import { describe, expect, it } from "vitest";
import { arrancar, pedido } from "./helpers.js";

type TurmaPublica = { turmaId: number; vagasLivres: number; vagasMostradas: number };

describe("vagas anunciadas no site", () => {
  it("a secretaria anuncia menos vagas; o site mostra-as sem passar das reais; vazio volta às reais", async () => {
    const ctx = await arrancar();
    const criar = await pedido(ctx, "secretaria", "POST", "/v1/turmas-gold", {
      dataInicio: "2099-05-04", nome: `VA ${Date.now()}`, curso: "Curso Vagas", local: "Porto", horario: "Laboral", vagas: 16,
      vagasAnunciadas: 3,
    });
    expect(criar.statusCode, criar.body).toBe(200);
    const id = (criar.json() as { turma: { id: number; vagasAnunciadas: number | null } }).turma.id;
    expect((criar.json() as { turma: { vagasAnunciadas: number } }).turma.vagasAnunciadas).toBe(3);

    const publica = async () => ((await ctx.app.inject({ method: "GET", url: "/v1/public/oferta" })).json() as { turmas: TurmaPublica[] })
      .turmas.find(t => t.turmaId === id);
    expect(await publica()).toMatchObject({ vagasLivres: 16, vagasMostradas: 3 });

    // Mais do que as livres: o site mostra só as livres.
    expect((await pedido(ctx, "secretaria", "PATCH", `/v1/turmas-gold/${id}`, { vagasAnunciadas: 40 })).statusCode).toBe(200);
    expect(await publica()).toMatchObject({ vagasMostradas: 16 });

    // Vazio: volta às reais.
    expect((await pedido(ctx, "secretaria", "PATCH", `/v1/turmas-gold/${id}`, { vagasAnunciadas: null })).statusCode).toBe(200);
    expect(await publica()).toMatchObject({ vagasMostradas: 16 });
    // O comercial só vende: já não mexe na turma (vê as vagas nos Cronogramas).
    expect((await pedido(ctx, "comercial", "PATCH", `/v1/turmas-gold/${id}`, { vagasAnunciadas: 2 })).statusCode).toBe(403);
  });
});

describe("data limite de matrícula no site", () => {
  it("a oferta pública traz a data do marcador «Matrícula» do cronograma", async () => {
    const ctx = await arrancar();
    const criar = await pedido(ctx, "secretaria", "POST", "/v1/turmas-gold", {
      dataInicio: "2099-06-10", nome: `MAT ${Date.now()}`, curso: "Curso Matrícula", local: "Porto", horario: "Laboral", vagas: 10,
    });
    const id = (criar.json() as { turma: { id: number } }).turma.id;
    await ctx.db.query("UPDATE turmas_gold SET cronograma = $2::jsonb WHERE id = $1", [id, JSON.stringify([
      { id: "matricula", data: "2099-06-03", modalidade: "matricula", horaInicio: "", horaFim: "", modulos: [], formadores: [] },
      { id: "s1", data: "2099-06-10", horaInicio: "09:00", horaFim: "13:00", modulos: [], formadores: [] },
    ])]);
    const turmas = ((await ctx.app.inject({ method: "GET", url: "/v1/public/oferta" })).json() as { turmas: { turmaId: number; matricula: string }[] }).turmas;
    expect(turmas.find(t => t.turmaId === id)?.matricula).toBe("2099-06-03");
  });
});
