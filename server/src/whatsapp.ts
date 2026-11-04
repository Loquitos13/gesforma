/** WhatsApp (Meta Cloud API): credenciais, envio, webhook e rotas da configuração e do simulador. */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { config, newToken } from "./config.js";
import type { Db } from "./db/pool.js";
import { openSecret, sealSecret } from "./secretBox.js";
import {
  apagarConversaWhatsapp, apagarWhatsapp, contarSessoesWhatsapp, conversasWhatsapp, conversaWhatsapp, gravarWhatsapp, HUMANO_EXPIRA_HORAS,
  conversasPorLerWhatsapp, leadsPorTelefoneWhatsapp, libertarHumanoWhatsapp, pedidosPendentesWhatsapp, marcarLidaWhatsapp, refrescarHumanoWhatsapp, registarMensagemWhatsapp,
  sessaoWhatsapp, ultimaEntradaWhatsapp, whatsappGuardado,
} from "./repos/whatsapp.js";
import { sanitizeText } from "./security.js";
import { fecharConversaWhatsapp, verificarInatividade } from "./whatsappInatividade.js";
import { digitsPhone, handleWhatsappText, type Resposta } from "./whatsappBot.js";

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

const corta = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);

/**
 * Corpo da mensagem para a Cloud API: botões (até 3 opções com títulos curtos), lista (até 10) ou, se não couber, o
 * texto com as opções numeradas (a pessoa responde com o número).
 */
export function corpoCloudApi(to: string, r: Resposta): Record<string, unknown> {
  const base = { messaging_product: "whatsapp", recipient_type: "individual", to };
  if (typeof r === "string" || !r.opcoes.length || r.opcoes.length > 10) {
    return { ...base, type: "text", text: { body: corta(typeof r === "string" ? r : r.simples, 4000), preview_url: false } };
  }
  const body = { text: corta(r.texto, 1024) };
  const footer = r.rodape && r.rodape.length <= 60 ? { footer: { text: r.rodape } } : {};
  if (r.opcoes.length <= 3 && r.opcoes.every(o => o.titulo.length <= 20)) {
    return {
      ...base, type: "interactive",
      interactive: {
        type: "button", body, ...footer,
        action: { buttons: r.opcoes.map(o => ({ type: "reply", reply: { id: o.id, title: o.titulo } })) },
      },
    };
  }
  return {
    ...base, type: "interactive",
    interactive: {
      type: "list", body, ...footer,
      action: {
        button: corta(r.botao || "Escolher", 20),
        sections: [{
          title: "Opções",
          rows: r.opcoes.map(o => {
            // Título curto (24); o nome completo vai na descrição quando não cabe.
            const descricao = o.descricao ?? (o.titulo.length > 24 ? o.titulo : "");
            return { id: o.id, title: corta(o.titulo, 24), ...(descricao ? { description: corta(descricao, 72) } : {}) };
          }),
        }],
      },
    },
  };
}

/** Anexos que a equipa pode enviar (a Meta aceita imagens até 5 MB; o resto vai como documento, até 15 MB aqui). */
export const ANEXO_MAX_BYTES = 15 * 1024 * 1024;
const IMAGEM_MAX_BYTES = 5 * 1024 * 1024;

/** O tipo do ficheiro pelos primeiros bytes (não pelo que o navegador diz). */
export function tipoAnexo(bytes: Buffer, nome: string): { mime: string; imagem: boolean } | null {
  const ext = nome.toLowerCase().split(".").pop() ?? "";
  if (bytes.subarray(0, 4).toString("latin1") === "%PDF") return { mime: "application/pdf", imagem: false };
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: "image/jpeg", imagem: bytes.length <= IMAGEM_MAX_BYTES };
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: "image/png", imagem: bytes.length <= IMAGEM_MAX_BYTES };
  if (bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) {
    if (ext === "docx") return { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", imagem: false };
    if (ext === "xlsx") return { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", imagem: false };
  }
  return null;
}

/** Carrega o ficheiro na Meta e envia-o (imagem ou documento) com a legenda. */
async function enviarAnexoCloudApi(db: Db, to: string, a: { bytes: Buffer; nome: string; mime: string; imagem: boolean; legenda: string }) {
  const c = await whatsappCreds(db);
  if (!c.token || !c.phoneId) return { sent: false as const };
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", a.mime);
  form.append("file", new Blob([new Uint8Array(a.bytes)], { type: a.mime }), a.nome);
  const up = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(c.phoneId)}/media`, {
    method: "POST", headers: { Authorization: `Bearer ${c.token}` }, body: form,
  });
  const upJson = await up.json().catch(() => ({})) as { id?: string };
  if (!up.ok || !upJson.id) return { sent: false as const, error: `media: ${JSON.stringify(upJson).slice(0, 300)}` };
  const legenda = a.legenda ? { caption: a.legenda.slice(0, 1024) } : {};
  const corpo = a.imagem
    ? { type: "image", image: { id: upJson.id, ...legenda } }
    : { type: "document", document: { id: upJson.id, filename: a.nome, ...legenda } };
  const res = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(c.phoneId)}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, ...corpo }),
  });
  if (!res.ok) return { sent: false as const, error: (await res.text().catch(() => "")).slice(0, 300) };
  return { sent: true as const };
}

/** Regras de inatividade (a cada minuto, dentro da API): só com o WhatsApp ligado. */
export async function verificarInatividadeWhatsapp(db: Db) {
  if (!(await whatsappLigado(db))) return null;
  return verificarInatividade(db, (to, m) => enviarCloudApi(db, to, m));
}

async function enviarCloudApi(db: Db, to: string, mensagem: Resposta) {
  const c = await whatsappCreds(db);
  if (!c.token || !c.phoneId) return { sent: false as const };
  const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(c.phoneId)}/messages`;
  const enviar = (corpo: Record<string, unknown>) => fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
  let res = await enviar(corpoCloudApi(to, mensagem));
  // Se a Meta recusar os botões/lista, vai em texto (as opções numeradas continuam a funcionar).
  if (!res.ok && typeof mensagem !== "string") res = await enviar(corpoCloudApi(to, mensagem.simples));
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    return { sent: false as const, error: err.slice(0, 400) };
  }
  return { sent: true as const };
}

type WaMsg = {
  from?: string;
  id?: string;
  /** Segundos desde 1970 (texto). */
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  button?: { text?: string };
  interactive?: { button_reply?: { id?: string; title?: string }; list_reply?: { id?: string; title?: string } };
};

type WaContacto = { wa_id?: string; profile?: { name?: string } };

/** Mensagens mais antigas do que isto não têm resposta: são entregas atrasadas (a Meta repete as que falharam durante dias). */
export const WHATSAPP_ANTIGA_MIN = 15;

export type Entrada = { from: string; text: string; wamid: string; nome: string; rotulo: string; ts: number };

export function extractIncoming(body: unknown): Entrada[] {
  const out: Entrada[] = [];
  const root = body as { entry?: Array<{ changes?: Array<{ value?: {
    messages?: WaMsg[]; contacts?: WaContacto[]; metadata?: { display_phone_number?: string };
  } }> }> };
  for (const entry of root.entry ?? []) {
    for (const change of entry.changes ?? []) {
      // O nome do perfil de WhatsApp da pessoa (para a caixa de conversas).
      const nomes = new Map((change.value?.contacts ?? []).map(c => [c.wa_id ?? "", c.profile?.name ?? ""]));
      // Nunca responder ao próprio número da ENA (evita conversas do bot consigo mesmo).
      const proprio = (change.value?.metadata?.display_phone_number ?? "").replace(/\D/g, "");
      for (const m of change.value?.messages ?? []) {
        if (proprio && (m.from ?? "").replace(/\D/g, "") === proprio) continue;
        // Botão ou linha de lista tocados: conta o id da opção (o número ou «sim»/«menu»); o título fica no histórico.
        const escolha = m.interactive?.button_reply ?? m.interactive?.list_reply;
        const text = escolha?.id || escolha?.title || m.text?.body || m.button?.text || "";
        const rotulo = escolha?.title ?? "";
        if (m.from && text) out.push({ from: m.from, text, wamid: m.id ?? "", nome: nomes.get(m.from) ?? "", rotulo, ts: Number(m.timestamp) || 0 });
      }
    }
  }
  return out;
}

/** A Meta só deixa mandar texto livre até 24 horas depois da última mensagem da pessoa. */
export function dentroDas24h(ultimaEntrada: string | null | undefined) {
  if (!ultimaEntrada) return false;
  const t = new Date(ultimaEntrada).getTime();
  return Number.isFinite(t) && Date.now() - t < 24 * 3600_000;
}

/** Mensagens tratadas por pedido do webhook: o Meta manda poucas de cada vez; mais do que isto é abuso. */
export const WHATSAPP_MAX_MENSAGENS = 10;

/** Confirma a assinatura do Meta (HMAC-SHA256 do corpo tal como chegou, com o app secret). */
export function assinaturaWhatsappValida(corpo: string, assinatura: string | undefined, segredo: string) {
  if (!segredo || !assinatura?.startsWith("sha256=")) return false;
  const recebida = Buffer.from(assinatura.slice(7), "hex");
  const esperada = createHmac("sha256", segredo).update(corpo, "utf8").digest();
  return recebida.length === esperada.length && timingSafeEqual(recebida, esperada);
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

  // O corpo cru é preciso para a assinatura: o parser de JSON fica só dentro deste contexto.
  app.register(async scope => {
    scope.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) => {
      done(null, { raw: String(body) });
    });
    scope.post("/v1/public/whatsapp/webhook", {
      config: { rateLimit: { max: 80, timeWindow: "1 minute" } },
    }, async (req, reply) => {
      const segredo = config.whatsappAppSecret;
      if (!segredo) {
        req.log.error("webhook WhatsApp recusado: defina WHATSAPP_APP_SECRET (app secret da aplicação Meta)");
        return reply.code(503).send({ error: "webhook sem app secret" });
      }
      const raw = (req.body as { raw?: string } | undefined)?.raw ?? "";
      const assinatura = req.headers["x-hub-signature-256"];
      if (!assinaturaWhatsappValida(raw, Array.isArray(assinatura) ? assinatura[0] : assinatura, segredo)) {
        req.log.warn("webhook WhatsApp com assinatura inválida");
        return reply.code(401).send({ error: "assinatura inválida" });
      }
      let body: unknown;
      try { body = JSON.parse(raw); } catch { return reply.code(400).send({ error: "JSON inválido" }); }
      const incoming = extractIncoming(body).slice(0, WHATSAPP_MAX_MENSAGENS);
      for (const msg of incoming) {
        if (msg.ts && Date.now() / 1000 - msg.ts > WHATSAPP_ANTIGA_MIN * 60) {
          req.log.info({ wamid: msg.wamid, idadeMin: Math.round((Date.now() / 1000 - msg.ts) / 60) }, "WhatsApp: mensagem atrasada ignorada");
          continue;
        }
        const out = await handleWhatsappText(db, msg.from, msg.text, msg.wamid, msg.nome, msg.rotulo);
        for (const m of out.mensagens) {
          await enviarCloudApi(db, out.telefone, m);
        }
      }
      return { ok: true };
    });
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

  // Pedidos para falar com a equipa à espera de resposta (contador no menu e alerta no ecrã), com a área de cada um:
  // a da pré-inscrição com este número; sem ela, null (conta para Gold e Financiada).
  app.get("/v1/crm/whatsapp/pendentes", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    // A área de cada número: a da pré-inscrição com este número; sem ela, null (conta para Gold e Financiada).
    const areas = new Map<string, { nome: string; regime: "gold" | "fin" | null }>();
    const areaDe = async (telefone: string) => {
      if (!areas.has(telefone)) {
        const n9 = telefone.slice(-9);
        const lead = n9.length === 9 ? (await leadsPorTelefoneWhatsapp(db, telefone, n9))[0] : undefined;
        areas.set(telefone, {
          nome: lead ? `${lead.nome ?? ""} ${lead.apelido ?? ""}`.trim() : "",
          regime: lead ? (String(lead.regime) === "fin" ? "fin" : "gold") : null,
        });
      }
      return areas.get(telefone)!;
    };
    const pendentes = [];
    for (const r of await pedidosPendentesWhatsapp(db)) {
      const a = await areaDe(r.telefone);
      pendentes.push({ telefone: r.telefone, nome: a.nome || r.nome_perfil || "", regime: a.regime, desde: r.humano_desde });
    }
    // Conversas com mensagens por ler (contador do menu); as que começaram há pouco e ninguém abriu dão o alerta.
    const porLer = [];
    for (const r of await conversasPorLerWhatsapp(db)) {
      const a = await areaDe(r.telefone);
      const nova = Boolean(r.conversa_iniciada_em) && (!r.lida_em || r.lida_em < r.conversa_iniciada_em!);
      porLer.push({
        telefone: r.telefone, nome: a.nome || r.nome_perfil || "", regime: a.regime, porLer: r.por_ler,
        novaDesde: nova ? r.conversa_iniciada_em : null,
      });
    }
    return { pendentes, porLer };
  });

  // Caixa de conversas: todas as conversas, as que pedem uma pessoa à frente.
  app.get("/v1/crm/whatsapp/conversas", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const rows = await conversasWhatsapp(db);
    const agora = Date.now();
    return {
      ligado: await whatsappLigado(db),
      conversas: rows.map(r => ({
        telefone: r.telefone,
        nome: r.nome_perfil || "",
        humano: Boolean(r.humano_desde) && agora - new Date(r.humano_desde!).getTime() < HUMANO_EXPIRA_HORAS * 3600_000,
        humanoPor: r.humano_por || "",
        ultima: r.ultima,
        ultimaDireccao: r.ultima_direccao,
        ultimaEm: r.ultima_em,
        podeResponder: dentroDas24h(r.ultima_entrada),
        porLer: r.por_ler,
        fechada: Boolean(r.fechada_em),
        fechadaPor: r.fechada_por || "",
      })),
    };
  });

  app.get("/v1/crm/whatsapp/conversa", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const tel = digitsPhone(String((req.query as { telefone?: string }).telefone ?? ""));
    if (!tel) return { mensagens: [] };
    const [rows, sessao, ultima] = await Promise.all([conversaWhatsapp(db, tel), sessaoWhatsapp(db, tel), ultimaEntradaWhatsapp(db, tel)]);
    await marcarLidaWhatsapp(db, tel);
    const n9 = tel.slice(-9);
    const leads = n9.length === 9 ? await leadsPorTelefoneWhatsapp(db, tel, n9) : [];
    return {
      telefone: tel,
      humano: Boolean(sessao?.humano_desde) && Date.now() - new Date(sessao!.humano_desde!).getTime() < HUMANO_EXPIRA_HORAS * 3600_000,
      podeResponder: dentroDas24h(ultima),
      ultimaEntrada: ultima ?? null,
      fechada: Boolean(sessao?.fechada_em),
      fechadaPor: sessao?.fechada_por || "",
      leads: leads.map(l => ({
        id: Number(l.id), nome: `${l.nome ?? ""} ${l.apelido ?? ""}`.trim(), curso: String(l.curso ?? ""),
        estado: String(l.estado ?? ""), regime: String(l.regime ?? "gold") === "fin" ? "fin" : "gold",
      })),
      mensagens: rows.map(r => ({
        direccao: r.direccao,
        corpo: r.corpo,
        createdAt: r.created_at,
        autor: r.autor ?? "",
      })),
    };
  });

  // Resposta de uma pessoa da equipa (texto livre: só até 24 horas depois da última mensagem da pessoa).
  app.post("/v1/crm/whatsapp/responder", {
    config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const parsed = z.object({
      telefone: z.string().trim().min(9).max(20),
      texto: z.string().trim().min(1).max(4000),
    }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Escreva a mensagem." });
    const tel = digitsPhone(parsed.data.telefone);
    const texto = sanitizeText(parsed.data.texto, 4000).trim();
    if (!tel || !texto) return reply.code(400).send({ error: "Escreva a mensagem." });
    if (!(await whatsappLigado(db))) return reply.code(409).send({ error: "O WhatsApp não está ligado (Configurações › Integrações)." });
    if (!dentroDas24h(await ultimaEntradaWhatsapp(db, tel))) {
      return reply.code(409).send({
        error: "Passaram mais de 24 horas desde a última mensagem desta pessoa: o WhatsApp não deixa responder com texto livre. Ligue-lhe ou envie um email.",
      });
    }
    const envio = await enviarCloudApi(db, tel, texto);
    if (!envio.sent) {
      req.log.warn({ erro: envio.error }, "resposta WhatsApp não enviada");
      return reply.code(502).send({ error: "O WhatsApp recusou a mensagem. Tente outra vez daqui a pouco." });
    }
    const autor = req.actor?.name || req.actor?.email || "Equipa";
    await registarMensagemWhatsapp(db, tel, "out", texto, undefined, autor);
    // Quem responde fica com a conversa: o bot continua em pausa.
    await refrescarHumanoWhatsapp(db, tel, autor);
    return { ok: true };
  });

  // Resposta com anexo (PDF, imagem, Word ou Excel): carrega-se na Meta (/media) e envia-se pelo id, com a legenda.
  app.post("/v1/crm/whatsapp/anexo", {
    config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    let bytes: Buffer | null = null;
    let nome = "anexo";
    const campos: Record<string, string> = {};
    try {
      for await (const part of req.parts()) {
        if (part.type === "file") { nome = part.filename || nome; bytes = await part.toBuffer(); }
        else campos[part.fieldname] = String(part.value ?? "").slice(0, 1024);
      }
    } catch {
      return reply.code(400).send({ error: "upload inválido" });
    }
    const tel = digitsPhone(campos.telefone ?? "");
    if (!tel) return reply.code(400).send({ error: "telefone em falta" });
    if (!bytes?.length) return reply.code(400).send({ error: "Escolha o ficheiro." });
    const tipo = tipoAnexo(bytes, nome);
    if (!tipo) return reply.code(400).send({ error: "Só PDF, imagens (JPG, PNG), Word ou Excel." });
    if (bytes.length > ANEXO_MAX_BYTES) return reply.code(400).send({ error: "O ficheiro tem mais de 15 MB." });
    if (!(await whatsappLigado(db))) return reply.code(409).send({ error: "O WhatsApp não está ligado (Configurações › Integrações)." });
    if (!dentroDas24h(await ultimaEntradaWhatsapp(db, tel))) {
      return reply.code(409).send({
        error: "Passaram mais de 24 horas desde a última mensagem desta pessoa: o WhatsApp não deixa enviar nada. Ligue-lhe ou envie um email.",
      });
    }
    const legenda = sanitizeText(campos.legenda ?? "", 1024).trim();
    const nomeLimpo = nome.replace(/[\\/\r\n]/g, "_").slice(0, 120);
    const envio = await enviarAnexoCloudApi(db, tel, { bytes, nome: nomeLimpo, ...tipo, legenda });
    if (!envio.sent) {
      req.log.warn({ erro: envio.error }, "anexo WhatsApp não enviado");
      return reply.code(502).send({ error: "O WhatsApp recusou o ficheiro. Tente outra vez daqui a pouco." });
    }
    const autor = req.actor?.name || req.actor?.email || "Equipa";
    await registarMensagemWhatsapp(db, tel, "out", `📎 ${nomeLimpo}${legenda ? `\n${legenda}` : ""}`, undefined, autor);
    await refrescarHumanoWhatsapp(db, tel, autor);
    return { ok: true };
  });

  // Devolve a conversa ao assistente automático (a pessoa recebe o menu na próxima mensagem).
  app.post("/v1/crm/whatsapp/devolver", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const tel = digitsPhone(String((req.body as { telefone?: string } | undefined)?.telefone ?? ""));
    if (!tel) return reply.code(400).send({ error: "telefone em falta" });
    await libertarHumanoWhatsapp(db, tel);
    return { ok: true };
  });

  // Fechar a conversa: despedida à pessoa (dentro das 24 horas), o assistente volta a responder; o histórico fica.
  app.post("/v1/crm/whatsapp/fechar", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const tel = digitsPhone(String((req.body as { telefone?: string } | undefined)?.telefone ?? ""));
    if (!tel) return reply.code(400).send({ error: "telefone em falta" });
    const r = await fecharConversaWhatsapp(db, tel, req.actor?.name || req.actor?.email || "Equipa", (to, m) => enviarCloudApi(db, to, m));
    return { ok: true, ...r };
  });

  // Eliminar a conversa de vez (mensagens e estado). Se a pessoa voltar a escrever, começa uma conversa nova.
  app.delete("/v1/crm/whatsapp/conversa", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const tel = digitsPhone(String((req.query as { telefone?: string }).telefone ?? ""));
    if (!tel) return reply.code(400).send({ error: "telefone em falta" });
    await apagarConversaWhatsapp(db, tel);
    req.log.info({ por: req.actor?.email, telefone: `…${tel.slice(-3)}` }, "conversa WhatsApp eliminada");
    return { ok: true };
  });

  // Ficar com a conversa (pausa o bot) sem esperar que a pessoa o peça.
  app.post("/v1/crm/whatsapp/assumir", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const tel = digitsPhone(String((req.body as { telefone?: string } | undefined)?.telefone ?? ""));
    if (!tel) return reply.code(400).send({ error: "telefone em falta" });
    await refrescarHumanoWhatsapp(db, tel, req.actor?.name || req.actor?.email || "Equipa");
    return { ok: true };
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
