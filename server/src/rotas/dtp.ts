/** Dossiê técnico-pedagógico: vista geral por regime, modelos (curso e entidade) e exportação ZIP. */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { onVercel } from "../config.js";
import { criarEstruturaDtp } from "../driveArvore.js";
import { substituirNaPasta } from "../driveFicheiros.js";
import { comporModelo, dtpDefs, dtpEstrutura, DTP_FASES, DTP_MODELO_VAZIO, type DtpModelo } from "../dtpModel.js";
import { entidadeDoCurso, mapModelo, packDoCurso, type EntidadeDtp } from "../pedagogia/dtp.js";
import { matrizDtp, resumoDtp } from "../pedagogia/dtpCache.js";
import { exportarDossie } from "../pedagogia/dtpExport.js";
import { dtpModeloSchema, nomeEntidadeSchema } from "../pedagogia/esquemas.js";
import { idsBase, normalizarExtras, type Regime } from "../pedagogia/util.js";
import { partilharPasta, usableToken } from "../googleDrive.js";
import { pastaDaTurma } from "../repos/drive.js";
import * as repo from "../repos/dtp.js";
import { idParam, regimeIdParam, regimeParam, validar } from "../validacao.js";
import { semFormador, turmaOu404 } from "./pedagogia/comum.js";
import type { Deps } from "./tipos.js";

const SEM_LEITURA = "O formador não consulta o dossiê técnico-pedagógico.";

const exportQuery = z.object({ destino: z.enum(["zip", "drive"]).optional().catch(undefined) });

/** Na Vercel (30 s por pedido) as descargas da Drive param aqui; o resto do tempo é para gerar e gravar o ZIP. */
const PRAZO_DESCARGAS_VERCEL_MS = 15_000;

function respostaModelo(regime: Regime, modelo: DtpModelo, entidade: EntidadeDtp | null) {
  const efectivo = regime === "gold" ? comporModelo(entidade?.modelo ?? DTP_MODELO_VAZIO, modelo) : modelo;
  return {
    fases: DTP_FASES,
    base: dtpDefs(regime),
    modelo,
    entidade: entidade ? { id: entidade.id, nome: entidade.nome, modelo: entidade.modelo } : null,
    efectivo,
    estrutura: dtpEstrutura(regime, efectivo),
  };
}

export async function registar(app: FastifyInstance, { db, requireAuth, audit }: Deps) {
  app.get("/v1/dtp/:regime", async (req, reply) => {
    if (!requireAuth(req, reply) || !semFormador(req, reply, SEM_LEITURA)) return;
    const v = validar(reply, { params: regimeParam }, req);
    if (!v) return;
    return { pct: await resumoDtp(db, v.params.regime) };
  });

  /** Matriz turma × secção para a vista geral do Dossiê TP. */
  app.get("/v1/dtp/:regime/resumo", async (req, reply) => {
    if (!requireAuth(req, reply) || !semFormador(req, reply, SEM_LEITURA)) return;
    const v = validar(reply, { params: regimeParam }, req);
    if (!v) return;
    return matrizDtp(db, v.params.regime);
  });

  app.get("/v1/dtp/:regime/base", async (req, reply) => {
    if (!requireAuth(req, reply) || !semFormador(req, reply, SEM_LEITURA)) return;
    const v = validar(reply, { params: regimeParam }, req);
    if (!v) return;
    return { fases: DTP_FASES, base: dtpDefs(v.params.regime) };
  });

  app.get("/v1/dtp/gold/entidades", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const rows = await repo.listarEntidades(db);
    return { entidades: rows.map(r => ({ id: Number(r.id), nome: r.nome, documentos: dtpEstrutura("gold", mapModelo(r)).length })) };
  });

  app.post("/v1/dtp/gold/entidades", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { body: nomeEntidadeSchema }, req);
    if (!v) return;
    const nome = v.body.nome;
    if (await repo.entidadeComNome(db, nome)) return reply.code(409).send({ error: "Já existe uma entidade com esse nome." });
    const id = await repo.criarEntidade(db, nome);
    await audit(db, req.actor!.id, "dtp.entidade", "dtp_entidade", String(id), req.ip, { nome });
    return { entidade: { id, nome, documentos: dtpEstrutura("gold", DTP_MODELO_VAZIO).length } };
  });

  app.patch("/v1/dtp/gold/entidades/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam, body: nomeEntidadeSchema }, req);
    if (!v) return;
    const { id } = v.params;
    const nome = v.body.nome;
    if (await repo.entidadeComNome(db, nome, id)) return reply.code(409).send({ error: "Já existe uma entidade com esse nome." });
    const saved = await repo.renomearEntidade(db, id, nome);
    if (!saved) return reply.code(404).send({ error: "Entidade não encontrada." });
    await audit(db, req.actor!.id, "dtp.entidade", "dtp_entidade", String(id), req.ip, { nome });
    return { entidade: { id, nome, documentos: dtpEstrutura("gold", mapModelo(saved)).length } };
  });

  app.delete("/v1/dtp/gold/entidades/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam }, req);
    if (!v) return;
    if (!(await repo.apagarEntidade(db, v.params.id))) return reply.code(404).send({ error: "Entidade não encontrada." });
    await audit(db, req.actor!.id, "dtp.entidade.apagar", "dtp_entidade", String(v.params.id), req.ip);
    return { ok: true };
  });

  app.get("/v1/dtp/gold/entidades/:id/modelo", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam }, req);
    if (!v) return;
    const found = await repo.lerEntidade(db, v.params.id);
    if (!found) return reply.code(404).send({ error: "Entidade não encontrada." });
    const modelo = mapModelo(found);
    return { fases: DTP_FASES, base: dtpDefs("gold"), modelo, entidade: null, efectivo: modelo, estrutura: dtpEstrutura("gold", modelo) };
  });

  app.put("/v1/dtp/gold/entidades/:id/modelo", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam, body: dtpModeloSchema }, req);
    if (!v) return;
    const { id } = v.params;
    if (!(await repo.lerEntidade(db, id))) return reply.code(404).send({ error: "Entidade não encontrada." });
    const excluidos = idsBase("gold", v.body.excluidos);
    const extra = normalizarExtras(v.body.extra, "ENA · entidade responsável");
    await repo.gravarModeloEntidade(db, id, excluidos, extra);
    await audit(db, req.actor!.id, "dtp.entidade.modelo", "dtp_entidade", String(id), req.ip, { excluidos: excluidos.length, extra: extra.length });
    const modelo: DtpModelo = { excluidos, incluidos: [], extra };
    return { modelo, estrutura: dtpEstrutura("gold", modelo) };
  });

  app.get("/v1/cursos/:regime/:id/dtp-modelo", async (req, reply) => {
    if (!requireAuth(req, reply) || !semFormador(req, reply, SEM_LEITURA)) return;
    const v = validar(reply, { params: regimeIdParam }, req);
    if (!v) return;
    const { regime, id } = v.params;
    const pack = await packDoCurso(db, regime, id);
    return respostaModelo(regime, pack.curso, pack.entidade);
  });

  app.put("/v1/cursos/:regime/:id/dtp-modelo", async (req, reply) => {
    if (!requireAuth(req, reply) || !semFormador(req, reply, "O formador não altera o dossiê técnico-pedagógico.")) return;
    const v = validar(reply, { params: regimeIdParam, body: dtpModeloSchema }, req);
    if (!v) return;
    const { regime, id } = v.params;
    const entidade = regime === "gold" ? await entidadeDoCurso(db, id) : null;
    const idsEntidade = new Set((entidade?.modelo.extra ?? []).map(x => x.id));
    const excluidos = idsBase(regime, v.body.excluidos, { extras: true });
    const incluidos = idsBase(regime, v.body.incluidos).filter(x => entidade?.modelo.excluidos.includes(x));
    const extra = normalizarExtras(v.body.extra, "ENA · exigência do curso").filter(x => !idsEntidade.has(x.id));
    await repo.gravarModeloDoCurso(db, regime, id, { excluidos, incluidos, extra });
    await audit(db, req.actor!.id, "curso.dtp_modelo", "curso", String(id), req.ip, {
      regime, excluidos: excluidos.length, incluidos: incluidos.length, extra: extra.length,
    });
    return respostaModelo(regime, { excluidos, incluidos, extra }, entidade);
  });

  /**
   * Exporta o dossiê da turma num ZIP. `destino=zip` devolve o ZIP na resposta (o habitual fora da Vercel);
   * `destino=drive` grava-o na pasta da turma na Drive e devolve a ligação. Na Vercel é o destino por omissão:
   * a resposta não passa de ~4,5 MB e a função tem 30 s, por isso as descargas têm prazo e o que não couber
   * fica listado no índice do ZIP. Sem ligação à Drive, devolve sempre o ZIP.
   */
  app.get("/v1/dtp/:regime/:id/export", async (req, reply) => {
    if (!requireAuth(req, reply) || !semFormador(req, reply, SEM_LEITURA)) return;
    const v = validar(reply, { params: regimeIdParam, query: exportQuery }, req);
    if (!v) return;
    const { regime, id } = v.params;
    const turma = await turmaOu404(db, reply, regime, id);
    if (!turma) return;
    const destino = v.query.destino ?? (onVercel ? "drive" : "zip");
    const { token } = destino === "drive" ? await usableToken(db) : { token: null };
    const out = await exportarDossie(db, req.actor!.id, regime, turma, onVercel ? { prazo: Date.now() + PRAZO_DESCARGAS_VERCEL_MS } : {});
    await audit(db, req.actor!.id, "dtp.export", "turma", String(id), req.ip, {
      ficheiros: out.ficheiros, pasta: out.pasta, destino: token ? "drive" : "zip", foraDoPrazo: out.foraDoPrazo,
    });
    if (token) {
      const pasta = await pastaDaTurma(db, regime, id)
        || (await criarEstruturaDtp(db, { regime, turmaId: id, nome: turma.nome }, token))?.turmaPastaId
        || "";
      if (pasta) {
        const zip = await substituirNaPasta(token, pasta, out.nome, "application/zip", out.zip);
        // A secretaria já edita a pasta da turma; quem mais exporta (equipa) recebe só este ficheiro, para leitura.
        const actor = req.actor!;
        if (actor.role !== "admin" && actor.role !== "secretaria" && actor.email) {
          await partilharPasta(token, zip.id, actor.email, "reader").catch(() => undefined);
        }
        return {
          drive: {
            id: zip.id, url: zip.webViewLink ?? `https://drive.google.com/file/d/${zip.id}/view`,
            nome: out.nome, ficheiros: out.ficheiros, foraDoPrazo: out.foraDoPrazo,
          },
        };
      }
    }
    return reply
      .header("Content-Type", "application/zip")
      .header("Content-Disposition", `attachment; filename="${out.nome}"`)
      .send(out.zip);
  });
}
