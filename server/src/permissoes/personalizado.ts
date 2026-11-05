/**
 * Perfil «personalizado»: soma de perfis da equipa. Em cada pedido escolhe-se o perfil (dos marcados) que pode fazer
 * aquela operação; havendo regime (Gold/Financiada) no caminho ou em `?regime=`, o perfil desse regime. Assim cada
 * operação corre exactamente com as regras (e o RLS) de um perfil normal.
 */
import { FIN, GOLD, type Perfil } from "./perfis.js";

/** Perfis que se podem juntar, do mais largo para o mais restrito (desempate quando vários podem). */
export const PERFIS_COMBINAVEIS = ["secretaria", "financiada", "contabilidade", "comercial"] as const satisfies readonly Perfil[];

export function perfisValidos(v: unknown): Perfil[] {
  const lista = Array.isArray(v) ? v.map(String) : typeof v === "string" ? v.replace(/^\{|\}$/g, "").split(",").filter(Boolean) : [];
  return PERFIS_COMBINAVEIS.filter(p => lista.includes(p));
}

/** Os perfis de um utilizador: os marcados (personalizado) ou o seu. */
export function perfisDoActor(a: { role: string; perfis?: readonly string[] | null }): Perfil[] {
  return a.role === "personalizado" ? perfisValidos(a.perfis ?? []) : [a.role as Perfil];
}

/** Ordena os perfis candidatos: primeiro os do regime pedido (se houver), depois a ordem de `PERFIS_COMBINAVEIS`. */
export function candidatosParaPedido(perfis: readonly Perfil[], regime: "gold" | "fin" | null): Perfil[] {
  const doRegime = (p: Perfil) => (regime ? (regime === "gold" ? GOLD : FIN).includes(p) : true);
  const ordem = PERFIS_COMBINAVEIS.filter(p => perfis.includes(p));
  return [...ordem.filter(doRegime), ...ordem.filter(p => !doRegime(p))];
}
