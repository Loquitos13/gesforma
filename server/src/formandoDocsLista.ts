/**
 * Documentos de uma ficha de formando. Fichas criadas em Formandos › Nova ficha guardam (`docs_lista`) os documentos da
 * ficha do curso nesse momento: obrigatórios como no curso, opcionais e condicionais (com gatilho) como opcionais, sem
 * os desmarcados. Mudar depois o curso não mexe nessas fichas. As fichas antigas mantêm a lista fixa do regime. Em ambas, os «outros documentos» anexados pela equipa (`outro-…`) vêm no fim.
 */
import { DOCS_FORMANDO_FIN, DOCS_FORMANDO_GOLD } from "../../src/partilhado/dossierDocs.js";
import type { Db } from "./db/pool.js";
import { docsDoCurso } from "./docsCurso.js";
import { linhaFormando } from "./repos/formandos.js";
import { many } from "./repos/sql.js";

export type DefDocFormando = { id: string; label: string; required: boolean; outro?: boolean };

/** Id de um «outro documento» anexado pela equipa. */
export const RE_DOC_OUTRO = /^outro-[a-z0-9-]{4,34}$/;

function listaFixa(regime: "gold" | "fin"): DefDocFormando[] {
  return (regime === "fin" ? DOCS_FORMANDO_FIN : DOCS_FORMANDO_GOLD).map(d => ({ id: d.id, label: d.label, required: Boolean(d.required) }));
}

/** Documentos do curso para uma ficha nova (sem dados da pessoa: os condicionais ficam opcionais). */
export async function docsDoCursoParaFicha(db: Db, regime: "gold" | "fin", curso: string): Promise<(DefDocFormando & { condicional: boolean })[]> {
  if (!curso.trim()) return [];
  const lista = await docsDoCurso(db, curso, regime);
  // Curso sem lista própria (ex.: cursos Gold que não pedem documentos na pré-inscrição): os documentos da ficha do regime.
  if (!lista.length) return listaFixa(regime).map(d => ({ ...d, condicional: false }));
  return lista.map(d => ({ id: d.id, label: d.label, required: d.required && !d.gatilho, condicional: Boolean(d.gatilho) }));
}

/** A lista guardada na ficha (null se a ficha não tem lista própria). */
function listaGuardada(v: unknown): DefDocFormando[] | null {
  const arr = typeof v === "string" ? (() => { try { return JSON.parse(v) as unknown; } catch { return null; } })() : v;
  if (!Array.isArray(arr)) return null;
  return arr.flatMap(x => {
    const d = x as { id?: unknown; label?: unknown; required?: unknown };
    const id = String(d.id ?? "").trim();
    return id ? [{ id, label: String(d.label ?? id), required: Boolean(d.required) }] : [];
  });
}

/**
 * Fichas sem lista guardada (anteriores à Nova ficha com documentos do curso): seguem os documentos activos da ficha do
 * curso (os desmarcados não aparecem). Só continua obrigatório o que já o era na lista do regime e no curso; o que o
 * curso acrescentou fica opcional nestas fichas. Curso sem lista própria: a lista do regime.
 */
async function listaDeFichaAntiga(db: Db, regime: "gold" | "fin", curso: string): Promise<DefDocFormando[]> {
  const fixa = listaFixa(regime);
  if (!curso.trim()) return fixa;
  const doCurso = await docsDoCurso(db, curso, regime).catch(() => []);
  if (!doCurso.length) return fixa;
  const obrigatoriosAntes = new Set(fixa.filter(d => d.required).map(d => d.id));
  return doCurso.map(d => ({ id: d.id, label: d.label, required: obrigatoriosAntes.has(d.id) && d.required && !d.gatilho }));
}

/** Guarda na ficha a lista de documentos do curso de agora (Nova ficha). Sem documentos no curso, fica a lista fixa. */
export async function guardarDocsDoCursoNaFicha(db: Db, regime: "gold" | "fin", formandoId: number, curso: string) {
  const lista = await docsDoCursoParaFicha(db, regime, curso);
  if (!lista.length) return;
  const tabela = regime === "fin" ? "formandos_fin" : "formandos_gold";
  await db.query(`UPDATE ${tabela} SET docs_lista = $2::jsonb WHERE id = $1`,
    [formandoId, JSON.stringify(lista.map(({ id, label, required }) => ({ id, label, required })))]);
}

export async function docsDefinidosDoFormando(
  db: Db, regime: "gold" | "fin", formandoId: number, row?: Record<string, unknown> | null,
): Promise<DefDocFormando[]> {
  const f = row ?? await linhaFormando(db, regime, formandoId) as Record<string, unknown> | null;
  const guardada = listaGuardada(f?.docs_lista);
  const base = guardada ?? await listaDeFichaAntiga(db, regime, String(f?.curso ?? ""));
  const linhas = await many<{ doc_id: string; rotulo: string; com_ficheiro: boolean }>(db,
    `SELECT doc_id, COALESCE(rotulo, '') AS rotulo, (ok OR file_name <> '' OR COALESCE(drive_file_id, '') <> '') AS com_ficheiro
       FROM formando_docs WHERE regime = $1 AND formando_id = $2 ORDER BY updated_at, doc_id`, [regime, formandoId]);
  const ids = new Set(base.map(d => d.id));
  const fixos = new Map(listaFixa(regime).map(d => [d.id, d.label]));
  // Documentos que saíram da lista (ex.: desmarcados no curso) mas já têm ficheiro ou foram entregues: ficam, opcionais.
  const entregues = linhas.filter(l => !l.doc_id.startsWith("outro-") && !ids.has(l.doc_id) && l.com_ficheiro)
    .map(l => ({ id: l.doc_id, label: fixos.get(l.doc_id) ?? l.doc_id, required: false }));
  const outros = linhas.filter(l => l.doc_id.startsWith("outro-"))
    .map(o => ({ id: o.doc_id, label: o.rotulo || "Outro documento", required: false, outro: true }));
  return [...base, ...entregues, ...outros];
}
