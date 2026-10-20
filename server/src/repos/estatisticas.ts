/**
 * Estatísticas dos painéis Gold e Financiada: fragmentos SQL partilhados (datas, filtros)
 * e as consultas de indicadores e da série mensal. Toda a agregação é feita em SQL.
 */
import { Filtros, many, one, type Consulta, type Regime } from "./sql.js";
import { sqlADecorrer } from "./turmas.js";

/** Hoje em Lisboa (aaaa-mm-dd), para comparar com as datas em texto das turmas. */
export const HOJE_LISBOA = "to_char((now() AT TIME ZONE 'Europe/Lisbon')::date, 'YYYY-MM-DD')";

export type FiltroPainel = {
  regime: Regime;
  de: string;
  ate: string;
  anterior: { de: string; ate: string };
  curso?: string;
  local?: string;
  horario?: string;
  financiador?: string;
};

// ── Fragmentos SQL fixos (nunca recebem texto do pedido) ─────────────────────

/** Dia civil (Lisboa) da pré-inscrição. `inscrito` é um carimbo UTC sem fuso; sem ele usa-se created_at. */
export const DIA_LEAD = `(CASE
  WHEN p.inscrito ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}[ T][0-9]{2}:[0-9]{2}'
    THEN ((substring(p.inscrito from 1 for 16) || ':00')::timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Lisbon')::date
  WHEN p.inscrito ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN substring(p.inscrito from 1 for 10)::date
  ELSE (p.created_at AT TIME ZONE 'Europe/Lisbon')::date
END)`;

/**
 * Dia civil (Lisboa) da inscrição do formando Gold (campo texto `inscrito`). Com hora, é um carimbo UTC
 * sem fuso (como o das pré-inscrições, ver DIA_LEAD); só com a data, é já o dia escrito.
 */
export const DIA_FORMANDO = `(CASE
  WHEN fg.inscrito ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}[ T][0-9]{2}:[0-9]{2}'
    THEN ((substring(fg.inscrito from 1 for 16) || ':00')::timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Lisbon')::date
  WHEN fg.inscrito ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN substring(fg.inscrito from 1 for 10)::date
  WHEN fg.inscrito ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}' THEN to_date(substring(fg.inscrito from 1 for 10), 'DD/MM/YYYY')
  ELSE NULL
END)`;

/** Dia em que o pagamento ficou pago: `pago_em`, senão a data escrita no pagamento. */
export const DIA_PAGO = `COALESCE((pg.pago_em AT TIME ZONE 'Europe/Lisbon')::date, CASE
  WHEN pg.data ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN substring(pg.data from 1 for 10)::date
  WHEN pg.data ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}' THEN to_date(substring(pg.data from 1 for 10), 'DD/MM/YYYY')
  ELSE NULL
END)`;

export const PAGO = `pg.estado ILIKE 'pago%'`;
/** Por receber: nem pago, nem recusado/cancelado. */
export const PENDENTE = `NOT (pg.estado ILIKE 'pago%') AND pg.estado !~* 'recus|cancel|anul|devol'`;

/** Pagamento de um curso financiado (a Financiada não cobra: isto separa os regimes). */
const PAGAMENTO_FIN = `EXISTS (SELECT 1 FROM cursos_fin c
  WHERE lower(trim(c.nome_comercial)) = lower(trim(pg.curso)) OR lower(trim(c.ufcd)) = lower(trim(pg.curso)))`;

/** Formandos que ocupam vaga: todos menos desistentes e indeferidos (regra de inscricao.ts). */
export const OCUPA = (alias: string) =>
  `NOT (lower(coalesce(${alias}.estado, '')) LIKE 'desist%' OR lower(coalesce(${alias}.estado, '')) = 'indeferido')`;

/** Pré-inscrição ainda em aberto (não desistiu nem passou a formando). */
export const LEAD_ABERTO = `p.estado NOT IN ('Desistiu', 'Formando')`;

/** Turma da pré-inscrição (escolhida na ligação ou atribuída). */
const TURMA_LEAD = "COALESCE(p.turma_escolhida_id, p.turma_id)";

// ── Filtros por entidade ────────────────────────────────────────────────────

/** Pré-inscrições (alias `p`) do regime e dos filtros do painel. */
export function filtrarLeads(f: FiltroPainel, w = new Filtros()) {
  w.add("COALESCE(p.regime, 'gold') = ?", f.regime);
  w.add("lower(trim(p.curso)) = lower(trim(?))", f.curso);
  w.add("p.local = ?", f.local);
  w.add("p.horario = ?", f.horario);
  if (f.regime === "fin") {
    w.add(`EXISTS (SELECT 1 FROM turmas_fin tf WHERE tf.id = ${TURMA_LEAD} AND tf.financiador = ?)`, f.financiador);
  }
  return w;
}

/** Formandos Gold (alias `fg`). */
export function filtrarFormandosGold(f: FiltroPainel, w = new Filtros()) {
  w.add("lower(trim(fg.curso)) = lower(trim(?))", f.curso);
  w.add("fg.local = ?", f.local);
  w.add("EXISTS (SELECT 1 FROM turmas_gold t WHERE t.id = fg.turma_id AND t.horario = ?)", f.horario);
  return w;
}

/** Formandos financiados (alias `ff`), filtrados pela turma onde estão. */
export function filtrarFormandosFin(f: FiltroPainel, w = new Filtros()) {
  w.add("lower(trim(ff.curso)) = lower(trim(?))", f.curso);
  w.add("EXISTS (SELECT 1 FROM turmas_fin t WHERE t.id = ff.turma_id AND t.local = ?)", f.local);
  w.add("EXISTS (SELECT 1 FROM turmas_fin t WHERE t.id = ff.turma_id AND t.horario = ?)", f.horario);
  w.add("EXISTS (SELECT 1 FROM turmas_fin t WHERE t.id = ff.turma_id AND t.financiador = ?)", f.financiador);
  return w;
}

/** Turmas (alias `t`) do regime. */
export function filtrarTurmas(f: FiltroPainel, w = new Filtros()) {
  w.add("lower(trim(t.curso)) = lower(trim(?))", f.curso);
  w.add("t.local = ?", f.local);
  w.add("t.horario = ?", f.horario);
  if (f.regime === "fin") w.add("t.financiador = ?", f.financiador);
  return w;
}

/** Joins para filtrar pagamentos por local e horário (turma do pagamento ou do formando). */
export const JOINS_PAGAMENTO = `LEFT JOIN turmas_gold tp ON tp.id = pg.turma_id
  LEFT JOIN formandos_gold fp ON fp.id = pg.formando_id
  LEFT JOIN turmas_gold tfp ON tfp.id = fp.turma_id`;

/** Pagamentos (alias `pg`, com JOINS_PAGAMENTO) do regime Gold e dos filtros. */
export function filtrarPagamentos(f: FiltroPainel, w = new Filtros()) {
  w.sempre(f.regime === "fin" ? PAGAMENTO_FIN : `NOT ${PAGAMENTO_FIN}`);
  w.add("lower(trim(pg.curso)) = lower(trim(?))", f.curso);
  w.add("COALESCE(tp.local, fp.local, '') = ?", f.local);
  w.add("COALESCE(tp.horario, tfp.horario, '') = ?", f.horario);
  return w;
}

// ── Indicadores (período actual e anterior numa só consulta) ────────────────

type Par = { atual: number; anterior: number };
const par = (r: { atual?: unknown; anterior?: unknown } | null): Par => ({ atual: Number(r?.atual ?? 0), anterior: Number(r?.anterior ?? 0) });

/** Parâmetros $1..$4: início/fim do período e do período anterior. */
function periodos(f: FiltroPainel) {
  return new Filtros([f.de, f.ate, f.anterior.de, f.anterior.ate]);
}
const NO_ATUAL = (dia: string) => `${dia} BETWEEN $1::date AND $2::date`;
const NO_ANTERIOR = (dia: string) => `${dia} BETWEEN $3::date AND $4::date`;

export async function contarLeads(c: Consulta, f: FiltroPainel): Promise<Par> {
  const w = filtrarLeads(f, periodos(f));
  return par(await one(c, `SELECT count(*) FILTER (WHERE ${NO_ATUAL(DIA_LEAD)})::int AS atual,
                                  count(*) FILTER (WHERE ${NO_ANTERIOR(DIA_LEAD)})::int AS anterior
                             FROM preinscricoes p ${w.where}`, w.params));
}

/** Pré-inscrições validadas no período (Financiada). */
export async function contarValidadas(c: Consulta, f: FiltroPainel): Promise<Par> {
  const w = filtrarLeads(f, periodos(f)).sempre("p.validada_em IS NOT NULL");
  const dia = "(p.validada_em AT TIME ZONE 'Europe/Lisbon')::date";
  return par(await one(c, `SELECT count(*) FILTER (WHERE ${NO_ATUAL(dia)})::int AS atual,
                                  count(*) FILTER (WHERE ${NO_ANTERIOR(dia)})::int AS anterior
                             FROM preinscricoes p ${w.where}`, w.params));
}

/** Novos formandos Gold (ficha criada no período). */
export async function contarFormandosGold(c: Consulta, f: FiltroPainel): Promise<Par> {
  const w = filtrarFormandosGold(f, periodos(f)).sempre(OCUPA("fg"));
  return par(await one(c, `SELECT count(*) FILTER (WHERE ${NO_ATUAL(DIA_FORMANDO)})::int AS atual,
                                  count(*) FILTER (WHERE ${NO_ANTERIOR(DIA_FORMANDO)})::int AS anterior
                             FROM formandos_gold fg ${w.where}`, w.params));
}

export async function somarReceita(c: Consulta, f: FiltroPainel): Promise<Par & { pagos: number }> {
  const w = filtrarPagamentos(f, periodos(f)).sempre(PAGO);
  const r = await one(c, `SELECT COALESCE(sum(pg.valor) FILTER (WHERE ${NO_ATUAL(DIA_PAGO)}), 0)::float AS atual,
                                 COALESCE(sum(pg.valor) FILTER (WHERE ${NO_ANTERIOR(DIA_PAGO)}), 0)::float AS anterior,
                                 count(*) FILTER (WHERE ${NO_ATUAL(DIA_PAGO)})::int AS pagos
                            FROM pagamentos pg ${JOINS_PAGAMENTO} ${w.where}`, w.params);
  return { ...par(r), pagos: Number(r?.pagos ?? 0) };
}

/** Pré-inscrições em aberto ainda sem contacto (estado actual, não do período). */
export async function porContactar(c: Consulta, f: FiltroPainel) {
  const w = filtrarLeads(f).sempre("p.contactado_em IS NULL").sempre(LEAD_ABERTO).sempre("p.validada_em IS NULL");
  const r = await one(c, `SELECT count(*)::int AS n,
                                 count(*) FILTER (WHERE ${DIA_LEAD} < (now() AT TIME ZONE 'Europe/Lisbon')::date - 2)::int AS atrasados,
                                 COALESCE(max((now() AT TIME ZONE 'Europe/Lisbon')::date - ${DIA_LEAD}), 0)::int AS dias,
                                 (array_agg(p.id ORDER BY ${DIA_LEAD}, p.id))[1] AS id
                            FROM preinscricoes p ${w.where}`, w.params);
  return { n: Number(r?.n ?? 0), atrasados: Number(r?.atrasados ?? 0), maisAntigaDias: Number(r?.dias ?? 0), leadId: r?.id == null ? null : Number(r.id) };
}

/**
 * Turmas a decorrer (a mesma fase do separador «A decorrer» da lista de turmas: sem as «por fechar»)
 * e as que começam no mês corrente. Datas de início em texto aaaa-mm-dd.
 */
export async function turmasADecorrer(c: Consulta, f: FiltroPainel) {
  const w = filtrarTurmas(f).sempre("t.fechada_em IS NULL");
  const tabela = f.regime === "gold" ? "turmas_gold" : "turmas_fin";
  const r = await one(c, `SELECT
      count(*) FILTER (WHERE ${sqlADecorrer(f.regime, HOJE_LISBOA)})::int AS decorrer,
      count(*) FILTER (WHERE t.data_inicio ~ '^[0-9]{4}-'
        AND t.data_inicio::date > (now() AT TIME ZONE 'Europe/Lisbon')::date
        AND date_trunc('month', t.data_inicio::date) = date_trunc('month', (now() AT TIME ZONE 'Europe/Lisbon')::date))::int AS comecam
    FROM ${tabela} t ${w.where}`, w.params);
  return { decorrer: Number(r?.decorrer ?? 0), comecamEsteMes: Number(r?.comecam ?? 0) };
}

// ── Série mensal (24 meses até ao mês de `ate`) ─────────────────────────────

export type LinhaMes = { mes: string; chave: string | null; v: number; n: number };

/** $1 = primeiro dia da janela, $2 = último dia do mês de `ate`. */
function janela(f: FiltroPainel) {
  return new Filtros([f.ate, f.ate]);
}
const INICIO_JANELA = "(date_trunc('month', $1::date) - interval '23 months')::date";
const FIM_JANELA = "(date_trunc('month', $2::date) + interval '1 month - 1 day')::date";
const NA_JANELA = (dia: string) => `${dia} BETWEEN ${INICIO_JANELA} AND ${FIM_JANELA}`;
const MES = (dia: string) => `to_char(date_trunc('month', ${dia}), 'YYYY-MM')`;

/**
 * Pré-inscrições por mês e por "como conheceu" (GROUPING SETS: a linha com chave null é o total do mês).
 * Devolve também quantas dessas pré-inscrições passaram a formando.
 */
export async function leadsPorMes(c: Consulta, f: FiltroPainel): Promise<LinhaMes[]> {
  const w = filtrarLeads(f, janela(f)).sempre(NA_JANELA(DIA_LEAD));
  const linhas = await many<{ mes: string; chave: string | null; n: number }>(c, `
    SELECT ${MES(DIA_LEAD)} AS mes, COALESCE(NULLIF(trim(p.origem), ''), 'Outro') AS chave, count(*)::int AS n
      FROM preinscricoes p ${w.where}
     GROUP BY GROUPING SETS ((1, 2), (1))`, w.params);
  return linhas.map(l => ({ mes: l.mes, chave: l.chave, v: Number(l.n), n: Number(l.n) }));
}

/** Receita Gold por mês e por curso (linha com chave null = total do mês). */
export async function receitaPorMes(c: Consulta, f: FiltroPainel): Promise<LinhaMes[]> {
  const w = filtrarPagamentos(f, janela(f)).sempre(PAGO).sempre(NA_JANELA(DIA_PAGO));
  const linhas = await many<{ mes: string; chave: string | null; v: number; n: number }>(c, `
    SELECT ${MES(DIA_PAGO)} AS mes, COALESCE(NULLIF(trim(pg.curso), ''), 'Sem curso') AS chave,
           COALESCE(sum(pg.valor), 0)::float AS v, count(*)::int AS n
      FROM pagamentos pg ${JOINS_PAGAMENTO} ${w.where}
     GROUP BY GROUPING SETS ((1, 2), (1))`, w.params);
  return linhas.map(l => ({ mes: l.mes, chave: l.chave, v: Number(l.v), n: Number(l.n) }));
}

/** Novos formandos Gold por mês. */
export async function formandosGoldPorMes(c: Consulta, f: FiltroPainel): Promise<LinhaMes[]> {
  const w = filtrarFormandosGold(f, janela(f)).sempre(OCUPA("fg")).sempre(NA_JANELA(DIA_FORMANDO));
  const linhas = await many<{ mes: string; n: number }>(c, `
    SELECT ${MES(DIA_FORMANDO)} AS mes, count(*)::int AS n FROM formandos_gold fg ${w.where} GROUP BY 1`, w.params);
  return linhas.map(l => ({ mes: l.mes, chave: null, v: Number(l.n), n: Number(l.n) }));
}

/**
 * Financiada: inscrições validadas por mês e por curso (linha com chave null = total do mês),
 * com quantas ficaram colocadas numa turma.
 */
export async function validadasPorMes(c: Consulta, f: FiltroPainel): Promise<(LinhaMes & { colocadas: number })[]> {
  const dia = "(p.validada_em AT TIME ZONE 'Europe/Lisbon')::date";
  const w = filtrarLeads(f, janela(f)).sempre("p.validada_em IS NOT NULL").sempre(NA_JANELA(dia));
  const linhas = await many<{ mes: string; chave: string | null; n: number; colocadas: number }>(c, `
    SELECT ${MES(dia)} AS mes, COALESCE(NULLIF(trim(p.curso), ''), 'Sem curso') AS chave, count(*)::int AS n,
           count(*) FILTER (WHERE ${TURMA_LEAD} IS NOT NULL OR p.estado = 'Formando')::int AS colocadas
      FROM preinscricoes p ${w.where}
     GROUP BY GROUPING SETS ((1, 2), (1))`, w.params);
  return linhas.map(l => ({ mes: l.mes, chave: l.chave, v: Number(l.n), n: Number(l.n), colocadas: Number(l.colocadas) }));
}

/** As 24 chaves "aaaa-mm" da janela, por ordem cronológica, terminando no mês de `ate`. */
export function mesesDaJanela(ate: string): string[] {
  const [y, m] = ate.split("-").map(Number);
  const out: string[] = [];
  for (let i = 23; i >= 0; i--) {
    const d = new Date(Date.UTC(y!, m! - 1 - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}
