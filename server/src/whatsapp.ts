import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { config } from "./config.js";
import { logLeadEvent } from "./crmDossier.js";
import type { Db } from "./db/pool.js";
import { mapPreinscricao } from "./ops.js";
import { criarPreinscricaoPublica } from "./preinscricaoPublica.js";
import { isEmail, normalizeEmail, sanitizeHeader, sanitizeText } from "./security.js";

type Passo = "menu" | "nome" | "apelido" | "email" | "concelho" | "curso" | "consulta";

type Dados = {
  nome?: string;
  apelido?: string;
  email?: string;
  concelho?: string;
  curso?: string;
};

const MENU = [
  "Olá, sou o assistente da ENA Formação.",
  "Como posso ajudar?",
  "1 · Pré-inscrição num curso",
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
  const rows = await db.query<{ nome: string; preco: number }>(
    "SELECT nome, preco FROM cursos_gold WHERE estado = 'Ativo' ORDER BY nome LIMIT 12",
  );
  return rows.rows.map(r => ({ nome: r.nome, preco: Number(r.preco) }));
}

function listaCursos(cursos: { nome: string; preco: number }[]) {
  if (!cursos.length) return "Neste momento não há cursos activos na lista. Escreva *menu*.";
  return ["Cursos Gold activos:", ...cursos.map((c, i) => `${i + 1}. ${c.nome} · € ${c.preco}`), "", "Responda com o número ou o nome do curso."].join("\n");
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
    `Estado: ${lead.estado}`,
  ];
  if (lead.estado === "Pago" || lead.estado === "Formando") {
    linhas.push("A inscrição está confirmada do lado da secretaria. Qualquer dúvida, ligue para a ENA.");
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
      say(listaCursos(await cursosActivos(db)));
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
    say(listaCursos(await cursosActivos(db)));
  } else if (passo === "curso") {
    const cursos = await cursosActivos(db);
    const n = Number(text);
    let curso = "";
    if (Number.isInteger(n) && n >= 1 && n <= cursos.length) curso = cursos[n - 1]!.nome;
    else {
      const q = text.toLowerCase();
      const hit = cursos.find(c => c.nome.toLowerCase() === q)
        ?? cursos.find(c => c.nome.toLowerCase().includes(q) || q.includes(c.nome.toLowerCase().slice(0, 12)));
      curso = hit?.nome || sanitizeHeader(text).slice(0, 200);
    }
    dados.curso = curso || "Formação de Formadores - CCP";
    const created = await criarPreinscricaoPublica(db, {
      nome: dados.nome || "WhatsApp",
      apelido: dados.apelido || "",
      email: dados.email || "",
      telf: telefone,
      concelho: dados.concelho || "",
      curso: dados.curso,
      origem: "WhatsApp",
      meioContacto: "WhatsApp",
    });
    if ("error" in created) {
      say("O email ficou inválido. Escreva *menu* e recomece.");
      passo = "menu";
    } else {
      leadId = created.preinscricao.id;
      await logLeadEvent(db, leadId, undefined, "whatsapp", created.duplicado ? "Consulta WhatsApp" : "Pré-inscrição via WhatsApp", telefone);
      if (created.duplicado) {
        say(`Já tínhamos este email. ${created.aviso}`);
        const mapped = created.preinscricao as ReturnType<typeof mapPreinscricao>;
        if ("estado" in mapped) say(textoEstado(mapped));
      } else {
        say(`Pré-inscrição nº ${leadId} gravada no CRM.\n${created.aviso}\nCurso: ${dados.curso}\n\nO pagamento *não* se faz neste chat - quando houver referência MB / MB Way, o banco confirma sozinho.`);
      }
      passo = "menu";
      dados = {};
    }
  }

  await saveSessao(db, telefone, passo, dados, leadId);
  for (const r of replies) await logMsg(db, telefone, "out", r);
  return { replies, telefone, passo, leadId };
}

export function whatsappConfigured() {
  return Boolean(config.whatsappToken && config.whatsappPhoneId && config.whatsappVerifyToken);
}

async function enviarCloudApi(to: string, body: string) {
  if (!config.whatsappToken || !config.whatsappPhoneId) return { sent: false as const };
  const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(config.whatsappPhoneId)}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.whatsappToken}`,
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
    if (mode === "subscribe" && config.whatsappVerifyToken && token === config.whatsappVerifyToken) {
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
        await enviarCloudApi(out.telefone, line);
      }
    }
    return { ok: true };
  });

  app.get("/v1/crm/whatsapp", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const n = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM whatsapp_sessoes");
    return {
      ligado: whatsappConfigured(),
      sessoes: n.rows[0]?.n ?? 0,
      webhook: `${config.appOrigin}/api/v1/public/whatsapp/webhook`,
    };
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
    return { ...out, ligado: whatsappConfigured() };
  });
}
