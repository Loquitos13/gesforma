import { describe, expect, it } from "vitest";
import { eur } from "../../src/partilhado/ui/formatos.js";
import { numeroDe } from "../../src/gesforma/vistas/crm/comum.js";

describe("valores em euros no CRM", () => {
  it("lê o separador de milhares e a vírgula decimal", () => {
    expect(numeroDe("1.250")).toBe(1250);
    expect(numeroDe("1.250,00")).toBe(1250);
    expect(numeroDe("1 250,50")).toBe(1250.5);
    expect(numeroDe("1250.5")).toBe(1250.5);
    expect(numeroDe("349,5 €")).toBe(349.5);
  });

  it("vazio ou inválido dá 0", () => {
    expect(numeroDe("")).toBe(0);
    expect(numeroDe("abc")).toBe(0);
  });
});

describe("eur com casas decimais", () => {
  it("mostra sempre duas casas", () => {
    expect(eur(349.5, true)).toMatch(/^349,50\s€$/);
    expect(eur(380, true)).toMatch(/^380,00\s€$/);
    expect(eur(Number.NaN, true)).toMatch(/^0,00\s€$/);
  });
});
