/**
 * Validação da pré-inscrição pela secretaria, sugestão por turma cheia e ligação ao formando Gold.
 * Separado de `percurso.ts` (escolha pública e documentos).
 */
import { InscricaoErro, garantirVaga } from "./inscricao.js";
import * as docsRepo from "./repos/leadDocs.js";
import { apagarFicheiroSubstituido } from "./driveFicheiros.js";
import { ingestEvent } from "./automations.js";
import { transferirDocsDoLead } from "./docsParaFormando.js";
import { config } from "./config.js";
import type { Db } from "./db/pool.js";
import { docsDoCurso, faltaValidarPreinscricao, situacaoPagamento } from "./docsCurso.js";
import { documentosUrl, ensureDocsToken, listarDocsLead } from "./docsLink.js";
import { idsRecusados } from "./lembretePre.js";
import { renderAutomaticEmail } from "./emailHtml.js";
import { moverPastaFormando } from "./driveArvore.js";
import { sendMail } from "./mailer.js";
import { isEmail, normalizeEmail } from "./security.js";
import { PercursoErro, evento, norm, regimeDe, sugestoesTurmaCheia, turmaPorId } from "./percurso.js";
import * as leads from "./repos/leads.js";
import * as repo from "./repos/percurso.js";

export async function moverDocsDoLead(db: Db, leadId: number, turmaId: number) {
  const row = await leads.lead(db, leadId);
  if (!row) return { moved: 0 };
  const regime = regimeDe(row.regime);
  const turma = await turmaPorId(db, regime, turmaId);
  if (!turma) return { moved: 0 };
  if (!row.validada_em) return { moved: 0, turma: turma.nome };
  const r = await moverPastaFormando(db, leadId, regime, turma.id);
  return { moved: r.moved ? 1 : 0, turma: r.turma || turma.nome };
}

export async function moverDocsParaTurma(db: Db, input: {
  email: string;
  turmaId: number;
  curso?: string;
  regime: "gold" | "fin";
}) {
  const email = normalizeEmail(input.email);
  if (!isEmail(email)) return { moved: 0 };
  let moved = 0;
  for (const lead of await repo.leadsDoEmail(db, email, input.regime)) {
    if (input.curso && norm(lead.curso) !== norm(input.curso)) continue;
    const r = await moverDocsDoLead(db, lead.id, input.turmaId);
    moved += r.moved;
    await repo.mudarTurmaDoLead(db, lead.id, input.turmaId);
  }
  return { moved };
}

export async function validarPreinscricao(db: Db, leadId: number, actorId?: string, turmaDestinoId?: number) {
  const row = await leads.lead(db, leadId);
  if (!row) throw new PercursoErro("Pré-inscrição inexistente.");
  const regime = regimeDe(row.regime);
  const pedidos = await docsDoCurso(db, String(row.curso ?? ""), regime);
  const ficheiros = await listarDocsLead(db, leadId);
  let turmaId = Number(row.turma_escolhida_id || 0);
  const transferir = Boolean(turmaDestinoId && turmaDestinoId !== turmaId);
  if (transferir && turmaDestinoId) {
    const cursoDestino = String((await leads.cursoDaTurma(db, regime, turmaDestinoId))?.curso ?? "");
    if (!cursoDestino || norm(cursoDestino) !== norm(String(row.curso ?? ""))) {
      throw new PercursoErro("A turma de destino é de outro curso.");
    }
    turmaId = turmaDestinoId;
  }
  const turma = turmaId ? await turmaPorId(db, regime, turmaId) : null;
  const falta = faltaValidarPreinscricao({
    validada: Boolean(row.validada_em),
    concluido: Boolean(row.percurso_concluido_em),
    turma,
    pedidos,
    ficheiros,
    pagamento: (await situacaoPagamento(db, row)).estado,
    turmaPelaSecretaria: regime === "fin",
  });
  if (falta) throw new PercursoErro(falta);
  if (regime === "fin" && !turmaId) throw new PercursoErro("Escolha a turma onde colocar o formando.");
  if (regime === "fin" && turma && turma.livres <= 0) throw new PercursoErro("A turma escolhida está cheia.");
  if (turmaId) {
    // Financiada: a validação cria a ficha. Gold: a validação reserva a vaga até a secretaria inscrever.
    const email = normalizeEmail(String(row.email ?? ""));
    const existente = email ? await repo.formandoNaTurma(db, regime, email, turmaId) : null;
    try {
      await db.tx(q => garantirVaga(q, regime, turmaId, { email, excluirFormandoId: existente ?? undefined }));
    } catch (err) {
      if (err instanceof InscricaoErro) throw new PercursoErro(err.message);
      throw err;
    }
  }
  // Os documentos recusados que ficaram por substituir estavam errados: saem antes de a pasta passar para a turma,
  // para nunca chegarem à ficha do formando nem ao DTP (um ficheiro partilhado com outro registo fica na Drive).
  for (const r of await docsRepo.apagarRecusados(db, leadId)) {
    if (r.drive_file_id && !(await docsRepo.ficheiroEmOutroSitio(db, r.drive_file_id, leadId))) {
      await apagarFicheiroSubstituido(db, r.drive_file_id).catch(() => undefined);
    }
  }
  let moved: { moved: number; turma?: string };
  try {
    const pasta = await moverPastaFormando(db, leadId, regime, turmaId);
    moved = { moved: pasta.moved ? 1 : 0, turma: pasta.turma };
  } catch (err) {
    throw new PercursoErro(err instanceof Error ? err.message : "Não foi possível mover a pasta na Drive.");
  }
  if (transferir) await repo.mudarTurmaDoLead(db, leadId, turmaId);
  await repo.marcarValidada(db, leadId);
  await evento(db, leadId, actorId, "Pré-inscrição validada", moved.turma ? `Pasta do formando em ${moved.turma}` : "");
  const emailValidado = normalizeEmail(String(row.email ?? ""));
  if (isEmail(emailValidado)) {
    await ingestEvent(db, "preinscricao.validated", {
      email: emailValidado,
      nome: `${row.nome ?? ""} ${row.apelido ?? ""}`.trim(),
      curso: String(row.curso ?? ""),
      turma: turma?.nome ?? moved.turma ?? "-",
      preinscricaoId: leadId,
    }, `validated:${leadId}`).catch(() => undefined);
  }
  if (regime === "gold" && isEmail(emailValidado)) {
    // Se a secretaria já tinha criado a ficha numa turma deste curso, liga-a agora (e os documentos passam).
    const fichaId = await repo.formandoGoldDoCurso(db, emailValidado, String(row.curso ?? ""));
    if (fichaId) await ligarPreinscricaoAoFormandoGold(db, fichaId, actorId).catch(() => undefined);
  }
  let fichaErro: string | undefined;
  if (regime === "fin") {
    const { upsertFormandoFinFromLead } = await import("./finPipeline.js");
    const ficha = await upsertFormandoFinFromLead(db, leadId, actorId).catch(err => {
      console.warn(`[percurso] ficha financiada do lead ${leadId} não criada:`, err instanceof Error ? err.message : err);
      fichaErro = err instanceof InscricaoErro || err instanceof PercursoErro ? err.message : "erro inesperado";
      return null;
    });
    // A validação já ficou feita: a falha tem de aparecer no dossiê e na resposta, não só no log do servidor.
    if (!ficha?.formandoId) {
      fichaErro ??= "a ficha não foi criada";
      await evento(db, leadId, actorId, "Ficha de formando por criar", `${fichaErro}. Crie a ficha à mão na turma.`);
    }
    // Financiada (sem pagamento): a conta da área do formando e o email de acesso saem com a validação.
    if (ficha?.formandoId) {
      const { darAcessoAoFormando } = await import("./inscricaoPaga.js");
      const acesso = await darAcessoAoFormando(db, "fin", Number(ficha.formandoId), String(row.curso ?? ""), false)
        .catch(err => ({ enviado: false as const, erro: err instanceof Error ? err.message : "erro" }));
      await evento(db, leadId, actorId, "Acesso à área do formando", acesso.enviado ? "Enviado por email." : `Não enviado: ${acesso.erro}`);
    }
  }
  return { ok: true as const, moved: moved.moved, ...(fichaErro ? { aviso: `Validada, mas a ficha de formando não foi criada: ${fichaErro}.` } : {}) };
}

function fmtData(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso;
}

export async function enviarSugestaoTurmaCheia(db: Db, leadId: number, actorId?: string) {
  const row = await leads.lead(db, leadId);
  if (!row) throw new PercursoErro("Pré-inscrição inexistente.");
  if (row.validada_em) throw new PercursoErro("A pré-inscrição já foi validada.");
  const email = normalizeEmail(String(row.email ?? ""));
  if (!isEmail(email)) throw new PercursoErro("A ficha não tem email.");
  const regime = regimeDe(row.regime);
  if (regime === "fin") throw new PercursoErro("Na formação financiada a secretaria escolhe outra turma ao validar.");
  const curso = String(row.curso ?? "");
  const turmaId = Number(row.turma_escolhida_id || row.turma_id || 0);
  const turma = turmaId ? await turmaPorId(db, regime, turmaId) : null;
  const local = turma?.local || String(row.local ?? "");
  const horario = turma?.horario || String(row.horario ?? "");
  if (!local.trim()) throw new PercursoErro("Indique o local da pré-inscrição para sugerir outra turma.");
  const jaRecusadas = new Set(idsRecusados(row.turmas_recusadas));
  const sugestoes = (await sugestoesTurmaCheia(db, curso, regime, local, horario, turmaId))
    .filter(t => !jaRecusadas.has(t.id));
  const token = await ensureDocsToken(db, leadId);
  const url = `${documentosUrl(token)}?passo=cronograma`;
  const nome = `${row.nome ?? ""} ${row.apelido ?? ""}`.trim();
  const linhas = [
    `A turma de ${curso} em ${local} já não tem vaga.`,
    sugestoes.length
      ? "Estas são as próximas turmas do mesmo curso, no mesmo local, no mesmo horário ou noutro horário:"
      : "Neste momento não há outra turma com vaga nesse local. A secretaria avisa quando abrir uma data.",
    ...sugestoes.map(t => `${t.nome} · ${t.horario} · início ${fmtData(t.dataInicio)} · ${t.livres} vaga${t.livres === 1 ? "" : "s"}`),
    "A ligação pessoal continua aberta para escolher outro cronograma.",
  ];
  const mail = renderAutomaticEmail({
    nome, xml: "", linhas, cta: "Escolher outro cronograma", href: url,
    vars: { nome, curso, documentos_url: url }, origin: config.appOrigin,
  });
  await sendMail(db, { to: email, name: nome, subject: `Turma cheia · outras datas de ${curso}`, text: mail.text, html: mail.html });
  await repo.recusarTurmaCheia(db, leadId, turmaId);
  await evento(db, leadId, actorId, "Sugestão por turma cheia", sugestoes.map(t => t.nome).join(", ") || "Sem turmas com vaga");
  return { ok: true as const, enviadas: sugestoes.length, turmas: sugestoes };
}

/**
 * Gold (validação manual): quando a secretaria cria a ficha do formando, liga-a à pré-inscrição
 * validada do mesmo email e curso — o lead passa a «Formando», o pagamento fica associado e
 * os documentos validados passam para o dossiê. A reserva da vaga deixa de contar.
 */
export async function ligarPreinscricaoAoFormandoGold(db: Db, formandoId: number, actorId?: string) {
  // Só um formando colocado numa turma conta: o curso é o da turma.
  const formando = await repo.formandoGoldComTurma(db, formandoId);
  const email = normalizeEmail(formando?.email ?? "");
  if (!formando || formando.turma_id == null || !isEmail(email)) return null;
  const row = await repo.leadValidadoDoCurso(db, email, formando.curso);
  if (!row) return null;
  await repo.passarAFormando(db, row.id, formando.turma_id);
  // Os ficheiros da ligação pessoal vivem no dossiê da turma onde a pessoa ficou mesmo inscrita.
  if (Number(row.turma_escolhida_id) !== Number(formando.turma_id)) {
    await moverPastaFormando(db, row.id, "gold", formando.turma_id).catch(() => undefined);
  }
  if (row.pagamento_id) {
    const pag = await repo.ligarPagamentoAoFormando(db, row.pagamento_id, formandoId, formando.turma_id);
    if (/^pago$/i.test(pag?.estado ?? "")) {
      await repo.marcarFormandoGoldPago(db, formandoId, pag?.metodo || "Transferência bancária");
    }
  }
  await transferirDocsDoLead(db, row.id, actorId);
  await evento(db, row.id, actorId, "Inscrito na turma", `Ficha de formando #${formandoId}`);
  return { leadId: row.id };
}
