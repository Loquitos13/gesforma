import { transferirDocsDoLead } from "./docsParaFormando.js";
import { garantirVaga, recontar, recontarTurma } from "./inscricao.js";
import type { Db } from "./db/pool.js";
import { listarDocsLead } from "./docsLink.js";
import { nextOpsId, newPublicId } from "./ops.js";
import { readFormandoDocs, readFormandoPii, readPreinscricaoPii, writeFormandoDocs, writeFormandoPiiPatch, type IdentificacaoFin } from "./pii.js";
import { encryptField } from "./fieldCrypto.js";
import { dadosBancarios, gravarDadosBancarios } from "./repos/apoios.js";
import {
  COLUNAS_FINANCIAMENTO, financiamentoDoFormando, gravarFinanciamento, gravarPiiFormandoFin, piiFormandoFinParaGravar, type CampoTabela,
} from "./repos/formandoFinanciamento.js";
import {
  actualizarFormandoFin, docsValidosFin, formandoFinParaLembrete, formandoFinPorEmail, gravarDocsFin, inserirFormandoFin,
  marcarLeadFormando, notaDoSistemaFin, preinscricaoCompleta, turmaDoFormandoFin, turmaFinPorId, turmaFinPorNome, turmasFinDoCurso,
} from "./repos/finPipeline.js";
import { logLeadEvent } from "./crmDossier.js";
import { isEmail, normalizeEmail } from "./security.js";
import { hojeLisboa } from "./datas.js";

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
  const hoje = hojeLisboa();
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
    if (r.ok) out[r.doc_id] = { ok: true, data: String(r.data ?? "").slice(0, 10) || hojeLisboa() };
  }
  return out;
}

/**
 * Os dados pessoais da financiada (pacote cifrado da pré-inscrição: formulário público e ligação pessoal) passam
 * para a ficha do formando: NIF, NISS, data de nascimento, código postal e documento de identificação para o pacote
 * cifrado (Dados para o financiamento); género, nacionalidade, habilitações e situação face ao emprego à entrada e
 * NIF da entidade empregadora para a tabela do financiamento; o IBAN para os apoios (cifrado). Só preenche o que a
 * ficha ainda não tem: o que a secretaria já gravou nunca é substituído. Devolve os nomes dos campos (nunca os valores).
 */
export async function levarDadosPessoaisParaFicha(db: Db, row: Record<string, unknown>, formandoId: number, actorId?: string) {
  const pre = readPreinscricaoPii(row);
  const fin = pre.fin ?? {};
  const nifPre = String(pre.nif ?? "").replace(/\D/g, "");
  const cp = /(\d{4})\s*-?\s*(\d{3})/.exec(pre.codigoPostal ?? "");
  const cifrados: [keyof IdentificacaoFin, string][] = [
    ["nif", nifPre.length === 9 ? nifPre : ""],
    ["niss", fin.niss ?? ""],
    ["dataNascimento", fin.dataNascimento ?? ""],
    ["codigoPostal", cp ? `${cp[1]}-${cp[2]}` : ""],
    ["tipoDocumento", fin.tipoDocumento ?? ""],
    ["numeroDocumento", fin.numeroDocumento ?? ""],
    ["validadeDocumento", fin.validadeDocumento ?? ""],
    ["passaporte", fin.tipoDocumento === "Passaporte" ? fin.numeroDocumento ?? "" : ""],
  ];
  const candidatosTabela: [CampoTabela, string][] = [
    ["genero", fin.genero ?? ""],
    ["nacionalidade", fin.nacionalidade ?? ""],
    ["habilitacoesEntrada", fin.habilitacoesEntrada ?? ""],
    ["situacaoEmpregoEntrada", fin.situacaoEmpregoEntrada ?? ""],
    ["nifEntidadeEmpregadora", fin.nifEntidadeEmpregadora ?? ""],
  ];
  const banco = fin.iban ? (await dadosBancarios(db, [formandoId]))[0] : undefined;
  const iban = fin.iban && !banco?.iban_enc ? fin.iban : "";
  if (!cifrados.some(([, v]) => v) && !candidatosTabela.some(([, v]) => v) && !iban) return [] as string[];
  // A ficha lida e bloqueada dentro da transacção: o «só o que falta» decide-se sobre o que está gravado agora
  // e o pacote cifrado grava-se sobre essa cópia (uma gravação da secretaria ao mesmo tempo não se perde).
  return db.tx(async q => {
    const ficha = await piiFormandoFinParaGravar(q, formandoId);
    if (!ficha) return [] as string[];
    const prev = readFormandoPii({ pii_enc: ficha.pii_enc, telf: ficha.telf });
    const ident: IdentificacaoFin = { ...prev.ident };
    const levados: string[] = [];
    const identNovo = cifrados.filter(([k, v]) => v && !String(ident[k] ?? "").trim());
    for (const [k, v] of identNovo) { ident[k] = v; levados.push(k); }
    const linha = await financiamentoDoFormando(q, formandoId);
    const tabela: Partial<Record<CampoTabela, string>> = {};
    for (const [k, v] of candidatosTabela) {
      if (v && !String(linha?.[COLUNAS_FINANCIAMENTO[k]] ?? "").trim()) { tabela[k] = v; levados.push(k); }
    }
    if (iban) levados.push("iban");
    if (identNovo.length) await gravarPiiFormandoFin(q, formandoId, writeFormandoPiiPatch({ ident }, prev));
    if (Object.keys(tabela).length) await gravarFinanciamento(q, formandoId, tabela, actorId ?? null);
    if (iban) {
      const titular = banco?.titular || `${String(row.nome ?? "")} ${String(row.apelido ?? "")}`.trim();
      await gravarDadosBancarios(q, formandoId, encryptField(iban), titular, actorId ?? null);
    }
    return levados;
  });
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

  const levados = await levarDadosPessoaisParaFicha(db, row, id, actorId);
  if (levados.length) {
    await logLeadEvent(db, leadId, actorId, "campo", "Dados pessoais passados para a ficha", `Ficha #${id} · ${levados.length} campo${levados.length === 1 ? "" : "s"}: ${levados.join(", ")}`);
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
  // A partir daqui seguem lembretes automáticos (cadência das pré-inscrições) até os documentos ficarem completos.
  const { iniciarLembretesFin } = await import("./avisosDocumentos.js");
  await iniciarLembretesFin(db, formandoId);
  return { enviado: true as const };
}
