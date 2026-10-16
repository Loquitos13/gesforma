/**
 * Listas do CRM de pré-inscrições: filtros, filas de trabalho, contagens, facetas, pipeline e exportação.
 * Todos os filtros entram como parâmetros `$n`; ordem e colunas de facetas vêm de listas fixas.
 */
import { Filtros, many, padraoPesquisa, valor, type AtorCrm, type Consulta } from "./sql.js";

export type CrmFila = "contactar" | "atrasados" | "hoje" | "agenda" | "converter" | "abertos" | "secretaria" | "preinscricao" | "minhas";
export type CrmSort = "inscrito" | "proximo" | "valor" | "nome" | "actividade" | "comercial" | "origem" | "meio" | "etiqueta" | "curso" | "turma" | "estado";
export type CrmDir = "asc" | "desc";

export type CrmFiltros = {
  q?: string;
  estado?: string;
  curso?: string;
  local?: string;
  origem?: string;
  entrada?: "preinscricao" | "manual" | "";
  campanha?: string;
  campanhaId?: number;
  comercialId?: string;
  actorId?: string;
  /** Quem pede: o comercial só vê as suas, a Financiada só a Financiada (`Filtros.visivelPara`). */
  ator?: AtorCrm;
  fila?: CrmFila | "";
  regime?: "gold" | "fin" | "";
  de?: string;
  ate?: string;
};

type Linha = Record<string, unknown>;

/** Dia civil da pré-inscrição em Lisboa. O carimbo `inscrito` é UTC sem fuso. */
const DIA_INSCRITO = `(CASE
  WHEN inscrito ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}[ T][0-9]{2}:[0-9]{2}'
    THEN ((substring(inscrito from 1 for 16) || ':00')::timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Lisbon')::date
  WHEN inscrito ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
    THEN substring(inscrito from 1 for 10)::date
  ELSE (created_at AT TIME ZONE 'Europe/Lisbon')::date
END)`;

const FECHADOS = "estado NOT IN ('Formando','Desistiu')";

function filtros(f: CrmFiltros, hoje: string, semEstado = false) {
  const w = new Filtros();
  const q = (f.q ?? "").trim().slice(0, 80);
  const needle = padraoPesquisa(q);
  if (needle) {
    const id = Number(q);
    const texto = "nome ILIKE ? OR apelido ILIKE ? OR email ILIKE ? OR telf ILIKE ? OR curso ILIKE ? OR nif ILIKE ? OR id IN (SELECT preinscricao_id FROM preinscricao_contactos WHERE nota ILIKE ?)";
    if (Number.isInteger(id) && id > 0) w.add(`id = ? OR ${texto}`, id, needle, needle, needle, needle, needle, needle, needle);
    else w.add(texto, needle, needle, needle, needle, needle, needle, needle);
  }
  if (!semEstado && f.estado && f.estado !== "Todos") w.add("estado = ?", f.estado);
  w.add("curso = ?", f.curso);
  w.add("local = ?", f.local);
  w.add("origem = ?", f.origem);
  if (f.entrada === "preinscricao" || f.entrada === "manual") w.add("entrada = ?", f.entrada);
  w.add("campanha = ?", f.campanha);
  w.add("campanha_id = ?", f.campanhaId);
  if (f.comercialId === "eu") w.add("comercial_id = ?", f.actorId);
  else w.add("comercial_id = ?", f.comercialId);
  if (f.fila === "minhas") w.add("comercial_id = ?", f.actorId);
  if (f.fila === "contactar") w.sempre("estado = 'Não contactado'");
  if (f.fila === "atrasados") w.add(`proximo_contacto <> '' AND left(proximo_contacto,10) < ? AND ${FECHADOS}`, hoje);
  if (f.fila === "hoje") {
    w.add(`${DIA_INSCRITO} = ?::date OR (proximo_contacto <> '' AND left(proximo_contacto, 10) = ? AND ${FECHADOS})`, hoje, hoje);
  }
  if (f.fila === "agenda") {
    w.add(`${FECHADOS} AND (estado = 'Não contactado' OR (proximo_contacto <> '' AND left(proximo_contacto,10) <= ?))`, hoje);
  }
  if (f.fila === "converter") w.sempre("estado = 'Pago'");
  if (f.fila === "preinscricao") w.sempre("estado = 'Pré-inscrição' AND secretaria_em IS NULL");
  if (f.fila === "secretaria") w.sempre("estado = 'Pré-inscrição' AND secretaria_em IS NOT NULL");
  if (f.fila === "abertos") w.sempre(FECHADOS);
  if (f.regime === "gold" || f.regime === "fin") w.add("regime = ?", f.regime);
  w.visivelPara(f.ator, "comercial_id", "regime");
  if (f.de && /^\d{4}-\d{2}-\d{2}$/.test(f.de)) w.add(`${DIA_INSCRITO} >= ?::date`, f.de);
  if (f.ate && /^\d{4}-\d{2}-\d{2}$/.test(f.ate)) w.add(`${DIA_INSCRITO} <= ?::date`, f.ate);
  return w;
}

function comEtiqueta(inner: string) {
  return `SELECT p.*, e.nome AS etiqueta_nome, e.cor AS etiqueta_cor, u.name AS comercial_nome,
                 (SELECT count(*)::int FROM preinscricao_docs d WHERE d.preinscricao_id = p.id) AS docs_enviados,
                 (SELECT count(*)::int FROM preinscricao_docs d WHERE d.preinscricao_id = p.id AND d.estado = 'validado') AS docs_validados,
                 (SELECT count(*)::int FROM preinscricao_docs d WHERE d.preinscricao_id = p.id AND d.estado = 'recusado') AS docs_recusados
            FROM (${inner}) p
            LEFT JOIN crm_etiquetas e ON e.id = p.etiqueta_id
            LEFT JOIN users u ON u.id = p.comercial_id`;
}

/** ORDER BY a partir de uma lista fixa de colunas. */
function ordem(sort: CrmSort | undefined, dir: CrmDir | undefined) {
  const d = dir === "asc" ? "ASC" : "DESC";
  const id = `id ${d}`;
  const mapa: Record<CrmSort, string> = {
    nome: `nome ${d}, apelido ${d}, ${id}`,
    comercial: `comercial_nome ${d} NULLS LAST, ${id}`,
    origem: `origem ${d}, ${id}`,
    meio: `meio_contacto ${d}, ${id}`,
    etiqueta: `etiqueta_nome ${d} NULLS LAST, ${id}`,
    curso: `curso ${d}, ${id}`,
    turma: `local ${d}, horario ${d}, ${id}`,
    valor: `preco ${d}, ${id}`,
    proximo: `CASE WHEN proximo_contacto = '' THEN 1 ELSE 0 END, proximo_contacto ${d}, ${id}`,
    actividade: `COALESCE(ultima_actividade_em, created_at) ${d} NULLS LAST, ${id}`,
    estado: `estado ${d}, ${id}`,
    inscrito: `inscrito ${d}, ${id}`,
  };
  return `ORDER BY ${mapa[sort ?? "inscrito"] ?? mapa.inscrito}`;
}

/** Uma página da lista (com etiqueta e comercial) e o total do filtro. */
export async function pagina(
  c: Consulta, f: CrmFiltros, hoje: string, opts: { pagina: number; porPagina: number; sort?: CrmSort; dir?: CrmDir },
) {
  const w = filtros(f, hoje);
  const total = Number(await valor<number>(c, `SELECT count(*)::int AS n FROM preinscricoes ${w.where}`, w.params) ?? 0);
  const n = w.params.length;
  const linhas = await many<Linha>(c,
    `${comEtiqueta(`SELECT * FROM preinscricoes ${w.where}`)} ${ordem(opts.sort, opts.dir)} LIMIT $${n + 1} OFFSET $${n + 2}`,
    [...w.params, opts.porPagina, (opts.pagina - 1) * opts.porPagina]);
  return { total, linhas };
}

/** Até `limite` linhas do filtro, ordenadas (exportação CSV). */
export async function todas(c: Consulta, f: CrmFiltros, hoje: string, sort: CrmSort | undefined, dir: CrmDir | undefined, limite = 2000) {
  const w = filtros(f, hoje);
  return many<Linha>(c,
    `${comEtiqueta(`SELECT * FROM preinscricoes ${w.where}`)} ${ordem(sort, dir)} LIMIT $${w.params.length + 1}`,
    [...w.params, limite]);
}

/** Uma coluna do pipeline: total, valor e as primeiras `limite` linhas. */
export async function colunaPipeline(
  c: Consulta, f: CrmFiltros, hoje: string, estado: string, sort: CrmSort | undefined, dir: CrmDir | undefined, limite = 80,
) {
  const w = filtros(f, hoje, true).add("estado = ?", estado);
  const tot = await many<{ n: number; valor: number }>(c,
    `SELECT count(*)::int AS n, COALESCE(sum(preco),0)::float AS valor FROM preinscricoes ${w.where}`, w.params);
  const linhas = await many<Linha>(c,
    `${comEtiqueta(`SELECT * FROM preinscricoes ${w.where}`)} ${ordem(sort, dir)} LIMIT $${w.params.length + 1}`,
    [...w.params, limite]);
  return { total: tot[0]?.n ?? 0, valor: Number(tot[0]?.valor ?? 0), linhas };
}

/** Contagens das filas de trabalho e dos cartões (por regime). */
export async function contagens(c: Consulta, hoje: string, regime: "gold" | "fin" | "", ator?: AtorCrm) {
  const w = new Filtros([hoje]).visivelPara(ator, "comercial_id", "regime");
  if (regime) w.add("regime = ?", regime);
  const r = await many<Record<string, number>>(c,
    `SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE ${FECHADOS})::int AS abertos,
      count(*) FILTER (WHERE estado = 'Não contactado')::int AS por_contactar,
      count(*) FILTER (WHERE estado IN ('1º Contacto','2º Contacto'))::int AS conversa,
      count(*) FILTER (WHERE estado = 'Pago')::int AS pagos,
      count(*) FILTER (WHERE estado = 'Formando')::int AS formando,
      count(*) FILTER (WHERE proximo_contacto <> '' AND left(proximo_contacto,10) < $1 AND ${FECHADOS})::int AS atrasados,
      count(*) FILTER (WHERE left(proximo_contacto,10) = $1 AND ${FECHADOS})::int AS marcados_hoje,
      count(*) FILTER (WHERE ${DIA_INSCRITO} = $1::date OR (proximo_contacto <> '' AND left(proximo_contacto,10) = $1 AND ${FECHADOS}))::int AS hoje,
      COALESCE(sum(preco) FILTER (WHERE ${FECHADOS}), 0)::float AS valor_aberto,
      count(*) FILTER (WHERE entrada = 'preinscricao')::int AS preinscricoes,
      count(*) FILTER (WHERE entrada = 'manual')::int AS manuais,
      count(*) FILTER (WHERE estado = 'Pré-inscrição' AND secretaria_em IS NULL)::int AS fila_pre,
      count(*) FILTER (WHERE estado = 'Pré-inscrição' AND secretaria_em IS NOT NULL)::int AS fila_sec,
      count(*) FILTER (WHERE estado = 'Desistiu')::int AS desistiu,
      count(*) FILTER (WHERE estado = 'Não contactado' AND created_at < now() - interval '2 days')::int AS sem_contacto_2d
     FROM preinscricoes ${w.where}`,
    w.params);
  return r[0] ?? {};
}

export async function porEstado(c: Consulta, regime: "gold" | "fin" | "", ator?: AtorCrm) {
  const w = new Filtros().visivelPara(ator, "comercial_id", "regime");
  if (regime) w.add("regime = ?", regime);
  return many<{ estado: string; n: number }>(c, `SELECT estado, count(*)::int AS n FROM preinscricoes ${w.where} GROUP BY estado`, w.params);
}

const COLUNAS_FACETA = { curso: "curso", local: "local", origem: "origem", campanha: "campanha" } as const;

/** Valores mais usados de uma coluna (para os filtros). */
export async function faceta(c: Consulta, coluna: keyof typeof COLUNAS_FACETA, regime: "gold" | "fin" | "", ator?: AtorCrm) {
  const col = COLUNAS_FACETA[coluna];
  const w = new Filtros().sempre(`${col} <> ''`).visivelPara(ator, "comercial_id", "regime");
  if (regime) w.add("regime = ?", regime);
  const r = await many<{ v: string }>(c,
    `SELECT ${col} AS v FROM preinscricoes ${w.where} GROUP BY ${col} ORDER BY count(*) DESC, ${col} LIMIT 80`, w.params);
  return r.map(x => x.v);
}

/** Pesquisa rápida (nome, contacto, curso, NIF, notas ou número). */
export async function pesquisar(c: Consulta, q: string, limite: number, ator?: AtorCrm) {
  const needle = padraoPesquisa(q.slice(0, 80));
  if (!needle) return [];
  const w = new Filtros([needle, q.trim().slice(0, 12), Math.min(30, Math.max(1, limite))])
    .sempre(`nome ILIKE $1 OR apelido ILIKE $1 OR email ILIKE $1 OR telf ILIKE $1 OR curso ILIKE $1 OR nif ILIKE $1
         OR CAST(id AS text) = $2
         OR id IN (SELECT preinscricao_id FROM preinscricao_contactos WHERE nota ILIKE $1)`).visivelPara(ator, "comercial_id", "regime");
  return many<Linha>(c, comEtiqueta(`SELECT * FROM preinscricoes ${w.where} ORDER BY inscrito DESC LIMIT $3`), w.params);
}
