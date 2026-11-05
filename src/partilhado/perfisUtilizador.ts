/**
 * Perfil personalizado no ecrã (o servidor decide sempre; ver server/src/permissoes/personalizado.ts). O ecrã usa o
 * mesmo perfil que o servidor usaria: numa ficha ou turma Gold, o perfil Gold marcado; na Financiada, o da Financiada.
 */
type U = { role: string; perfis?: readonly string[] | null };

/** Do mais largo para o mais restrito (a mesma ordem do servidor). */
const ORDEM = ["secretaria", "financiada", "contabilidade", "comercial"];
const DO_REGIME: Record<"gold" | "fin", string[]> = { gold: ["admin", "secretaria", "comercial"], fin: ["admin", "financiada"] };

/** Os perfis da pessoa: os marcados (personalizado) ou o seu. */
export function perfisDe(u: U): string[] {
  return u.role === "personalizado" ? ORDEM.filter(p => u.perfis?.includes(p)) : [u.role];
}

/** Tem algum destes perfis (num perfil personalizado, algum dos marcados)? */
export function temPerfil(u: U, ...perfis: string[]) {
  return perfisDe(u).some(p => perfis.includes(p));
}

/** O perfil com que se trabalha num regime: o próprio, ou (personalizado) o marcado desse regime. */
export function perfilNoRegime(u: U, regime: "gold" | "fin" | string | null | undefined): string {
  if (u.role !== "personalizado") return u.role;
  const perfis = perfisDe(u);
  const r = regime === "fin" ? "fin" : regime === "gold" ? "gold" : null;
  return (r ? perfis.find(p => DO_REGIME[r].includes(p)) : undefined) ?? perfis[0] ?? "personalizado";
}
