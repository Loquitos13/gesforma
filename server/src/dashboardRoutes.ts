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

type PagamentoRow = { valor: unknown; metodo: string; curso: string; data: string; estado: string };

function financeiro(pagamentos: PagamentoRow[], now: Date) {
  const pagos = pagamentos.filter(p => /pago/i.test(p.estado));
  const pendentes = pagamentos.filter(p => !/pago/i.test(p.estado));
  const receitaTotal = pagos.reduce((s, p) => s + num(p.valor), 0);
  const mesAtual = monthKey(now);
  const mesAnteriorDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const mesAnterior = monthKey(mesAnteriorDate);

  const porMes = new Map<string, number>();
  for (const p of pagos) {
    const d = parseData(p.data);
    if (!d) continue;
    const k = monthKey(d);
    porMes.set(k, (porMes.get(k) ?? 0) + num(p.valor));
  }

  const receitaMensal: { mes: string; v: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    receitaMensal.push({ mes: MESES[d.getMonth()] ?? "", v: Math.round(porMes.get(monthKey(d)) ?? 0) });
  }

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
    db.query<{ n: number }>("SELECT count(*)::int AS n FROM preinscricoes WHERE contactado_em IS NULL"),
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

  const porContactar = Number(leads.rows[0]?.n ?? 0);
  if (porContactar > 0) {
    out.push({
      chave: `leads-por-contactar-${porContactar}`,
      tipo: porContactar > 20 ? "warn" : "info",
      titulo: `${porContactar} pré-inscrições por contactar`,
      texto: "A fila comercial do dia está em Pré-Inscrições Gold.",
      view: "gold-preinscricoes",
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

export function registerDashboardRoutes(
  app: FastifyInstance,
  db: Db,
  helpers: { requireAuth: (req: FastifyRequest, reply: FastifyReply) => boolean },
) {
  const { requireAuth } = helpers;

  app.get("/v1/dashboard", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const now = new Date();
    const [counts, pagamentosRows, origens, cursosPorReceita, leadsPorCurso] = await Promise.all([
      db.query<{
        preinscritos: number; contactados: number; formandos_gold: number; formandos_fin: number;
        turmas_gold_ativas: number; turmas_gold: number; turmas_fin_ativas: number; turmas_fin: number;
        cursos_gold: number; cursos_fin: number;
      }>(
        `SELECT
           (SELECT count(*)::int FROM preinscricoes) AS preinscritos,
           (SELECT count(*)::int FROM preinscricoes WHERE contactado_em IS NOT NULL) AS contactados,
           (SELECT count(*)::int FROM formandos_gold) AS formandos_gold,
           (SELECT count(*)::int FROM formandos_fin) AS formandos_fin,
           (SELECT count(*)::int FROM turmas_gold WHERE estado = 'Ativa') AS turmas_gold_ativas,
           (SELECT count(*)::int FROM turmas_gold) AS turmas_gold,
           (SELECT count(*)::int FROM turmas_fin WHERE activa = true) AS turmas_fin_ativas,
           (SELECT count(*)::int FROM turmas_fin) AS turmas_fin,
           (SELECT count(*)::int FROM cursos_gold WHERE estado = 'Ativo') AS cursos_gold,
           (SELECT count(*)::int FROM cursos_fin WHERE estado = 'Ativo') AS cursos_fin`,
      ),
      db.query<PagamentoRow>("SELECT valor, metodo, curso, data, estado FROM pagamentos"),
      db.query<{ origem: string; n: number }>("SELECT origem, count(*)::int AS n FROM preinscricoes GROUP BY origem"),
      db.query<{ curso: string; receita: unknown; pagos: number }>(
        `SELECT curso, COALESCE(sum(valor), 0) AS receita, count(*)::int AS pagos
           FROM pagamentos WHERE estado = 'Pago' AND curso <> '' GROUP BY curso ORDER BY 2 DESC LIMIT 6`,
      ),
      db.query<{ curso: string; n: number }>(
        "SELECT curso, count(*)::int AS n FROM preinscricoes WHERE curso <> '' GROUP BY curso",
      ),
    ]);

    const c = counts.rows[0];
    const fin = financeiro(pagamentosRows.rows, now);
    const formandosAtivos = Number(c?.formandos_gold ?? 0) + Number(c?.formandos_fin ?? 0);
    const preinscritos = Number(c?.preinscritos ?? 0);

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

    return {
      cards: {
        preinscritos,
        formandosAtivos,
        formandosGold: Number(c?.formandos_gold ?? 0),
        formandosFin: Number(c?.formandos_fin ?? 0),
        turmasAtivas: Number(c?.turmas_gold_ativas ?? 0) + Number(c?.turmas_fin_ativas ?? 0),
        turmasTotal: Number(c?.turmas_gold ?? 0) + Number(c?.turmas_fin ?? 0),
        cursosAtivos: Number(c?.cursos_gold ?? 0) + Number(c?.cursos_fin ?? 0),
        cursosGold: Number(c?.cursos_gold ?? 0),
        cursosFin: Number(c?.cursos_fin ?? 0),
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
