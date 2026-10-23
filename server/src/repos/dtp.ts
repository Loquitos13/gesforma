/** Dossiê técnico-pedagógico: estado manual, anexos, modelos por curso e entidade, factos da turma. */
import { pgIntArray, pgTextArray } from "../pedagogia/util.js";
import type { DtpEstado } from "../dtpModel.js";
import { sqlFormandoConta } from "./pedagogiaTurma.js";
import { many, one, type Consulta, type Regime } from "./sql.js";

export async function estadosManuais(c: Consulta, regime: Regime, turmaId: number) {
  const rows = await many<{ item_id: string; estado: DtpEstado }>(
    c,
    "SELECT item_id, estado FROM turma_dtp WHERE regime = $1 AND turma_id = $2",
    [regime, turmaId],
  );
  return Object.fromEntries(rows.map(r => [r.item_id, r.estado])) as Record<string, DtpEstado>;
}

export async function definirEstadoManual(c: Consulta, regime: Regime, turmaId: number, itemId: string, estado: DtpEstado) {
  await one(
    c,
    `INSERT INTO turma_dtp (regime, turma_id, item_id, estado) VALUES ($1, $2, $3, $4)
     ON CONFLICT (regime, turma_id, item_id) DO UPDATE SET estado = EXCLUDED.estado, updated_at = now()
     RETURNING item_id`,
    [regime, turmaId, itemId, estado],
  );
}

export async function limparEstadoManual(c: Consulta, regime: Regime, turmaId: number, itemId: string) {
  await many(c, "DELETE FROM turma_dtp WHERE regime = $1 AND turma_id = $2 AND item_id = $3 RETURNING item_id", [regime, turmaId, itemId]);
}

export type AnexoLinha = { item_id: string; drive_file_id: string; file_name: string; drive_url: string };

export async function anexosDaTurma(c: Consulta, regime: Regime, turmaId: number) {
  return many<AnexoLinha>(
    c,
    "SELECT item_id, drive_file_id, file_name, drive_url FROM dtp_anexos WHERE regime = $1 AND turma_id = $2",
    [regime, turmaId],
  );
}

export async function gravarAnexo(c: Consulta, regime: Regime, turmaId: number, itemId: string, f: { id: string; nome: string; url: string }) {
  await one(
    c,
    `INSERT INTO dtp_anexos (regime, turma_id, item_id, drive_file_id, file_name, drive_url)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (regime, turma_id, item_id) DO UPDATE SET
       drive_file_id = EXCLUDED.drive_file_id, file_name = EXCLUDED.file_name,
       drive_url = EXCLUDED.drive_url, updated_at = now()
     RETURNING item_id`,
    [regime, turmaId, itemId, f.id, f.nome, f.url],
  );
}

/** Contagens base da turma para os factos do dossiê. */
export async function sessoesParaFactos(c: Consulta, regime: Regime, turmaId: number) {
  return many<{ sessao_n: number; plano: unknown; sumario: unknown; presencas: unknown }>(
    c,
    "SELECT sessao_n, plano, sumario, presencas FROM turma_sessoes WHERE regime = $1 AND turma_id = $2 AND sessao_n IS NOT NULL",
    [regime, turmaId],
  );
}

export async function docsValidadosDosFormandos(c: Consulta, regime: Regime, ids: number[]) {
  if (!ids.length) return [];
  return many<{ formando_id: number; doc_id: string }>(
    c,
    "SELECT formando_id, doc_id FROM formando_docs WHERE regime = $1 AND ok = true AND formando_id = ANY($2::int[])",
    [regime, pgIntArray(ids)],
  );
}

/** Inquéritos enviados a esta turma (o total é o que se enviou, não o catálogo do regime). */
export async function inqueritosEnviadosATurma(c: Consulta, regime: Regime, turmaId: number) {
  return many<{ publico: string; enviado: boolean }>(
    c,
    "SELECT COALESCE(NULLIF(publico, ''), 'formando') AS publico, true AS enviado FROM inquerito_envios WHERE regime = $1 AND turma_id = $2",
    [regime, turmaId],
  );
}

/** Formadores pelos nomes (minúsculas, aparados), com a validade do CCP e os documentos carregados. */
export async function docsDosFormadores(c: Consulta, nomesMinusculos: string[]) {
  if (!nomesMinusculos.length) return [];
  return many<{ nome: string; ccp_validade: string | null; docs: string[] | null }>(
    c,
    `SELECT lower(trim(fm.nome)) AS nome, fm.ccp_validade::text AS ccp_validade,
            (SELECT array_agg(d.doc_id) FROM formador_docs d WHERE d.formador_id = fm.id AND d.uploaded) AS docs
       FROM formadores fm
      WHERE lower(trim(fm.nome)) = ANY($1::text[])`,
    [pgTextArray(nomesMinusculos)],
  );
}

export async function ficheirosDoCurso(c: Consulta, regime: Regime, cursoId: number) {
  return many<{ ambito: string; requisito_id: string; pessoa_id: number | null; pessoa_nome: string }>(
    c,
    `SELECT ambito, requisito_id, pessoa_id, pessoa_nome
       FROM curso_ficheiros
      WHERE regime = $1 AND curso_id = $2 AND requisito_id <> ''`,
    [regime, cursoId],
  );
}

type ModeloLinha = { excluidos: unknown; extra: unknown; incluidos?: unknown };

export async function modeloDoCurso(c: Consulta, regime: Regime, cursoId: number) {
  return one<ModeloLinha>(c, "SELECT excluidos, extra, incluidos FROM curso_dtp_modelos WHERE regime = $1 AND curso_id = $2", [regime, cursoId]);
}

export async function modelosDosCursos(c: Consulta, regime: Regime) {
  return many<ModeloLinha & { curso_id: number }>(
    c,
    "SELECT curso_id, excluidos, extra, incluidos FROM curso_dtp_modelos WHERE regime = $1",
    [regime],
  );
}

export async function gravarModeloDoCurso(c: Consulta, regime: Regime, cursoId: number, m: { excluidos: string[]; incluidos: string[]; extra: unknown[] }) {
  await one(
    c,
    `INSERT INTO curso_dtp_modelos (regime, curso_id, excluidos, incluidos, extra)
     VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb)
     ON CONFLICT (regime, curso_id) DO UPDATE SET
       excluidos = EXCLUDED.excluidos, incluidos = EXCLUDED.incluidos, extra = EXCLUDED.extra, updated_at = now()
     RETURNING curso_id`,
    [regime, cursoId, m.excluidos, m.incluidos, m.extra],
  );
}

/** Entidade responsável (Gold) do curso, com o seu modelo. */
export async function entidadeDoCurso(c: Consulta, cursoId: number) {
  return one<{ id: number; nome: string; excluidos: unknown; extra: unknown }>(
    c,
    `SELECT e.id, e.nome, e.excluidos, e.extra
       FROM cursos_gold c
       JOIN dtp_entidades e ON e.id = c.entidade_responsavel_id
      WHERE c.id = $1`,
    [cursoId],
  );
}

export async function listarEntidades(c: Consulta) {
  return many<{ id: number; nome: string; excluidos: unknown; extra: unknown }>(c, "SELECT id, nome, excluidos, extra FROM dtp_entidades ORDER BY nome");
}

export async function lerEntidade(c: Consulta, id: number) {
  return one<{ id: number; nome: string; excluidos: unknown; extra: unknown }>(c, "SELECT id, nome, excluidos, extra FROM dtp_entidades WHERE id = $1", [id]);
}

export async function entidadeComNome(c: Consulta, nome: string, excetoId?: number) {
  return one<{ id: number }>(
    c,
    "SELECT id FROM dtp_entidades WHERE lower(trim(nome)) = lower(trim($1)) AND ($2::int IS NULL OR id <> $2) LIMIT 1",
    [nome, excetoId ?? null],
  );
}

export async function criarEntidade(c: Consulta, nome: string) {
  const r = await one<{ id: number }>(c, "INSERT INTO dtp_entidades (nome) VALUES ($1) RETURNING id", [nome]);
  return Number(r?.id);
}

export async function renomearEntidade(c: Consulta, id: number, nome: string) {
  return one<{ id: number; excluidos: unknown; extra: unknown }>(
    c,
    "UPDATE dtp_entidades SET nome = $2, updated_at = now() WHERE id = $1 RETURNING id, excluidos, extra",
    [id, nome],
  );
}

export async function apagarEntidade(c: Consulta, id: number) {
  return one<{ id: number }>(c, "DELETE FROM dtp_entidades WHERE id = $1 RETURNING id", [id]);
}

export async function gravarModeloEntidade(c: Consulta, id: number, excluidos: string[], extra: unknown[]) {
  await one(c, "UPDATE dtp_entidades SET excluidos = $2::jsonb, extra = $3::jsonb, updated_at = now() WHERE id = $1 RETURNING id", [id, excluidos, extra]);
}

/** Ligações curso Gold → entidade responsável. */
export async function entidadesDosCursosGold(c: Consulta) {
  return many<{ id: number; entidade_responsavel_id: number | null }>(c, "SELECT id, entidade_responsavel_id FROM cursos_gold");
}

/** Percurso Gold: emails dos formandos, pré-inscrições e documentos dessas pré-inscrições. */
export async function emailsFormandosGold(c: Consulta, turmaId: number, turmaNome: string) {
  return many<{ id: number; email: string }>(
    c,
    `SELECT id, lower(trim(email)) AS email FROM formandos_gold
      WHERE (turma_id = $1 OR (trim(turma) <> '' AND turma = $2)) AND ${sqlFormandoConta("gold")}`,
    [turmaId, turmaNome],
  );
}

export async function leadsDosEmails(c: Consulta, emails: string[], curso: string, turmaId: number) {
  if (!emails.length) return [];
  return many<{ email: string; id: number }>(
    c,
    `SELECT DISTINCT ON (lower(email)) lower(email) AS email, id
       FROM preinscricoes
      WHERE lower(email) = ANY($1::text[])
        AND COALESCE(regime, 'gold') = 'gold'
        AND (lower(trim(curso)) = lower(trim($2)) OR percurso_turma_id = $3)
      ORDER BY lower(email), (percurso_turma_id = $3) DESC, id DESC`,
    [pgTextArray(emails), curso, turmaId],
  );
}

export async function docsDasPreinscricoes(c: Consulta, leadIds: number[]) {
  if (!leadIds.length) return [];
  return many<{ preinscricao_id: number; tipo: string; estado: string }>(
    c,
    "SELECT preinscricao_id, tipo, COALESCE(estado, 'pendente') AS estado FROM preinscricao_docs WHERE preinscricao_id = ANY($1::int[])",
    [pgIntArray(leadIds)],
  );
}

/** Ficheiros dos formandos e formadores (exportação do dossiê). */
export async function ficheirosDosFormandos(c: Consulta, regime: Regime, ids: number[]) {
  if (!ids.length) return [];
  return many<{ formando_id: number; doc_id: string; file_name: string; drive_file_id: string }>(
    c,
    "SELECT formando_id, doc_id, file_name, drive_file_id FROM formando_docs WHERE regime = $1 AND formando_id = ANY($2::int[]) AND drive_file_id <> ''",
    [regime, pgIntArray(ids)],
  );
}

export async function formadoresPorNome(c: Consulta, nomes: string[]) {
  if (!nomes.length) return [];
  return many<{ id: number; nome: string }>(
    c,
    "SELECT id, nome FROM formadores WHERE lower(trim(nome)) IN (SELECT lower(trim(jsonb_array_elements_text($1::jsonb))))",
    [nomes],
  );
}

export async function ficheirosDoFormador(c: Consulta, formadorId: number) {
  return many<{ doc_id: string; file_name: string; drive_file_id: string }>(
    c,
    "SELECT doc_id, file_name, drive_file_id FROM formador_docs WHERE formador_id = $1 AND drive_file_id <> ''",
    [formadorId],
  );
}
