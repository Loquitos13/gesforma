/** Despesas da Financiada: lista, criar, editar, apagar e exportar no formato do template (Excel). */
import type { FastifyInstance } from "fastify";
import * as XLSX from "xlsx";
import { CAMPOS_DESPESA, validarDespesa } from "../../../src/partilhado/despesas.js";
import { textoSeguro } from "../pagamentosExportar.js";
import { alterarDespesa, apagarDespesa, criarDespesa, listarDespesas, type LinhaDespesa } from "../repos/despesas.js";
import { idParam, validar } from "../validacao.js";
import type { Deps } from "./tipos.js";

const dto = (r: LinhaDespesa) => ({ id: Number(r.id), ordem: Number(r.ordem), dados: r.dados, atualizadoEm: r.atualizado_em });

export async function registar(app: FastifyInstance, deps: Deps) {
  const { db, requireAuth, audit } = deps;

  app.get("/v1/despesas", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    return { despesas: (await listarDespesas(db)).map(dto) };
  });

  app.post("/v1/despesas", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validarDespesa((req.body as { dados?: unknown } | undefined)?.dados);
    if (!v.ok) return reply.code(400).send({ error: v.erro });
    const r = await criarDespesa(db, v.dados, req.actor!.id);
    await audit(db, req.actor!.id, "despesa.criar", "despesa", String(r?.id), req.ip);
    return { despesa: r ? dto(r) : null };
  });

  app.patch("/v1/despesas/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const p = validar(reply, { params: idParam }, req);
    if (!p) return;
    const v = validarDespesa((req.body as { dados?: unknown } | undefined)?.dados);
    if (!v.ok) return reply.code(400).send({ error: v.erro });
    const r = await alterarDespesa(db, p.params.id, v.dados);
    if (!r) return reply.code(404).send({ error: "Despesa não encontrada." });
    await audit(db, req.actor!.id, "despesa.alterar", "despesa", String(p.params.id), req.ip);
    return { despesa: dto(r) };
  });

  app.delete("/v1/despesas/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const p = validar(reply, { params: idParam }, req);
    if (!p) return;
    if (!(await apagarDespesa(db, p.params.id))) return reply.code(404).send({ error: "Despesa não encontrada." });
    await audit(db, req.actor!.id, "despesa.apagar", "despesa", String(p.params.id), req.ip);
    return { ok: true };
  });

  /** Mesmas colunas, pela mesma ordem, do template de despesas. */
  app.get("/v1/despesas/exportar", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const linhas = await listarDespesas(db);
    const cab = ["Ordem", ...CAMPOS_DESPESA.map(c => c.rotulo)];
    const dados = linhas.map(l => [
      Number(l.ordem),
      ...CAMPOS_DESPESA.map(c => {
        const v = l.dados[c.chave];
        return typeof v === "number" ? v : textoSeguro(v ?? "");
      }),
    ]);
    const folha = XLSX.utils.aoa_to_sheet([cab, ...dados]);
    folha["!cols"] = cab.map(c => ({ wch: Math.max(12, Math.min(40, c.length + 4)) }));
    const livro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(livro, folha, "Despesas");
    const bytes = XLSX.write(livro, { type: "buffer", bookType: "xlsx" }) as Buffer;
    await audit(db, req.actor!.id, "despesa.exportar", "despesa", undefined, req.ip, { total: linhas.length });
    reply
      .header("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .header("content-disposition", `attachment; filename="despesas-${new Date().toISOString().slice(0, 10)}.xlsx"`)
      .header("cache-control", "no-store");
    return reply.send(bytes);
  });
}
