// Regime da oferta do curso (ficha, Gold e Financiada): síncrono ou assíncrono.
// Fica em `regimeSincronia` no payload da ficha; `regime` já guarda a modalidade (Presencial, Online…).

export type RegimeSincronia = "" | "sincrono" | "assincrono";

export const OPCOES_SINCRONIA = [
  { valor: "sincrono", rotulo: "Síncrono" },
  { valor: "assincrono", rotulo: "Assíncrono" },
] as const;

export function regimeSincronia(raw: unknown): RegimeSincronia {
  return raw === "sincrono" || raw === "assincrono" ? raw : "";
}

/** «Síncrono», «Assíncrono» ou vazio. */
export function rotuloSincronia(raw: unknown): "" | "Síncrono" | "Assíncrono" {
  const v = regimeSincronia(raw);
  return v ? OPCOES_SINCRONIA.find(o => o.valor === v)!.rotulo : "";
}
