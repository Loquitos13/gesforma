import { describe, expect, it } from "vitest";
import { buildLinha, datesFromRange, diasDaRepeticao, grelhaTempos, temasDaSessao, mudarHorasLinha, preencherIntervalo, saltoMatricula, saltosVazios, setMatricula } from "../../src/partilhado/cronogramaGrelha.js";
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

  it("intervalos longos sem eventos entre módulos ficam numa só coluna (cortes)", () => {
    const sessoes = setMatricula([s("a", "2026-11-23"), s("b", "2026-11-24"), s("c", "2026-12-15"), s("d", "2026-12-17")], "2026-11-02");
    const dias = datesFromRange("2026-11-02", "2026-12-20");
    expect(saltosVazios(dias, sessoes, "2026-11-02", "2026-11-23")).toEqual([
      { apos: "2026-11-02", de: "2026-11-03", ate: "2026-11-22", n: 20 },
      { apos: "2026-11-24", de: "2026-11-25", ate: "2026-12-14", n: 20 },
    ]);
    // Um dia vazio entre aulas (16) e os dias depois da última sessão ficam como estão.
    expect(saltosVazios(dias, sessoes, "", "2026-11-23").some(x => x.de === "2026-12-16" || x.de === "2026-12-18")).toBe(false);
  });

  it("o e-learning preenche um intervalo de dias (com ou sem fins de semana)", () => {
    const auto = buildLinha("auto", "", "");
    const todos = preencherIntervalo([], "2026-11-24", "2026-12-02", auto, { modulos: ["M1"] });
    expect(todos).toHaveLength(9);
    const uteis = preencherIntervalo([], "2026-11-24", "2026-12-02", auto, { modulos: ["M1"] }, "uteis");
    expect(uteis.map(x => x.data)).not.toContain("2026-11-28");
    expect(uteis).toHaveLength(7);
  });

  it("uma sessão presencial repete-se todas as semanas até uma data; os dias que já a têm ficam como estão", () => {
    const linha = buildLinha("presencial", "09:00", "13:00");
    const existente = { ...s("x", "2026-11-16"), modulos: ["M3"] };
    // Segunda, 02-11 até 30-11: cinco segundas-feiras; a de 16-11 já tinha sessão (mantém o id e o módulo).
    const r = preencherIntervalo([existente], "2026-11-02", "2026-11-30", linha, { modulos: ["M1"], formadores: ["Ana"] }, "semanal");
    expect(r.map(x => x.data).sort()).toEqual(["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30"]);
    expect(r.find(x => x.data === "2026-11-16")).toMatchObject({ id: "x", modulos: ["M3"] });
    expect(r.find(x => x.data === "2026-11-23")).toMatchObject({ horaInicio: "09:00", horaFim: "13:00", modulos: ["M1"], formadores: ["Ana"] });
    expect(new Set(r.map(x => x.id)).size).toBe(5);
    expect(diasDaRepeticao("2026-11-02", "2026-11-08", "uteis")).toHaveLength(5);
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

describe("grelha de hora em hora", () => {
  it("das 8:00 às 19:00, alarga para aulas fora dessa janela; sobrepostas ficam lado a lado", () => {
    const dias = ["2026-11-07", "2026-11-14"];
    const g = grelhaTempos([s("a", "2026-11-07", "09:00", "12:30"), s("b", "2026-11-14", "09:00", "10:45"), s("c", "2026-11-14", "10:00", "11:00", "sincrona")], dias, "Sábado manhã");
    expect(g.base).toBe(8 * 60);
    expect(g.n).toBe(11);
    const a = g.blocos.find(b => b.date === "2026-11-07")!;
    expect(a).toMatchObject({ linha: 1, linhas: 4 });
    expect(a.sessoes[0]!.altura).toBeCloseTo((210 / 240) * 100);
    const b = g.blocos.find(x => x.date === "2026-11-14")!;
    expect(b.sessoes.map(x => x.colunas)).toEqual([2, 2]);
    expect(g.inicioDaLinha(1)).toBe("09:00");
    // Uma aula pós-laboral alarga a grelha até às 23:00.
    const tarde = grelhaTempos([s("d", "2026-11-07", "19:00", "22:30")], dias, "");
    expect(tarde.base).toBe(8 * 60);
    expect(tarde.inicioDaLinha(tarde.n)).toBe("23:00");
  });
});

describe("o que a aula trata", () => {
  it("curso modular: código e nome do módulo; curso sem módulos: o tema", () => {
    expect(temasDaSessao({ ...s("a", "2026-11-07"), modulos: ["M2 · Comunicação e dinâmica de grupos · 20h"] }))
      .toEqual([{ codigo: "M2", titulo: "Comunicação e dinâmica de grupos" }]);
    expect(temasDaSessao({ ...s("a", "2026-11-07"), modulos: ["Fórmulas e funções · 4h"] }))
      .toEqual([{ codigo: "", titulo: "Fórmulas e funções" }]);
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

  it("a palavra-passe escolhida ao criar fica (ou pede a troca, se marcada); entra-se com ela e não se repete na resposta", async () => {
    const ctx = await arrancar();
    const mustChange = async (email: string) =>
      (await ctx.db.query<{ must_change_password: boolean }>("SELECT must_change_password FROM users WHERE email = $1", [email])).rows[0]!.must_change_password;

    const fraca = await pedido(ctx, "secretaria", "POST", "/v1/formadores", { nome: `PP Fraca ${Date.now()}`, email: `ppf.${Date.now()}@exemplo.pt`, regimes: ["gold"], acesso: { password: "curta" } });
    expect(fraca.statusCode).toBe(400);

    const email = `ppe.${Date.now()}@exemplo.pt`;
    const r = await pedido(ctx, "secretaria", "POST", "/v1/formadores", { nome: `PP Escolhida ${Date.now()}`, email, regimes: ["gold"], acesso: { password: "Escolhida!2026", temporaria: false } });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().acesso).toEqual({ email, criado: true, temporaria: false });
    expect(await mustChange(email)).toBe(false);
    const login = await pedido(ctx, null, "POST", "/v1/auth/login", { email, password: "Escolhida!2026" });
    expect(login.statusCode, login.body).toBe(200);
    expect(login.json().user.mustChangePassword).toBe(false);

    // Repor com uma escolhida e troca no próximo acesso.
    const id = r.json().formador.id as number;
    const reposta = await pedido(ctx, "secretaria", "POST", `/v1/formadores/${id}/acesso`, { password: "Outra!Passe2026", temporaria: true });
    expect(reposta.statusCode, reposta.body).toBe(200);
    expect(reposta.json().acesso).toEqual({ email, criado: false, temporaria: true });
    expect(await mustChange(email)).toBe(true);
  });
});
