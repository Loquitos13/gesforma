/**
 * Documentos da pré-inscrição (ficheiros, estados, alertas) e o que cada curso pede
 * (configuração por curso, modelos de consentimento, extras do dossiê).
 */
import { Filtros, many, one, type AtorCrm, type Consulta, type Regime } from "./sql.js";
import { pgTextArray } from "../pedagogia/util.js";

const CURSOS = { gold: "cursos_gold", fin: "cursos_fin" } as const;

export type DocLeadRow = {
  id: number;
  tipo: string;
  nome: string;
  drive_file_id: string;
  drive_url: string;
  created_at: string;
  estado: string;
  observacao: string;
};

export async function docsDoLead(c: Consulta, leadId: number) {
  return many<DocLeadRow>(c,
    `SELECT id, tipo, nome, drive_file_id, drive_url, created_at,
            COALESCE(estado, 'pendente') AS estado,
            COALESCE(observacao, '') AS observacao
       FROM preinscricao_docs WHERE preinscricao_id = $1 ORDER BY created_at`,
    [leadId]);
}

/** Pré-inscrição a que pertence um ficheiro da Drive (documento da ligação pessoal ou comprovativo). */
export async function leadDoFicheiro(c: Consulta, driveFileId: string): Promise<number | null> {
  const r = await one<{ id: number }>(c, "SELECT preinscricao_id AS id FROM preinscricao_docs WHERE drive_file_id = $1 LIMIT 1", [driveFileId]);
  return r ? Number(r.id) : null;
}

export async function tipoDoDoc(c: Consulta, docId: number) {
  return (await one<{ tipo: string }>(c, "SELECT tipo FROM preinscricao_docs WHERE id = $1", [docId]))?.tipo ?? null;
}

export async function estadosDoTipo(c: Consulta, leadId: number, tipo: string) {
  return many<{ estado: string }>(c,
    "SELECT COALESCE(estado, 'pendente') AS estado FROM preinscricao_docs WHERE preinscricao_id = $1 AND tipo = $2",
    [leadId, tipo]);
}

/** Substitui o ficheiro do tipo (um por tipo). */
export async function substituirDoc(
  c: Consulta,
  d: { leadId: number; tipo: string; nome: string; driveFileId: string; driveUrl: string; consentimentoIp?: string; consentimentoModelo?: string },
) {
  await many(c, "DELETE FROM preinscricao_docs WHERE preinscricao_id = $1 AND tipo = $2", [d.leadId, d.tipo]);
  await many(c,
    `INSERT INTO preinscricao_docs (preinscricao_id, tipo, nome, drive_file_id, drive_url, consentimento_ip, consentimento_modelo)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [d.leadId, d.tipo, d.nome, d.driveFileId, d.driveUrl, d.consentimentoIp ?? "", d.consentimentoModelo ?? ""]);
}

export async function definirEstado(
  c: Consulta, leadId: number, docId: number, estado: "validado" | "recusado", observacao: string, actorId: string | null,
) {
  return one<{ id: number }>(c,
    `UPDATE preinscricao_docs
        SET estado = $3, observacao = $4,
            validated_by = CASE WHEN $5::uuid IS NULL THEN validated_by ELSE $5::uuid END,
            validated_at = now()
      WHERE id = $1 AND preinscricao_id = $2
      RETURNING id`,
    [docId, leadId, estado, observacao, actorId]);
}

/** Um documento recusado reabre o percurso (a pessoa volta a concluir). */
export async function reabrirPercurso(c: Consulta, leadId: number) {
  await many(c, "UPDATE preinscricoes SET percurso_concluido_em = NULL WHERE id = $1 AND validada_em IS NULL", [leadId]);
}

export async function marcarLembreteDocs(c: Consulta, leadId: number) {
  await many(c, "UPDATE preinscricoes SET lembrete_pre_em = now() WHERE id = $1", [leadId]);
}

/* ── Alertas de documentos novos ─────────────────────────────────────────── */

export async function alertaAberto(c: Consulta, leadId: number) {
  return (await one<{ id: string }>(c,
    "SELECT id FROM doc_alertas WHERE preinscricao_id = $1 AND dispensada_em IS NULL LIMIT 1", [leadId]))?.id ?? null;
}

export async function criarAlerta(c: Consulta, id: string, leadId: number) {
  await many(c, "INSERT INTO doc_alertas (id, preinscricao_id) VALUES ($1, $2)", [id, leadId]);
}

export async function dispensarAlertasDoLead(c: Consulta, leadId: number) {
  await many(c, "UPDATE doc_alertas SET dispensada_em = now() WHERE preinscricao_id = $1 AND dispensada_em IS NULL", [leadId]);
}

export async function dispensarAlerta(c: Consulta, id: string, ator?: AtorCrm) {
  const w = new Filtros([id]).sempre("p.id = doc_alertas.preinscricao_id AND doc_alertas.id = $1 AND doc_alertas.dispensada_em IS NULL")
    .visivelPara(ator, "p.comercial_id", "p.regime");
  await many(c, `UPDATE doc_alertas SET dispensada_em = now() FROM preinscricoes p ${w.where}`, w.params);
}

export async function alertasAbertos(c: Consulta, limite = 20, ator?: AtorCrm) {
  const w = new Filtros([limite]).sempre("a.dispensada_em IS NULL").visivelPara(ator, "p.comercial_id", "p.regime");
  return many<{ id: string; preinscricao_id: number; created_at: string; nome: string; apelido: string; curso: string; regime: string }>(c,
    `SELECT a.id, a.preinscricao_id, a.created_at, p.nome, p.apelido, p.curso, COALESCE(p.regime, 'gold') AS regime
       FROM doc_alertas a
       JOIN preinscricoes p ON p.id = a.preinscricao_id
      ${w.where}
      ORDER BY a.created_at DESC
      LIMIT $1`,
    w.params);
}

/* ── O que o curso pede ──────────────────────────────────────────────────── */

export async function estadoDoPagamento(c: Consulta, pagamentoId: string) {
  return (await one<{ estado: string }>(c, "SELECT estado FROM pagamentos WHERE id = $1", [pagamentoId]))?.estado ?? null;
}

export async function configDocsDoCurso(c: Consulta, regime: Regime, cursoId: number) {
  return (await one<{ docs_preinscricao: unknown }>(c,
    `SELECT docs_preinscricao FROM ${CURSOS[regime]} WHERE id = $1`, [cursoId]))?.docs_preinscricao ?? null;
}

export async function gravarConfigDocs(c: Consulta, regime: Regime, cursoId: number, cfg: unknown) {
  await many(c, `UPDATE ${CURSOS[regime]} SET docs_preinscricao = $2::jsonb WHERE id = $1`, [cursoId, JSON.stringify(cfg)]);
}

export async function modelosConsentimento(c: Consulta, regime: Regime, cursoId: number) {
  return many<{ requisito_id: string; nome: string; drive_file_id: string }>(c,
    `SELECT requisito_id, nome, drive_file_id
       FROM curso_ficheiros
      WHERE regime = $1 AND curso_id = $2 AND ambito = 'consentimento' AND drive_file_id <> ''
      ORDER BY created_at`,
    [regime, cursoId]);
}

export async function apagarModelosFora(c: Consulta, regime: Regime, cursoId: number, activos: string[]) {
  await many(c,
    `DELETE FROM curso_ficheiros
      WHERE regime = $1 AND curso_id = $2 AND ambito = 'consentimento'
        AND NOT (requisito_id = ANY($3::text[]))`,
    [regime, cursoId, pgTextArray(activos)]);
}

export async function modeloMaisRecente(c: Consulta, regime: Regime, cursoId: number, docId: string) {
  return one<{ nome: string; drive_file_id: string }>(c,
    `SELECT nome, drive_file_id FROM curso_ficheiros
      WHERE regime = $1 AND curso_id = $2 AND ambito = 'consentimento' AND requisito_id = $3
      ORDER BY created_at DESC LIMIT 1`,
    [regime, cursoId, docId]);
}

/** Curso pelo nome (Fin aceita nome comercial, UFCD ou código). Devolve id e tipo comercial. */
export async function cursoPorNome(c: Consulta, regime: Regime, curso: string, aceitarCodigo = false) {
  if (regime === "fin") {
    return one<{ id: number; tipo: string }>(c,
      `SELECT id, ''::text AS tipo FROM cursos_fin
        WHERE lower(trim(nome_comercial)) = lower(trim($1)) OR lower(trim(ufcd)) = lower(trim($1))
           OR ($2 AND ufcd_cod = $1)
        LIMIT 1`,
      [curso, aceitarCodigo]);
  }
  return one<{ id: number; tipo: string }>(c,
    "SELECT id, tipo FROM cursos_gold WHERE lower(trim(nome)) = lower(trim($1)) LIMIT 1", [curso]);
}

export async function modeloDtpDoCurso(c: Consulta, regime: Regime, cursoId: number) {
  return one<{ extra: unknown; excluidos: unknown; incluidos: unknown }>(c,
    "SELECT extra, excluidos, incluidos FROM curso_dtp_modelos WHERE regime = $1 AND curso_id = $2", [regime, cursoId]);
}

export async function modeloDtpDaEntidade(c: Consulta, cursoGoldId: number) {
  return one<{ excluidos: unknown; extra: unknown }>(c,
    `SELECT e.excluidos, e.extra
       FROM cursos_gold c
       JOIN dtp_entidades e ON e.id = c.entidade_responsavel_id
      WHERE c.id = $1`,
    [cursoGoldId]);
}
