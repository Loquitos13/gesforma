/**
 * Utilitários da camada de dados. Todo o SQL do GesForma vive em `server/src/repos/*`
 * e usa só parâmetros `$n`: nunca se interpola texto vindo do pedido.
 *
 * Forma de uma função de repositório: `async function listarX(db: Db | TxQuery, params) { … }`.
 */
import type { Db, TxQuery } from "../db/pool.js";

export type Regime = "gold" | "fin";

/** Quem pede, para as regras de visibilidade das tabelas comerciais (`Filtros.visivelPara`). */
export type AtorCrm = { id: string; role: string };

/** Aceita a ligação (`db`) ou o `q` de uma transacção (`db.tx(q => …)`). */
export type Consulta = Db | TxQuery;

type Linha = Record<string, unknown>;

function correr<T extends Linha>(c: Consulta, sql: string, params: unknown[]) {
  return typeof c === "function" ? c<T>(sql, params) : c.query<T>(sql, params);
}

/** Uma linha (ou null). */
export async function one<T extends Linha = Linha>(c: Consulta, sql: string, params: unknown[] = []): Promise<T | null> {
  const r = await correr<T>(c, sql, params);
  return r.rows[0] ?? null;
}

/** Todas as linhas. */
export async function many<T extends Linha = Linha>(c: Consulta, sql: string, params: unknown[] = []): Promise<T[]> {
  const r = await correr<T>(c, sql, params);
  return r.rows;
}

/** Valor escalar da primeira coluna da primeira linha. */
export async function valor<T = unknown>(c: Consulta, sql: string, params: unknown[] = []): Promise<T | null> {
  const linha = await one(c, sql, params);
  if (!linha) return null;
  const k = Object.keys(linha)[0];
  return (k ? linha[k] : null) as T | null;
}

export type Pagina<T> = { total: number; linhas: T[]; pagina: number; porPagina: number };

/**
 * Pagina uma consulta. `sql` é o SELECT completo sem ORDER/LIMIT; `ordem` vem de `ordenarPor`.
 * O total é contado sobre a mesma consulta, com os mesmos parâmetros.
 */
export async function paginar<T extends Linha = Linha>(
  c: Consulta,
  sql: string,
  params: unknown[],
  opts: { pagina?: number; porPagina?: number; ordem?: string },
): Promise<Pagina<T>> {
  const porPagina = Math.min(Math.max(Math.trunc(opts.porPagina ?? 25), 1), 200);
  const pagina = Math.max(Math.trunc(opts.pagina ?? 1), 1);
  const n = params.length;
  // Em sequência: dentro de uma transacção não se podem cruzar consultas.
  const contagem = await valor<number | string>(c, `SELECT count(*)::int AS total FROM (${sql}) AS sub`, params);
  const linhas = await many<T>(c, `${sql} ${opts.ordem ?? ""} LIMIT $${n + 1} OFFSET $${n + 2}`, [...params, porPagina, (pagina - 1) * porPagina]);
  return { total: Number(contagem ?? 0), linhas, pagina, porPagina };
}

/**
 * Cláusula ORDER BY a partir de uma whitelist `{ chavePublica: "expressão sql" }`.
 * Chaves desconhecidas caem na ordem por omissão. `campo` aceita "-campo" para descendente.
 */
export function ordenarPor(whitelist: Record<string, string>, campo: string | undefined, omissao: string): string {
  const desc = Boolean(campo?.startsWith("-"));
  const chave = campo?.replace(/^-/, "") ?? "";
  const expr = whitelist[chave];
  if (!expr) return `ORDER BY ${omissao}`;
  return `ORDER BY ${expr} ${desc ? "DESC" : "ASC"} NULLS LAST`;
}

const TABELAS = {
  formandos: { gold: "formandos_gold", fin: "formandos_fin" },
  turmas: { gold: "turmas_gold", fin: "turmas_fin" },
  cursos: { gold: "cursos_gold", fin: "cursos_fin" },
} as const;

export type Entidade = keyof typeof TABELAS;

/** Nome real da tabela por regime. Só devolve valores fixos deste mapa. */
export function tabelaRegime(entidade: Entidade, regime: Regime): string {
  const t = TABELAS[entidade]?.[regime];
  if (!t) throw new Error(`tabela desconhecida: ${entidade}/${regime}`);
  return t;
}

export type Periodo = { de: string; ate: string };

/**
 * Período fechado [de, ate] em datas ISO (yyyy-mm-dd). Sem datas, usa o mês corrente.
 * `anterior` é o período imediatamente antes, com o mesmo número de dias; quando o período começa
 * no dia 1 e acaba no mesmo mês ("este mês" até hoje, ou o mês inteiro), é o mesmo intervalo de dias
 * do mês anterior (1–19/10 compara com 1–19/09), cortado no fim desse mês (1–31/03 → 1–28/02).
 */
export function periodo(de?: string | null, ate?: string | null, hoje = new Date()): Periodo & { anterior: Periodo; dias: number } {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const inicioMes = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1));
  const d0 = de ? new Date(`${de}T00:00:00Z`) : inicioMes;
  const d1 = ate ? new Date(`${ate}T00:00:00Z`) : new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate()));
  const [a, b] = d0 <= d1 ? [d0, d1] : [d1, d0];
  const dias = Math.round((b.getTime() - a.getTime()) / 86400_000) + 1;
  const doMes = a.getUTCDate() === 1 && a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
  if (doMes) {
    const ultimoDia = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), 0)).getUTCDate();
    const antIni = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() - 1, 1));
    const antFim = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() - 1, Math.min(b.getUTCDate(), ultimoDia)));
    return { de: iso(a), ate: iso(b), dias, anterior: { de: iso(antIni), ate: iso(antFim) } };
  }
  const antFim = new Date(a.getTime() - 86400_000);
  const antIni = new Date(antFim.getTime() - (dias - 1) * 86400_000);
  return { de: iso(a), ate: iso(b), dias, anterior: { de: iso(antIni), ate: iso(antFim) } };
}

/** Escapa `%`, `_` e `\` para usar texto do utilizador num ILIKE com `$n`. */
export function padraoPesquisa(q: string | undefined | null): string | null {
  const t = (q ?? "").trim();
  if (!t) return null;
  return `%${t.replace(/[\\%_]/g, m => `\\${m}`)}%`;
}

/**
 * Constrói um WHERE a partir de condições opcionais, numerando os parâmetros.
 * Exemplo: `const w = new Filtros(); w.add("curso = ?", curso); w.sql` → "WHERE curso = $1".
 * `?` é substituído pelo próximo `$n`; condições com valor null/undefined/"" são ignoradas.
 */
export class Filtros {
  readonly params: unknown[] = [];
  private readonly partes: string[] = [];

  constructor(inicial: unknown[] = []) {
    this.params.push(...inicial);
  }

  add(condicao: string, ...valores: unknown[]): this {
    if (valores.some(v => v == null || v === "")) return this;
    let i = 0;
    const sql = condicao.replace(/\?/g, () => {
      this.params.push(valores[i++]);
      return `$${this.params.length}`;
    });
    this.partes.push(`(${sql})`);
    return this;
  }

  /** Condição fixa, sem parâmetros. */
  sempre(condicao: string): this {
    this.partes.push(`(${condicao})`);
    return this;
  }

  /**
   * A regra do RLS das tabelas comerciais (migrações 048 e 105) também no código, para não depender da base:
   * o comercial só vê as linhas de que é dono (as sem dono não), a Financiada só as da Financiada,
   * admin e secretaria tudo. Sem ator (trabalhos do sistema) não filtra.
   */
  visivelPara(ator: AtorCrm | undefined, dono: string, regime: string): this {
    if (!ator || ator.role === "admin" || ator.role === "secretaria") return this;
    if (ator.role === "comercial") return this.add(`${dono}::text = ?`, ator.id || "-");
    if (ator.role === "financiada") return this.sempre(`${regime} = 'fin'`);
    return this.sempre("false");
  }

  get where(): string {
    return this.partes.length ? `WHERE ${this.partes.join(" AND ")}` : "";
  }

  get and(): string {
    return this.partes.length ? `AND ${this.partes.join(" AND ")}` : "";
  }
}
