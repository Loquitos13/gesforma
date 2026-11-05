/**
 * Documento carregado pela equipa na ficha do formando (inscrição feita pela equipa, documentos entregues em papel ou já
 * recebidos na plataforma antiga): o ficheiro vai para a Drive, na pasta do formando, e fica logo validado por quem o
 * carregou. Não sai nenhum email para o formando.
 */
import { hojeLisboa } from "./datas.js";
import type { Db } from "./db/pool.js";
import { pastaDoFormando } from "./driveArvore.js";
import { apagarFicheiroSubstituido, storeDriveFile } from "./driveFicheiros.js";
import { ficheiroDeDocumentoDaEquipa, nomeIdentificado } from "./ficheirosValidacao.js";
import { docsDefinidosDoFormando, RE_DOC_OUTRO } from "./formandoDocsLista.js";
import { mergeDocsJson } from "./formandoFinDocs.js";
import { linhaFormando } from "./repos/formandos.js";
import { docCarregadoPelaEquipa, docDoFormando, inserirNota } from "./repos/formandosDocs.js";
import type { Regime } from "./repos/sql.js";

export type ResultadoCarregar = { ok: true; nome: string } | { ok: false; status: number; error: string };

export async function carregarDocPelaEquipa(
  db: Db,
  regime: Regime,
  formandoId: number,
  docId: string,
  file: { name: string; mime: string; bytes: Buffer },
  actor: { id: string; name: string },
  rotulo = "",
): Promise<ResultadoCarregar> {
  const outro = RE_DOC_OUTRO.test(docId);
  const nomeOutro = rotulo.replace(/\s+/g, " ").trim().slice(0, 120);
  if (outro && !nomeOutro && !(await docDoFormando(db, regime, formandoId, docId))) return { ok: false, status: 400, error: "Dê um nome ao documento." };
  const def = outro && nomeOutro ? { id: docId, label: nomeOutro } : (await docsDefinidosDoFormando(db, regime, formandoId)).find(d => d.id === docId);
  // Fora da lista da ficha, só um documento que já lá esteja (documentos antigos da Gold).
  if (!def && !(await docDoFormando(db, regime, formandoId, docId))) return { ok: false, status: 404, error: "Este documento não faz parte da ficha." };
  const tipo = ficheiroDeDocumentoDaEquipa(file.name, file.bytes);
  if ("erro" in tipo) return { ok: false, status: 400, error: tipo.erro };
  file = { ...file, name: tipo.nome, mime: tipo.mime };
  const f = await linhaFormando(db, regime, formandoId) as Record<string, unknown> | null;
  if (!f) return { ok: false, status: 404, error: "Formando inexistente." };
  const pessoa = `${f.nome ?? ""} ${f.apelido ?? ""}`.replace(/\s+/g, " ").trim();
  const label = def?.label ?? docId;
  const anterior = (await db.query<{ drive_file_id: string | null }>(
    "SELECT drive_file_id FROM formando_docs WHERE regime = $1 AND formando_id = $2 AND doc_id = $3", [regime, formandoId, docId])).rows[0]?.drive_file_id ?? "";
  // Na pasta do formando, com os outros documentos dele (sem Drive ligada, a regra habitual).
  const pasta = await pastaDoFormando(db, regime, formandoId).catch(() => null);
  const guardado = await storeDriveFile(db, actor.id, { ...file, name: nomeIdentificado(file.name, label, pessoa) }, {
    kind: "formando-doc", regime, formando: pessoa, turma: String(f.turma ?? "") || undefined, label, itemId: String(formandoId),
    ...(pasta ? { parentDriveId: pasta.pastaId, folderPath: pasta.path } : {}),
  });
  const data = hojeLisboa();
  if (anterior && anterior !== guardado.id) await substituirFicheiroAnterior(db, anterior, { id: guardado.id, nome: guardado.name, url: guardado.openUrl ?? "" });
  await docCarregadoPelaEquipa(db, regime, formandoId, docId, { nome: guardado.name, data, driveFileId: guardado.id, driveUrl: guardado.openUrl ?? "" }, actor.id);
  if (outro && nomeOutro) {
    await db.query("UPDATE formando_docs SET rotulo = $4 WHERE regime = $1 AND formando_id = $2 AND doc_id = $3", [regime, formandoId, docId, nomeOutro]);
  }
  // Financiada: o registo antigo (JSON) acompanha, como na validação.
  if (regime === "fin" && !outro) await mergeDocsJson(db, formandoId, { [docId]: { ok: true, data } });
  await inserirNota(db, regime, formandoId, actor.name, actor.id, `Documento carregado pela equipa (validado) · ${label}`);
  return { ok: true, nome: guardado.name };
}

/**
 * «Substituir ficheiro»: o anterior sai da Drive (não fica uma cópia a mais). A pré-inscrição de onde veio aponta para o
 * mesmo ficheiro e passa para o novo. Um anexo do WhatsApp guardado na ficha ainda o abre: aí fica.
 */
async function substituirFicheiroAnterior(db: Db, anterior: string, novo: { id: string; nome: string; url: string }) {
  await db.query("UPDATE preinscricao_docs SET drive_file_id = $2, drive_url = $3, nome = $4 WHERE drive_file_id = $1", [anterior, novo.id, novo.url, novo.nome]);
  await db.query("UPDATE formando_docs SET drive_file_id = $2, drive_url = $3, file_name = $4 WHERE drive_file_id = $1", [anterior, novo.id, novo.url, novo.nome]);
  const doWhatsapp = (await db.query("SELECT 1 FROM whatsapp_anexos WHERE drive_file_id = $1 LIMIT 1", [anterior])).rows.length > 0;
  if (!doWhatsapp) await apagarFicheiroSubstituido(db, anterior).catch(err => console.error("[drive] ficheiro substituído por apagar:", err));
}

/**
 * «Remover»: o documento volta a ficar em falta (um «outro documento» sai da lista) e o ficheiro sai da Drive, se nada
 * mais o usar (a pré-inscrição de onde veio ou um anexo do WhatsApp continuam com ele).
 */
export async function removerDocPelaEquipa(db: Db, regime: Regime, formandoId: number, docId: string, actor: { id: string; name: string }) {
  const linha = (await db.query<{ drive_file_id: string | null; rotulo: string | null }>(
    "DELETE FROM formando_docs WHERE regime = $1 AND formando_id = $2 AND doc_id = $3 RETURNING drive_file_id, rotulo", [regime, formandoId, docId])).rows[0];
  if (!linha) return false;
  if (regime === "fin" && !RE_DOC_OUTRO.test(docId)) await mergeDocsJson(db, formandoId, { [docId]: { ok: false, data: "" } });
  const ficheiro = linha.drive_file_id ?? "";
  if (ficheiro) {
    const usado = (await db.query(
      `SELECT 1 FROM formando_docs WHERE drive_file_id = $1
       UNION ALL SELECT 1 FROM preinscricao_docs WHERE drive_file_id = $1
       UNION ALL SELECT 1 FROM whatsapp_anexos WHERE drive_file_id = $1 LIMIT 1`, [ficheiro])).rows.length > 0;
    if (!usado) await apagarFicheiroSubstituido(db, ficheiro).catch(err => console.error("[drive] ficheiro removido por apagar:", err));
  }
  await inserirNota(db, regime, formandoId, actor.name, actor.id, `Documento removido pela equipa · ${linha.rotulo || docId}`);
  return true;
}
