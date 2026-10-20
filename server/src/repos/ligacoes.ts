/**
 * SQL das ligações por nome entre tabelas (curso, formador, turma, cliente):
 * propagar um nome novo, contar o que ainda usa um registo e ler os candidatos da reparação.
 */
import { many, one, valor, type Consulta, type Regime } from "./sql.js";

/** Tabelas/colunas que guardam o nome do curso em texto. Lista fixa: nunca vem do pedido. */
const CURSO_COLS = [
  ["turmas_gold", "curso"],
  ["turmas_fin", "curso"],
  ["formandos_gold", "curso"],
  ["formandos_fin", "curso"],
  ["preinscricoes", "curso"],
  ["pagamentos", "curso"],
  ["campanhas", "curso"],
  ["propostas_comerciais", "curso"],
  ["contratos_comerciais", "curso"],
  ["email_rules", "curso"],
] as const;

const TURMAS = { gold: "turmas_gold", fin: "turmas_fin" } as const;
const FORMANDOS = { gold: "formandos_gold", fin: "formandos_fin" } as const;

async function contar(c: Consulta, sql: string, params: unknown[]) {
  return Number((await valor<number>(c, sql, params)) ?? 0);
}

export async function renomearCursoEmTodo(c: Consulta, antigo: string, novo: string) {
  for (const [table, col] of CURSO_COLS) {
    await many(c,
      `UPDATE ${table} SET ${col} = $2 WHERE lower(trim(${col})) = lower(trim($1)) AND ${col} IS DISTINCT FROM $2`,
      [antigo, novo]);
  }
  await many(c,
    `UPDATE catalog_items
        SET payload = jsonb_set(payload, '{curso}', to_jsonb($2::text), true)
      WHERE jsonb_typeof(payload) = 'object'
        AND lower(trim(coalesce(payload->>'curso', ''))) = lower(trim($1))
        AND payload->>'curso' IS DISTINCT FROM $2`,
    [antigo, novo]);
}

/**
 * Renomear um curso só no seu regime (Gold e Financiada nunca se misturam): tabelas do regime,
 * linhas com coluna `regime` desse regime e itens de catálogo desse regime. As tabelas sem regime
 * (pagamentos, campanhas, regras de email, contratos sem formando) só mudam quando o nome antigo
 * não é também de um curso do outro regime — aí não se sabe a quem pertencem e ficam como estão.
 */
export async function renomearCursoNoRegime(c: Consulta, regime: Regime, antigo: string, novo: string) {
  const onde = (col: string, extra = "") =>
    `WHERE lower(trim(${col})) = lower(trim($1)) AND ${col} IS DISTINCT FROM $2${extra}`;
  for (const table of [TURMAS[regime], FORMANDOS[regime]]) {
    await many(c, `UPDATE ${table} SET curso = $2 ${onde("curso")}`, [antigo, novo]);
  }
  for (const table of ["preinscricoes", "propostas_comerciais"]) {
    await many(c, `UPDATE ${table} SET curso = $2 ${onde("curso", " AND regime = $3")}`, [antigo, novo, regime]);
  }
  await many(c, `UPDATE contratos_comerciais SET curso = $2 ${onde("curso", " AND formando_regime = $3")}`, [antigo, novo, regime]);
  const doOutro = await contar(c,
    regime === "gold"
      ? "SELECT count(*)::int FROM cursos_fin WHERE lower(trim($1)) IN (lower(trim(nome_comercial)), lower(trim(ufcd)))"
      : "SELECT count(*)::int FROM cursos_gold WHERE lower(trim(nome)) = lower(trim($1))",
    [antigo]);
  if (!doOutro) {
    for (const table of ["pagamentos", "campanhas", "email_rules"]) {
      await many(c, `UPDATE ${table} SET curso = $2 ${onde("curso")}`, [antigo, novo]);
    }
    await many(c, `UPDATE contratos_comerciais SET curso = $2 ${onde("curso", " AND formando_regime IS NULL")}`, [antigo, novo]);
  }
  await many(c,
    `UPDATE catalog_items
        SET payload = jsonb_set(payload, '{curso}', to_jsonb($2::text), true)
      WHERE regime = $3
        AND jsonb_typeof(payload) = 'object'
        AND lower(trim(coalesce(payload->>'curso', ''))) = lower(trim($1))
        AND payload->>'curso' IS DISTINCT FROM $2`,
    [antigo, novo, regime]);
}

export async function renomearFormadorNasTurmas(c: Consulta, antigo: string, novo: string) {
  for (const table of [TURMAS.gold, TURMAS.fin]) {
    await many(c, `UPDATE ${table} SET formador = $2 WHERE lower(trim(formador)) = lower(trim($1))`, [antigo, novo]);
    // O valor por hora do formador na turma (chave = nome) segue o nome novo.
    await many(c,
      `UPDATE ${table} SET valores_hora_formador = (
         SELECT COALESCE(jsonb_object_agg(CASE WHEN lower(trim(v.key)) = lower(trim($1)) THEN $2::text ELSE v.key END, v.value), '{}'::jsonb)
           FROM jsonb_each(valores_hora_formador) v
       )
       WHERE jsonb_typeof(valores_hora_formador) = 'object'
         AND EXISTS (SELECT 1 FROM jsonb_object_keys(valores_hora_formador) k WHERE lower(trim(k)) = lower(trim($1)))`,
      [antigo, novo]);
    await many(c,
      `UPDATE ${table} SET formadores = (
         SELECT COALESCE(jsonb_agg(
           CASE WHEN lower(trim(e)) = lower(trim($1)) THEN $2::text ELSE e END
         ), '[]'::jsonb)
           FROM jsonb_array_elements_text(
             CASE WHEN jsonb_typeof(formadores) = 'array' THEN formadores ELSE '[]'::jsonb END
           ) e
       )
       WHERE EXISTS (
         SELECT 1 FROM jsonb_array_elements_text(
           CASE WHEN jsonb_typeof(formadores) = 'array' THEN formadores ELSE '[]'::jsonb END
         ) e
         WHERE lower(trim(e)) = lower(trim($1))
       )`,
      [antigo, novo]);
  }
}

export type CronogramaTurma = { regime: Regime; id: number; cronograma: unknown };

export async function cronogramasDeTodasAsTurmas(c: Consulta) {
  return many<CronogramaTurma>(c,
    `SELECT 'gold' AS regime, id, cronograma FROM turmas_gold
     UNION ALL
     SELECT 'fin', id, cronograma FROM turmas_fin`);
}

export async function gravarCronograma(c: Consulta, regime: Regime, id: number, cronograma: unknown) {
  await many(c, `UPDATE ${TURMAS[regime]} SET cronograma = $2::jsonb WHERE id = $1`, [id, JSON.stringify(cronograma)]);
}

export async function renomearUtilizadorDoFormador(c: Consulta, antigo: string, novo: string) {
  await many(c,
    `UPDATE users SET name = $2
      WHERE id IN (SELECT user_id FROM formadores WHERE lower(trim(nome)) = lower(trim($2)) AND user_id IS NOT NULL)
        AND lower(trim(name)) = lower(trim($1))`,
    [antigo, novo]);
}

export async function renomearTurmaNosFormandos(c: Consulta, regime: Regime, id: number, antigo: string, novo: string) {
  if (regime === "gold") {
    await many(c, "UPDATE formandos_gold SET turma = $3 WHERE turma_id = $1 OR lower(trim(turma)) = lower(trim($2))", [id, antigo, novo]);
  } else {
    await many(c,
      "UPDATE formandos_fin SET turma = $3, turma_id = $1 WHERE turma_id = $1 OR lower(trim(turma)) = lower(trim($2))",
      [id, antigo, novo]);
  }
  await many(c,
    `UPDATE catalog_items
        SET payload = jsonb_set(payload, '{turma}', to_jsonb($2::text), true)
      WHERE kind = 'inscricoes_fin'
        AND jsonb_typeof(payload) = 'object'
        AND lower(trim(coalesce(payload->>'turma', ''))) = lower(trim($1))`,
    [antigo, novo]);
}

export async function renomearCursoDaTurma(
  c: Consulta, regime: Regime, turmaId: number, turmaNome: string, antigo: string, novo: string,
) {
  await many(c,
    `UPDATE ${FORMANDOS[regime]} SET curso = $4
      WHERE (turma_id = $1 OR lower(trim(turma)) = lower(trim($2)))
        AND lower(trim(curso)) = lower(trim($3))`,
    [turmaId, turmaNome, antigo, novo]);
  if (regime === "gold") {
    await many(c,
      "UPDATE preinscricoes SET curso = $3 WHERE turma_id = $1 AND lower(trim(curso)) = lower(trim($2))",
      [turmaId, antigo, novo]);
  }
}

/** O que ainda usa um curso Gold (por nome). */
export async function usoCursoGold(c: Consulta, id: number) {
  const row = await one<{ nome: string }>(c, "SELECT nome FROM cursos_gold WHERE id = $1", [id]);
  const nome = String(row?.nome ?? "");
  if (!nome) return null;
  const n = (table: string) => contar(c, `SELECT count(*)::int AS n FROM ${table} WHERE lower(trim(curso)) = lower(trim($1))`, [nome]);
  return {
    turmas: await n("turmas_gold"),
    formandos: await n("formandos_gold"),
    preinscricoes: await n("preinscricoes"),
    pagamentos: await n("pagamentos"),
  };
}

/** O que ainda usa um curso financiado (nome comercial ou UFCD). */
export async function usoCursoFin(c: Consulta, id: number) {
  const row = await one<{ nome_comercial: string; ufcd: string }>(c, "SELECT nome_comercial, ufcd FROM cursos_fin WHERE id = $1", [id]);
  const nomes = [String(row?.nome_comercial ?? ""), String(row?.ufcd ?? "")].filter(Boolean);
  if (!nomes.length) return null;
  const n = (table: string) => contar(c,
    `SELECT count(*)::int AS n FROM ${table}
      WHERE lower(trim(curso)) IN (SELECT lower(trim(x)) FROM jsonb_array_elements_text($1::jsonb) x)`,
    [JSON.stringify(nomes)]);
  return { turmas: await n("turmas_fin"), formandos: await n("formandos_fin"), pagamentos: await n("pagamentos") };
}

/** Turmas (dos dois regimes) onde o formador está atribuído. */
export async function turmasDoFormadorPorNome(c: Consulta, formadorId: number) {
  const row = await one<{ nome: string }>(c, "SELECT nome FROM formadores WHERE id = $1", [formadorId]);
  const nome = String(row?.nome ?? "").trim();
  if (!nome) return null;
  const porRegime = (table: string) => `SELECT id FROM ${table}
        WHERE lower(trim(formador)) = lower(trim($1))
           OR EXISTS (
             SELECT 1 FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(formadores) = 'array' THEN formadores ELSE '[]'::jsonb END) e
              WHERE lower(trim(e)) = lower(trim($1))
           )`;
  return contar(c, `SELECT count(*)::int AS n FROM (${porRegime(TURMAS.gold)} UNION ALL ${porRegime(TURMAS.fin)}) t`, [nome]);
}

export async function usoTurma(c: Consulta, regime: Regime, id: number) {
  const row = await one<{ nome: string }>(c, `SELECT nome FROM ${TURMAS[regime]} WHERE id = $1`, [id]);
  const nome = String(row?.nome ?? "");
  if (!nome) return null;
  const formandos = await contar(c,
    `SELECT count(*)::int AS n FROM ${FORMANDOS[regime]} WHERE turma_id = $1 OR lower(trim(turma)) = lower(trim($2))`, [id, nome]);
  const preinscricoes = regime === "gold"
    ? await contar(c, "SELECT count(*)::int AS n FROM preinscricoes WHERE turma_id = $1", [id])
    : 0;
  return { formandos, preinscricoes };
}

export async function usoCliente(c: Consulta, id: number) {
  return {
    propostas: await contar(c, "SELECT count(*)::int AS n FROM propostas_comerciais WHERE cliente_id = $1", [id]),
    contratos: await contar(c, "SELECT count(*)::int AS n FROM contratos_comerciais WHERE cliente_id = $1", [id]),
  };
}

/* ── Reparação das ligações (arranque) ─────────────────────────────────────── */

export async function nomesDosCursos(c: Consulta) {
  const gold = await many<{ nome: string }>(c, "SELECT nome FROM cursos_gold");
  const fin = await many<{ nome_comercial: string; ufcd: string; ufcd_cod: string }>(c, "SELECT nome_comercial, ufcd, ufcd_cod FROM cursos_fin");
  return { gold, fin };
}

export async function cursosEscritosEmTodo(c: Consulta) {
  const rows = await many<{ v: string | null }>(c,
    `SELECT curso AS v FROM turmas_gold
     UNION SELECT curso FROM turmas_fin
     UNION SELECT curso FROM formandos_gold
     UNION SELECT curso FROM formandos_fin
     UNION SELECT curso FROM preinscricoes
     UNION SELECT curso FROM pagamentos
     UNION SELECT curso FROM campanhas
     UNION SELECT curso FROM propostas_comerciais
     UNION SELECT curso FROM contratos_comerciais
     UNION SELECT curso FROM email_rules WHERE curso IS NOT NULL
     UNION SELECT payload->>'curso' FROM catalog_items WHERE jsonb_typeof(payload) = 'object'`);
  return [...new Set(rows.map(r => String(r.v ?? "").trim()).filter(Boolean))];
}

export async function nomesDosFormadores(c: Consulta) {
  return (await many<{ nome: string }>(c, "SELECT nome FROM formadores")).map(r => String(r.nome));
}

export async function formadoresDasTurmas(c: Consulta) {
  return many<{ regime: string; id: number; formador: string; formadores: unknown; cronograma: unknown }>(c,
    `SELECT 'gold' AS regime, id, formador, formadores, cronograma FROM turmas_gold
     UNION ALL
     SELECT 'fin', id, formador, formadores, cronograma FROM turmas_fin`);
}

export async function turmasFinNomes(c: Consulta) {
  return many<{ id: number; nome: string; curso: string }>(c, "SELECT id, nome, curso FROM turmas_fin");
}

export async function formandosFinTurma(c: Consulta) {
  return many<{ id: number; turma: string; curso: string; turma_id: number | null }>(c, "SELECT id, turma, curso, turma_id FROM formandos_fin");
}

export async function ligarFormandoFinATurma(c: Consulta, id: number, turma: string, turmaId: number, curso: string) {
  await many(c, "UPDATE formandos_fin SET turma = $2, turma_id = $3, curso = $4 WHERE id = $1", [id, turma, turmaId, curso]);
}

export async function inscricoesFinGuardadas(c: Consulta) {
  return many<{ id: number; payload: unknown }>(c,
    "SELECT id, payload FROM catalog_items WHERE kind = 'inscricoes_fin' AND jsonb_typeof(payload) = 'object'");
}

export async function gravarPayloadCatalogo(c: Consulta, id: number, payload: unknown) {
  await many(c, "UPDATE catalog_items SET payload = $2::jsonb WHERE id = $1", [id, JSON.stringify(payload)]);
}
