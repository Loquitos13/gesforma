import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { exportarPagamentos } from "../pagamentosExportar.js";
import { emitirRecibo, enviarRecibo, estadoRecibo, pdfDoRecibo, ReciboErro } from "../recibos.js";
import { SITUACOES } from "../repos/pagamentos.js";
import { periodoQuery, textoQuery, validar } from "../validacao.js";
import type { Deps } from "./tipos.js";
import { hojeLisboa } from "../datas.js";

// Pagamentos: exportação para Excel e recibos internos (PDF, numeração anual, Drive e email).

const idTexto = z.object({ id: z.string().trim().min(1).max(40) });
const exportarQuery = periodoQuery.extend({
  situacao: z.preprocess(v => (v === "" ? undefined : v), z.enum(SITUACOES).optional()),
  curso: textoQuery(200),
  metodo: textoQuery(60),
  q: textoQuery(200),
});
const envioSchema = z.object({ para: z.string().trim().max(254).optional() }).default({});

/** Perfis que podem ver o NIF de quem pagou (a lista de pagamentos já é só da secretaria e do admin). */
const VEEM_NIF = new Set(["admin", "secretaria"]);

function nomeFicheiro(texto: string) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.\- ]/g, "").trim().slice(0, 120) || "recibo";
}

export async function registar(app: FastifyInstance, deps: Deps) {
  const { db, requireAuth, audit } = deps;

  app.get("/v1/pagamentos/exportar", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { query: exportarQuery }, req);
    if (!v) return;
    const { bytes, total } = await exportarPagamentos(db, v.query, { comNif: VEEM_NIF.has(req.actor!.role) });
    await audit(db, req.actor!.id, "pagamento.exportar", "pagamento", undefined, req.ip, { ...v.query, total });
    const hoje = hojeLisboa();
    reply
      .header("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .header("content-disposition", `attachment; filename="pagamentos-${hoje}.xlsx"`)
      .header("cache-control", "no-store");
    return reply.send(bytes);
  });

  app.get("/v1/pagamentos/:id/recibo/estado", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idTexto }, req);
    if (!v) return;
    return { recibo: await estadoRecibo(db, v.params.id) };
  });

  /** Emite o recibo (ou gera-o de novo com o mesmo número) e guarda-o na Drive. */
  app.post("/v1/pagamentos/:id/recibo", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idTexto }, req);
    if (!v) return;
    try {
      const r = await emitirRecibo(db, v.params.id, req.actor!.id);
      await audit(db, req.actor!.id, r.novo ? "recibo.emitir" : "recibo.regenerar", "pagamento", v.params.id, req.ip, { numero: r.recibo.numero });
      return { recibo: r.recibo, novo: r.novo, avisoDrive: r.avisoDrive };
    } catch (err) {
      if (err instanceof ReciboErro) return reply.code(err.codigo).send({ error: err.message });
      throw err;
    }
  });

  /** Descarrega o PDF de um recibo já emitido. */
  app.get("/v1/pagamentos/:id/recibo", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idTexto }, req);
    if (!v) return;
    try {
      const { pdf, numero, nome } = await pdfDoRecibo(db, v.params.id);
      reply
        .header("content-type", "application/pdf")
        .header("content-disposition", `inline; filename="Recibo ${numero.replace("/", "-")} - ${nomeFicheiro(nome)}.pdf"`)
        .header("cache-control", "no-store");
      return reply.send(pdf);
    } catch (err) {
      if (err instanceof ReciboErro) return reply.code(err.codigo).send({ error: err.message });
      throw err;
    }
  });

  app.post("/v1/pagamentos/:id/recibo/enviar", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idTexto, body: envioSchema }, req);
    if (!v) return;
    try {
      const recibo = await enviarRecibo(db, v.params.id, v.body.para);
      await audit(db, req.actor!.id, "recibo.enviar", "pagamento", v.params.id, req.ip, { numero: recibo.numero, para: recibo.enviadoPara });
      return { recibo };
    } catch (err) {
      if (err instanceof ReciboErro) return reply.code(err.codigo).send({ error: err.message });
      throw err;
    }
  });
}
