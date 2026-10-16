import { Filtros, many, one, padraoPesquisa, paginar, valor, type Consulta } from "./sql.js";

/** Pagamentos (transferência com comprovativo; o gateway automático ainda não está escolhido). */

const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0) || 0);

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

export type PagamentoRow = Record<string, unknown> & { id: string; estado: string; valor: unknown; email: string; curso: string; formando_id: number | null };

export function obterPagamento(c: Consulta, id: string) {
  return one<PagamentoRow>(c, "SELECT * FROM pagamentos WHERE id = $1", [id]);
}

export async function inserirPagamento(c: Consulta, p: {
  id: string; nome: string; valor: number; metodo: string; curso: string; data: string; estado: string; email: string;
  referencia: string; formandoId: number | null; turmaId: number | null;
}) {
  await one(
    c,
    `INSERT INTO pagamentos (id, nome, valor, metodo, curso, data, estado, email, referencia, formando_id, turma_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [p.id, p.nome, p.valor, p.metodo, p.curso, p.data, p.estado, p.email, p.referencia, p.formandoId, p.turmaId],
  );
}

export async function actualizarPagamento(c: Consulta, id: string, p: {
  nome?: string; valor?: number; metodo?: string; curso?: string; data?: string; estado?: string; email?: string; referencia?: string;
}) {
  await one(
    c,
    `UPDATE pagamentos SET nome = COALESCE($2, nome), valor = COALESCE($3, valor), metodo = COALESCE($4, metodo),
       curso = COALESCE($5, curso), data = COALESCE($6, data), estado = COALESCE($7, estado), email = COALESCE($8, email),
       referencia = COALESCE($9, referencia)
     WHERE id = $1`,
    [id, p.nome ?? null, p.valor ?? null, p.metodo ?? null, p.curso ?? null, p.data ?? null, p.estado ?? null, p.email ?? null, p.referencia ?? null],
  );
}

export async function apagarPagamento(c: Consulta, id: string) {
  await one(c, "DELETE FROM pagamentos WHERE id = $1", [id]);
}

export function formandoGoldDoPagamento(c: Consulta, id: number) {
  return one<{ id: number; turma_id: number | null }>(c, "SELECT id, turma_id FROM formandos_gold WHERE id = $1", [id]);
}

/**
 * Passa a Pago, regista quando e quem, e limpa uma recusa anterior.
 * Atómico: devolve false se outro pedido já o confirmou (os efeitos só correm uma vez).
 */
export async function marcarPago(c: Consulta, id: string, carimbo: string, actorId?: string | null) {
  const r = await one(
    c,
    `UPDATE pagamentos SET estado = 'Pago', data = $2, pago_em = now(), confirmado_por = $3, recusado_em = NULL, recusa_motivo = ''
      WHERE id = $1 AND estado <> 'Pago' RETURNING id`,
    [id, carimbo, actorId ?? null],
  );
  return !!r;
}

/** Ficha Gold do pagamento: pelo id ligado; sem ele, pelo email e curso. */
export async function marcarFormandoGoldPago(c: Consulta, p: { email: string; metodo: string; formandoId: number | null; curso: string }) {
  await one(
    c,
    `UPDATE formandos_gold SET pago = true, metodo = CASE WHEN metodo = '-' OR metodo = '' THEN $2 ELSE metodo END
      WHERE ($3::int IS NOT NULL AND id = $3::int)
         OR ($3::int IS NULL AND lower(email) = $1 AND lower(trim(curso)) = lower(trim($4)))`,
    [p.email, p.metodo, p.formandoId, p.curso],
  );
}

/**
 * Pré-inscrição do pagamento: a ligada pelo pagamento_id; só sem nenhuma ligada, a Gold do mesmo email e curso
 * que ainda não tem pagamento próprio nem desistiu.
 */
/** Pagamento reembolsado: a ficha Gold ligada volta a ficar por pagar. */
export async function desmarcarFormandoGoldPago(c: Consulta, formandoId: number) {
  await one(c, "UPDATE formandos_gold SET pago = false WHERE id = $1", [formandoId]);
}

export async function marcarLeadPago(c: Consulta, p: { email: string; pagamentoId: string; curso: string }) {
  await one(
    c,
    `UPDATE preinscricoes SET estado = 'Pago'
      WHERE estado NOT IN ('Formando', 'Pago')
        AND (pagamento_id = $2
          OR (NOT EXISTS (SELECT 1 FROM preinscricoes l WHERE l.pagamento_id = $2)
              AND COALESCE(pagamento_id, '') = '' AND regime = 'gold' AND estado <> 'Desistiu'
              AND lower(email) = $1 AND lower(trim(curso)) = lower(trim($3))))`,
    [p.email, p.pagamentoId, p.curso],
  );
}

/** Recusa o comprovativo: o pagamento continua pendente e a pessoa volta a poder anexar. */
export async function registarRecusa(c: Consulta, id: string, motivo: string) {
  await one(c, "UPDATE pagamentos SET recusado_em = now(), recusa_motivo = $2 WHERE id = $1", [id, motivo]);
  await one(
    c,
    `UPDATE preinscricao_docs d SET estado = 'recusado', observacao = $2
      WHERE d.tipo = 'comprovativo' AND d.estado <> 'validado'
        AND d.preinscricao_id IN (SELECT id FROM preinscricoes WHERE pagamento_id = $1)`,
    [id, motivo],
  );
}

export async function pagamentosPorReferencia(c: Consulta, referencia: string, digitos: string) {
  return many<PagamentoRow>(
    c,
    `SELECT * FROM pagamentos WHERE referencia <> '' AND (referencia = $1 OR regexp_replace(referencia, '[^0-9]', '', 'g') = $2)
      ORDER BY created_at DESC`,
    [referencia, digitos],
  );
}

/** Chave do webhook de pagamentos guardada nas Configurações (Gold). */
export async function chaveWebhookGuardada(c: Consulta) {
  const row = await one<{ values: Record<string, unknown> }>(c, "SELECT values FROM app_settings WHERE id = 'gold'");
  const v = row?.values ?? {};
  return String(v["Chave webhook pagamentos"] ?? v.chaveWebhook ?? "").trim();
}

// ─── Lista e indicadores ─────────────────────────────────────────────────────

/** Situação de trabalho de cada pagamento, a partir do estado e do último comprovativo. */
const SITUACAO = `CASE
  WHEN p.estado = 'Pago' THEN 'pago'
  WHEN p.estado = 'Cancelado' THEN 'cancelado'
  WHEN p.estado = 'Reembolsado' THEN 'reembolsado'
  WHEN comp.estado = 'pendente' AND (p.recusado_em IS NULL OR comp.created_at > p.recusado_em) THEN 'a_confirmar'
  WHEN p.recusado_em IS NOT NULL THEN 'recusado'
  ELSE 'pedido' END`;

const BASE = `
  FROM pagamentos p
  LEFT JOIN LATERAL (
    SELECT l.id, l.regime, l.pagamento_pedido_em FROM preinscricoes l WHERE l.pagamento_id = p.id ORDER BY l.id DESC LIMIT 1
  ) lead ON true
  LEFT JOIN LATERAL (
    SELECT d.id, d.estado, d.nome, d.drive_file_id, d.created_at, d.observacao FROM preinscricao_docs d
     WHERE lead.id IS NOT NULL AND d.preinscricao_id = lead.id AND d.tipo = 'comprovativo'
     ORDER BY d.created_at DESC LIMIT 1
  ) comp ON true`;

export const SITUACOES = ["a_confirmar", "pedido", "recusado", "pago", "cancelado", "reembolsado"] as const;
export type Situacao = (typeof SITUACOES)[number];

export type FiltrosPagamentos = { situacao?: Situacao; curso?: string; metodo?: string; de?: string; ate?: string; q?: string };

function filtros(f: FiltrosPagamentos, comSituacao = true) {
  const w = new Filtros();
  if (comSituacao) w.add(`(${SITUACAO}) = ?`, f.situacao);
  w.add("p.curso = ?", f.curso);
  w.add("p.metodo = ?", f.metodo);
  w.add("COALESCE(p.pago_em, p.created_at) >= ?::date", f.de);
  w.add("COALESCE(p.pago_em, p.created_at) < (?::date + 1)", f.ate);
  const q = padraoPesquisa(f.q);
  w.add("(p.nome ILIKE ? OR p.email ILIKE ? OR p.curso ILIKE ? OR p.id ILIKE ?)", q, q, q, q);
  return w;
}

export type LinhaPagamento = {
  id: string; nome: string; email: string; curso: string; valor: number; metodo: string; estado: string; situacao: Situacao;
  criado: string; pago_em: string | null; recusado_em: string | null; recusa_motivo: string; referencia: string;
  formando_id: number | null; lead_id: number | null; lead_regime: string | null; pedido_em: string | null;
  comprovativo_id: number | null; comprovativo_nome: string | null; comprovativo_ficheiro: string | null; comprovativo_em: string | null;
};

const ORDENS: Record<string, string> = {
  data: "COALESCE(p.pago_em, p.created_at)", valor: "p.valor", nome: "p.nome", curso: "p.curso",
};

export function listarPagamentos(c: Consulta, f: FiltrosPagamentos & { pagina: number; porPagina: number; ordem?: string }) {
  const w = filtros(f);
  const campo = f.ordem?.replace(/^-/, "") ?? "";
  const expr = ORDENS[campo];
  const ordem = expr ? `ORDER BY ${expr} ${f.ordem?.startsWith("-") ? "DESC" : "ASC"} NULLS LAST, p.id` : "ORDER BY COALESCE(p.pago_em, p.created_at) DESC, p.id DESC";
  return paginar<LinhaPagamento>(
    c,
    `SELECT p.id, p.nome, p.email, p.curso, p.valor::float AS valor, p.metodo, p.estado, (${SITUACAO}) AS situacao,
            p.created_at::text AS criado, p.pago_em::text AS pago_em, p.recusado_em::text AS recusado_em, p.recusa_motivo, p.referencia,
            p.formando_id, lead.id AS lead_id, lead.regime AS lead_regime, lead.pagamento_pedido_em::text AS pedido_em,
            comp.id AS comprovativo_id, comp.nome AS comprovativo_nome, NULLIF(comp.drive_file_id, '') AS comprovativo_ficheiro,
            comp.created_at::text AS comprovativo_em
       ${BASE} ${w.where}`,
    w.params,
    { pagina: f.pagina, porPagina: f.porPagina, ordem },
  );
}

export function obterPagamentoDetalhe(c: Consulta, id: string) {
  return one<LinhaPagamento>(
    c,
    `SELECT p.id, p.nome, p.email, p.curso, p.valor::float AS valor, p.metodo, p.estado, (${SITUACAO}) AS situacao,
            p.created_at::text AS criado, p.pago_em::text AS pago_em, p.recusado_em::text AS recusado_em, p.recusa_motivo, p.referencia,
            p.formando_id, lead.id AS lead_id, lead.regime AS lead_regime, lead.pagamento_pedido_em::text AS pedido_em,
            comp.id AS comprovativo_id, comp.nome AS comprovativo_nome, NULLIF(comp.drive_file_id, '') AS comprovativo_ficheiro,
            comp.created_at::text AS comprovativo_em
       ${BASE} WHERE p.id = $1`,
    [id],
  );
}

/** Contagens por situação (para os separadores), com os mesmos filtros excepto a situação. */
export function contarPorSituacao(c: Consulta, f: FiltrosPagamentos) {
  const w = filtros(f, false);
  return many<{ situacao: Situacao; total: number; valor: number }>(
    c,
    `SELECT (${SITUACAO}) AS situacao, count(*)::int AS total, COALESCE(sum(p.valor), 0)::float AS valor ${BASE} ${w.where} GROUP BY 1`,
    w.params,
  );
}

/** Indicadores: receita no período, este mês, por receber, ticket médio e métodos (só pagamentos confirmados). */
export async function indicadoresPagamentos(c: Consulta, f: FiltrosPagamentos) {
  const w = new Filtros();
  w.sempre("p.estado = 'Pago'");
  w.add("p.curso = ?", f.curso);
  w.add("COALESCE(p.pago_em, p.created_at) >= ?::date", f.de);
  w.add("COALESCE(p.pago_em, p.created_at) < (?::date + 1)", f.ate);
  const periodo = await one<{ receita: number; n: number }>(
    c, `SELECT COALESCE(sum(p.valor), 0)::float AS receita, count(*)::int AS n FROM pagamentos p ${w.where}`, w.params,
  );
  const mes = await valor<number>(
    c,
    `SELECT COALESCE(sum(valor), 0)::float FROM pagamentos
      WHERE estado = 'Pago' AND COALESCE(pago_em, created_at) >= date_trunc('month', now())`,
  );
  const mesAnterior = await valor<number>(
    c,
    `SELECT COALESCE(sum(valor), 0)::float FROM pagamentos
      WHERE estado = 'Pago' AND COALESCE(pago_em, created_at) >= date_trunc('month', now()) - interval '1 month'
        AND COALESCE(pago_em, created_at) < now() - interval '1 month'`,
  );
  const porReceber = await one<{ valor: number; n: number }>(
    c, "SELECT COALESCE(sum(valor), 0)::float AS valor, count(*)::int AS n FROM pagamentos WHERE estado = 'Pendente'",
  );
  const metodos = await many<{ metodo: string; valor: number; n: number }>(
    c,
    `SELECT COALESCE(NULLIF(p.metodo, ''), 'Sem método') AS metodo, COALESCE(sum(p.valor), 0)::float AS valor, count(*)::int AS n
       FROM pagamentos p ${w.where} GROUP BY 1 ORDER BY 2 DESC`,
    w.params,
  );
  const n = Number(periodo?.n ?? 0);
  return {
    receita: Number(periodo?.receita ?? 0),
    pagamentos: n,
    ticketMedio: n ? Math.round((Number(periodo?.receita ?? 0) / n) * 100) / 100 : 0,
    esteMes: Number(mes ?? 0),
    mesAnteriorAteHoje: Number(mesAnterior ?? 0),
    porReceber: Number(porReceber?.valor ?? 0),
    porReceberN: Number(porReceber?.n ?? 0),
    metodos,
  };
}
