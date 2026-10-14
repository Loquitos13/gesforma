/**
 * Esquemas zod partilhados e um ajudante para validar `params`, `query` e `body`
 * com a mesma resposta 400 em todo o GesForma.
 *
 *   const v = validar(reply, { params: idParam, query: paginacao }, req);
 *   if (!v) return;           // a resposta 400 já foi enviada
 *   v.params.id; v.query.pagina;
 */
import type { FastifyReply, FastifyRequest } from "fastify";
import { z, type ZodTypeAny } from "zod";

const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data inválida (aaaa-mm-dd)");

/** Inteiro positivo vindo de texto (params e query chegam sempre como string). */
export const idNum = z.coerce.number().int().positive().max(2_147_483_647);

export const idParam = z.object({ id: idNum });
export const regime = z.enum(["gold", "fin"]);
export const regimeParam = z.object({ regime });
export const regimeIdParam = z.object({ regime, id: idNum });

/** Texto opcional de query: vazio passa a undefined. */
export const textoQuery = (max = 200) => z.preprocess(
  v => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().trim().max(max).optional(),
);

export const paginacao = z.object({
  pagina: z.coerce.number().int().min(1).max(100_000).default(1),
  porPagina: z.coerce.number().int().min(1).max(200).default(25),
  ordem: textoQuery(40),
  q: textoQuery(120),
});

export const periodoQuery = z.object({
  de: z.preprocess(v => (v === "" ? undefined : v), dataIso.optional()),
  ate: z.preprocess(v => (v === "" ? undefined : v), dataIso.optional()),
});

type Esquemas = { params?: ZodTypeAny; query?: ZodTypeAny; body?: ZodTypeAny };
type Saida<E extends Esquemas> = {
  params: E["params"] extends ZodTypeAny ? z.infer<E["params"]> : undefined;
  query: E["query"] extends ZodTypeAny ? z.infer<E["query"]> : undefined;
  body: E["body"] extends ZodTypeAny ? z.infer<E["body"]> : undefined;
};

function mensagem(err: z.ZodError) {
  const p = err.issues[0];
  if (!p) return "pedido inválido";
  const campo = p.path.join(".");
  return campo ? `${campo}: ${p.message}` : p.message;
}

/** Valida as partes pedidas; em erro responde 400 `{ error, campos }` e devolve null. */
export function validar<E extends Esquemas>(reply: FastifyReply, esquemas: E, req: FastifyRequest): Saida<E> | null {
  const out: Record<string, unknown> = { params: undefined, query: undefined, body: undefined };
  for (const parte of ["params", "query", "body"] as const) {
    const esquema = esquemas[parte];
    if (!esquema) continue;
    const r = esquema.safeParse(req[parte] ?? {});
    if (!r.success) {
      reply.code(400).send({
        error: mensagem(r.error),
        campos: r.error.issues.map(i => ({ campo: i.path.join("."), erro: i.message })),
      });
      return null;
    }
    out[parte] = r.data;
  }
  return out as Saida<E>;
}
