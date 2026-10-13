import { gerarAcessoFormando } from "./areaFormando.js";
import { config } from "./config.js";
import { logLeadEvent } from "./crmDossier.js";
import type { Db } from "./db/pool.js";
import { renderAutomaticEmail } from "./emailHtml.js";
import { InscricaoErro, garantirVaga, recontarTurma } from "./inscricao.js";
import { sendMail } from "./mailer.js";
import { newPublicId, nextOpsId } from "./ops.js";
import { PercursoErro, ligarPreinscricaoAoFormandoGold, validarPreinscricao } from "./percurso.js";
import { readPreinscricaoPii, writeFormandoPiiPatch } from "./pii.js";
import { isEmail, normalizeEmail } from "./security.js";

/**
 * Fim do percurso Gold pago: com o pagamento confirmado (comprovativo validado, webhook ou
 * secretaria), a pré-inscrição valida-se, cria-se a ficha de formando na turma escolhida e a conta
 * da área do formando, e a pessoa recebe o email com o acesso. Seguro de repetir.
 */

function nowStamp() {
  return new Date().toISOString().slice(0, 16).replace("T", " ");
}

/** Pré-inscrição Gold cujo pagamento foi pedido pela secretaria e está ligado a este pagamento. */
export async function leadDoPagamentoPedido(db: Db, pagamentoId: string) {
  const r = await db.query<{ id: number }>(
    `SELECT id FROM preinscricoes
      WHERE pagamento_id = $1 AND COALESCE(regime, 'gold') = 'gold' AND pagamento_pedido_em IS NOT NULL
      ORDER BY id DESC LIMIT 1`,
    [pagamentoId],
  );
  return r.rows[0] ? Number(r.rows[0].id) : null;
}

async function criarFormandoGoldDoLead(db: Db, lead: Record<string, unknown>, turmaId: number, pagamento: { valor: number; metodo: string }) {
  const email = normalizeEmail(String(lead.email ?? ""));
  const existente = await db.query<{ id: number }>(
    "SELECT id FROM formandos_gold WHERE lower(trim(email)) = $1 AND turma_id = $2 ORDER BY id DESC LIMIT 1",
    [email, turmaId],
  );
  if (existente.rows[0]) return Number(existente.rows[0].id);
  const turma = await db.query<{ nome: string; curso: string; local: string }>(
    "SELECT nome, curso, local FROM turmas_gold WHERE id = $1",
    [turmaId],
  );
  const t = turma.rows[0];
  if (!t) throw new PercursoErro("A turma escolhida já não existe.");
  const telf = readPreinscricaoPii(lead).telf || String(lead.telf ?? "");
  const pii = writeFormandoPiiPatch({ telf });
  const id = await nextOpsId(db);
  await db.tx(async q => {
    await garantirVaga(q, "gold", turmaId, { email });
    await q(
      `INSERT INTO formandos_gold (id, nome, apelido, telf, email, inscrito, local, curso, turma, turma_id, estado, pago, valor, metodo, pii_enc, public_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'Formando',true,$11,$12,$13,$14)`,
      [
        id, String(lead.nome ?? ""), String(lead.apelido ?? ""), pii.telf || telf, email, nowStamp(),
        t.local, t.curso, t.nome, turmaId, pagamento.valor, pagamento.metodo || "Transferência bancária",
        pii.pii_enc ?? "", newPublicId(),
      ],
    );
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
  const tabela = regime === "fin" ? "formandos_fin" : "formandos_gold";
  const f = await db.query<{ nome: string; apelido: string }>(`SELECT nome, apelido FROM ${tabela} WHERE id = $1`, [formandoId]);
  const nome = `${f.rows[0]?.nome ?? ""} ${f.rows[0]?.apelido ?? ""}`.trim() || acesso.email;
  await enviarEmailAcesso(db, { email: acesso.email, nome, curso, password: acesso.password, pago });
  return { enviado: true as const, criado: acesso.criado };
}

export async function aposPagamentoConfirmado(db: Db, pagamentoId: string, actorId?: string) {
  const leadId = await leadDoPagamentoPedido(db, pagamentoId);
  if (!leadId) return null;
  const r = await db.query("SELECT * FROM preinscricoes WHERE id = $1", [leadId]);
  const lead = r.rows[0] as Record<string, unknown> | undefined;
  if (!lead || lead.estado === "Formando" || lead.estado === "Desistiu") return null;
  const email = normalizeEmail(String(lead.email ?? ""));
  if (!isEmail(email)) return null;
  try {
    if (!lead.validada_em) await validarPreinscricao(db, leadId, actorId);
    const turmaId = Number(lead.turma_escolhida_id || 0);
    if (!turmaId) throw new PercursoErro("A pré-inscrição não tem turma escolhida.");
    const pag = await db.query<{ valor: number; metodo: string }>("SELECT valor, metodo FROM pagamentos WHERE id = $1", [pagamentoId]);
    const formandoId = await criarFormandoGoldDoLead(db, lead, turmaId, {
      valor: Number(pag.rows[0]?.valor ?? lead.preco) || 0,
      metodo: String(pag.rows[0]?.metodo ?? ""),
    });
    await ligarPreinscricaoAoFormandoGold(db, formandoId, actorId);
    const acesso = await darAcessoAoFormando(db, "gold", formandoId, String(lead.curso ?? ""), true);
    await logLeadEvent(db, leadId, actorId, "seguimento", "Inscrição concluída",
      acesso.enviado ? "Ficha de formando e acesso à área do formando enviados por email." : `Ficha criada. Acesso não enviado: ${acesso.erro}`);
    return { formandoId, acesso };
  } catch (err) {
    const msg = err instanceof PercursoErro || err instanceof InscricaoErro ? err.message : "erro inesperado";
    await logLeadEvent(db, leadId, actorId, "seguimento", "Pagamento confirmado · inscrição por concluir", msg);
    if (!(err instanceof PercursoErro || err instanceof InscricaoErro)) throw err;
    return { erro: msg };
  }
}
