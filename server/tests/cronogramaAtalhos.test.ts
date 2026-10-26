import { describe, expect, it } from "vitest";
import { buildLinha, datesFromRange, mudarHorasLinha, preencherIntervalo, saltoMatricula, setMatricula } from "../../src/partilhado/cronogramaGrelha.js";
import type { SessaoCronograma } from "../../src/partilhado/turmaModel.js";
import { arrancar, pedido } from "./helpers.js";

const s = (id: string, data: string, horaInicio = "09:00", horaFim = "13:00", modalidade: SessaoCronograma["modalidade"] = "presencial") =>
  ({ id, data, horaInicio, horaFim, modalidade, modulos: [], formadores: [] }) as SessaoCronograma;

describe("atalhos do cronograma", () => {
  it("os dias vazios entre a matrícula e o início ficam numa só coluna", () => {
    const sessoes = setMatricula([s("a", "2026-11-23")], "2026-11-02");
    const dias = datesFromRange("2026-11-02", "2026-11-30");
    expect(saltoMatricula(dias, sessoes, "2026-11-02", "2026-11-23")).toEqual({ de: "2026-11-03", ate: "2026-11-22", n: 20 });
    // Com um evento pelo meio, não se esconde nada.
    expect(saltoMatricula(dias, [...sessoes, s("b", "2026-11-10")], "2026-11-02", "2026-11-23")).toBeNull();
  });

  it("o e-learning preenche um intervalo de dias (com ou sem fins de semana)", () => {
    const auto = buildLinha("auto", "", "");
    const todos = preencherIntervalo([], "2026-11-24", "2026-12-02", auto, { modulos: ["M1"] });
    expect(todos).toHaveLength(9);
    const uteis = preencherIntervalo([], "2026-11-24", "2026-12-02", auto, { modulos: ["M1"] }, true);
    expect(uteis.map(x => x.data)).not.toContain("2026-11-28");
    expect(uteis).toHaveLength(7);
  });

  it("muda a hora de uma linha inteira mantendo os ids; recusa sobreposição", () => {
    const linha = buildLinha("presencial", "09:00", "10:45");
    const sessoes = [s("a", "2026-11-03", "09:00", "10:45"), s("b", "2026-11-04", "09:00", "10:45"), s("c", "2026-11-05")];
    const r = mudarHorasLinha(sessoes, linha, "09:00", "10:50");
    expect(r.ok && r.sessoes.filter(x => x.horaFim === "10:50").map(x => x.id)).toEqual(["a", "b"]);
    const choque = mudarHorasLinha([...sessoes, s("d", "2026-11-03", "09:00", "13:00")], linha, "09:00", "13:00");
    expect(choque.ok).toBe(false);
  });
});

describe("acesso do formador", () => {
  it("a pedagogia gera uma nova palavra-passe temporária; o formador não", async () => {
    const ctx = await arrancar();
    const email = `fp.${Date.now()}@exemplo.pt`;
    const r = await pedido(ctx, "secretaria", "POST", "/v1/formadores", { nome: `Formador PP ${Date.now()}`, email, regimes: ["gold"] });
    expect(r.statusCode, r.body).toBe(200);
    const id = r.json().formador.id as number;
    const nova = await pedido(ctx, "secretaria", "POST", `/v1/formadores/${id}/acesso`, {});
    expect(nova.statusCode, nova.body).toBe(200);
    expect(nova.json().acesso).toMatchObject({ email, criado: false, password: expect.any(String) });
    const conta = await ctx.db.query<{ must_change_password: boolean }>("SELECT must_change_password FROM users WHERE email = $1", [email]);
    expect(conta.rows[0]!.must_change_password).toBe(true);
    expect((await pedido(ctx, "formador", "POST", `/v1/formadores/${id}/acesso`, {})).statusCode).toBe(403);
  });
});
