import { gerarAcessoFormando } from "./areaFormando.js";
import { config } from "./config.js";
import { carimboUtc } from "./datas.js";
import { logLeadEvent } from "./crmDossier.js";
import type { Db } from "./db/pool.js";
import { renderAutomaticEmail } from "./emailHtml.js";
import { pedirFaturacaoSeFalta } from "./faturacao.js";
import { InscricaoErro, garantirVaga, recontarTurma } from "./inscricao.js";
import { sendMail } from "./mailer.js";
import { newPublicId, nextOpsId } from "./ops.js";
import { PercursoErro, ligarPreinscricaoAoFormandoGold, validarPreinscricao } from "./percurso.js";
import { readPreinscricaoPii, writeFormandoPiiPatch } from "./pii.js";
import {
  formandoGoldNaTurma, inserirFormandoGoldPago, leadComPagamentoPedido, leadCompleto, libertarConclusao, nomeDoFormando,
  pagamentoDoLead, pagamentoBasico, reservarConclusao, turmaGoldParaInscricao,
} from "./repos/formandosInscricao.js";
import { isEmail, normalizeEmail } from "./security.js";

/**
 * Fim do percurso Gold pago: com o pagamento confirmado (comprovativo validado, webhook ou
 * secretaria), a pré-inscrição valida-se, cria-se a ficha de formando na turma escolhida e a conta
 * da área do formando, e a pessoa recebe o email com o acesso. Seguro de repetir.
 */

/** Pré-inscrição Gold cujo pagamento foi pedido pela secretaria e está ligado a este pagamento. */
export async function leadDoPagamentoPedido(db: Db, pagamentoId: string) {
  const r = await leadComPagamentoPedido(db, pagamentoId);
  return r ? Number(r.id) : null;
}

async function criarFormandoGoldDoLead(db: Db, lead: Record<string, unknown>, turmaId: number, pagamento: { valor: number; metodo: string }) {
  const email = normalizeEmail(String(lead.email ?? ""));
  const existente = await formandoGoldNaTurma(db, email, turmaId);
  if (existente) return Number(existente.id);
  const t = await turmaGoldParaInscricao(db, turmaId);
  if (!t) throw new PercursoErro("A turma escolhida já não existe.");
  const telf = readPreinscricaoPii(lead).telf || String(lead.telf ?? "");
  const pii = writeFormandoPiiPatch({ telf });
  const id = await nextOpsId(db);
  await db.tx(async q => {
    await garantirVaga(q, "gold", turmaId, { email });
    await inserirFormandoGoldPago(q, {
      id, nome: String(lead.nome ?? ""), apelido: String(lead.apelido ?? ""), telf: pii.telf, email, inscrito: carimboUtc(),
      local: t.local, curso: t.curso, turma: t.nome, turmaId, valor: pagamento.valor,
      metodo: pagamento.metodo || "Transferência bancária", piiEnc: pii.pii_enc ?? "", publicId: newPublicId(),
    });
    await recontarTurma(q, "gold", turmaId);
  });
  return id;
}

/** Email com o acesso à área do formando. A palavra-passe só existe aqui (nunca fica gravada em claro). */
export async function enviarEmailAcesso(db: Db, input: { email: string; nome: string; curso: string; password?: string; pago: boolean }) {
  const href = `${config.appOrigin.replace(/\/$/, "")}/area-formando`;
  const linhas = [
    input.pago
      ? `O pagamento de ${input.curso} está confirmado e a sua inscrição está concluída.`
      : `A sua inscrição em ${input.curso} está concluída.`,
    "Já pode entrar na área do formando, onde encontra o curso, a agenda e os documentos.",
    `Utilizador: ${input.email}`,
    input.password
      ? `Palavra-passe temporária: ${input.password} (vai ser pedida uma nova no primeiro acesso).`
      : "Entre com a palavra-passe que já usa na área do formando. Se não se lembrar, use «Esqueci-me da palavra-passe».",
  ];
  const mail = renderAutomaticEmail({
    nome: input.nome, xml: "", linhas, cta: "Entrar na área do formando", href,
    vars: { nome: input.nome, curso: input.curso }, origin: config.appOrigin,
  });
  await sendMail(db, {
    to: input.email,
    name: input.nome,
    subject: input.pago ? `Pagamento confirmado · acesso a ${input.curso}` : `Inscrição concluída · acesso a ${input.curso}`,
    text: mail.text,
    html: mail.html,
  });
}

/** Cria (ou liga) a conta do formando e envia o email de acesso. */
export async function darAcessoAoFormando(db: Db, regime: "gold" | "fin", formandoId: number, curso: string, pago: boolean) {
  const acesso = await gerarAcessoFormando(db, regime, formandoId, false);
  if ("erro" in acesso) return { enviado: false as const, erro: acesso.erro };
  const f = await nomeDoFormando(db, regime, formandoId);
  const nome = `${f?.nome ?? ""} ${f?.apelido ?? ""}`.trim() || acesso.email;
  try {
    await enviarEmailAcesso(db, { email: acesso.email, nome, curso, password: acesso.password, pago });
  } catch (err) {
    // A ficha e a conta já existem: a falha do email não pode desfazer a inscrição nem dar 500.
    console.error("email de acesso falhou", err);
    return { enviado: false as const, erro: "o email de acesso falhou; gere de novo o acesso na ficha do formando." };
  }
  return { enviado: true as const, criado: acesso.criado };
}

/**
 * Conclui a inscrição paga, uma vez de cada vez por pré-inscrição: com dois pedidos ao mesmo tempo (a reentrega
 * do webhook e a confirmação, ou duas reentregas), o segundo não repete nada; com a inscrição já concluída também não.
 */
export async function aposPagamentoConfirmado(db: Db, pagamentoId: string, actorId?: string) {
  const leadId = await leadDoPagamentoPedido(db, pagamentoId);
  if (!leadId) return null;
  if (!(await reservarConclusao(db, leadId))) return { erro: "A inscrição está a ser concluída neste momento." };
  try {
    return await concluirComReserva(db, leadId, pagamentoId, actorId);
  } finally {
    await libertarConclusao(db, leadId).catch(() => undefined);
  }
}

async function concluirComReserva(db: Db, leadId: number, pagamentoId: string, actorId?: string) {
  // Lido depois da reserva: o que outro pedido acabou de concluir já se vê aqui.
  const lead = await leadCompleto(db, leadId);
  if (!lead || lead.estado === "Formando" || lead.estado === "Desistiu") return null;
  const email = normalizeEmail(String(lead.email ?? ""));
  if (!isEmail(email)) return null;
  try {
    // A ficha nasce na turma cujo preço foi pedido; outra turma só a secretaria a escolhe (e aí a turma paga acompanha).
    const turmaPaga = Number(lead.pagamento_turma_id || 0);
    if (turmaPaga && turmaPaga !== Number(lead.turma_escolhida_id || 0)) {
      throw new PercursoErro("A turma mudou depois de o pagamento ser pedido: a secretaria tem de confirmar a turma e o valor antes de concluir.");
    }
    if (!lead.validada_em) await validarPreinscricao(db, leadId, actorId);
    const turmaId = Number(lead.turma_escolhida_id || 0);
    if (!turmaId) throw new PercursoErro("A pré-inscrição não tem turma escolhida.");
    const pag = await pagamentoBasico(db, pagamentoId);
    const formandoId = await criarFormandoGoldDoLead(db, lead, turmaId, {
      valor: Number(pag?.valor ?? lead.preco) || 0,
      metodo: String(pag?.metodo ?? ""),
    });
    await ligarPreinscricaoAoFormandoGold(db, formandoId, actorId);
    const acesso = await darAcessoAoFormando(db, "gold", formandoId, String(lead.curso ?? ""), true);
    await logLeadEvent(db, leadId, actorId, "seguimento", "Inscrição concluída",
      acesso.enviado ? "Ficha de formando e acesso à área do formando enviados por email." : `Ficha criada. Acesso não enviado: ${acesso.erro}`);
    // Inscrição concluída: segue o pedido dos dados de faturação (uma vez; a falha não desfaz a inscrição).
    await pedirFaturacaoSeFalta(db, leadId, actorId).catch(() => undefined);
    return { formandoId, acesso };
  } catch (err) {
    const msg = err instanceof PercursoErro || err instanceof InscricaoErro ? err.message : "erro inesperado";
    await logLeadEvent(db, leadId, actorId, "seguimento", "Pagamento confirmado · inscrição por concluir", msg);
    if (!(err instanceof PercursoErro || err instanceof InscricaoErro)) throw err;
    return { erro: msg };
  }
}

/**
 * A secretaria volta a concluir uma inscrição paga que ficou a meio (turma cheia, Drive em baixo...).
 * Só com o pagamento do percurso já confirmado; o resto é o mesmo passo, seguro de repetir.
 */
export async function concluirInscricaoPaga(db: Db, leadId: number, actorId?: string) {
  const pag = await pagamentoDoLead(db, leadId);
  if (!pag) throw new PercursoErro("Esta pré-inscrição não tem pagamento pedido no percurso.");
  if (!/^pago$/i.test(pag.estado)) throw new PercursoErro("O pagamento ainda não está confirmado.");
  const r = await aposPagamentoConfirmado(db, pag.id, actorId);
  if (!r) throw new PercursoErro("A inscrição já está concluída ou a pré-inscrição foi encerrada.");
  if ("erro" in r) throw new PercursoErro(r.erro);
  return r;
}
