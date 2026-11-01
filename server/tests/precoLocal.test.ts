import { describe, expect, it } from "vitest";
import { precoDoLocal } from "../../src/partilhado/precoLocal.js";

describe("preço de cada local no site (Preço por local e horário)", () => {
  const regras = [
    { local: "Braga", horario: "", preco: 125 }, { local: "Lisboa", horario: "", preco: 155 }, { local: "V.N.Gaia", horario: "", preco: 115 },
    { local: "Aveiro", horario: "", preco: 125 }, { local: "Penafiel", horario: "", preco: 139 },
  ];
  it("cada local com o seu preço; sem regra, o do curso", () => {
    expect(precoDoLocal(115, "Lisboa", regras)).toEqual({ min: 155, varia: false });
    expect(precoDoLocal(115, "BRAGA", regras)).toEqual({ min: 125, varia: false });
    expect(precoDoLocal(115, "Viseu", regras)).toEqual({ min: 115, varia: false });
  });
  it("um horário com outro preço no local: o mais baixo e «varia»", () => {
    expect(precoDoLocal(115, "Lisboa", [...regras, { local: "Lisboa", horario: "Pós-laboral", preco: 140 }])).toEqual({ min: 140, varia: true });
  });
});
