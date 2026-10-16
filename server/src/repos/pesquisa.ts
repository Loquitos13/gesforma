/** Pesquisa global: SQL por grupo. A interpretação da consulta e o formato das respostas ficam em globalSearch.ts. */
import { Filtros, many, type AtorCrm, type Consulta } from "./sql.js";

export type SearchKind = "email" | "telemovel" | "id" | "nome";
type Linha = Record<string, unknown>;

function like(raw: string) {
  return `%${raw.replace(/[%_\\]/g, ch => `\\${ch}`).slice(0, 80)}%`;
}

function phoneLike(digits: string) {
  const core = digits.length > 9 ? digits.slice(-9) : digits;
  return `%${core}%`;
}

type Pred = { sql: string; vals: unknown[] };

function personPred(kind: SearchKind, needle: string, digits: string, cols: { nome?: string; apelido?: string; email?: string; telf?: string; extra?: string[] }): Pred {
  const vals: unknown[] = [];
  const p = (v: unknown) => {
    vals.push(v);
    return `$${vals.length}`;
  };
  const nome = cols.nome ?? "nome";
  const email = cols.email ?? "email";
  const telf = cols.telf ?? "telf";
  const extras = cols.extra ?? [];
  if (kind === "email") {
    return { sql: `${email} ILIKE ${p(like(needle))}`, vals };
  }
  if (kind === "telemovel") {
    return { sql: `regexp_replace(COALESCE(${telf}, ''), '[^0-9]', '', 'g') LIKE ${p(phoneLike(digits))}`, vals };
  }
  if (kind === "id") {
    const id = Number(needle);
    const parts = [`id = ${p(id)}`];
    if (cols.apelido) parts.push(`${nome} ILIKE ${p(like(needle))}`, `${cols.apelido} ILIKE ${p(like(needle))}`);
    else parts.push(`${nome} ILIKE ${p(like(needle))}`);
    return { sql: `(${parts.join(" OR ")})`, vals };
  }
  const n = like(needle);
  const parts = [`${nome} ILIKE ${p(n)}`];
  if (cols.apelido) parts.push(`${cols.apelido} ILIKE ${p(n)}`);
  parts.push(`${email} ILIKE ${p(n)}`, `${telf} ILIKE ${p(n)}`);
  for (const c of extras) parts.push(`${c} ILIKE ${p(n)}`);
  if (digits.length >= 6) {
    parts.push(`regexp_replace(COALESCE(${telf}, ''), '[^0-9]', '', 'g') LIKE ${p(phoneLike(digits))}`);
  }
  return { sql: `(${parts.join(" OR ")})`, vals };
}

function textPred(kind: SearchKind, needle: string, cols: string[]): Pred | null {
  if (kind === "telemovel" || kind === "email") return null;
  const vals: unknown[] = [];
  const p = (v: unknown) => {
    vals.push(v);
    return `$${vals.length}`;
  };
  if (kind === "id") {
    return { sql: `id = ${p(Number(needle))}`, vals };
  }
  const n = like(needle);
  return { sql: `(${cols.map(c => `${c} ILIKE ${p(n)}`).join(" OR ")})`, vals };
}

export type Criterio = { kind: SearchKind; needle: string; digits: string; limite: number };

/** Formandos Gold (com turma e avulsos, que são os de `turma_id` vazio). */
export function pesquisarFormandosGold(c: Consulta, k: Criterio) {
  const p = personPred(k.kind, k.needle, k.digits, { apelido: "apelido", extra: ["curso", "turma"] });
  return many<Linha>(c, `SELECT id, nome, apelido, email, telf, turma, turma_id, curso, estado FROM formandos_gold WHERE ${p.sql} ORDER BY nome LIMIT ${k.limite}`, p.vals);
}

export function pesquisarFormandosFin(c: Consulta, k: Criterio) {
  const p = personPred(k.kind, k.needle, k.digits, { apelido: "apelido", extra: ["curso", "turma"] });
  return many<Linha>(c, `SELECT id, nome, apelido, email, telf, turma, curso, estado FROM formandos_fin WHERE ${p.sql} ORDER BY nome LIMIT ${k.limite}`, p.vals);
}

export function pesquisarFormadores(c: Consulta, k: Criterio) {
  const p = personPred(k.kind, k.needle, k.digits, { extra: ["especialidade", "ccp", "nif"] });
  return many<Linha>(c, `SELECT id, nome, email, telf, especialidade, regimes, estado FROM formadores WHERE ${p.sql} ORDER BY nome LIMIT ${k.limite}`, p.vals);
}

export function pesquisarLeads(c: Consulta, k: Criterio, ator?: AtorCrm) {
  const p = personPred(k.kind, k.needle, k.digits, { apelido: "apelido", extra: ["curso"] });
  const w = new Filtros(p.vals).sempre(p.sql).visivelPara(ator, "comercial_id", "regime");
  return many<Linha>(c, `SELECT id, nome, apelido, email, telf, curso, estado, local, regime FROM preinscricoes ${w.where} ORDER BY inscrito DESC LIMIT ${k.limite}`, w.params);
}

export async function pesquisarCursosGold(c: Consulta, k: Criterio) {
  const p = textPred(k.kind, k.needle, ["nome", "categoria"]);
  return p ? many<Linha>(c, `SELECT id, nome, categoria, estado FROM cursos_gold WHERE ${p.sql} ORDER BY nome LIMIT ${k.limite}`, p.vals) : [];
}

export async function pesquisarCursosFin(c: Consulta, k: Criterio) {
  const p = textPred(k.kind, k.needle, ["ufcd", "ufcd_cod", "nome_comercial"]);
  return p ? many<Linha>(c, `SELECT id, ufcd_cod, ufcd, nome_comercial, estado FROM cursos_fin WHERE ${p.sql} ORDER BY ufcd LIMIT ${k.limite}`, p.vals) : [];
}

export async function pesquisarTurmasGold(c: Consulta, k: Criterio) {
  const p = textPred(k.kind, k.needle, ["nome", "curso", "local", "formador"]);
  return p ? many<Linha>(c, `SELECT id, nome, curso, local, estado FROM turmas_gold WHERE ${p.sql} ORDER BY data_inicio DESC LIMIT ${k.limite}`, p.vals) : [];
}

export async function pesquisarTurmasFin(c: Consulta, k: Criterio) {
  const p = textPred(k.kind, k.needle, ["nome", "curso", "ufcd_cod", "local", "formador"]);
  return p ? many<Linha>(c, `SELECT id, nome, curso, ufcd_cod, local, estado FROM turmas_fin WHERE ${p.sql} ORDER BY data_inicio DESC LIMIT ${k.limite}`, p.vals) : [];
}
