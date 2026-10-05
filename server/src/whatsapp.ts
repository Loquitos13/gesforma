import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { config, newToken } from "./config.js";
import { logLeadEvent } from "./crmDossier.js";
import type { Db } from "./db/pool.js";
import { mapPreinscricao } from "./ops.js";
import { criarPreinscricaoPublica } from "./preinscricaoPublica.js";
import { filtrarOferta, fmtDataPt, listCursosGoldActivos, listOfertaGold, uniqueOferta, type OfertaTurma } from "./ofertaGold.js";
import { openSecret, sealSecret } from "./secretBox.js";
import { isEmail, normalizeEmail, sanitizeHeader, sanitizeText } from "./security.js";

type Passo = "menu" | "nome" | "apelido" | "email" | "concelho" | "curso" | "local" | "horario" | "data" | "consulta";

type Dados = {
  nome?: string;
  apelido?: string;
  email?: string;
  concelho?: string;
  curso?: string;
  local?: string;
  horario?: string;
  dataInicio?: string;
  turmaId?: number;
};

const MENU = [
  "Olá, sou o assistente da ENA Formação.",
  "Como posso ajudar?",
  "1 · Pré-inscrição num curso (dados pessoais + curso, local, horário e data)",
  "2 · Ver o estado do meu pedido",
  "3 · Lista de cursos",
  "Escreva o número ou *menu* para voltar aqui.",
].join("\n");

export function digitsPhone(raw: string) {
  const d = raw.replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("351") && d.length >= 12) return d.slice(0, 15);
  if (d.length === 9) return `351${d}`;
  return d.slice(0, 15);
}

function last9(raw: string) {
  const d = raw.replace(/\D/g, "");
  return d.slice(-9);
}

function parseDados(raw: unknown): Dados {
  if (raw && typeof raw === "object") return raw as Dados;
  if (typeof raw === "string") {
    try { return JSON.parse(raw) as Dados; } catch { return {}; }
  }
  return {};
}

async function cursosActivos(db: Db) {
  return listCursosGoldActivos(db);
}

function pickOpcao(text: string, opcoes: string[]) {
  const n = Number(text);
  if (Number.isInteger(n) && n >= 1 && n <= opcoes.length) return opcoes[n - 1] ?? null;
  const q = text.toLowerCase();
  return opcoes.find(o => o.toLowerCase() === q)
    ?? opcoes.find(o => o.toLowerCase().includes(q) || q.includes(o.toLowerCase().slice(0, 10)))
    ?? null;
}

function listaNumerada(titulo: string, items: string[], extra = "") {
  if (!items.length) return extra || "Não há opções libertadas. Escreva *menu*.";
  return [titulo, ...items.map((c, i) => `${i + 1}. ${c}`), "", "Responda com o número."].join("\n");
}

async function leadsPorTelefone(db: Db, telefone: string) {
  const n9 = last9(telefone);
  if (n9.length < 9) return [];
  const rows = await db.query(
    `SELECT * FROM preinscricoes
     WHERE telf LIKE $1 OR telf LIKE $2 OR telf LIKE $3
     ORDER BY id DESC LIMIT 8`,
    [`%${n9}%`, `%351${n9}%`, `%${telefone}%`],
  );
  return rows.rows.map(r => mapPreinscricao(r as Record<string, unknown>));
}

function textoEstado(lead: ReturnType<typeof mapPreinscricao>) {
  const nome = `${lead.nome} ${lead.apelido}`.trim();
  const linhas = [
    `Pedido nº ${lead.id} · ${nome}`,
    `Curso: ${lead.curso || "-"}`,
    lead.local ? `Local: ${lead.local}` : "",
    lead.horario ? `Horário: ${lead.horario}` : "",
    lead.inicioCurso && lead.inicioCurso !== "-" ? `Início: ${fmtDataPt(lead.inicioCurso)}` : "",
    `Estado: ${lead.estado}`,
  ].filter(Boolean);
  if (lead.estado === "Pago" || lead.estado === "Formando" || lead.estado === "Pré-inscrição") {
    linhas.push(lead.estado === "Pré-inscrição"
      ? "O pedido está na pré-inscrição. A secretaria trata da inscrição na turma."
      : "A inscrição está confirmada do lado da secretaria. Qualquer dúvida, ligue para a ENA.");
  } else if (lead.estado === "Não contactado") {
    linhas.push("Ainda está na fila. A secretaria contacta-o em breve - não precisa de se pré-inscrever outra vez.");
  } else {
    linhas.push("Já houve contacto comercial. Se quiser actualizar dados, a secretaria trata disso.");
  }
  linhas.push("O pagamento não se confirma por aqui: só entra quando o banco (MB / MB Way) confirma.");
  return linhas.join("\n");
}

async function getSessao(db: Db, telefone: string) {
  const row = await db.query<{ passo: string; dados: unknown; lead_id: number | null }>(
    "SELECT passo, dados, lead_id FROM whatsapp_sessoes WHERE telefone = $1",
    [telefone],
  );
  const r = row.rows[0];
  return {
    passo: (r?.passo ?? "menu") as Passo,
    dados: parseDados(r?.dados),
    leadId: r?.lead_id ?? null,
  };
}

async function saveSessao(db: Db, telefone: string, passo: Passo, dados: Dados, leadId: number | null) {
  await db.query(
    `INSERT INTO whatsapp_sessoes (telefone, passo, dados, lead_id, actualizado_em)
     VALUES ($1,$2,$3::jsonb,$4,now())
     ON CONFLICT (telefone) DO UPDATE SET passo = EXCLUDED.passo, dados = EXCLUDED.dados, lead_id = EXCLUDED.lead_id, actualizado_em = now()`,
    [telefone, passo, JSON.stringify(dados), leadId],
  );
}

async function logMsg(db: Db, telefone: string, direccao: "in" | "out", corpo: string, wamid?: string) {
  try {
    await db.query(
      "INSERT INTO whatsapp_mensagens (telefone, direccao, corpo, wamid) VALUES ($1,$2,$3,$4)",
      [telefone, direccao, corpo.slice(0, 4000), wamid || null],
    );
  } catch {
    /* wamid duplicado */
  }
}

async function wamidVisto(db: Db, wamid: string) {
  if (!wamid) return false;
  const row = await db.query("SELECT 1 FROM whatsapp_mensagens WHERE wamid = $1 LIMIT 1", [wamid]);
  return Boolean(row.rows[0]);
}

function isMenuCmd(t: string) {
  return /^(menu|olá|ola|oi|bom dia|boa tarde|boa noite|inicio|início|start|hi|hello)$/i.test(t);
}

export async function handleWhatsappText(db: Db, telefoneRaw: string, textRaw: string, wamid = "") {
  const telefone = digitsPhone(telefoneRaw);
  const text = sanitizeText(textRaw, 500).trim();
  const replies: string[] = [];

  if (!telefone || !text) {
    return { replies: ["Não percebi. Escreva *menu* para recomeçar."], telefone };
  }
  if (wamid && await wamidVisto(db, wamid)) {
    return { replies: [], telefone, duplicado: true };
  }

  await logMsg(db, telefone, "in", text, wamid || undefined);
  const sess = await getSessao(db, telefone);
  let passo = sess.passo;
  let dados = { ...sess.dados };
  let leadId = sess.leadId;

  const say = (m: string) => { replies.push(m); };

  if (isMenuCmd(text) || text === "0") {
    passo = "menu";
    dados = {};
    say(MENU);
    await saveSessao(db, telefone, passo, dados, leadId);
    for (const r of replies) await logMsg(db, telefone, "out", r);
    return { replies, telefone, passo, leadId };
  }

  if (passo === "menu") {
    if (text === "1" || /pr[eé]-?inscri/i.test(text) || /^inscrever/i.test(text)) {
      passo = "nome";
      say("Vamos à pré-inscrição. Qual é o *primeiro nome*?");
    } else if (text === "2" || /estado|pedido|inscri/i.test(text)) {
      const leads = await leadsPorTelefone(db, telefone);
      if (leads[0]) {
        leadId = leads[0].id;
        say(textoEstado(leads[0]));
        if (leads.length > 1) say(`Há mais ${leads.length - 1} pedido(s) neste número. A secretaria vê o histórico completo no CRM.`);
        passo = "menu";
      } else {
        passo = "consulta";
        say("Não encontro um pedido neste número. Envie o *email* da pré-inscrição, ou escreva *1* para se pré-inscrever.");
      }
    } else if (text === "3" || /curso/i.test(text)) {
      const cursos = await cursosActivos(db);
      say(listaNumerada("Cursos Gold activos:", cursos.map(c => `${c.nome} · € ${c.preco}`)));
      say("Esse valor é o do curso. O local ou o horário podem ter outro preço, e a inscrição fica com o que escolher.");
      passo = "menu";
    } else {
      say(MENU);
    }
  } else if (passo === "consulta") {
    if (text === "1") {
      passo = "nome";
      say("Qual é o *primeiro nome*?");
    } else if (isEmail(text)) {
      const email = normalizeEmail(text);
      const row = await db.query("SELECT * FROM preinscricoes WHERE lower(email) = $1 ORDER BY id DESC LIMIT 1", [email]);
      if (row.rows[0]) {
        const lead = mapPreinscricao(row.rows[0] as Record<string, unknown>);
        leadId = lead.id;
        say(textoEstado(lead));
        passo = "menu";
      } else {
        say("Não há pré-inscrição com esse email. Escreva *1* para criar uma, ou *menu*.");
      }
    } else {
      say("Envie o email, *1* para pré-inscrição, ou *menu*.");
    }
  } else if (passo === "nome") {
    dados.nome = sanitizeHeader(text).slice(0, 80);
    if (!dados.nome) say("Indique o primeiro nome.");
    else {
      passo = "apelido";
      say("E o *apelido*?");
    }
  } else if (passo === "apelido") {
    dados.apelido = sanitizeHeader(text).slice(0, 80);
    passo = "email";
    say("Qual é o *email*? (é por aqui que a secretaria confirma o pedido)");
  } else if (passo === "email") {
    if (!isEmail(text)) say("Esse email não parece válido. Tente outra vez (ex.: nome@dominio.pt).");
    else {
      dados.email = normalizeEmail(text);
      passo = "concelho";
      say("Em que *concelho* vive?");
    }
  } else if (passo === "concelho") {
    dados.concelho = sanitizeHeader(text).slice(0, 80);
    passo = "curso";
    const cursos = await cursosActivos(db);
    say("Agora os *dados do curso*. A turma é o conjunto local + horário + data de início, e só entra se estiver *liberada* (turma Gold activa).");
    say(listaNumerada("Curso a que se quer inscrever:", cursos.map(c => c.nome)));
  } else if (passo === "curso") {
    const cursos = await cursosActivos(db);
    const curso = pickOpcao(text, cursos.map(c => c.nome)) || sanitizeHeader(text).slice(0, 200);
    dados.curso = curso;
    dados.local = undefined;
    dados.horario = undefined;
    dados.dataInicio = undefined;
    const oferta = filtrarOferta(await listOfertaGold(db), { curso });
    const locais = uniqueOferta(oferta, "local");
    if (!locais.length) {
      say(`Ainda não há turma liberada para *${curso}* (falta local + horário + data). Escolha outro curso ou escreva *menu*.`);
    } else {
      passo = "local";
      say(listaNumerada(`Local para ${curso}:`, locais));
    }
  } else if (passo === "local") {
    const oferta = filtrarOferta(await listOfertaGold(db), { curso: dados.curso });
    const locais = uniqueOferta(oferta, "local");
    const local = pickOpcao(text, locais);
    if (!local) {
      say(listaNumerada("Não percebi o local. Escolha um número:", locais));
    } else {
      dados.local = local;
      dados.horario = undefined;
      dados.dataInicio = undefined;
      const horarios = uniqueOferta(filtrarOferta(oferta, { local }), "horario");
      if (!horarios.length) {
        say(`Neste local ainda não há horário liberado. Escreva *menu* ou escolha outro local.`);
      } else {
        passo = "horario";
        say(listaNumerada(`Horário em ${local}:`, horarios, "O horário depende do local e só aparece se a turma estiver activa."));
      }
    }
  } else if (passo === "horario") {
    const oferta = filtrarOferta(await listOfertaGold(db), { curso: dados.curso, local: dados.local });
    const horarios = uniqueOferta(oferta, "horario");
    const horario = pickOpcao(text, horarios);
    if (!horario) {
      say(listaNumerada("Não percebi o horário. Escolha um número:", horarios));
    } else {
      dados.horario = horario;
      const datas = oferta.filter(t => t.horario === horario);
      if (!datas.length) {
        say("Não há data de início libertada para este horário. Escreva *menu*.");
      } else {
        passo = "data";
        say(listaNumerada(
          `Data de início (${dados.local} · ${horario}):`,
          datas.map(t => `${fmtDataPt(t.dataInicio)} · ${t.nome}${t.vagasLivres ? ` · ${t.vagasLivres} vagas` : " · lotada"}`),
        ));
      }
    }
  } else if (passo === "data") {
    const oferta = filtrarOferta(await listOfertaGold(db), {
      curso: dados.curso, local: dados.local, horario: dados.horario,
    });
    const n = Number(text);
    const turma: OfertaTurma | undefined = (Number.isInteger(n) && n >= 1 && n <= oferta.length)
      ? oferta[n - 1]
      : oferta.find(t => t.dataInicio === text || fmtDataPt(t.dataInicio) === text);
    if (!turma) {
      say(listaNumerada("Escolha a data pelo número:", oferta.map(t => `${fmtDataPt(t.dataInicio)} · ${t.nome}`)));
    } else {
      dados.dataInicio = turma.dataInicio;
      dados.turmaId = turma.turmaId;
      const created = await criarPreinscricaoPublica(db, {
        nome: dados.nome || "WhatsApp",
        apelido: dados.apelido || "",
        email: dados.email || "",
        telf: telefone,
        concelho: dados.concelho || "",
        curso: turma.curso,
        local: turma.local,
        horario: turma.horario,
        inicioCurso: turma.dataInicio,
        turmaId: turma.turmaId,
        origem: "WhatsApp",
        meioContacto: "WhatsApp",
      });
      if ("error" in created) {
        say(created.error === "email inválido"
          ? "O email ficou inválido. Escreva *menu* e recomece."
          : "Essa turma já não está liberada. Escreva *menu* e escolha outra.");
        passo = "menu";
      } else {
        leadId = created.preinscricao.id;
        await logLeadEvent(db, leadId, undefined, "whatsapp", created.duplicado ? "Consulta WhatsApp" : "Pré-inscrição via WhatsApp", telefone);
        if (created.duplicado) {
          say(`Já tínhamos este email. ${created.aviso}`);
          const mapped = created.preinscricao as ReturnType<typeof mapPreinscricao>;
          if ("estado" in mapped) say(textoEstado(mapped));
        } else {
          const preco = "preco" in created.preinscricao ? Number(created.preinscricao.preco) : turma.preco;
          say(`Pré-inscrição nº ${leadId} gravada.\n${turma.curso}\n${turma.local} · ${turma.horario} · ${fmtDataPt(turma.dataInicio)}\nPreço: € ${Number.isFinite(preco) ? preco : turma.preco ?? "-"}\n${created.aviso}\n\nO pagamento *não* se faz neste chat.`);
        }
        passo = "menu";
        dados = {};
      }
    }
  }

  await saveSessao(db, telefone, passo, dados, leadId);
  for (const r of replies) await logMsg(db, telefone, "out", r);
  return { replies, telefone, passo, leadId };
}

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
  const row = await db.query<StoredWa>(
    "SELECT token_sealed, phone_id, verify_token, display_phone FROM whatsapp_config WHERE id = 'meta'",
  );
  return row.rows[0] ?? null;
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
  await db.query(
    `INSERT INTO whatsapp_config (id, token_sealed, phone_id, verify_token, display_phone, updated_at)
     VALUES ('meta', $1, $2, $3, $4, now())
     ON CONFLICT (id) DO UPDATE SET
       token_sealed = EXCLUDED.token_sealed,
       phone_id = EXCLUDED.phone_id,
       verify_token = EXCLUDED.verify_token,
       display_phone = EXCLUDED.display_phone,
       updated_at = now()`,
    [sealSecret(token), phoneId, verifyToken, displayPhone],
  );
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
    const n = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM whatsapp_sessoes");
    const c = await whatsappCreds(db);
    return whatsappStatusPayload(c, n.rows[0]?.n ?? 0);
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
      const n = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM whatsapp_sessoes");
      return whatsappStatusPayload(c, n.rows[0]?.n ?? 0);
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "Não foi possível gravar o token." });
    }
  });

  app.post("/v1/crm/whatsapp/desligar", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if ((await whatsappCreds(db)).fromEnv) {
      return reply.code(409).send({ error: "Token definido no servidor." });
    }
    await db.query("DELETE FROM whatsapp_config WHERE id = 'meta'");
    const n = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM whatsapp_sessoes");
    return whatsappStatusPayload(await whatsappCreds(db), n.rows[0]?.n ?? 0);
  });

  app.get("/v1/crm/whatsapp/conversa", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const tel = digitsPhone(String((req.query as { telefone?: string }).telefone ?? ""));
    if (!tel) return { mensagens: [] };
    const rows = await db.query<{ direccao: string; corpo: string; created_at: string }>(
      "SELECT direccao, corpo, created_at FROM whatsapp_mensagens WHERE telefone = $1 ORDER BY id ASC LIMIT 80",
      [tel],
    );
    return {
      telefone: tel,
      mensagens: rows.rows.map(r => ({
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
