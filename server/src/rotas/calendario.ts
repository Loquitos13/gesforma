/**
 * GET /v1/calendario?de=&ate=: os eventos do calendário de quem pede.
 *  - Administração: tudo (sessões dos dois regimes, início/matrícula/fim das turmas e contactos marcados no CRM).
 *  - Coordenação Gold / Financiada: as sessões e as datas das turmas do seu regime (Personalizado: a soma).
 *  - Comercial Gold: as sessões Gold (turma, curso e módulo).
 *  - Formador: só as sessões em que está.
 */
import { z } from "zod";
import { eventosCalendario } from "../calendario.js";
import { pode } from "../permissoes/capacidades.js";
import { perfisDoActor } from "../permissoes/personalizado.js";
import { formadorDaConta, obterFormador } from "../repos/formadores.js";
import { validar } from "../validacao.js";
import type { Deps } from "./tipos.js";

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export async function registar(app: import("fastify").FastifyInstance, deps: Deps) {
  const { db, requireAuth } = deps;
  app.get("/v1/calendario", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { query: z.object({ de: dia, ate: dia }) }, req);
    if (!v) return;
    const { de, ate } = v.query;
    if (ate < de || (Date.parse(ate) - Date.parse(de)) / 86_400_000 > 120) return reply.code(400).send({ error: "Período até 120 dias." });
    const a = req.actor!;
    if (a.role === "formador") {
      const f = await formadorDaConta(db, a.id, a.email);
      const nome = f ? String((await obterFormador(db, f.id))?.nome ?? "").trim().toLowerCase() : "";
      if (!nome) return { eventos: [] };
      return { eventos: await eventosCalendario(db, { de, ate, regimes: ["gold", "fin"], formador: nome }) };
    }
    const perfis = perfisDoActor({ role: a.perfil, perfis: a.perfis });
    const admin = perfis.includes("admin");
    const regimes = (["gold", "fin"] as const).filter(r => perfis.some(p => pode(p, r === "gold" ? "gold.ver" : "fin.ver")));
    if (!regimes.length) return reply.code(403).send({ error: "Sem acesso ao calendário." });
    // As datas das turmas (início, matrícula, fim) para quem gere turmas; os contactos do CRM só para a administração.
    const geremTurmas = admin || perfis.some(p => p === "secretaria" || p === "financiada");
    return { eventos: await eventosCalendario(db, { de, ate, regimes: [...regimes], datasTurma: geremTurmas, contactos: admin }) };
  });
}
