import { transferirDocsDoLead } from "./docsParaFormando.js";
import { garantirVaga, recontar, recontarTurma } from "./inscricao.js";
import type { Db } from "./db/pool.js";
import { listarDocsLead } from "./docsLink.js";
import { nextOpsId, newPublicId } from "./ops.js";
import { readFormandoDocs, writeFormandoDocs, writeFormandoPiiPatch } from "./pii.js";
import {
  actualizarFormandoFin, docsValidosFin, formandoFinParaLembrete, formandoFinPorEmail, gravarDocsFin, inserirFormandoFin,
  marcarLeadFormando, notaDoSistemaFin, preinscricaoCompleta, turmaDoFormandoFin, turmaFinPorId, turmaFinPorNome, turmasFinDoCurso,
} from "./repos/finPipeline.js";
import { logLeadEvent } from "./crmDossier.js";
import { isEmail, normalizeEmail } from "./security.js";

const DOC_KEYS = ["cc", "ch", "cu", "morada", "ci", "ce", "contrato", "rgpd"] as const;

function vazioDoc() {
  return { ok: false, data: "" };
}

function asObj(v: unknown) {
  if (v && typeof v === "object") return v as Record<string, unknown>;
  return {};
}

function docDeJson(docs: Record<string, unknown>, key: string) {
  const d = asObj(docs[key]);
  return { ok: Boolean(d.ok), data: String(d.data ?? "") };
}

function docsFromInscricaoPips(pips: Record<string, boolean | undefined>) {
  const map: Record<string, boolean> = {
    cc: Boolean(pips.cc),
    ch: Boolean(pips.ch),
    cu: Boolean(pips.cu),
    ci: Boolean(pips.ci),
    ce: Boolean(pips.ce),
  };
  const hoje = new Date().toISOString().slice(0, 10);
  const out: Record<string, { ok: boolean; data: string }> = {};
  for (const k of DOC_KEYS) {
    const pip = map[k];
    out[k] = pip ? { ok: true, data: hoje } : vazioDoc();
  }
  return out;
}

async function turmaPorNomeOuId(db: Db, turma: string, curso: string) {
  const nome = turma.trim();
  if (nome && nome !== "-") {
    const porNome = await turmaFinPorNome(db, nome);
    if (porNome) return porNome;
  }
  const c = curso.trim();
  if (!c) return null;
  const porCurso = await turmasFinDoCurso(db, c);
  return porCurso.length === 1 ? porCurso[0]! : null;
}

async function mergeDocsJson(
  db: Db,
  formandoId: number,
  base: Record<string, { ok: boolean; data: string }>,
) {
  const out = { ...base };
  for (const r of await docsValidosFin(db, formandoId)) {
    if (r.ok) out[r.doc_id] = { ok: true, data: String(r.data ?? "").slice(0, 10) || new Date().toISOString().slice(0, 10) };
  }
  return out;
}

export async function upsertFormandoFinFromLead(db: Db, leadId: number, actorId?: string) {
  const row = await preinscricaoCompleta(db, leadId);
  if (!row) return null;
  if (String(row.regime ?? "gold") !== "fin") return null;

  const email = normalizeEmail(String(row.email ?? ""));
  const turmaId = Number(row.turma_escolhida_id || row.turma_id || 0);
  let turma: { id: number; nome: string; curso: string } | null = null;
  if (turmaId) {
    turma = await turmaFinPorId(db, turmaId);
  }
  if (!turma) {
    const curso = String(row.curso ?? "").trim();
    const local = String(row.local ?? "").trim();
    const horario = String(row.horario ?? "").trim();
    if (curso) {
      const q = await turmasFinDoCurso(db, curso, local, horario);
      if (q.length === 1) turma = q[0]!;
    }
  }
  if (!turma) {
    turma = await turmaPorNomeOuId(db, "", String(row.curso ?? ""));
  }
  const turmaNome = turma?.nome ?? (turmaId ? `Turma #${turmaId}` : "-");
  const curso = String(turma?.curso ?? row.curso ?? "");

  const found = email ? await formandoFinPorEmail(db, email) : null;

  let id = found?.id;
  const estado = "Elegível";
  const docsBase = docsFromInscricaoPips({});
  if (!id) {
    id = await nextOpsId(db);
    const docPack = writeFormandoDocs(docsBase as Record<string, unknown>);
    const piiPack = writeFormandoPiiPatch({ telf: String(row.telf ?? "") });
    const tid = turma?.id ?? (turmaId || null);
    await db.tx(async q => {
      if (tid) await garantirVaga(q, "fin", tid, { email });
      await inserirFormandoFin(q, {
        id: id!,
        nome: String(row.nome ?? ""),
        apelido: String(row.apelido ?? ""),
        turma: turmaNome,
        turmaId: turma?.id ?? (turmaId || null),
        telf: piiPack.telf || String(row.telf ?? ""),
        email,
        curso,
        estado,
        docs: docPack.docs,
        docsEnc: docPack.docs_enc,
        piiEnc: piiPack.pii_enc ?? "",
        publicId: newPublicId(),
      });
      await recontarTurma(q, "fin", tid);
    });
    await logLeadEvent(db, leadId, actorId, "estado", "Formando financiado criado", `Ficha #${id} · ${turmaNome}`);
    const { ensureFinDocsToken } = await import("./formandoFinDocs.js");
    await ensureFinDocsToken(db, id);
  } else {
    const existente = id;
    const antes = await turmaDoFormandoFin(db, existente);
    const tid = turma?.id ?? null;
    await db.tx(async q => {
      if (tid && tid !== antes) await garantirVaga(q, "fin", tid, { email, excluirFormandoId: existente });
      await actualizarFormandoFin(q, existente, {
        nome: String(row.nome ?? ""), apelido: String(row.apelido ?? ""), turma: turmaNome, turmaId: tid,
        telf: String(row.telf ?? ""), curso, estado,
      });
    });
    await recontar(db, "fin", antes, tid);
    await logLeadEvent(db, leadId, actorId, "estado", "Formando financiado actualizado", `Ficha #${id} · ${turmaNome}`);
  }

  await transferirDocsDoLead(db, leadId, actorId);
  const merged = await mergeDocsJson(db, id, docsBase);
  const docPack = writeFormandoDocs(merged);
  await gravarDocsFin(db, id, docPack.docs, docPack.docs_enc);
  await marcarLeadFormando(db, leadId);
  return { formandoId: id, turmaId: turma?.id ?? null };
}

export async function upsertFormandoFinFromInscricao(db: Db, payload: Record<string, unknown>) {
  const estado = String(payload.estado ?? "").trim();
  if (estado !== "Colocado na turma" && estado !== "Elegível") return null;

  const email = normalizeEmail(String(payload.email ?? ""));
  const curso = String(payload.curso ?? "").trim();
  const turmaTxt = String(payload.turma ?? "").trim();
  const turma = await turmaPorNomeOuId(db, turmaTxt, curso);
  const docsPips = asObj(payload.docs);
  const docsBase = docsFromInscricaoPips({
    cc: Boolean(docsPips.cc),
    ch: Boolean(docsPips.ch),
    cu: Boolean(docsPips.cu),
    ci: Boolean(docsPips.ci),
    ce: Boolean(docsPips.ce),
  });

  const found = email ? await formandoFinPorEmail(db, email) : null;

  let id = found?.id;
  const finEstado = estado === "Colocado na turma" ? "Colocado na turma" : "Elegível";

  if (!id) {
    id = await nextOpsId(db);
    const tid = turma?.id ?? null;
    await db.tx(async q => {
      if (tid) await garantirVaga(q, "fin", tid, { email });
      await inserirFormandoFin(q, {
        id: id!,
        nome: String(payload.nome ?? ""),
        apelido: String(payload.apelido ?? ""),
        turma: (turma?.nome ?? turmaTxt) || "-",
        turmaId: turma?.id ?? null,
        telf: String(payload.telf ?? ""),
        email,
        curso: turma?.curso ?? curso,
        estado: finEstado,
        docs: docsBase,
        publicId: newPublicId(),
      });
      await recontarTurma(q, "fin", tid);
    });
  } else {
    const prev = found ? readFormandoDocs(found as unknown as Record<string, unknown>) : {};
    const merged: Record<string, { ok: boolean; data: string }> = {};
    for (const k of DOC_KEYS) {
      const fromPip = docsBase[k];
      const fromPrev = docDeJson(prev, k);
      merged[k] = fromPip.ok ? fromPip : fromPrev;
    }
    const existente = id;
    const antes = await turmaDoFormandoFin(db, existente);
    const tid = turma?.id ?? null;
    if (tid && tid !== antes) {
      await db.tx(q => garantirVaga(q, "fin", tid, { email, excluirFormandoId: existente }));
    }
    await actualizarFormandoFin(db, id, {
      nome: String(payload.nome ?? ""),
      apelido: String(payload.apelido ?? ""),
      turma: (turma?.nome ?? turmaTxt) || "-",
      turmaId: turma?.id ?? null,
      telf: String(payload.telf ?? ""),
      curso: turma?.curso ?? curso,
      estado: finEstado,
      docs: merged,
    });
    await recontar(db, "fin", antes, tid);
  }
  return { formandoId: id };
}

export async function enviarLembreteDocsFin(db: Db, formandoId: number, actorId?: string) {
  const f = await formandoFinParaLembrete(db, formandoId);
  if (!f) return { enviado: false as const, erro: "Formando inexistente." };
  const email = normalizeEmail(f.email);
  if (!isEmail(email)) return { enviado: false as const, erro: "Email inválido na ficha." };

  const docs = readFormandoDocs(f as unknown as Record<string, unknown>);
  const labels: Record<string, string> = {
    cc: "Cartão de Cidadão",
    ch: "Certificado de habilitações",
    cu: "Curriculum vitae",
    morada: "Comprovativo de morada",
    ci: "IBAN / comprovativo de NIB",
    ce: "Comprovativo de situação perante o emprego",
    contrato: "Contrato de formação",
    rgpd: "Declaração RGPD",
  };
  const emFalta = DOC_KEYS.filter(k => !docDeJson(docs, k).ok).map(k => labels[k] ?? k);
  if (!emFalta.length) return { enviado: false as const, erro: "Todos os documentos obrigatórios já estão validados." };

  const { sendMail } = await import("./mailer.js");
  const { renderAutomaticEmail } = await import("./emailHtml.js");
  const { config } = await import("./config.js");
  const nome = `${f.nome} ${f.apelido}`.trim();
  const { ensureFinDocsToken, formandoFinDocsUrl } = await import("./formandoFinDocs.js");
  const token = await ensureFinDocsToken(db, formandoId);
  const portalUrl = formandoFinDocsUrl(token);
  const linhas = [
    `Olá ${f.nome},`,
    "",
    `Para concluir a inscrição na formação ${f.curso} faltam os seguintes documentos:`,
    ...emFalta.map(d => `· ${d}`),
    "",
    "Use o botão para enviar um ficheiro de cada vez na área segura. Se a secretaria tiver recusado algum documento, só poderá reenviar esses.",
  ];
  const mail = renderAutomaticEmail({
    nome,
    xml: "",
    linhas,
    cta: "Enviar documentos",
    href: portalUrl,
    vars: { nome, curso: f.curso },
    origin: config.appOrigin,
  });
  await sendMail(db, {
    to: email,
    name: nome,
    subject: `Documentos em falta · ${f.curso}`,
    text: mail.text,
    html: mail.html,
  });
  await notaDoSistemaFin(db, formandoId, actorId ?? null, `Lembrete de documentos enviado (${emFalta.length} em falta).`);
  return { enviado: true as const };
}
