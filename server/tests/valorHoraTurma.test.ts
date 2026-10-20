// Valor por hora de cada formador na turma (visão geral): a gestão define-o; a comercial não o muda.
import { describe, expect, it } from "vitest";
import { arrancar, pedido } from "./helpers.js";

const sessao = (id: string, data: string, formador: string) => ({
  id, data, horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", formadores: [formador],
});

describe("valor por hora do formador na turma", () => {
  it("a Financiada grava o valor por hora de um formador na turma", async () => {
    const ctx = await arrancar();
    const turmaId = 990801;
    const cronograma = [sessao("s1", "2099-09-01", "Ana Valor"), sessao("s2", "2099-09-02", "Rui Ficha")];
    await ctx.db.query(
      `INSERT INTO turmas_fin (id, data_inicio, nome, curso, financiador, cronograma) VALUES ($1, '2099-09-01', 'TValorHora', 'UFCD', 'IEFP', $2::jsonb)`,
      [turmaId, JSON.stringify(cronograma)],
    );
    const r = await pedido(ctx, "financiada", "PATCH", `/v1/turmas-fin/${turmaId}`, { valoresHoraFormador: { "Ana Valor": 20.5 } });
    expect(r.statusCode, r.body).toBe(200);
    const lido = await ctx.db.query<{ v: Record<string, number> }>("SELECT valores_hora_formador AS v FROM turmas_fin WHERE id = $1", [turmaId]);
    expect(lido.rows[0]!.v).toEqual({ "Ana Valor": 20.5 });
  });

  it("a comercial não muda os custos da turma Gold (os outros campos gravam-se)", async () => {
    const ctx = await arrancar();
    const turmaId = 990802;
    await ctx.db.query(
      `INSERT INTO turmas_gold (id, data_inicio, nome, curso, formador, cronograma, valores_hora_formador, custo_hora_sala)
       VALUES ($1, '2099-09-01', 'TGoldValor', 'Curso', 'Ana', '[]'::jsonb, '{"Ana": 30}'::jsonb, 5)`,
      [turmaId],
    );
    const r = await pedido(ctx, "comercial", "PATCH", `/v1/turmas-gold/${turmaId}`, { valoresHoraFormador: { Ana: 1 }, custoHoraSala: 0, local: "Porto" });
    expect(r.statusCode, r.body).toBe(200);
    const t = await ctx.db.query<{ v: Record<string, number>; sala: string; local: string }>(
      "SELECT valores_hora_formador AS v, custo_hora_sala::text AS sala, local FROM turmas_gold WHERE id = $1", [turmaId]);
    expect(t.rows[0]).toMatchObject({ v: { Ana: 30 }, sala: "5", local: "Porto" });
    const s = await pedido(ctx, "secretaria", "PATCH", `/v1/turmas-gold/${turmaId}`, { valoresHoraFormador: { Ana: 25 } });
    expect(s.statusCode, s.body).toBe(200);
    const depois = await ctx.db.query<{ v: Record<string, number> }>("SELECT valores_hora_formador AS v FROM turmas_gold WHERE id = $1", [turmaId]);
    expect(depois.rows[0]!.v).toEqual({ Ana: 25 });
  });
});
