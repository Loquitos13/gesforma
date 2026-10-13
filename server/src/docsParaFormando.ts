import type { Db } from "./db/pool.js";
import { isEmail, normalizeEmail } from "./security.js";

/**
 * Regra única para os documentos da ligação pessoal chegarem ao dossiê / área do formando:
 * passam SE E SÓ SE a pré-inscrição foi validada pela secretaria E a pessoa é formando de uma
 * turma desse mesmo curso (no mesmo regime). Só passam documentos validados.
 * Os documentos copiados ficam marcados com a pré-inscrição de origem, para saírem se a pessoa
 * deixar de ser formando dessa turma/curso.
 */

type Regime = "gold" | "fin";

const TABELA = { gold: { formandos: "formandos_gold", turmas: "turmas_gold" }, fin: { formandos: "formandos_fin", turmas: "turmas_fin" } } as const;

type LeadElegivel = { id: number; email: string; curso: string; regime: Regime };

async function leadValidado(db: Db, leadId: number): Promise<LeadElegivel | null> {
  const r = await db.query<{ id: number; email: string; curso: string; regime: string; validada_em: unknown; estado: string }>(
    "SELECT id, email, curso, COALESCE(regime, 'gold') AS regime, validada_em, estado FROM preinscricoes WHERE id = $1",
    [leadId],
  );
  const lead = r.rows[0];
  if (!lead || !lead.validada_em || lead.estado === "Desistiu") return null;
  const email = normalizeEmail(lead.email);
  if (!isEmail(email)) return null;
  return { id: Number(lead.id), email, curso: lead.curso, regime: lead.regime === "fin" ? "fin" : "gold" };
}

/** Ficha de formando numa turma do mesmo curso, se existir. */
async function formandoNaTurmaDoCurso(db: Db, lead: LeadElegivel) {
  const t = TABELA[lead.regime];
  const r = await db.query<{ id: number; turma_id: number }>(
    `SELECT f.id, f.turma_id FROM ${t.formandos} f
       JOIN ${t.turmas} tu ON tu.id = f.turma_id
      WHERE f.email <> '' AND lower(f.email) = $1
        AND lower(trim(tu.curso)) = lower(trim($2))
        AND NOT (lower(coalesce(f.estado, '')) LIKE 'desist%')
      ORDER BY f.id DESC LIMIT 1`,
    [lead.email, lead.curso],
  );
  return r.rows[0] ?? null;
}

/**
 * Copia os documentos validados da pré-inscrição para o formando, se a regra se cumprir.
 * Seguro de chamar várias vezes (validar documento, validar pré-inscrição, inscrever na turma).
 */
export async function transferirDocsDoLead(db: Db, leadId: number, actorId?: string) {
  const lead = await leadValidado(db, leadId);
  if (!lead) return { copiados: 0, motivo: "pré-inscrição não validada" as const };
  const formando = await formandoNaTurmaDoCurso(db, lead);
  if (!formando) return { copiados: 0, motivo: "sem turma deste curso" as const };
  const docs = await db.query<{ tipo: string; nome: string; drive_file_id: string; drive_url: string; validated_by: string | null }>(
    `SELECT tipo, nome, drive_file_id, drive_url, validated_by::text AS validated_by FROM preinscricao_docs
      WHERE preinscricao_id = $1 AND estado = 'validado' AND tipo <> 'comprovativo'`,
    [lead.id],
  );
  const hoje = new Date().toISOString().slice(0, 10);
  for (const d of docs.rows) {
    await db.query(
      `INSERT INTO formando_docs (regime, formando_id, doc_id, ok, file_name, data, drive_file_id, drive_url, estado, validated_by, validated_at, origem_preinscricao_id)
       VALUES ($1, $2, $3, true, $4, $5, $6, $7, 'validado', $8::uuid, now(), $9)
       ON CONFLICT (regime, formando_id, doc_id) DO UPDATE SET
         ok = true, file_name = EXCLUDED.file_name, data = EXCLUDED.data, estado = 'validado',
         drive_file_id = EXCLUDED.drive_file_id, drive_url = EXCLUDED.drive_url,
         validated_by = COALESCE(EXCLUDED.validated_by, formando_docs.validated_by), validated_at = now(),
         origem_preinscricao_id = EXCLUDED.origem_preinscricao_id, updated_at = now()`,
      [lead.regime, formando.id, d.tipo, d.nome, hoje, d.drive_file_id, d.drive_url, d.validated_by ?? actorId ?? null, lead.id],
    );
  }
  return { copiados: docs.rows.length, formandoId: formando.id, turmaId: formando.turma_id };
}

/** Pré-inscrições validadas desta pessoa (email) neste curso — para reaplicar a regra quando a ficha muda. */
export async function leadsValidadosDe(db: Db, regime: Regime, email: string, curso: string) {
  const mail = normalizeEmail(email);
  if (!isEmail(mail)) return [];
  const r = await db.query<{ id: number }>(
    `SELECT id FROM preinscricoes
      WHERE lower(email) = $1 AND lower(trim(curso)) = lower(trim($2)) AND COALESCE(regime, 'gold') = $3
        AND validada_em IS NOT NULL AND estado <> 'Desistiu'`,
    [mail, curso, regime],
  );
  return r.rows.map(x => Number(x.id));
}

/**
 * Reavalia a ficha do formando: se já não está numa turma do curso da pré-inscrição (ou desistiu),
 * os documentos que vieram da ligação pessoal saem do dossiê; se está, entram.
 */
export async function reavaliarDocsDoFormando(db: Db, regime: Regime, formandoId: number, actorId?: string) {
  const t = TABELA[regime];
  const f = await db.query<{ email: string; curso: string; turma_id: number | null; estado: string; turma_curso: string | null }>(
    `SELECT f.email, f.curso, f.turma_id, COALESCE(f.estado, '') AS estado, tu.curso AS turma_curso
       FROM ${t.formandos} f LEFT JOIN ${t.turmas} tu ON tu.id = f.turma_id
      WHERE f.id = $1`,
    [formandoId],
  );
  const row = f.rows[0];
  const origem = await db.query<{ origem_preinscricao_id: number }>(
    "SELECT DISTINCT origem_preinscricao_id FROM formando_docs WHERE regime = $1 AND formando_id = $2 AND origem_preinscricao_id IS NOT NULL",
    [regime, formandoId],
  );
  for (const o of origem.rows) {
    const lead = await db.query<{ curso: string; validada_em: unknown; estado: string }>(
      "SELECT curso, validada_em, estado FROM preinscricoes WHERE id = $1",
      [o.origem_preinscricao_id],
    );
    const l = lead.rows[0];
    const continua = Boolean(row && l && l.validada_em && l.estado !== "Desistiu"
      && row.turma_id != null && !/^desist/i.test(row.estado)
      && (row.turma_curso ?? "").trim().toLowerCase() === (l.curso ?? "").trim().toLowerCase());
    if (!continua) {
      await db.query(
        "DELETE FROM formando_docs WHERE regime = $1 AND formando_id = $2 AND origem_preinscricao_id = $3",
        [regime, formandoId, o.origem_preinscricao_id],
      );
    }
  }
  if (!row) return;
  const curso = row.turma_curso ?? row.curso;
  for (const leadId of await leadsValidadosDe(db, regime, row.email, curso)) {
    await transferirDocsDoLead(db, leadId, actorId);
  }
}

/** Ficha apagada: os documentos que vieram da pré-inscrição saem com ela. */
export async function apagarDocsDaFicha(db: Db, regime: Regime, formandoId: number) {
  await db.query("DELETE FROM formando_docs WHERE regime = $1 AND formando_id = $2", [regime, formandoId]);
}
