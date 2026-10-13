import type { Db } from "./db/pool.js";

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

function lective(cronograma: unknown) {
  return asArr(cronograma).filter(item => {
    if (!item || typeof item !== "object") return false;
    const m = String((item as { modalidade?: string }).modalidade ?? "presencial");
    return m === "presencial" || m === "sincrona";
  }) as { formadores?: string[]; formador?: string }[];
}

/** A sessão n (1…) conta só as sessões lectivas do cronograma (presencial e síncrona). */
export function sessaoLectivaN(cronograma: unknown, n: number) {
  return (lective(cronograma)[n - 1] ?? null) as null | { data?: string; horaInicio?: string; horaFim?: string; formadores?: string[]; formador?: string };
}

export function formadoresDaSessaoN(cronograma: unknown, n: number) {
  const s = lective(cronograma)[n - 1];
  if (!s) return [];
  if (Array.isArray(s.formadores) && s.formadores.length) return s.formadores.map(f => String(f).trim()).filter(Boolean);
  return s.formador?.trim() ? [s.formador.trim()] : [];
}

/**
 * Nomes com que o formador aparece nas turmas. A ficha do formador encontra-se pela
 * conta (`formadores.user_id`) ou pelo email — nunca só pelo nome da conta.
 */
export async function nomesDoFormador(db: Db, email: string, _name: string, userId = "") {
  const rows = await db.query<{ nome: string }>(
    `SELECT nome FROM formadores
      WHERE ($2 <> '' AND user_id::text = $2)
         OR ($1 <> '' AND lower(email) = lower($1))`,
    [email.trim(), userId],
  );
  return new Set(rows.rows.map(r => r.nome.trim()).filter(Boolean));
}

/** Nomes de formador referidos por uma turma: responsável, equipa e cada sessão do cronograma. */
export function nomesNaTurma(t: { formador?: unknown; formadores?: unknown; cronograma?: unknown }) {
  const out = new Set<string>();
  const add = (v: unknown) => { const n = String(v ?? "").trim().toLowerCase(); if (n) out.add(n); };
  add(t.formador);
  for (const n of asArr(t.formadores)) add(n);
  for (const raw of asArr(t.cronograma)) {
    if (!raw || typeof raw !== "object") continue;
    const s = raw as { formador?: unknown; formadores?: unknown };
    add(s.formador);
    for (const n of asArr(s.formadores)) add(n);
  }
  return out;
}

export function turmaDoFormador(t: { formador?: unknown; formadores?: unknown; cronograma?: unknown }, nomes: Set<string>) {
  const naTurma = nomesNaTurma(t);
  for (const n of nomes) if (naTurma.has(n.toLowerCase())) return true;
  return false;
}

/** O formador está atribuído a esta turma? Staff passa sempre. */
export async function formadorNaTurma(db: Db, actor: { id: string; role: string; email: string; name: string }, regime: "gold" | "fin", turmaId: number) {
  if (actor.role !== "formador") return true;
  const table = regime === "gold" ? "turmas_gold" : "turmas_fin";
  const row = await db.query<{ formador: unknown; formadores: unknown; cronograma: unknown }>(
    `SELECT formador, formadores, cronograma FROM ${table} WHERE id = $1`, [turmaId],
  );
  if (!row.rows[0]) return false;
  return turmaDoFormador(row.rows[0], await nomesDoFormador(db, actor.email, actor.name, actor.id));
}

function atribuido(nomes: Set<string>, daSessao: string[]) {
  if (!daSessao.length) return false;
  for (const n of daSessao) {
    if (nomes.has(n)) return true;
    const low = n.toLowerCase();
    for (const meu of nomes) if (meu.toLowerCase() === low) return true;
  }
  return false;
}

function normSessao(item: unknown) {
  const s = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
  const lista = Array.isArray(s.formadores) ? s.formadores.map(x => String(x).trim()).filter(Boolean) : [];
  const unico = typeof s.formador === "string" ? s.formador.trim() : "";
  return {
    id: String(s.id ?? ""),
    data: String(s.data ?? ""),
    horaInicio: String(s.horaInicio ?? ""),
    horaFim: String(s.horaFim ?? ""),
    modulos: JSON.stringify(s.modulos ?? []),
    formadores: lista.length ? lista : (unico ? [unico] : []),
    modalidade: String(s.modalidade ?? "presencial"),
    iniciadaEm: s.iniciadaEm ? String(s.iniciadaEm) : "",
    fechadaEm: s.fechadaEm ? String(s.fechadaEm) : "",
  };
}

/** O formador só pode marcar início e fecho nas sessões em que está atribuído. */
export function cronogramaSoMarcas(actual: unknown, next: unknown, nomes: Set<string>) {
  const a = asArr(actual);
  const b = asArr(next);
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const left = normSessao(a[i]);
    const right = normSessao(b[i]);
    const igual = left.id === right.id
      && left.data === right.data
      && left.horaInicio === right.horaInicio
      && left.horaFim === right.horaFim
      && left.modulos === right.modulos
      && JSON.stringify(left.formadores) === JSON.stringify(right.formadores)
      && left.modalidade === right.modalidade;
    if (!igual) return false;
    if (left.iniciadaEm !== right.iniciadaEm || left.fechadaEm !== right.fechadaEm) {
      if (!atribuido(nomes, right.formadores)) return false;
    }
  }
  return true;
}

export async function podeGravarSessao(db: Db, actor: { id?: string; role: string; email: string; name: string }, opts: {
  regime: "gold" | "fin";
  turmaId: number;
  n: number;
  plano?: { assinado?: boolean };
  sumario?: { assinado?: boolean };
  presencas?: unknown;
}) {
  const staff = actor.role === "admin" || actor.role === "secretaria" || actor.role === "financiada";
  const table = opts.regime === "gold" ? "turmas_gold" : "turmas_fin";
  const turma = await db.query<{ cronograma: unknown }>(`SELECT cronograma FROM ${table} WHERE id = $1`, [opts.turmaId]);
  const daSessao = formadoresDaSessaoN(turma.rows[0]?.cronograma, opts.n);
  const actual = await db.query<{ plano: unknown; sumario: unknown; presencas: unknown }>(
    "SELECT plano, sumario, presencas FROM turma_sessoes WHERE regime = $1 AND turma_id = $2 AND sessao_n = $3",
    [opts.regime, opts.turmaId, opts.n],
  );
  const row = actual.rows[0];
  const planoValidado = Boolean(row?.plano && typeof row.plano === "object" && (row.plano as { assinado?: boolean }).assinado);
  const sumarioValidado = Boolean(row?.sumario && typeof row.sumario === "object" && (row.sumario as { assinado?: boolean }).assinado);
  const presencasValidado = Boolean(row?.sumario && typeof row.sumario === "object" && (row.sumario as { presencasValidadas?: boolean }).presencasValidadas);

  if (staff) return { ok: true as const };
  if (actor.role !== "formador") {
    if ((opts.plano && planoValidado) || (opts.sumario && sumarioValidado) || (opts.presencas && presencasValidado)) {
      return { ok: false as const, erro: "Depois de validado, só a secretaria ou um administrador altera este documento." };
    }
    return { ok: true as const };
  }
  const nomes = await nomesDoFormador(db, actor.email, actor.name, actor.id ?? "");
  if (!atribuido(nomes, daSessao)) {
    return { ok: false as const, erro: "Só pode preencher sessões em que está atribuído." };
  }
  if (opts.plano && planoValidado) return { ok: false as const, erro: "O plano já foi validado. A secretaria ou um administrador pode corrigi-lo." };
  if (opts.sumario && sumarioValidado) return { ok: false as const, erro: "O sumário já foi validado. A secretaria ou um administrador pode corrigi-lo." };
  if (opts.presencas && presencasValidado) return { ok: false as const, erro: "A folha de presenças já foi validada. A secretaria ou um administrador pode corrigi-la." };
  return { ok: true as const };
}

/** O formador só consulta e altera a sua própria ficha. Staff passa sempre. */
export async function fichaDoProprioFormador(db: Db, actor: { id: string; role: string; email: string }, formadorId: number) {
  if (actor.role !== "formador") return true;
  const row = await db.query<{ id: number }>(
    `SELECT id FROM formadores WHERE id = $1 AND (user_id::text = $2 OR ($3 <> '' AND lower(email) = lower($3)))`,
    [formadorId, actor.id, actor.email.trim()],
  );
  return Boolean(row.rows[0]);
}

/** Ids das turmas Gold e Financiada em que o formador aparece. */
export async function turmasDoFormador(db: Db, actor: { id: string; email: string; name: string }) {
  const nomes = await nomesDoFormador(db, actor.email, actor.name, actor.id);
  const [gold, fin] = await Promise.all([
    db.query<{ id: number; formador: unknown; formadores: unknown; cronograma: unknown }>("SELECT id, formador, formadores, cronograma FROM turmas_gold"),
    db.query<{ id: number; formador: unknown; formadores: unknown; cronograma: unknown }>("SELECT id, formador, formadores, cronograma FROM turmas_fin"),
  ]);
  return {
    gold: new Set(gold.rows.filter(t => turmaDoFormador(t, nomes)).map(t => Number(t.id))),
    fin: new Set(fin.rows.filter(t => turmaDoFormador(t, nomes)).map(t => Number(t.id))),
  };
}
