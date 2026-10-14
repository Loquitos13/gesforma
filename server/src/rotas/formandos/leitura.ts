/** Lista de formandos e ficha completa. */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sincronizarDocsAntigosFin } from "../../formandoFinDocs.js";
import { pode } from "../../permissoes/capacidades.js";
import { readFormandoPii } from "../../pii.js";
import { docsObrigatorios, listarFormandos } from "../../repos/formandos.js";
import { idNum, paginacao, regime, regimeIdParam, textoQuery, validar } from "../../validacao.js";
import type { Deps } from "../tipos.js";
import { montarFicha } from "./ficha.js";

const listaQuery = paginacao.extend({
  regime: regime.default("gold"),
  separador: z.enum(["turmas", "avulsos", "pendencias", "elegiveis", "docs_em_falta", "todos"]).optional(),
  curso: textoQuery(200),
  turma: z.preprocess(v => (v === "" ? undefined : v), idNum.optional()),
  local: textoQuery(120),
  estado: textoQuery(40),
  pagamento: z.preprocess(v => (v === "" ? undefined : v), z.enum(["pago", "por_pagar", "oferta", "isento"]).optional()),
  docs: z.preprocess(v => (v === "" ? undefined : v), z.enum(["completos", "em_falta"]).optional()),
  acesso: z.preprocess(v => (v === "" ? undefined : v), z.enum(["com", "sem"]).optional()),
});

export function registarLeitura(app: FastifyInstance, deps: Deps) {
  const { db, requireAuth } = deps;

  app.get("/v1/formandos", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { query: listaQuery }, req);
    if (!v) return;
    const q = v.query;
    if (!pode(req.actor!.role, q.regime === "fin" ? "fin.ver" : "gold.ver")) {
      return reply.code(403).send({ error: "Sem acesso a estes formandos." });
    }
    // Os documentos antigos da Financiada passam para formando_docs antes de se contarem em SQL.
    if (q.regime === "fin") {
      await sincronizarDocsAntigosFin(db).catch(err => req.log.warn({ err }, "documentos antigos da Financiada por sincronizar"));
    }
    const r = await listarFormandos(db, q);
    return {
      ...r,
      docsObrigatorios: docsObrigatorios(q.regime).length,
      linhas: r.linhas.map(l => ({
        id: Number(l.id),
        nome: l.nome,
        apelido: l.apelido,
        email: l.email,
        telf: readFormandoPii(l).telf || String(l.telf ?? ""),
        curso: l.curso,
        local: l.local,
        turma: l.turma_id ? { id: Number(l.turma_id), nome: l.turma_nome ?? "" } : null,
        ufcd: l.ufcd ?? "",
        estado: l.estado,
        inscrito: l.inscrito,
        pagamento: { situacao: l.situacao_pagamento, valor: Number(l.valor ?? 0), metodo: l.metodo, pago: Boolean(l.pago) },
        acesso: Boolean(l.tem_acesso),
        docs: { validados: Number(l.docs_ok), recusados: Number(l.docs_recusados) },
      })),
    };
  });

  app.get("/v1/formandos/:regime/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: regimeIdParam }, req);
    if (!v) return;
    const { regime: r, id } = v.params;
    const role = req.actor!.role;
    if (role === "formador" || !pode(role, r === "fin" ? "fin.ver" : "gold.ver")) {
      return reply.code(403).send({ error: "Sem acesso a esta ficha." });
    }
    const ficha = await montarFicha(db, r, id);
    if (!ficha) return reply.code(404).send({ error: "Formando inexistente." });
    return { ficha };
  });
}
