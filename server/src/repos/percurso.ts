/**
 * Percurso da ligação pessoal: turmas para escolha (com reservas), escolha, conclusão,
 * validação pela secretaria e ligação ao formando Gold.
 */
import { sqlReservas } from "../inscricao.js";
import { many, one, type Consulta, type Regime } from "./sql.js";

export type TurmaPercursoRow = {
  id: number;
  vagas_anunciadas?: number | null;
  nome: string;
  curso: string;
  local: string;
  horario: string;
  data_inicio: string;
  ocupadas: number;
  vagas: number;
  tolerancia?: number;
  estado: string;
  activa?: boolean;
  fechada_em?: unknown;
  cronograma: unknown;
};

/** SELECT de turmas com ocupação = formandos + reservas de pré-inscrições validadas. Colunas fixas por regime. */
function selectTurmas(regime: Regime) {
  return regime === "fin"
    ? `SELECT t.id, t.nome, t.curso, t.local, t.horario, t.data_inicio,
              t.alunos + ${sqlReservas("fin", "t.id")} AS ocupadas, t.alunos_total AS vagas,
              COALESCE(t.tolerancia_vagas, 0) AS tolerancia, t.vagas_anunciadas, t.estado, t.cronograma, t.fechada_em, t.activa
         FROM turmas_fin t`
    : `SELECT t.id, t.nome, t.curso, t.local, t.horario, t.data_inicio,
              t.total_alunos + ${sqlReservas("gold", "t.id")} AS ocupadas, t.vagas AS vagas,
              COALESCE(t.tolerancia_vagas, 0) AS tolerancia, t.vagas_anunciadas, t.estado, t.cronograma, t.fechada_em
         FROM turmas_gold t`;
}

export async function turmasDoCurso(c: Consulta, regime: Regime, curso: string) {
  return many<TurmaPercursoRow>(c, `${selectTurmas(regime)} WHERE lower(trim(t.curso)) = lower(trim($1)) ORDER BY t.data_inicio`, [curso]);
}

export async function turmaPorId(c: Consulta, regime: Regime, id: number) {
  return one<TurmaPercursoRow>(c, `${selectTurmas(regime)} WHERE t.id = $1`, [id]);
}

/** Estado do pagamento ligado à pré-inscrição (vazio se não houver). */
export async function estadoPagamentoLigado(c: Consulta, leadId: number) {
  const r = await one<{ estado: string }>(c,
    "SELECT p.estado FROM preinscricoes l JOIN pagamentos p ON p.id = l.pagamento_id WHERE l.id = $1", [leadId]);
  return r?.estado ?? "";
}

export async function gravarTurmaEscolhida(
  c: Consulta, leadId: number, t: { id: number; local: string; horario: string; dataInicio: string; preco: number | null },
) {
  await many(c,
    `UPDATE preinscricoes SET
       turma_escolhida_id = $2, turma_id = $2, local = $3, horario = $4, inicio_curso = $5, preco = COALESCE($6, preco)
     WHERE id = $1`,
    [leadId, t.id, t.local, t.horario, t.dataInicio, t.preco]);
}

/** A secretaria muda a turma: se o pagamento já foi pedido, a inscrição paga passa a concluir nesta. */
export async function mudarTurmaDoLead(c: Consulta, leadId: number, turmaId: number) {
  await many(c,
    `UPDATE preinscricoes SET turma_escolhida_id = $2, turma_id = $2,
       pagamento_turma_id = CASE WHEN pagamento_turma_id IS NULL THEN NULL ELSE $2::integer END
     WHERE id = $1`, [leadId, turmaId]);
}

export async function marcarConcluido(c: Consulta, leadId: number) {
  await many(c, "UPDATE preinscricoes SET percurso_concluido_em = now() WHERE id = $1", [leadId]);
}

export async function marcarValidada(c: Consulta, leadId: number) {
  await many(c,
    `UPDATE preinscricoes
        SET validada_em = COALESCE(validada_em, now()),
            docs_fechado_em = COALESCE(docs_fechado_em, now()),
            recusa_motivo = ''
      WHERE id = $1`,
    [leadId]);
}

/** Pré-inscrições do mesmo email e regime (para mover documentos para a turma). */
export async function leadsDoEmail(c: Consulta, email: string, regime: Regime) {
  return many<{ id: number; curso: string }>(c,
    "SELECT id, curso FROM preinscricoes WHERE email <> '' AND lower(email) = $1 AND COALESCE(regime, 'gold') = $2",
    [email, regime]);
}

/** Ficha de formando já existente com este email nessa turma. */
export async function formandoNaTurma(c: Consulta, regime: Regime, email: string, turmaId: number) {
  const sql = regime === "fin"
    ? "SELECT id FROM formandos_fin WHERE email <> '' AND lower(trim(email)) = $1 AND turma_id = $2 ORDER BY id DESC LIMIT 1"
    : "SELECT id FROM formandos_gold WHERE email <> '' AND lower(trim(email)) = $1 AND turma_id = $2 ORDER BY id DESC LIMIT 1";
  return (await one<{ id: number }>(c, sql, [email, turmaId]))?.id ?? null;
}

/** Ficha Gold numa turma do curso (a secretaria criou-a antes de validar). */
export async function formandoGoldDoCurso(c: Consulta, email: string, curso: string) {
  return (await one<{ id: number }>(c,
    `SELECT f.id FROM formandos_gold f JOIN turmas_gold t ON t.id = f.turma_id
      WHERE lower(f.email) = $1 AND lower(trim(t.curso)) = lower(trim($2)) ORDER BY f.id DESC LIMIT 1`,
    [email, curso]))?.id ?? null;
}

/** Turma cheia: regista a recusa, tira a turma escolhida e reabre o percurso. */
export async function recusarTurmaCheia(c: Consulta, leadId: number, turmaId: number) {
  await many(c,
    `UPDATE preinscricoes
        SET recusa_motivo = 'Turma cheia',
            turmas_recusadas = CASE WHEN $2 > 0 THEN (
              SELECT COALESCE(array_agg(DISTINCT n), '{}'::int[])
                FROM unnest(COALESCE(turmas_recusadas, '{}'::int[]) || ARRAY[$2]::int[]) AS n
               WHERE n > 0
            ) ELSE turmas_recusadas END,
            turma_escolhida_id = NULL,
            turma_id = CASE WHEN turma_id = $2 THEN NULL ELSE turma_id END,
            percurso_concluido_em = NULL,
            docs_fechado_em = NULL,
            lembrete_pre_em = now()
      WHERE id = $1 AND validada_em IS NULL`,
    [leadId, turmaId]);
}

export async function valorEstadoPagamento(c: Consulta, id: string) {
  return one<{ valor: number; estado: string }>(c, "SELECT valor, estado FROM pagamentos WHERE id = $1", [id]);
}

/* ── Ligação ao formando Gold ────────────────────────────────────────────── */

export async function formandoGoldComTurma(c: Consulta, formandoId: number) {
  return one<{ email: string; curso: string; turma_id: number | null }>(c,
    `SELECT f.email, t.curso, f.turma_id FROM formandos_gold f
       JOIN turmas_gold t ON t.id = f.turma_id
      WHERE f.id = $1`,
    [formandoId]);
}

export async function leadValidadoDoCurso(c: Consulta, email: string, curso: string) {
  return one<{ id: number; pagamento_id: string | null; turma_escolhida_id: number | null }>(c,
    `SELECT id, pagamento_id, turma_escolhida_id FROM preinscricoes
      WHERE lower(email) = $1 AND lower(trim(curso)) = lower(trim($2))
        AND COALESCE(regime, 'gold') = 'gold' AND validada_em IS NOT NULL AND estado <> 'Desistiu'
      ORDER BY validada_em DESC LIMIT 1`,
    [email, curso]);
}

export async function passarAFormando(c: Consulta, leadId: number, turmaId: number | null) {
  await many(c,
    `UPDATE preinscricoes SET estado = 'Formando', ultima_actividade_em = now(),
       turma_id = COALESCE($2, turma_id), turma_escolhida_id = COALESCE($2, turma_escolhida_id)
     WHERE id = $1`,
    [leadId, turmaId]);
}

export async function ligarPagamentoAoFormando(c: Consulta, pagamentoId: string, formandoId: number, turmaId: number | null) {
  return one<{ estado: string; metodo: string }>(c,
    "UPDATE pagamentos SET formando_id = $2, turma_id = $3 WHERE id = $1 RETURNING estado, metodo",
    [pagamentoId, formandoId, turmaId]);
}

export async function marcarFormandoGoldPago(c: Consulta, formandoId: number, metodo: string) {
  await many(c,
    "UPDATE formandos_gold SET pago = true, metodo = CASE WHEN metodo IN ('-', '') THEN $2 ELSE metodo END WHERE id = $1",
    [formandoId, metodo]);
}
