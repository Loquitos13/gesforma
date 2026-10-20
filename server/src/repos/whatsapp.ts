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
  return one<{ passo: string; dados: unknown; lead_id: number | null }>(
    c, "SELECT passo, dados, lead_id FROM whatsapp_sessoes WHERE telefone = $1", [telefone],
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

export async function registarMensagemWhatsapp(c: Consulta, telefone: string, direccao: "in" | "out", corpo: string, wamid?: string) {
  await one(
    c, "INSERT INTO whatsapp_mensagens (telefone, direccao, corpo, wamid) VALUES ($1, $2, $3, $4)",
    [telefone, direccao, corpo.slice(0, 4000), wamid || null],
  );
}

export async function wamidJaVisto(c: Consulta, wamid: string) {
  return Boolean(await one(c, "SELECT 1 FROM whatsapp_mensagens WHERE wamid = $1 LIMIT 1", [wamid]));
}

export function conversaWhatsapp(c: Consulta, telefone: string, limite = 80) {
  return many<{ direccao: string; corpo: string; created_at: string }>(
    c, "SELECT direccao, corpo, created_at::text AS created_at FROM whatsapp_mensagens WHERE telefone = $1 ORDER BY id ASC LIMIT $2",
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
