/**
 * Dados do Dossiê TP de muitas turmas de uma vez (vista geral, notificações, painel).
 * Uma consulta por fonte para todas as turmas, em vez de ~10 consultas por turma.
 */
import { pgIntArray, pgTextArray } from "../pedagogia/util.js";
import type { DtpEstado } from "../dtpModel.js";
import type { AnexoLinha } from "./dtp.js";
import type { DocumentoLinha } from "./pedagogiaSessoes.js";
import { many, type Consulta, type Regime } from "./sql.js";

export async function sessoesDasTurmas(c: Consulta, regime: Regime, ids: number[]) {
  if (!ids.length) return [];
  return many<{ turma_id: number; sessao_n: number; plano: unknown; sumario: unknown; presencas: unknown }>(
    c,
    "SELECT turma_id, sessao_n, plano, sumario, presencas FROM turma_sessoes WHERE regime = $1 AND turma_id = ANY($2::int[]) AND sessao_n IS NOT NULL",
    [regime, pgIntArray(ids)],
  );
}

export async function documentosDasTurmas(c: Consulta, regime: Regime, ids: number[]) {
  if (!ids.length) return [];
  return many<DocumentoLinha & { turma_id: number }>(
    c,
    `SELECT turma_id, grupo_id, label, estado, detalhe, payload FROM turma_documentos
      WHERE regime = $1 AND turma_id = ANY($2::int[]) ORDER BY grupo_id, label`,
    [regime, pgIntArray(ids)],
  );
}

export async function certificadosDasTurmas(c: Consulta, regime: Regime, ids: number[]) {
  if (!ids.length) return [];
  return many<{ turma_id: number; formando_id: number; emitido: boolean }>(
    c,
    "SELECT turma_id, formando_id, emitido FROM turma_certificados WHERE regime = $1 AND turma_id = ANY($2::int[])",
    [regime, pgIntArray(ids)],
  );
}

/** Formandos Gold candidatos às turmas (por id ou pelo nome da turma). */
export async function formandosGoldDasTurmas(c: Consulta, ids: number[], nomes: string[]) {
  if (!ids.length) return [];
  return many<{ id: number; nome: string; apelido: string; email: string; turma_id: number | null; turma: string }>(
    c,
    `SELECT id, nome, coalesce(apelido, '') AS apelido, lower(trim(coalesce(email, ''))) AS email, turma_id, coalesce(turma, '') AS turma
       FROM formandos_gold
      WHERE turma_id = ANY($1::int[]) OR turma = ANY($2::text[])`,
    [pgIntArray(ids), pgTextArray(nomes)],
  );
}

/** Formandos da Financiada: os ligados às turmas e, sem id, os que apontam para elas pelo nome. */
export async function formandosFinDasTurmas(c: Consulta, ids: number[], nomes: string[]) {
  if (!ids.length) return [];
  return many<{ id: number; nome: string; apelido: string; docs: unknown; turma_id: number | null; turma: string; curso: string }>(
    c,
    `SELECT id, nome, coalesce(apelido, '') AS apelido, docs, turma_id, coalesce(turma, '') AS turma, coalesce(curso, '') AS curso
       FROM formandos_fin
      WHERE turma_id = ANY($1::int[]) OR (turma_id IS NULL AND turma = ANY($2::text[]))`,
    [pgIntArray(ids), pgTextArray(nomes)],
  );
}

/** Para cada turma e inquérito do regime: se já foi enviado. */
export async function inqueritosEnviadosAsTurmas(c: Consulta, regime: Regime, ids: number[]) {
  if (!ids.length) return [];
  return many<{ turma_id: number; publico: string; enviado: boolean }>(
    c,
    `SELECT t.id AS turma_id,
            COALESCE(NULLIF(i.payload->>'publico', ''), 'formando') AS publico,
            EXISTS (
              SELECT 1 FROM inquerito_envios e
               WHERE e.regime = $1 AND e.turma_id = t.id AND e.inquerito_id = i.id
            ) AS enviado
       FROM catalog_items i
       CROSS JOIN unnest($2::int[]) AS t(id)
      WHERE i.kind = 'inqueritos' AND i.regime = $1`,
    [regime, pgIntArray(ids)],
  );
}

export async function estadosManuaisDasTurmas(c: Consulta, regime: Regime, ids: number[]) {
  if (!ids.length) return [];
  return many<{ turma_id: number; item_id: string; estado: DtpEstado }>(
    c,
    "SELECT turma_id, item_id, estado FROM turma_dtp WHERE regime = $1 AND turma_id = ANY($2::int[])",
    [regime, pgIntArray(ids)],
  );
}

export async function anexosDasTurmas(c: Consulta, regime: Regime, ids: number[]) {
  if (!ids.length) return [];
  return many<AnexoLinha & { turma_id: number }>(
    c,
    "SELECT turma_id, item_id, drive_file_id, file_name, drive_url FROM dtp_anexos WHERE regime = $1 AND turma_id = ANY($2::int[])",
    [regime, pgIntArray(ids)],
  );
}

export async function ficheirosDosCursos(c: Consulta, regime: Regime, cursoIds: number[]) {
  if (!cursoIds.length) return [];
  return many<{ curso_id: number; ambito: string; requisito_id: string; pessoa_id: number | null; pessoa_nome: string }>(
    c,
    `SELECT curso_id, ambito, requisito_id, pessoa_id, pessoa_nome
       FROM curso_ficheiros
      WHERE regime = $1 AND curso_id = ANY($2::int[]) AND requisito_id <> ''`,
    [regime, pgIntArray(cursoIds)],
  );
}

/** Pré-inscrições Gold dos emails dados (todas; a escolha por turma faz-se em memória). */
export async function leadsGoldDosEmails(c: Consulta, emails: string[]) {
  if (!emails.length) return [];
  return many<{ id: number; email: string; curso: string; percurso_turma_id: number | null }>(
    c,
    `SELECT id, lower(email) AS email, lower(trim(coalesce(curso, ''))) AS curso, percurso_turma_id
       FROM preinscricoes
      WHERE lower(email) = ANY($1::text[]) AND COALESCE(regime, 'gold') = 'gold'`,
    [pgTextArray(emails)],
  );
}
