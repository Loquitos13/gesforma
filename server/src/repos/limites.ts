/** Contadores dos limites de pedidos públicos (limitePedidos.ts). */
import { many, one, type Consulta } from "./sql.js";

/** Conta mais um pedido na janela da chave (recomeça a janela quando passou) e devolve a contagem. */
export async function contarPedido(c: Consulta, chave: string, janelaSegundos: number) {
  const r = await one<{ contagem: number }>(c,
    `INSERT INTO limites_pedidos (chave, janela_inicio, contagem) VALUES ($1, now(), 1)
     ON CONFLICT (chave) DO UPDATE SET
       janela_inicio = CASE WHEN limites_pedidos.janela_inicio < now() - make_interval(secs => $2) THEN now() ELSE limites_pedidos.janela_inicio END,
       contagem = CASE WHEN limites_pedidos.janela_inicio < now() - make_interval(secs => $2) THEN 1 ELSE limites_pedidos.contagem + 1 END
     RETURNING contagem`,
    [chave, janelaSegundos]);
  return Number(r?.contagem ?? 1);
}

/** Apaga contadores com mais de dois dias (as janelas são de minutos ou horas). */
export async function limparLimitesAntigos(c: Consulta) {
  await many(c, "DELETE FROM limites_pedidos WHERE janela_inicio < now() - interval '2 days'");
}
