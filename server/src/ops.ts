import type { Db } from "./db/pool.js";
import { ingestEvent } from "./automations.js";
import { isEmail, normalizeEmail } from "./security.js";

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

const SLOTS_CCP = ["laboral", "pos-laboral", "sabado-manha", "sabado-tarde"];

function slotsCcp(raw: unknown) {
  if (raw == null) return [...SLOTS_CCP];
  const arr = asArr(raw);
  if (arr.some(item => item && typeof item === "object")) return [...SLOTS_CCP];
  return arr.map(item => String(item));
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
    horario: String(r.horario ?? ""),
    turmaId: r.turma_id == null || r.turma_id === "" ? 0 : num(r.turma_id),
    entrada: String(r.entrada ?? "preinscricao") === "manual" ? "manual" : "preinscricao",
    meioContacto: String(r.meio_contacto ?? ""),
    etiquetaId: r.etiqueta_id == null || r.etiqueta_id === "" ? null : num(r.etiqueta_id),
    etiquetaNome: String(r.etiqueta_nome ?? ""),
    etiquetaCor: String(r.etiqueta_cor ?? ""),
    contactadoEm: r.contactado_em ? String(r.contactado_em) : null,
    notas: String(r.notas ?? ""),
    proximoContacto: String(r.proximo_contacto ?? ""),
    comercialId: r.comercial_id ? String(r.comercial_id) : null,
    comercialNome: String(r.comercial_nome ?? ""),
    nif: String(r.nif ?? ""),
    moradaFiscal: String(r.morada_fiscal ?? ""),
    codigoPostal: String(r.codigo_postal ?? ""),
    motivoDesistencia: String(r.motivo_desistencia ?? ""),
    pagamentoMetodo: String(r.pagamento_metodo ?? ""),
    secretariaEm: r.secretaria_em ? String(r.secretaria_em) : null,
    ultimaNota: String(r.ultima_nota ?? ""),
    ultimaActividadeEm: r.ultima_actividade_em ? String(r.ultima_actividade_em) : null,
    ultimaResultado: String(r.ultima_resultado ?? ""),
    regime: String(r.regime ?? "gold") === "fin" ? "fin" as const : "gold" as const,
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
    formadores: asArr(r.formadores).map(x => String(x)).filter(Boolean),
    horas: num(r.horas),
    custoHoraSala: num(r.custo_hora_sala),
    cronograma: asArr(r.cronograma),
    drivePastaId: String(r.drive_pasta_id ?? ""),
    driveDossieId: String(r.drive_dossie_id ?? ""),
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
    formadores: asArr(r.formadores).map(x => String(x)).filter(Boolean),
    activa: Boolean(r.activa),
    cronograma: asArr(r.cronograma),
    drivePastaId: String(r.drive_pasta_id ?? ""),
    driveDossieId: String(r.drive_dossie_id ?? ""),
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
    disponibilidade: slotsCcp(r.disponibilidade),
    custoHora: num(r.custo_hora),
    temAcesso: Boolean(r.user_id),
  };
}

function sameLabel(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function mapCampanha(r: Record<string, unknown>) {
  return {
    id: num(r.id),
    nome: String(r.nome ?? ""),
    data: String(r.data ?? ""),
    encarregado: String(r.encarregado ?? ""),
    curso: String(r.curso ?? ""),
    preinscricoes: num(r.preinscricoes),
    pagos: num(r.pagos),
    receita: num(r.receita),
    custo: num(r.custo),
    fim: String(r.fim ?? ""),
    canal: String(r.canal ?? ""),
    notas: String(r.notas ?? ""),
  };
}

function numsCampanha(
  campanha: ReturnType<typeof mapCampanha>,
  leads: ReturnType<typeof mapPreinscricao>[],
  formandos: ReturnType<typeof mapFormandoGold>[],
  pagamentos: ReturnType<typeof mapPagamento>[],
) {
  const leadsC = leads.filter(l =>
    sameLabel(l.campanha, campanha.nome) || (campanha.curso && sameLabel(l.curso, campanha.curso)),
  );
  const emails = new Set(leadsC.map(l => l.email.trim().toLowerCase()).filter(Boolean));
  const pagosLead = leadsC.filter(l => /pago|formando/i.test(l.estado));
  const formandosC = formandos.filter(f =>
    f.pago && (
      (f.email && emails.has(f.email.trim().toLowerCase()))
      || (campanha.curso && sameLabel(f.curso, campanha.curso))
    ),
  );
  const pagamentosC = pagamentos.filter(p =>
    /pago/i.test(p.estado) && (
      (campanha.curso && sameLabel(p.curso, campanha.curso))
      || (!campanha.curso && leadsC.some(l => sameLabel(l.curso, p.curso)))
    ),
  );
  const receitaPag = pagamentosC.reduce((s, p) => s + p.valor, 0);
  const receitaForm = formandosC.reduce((s, f) => s + f.valor, 0);
  const receitaLead = pagosLead.reduce((s, l) => s + l.preco, 0);
  return {
    ...campanha,
    preinscricoes: leadsC.length,
    pagos: Math.max(pagosLead.length, formandosC.length, pagamentosC.length),
    receita: Math.round(receitaPag || receitaForm || receitaLead),
  };
}

export function mapBlog(r: Record<string, unknown>) {
  return {
    id: num(r.id),
    titulo: String(r.titulo ?? ""),
    slug: String(r.slug ?? ""),
    data: String(r.data ?? ""),
    status: String(r.status ?? "Ativo"),
    tematica: String(r.tematica ?? ""),
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
    email: String(r.email ?? ""),
    referencia: String(r.referencia ?? ""),
  };
}

function stamp() {
  return new Date().toISOString().slice(0, 16).replace("T", " ");
}

function refDigits(raw: string) {
  return raw.replace(/\D/g, "");
}

/** Marca o pagamento como Pago, dispara o email e actualiza o formando Gold com o mesmo email. */
export async function confirmarPagamento(db: Db, row: Record<string, unknown>) {
  const mapped = mapPagamento(row);
  if (!/pago/i.test(mapped.estado)) {
    await db.query(
      "UPDATE pagamentos SET estado = 'Pago', data = $2 WHERE id = $1",
      [mapped.id, stamp()],
    );
  }
  const email = mapped.email ? normalizeEmail(mapped.email) : "";
  if (email && isEmail(email)) {
    await ingestEvent(db, "payment.confirmed", {
      email,
      nome: mapped.nome,
      curso: mapped.curso,
    }, `payment:${mapped.id}:${email}`).catch(() => undefined);
    await db.query(
      "UPDATE formandos_gold SET pago = true, metodo = CASE WHEN metodo = '-' OR metodo = '' THEN $2 ELSE metodo END WHERE lower(email) = $1",
      [email, mapped.metodo || "Multibanco"],
    );
    await db.query(
      "UPDATE preinscricoes SET estado = 'Pago' WHERE lower(email) = $1 AND estado <> 'Formando'",
      [email],
    );
  }
  const next = await db.query("SELECT * FROM pagamentos WHERE id = $1", [mapped.id]);
  return next.rows[0] ? mapPagamento(next.rows[0] as Record<string, unknown>) : mapped;
}

export async function findPagamentoPorReferencia(db: Db, referencia: string, valor?: number) {
  const digits = refDigits(referencia);
  if (!digits) return null;
  const rows = await db.query(
    `SELECT * FROM pagamentos
      WHERE referencia <> ''
        AND (referencia = $1 OR regexp_replace(referencia, '[^0-9]', '', 'g') = $2)
      ORDER BY data DESC`,
    [referencia, digits],
  );
  const list = rows.rows as Record<string, unknown>[];
  if (valor == null || !Number.isFinite(valor)) return list[0] ?? null;
  return list.find(r => Math.abs(num(r.valor) - valor) < 0.02) ?? null;
}

export async function listMapped<T>(db: Db, sql: string, map: (r: Record<string, unknown>) => T) {
  const rows = await db.query(sql);
  return rows.rows.map(map);
}

export async function getOpsSnapshot(db: Db) {
  const [
    preinscricoes, formandosTurmas, formandosFin, cursosGold, cursosFin,
    turmasGold, turmasFin, formadores, campanhas, blogPosts, pagamentos,
    catalogRows, settingRows,
  ] = await Promise.all([
    listMapped(db, `SELECT p.*, e.nome AS etiqueta_nome, e.cor AS etiqueta_cor
       FROM preinscricoes p LEFT JOIN crm_etiquetas e ON e.id = p.etiqueta_id
      ORDER BY p.inscrito DESC`, mapPreinscricao),
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
    db.query<{ id: number; kind: string; regime: string; payload: unknown }>("SELECT id, kind, regime, payload FROM catalog_items ORDER BY id"),
    db.query<{ id: string; values: unknown }>("SELECT id, values FROM app_settings"),
  ]);
  const alocados = new Set<string>();
  const marcar = (nome: unknown) => {
    const n = String(nome ?? "").trim().toLowerCase();
    if (n) alocados.add(n);
  };
  for (const t of [...turmasGold, ...turmasFin]) {
    marcar(t.formador);
    for (const n of t.formadores ?? []) marcar(n);
    for (const raw of t.cronograma ?? []) {
      if (!raw || typeof raw !== "object") continue;
      const s = raw as { formador?: string; formadores?: string[] };
      if (s.formador) marcar(s.formador);
      for (const n of s.formadores ?? []) marcar(n);
    }
  }
  const formadoresComAlocacao = formadores.map(f => ({ ...f, alocado: alocados.has(f.nome.trim().toLowerCase()) }));
  const catalogs: Record<string, Array<Record<string, unknown>>> = {};
  for (const r of catalogRows.rows) {
    const key = `${r.kind}:${r.regime}`;
    (catalogs[key] ??= []).push({ id: num(r.id), ...asObj(r.payload) });
  }
  const settings = Object.fromEntries(settingRows.rows.map(r => [r.id, asObj(r.values)]));
  return {
    preinscricoes, formandosTurmas, formandosFin, cursosGold, cursosFin,
    turmasGold, turmasFin, formadores: formadoresComAlocacao,
    campanhas: campanhas.map(c => numsCampanha(c, preinscricoes, formandosTurmas, pagamentos)),
    blogPosts, pagamentos,
    catalogs, settings,
  };
}
