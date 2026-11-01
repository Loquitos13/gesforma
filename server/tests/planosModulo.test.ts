import { distribuirTempo, minutosDeTempo, somarMinutos, textoDeMinutos } from "../../src/partilhado/duracaoSessao.js";
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

describe("sessões marcadas a partir de um plano (planoOrdem)", () => {
  it("cada sessão leva o plano marcado; as «Personalizado» (0) ficam sem plano; as outras recebem os planos livres", () => {
    const planos = [{ ordem: 1, modulos: ["M1"] }, { ordem: 2, modulos: [] }, { ordem: 3, modulos: [] }, { ordem: 4, modulos: [] }];
    // A 2.ª (M1, livre): o plano do M1 já foi marcado na 3.ª, leva o plano 2 pelo número. A 4.ª repete o plano 3 (fica
    // sem); a 5.ª é «Personalizado»; a 6.ª, livre, não tem plano com o n.º 6.
    const r = atribuirPlanos(planos, [{ planoOrdem: 3 }, { modulos: ["M1"] }, { planoOrdem: 1 }, { planoOrdem: 3 }, { planoOrdem: 0 }, {}]);
    expect(r.map(p => p?.ordem ?? null)).toEqual([3, 2, 1, null, null, null]);
    // Sem nenhuma marcada: a regra de sempre (módulo, depois o número).
    expect(atribuirPlanos(planos, [{ modulos: ["M1"] }, {}, { planoOrdem: 0 }, {}]).map(p => p?.ordem ?? null)).toEqual([1, 2, null, 4]);
  });
});

describe("tempo dos planos", () => {
  it("lê e escreve durações e reparte pelos momentos", () => {
    expect(["15 min", "3 h", "2h30", "1:45", "90", "", "x", "20 minutos", "2 horas", "1 hora 30"].map(minutosDeTempo)).toEqual([15, 180, 150, 105, 90, 0, 0, 20, 120, 90]);
    expect([0, 15, 60, 150].map(textoDeMinutos)).toEqual(["", "15 min", "1h", "2h30"]);
    expect(distribuirTempo(180)).toEqual({ introducao: 20, desenvolvimento: 140, conclusao: 20 });
    expect(distribuirTempo(10)).toEqual({ introducao: 3, desenvolvimento: 4, conclusao: 3 });
    expect(somarMinutos("19:00", 210)).toEqual("22:30");
  });
});

describe("planos por id (pertencem aos módulos)", () => {
  it("a sessão marcada com o id do plano leva-o, mesmo que a ordem mude; o formato antigo (planoOrdem) aponta para plano-<n>", () => {
    const planos = [
      { id: "plano-1", ordem: 3, modulos: ["M1"] }, { id: "plano-x", ordem: 1, modulos: ["M2"] }, { id: "plano-y", ordem: 2, modulos: ["M2"] },
    ];
    const r = atribuirPlanos(planos, [{ planoId: "plano-y" }, { planoOrdem: 1 }, { planoId: "-" }, { modulos: ["M2"] }]);
    expect(r.map(p => p?.id ?? null)).toEqual(["plano-y", "plano-1", null, "plano-x"]);
  });
});
