import type { Db } from "./db/pool.js";
import { contarPedido, limparLimitesAntigos } from "./repos/limites.js";
import { sha256 } from "./security.js";

/**
 * Limites dos pedidos públicos sensíveis, guardados na base de dados. O limite do @fastify/rate-limit vive
 * na memória de cada instância (na Vercel há muitas e curtas): serve de primeira barreira, não de garantia.
 * A chave guarda-se em hash: nem o email nem o IP ficam em claro.
 */
export async function dentroDoLimite(db: Db, tipo: string, valor: string, max: number, janelaSegundos: number) {
  const chave = sha256(`${tipo}:${valor.trim().toLowerCase()}`);
  const n = await contarPedido(db, chave, janelaSegundos);
  // De vez em quando, arruma os contadores velhos (sem tarefa agendada).
  if (Math.random() < 0.02) await limparLimitesAntigos(db).catch(() => undefined);
  return n <= max;
}
