import type { Db } from "./db/pool.js";
import { lerSessao } from "./repos/pedagogiaSessoes.js";
import { cronogramaDaTurma } from "./repos/pedagogiaTurma.js";
import { equipaECronograma, equipasDoRegime, fichaDaConta, nomesPorConta } from "./repos/sessaoAcesso.js";

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

type SessaoLectiva = { id?: string; data?: string; horaInicio?: string; horaFim?: string; formadores?: string[]; formador?: string };

/** A sessão n (1…) conta só as sessões lectivas do cronograma (presencial e síncrona). */
export function sessaoLectivaN(cronograma: unknown, n: number) {
  return (lective(cronograma)[n - 1] ?? null) as null | SessaoLectiva;
}

/** A sessão lectiva com este id e a sua posição actual (n). Os dados da sessão ligam-se ao id, não à posição. */
export function sessaoLectivaPorId(cronograma: unknown, id: string) {
  if (!id) return null;
  const lista = lective(cronograma) as SessaoLectiva[];
  const i = lista.findIndex(s => String(s.id ?? "") === id);
  return i < 0 ? null : { n: i + 1, sessao: lista[i]! };
}

function formadoresDe(s: SessaoLectiva | null | undefined) {
  if (!s) return [];
  if (Array.isArray(s.formadores) && s.formadores.length) return s.formadores.map(f => String(f).trim()).filter(Boolean);
  return s.formador?.trim() ? [s.formador.trim()] : [];
}

export function formadoresDaSessaoN(cronograma: unknown, n: number) {
  return formadoresDe(sessaoLectivaN(cronograma, n));
}

/** Cada sessão do cronograma com um id único (as que não têm, ou o repetem, recebem um novo). */
export function comIdsUnicos(cronograma: unknown[]) {
  const vistos = new Set<string>();
  return cronograma.map((item, i) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return item;
    const o = item as Record<string, unknown>;
    let id = String(o.id ?? "").trim();
    if (!id || vistos.has(id)) id = `s-${Date.now().toString(36)}-${i}-${Math.random().toString(36).slice(2, 6)}`;
    vistos.add(id);
    return id === o.id ? item : { ...o, id };
  });
}

/**
 * Os dados de uma sessão acompanham-na pelo id quando muda de dia ou de lugar. O que não pode é sair do cronograma
 * (ou deixar de ser lectiva) uma sessão que já tem sumário, presenças ou plano assinado.
 */
export function erroSessoesRemovidas(next: unknown, comDados: { sessao_id: string; sessao_n: number | null }[], actual?: unknown) {
  const ids = new Set((lective(next) as SessaoLectiva[]).map(s => String(s.id ?? "")));
  for (const r of [...comDados].sort((x, y) => (x.sessao_n ?? 0) - (y.sessao_n ?? 0))) {
    if (r.sessao_n == null || ids.has(r.sessao_id)) continue;
    const data = sessaoLectivaPorId(actual, r.sessao_id)?.sessao.data;
    return `A sessão ${r.sessao_n}${data ? ` (${data})` : ""} já tem sumário, presenças ou plano assinado: não pode ser removida nem passar a não lectiva. Pode mudá-la de dia, hora ou posição.`;
  }
  return null;
}

/**
 * Nomes com que o formador aparece nas turmas. A ficha do formador encontra-se pela
 * conta (`formadores.user_id`) ou pelo email — nunca só pelo nome da conta.
 */
export async function nomesDoFormador(db: Db, email: string, _name: string, userId = "") {
  const rows = await nomesPorConta(db, email, userId);
  return new Set(rows.map(r => r.nome.trim()).filter(Boolean));
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
  const row = await equipaECronograma(db, regime, turmaId);
  if (!row) return false;
  return turmaDoFormador(row, await nomesDoFormador(db, actor.email, actor.name, actor.id));
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

export async function podeGravarSessao(db: Db, actor: { id?: string; role: string; email: string; name: string }, opts: {
  regime: "gold" | "fin";
  turmaId: number;
  /** Id da sessão no cronograma: o formador que conta é o dessa sessão, esteja ela onde estiver. */
  sessaoId: string;
  /** Cronograma já lido (na transacção da gravação); sem ele lê-se agora. */
  cronograma?: unknown;
  plano?: { assinado?: boolean };
  sumario?: { assinado?: boolean };
  presencas?: unknown;
}) {
  const staff = actor.role === "admin" || actor.role === "secretaria" || actor.role === "financiada";
  const cronograma = opts.cronograma !== undefined ? opts.cronograma : (await cronogramaDaTurma(db, opts.regime, opts.turmaId))?.cronograma;
  const daSessao = formadoresDe(sessaoLectivaPorId(cronograma, opts.sessaoId)?.sessao);
  const row = await lerSessao(db, opts.regime, opts.turmaId, opts.sessaoId);
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
  return Boolean(await fichaDaConta(db, formadorId, actor.id, actor.email));
}

/** Ids das turmas Gold e Financiada em que o formador aparece. */
export async function turmasDoFormador(db: Db, actor: { id: string; email: string; name: string }) {
  const nomes = await nomesDoFormador(db, actor.email, actor.name, actor.id);
  const [gold, fin] = await Promise.all([
    equipasDoRegime(db, "gold"),
    equipasDoRegime(db, "fin"),
  ]);
  return {
    gold: new Set(gold.filter(t => turmaDoFormador(t, nomes)).map(t => Number(t.id))),
    fin: new Set(fin.filter(t => turmaDoFormador(t, nomes)).map(t => Number(t.id))),
  };
}
