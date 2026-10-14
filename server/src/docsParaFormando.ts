import type { Db } from "./db/pool.js";
import {
  apagarDocsDeOrigem, apagarDocsDoFormando, docsValidadosDoLead, estadoDoLead, fichaComCursoDaTurma,
  formandoNaTurmaDoCurso, gravarDocDoLead, idsLeadsValidados, leadParaDocs, origensDosDocs,
} from "./repos/docsLigacao.js";
import { isEmail, normalizeEmail } from "./security.js";

/**
 * Regra única para os documentos da ligação pessoal chegarem ao dossiê / área do formando:
 * passam SE E SÓ SE a pré-inscrição foi validada pela secretaria E a pessoa é formando de uma
 * turma desse mesmo curso (no mesmo regime). Só passam documentos validados.
 * Os documentos copiados ficam marcados com a pré-inscrição de origem, para saírem se a pessoa
 * deixar de ser formando dessa turma/curso.
 */

type Regime = "gold" | "fin";

type LeadElegivel = { id: number; email: string; curso: string; regime: Regime };

async function leadValidado(db: Db, leadId: number): Promise<LeadElegivel | null> {
  const lead = await leadParaDocs(db, leadId);
  if (!lead || !lead.validada_em || lead.estado === "Desistiu") return null;
  const email = normalizeEmail(lead.email);
  if (!isEmail(email)) return null;
  return { id: Number(lead.id), email, curso: lead.curso, regime: lead.regime === "fin" ? "fin" : "gold" };
}

/**
 * Copia os documentos validados da pré-inscrição para o formando, se a regra se cumprir.
 * Seguro de chamar várias vezes (validar documento, validar pré-inscrição, inscrever na turma).
 */
export async function transferirDocsDoLead(db: Db, leadId: number, actorId?: string) {
  const lead = await leadValidado(db, leadId);
  if (!lead) return { copiados: 0, motivo: "pré-inscrição não validada" as const };
  const formando = await formandoNaTurmaDoCurso(db, lead.regime, lead.email, lead.curso);
  if (!formando) return { copiados: 0, motivo: "sem turma deste curso" as const };
  const docs = await docsValidadosDoLead(db, lead.id);
  const hoje = new Date().toISOString().slice(0, 10);
  for (const d of docs) {
    await gravarDocDoLead(db, {
      regime: lead.regime, formandoId: formando.id, tipo: d.tipo, nome: d.nome, data: hoje,
      driveFileId: d.drive_file_id, driveUrl: d.drive_url, validadoPor: d.validated_by ?? actorId ?? null, leadId: lead.id,
    });
  }
  return { copiados: docs.length, formandoId: formando.id, turmaId: formando.turma_id };
}

/** Pré-inscrições validadas desta pessoa (email) neste curso — para reaplicar a regra quando a ficha muda. */
export async function leadsValidadosDe(db: Db, regime: Regime, email: string, curso: string) {
  const mail = normalizeEmail(email);
  if (!isEmail(mail)) return [];
  return idsLeadsValidados(db, regime, mail, curso);
}

/**
 * Reavalia a ficha do formando: se já não está numa turma do curso da pré-inscrição (ou desistiu),
 * os documentos que vieram da ligação pessoal saem do dossiê; se está, entram.
 */
export async function reavaliarDocsDoFormando(db: Db, regime: Regime, formandoId: number, actorId?: string) {
  const row = await fichaComCursoDaTurma(db, regime, formandoId);
  for (const leadId of await origensDosDocs(db, regime, formandoId)) {
    const l = await estadoDoLead(db, leadId);
    const continua = Boolean(row && l && l.validada_em && l.estado !== "Desistiu"
      && row.turma_id != null && !/^desist/i.test(row.estado)
      && (row.turma_curso ?? "").trim().toLowerCase() === (l.curso ?? "").trim().toLowerCase());
    if (!continua) await apagarDocsDeOrigem(db, regime, formandoId, leadId);
  }
  if (!row) return;
  const curso = row.turma_curso ?? row.curso;
  for (const leadId of await leadsValidadosDe(db, regime, row.email, curso)) {
    await transferirDocsDoLead(db, leadId, actorId);
  }
}

/** Ficha apagada: os documentos que vieram da pré-inscrição saem com ela. */
export async function apagarDocsDaFicha(db: Db, regime: Regime, formandoId: number) {
  await apagarDocsDoFormando(db, regime, formandoId);
}
