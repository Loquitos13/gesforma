/** Passagem de pré-inscrições e inscrições da Financiada para fichas de formando (finPipeline.ts). */
import { many, one, type Consulta } from "./sql.js";

type TurmaCurta = { id: number; nome: string; curso: string };

export function turmaFinPorNome(c: Consulta, nome: string) {
  return one<TurmaCurta>(c,
    "SELECT id, nome, curso FROM turmas_fin WHERE lower(trim(nome)) = lower(trim($1)) ORDER BY id DESC LIMIT 1", [nome]);
}

/** Até duas turmas do curso: só se usa quando há exactamente uma. */
export function turmasFinDoCurso(c: Consulta, curso: string, local = "", horario = "") {
  return many<TurmaCurta>(c,
    `SELECT id, nome, curso FROM turmas_fin
      WHERE lower(trim(curso)) = lower(trim($1))
        AND ($2 = '' OR lower(trim(local)) = lower(trim($2)))
        AND ($3 = '' OR lower(trim(horario)) = lower(trim($3)))
      ORDER BY id DESC LIMIT 2`,
    [curso, local, horario]);
}

export function turmaFinPorId(c: Consulta, id: number) {
  return one<TurmaCurta>(c, "SELECT id, nome, curso FROM turmas_fin WHERE id = $1", [id]);
}

export function docsValidosFin(c: Consulta, formandoId: number) {
  return many<{ doc_id: string; ok: boolean; data: string }>(c,
    "SELECT doc_id, ok, data FROM formando_docs WHERE regime = 'fin' AND formando_id = $1", [formandoId]);
}

export function preinscricaoCompleta(c: Consulta, id: number) {
  return one<Record<string, unknown>>(c, "SELECT * FROM preinscricoes WHERE id = $1", [id]);
}

export function formandoFinPorEmail(c: Consulta, email: string) {
  return one<{ id: number; docs: unknown; docs_enc: string | null }>(c,
    "SELECT id, docs, docs_enc FROM formandos_fin WHERE email <> '' AND lower(trim(email)) = $1 ORDER BY id DESC LIMIT 1", [email]);
}

export async function turmaDoFormandoFin(c: Consulta, id: number) {
  const r = await one<{ turma_id: number | null }>(c, "SELECT turma_id FROM formandos_fin WHERE id = $1", [id]);
  return r?.turma_id ?? null;
}

export async function inserirFormandoFin(c: Consulta, f: {
  id: number; nome: string; apelido: string; turma: string; turmaId: number | null; telf: string; email: string;
  curso: string; estado: string; docs: unknown; docsEnc?: string | null; piiEnc?: string; publicId?: string | null;
}) {
  await many(c,
    `INSERT INTO formandos_fin (id, nome, apelido, turma, turma_id, telf, email, curso, estado, docs, docs_enc, pii_enc, public_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,COALESCE($12,''),COALESCE($13,''))`,
    [f.id, f.nome, f.apelido, f.turma, f.turmaId, f.telf, f.email, f.curso, f.estado, f.docs, f.docsEnc ?? null, f.piiEnc ?? null, f.publicId ?? null]);
}

export async function actualizarFormandoFin(c: Consulta, id: number, f: {
  nome: string; apelido: string; turma: string; turmaId: number | null; telf: string; curso: string; estado: string; docs?: unknown;
}) {
  await many(c,
    `UPDATE formandos_fin SET
       nome = COALESCE(NULLIF($2,''), nome), apelido = COALESCE(NULLIF($3,''), apelido),
       turma = $4, turma_id = $5, telf = COALESCE(NULLIF($6,''), telf), curso = $7, estado = $8,
       docs = COALESCE($9::jsonb, docs)
     WHERE id = $1`,
    [id, f.nome, f.apelido, f.turma, f.turmaId, f.telf, f.curso, f.estado, f.docs === undefined ? null : f.docs]);
}

export async function gravarDocsFin(c: Consulta, id: number, docs: unknown, docsEnc: string | null) {
  await many(c, "UPDATE formandos_fin SET docs = $2::jsonb, docs_enc = COALESCE($3, docs_enc) WHERE id = $1", [id, docs, docsEnc]);
}

export async function marcarLeadFormando(c: Consulta, leadId: number) {
  await many(c, "UPDATE preinscricoes SET estado = 'Formando', ultima_actividade_em = now() WHERE id = $1 AND estado <> 'Formando'", [leadId]);
}

export function formandoFinParaLembrete(c: Consulta, id: number) {
  return one<{ nome: string; apelido: string; email: string; curso: string; docs: unknown; docs_enc: string | null }>(c,
    "SELECT nome, apelido, email, curso, docs, docs_enc FROM formandos_fin WHERE id = $1", [id]);
}

export async function notaDoSistemaFin(c: Consulta, formandoId: number, actorId: string | null, texto: string) {
  await many(c,
    "INSERT INTO formando_notas (regime, formando_id, autor, actor_id, texto) VALUES ('fin', $1, 'Sistema', $2, $3)",
    [formandoId, actorId, texto]);
}
