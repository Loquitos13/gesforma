import { LogController } from "fastify";

type Pedido = { method?: string; url?: string; consultas?: { n: number; ms: number } };
type Resposta = { statusCode: number; elapsedTime: number; log: { info: (o: object, m: string) => void; warn: (o: object, m: string) => void; error: (o: object, m: string) => void } };

/**
 * Uma linha por pedido em vez de duas ("incoming" + "completed"), só com o essencial.
 * Pedidos lentos (> 1 s) saem como aviso e erros 5xx como erro, para se encontrarem nos logs.
 */
export class LogCompacto extends LogController {
  incomingRequest() {
    /* a linha de fim de pedido já diz tudo */
  }

  requestCompleted(error: unknown, request: Pedido, reply: Resposta) {
    const linha = {
      m: request.method,
      u: request.url,
      s: reply.statusCode,
      ms: Math.round(reply.elapsedTime),
      // Consultas à base neste pedido e tempo gasto nelas.
      q: request.consultas?.n ?? 0,
      qms: Math.round(request.consultas?.ms ?? 0),
    };
    if (error || reply.statusCode >= 500) reply.log.error({ ...linha, err: error }, "pedido com erro");
    else if (reply.elapsedTime > 1000) reply.log.warn(linha, "pedido lento");
    else reply.log.info(linha, "pedido");
  }
}
