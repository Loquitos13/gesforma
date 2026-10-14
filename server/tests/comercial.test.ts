import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { arrancar, pedido, type Ctx } from "./helpers.js";

let ctx: Ctx;

beforeAll(async () => {
  ctx = await arrancar();
});

afterAll(async () => {
  await ctx.app.close();
});

async function novoLead(campanhaId: number | null, estado: string, preco: number, extra: { comercial?: string; criado?: string; origem?: string } = {}) {
  const r = await ctx.db.query<{ id: number }>(
    `INSERT INTO preinscricoes (id, inscrito, nome, email, curso, preco, estado, campanha_id, origem, comercial_id, regime, created_at)
     VALUES (nextval('ops_id_seq')::int, to_char(now(), 'YYYY-MM-DD'), 'Teste', $1, 'Curso Campanha', $2, $3, $4, $5, $6, 'gold', COALESCE($7::timestamptz, now()))
     RETURNING id`,
    [`lead.${Math.random().toString(36).slice(2)}@exemplo.pt`, preco, estado, campanhaId, extra.origem ?? "Instagram", extra.comercial ?? null, extra.criado ?? null],
  );
  return r.rows[0]!.id;
}

describe("Campanhas: números pela ligação campanha_id", () => {
  it("conta pré-inscrições, pagos, receita, ROI e origens só das ligadas à campanha", async () => {
    const criar = await pedido(ctx, "comercial", "POST", "/v1/campanhas", {
      nome: "Teste campanha", data: "2026-01-01", custo: 100, canal: "Instagram", curso: "Curso Campanha",
    });
    expect(criar.statusCode).toBe(200);
    const id = criar.json().campanha.id as number;
    await novoLead(id, "Não contactado", 125);
    await novoLead(id, "Pago", 125);
    await novoLead(id, "Desistiu", 125, { origem: "Google" });
    // Mesmo curso, sem ligação: não conta (antes casava pelo nome do curso).
    await novoLead(null, "Pago", 999);

    const r = await pedido(ctx, "comercial", "GET", `/v1/campanhas/${id}`);
    expect(r.statusCode).toBe(200);
    const c = r.json().campanha;
    expect(c.preinscricoes).toBe(3);
    expect(c.pagos).toBe(1);
    expect(c.receita).toBe(125);
    expect(c.porContactar).toBe(1);
    expect(c.desistiram).toBe(1);
    expect(c.conversao).toBe(33);
    expect(c.roi).toBe(25);
    expect(c.origens).toEqual([{ origem: "Instagram", n: 2 }, { origem: "Google", n: 1 }]);

    const lista = await pedido(ctx, "comercial", "GET", "/v1/campanhas?estado=ativas");
    expect(lista.json().campanhas.some((x: { id: number }) => x.id === id)).toBe(true);
    expect(lista.json().resumo.ativas).toBeGreaterThanOrEqual(1);
  });

  it("valida datas e apaga sem perder as pré-inscrições", async () => {
    const mau = await pedido(ctx, "comercial", "POST", "/v1/campanhas", { nome: "X", data: "2026-05-01", fim: "2026-04-01" });
    expect(mau.statusCode).toBe(400);
    const criar = await pedido(ctx, "secretaria", "POST", "/v1/campanhas", { nome: "Apagar", data: "2026-05-01" });
    const id = criar.json().campanha.id as number;
    const lead = await novoLead(id, "Não contactado", 0);
    expect((await pedido(ctx, "secretaria", "DELETE", `/v1/campanhas/${id}`)).statusCode).toBe(200);
    const r = await ctx.db.query<{ campanha_id: number | null }>("SELECT campanha_id FROM preinscricoes WHERE id = $1", [lead]);
    expect(r.rows[0]!.campanha_id).toBeNull();
  });

  it("a Financiada e o formador não gerem campanhas", async () => {
    expect((await pedido(ctx, "financiada", "GET", "/v1/campanhas")).statusCode).toBe(403);
    expect((await pedido(ctx, "formador", "GET", "/v1/campanhas")).statusCode).toBe(403);
  });
});

describe("Clientes, propostas e contratos", () => {
  it("cliente com proposta: resumo, ficha, bloqueio de apagar e contrato a partir da proposta", async () => {
    const c = await pedido(ctx, "comercial", "POST", "/v1/crm/clientes", { nome: "Empresa Teste, Lda.", email: "geral@empresa-teste.pt", nif: "509000000" });
    expect(c.statusCode).toBe(200);
    const id = c.json().cliente.id as number;
    expect((await pedido(ctx, "comercial", "POST", "/v1/crm/clientes", { nome: "X", email: "nao-e-email" })).statusCode).toBe(400);

    const p = await pedido(ctx, "comercial", "POST", `/v1/crm/clientes/${id}/propostas`, { curso: "Excel", valor: 1200 });
    expect(p.statusCode).toBe(200);
    const propostaId = p.json().proposta.id as number;

    const lista = await pedido(ctx, "comercial", "GET", "/v1/crm/clientes?q=Empresa%20Teste");
    const linha = lista.json().linhas.find((x: { id: number }) => x.id === id);
    expect(linha).toMatchObject({ propostas: 1, emAberto: 1200, contratos: 0, ultimoEstado: "Enviada" });

    expect((await pedido(ctx, "comercial", "DELETE", `/v1/crm/clientes/${id}`)).statusCode).toBe(403);
    expect((await pedido(ctx, "secretaria", "DELETE", `/v1/crm/clientes/${id}`)).statusCode).toBe(409);

    const k = await pedido(ctx, "comercial", "POST", "/v1/crm/contratos", { clienteNome: "Empresa Teste, Lda.", propostaId });
    expect(k.statusCode).toBe(200);
    const contrato = k.json().contrato;
    expect(contrato).toMatchObject({ clienteId: id, curso: "Excel", valor: 1200, estado: "Rascunho" });

    const ass = await pedido(ctx, "comercial", "PATCH", `/v1/crm/contratos/${contrato.id}`, { estado: "Assinado" });
    expect(ass.json().contrato.assinadoEm).toBeTruthy();
    expect((await pedido(ctx, "comercial", "PATCH", `/v1/crm/contratos/${contrato.id}`, { valor: 1 })).statusCode).toBe(409);
    expect((await pedido(ctx, "secretaria", "DELETE", `/v1/crm/contratos/${contrato.id}`)).statusCode).toBe(409);

    const ficha = await pedido(ctx, "comercial", "GET", `/v1/crm/clientes/${id}`);
    expect(ficha.json().cliente.propostas[0].contratoId).toBe(contrato.id);
    expect(ficha.json().cliente.contratos).toHaveLength(1);
  });

  it("modelos: só a secretaria edita, e conta os usos", async () => {
    expect((await pedido(ctx, "comercial", "POST", "/v1/crm/modelos/contrato", { nome: "Modelo X" })).statusCode).toBe(403);
    const m = await pedido(ctx, "secretaria", "POST", "/v1/crm/modelos/contrato", { nome: "Modelo X", corpo: "Contrato com {{cliente}}" });
    const mid = m.json().modelo.id as number;
    await pedido(ctx, "comercial", "POST", "/v1/crm/contratos", { clienteNome: "Cliente Y", templateId: mid });
    const lista = await pedido(ctx, "comercial", "GET", "/v1/crm/modelos/contrato");
    expect(lista.json().modelos.find((x: { id: number }) => x.id === mid).usos).toBe(1);
    expect((await pedido(ctx, "secretaria", "PATCH", `/v1/crm/modelos/contrato/${mid}`, { nome: "Modelo Y" })).json().modelo.nome).toBe("Modelo Y");
  });

  it("parceiros: criar, alterar e apagar só pela secretaria", async () => {
    const p = await pedido(ctx, "comercial", "POST", "/v1/crm/parceiros", { nome: "Associação Teste", tipo: "Associação" });
    const id = p.json().parceiro.id as number;
    expect((await pedido(ctx, "comercial", "PATCH", `/v1/crm/parceiros/${id}`, { retribuicao: "10 % por inscrito" })).statusCode).toBe(200);
    const lista = await pedido(ctx, "comercial", "GET", "/v1/crm/parceiros?q=Associa");
    expect(lista.json().parceiros.find((x: { id: number }) => x.id === id).retribuicao).toBe("10 % por inscrito");
    expect((await pedido(ctx, "comercial", "DELETE", `/v1/crm/parceiros/${id}`)).statusCode).toBe(403);
    expect((await pedido(ctx, "secretaria", "DELETE", `/v1/crm/parceiros/${id}`)).statusCode).toBe(200);
  });

  it("o formador não lê o diretório comercial", async () => {
    expect((await pedido(ctx, "formador", "GET", "/v1/crm/clientes")).statusCode).toBe(403);
  });
});

describe("Equipa: período e período anterior", () => {
  it("separa as pré-inscrições do período das do período anterior", async () => {
    const comercial = ctx.userId.comercial;
    await novoLead(null, "Pago", 200, { comercial, criado: "2026-03-10T10:00:00Z" });
    await novoLead(null, "Não contactado", 200, { comercial, criado: "2026-03-12T10:00:00Z" });
    await novoLead(null, "Pago", 300, { comercial, criado: "2026-02-10T10:00:00Z" });
    const r = await pedido(ctx, "secretaria", "GET", "/v1/equipa?regime=gold&de=2026-03-01&ate=2026-03-31");
    expect(r.statusCode).toBe(200);
    const m = r.json().membros.find((x: { id: string }) => x.id === comercial);
    expect(m.atual).toMatchObject({ leads: 2, pagos: 1, receita: 200, conversao: 50 });
    expect(r.json().periodo.anterior).toEqual({ de: "2026-01-29", ate: "2026-02-28" });
    expect(m.anterior).toMatchObject({ leads: 1, pagos: 1, receita: 300 });

    const ficha = await pedido(ctx, "comercial", "GET", `/v1/equipa/${comercial}?regime=gold`);
    expect(ficha.statusCode).toBe(200);
    expect(ficha.json().membro.carteira.leads).toBeGreaterThanOrEqual(3);
  });

  it("cada equipa só vê a sua", async () => {
    expect((await pedido(ctx, "comercial", "GET", "/v1/equipa?regime=fin")).statusCode).toBe(403);
    expect((await pedido(ctx, "financiada", "GET", "/v1/equipa?regime=gold")).statusCode).toBe(403);
    expect((await pedido(ctx, "comercial", "PUT", `/v1/equipa/${ctx.userId.comercial}/objetivo`, { metaPct: 30 })).statusCode).toBe(403);
  });
});
