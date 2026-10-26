import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { construirNotificacoes, marcarLidas } from "../repos/notificacoes.js";
import { validar } from "../validacao.js";
import type { Deps } from "./tipos.js";

const lidasBody = z.object({ chaves: z.array(z.string().min(1).max(120)).max(60) });

// Sino do cabeçalho: avisos calculados na hora e o estado "lida" de cada pessoa.
export async function registar(app: FastifyInstance, deps: Deps) {
  const { db, requireAuth } = deps;

  app.get("/v1/notificacoes", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const items = await construirNotificacoes(db, req.actor!.id, req.actor!.role, req.actor!);
    return { notificacoes: items, naoLidas: items.filter(n => !n.lida).length };
  });

  app.post("/v1/notificacoes/lidas", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { body: lidasBody }, req);
    if (!v) return;
    await marcarLidas(db, req.actor!.id, v.body.chaves);
    return { ok: true };
  });
}
