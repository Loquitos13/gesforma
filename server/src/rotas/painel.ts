import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { montarPainel } from "../repos/painel.js";
import { periodo } from "../repos/sql.js";
import { periodoQuery, regimeParam, textoQuery, validar } from "../validacao.js";
import type { Deps } from "./tipos.js";

const painelQuery = periodoQuery.extend({
  curso: textoQuery(200),
  local: textoQuery(120),
  horario: textoQuery(80),
  financiador: textoQuery(120),
  eixo: z.enum(["curso", "local", "horario"]).default("curso"),
});

// Painéis Gold e Financiada. Quem vê cada um está em permissoes/painel.ts; o comercial vê só os blocos de vendas.
export async function registar(app: FastifyInstance, deps: Deps) {
  const { db, requireAuth } = deps;

  app.get("/v1/painel/:regime", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: regimeParam, query: painelQuery }, req);
    if (!v) return;
    const q = v.query;
    const p = periodo(q.de, q.ate);
    return montarPainel(db, {
      regime: v.params.regime,
      de: p.de,
      ate: p.ate,
      anterior: p.anterior,
      curso: q.curso,
      local: q.local,
      horario: q.horario,
      financiador: v.params.regime === "fin" ? q.financiador : undefined,
    }, q.eixo, { soVendas: req.actor!.role === "comercial" });
  });
}
