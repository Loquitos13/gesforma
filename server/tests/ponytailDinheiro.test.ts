import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { arrancar, pedido, type Ctx } from "./helpers.js";

let seq = 0;
const idLead = () => 970000 + Math.floor(Math.random() * 9000) * 10 + (++seq % 10);

async function novoPagamento(ctx: Ctx, estado: string, d: { email: string; curso: string; valor?: number }) {
  const id = `PT-${randomUUID().slice(0, 8)}`;
  await ctx.db.query(
    `INSERT INTO pagamentos (id, nome, valor, metodo, curso, data, estado, email, referencia)
     VALUES ($1, 'Rita Teste', $2, 'Transferência bancária', $3, '2026-10-01 10:00', $4, $5, '')`,
    [id, d.valor ?? 100, d.curso, estado, d.email],
  );
  return id;
}

async function novoLead(ctx: Ctx, d: {
  email?: string; curso?: string; estado?: string; preco?: number; pagamentoId?: string | null;
  campanhaId?: number | null; comercialId?: string | null;
}) {
  const id = idLead();
  await ctx.db.query(
    `INSERT INTO preinscricoes (id, inscrito, nome, apelido, email, curso, preco, estado, regime, pagamento_id, campanha_id, comercial_id)
     VALUES ($1, '2026-10-01', 'Rita', 'Teste', $2, $3, $4, $5, 'gold', $6, $7, $8)`,
    [id, d.email ?? `lead.${randomUUID().slice(0, 8)}@exemplo.pt`, d.curso ?? "Curso Dinheiro", d.preco ?? 100,
      d.estado ?? "2º Contacto", d.pagamentoId ?? null, d.campanhaId ?? null, d.comercialId ?? null],
  );
  return id;
}

const estadoDe = async (ctx: Ctx, id: string) =>
  (await ctx.db.query<{ estado: string }>("SELECT estado FROM pagamentos WHERE id = $1", [id])).rows[0]!.estado;
const pagamentoDoLead = async (ctx: Ctx, id: number) =>
  (await ctx.db.query<{ pagamento_id: string | null }>("SELECT pagamento_id FROM preinscricoes WHERE id = $1", [id])).rows[0]!.pagamento_id;

describe("pagamento cancelado ou reembolsado não se reaproveita", () => {
  it("validar o comprovativo não o põe «Pago»; um novo pedido cria outro pagamento", async () => {
    const ctx = await arrancar();
    const email = `reemb.${randomUUID().slice(0, 8)}@exemplo.pt`;
    const curso = `Curso Reembolso ${randomUUID().slice(0, 4)}`;
    const reemb = await novoPagamento(ctx, "Reembolsado", { email, curso });
    const leadId = await novoLead(ctx, { email, curso, pagamentoId: reemb });
    await ctx.db.query(
      "INSERT INTO preinscricao_docs (preinscricao_id, tipo, nome, estado) VALUES ($1, 'comprovativo', 'comprovativo.pdf', 'pendente')",
      [leadId],
    );
    const doc = await ctx.db.query<{ id: number }>("SELECT id FROM preinscricao_docs WHERE preinscricao_id = $1", [leadId]);
    const r = await pedido(ctx, "secretaria", "POST", `/v1/crm/leads/${leadId}/documentos/${doc.rows[0]!.id}/validar`);
    expect(r.statusCode, r.body).toBe(200);
    expect(await estadoDe(ctx, reemb)).toBe("Reembolsado");

    const { ensurePagamentoPendente } = await import("../src/pagamentoPedido.js");
    const novo = await ensurePagamentoPendente(ctx.db, {
      id: leadId, nome: "Rita", apelido: "Teste", email, curso, preco: 120, pagamento_id: reemb,
    });
    expect(String(novo.id)).not.toBe(reemb);
    expect(novo.estado).toBe("Pendente");
    expect(await pagamentoDoLead(ctx, leadId)).toBe(String(novo.id));
    const reembRow = await ctx.db.query<{ estado: string; valor: string }>("SELECT estado, valor FROM pagamentos WHERE id = $1", [reemb]);
    expect(reembRow.rows[0]).toMatchObject({ estado: "Reembolsado" });
    expect(Number(reembRow.rows[0]!.valor)).toBe(100);
  });

  it("um pendente do mesmo email e curso substitui a ligação ao reembolsado", async () => {
    const ctx = await arrancar();
    const email = `subst.${randomUUID().slice(0, 8)}@exemplo.pt`;
    const curso = `Curso Subst ${randomUUID().slice(0, 4)}`;
    const reemb = await novoPagamento(ctx, "Reembolsado", { email, curso });
    const pendente = await novoPagamento(ctx, "Pendente", { email, curso });
    const leadId = await novoLead(ctx, { email, curso, pagamentoId: reemb });
    const { ensurePagamentoPendente } = await import("../src/pagamentoPedido.js");
    const pag = await ensurePagamentoPendente(ctx.db, { id: leadId, nome: "Rita", apelido: "Teste", email, curso, preco: 100, pagamento_id: reemb });
    expect(String(pag.id)).toBe(pendente);
    expect(await pagamentoDoLead(ctx, leadId)).toBe(pendente);
  });

  it("marcar a pré-inscrição como paga com um pagamento cancelado regista um novo", async () => {
    const ctx = await arrancar();
    const email = `canc.${randomUUID().slice(0, 8)}@exemplo.pt`;
    const curso = `Curso Cancelado ${randomUUID().slice(0, 4)}`;
    const canc = await novoPagamento(ctx, "Cancelado", { email, curso });
    const leadId = await novoLead(ctx, { email, curso, pagamentoId: canc });
    const { marcarLeadPago } = await import("../src/pagamentoPedido.js");
    const r = await marcarLeadPago(ctx.db, leadId);
    expect(r?.pagamentoId).toBeTruthy();
    expect(r!.pagamentoId).not.toBe(canc);
    expect(await estadoDe(ctx, canc)).toBe("Cancelado");
    expect(await estadoDe(ctx, r!.pagamentoId)).toBe("Pago");
  });
});

describe("apoio recalculado nunca fica negativo", () => {
  it("o ajuste manual é limitado ao novo valor calculado", async () => {
    const ctx = await arrancar();
    const { gravarCalculado } = await import("../src/repos/apoios.js");
    const base = { formandoId: 980001, turmaId: 980001, periodo: "2026-05", tipo: "bolsa" as const, dias: 10, horas: 40, detalhe: {} };
    await gravarCalculado(ctx.db, { ...base, valor: 100 }, ctx.userId.admin);
    await ctx.db.query("UPDATE apoios SET ajuste = -80 WHERE formando_id = $1 AND periodo = $2", [base.formandoId, base.periodo]);
    expect(await gravarCalculado(ctx.db, { ...base, valor: 50 }, ctx.userId.admin)).toBe("atualizado");
    const r = await ctx.db.query<{ valor_calculado: string; ajuste: string }>(
      "SELECT valor_calculado, ajuste FROM apoios WHERE formando_id = $1 AND periodo = $2", [base.formandoId, base.periodo]);
    expect(Number(r.rows[0]!.valor_calculado)).toBe(50);
    expect(Number(r.rows[0]!.ajuste)).toBe(-50);
    // Um ajuste que cabe no novo valor fica como está.
    await ctx.db.query("UPDATE apoios SET ajuste = -20 WHERE formando_id = $1 AND periodo = $2", [base.formandoId, base.periodo]);
    await gravarCalculado(ctx.db, { ...base, valor: 60 }, ctx.userId.admin);
    const s = await ctx.db.query<{ ajuste: string }>("SELECT ajuste FROM apoios WHERE formando_id = $1 AND periodo = $2", [base.formandoId, base.periodo]);
    expect(Number(s.rows[0]!.ajuste)).toBe(-20);
  });
});

describe("receita de campanhas e da equipa não conta reembolsos", () => {
  it("pré-inscrição paga com pagamento reembolsado não entra nos pagos nem na receita", async () => {
    const ctx = await arrancar();
    const criar = await pedido(ctx, "comercial", "POST", "/v1/campanhas", {
      nome: `Campanha reembolso ${randomUUID().slice(0, 6)}`, data: "2026-01-01", custo: 50, canal: "Instagram", curso: "Curso Dinheiro",
    });
    expect(criar.statusCode, criar.body).toBe(200);
    const campanhaId = criar.json().campanha.id as number;
    const comercialId = ctx.userId.comercial;
    const curso = "Curso Dinheiro";
    const email = () => `camp.${randomUUID().slice(0, 8)}@exemplo.pt`;
    const e1 = email(), e2 = email();
    const reemb = await novoPagamento(ctx, "Reembolsado", { email: e1, curso, valor: 200 });
    const pago = await novoPagamento(ctx, "Pago", { email: e2, curso, valor: 150 });
    await novoLead(ctx, { email: e1, curso, estado: "Pago", preco: 200, pagamentoId: reemb, campanhaId, comercialId });
    await novoLead(ctx, { email: e2, curso, estado: "Formando", preco: 150, pagamentoId: pago, campanhaId, comercialId });
    await novoLead(ctx, { curso, estado: "Formando", preco: 100, campanhaId, comercialId });

    const r = await pedido(ctx, "comercial", "GET", `/v1/campanhas/${campanhaId}`);
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().campanha).toMatchObject({ pagos: 2, receita: 250 });

    const { indicadoresEquipa } = await import("../src/repos/equipa.js");
    const ind = await indicadoresEquipa(ctx.db, "gold", { de: "2000-01-01", ate: "2100-01-01", anterior: { de: "1990-01-01", ate: "1999-12-31" } }, comercialId);
    const eu = ind.porPessoa(comercialId);
    expect(eu.carteira).toMatchObject({ leads: 3, pagos: 2, receita: 250 });
    expect(eu.atual).toMatchObject({ pagos: 2, receita: 250 });
  });
});
