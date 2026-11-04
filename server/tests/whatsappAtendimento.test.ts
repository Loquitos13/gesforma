// WhatsApp: botões e listas nas respostas do assistente, pedido para falar com a equipa (bot em pausa + aviso por email)
// e caixa de conversas do CRM (a equipa responde pelo número da ENA, só até 24 horas depois da última mensagem da pessoa).
import { createHmac } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { arrancar, pedido, type Ctx } from "./helpers.js";

type Enviado = { to: string; subject: string; text: string };
const enviados = vi.hoisted(() => [] as Enviado[]);
vi.mock("../src/mailer.js", async importOriginal => ({
  ...(await importOriginal<typeof import("../src/mailer.js")>()),
  sendMail: async (_db: unknown, m: Enviado) => { enviados.push({ to: m.to, subject: m.subject, text: m.text }); return "teste"; },
}));

let ctx: Ctx;
let seq = 0;
const tel = () => `3519${String(10_000_000 + Math.floor(Math.random() * 89_000_000) + (++seq)).slice(0, 8)}`;
const pedidosMeta: Record<string, unknown>[] = [];

beforeAll(async () => {
  ctx = await arrancar();
  await ctx.db.query(
    `INSERT INTO app_settings (id, values) VALUES ('entidade', '{"email": "geral@ena.pt"}'::jsonb)
     ON CONFLICT (id) DO UPDATE SET values = app_settings.values || '{"email": "geral@ena.pt"}'::jsonb`);
  const { sealSecret } = await import("../src/secretBox.js");
  await ctx.db.query(
    `INSERT INTO whatsapp_config (id, token_sealed, phone_id, verify_token, display_phone) VALUES ('meta', $1, '123456', 'vt', '')
     ON CONFLICT (id) DO UPDATE SET token_sealed = EXCLUDED.token_sealed, phone_id = EXCLUDED.phone_id`, [sealSecret("t".repeat(40))]);
  vi.stubGlobal("fetch", async (_url: string, init?: { body?: string }) => {
    pedidosMeta.push(JSON.parse(init?.body ?? "{}"));
    return new Response(JSON.stringify({ messages: [{ id: "wamid.x" }] }), { status: 200 });
  });
});

describe("botões e listas", () => {
  it("menu em lista, consentimento em botões, mais de 10 opções em texto", async () => {
    const { corpoCloudApi } = await import("../src/whatsapp.js");
    const { handleWhatsappText } = await import("../src/whatsappBot.js");
    const t = tel();
    const out = await handleWhatsappText(ctx.db, t, "menu");
    expect(out.replies[0]).toContain("4 · Falar com uma pessoa da equipa");
    const menu = corpoCloudApi(t, out.mensagens[0]!) as { type: string; interactive: { type: string; action: { sections: { rows: { id: string; title: string }[] }[] } } };
    expect(menu.type).toBe("interactive");
    expect(menu.interactive.type).toBe("list");
    expect(menu.interactive.action.sections[0]!.rows.map(r => r.id)).toEqual(["1", "2", "3", "4"]);

    const botoes = corpoCloudApi(t, { texto: "Aceita?", opcoes: [{ id: "sim", titulo: "Sim, aceito" }, { id: "não", titulo: "Não" }], simples: "Aceita? sim/não" }) as
      { interactive: { type: string; action: { buttons: { reply: { id: string } }[] } } };
    expect(botoes.interactive.type).toBe("button");
    expect(botoes.interactive.action.buttons.map(b => b.reply.id)).toEqual(["sim", "não"]);

    const muitas = Array.from({ length: 12 }, (_, i) => ({ id: String(i + 1), titulo: `Curso ${i + 1}` }));
    const texto = corpoCloudApi(t, { texto: "Curso:", opcoes: muitas, simples: "Curso:\n1. Curso 1" }) as { type: string; text: { body: string } };
    expect(texto).toMatchObject({ type: "text", text: { body: "Curso:\n1. Curso 1" } });

    // Títulos compridos numa lista: cortados a 24, com o nome completo na descrição.
    const nome = "Formação Pedagógica Inicial de Formadores";
    const lista = corpoCloudApi(t, { texto: "Curso:", opcoes: [{ id: "1", titulo: nome }, { id: "2", titulo: "B" }, { id: "3", titulo: "C" }, { id: "4", titulo: "D" }], simples: "" }) as
      { interactive: { action: { sections: { rows: { title: string; description?: string }[] }[] } } };
    const linha = lista.interactive.action.sections[0]!.rows[0]!;
    expect(linha.title.length).toBeLessThanOrEqual(24);
    expect(linha.description).toBe(nome);
  });

  it("a resposta tocada conta pelo id; o título e o nome do perfil ficam guardados", async () => {
    const { extractIncoming } = await import("../src/whatsapp.js");
    const msgs = extractIncoming({ entry: [{ changes: [{ value: {
      contacts: [{ wa_id: "351910000001", profile: { name: "Rita" } }],
      messages: [{ from: "351910000001", id: "wamid.1", type: "interactive", interactive: { list_reply: { id: "4", title: "Falar com a equipa" } } }],
    } }] }] });
    expect(msgs).toEqual([{ from: "351910000001", text: "4", wamid: "wamid.1", nome: "Rita", rotulo: "Falar com a equipa", ts: 0 }]);
  });
});

describe("falar com uma pessoa", () => {
  it("opção 4: bot em pausa, aviso por email à equipa, caixa de conversas e resposta da equipa", async () => {
    const { handleWhatsappText } = await import("../src/whatsappBot.js");
    const t = tel();
    await handleWhatsappText(ctx.db, t, "olá", "", "Rita Lopes");
    const antes = enviados.length;
    const pede = await handleWhatsappText(ctx.db, t, "4", "", "Rita Lopes", "Falar com a equipa");
    expect(pede.humano).toBe(true);
    expect(pede.replies[0]).toMatch(/Uma pessoa da equipa da ENA vai responder-lhe aqui/);
    // Sem pré-inscrição: vai às equipas Gold (comerciais e coordenação) e Financiada; nunca à administração nem à contabilidade.
    const aviso = enviados.slice(antes);
    const equipa = (await ctx.db.query<{ email: string; role: string }>(
      "SELECT lower(email) AS email, role FROM users WHERE active = true AND role IN ('admin', 'comercial', 'secretaria', 'financiada', 'contabilidade')")).rows;
    const esperados = equipa.filter(u => ["comercial", "secretaria", "financiada"].includes(u.role)).map(u => u.email).sort();
    expect(aviso.map(m => m.to).sort()).toEqual(esperados);
    for (const m of aviso) expect(m.subject).toBe("WhatsApp: Rita Lopes quer falar com a equipa");
    expect(aviso[0]!.text).toContain(`/gesforma/gold/whatsapp?telefone=${t}`);
    // O texto do botão tocado, não o número da opção.
    expect(aviso[0]!.text).toContain("Falar com a equipa");

    // Em pausa: o bot não responde (nem a «olá») e não sai outro aviso.
    expect((await handleWhatsappText(ctx.db, t, "olá, ainda está aí?")).replies).toEqual([]);
    expect((await handleWhatsappText(ctx.db, t, "operador")).replies).toEqual([]);
    expect(enviados.length).toBe(antes + aviso.length);

    // Caixa de conversas: a que pede uma pessoa vem à frente, com as mensagens por ler.
    const lista = await pedido(ctx, "comercial", "GET", "/v1/crm/whatsapp/conversas");
    expect(lista.statusCode, lista.body).toBe(200);
    const primeira = lista.json().conversas[0];
    expect(primeira).toMatchObject({ telefone: t, nome: "Rita Lopes", humano: true, podeResponder: true });
    expect(primeira.porLer).toBeGreaterThanOrEqual(3);
    expect((await pedido(ctx, "contabilidade", "GET", "/v1/crm/whatsapp/conversas")).statusCode).toBe(403);

    const conversa = (await pedido(ctx, "financiada", "GET", `/v1/crm/whatsapp/conversa?telefone=${t}`)).json();
    expect(conversa.humano).toBe(true);
    expect(conversa.mensagens.map((m: { corpo: string }) => m.corpo)).toContain("Falar com a equipa");
    const lida = (await pedido(ctx, "comercial", "GET", "/v1/crm/whatsapp/conversas")).json().conversas.find((c: { telefone: string }) => c.telefone === t);
    expect(lida.porLer).toBe(0);

    pedidosMeta.length = 0;
    const r = await pedido(ctx, "secretaria", "POST", "/v1/crm/whatsapp/responder", { telefone: t, texto: "Olá Rita, sou a Ana da ENA. Em que posso ajudar?" });
    expect(r.statusCode, r.body).toBe(200);
    expect(pedidosMeta[0]).toMatchObject({ to: t, type: "text", text: { body: "Olá Rita, sou a Ana da ENA. Em que posso ajudar?" } });
    const depois = (await pedido(ctx, "secretaria", "GET", `/v1/crm/whatsapp/conversa?telefone=${t}`)).json();
    expect(depois.mensagens.at(-1)).toMatchObject({ direccao: "out", autor: expect.any(String) });
    expect(depois.mensagens.at(-1).autor).not.toBe("");

    // Devolver ao assistente: a mensagem seguinte já tem resposta automática.
    expect((await pedido(ctx, "secretaria", "POST", "/v1/crm/whatsapp/devolver", { telefone: t })).statusCode).toBe(200);
    expect((await handleWhatsappText(ctx.db, t, "olá")).replies[0]).toContain("Como posso ajudar?");
  });

  it("a frase do site («falar com um operador») também pede uma pessoa; *menu* devolve ao assistente", async () => {
    const { handleWhatsappText } = await import("../src/whatsappBot.js");
    const t = tel();
    const out = await handleWhatsappText(ctx.db, t, "Olá! Sou Rui. Vim do site da ENA e gostava de falar com um operador sobre o curso «CCP».");
    expect(out.humano).toBe(true);
    expect((await handleWhatsappText(ctx.db, t, "menu")).replies[0]).toContain("Como posso ajudar?");
  });

  it("sem resposta da pessoa há mais de 24 horas não se manda texto livre", async () => {
    const { handleWhatsappText } = await import("../src/whatsappBot.js");
    const t = tel();
    await handleWhatsappText(ctx.db, t, "4");
    await ctx.db.query("UPDATE whatsapp_mensagens SET created_at = now() - interval '25 hours' WHERE telefone = $1", [t]);
    const r = await pedido(ctx, "comercial", "POST", "/v1/crm/whatsapp/responder", { telefone: t, texto: "Olá" });
    expect(r.statusCode).toBe(409);
    expect(r.json().error).toMatch(/24 horas/);
    expect((await pedido(ctx, "comercial", "GET", `/v1/crm/whatsapp/conversa?telefone=${t}`)).json().podeResponder).toBe(false);
  });
});

describe("webhook: sem respostas repetidas", () => {
  it("ignora mensagens atrasadas, do próprio número e a mesma mensagem entregue duas vezes", async () => {
    const { config } = await import("../src/config.js");
    config.whatsappAppSecret = "segredo-teste-wa";
    const t = tel();
    const agora = Math.floor(Date.now() / 1000);
    const msg = (id: string, from: string, ts: number) => ({ from, id, timestamp: String(ts), type: "text", text: { body: "olá" } });
    const entregar = (mensagens: unknown[]) => {
      const corpo = JSON.stringify({ entry: [{ changes: [{ value: { metadata: { display_phone_number: "351962215550" }, messages: mensagens } }] }] });
      return ctx.app.inject({
        method: "POST", url: "/v1/public/whatsapp/webhook", payload: corpo,
        headers: { "content-type": "application/json", "x-hub-signature-256": `sha256=${createHmac("sha256", "segredo-teste-wa").update(corpo).digest("hex")}` },
      });
    };
    pedidosMeta.length = 0;
    // Uma mensagem de ontem (entrega repetida pela Meta) e uma do próprio número: nenhuma resposta.
    expect((await entregar([msg(`wamid.antiga.${t}`, t, agora - 86_400), msg(`wamid.eco.${t}`, "351962215550", agora)])).statusCode).toBe(200);
    expect(pedidosMeta).toHaveLength(0);
    // A mesma mensagem duas vezes ao mesmo tempo: uma resposta.
    const nova = msg(`wamid.nova.${t}`, t, agora);
    const [a, b] = await Promise.all([entregar([nova]), entregar([nova])]);
    expect([a.statusCode, b.statusCode]).toEqual([200, 200]);
    expect(pedidosMeta.filter(p => p.to === t)).toHaveLength(1);
    config.whatsappAppSecret = "";
  });
});
