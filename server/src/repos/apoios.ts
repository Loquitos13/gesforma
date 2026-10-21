/**
 * Apoios aos formandos da Financiada: regras por âmbito, IBAN do formando e registos por mês.
 * Todo o SQL dos apoios vive aqui.
 */
import { many, one, type Consulta } from "./sql.js";

export const TIPOS_APOIO = ["bolsa", "alimentacao", "transporte", "acolhimento", "alojamento"] as const;
export type TipoApoio = typeof TIPOS_APOIO[number];
export type ModoApoio = "hora" | "dia" | "mes";
export type EstadoApoio = "calculado" | "aprovado" | "pago" | "anulado";

export type RegraApoioRow = {
  id: number;
  financiador: string;
  turma_id: number | null;
  tipo: TipoApoio;
  ativo: boolean;
  modo: ModoApoio;
  valor: string | number;
  min_horas_dia: string | number;
  teto_mensal: string | number | null;
  assiduidade_minima: string | number | null;
  requer_iban: boolean;
  notas: string;
  updated_at: string | Date;
};

export type RegraApoioNova = {
  tipo: TipoApoio;
  ativo: boolean;
  modo: ModoApoio;
  valor: number;
  minHorasDia: number;
  tetoMensal: number | null;
  assiduidadeMinima: number | null;
  requerIban: boolean;
  notas: string;
};

export type ApoioRow = {
  id: number;
  formando_id: number;
  turma_id: number;
  periodo: string;
  tipo: TipoApoio;
  dias: number;
  horas: string | number;
  valor_calculado: string | number;
  ajuste: string | number;
  motivo_ajuste: string;
  estado: EstadoApoio;
  detalhe: unknown;
  pago_em: string | Date | null;
  referencia: string;
  notas: string;
  updated_at: string | Date;
  formando_nome?: string;
};

const COLS_APOIO = `a.id, a.formando_id, a.turma_id, a.periodo, a.tipo, a.dias, a.horas, a.valor_calculado, a.ajuste,
  a.motivo_ajuste, a.estado, a.detalhe, a.pago_em, a.referencia, a.notas, a.updated_at`;

/** Todas as regras (gerais, por financiador e por turma). */
export function listarRegras(c: Consulta) {
  return many<RegraApoioRow>(
    c,
    `SELECT id, financiador, turma_id, tipo, ativo, modo, valor, min_horas_dia, teto_mensal, assiduidade_minima,
            requer_iban, notas, updated_at
       FROM apoio_regras ORDER BY financiador, turma_id NULLS FIRST, tipo`,
  );
}

/** Regras que podem valer para uma turma: a própria, as do financiador e as gerais. */
export function regrasParaTurma(c: Consulta, turmaId: number, financiador: string) {
  return many<RegraApoioRow>(
    c,
    `SELECT id, financiador, turma_id, tipo, ativo, modo, valor, min_horas_dia, teto_mensal, assiduidade_minima,
            requer_iban, notas, updated_at
       FROM apoio_regras
      WHERE turma_id = $1 OR (turma_id IS NULL AND financiador IN ($2, ''))`,
    [turmaId, financiador],
  );
}

/** Substitui as regras de um âmbito (financiador e, opcionalmente, turma). Lista vazia apaga o âmbito. */
export async function substituirRegras(
  c: Consulta,
  ambito: { financiador: string; turmaId: number | null },
  regras: RegraApoioNova[],
  actorId: string,
) {
  await many(
    c,
    "DELETE FROM apoio_regras WHERE financiador = $1 AND COALESCE(turma_id, 0) = COALESCE($2::int, 0)",
    [ambito.financiador, ambito.turmaId],
  );
  for (const r of regras) {
    await many(
      c,
      `INSERT INTO apoio_regras
         (financiador, turma_id, tipo, ativo, modo, valor, min_horas_dia, teto_mensal, assiduidade_minima, requer_iban, notas, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [ambito.financiador, ambito.turmaId, r.tipo, r.ativo, r.modo, r.valor, r.minHorasDia, r.tetoMensal,
        r.assiduidadeMinima, r.requerIban, r.notas, actorId],
    );
  }
}

/** Financiadores em uso nas turmas da Financiada (para escolher o âmbito). */
export async function financiadoresEmUso(c: Consulta) {
  const r = await many<{ financiador: string }>(
    c,
    "SELECT DISTINCT financiador FROM turmas_fin WHERE financiador <> '' ORDER BY financiador",
  );
  return r.map(x => x.financiador);
}

/** Turmas ativas da Financiada (para escolher a turma de uma regra própria). */
export function turmasFinAtivas(c: Consulta) {
  return many<{ id: number; nome: string; financiador: string }>(
    c,
    "SELECT id, nome, financiador FROM turmas_fin WHERE activa ORDER BY nome",
  );
}

export type TurmaApoio ={ id: number; nome: string; curso: string; financiador: string; cronograma: unknown };

export function turmaFin(c: Consulta, turmaId: number) {
  return one<TurmaApoio>(c, "SELECT id, nome, curso, financiador, cronograma FROM turmas_fin WHERE id = $1", [turmaId]);
}

export function formandoFin(c: Consulta, formandoId: number) {
  return one<{ id: number; nome: string; apelido: string; turma_id: number | null }>(
    c,
    "SELECT id, nome, apelido, turma_id FROM formandos_fin WHERE id = $1",
    [formandoId],
  );
}

/** Formandos da turma (pela ligação `turma_id`), sem os que desistiram. */
export function formandosDaTurma(c: Consulta, turmaId: number) {
  return many<{ id: number; nome: string; apelido: string; estado: string }>(
    c,
    `SELECT id, nome, apelido, estado FROM formandos_fin
      WHERE turma_id = $1 AND estado NOT IN ('Desistiu', 'Indeferido')
      ORDER BY nome, apelido`,
    [turmaId],
  );
}

/** Fichas da Financiada pelos ids, em qualquer turma e estado (para o direito de um mês já passado). */
export function formandosFinPorIds(c: Consulta, ids: number[]) {
  if (!ids.length) return Promise.resolve([] as { id: number; nome: string; apelido: string; estado: string }[]);
  return many<{ id: number; nome: string; apelido: string; estado: string }>(
    c,
    `SELECT id, nome, apelido, estado FROM formandos_fin
      WHERE id IN (SELECT (jsonb_array_elements_text($1::jsonb))::int)
      ORDER BY nome, apelido`,
    [JSON.stringify(ids)],
  );
}

/** IBAN cifrado e titular de vários formandos. */
export function dadosBancarios(c: Consulta, formandoIds: number[]) {
  if (!formandoIds.length) return Promise.resolve([] as { formando_id: number; iban_enc: string; titular: string }[]);
  return many<{ formando_id: number; iban_enc: string; titular: string }>(
    c,
    `SELECT formando_id, iban_enc, titular FROM formando_apoio_dados
      WHERE formando_id IN (SELECT (jsonb_array_elements_text($1::jsonb))::int)`,
    [JSON.stringify(formandoIds)],
  );
}

export async function gravarDadosBancarios(c: Consulta, formandoId: number, ibanEnc: string, titular: string, actorId: string | null) {
  await many(
    c,
    `INSERT INTO formando_apoio_dados (formando_id, iban_enc, titular, updated_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (formando_id) DO UPDATE
       SET iban_enc = EXCLUDED.iban_enc, titular = EXCLUDED.titular, updated_at = now(), updated_by = EXCLUDED.updated_by`,
    [formandoId, ibanEnc, titular, actorId],
  );
}

/** Folhas de presença de uma turma da Financiada. */
export function folhasFin(c: Consulta, turmaId: number) {
  return many<{ sessao_n: number; presencas: unknown }>(
    c,
    "SELECT sessao_n, presencas FROM turma_sessoes WHERE regime = 'fin' AND turma_id = $1 AND sessao_n IS NOT NULL",
    [turmaId],
  );
}

export function apoiosDoFormando(c: Consulta, formandoId: number) {
  return many<ApoioRow>(
    c,
    `SELECT ${COLS_APOIO} FROM apoios a WHERE a.formando_id = $1 ORDER BY a.periodo DESC, a.tipo`,
    [formandoId],
  );
}

export function apoiosDaTurma(c: Consulta, turmaId: number, periodo: string | null) {
  return many<ApoioRow>(
    c,
    `SELECT ${COLS_APOIO}, trim(f.nome || ' ' || f.apelido) AS formando_nome
       FROM apoios a LEFT JOIN formandos_fin f ON f.id = a.formando_id
      WHERE a.turma_id = $1 AND ($2::text IS NULL OR a.periodo = $2)
      ORDER BY a.periodo DESC, formando_nome, a.tipo`,
    [turmaId, periodo],
  );
}

export function apoioPorId(c: Consulta, id: number) {
  return one<ApoioRow>(c, `SELECT ${COLS_APOIO} FROM apoios a WHERE a.id = $1`, [id]);
}

export type ApoioCalculadoNovo = {
  formandoId: number;
  turmaId: number;
  periodo: string;
  tipo: TipoApoio;
  dias: number;
  horas: number;
  valor: number;
  detalhe: Record<string, unknown>;
};

/**
 * Grava um apoio calculado. Se já existir para o mesmo formando, mês e tipo, só é recalculado
 * enquanto estiver "calculado" (ou anulado por um recálculo anterior); aprovados, pagos e anulados à mão ficam como estão.
 * Devolve "criado", "atualizado" ou "mantido".
 */
export async function gravarCalculado(c: Consulta, a: ApoioCalculadoNovo, actorId: string) {
  const r = await one<{ acao: string }>(
    c,
    `WITH antes AS (
       SELECT estado FROM apoios WHERE formando_id = $1 AND periodo = $3 AND tipo = $4
     ), gravado AS (
       INSERT INTO apoios (formando_id, turma_id, periodo, tipo, dias, horas, valor_calculado, detalhe, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $9)
       ON CONFLICT (formando_id, periodo, tipo) DO UPDATE
         SET turma_id = EXCLUDED.turma_id, dias = EXCLUDED.dias, horas = EXCLUDED.horas,
             valor_calculado = EXCLUDED.valor_calculado, detalhe = EXCLUDED.detalhe, estado = 'calculado',
             -- O ajuste manual mantém-se, mas o valor final (calculado + ajuste) nunca fica negativo.
             ajuste = GREATEST(apoios.ajuste, -EXCLUDED.valor_calculado),
             updated_at = now(), updated_by = EXCLUDED.updated_by
         WHERE apoios.estado = 'calculado' OR (apoios.estado = 'anulado' AND apoios.detalhe->>'anuladoNoRecalculo' = 'true')
       RETURNING id
     )
     SELECT CASE
              WHEN NOT EXISTS (SELECT 1 FROM antes) THEN 'criado'
              WHEN EXISTS (SELECT 1 FROM gravado) THEN 'atualizado'
              ELSE 'mantido'
            END AS acao`,
    [a.formandoId, a.turmaId, a.periodo, a.tipo, a.dias, a.horas, a.valor, JSON.stringify(a.detalhe), actorId],
  );
  return (r?.acao ?? "mantido") as "criado" | "atualizado" | "mantido";
}

/**
 * O recálculo deixou de dar direito (valor 0 ou sem IBAN): anula o registo ainda "calculado"
 * para não seguir para pagamento. Devolve true se havia um para anular.
 */
export async function anularCalculado(c: Consulta, a: { formandoId: number; periodo: string; tipo: TipoApoio; motivo: string }, actorId: string) {
  const r = await one(
    c,
    `UPDATE apoios SET estado = 'anulado', detalhe = detalhe || jsonb_build_object('anuladoNoRecalculo', true, 'motivo', $4::text),
            updated_at = now(), updated_by = $5
      WHERE formando_id = $1 AND periodo = $2 AND tipo = $3 AND estado = 'calculado'
      RETURNING id`,
    [a.formandoId, a.periodo, a.tipo, a.motivo, actorId],
  );
  return !!r;
}

export type AlteracaoApoio = {
  estado?: EstadoApoio;
  pagoEm?: string | null;
  referencia?: string;
  notas?: string;
  ajuste?: number;
  motivoAjuste?: string;
};

export async function alterarApoio(c: Consulta, id: number, a: AlteracaoApoio, actorId: string) {
  return one<ApoioRow>(
    c,
    `UPDATE apoios a SET
       estado = COALESCE($2, a.estado),
       pago_em = CASE WHEN $3::boolean THEN $4::date ELSE a.pago_em END,
       referencia = COALESCE($5, a.referencia),
       notas = COALESCE($6, a.notas),
       ajuste = COALESCE($7, a.ajuste),
       motivo_ajuste = COALESCE($8, a.motivo_ajuste),
       updated_at = now(), updated_by = $9
     WHERE a.id = $1
     RETURNING ${COLS_APOIO}`,
    [id, a.estado ?? null, a.pagoEm !== undefined, a.pagoEm ?? null, a.referencia ?? null, a.notas ?? null,
      a.ajuste ?? null, a.motivoAjuste ?? null, actorId],
  );
}

/** Apoios por tratar (para o painel da Financiada): calculados por aprovar e aprovados por pagar. */
export async function apoiosPendentes(c: Consulta) {
  const r = await one<{ calculados: number; aprovados: number; valor: string | number }>(
    c,
    `SELECT count(*) FILTER (WHERE estado = 'calculado')::int AS calculados,
            count(*) FILTER (WHERE estado = 'aprovado')::int AS aprovados,
            COALESCE(sum(valor_calculado + ajuste) FILTER (WHERE estado IN ('calculado', 'aprovado')), 0) AS valor
       FROM apoios`,
  );
  return { calculados: Number(r?.calculados ?? 0), aprovados: Number(r?.aprovados ?? 0), valor: Number(r?.valor ?? 0) };
}
