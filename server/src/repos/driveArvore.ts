/** Árvore da Drive: pastas de turmas, pré-inscrições e formadores, e atalhos dos documentos dos formadores. */
import { many, one, tabelaRegime, type Consulta, type Regime } from "./sql.js";

const emails = (r: { email: string }[]) => r.map(x => x.email);

export async function gravarPastasTurma(c: Consulta, regime: Regime, turmaId: number, p: { pasta: string; formandos: string; formadores: string }) {
  await many(c,
    `UPDATE ${tabelaRegime("turmas", regime)}
        SET drive_pasta_id = $2, drive_dossie_id = $2, drive_formandos_id = $3, drive_formadores_id = $4
      WHERE id = $1`,
    [turmaId, p.pasta, p.formandos, p.formadores]);
}

export async function emailsSecretaria(c: Consulta) {
  return emails(await many<{ email: string }>(c, "SELECT email FROM users WHERE role IN ('admin', 'secretaria') AND active = true AND email <> ''"));
}

/**
 * Contas activas da equipa (nem formadores, nem formandos, nem a comercial, que não vê turmas nem o dossiê):
 * a sincronização da Drive nunca lhes tira a partilha.
 */
export async function emailsEquipaActiva(c: Consulta) {
  return emails(await many<{ email: string }>(c,
    "SELECT email FROM users WHERE role NOT IN ('formando', 'formador', 'comercial') AND active = true AND email <> ''"));
}

/** Formadores cujo nome está na lista (comparação sem maiúsculas nem espaços nas pontas). */
export function formadoresPorNomes(c: Consulta, nomes: string[]) {
  if (!nomes.length) return Promise.resolve([] as { id: number; nome: string; email: string }[]);
  return many<{ id: number; nome: string; email: string }>(c,
    `SELECT id, nome, email FROM formadores
      WHERE lower(trim(nome)) IN (SELECT lower(trim(jsonb_array_elements_text($1::jsonb))))`,
    [JSON.stringify(nomes)]);
}

export function pastaDaPreinscricao(c: Consulta, leadId: number) {
  return one<{ id: number; nome: string; apelido: string; drive_pasta_id: string; drive_pasta_parent_id: string }>(c,
    "SELECT id, nome, apelido, drive_pasta_id, drive_pasta_parent_id FROM preinscricoes WHERE id = $1", [leadId]);
}

export async function gravarPastaPendente(c: Consulta, leadId: number, pastaId: string, parentId: string) {
  await many(c,
    "UPDATE preinscricoes SET drive_pasta_id = $2, drive_pasta_parent_id = $3 WHERE id = $1 AND drive_pasta_id = ''",
    [leadId, pastaId, parentId]);
}

export async function gravarPastaNaTurma(c: Consulta, leadId: number, pastaId: string, parentId: string, turmaId: number) {
  await many(c,
    "UPDATE preinscricoes SET drive_pasta_id = $2, drive_pasta_parent_id = $3, turma_id = $4 WHERE id = $1",
    [leadId, pastaId, parentId, turmaId]);
}

export async function caminhosDosDocsDoLead(c: Consulta, leadId: number, path: string, turmaNome: string) {
  await many(c,
    `UPDATE drive_files SET folder_path = $2, turma = $3
      WHERE id IN (SELECT drive_file_id FROM preinscricao_docs WHERE preinscricao_id = $1 AND drive_file_id <> '')`,
    [leadId, path, turmaNome]);
}

export async function nomeDaTurma(c: Consulta, regime: Regime, turmaId: number) {
  const r = await one<{ nome: string }>(c, `SELECT nome FROM ${tabelaRegime("turmas", regime)} WHERE id = $1`, [turmaId]);
  return r?.nome ?? null;
}

export function formadorPorNome(c: Consulta, nome: string) {
  return one<{ id: number; nome: string; drive_pasta_id: string }>(c,
    "SELECT id, nome, drive_pasta_id FROM formadores WHERE lower(trim(nome)) = lower(trim($1)) ORDER BY id LIMIT 1", [nome]);
}

export async function gravarPastaFormador(c: Consulta, formadorId: number, pastaId: string) {
  await many(c, "UPDATE formadores SET drive_pasta_id = $2 WHERE id = $1", [formadorId, pastaId]);
}

export async function nomeDoFormador(c: Consulta, formadorId: number) {
  const r = await one<{ nome: string }>(c, "SELECT nome FROM formadores WHERE id = $1", [formadorId]);
  return r?.nome ?? null;
}

/** Documentos do formador que já estão na Drive. */
export function docsNaDriveDoFormador(c: Consulta, formadorId: number) {
  return many<{ doc_id: string; file_name: string; drive_id: string; local_id: string }>(c,
    `SELECT d.doc_id, d.file_name, f.drive_id, f.id AS local_id
       FROM formador_docs d
       JOIN drive_files f ON f.id = d.drive_file_id
      WHERE d.formador_id = $1 AND d.drive_file_id <> '' AND COALESCE(f.drive_id, '') <> ''`,
    [formadorId]);
}

/** Atalhos do formador nesta turma cujo documento já não existe. */
export function atalhosOrfaos(c: Consulta, formadorId: number, regime: Regime, turmaId: number, docsActuais: string[]) {
  return many<{ id: number; shortcut_id: string }>(c,
    `SELECT id, shortcut_id FROM formador_atalhos
      WHERE formador_id = $1 AND regime = $2 AND turma_id = $3
        AND doc_id NOT IN (SELECT jsonb_array_elements_text($4::jsonb))`,
    [formadorId, regime, turmaId, JSON.stringify(docsActuais)]);
}

export function atalhoDoDoc(c: Consulta, formadorId: number, regime: Regime, turmaId: number, docId: string) {
  return one<{ id: number; drive_file_id: string; shortcut_id: string }>(c,
    `SELECT id, drive_file_id, shortcut_id FROM formador_atalhos
      WHERE formador_id = $1 AND regime = $2 AND turma_id = $3 AND doc_id = $4`,
    [formadorId, regime, turmaId, docId]);
}

export async function gravarAtalho(c: Consulta, a: { formadorId: number; regime: Regime; turmaId: number; docId: string; driveFileId: string; shortcutId: string }) {
  await many(c,
    `INSERT INTO formador_atalhos (formador_id, regime, turma_id, doc_id, drive_file_id, shortcut_id)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (formador_id, regime, turma_id, doc_id) DO UPDATE SET
       drive_file_id = EXCLUDED.drive_file_id, shortcut_id = EXCLUDED.shortcut_id`,
    [a.formadorId, a.regime, a.turmaId, a.docId, a.driveFileId, a.shortcutId]);
}

export async function apagarAtalho(c: Consulta, id: number) {
  await many(c, "DELETE FROM formador_atalhos WHERE id = $1", [id]);
}

export function atalhosDaTurma(c: Consulta, regime: Regime, turmaId: number) {
  return many<{ id: number; formador_id: number; shortcut_id: string }>(c,
    "SELECT id, formador_id, shortcut_id FROM formador_atalhos WHERE regime = $1 AND turma_id = $2", [regime, turmaId]);
}

export function turmasComAtalhosDoFormador(c: Consulta, formadorId: number) {
  return many<{ regime: Regime; turma_id: number }>(c,
    "SELECT DISTINCT regime, turma_id FROM formador_atalhos WHERE formador_id = $1", [formadorId]);
}

/** Todas as turmas com a equipa e o cronograma (para saber onde o formador está associado). */
export function turmasComEquipa(c: Consulta) {
  return many<{ regime: Regime; id: number; nome: string; formador: unknown; formadores: unknown; cronograma: unknown }>(c,
    `SELECT 'gold' AS regime, id, nome, formador, formadores, cronograma FROM turmas_gold
     UNION ALL
     SELECT 'fin', id, nome, formador, formadores, cronograma FROM turmas_fin`);
}
