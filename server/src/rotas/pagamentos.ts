import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { config } from "../config.js";
import { normalizarEstado, validarTransicao } from "../estados.js";
import { nextOpsId } from "../ops.js";
import { METODOS_ACEITES, confirmarPagamento, findPagamentoPorReferencia, mapPagamento, PagamentoErro, recusarPagamento } from "../pagamentos.js";
import {
  SITUACOES, actualizarPagamento, apagarPagamento, chaveWebhookGuardada, contarPorSituacao, desmarcarFormandoGoldPago, formandoGoldDoPagamento,
  indicadoresPagamentos, inserirPagamento, listarPagamentos, obterPagamento, obterPagamentoDetalhe,
} from "../repos/pagamentos.js";
import { normalizeEmail } from "../security.js";
import { paginacao, periodoQuery, textoQuery, validar } from "../validacao.js";
import type { Deps } from "./tipos.js";

// Pagamentos: lista com indicadores, confirmar/recusar comprovativo, registo manual e webhook do gateway.

const idTexto = z.object({ id: z.string().trim().min(1).max(40) });
const pagSchema = z.object({
  nome: z.string().trim().min(1).max(160),
  valor: z.number().min(0).max(100_000),
  metodo: z.string().trim().min(1).max(60).optional(),
  curso: z.string().max(200).optional().default(""),
  data: z.string().max(40).optional(),
  estado: z.string().max(20).optional().default("Pendente"),
  email: z.string().max(254).optional(),
  referencia: z.string().max(40).optional(),
  formandoId: z.number().int().positive().optional(),
});
const listaQuery = paginacao.merge(periodoQuery).extend({
  situacao: z.preprocess(v => (v === "" ? undefined : v), z.enum(SITUACOES).optional()),
  curso: textoQuery(200),
  metodo: textoQuery(60),
});
const recusaSchema = z.object({ motivo: z.string().trim().min(3).max(400) });

function carimbo() {
  return new Date().toISOString().slice(0, 16).replace("T", " ");
}

function chaveIgual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function registar(app: FastifyInstance, deps: Deps) {
  const { db, requireAuth, audit } = deps;

  /** Lista paginada com contagens por situação e indicadores (os indicadores ignoram a situação e o método). */
  app.get("/v1/pagamentos", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { query: listaQuery }, req);
    if (!v) return;
    const { situacao, curso, metodo, de, ate, q, pagina, porPagina, ordem } = v.query;
    const pag = await listarPagamentos(db, { situacao, curso, metodo, de, ate, q, pagina, porPagina, ordem });
    const contagens = await contarPorSituacao(db, { curso, metodo, de, ate, q });
    const indicadores = await indicadoresPagamentos(db, { curso, de, ate });
    return { ...pag, contagens, indicadores, gateway: { ligado: false, estado: "por escolher" } };
  });

  app.get("/v1/pagamentos/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idTexto }, req);
    if (!v) return;
    const p = await obterPagamentoDetalhe(db, v.params.id);
    if (!p) return reply.code(404).send({ error: "pagamento inexistente" });
    return { pagamento: p };
  });

  /** Registo manual (ficha criada pela secretaria, pagamento em mão ou transferência já recebida). */
  app.post("/v1/pagamentos", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { body: pagSchema }, req);
    if (!v) return;
    const d = v.body;
    const estado = normalizarEstado("pagamento", d.estado);
    if (!estado) return reply.code(400).send({ error: `Estado inválido: «${d.estado}».` });
    const formando = d.formandoId ? await formandoGoldDoPagamento(db, d.formandoId) : null;
    if (d.formandoId && !formando) return reply.code(400).send({ error: "Formando inexistente." });
    const id = `TRX-${await nextOpsId(db)}`;
    const email = d.email ? normalizeEmail(d.email) : "";
    await inserirPagamento(db, {
      id, nome: d.nome, valor: d.valor, metodo: d.metodo || METODOS_ACEITES[0], curso: d.curso, data: d.data || carimbo(), estado: estado === "Pago" ? "Pendente" : estado,
      email, referencia: d.referencia ?? "", formandoId: formando ? Number(formando.id) : null, turmaId: formando?.turma_id ?? null,
    });
    await audit(db, req.actor!.id, "pagamento.criar", "pagamento", id, req.ip, { valor: d.valor, estado });
    const row = await obterPagamento(db, id);
    const pagamento = row && estado === "Pago" ? await confirmarPagamento(db, row, req.actor!.id) : row ? mapPagamento(row) : null;
    return { pagamento };
  });

  /** Confirmar o pagamento recebido (comprovativo ou transferência vista no banco). */
  app.post("/v1/pagamentos/:id/confirmar", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idTexto }, req);
    if (!v) return;
    const row = await obterPagamento(db, v.params.id);
    if (!row) return reply.code(404).send({ error: "pagamento inexistente" });
    if (String(row.estado) === "Pago") return reply.code(409).send({ error: "Este pagamento já está confirmado." });
    const t = validarTransicao("pagamento", String(row.estado), "Pago", req.actor!.role);
    if (!t.ok) return reply.code(409).send({ error: t.erro });
    try {
      const pagamento = await confirmarPagamento(db, row, req.actor!.id);
      await audit(db, req.actor!.id, "pagamento.confirmar", "pagamento", v.params.id, req.ip, { valor: pagamento.valor });
      return { pagamento, detalhe: await obterPagamentoDetalhe(db, v.params.id) };
    } catch (err) {
      return reply.code(409).send({ error: err instanceof Error ? err.message : "Não foi possível confirmar." });
    }
  });

  app.post("/v1/pagamentos/:id/recusar", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idTexto, body: recusaSchema }, req);
    if (!v) return;
    try {
      const r = await recusarPagamento(db, v.params.id, v.body.motivo);
      await audit(db, req.actor!.id, "pagamento.recusar", "pagamento", v.params.id, req.ip, { motivo: v.body.motivo, avisado: r.avisado });
      return { ...r, detalhe: await obterPagamentoDetalhe(db, v.params.id) };
    } catch (err) {
      if (err instanceof PagamentoErro) return reply.code(409).send({ error: err.message });
      throw err;
    }
  });

  app.patch("/v1/pagamentos/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idTexto, body: pagSchema.partial() }, req);
    if (!v) return;
    const d = v.body;
    const antes = await obterPagamento(db, v.params.id);
    if (!antes) return reply.code(404).send({ error: "pagamento inexistente" });
    // Pagamento recebido: valor, nome e método ficam como foram confirmados (o admin corrige, fica na auditoria).
    const mexeNoRecebido = (d.valor !== undefined && Number(d.valor) !== Number(antes.valor))
      || (d.nome !== undefined && d.nome !== String(antes.nome ?? "")) || (d.metodo !== undefined && d.metodo !== String(antes.metodo ?? ""));
    if (String(antes.estado) === "Pago" && mexeNoRecebido && req.actor!.role !== "admin") {
      return reply.code(409).send({ error: "Um pagamento recebido não muda de valor, nome nem método." });
    }
    let estado: string | undefined;
    if (d.estado !== undefined) {
      const t = validarTransicao("pagamento", String(antes.estado ?? ""), d.estado, req.actor!.role);
      if (!t.ok) return reply.code(409).send({ error: t.erro });
      estado = t.estado;
    }
    const passaAPago = estado === "Pago" && String(antes.estado) !== "Pago";
    await actualizarPagamento(db, v.params.id, {
      nome: d.nome, valor: d.valor, metodo: d.metodo, curso: d.curso, data: d.data,
      estado: passaAPago ? undefined : estado, email: d.email ? normalizeEmail(d.email) : undefined, referencia: d.referencia,
    });
    if (estado === "Reembolsado" && String(antes.estado) !== "Reembolsado" && antes.formando_id != null) {
      await desmarcarFormandoGoldPago(db, Number(antes.formando_id));
    }
    const row = await obterPagamento(db, v.params.id);
    const pagamento = row && passaAPago ? await confirmarPagamento(db, row, req.actor!.id) : row ? mapPagamento(row) : null;
    await audit(db, req.actor!.id, "pagamento.alterar", "pagamento", v.params.id, req.ip, { ...d });
    return { pagamento };
  });

  app.delete("/v1/pagamentos/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idTexto }, req);
    if (!v) return;
    const antes = await obterPagamento(db, v.params.id);
    if (!antes) return reply.code(404).send({ error: "pagamento inexistente" });
    if (String(antes.estado) === "Pago" && req.actor!.role !== "admin") {
      return reply.code(409).send({ error: "Um pagamento recebido não se apaga: marque-o como Reembolsado." });
    }
    await apagarPagamento(db, v.params.id);
    await audit(db, req.actor!.id, "pagamento.apagar", "pagamento", v.params.id, req.ip, { estado: antes.estado, valor: antes.valor });
    return { ok: true };
  });

  // ─── Webhook do gateway (fica pronto para quando houver gateway) ──────────

  const webhookSchema = z.object({
    chave: z.string().max(200).optional(), key: z.string().max(200).optional(),
    referencia: z.string().max(40).optional(), ref: z.string().max(40).optional(),
    id: z.string().max(40).optional(), valor: z.union([z.string().max(20), z.number()]).optional(),
  }).passthrough();

  async function webhook(req: FastifyRequest, reply: FastifyReply) {
    const q = webhookSchema.safeParse(req.query ?? {});
    const b = webhookSchema.safeParse(req.body ?? {});
    if (!q.success || !b.success) return reply.code(400).send({ error: "pedido inválido" });
    const d = { ...b.data, ...q.data };
    const chave = String(d.chave ?? d.key ?? req.headers["x-webhook-key"] ?? "").trim();
    const esperada = config.paymentWebhookKey || await chaveWebhookGuardada(db);
    if (!esperada) return reply.code(503).send({ error: "webhook sem chave: defina PAYMENT_WEBHOOK_KEY ou a chave em Configurações → Pagamentos" });
    if (!chaveIgual(chave, esperada)) return reply.code(401).send({ error: "chave inválida" });
    const referencia = String(d.referencia ?? d.ref ?? "").trim();
    const id = String(d.id ?? "").trim();
    const valor = d.valor == null || d.valor === "" ? undefined : Number(String(d.valor).replace(",", "."));
    const found = id ? await obterPagamento(db, id) : await findPagamentoPorReferencia(db, referencia, valor);
    if (!found) return reply.code(404).send({ error: "referência desconhecida" });
    // Reentrega do gateway: já pago responde ok sem repetir efeitos; reembolsado ou cancelado não volta a Pago.
    if (String(found.estado) === "Pago") return { ok: true, pagamento: mapPagamento(found) };
    if (String(found.estado) !== "Pendente") return reply.code(409).send({ error: `pagamento em estado ${found.estado}` });
    if (valor != null && Number.isFinite(valor) && Math.abs(Number(found.valor) - valor) >= 0.02) {
      await audit(db, undefined, "pagamento.webhook_valor", "pagamento", String(found.id), req.ip, { referencia, valor });
      return reply.code(409).send({ error: "valor não corresponde ao pagamento" });
    }
    const pagamento = await confirmarPagamento(db, found);
    await audit(db, undefined, "pagamento.webhook", "pagamento", pagamento.id, req.ip, { referencia, valor });
    return { ok: true, pagamento };
  }

  app.get("/v1/public/pagamentos/webhook", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, webhook);
  app.post("/v1/public/pagamentos/webhook", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, webhook);
}
