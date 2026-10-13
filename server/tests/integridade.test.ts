import { describe, expect, it } from "vitest";
import { normalizarEstado, validarTransicao } from "../src/estados.js";
import { arrancar, pedido, type Ctx } from "./helpers.js";

describe("máquinas de estado", () => {
  it("normaliza variantes", () => {
    expect(normalizarEstado("formandoGold", "concluido")).toBe("Concluído");
    expect(normalizarEstado("turmaGold", "Ativo")).toBe("Ativa");
    expect(normalizarEstado("pagamento", "xpto")).toBeNull();
  });
  it("transições", () => {
    expect(validarTransicao("pagamento", "Pago", "Pendente", "secretaria").ok).toBe(false);
    expect(validarTransicao("pagamento", "Pago", "Pendente", "admin").ok).toBe(true);
    expect(validarTransicao("pagamento", "Pago", "Reembolsado", "secretaria").ok).toBe(true);
    expect(validarTransicao("turmaFin", "A decorrer", "Encerrada", "admin").ok).toBe(false);
    expect(validarTransicao("formandoGold", "estado antigo", "Formando", "secretaria").ok).toBe(true);
  });
});

let seq = 0;
async function novaTurmaGold(ctx: Ctx, vagas: number) {
  seq += 1;
  const res = await pedido(ctx, "secretaria", "POST", "/v1/turmas-gold", {
    dataInicio: "2030-01-07", nome: `TESTE-${Date.now()}-${seq}`, curso: "Curso de Teste", vagas, toleranciaVagas: 0,
    cronograma: [{ id: `s${seq}`, data: "2030-01-07", horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", formadores: [] }],
  });
  expect(res.statusCode).toBe(200);
  return res.json().turma as { id: number; nome: string };
}

function inscrever(ctx: Ctx, turmaId: number, email: string) {
  return pedido(ctx, "secretaria", "POST", "/v1/formandos-gold", { nome: "Ana", apelido: email, email, turmaId });
}

describe("inscrições e vagas", () => {
  it("recusa acima da capacidade e conta no servidor", async () => {
    const ctx = await arrancar();
    const t = await novaTurmaGold(ctx, 2);
    expect((await inscrever(ctx, t.id, "a1@exemplo.pt")).statusCode).toBe(200);
    expect((await inscrever(ctx, t.id, "a1@exemplo.pt")).statusCode).toBe(409);
    expect((await inscrever(ctx, t.id, "a2@exemplo.pt")).statusCode).toBe(200);
    const cheia = await inscrever(ctx, t.id, "a3@exemplo.pt");
    expect(cheia.statusCode).toBe(409);
    const row = await ctx.db.query<{ total_alunos: number }>("SELECT total_alunos FROM turmas_gold WHERE id = $1", [t.id]);
    expect(row.rows[0]!.total_alunos).toBe(2);
    // O contador enviado pelo cliente é ignorado.
    await pedido(ctx, "secretaria", "PATCH", `/v1/turmas-gold/${t.id}`, { totalAlunos: 99 });
    const depois = await ctx.db.query<{ total_alunos: number }>("SELECT total_alunos FROM turmas_gold WHERE id = $1", [t.id]);
    expect(depois.rows[0]!.total_alunos).toBe(2);
    // Não se reduz a capacidade abaixo dos inscritos.
    expect((await pedido(ctx, "secretaria", "PATCH", `/v1/turmas-gold/${t.id}`, { vagas: 1 })).statusCode).toBe(409);
  });

  it("duas inscrições em simultâneo para a última vaga: só uma entra", async () => {
    const ctx = await arrancar();
    const t = await novaTurmaGold(ctx, 1);
    const [a, b] = await Promise.all([inscrever(ctx, t.id, "c1@exemplo.pt"), inscrever(ctx, t.id, "c2@exemplo.pt")]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409]);
  });

  it("estado inválido ou transição proibida", async () => {
    const ctx = await arrancar();
    const t = await novaTurmaGold(ctx, 5);
    const f = (await inscrever(ctx, t.id, "d1@exemplo.pt")).json().formando as { id: number };
    expect((await pedido(ctx, "secretaria", "PATCH", `/v1/formandos-gold/${f.id}`, { estado: "Voador" })).statusCode).toBe(409);
    expect((await pedido(ctx, "secretaria", "PATCH", `/v1/formandos-gold/${f.id}`, { estado: "Certificado" })).statusCode).toBe(409);
    expect((await pedido(ctx, "secretaria", "PATCH", `/v1/formandos-gold/${f.id}`, { estado: "desistente" })).statusCode).toBe(200);
    const row = await ctx.db.query<{ total_alunos: number }>("SELECT total_alunos FROM turmas_gold WHERE id = $1", [t.id]);
    expect(row.rows[0]!.total_alunos).toBe(0);
  });

  it("presenças só com formandos da turma", async () => {
    const ctx = await arrancar();
    const t = await novaTurmaGold(ctx, 5);
    const res = await pedido(ctx, "secretaria", "PUT", `/v1/turmas/gold/${t.id}/sessoes/1`, {
      presencas: [{ id: 999999, nome: "Fantasma", presente: true }],
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("pagamentos", () => {
  it("confirmar pagamento só marca o formando desse curso", async () => {
    const ctx = await arrancar();
    const email = "pag@exemplo.pt";
    await pedido(ctx, "secretaria", "POST", "/v1/formandos-gold", { nome: "P", email, curso: "Curso A" });
    await pedido(ctx, "secretaria", "POST", "/v1/formandos-gold", { nome: "P", email, curso: "Curso B" });
    const res = await pedido(ctx, "secretaria", "POST", "/v1/pagamentos", { nome: "P", valor: 10, curso: "Curso A", email, estado: "Pago" });
    expect(res.statusCode).toBe(200);
    const rows = await ctx.db.query<{ curso: string; pago: boolean }>("SELECT curso, pago FROM formandos_gold WHERE email = $1 ORDER BY curso", [email]);
    expect(rows.rows.map(r => [r.curso, r.pago])).toEqual([["Curso A", true], ["Curso B", false]]);
    const id = res.json().pagamento.id as string;
    expect((await pedido(ctx, "secretaria", "PATCH", `/v1/pagamentos/${id}`, { estado: "Pendente" })).statusCode).toBe(409);
    expect((await pedido(ctx, "secretaria", "DELETE", `/v1/pagamentos/${id}`)).statusCode).toBe(409);
    expect((await pedido(ctx, "secretaria", "PATCH", `/v1/pagamentos/${id}`, { estado: "Reembolsado" })).statusCode).toBe(200);
  });
});
