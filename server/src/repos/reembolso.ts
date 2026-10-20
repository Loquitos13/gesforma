/** Leituras e escritas dos ficheiros do reembolso da Financiada (execução física e despesas), por turma. */
import type { TxQuery } from "../db/pool.js";
import { COLUNAS_FINANCIAMENTO, type LinhaFinanciamento } from "./formandoFinanciamento.js";
import { many, one, type Consulta } from "./sql.js";

const COLUNAS_D = Object.values(COLUNAS_FINANCIAMENTO).map(c => `COALESCE(d.${c}, '') AS d_${c}`).join(", ");

export type TipoReembolso = "execucao-fisica" | "despesas";

export type TurmaReembolso = {
  id: number; nome: string; curso: string; local: string; cronograma: unknown; fechada_em: string | null;
  numero_acao: number; ufcd_cod: string; c_ufcd_cod: string; c_ufcd: string; c_area_cnaef: string;
};

/** A turma e o seu curso (pelo id, ou pelo nome nas turmas antigas): código e designação da UFCD e área CNAEF. */
export function turmaReembolso(c: Consulta, id: number) {
  return one<TurmaReembolso>(
    c,
    `SELECT t.id, t.nome, t.curso, t.local, t.cronograma, t.fechada_em::text AS fechada_em,
            COALESCE(t.numero_acao, 1) AS numero_acao, COALESCE(t.ufcd_cod, '') AS ufcd_cod,
            COALESCE(cf.ufcd_cod, '') AS c_ufcd_cod, COALESCE(cf.ufcd, '') AS c_ufcd, COALESCE(cf.area_cnaef, '') AS c_area_cnaef
       FROM turmas_fin t
       LEFT JOIN LATERAL (
         SELECT ufcd_cod, ufcd, area_cnaef FROM cursos_fin c
          WHERE c.id = t.curso_id
             OR (t.curso_id IS NULL AND (lower(trim(c.nome_comercial)) = lower(trim(t.curso)) OR lower(trim(c.ufcd)) = lower(trim(t.curso))))
          ORDER BY (c.id = t.curso_id) DESC NULLS LAST, c.id
          LIMIT 1
       ) cf ON true
      WHERE t.id = $1`,
    [id],
  );
}

export type FormandoExecucao = {
  id: number; nome: string; apelido: string; email: string; telf: string; estado: string; pii_enc: string;
  inscrito: string; p_nif: string; p_codigo_postal: string; p_telf: string; p_pii_enc: string;
} & { [K in `d_${keyof LinhaFinanciamento}`]: string };

/**
 * Formandos da turma (pelo id; as fichas antigas sem id pelo nome da turma), com a pré-inscrição mais recente
 * do mesmo email (de preferência da Financiada): data de inscrição, NIF, código postal e telefone; e os dados
 * para o financiamento (formando_fin_financiamento, prefixo `d_`).
 */
export function formandosExecucao(c: Consulta, turma: { id: number; nome: string }) {
  return many<FormandoExecucao>(
    c,
    `SELECT f.id, f.nome, f.apelido, f.email, f.telf, f.estado, COALESCE(f.pii_enc, '') AS pii_enc,
            COALESCE(p.inscrito, '') AS inscrito, COALESCE(p.nif, '') AS p_nif, COALESCE(p.codigo_postal, '') AS p_codigo_postal,
            COALESCE(p.telf, '') AS p_telf, COALESCE(p.pii_enc, '') AS p_pii_enc, ${COLUNAS_D}
       FROM formandos_fin f
       LEFT JOIN formando_fin_financiamento d ON d.formando_id = f.id
       LEFT JOIN LATERAL (
         SELECT inscrito, nif, codigo_postal, telf, pii_enc
           FROM preinscricoes
          WHERE f.email <> '' AND lower(trim(email)) = lower(trim(f.email))
          ORDER BY (regime = 'fin') DESC, id DESC
          LIMIT 1
       ) p ON true
      WHERE f.turma_id = $1 OR (f.turma_id IS NULL AND lower(trim(f.turma)) = lower(trim($2)))
      ORDER BY f.nome, f.apelido, f.id`,
    [turma.id, turma.nome],
  );
}

export function certificadosEmitidosFin(c: Consulta, turmaId: number) {
  return many<{ formando_id: number; emitido: boolean; emitido_em: string | null }>(
    c,
    "SELECT formando_id, emitido, emitido_em::text AS emitido_em FROM turma_certificados WHERE regime = 'fin' AND turma_id = $1",
    [turmaId],
  );
}

/** Morada do local (Edição de cursos › Locais), para o código postal do local de realização. */
export async function moradaDoLocal(c: Consulta, nome: string) {
  if (!nome.trim()) return "";
  const r = await one<{ morada: string }>(
    c,
    `SELECT COALESCE(payload->>'morada', '') AS morada FROM catalog_items
      WHERE kind = 'locais' AND lower(trim(COALESCE(payload->>'nome', ''))) = lower(trim($1))
      ORDER BY (regime = 'fin') DESC, id LIMIT 1`,
    [nome],
  );
  return r?.morada ?? "";
}

export type FicheiroReembolso = { tipo: TipoReembolso; drive_file_id: string; impressao: string; atualizado_em: string };

export function ficheirosReembolso(c: Consulta, turmaId: number) {
  return many<FicheiroReembolso>(
    c,
    "SELECT tipo, drive_file_id, impressao, atualizado_em::text AS atualizado_em FROM reembolso_ficheiros WHERE turma_id = $1",
    [turmaId],
  );
}

/**
 * Passa a cópia da turma para o ficheiro novo e devolve o anterior (para apagar). A linha é única por
 * turma e tipo e fica bloqueada durante a troca: duas actualizações seguidas trocam uma de cada vez e
 * cada uma apaga só o ficheiro que substituiu. Chamar dentro de `db.tx`.
 */
export async function trocarFicheiroReembolso(q: TxQuery, turmaId: number, tipo: TipoReembolso, fileId: string, impressao: string, actorId: string | null) {
  const antes = await one<{ drive_file_id: string }>(q,
    "SELECT drive_file_id FROM reembolso_ficheiros WHERE turma_id = $1 AND tipo = $2 FOR UPDATE", [turmaId, tipo]);
  await many(q,
    `INSERT INTO reembolso_ficheiros (turma_id, tipo, drive_file_id, impressao, atualizado_em, atualizado_por)
     VALUES ($1, $2, $3, $4, now(), $5)
     ON CONFLICT (turma_id, tipo) DO UPDATE
       SET drive_file_id = EXCLUDED.drive_file_id, impressao = EXCLUDED.impressao,
           atualizado_em = EXCLUDED.atualizado_em, atualizado_por = EXCLUDED.atualizado_por`,
    [turmaId, tipo, fileId, impressao, actorId]);
  return antes?.drive_file_id && antes.drive_file_id !== fileId ? antes.drive_file_id : null;
}
