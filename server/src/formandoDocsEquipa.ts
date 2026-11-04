/**
 * Documento carregado pela equipa na ficha do formando (inscrição feita pela equipa, documentos entregues em papel ou já
 * recebidos na plataforma antiga): o ficheiro vai para a Drive, na pasta do formando, e fica logo validado por quem o
 * carregou. Não sai nenhum email para o formando.
 */
import { hojeLisboa } from "./datas.js";
import type { Db } from "./db/pool.js";
import { pastaDoFormando } from "./driveArvore.js";
import { storeDriveFile } from "./driveFicheiros.js";
import { erroFicheiroPublico, nomeIdentificado } from "./ficheirosValidacao.js";
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
  const erro = erroFicheiroPublico(file.name, file.bytes);
  if (erro) return { ok: false, status: 400, error: erro };
  const f = await linhaFormando(db, regime, formandoId) as Record<string, unknown> | null;
  if (!f) return { ok: false, status: 404, error: "Formando inexistente." };
  const pessoa = `${f.nome ?? ""} ${f.apelido ?? ""}`.replace(/\s+/g, " ").trim();
  const label = def?.label ?? docId;
  // Na pasta do formando, com os outros documentos dele (sem Drive ligada, a regra habitual).
  const pasta = await pastaDoFormando(db, regime, formandoId).catch(() => null);
  const guardado = await storeDriveFile(db, actor.id, { ...file, name: nomeIdentificado(file.name, label, pessoa) }, {
    kind: "formando-doc", regime, formando: pessoa, turma: String(f.turma ?? "") || undefined, label, itemId: String(formandoId),
    ...(pasta ? { parentDriveId: pasta.pastaId, folderPath: pasta.path } : {}),
  });
  const data = hojeLisboa();
  await docCarregadoPelaEquipa(db, regime, formandoId, docId, { nome: guardado.name, data, driveFileId: guardado.id, driveUrl: guardado.openUrl ?? "" }, actor.id);
  if (outro && nomeOutro) {
    await db.query("UPDATE formando_docs SET rotulo = $4 WHERE regime = $1 AND formando_id = $2 AND doc_id = $3", [regime, formandoId, docId, nomeOutro]);
  }
  // Financiada: o registo antigo (JSON) acompanha, como na validação.
  if (regime === "fin" && !outro) await mergeDocsJson(db, formandoId, { [docId]: { ok: true, data } });
  await inserirNota(db, regime, formandoId, actor.name, actor.id, `Documento carregado pela equipa (validado) · ${label}`);
  return { ok: true, nome: guardado.name };
}
