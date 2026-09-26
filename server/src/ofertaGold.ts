import type { Db } from "./db/pool.js";

export type OfertaTurma = {
  turmaId: number;
  nome: string;
  curso: string;
  local: string;
  horario: string;
  dataInicio: string;
  vagasLivres: number;
};

export function fmtDataPt(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export async function listOfertaGold(db: Db): Promise<OfertaTurma[]> {
  const rows = await db.query<{
    id: number; nome: string; curso: string; local: string; horario: string;
    data_inicio: string; total_alunos: number; vagas: number;
  }>(
    `SELECT id, nome, curso, local, horario, data_inicio, total_alunos, vagas
     FROM turmas_gold
     WHERE estado = 'Ativa'
     ORDER BY curso, local, horario, data_inicio`,
  );
  return rows.rows.map(r => ({
    turmaId: Number(r.id),
    nome: r.nome,
    curso: r.curso,
    local: r.local,
    horario: r.horario,
    dataInicio: String(r.data_inicio ?? "").slice(0, 10),
    vagasLivres: Math.max(0, Number(r.vagas ?? 0) - Number(r.total_alunos ?? 0)),
  }));
}

export async function listCursosGoldActivos(db: Db) {
  const rows = await db.query<{ nome: string; preco: number }>(
    "SELECT nome, preco FROM cursos_gold WHERE estado = 'Ativo' ORDER BY nome",
  );
  return rows.rows.map(r => ({ nome: r.nome, preco: Number(r.preco) }));
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
  sel: { turmaId?: number; curso?: string; local?: string; horario?: string; dataInicio?: string },
) {
  const oferta = await listOfertaGold(db);
  if (sel.turmaId) {
    return oferta.find(t => t.turmaId === sel.turmaId) ?? null;
  }
  const data = (sel.dataInicio ?? "").slice(0, 10);
  return oferta.find(t =>
    t.curso === sel.curso
    && t.local === sel.local
    && t.horario === sel.horario
    && t.dataInicio === data,
  ) ?? null;
}
