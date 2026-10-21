import type { Db } from "./db/pool.js";
import { docsDoCurso } from "./docsCurso.js";
import * as repo from "./repos/leadDocs.js";

export type RecusaDoc = { id: number; tipo: string; label: string; observacao: string };

/** O que falta na documentação obrigatória da pré-inscrição: documentos por enviar e documentos recusados. */
export async function pendenciaDocsLead(db: Db, lead: { id: number; curso?: unknown; regime?: unknown }) {
  const regime = String(lead.regime ?? "gold") === "fin" ? "fin" : "gold";
  const pedidos = await docsDoCurso(db, String(lead.curso ?? ""), regime);
  const ficheiros = await repo.docsDoLead(db, Number(lead.id));
  const by = new Map(ficheiros.map(f => [f.tipo, f]));
  const faltam: string[] = [];
  const recusados: RecusaDoc[] = [];
  for (const doc of pedidos) {
    if (!doc.required) continue;
    const f = by.get(doc.id);
    if (!f) faltam.push(doc.label);
    else if (f.estado === "recusado") recusados.push({ id: Number(f.id), tipo: f.tipo, label: doc.label, observacao: f.observacao.trim() });
  }
  return { faltam, recusados, pendente: faltam.length > 0 || recusados.length > 0 };
}

/** Linha da lista do email: «Documento: motivo». */
export function itemRecusa(d: { label: string; observacao: string }) {
  return `${d.label}: ${d.observacao || "não está correcto. Volte a enviar o ficheiro."}`;
}
