/**
 * Formadores: lista com KPIs, ficha (turmas, sessões, horas, valores), documentos e escrita.
 * As horas contam-se a partir do cronograma das turmas: uma sessão lectiva é do formador
 * se o tiver na lista da sessão, ou, sem formadores na sessão, se ele for o responsável da turma.
 */
import { many, one, ordenarPor, paginar, valor, Filtros, padraoPesquisa, type Consulta, type Regime } from "./sql.js";

const HORAS_SESSAO = `CASE
  WHEN COALESCE(s.val->>'horaInicio', '') ~ '^\\d{1,2}:\\d{2}$' AND COALESCE(s.val->>'horaFim', '') ~ '^\\d{1,2}:\\d{2}$'
  THEN GREATEST(EXTRACT(EPOCH FROM ((s.val->>'horaFim')::time - (s.val->>'horaInicio')::time)) / 3600.0, 0)
  ELSE 0 END`;

const CRONOGRAMA = "jsonb_array_elements(CASE WHEN jsonb_typeof(t.cronograma) = 'array' THEN t.cronograma ELSE '[]'::jsonb END) WITH ORDINALITY AS s(val, ord)";

/** Uma linha por (formador, sessão lectiva) das turmas dos dois regimes. */
const SESSOES_FORMADOR = `
  sess AS (
    SELECT 'gold'::text AS regime, t.id AS turma_id, t.nome AS turma, t.curso, t.formador AS responsavel,
           t.valores_hora_formador AS valores, t.fechada_em, s.val, s.ord
      FROM turmas_gold t, ${CRONOGRAMA}
     WHERE COALESCE(s.val->>'modalidade', 'presencial') IN ('presencial', 'sincrona')
    UNION ALL
    SELECT 'fin'::text, t.id, t.nome, t.curso, t.formador, t.valores_hora_formador, t.fechada_em, s.val, s.ord
      FROM turmas_fin t, ${CRONOGRAMA}
     WHERE COALESCE(s.val->>'modalidade', 'presencial') IN ('presencial', 'sincrona')
  ),
  sf AS (
    SELECT s.regime, s.turma_id, s.turma, s.curso, s.valores, s.fechada_em, s.ord,
           COALESCE(s.val->>'data', '') AS data, s.val->>'horaInicio' AS hora_inicio, s.val->>'horaFim' AS hora_fim,
           n.nome AS nome_original, lower(trim(n.nome)) AS nome, ${HORAS_SESSAO} AS horas
      FROM sess s
      CROSS JOIN LATERAL (
        SELECT jsonb_array_elements_text(s.val->'formadores') AS nome
         WHERE jsonb_typeof(s.val->'formadores') = 'array'
        UNION
        SELECT s.val->>'formador' WHERE COALESCE(s.val->>'formador', '') <> ''
        UNION
        SELECT s.responsavel
         WHERE COALESCE(s.responsavel, '') <> ''
           AND COALESCE(s.val->>'formador', '') = ''
           AND (jsonb_typeof(s.val->'formadores') IS DISTINCT FROM 'array' OR jsonb_array_length(s.val->'formadores') = 0)
      ) n
     WHERE trim(COALESCE(n.nome, '')) <> ''
  ),
  membros AS (
    SELECT 'gold'::text AS regime, t.id AS turma_id, lower(trim(t.formador)) AS nome FROM turmas_gold t WHERE trim(COALESCE(t.formador, '')) <> ''
    UNION SELECT 'gold', t.id, lower(trim(e)) FROM turmas_gold t, jsonb_array_elements_text(COALESCE(t.formadores, '[]'::jsonb)) e
    UNION SELECT 'fin', t.id, lower(trim(t.formador)) FROM turmas_fin t WHERE trim(COALESCE(t.formador, '')) <> ''
    UNION SELECT 'fin', t.id, lower(trim(e)) FROM turmas_fin t, jsonb_array_elements_text(COALESCE(t.formadores, '[]'::jsonb)) e
    UNION SELECT regime, turma_id, nome FROM sf
  )`;

/** Lista de ids (JSON em texto, para os dois drivers) como text[]. */
const DOCS = "ARRAY(SELECT jsonb_array_elements_text($4::jsonb))";

export type FiltrosFormadores = {
  regime: Regime;
  hoje: string;
  /** Data limite para "CCP a expirar" (hoje + 90 dias). */
  limiteCcp: string;
  docsObrigatorios: string[];
  estado?: "Ativo" | "Inactivo";
  especialidade?: string;
  disponibilidade?: string;
  alerta?: "docs" | "ccp" | "com_turma" | "sem_turma";
  q?: string;
};

/**
 * SELECT com uma linha por formador do regime e os números da lista.
 * Parâmetros: $1 regime, $2 hoje, $3 limite CCP, $4 docs obrigatórios.
 */
const LISTA = `
  WITH ${SESSOES_FORMADOR},
  horas AS (
    SELECT nome,
           COALESCE(sum(horas) FILTER (WHERE data ~ '^\\d{4}-\\d{2}-\\d{2}$' AND data <= $2), 0) AS dadas,
           COALESCE(sum(horas) FILTER (WHERE data ~ '^\\d{4}-\\d{2}-\\d{2}$' AND data > $2), 0) AS pendentes,
           min(data) FILTER (WHERE data ~ '^\\d{4}-\\d{2}-\\d{2}$' AND data >= $2) AS proxima
      FROM sf WHERE regime = $1 GROUP BY nome
  ),
  tur AS (
    SELECT m.nome, count(DISTINCT m.turma_id)::int AS turmas,
           count(DISTINCT m.turma_id) FILTER (WHERE EXISTS (
             SELECT 1 FROM sf WHERE sf.regime = m.regime AND sf.turma_id = m.turma_id AND sf.data >= $2
           ))::int AS turmas_ativas
      FROM membros m WHERE m.regime = $1 GROUP BY m.nome
  )
  SELECT fm.id, fm.nome, fm.telf, fm.email, fm.especialidade, fm.ccp, fm.ccp_validade, fm.nif, fm.regimes, fm.estado,
         fm.disponibilidade, fm.custo_hora, fm.user_id,
         COALESCE(tur.turmas, 0) AS turmas, COALESCE(tur.turmas_ativas, 0) AS turmas_ativas,
         COALESCE(h.dadas, 0) AS horas_dadas, COALESCE(h.pendentes, 0) AS horas_pendentes, h.proxima,
         cardinality(${DOCS}) - (
           SELECT count(DISTINCT d.doc_id) FROM formador_docs d
            WHERE d.formador_id = fm.id AND d.uploaded AND d.doc_id = ANY(${DOCS})
         ) AS docs_em_falta,
         (fm.ccp_validade IS NOT NULL AND fm.ccp_validade <= $3::date) AS ccp_a_expirar,
         (fm.ccp_validade IS NOT NULL AND fm.ccp_validade < $2::date) AS ccp_expirado
    FROM formadores fm
    LEFT JOIN horas h ON h.nome = lower(trim(fm.nome))
    LEFT JOIN tur ON tur.nome = lower(trim(fm.nome))
   WHERE jsonb_exists(COALESCE(fm.regimes, '[]'::jsonb), $1)`;

function filtrar(f: FiltrosFormadores) {
  const w = new Filtros([f.regime, f.hoje, f.limiteCcp, JSON.stringify(f.docsObrigatorios)]);
  w.add("x.estado = ?", f.estado);
  w.add("x.especialidade = ?", f.especialidade);
  w.add("jsonb_exists(COALESCE(x.disponibilidade, '[]'::jsonb), ?)", f.disponibilidade);
  if (f.alerta === "docs") w.sempre("x.docs_em_falta > 0");
  if (f.alerta === "ccp") w.sempre("x.ccp_a_expirar");
  if (f.alerta === "com_turma") w.sempre("x.turmas_ativas > 0");
  if (f.alerta === "sem_turma") w.sempre("x.turmas_ativas = 0");
  const p = padraoPesquisa(f.q);
  if (p) w.add("(x.nome ILIKE ? OR x.email ILIKE ? OR x.telf ILIKE ? OR x.ccp ILIKE ? OR x.especialidade ILIKE ?)", p, p, p, p, p);
  return w;
}

const ORDEM: Record<string, string> = {
  nome: "lower(x.nome)",
  horas: "x.horas_dadas",
  turmas: "x.turmas_ativas",
  ccp: "x.ccp_validade",
  docs: "x.docs_em_falta",
};

export async function listarFormadores(c: Consulta, f: FiltrosFormadores, pag: { pagina: number; porPagina: number; ordem?: string }) {
  const w = filtrar(f);
  const ordem = ordenarPor(ORDEM, pag.ordem, "lower(x.nome)");
  const r = await paginar(c, `SELECT x.* FROM (${LISTA}) x ${w.where}`, w.params, { ...pag, ordem });
  return { ...r, linhas: r.linhas.map(mapLinha) };
}

/** KPIs do regime (sem os filtros de alerta, para servirem de atalhos). */
export async function kpisFormadores(c: Consulta, f: Pick<FiltrosFormadores, "regime" | "hoje" | "limiteCcp" | "docsObrigatorios">) {
  const r = await one<Record<string, unknown>>(c, `
    SELECT count(*) FILTER (WHERE x.estado = 'Ativo')::int AS ativos,
           count(*)::int AS total,
           count(*) FILTER (WHERE x.turmas_ativas > 0)::int AS com_turma,
           count(*) FILTER (WHERE x.docs_em_falta > 0)::int AS docs_em_falta,
           count(*) FILTER (WHERE x.ccp_a_expirar)::int AS ccp_a_expirar,
           COALESCE(sum(x.horas_dadas), 0) AS horas_dadas
      FROM (${LISTA}) x`, [f.regime, f.hoje, f.limiteCcp, JSON.stringify(f.docsObrigatorios)]);
  return {
    ativos: Number(r?.ativos ?? 0),
    total: Number(r?.total ?? 0),
    comTurma: Number(r?.com_turma ?? 0),
    docsEmFalta: Number(r?.docs_em_falta ?? 0),
    ccpAExpirar: Number(r?.ccp_a_expirar ?? 0),
    horasDadas: Math.round(Number(r?.horas_dadas ?? 0) * 10) / 10,
  };
}

export async function especialidades(c: Consulta, regime: Regime) {
  const r = await many<{ e: string }>(c, `SELECT DISTINCT trim(especialidade) AS e FROM formadores
     WHERE jsonb_exists(COALESCE(regimes, '[]'::jsonb), $1) AND trim(COALESCE(especialidade, '')) <> '' ORDER BY 1`, [regime]);
  return r.map(x => x.e);
}

const lista = (v: unknown) => (Array.isArray(v) ? v.map(String).filter(Boolean) : []);
/** Coluna `date` → aaaa-mm-dd (o driver devolve Date à meia-noite local). */
function dataIso(v: unknown) {
  if (!v) return "";
  if (v instanceof Date) {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
  }
  return String(v).slice(0, 10);
}
const h1 = (v: unknown) => Math.round(Number(v ?? 0) * 10) / 10;

export function mapFormadorBase(r: Record<string, unknown>) {
  return {
    id: Number(r.id),
    nome: String(r.nome ?? ""),
    telf: String(r.telf ?? ""),
    email: String(r.email ?? ""),
    especialidade: String(r.especialidade ?? ""),
    ccp: String(r.ccp ?? ""),
    ccpValidade: dataIso(r.ccp_validade),
    nif: String(r.nif ?? ""),
    regimes: lista(r.regimes) as Regime[],
    estado: String(r.estado ?? "Ativo") as "Ativo" | "Inactivo",
    disponibilidade: lista(r.disponibilidade),
    custoHora: Number(r.custo_hora ?? 0),
    temAcesso: Boolean(r.user_id),
  };
}

function mapLinha(r: Record<string, unknown>) {
  return {
    ...mapFormadorBase(r),
    turmas: Number(r.turmas ?? 0),
    turmasAtivas: Number(r.turmas_ativas ?? 0),
    horasDadas: h1(r.horas_dadas),
    horasPendentes: h1(r.horas_pendentes),
    proximaSessao: r.proxima ? String(r.proxima) : "",
    docsEmFalta: Math.max(Number(r.docs_em_falta ?? 0), 0),
    ccpAExpirar: Boolean(r.ccp_a_expirar),
    ccpExpirado: Boolean(r.ccp_expirado),
  };
}

// ─── Ficha ───────────────────────────────────────────────────────────────────

export async function obterFormador(c: Consulta, id: number) {
  return one(c, "SELECT * FROM formadores WHERE id = $1", [id]);
}

/** Turmas do formador nos dois regimes, com horas dadas/pendentes e valor por hora. */
export async function turmasDaFicha(c: Consulta, nome: string, hoje: string, custoHora: number) {
  const linhas = await many(c, `
    WITH ${SESSOES_FORMADOR},
    h AS (
      SELECT regime, turma_id,
             COALESCE(sum(horas) FILTER (WHERE data ~ '^\\d{4}-\\d{2}-\\d{2}$' AND data <= $2), 0) AS dadas,
             COALESCE(sum(horas) FILTER (WHERE NOT (data ~ '^\\d{4}-\\d{2}-\\d{2}$' AND data <= $2)), 0) AS pendentes,
             count(*)::int AS sessoes, min(data) FILTER (WHERE data <> '') AS inicio, max(data) FILTER (WHERE data <> '') AS fim
        FROM sf WHERE nome = $1 GROUP BY regime, turma_id
    ),
    t AS (
      SELECT 'gold'::text AS regime, id, nome, curso, formador, valores_hora_formador, fechada_em, data_inicio FROM turmas_gold
      UNION ALL
      SELECT 'fin', id, nome, curso, formador, valores_hora_formador, fechada_em, data_inicio FROM turmas_fin
    )
    SELECT t.regime, t.id, t.nome, t.curso, t.fechada_em, t.data_inicio,
           (lower(trim(COALESCE(t.formador, ''))) = $1) AS responsavel,
           COALESCE(h.dadas, 0) AS dadas, COALESCE(h.pendentes, 0) AS pendentes, COALESCE(h.sessoes, 0) AS sessoes,
           h.inicio, h.fim,
           (SELECT v.value FROM jsonb_each_text(COALESCE(t.valores_hora_formador, '{}'::jsonb)) v
             WHERE lower(trim(v.key)) = $1 LIMIT 1) AS valor_hora
      FROM t
      JOIN (SELECT DISTINCT regime, turma_id FROM membros WHERE nome = $1) m ON m.regime = t.regime AND m.turma_id = t.id
      LEFT JOIN h ON h.regime = t.regime AND h.turma_id = t.id
     ORDER BY COALESCE(h.inicio, t.data_inicio) DESC NULLS LAST`, [nome.trim().toLowerCase(), hoje]);
  return linhas.map(r => {
    const valorHora = r.valor_hora != null && r.valor_hora !== "" ? Number(r.valor_hora) : custoHora;
    const dadas = h1(r.dadas);
    return {
      regime: String(r.regime) as Regime,
      id: Number(r.id),
      nome: String(r.nome ?? ""),
      curso: String(r.curso ?? ""),
      responsavel: Boolean(r.responsavel),
      fechada: Boolean(r.fechada_em),
      inicio: String(r.inicio ?? r.data_inicio ?? ""),
      fim: String(r.fim ?? ""),
      sessoes: Number(r.sessoes ?? 0),
      horasDadas: dadas,
      horasPendentes: h1(r.pendentes),
      valorHora,
      valorDado: Math.round(dadas * valorHora * 100) / 100,
    };
  });
}

/** Ficha ligada a esta conta (pelo utilizador ou pelo email). */
export async function formadorDaConta(c: Consulta, userId: string, email: string) {
  return one<{ id: number }>(c, `SELECT id FROM formadores
     WHERE user_id::text = $1 OR ($2 <> '' AND lower(email) = lower($2))
     ORDER BY (user_id::text = $1) DESC LIMIT 1`, [userId, email.trim()]);
}

/** Sessões lectivas datadas do formador a partir de `desde` (as primeiras `limite`). */
export async function proximasSessoes(c: Consulta, nome: string, hoje: string, limite = 8) {
  const linhas = await many(c, `
    WITH ${SESSOES_FORMADOR}
    SELECT regime, turma_id, turma, curso, data, hora_inicio, hora_fim, horas
      FROM sf
     WHERE nome = $1 AND data ~ '^\\d{4}-\\d{2}-\\d{2}$' AND data >= $2
     ORDER BY data, hora_inicio
     LIMIT $3`, [nome.trim().toLowerCase(), hoje, limite]);
  return linhas.map(r => ({
    regime: String(r.regime) as Regime,
    turmaId: Number(r.turma_id),
    turma: String(r.turma ?? ""),
    curso: String(r.curso ?? ""),
    data: String(r.data ?? ""),
    horaInicio: String(r.hora_inicio ?? ""),
    horaFim: String(r.hora_fim ?? ""),
    horas: h1(r.horas),
  }));
}

/** Sessões presenciais ou síncronas do formador entre duas datas (inclusive): os horários em que está ocupado. */
export async function ocupacaoFormador(c: Consulta, nome: string, de: string, ate: string) {
  const linhas = await many(c, `
    WITH ${SESSOES_FORMADOR}
    SELECT DISTINCT regime, turma_id, turma, data, hora_inicio, hora_fim
      FROM sf
     WHERE nome = $1 AND data ~ '^\\d{4}-\\d{2}-\\d{2}$' AND data >= $2 AND data <= $3
     ORDER BY data, hora_inicio`, [nome.trim().toLowerCase(), de, ate]);
  return linhas.map(r => ({
    regime: String(r.regime) as Regime,
    turmaId: Number(r.turma_id),
    turma: String(r.turma ?? ""),
    data: String(r.data ?? ""),
    horaInicio: String(r.hora_inicio ?? ""),
    horaFim: String(r.hora_fim ?? ""),
  }));
}

export async function acessoDoFormador(c: Consulta, userId: string | null) {
  if (!userId) return null;
  const r = await one(c, `SELECT u.email, u.active, u.must_change_password,
       (SELECT max(s.created_at) FROM sessions s WHERE s.user_id = u.id) AS ultimo_acesso
     FROM users u WHERE u.id = $1`, [userId]);
  if (!r) return null;
  return {
    email: String(r.email ?? ""),
    ativo: Boolean(r.active),
    porTrocarPalavraPasse: Boolean(r.must_change_password),
    ultimoAcesso: r.ultimo_acesso ? String(r.ultimo_acesso instanceof Date ? r.ultimo_acesso.toISOString() : r.ultimo_acesso) : "",
  };
}

// ─── Documentos ──────────────────────────────────────────────────────────────

export async function docsDoFormador(c: Consulta, id: number) {
  const r = await many(c, `SELECT doc_id, uploaded, file_name, drive_file_id, drive_url, updated_at
     FROM formador_docs WHERE formador_id = $1`, [id]);
  return r.map(d => ({
    id: String(d.doc_id),
    uploaded: Boolean(d.uploaded),
    fileName: String(d.file_name ?? ""),
    driveFileId: String(d.drive_file_id ?? ""),
    driveUrl: String(d.drive_url ?? ""),
    atualizadoEm: d.updated_at ? String(d.updated_at instanceof Date ? d.updated_at.toISOString() : d.updated_at) : "",
  }));
}

export async function gravarDocFormador(c: Consulta, id: number, doc: { id: string; uploaded: boolean; fileName: string; driveFileId?: string; driveUrl?: string }) {
  await valor(c, `INSERT INTO formador_docs (formador_id, doc_id, uploaded, file_name, drive_file_id, drive_url)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (formador_id, doc_id) DO UPDATE SET
       uploaded = EXCLUDED.uploaded, file_name = EXCLUDED.file_name,
       drive_file_id = EXCLUDED.drive_file_id, drive_url = EXCLUDED.drive_url, updated_at = now()
     RETURNING formador_id`,
  [id, doc.id, doc.uploaded, doc.fileName, doc.driveFileId ?? "", doc.driveUrl ?? ""]);
}

// ─── Escrita ─────────────────────────────────────────────────────────────────

export type DadosFormador = {
  nome: string; telf: string; email: string; especialidade: string; ccp: string; ccpValidade: string | null; nif: string;
  regimes: Regime[]; estado: "Ativo" | "Inactivo"; disponibilidade: string[]; custoHora: number;
};

export async function inserirFormador(c: Consulta, id: number, d: DadosFormador) {
  await valor(c, `INSERT INTO formadores (id, nome, telf, email, especialidade, ccp, ccp_validade, nif, regimes, estado, disponibilidade, custo_hora)
     VALUES ($1,$2,$3,$4,$5,$6,$7::date,$8,$9::jsonb,$10,$11::jsonb,$12) RETURNING id`,
  [id, d.nome, d.telf, d.email, d.especialidade, d.ccp, d.ccpValidade || null, d.nif, JSON.stringify(d.regimes), d.estado, JSON.stringify(d.disponibilidade), d.custoHora]);
}

export async function atualizarFormador(c: Consulta, id: number, d: Partial<DadosFormador>) {
  const validade = d.ccpValidade === undefined ? null : (d.ccpValidade || "");
  await valor(c, `UPDATE formadores SET nome = COALESCE($2, nome), telf = COALESCE($3, telf), email = COALESCE($4, email),
       especialidade = COALESCE($5, especialidade), ccp = COALESCE($6, ccp), nif = COALESCE($7, nif),
       regimes = COALESCE($8::jsonb, regimes), estado = COALESCE($9, estado),
       disponibilidade = COALESCE($10::jsonb, disponibilidade), custo_hora = COALESCE($11, custo_hora),
       ccp_validade = CASE WHEN $12::text IS NULL THEN ccp_validade WHEN $12::text = '' THEN NULL ELSE $12::date END
     WHERE id = $1 RETURNING id`,
  [id, d.nome ?? null, d.telf ?? null, d.email ?? null, d.especialidade ?? null, d.ccp ?? null, d.nif ?? null,
    d.regimes ? JSON.stringify(d.regimes) : null, d.estado ?? null, d.disponibilidade ? JSON.stringify(d.disponibilidade) : null,
    d.custoHora ?? null, validade]);
}

export async function ligarConta(c: Consulta, id: number, userId: string) {
  await valor(c, "UPDATE formadores SET user_id = $2 WHERE id = $1 RETURNING id", [id, userId]);
}

export async function apagarFormador(c: Consulta, id: number) {
  await valor(c, "DELETE FROM formadores WHERE id = $1 RETURNING id", [id]);
}

/** O formador dá aulas em alguma turma (responsável, equipa ou sessão)? */
export async function estaAlocado(c: Consulta, nome: string) {
  const n = nome.trim().toLowerCase();
  if (!n) return false;
  const r = await valor(c, `WITH ${SESSOES_FORMADOR} SELECT 1 FROM membros WHERE nome = $1 LIMIT 1`, [n]);
  return r != null;
}

/** Disponibilidade gravada dos formadores com estes nomes (minúsculas). */
export async function disponibilidades(c: Consulta, nomes: string[]) {
  return many<{ nome: string; disponibilidade: unknown }>(c,
    "SELECT nome, disponibilidade FROM formadores WHERE lower(nome) IN (SELECT jsonb_array_elements_text($1::jsonb))", [JSON.stringify(nomes.map(n => n.toLowerCase()))]);
}

// ─── Contas de acesso ───────────────────────────────────────────────────────

export async function utilizadorPorEmail(c: Consulta, email: string) {
  return one<{ id: string }>(c, "SELECT id FROM users WHERE lower(email) = $1", [email]);
}

export async function inserirUtilizadorFormador(c: Consulta, d: { id: string; nome: string; email: string; hash: string }) {
  await valor(c, `INSERT INTO users (id, name, email, password_hash, role, active, must_change_password)
     VALUES ($1,$2,$3,$4,'formador',true,true) RETURNING id`, [d.id, d.nome, d.email, d.hash]);
}
