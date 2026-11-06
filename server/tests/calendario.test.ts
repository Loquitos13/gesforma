// Calendário: cada perfil vê o seu (administração tudo; coordenações o seu regime; comercial Gold as sessões Gold;
// formador só as suas sessões).
import { describe, expect, it } from "vitest";
import { arrancar, pedido } from "./helpers.js";

describe("calendário", () => {
  it("sessões com turma, curso, módulo e horário; filtros por perfil", async () => {
    const ctx = await arrancar();
    const marca = `CAL${Date.now()}`;
    const g = await pedido(ctx, "secretaria", "POST", "/v1/turmas-gold", {
      dataInicio: "2099-03-02", nome: `${marca}-G`, curso: "Formação de Formadores - CCP", local: "Lisboa", horario: "Laboral", vagas: 10, estado: "Ativa",
      cronograma: [
        { id: "s1", data: "2099-03-02", horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", modulos: ["M1 · Formador"], formadores: ["Rita Cal"] },
        { id: "s2", data: "2099-03-03", horaInicio: "09:00", horaFim: "13:00", modalidade: "auto", modulos: ["M2"], formadores: [] },
        { id: "fim-cronograma", data: "2099-03-20", horaInicio: "", horaFim: "", modalidade: "presencial" },
      ],
    });
    expect(g.statusCode, g.body).toBe(200);
    const q = "/v1/calendario?de=2099-03-01&ate=2099-03-31";
    const doTeste = (r: { json: () => { eventos: { turma: string; tipo: string; modulos: string[]; inicio: string; fim: string; curso: string }[] } }) =>
      r.json().eventos.filter(e => e.turma.startsWith(marca));

    const admin = doTeste(await pedido(ctx, "admin", "GET", q));
    expect(admin.filter(e => e.tipo === "sessao")).toEqual([expect.objectContaining({ modulos: ["M1 · Formador"], inicio: "09:00", fim: "13:00", curso: "Formação de Formadores - CCP" })]);
    expect(admin.map(e => e.tipo)).toEqual(expect.arrayContaining(["inicio", "fim"]));
    // Coordenação Gold: as suas turmas com as datas; Financiada não vê Gold; comercial só as sessões.
    expect(doTeste(await pedido(ctx, "secretaria", "GET", q)).map(e => e.tipo)).toEqual(expect.arrayContaining(["sessao", "inicio", "fim"]));
    expect(doTeste(await pedido(ctx, "financiada", "GET", q))).toEqual([]);
    expect(doTeste(await pedido(ctx, "comercial", "GET", q)).map(e => e.tipo)).toEqual(["sessao"]);
    expect((await pedido(ctx, "contabilidade", "GET", q)).statusCode).toBe(403);
    // Formador: só as sessões em que está.
    expect(doTeste(await pedido(ctx, "formador", "GET", q))).toEqual([]);
    const f = await pedido(ctx, "admin", "POST", "/v1/formadores", { nome: "Rita Cal", email: "", regimes: ["gold"] });
    await ctx.db.query("UPDATE formadores SET user_id = $2 WHERE id = $1", [f.json().formador.id, ctx.userId.formador]);
    expect(doTeste(await pedido(ctx, "formador", "GET", q)).map(e => e.tipo)).toEqual(["sessao"]);
    expect((await pedido(ctx, "admin", "GET", "/v1/calendario?de=2099-01-01&ate=2099-12-31")).statusCode).toBe(400);
  });
});
