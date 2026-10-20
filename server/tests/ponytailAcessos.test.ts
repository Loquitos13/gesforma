// Acessos: bot de WhatsApp sem consulta por email, simulador só do admin, comercial fora da Financiada,
// ficha de formador por regime, valores da turma para o formador, ligação Fin fechada e limite de login por email.
import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { arrancar, pedido, type Ctx } from "./helpers.js";

let seq = 0;
const unico = (p: string) => `${p}${Date.now().toString(36)}${++seq}`;

async function lead(ctx: Ctx, regime: "gold" | "fin", comercialId: string | null, extra: { email?: string; telf?: string } = {}) {
  const r = await ctx.db.query<{ id: number }>(
    `INSERT INTO preinscricoes (id, inscrito, nome, email, telf, curso, preco, estado, comercial_id, regime)
     VALUES (nextval('ops_id_seq')::int, to_char(now(), 'YYYY-MM-DD'), $1, $2, $3, 'Curso', 100, 'Não contactado', $4, $5) RETURNING id`,
    [unico("Lead"), extra.email ?? `${unico("l")}@exemplo.pt`, extra.telf ?? "", comercialId, regime],
  );
  return r.rows[0]!.id;
}

describe("WhatsApp: o bot não revela pré-inscrições de outros", () => {
  it("sem pedido neste número não pede o email nem o procura", async () => {
    const ctx = await arrancar();
    const { handleWhatsappText } = await import("../src/whatsappBot.js");
    const email = `${unico("alvo")}@exemplo.pt`;
    await lead(ctx, "gold", null, { email, telf: "912000111" });
    const tel = "351919990001";
    await handleWhatsappText(ctx.db, tel, "menu");
    const r = await handleWhatsappText(ctx.db, tel, "2");
    expect(r.replies.join("\n")).toBe("Não encontro um pedido neste número. Escreva *1* para se pré-inscrever ou contacte a secretaria.");
    expect(r.passo).toBe("menu");
    const depois = await handleWhatsappText(ctx.db, tel, email);
    expect(depois.replies.join("\n")).not.toMatch(/Pedido nº|Estado:/);
  });

  it("um email já conhecido recebe a mesma resposta que um novo", async () => {
    const ctx = await arrancar();
    const { handleWhatsappText } = await import("../src/whatsappBot.js");
    const { listOfertaGold } = await import("../src/ofertaGold.js");
    const { AVISO_PREINSCRICAO } = await import("../src/preinscricaoPublica.js");
    const turma = (await listOfertaGold(ctx.db))[0]!;
    const email = `${unico("dup")}@exemplo.pt`;
    const fim = async (tel: string) => {
      for (const t of ["menu", "1", "Rita", "Lopes", email, "Porto", turma.curso, turma.local, turma.horario, turma.dataInicio]) {
        await handleWhatsappText(ctx.db, tel, t);
      }
      return (await handleWhatsappText(ctx.db, tel, "sim")).replies.join("\n");
    };
    const primeiro = await fim("351919990002");
    const segundo = await fim("351919990003");
    expect(segundo).toContain(AVISO_PREINSCRICAO);
    expect(segundo).toBe(primeiro);
    expect(segundo).not.toMatch(/Já tínhamos|Pedido nº|Estado:/);
  });
});

describe("WhatsApp: simulador e conversa", () => {
  it("o simulador é só do admin; a conversa da secretaria", async () => {
    const ctx = await arrancar();
    const corpo = { telefone: "351919990004", texto: "menu" };
    for (const p of ["secretaria", "comercial", "financiada"] as const) {
      expect((await pedido(ctx, p, "POST", "/v1/crm/whatsapp/simular", corpo)).statusCode).toBe(403);
    }
    expect((await pedido(ctx, "admin", "POST", "/v1/crm/whatsapp/simular", corpo)).statusCode).toBe(200);
    const url = "/v1/crm/whatsapp/conversa?telefone=351919990004";
    for (const p of ["comercial", "financiada"] as const) expect((await pedido(ctx, p, "GET", url)).statusCode).toBe(403);
    for (const p of ["admin", "secretaria"] as const) expect((await pedido(ctx, p, "GET", url)).statusCode).toBe(200);
  });
});

describe("comercial: nada da Financiada", () => {
  it("não vê a pré-inscrição Fin que tem o seu nome, nem na lista nem na ficha", async () => {
    const ctx = await arrancar();
    const gold = await lead(ctx, "gold", ctx.userId.comercial);
    const fin = await lead(ctx, "fin", ctx.userId.comercial);
    expect((await pedido(ctx, "comercial", "GET", `/v1/crm/leads/${gold}`)).statusCode).toBe(200);
    expect((await pedido(ctx, "comercial", "GET", `/v1/crm/leads/${fin}`)).statusCode).toBe(404);
    const lista = await pedido(ctx, "comercial", "GET", "/v1/crm/leads?porPagina=200");
    expect(lista.statusCode, lista.body).toBe(200);
    expect(lista.body).toContain(`"id":${gold}`);
    expect(lista.body).not.toContain(`"id":${fin}`);
  });

  it("uma pré-inscrição Fin não passa a um comercial", async () => {
    const ctx = await arrancar();
    const fin = await lead(ctx, "fin", null);
    const r = await pedido(ctx, "secretaria", "PATCH", `/v1/preinscricoes/${fin}`, { comercialId: ctx.userId.comercial });
    expect(r.statusCode, r.body).toBe(409);
    const ok = await pedido(ctx, "secretaria", "PATCH", `/v1/preinscricoes/${fin}`, { comercialId: ctx.userId.financiada });
    expect(ok.statusCode, ok.body).toBe(200);
    const lote = await pedido(ctx, "secretaria", "POST", "/v1/crm/lote", { ids: [fin], acao: "atribuir", comercialId: ctx.userId.comercial });
    expect(lote.statusCode, lote.body).toBe(200);
    const dono = await ctx.db.query<{ c: string }>("SELECT comercial_id::text AS c FROM preinscricoes WHERE id = $1", [fin]);
    expect(dono.rows[0]!.c).toBe(ctx.userId.financiada);
  });
});

describe("ficha do formador por regime", () => {
  it("a Financiada não abre a ficha de um formador só da Gold e não vê turmas Gold", async () => {
    const ctx = await arrancar();
    const soGold = (await ctx.db.query<{ id: number }>(
      `INSERT INTO formadores (id, nome, regimes, estado) VALUES (nextval('ops_id_seq')::int, $1, '["gold"]'::jsonb, 'Ativo') RETURNING id`,
      [unico("Gold Só ")],
    )).rows[0]!.id;
    expect((await pedido(ctx, "financiada", "GET", `/v1/formadores/${soGold}`)).statusCode).toBe(403);
    expect((await pedido(ctx, "secretaria", "GET", `/v1/formadores/${soGold}`)).statusCode).toBe(200);

    const nome = unico("Ambos ");
    const ambos = (await ctx.db.query<{ id: number }>(
      `INSERT INTO formadores (id, nome, regimes, estado) VALUES (nextval('ops_id_seq')::int, $1, '["gold","fin"]'::jsonb, 'Ativo') RETURNING id`,
      [nome],
    )).rows[0]!.id;
    const sessao = JSON.stringify([{ id: "s1", data: "2099-03-01", horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", formadores: [nome] }]);
    await ctx.db.query(
      "INSERT INTO turmas_gold (id, data_inicio, nome, curso, formador, cronograma) VALUES (nextval('ops_id_seq')::int, '2099-03-01', $1, 'Curso', $2, $3::jsonb)",
      [unico("TG "), nome, sessao],
    );
    await ctx.db.query(
      "INSERT INTO turmas_fin (id, data_inicio, nome, curso, financiador, cronograma) VALUES (nextval('ops_id_seq')::int, '2099-03-01', $1, 'UFCD', 'IEFP', $2::jsonb)",
      [unico("TF "), sessao],
    );
    const fin = await pedido(ctx, "financiada", "GET", `/v1/formadores/${ambos}`);
    expect(fin.statusCode, fin.body).toBe(200);
    const corpo = fin.json() as { turmas: { regime: string }[]; sessoes: { regime: string }[] };
    expect(corpo.turmas.map(t => t.regime)).toEqual(["fin"]);
    expect(corpo.sessoes.map(s => s.regime)).toEqual(["fin"]);
    const sec = (await pedido(ctx, "secretaria", "GET", `/v1/formadores/${ambos}`)).json() as { turmas: unknown[] };
    expect(sec.turmas).toHaveLength(2);
  });
});

describe("turma vista pelo formador", () => {
  it("só o seu valor por hora e sem custo da sala", async () => {
    const ctx = await arrancar();
    const nome = unico("Eu Formador ");
    await ctx.db.query(
      `INSERT INTO formadores (id, nome, regimes, estado, user_id) VALUES (nextval('ops_id_seq')::int, $1, '["gold"]'::jsonb, 'Ativo', $2)`,
      [nome, ctx.userId.formador],
    );
    const turmaId = (await ctx.db.query<{ id: number }>(
      `INSERT INTO turmas_gold (id, data_inicio, nome, curso, formador, formadores, cronograma, valores_hora_formador, custo_hora_sala)
       VALUES (nextval('ops_id_seq')::int, '2099-04-01', $1, 'Curso', $2, '["Colega"]'::jsonb, '[]'::jsonb, $3::jsonb, 7) RETURNING id`,
      [unico("TV "), nome, JSON.stringify({ [nome]: 20, Colega: 35 })],
    )).rows[0]!.id;
    const f = await pedido(ctx, "formador", "GET", `/v1/turmas/gold/${turmaId}`);
    expect(f.statusCode, f.body).toBe(200);
    expect(f.json().turma).toMatchObject({ valoresHoraFormador: { [nome]: 20 }, custoHoraSala: 0 });
    const s = (await pedido(ctx, "secretaria", "GET", `/v1/turmas/gold/${turmaId}`)).json();
    expect(s.turma).toMatchObject({ valoresHoraFormador: { [nome]: 20, Colega: 35 }, custoHoraSala: 7 });
  });
});

describe("ligação de documentos do formando Fin", () => {
  it("fecha (410) quando desiste, é indeferido ou a turma fecha", async () => {
    const ctx = await arrancar();
    const turma = (await ctx.db.query<{ id: number }>(
      "INSERT INTO turmas_fin (id, data_inicio, nome, curso, financiador, cronograma) VALUES (nextval('ops_id_seq')::int, '2099-05-01', $1, 'UFCD', 'IEFP', '[]'::jsonb) RETURNING id",
      [unico("TFL ")],
    )).rows[0]!.id;
    const formando = async (estado: string) => {
      const token = randomBytes(18).toString("base64url");
      await ctx.db.query(
        `INSERT INTO formandos_fin (id, nome, apelido, email, curso, turma, estado, turma_id, docs_token)
         VALUES (nextval('ops_id_seq')::int, 'Ana', 'Fin', $1, 'UFCD', '', $2, $3, $4)`,
        [`${unico("ff")}@exemplo.pt`, estado, turma, token],
      );
      return token;
    };
    const activo = await formando("A frequentar");
    const desistente = await formando("Desistente");
    const indeferido = await formando("Indeferido");
    const url = (t: string) => `/v1/public/formando-documentos/${t}`;
    expect((await pedido(ctx, null, "GET", url(activo))).statusCode).toBe(200);
    expect((await pedido(ctx, null, "GET", url(desistente))).statusCode).toBe(410);
    expect((await pedido(ctx, null, "GET", url(indeferido))).statusCode).toBe(410);
    expect((await pedido(ctx, null, "POST", url(desistente), {})).statusCode).toBe(410);
    await ctx.db.query("UPDATE turmas_fin SET fechada_em = now() WHERE id = $1", [turma]);
    expect((await pedido(ctx, null, "GET", url(activo))).statusCode).toBe(410);
  });
});

describe("login: limite por email", () => {
  it("passadas 30 tentativas numa hora, 429 com a mesma mensagem, exista ou não a conta", async () => {
    const ctx = await arrancar();
    const { dentroDoLimite } = await import("../src/limitePedidos.js");
    const existente = (await ctx.db.query<{ email: string }>("SELECT email FROM users WHERE id = $1", [ctx.userId.secretaria])).rows[0]!.email;
    const inexistente = `${unico("ninguem")}@exemplo.pt`;
    const respostas: string[] = [];
    for (const email of [existente, inexistente]) {
      for (let i = 0; i < 30; i++) await dentroDoLimite(ctx.db, "login-email", email, 30, 3600);
      const r = await pedido(ctx, null, "POST", "/v1/auth/login", { email, password: "errada-123456" });
      expect(r.statusCode, r.body).toBe(429);
      respostas.push(r.json().error);
    }
    expect(respostas[0]).toBe(respostas[1]);
  });
});
