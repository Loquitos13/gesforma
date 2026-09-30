import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { Db } from "./db/pool.js";
import { dtpResumo } from "./pedagogiaRoutes.js";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const ORIGENS: { id: string; match: RegExp; fonte: string; curto: string; detalhe: string; color: string }[] = [
  { id: "web", match: /site|website|google|pesquisa|org[aâ]nic/i, fonte: "Website / pesquisa Google", curto: "Website", detalhe: "ena.pt e resultados orgânicos", color: "#F59E0B" },
  { id: "ref", match: /refer|amigo|colega|empresa|formador/i, fonte: "Referência", curto: "Referência", detalhe: "Formando, formador ou empresa", color: "#10B981" },
  { id: "ig", match: /insta/i, fonte: "Instagram", curto: "Instagram", detalhe: "Reels e campanhas pagas", color: "#E1306C" },
  { id: "fb", match: /face/i, fonte: "Facebook", curto: "Facebook", detalhe: "Grupos e anúncios", color: "#3B82F6" },
  { id: "li", match: /linked/i, fonte: "LinkedIn", curto: "LinkedIn", detalhe: "CCP e formação para empresas", color: "#0A66C2" },
  { id: "iefp", match: /iefp|emprego|centro/i, fonte: "IEFP / Centro de emprego", curto: "IEFP", detalhe: "Turmas financiadas", color: "#8B5CF6" },
  { id: "outro", match: /.*/, fonte: "Outdoor, feira ou outro", curto: "Outro", detalhe: "Eventos e material impresso", color: "#94A3B8" },
];

const METODO_COLORS: Record<string, string> = {
  "MB Way": "#F59E0B",
  "Cartão": "#3B82F6",
  "Transferência": "#8B5CF6",
  Multibanco: "#10B981",
  PayPal: "#6366F1",
};

function num(v: unknown) {
  return typeof v === "number" ? v : Number(v ?? 0);
}

function parseData(raw: string) {
  const iso = raw.trim().replace(" ", "T");
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(chave: string, delta: number) {
  const [y, m] = chave.split("-").map(Number);
  const d = new Date(y || 2000, (m || 1) - 1 + delta, 1);
  return monthKey(d);
}

function rotuloMes(chave: string) {
  const [y, m] = chave.split("-").map(Number);
  return `${MESES[(m || 1) - 1] ?? chave} ${y || ""}`.trim();
}

function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function janelaMeses(now: Date, de?: string, ate?: string) {
  const fim = ate ? parseData(ate) ?? now : now;
  const inicio = de
    ? parseData(de) ?? new Date(fim.getFullYear(), fim.getMonth() - 11, 1)
    : new Date(fim.getFullYear(), fim.getMonth() - 11, 1);
  let y = inicio.getFullYear();
  let m = inicio.getMonth();
  const endY = fim.getFullYear();
  const endM = fim.getMonth();
  const out: { chave: string; mes: string; ano: number }[] = [];
  while (y < endY || (y === endY && m <= endM)) {
    out.push({ chave: `${y}-${String(m + 1).padStart(2, "0")}`, mes: MESES[m] ?? "", ano: y });
    m += 1;
    if (m > 11) { m = 0; y += 1; }
    if (out.length > 18) out.shift();
  }
  if (!out.length) {
    out.push({ chave: monthKey(now), mes: MESES[now.getMonth()] ?? "", ano: now.getFullYear() });
  }
  return out;
}

type PagamentoRow = { valor: unknown; metodo: string; curso: string; data: string; estado: string };
type CursoMes = { nome: string; n: number; receita: number };

function pagoNoDia(p: PagamentoRow, de?: string, ate?: string) {
  if (!/pago/i.test(p.estado)) return null;
  const d = parseData(p.data);
  if (!d) return null;
  const dia = isoDay(d);
  if (de && dia < de) return null;
  if (ate && dia > ate) return null;
  return d;
}

function totaisPorMes(pagamentos: PagamentoRow[], de?: string, ate?: string) {
  const map = new Map<string, number>();
  for (const p of pagamentos) {
    const d = pagoNoDia(p, de, ate);
    if (!d) continue;
    const k = monthKey(d);
    map.set(k, (map.get(k) ?? 0) + num(p.valor));
  }
  return map;
}

function cursosNoMes(pagamentos: PagamentoRow[], de?: string, ate?: string) {
  const byMonth = new Map<string, Map<string, { n: number; receita: number }>>();
  for (const p of pagamentos) {
    const d = pagoNoDia(p, de, ate);
    if (!d) continue;
    const mk = monthKey(d);
    const nome = p.curso.trim() || "Sem curso";
    let cursos = byMonth.get(mk);
    if (!cursos) {
      cursos = new Map();
      byMonth.set(mk, cursos);
    }
    const cur = cursos.get(nome) ?? { n: 0, receita: 0 };
    cur.n += 1;
    cur.receita += num(p.valor);
    cursos.set(nome, cur);
  }
  const out = new Map<string, CursoMes[]>();
  for (const [mk, cursos] of byMonth) {
    out.set(mk, [...cursos.entries()]
      .map(([nome, v]) => ({ nome, n: v.n, receita: Math.round(v.receita) }))
      .sort((a, b) => b.n - a.n || b.receita - a.receita)
      .slice(0, 12));
  }
  return out;
}

function financeiro(pagamentos: PagamentoRow[], now: Date, de?: string, ate?: string) {
  const pagos = pagamentos.filter(p => pagoNoDia(p, de, ate));
  const pendentes = pagamentos.filter(p => !/pago/i.test(p.estado) && pagoNoDia({ ...p, estado: "Pago" }, de, ate));
  const receitaTotal = pagos.reduce((s, p) => s + num(p.valor), 0);
  const mesAtual = monthKey(now);
  const mesAnterior = shiftMonth(mesAtual, -1);

  const porMes = new Map<string, number>();
  for (const p of pagos) {
    const d = parseData(p.data);
    if (!d) continue;
    const k = monthKey(d);
    porMes.set(k, (porMes.get(k) ?? 0) + num(p.valor));
  }

  const janela = janelaMeses(now, de, ate);
  const noPeriodo = cursosNoMes(pagamentos, de, ate);
  const paraComparar = de || ate ? cursosNoMes(pagamentos) : noPeriodo;
  const totaisComparar = de || ate ? totaisPorMes(pagamentos) : porMes;
  const periodoComparacao = (chave: string) => ({
    chave,
    rotulo: rotuloMes(chave),
    v: Math.round(totaisComparar.get(chave) ?? 0),
    cursos: paraComparar.get(chave) ?? [],
  });
  const receitaMensal = janela.map(m => ({
    ...m,
    v: Math.round(porMes.get(m.chave) ?? 0),
    cursos: noPeriodo.get(m.chave) ?? [],
    comparar: {
      mesPassado: periodoComparacao(shiftMonth(m.chave, -1)),
      anoPassado: periodoComparacao(shiftMonth(m.chave, -12)),
    },
  }));

  const receitaMes = Math.round(porMes.get(mesAtual) ?? 0);
  const receitaMesAnterior = Math.round(porMes.get(mesAnterior) ?? 0);
  const variacaoMes = receitaMesAnterior > 0
    ? Math.round(((receitaMes - receitaMesAnterior) / receitaMesAnterior) * 100)
    : null;

  const metodoTotais = new Map<string, number>();
  for (const p of pagos) {
    const metodo = p.metodo.trim() || "Outro";
    metodoTotais.set(metodo, (metodoTotais.get(metodo) ?? 0) + num(p.valor));
  }
  const metodoSoma = [...metodoTotais.values()].reduce((s, v) => s + v, 0);
  const metodosPagamento = [...metodoTotais.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([metodo, valor]) => ({
      metodo,
      valor: Math.round(valor),
      pct: metodoSoma > 0 ? Math.round((valor / metodoSoma) * 100) : 0,
      color: METODO_COLORS[metodo] ?? "#94A3B8",
    }));

  return {
    receitaTotal: Math.round(receitaTotal),
    receitaMes,
    receitaMesAnterior,
    variacaoMes,
    receitaMensal,
    receita12m: receitaMensal.reduce((s, m) => s + m.v, 0),
    pendentes: { valor: Math.round(pendentes.reduce((s, p) => s + num(p.valor), 0)), n: pendentes.length },
    pagos: pagos.length,
    metodosPagamento,
  };
}

export type Notificacao = {
  chave: string;
  tipo: "error" | "warn" | "info";
  titulo: string;
  texto: string;
  view: string;
  turmaId?: number;
  leadId?: number;
  tab?: string;
  lida: boolean;
};

async function buildNotificacoes(db: Db, actorId: string): Promise<Notificacao[]> {
  const hoje = new Date();
  const em14dias = new Date(hoje.getTime() + 14 * 86400_000).toISOString().slice(0, 10);
  const hojeIso = hoje.toISOString().slice(0, 10);

  const [lidas, turmasGold, turmasFin, pagamentos, leads, finDocs] = await Promise.all([
    db.query<{ chave: string }>("SELECT chave FROM notificacoes_lidas WHERE actor_id = $1", [actorId]),
    db.query<{ id: number; nome: string; curso: string; local: string; total_alunos: number; vagas: number; data_inicio: string; estado: string }>(
      "SELECT id, nome, curso, local, total_alunos, vagas, data_inicio, estado FROM turmas_gold",
    ),
    db.query<{ id: number; nome: string; curso: string; ufcd_cod: string; alunos: number; alunos_total: number; data_inicio: string; activa: boolean }>(
      "SELECT id, nome, curso, ufcd_cod, alunos, alunos_total, data_inicio, activa FROM turmas_fin",
    ),
    db.query<{ n: number; total: unknown }>(
      "SELECT count(*)::int AS n, COALESCE(sum(valor), 0) AS total FROM pagamentos WHERE estado <> 'Pago'",
    ),
    db.query<{ n: number; id: number | null; regime: string }>(
      `SELECT regime, count(*)::int AS n,
              (array_agg(id ORDER BY inscrito DESC))[1] AS id
         FROM preinscricoes
        WHERE contactado_em IS NULL
        GROUP BY regime`,
    ),
    db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM formandos_fin
        WHERE NOT (COALESCE((docs->'cc'->>'ok')::boolean, false)
               AND COALESCE((docs->'ch'->>'ok')::boolean, false)
               AND COALESCE((docs->'cu'->>'ok')::boolean, false)
               AND COALESCE((docs->'ci'->>'ok')::boolean, false)
               AND COALESCE((docs->'ce'->>'ok')::boolean, false))`,
    ),
  ]);

  const lidaSet = new Set(lidas.rows.map(r => r.chave));
  const out: Omit<Notificacao, "lida">[] = [];

  const pend = pagamentos.rows[0];
  if (pend && Number(pend.n) > 0) {
    out.push({
      chave: `pagamentos-pendentes-${pend.n}`,
      tipo: Number(pend.n) > 10 ? "error" : "warn",
      titulo: `${pend.n} pagamentos pendentes`,
      texto: `€${Math.round(num(pend.total)).toLocaleString("pt-PT")} por confirmar na tesouraria.`,
      view: "pagamentos",
    });
  }

  for (const fila of leads.rows) {
    const porContactar = Number(fila.n ?? 0);
    if (porContactar <= 0) continue;
    const fin = fila.regime === "fin";
    out.push({
      chave: `leads-por-contactar-${fin ? "fin" : "gold"}-${porContactar}`,
      tipo: porContactar > 20 ? "warn" : "info",
      titulo: `${porContactar} pré-inscrições por contactar${fin ? " · Financiada" : ""}`,
      texto: fin ? "A fila do dia está no CRM da Financiada." : "A fila comercial do dia está no CRM Gold.",
      view: fin ? "fin-preinscricoes" : "gold-preinscricoes",
      leadId: fila.id ? Number(fila.id) : undefined,
    });
  }

  const secFila = await db.query<{ n: number; id: number | null; regime: string }>(
    `SELECT regime, count(*)::int AS n,
            (array_agg(id ORDER BY secretaria_em DESC))[1] AS id
       FROM preinscricoes
      WHERE estado = 'Pré-inscrição' AND secretaria_em IS NOT NULL
      GROUP BY regime`,
  );
  for (const fila of secFila.rows) {
    const nSec = Number(fila.n ?? 0);
    if (nSec <= 0) continue;
    const fin = fila.regime === "fin";
    out.push({
      chave: `secretaria-pre-${fin ? "fin" : "gold"}-${nSec}`,
      tipo: "warn",
      titulo: `${nSec} pré-inscrição(ões) na secretaria${fin ? " · Financiada" : ""}`,
      texto: "O dossiê está completo. Falta inscrever o formando na turma.",
      view: fin ? "fin-preinscricoes" : "gold-preinscricoes",
      leadId: fila.id ? Number(fila.id) : undefined,
    });
  }

  const semDocs = Number(finDocs.rows[0]?.n ?? 0);
  if (semDocs > 0) {
    out.push({
      chave: `fin-docs-${semDocs}`,
      tipo: "warn",
      titulo: `${semDocs} formandos financiados sem documentos completos`,
      texto: "Sem elegibilidade completa a turma não arranca nem recebe apoios.",
      view: "fin-formandos",
    });
  }

  for (const t of turmasGold.rows) {
    const livres = Number(t.vagas) - Number(t.total_alunos);
    if (livres <= 0) {
      out.push({
        chave: `turma-lotada-gold-${t.id}`,
        tipo: "warn",
        titulo: `${t.nome} sem vagas`,
        texto: `${t.local} atingiu a capacidade máxima - ${t.total_alunos}/${t.vagas} formandos.`,
        view: "gold-cockpit-turma",
        turmaId: t.id,
        tab: "overview",
      });
    } else if (t.data_inicio >= hojeIso && t.data_inicio <= em14dias && Number(t.total_alunos) <= Math.max(2, Math.floor(Number(t.vagas) * 0.25))) {
      out.push({
        chave: `turma-vazia-gold-${t.id}`,
        tipo: "info",
        titulo: `${t.nome} com poucas inscrições`,
        texto: `${t.total_alunos} de ${t.vagas} vagas preenchidas e início a ${t.data_inicio}.`,
        view: "gold-turmas",
      });
    }
  }

  for (const t of turmasFin.rows) {
    if (!t.activa) continue;
    if (t.data_inicio >= hojeIso && t.data_inicio <= em14dias && Number(t.alunos) === 0) {
      out.push({
        chave: `turma-vazia-fin-${t.id}`,
        tipo: "info",
        titulo: `UFCD ${t.ufcd_cod} · ${t.nome} sem formandos`,
        texto: `Início a ${t.data_inicio} e ainda sem inscrições colocadas.`,
        view: "fin-turmas",
      });
    }
  }

  const [pctGold, pctFin] = await Promise.all([dtpResumo(db, "gold"), dtpResumo(db, "fin")]);
  const dtpAvisos: Omit<Notificacao, "lida">[] = [];
  for (const t of turmasGold.rows) {
    const pct = pctGold[t.id] ?? 0;
    if (pct < 60) {
      dtpAvisos.push({
        chave: `dtp-gold-${t.id}-${pct}`,
        tipo: pct < 40 ? "error" : "warn",
        titulo: `DTP da turma ${t.nome} a ${pct}%`,
        texto: "O dossiê bloqueia o fecho da turma e a emissão de certificados.",
        view: "gold-cockpit-turma",
        turmaId: t.id,
        tab: "dtp",
      });
    }
  }
  for (const t of turmasFin.rows) {
    const pct = pctFin[t.id] ?? 0;
    if (pct < 60) {
      dtpAvisos.push({
        chave: `dtp-fin-${t.id}-${pct}`,
        tipo: pct < 40 ? "error" : "warn",
        titulo: `DTP da turma UFCD ${t.ufcd_cod} · ${t.nome} a ${pct}%`,
        texto: "Faltam documentos obrigatórios do dossiê financiado.",
        view: "fin-cockpit-turma",
        turmaId: t.id,
        tab: "dtp",
      });
    }
  }
  dtpAvisos.sort((a, b) => (a.tipo === b.tipo ? 0 : a.tipo === "error" ? -1 : 1));
  out.push(...dtpAvisos.slice(0, 4));

  return out.map(n => ({ ...n, lida: lidaSet.has(n.chave) }));
}

const lidasSchema = z.object({ chaves: z.array(z.string().min(1).max(120)).max(60) });

const dashQuery = z.object({
  regime: z.enum(["gold", "fin"]).optional(),
  de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  curso: z.string().max(200).optional(),
  local: z.string().max(120).optional(),
  horario: z.string().max(80).optional(),
  audiencia: z.enum(["todos", "pre", "formandos"]).optional(),
  desagregar: z.enum(["curso", "local", "horario"]).optional(),
  mes: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

function leadAt(alias = "p") {
  return `CASE
    WHEN ${alias}.inscrito ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN to_timestamp(substring(${alias}.inscrito from 1 for 16), 'YYYY-MM-DD HH24:MI')
    ELSE ${alias}.created_at
  END`;
}

function payDate(alias = "pg") {
  return `CASE
    WHEN ${alias}.data ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN substring(${alias}.data from 1 for 10)
    ELSE NULL
  END`;
}

type Filter = {
  regime?: "gold" | "fin";
  de?: string;
  ate?: string;
  curso?: string;
  local?: string;
  horario?: string;
  audiencia: "todos" | "pre" | "formandos";
  desagregar: "curso" | "local" | "horario";
  mes?: string;
};

function parseFiltro(q: unknown): Filter {
  const p = dashQuery.safeParse(q);
  const d = p.success ? p.data : {};
  return {
    regime: d.regime,
    de: d.de,
    ate: d.ate,
    curso: d.curso?.trim() || undefined,
    local: d.local?.trim() || undefined,
    horario: d.horario?.trim() || undefined,
    audiencia: d.audiencia ?? "todos",
    desagregar: d.desagregar ?? "curso",
    mes: d.mes,
  };
}

function leadWhere(f: Filter) {
  const conds: string[] = ["true"];
  const params: unknown[] = [];
  let i = 1;
  if (f.regime) { conds.push(`p.regime = $${i}`); params.push(f.regime); i += 1; }
  if (f.de) { conds.push(`(${leadAt("p")})::date >= $${i}::date`); params.push(f.de); i += 1; }
  if (f.ate) { conds.push(`(${leadAt("p")})::date <= $${i}::date`); params.push(f.ate); i += 1; }
  if (f.curso) { conds.push(`p.curso = $${i}`); params.push(f.curso); i += 1; }
  if (f.local) { conds.push(`p.local = $${i}`); params.push(f.local); i += 1; }
  if (f.horario) { conds.push(`p.horario = $${i}`); params.push(f.horario); i += 1; }
  if (f.audiencia === "pre") conds.push(`p.estado IN ('Pré-inscrição','Não contactado','1º Contacto','2º Contacto','Pago')`);
  if (f.audiencia === "formandos") conds.push(`p.estado = 'Formando'`);
  return { sql: conds.join(" AND "), params };
}

export function registerDashboardRoutes(
  app: FastifyInstance,
  db: Db,
  helpers: { requireAuth: (req: FastifyRequest, reply: FastifyReply) => boolean },
) {
  const { requireAuth } = helpers;

  app.get("/v1/dashboard", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const now = new Date();
    const f = parseFiltro(req.query);
    const lw = leadWhere(f);
    const payConds = ["true"];
    const payParams: unknown[] = [];
    let pi = 1;
    if (f.curso) { payConds.push(`pg.curso = $${pi}`); payParams.push(f.curso); pi += 1; }
    const cursoFinMatch = `EXISTS (
      SELECT 1 FROM cursos_fin c
       WHERE lower(trim(c.nome_comercial)) = lower(trim(pg.curso))
          OR lower(trim(c.ufcd)) = lower(trim(pg.curso))
    )`;
    if (f.regime === "fin") payConds.push(cursoFinMatch);
    if (f.regime === "gold") payConds.push(`NOT ${cursoFinMatch}`);
    const payJoin = (f.local || f.horario || f.audiencia !== "todos")
      ? `LEFT JOIN preinscricoes p ON (NULLIF(pg.email,'') IS NOT NULL AND lower(p.email) = lower(pg.email))`
      : "";
    if (f.local) { payConds.push(`COALESCE(p.local, fg.local, '') = $${pi}`); payParams.push(f.local); pi += 1; }
    if (f.horario) { payConds.push(`COALESCE(p.horario, tg.horario, '') = $${pi}`); payParams.push(f.horario); pi += 1; }
    if (f.audiencia === "pre") payConds.push(`(p.id IS NULL OR p.estado <> 'Formando')`);
    if (f.audiencia === "formandos") payConds.push(`(p.estado = 'Formando' OR fg.id IS NOT NULL)`);
    const rankConds = [...payConds];
    const rankParams = [...payParams];
    let ri = pi;
    if (f.de) { rankConds.push(`${payDate("pg")} >= $${ri}::text`); rankParams.push(f.de); ri += 1; }
    if (f.ate) { rankConds.push(`${payDate("pg")} <= $${ri}::text`); rankParams.push(f.ate); }
    const [leadCounts, entityCounts, pagamentosRows, origens, cursosPorReceita, leadsPorCurso, desag, filtros] = await Promise.all([
      db.query<{ preinscritos: number; contactados: number }>(
        `SELECT
           (SELECT count(*)::int FROM preinscricoes p WHERE ${lw.sql} AND p.estado <> 'Formando') AS preinscritos,
           (SELECT count(*)::int FROM preinscricoes p WHERE ${lw.sql} AND p.contactado_em IS NOT NULL) AS contactados`,
        lw.params,
      ),
      db.query<{
        formandos_gold: number; formandos_fin: number;
        turmas_gold_ativas: number; turmas_gold: number; turmas_fin_ativas: number; turmas_fin: number;
        cursos_gold: number; cursos_fin: number;
      }>(
        `SELECT
           (SELECT count(*)::int FROM formandos_gold fg
              WHERE ($1::text IS NULL OR fg.curso = $1::text)
                AND ($2::text IS NULL OR fg.local = $2::text)
                AND ($3::text IS NULL OR EXISTS (SELECT 1 FROM turmas_gold tg WHERE tg.id = fg.turma_id AND tg.horario = $3::text))
                AND ($4::text IS NULL OR substring(fg.inscrito from 1 for 10) >= $4::text)
                AND ($5::text IS NULL OR substring(fg.inscrito from 1 for 10) <= $5::text)
           ) AS formandos_gold,
           (SELECT count(*)::int FROM formandos_fin ff
              WHERE ($1::text IS NULL OR ff.curso = $1::text)
           ) AS formandos_fin,
           (SELECT count(*)::int FROM turmas_gold WHERE estado = 'Ativa'
              AND ($1::text IS NULL OR curso = $1::text) AND ($2::text IS NULL OR local = $2::text) AND ($3::text IS NULL OR horario = $3::text)) AS turmas_gold_ativas,
           (SELECT count(*)::int FROM turmas_gold
              WHERE ($1::text IS NULL OR curso = $1::text) AND ($2::text IS NULL OR local = $2::text) AND ($3::text IS NULL OR horario = $3::text)) AS turmas_gold,
           (SELECT count(*)::int FROM turmas_fin WHERE activa = true
              AND ($1::text IS NULL OR curso = $1::text) AND ($2::text IS NULL OR local = $2::text) AND ($3::text IS NULL OR horario = $3::text)) AS turmas_fin_ativas,
           (SELECT count(*)::int FROM turmas_fin
              WHERE ($1::text IS NULL OR curso = $1::text) AND ($2::text IS NULL OR local = $2::text) AND ($3::text IS NULL OR horario = $3::text)) AS turmas_fin,
           (SELECT count(*)::int FROM cursos_gold WHERE estado = 'Ativo' AND ($1::text IS NULL OR nome = $1::text)) AS cursos_gold,
           (SELECT count(*)::int FROM cursos_fin WHERE estado = 'Ativo' AND ($1::text IS NULL OR ufcd = $1::text OR nome_comercial = $1::text)) AS cursos_fin`,
        [f.curso ?? null, f.local ?? null, f.horario ?? null, f.de ?? null, f.ate ?? null],
      ),
      db.query<PagamentoRow>(
        `SELECT DISTINCT ON (pg.id) pg.valor, pg.metodo, pg.curso, pg.data, pg.estado
           FROM pagamentos pg
           LEFT JOIN formandos_gold fg ON lower(fg.email) = lower(NULLIF(pg.email,''))
           LEFT JOIN turmas_gold tg ON tg.id = fg.turma_id
           ${payJoin}
          WHERE ${payConds.join(" AND ")}
          ORDER BY pg.id`,
        payParams,
      ),
      db.query<{ origem: string; n: number }>(
        `SELECT p.origem, count(*)::int AS n FROM preinscricoes p WHERE ${lw.sql} GROUP BY p.origem`,
        lw.params,
      ),
      db.query<{ curso: string; receita: unknown; pagos: number }>(
        `SELECT pg.curso, COALESCE(sum(pg.valor), 0) AS receita, count(*)::int AS pagos
           FROM pagamentos pg
           LEFT JOIN formandos_gold fg ON lower(fg.email) = lower(NULLIF(pg.email,''))
           LEFT JOIN turmas_gold tg ON tg.id = fg.turma_id
           ${payJoin}
          WHERE pg.estado = 'Pago' AND pg.curso <> '' AND ${rankConds.join(" AND ")}
          GROUP BY pg.curso ORDER BY 2 DESC LIMIT 12`,
        rankParams,
      ),
      db.query<{ curso: string; n: number }>(
        `SELECT p.curso, count(*)::int AS n FROM preinscricoes p WHERE ${lw.sql} AND p.curso <> '' GROUP BY p.curso`,
        lw.params,
      ),
      db.query<{ chave: string; n: number; receita: unknown }>(
        f.desagregar === "local"
          ? `SELECT COALESCE(NULLIF(p.local,''), 'Sem local') AS chave, count(*)::int AS n,
                    COALESCE(MAX(pay.receita), 0) AS receita
               FROM preinscricoes p
               LEFT JOIN (SELECT curso, sum(valor) AS receita FROM pagamentos WHERE estado = 'Pago' GROUP BY curso) pay ON pay.curso = p.curso
              WHERE ${lw.sql} GROUP BY 1 ORDER BY 2 DESC LIMIT 12`
          : f.desagregar === "horario"
            ? `SELECT COALESCE(NULLIF(p.horario,''), 'Sem horário') AS chave, count(*)::int AS n,
                      COALESCE(MAX(pay.receita), 0) AS receita
                 FROM preinscricoes p
                 LEFT JOIN (SELECT curso, sum(valor) AS receita FROM pagamentos WHERE estado = 'Pago' GROUP BY curso) pay ON pay.curso = p.curso
                WHERE ${lw.sql} GROUP BY 1 ORDER BY 2 DESC LIMIT 12`
            : `SELECT COALESCE(NULLIF(p.curso,''), 'Sem curso') AS chave, count(*)::int AS n,
                      COALESCE(MAX(pay.receita), 0) AS receita
                 FROM preinscricoes p
                 LEFT JOIN (SELECT curso, sum(valor) AS receita FROM pagamentos WHERE estado = 'Pago' GROUP BY curso) pay ON pay.curso = p.curso
                WHERE ${lw.sql} GROUP BY 1 ORDER BY 2 DESC LIMIT 12`,
        lw.params,
      ),
      db.query<{ curso: string; local: string; horario: string }>(
        f.regime
          ? `SELECT DISTINCT curso, local, horario FROM preinscricoes WHERE regime = $1`
          : `SELECT DISTINCT curso, local, horario FROM preinscricoes`,
        f.regime ? [f.regime] : [],
      ),
    ]);

    const c = { ...(entityCounts.rows[0] ?? {}), ...(leadCounts.rows[0] ?? {}) };
    const fin = financeiro(pagamentosRows.rows, now, f.de, f.ate);
    const regime = f.regime;
    let formandosGold = regime === "fin" ? 0 : Number(c?.formandos_gold ?? 0);
    let formandosFin = regime === "gold" ? 0 : Number(c?.formandos_fin ?? 0);
    if (f.audiencia === "pre") { formandosGold = 0; formandosFin = 0; }
    const formandosAtivos = formandosGold + formandosFin;
    const preinscritos = f.audiencia === "formandos" ? 0 : Number(c?.preinscritos ?? 0);
    const turmasAtivas = regime === "gold"
      ? Number(c?.turmas_gold_ativas ?? 0)
      : regime === "fin"
        ? Number(c?.turmas_fin_ativas ?? 0)
        : Number(c?.turmas_gold_ativas ?? 0) + Number(c?.turmas_fin_ativas ?? 0);
    const turmasTotal = regime === "gold"
      ? Number(c?.turmas_gold ?? 0)
      : regime === "fin"
        ? Number(c?.turmas_fin ?? 0)
        : Number(c?.turmas_gold ?? 0) + Number(c?.turmas_fin ?? 0);
    const cursosGold = regime === "fin" ? 0 : Number(c?.cursos_gold ?? 0);
    const cursosFin = regime === "gold" ? 0 : Number(c?.cursos_fin ?? 0);

    const origemTotais = new Map<string, number>();
    for (const r of origens.rows) {
      const def = ORIGENS.find(o => o.match.test(r.origem || "")) ?? ORIGENS[ORIGENS.length - 1]!;
      origemTotais.set(def.id, (origemTotais.get(def.id) ?? 0) + Number(r.n));
    }
    const origemSoma = [...origemTotais.values()].reduce((s, v) => s + v, 0);
    const conhecimento = ORIGENS
      .filter(o => (origemTotais.get(o.id) ?? 0) > 0)
      .map(o => {
        const n = origemTotais.get(o.id) ?? 0;
        return { id: o.id, fonte: o.fonte, curto: o.curto, detalhe: o.detalhe, color: o.color, n, pct: origemSoma > 0 ? Math.round((n / origemSoma) * 100) : 0 };
      })
      .sort((a, b) => b.n - a.n);

    const leadsMap = new Map(leadsPorCurso.rows.map(r => [r.curso, Number(r.n)]));
    const topCursos = cursosPorReceita.rows.map(r => {
      const leads = leadsMap.get(r.curso) ?? 0;
      const pagos = Number(r.pagos);
      return {
        nome: r.curso,
        inscritos: leads || pagos,
        receita: Math.round(num(r.receita)),
        taxa: leads > 0 ? Math.min(100, Math.round((pagos / leads) * 100)) : null,
      };
    });

    const desagSoma = desag.rows.reduce((s, r) => s + Number(r.n), 0);
    const desagregacao = desag.rows.map(r => ({
      chave: r.chave,
      n: Number(r.n),
      receita: Math.round(num(r.receita)),
      pct: desagSoma > 0 ? Math.round((Number(r.n) / desagSoma) * 100) : 0,
    }));

    const optsRows = filtros.rows;
    const uniq = (key: "curso" | "local" | "horario") =>
      [...new Set(optsRows.map(r => r[key]).filter(s => s && s.trim()))].sort((a, b) => a.localeCompare(b, "pt"));
    return {
      cards: {
        preinscritos,
        formandosAtivos,
        formandosGold,
        formandosFin,
        turmasAtivas,
        turmasTotal,
        cursosAtivos: cursosGold + cursosFin,
        cursosGold,
        cursosFin,
      },
      financeiro: {
        ...fin,
        ticketMedio: fin.pagos > 0 ? Math.round(fin.receitaTotal / fin.pagos) : 0,
      },
      funil: [
        { l: "Pré-inscritos", v: preinscritos },
        { l: "Contactados", v: Number(c?.contactados ?? 0) },
        { l: "Pagaram", v: fin.pagos },
        { l: "Formandos", v: formandosAtivos },
      ],
      conhecimento,
      topCursos,
      desagregar: f.desagregar,
      desagregacao,
      filtros: {
        cursos: uniq("curso"),
        locais: uniq("local"),
        horarios: uniq("horario"),
      },
    };
  });

  app.get("/v1/notificacoes", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const items = await buildNotificacoes(db, req.actor!.id);
    return { notificacoes: items, naoLidas: items.filter(n => !n.lida).length };
  });

  app.post("/v1/notificacoes/lidas", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const parsed = lidasSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    for (const chave of parsed.data.chaves) {
      await db.query(
        "INSERT INTO notificacoes_lidas (actor_id, chave) VALUES ($1, $2) ON CONFLICT (actor_id, chave) DO NOTHING",
        [req.actor!.id, chave],
      );
    }
    return { ok: true };
  });
}
