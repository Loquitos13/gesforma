import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { arrancar, pedido, preinscricaoDoEmail, type Ctx } from "./helpers.js";

let seq = 0;
const unico = (p: string) => `${p}-${Date.now()}-${++seq}`;

async function cursoGold(ctx: Ctx, preco = 100) {
  const nome = unico("Curso Site");
  const r = await pedido(ctx, "secretaria", "POST", "/v1/cursos-gold", { nome, categoria: "T", tipo: "Pré-inscrição", preco, regime: "Presencial", horas: 8 });
  expect(r.statusCode, r.body).toBe(200);
  return nome;
}

async function turmaGold(ctx: Ctx, curso: string, dataInicio = "2031-03-03", local = "Porto") {
  const nome = unico("TS");
  const r = await pedido(ctx, "secretaria", "POST", "/v1/turmas-gold", {
    dataInicio, nome, curso, local, horario: "Laboral Manhã", vagas: 5, toleranciaVagas: 0, estado: "Ativa",
    cronograma: [{ id: unico("s"), data: dataInicio, horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", formadores: [] }],
  });
  expect(r.statusCode, r.body).toBe(200);
  return { id: (r.json() as { turma: { id: number } }).turma.id, nome, curso };
}

function publico(ctx: Ctx, body: Record<string, unknown>, ip = `10.20.${seq % 250}.${(seq * 3) % 250}`) {
  return ctx.app.inject({ method: "POST", url: "/v1/public/preinscricoes", payload: body, remoteAddress: ip });
}

async function token(ctx: Ctx, id: number) {
  return (await ctx.db.query<{ docs_token: string }>("SELECT docs_token FROM preinscricoes WHERE id = $1", [id])).rows[0]!.docs_token;
}

describe("webhook do WhatsApp (assinatura do Meta)", () => {
  it("recusa sem app secret, recusa assinatura errada e trata no máximo 10 mensagens por pedido", async () => {
    const ctx = await arrancar();
    const { config } = await import("../src/config.js");
    const prefixo = `3519${String(Date.now()).slice(-7)}`;
    const mensagens = Array.from({ length: 15 }, (_, i) => ({ from: `${prefixo}${String(i).padStart(2, "0")}`, id: `wamid.${i}`, type: "text", text: { body: "olá" } }));
    const corpo = JSON.stringify({ entry: [{ changes: [{ value: { messages: mensagens } }] }] });
    const enviar = (assinatura?: string) => ctx.app.inject({
      method: "POST", url: "/v1/public/whatsapp/webhook", payload: corpo,
      headers: { "content-type": "application/json", ...(assinatura ? { "x-hub-signature-256": assinatura } : {}) },
    });
    const contar = async () => (await ctx.db.query<{ n: number }>(
      "SELECT count(DISTINCT telefone)::int AS n FROM whatsapp_mensagens WHERE telefone LIKE $1", [`%${prefixo}%`])).rows[0]!.n;

    config.whatsappAppSecret = "";
    expect((await enviar("sha256=00")).statusCode).toBe(503);

    config.whatsappAppSecret = "segredo-da-app-meta";
    expect((await enviar()).statusCode).toBe(401);
    expect((await enviar(`sha256=${createHmac("sha256", "outro-segredo").update(corpo).digest("hex")}`)).statusCode).toBe(401);
    expect(await contar()).toBe(0);

    const boa = `sha256=${createHmac("sha256", "segredo-da-app-meta").update(corpo).digest("hex")}`;
    const ok = await enviar(boa);
    expect(ok.statusCode, ok.body).toBe(200);
    expect(await contar()).toBe(10);
    config.whatsappAppSecret = "";
  });
});

describe("turma e pagamento pedido", () => {
  it("a ligação pessoal não muda de turma depois do pedido de pagamento e a ficha só nasce na turma paga", async () => {
    const ctx = await arrancar();
    const curso = await cursoGold(ctx);
    const turma = await turmaGold(ctx, curso, "2031-03-03");
    const outra = await turmaGold(ctx, curso, "2031-04-07");
    const email = `${unico("pag")}@exemplo.pt`;
    expect((await publico(ctx, { nome: "Ana", email, curso, turmaId: turma.id })).statusCode).toBe(200);
    const id = await preinscricaoDoEmail(ctx, email);
    const tk = await token(ctx, id);
    const escolher = (turmaId: number) => ctx.app.inject({ method: "POST", url: `/v1/public/documentos/${tk}/turma`, payload: { turmaId } });

    // Antes do pedido, mudar é livre.
    const mudou = await escolher(outra.id);
    expect(mudou.statusCode, mudou.body).toBe(200);

    const pagId = `PAG-${Date.now()}`;
    await ctx.db.query(
      "INSERT INTO pagamentos (id, nome, valor, metodo, curso, data, estado, email, referencia) VALUES ($1, 'Ana', 100, 'Transferência bancária', $2, '2031-01-01 10:00', 'Pendente', $3, '')",
      [pagId, curso, email]);
    await ctx.db.query("UPDATE preinscricoes SET pagamento_id = $2 WHERE id = $1", [id, pagId]);
    const pags = await import("../src/repos/pagamentosLead.js");
    await pags.marcarPagamentoPedido(ctx.db, id);

    const recusa = await escolher(turma.id);
    expect(recusa.statusCode).toBe(400);
    expect(recusa.json().error).toMatch(/contacte a secretaria/);
    const lead = await ctx.db.query<{ turma_escolhida_id: number; pagamento_turma_id: number }>(
      "SELECT turma_escolhida_id, pagamento_turma_id FROM preinscricoes WHERE id = $1", [id]);
    expect(lead.rows[0]).toMatchObject({ turma_escolhida_id: outra.id, pagamento_turma_id: outra.id });

    // Se a turma mudar por outro caminho, o pagamento confirmado não cria a ficha noutra turma em silêncio.
    await ctx.db.query("UPDATE preinscricoes SET turma_escolhida_id = $2, turma_id = $2 WHERE id = $1", [id, turma.id]);
    const { aposPagamentoConfirmado } = await import("../src/inscricaoPaga.js");
    const r = await aposPagamentoConfirmado(ctx.db, pagId);
    expect(r && "erro" in r ? r.erro : "").toMatch(/turma mudou/);
    expect((await ctx.db.query("SELECT 1 FROM formandos_gold WHERE lower(email) = $1", [email])).rows).toHaveLength(0);

    // A secretaria muda a turma no backoffice: a turma paga acompanha.
    const { moverDocsParaTurma } = await import("../src/percursoValidacao.js");
    await moverDocsParaTurma(ctx.db, { email, turmaId: outra.id, curso, regime: "gold" });
    const depois = await ctx.db.query<{ pagamento_turma_id: number }>("SELECT pagamento_turma_id FROM preinscricoes WHERE id = $1", [id]);
    expect(depois.rows[0]!.pagamento_turma_id).toBe(outra.id);
  });
});

describe("formulário público de pré-inscrição", () => {
  it("resposta igual para pedido novo e repetido; ligação expirada é trocada antes de ser reenviada", async () => {
    const ctx = await arrancar();
    const curso = await cursoGold(ctx);
    const email = `${unico("rep")}@exemplo.pt`;
    const novo = await publico(ctx, { nome: "Rita", email, curso });
    expect(novo.statusCode).toBe(200);
    const id = await preinscricaoDoEmail(ctx, email);
    const antigo = await token(ctx, id);
    // 100 dias sem uso: a ligação está expirada.
    await ctx.db.query(
      `UPDATE preinscricoes SET docs_token_criado_em = now() - interval '100 days', docs_token_usado_em = NULL,
              ligacao_reenviada_em = now() - interval '1 day' WHERE id = $1`, [id]);
    const repetido = await publico(ctx, { nome: "Rita", email, curso });
    expect(repetido.body).toBe(novo.body);
    expect(Object.keys(repetido.json()).sort()).toEqual(["aviso", "ok"]);
    const novoToken = await token(ctx, id);
    expect(novoToken).not.toBe(antigo);
    const vista = await ctx.app.inject({ method: "GET", url: `/v1/public/documentos/${novoToken}` });
    expect(vista.json().encerrada).toBeFalsy();

    // Reenvio da ligação ao mesmo email: no máximo um a cada 10 minutos.
    const reenvios = async () => (await ctx.db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM lead_eventos WHERE lead_id = $1 AND titulo LIKE 'Novo pedido no site%'", [id])).rows[0]!.n;
    const antes = await reenvios();
    expect((await publico(ctx, { nome: "Rita", email, curso })).statusCode).toBe(200);
    expect(await reenvios()).toBe(antes);
  });

  it("limita pedidos por email na base de dados", async () => {
    const ctx = await arrancar();
    const curso = await cursoGold(ctx);
    const email = `${unico("lim")}@exemplo.pt`;
    const { PREINSCRICOES_POR_EMAIL } = await import("../src/preinscricaoPublica.js");
    for (let i = 0; i < PREINSCRICOES_POR_EMAIL; i++) {
      expect((await publico(ctx, { nome: "Lia", email, curso }, `10.30.0.${i}`)).statusCode).toBe(200);
    }
    expect((await publico(ctx, { nome: "Lia", email, curso }, "10.30.1.1")).statusCode).toBe(429);
  });

  it("curso fora da oferta: os emails dizem «Contacto pelo site» e o texto livre fica só nas notas", async () => {
    const ctx = await arrancar();
    const email = `${unico("fora")}@exemplo.pt`;
    const livre = "Quero um curso <b>especial</b> de qualquer coisa";
    expect((await publico(ctx, { nome: "Rui", email, curso: livre })).statusCode).toBe(200);
    const id = await preinscricaoDoEmail(ctx, email);
    const lead = await ctx.db.query<{ curso: string; notas: string }>("SELECT curso, notas FROM preinscricoes WHERE id = $1", [id]);
    expect(lead.rows[0]!.curso).toBe("Contacto pelo site");
    expect(lead.rows[0]!.notas).toContain("especial");
    const eventos = await ctx.db.query<{ payload: Record<string, unknown> }>(
      "SELECT payload FROM automation_events WHERE type = 'preinscricao.created' AND payload->>'email' = $1", [email]);
    expect(eventos.rows.length).toBeGreaterThan(0);
    for (const e of eventos.rows) expect(JSON.stringify(e.payload)).not.toContain("especial");
    const jobs = await ctx.db.query<{ subject: string; body_text: string }>("SELECT subject, body_text FROM email_jobs WHERE lower(to_email) = $1", [email]);
    for (const j of jobs.rows) expect(`${j.subject} ${j.body_text}`).not.toContain("especial");
  });

  it("o preço mostrado vem do servidor e é o que a pré-inscrição grava", async () => {
    const ctx = await arrancar();
    const curso = await cursoGold(ctx, 100);
    // Regra de preço da ficha do curso: em Lisboa custa 140 (base 100).
    await ctx.db.query(
      `INSERT INTO curso_fichas (regime, curso_id, payload) SELECT 'gold', id, $2::jsonb FROM cursos_gold WHERE nome = $1
       ON CONFLICT (regime, curso_id) DO UPDATE SET payload = curso_fichas.payload || EXCLUDED.payload`,
      [curso, JSON.stringify({ precosOferta: [{ local: "Lisboa", horario: "", preco: 140 }] })]);
    const { precoParaOferta } = await import("../src/precoOferta.js");
    const esperado = (await precoParaOferta(ctx.db, curso, "Lisboa", "Pós-laboral")) ?? 100;
    expect(esperado).toBe(140);
    const r = await ctx.app.inject({ method: "GET", url: `/v1/public/oferta/preco?curso=${encodeURIComponent(curso)}&local=Lisboa&horario=${encodeURIComponent("Pós-laboral")}` });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().preco).toBe(esperado);
    const email = `${unico("preco")}@exemplo.pt`;
    expect((await publico(ctx, { nome: "Eva", email, curso, local: "Lisboa", horario: "Pós-laboral" })).statusCode).toBe(200);
    const gravado = await ctx.db.query<{ preco: unknown }>("SELECT preco FROM preinscricoes WHERE id = $1", [await preinscricaoDoEmail(ctx, email)]);
    expect(Number(gravado.rows[0]!.preco)).toBe(esperado);
    expect((await ctx.app.inject({ method: "GET", url: "/v1/public/oferta/preco?curso=Nao%20existe&local=&horario=" })).json().preco).toBeNull();
  });
});

describe("recuperação da palavra-passe", () => {
  it("limite por conta na base de dados, com a mesma resposta exista ou não a conta", async () => {
    const ctx = await arrancar();
    const email = (await ctx.db.query<{ email: string }>("SELECT email FROM users WHERE id = $1", [ctx.userId.formando])).rows[0]!.email;
    const recuperar = (e: string, i: number) => ctx.app.inject({
      method: "POST", url: "/v1/auth/recuperar", payload: { email: e }, remoteAddress: `10.40.0.${i}`,
      headers: { "x-gesforma-client": "web" },
    });
    const tokenHash = async () => (await ctx.db.query<{ token_hash: string }>(
      "SELECT token_hash FROM password_resets WHERE user_id = $1", [ctx.userId.formando])).rows[0]?.token_hash ?? "";
    const { RECUPERACAO_POR_EMAIL } = await import("../src/areaFormando.js");
    const hashes = new Set<string>();
    for (let i = 0; i < RECUPERACAO_POR_EMAIL; i++) {
      const r = await recuperar(email, i);
      expect(r.json()).toEqual({ ok: true });
      hashes.add(await tokenHash());
    }
    expect(hashes.size).toBe(RECUPERACAO_POR_EMAIL);
    const excesso = await recuperar(email, 99);
    expect(excesso.json()).toEqual({ ok: true });
    expect(hashes.has(await tokenHash())).toBe(true);
    // Conta inexistente: resposta igual.
    expect((await recuperar(`${unico("ninguem")}@exemplo.pt`, 7)).json()).toEqual({ ok: true });
  });
});

describe("inquéritos públicos", () => {
  async function inquerito(ctx: Ctx, extra: Record<string, unknown> = {}) {
    const r = await ctx.db.query<{ id: number }>(
      `INSERT INTO catalog_items (id, kind, regime, payload)
       VALUES ((SELECT coalesce(max(id), 0) + 1 FROM catalog_items), 'inqueritos', 'gold', $1::jsonb) RETURNING id`,
      [{ titulo: unico("Satisfação"), publico: "formando", perguntas: [{ id: 1, tipo: "escala", texto: "Gostou?" }], ...extra }],
    );
    const id = r.rows[0]!.id;
    return { id, token: (await pedido(ctx, "secretaria", "GET", `/v1/inqueritos/${id}/publico`)).json().token as string };
  }

  it("inquérito inactivo não recebe respostas; a turma da ligação não passa dos destinatários", async () => {
    const ctx = await arrancar();
    const fechado = await inquerito(ctx, { status: "Inativo" });
    expect((await ctx.app.inject({ method: "GET", url: `/v1/public/inqueritos/${fechado.token}` })).statusCode).toBe(410);
    expect((await ctx.app.inject({ method: "POST", url: `/v1/public/inqueritos/${fechado.token}/respostas`, payload: { formando: "", respostas: { 1: 5 } } })).statusCode).toBe(410);

    const curso = await cursoGold(ctx, 0);
    const t = await turmaGold(ctx, curso);
    await ctx.db.query(
      `INSERT INTO formandos_gold (id, nome, apelido, email, curso, turma, turma_id)
       VALUES ((SELECT coalesce(max(id), 0) + 1 FROM formandos_gold), 'Ana', 'Teste', $1, $2, $3, $4)`,
      [`${unico("inq")}@exemplo.pt`, curso, t.nome, t.id]);
    const aberto = await inquerito(ctx);
    expect((await pedido(ctx, "secretaria", "POST", `/v1/turmas/gold/${t.id}/inqueritos/enviar`)).json().enviados).toBe(1);
    const responder = () => ctx.app.inject({
      method: "POST", url: `/v1/public/inqueritos/${aberto.token}/respostas`, payload: { turma: "", turmaId: t.id, formando: "", respostas: { 1: 4 } },
    });
    expect((await responder()).statusCode).toBe(200);
    expect((await responder()).statusCode).toBe(409);
  });
});

describe("dados de faturação", () => {
  it("o histórico não leva o NIF e a ligação fecha ao gravar; pedir de novo dá ligação nova", async () => {
    const ctx = await arrancar();
    const email = `${unico("fat")}@exemplo.pt`;
    const lead = await pedido(ctx, "secretaria", "POST", "/v1/preinscricoes", { nome: "Fausto", email, curso: await cursoGold(ctx), regime: "gold" });
    expect(lead.statusCode, lead.body).toBe(200);
    const id = lead.json().preinscricao.id as number;
    await ctx.db.query("UPDATE preinscricoes SET estado = 'Pago' WHERE id = $1", [id]);
    expect((await pedido(ctx, "secretaria", "POST", `/v1/crm/leads/${id}/faturacao/pedir`)).statusCode).toBe(200);
    const tk = (await ctx.db.query<{ token: string }>("SELECT token FROM preinscricao_faturacao WHERE preinscricao_id = $1", [id])).rows[0]!.token;
    expect((await ctx.app.inject({ method: "GET", url: `/v1/public/faturacao/${tk}` })).statusCode).toBe(200);
    const dados = { nome: "Empresa Y, Lda", nif: "509999999", moradaFiscal: "Rua das Flores, 10, Porto", codigoPostal: "4000-001", email: "fat@exemplo.pt" };
    expect((await ctx.app.inject({ method: "POST", url: `/v1/public/faturacao/${tk}`, payload: dados })).statusCode).toBe(200);

    const eventos = await ctx.db.query<{ titulo: string; detalhe: string }>("SELECT titulo, detalhe FROM lead_eventos WHERE lead_id = $1", [id]);
    const historico = JSON.stringify(eventos.rows);
    expect(historico).not.toContain("509999999");
    expect(historico).not.toContain("Rua das Flores");

    // Gravado: a ligação fecha (nem leitura nem nova gravação).
    expect((await ctx.app.inject({ method: "GET", url: `/v1/public/faturacao/${tk}` })).statusCode).toBe(404);
    expect((await ctx.app.inject({ method: "POST", url: `/v1/public/faturacao/${tk}`, payload: dados })).statusCode).toBe(404);

    // A secretaria volta a pedir (para corrigir): ligação nova, a antiga continua fechada.
    expect((await pedido(ctx, "secretaria", "POST", `/v1/crm/leads/${id}/faturacao/pedir`)).statusCode).toBe(200);
    const novo = (await ctx.db.query<{ token: string }>("SELECT token FROM preinscricao_faturacao WHERE preinscricao_id = $1", [id])).rows[0]!.token;
    expect(novo).not.toBe(tk);
    const reaberta = await ctx.app.inject({ method: "GET", url: `/v1/public/faturacao/${novo}` });
    expect(reaberta.statusCode).toBe(200);
    expect(reaberta.json()).toMatchObject({ preenchido: true, dados: { nif: "509999999" } });
    expect((await ctx.app.inject({ method: "GET", url: `/v1/public/faturacao/${tk}` })).statusCode).toBe(404);

    // Pedido com mais de 30 dias: expira.
    await ctx.db.query("UPDATE preinscricao_faturacao SET pedido_em = now() - interval '31 days' WHERE preinscricao_id = $1", [id]);
    expect((await ctx.app.inject({ method: "GET", url: `/v1/public/faturacao/${novo}` })).statusCode).toBe(404);
  });
});

describe("área do formando: telefone", () => {
  it("o telefone alterado pelo formando entra no pacote cifrado (o que a leitura usa)", async () => {
    const ctx = await arrancar();
    const { encryptJson } = await import("../src/fieldCrypto.js");
    const { readFormandoPii } = await import("../src/pii.js");
    const curso = await cursoGold(ctx, 0);
    const t = await turmaGold(ctx, curso);
    const fid = (await ctx.db.query<{ id: number }>(
      `INSERT INTO formandos_gold (id, nome, apelido, email, curso, turma, turma_id, user_id, telf, pii_enc)
       VALUES ((SELECT coalesce(max(id), 0) + 1 FROM formandos_gold), 'Ana', 'Teste', $1, $2, $3, $4, $5, '', $6) RETURNING id`,
      [`${unico("tel")}@exemplo.pt`, curso, t.nome, t.id, ctx.userId.formando, encryptJson({ telf: "911111111" })])).rows[0]!.id;
    const r = await pedido(ctx, "formando", "PATCH", "/v1/area-formando", { telf: "922222222" });
    expect(r.statusCode, r.body).toBe(200);
    const row = (await ctx.db.query<Record<string, unknown>>("SELECT telf, pii_enc FROM formandos_gold WHERE id = $1", [fid])).rows[0]!;
    expect(readFormandoPii(row).telf).toBe("922222222");
    expect(row.telf).toBe("");
  });
});

describe("cronograma público", () => {
  it("turma fechada nunca publicada não se lê por id; publicada continua a abrir", async () => {
    const ctx = await arrancar();
    const curso = await cursoGold(ctx, 0);
    const t = await turmaGold(ctx, curso);
    const ver = () => ctx.app.inject({ method: "GET", url: `/v1/public/cronograma/gold/${t.id}` });
    expect((await ver()).statusCode).toBe(200);
    await ctx.db.query("UPDATE turmas_gold SET estado = 'Concluída' WHERE id = $1", [t.id]);
    expect((await ver()).statusCode).toBe(404);
    await ctx.db.query("UPDATE turmas_gold SET cronograma_publicado_em = now() WHERE id = $1", [t.id]);
    expect((await ver()).statusCode).toBe(200);
  });
});
