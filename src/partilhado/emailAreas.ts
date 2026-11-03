/**
 * Áreas dos emails automáticos (Sistema › Emails): a coordenação Gold, a coordenação Financiada e a contabilidade
 * têm os seus modelos e regras. Cada uma vê e edita só os da sua área; a administração vê todos, com a área.
 * Partilhado com o servidor (sem React).
 */
export const AREAS_EMAIL = ["gold", "fin", "contabilidade"] as const;
export type AreaEmail = (typeof AREAS_EMAIL)[number];

export const ROTULO_AREA_EMAIL: Record<AreaEmail, string> = { gold: "Gold", fin: "Financiada", contabilidade: "Contabilidade" };

export const eAreaEmail = (v: unknown): v is AreaEmail => (AREAS_EMAIL as readonly unknown[]).includes(v);

/** As áreas que cada perfil vê e edita (a administração, todas; o comercial trabalha na Gold). */
export function areasDoPerfil(role: string): AreaEmail[] {
  if (role === "admin") return [...AREAS_EMAIL];
  if (role === "secretaria" || role === "comercial") return ["gold"];
  if (role === "financiada") return ["fin"];
  if (role === "contabilidade") return ["contabilidade"];
  return [];
}

/** Área de um envio a partir do regime da pré-inscrição, da turma ou do formando (o que não é da Financiada é Gold). */
export const areaDoRegime = (regime: unknown): AreaEmail => (String(regime ?? "") === "fin" ? "fin" : "gold");
