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

  it("um mês de aulas (como o modelo da ENA) cabe numa folha: das 8:00 às 19:00, linhas baixas e colunas estreitas", () => {
    (globalThis as { window?: unknown }).window ??= { location: { origin: "http://localhost" } };
    const aula = (id: string, data: string, hi: string, hf: string, modulos: string[], modalidade: SessaoCronograma["modalidade"] = "presencial") =>
      ({ id, data, horaInicio: hi, horaFim: hf, modalidade, modulos, formadores: [] }) as SessaoCronograma;
    const auto = (data: string, m: string[]) => aula(`e${data}`, data, "", "", m, "auto");
    const sessoes = [
      aula("1", "2026-08-17", "11:00", "13:00", ["M1"]), aula("2", "2026-08-24", "09:00", "13:30", ["M2"]), aula("3", "2026-08-25", "09:00", "13:30", ["M2"]),
      aula("4", "2026-08-26", "09:00", "13:00", ["M3", "M4"]), aula("5", "2026-09-02", "09:00", "13:00", ["M5", "M6"]),
      aula("s1", "2026-09-04", "10:00", "11:30", [], "sincrona"), aula("6", "2026-09-09", "09:00", "13:00", ["M7", "M8"]),
      aula("s2", "2026-09-11", "10:00", "11:30", [], "sincrona"), aula("7", "2026-09-16", "09:00", "13:30", ["M9"]), aula("8", "2026-09-17", "09:00", "13:30", ["M9"]),
      ...["18", "19", "20", "21"].map(d => auto(`2026-08-${d}`, ["M1"])), aula("a1", "2026-08-22", "", "", ["M1"], "avaliacao"),
      ...["27", "28", "29", "30", "31"].map(d => auto(`2026-08-${d}`, ["M3", "M4"])), aula("a2", "2026-09-01", "", "", ["M3", "M4"], "avaliacao"),
    ];
    const dias = datesFromRange("2026-08-03", "2026-09-17").filter(d => d === "2026-08-03" || d >= "2026-08-17");
    const html = buildCronogramaPrintHtml({
      horario: "Laboral manhã", curso: "Formação de Formadores - CCP", nome: "teste planos", matricula: "2026-08-03", inicio: "2026-08-17", fim: "2026-09-17",
      local: { localizacao: "Vila Nova de Gaia", morada: "" } as never, dates: dias,
      linhas: linhasFromSessoes(sessoes, "Laboral manhã"), sessoes: [...sessoes, { id: "matricula", data: "2026-08-03", horaInicio: "", horaFim: "", modalidade: "matricula", modulos: [], formadores: [] } as SessaoCronograma], cores: "gold", embutido: true,
    });
    expect(html.split('class="bloco-grelha"').length - 1).toBe(1);
    // Das 8:00 às 19:00, de hora em hora (mais horas só se houver aulas fora disso).
    expect(html.split('<tr class="tempo">').length - 1).toBe(11);
    if (process.env.CRONOGRAMA_HTML2) writeFileSync(process.env.CRONOGRAMA_HTML2, html);
  });

  it("o cabeçalho leva os dados da entidade, sem nenhum email", () => {
    (globalThis as { window?: unknown }).window ??= { location: { origin: "http://localhost" } };
    // Como na aplicação: chega a entidade inteira (Configurações › Entidade), com o email.
    const entidade = { nome: "Escola Teste", morada: "Rua A, 1", codigoPostal: "1000-001", localidade: "Lisboa", telefone: "210000000", email: "pessoa@exemplo.pt", site: "exemplo.pt" };
    const html = buildCronogramaPrintHtml({
      horario: "Laboral manhã", curso: "Excel", nome: "T1", local: { localizacao: "Lisboa", morada: "" } as never,
      dates: ["2026-09-01"], linhas: [], sessoes: [], embutido: true, entidade,
    });
    expect(html).toContain("Rua A, 1 - 1000-001 Lisboa :: Telf: 210000000 :: Site: exemplo.pt");
    expect(html).not.toContain("pessoa@exemplo.pt");
    expect(html).not.toContain("E-mail:");
  });
});
