import { classificarInscricao, cursoVisivelNoSite } from "./catalogoPublico.js";
import type { Db } from "./db/pool.js";
import { mapaPrecosGold, precoNoMapa } from "./precoOferta.js";

export type OfertaTurma = {
  turmaId: number;
  nome: string;
  curso: string;
  local: string;
  horario: string;
  dataInicio: string;
  vagasLivres: number;
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
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export async function listOfertaGold(db: Db): Promise<OfertaTurma[]> {
  const rows = await db.query<{
    id: number; nome: string; curso: string; local: string; horario: string;
    data_inicio: string; total_alunos: number; vagas: number; tolerancia: number; cronograma_publicado_em: string | null;
  }>(
    `SELECT id, nome, curso, local, horario, data_inicio, total_alunos, vagas,
            COALESCE(tolerancia_vagas, 0) AS tolerancia, cronograma_publicado_em
     FROM turmas_gold
     WHERE estado = 'Ativa'
     ORDER BY curso, local, horario, data_inicio`,
  );
  const mapa = await mapaPrecosGold(db);
  return rows.rows.map(r => {
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
      vagasLivres: Math.max(0, Number(r.vagas ?? 0) + Math.max(0, Number(r.tolerancia) || 0) - Number(r.total_alunos ?? 0)),
      preco: precoNoMapa(mapa, curso, local, horario),
      cronogramaPublicado: Boolean(r.cronograma_publicado_em),
      regime: "gold" as const,
    };
  });
}

export async function listOfertaFin(db: Db): Promise<OfertaTurma[]> {
  const rows = await db.query<{
    id: number; nome: string; curso: string; local: string; horario: string;
    data_inicio: string; alunos: number; alunos_total: number; tolerancia: number; cronograma_publicado_em: string | null;
  }>(
    `SELECT id, nome, curso, local, horario, data_inicio, alunos, alunos_total,
            COALESCE(tolerancia_vagas, 0) AS tolerancia, cronograma_publicado_em
     FROM turmas_fin
     WHERE activa = true
     ORDER BY curso, local, horario, data_inicio`,
  );
  return rows.rows.map(r => ({
    turmaId: Number(r.id),
    nome: r.nome,
    curso: r.curso,
    local: r.local,
    horario: r.horario,
    dataInicio: String(r.data_inicio ?? "").slice(0, 10),
    vagasLivres: Math.max(0, Number(r.alunos_total ?? 0) + Math.max(0, Number(r.tolerancia) || 0) - Number(r.alunos ?? 0)),
    preco: null,
    cronogramaPublicado: Boolean(r.cronograma_publicado_em),
    regime: "fin" as const,
  }));
}

export async function listCursosOferta(db: Db): Promise<CursoOfertaPublico[]> {
  const [gold, fin] = await Promise.all([
    db.query<{ nome: string; preco: number; tipo: string; regime: string; estado: string }>(
      "SELECT nome, preco, tipo, regime, estado FROM cursos_gold ORDER BY nome",
    ),
    db.query<{ nome: string; estado: string }>(
      "SELECT COALESCE(NULLIF(trim(nome_comercial), ''), ufcd) AS nome, estado FROM cursos_fin ORDER BY nome",
    ),
  ]);
  const out: CursoOfertaPublico[] = [];
  for (const row of gold.rows) {
    if (!cursoVisivelNoSite(row.estado) || !row.nome?.trim()) continue;
    out.push({
      nome: row.nome,
      preco: Number(row.preco) || 0,
      regime: "gold",
      inscricao: classificarInscricao("gold", row.tipo, row.regime),
    });
  }
  for (const row of fin.rows) {
    if (!cursoVisivelNoSite(row.estado) || !row.nome?.trim()) continue;
    out.push({ nome: row.nome, preco: 0, regime: "fin", inscricao: "Pré-inscrição" });
  }
  return out;
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
  sel: { turmaId?: number; curso?: string; local?: string; horario?: string; dataInicio?: string; regime?: "gold" | "fin" },
) {
  const oferta = sel.regime === "fin" ? await listOfertaFin(db) : await listOfertaGold(db);
  if (sel.turmaId) return oferta.find(t => t.turmaId === sel.turmaId) ?? null;
  const data = (sel.dataInicio ?? "").slice(0, 10);
  return oferta.find(t =>
    t.curso === sel.curso
    && t.local === sel.local
    && t.horario === sel.horario
    && t.dataInicio === data,
  ) ?? null;
}
