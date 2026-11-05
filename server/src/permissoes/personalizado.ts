/**
 * Perfil «personalizado»: soma de perfis da equipa. Em cada pedido escolhe-se o perfil (dos marcados) que pode fazer
 * aquela operação; havendo regime (Gold/Financiada) no caminho ou em `?regime=`, o perfil desse regime. Assim cada
 * operação corre exactamente com as regras (e o RLS) de um perfil normal.
 */
import { podeAceder } from "../permissoes.js";
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

type ActorPedido = { role: string; perfil: string; perfis: string[] };
type PedidoComActor = { method: string; url: string; actor?: ActorPedido };

/**
 * Os perfis com que este pedido pode correr: o escolhido primeiro e, no perfil personalizado, os outros marcados que
 * também têm acesso à rota. Para as operações que não dizem o regime (abrir um ficheiro, pesquisar, alertas, emails),
 * que somam o que cada perfil pode.
 */
export function perfisDoPedido(req: PedidoComActor): string[] {
  const a = req.actor;
  if (!a) return [];
  if (a.perfil !== "personalizado") return [a.role];
  let path = req.url.split("?")[0] ?? req.url;
  try { path = decodeURI(path); } catch { /* o preHandler já recusou */ }
  return [a.role, ...a.perfis.filter(p => p !== a.role && podeAceder(p, req.method, path))];
}

/** Algum dos perfis do pedido passa a verificação (corre com cada um, por ordem, até um passar). */
export async function algumPerfil<A extends ActorPedido>(req: PedidoComActor & { actor?: A }, ok: (actor: A) => boolean | Promise<boolean>) {
  for (const p of perfisDoPedido(req)) if (await ok({ ...req.actor!, role: p })) return true;
  return false;
}

/** Junta, sem repetidos (pela chave), o resultado de correr uma leitura com cada perfil do pedido. */
export async function somarPorPerfil<A extends ActorPedido, T>(
  req: PedidoComActor & { actor?: A }, ler: (actor: A) => Promise<T[]>, chave: (x: T) => string | number,
): Promise<T[]> {
  const vistos = new Map<string | number, T>();
  for (const p of perfisDoPedido(req)) for (const x of await ler({ ...req.actor!, role: p })) if (!vistos.has(chave(x))) vistos.set(chave(x), x);
  return [...vistos.values()];
}
