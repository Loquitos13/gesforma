import { describe, expect, it } from "vitest";
import { diaAntesDe, moodleDaTurma } from "../../src/partilhado/moodle.js";

describe("Moodle de cada turma (atual / novo)", () => {
  const curso = { moodleUrl: "https://antigo.ena.pt/c/2", moodleNovoUrl: "https://novo.ena.pt/c/2", moodleNovoDesde: "2026-11-01", moodleNovoTurmas: [7] };
  it("turmas novas (pela data) e as escolhidas usam o novo; as outras o atual", () => {
    expect(moodleDaTurma(curso, { id: 1, dataInicio: "2026-10-15" })).toBe("https://antigo.ena.pt/c/2");
    expect(moodleDaTurma(curso, { id: 2, dataInicio: "2026-11-01" })).toBe("https://novo.ena.pt/c/2");
    expect(moodleDaTurma(curso, { id: 7, dataInicio: "2026-09-01" })).toBe("https://novo.ena.pt/c/2");
    // Sem novo endereço, todas no atual; endereços que não são http(s) não contam.
    expect(moodleDaTurma({ moodleUrl: "https://antigo.ena.pt/c/2" }, { id: 2, dataInicio: "2026-12-01" })).toBe("https://antigo.ena.pt/c/2");
    expect(moodleDaTurma({ moodleUrl: "javascript:alert(1)" }, { id: 2 })).toBe("");
  });
  it("a página de entrada diz «cursos iniciados até» o dia anterior", () => {
    expect(diaAntesDe("2026-11-01")).toBe("31/10/2026");
    expect(diaAntesDe("")).toBe("");
  });
});
