// Turmas cheias no site: escondem-se se houver outra com vagas no mesmo curso, local e horário; senão ficam
// bloqueadas («Novas datas em breve»).
import { describe, expect, it } from "vitest";
import { turmaCheia, turmasParaMostrar, vagasPublicas, type OfertaTurma } from "../../src/partilhado/oferta.js";

const t = (turmaId: number, horario: string, vagasLivres: number, dataInicio = "2026-12-01"): OfertaTurma => ({
  turmaId, nome: `T${turmaId}`, curso: "CCP", local: "Porto", horario, dataInicio, vagasLivres, regime: "gold",
});

describe("turmas cheias no site", () => {
  it("cheia com outra turma com vagas no mesmo horário: não aparece", () => {
    const r = turmasParaMostrar([t(1, "Laboral", 0), t(2, "Laboral", 5, "2027-01-10")]);
    expect(r.map(x => x.turmaId)).toEqual([2]);
  });

  it("cheia sem alternativa no mesmo horário: aparece bloqueada", () => {
    const r = turmasParaMostrar([t(1, "Laboral", 0), t(2, "Pós-laboral", 5)]);
    expect(r.map(x => x.turmaId)).toEqual([1, 2]);
    expect(turmaCheia(r[0]!)).toBe(true);
    expect(vagasPublicas(r[0]!)).toBe("Novas datas em breve");
  });

  it("vagas anunciadas a zero contam como cheia", () => {
    expect(turmaCheia({ vagasLivres: 3, vagasMostradas: 0 })).toBe(true);
  });
});
