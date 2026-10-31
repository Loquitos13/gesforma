import { describe, expect, it } from "vitest";
import { atribuirPlanos, chaveModuloPlano, modulosEmFalta } from "../../src/partilhado/planosModulo.js";

describe("planos do curso por módulo", () => {
  it("cada plano com módulo vai para as sessões desse módulo, pela ordem; os sem módulo pelo número", () => {
    expect(chaveModuloPlano("M1 · Aprendizagem e pedagogia · 20h")).toBe("m1");
    const planos = [
      { ordem: 1, modulo: "M1 · Aprendizagem" }, { ordem: 2, modulo: "M1 · Aprendizagem" },
      { ordem: 3, modulo: "M2 · Comunicação" }, { ordem: 4, modulo: "" },
    ];
    const sessoes = [
      { modulos: ["M1 · Aprendizagem e pedagogia · 20h"] }, { modulos: ["M2 · Comunicação e dinâmica · 20h"] },
      { modulos: [] }, { modulos: ["M1 · Aprendizagem e pedagogia · 20h"] }, { modulos: ["M1 · Aprendizagem e pedagogia · 20h"] },
    ];
    expect(atribuirPlanos(planos, sessoes).map(p => p?.ordem ?? null)).toEqual([1, 3, null, 2, null]);
    // Sem módulos nos planos: como antes, o plano n para a sessão n, mesmo que as sessões tenham módulo (grelha gerada).
    expect(atribuirPlanos([{ ordem: 1 }, { ordem: 2 }], [{}, {}, {}]).map(p => p?.ordem ?? null)).toEqual([1, 2, null]);
    const geradas = [{ modulos: ["M1 · A"] }, { modulos: ["M1 · A"] }, { modulos: ["M2 · B"] }, { modulos: [] }];
    expect(atribuirPlanos([1, 2, 3, 4, 5].map(ordem => ({ ordem })), geradas).map(p => p?.ordem ?? null)).toEqual([1, 2, 3, 4]);
  });

  it("um plano com vários módulos vai para as sessões desses módulos; sessão sem módulo fica com os do plano", () => {
    const planos = [
      { ordem: 1, modulos: ["M1 · A"] },
      { ordem: 2, modulos: ["M3 · C", "M4 · D"] },
      { ordem: 3, modulos: ["M3 · C", "M4 · D"] },
      { ordem: 4, modulo: "M2 · B" }, // formato antigo (um só módulo)
    ];
    const sessoes = [
      { modulos: ["M4 · D longo", "M3 · C longo"] }, { modulos: ["M1 · A"] }, { modulos: ["M2 · B"] },
      { modulos: ["M3 · C"] }, { modulos: [] },
    ];
    // Sessão 1 (M3+M4) leva o 1.º plano do M3+M4; a sessão 4 só do M3 leva o 2.º (tem o M3).
    expect(atribuirPlanos(planos, sessoes).map(p => p?.ordem ?? null)).toEqual([2, 1, 4, 3, null]);
    // Sessões sem módulo que recebem um plano com módulos ficam com todos os módulos desse plano.
    expect([...modulosEmFalta([{ ordem: 1, modulos: ["M3 · C", "M4 · D"] }], [{ modulos: [] }])]).toEqual([[0, ["M3 · C", "M4 · D"]]]);
  });
});
