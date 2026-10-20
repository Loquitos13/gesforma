import type { Db } from "./db/pool.js";
import type { AtorCrm } from "./repos/sql.js";
import {
  pesquisarCursosFin, pesquisarCursosGold, pesquisarFormadores, pesquisarFormandosFin, pesquisarFormandosGold,
  pesquisarLeads, pesquisarTurmasFin, pesquisarTurmasGold, type SearchKind,
} from "./repos/pesquisa.js";
import { rotuloCodigoCurso } from "../../src/partilhado/codigoCurso.js";

export type { SearchKind };
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

export async function globalSearch(db: Db, qRaw: string, limitPer = 8, ator?: AtorCrm): Promise<GlobalSearchResult> {
  const { kind, digits, needle } = detectQueryKind(qRaw);
  if (needle.length < 2 && kind !== "id") {
    return { q: needle, kind, kindLabel: KIND_LABEL[kind], groups: [], total: 0 };
  }
  const k = { kind, digits, needle, limite: Math.min(12, Math.max(4, Math.trunc(limitPer))) };
  const pessoa = (row: Record<string, unknown>) => `${row.nome ?? ""} ${row.apelido ?? ""}`.trim();
  const [gold, fin, formadores, leads, cursosG, cursosF, turmasG, turmasF] = await Promise.all([
    pesquisarFormandosGold(db, k), pesquisarFormandosFin(db, k), pesquisarFormadores(db, k), pesquisarLeads(db, k, ator),
    pesquisarCursosGold(db, k), pesquisarCursosFin(db, k), pesquisarTurmasGold(db, k), pesquisarTurmasFin(db, k),
  ]);
  const hits: GlobalSearchHit[] = [];
  for (const row of gold) {
    const avulso = row.turma_id == null;
    hits.push({
      grupo: "formandos",
      tipo: avulso ? "Formando Gold avulso" : "Formando Gold",
      nome: pessoa(row) || `Formando #${row.id}`,
      sub: `${row.email || "sem email"} · ${row.telf || "sem telemóvel"} · ${avulso ? row.curso || "sem curso" : row.turma || "sem turma"}`,
      view: "gold-formando-ficha",
      formandoId: Number(row.id),
      formandoOrigem: avulso ? "gold-avulso" : "gold-turma",
    });
  }
  for (const row of fin) {
    hits.push({
      grupo: "formandos",
      tipo: "Formando Financiado",
      nome: pessoa(row),
      sub: `${row.email || "sem email"} · ${row.telf || "sem telemóvel"} · ${row.turma || "sem turma"}`,
      view: "fin-formando-ficha",
      formandoId: Number(row.id),
      formandoOrigem: "fin",
    });
  }
  for (const row of formadores) {
    const gold = asRegimes(row.regimes).includes("gold");
    hits.push({
      grupo: "formadores",
      tipo: gold ? "Formador Gold" : "Formador Financiado",
      nome: String(row.nome ?? ""),
      sub: `${row.email || "sem email"} · ${row.telf || "sem telemóvel"} · ${row.especialidade || "sem especialidade"}`,
      view: "formador-ficha",
      formadorId: Number(row.id),
    });
  }
  for (const row of leads) {
    hits.push({
      grupo: "crm",
      tipo: row.regime === "fin" ? "CRM Financiada" : "CRM Gold",
      nome: pessoa(row),
      sub: `${row.curso || "sem curso"} · ${row.estado} · ${row.telf || row.email || ""}`,
      view: row.regime === "fin" ? "fin-preinscricoes" : "gold-preinscricoes",
      leadId: Number(row.id),
    });
  }
  for (const row of cursosG) {
    hits.push({ grupo: "formacoes", tipo: "Curso Gold", nome: String(row.nome ?? ""), sub: `${row.categoria || "sem categoria"} · ${row.estado}`, view: "gold-curso-ficha", cursoId: Number(row.id) });
  }
  for (const row of cursosF) {
    hits.push({
      grupo: "formacoes",
      tipo: "UFCD",
      nome: `${row.ufcd_cod ? `${row.ufcd_cod} · ` : ""}${row.ufcd ?? ""}`.trim(),
      sub: `${row.nome_comercial || "UFCD"} · ${row.estado}`,
      view: "fin-curso-ficha",
      cursoId: Number(row.id),
    });
  }
  for (const row of turmasG) {
    hits.push({ grupo: "turmas", tipo: "Turma Gold", nome: String(row.nome ?? ""), sub: `${row.curso || "sem curso"} · ${row.local || "sem local"} · ${row.estado}`, view: "gold-cockpit-turma", turmaId: Number(row.id), tab: "overview" });
  }
  for (const row of turmasF) {
    hits.push({ grupo: "turmas", tipo: "Turma Financiada", nome: String(row.nome ?? ""), sub: `${rotuloCodigoCurso(String(row.ufcd_cod || "-"))} · ${row.curso || "sem curso"} · ${row.local || ""}`, view: "fin-cockpit-turma", turmaId: Number(row.id), tab: "overview" });
  }

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
