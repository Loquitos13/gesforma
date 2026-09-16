import type { Db } from "./db/pool.js";

export async function nextOpsId(db: Db) {
  const row = await db.query<{ id: number }>("SELECT nextval('ops_id_seq')::int AS id");
  return row.rows[0]?.id ?? Date.now() % 100000;
}

function num(v: unknown) {
  return typeof v === "number" ? v : Number(v ?? 0);
}

function asObj(v: unknown) {
  if (v && typeof v === "object") return v as Record<string, unknown>;
  if (typeof v === "string") {
    try { return JSON.parse(v) as Record<string, unknown>; } catch { return {}; }
  }
  return {};
}

function asArr(v: unknown) {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p : [];
    } catch { return []; }
  }
  return [];
}

export function mapPreinscricao(r: Record<string, unknown>) {
  return {
    id: num(r.id),
    inscrito: String(r.inscrito ?? ""),
    nome: String(r.nome ?? ""),
    apelido: String(r.apelido ?? ""),
    email: String(r.email ?? ""),
    telf: String(r.telf ?? ""),
    inicioCurso: String(r.inicio_curso ?? "-"),
    concelho: String(r.concelho ?? ""),
    local: String(r.local ?? ""),
    curso: String(r.curso ?? ""),
    preco: num(r.preco),
    estado: String(r.estado ?? "Não contactado"),
    campanha: String(r.campanha ?? ""),
    origem: String(r.origem ?? "Website"),
    contactadoEm: r.contactado_em ? String(r.contactado_em) : null,
    notas: String(r.notas ?? ""),
  };
}

export function mapFormandoGold(r: Record<string, unknown>) {
  return {
    id: num(r.id),
    nome: String(r.nome ?? ""),
    apelido: String(r.apelido ?? ""),
    telf: String(r.telf ?? ""),
    email: String(r.email ?? ""),
    inscrito: String(r.inscrito ?? ""),
    local: String(r.local ?? ""),
    curso: String(r.curso ?? ""),
    turma: String(r.turma ?? ""),
    turmaId: r.turma_id == null ? 0 : num(r.turma_id),
    estado: String(r.estado ?? "Formando"),
    pago: Boolean(r.pago),
    valor: num(r.valor),
    metodo: String(r.metodo ?? "-"),
  };
}

export function mapFormandoFin(r: Record<string, unknown>) {
  const docs = asObj(r.docs);
  const doc = (k: string) => {
    const d = asObj(docs[k]);
    return { ok: Boolean(d.ok), data: String(d.data ?? "") };
  };
  return {
    id: num(r.id),
    nome: String(r.nome ?? ""),
    apelido: String(r.apelido ?? ""),
    turma: String(r.turma ?? ""),
    telf: String(r.telf ?? ""),
    email: String(r.email ?? ""),
    curso: String(r.curso ?? ""),
    estado: String(r.estado ?? "Elegível"),
    cc: doc("cc"),
    ch: doc("ch"),
    cu: doc("cu"),
    ci: doc("ci"),
    ce: doc("ce"),
  };
}

export function mapCursoGold(r: Record<string, unknown>) {
  return {
    id: num(r.id),
    nome: String(r.nome ?? ""),
    categoria: String(r.categoria ?? ""),
    tipo: String(r.tipo ?? "Gold"),
    preco: num(r.preco),
    regime: String(r.regime ?? ""),
    horas: num(r.horas),
    estado: String(r.estado ?? "Ativo"),
  };
}

export function mapCursoFin(r: Record<string, unknown>) {
  return {
    id: num(r.id),
    ufcdCod: String(r.ufcd_cod ?? ""),
    ufcd: String(r.ufcd ?? ""),
    nomeComercial: String(r.nome_comercial ?? ""),
    regime: String(r.regime ?? ""),
    horas: num(r.horas),
    estado: String(r.estado ?? "Ativo"),
  };
}

export function mapTurmaGold(r: Record<string, unknown>) {
  return {
    id: num(r.id),
    dataInicio: String(r.data_inicio ?? ""),
    nome: String(r.nome ?? ""),
    curso: String(r.curso ?? ""),
    local: String(r.local ?? ""),
    horario: String(r.horario ?? ""),
    totalAlunos: num(r.total_alunos),
    vagas: num(r.vagas),
    estado: String(r.estado ?? "Ativa"),
    formador: String(r.formador ?? ""),
    horas: num(r.horas),
    cronograma: asArr(r.cronograma),
  };
}

export function mapTurmaFin(r: Record<string, unknown>) {
  return {
    id: num(r.id),
    dataInicio: String(r.data_inicio ?? ""),
    nome: String(r.nome ?? ""),
    curso: String(r.curso ?? ""),
    ufcdCod: String(r.ufcd_cod ?? ""),
    local: String(r.local ?? ""),
    horario: String(r.horario ?? ""),
    alunos: num(r.alunos),
    alunosTotal: num(r.alunos_total),
    estado: String(r.estado ?? "A montar"),
    horas: num(r.horas),
    formador: String(r.formador ?? ""),
    activa: Boolean(r.activa),
    cronograma: asArr(r.cronograma),
  };
}

export function mapFormador(r: Record<string, unknown>) {
  return {
    id: num(r.id),
    nome: String(r.nome ?? ""),
    telf: String(r.telf ?? ""),
    email: String(r.email ?? ""),
    especialidade: String(r.especialidade ?? ""),
    ccp: String(r.ccp ?? ""),
    nif: String(r.nif ?? ""),
    regimes: asArr(r.regimes),
    estado: String(r.estado ?? "Ativo"),
  };
}

export function mapCampanha(r: Record<string, unknown>) {
  return {
    id: num(r.id),
    nome: String(r.nome ?? ""),
    data: String(r.data ?? ""),
    encarregado: String(r.encarregado ?? ""),
    preinscricoes: num(r.preinscricoes),
    pagos: num(r.pagos),
    receita: num(r.receita),
    custo: num(r.custo),
  };
}

export function mapBlog(r: Record<string, unknown>) {
  return {
    id: num(r.id),
    titulo: String(r.titulo ?? ""),
    slug: String(r.slug ?? ""),
    data: String(r.data ?? ""),
    status: String(r.status ?? "Ativo"),
  };
}

export function mapPagamento(r: Record<string, unknown>) {
  return {
    id: String(r.id ?? ""),
    nome: String(r.nome ?? ""),
    valor: num(r.valor),
    metodo: String(r.metodo ?? ""),
    curso: String(r.curso ?? ""),
    data: String(r.data ?? ""),
    estado: String(r.estado ?? "Pendente"),
  };
}

export async function listMapped<T>(db: Db, sql: string, map: (r: Record<string, unknown>) => T) {
  const rows = await db.query(sql);
  return rows.rows.map(map);
}

export async function getOpsSnapshot(db: Db) {
  const [
    preinscricoes, formandosTurmas, formandosFin, cursosGold, cursosFin,
    turmasGold, turmasFin, formadores, campanhas, blogPosts, pagamentos,
  ] = await Promise.all([
    listMapped(db, "SELECT * FROM preinscricoes ORDER BY inscrito DESC", mapPreinscricao),
    listMapped(db, "SELECT * FROM formandos_gold ORDER BY inscrito DESC", mapFormandoGold),
    listMapped(db, "SELECT * FROM formandos_fin ORDER BY id", mapFormandoFin),
    listMapped(db, "SELECT * FROM cursos_gold ORDER BY nome", mapCursoGold),
    listMapped(db, "SELECT * FROM cursos_fin ORDER BY ufcd", mapCursoFin),
    listMapped(db, "SELECT * FROM turmas_gold ORDER BY data_inicio DESC", mapTurmaGold),
    listMapped(db, "SELECT * FROM turmas_fin ORDER BY data_inicio DESC", mapTurmaFin),
    listMapped(db, "SELECT * FROM formadores ORDER BY nome", mapFormador),
    listMapped(db, "SELECT * FROM campanhas ORDER BY data DESC", mapCampanha),
    listMapped(db, "SELECT * FROM blog_posts ORDER BY data DESC", mapBlog),
    listMapped(db, "SELECT * FROM pagamentos ORDER BY data DESC", mapPagamento),
  ]);
  return {
    preinscricoes, formandosTurmas, formandosFin, cursosGold, cursosFin,
    turmasGold, turmasFin, formadores, campanhas, blogPosts, pagamentos,
  };
}
