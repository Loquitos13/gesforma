/**
 * Ligação pessoal `/documentos/:token`: a pessoa vê o percurso, envia documentos, escolhe a turma,
 * aceita os consentimentos e conclui. Fechada (validada, desistiu, formando ou 90 dias sem uso sem documentos
 * pendentes) não mostra dados.
 * Inclui a ligação de documentos do formando financiado (`/formando-documentos/:token`).
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { logLeadEvent } from "../crmDossier.js";
import { ficheiroModelo, situacaoPagamento } from "../docsCurso.js";
import { COMPROVATIVO, abrirAlerta, docsDoCurso, listarDocsLead, syncLigacao } from "../docsLink.js";
import { garantirPastaPendente } from "../driveArvore.js";
import { formandoFinPorToken, uploadDocFormandoFin } from "../formandoFinDocs.js";
import { apagarFicheiroSubstituido, readDriveContent, storeDriveFile } from "../driveFicheiros.js";
import { erroFicheiroPublico } from "../ficheirosValidacao.js";
import { fechoDaLigacao, leadPorToken, marcarUso, textoFecho, vistaEncerrada } from "../ligacaoPessoal.js";
import { DadosFinErro, aceitarTermosFin, faltaDadosFin, gravarIdentificacaoFin, gravarMoradaFin } from "../percursoDadosFin.js";
import { PercursoErro, concluirPercurso, escolherTurmaPublica, registarConsentimento, vistaDocumentosPublica } from "../percurso.js";
import * as docsRepo from "../repos/leadDocs.js";
import * as leads from "../repos/leads.js";
import { validar } from "../validacao.js";
import type { Deps } from "./tipos.js";

const tokenParam = z.object({ token: z.string().trim().min(1).max(200) });
const tokenFormando = z.object({ token: z.string().trim().min(12, "ligação inválida").max(200) });
const limite = (max: number) => ({ config: { rateLimit: { max, timeWindow: "1 minute" } } });

type Ficheiro = { name: string; mime: string; bytes: Buffer | null; campos: Record<string, string> };

/** Lê um multipart com um ficheiro e campos de texto curtos. */
async function lerUpload(req: FastifyRequest): Promise<Ficheiro | null> {
  const out: Ficheiro = { name: "ficheiro", mime: "application/octet-stream", bytes: null, campos: {} };
  try {
    for await (const part of req.parts()) {
      if (part.type === "file") {
        out.name = part.filename || out.name;
        out.mime = part.mimetype || out.mime;
        out.bytes = await part.toBuffer();
      } else {
        out.campos[part.fieldname] = String(part.value ?? "").slice(0, 48);
      }
    }
  } catch {
    return null;
  }
  return out;
}

const LIGACAO_FIN_FECHADA = "Esta ligação já não está activa. Contacte a secretaria se precisar de enviar documentos.";

export async function registar(app: FastifyInstance, deps: Deps) {
  const { db } = deps;

  /** Lead da ligação aberta, ou responde 404/410 e devolve null. */
  async function ligacaoAberta(req: FastifyRequest, reply: FastifyReply) {
    const v = validar(reply, { params: tokenParam }, req);
    if (!v) return null;
    const lead = await leadPorToken(db, v.params.token);
    if (!lead) {
      reply.code(404).send({ error: "ligação inválida ou expirada" });
      return null;
    }
    const fecho = await fechoDaLigacao(db, lead);
    if (fecho) {
      reply.code(410).send({ error: textoFecho(fecho) });
      return null;
    }
    return lead;
  }

  app.get("/v1/public/documentos/:token", limite(40), async (req, reply) => {
    const v = validar(reply, { params: tokenParam }, req);
    if (!v) return;
    const lead = await leadPorToken(db, v.params.token);
    if (!lead) return reply.code(404).send({ error: "ligação inválida ou expirada" });
    const fecho = await fechoDaLigacao(db, lead);
    if (fecho) return vistaEncerrada(lead, fecho);
    await marcarUso(db, Number(lead.id));
    return vistaDocumentosPublica(db, lead);
  });

  app.get("/v1/public/documentos/:token/modelo/:tipo", limite(40), async (req, reply) => {
    const v = validar(reply, { params: tokenParam.extend({ tipo: z.string().trim().min(1).max(48) }) }, req);
    if (!v) return;
    const lead = await ligacaoAberta(req, reply);
    if (!lead) return;
    const regime = String(lead.regime ?? "gold") === "fin" ? "fin" : "gold";
    const modelo = await ficheiroModelo(db, regime, String(lead.curso ?? ""), v.params.tipo);
    if (!modelo) return reply.code(404).send({ error: "Este documento não tem ficheiro da secretaria." });
    const content = await readDriveContent(db, modelo.driveFileId);
    if (!content) return reply.code(404).send({ error: "ficheiro inexistente" });
    if (content.redirect && !content.bytes) return reply.redirect(content.redirect);
    reply.header("Content-Type", content.mime);
    reply.header("Content-Disposition", `inline; filename="${content.name.replace(/["\r\n]/g, "")}"`);
    reply.header("Cache-Control", "private, max-age=60");
    return reply.send(content.bytes);
  });

  app.post("/v1/public/documentos/:token/consentir", limite(20), async (req, reply) => {
    const v = validar(reply, { body: z.object({ tipo: z.string().trim().min(1).max(48) }) }, req);
    if (!v) return;
    const lead = await ligacaoAberta(req, reply);
    if (!lead) return;
    const faltaFin = faltaDadosFin(lead);
    if (faltaFin) return reply.code(409).send({ error: faltaFin });
    try {
      await marcarUso(db, Number(lead.id));
      return await registarConsentimento(db, Number(lead.id), v.body.tipo, { ip: req.ip });
    } catch (err) {
      return reply.code(400).send({ error: err instanceof PercursoErro ? err.message : "Não foi possível registar o consentimento." });
    }
  });

  app.post("/v1/public/documentos/:token/turma", limite(20), async (req, reply) => {
    const v = validar(reply, { body: z.object({ turmaId: z.coerce.number().int().positive() }) }, req);
    if (!v) return;
    const lead = await ligacaoAberta(req, reply);
    if (!lead) return;
    await marcarUso(db, Number(lead.id));
    try {
      return { ok: true, turma: await escolherTurmaPublica(db, Number(lead.id), v.body.turmaId) };
    } catch (err) {
      return reply.code(400).send({ error: err instanceof PercursoErro ? err.message : "Não foi possível escolher a turma." });
    }
  });

  // Financiada: passos antes dos documentos (morada, identificação, termos). Erros por campo, sem devolver valores.
  const texto = (max: number) => z.string().max(max).default("");
  const passosFin = {
    morada: z.object({ morada: texto(200), localidade: texto(80), codigoPostal: texto(10), concelho: texto(80) }).strict(),
    identificacao: z.object({
      tipoDocumento: texto(40), numeroDocumento: texto(30), validadeDocumento: texto(10), nif: texto(20), niss: texto(20),
      iban: texto(60), situacaoEmprego: texto(80), nifEntidadeEmpregadora: texto(20),
    }).strict(),
    termos: z.object({ termos: z.boolean().default(false), dados: z.boolean().default(false) }).strict(),
  };
  for (const passo of ["morada", "identificacao", "termos"] as const) {
    app.post(`/v1/public/documentos/:token/dados/${passo}`, limite(20), async (req, reply) => {
      const v = validar(reply, { body: passosFin[passo] }, req);
      if (!v) return;
      const lead = await ligacaoAberta(req, reply);
      if (!lead) return;
      await marcarUso(db, Number(lead.id));
      try {
        const id = Number(lead.id);
        if (passo === "morada") return await gravarMoradaFin(db, id, v.body as z.infer<typeof passosFin.morada>);
        if (passo === "identificacao") return await gravarIdentificacaoFin(db, id, v.body as z.infer<typeof passosFin.identificacao>);
        return await aceitarTermosFin(db, id, v.body as z.infer<typeof passosFin.termos>, { ip: req.ip });
      } catch (err) {
        if (err instanceof DadosFinErro) {
          return reply.code(400).send({
            error: err.message,
            ...(err.campos ? { campos: Object.entries(err.campos).map(([campo, erro]) => ({ campo, erro })) } : {}),
          });
        }
        throw err;
      }
    });
  }

  app.post("/v1/public/documentos/:token/concluir", limite(12), async (req, reply) => {
    const lead = await ligacaoAberta(req, reply);
    if (!lead) return;
    const faltaFin = faltaDadosFin(lead);
    if (faltaFin) return reply.code(409).send({ error: faltaFin });
    await marcarUso(db, Number(lead.id));
    try {
      return await concluirPercurso(db, Number(lead.id));
    } catch (err) {
      return reply.code(400).send({ error: err instanceof PercursoErro ? err.message : "Não foi possível concluir." });
    }
  });

  app.post("/v1/public/documentos/:token", limite(12), async (req, reply) => {
    const lead = await ligacaoAberta(req, reply);
    if (!lead) return;
    // Financiada: os documentos só depois da morada, da identificação e dos termos aceites.
    const faltaFin = faltaDadosFin(lead);
    if (faltaFin) return reply.code(409).send({ error: faltaFin });
    const up = await lerUpload(req);
    if (!up) return reply.code(400).send({ error: "upload inválido" });
    if (!up.bytes) return reply.code(400).send({ error: "ficheiro em falta" });
    const tipo = (up.campos.tipo || "outro").slice(0, 40);
    const erroFicheiro = erroFicheiroPublico(up.name, up.bytes);
    if (erroFicheiro) return reply.code(400).send({ error: erroFicheiro });
    const leadId = Number(lead.id);
    const regime = String(lead.regime ?? "gold") === "fin" ? "fin" : "gold";
    const pedidos = await docsDoCurso(db, String(lead.curso ?? ""), regime);
    const permitido = new Set([...pedidos.map(p => p.id), COMPROVATIVO.id]);
    if (!permitido.has(tipo)) return reply.code(400).send({ error: "Este tipo de documento não faz parte do curso." });
    // O comprovativo só entra com o passo de pagamento aberto (pagamento pedido pela secretaria).
    const comprovativo = tipo === COMPROVATIVO.id;
    if (comprovativo && (await situacaoPagamento(db, lead)).estado !== "pedido") {
      return reply.code(409).send({ error: "O pagamento ainda não foi pedido pela secretaria." });
    }
    const ja = await listarDocsLead(db, leadId);
    const recusados = ja.filter(d => d.estado === "recusado").map(d => d.tipo);
    if (!comprovativo && recusados.length && !recusados.includes(tipo)) {
      return reply.code(400).send({ error: "Nesta correcção só pode enviar os documentos indicados." });
    }
    if (ja.some(d => d.tipo === tipo && d.estado === "validado")) {
      return reply.code(409).send({ error: "Este documento já foi validado pela secretaria. Para o substituir, contacte a secretaria." });
    }
    await marcarUso(db, leadId);
    try {
      const antigo = ja.find(d => d.tipo === tipo && d.drive_file_id);
      const zona = await garantirPastaPendente(db, { id: leadId, nome: String(lead.nome ?? ""), apelido: String(lead.apelido ?? "") });
      const file = await storeDriveFile(db, undefined, { name: up.name, mime: up.mime, bytes: up.bytes }, {
        kind: comprovativo ? "comprovativo-pagamento" : "preinscricao-doc",
        regime,
        formando: `${lead.nome} ${lead.apelido}`.trim(),
        label: tipo,
        itemId: String(leadId),
        parentDriveId: zona?.pastaId,
        folderPath: zona?.path || undefined,
      });
      // Só o documento errado (recusado) ou ainda por rever é substituído; um ficheiro partilhado com outro registo fica.
      if (antigo?.drive_file_id && antigo.drive_file_id !== file.id && !(await docsRepo.ficheiroEmOutroSitio(db, antigo.drive_file_id, leadId))) {
        await apagarFicheiroSubstituido(db, antigo.drive_file_id);
      }
      await docsRepo.substituirDoc(db, { leadId, tipo, nome: file.name, driveFileId: file.id, driveUrl: file.openUrl ?? "" });
      await logLeadEvent(db, leadId, undefined, "campo", comprovativo ? "Comprovativo de pagamento na ficha" : `Documento na ficha · ${tipo}`, file.name);
      await syncLigacao(db, leadId);
      await abrirAlerta(db, leadId);
      return { ok: true, nome: file.name };
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "upload recusado" });
    }
  });

  app.get("/v1/public/formando-documentos/:token", limite(40), async (req, reply) => {
    const v = validar(reply, { params: tokenFormando }, req);
    if (!v) return;
    const vista = await formandoFinPorToken(db, v.params.token);
    if (!vista) return reply.code(404).send({ error: "ligação inválida ou expirada" });
    if (await leads.ligacaoFinFechada(db, vista.formandoId)) return reply.code(410).send({ error: LIGACAO_FIN_FECHADA });
    return vista;
  });

  app.post("/v1/public/formando-documentos/:token", limite(16), async (req, reply) => {
    const v = validar(reply, { params: tokenFormando }, req);
    if (!v) return;
    const formandoId = await leads.formandoFinIdPorToken(db, v.params.token);
    if (!formandoId) return reply.code(404).send({ error: "ligação inválida ou expirada" });
    if (await leads.ligacaoFinFechada(db, formandoId)) return reply.code(410).send({ error: LIGACAO_FIN_FECHADA });
    const up = await lerUpload(req);
    if (!up) return reply.code(400).send({ error: "upload inválido" });
    const tipo = up.campos.tipo ?? "";
    if (!up.bytes || !tipo) return reply.code(400).send({ error: "pedido inválido" });
    const r = await uploadDocFormandoFin(db, formandoId, tipo, { name: up.name, mime: up.mime, bytes: up.bytes }, { viaFormando: true });
    if ("error" in r) return reply.code(400).send({ error: r.error });
    return r;
  });
}
