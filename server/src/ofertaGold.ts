import { classificarInscricao, cursoVisivelNoSite } from "./catalogoPublico.js";
import type { Db } from "./db/pool.js";
import { mapaPrecosGold, precoNoMapa } from "./precoOferta.js";
import { cursosFinOferta, cursosGoldActivos, cursosGoldOferta, turmasFinActivas, turmasGoldActivas } from "./repos/oferta.js";

export type OfertaTurma = {
  turmaId: number;
  nome: string;
  curso: string;
  local: string;
  horario: string;
  dataInicio: string;
  vagasLivres: number;
  /** O que o site mostra: as vagas anunciadas pelo comercial, nunca acima das livres. */
  vagasMostradas: number;
  preco: number | null;
  cronogramaPublicado: boolean;
  regime: "gold" | "fin";
};

export type CursoOfertaPublico = {
  nome: string;
  preco: number;
  regime: "gold" | "fin";
  inscricao: "Acesso direto" | "Pré-pago" | "Pré-inscrição";
};

export function fmtDataPt(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** Vagas livres reais e as que o site mostra (anunciadas, sem passar das reais). */
function vagas(livres: number, anunciadas: number | null | undefined) {
  const a = anunciadas == null ? null : Number(anunciadas);
  return { vagasLivres: livres, vagasMostradas: a == null || Number.isNaN(a) ? livres : Math.min(Math.max(0, a), livres) };
}

export async function listOfertaGold(db: Db): Promise<OfertaTurma[]> {
  const rows = await turmasGoldActivas(db);
  const mapa = await mapaPrecosGold(db);
  return rows.map(r => {
    const local = r.local;
    const horario = r.horario;
    const curso = r.curso;
    return {
      turmaId: Number(r.id),
      nome: r.nome,
      curso,
      local,
      horario,
      dataInicio: String(r.data_inicio ?? "").slice(0, 10),
      ...vagas(Math.max(0, Number(r.vagas ?? 0) + Math.max(0, Number(r.tolerancia) || 0) - Number(r.total_alunos ?? 0)), r.vagas_anunciadas),
      preco: precoNoMapa(mapa, curso, local, horario),
      cronogramaPublicado: Boolean(r.tem_cronograma),
      regime: "gold" as const,
    };
  });
}

export async function listOfertaFin(db: Db): Promise<OfertaTurma[]> {
  const rows = await turmasFinActivas(db);
  return rows.map(r => ({
    turmaId: Number(r.id),
    nome: r.nome,
    curso: r.curso,
    local: r.local,
    horario: r.horario,
    dataInicio: String(r.data_inicio ?? "").slice(0, 10),
    ...vagas(Math.max(0, Number(r.alunos_total ?? 0) + Math.max(0, Number(r.tolerancia) || 0) - Number(r.alunos ?? 0)), r.vagas_anunciadas),
    preco: null,
    cronogramaPublicado: Boolean(r.tem_cronograma),
    regime: "fin" as const,
  }));
}

export async function listCursosOferta(db: Db): Promise<CursoOfertaPublico[]> {
  const [gold, fin] = await Promise.all([cursosGoldOferta(db), cursosFinOferta(db)]);
  const out: CursoOfertaPublico[] = [];
  for (const row of gold) {
    if (!cursoVisivelNoSite(row.estado) || !row.nome?.trim()) continue;
    out.push({
      nome: row.nome,
      preco: Number(row.preco) || 0,
      regime: "gold",
      inscricao: classificarInscricao("gold", row.tipo, row.regime),
    });
  }
  for (const row of fin) {
    if (!cursoVisivelNoSite(row.estado) || !row.nome?.trim()) continue;
    out.push({ nome: row.nome, preco: 0, regime: "fin", inscricao: "Pré-inscrição" });
  }
  return out;
}

export async function listCursosGoldActivos(db: Db) {
  const rows = await cursosGoldActivos(db);
  return rows.map(r => ({ nome: r.nome, preco: Number(r.preco) }));
}

export function uniqueOferta(turmas: OfertaTurma[], key: keyof OfertaTurma) {
  return [...new Set(turmas.map(t => String(t[key] ?? "")).filter(Boolean))];
}

export function filtrarOferta(
  turmas: OfertaTurma[],
  sel: { curso?: string; local?: string; horario?: string },
) {
  return turmas.filter(t =>
    (!sel.curso || t.curso === sel.curso)
    && (!sel.local || t.local === sel.local)
    && (!sel.horario || t.horario === sel.horario),
  );
}

export async function resolverTurmaOferta(
  db: Db,
  sel: { turmaId?: number; curso?: string; local?: string; horario?: string; dataInicio?: string; regime?: "gold" | "fin" },
) {
  const oferta = sel.regime === "fin" ? await listOfertaFin(db) : await listOfertaGold(db);
  // A turma tem de ser do curso pedido: um id de outro curso não traz local, horário nem vaga.
  const mesmoCurso = (c: string) => !sel.curso || c.trim().toLowerCase() === sel.curso.trim().toLowerCase();
  if (sel.turmaId) return oferta.find(t => t.turmaId === sel.turmaId && mesmoCurso(t.curso)) ?? null;
  const data = (sel.dataInicio ?? "").slice(0, 10);
  return oferta.find(t =>
    t.curso === sel.curso
    && t.local === sel.local
    && t.horario === sel.horario
    && t.dataInicio === data,
  ) ?? null;
}
