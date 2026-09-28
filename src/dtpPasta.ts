export function slugTurma(nome: string) {
  const s = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return s || "turma";
}

export function dtpPastaNome(regime: "gold" | "fin", turmaNome: string) {
  const tag = regime === "fin" ? "Financiada" : "Gold";
  return `DTP ${tag} ${turmaNome.trim() || "turma"}`;
}

export function dtpZipNome(regime: "gold" | "fin", turmaNome: string) {
  const tag = regime === "fin" ? "Financiada" : "Gold";
  return `DTP-${tag}-${slugTurma(turmaNome)}.zip`;
}

export function dtpFasePasta(fase: string | undefined) {
  if (fase === "durante") return "02-Durante";
  if (fase === "depois") return "03-Fecho";
  return "01-Antes da turma";
}
