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
  const base = guardada ?? listaFixa(regime);
  const outros = await many<{ doc_id: string; rotulo: string }>(db,
    `SELECT doc_id, COALESCE(rotulo, '') AS rotulo FROM formando_docs
      WHERE regime = $1 AND formando_id = $2 AND doc_id LIKE 'outro-%' ORDER BY updated_at, doc_id`, [regime, formandoId]);
  return [...base, ...outros.map(o => ({ id: o.doc_id, label: o.rotulo || "Outro documento", required: false, outro: true }))];
}
