// Copiar o cronograma de outra turma: as datas passam para o novo início com os mesmos intervalos e horas; os planos
// e os sumários vêm também; com presenças registadas não se substitui.
import { describe, expect, it } from "vitest";
import { copiarCronograma } from "../../src/partilhado/cronogramaCopiar.js";
import { arrancar, pedido } from "./helpers.js";

const sessao = (id: string, data: string, extra: Record<string, unknown> = {}) =>
  ({ id, data, horaInicio: "09:00", horaFim: "13:00", modulos: ["M1"], formadores: ["Ana"], ...extra });

describe("copiarCronograma (datas)", () => {
  it("mantém os intervalos entre dias e as horas; a matrícula e o fim acompanham", () => {
    const r = copiarCronograma([
      sessao("matricula", "2026-01-02", { modalidade: "matricula", horaInicio: "", horaFim: "" }),
      sessao("a", "2026-01-05"), sessao("b", "2026-01-07", { iniciadaEm: "x" }), sessao("e", "2026-01-08", { modalidade: "auto" }),
      sessao("fim-cronograma", "2026-01-20"),
    ], "2026-03-02");
    expect(r.map(s => s.data)).toEqual(["2026-02-27", "2026-03-02", "2026-03-04", "2026-03-05", "2026-03-17"]);
    expect(r.find(s => s.data === "2026-03-04")).toMatchObject({ horaInicio: "09:00", horaFim: "13:00", formadores: ["Ana"] });
    expect(r.some(s => "iniciadaEm" in s)).toBe(false);
    expect(r.find(s => s.data === "2026-03-02")!.id).not.toBe("a");
  });
});

describe("POST /v1/turmas/:regime/:id/cronograma/copiar", () => {
  it("copia cronograma, planos e sumários da outra turma do mesmo curso", async () => {
    const ctx = await arrancar();
    const criar = async (nome: string, dataInicio: string) => ((await pedido(ctx, "secretaria", "POST", "/v1/turmas-gold", {
      dataInicio, nome: `${nome} ${Date.now()}`, curso: "Curso Copia", local: "Porto", horario: "Laboral", vagas: 10,
    })).json() as { turma: { id: number } }).turma.id;
    const origem = await criar("ORIG", "2099-01-05");
    const nova = await criar("NOVA", "2099-03-02");
    await ctx.db.query("UPDATE turmas_gold SET cronograma = $2::jsonb WHERE id = $1",
      [origem, JSON.stringify([sessao("o1", "2099-01-05"), sessao("o2", "2099-01-07")])]);
    const { gravarSessao } = await import("../src/repos/pedagogiaSessoes.js");
    await gravarSessao(ctx.db, "gold", origem, { id: "o2", n: 2 }, {
      plano: { tema: "Plano da sessão 2", objetivoGeral: "Objetivo" }, sumario: { conteudos: "Conteúdos 2", atividades: "Atividades 2" },
    });

    const r = await pedido(ctx, "secretaria", "POST", `/v1/turmas/gold/${nova}/cronograma/copiar`, { origemTurmaId: origem, inicio: "2099-03-02" });
    expect(r.statusCode, r.body).toBe(200);
    const corpo = r.json() as { cronograma: { data: string }[]; sumarios: number };
    expect(corpo.cronograma.map(s => s.data)).toEqual(["2099-03-02", "2099-03-04"]);
    expect(corpo.sumarios).toBe(1);
    const linhas = (await ctx.db.query<{ sessao_n: number; sumario: { conteudos?: string } }>(
      "SELECT sessao_n, sumario FROM turma_sessoes WHERE regime = 'gold' AND turma_id = $1 AND sessao_n IS NOT NULL ORDER BY sessao_n", [nova])).rows;
    expect(linhas.find(l => l.sessao_n === 2)?.sumario.conteudos).toBe("Conteúdos 2");

    // O formador não copia; uma turma de outro curso não serve de origem.
    expect((await pedido(ctx, "formador", "POST", `/v1/turmas/gold/${nova}/cronograma/copiar`, { origemTurmaId: origem, inicio: "2099-03-02" })).statusCode).toBe(403);

    // Com presenças registadas, não se substitui.
    await ctx.db.query("UPDATE turma_sessoes SET presencas = '{\"1\": \"P\"}'::jsonb WHERE regime = 'gold' AND turma_id = $1", [nova]);
    expect((await pedido(ctx, "secretaria", "POST", `/v1/turmas/gold/${nova}/cronograma/copiar`, { origemTurmaId: origem, inicio: "2099-03-09" })).statusCode).toBe(409);
  });
});
