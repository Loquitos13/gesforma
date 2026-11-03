import { many, one, valor, type Consulta } from "./sql.js";

/** WhatsApp (Meta Cloud API): configuração, sessões do assistente e mensagens. */

export type WhatsappGuardado = { token_sealed: string | null; phone_id: string | null; verify_token: string | null; display_phone: string | null };

export function whatsappGuardado(c: Consulta) {
  return one<WhatsappGuardado>(c, "SELECT token_sealed, phone_id, verify_token, display_phone FROM whatsapp_config WHERE id = 'meta'");
}

export async function gravarWhatsapp(c: Consulta, w: { tokenSealed: string; phoneId: string; verifyToken: string; displayPhone: string }) {
  await one(
    c,
    `INSERT INTO whatsapp_config (id, token_sealed, phone_id, verify_token, display_phone, updated_at)
     VALUES ('meta', $1, $2, $3, $4, now())
     ON CONFLICT (id) DO UPDATE SET token_sealed = EXCLUDED.token_sealed, phone_id = EXCLUDED.phone_id,
       verify_token = EXCLUDED.verify_token, display_phone = EXCLUDED.display_phone, updated_at = now()`,
    [w.tokenSealed, w.phoneId, w.verifyToken, w.displayPhone],
  );
}

export async function apagarWhatsapp(c: Consulta) {
  await one(c, "DELETE FROM whatsapp_config WHERE id = 'meta'");
}

export async function contarSessoesWhatsapp(c: Consulta) {
  return Number((await valor<number>(c, "SELECT count(*)::int FROM whatsapp_sessoes")) ?? 0);
}

export function sessaoWhatsapp(c: Consulta, telefone: string) {
  return one<{ passo: string; dados: unknown; lead_id: number | null; humano_desde: string | null }>(
    c, "SELECT passo, dados, lead_id, humano_desde::text AS humano_desde FROM whatsapp_sessoes WHERE telefone = $1", [telefone],
  );
}

/** Horas sem resposta da equipa ao fim das quais o assistente volta a responder nessa conversa. */
export const HUMANO_EXPIRA_HORAS = 72;

/** A pessoa pediu para falar com a equipa: o bot fica em pausa nesta conversa (uma pausa já caducada recomeça agora). */
export async function pedirHumanoWhatsapp(c: Consulta, telefone: string) {
  await one(
    c,
    `INSERT INTO whatsapp_sessoes (telefone, passo, humano_desde, actualizado_em) VALUES ($1, 'menu', now(), now())
     ON CONFLICT (telefone) DO UPDATE SET passo = 'menu', dados = '{}'::jsonb, actualizado_em = now(),
       humano_desde = CASE WHEN whatsapp_sessoes.humano_desde IS NULL
                             OR whatsapp_sessoes.humano_desde < now() - make_interval(hours => $2)
                           THEN now() ELSE whatsapp_sessoes.humano_desde END`,
    [telefone, HUMANO_EXPIRA_HORAS],
  );
}

/** A equipa respondeu: a pausa do bot conta de novo a partir de agora. */
export async function refrescarHumanoWhatsapp(c: Consulta, telefone: string, por: string) {
  await one(
    c,
    `INSERT INTO whatsapp_sessoes (telefone, passo, humano_desde, humano_por, lida_em, actualizado_em) VALUES ($1, 'menu', now(), $2, now(), now())
     ON CONFLICT (telefone) DO UPDATE SET humano_desde = now(), humano_por = $2, lida_em = now(), actualizado_em = now()`,
    [telefone, por],
  );
}

/** Devolve a conversa ao assistente automático. */
export async function libertarHumanoWhatsapp(c: Consulta, telefone: string) {
  await one(c, "UPDATE whatsapp_sessoes SET humano_desde = NULL, humano_por = NULL, passo = 'menu', dados = '{}'::jsonb WHERE telefone = $1", [telefone]);
}

export async function marcarLidaWhatsapp(c: Consulta, telefone: string) {
  await one(c, "UPDATE whatsapp_sessoes SET lida_em = now() WHERE telefone = $1", [telefone]);
}

export async function gravarNomePerfilWhatsapp(c: Consulta, telefone: string, nome: string) {
  await one(
    c,
    `INSERT INTO whatsapp_sessoes (telefone, nome_perfil, actualizado_em) VALUES ($1, $2, now())
     ON CONFLICT (telefone) DO UPDATE SET nome_perfil = EXCLUDED.nome_perfil`,
    [telefone, nome.slice(0, 120)],
  );
}

/** Quando chegou a última mensagem da pessoa (as respostas livres só valem até 24 horas depois). */
export function ultimaEntradaWhatsapp(c: Consulta, telefone: string) {
  return valor<string>(c, "SELECT max(created_at)::text FROM whatsapp_mensagens WHERE telefone = $1 AND direccao = 'in'", [telefone]);
}

export type ConversaResumo = {
  telefone: string; nome_perfil: string | null; humano_desde: string | null; humano_por: string | null;
  ultima_em: string; ultima: string; ultima_direccao: string; ultima_entrada: string | null; por_ler: number;
};

/** Conversas, as mais recentes primeiro; as que pedem uma pessoa vêm à frente. */
export function conversasWhatsapp(c: Consulta, limite = 200) {
  return many<ConversaResumo>(
    c,
    `WITH ult AS (
       SELECT DISTINCT ON (telefone) telefone, corpo, direccao, created_at
         FROM whatsapp_mensagens ORDER BY telefone, id DESC
     )
     SELECT u.telefone, s.nome_perfil, s.humano_desde::text AS humano_desde, s.humano_por,
            u.created_at::text AS ultima_em, left(u.corpo, 160) AS ultima, u.direccao AS ultima_direccao,
            (SELECT max(created_at)::text FROM whatsapp_mensagens m WHERE m.telefone = u.telefone AND m.direccao = 'in') AS ultima_entrada,
            (SELECT count(*)::int FROM whatsapp_mensagens m WHERE m.telefone = u.telefone AND m.direccao = 'in'
               AND m.created_at > COALESCE(s.lida_em, '-infinity'::timestamptz)) AS por_ler
       FROM ult u LEFT JOIN whatsapp_sessoes s ON s.telefone = u.telefone
      ORDER BY (s.humano_desde IS NOT NULL AND s.humano_desde > now() - make_interval(hours => $2)) DESC, u.created_at DESC
      LIMIT $1`,
    [limite, HUMANO_EXPIRA_HORAS],
  );
}

export async function gravarSessaoWhatsapp(c: Consulta, telefone: string, passo: string, dados: unknown, leadId: number | null) {
  await one(
    c,
    `INSERT INTO whatsapp_sessoes (telefone, passo, dados, lead_id, actualizado_em) VALUES ($1, $2, $3::jsonb, $4, now())
     ON CONFLICT (telefone) DO UPDATE SET passo = EXCLUDED.passo, dados = EXCLUDED.dados, lead_id = EXCLUDED.lead_id, actualizado_em = now()`,
    [telefone, passo, JSON.stringify(dados), leadId],
  );
}

export async function registarMensagemWhatsapp(c: Consulta, telefone: string, direccao: "in" | "out", corpo: string, wamid?: string, autor?: string) {
  await one(
    c, "INSERT INTO whatsapp_mensagens (telefone, direccao, corpo, wamid, autor) VALUES ($1, $2, $3, $4, $5)",
    [telefone, direccao, corpo.slice(0, 4000), wamid || null, autor || null],
  );
}

export async function wamidJaVisto(c: Consulta, wamid: string) {
  return Boolean(await one(c, "SELECT 1 FROM whatsapp_mensagens WHERE wamid = $1 LIMIT 1", [wamid]));
}

/** As últimas mensagens da conversa, pela ordem em que aconteceram. */
export function conversaWhatsapp(c: Consulta, telefone: string, limite = 200) {
  return many<{ direccao: string; corpo: string; created_at: string; autor: string | null }>(
    c,
    `SELECT direccao, corpo, created_at, autor FROM (
       SELECT id, direccao, corpo, created_at::text AS created_at, autor FROM whatsapp_mensagens
        WHERE telefone = $1 ORDER BY id DESC LIMIT $2
     ) x ORDER BY id ASC`,
    [telefone, limite],
  );
}

/** Pré-inscrições com este telefone (últimos 9 dígitos, com ou sem indicativo). */
export function leadsPorTelefoneWhatsapp(c: Consulta, telefone: string, ultimos9: string) {
  return many<Record<string, unknown>>(
    c,
    "SELECT * FROM preinscricoes WHERE telf LIKE $1 OR telf LIKE $2 OR telf LIKE $3 ORDER BY id DESC LIMIT 8",
    [`%${ultimos9}%`, `%351${ultimos9}%`, `%${telefone}%`],
  );
}
