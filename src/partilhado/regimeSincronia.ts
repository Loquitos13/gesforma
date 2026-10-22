// Regime da oferta do curso (ficha, Gold e Financiada): síncrono, assíncrono ou misto (os dois).
// Fica em `regimeSincronia` no payload da ficha; `regime` já guarda a modalidade (Presencial, Online…).

export type RegimeSincronia = "" | "sincrono" | "assincrono" | "misto";

export const OPCOES_SINCRONIA = [
  { valor: "sincrono", rotulo: "Síncrono" },
  { valor: "assincrono", rotulo: "Assíncrono" },
  { valor: "misto", rotulo: "Misto (Síncrono + Assíncrono)" },
] as const;

export function regimeSincronia(raw: unknown): RegimeSincronia {
  return raw === "sincrono" || raw === "assincrono" || raw === "misto" ? raw : "";
}

/** «Síncrono», «Assíncrono», «Misto (Síncrono + Assíncrono)» ou vazio. */
export function rotuloSincronia(raw: unknown): "" | (typeof OPCOES_SINCRONIA)[number]["rotulo"] {
  const v = regimeSincronia(raw);
  return v ? OPCOES_SINCRONIA.find(o => o.valor === v)!.rotulo : "";
}

/** Local que o e-learning impõe: síncrono (e misto, que também tem aulas online) na Sala Virtual; assíncrono é só o Moodle. */
export const LOCAL_SALA_VIRTUAL = "Sala Virtual";
export const LOCAL_DISTANCIA = "Aprendizagem à distância";

export function localDoElearning(modalidade: unknown, sincronia: unknown): string | null {
  if (!/e-?learning/i.test(String(modalidade ?? ""))) return null;
  const v = regimeSincronia(sincronia);
  return v === "sincrono" || v === "misto" ? LOCAL_SALA_VIRTUAL : v === "assincrono" ? LOCAL_DISTANCIA : null;
}

/** Morada do local criado no catálogo quando ainda não existe. */
export function moradaDoLocalElearning(local: string) {
  return local === LOCAL_SALA_VIRTUAL ? "Aulas síncronas online (sala virtual)" : "Acesso ao Moodle";
}
