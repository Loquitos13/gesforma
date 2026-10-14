/** Dados da turma usados pela pedagogia: a turma, os formandos, o curso, o fecho e o cronograma público. */
import { asObj, pgTextArray } from "../pedagogia/util.js";
import { many, one, tabelaRegime, type Consulta, type Regime } from "./sql.js";

export type TurmaRow = { id: number; nome: string; curso: string; cronograma: unknown; formador?: string; local?: string; horario?: string };

export async function carregarTurma(c: Consulta, regime: Regime, id: number): Promise<TurmaRow | null> {
  return one<TurmaRow>(c, `SELECT id, nome, curso, cronograma, formador, local, horario FROM ${tabelaRegime("turmas", regime)} WHERE id = $1`, [id]);
}

/** Todas as turmas do regime, só com o necessário para o dossiê. */
export async function listarTurmasDtp(c: Consulta, regime: Regime) {
  const extra = regime === "fin" ? "financiador, fechada_em IS NOT NULL AS fechada" : "'' AS financiador, false AS fechada";
  return many<TurmaRow & { estado: string; data_inicio: string; financiador: string; fechada: boolean }>(
    c,
    `SELECT id, nome, curso, cronograma, formador, local, horario, coalesce(estado, '') AS estado,
            coalesce(data_inicio::text, '') AS data_inicio, ${extra}
       FROM ${tabelaRegime("turmas", regime)}
      ORDER BY data_inicio DESC NULLS LAST, nome`,
  );
}

export async function cronogramaDaTurma(c: Consulta, regime: Regime, id: number) {
  return one<{ cronograma: unknown }>(c, `SELECT cronograma FROM ${tabelaRegime("turmas", regime)} WHERE id = $1`, [id]);
}

export async function gravarCronograma(c: Consulta, regime: Regime, id: number, sessoes: unknown[]) {
  await one(c, `UPDATE ${tabelaRegime("turmas", regime)} SET cronograma = $2::jsonb WHERE id = $1 RETURNING id`, [id, sessoes]);
}

export type TurmaPublica = {
  nome: string; curso: string; local: string; horario: string; data_inicio: string; formador: string;
  cronograma: unknown; cronograma_publicado_em: string | null;
};

export async function turmaParaCronograma(c: Consulta, regime: Regime, id: number) {
  return one<TurmaPublica>(
    c,
    `SELECT nome, curso, local, horario, data_inicio, formador, cronograma, cronograma_publicado_em
       FROM ${tabelaRegime("turmas", regime)} WHERE id = $1`,
    [id],
  );
}

export async function marcarCronogramaPublicado(c: Consulta, regime: Regime, id: number) {
  await one(c, `UPDATE ${tabelaRegime("turmas", regime)} SET cronograma_publicado_em = now() WHERE id = $1 RETURNING id`, [id]);
}

/** Equipa de formadores da turma (responsável + lista). */
export async function equipaDaTurma(c: Consulta, regime: Regime, id: number) {
  return one<{ nome: string; curso: string; formador: string; formadores: unknown }>(
    c,
    `SELECT nome, curso, formador, formadores FROM ${tabelaRegime("turmas", regime)} WHERE id = $1`,
    [id],
  );
}

export type FormandoTurma = { id: number; nome: string; docs: Record<string, unknown> };

/** Formandos da turma. Na Financiada o campo turma é texto livre: quem não aponta para uma turma existente conta pelo curso. */
export async function formandosDaTurma(c: Consulta, regime: Regime, turma: TurmaRow): Promise<FormandoTurma[]> {
  if (regime === "gold") {
    const rows = await many<{ id: number; nome: string; apelido: string }>(
      c,
      "SELECT id, nome, apelido FROM formandos_gold WHERE turma_id = $1 OR turma = $2 ORDER BY nome",
      [turma.id, turma.nome],
    );
    return rows.map(r => ({ id: r.id, nome: `${r.nome} ${r.apelido}`.trim(), docs: {} }));
  }
  const rows = await many<{ id: number; nome: string; apelido: string; docs: unknown }>(
    c,
    `SELECT id, nome, apelido, docs FROM formandos_fin f
      WHERE f.turma_id = $1
         OR (f.turma_id IS NULL AND f.turma = $2)
         OR (f.turma_id IS NULL AND f.curso = $3 AND NOT EXISTS (SELECT 1 FROM turmas_fin t WHERE t.nome = f.turma))
      ORDER BY nome`,
    [turma.id, turma.nome, turma.curso],
  );
  return rows.map(r => ({ id: r.id, nome: `${r.nome} ${r.apelido}`.trim(), docs: asObj(r.docs) }));
}

/** Formandos com email (para o envio de inquéritos). */
export async function contactosFormandos(c: Consulta, regime: Regime, turmaId: number, turmaNome: string) {
  return many<{ nome: string; apelido: string; email: string }>(
    c,
    `SELECT nome, apelido, email FROM ${tabelaRegime("formandos", regime)}
      WHERE turma_id = $1 OR lower(trim(turma)) = lower(trim($2))`,
    [turmaId, turmaNome],
  );
}

/** Email dos formadores pelos nomes (minúsculas, aparados). */
export async function contactosFormadores(c: Consulta, nomesMinusculos: string[]) {
  if (!nomesMinusculos.length) return [];
  return many<{ nome: string; email: string }>(
    c,
    "SELECT nome, email FROM formadores WHERE lower(trim(nome)) = ANY($1::text[])",
    [pgTextArray(nomesMinusculos)],
  );
}

/** O curso da turma é texto: resolve-se pelo nome (Gold) ou pela UFCD / nome comercial (Financiada). */
export async function cursoIdDaTurma(c: Consulta, regime: Regime, curso: string) {
  if (!curso.trim()) return null;
  const row = regime === "gold"
    ? await one<{ id: number }>(c, "SELECT id FROM cursos_gold WHERE lower(trim(nome)) = lower(trim($1)) LIMIT 1", [curso])
    : await one<{ id: number }>(
      c,
      "SELECT id FROM cursos_fin WHERE lower(trim(ufcd)) = lower(trim($1)) OR lower(trim(nome_comercial)) = lower(trim($1)) LIMIT 1",
      [curso],
    );
  return row?.id ?? null;
}

/** Mapa curso (texto, minúsculas) → id, para resolver muitas turmas de uma vez. */
export async function mapaCursos(c: Consulta, regime: Regime) {
  const rows = regime === "gold"
    ? await many<{ id: number; chave: string }>(c, "SELECT id, lower(trim(nome)) AS chave FROM cursos_gold")
    : await many<{ id: number; chave: string }>(
      c,
      `SELECT id, lower(trim(ufcd)) AS chave FROM cursos_fin WHERE trim(coalesce(ufcd, '')) <> ''
       UNION ALL
       SELECT id, lower(trim(nome_comercial)) AS chave FROM cursos_fin WHERE trim(coalesce(nome_comercial, '')) <> ''`,
    );
  const out = new Map<string, number>();
  for (const r of rows) if (!out.has(r.chave)) out.set(r.chave, Number(r.id));
  return out;
}

export async function estadoFechoFin(c: Consulta, id: number) {
  return one<{ fechada_em: string | null; nome: string }>(c, "SELECT fechada_em, nome FROM turmas_fin WHERE id = $1", [id]);
}

export async function fecharTurmaFin(c: Consulta, id: number, actorId: string, resumo: Record<string, unknown>) {
  await one(
    c,
    `UPDATE turmas_fin SET fechada_em = now(), fechada_por = $2, relatorio_execucao = $3::jsonb,
       estado = 'Concluída', activa = false WHERE id = $1 RETURNING id`,
    [id, actorId, JSON.stringify(resumo)],
  );
}

export async function fecharTurmaGold(c: Consulta, id: number, actorId: string) {
  await one(c, "UPDATE turmas_gold SET fechada_em = now(), fechada_por = $2, estado = 'Inativa' WHERE id = $1 RETURNING id", [id, actorId]);
}

export async function reabrirTurma(c: Consulta, regime: Regime, id: number) {
  const extra = regime === "fin" ? ", estado = 'A decorrer'" : "";
  await one(c, `UPDATE ${tabelaRegime("turmas", regime)} SET fechada_em = NULL, reaberta_em = now()${extra} WHERE id = $1 RETURNING id`, [id]);
}

/** Cronograma e valores por hora definidos na turma (horas do formador). */
export async function custosDaTurma(c: Consulta, regime: Regime, id: number) {
  return one<{ cronograma: unknown; valores_hora_formador: unknown }>(
    c,
    `SELECT cronograma, valores_hora_formador FROM ${tabelaRegime("turmas", regime)} WHERE id = $1`,
    [id],
  );
}

export async function custoHoraFormadores(c: Consulta) {
  return many<{ nome: string; custo_hora: unknown }>(c, "SELECT nome, custo_hora FROM formadores");
}
