/** Lembretes automáticos da pré-inscrição (documentos ou turma em falta). */
import { many, one, type Consulta, type Regime } from "./sql.js";

export async function configLembrete(c: Consulta) {
  return (await one<{ values: unknown }>(c, "SELECT values FROM app_settings WHERE id = 'lembrete_pre'"))?.values ?? null;
}

export async function nomeDaTurma(c: Consulta, regime: Regime, id: number) {
  const sql = regime === "fin" ? "SELECT nome FROM turmas_fin WHERE id = $1" : "SELECT nome FROM turmas_gold WHERE id = $1";
  return String((await one<{ nome: string }>(c, sql, [id]))?.nome ?? "");
}

/** Pedidos abertos sem data de lembrete começam a contar agora. */
export async function iniciarContagem(c: Consulta) {
  await many(c, "UPDATE preinscricoes SET lembrete_pre_em = now() WHERE validada_em IS NULL AND lembrete_pre_em IS NULL");
}

export type LeadLembrete = {
  id: number; nome: string; apelido: string; email: string; curso: string; regime: string;
  turma_escolhida_id: number | null; turmas_recusadas: unknown;
  validada_em: unknown; estado: string; docs_token_usado_em: unknown; docs_token_criado_em: unknown; created_at: unknown;
};

/** Pedidos abertos, com ligação pessoal enviada, cujo lembrete já venceu e abaixo do máximo. */
export async function devidos(c: Consulta, limite: Date, maximo: number, lote: number) {
  return many<LeadLembrete>(c,
    `SELECT id, nome, apelido, email, curso, COALESCE(regime, 'gold') AS regime,
            turma_escolhida_id, turmas_recusadas, validada_em, estado,
            docs_token_usado_em, docs_token_criado_em, created_at
       FROM preinscricoes
      WHERE validada_em IS NULL
        AND estado NOT IN ('Desistiu', 'Formando')
        AND docs_token IS NOT NULL
        AND lembretes_enviados < $2
        AND ultimo_lembrete_em IS NULL
        AND btrim(email) <> ''
        AND lembrete_pre_em IS NOT NULL
        AND lembrete_pre_em <= $1
      ORDER BY lembrete_pre_em, id
      LIMIT $3`,
    [limite, maximo, lote]);
}

export async function adiar(c: Consulta, id: number) {
  await many(c, "UPDATE preinscricoes SET lembrete_pre_em = now() WHERE id = $1", [id]);
}

/** Reserva o envio (evita dois envios em paralelo). Devolve false se outro processo já o fez. */
export async function reclamarEnvio(c: Consulta, id: number, limite: Date) {
  return Boolean(await one(c,
    `UPDATE preinscricoes SET lembrete_pre_em = now(), lembretes_enviados = lembretes_enviados + 1, lembrete_enviado_em = now()
      WHERE id = $1 AND lembrete_pre_em <= $2 RETURNING id`,
    [id, limite]));
}

/** Contactos registados no CRM (manuais e automáticos, lembretes incluídos). */
export async function contarContactos(c: Consulta, id: number) {
  return Number((await one<{ n: number }>(c, "SELECT count(*)::int AS n FROM preinscricao_contactos WHERE preinscricao_id = $1", [id]))?.n ?? 0);
}

/** Depois do último lembrete não se envia mais nenhum. */
export async function marcarUltimoLembrete(c: Consulta, id: number) {
  await many(c, "UPDATE preinscricoes SET ultimo_lembrete_em = now() WHERE id = $1", [id]);
}
