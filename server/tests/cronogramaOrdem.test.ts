// O cronograma grava-se por ordem cronológica: uma sessão acrescentada no fim, com data anterior, passa para o seu lugar
// e os números das sessões (e os dados que lhes estão ligados pelo id) seguem as datas.
import { describe, expect, it } from "vitest";
import { dataIsoDaSessao, ordenarCronograma } from "../../src/partilhado/cronogramaOrdem.js";
import { arrancar, pedido } from "./helpers.js";

const sessao = (id: string, data: string, horaInicio = "09:00") => ({ id, data, horaInicio, horaFim: "13:00", modalidade: "presencial", modulos: [], formadores: [] });

describe("ordem do cronograma", () => {
  it("ordena por data e hora, passa dd-mm-aaaa a aaaa-mm-dd e deixa as sem data no fim", () => {
    expect(dataIsoDaSessao("01-01-2027")).toBe("2027-01-01");
    expect(dataIsoDaSessao("30/11/2026")).toBe("2026-11-30");
    expect(dataIsoDaSessao("2026-12-07")).toBe("2026-12-07");
    const r = ordenarCronograma([
      sessao("a", "2026-12-07"), sessao("b", "01-01-2027"), sessao("c", "2026-12-23", "17:00"),
      sessao("d", "30-11-2026", "11:00"), sessao("e", ""), sessao("f", "2026-12-23", "9:00"),
    ]);
    expect(r.map(s => s.id)).toEqual(["d", "a", "f", "c", "b", "e"]);
    expect(r.map(s => s.data)).toEqual(["2026-11-30", "2026-12-07", "2026-12-23", "2026-12-23", "2027-01-01", ""]);
  });

  it("ao gravar a turma, a sessão nova com data anterior fica no lugar dela e os números seguem as datas", async () => {
    const ctx = await arrancar();
    const nome = `Ordem ${Date.now()}`;
    const criada = await pedido(ctx, "secretaria", "POST", "/v1/turmas-gold", {
      dataInicio: "2099-06-01", nome, curso: "Curso Sem Ficha", vagas: 10,
      cronograma: [sessao("s1", "2099-06-07"), sessao("s2", "2099-06-14")],
    });
    expect(criada.statusCode, criada.body).toBe(200);
    const id = criada.json().turma.id as number;
    await ctx.db.query(
      "INSERT INTO turma_sessoes (regime, turma_id, sessao_id, sessao_n, presencas) VALUES ('gold', $1, 's2', 2, '[]'::jsonb)", [id]);

    const r = await pedido(ctx, "secretaria", "PATCH", `/v1/turmas-gold/${id}`, {
      cronograma: [sessao("s1", "2099-06-07"), sessao("s2", "2099-06-14"), sessao("s3", "01-06-2099")],
    });
    expect(r.statusCode, r.body).toBe(200);
    const t = await ctx.db.query<{ cronograma: { id: string; data: string }[] }>("SELECT cronograma FROM turmas_gold WHERE id = $1", [id]);
    expect(t.rows[0]!.cronograma.map(s => [s.id, s.data])).toEqual([["s3", "2099-06-01"], ["s1", "2099-06-07"], ["s2", "2099-06-14"]]);
    const n = await ctx.db.query<{ sessao_n: number }>("SELECT sessao_n FROM turma_sessoes WHERE regime = 'gold' AND turma_id = $1 AND sessao_id = 's2'", [id]);
    expect(n.rows[0]!.sessao_n).toBe(3);
  });
});
