/**
 * Pré-inscrições (leads): leitura, escrita e ligação pessoal. Só SQL parametrizado.
 * As listas paginadas do CRM vivem em `repos/crmLeads.ts`; o dossiê em `repos/leadDossier.ts`.
 */
import { many, one, valor, type Consulta, type Regime } from "./sql.js";
import { pgTextArray } from "../pedagogia/util.js";

type Linha = Record<string, unknown>;

export const SELECT_LEAD = `SELECT p.*, e.nome AS etiqueta_nome, e.cor AS etiqueta_cor, u.name AS comercial_nome
     FROM preinscricoes p
     LEFT JOIN crm_etiquetas e ON e.id = p.etiqueta_id
     LEFT JOIN users u ON u.id = p.comercial_id`;

/** A linha completa da pré-inscrição. */
export async function lead(c: Consulta, id: number) {
  return one<Linha>(c, "SELECT * FROM preinscricoes WHERE id = $1", [id]);
}

/** A linha com etiqueta e nome do comercial (para `mapPreinscricao`). */
export async function leadComEtiqueta(c: Consulta, id: number) {
  return one<Linha>(c, `${SELECT_LEAD} WHERE p.id = $1`, [id]);
}

export async function existe(c: Consulta, id: number) {
  return Boolean(await one(c, "SELECT id FROM preinscricoes WHERE id = $1", [id]));
}

/* ── Ligação pessoal ─────────────────────────────────────────────────────── */

export async function tokenDoLead(c: Consulta, id: number) {
  return (await valor<string | null>(c, "SELECT docs_token FROM preinscricoes WHERE id = $1", [id])) ?? null;
}

export async function gravarTokenSeVazio(c: Consulta, id: number, token: string) {
  await many(c,
    "UPDATE preinscricoes SET docs_token = $2, docs_token_criado_em = now(), docs_token_usado_em = NULL WHERE id = $1 AND docs_token IS NULL",
    [id, token]);
}

export async function trocarToken(c: Consulta, id: number, token: string) {
  await many(c,
    "UPDATE preinscricoes SET docs_token = $2, docs_token_criado_em = now(), docs_token_usado_em = NULL, lembretes_enviados = 0 WHERE id = $1",
    [id, token]);
}

export async function leadPorToken(c: Consulta, token: string) {
  return one<Linha>(c, "SELECT * FROM preinscricoes WHERE docs_token = $1", [token]);
}

/** Ligação pessoal do formando financiado (documentos depois de inscrito). */
export async function formandoFinIdPorToken(c: Consulta, token: string) {
  return (await one<{ id: number }>(c, "SELECT id FROM formandos_fin WHERE docs_token = $1", [token]))?.id ?? null;
}

/** A ligação de documentos da Financiada fecha quando o formando desiste ou é indeferido, ou a turma fecha. */
export async function ligacaoFinFechada(c: Consulta, formandoId: number) {
  return Boolean(await valor(c, `SELECT 1 FROM formandos_fin f LEFT JOIN turmas_fin t ON t.id = f.turma_id
     WHERE f.id = $1 AND (lower(COALESCE(f.estado, '')) LIKE 'desist%' OR lower(COALESCE(f.estado, '')) = 'indeferido' OR t.fechada_em IS NOT NULL)`, [formandoId]));
}

export async function marcarUsoToken(c: Consulta, id: number) {
  await many(c, "UPDATE preinscricoes SET docs_token_usado_em = now() WHERE id = $1", [id]);
}

/* ── Contactos e actividade ──────────────────────────────────────────────── */

export async function inserirContacto(
  c: Consulta,
  input: { leadId: number; actorId?: string | null; nota: string; meio?: string; resultado?: string },
) {
  await many(c,
    "INSERT INTO preinscricao_contactos (preinscricao_id, actor_id, nota, meio, resultado) VALUES ($1,$2,$3,$4,$5)",
    [input.leadId, input.actorId ?? null, input.nota, input.meio ?? "", input.resultado ?? ""]);
}

/** Primeiro contacto: «Não contactado» passa a «1º Contacto»; a nota junta-se às notas. */
export async function registarContacto(c: Consulta, id: number, estado: string, nota: string, meio = "") {
  await many(c,
    `UPDATE preinscricoes SET estado = $2, contactado_em = now(),
       notas = CASE WHEN $3 = '' THEN notas ELSE trim(both from notas || E'\\n' || $3) END,
       meio_contacto = CASE WHEN $4 = '' THEN meio_contacto ELSE $4 END
     WHERE id = $1`,
    [id, estado, nota, meio]);
}

export async function juntarNota(c: Consulta, id: number, corpo: string, meio: string, resultado: string) {
  await many(c,
    `UPDATE preinscricoes SET
       notas = CASE WHEN $2 = '' THEN notas ELSE trim(both from notas || E'\\n' || $2) END,
       meio_contacto = CASE WHEN $3 = '' THEN meio_contacto ELSE $3 END,
       ultima_nota = $2,
       ultima_actividade_em = now(),
       ultima_resultado = CASE WHEN $4 = '' THEN ultima_resultado ELSE $4 END
     WHERE id = $1`,
    [id, corpo, meio, resultado]);
}

export async function agendarSeguimento(c: Consulta, id: number, proximo: string | null, nota: string) {
  await many(c,
    `UPDATE preinscricoes SET proximo_contacto = COALESCE($2, proximo_contacto),
       notas = CASE WHEN $3 = '' THEN notas ELSE trim(both from notas || E'\\n' || $3) END
     WHERE id = $1`,
    [id, proximo, nota]);
}

export async function mudarEstado(c: Consulta, id: number, estado: string) {
  await many(c, "UPDATE preinscricoes SET estado = $2 WHERE id = $1 AND estado <> 'Formando'", [id, estado]);
}

export async function atribuirComercial(c: Consulta, id: number, comercialId: string) {
  await many(c, "UPDATE preinscricoes SET comercial_id = $2 WHERE id = $1", [id, comercialId]);
}

/** Este utilizador é um comercial (só vende Gold). */
export async function eComercial(c: Consulta, id: string) {
  return Boolean(await valor(c, "SELECT 1 FROM users WHERE id::text = $1 AND role = 'comercial'", [id]));
}

export async function marcarEtiqueta(c: Consulta, id: number, etiquetaId: number | null) {
  await many(c, "UPDATE preinscricoes SET etiqueta_id = $2 WHERE id = $1", [id, etiquetaId]);
}

export async function definirProximoContacto(c: Consulta, id: number, data: string) {
  await many(c, "UPDATE preinscricoes SET proximo_contacto = $2 WHERE id = $1", [id, data]);
}

export async function entregarASecretaria(c: Consulta, id: number, mudarEstado: boolean) {
  await many(c,
    mudarEstado
      ? "UPDATE preinscricoes SET secretaria_em = now(), ultima_actividade_em = now(), estado = 'Pré-inscrição' WHERE id = $1 AND secretaria_em IS NULL"
      : "UPDATE preinscricoes SET secretaria_em = now(), ultima_actividade_em = now() WHERE id = $1 AND secretaria_em IS NULL",
    [id]);
}

/** Passa a «Pré-inscrição» (nunca recua um formando). */
export async function promoverAPreinscricao(c: Consulta, id: number) {
  await many(c,
    `UPDATE preinscricoes SET
       estado = 'Pré-inscrição',
       contactado_em = COALESCE(contactado_em, now()),
       ultima_actividade_em = now()
     WHERE id = $1 AND estado <> 'Formando'`,
    [id]);
}

export async function apagar(c: Consulta, id: number) {
  await many(c, "DELETE FROM preinscricoes WHERE id = $1", [id]);
}

/* ── Utilizadores para o CRM ─────────────────────────────────────────────── */

export async function comerciaisActivos(c: Consulta, perfis: string[]) {
  return many<{ id: string; name: string }>(c,
    "SELECT id, name FROM users WHERE active = true AND role = ANY($1::text[]) ORDER BY name", [pgTextArray(perfis)]);
}

/* ── Opções das listas («Como conheceu a ENA», métodos, campanhas) ───────── */

/** Valor da lista de opções igual (sem maiúsculas/acentos) ao texto pedido, ou null. */
export async function opcaoDaLista(c: Consulta, lista: string, texto: string) {
  const t = texto.trim();
  if (!t) return null;
  return valor<string>(c,
    `SELECT payload->>'nome' FROM catalog_items
      WHERE kind = 'lista_opcoes' AND payload->>'lista' = $1 AND lower(trim(payload->>'nome')) = lower($2)
      LIMIT 1`,
    [lista, t]);
}

export async function listaTemOpcoes(c: Consulta, lista: string) {
  return Boolean(await one(c,
    "SELECT 1 FROM catalog_items WHERE kind = 'lista_opcoes' AND payload->>'lista' = $1 LIMIT 1", [lista]));
}

/** Campanha pelo nome (sem maiúsculas). */
export async function campanhaPorNome(c: Consulta, nome: string) {
  if (!nome.trim()) return null;
  return one<{ id: number; nome: string }>(c,
    "SELECT id, nome FROM campanhas WHERE lower(trim(nome)) = lower(trim($1)) ORDER BY id DESC LIMIT 1", [nome]);
}

export async function campanhaPorId(c: Consulta, id: number) {
  return one<{ id: number; nome: string }>(c, "SELECT id, nome FROM campanhas WHERE id = $1", [id]);
}

/** Turma do regime (para confirmar que é do mesmo curso). */
export async function cursoDaTurma(c: Consulta, regime: Regime, turmaId: number) {
  const tabela = regime === "fin" ? "turmas_fin" : "turmas_gold";
  return one<{ curso: string }>(c, `SELECT curso FROM ${tabela} WHERE id = $1`, [turmaId]);
}
