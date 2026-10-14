/** Documentos que passam da ligação pessoal (pré-inscrição) para o dossiê do formando. Regras em docsParaFormando.ts. */
import { many, one, tabelaRegime, type Consulta, type Regime } from "./sql.js";

export function leadParaDocs(c: Consulta, leadId: number) {
  return one<{ id: number; email: string; curso: string; regime: string; validada_em: unknown; estado: string }>(c,
    "SELECT id, email, curso, COALESCE(regime, 'gold') AS regime, validada_em, estado FROM preinscricoes WHERE id = $1",
    [leadId]);
}

/** Ficha activa (não desistiu) numa turma do curso indicado, pelo email. */
export function formandoNaTurmaDoCurso(c: Consulta, regime: Regime, email: string, curso: string) {
  const f = tabelaRegime("formandos", regime);
  const t = tabelaRegime("turmas", regime);
  return one<{ id: number; turma_id: number }>(c,
    `SELECT f.id, f.turma_id FROM ${f} f
       JOIN ${t} tu ON tu.id = f.turma_id
      WHERE f.email <> '' AND lower(f.email) = $1
        AND lower(trim(tu.curso)) = lower(trim($2))
        AND NOT (lower(coalesce(f.estado, '')) LIKE 'desist%')
      ORDER BY f.id DESC LIMIT 1`,
    [email, curso]);
}

export function docsValidadosDoLead(c: Consulta, leadId: number) {
  return many<{ tipo: string; nome: string; drive_file_id: string; drive_url: string; validated_by: string | null }>(c,
    `SELECT tipo, nome, drive_file_id, drive_url, validated_by::text AS validated_by FROM preinscricao_docs
      WHERE preinscricao_id = $1 AND estado = 'validado' AND tipo <> 'comprovativo'`,
    [leadId]);
}

export async function gravarDocDoLead(c: Consulta, d: {
  regime: Regime; formandoId: number; tipo: string; nome: string; data: string;
  driveFileId: string; driveUrl: string; validadoPor: string | null; leadId: number;
}) {
  await many(c,
    `INSERT INTO formando_docs (regime, formando_id, doc_id, ok, file_name, data, drive_file_id, drive_url, estado, validated_by, validated_at, origem_preinscricao_id)
     VALUES ($1, $2, $3, true, $4, $5, $6, $7, 'validado', $8::uuid, now(), $9)
     ON CONFLICT (regime, formando_id, doc_id) DO UPDATE SET
       ok = true, file_name = EXCLUDED.file_name, data = EXCLUDED.data, estado = 'validado',
       drive_file_id = EXCLUDED.drive_file_id, drive_url = EXCLUDED.drive_url,
       validated_by = COALESCE(EXCLUDED.validated_by, formando_docs.validated_by), validated_at = now(),
       origem_preinscricao_id = EXCLUDED.origem_preinscricao_id, updated_at = now()`,
    [d.regime, d.formandoId, d.tipo, d.nome, d.data, d.driveFileId, d.driveUrl, d.validadoPor, d.leadId]);
}

export async function idsLeadsValidados(c: Consulta, regime: Regime, email: string, curso: string) {
  const r = await many<{ id: number }>(c,
    `SELECT id FROM preinscricoes
      WHERE lower(email) = $1 AND lower(trim(curso)) = lower(trim($2)) AND COALESCE(regime, 'gold') = $3
        AND validada_em IS NOT NULL AND estado <> 'Desistiu'`,
    [email, curso, regime]);
  return r.map(x => Number(x.id));
}

export function fichaComCursoDaTurma(c: Consulta, regime: Regime, formandoId: number) {
  const f = tabelaRegime("formandos", regime);
  const t = tabelaRegime("turmas", regime);
  return one<{ email: string; curso: string; turma_id: number | null; estado: string; turma_curso: string | null }>(c,
    `SELECT f.email, f.curso, f.turma_id, COALESCE(f.estado, '') AS estado, tu.curso AS turma_curso
       FROM ${f} f LEFT JOIN ${t} tu ON tu.id = f.turma_id
      WHERE f.id = $1`,
    [formandoId]);
}

export async function origensDosDocs(c: Consulta, regime: Regime, formandoId: number) {
  const r = await many<{ origem_preinscricao_id: number }>(c,
    "SELECT DISTINCT origem_preinscricao_id FROM formando_docs WHERE regime = $1 AND formando_id = $2 AND origem_preinscricao_id IS NOT NULL",
    [regime, formandoId]);
  return r.map(x => Number(x.origem_preinscricao_id));
}

export function estadoDoLead(c: Consulta, leadId: number) {
  return one<{ curso: string; validada_em: unknown; estado: string }>(c,
    "SELECT curso, validada_em, estado FROM preinscricoes WHERE id = $1", [leadId]);
}

export async function apagarDocsDeOrigem(c: Consulta, regime: Regime, formandoId: number, leadId: number) {
  await many(c, "DELETE FROM formando_docs WHERE regime = $1 AND formando_id = $2 AND origem_preinscricao_id = $3",
    [regime, formandoId, leadId]);
}

export async function apagarDocsDoFormando(c: Consulta, regime: Regime, formandoId: number) {
  await many(c, "DELETE FROM formando_docs WHERE regime = $1 AND formando_id = $2", [regime, formandoId]);
}
