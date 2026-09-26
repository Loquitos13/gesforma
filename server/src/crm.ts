import type { Db } from "./db/pool.js";
import { mapPreinscricao } from "./ops.js";

export type CrmFila = "contactar" | "atrasados" | "hoje" | "converter" | "abertos";
export type CrmSort = "inscrito" | "proximo" | "valor" | "nome";

export type CrmListParams = {
  q?: string;
  estado?: string;
  curso?: string;
  local?: string;
  origem?: string;
  entrada?: "preinscricao" | "manual" | "";
  campanha?: string;
  fila?: CrmFila | "";
  page?: number;
  perPage?: number;
  sort?: CrmSort;
  kanban?: boolean;
};

function like(raw: string) {
  return `%${raw.replace(/[%_\\]/g, ch => `\\${ch}`).slice(0, 80)}%`;
}

function addWhere(params: CrmListParams, hoje: string, skipEstado = false) {
  const vals: unknown[] = [];
  const parts: string[] = ["TRUE"];
  const push = (fragment: string, ...vs: unknown[]) => {
    let sql = fragment;
    for (const v of vs) {
      vals.push(v);
      sql = sql.replace("?", `$${vals.length}`);
    }
    parts.push(sql);
  };
  const q = (params.q ?? "").trim();
  if (q) {
    const needle = like(q);
    const id = Number(q);
    if (Number.isInteger(id) && id > 0) {
      push("(id = ? OR nome ILIKE ? OR apelido ILIKE ? OR email ILIKE ? OR telf ILIKE ? OR curso ILIKE ?)", id, needle, needle, needle, needle, needle);
    } else {
      push("(nome ILIKE ? OR apelido ILIKE ? OR email ILIKE ? OR telf ILIKE ? OR curso ILIKE ?)", needle, needle, needle, needle, needle);
    }
  }
  if (!skipEstado && params.estado && params.estado !== "Todos") push("estado = ?", params.estado);
  if (params.curso) push("curso = ?", params.curso);
  if (params.local) push("local = ?", params.local);
  if (params.origem) push("origem = ?", params.origem);
  if (params.entrada === "preinscricao" || params.entrada === "manual") push("entrada = ?", params.entrada);
  if (params.campanha) push("campanha = ?", params.campanha);
  if (params.fila === "contactar") parts.push("estado = 'Não contactado'");
  if (params.fila === "atrasados") {
    push("proximo_contacto <> '' AND proximo_contacto < ? AND estado NOT IN ('Pago','Formando')", hoje);
  }
  if (params.fila === "hoje") {
    push("proximo_contacto = ? AND estado NOT IN ('Pago','Formando')", hoje);
  }
  if (params.fila === "converter") parts.push("estado = 'Pago'");
  if (params.fila === "abertos") parts.push("estado <> 'Formando'");
  return { sql: parts.join(" AND "), vals };
}

function orderSql(sort: CrmSort | undefined) {
  if (sort === "proximo") return "CASE WHEN proximo_contacto = '' THEN '9999-12-31' ELSE proximo_contacto END ASC, inscrito DESC";
  if (sort === "valor") return "preco DESC, inscrito DESC";
  if (sort === "nome") return "nome ASC, apelido ASC";
  return "inscrito DESC, id DESC";
}

export async function queryCrmLeads(db: Db, params: CrmListParams, hoje: string) {
  const page = Math.max(1, params.page ?? 1);
  const perPage = Math.min(100, Math.max(10, params.perPage ?? 50));
  const { sql, vals } = addWhere(params, hoje);
  const count = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM preinscricoes WHERE ${sql}`, vals);
  const total = count.rows[0]?.n ?? 0;
  const offset = (page - 1) * perPage;
  const rows = await db.query(
    `SELECT * FROM preinscricoes WHERE ${sql} ORDER BY ${orderSql(params.sort)} LIMIT $${vals.length + 1} OFFSET $${vals.length + 2}`,
    [...vals, perPage, offset],
  );
  const items = rows.rows.map(r => mapPreinscricao(r as Record<string, unknown>));

  const counts = await db.query<{
    total: number; abertos: number; por_contactar: number; conversa: number; pagos: number;
    formando: number; atrasados: number; hoje: number; valor_aberto: number;
    preinscricoes: number; manuais: number;
  }>(
    `SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE estado <> 'Formando')::int AS abertos,
      count(*) FILTER (WHERE estado = 'Não contactado')::int AS por_contactar,
      count(*) FILTER (WHERE estado IN ('1º Contacto','2º Contacto'))::int AS conversa,
      count(*) FILTER (WHERE estado = 'Pago')::int AS pagos,
      count(*) FILTER (WHERE estado = 'Formando')::int AS formando,
      count(*) FILTER (WHERE proximo_contacto <> '' AND proximo_contacto < $1 AND estado NOT IN ('Pago','Formando'))::int AS atrasados,
      count(*) FILTER (WHERE proximo_contacto = $1 AND estado NOT IN ('Pago','Formando'))::int AS hoje,
      COALESCE(sum(preco) FILTER (WHERE estado <> 'Formando'), 0)::float AS valor_aberto,
      count(*) FILTER (WHERE entrada = 'preinscricao')::int AS preinscricoes,
      count(*) FILTER (WHERE entrada = 'manual')::int AS manuais
     FROM preinscricoes`,
    [hoje],
  );
  const c = counts.rows[0];

  const porEstadoRows = await db.query<{ estado: string; n: number }>(
    "SELECT estado, count(*)::int AS n FROM preinscricoes GROUP BY estado",
  );
  const porEstado: Record<string, number> = {};
  for (const r of porEstadoRows.rows) porEstado[r.estado] = r.n;

  const facet = async (col: string) => {
    const r = await db.query<{ v: string }>(
      `SELECT ${col} AS v FROM preinscricoes WHERE ${col} <> '' GROUP BY ${col} ORDER BY count(*) DESC, ${col} LIMIT 80`,
    );
    return r.rows.map(x => x.v);
  };
  const [cursos, locais, origens, campanhas] = await Promise.all([
    facet("curso"), facet("local"), facet("origem"), facet("campanha"),
  ]);

  let columns: { estado: string; total: number; items: ReturnType<typeof mapPreinscricao>[] }[] | undefined;
  if (params.kanban) {
    const estados = ["Não contactado", "1º Contacto", "2º Contacto", "Pago", "Formando"];
    const { sql: sqlK, vals: valsK } = addWhere({ ...params, estado: undefined, fila: params.fila }, hoje, true);
    columns = [];
    for (const estado of estados) {
      const colVals = [...valsK, estado];
      const n = await db.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM preinscricoes WHERE ${sqlK} AND estado = $${colVals.length}`,
        colVals,
      );
      const list = await db.query(
        `SELECT * FROM preinscricoes WHERE ${sqlK} AND estado = $${colVals.length}
         ORDER BY ${orderSql(params.sort)} LIMIT 20`,
        colVals,
      );
      columns.push({
        estado,
        total: n.rows[0]?.n ?? 0,
        items: list.rows.map(r => mapPreinscricao(r as Record<string, unknown>)),
      });
    }
  }

  return {
    items,
    total,
    page,
    perPage,
    counts: {
      total: c?.total ?? 0,
      abertos: c?.abertos ?? 0,
      porContactar: c?.por_contactar ?? 0,
      conversa: c?.conversa ?? 0,
      pagos: c?.pagos ?? 0,
      formando: c?.formando ?? 0,
      atrasados: c?.atrasados ?? 0,
      hoje: c?.hoje ?? 0,
      converter: c?.pagos ?? 0,
      valorAberto: Number(c?.valor_aberto ?? 0),
      preinscricoes: c?.preinscricoes ?? 0,
      manuais: c?.manuais ?? 0,
    },
    porEstado,
    facets: { cursos, locais, origens, campanhas },
    columns,
  };
}

export async function searchCrmLeads(db: Db, q: string, limit = 12) {
  const needle = like(q.trim());
  if (needle === "%%") return [];
  const rows = await db.query(
    `SELECT * FROM preinscricoes
      WHERE nome ILIKE $1 OR apelido ILIKE $1 OR email ILIKE $1 OR telf ILIKE $1 OR curso ILIKE $1
         OR CAST(id AS text) = $2
      ORDER BY inscrito DESC
      LIMIT $3`,
    [needle, q.trim().slice(0, 12), Math.min(30, Math.max(1, limit))],
  );
  return rows.rows.map(r => mapPreinscricao(r as Record<string, unknown>));
}

export async function exportCrmLeads(db: Db, params: CrmListParams, hoje: string) {
  const { sql, vals } = addWhere(params, hoje);
  const rows = await db.query(
    `SELECT * FROM preinscricoes WHERE ${sql} ORDER BY ${orderSql(params.sort)} LIMIT 2000`,
    vals,
  );
  return rows.rows.map(r => mapPreinscricao(r as Record<string, unknown>));
}
