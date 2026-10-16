import type { FastifyInstance } from "fastify";
import { avisosConfiguracao } from "../config.js";
import { chaveiro } from "../fieldCrypto.js";
import { recifrarTudo } from "../repos/sistema.js";
import type { Deps } from "./tipos.js";

// Saúde da configuração e manutenção (só admin: regra "/v1/sistema/*" em permissoes/sistema.ts).
export async function registar(app: FastifyInstance, deps: Deps) {
  const { db, requireAuth, audit } = deps;
  // Segunda barreira, além da matriz.
  const soAdmin: typeof requireAuth = (req, reply) => {
    if (!requireAuth(req, reply)) return false;
    if (req.actor!.role === "admin") return true;
    reply.code(403).send({ error: "Sem permissão para esta operação." });
    return false;
  };

  /** Variáveis de ambiente em falta ou fracas. Só aviso; nada bloqueia. */
  app.get("/v1/sistema/avisos", async (req, reply) => {
    if (!soAdmin(req, reply)) return;
    return { avisos: avisosConfiguracao(), chavesAntigas: Math.max(chaveiro().length - 1, 0) };
  });

  /** Recifra com a chave atual os dados ainda cifrados com chaves antigas. */
  app.post("/v1/sistema/recifrar", {
    config: { rateLimit: { max: 3, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    if (!soAdmin(req, reply)) return;
    const resultado = await recifrarTudo(db);
    const total = resultado.reduce((s, r) => s + r.recifrados, 0);
    const ilegiveis = resultado.reduce((s, r) => s + r.ilegiveis, 0);
    await audit(db, req.actor!.id, "sistema.recifrar", "sistema", undefined, req.ip, { total, ilegiveis });
    return { ok: true, total, ilegiveis, resultado };
  });
}
