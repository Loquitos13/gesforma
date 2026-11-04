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
  vi.stubGlobal("fetch", async (url: string, init?: { body?: unknown }) => {
    // Ficheiro recebido: a Meta dá o endereço (GET /<media-id>) e depois o conteúdo.
    if (/graph\.facebook\.com\/v\d+\.\d+\/media-in-/.test(String(url))) {
      return new Response(JSON.stringify({ url: "https://lookaside.fbsbx.com/whatsapp/ficheiro", mime_type: "application/pdf", file_size: 20 }), { status: 200 });
    }
    if (String(url).startsWith("https://lookaside.fbsbx.com/")) return new Response(new Uint8Array(Buffer.from("%PDF-1.4\n%%EOF\n")), { status: 200 });
    // Carregamento de ficheiros (/media): devolve o id do ficheiro na Meta.
    if (String(url).endsWith("/media")) {
      const f = (init?.body as FormData).get("file") as File;
      pedidosMeta.push({ media: true, nome: f.name, tipo: (init?.body as FormData).get("type") });
      return new Response(JSON.stringify({ id: "media-123" }), { status: 200 });
    }
    pedidosMeta.push(JSON.parse(String(init?.body ?? "{}")));
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
    // O aviso à equipa espera pelo assunto (a mensagem seguinte), que o assistente pede.
    expect(enviados.length).toBe(antes);
    expect((await handleWhatsappText(ctx.db, t, "Quero saber o preço do curso CCP")).replies).toEqual([]);
    // Sem pré-inscrição: vai às equipas Gold (comerciais e coordenação) e Financiada; nunca à administração nem à contabilidade.
    const aviso = enviados.slice(antes);
    const equipa = (await ctx.db.query<{ email: string; role: string }>(
      "SELECT lower(email) AS email, role FROM users WHERE active = true AND role IN ('admin', 'comercial', 'secretaria', 'financiada', 'contabilidade')")).rows;
    const esperados = equipa.filter(u => ["comercial", "secretaria", "financiada"].includes(u.role)).map(u => u.email).sort();
    expect(aviso.map(m => m.to).sort()).toEqual(esperados);
    for (const m of aviso) expect(m.subject).toBe("WhatsApp: Rita Lopes quer falar com a equipa");
    expect(aviso[0]!.text).toContain(`/gesforma/gold/whatsapp?telefone=${t}`);
    expect(aviso[0]!.text).toContain("Assunto: Quero saber o preço do curso CCP");

    // Em pausa: o bot não responde (nem a «olá») e não sai outro aviso.
    expect((await handleWhatsappText(ctx.db, t, "olá, ainda está aí?")).replies).toEqual([]);
    expect((await handleWhatsappText(ctx.db, t, "operador")).replies).toEqual([]);
    expect(enviados.length).toBe(antes + aviso.length);

    // Caixa de conversas: a que pede uma pessoa vem à frente, com as mensagens por ler.
    const lista = await pedido(ctx, "comercial", "GET", "/v1/crm/whatsapp/conversas");
    expect(lista.statusCode, lista.body).toBe(200);
    const primeira = lista.json().conversas[0];
    expect(primeira).toMatchObject({ telefone: t, nome: "Rita Lopes", humano: true, podeResponder: true });
    expect(primeira.porLer).toBeGreaterThanOrEqual(4);
    expect((await pedido(ctx, "contabilidade", "GET", "/v1/crm/whatsapp/conversas")).statusCode).toBe(403);

    const conversa = (await pedido(ctx, "financiada", "GET", `/v1/crm/whatsapp/conversa?telefone=${t}`)).json();
    expect(conversa.humano).toBe(true);
    expect(conversa.mensagens.map((m: { corpo: string }) => m.corpo)).toContain("Falar com a equipa");
    // Eliminar de vez: só a administração e as coordenações (o teste usa outra conversa, abaixo).
    expect((await pedido(ctx, "comercial", "DELETE", `/v1/crm/whatsapp/conversa?telefone=${t}`)).statusCode).toBe(403);
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
    const antes = enviados.length;
    const out = await handleWhatsappText(ctx.db, t, "Olá! Sou Rui. Vim do site da ENA e gostava de falar com um operador sobre o curso «CCP».");
    expect(out.humano).toBe(true);
    // O pedido já traz o assunto: o aviso sai logo, com ele.
    expect(enviados.slice(antes).some(m => m.text.includes("sobre o curso «CCP»"))).toBe(true);
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

describe("fechar conversas e inatividade", () => {
  it("fechar: despedida, assistente de volta, histórico fica; a pessoa volta a escrever e reabre", async () => {
    const { handleWhatsappText } = await import("../src/whatsappBot.js");
    const t = tel();
    await handleWhatsappText(ctx.db, t, "4");
    pedidosMeta.length = 0;
    const r = await pedido(ctx, "comercial", "POST", "/v1/crm/whatsapp/fechar", { telefone: t });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().despedida).toBe(true);
    expect(pedidosMeta[0]).toMatchObject({ to: t, type: "text", text: { body: expect.stringContaining("Esta conversa foi encerrada") } });

    const fechada = (await pedido(ctx, "comercial", "GET", `/v1/crm/whatsapp/conversa?telefone=${t}`)).json();
    expect(fechada).toMatchObject({ fechada: true, humano: false });
    expect(fechada.mensagens.at(-1)).toMatchObject({ direccao: "evento", corpo: expect.stringMatching(/^Conversa fechada por /) });
    expect((await pedido(ctx, "comercial", "GET", "/v1/crm/whatsapp/conversas")).json().conversas.find((c: { telefone: string }) => c.telefone === t).fechada).toBe(true);

    // Volta a escrever: reabre com o assistente e o histórico anterior continua lá.
    expect((await handleWhatsappText(ctx.db, t, "olá")).replies[0]).toContain("Como posso ajudar?");
    const aberta = (await pedido(ctx, "comercial", "GET", `/v1/crm/whatsapp/conversa?telefone=${t}`)).json();
    expect(aberta.fechada).toBe(false);
    const corpos = aberta.mensagens.map((m: { corpo: string }) => m.corpo);
    expect(corpos).toContain("Conversa reaberta");
    expect(corpos.some((c: string) => c.startsWith("Combinado."))).toBe(true);
  });

  it("regras: lembra quem parou a meio, avisa a equipa sem resposta e fecha sem mensagens", async () => {
    const { handleWhatsappText } = await import("../src/whatsappBot.js");
    const { verificarInatividade } = await import("../src/whatsappInatividade.js");
    await ctx.db.query(
      `INSERT INTO app_settings (id, values) VALUES ('whatsapp_regras', '{"lembreteMin": "30", "avisoEquipaHoras": "4", "fecharHoras": "24"}'::jsonb)
       ON CONFLICT (id) DO UPDATE SET values = EXCLUDED.values`);
    const enviadas: { to: string; m: unknown }[] = [];
    const enviar = async (to: string, m: unknown) => { enviadas.push({ to, m }); return { sent: true }; };
    const recuar = (t: string, intervalo: string) => ctx.db.query(
      `UPDATE whatsapp_mensagens SET created_at = created_at - $2::interval WHERE telefone = $1`, [t, intervalo]);

    // A meio da pré-inscrição há 40 minutos: um lembrete (e só um).
    const meio = tel();
    await handleWhatsappText(ctx.db, meio, "1");
    await recuar(meio, "40 minutes");
    await verificarInatividade(ctx.db, enviar);
    await verificarInatividade(ctx.db, enviar);
    expect(enviadas.filter(e => e.to === meio).map(e => e.m)).toEqual([expect.stringContaining("Ainda está aí?")]);

    // Pediu a equipa há 5 horas e ninguém respondeu: novo aviso por email (uma vez).
    const espera = tel();
    await handleWhatsappText(ctx.db, espera, "4", "", "Marta");
    await ctx.db.query("UPDATE whatsapp_sessoes SET humano_desde = humano_desde - interval '5 hours' WHERE telefone = $1", [espera]);
    await recuar(espera, "5 hours");
    const antes = enviados.length;
    await verificarInatividade(ctx.db, enviar);
    await verificarInatividade(ctx.db, enviar);
    const novos = enviados.slice(antes).filter(m => m.text.includes("Ainda sem resposta da equipa"));
    expect(novos.length).toBeGreaterThan(0);
    expect(new Set(novos.map(m => m.to)).size).toBe(novos.length);

    // Sem mensagens há 30 horas: fecha (sem despedida: passaram as 24 horas da Meta).
    const parada = tel();
    await handleWhatsappText(ctx.db, parada, "olá");
    await recuar(parada, "30 hours");
    await verificarInatividade(ctx.db, enviar);
    expect(enviadas.filter(e => e.to === parada)).toHaveLength(0);
    const c = (await pedido(ctx, "comercial", "GET", `/v1/crm/whatsapp/conversa?telefone=${parada}`)).json();
    expect(c.fechada).toBe(true);
    expect(c.mensagens.at(-1).corpo).toBe("Conversa fechada por inatividade");
    await ctx.db.query("DELETE FROM app_settings WHERE id = 'whatsapp_regras'");
  });
});

describe("eliminar conversa", () => {
  it("a coordenação elimina de vez; a pessoa volta a escrever e começa uma conversa nova", async () => {
    const { handleWhatsappText } = await import("../src/whatsappBot.js");
    const t = tel();
    await handleWhatsappText(ctx.db, t, "olá");
    expect((await pedido(ctx, "secretaria", "DELETE", `/v1/crm/whatsapp/conversa?telefone=${t}`)).statusCode).toBe(200);
    expect((await pedido(ctx, "secretaria", "GET", `/v1/crm/whatsapp/conversa?telefone=${t}`)).json().mensagens).toEqual([]);
    expect((await pedido(ctx, "secretaria", "GET", "/v1/crm/whatsapp/conversas")).json().conversas.some((c: { telefone: string }) => c.telefone === t)).toBe(false);
    await handleWhatsappText(ctx.db, t, "olá");
    expect((await pedido(ctx, "secretaria", "GET", `/v1/crm/whatsapp/conversa?telefone=${t}`)).json().mensagens).toHaveLength(2);
  });
});

describe("Gold ou Financiada", () => {
  it("antes de listar cursos pergunta Gold ou Financiada; a Financiada regista a pré-inscrição com o local preferido", async () => {
    const { handleWhatsappText } = await import("../src/whatsappBot.js");
    const { listCursosOferta } = await import("../src/ofertaGold.js");
    const t = tel();
    // Lista de cursos: primeiro a escolha.
    const lista = await handleWhatsappText(ctx.db, t, "3");
    expect(lista.replies[0]).toMatch(/Formação Gold[\s\S]*Formação Financiada/);
    expect((await handleWhatsappText(ctx.db, t, "fin")).replies[0]).toMatch(/^Cursos de Formação Financiada:/);

    const fin = (await listCursosOferta(ctx.db)).find(c => c.regime === "fin");
    if (!fin) return; // sem cursos financiados na base de testes, a lista acima chega
    const email = `wa.fin.${t}@exemplo.pt`;
    await handleWhatsappText(ctx.db, t, "1");
    for (const passo of ["fin", "Ana", "Reis", email, "Porto"]) await handleWhatsappText(ctx.db, t, passo);
    let r = await handleWhatsappText(ctx.db, t, fin.nome);
    if (/Onde prefere/.test(r.replies[0] ?? "")) r = await handleWhatsappText(ctx.db, t, "1");
    expect(r.replies.join("\n")).toMatch(/sim/i);
    await handleWhatsappText(ctx.db, t, "sim");
    const lead = (await ctx.db.query<{ regime: string; curso: string; origem: string }>(
      "SELECT regime, curso, origem FROM preinscricoes WHERE email = $1", [email])).rows[0];
    expect(lead).toMatchObject({ regime: "fin", curso: fin.nome, origem: "WhatsApp" });
  });
});

describe("pedidos à espera (contador e alerta)", () => {
  it("o pedido aparece até a equipa responder; volta se a pessoa escrever outra vez; sai ao fechar", async () => {
    const { handleWhatsappText } = await import("../src/whatsappBot.js");
    const t = tel();
    const pendente = async () => ((await pedido(ctx, "financiada", "GET", "/v1/crm/whatsapp/pendentes")).json().pendentes as { telefone: string; regime: string | null }[])
      .find(p => p.telefone === t);
    expect((await pedido(ctx, "contabilidade", "GET", "/v1/crm/whatsapp/pendentes")).statusCode).toBe(403);
    await handleWhatsappText(ctx.db, t, "4");
    expect(await pendente()).toMatchObject({ telefone: t, regime: null });
    expect((await pedido(ctx, "comercial", "POST", "/v1/crm/whatsapp/responder", { telefone: t, texto: "Olá, em que posso ajudar?" })).statusCode).toBe(200);
    expect(await pendente()).toBeUndefined();
    await handleWhatsappText(ctx.db, t, "Quero saber datas");
    expect(await pendente()).toBeDefined();
    await pedido(ctx, "comercial", "POST", "/v1/crm/whatsapp/fechar", { telefone: t });
    expect(await pendente()).toBeUndefined();
  });
});

describe("conversas novas e por ler (menu e alerta)", () => {
  it("a primeira mensagem dá «nova conversa» até alguém abrir; reabrir uma fechada também", async () => {
    const { handleWhatsappText } = await import("../src/whatsappBot.js");
    const t = tel();
    const linha = async () => ((await pedido(ctx, "comercial", "GET", "/v1/crm/whatsapp/pendentes")).json().porLer as
      { telefone: string; porLer: number; novaDesde: string | null }[]).find(c => c.telefone === t);
    await handleWhatsappText(ctx.db, t, "olá");
    const nova = await linha();
    expect(nova).toMatchObject({ telefone: t, porLer: 1 });
    expect(nova!.novaDesde).toBeTruthy();
    // Abrir a conversa marca-a como lida: sai do contador e do alerta.
    await pedido(ctx, "comercial", "GET", `/v1/crm/whatsapp/conversa?telefone=${t}`);
    expect(await linha()).toBeUndefined();
    // Uma mensagem a seguir conta para o menu, mas já não é conversa nova.
    await handleWhatsappText(ctx.db, t, "2");
    expect((await linha())!.novaDesde).toBeNull();
    // Fechada e a pessoa volta a escrever: nova outra vez.
    await pedido(ctx, "comercial", "POST", "/v1/crm/whatsapp/fechar", { telefone: t });
    await handleWhatsappText(ctx.db, t, "olá de novo");
    expect((await linha())!.novaDesde).toBeTruthy();
  });
});

describe("anexos", () => {
  it("a equipa envia um PDF com legenda; tipos não aceites e conversas paradas há mais de 24 horas são recusados", async () => {
    const { handleWhatsappText } = await import("../src/whatsappBot.js");
    const t = tel();
    await handleWhatsappText(ctx.db, t, "4");
    const enviar = (nome: string, bytes: Buffer, legenda = "") => {
      const boundary = "----wa";
      const campo = (k: string, v: string) => Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`);
      const body = Buffer.concat([
        campo("telefone", t), campo("legenda", legenda),
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${nome}"\r\nContent-Type: application/octet-stream\r\n\r\n`),
        bytes, Buffer.from(`\r\n--${boundary}--\r\n`),
      ]);
      return ctx.app.inject({
        method: "POST", url: "/v1/crm/whatsapp/anexo", payload: body,
        headers: { "content-type": `multipart/form-data; boundary=${boundary}`, cookie: ctx.cookie.comercial, "x-gesforma-client": "web" },
      });
    };
    const pdf = Buffer.from("%PDF-1.4\n%%EOF\n");
    pedidosMeta.length = 0;
    const r = await enviar("Programa CCP.pdf", pdf, "Segue o programa do curso.");
    expect(r.statusCode, r.body).toBe(200);
    expect(pedidosMeta[0]).toMatchObject({ media: true, nome: "Programa CCP.pdf", tipo: "application/pdf" });
    expect(pedidosMeta[1]).toMatchObject({
      to: t, type: "document", document: { id: "media-123", filename: "Programa CCP.pdf", caption: "Segue o programa do curso." },
    });
    const c = (await pedido(ctx, "comercial", "GET", `/v1/crm/whatsapp/conversa?telefone=${t}`)).json();
    expect(c.mensagens.at(-1)).toMatchObject({ direccao: "out", corpo: "📎 Programa CCP.pdf\nSegue o programa do curso." });

    expect((await enviar("virus.exe", Buffer.from("MZ\x90\x00"))).statusCode).toBe(400);
    await ctx.db.query("UPDATE whatsapp_mensagens SET created_at = now() - interval '25 hours' WHERE telefone = $1 AND direccao = 'in'", [t]);
    expect((await enviar("Programa CCP.pdf", pdf)).statusCode).toBe(409);
  });
});

describe("ficheiros enviados pela pessoa", () => {
  it("ficam na conversa; só passam para a ficha quando a equipa confirma (e escolhe o documento)", async () => {
    const { config } = await import("../src/config.js");
    config.whatsappAppSecret = "segredo-teste-wa";
    const t = tel();
    const email = `wa.anexo.${t}@exemplo.pt`;
    const curso = `Curso Anexo ${t}`;
    expect((await pedido(ctx, "secretaria", "POST", "/v1/cursos-gold", {
      nome: curso, categoria: "Teste", tipo: "Pré-inscrição", preco: 100, regime: "Presencial", horas: 8,
    })).statusCode).toBe(200);
    const lead = (await ctx.db.query<{ id: number }>(
      `INSERT INTO preinscricoes (id, inscrito, nome, apelido, email, telf, curso, estado, regime)
       VALUES (nextval('ops_id_seq')::int, to_char(now(), 'YYYY-MM-DD'), 'Ana', 'Ficheiro', $1, $2, $3, 'Não contactado', 'gold') RETURNING id`,
      [email, t.slice(3), curso])).rows[0]!.id;
    const corpo = JSON.stringify({ entry: [{ changes: [{ value: {
      metadata: { display_phone_number: "351962215550" },
      messages: [{ from: t, id: `wamid.doc.${t}`, timestamp: String(Math.floor(Date.now() / 1000)), type: "document",
        document: { id: `media-in-${t}`, mime_type: "application/pdf", filename: "cc.pdf", caption: "O meu CC" } }],
    } }] }] });
    pedidosMeta.length = 0;
    const r = await ctx.app.inject({
      method: "POST", url: "/v1/public/whatsapp/webhook", payload: corpo,
      headers: { "content-type": "application/json", "x-hub-signature-256": `sha256=${createHmac("sha256", "segredo-teste-wa").update(corpo).digest("hex")}` },
    });
    expect(r.statusCode, r.body).toBe(200);
    expect(pedidosMeta.some(p => JSON.stringify(p).includes("Recebemos o seu ficheiro"))).toBe(true);

    const c = (await pedido(ctx, "comercial", "GET", `/v1/crm/whatsapp/conversa?telefone=${t}`)).json();
    const msg = c.mensagens.find((m: { anexoId: number | null }) => m.anexoId);
    expect(msg.corpo).toBe("📎 cc.pdf\nO meu CC");
    expect(c.anexos[0]).toMatchObject({ nome: "cc.pdf", guardado: false });
    // O id do anexo na mensagem é o mesmo (e do mesmo tipo) que o da lista de anexos: o ecrã liga um ao outro.
    expect(typeof msg.anexoId).toBe("number");
    expect(c.anexos.some((a: { id: number }) => a.id === msg.anexoId)).toBe(true);
    // Ver: a equipa abre o ficheiro; a contabilidade não.
    const ver = await pedido(ctx, "comercial", "GET", `/v1/crm/whatsapp/anexos/${msg.anexoId}`);
    expect(ver.statusCode).toBe(200);
    expect(ver.headers["content-type"]).toBe("application/pdf");
    expect((await pedido(ctx, "contabilidade", "GET", `/v1/crm/whatsapp/anexos/${msg.anexoId}`)).statusCode).toBe(403);
    // Ainda não está na ficha.
    expect((await ctx.db.query("SELECT 1 FROM preinscricao_docs WHERE preinscricao_id = $1", [lead])).rows).toHaveLength(0);

    const tipos = c.leads.find((l: { id: number }) => l.id === lead).tipos as { id: string }[];
    expect((await pedido(ctx, "comercial", "POST", `/v1/crm/whatsapp/anexos/${msg.anexoId}/guardar`, { preinscricaoId: lead, tipo: "nao-existe" })).statusCode).toBe(400);
    expect((await pedido(ctx, "comercial", "POST", `/v1/crm/whatsapp/anexos/${msg.anexoId}/guardar`, { preinscricaoId: 1, tipo: "cc" })).statusCode).toBe(404);
    expect(tipos.length).toBeGreaterThan(0);
    {
      const g = await pedido(ctx, "comercial", "POST", `/v1/crm/whatsapp/anexos/${msg.anexoId}/guardar`, { preinscricaoId: lead, tipo: tipos[0]!.id });
      expect(g.statusCode, g.body).toBe(200);
      expect((await ctx.db.query("SELECT tipo FROM preinscricao_docs WHERE preinscricao_id = $1", [lead])).rows).toEqual([{ tipo: tipos[0]!.id }]);
      // Guardado na ficha: o conteúdo sai da base de dados (fica na Drive) e «Ver ficheiro» continua a abrir.
      const guardado = (await ctx.db.query<{ conteudo: unknown; drive_file_id: string | null }>(
        "SELECT conteudo, drive_file_id FROM whatsapp_anexos WHERE id = $1", [msg.anexoId])).rows[0]!;
      expect(guardado.conteudo).toBeNull();
      expect(guardado.drive_file_id).toBeTruthy();
      const verDepois = await pedido(ctx, "comercial", "GET", `/v1/crm/whatsapp/anexos/${msg.anexoId}`);
      expect(verDepois.statusCode).toBe(200);
      expect(verDepois.rawPayload.subarray(0, 4).toString()).toBe("%PDF");
      expect((await pedido(ctx, "comercial", "POST", `/v1/crm/whatsapp/anexos/${msg.anexoId}/guardar`, { preinscricaoId: lead, tipo: tipos[0]!.id })).statusCode).toBe(409);
    }
    config.whatsappAppSecret = "";
  });
});
