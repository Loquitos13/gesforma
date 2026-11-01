import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { blocosDaFolha, buildCronogramaPrintHtml } from "../../src/partilhado/cronogramaPrint.js";
import { datesFromRange, linhasFromSessoes } from "../../src/partilhado/cronogramaGrelha.js";
import type { SessaoCronograma } from "../../src/partilhado/turmaModel.js";

describe("cronograma comprido no PDF", () => {
  it("parte por meses inteiros que caibam; um mês largo demais parte-se pelos dias", () => {
    const dias = datesFromRange("2026-09-01", "2026-11-30");
    expect(blocosDaFolha(dias, dias.map(() => 3), 100)).toEqual([[0, 30], [30, 61], [61, 91]]);
    expect(blocosDaFolha(dias, dias.map(() => 3), 200)).toEqual([[0, 61], [61, 91]]);
    expect(blocosDaFolha(dias.slice(0, 30), dias.slice(0, 30).map(() => 10), 100)).toEqual([[0, 10], [10, 20], [20, 30]]);
  });

  it("cada bloco repete os dias e o horário das aulas", () => {
    // O logótipo usa o endereço da página.
    (globalThis as { window?: unknown }).window ??= { location: { origin: "http://localhost" } };
    const sessoes: SessaoCronograma[] = [];
    const d = new Date("2026-09-07T12:00:00");
    for (let i = 0; i < 70; i++) {
      sessoes.push({ id: `s${i}`, data: d.toISOString().slice(0, 10), horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", modulos: [`M${1 + (i % 9)} · X`], formadores: [] });
      d.setDate(d.getDate() + (i % 3 === 0 ? 1 : 2));
    }
    const html = buildCronogramaPrintHtml({
      horario: "Laboral manhã", curso: "Formação de Formadores - CCP", nome: "Teste", matricula: "2026-09-01", inicio: "2026-09-07",
      local: { localizacao: "Lisboa", morada: "" } as never, dates: datesFromRange("2026-09-01", sessoes.at(-1)!.data),
      linhas: linhasFromSessoes(sessoes, "Laboral manhã"), sessoes, cores: "gold", embutido: true,
    });
    const blocos = html.split('class="bloco-grelha"').length - 1;
    expect(blocos).toBeGreaterThan(1);
    expect(html.split("Horário das aulas").length - 1).toBe(blocos);
    if (process.env.CRONOGRAMA_HTML) writeFileSync(process.env.CRONOGRAMA_HTML, html);
  });
});
