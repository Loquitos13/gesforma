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

export function formadoresDaSessaoN(cronograma: unknown, n: number) {
  const s = lective(cronograma)[n - 1];
  if (!s) return [];
  if (Array.isArray(s.formadores) && s.formadores.length) return s.formadores.map(f => String(f).trim()).filter(Boolean);
  return s.formador?.trim() ? [s.formador.trim()] : [];
}

export async function nomesDoFormador(db: Db, email: string, name: string) {
  const rows = await db.query<{ nome: string }>(
    `SELECT nome FROM formadores
      WHERE ($1 <> '' AND lower(email) = lower($1))
         OR ($2 <> '' AND lower(nome) = lower($2))`,
    [email.trim(), name.trim()],
  );
  const nomes = new Set(rows.rows.map(r => r.nome.trim()).filter(Boolean));
  if (!nomes.size && name.trim()) nomes.add(name.trim());
  return nomes;
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

export async function podeGravarSessao(db: Db, actor: { role: string; email: string; name: string }, opts: {
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
  const nomes = await nomesDoFormador(db, actor.email, actor.name);
  if (!atribuido(nomes, daSessao)) {
    return { ok: false as const, erro: "Só pode preencher sessões em que está atribuído." };
  }
  if (opts.plano && planoValidado) return { ok: false as const, erro: "O plano já foi validado. A secretaria ou um administrador pode corrigi-lo." };
  if (opts.sumario && sumarioValidado) return { ok: false as const, erro: "O sumário já foi validado. A secretaria ou um administrador pode corrigi-lo." };
  if (opts.presencas && presencasValidado) return { ok: false as const, erro: "A folha de presenças já foi validada. A secretaria ou um administrador pode corrigi-la." };
  return { ok: true as const };
}
