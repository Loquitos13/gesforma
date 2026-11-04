/**
 * Equipas que recebem os avisos internos (Sistema › Emails › Regras › «Enviar para»). A administração nunca recebe.
 * Partilhado entre o servidor (quem recebe) e o backoffice (as opções da regra).
 */
export const GRUPOS_EQUIPA = ["gold", "fin", "contabilidade"] as const;
export type GrupoEquipa = (typeof GRUPOS_EQUIPA)[number];

export const ROTULO_GRUPO: Record<GrupoEquipa, string> = {
  gold: "Gold (comerciais e coordenação pedagógica)",
  fin: "Financiada (coordenação pedagógica)",
  contabilidade: "Contabilidade",
};

export const ROTULO_GRUPO_CURTO: Record<GrupoEquipa, string> = { gold: "Gold", fin: "Financiada", contabilidade: "Contabilidade" };

/** Perfis de utilizador de cada equipa. */
export const PERFIS_DO_GRUPO: Record<GrupoEquipa, string[]> = {
  gold: ["comercial", "secretaria"],
  fin: ["financiada"],
  contabilidade: ["contabilidade"],
};

/** Regras de aviso interno (vão para a equipa, não para a pessoa). */
export function eAvisoEquipa(triggerKey: string) {
  return triggerKey.startsWith("equipa.");
}

/** A quem vai, por omissão, um aviso interno desta área. */
export function gruposPorOmissao(triggerKey: string, area: string): GrupoEquipa[] {
  const daArea: GrupoEquipa = area === "fin" ? "fin" : area === "contabilidade" ? "contabilidade" : "gold";
  if (triggerKey === "equipa.comprovativo_recebido" && daArea !== "contabilidade") return [daArea, "contabilidade"];
  return [daArea];
}
