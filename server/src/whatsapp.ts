/** WhatsApp (Meta Cloud API): credenciais, envio, webhook e rotas da configuração e do simulador. */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { config, newToken } from "./config.js";
import type { Db } from "./db/pool.js";
import { openSecret, sealSecret } from "./secretBox.js";
import { apagarWhatsapp, contarSessoesWhatsapp, conversaWhatsapp, gravarWhatsapp, whatsappGuardado } from "./repos/whatsapp.js";
import { digitsPhone, handleWhatsappText } from "./whatsappBot.js";

export { digitsPhone, handleWhatsappText } from "./whatsappBot.js";

export type WhatsappCreds = {
  token: string;
  phoneId: string;
  verifyToken: string;
  displayPhone: string;
  fromEnv: boolean;
  hasToken: boolean;
};

type StoredWa = {
  token_sealed: string | null;
  phone_id: string | null;
  verify_token: string | null;
  display_phone: string | null;
};

async function storedWhatsapp(db: Db): Promise<StoredWa | null> {
  return whatsappGuardado(db);
}

export async function whatsappCreds(db: Db): Promise<WhatsappCreds> {
  const stored = await storedWhatsapp(db).catch(() => null);
  let storedToken = "";
  if (stored?.token_sealed) {
    try { storedToken = openSecret(stored.token_sealed); } catch { storedToken = ""; }
  }
  const fromEnv = Boolean(config.whatsappToken);
  const token = config.whatsappToken || storedToken;
  const phoneId = config.whatsappPhoneId || stored?.phone_id || "";
  const verifyToken = config.whatsappVerifyToken || stored?.verify_token || "";
  return {
    token,
    phoneId,
    verifyToken,
    displayPhone: stored?.display_phone || "",
    fromEnv,
    hasToken: Boolean(token),
  };
}

export async function whatsappLigado(db: Db) {
  const c = await whatsappCreds(db);
  return Boolean(c.token && c.phoneId);
}

function whatsappStatusPayload(c: WhatsappCreds, sessoes: number) {
  const ligado = Boolean(c.token && c.phoneId);
  let hint = "Cole o token temporário da página API Setup do Meta e grave. O número de teste é lido automaticamente.";
  if (c.fromEnv) hint = "Token definido por variáveis de ambiente no servidor.";
  else if (ligado) hint = "Token gravado. As respostas do bot saem para o telemóvel de teste. No Meta, aponte o webhook com o verify token abaixo.";
  else if (c.hasToken) hint = "Token gravado, mas o Meta não devolveu o Phone number ID. Cole-o (está ao lado do token na API Setup) só se as mensagens não saírem.";
  return {
    ligado,
    hasToken: c.hasToken,
    fromEnv: c.fromEnv,
    phoneId: c.phoneId,
    displayPhone: c.displayPhone,
    verifyToken: c.verifyToken,
    sessoes,
    webhook: `${config.appOrigin}/api/v1/public/whatsapp/webhook`,
    hint,
  };
}

async function graphGet(path: string, token: string) {
  const url = path.startsWith("http") ? path : `https://graph.facebook.com/v21.0/${path}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const raw = await res.text();
  try {
    return { ok: res.ok, data: JSON.parse(raw) as Record<string, unknown> };
  } catch {
    return { ok: res.ok, data: {} };
  }
}

function idsFromDebug(data: Record<string, unknown>) {
  const ids: string[] = [];
  const inner = (data.data ?? data) as Record<string, unknown>;
  if (inner.profile_id) ids.push(String(inner.profile_id));
  if (inner.app_id) ids.push(String(inner.app_id));
  const scopes = Array.isArray(inner.granular_scopes) ? inner.granular_scopes : [];
  for (const s of scopes) {
    const row = s as { target_ids?: unknown[] };
    for (const t of row.target_ids ?? []) ids.push(String(t));
  }
  return ids.filter(id => /^\d+$/.test(id));
}

export async function detectarNumeroWhatsapp(token: string) {
  const debug = await graphGet(
    `debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(token)}`,
    token,
  );
  const ids = idsFromDebug(debug.data);
  const me = await graphGet("me?fields=id", token);
  if (typeof me.data.id === "string" || typeof me.data.id === "number") ids.push(String(me.data.id));

  for (const id of [...new Set(ids)]) {
    const phones = await graphGet(`${id}/phone_numbers?fields=id,display_phone_number,verified_name`, token);
    const list = Array.isArray(phones.data.data) ? phones.data.data as Array<Record<string, unknown>> : [];
    const first = list[0];
    if (first?.id) {
      return { phoneId: String(first.id), displayPhone: String(first.display_phone_number ?? "") };
    }
    const one = await graphGet(`${id}?fields=id,display_phone_number`, token);
    if (one.data.display_phone_number && one.data.id) {
      return { phoneId: String(one.data.id), displayPhone: String(one.data.display_phone_number) };
    }
  }
  return { phoneId: "", displayPhone: "" };
}

async function saveWhatsappConfig(
  db: Db,
  patch: { token?: string; phoneId?: string; displayPhone?: string; verifyToken?: string },
) {
  const prev = await whatsappCreds(db);
  const token = (patch.token ?? prev.token).trim();
  if (!token || token.length < 20) throw new Error("Cole o token da Cloud API (mínimo 20 caracteres).");
  const phoneId = (patch.phoneId ?? prev.phoneId).trim();
  const displayPhone = (patch.displayPhone ?? prev.displayPhone).trim();
  const verifyToken = (patch.verifyToken ?? prev.verifyToken).trim() || `ena-wa-${newToken(12)}`;
  await gravarWhatsapp(db, { tokenSealed: sealSecret(token), phoneId, verifyToken, displayPhone });
  return whatsappCreds(db);
}

async function enviarCloudApi(db: Db, to: string, body: string) {
  const c = await whatsappCreds(db);
  if (!c.token || !c.phoneId) return { sent: false as const };
  const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(c.phoneId)}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${c.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: body.slice(0, 4000), preview_url: false },
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    return { sent: false as const, error: err.slice(0, 400) };
  }
  return { sent: true as const };
}

type WaMsg = {
  from?: string;
  id?: string;
  type?: string;
  text?: { body?: string };
  button?: { text?: string };
  interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
};

function extractIncoming(body: unknown): { from: string; text: string; wamid: string }[] {
  const out: { from: string; text: string; wamid: string }[] = [];
  const root = body as { entry?: Array<{ changes?: Array<{ value?: { messages?: WaMsg[] } }> }> };
  for (const entry of root.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const m of change.value?.messages ?? []) {
        const text = m.text?.body
          || m.button?.text
          || m.interactive?.button_reply?.title
          || m.interactive?.list_reply?.title
          || "";
        if (m.from && text) out.push({ from: m.from, text, wamid: m.id ?? "" });
      }
    }
  }
  return out;
}

export function registerWhatsappRoutes(
  app: FastifyInstance,
  db: Db,
  helpers: {
    requireAuth: (req: FastifyRequest, reply: FastifyReply) => boolean;
  },
) {
  const { requireAuth } = helpers;

  app.get("/v1/public/whatsapp/webhook", {
    config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const q = req.query as Record<string, string | undefined>;
    const mode = q["hub.mode"] ?? "";
    const token = q["hub.verify_token"] ?? "";
    const challenge = q["hub.challenge"] ?? "";
    const creds = await whatsappCreds(db);
    if (mode === "subscribe" && creds.verifyToken && token === creds.verifyToken) {
      return reply.type("text/plain").send(challenge);
    }
    return reply.code(403).send("verify token inválido");
  });

  app.post("/v1/public/whatsapp/webhook", {
    config: { rateLimit: { max: 80, timeWindow: "1 minute" } },
  }, async (req) => {
    const incoming = extractIncoming(req.body);
    for (const msg of incoming) {
      const out = await handleWhatsappText(db, msg.from, msg.text, msg.wamid);
      for (const line of out.replies) {
        await enviarCloudApi(db, out.telefone, line);
      }
    }
    return { ok: true };
  });

  app.get("/v1/crm/whatsapp", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const n = await contarSessoesWhatsapp(db);
    const c = await whatsappCreds(db);
    return whatsappStatusPayload(c, n);
  });

  app.put("/v1/crm/whatsapp/config", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if ((await whatsappCreds(db)).fromEnv) {
      return reply.code(409).send({ error: "Token definido no servidor (WHATSAPP_TOKEN). Remova a variável para gravar aqui." });
    }
    const parsed = z.object({
      token: z.string().trim().max(4000).optional(),
      phoneId: z.string().trim().max(40).optional(),
    }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Cole o token da Cloud API (página API Setup do Meta)." });
    try {
      const prev = await whatsappCreds(db);
      const token = (parsed.data.token ?? "").trim() || prev.token;
      if (!token || token.length < 20) {
        return reply.code(400).send({ error: "Cole o token da Cloud API (página API Setup do Meta)." });
      }
      let phoneId = (parsed.data.phoneId ?? "").trim() || prev.phoneId;
      let displayPhone = prev.displayPhone;
      const tokenNovo = Boolean((parsed.data.token ?? "").trim() && (parsed.data.token ?? "").trim() !== prev.token);
      if (!phoneId || tokenNovo) {
        const det = await detectarNumeroWhatsapp(token).catch(() => ({ phoneId: "", displayPhone: "" }));
        if (det.phoneId) {
          phoneId = det.phoneId;
          displayPhone = det.displayPhone;
        }
      }
      const c = await saveWhatsappConfig(db, {
        token,
        phoneId,
        displayPhone,
      });
      const n = await contarSessoesWhatsapp(db);
      return whatsappStatusPayload(c, n);
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "Não foi possível gravar o token." });
    }
  });

  app.post("/v1/crm/whatsapp/desligar", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if ((await whatsappCreds(db)).fromEnv) {
      return reply.code(409).send({ error: "Token definido no servidor." });
    }
    await apagarWhatsapp(db);
    const n = await contarSessoesWhatsapp(db);
    return whatsappStatusPayload(await whatsappCreds(db), n);
  });

  app.get("/v1/crm/whatsapp/conversa", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const tel = digitsPhone(String((req.query as { telefone?: string }).telefone ?? ""));
    if (!tel) return { mensagens: [] };
    const rows = await conversaWhatsapp(db, tel);
    return {
      telefone: tel,
      mensagens: rows.map(r => ({
        direccao: r.direccao,
        corpo: r.corpo,
        createdAt: r.created_at,
      })),
    };
  });

  app.post("/v1/crm/whatsapp/simular", {
    config: { rateLimit: { max: 40, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const parsed = z.object({
      telefone: z.string().trim().min(9).max(20),
      texto: z.string().trim().min(1).max(500),
    }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const out = await handleWhatsappText(db, parsed.data.telefone, parsed.data.texto);
    return { ...out, ligado: await whatsappLigado(db) };
  });
}
