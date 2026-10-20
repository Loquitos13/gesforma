/**
 * Notificações da equipa (sino do cabeçalho): contagens em SQL e o estado "lida" por pessoa.
 */
import { resumoDtp } from "../pedagogia/dtpCache.js";
import { pgTextArray } from "../pedagogia/util.js";
import { OCUPA } from "./estatisticas.js";
import { DOCS_FIN_COMPLETOS, DOCS_FIN_OBRIGATORIOS } from "./painelBlocos.js";
import { many, one, type Consulta } from "./sql.js";
import type { Db } from "../db/pool.js";
import { hojeLisboa, somarDias } from "../datas.js";
import { rotuloCodigoCurso } from "../../../src/partilhado/codigoCurso.js";
import { comercialAbre } from "../../../src/partilhado/vistasComercial.js";
import { eur as eurPt } from "../../../src/partilhado/ui/formatos.js";

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

type Nova = Omit<Notificacao, "lida">;

export async function chavesLidas(c: Consulta, actorId: string) {
  const linhas = await many<{ chave: string }>(c, "SELECT chave FROM notificacoes_lidas WHERE actor_id = $1", [actorId]);
  return new Set(linhas.map(l => l.chave));
}

export async function marcarLidas(c: Consulta, actorId: string, chaves: string[]) {
  if (!chaves.length) return;
  await many(c, `INSERT INTO notificacoes_lidas (actor_id, chave)
                 SELECT $1, k FROM unnest($2::text[]) AS k
                 ON CONFLICT (actor_id, chave) DO NOTHING RETURNING chave`, [actorId, pgTextArray(chaves)]);
}

async function contagens(c: Consulta) {
  return one<{ pend_n: number; pend_valor: number; fin_docs: number; sem_ficha: number; sem_ficha_id: number | null }>(c, `
    SELECT
      (SELECT count(*)::int FROM pagamentos pg WHERE NOT (pg.estado ILIKE 'pago%') AND pg.estado !~* 'recus|cancel|anul|devol') AS pend_n,
      (SELECT COALESCE(sum(valor), 0)::float FROM pagamentos pg WHERE NOT (pg.estado ILIKE 'pago%') AND pg.estado !~* 'recus|cancel|anul|devol') AS pend_valor,
      (SELECT count(*)::int FROM formandos_fin ff WHERE ${OCUPA("ff")} AND NOT (${DOCS_FIN_COMPLETOS("$1")})) AS fin_docs,
      (SELECT count(*)::int FROM preinscricoes p
        WHERE COALESCE(p.regime, 'gold') = 'gold' AND p.validada_em IS NOT NULL AND p.estado NOT IN ('Desistiu', 'Formando') AND p.email <> ''
          AND NOT EXISTS (SELECT 1 FROM formandos_gold f WHERE lower(f.email) = lower(p.email) AND lower(trim(f.curso)) = lower(trim(p.curso)))) AS sem_ficha,
      (SELECT p.id FROM preinscricoes p
        WHERE COALESCE(p.regime, 'gold') = 'gold' AND p.validada_em IS NOT NULL AND p.estado NOT IN ('Desistiu', 'Formando') AND p.email <> ''
          AND NOT EXISTS (SELECT 1 FROM formandos_gold f WHERE lower(f.email) = lower(p.email) AND lower(trim(f.curso)) = lower(trim(p.curso)))
        ORDER BY p.validada_em LIMIT 1) AS sem_ficha_id`, [DOCS_FIN_OBRIGATORIOS]);
}

/** Por regime: pré-inscrições por contactar e as que já estão na secretaria. */
async function filasLeads(c: Consulta) {
  return many<{ regime: string; contactar: number; contactar_id: number | null; secretaria: number; secretaria_id: number | null }>(c, `
    SELECT COALESCE(regime, 'gold') AS regime,
           count(*) FILTER (WHERE contactado_em IS NULL AND estado NOT IN ('Desistiu', 'Formando') AND validada_em IS NULL)::int AS contactar,
           (array_agg(id ORDER BY inscrito DESC) FILTER (WHERE contactado_em IS NULL AND estado NOT IN ('Desistiu', 'Formando') AND validada_em IS NULL))[1] AS contactar_id,
           count(*) FILTER (WHERE estado = 'Pré-inscrição' AND secretaria_em IS NOT NULL)::int AS secretaria,
           (array_agg(id ORDER BY secretaria_em DESC) FILTER (WHERE estado = 'Pré-inscrição' AND secretaria_em IS NOT NULL))[1] AS secretaria_id
      FROM preinscricoes GROUP BY 1`);
}

/** Turmas que merecem aviso: Gold sem vagas, ou a começar em 14 dias quase vazias. */
async function turmasEmAlerta(c: Consulta) {
  return many<{ regime: string; id: number; nome: string; local: string; ufcd: string; inicio: string; ocupadas: number; capacidade: number }>(c, `
    SELECT 'gold' AS regime, t.id, t.nome, t.local, '' AS ufcd, t.data_inicio AS inicio,
           (SELECT count(*)::int FROM formandos_gold f WHERE f.turma_id = t.id AND ${OCUPA("f")}) AS ocupadas, t.vagas AS capacidade
      FROM turmas_gold t WHERE t.fechada_em IS NULL AND t.estado !~* 'cancel|fechad'
    UNION ALL
    SELECT 'fin', t.id, t.nome, t.local, t.ufcd_cod, t.data_inicio,
           (SELECT count(*)::int FROM formandos_fin f WHERE f.turma_id = t.id AND ${OCUPA("f")}), t.alunos_total
      FROM turmas_fin t WHERE t.fechada_em IS NULL AND t.activa = true`);
}

/**
 * O comercial só vende: ficam os avisos das pré-inscrições Gold e, das turmas Gold, as cheias e as com poucas
 * inscrições, que abrem nos Cronogramas (não no cockpit). Fora: pagamentos, dossiê, Financiada e o que é
 * trabalho da secretaria (inscrever na turma).
 */
function paraComercial(avisos: Nova[]): Nova[] {
  const out: Nova[] = [];
  for (const x of avisos) {
    if (/^turma-(lotada|vazia)-gold-/.test(x.chave)) {
      out.push({ chave: x.chave, tipo: x.tipo, titulo: x.titulo, texto: x.texto, view: "gold-cronogramas" });
      continue;
    }
    if (x.chave.startsWith("gold-validadas-sem-ficha-") || x.tab === "dtp" || !comercialAbre(x.view)) continue;
    out.push(x);
  }
  return out;
}

const eur = (v: number) => eurPt(v, true);

export async function construirNotificacoes(db: Db, actorId: string, role = ""): Promise<Notificacao[]> {
  const hoje = hojeLisboa();
  const em14 = somarDias(hoje, 14);
  const [lidas, n, filas, turmas, pctGold, pctFin] = await Promise.all([
    chavesLidas(db, actorId), contagens(db), filasLeads(db), turmasEmAlerta(db), resumoDtp(db, "gold"), resumoDtp(db, "fin"),
  ]);
  const out: Nova[] = [];
  const pendN = Number(n?.pend_n ?? 0);
  if (pendN > 0) {
    out.push({ chave: `pagamentos-pendentes-${pendN}`, tipo: pendN > 10 ? "error" : "warn", titulo: `${pendN} pagamentos por receber`, texto: `${eur(Number(n?.pend_valor ?? 0))} por confirmar.`, view: "pagamentos" });
  }
  for (const fila of filas) {
    const fin = fila.regime === "fin";
    const sufixo = fin ? " · Financiada" : "";
    const view = fin ? "fin-preinscricoes" : "gold-preinscricoes";
    if (fila.contactar > 0) {
      out.push({ chave: `leads-por-contactar-${fin ? "fin" : "gold"}-${fila.contactar}`, tipo: fila.contactar > 20 ? "warn" : "info", titulo: `${fila.contactar} pré-inscrições por contactar${sufixo}`, texto: fin ? "A fila do dia está no CRM da Financiada." : "A fila comercial do dia está no CRM Gold.", view, leadId: fila.contactar_id ?? undefined });
    }
    if (fila.secretaria > 0) {
      out.push({ chave: `secretaria-pre-${fin ? "fin" : "gold"}-${fila.secretaria}`, tipo: "warn", titulo: `${fila.secretaria} pré-inscrição(ões) na secretaria${sufixo}`, texto: "O dossiê está completo. Falta inscrever o formando na turma.", view, leadId: fila.secretaria_id ?? undefined });
    }
  }
  const semFicha = Number(n?.sem_ficha ?? 0);
  if (semFicha > 0) {
    out.push({ chave: `gold-validadas-sem-ficha-${semFicha}`, tipo: "warn", titulo: `${semFicha} pré-inscrição(ões) validada(s) sem ficha de formando`, texto: "A vaga está reservada. Inscreva o formando na turma escolhida.", view: "gold-preinscricoes", leadId: n?.sem_ficha_id ?? undefined });
  }
  const finDocs = Number(n?.fin_docs ?? 0);
  if (finDocs > 0) {
    out.push({ chave: `fin-docs-${finDocs}`, tipo: "warn", titulo: `${finDocs} formandos financiados sem documentos completos`, texto: "Sem elegibilidade completa a turma não arranca nem recebe apoios.", view: "fin-formandos" });
  }
  for (const t of turmas) {
    const fin = t.regime === "fin";
    const nome = fin && t.ufcd ? `${rotuloCodigoCurso(t.ufcd)} · ${t.nome}` : t.nome;
    if (!fin && t.capacidade > 0 && t.ocupadas >= t.capacidade) {
      out.push({ chave: `turma-lotada-gold-${t.id}`, tipo: "warn", titulo: `${nome} sem vagas`, texto: `${t.local} atingiu a capacidade máxima - ${t.ocupadas}/${t.capacidade} formandos.`, view: "gold-cockpit-turma", turmaId: t.id, tab: "overview" });
    } else if (t.inicio >= hoje && t.inicio <= em14 && t.ocupadas <= (fin ? 0 : Math.max(2, Math.floor(t.capacidade * 0.25)))) {
      out.push({ chave: `turma-vazia-${t.regime}-${t.id}`, tipo: "info", titulo: fin ? `${nome} sem formandos` : `${nome} com poucas inscrições`, texto: `${t.ocupadas} de ${t.capacidade} vagas preenchidas e início a ${t.inicio}.`, view: fin ? "fin-turmas" : "gold-turmas" });
    }
  }
  // Pedidos de proposta do site por tratar (o ecrã é da administração).
  if (role === "admin") {
    const novos = Number((await one<{ n: number }>(db, "SELECT count(*)::int AS n FROM pedidos_proposta WHERE estado = 'novo'"))?.n ?? 0);
    if (novos > 0) out.push({ chave: `pedidos-proposta-${novos}`, tipo: "warn", titulo: `${novos} pedido(s) de proposta por tratar`, texto: "Chegaram pelo formulário do site (Empresas e serviços).", view: "empresas-servicos" });
  }
  const dtp: Nova[] = [];
  for (const t of turmas) {
    const fin = t.regime === "fin";
    const p = (fin ? pctFin : pctGold)[t.id] ?? 0;
    if (p >= 60) continue;
    dtp.push({
      chave: `dtp-${t.regime}-${t.id}-${p}`,
      tipo: p < 40 ? "error" : "warn",
      titulo: `DTP da turma ${fin && t.ufcd ? `${rotuloCodigoCurso(t.ufcd)} · ` : ""}${t.nome} a ${p}%`,
      texto: fin ? "Faltam documentos obrigatórios do dossiê financiado." : "O dossiê bloqueia o fecho da turma e a emissão de certificados.",
      view: fin ? "fin-cockpit-turma" : "gold-cockpit-turma",
      turmaId: t.id,
      tab: "dtp",
    });
  }
  dtp.sort((a, b) => (a.tipo === b.tipo ? 0 : a.tipo === "error" ? -1 : 1));
  out.push(...dtp.slice(0, 4));

  const visiveis = role === "formador"
    ? out.filter(x => x.tab !== "dtp" && x.view !== "pagamentos" && x.view !== "fin-formandos" && !/pagament|dossiê|dtp|document/i.test(`${x.titulo} ${x.texto}`))
    : role === "comercial" ? paraComercial(out) : out;
  return visiveis.map(x => ({ ...x, lida: lidas.has(x.chave) }));
}
