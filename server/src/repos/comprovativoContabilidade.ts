/** Comprovativo de pagamento à espera dos dados de faturação, antes do email à contabilidade. */
import { many, one, type Consulta } from "./sql.js";

export type ComprovativoPendente = {
  preinscricao_id: number; drive_file_id: string; recebido_em: string;
  enviado_em: string | null; enviado_com_dados: boolean; lembrete_em: string | null;
};

const COLUNAS = `preinscricao_id, drive_file_id, recebido_em::text AS recebido_em, enviado_em::text AS enviado_em,
  enviado_com_dados, lembrete_em::text AS lembrete_em`;

/** Comprovativo novo (ou outro a seguir a uma recusa): volta a ficar por enviar à contabilidade. */
export async function registarComprovativo(c: Consulta, leadId: number, driveFileId: string) {
  await one(c,
    `INSERT INTO comprovativo_contabilidade (preinscricao_id, drive_file_id) VALUES ($1, $2)
     ON CONFLICT (preinscricao_id) DO UPDATE
       SET drive_file_id = EXCLUDED.drive_file_id, recebido_em = now(), enviado_em = NULL, enviado_com_dados = false
     RETURNING preinscricao_id`,
    [leadId, driveFileId]);
}

export async function comprovativoDoLead(c: Consulta, leadId: number) {
  return one<ComprovativoPendente>(c, `SELECT ${COLUNAS} FROM comprovativo_contabilidade WHERE preinscricao_id = $1`, [leadId]);
}

export type ReservaEnvio = { antesEm: string | null; antesComDados: boolean };

/**
 * Reserva o envio à contabilidade numa só instrução (a volta automática e a confirmação dos dados não enviam as duas).
 * `comDados`: os dados de faturação vão confirmados; um envio que saiu sem eles pode voltar a sair com eles.
 */
export async function reservarEnvio(c: Consulta, leadId: number, comDados: boolean): Promise<ReservaEnvio | null> {
  const r = await one<{ antes_em: string | null; antes_dados: boolean }>(c,
    `UPDATE comprovativo_contabilidade c SET enviado_em = now(), enviado_com_dados = $2
       FROM (SELECT enviado_em::text AS em, enviado_com_dados AS dados FROM comprovativo_contabilidade WHERE preinscricao_id = $1) antes
      WHERE c.preinscricao_id = $1 AND (c.enviado_em IS NULL OR ($2 AND NOT c.enviado_com_dados))
      RETURNING antes.em AS antes_em, antes.dados AS antes_dados`,
    [leadId, comDados]);
  return r ? { antesEm: r.antes_em, antesComDados: Boolean(r.antes_dados) } : null;
}

/** O envio falhou: volta ao que estava (a volta seguinte tenta de novo). */
export async function libertarEnvio(c: Consulta, leadId: number, r: ReservaEnvio) {
  await one(c,
    "UPDATE comprovativo_contabilidade SET enviado_em = $2::timestamptz, enviado_com_dados = $3 WHERE preinscricao_id = $1 RETURNING preinscricao_id",
    [leadId, r.antesEm, r.antesComDados]);
}

/** Reserva o lembrete à pessoa (um só por pré-inscrição). */
export async function reservarLembrete(c: Consulta, leadId: number) {
  return Boolean(await one(c,
    "UPDATE comprovativo_contabilidade SET lembrete_em = now() WHERE preinscricao_id = $1 AND lembrete_em IS NULL RETURNING preinscricao_id",
    [leadId]));
}

export async function libertarLembrete(c: Consulta, leadId: number) {
  await one(c, "UPDATE comprovativo_contabilidade SET lembrete_em = NULL WHERE preinscricao_id = $1 RETURNING preinscricao_id", [leadId]);
}

/** Já não há nada a enviar (pagamento confirmado, comprovativo recusado, desistência): fica arrumado. */
export async function arrumar(c: Consulta, leadId: number) {
  await one(c,
    `UPDATE comprovativo_contabilidade
        SET enviado_em = COALESCE(enviado_em, now()), enviado_com_dados = true, lembrete_em = COALESCE(lembrete_em, now())
      WHERE preinscricao_id = $1 RETURNING preinscricao_id`,
    [leadId]);
}

/** Uma falha (email, Drive): a volta automática só tenta de novo ao fim de `minutos`. */
export async function adiar(c: Consulta, leadId: number, minutos: number) {
  await one(c,
    "UPDATE comprovativo_contabilidade SET tentar_depois = now() + ($2::float8 * interval '1 minute') WHERE preinscricao_id = $1 RETURNING preinscricao_id",
    [leadId, minutos]);
}

/**
 * Por tratar na volta automática: o email à contabilidade cujo prazo (`horas`) terminou sem os dados de faturação, e o
 * lembrete à pessoa (`minutos` depois do comprovativo, ainda sem os dados confirmados).
 */
export async function pendentes(c: Consulta, horas: number, minutos: number, limite: number) {
  return many<ComprovativoPendente & { contabilidade: boolean; lembrete: boolean }>(c,
    `SELECT * FROM (
       SELECT ${COLUNAS},
              (c.enviado_em IS NULL AND c.recebido_em <= now() - ($1::float8 * interval '1 hour')) AS contabilidade,
              (c.lembrete_em IS NULL AND c.recebido_em <= now() - ($2::float8 * interval '1 minute')
                AND NOT EXISTS (SELECT 1 FROM preinscricao_faturacao f WHERE f.preinscricao_id = c.preinscricao_id AND f.dados_enc IS NOT NULL)) AS lembrete
         FROM comprovativo_contabilidade c
        WHERE (c.enviado_em IS NULL OR c.lembrete_em IS NULL) AND (c.tentar_depois IS NULL OR c.tentar_depois <= now())
     ) x
      WHERE x.contabilidade OR x.lembrete
      ORDER BY x.recebido_em
      LIMIT $3`,
    [horas, minutos, limite]);
}
