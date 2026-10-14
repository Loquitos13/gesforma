import { Filtros, many, one, padraoPesquisa, paginar, valor, type Consulta } from "./sql.js";
import { pgTextArray } from "../pedagogia/util.js";

/** Emails automáticos: modelos, regras, eventos e fila de envios. */

export type ModeloEmail = {
  id: number; tipo: string; nome: string; assunto: string; body_lines: unknown; body_xml: string;
  cta: string; cta_href: string; cta_ambito: string; updated_at: string;
};

const SELECT_MODELO = "SELECT id, tipo, nome, assunto, body_lines, body_xml, cta, cta_href, cta_ambito, updated_at::text AS updated_at FROM email_templates";

export function listarModelos(c: Consulta) {
  return many<ModeloEmail>(c, `${SELECT_MODELO} ORDER BY id`);
}

export function obterModelo(c: Consulta, id: number) {
  return one<ModeloEmail>(c, `${SELECT_MODELO} WHERE id = $1`, [id]);
}

export async function existeModeloTipo(c: Consulta, tipo: string) {
  return Boolean(await one(c, "SELECT 1 FROM email_templates WHERE tipo = $1", [tipo]));
}

export async function actualizarModelo(c: Consulta, id: number, p: {
  nome?: string; assunto?: string; body_lines?: string[]; body_xml?: string; cta?: string; cta_href?: string; cta_ambito?: string;
}) {
  await one(
    c,
    `UPDATE email_templates SET
       nome = COALESCE($2, nome), assunto = COALESCE($3, assunto), body_lines = COALESCE($4::jsonb, body_lines),
       cta = COALESCE($5, cta), body_xml = COALESCE($6, body_xml), cta_href = COALESCE($7, cta_href),
       cta_ambito = COALESCE($8, cta_ambito), updated_at = now()
     WHERE id = $1`,
    [id, p.nome ?? null, p.assunto ?? null, p.body_lines ? JSON.stringify(p.body_lines) : null, p.cta ?? null,
      p.body_xml ?? null, p.cta_href ?? null, p.cta_ambito ?? null],
  );
}

export type RegraEmail = {
  id: number; nome: string; trigger_key: string; gatilho_label: string; template_tipo: string; template_nome: string | null;
  delay_seconds: number; curso: string | null; ativo: boolean;
  envios: number; abertos: number; falhados: number; em_fila: number; ultimo_envio: string | null;
};

/** Regras com estatísticas (sem os envios de teste) e a data do último envio. */
export function listarRegras(c: Consulta) {
  return many<RegraEmail>(
    c,
    `SELECT r.id, r.nome, r.trigger_key, r.gatilho_label, r.template_tipo, t.nome AS template_nome, r.delay_seconds, r.curso, r.ativo,
            COALESCE(j.envios, 0)::int AS envios, COALESCE(j.abertos, 0)::int AS abertos,
            COALESCE(j.falhados, 0)::int AS falhados, COALESCE(j.em_fila, 0)::int AS em_fila, j.ultimo_envio
       FROM email_rules r
       LEFT JOIN email_templates t ON t.tipo = r.template_tipo
       LEFT JOIN (
         SELECT rule_id,
                count(*) FILTER (WHERE status = 'sent') AS envios,
                count(*) FILTER (WHERE status = 'sent' AND opened_at IS NOT NULL) AS abertos,
                count(*) FILTER (WHERE status = 'failed') AS falhados,
                count(*) FILTER (WHERE status = 'queued') AS em_fila,
                max(sent_at)::text AS ultimo_envio
           FROM email_jobs
          WHERE COALESCE(payload->>'teste', '') <> 'true'
          GROUP BY rule_id
       ) j ON j.rule_id = r.id
      ORDER BY r.id`,
  );
}

export async function criarRegra(c: Consulta, r: { nome: string; triggerKey: string; gatilho: string; templateTipo: string; atrasoSeg: number; curso: string | null; ativo: boolean }) {
  const id = await valor<number>(
    c,
    `INSERT INTO email_rules (nome, trigger_key, gatilho_label, template_tipo, delay_seconds, curso, ativo)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [r.nome, r.triggerKey, r.gatilho, r.templateTipo, r.atrasoSeg, r.curso, r.ativo],
  );
  return Number(id);
}

export async function actualizarRegra(c: Consulta, id: number, r: {
  nome?: string; gatilho?: string; triggerKey?: string; templateTipo?: string; atrasoSeg?: number; curso?: string | null; ativo?: boolean;
}) {
  await one(
    c,
    `UPDATE email_rules SET nome = COALESCE($2, nome), gatilho_label = COALESCE($3, gatilho_label), trigger_key = COALESCE($4, trigger_key),
       template_tipo = COALESCE($5, template_tipo), delay_seconds = COALESCE($6, delay_seconds),
       curso = CASE WHEN $8::boolean THEN $7 ELSE curso END, ativo = COALESCE($9, ativo)
     WHERE id = $1`,
    [id, r.nome ?? null, r.gatilho ?? null, r.triggerKey ?? null, r.templateTipo ?? null, r.atrasoSeg ?? null,
      r.curso ?? null, r.curso !== undefined, r.ativo ?? null],
  );
}

export async function apagarRegra(c: Consulta, id: number) {
  await one(c, "DELETE FROM email_rules WHERE id = $1", [id]);
}

/** Regras activas (com o modelo) para um conjunto de eventos. */
export function regrasActivasPara(c: Consulta, chaves: string[]) {
  return many<RegraComModelo>(
    c,
    `SELECT r.id, r.template_tipo, r.delay_seconds, r.curso, t.assunto, t.body_lines, t.body_xml, t.cta, t.cta_href, t.cta_ambito
       FROM email_rules r JOIN email_templates t ON t.tipo = r.template_tipo
      WHERE r.ativo = true AND r.trigger_key = ANY($1::text[])`,
    [pgTextArray(chaves)],
  );
}

export type RegraComModelo = {
  id: number; template_tipo: string; delay_seconds: number; curso: string | null; assunto: string;
  body_lines: unknown; body_xml: string; cta: string; cta_href: string; cta_ambito: string;
};

export function regraComModelo(c: Consulta, id: number) {
  return one<RegraComModelo>(
    c,
    `SELECT r.id, r.template_tipo, r.delay_seconds, r.curso, t.assunto, t.body_lines, t.body_xml, t.cta, t.cta_href, t.cta_ambito
       FROM email_rules r JOIN email_templates t ON t.tipo = r.template_tipo WHERE r.id = $1`,
    [id],
  );
}

// ─── Eventos e fila ──────────────────────────────────────────────────────────

/** Regista o evento uma só vez (idempotência). Devolve o id, ou null se já existia. */
export async function registarEvento(c: Consulta, id: string, tipo: string, chave: string, payload: unknown) {
  const r = await one<{ id: string }>(
    c,
    `INSERT INTO automation_events (id, type, idempotency_key, payload) VALUES ($1, $2, $3, $4::jsonb)
     ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`,
    [id, tipo, chave.slice(0, 200), JSON.stringify(payload)],
  );
  return r?.id ?? null;
}

export async function porNaFila(c: Consulta, j: {
  id: string; regraId: number; eventoId: string; para: string; nome: string; assunto: string; texto: string; html: string;
  quando: string; payload: unknown; estado?: "queued";
}) {
  const r = await one<{ id: string }>(
    c,
    `INSERT INTO email_jobs (id, rule_id, event_id, to_email, to_name, subject, body_text, body_html, scheduled_at, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
     ON CONFLICT (rule_id, event_id) DO NOTHING RETURNING id`,
    [j.id, j.regraId, j.eventoId, j.para, j.nome, j.assunto, j.texto, j.html, j.quando, JSON.stringify(j.payload)],
  );
  return Boolean(r);
}

export function envioPendentes(c: Consulta, limite: number) {
  return many<{ id: string; to_email: string; to_name: string; subject: string; body_text: string; body_html: string; attempts: number }>(
    c,
    `SELECT id, to_email, to_name, subject, body_text, body_html, attempts FROM email_jobs
      WHERE status = 'queued' AND scheduled_at <= now() ORDER BY scheduled_at LIMIT $1`,
    [limite],
  );
}

export async function marcarEnviado(c: Consulta, id: string, nota: string | null = null) {
  await one(c, "UPDATE email_jobs SET status = 'sent', sent_at = now(), attempts = attempts + 1, last_error = $2 WHERE id = $1", [id, nota]);
}

export async function marcarFalha(c: Consulta, id: string, definitivo: boolean, erro: string) {
  await one(
    c,
    "UPDATE email_jobs SET status = $2, attempts = attempts + 1, last_error = $3, scheduled_at = now() + interval '2 minutes' WHERE id = $1",
    [id, definitivo ? "failed" : "queued", erro],
  );
}

export async function marcarAberto(c: Consulta, id: string) {
  await one(c, "UPDATE email_jobs SET opened_at = COALESCE(opened_at, now()) WHERE id = $1 AND status = 'sent'", [id]);
}

/** Volta a pôr na fila um envio falhado. */
export async function reenviarFalhado(c: Consulta, id: string) {
  const r = await one<{ id: string }>(
    c,
    "UPDATE email_jobs SET status = 'queued', scheduled_at = now(), last_error = NULL WHERE id = $1 AND status = 'failed' RETURNING id",
    [id],
  );
  return Boolean(r);
}

export async function cancelarEmFila(c: Consulta, id: string) {
  const r = await one<{ id: string }>(c, "UPDATE email_jobs SET status = 'cancelled' WHERE id = $1 AND status = 'queued' RETURNING id", [id]);
  return Boolean(r);
}

export function estatisticasEnvios30Dias(c: Consulta) {
  return one<{ sent: number; queued: number; failed: number; abertos: number }>(
    c,
    `SELECT count(*) FILTER (WHERE status = 'sent')::int AS sent,
            count(*) FILTER (WHERE status = 'queued')::int AS queued,
            count(*) FILTER (WHERE status = 'failed')::int AS failed,
            count(*) FILTER (WHERE status = 'sent' AND opened_at IS NOT NULL)::int AS abertos
       FROM email_jobs
      WHERE created_at >= now() - interval '30 days' AND COALESCE(payload->>'teste', '') <> 'true'`,
  );
}

export type EnvioLinha = {
  id: string; para: string; nome: string; assunto: string; estado: string; agendado: string; enviado: string | null;
  aberto: string | null; erro: string | null; regra: string; regra_id: number; tentativas: number; teste: boolean;
};

/** Histórico de envios, paginado e filtrado. */
export function listarEnvios(c: Consulta, f: { regra?: number; estado?: string; q?: string; de?: string; ate?: string; pagina: number; porPagina: number }) {
  const w = new Filtros();
  w.add("j.rule_id = ?", f.regra);
  w.add("j.status = ?", f.estado);
  const p = padraoPesquisa(f.q);
  w.add("(j.to_email ILIKE ? OR j.to_name ILIKE ? OR j.subject ILIKE ?)", p, p, p);
  w.add("coalesce(j.sent_at, j.scheduled_at) >= ?::date", f.de);
  w.add("coalesce(j.sent_at, j.scheduled_at) < (?::date + 1)", f.ate);
  return paginar<EnvioLinha>(
    c,
    `SELECT j.id, j.to_email AS para, j.to_name AS nome, j.subject AS assunto, j.status AS estado,
            j.scheduled_at::text AS agendado, j.sent_at::text AS enviado, j.opened_at::text AS aberto, j.last_error AS erro,
            r.nome AS regra, r.id AS regra_id, j.attempts AS tentativas, COALESCE(j.payload->>'teste', '') = 'true' AS teste,
            coalesce(j.sent_at, j.scheduled_at) AS ord
       FROM email_jobs j JOIN email_rules r ON r.id = j.rule_id ${w.where}`,
    w.params,
    { pagina: f.pagina, porPagina: f.porPagina, ordem: "ORDER BY ord DESC" },
  );
}

/** Um envio, com o HTML para pré-visualizar. */
export function obterEnvio(c: Consulta, id: string) {
  return one<{ id: string; subject: string; body_html: string; body_text: string; to_email: string }>(
    c,
    "SELECT id, subject, body_html, body_text, to_email FROM email_jobs WHERE id = $1",
    [id],
  );
}

/** Um evento manual só envia para quem existe no GesForma (lead, formando ou utilizador). */
export async function destinatarioConhecido(c: Consulta, email: string) {
  return Boolean(await one(
    c,
    `SELECT 1 FROM preinscricoes WHERE lower(email) = $1
     UNION ALL SELECT 1 FROM formandos_gold WHERE lower(email) = $1
     UNION ALL SELECT 1 FROM formandos_fin WHERE lower(email) = $1
     UNION ALL SELECT 1 FROM users WHERE lower(email) = $1 LIMIT 1`,
    [email],
  ));
}

/** Dados reais para pré-visualizar e testar: a pré-inscrição e a turma activa mais recentes. */
export async function exemploReal(c: Consulta, curso: string | null) {
  const lead = await one<{ nome: string; apelido: string; email: string; curso: string; docs_token: string | null }>(
    c,
    `SELECT nome, apelido, email, curso, docs_token FROM preinscricoes
      WHERE email <> '' AND ($1::text IS NULL OR lower(trim(curso)) = lower(trim($1)))
      ORDER BY id DESC LIMIT 1`,
    [curso],
  );
  const turma = await one<{ nome: string; curso: string }>(
    c,
    `SELECT nome, curso FROM turmas_gold WHERE estado = 'Ativa' AND ($1::text IS NULL OR lower(trim(curso)) = lower(trim($1)))
      ORDER BY data_inicio DESC NULLS LAST LIMIT 1`,
    [curso],
  );
  return { lead, turma };
}

// ─── Lembretes automáticos (CRM e turmas) ────────────────────────────────────

const LEAD_EM = `CASE WHEN inscrito ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN to_timestamp(substring(inscrito from 1 for 16), 'YYYY-MM-DD HH24:MI') ELSE created_at END`;

/** Leads em aberto há pelo menos N dias (só Gold quando `soGold`). */
export function leadsParados(c: Consulta, dias: number, soGold: boolean) {
  return many<{ id: number; nome: string; apelido: string; email: string; curso: string }>(
    c,
    `SELECT id, nome, apelido, email, curso FROM preinscricoes
      WHERE estado NOT IN ('Pago', 'Formando', 'Desistiu') AND email <> ''
        AND ($2::boolean = false OR COALESCE(regime, 'gold') <> 'fin')
        AND (${LEAD_EM}) <= now() - make_interval(days => $1::int)`,
    [dias, soGold],
  );
}

export function turmasQueComecam(c: Consulta, datas: string[]) {
  return many<{ id: number; nome: string; curso: string; data_inicio: string; regime: "gold" | "fin" }>(
    c,
    `SELECT id, nome, curso, data_inicio, 'gold' AS regime FROM turmas_gold WHERE data_inicio = ANY($1::text[]) AND estado = 'Ativa'
     UNION ALL
     SELECT id, nome, curso, data_inicio, 'fin' AS regime FROM turmas_fin WHERE data_inicio = ANY($1::text[]) AND activa = true`,
    [pgTextArray(datas)],
  );
}

export function formandosDaTurma(c: Consulta, regime: "gold" | "fin", turmaId: number, turmaNome: string) {
  return regime === "gold"
    ? many<{ nome: string; apelido: string; email: string; curso: string }>(
      c, "SELECT nome, apelido, email, curso FROM formandos_gold WHERE turma_id = $1 AND email <> ''", [turmaId])
    : many<{ nome: string; apelido: string; email: string; curso: string }>(
      c,
      `SELECT nome, apelido, email, curso FROM formandos_fin
        WHERE email <> '' AND (turma_id = $1 OR lower(trim(turma)) = lower(trim($2)))`,
      [turmaId, turmaNome],
    );
}

/** Avança o lead no funil; nunca recua Pago/Formando. */
export async function avancarEstadoLead(c: Consulta, alvo: string, rank: number, leadId: number, email: string) {
  await one(
    c,
    `UPDATE preinscricoes SET estado = $1
      WHERE ($3::int > 0 AND id = $3 OR $4 <> '' AND lower(email) = $4)
        AND COALESCE((CASE estado WHEN 'Não contactado' THEN 0 WHEN '1º Contacto' THEN 1 WHEN '2º Contacto' THEN 2
                      WHEN 'Pago' THEN 3 WHEN 'Pré-inscrição' THEN 4 WHEN 'Formando' THEN 5 ELSE 0 END), 0) < $2
        AND estado <> 'Formando'`,
    [alvo, rank, leadId, email],
  );
}
