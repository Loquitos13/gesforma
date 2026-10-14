/**
 * Turmas Gold e Financiada: lista com ocupação, sessões e documentos (tudo em SQL) e escrita.
 * O interior da turma (cockpit, sessões, avaliação, dossiê) vive noutros repositórios.
 */
import { many, one, ordenarPor, paginar, tabelaRegime, valor, Filtros, padraoPesquisa, type Consulta, type Regime } from "./sql.js";
import { sqlOcupa, sqlReservas } from "./inscricao.js";

export type FaseTurma = "abrir" | "decorrer" | "por_fechar" | "fechada" | "cancelada";

const COL = {
  gold: {
    capacidade: "t.vagas",
    inscricoes: "(t.estado = 'Ativa')",
    ufcd: "''",
    financiador: "''",
    fechada: "t.fechada_em IS NOT NULL",
    cancelada: "false",
  },
  fin: {
    capacidade: "t.alunos_total",
    inscricoes: "COALESCE(t.activa, false)",
    ufcd: "t.ufcd_cod",
    financiador: "t.financiador",
    fechada: "(t.fechada_em IS NOT NULL OR t.estado = 'Concluída')",
    cancelada: "(t.estado = 'Cancelada')",
  },
} as const;

/** Lista de ids (JSON em texto, para os dois drivers) como text[]. */
const lista = (p: string) => `ARRAY(SELECT jsonb_array_elements_text(${p}::jsonb))`;
const DOCS = lista("$3");

/** Uma sessão lectiva é presencial ou síncrona (a mesma regra de sessaoAcesso.ts). */
const SESSOES_LECTIVAS = `
  SELECT e.val->>'data' AS data,
         row_number() OVER (ORDER BY e.ord) AS n
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(t.cronograma) = 'array' THEN t.cronograma ELSE '[]'::jsonb END)
         WITH ORDINALITY AS e(val, ord)
   WHERE COALESCE(e.val->>'modalidade', 'presencial') IN ('presencial', 'sincrona')`;

/** Data ISO do início (as turmas antigas podem ter texto livre). */
const INICIO = "CASE WHEN left(COALESCE(t.data_inicio, ''), 10) ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN left(t.data_inicio, 10) END";

/**
 * SELECT de uma turma com os números da lista. Parâmetros fixos:
 * $1 regime, $2 hoje (aaaa-mm-dd), $3 documentos obrigatórios do regime (text[]).
 */
function sqlBase(regime: Regime) {
  const c = COL[regime];
  const turmas = tabelaRegime("turmas", regime);
  const formandos = tabelaRegime("formandos", regime);
  return `
    SELECT t.id, t.nome, t.curso, t.curso_id, t.local, t.horario, ${INICIO} AS data_inicio,
           t.data_inicio AS data_inicio_texto, t.horas, t.formador, t.formadores, t.estado,
           ${c.capacidade} AS capacidade, COALESCE(t.tolerancia_vagas, 0) AS tolerancia,
           ${c.inscricoes} AS inscricoes_abertas, ${c.ufcd} AS ufcd, ${c.financiador} AS financiador,
           t.fechada_em, t.drive_pasta_id,
           fo.inscritos, fo.docs_em_falta, fo.docs_completos,
           ${sqlReservas(regime, "t.id")} AS reservas,
           se.sessoes, se.realizadas, se.sumarios_em_falta, se.data_fim,
           CASE
             WHEN ${c.fechada} THEN 'fechada'
             WHEN ${c.cancelada} THEN 'cancelada'
             WHEN ${INICIO} > $2 THEN 'abrir'
             WHEN se.data_fim IS NOT NULL AND se.data_fim < $2 THEN 'por_fechar'
             WHEN ${INICIO} <= $2 THEN 'decorrer'
             ELSE 'abrir'
           END AS fase
      FROM ${turmas} t
      LEFT JOIN LATERAL (
        SELECT count(*)::int AS inscritos,
               COALESCE(sum(cardinality(${DOCS}) - d.ok), 0)::int AS docs_em_falta,
               count(*) FILTER (WHERE d.ok >= cardinality(${DOCS}))::int AS docs_completos
          FROM ${formandos} f
          LEFT JOIN LATERAL (
            SELECT count(DISTINCT fd.doc_id)::int AS ok
              FROM formando_docs fd
             WHERE fd.regime = $1 AND fd.formando_id = f.id AND fd.ok AND fd.doc_id = ANY(${DOCS})
          ) d ON true
         WHERE f.turma_id = t.id AND ${sqlOcupa("f")}
      ) fo ON true
      LEFT JOIN LATERAL (
        SELECT count(*)::int AS sessoes,
               max(s.data) FILTER (WHERE s.data ~ '^\\d{4}-\\d{2}-\\d{2}$') AS data_fim,
               count(*) FILTER (WHERE s.data ~ '^\\d{4}-\\d{2}-\\d{2}$' AND s.data <= $2)::int AS realizadas,
               count(*) FILTER (
                 WHERE s.data ~ '^\\d{4}-\\d{2}-\\d{2}$' AND s.data <= $2
                   AND COALESCE(ts.sumario->>'assinado', 'false') <> 'true'
               )::int AS sumarios_em_falta
          FROM (${SESSOES_LECTIVAS}) s
          LEFT JOIN turma_sessoes ts ON ts.regime = $1 AND ts.turma_id = t.id AND ts.sessao_n = s.n
      ) se ON true`;
}

/** Condição "o formador X dá aulas nesta turma" (responsável, equipa ou alguma sessão). */
function sqlTemFormador(param: string) {
  return `(lower(trim(COALESCE(x.formador, ''))) = ANY(${param})
    OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(x.formadores) = 'array' THEN x.formadores ELSE '[]'::jsonb END) e WHERE lower(trim(e)) = ANY(${param}))
    OR EXISTS (
      SELECT 1 FROM ${"%TURMAS%"} tt,
             jsonb_array_elements(CASE WHEN jsonb_typeof(tt.cronograma) = 'array' THEN tt.cronograma ELSE '[]'::jsonb END) s
       WHERE tt.id = x.id
         AND (lower(trim(COALESCE(s->>'formador', ''))) = ANY(${param})
           OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(s->'formadores') = 'array' THEN s->'formadores' ELSE '[]'::jsonb END) fs
                       WHERE lower(trim(fs)) = ANY(${param})))))`;
}

export type FiltrosTurmas = {
  regime: Regime;
  hoje: string;
  docsObrigatorios: string[];
  fase?: FaseTurma;
  curso?: string;
  local?: string;
  horario?: string;
  formador?: string;
  financiador?: string;
  de?: string;
  ate?: string;
  q?: string;
  /** Só as turmas destes formadores (perfil formador). Nomes em minúsculas. */
  apenasFormadores?: string[];
};

function filtrar(f: FiltrosTurmas, comFase: boolean) {
  const w = new Filtros([f.regime, f.hoje, JSON.stringify(f.docsObrigatorios)]);
  const turmas = tabelaRegime("turmas", f.regime);
  if (comFase) w.add("x.fase = ?", f.fase);
  w.add("x.curso = ?", f.curso);
  w.add("x.local = ?", f.local);
  w.add("x.horario = ?", f.horario);
  w.add("x.financiador = ?", f.financiador);
  w.add("x.data_inicio >= ?", f.de);
  w.add("x.data_inicio <= ?", f.ate);
  if (f.formador) {
    w.params.push(JSON.stringify([f.formador.trim().toLowerCase()]));
    w.sempre(sqlTemFormador(lista(`$${w.params.length}`)).replace("%TURMAS%", turmas));
  }
  if (f.apenasFormadores) {
    w.params.push(JSON.stringify(f.apenasFormadores));
    w.sempre(sqlTemFormador(lista(`$${w.params.length}`)).replace("%TURMAS%", turmas));
  }
  const p = padraoPesquisa(f.q);
  if (p) w.add("(x.nome ILIKE ? OR x.curso ILIKE ? OR x.formador ILIKE ? OR x.local ILIKE ? OR x.ufcd ILIKE ?)", p, p, p, p, p);
  return w;
}

const ORDEM: Record<string, string> = {
  inicio: "x.data_inicio",
  nome: "lower(x.nome)",
  curso: "lower(x.curso)",
  ocupacao: "(x.inscritos + x.reservas)::numeric / NULLIF(x.capacidade, 0)",
  fase: "x.fase",
};

export type LinhaTurma = Awaited<ReturnType<typeof listarTurmas>>["linhas"][number];

export async function listarTurmas(c: Consulta, f: FiltrosTurmas, pag: { pagina: number; porPagina: number; ordem?: string }) {
  const w = filtrar(f, true);
  const ordem = ordenarPor(ORDEM, pag.ordem, "x.data_inicio DESC NULLS LAST, x.id DESC");
  const r = await paginar(c, `SELECT x.* FROM (${sqlBase(f.regime)}) x ${w.where}`, w.params, { ...pag, ordem });
  return { ...r, linhas: r.linhas.map(mapLinha) };
}

/** Contagens por fase (para os separadores) e números do cabeçalho, com os mesmos filtros sem a fase. */
export async function resumoTurmas(c: Consulta, f: FiltrosTurmas) {
  const w = filtrar(f, false);
  const linhas = await many<{ fase: string; n: number; livres: number; abertas: number; inscritos: number }>(c, `
    SELECT x.fase, count(*)::int AS n,
           COALESCE(sum(GREATEST(x.capacidade + x.tolerancia - x.inscritos - x.reservas, 0)) FILTER (WHERE x.fase IN ('abrir', 'decorrer')), 0)::int AS livres,
           count(*) FILTER (WHERE x.inscricoes_abertas AND x.fase IN ('abrir', 'decorrer'))::int AS abertas,
           COALESCE(sum(x.inscritos), 0)::int AS inscritos
      FROM (${sqlBase(f.regime)}) x ${w.where}
     GROUP BY x.fase`, w.params);
  const porFase: Record<string, number> = {};
  let livres = 0, abertas = 0, inscritos = 0;
  for (const l of linhas) {
    porFase[l.fase] = Number(l.n);
    livres += Number(l.livres);
    abertas += Number(l.abertas);
    inscritos += Number(l.inscritos);
  }
  const total = Object.values(porFase).reduce((s, n) => s + n, 0);
  return { total, porFase, vagasLivres: livres, inscricoesAbertas: abertas, inscritos };
}

function mapLinha(r: Record<string, unknown>) {
  const capacidade = Number(r.capacidade ?? 0);
  const tolerancia = Number(r.tolerancia ?? 0);
  const inscritos = Number(r.inscritos ?? 0);
  const reservas = Number(r.reservas ?? 0);
  return {
    id: Number(r.id),
    nome: String(r.nome ?? ""),
    curso: String(r.curso ?? ""),
    cursoId: r.curso_id == null ? null : Number(r.curso_id),
    local: String(r.local ?? ""),
    horario: String(r.horario ?? ""),
    dataInicio: r.data_inicio ? String(r.data_inicio) : String(r.data_inicio_texto ?? ""),
    dataFim: r.data_fim ? String(r.data_fim) : "",
    horas: Number(r.horas ?? 0),
    formador: String(r.formador ?? ""),
    formadores: Array.isArray(r.formadores) ? r.formadores.map(String).filter(Boolean) : [],
    estado: String(r.estado ?? ""),
    fase: String(r.fase) as FaseTurma,
    inscricoesAbertas: Boolean(r.inscricoes_abertas),
    capacidade,
    tolerancia,
    inscritos,
    reservas,
    livres: Math.max(capacidade + tolerancia - inscritos - reservas, 0),
    sessoes: Number(r.sessoes ?? 0),
    realizadas: Number(r.realizadas ?? 0),
    sumariosEmFalta: Number(r.sumarios_em_falta ?? 0),
    docsEmFalta: Number(r.docs_em_falta ?? 0),
    docsCompletos: Number(r.docs_completos ?? 0),
    ufcd: String(r.ufcd ?? ""),
    financiador: String(r.financiador ?? ""),
    fechadaEm: r.fechada_em ? String(r.fechada_em) : "",
  };
}

// ─── Leitura de uma turma e verificações ────────────────────────────────────

export async function obterTurma(c: Consulta, regime: Regime, id: number) {
  return one(c, `SELECT * FROM ${tabelaRegime("turmas", regime)} WHERE id = $1`, [id]);
}

export async function existeNome(c: Consulta, regime: Regime, nome: string, excetoId: number | null) {
  const r = await one(c, `SELECT id FROM ${tabelaRegime("turmas", regime)}
     WHERE lower(trim(nome)) = lower(trim($1)) AND ($2::int IS NULL OR id <> $2::int) LIMIT 1`, [nome, excetoId]);
  return Boolean(r);
}

export async function existeTurmaIgual(c: Consulta, regime: Regime, d: { curso: string; local: string; horario: string; dataInicio: string }) {
  const r = await one(c, `SELECT id FROM ${tabelaRegime("turmas", regime)}
     WHERE curso = $1 AND local = $2 AND horario = $3 AND data_inicio = $4 LIMIT 1`, [d.curso, d.local, d.horario, d.dataInicio]);
  return Boolean(r);
}

/** Horas e código UFCD do curso com este nome (para as turmas novas). */
export async function dadosDoCurso(c: Consulta, regime: Regime, nome: string) {
  const r = regime === "gold"
    ? await one(c, "SELECT horas, '' AS ufcd FROM cursos_gold WHERE lower(trim(nome)) = lower(trim($1)) LIMIT 1", [nome])
    : await one(c, `SELECT horas, ufcd_cod AS ufcd FROM cursos_fin
        WHERE lower(trim(nome_comercial)) = lower(trim($1)) OR lower(trim(ufcd)) = lower(trim($1)) OR lower(trim(ufcd_cod)) = lower(trim($1)) LIMIT 1`, [nome]);
  return r ? { horas: Number(r.horas ?? 0), ufcd: String(r.ufcd ?? "") } : null;
}

/** Liga a turma ao curso pelo id (o nome continua a ser mostrado e propagado). */
export async function ligarCurso(c: Consulta, regime: Regime, turmaId: number) {
  if (regime === "gold") {
    await valor(c, `UPDATE turmas_gold t SET curso_id = c.id FROM cursos_gold c
       WHERE t.id = $1 AND lower(trim(c.nome)) = lower(trim(t.curso)) RETURNING t.id`, [turmaId]);
  } else {
    await valor(c, `UPDATE turmas_fin t SET curso_id = c.id FROM cursos_fin c
       WHERE t.id = $1 AND (lower(trim(c.nome_comercial)) = lower(trim(t.curso)) OR lower(trim(c.ufcd)) = lower(trim(t.curso))) RETURNING t.id`, [turmaId]);
  }
}

// ─── Escrita ─────────────────────────────────────────────────────────────────

export type NovaTurmaGold = {
  dataInicio: string; nome: string; curso: string; local: string; horario: string; vagas: number; tolerancia: number;
  estado: string; formador: string; formadores: string[]; horas: number; cronograma: unknown[]; custoHoraSala: number;
  valoresHoraFormador: Record<string, number>;
};

export async function inserirTurmaGold(c: Consulta, id: number, d: NovaTurmaGold) {
  await valor(c, `INSERT INTO turmas_gold (id, data_inicio, nome, curso, local, horario, total_alunos, vagas, tolerancia_vagas, estado, formador, formadores, horas, cronograma, custo_hora_sala, valores_hora_formador)
     VALUES ($1,$2,$3,$4,$5,$6,0,$7,$8,$9,$10,$11::jsonb,$12,$13::jsonb,$14,$15::jsonb) RETURNING id`,
  [id, d.dataInicio, d.nome, d.curso, d.local, d.horario, d.vagas, d.tolerancia, d.estado, d.formador, JSON.stringify(d.formadores), d.horas, JSON.stringify(d.cronograma), d.custoHoraSala, JSON.stringify(d.valoresHoraFormador)]);
}

export type NovaTurmaFin = {
  dataInicio: string; nome: string; curso: string; ufcdCod: string; local: string; horario: string; alunosTotal: number;
  tolerancia: number; estado: string; horas: number; formador: string; formadores: string[]; activa: boolean;
  cronograma: unknown[]; valoresHoraFormador: Record<string, number>; financiador: string;
};

export async function inserirTurmaFin(c: Consulta, id: number, d: NovaTurmaFin) {
  await valor(c, `INSERT INTO turmas_fin (id, data_inicio, nome, curso, ufcd_cod, local, horario, alunos, alunos_total, tolerancia_vagas, estado, horas, formador, formadores, activa, cronograma, valores_hora_formador, financiador)
     VALUES ($1,$2,$3,$4,$5,$6,$7,0,$8,$9,$10,$11,$12,$13::jsonb,$14,$15::jsonb,$16::jsonb,$17) RETURNING id`,
  [id, d.dataInicio, d.nome, d.curso, d.ufcdCod, d.local, d.horario, d.alunosTotal, d.tolerancia, d.estado, d.horas, d.formador, JSON.stringify(d.formadores), d.activa, JSON.stringify(d.cronograma), JSON.stringify(d.valoresHoraFormador), d.financiador]);
}

const json = (v: unknown) => (v === undefined || v === null ? null : JSON.stringify(v));

export async function atualizarTurmaGold(c: Consulta, id: number, d: Partial<NovaTurmaGold>) {
  await valor(c, `UPDATE turmas_gold SET data_inicio = COALESCE($2, data_inicio), nome = COALESCE($3, nome), curso = COALESCE($4, curso),
       local = COALESCE($5, local), horario = COALESCE($6, horario), vagas = COALESCE($7, vagas),
       tolerancia_vagas = COALESCE($8, tolerancia_vagas), estado = COALESCE($9, estado), formador = COALESCE($10, formador),
       formadores = COALESCE($11::jsonb, formadores), horas = COALESCE($12, horas), cronograma = COALESCE($13::jsonb, cronograma),
       custo_hora_sala = COALESCE($14, custo_hora_sala), valores_hora_formador = COALESCE($15::jsonb, valores_hora_formador)
     WHERE id = $1 RETURNING id`,
  [id, d.dataInicio ?? null, d.nome ?? null, d.curso ?? null, d.local ?? null, d.horario ?? null, d.vagas ?? null, d.tolerancia ?? null,
    d.estado ?? null, d.formador ?? null, json(d.formadores), d.horas ?? null, json(d.cronograma), d.custoHoraSala ?? null, json(d.valoresHoraFormador)]);
}

export async function atualizarTurmaFin(c: Consulta, id: number, d: Partial<NovaTurmaFin>) {
  await valor(c, `UPDATE turmas_fin SET data_inicio = COALESCE($2, data_inicio), nome = COALESCE($3, nome), curso = COALESCE($4, curso),
       ufcd_cod = COALESCE($5, ufcd_cod), local = COALESCE($6, local), horario = COALESCE($7, horario),
       alunos_total = COALESCE($8, alunos_total), tolerancia_vagas = COALESCE($9, tolerancia_vagas), estado = COALESCE($10, estado),
       horas = COALESCE($11, horas), formador = COALESCE($12, formador), formadores = COALESCE($13::jsonb, formadores),
       activa = COALESCE($14, activa), cronograma = COALESCE($15::jsonb, cronograma),
       valores_hora_formador = COALESCE($16::jsonb, valores_hora_formador), financiador = COALESCE($17, financiador)
     WHERE id = $1 RETURNING id`,
  [id, d.dataInicio ?? null, d.nome ?? null, d.curso ?? null, d.ufcdCod ?? null, d.local ?? null, d.horario ?? null, d.alunosTotal ?? null,
    d.tolerancia ?? null, d.estado ?? null, d.horas ?? null, d.formador ?? null, json(d.formadores), d.activa ?? null, json(d.cronograma),
    json(d.valoresHoraFormador), d.financiador ?? null]);
}

export async function apagarTurma(c: Consulta, regime: Regime, id: number) {
  await valor(c, `DELETE FROM ${tabelaRegime("turmas", regime)} WHERE id = $1 RETURNING id`, [id]);
}

/** Inscritos que ocupam vaga (para não baixar a capacidade abaixo deles). */
export async function contarOcupantes(c: Consulta, regime: Regime, turmaId: number) {
  const n = await valor<number>(c, `SELECT count(*)::int FROM ${tabelaRegime("formandos", regime)} f WHERE f.turma_id = $1 AND ${sqlOcupa("f")}`, [turmaId]);
  return Number(n ?? 0);
}

// ─── Regras de abertura automática de turmas ────────────────────────────────

export async function listarRegras(c: Consulta, regime?: Regime) {
  return regime
    ? many(c, "SELECT * FROM turma_regras WHERE regime = $1 ORDER BY id", [regime])
    : many(c, "SELECT * FROM turma_regras ORDER BY regime, id");
}

export type DadosRegra = {
  regime: Regime; curso: string; local: string; horario: string; vagas: number; horas: number; horasSessao: number;
  formador: string; proximaData: string; nomePrefixo: string; activa: boolean;
};

export async function inserirRegra(c: Consulta, d: DadosRegra) {
  return valor<number>(c, `INSERT INTO turma_regras (regime, curso, local, horario, vagas, horas, horas_sessao, formador, proxima_data, nome_prefixo, activa)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
  [d.regime, d.curso, d.local, d.horario, d.vagas, d.horas, d.horasSessao, d.formador, d.proximaData, d.nomePrefixo, d.activa]);
}

export async function atualizarRegra(c: Consulta, id: number, d: Partial<DadosRegra>) {
  await valor(c, `UPDATE turma_regras SET curso = COALESCE($2, curso), local = COALESCE($3, local), horario = COALESCE($4, horario),
       vagas = COALESCE($5, vagas), horas = COALESCE($6, horas), horas_sessao = COALESCE($7, horas_sessao),
       formador = COALESCE($8, formador), proxima_data = COALESCE($9, proxima_data),
       nome_prefixo = COALESCE($10, nome_prefixo), activa = COALESCE($11, activa)
     WHERE id = $1 RETURNING id`,
  [id, d.curso ?? null, d.local ?? null, d.horario ?? null, d.vagas ?? null, d.horas ?? null, d.horasSessao ?? null,
    d.formador ?? null, d.proximaData ?? null, d.nomePrefixo ?? null, d.activa ?? null]);
}

export async function apagarRegra(c: Consulta, id: number) {
  await valor(c, "DELETE FROM turma_regras WHERE id = $1 RETURNING id", [id]);
}
