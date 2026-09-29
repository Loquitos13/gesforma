import type { Db } from "./db/pool.js";

export type SearchKind = "email" | "telemovel" | "id" | "nome";
export type SearchGrupo = "formandos" | "formadores" | "formacoes" | "turmas" | "crm";

export type GlobalSearchHit = {
  grupo: SearchGrupo;
  tipo: string;
  nome: string;
  sub: string;
  view: string;
  formandoId?: number;
  formandoOrigem?: "gold-turma" | "gold-avulso" | "fin";
  formadorId?: number;
  leadId?: number;
  turmaId?: number;
  cursoId?: number;
  tab?: "overview" | "dtp";
};

export type GlobalSearchResult = {
  q: string;
  kind: SearchKind;
  kindLabel: string;
  groups: { grupo: SearchGrupo; label: string; items: GlobalSearchHit[] }[];
  total: number;
};

const GROUPS: { grupo: SearchGrupo; label: string }[] = [
  { grupo: "formandos", label: "Formandos" },
  { grupo: "formadores", label: "Formadores" },
  { grupo: "formacoes", label: "Formações" },
  { grupo: "turmas", label: "Turmas" },
  { grupo: "crm", label: "CRM" },
];

const KIND_LABEL: Record<SearchKind, string> = {
  email: "email",
  telemovel: "telemóvel",
  id: "número / id",
  nome: "nome",
};

export function detectQueryKind(q: string): { kind: SearchKind; digits: string; needle: string } {
  const needle = q.trim().slice(0, 80);
  const digits = needle.replace(/\D/g, "");
  const onlyDigits = /^\d[\d\s./+-]*$/.test(needle) && digits.length > 0;
  if (needle.includes("@")) return { kind: "email", digits, needle };
  if (digits.length >= 9) return { kind: "telemovel", digits, needle };
  if (onlyDigits && digits.startsWith("9") && digits.length >= 3) return { kind: "telemovel", digits, needle };
  if (onlyDigits && digits.length <= 6) return { kind: "id", digits, needle };
  return { kind: "nome", digits, needle };
}

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

function payloadPred(kind: SearchKind, needle: string, digits: string): Pred {
  const vals: unknown[] = [];
  const p = (v: unknown) => {
    vals.push(v);
    return `$${vals.length}`;
  };
  if (kind === "email") {
    return { sql: `payload->>'email' ILIKE ${p(like(needle))}`, vals };
  }
  if (kind === "telemovel") {
    return { sql: `regexp_replace(COALESCE(payload->>'telf', ''), '[^0-9]', '', 'g') LIKE ${p(phoneLike(digits))}`, vals };
  }
  if (kind === "id") {
    return { sql: `(id = ${p(Number(needle))} OR payload->>'nome' ILIKE ${p(like(needle))})`, vals };
  }
  const n = like(needle);
  const parts = [
    `payload->>'nome' ILIKE ${p(n)}`,
    `payload->>'apelido' ILIKE ${p(n)}`,
    `payload->>'email' ILIKE ${p(n)}`,
    `payload->>'telf' ILIKE ${p(n)}`,
    `payload->>'curso' ILIKE ${p(n)}`,
  ];
  if (digits.length >= 6) {
    parts.push(`regexp_replace(COALESCE(payload->>'telf', ''), '[^0-9]', '', 'g') LIKE ${p(phoneLike(digits))}`);
  }
  return { sql: `(${parts.join(" OR ")})`, vals };
}

function asRegimes(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function payloadObj(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v);
      if (p && typeof p === "object") return p as Record<string, unknown>;
    } catch { /* ignore */ }
  }
  return {};
}

export async function globalSearch(db: Db, qRaw: string, limitPer = 8): Promise<GlobalSearchResult> {
  const { kind, digits, needle } = detectQueryKind(qRaw);
  if (needle.length < 2 && kind !== "id") {
    return { q: needle, kind, kindLabel: KIND_LABEL[kind], groups: [], total: 0 };
  }
  const lim = Math.min(12, Math.max(4, limitPer));
  const hits: GlobalSearchHit[] = [];

  const gPred = personPred(kind, needle, digits, { apelido: "apelido", extra: ["curso", "turma"] });
  const fFinPred = personPred(kind, needle, digits, { apelido: "apelido", extra: ["curso", "turma"] });
  const formPred = personPred(kind, needle, digits, { extra: ["especialidade", "ccp", "nif"] });
  const crmPred = personPred(kind, needle, digits, { apelido: "apelido", extra: ["curso"] });
  const avulsoPred = payloadPred(kind, needle, digits);
  const cursoG = textPred(kind, needle, ["nome", "categoria"]);
  const cursoF = textPred(kind, needle, ["ufcd", "ufcd_cod", "nome_comercial"]);
  const turmaG = textPred(kind, needle, ["nome", "curso", "local", "formador"]);
  const turmaF = textPred(kind, needle, ["nome", "curso", "ufcd_cod", "local", "formador"]);

  const queries: Promise<void>[] = [
    db.query(
      `SELECT id, nome, apelido, email, telf, turma, curso, estado FROM formandos_gold WHERE ${gPred.sql} ORDER BY nome LIMIT ${lim}`,
      gPred.vals,
    ).then(r => {
      for (const row of r.rows as Record<string, unknown>[]) {
        hits.push({
          grupo: "formandos",
          tipo: "Formando Gold",
          nome: `${row.nome ?? ""} ${row.apelido ?? ""}`.trim(),
          sub: `${row.email || "sem email"} · ${row.telf || "sem telemóvel"} · ${row.turma || "sem turma"}`,
          view: "gold-formandos-turmas",
          formandoId: Number(row.id),
          formandoOrigem: "gold-turma",
        });
      }
    }),
    db.query(
      `SELECT id, nome, apelido, email, telf, turma, curso, estado FROM formandos_fin WHERE ${fFinPred.sql} ORDER BY nome LIMIT ${lim}`,
      fFinPred.vals,
    ).then(r => {
      for (const row of r.rows as Record<string, unknown>[]) {
        hits.push({
          grupo: "formandos",
          tipo: "Formando Financiado",
          nome: `${row.nome ?? ""} ${row.apelido ?? ""}`.trim(),
          sub: `${row.email || "sem email"} · ${row.telf || "sem telemóvel"} · ${row.turma || "sem turma"}`,
          view: "fin-formandos",
          formandoId: Number(row.id),
          formandoOrigem: "fin",
        });
      }
    }),
    db.query(
      `SELECT id, payload FROM catalog_items WHERE kind = 'formandos_avulso' AND ${avulsoPred.sql} ORDER BY id DESC LIMIT ${lim}`,
      avulsoPred.vals,
    ).then(r => {
      for (const row of r.rows as Record<string, unknown>[]) {
        const p = payloadObj(row.payload);
        hits.push({
          grupo: "formandos",
          tipo: "Formando Gold avulso",
          nome: `${p.nome ?? ""} ${p.apelido ?? ""}`.trim() || `Formando #${row.id}`,
          sub: `${p.email || "sem email"} · ${p.telf || "sem telemóvel"} · ${p.curso || "sem curso"}`,
          view: "gold-formandos-gold",
          formandoId: Number(row.id),
          formandoOrigem: "gold-avulso",
        });
      }
    }),
    db.query(
      `SELECT id, nome, email, telf, especialidade, regimes, estado FROM formadores WHERE ${formPred.sql} ORDER BY nome LIMIT ${lim}`,
      formPred.vals,
    ).then(r => {
      for (const row of r.rows as Record<string, unknown>[]) {
        const regimes = asRegimes(row.regimes);
        const gold = regimes.includes("gold");
        hits.push({
          grupo: "formadores",
          tipo: gold ? "Formador Gold" : "Formador Financiado",
          nome: String(row.nome ?? ""),
          sub: `${row.email || "sem email"} · ${row.telf || "sem telemóvel"} · ${row.especialidade || "sem especialidade"}`,
          view: gold ? "gold-formadores" : "fin-formadores",
          formadorId: Number(row.id),
        });
      }
    }),
    db.query(
      `SELECT id, nome, apelido, email, telf, curso, estado, local, regime FROM preinscricoes WHERE ${crmPred.sql} ORDER BY inscrito DESC LIMIT ${lim}`,
      crmPred.vals,
    ).then(r => {
      for (const row of r.rows as Record<string, unknown>[]) {
        hits.push({
          grupo: "crm",
          tipo: row.regime === "fin" ? "CRM Financiada" : "CRM Gold",
          nome: `${row.nome ?? ""} ${row.apelido ?? ""}`.trim(),
          sub: `${row.curso || "sem curso"} · ${row.estado} · ${row.telf || row.email || ""}`,
          view: row.regime === "fin" ? "fin-preinscricoes" : "gold-preinscricoes",
          leadId: Number(row.id),
        });
      }
    }),
  ];

  if (cursoG) {
    queries.push(db.query(
      `SELECT id, nome, categoria, estado FROM cursos_gold WHERE ${cursoG.sql} ORDER BY nome LIMIT ${lim}`,
      cursoG.vals,
    ).then(r => {
      for (const row of r.rows as Record<string, unknown>[]) {
        hits.push({
          grupo: "formacoes",
          tipo: "Curso Gold",
          nome: String(row.nome ?? ""),
          sub: `${row.categoria || "sem categoria"} · ${row.estado}`,
          view: "gold-curso-ficha",
          cursoId: Number(row.id),
        });
      }
    }));
  }
  if (cursoF) {
    queries.push(db.query(
      `SELECT id, ufcd_cod, ufcd, nome_comercial, estado FROM cursos_fin WHERE ${cursoF.sql} ORDER BY ufcd LIMIT ${lim}`,
      cursoF.vals,
    ).then(r => {
      for (const row of r.rows as Record<string, unknown>[]) {
        hits.push({
          grupo: "formacoes",
          tipo: "UFCD",
          nome: `${row.ufcd_cod ? `${row.ufcd_cod} · ` : ""}${row.ufcd ?? ""}`.trim(),
          sub: `${row.nome_comercial || "UFCD"} · ${row.estado}`,
          view: "fin-curso-ficha",
          cursoId: Number(row.id),
        });
      }
    }));
  }
  if (turmaG) {
    queries.push(db.query(
      `SELECT id, nome, curso, local, estado FROM turmas_gold WHERE ${turmaG.sql} ORDER BY data_inicio DESC LIMIT ${lim}`,
      turmaG.vals,
    ).then(r => {
      for (const row of r.rows as Record<string, unknown>[]) {
        hits.push({
          grupo: "turmas",
          tipo: "Turma Gold",
          nome: String(row.nome ?? ""),
          sub: `${row.curso || "sem curso"} · ${row.local || "sem local"} · ${row.estado}`,
          view: "gold-cockpit-turma",
          turmaId: Number(row.id),
          tab: "overview",
        });
      }
    }));
  }
  if (turmaF) {
    queries.push(db.query(
      `SELECT id, nome, curso, ufcd_cod, local, estado FROM turmas_fin WHERE ${turmaF.sql} ORDER BY data_inicio DESC LIMIT ${lim}`,
      turmaF.vals,
    ).then(r => {
      for (const row of r.rows as Record<string, unknown>[]) {
        hits.push({
          grupo: "turmas",
          tipo: "Turma Financiada",
          nome: String(row.nome ?? ""),
          sub: `UFCD ${row.ufcd_cod || "-"} · ${row.curso || "sem curso"} · ${row.local || ""}`,
          view: "fin-cockpit-turma",
          turmaId: Number(row.id),
          tab: "overview",
        });
      }
    }));
  }

  await Promise.all(queries);

  const groups = GROUPS
    .map(g => ({ ...g, items: hits.filter(h => h.grupo === g.grupo) }))
    .filter(g => g.items.length > 0);

  return {
    q: needle,
    kind,
    kindLabel: KIND_LABEL[kind],
    groups,
    total: hits.length,
  };
}
