/**
 * Avaliações da ENA no Google (Places API): a chave e a ficha configuram-se no backoffice
 * (Configurações › Avaliações Google); o site lê só a cópia guardada, renovada no máximo uma vez por dia.
 */
import type { Db } from "./db/pool.js";
import { lerDefinicao, gravarDefinicao } from "./repos/settings.js";
import { openSecret, sealSecret } from "./secretBox.js";

/** Entrada própria em app_settings: só estas rotas a lêem e escrevem (a rota genérica recusa-a). */
export const ID_AVALIACOES_GOOGLE = "google_avaliacoes";
const VALIDADE_MS = 24 * 60 * 60 * 1000;

export type AvaliacaoGoogle = { autor: string; autorUrl: string; foto: string; estrelas: number; texto: string; quando: string; data: string };
type Copia = { em: string; rating: number | null; total: number; url: string; avaliacoes: AvaliacaoGoogle[] };
type Guardado = { placeId?: string; chaveSelada?: string; copia?: Copia; erro?: string; erroEm?: string };
/** Depois de uma falha, espera antes de voltar a pedir (senão cada visita ao site ia à Google). */
const PAUSA_ERRO_MS = 60 * 60 * 1000;

async function ler(db: Db): Promise<Guardado> {
  return (await lerDefinicao(db, ID_AVALIACOES_GOOGLE)) as Guardado;
}

function chaveDe(g: Guardado) {
  if (!g.chaveSelada) return "";
  try { return openSecret(g.chaveSelada); } catch { return ""; }
}

/** O que o backoffice vê: nunca a chave. */
export async function estadoAvaliacoesGoogle(db: Db) {
  const g = await ler(db);
  return {
    configurado: Boolean(g.placeId && g.chaveSelada),
    placeId: g.placeId ?? "",
    temChave: Boolean(g.chaveSelada),
    atualizadoEm: g.copia?.em ?? null,
    rating: g.copia?.rating ?? null,
    total: g.copia?.total ?? 0,
    quantas: g.copia?.avaliacoes.length ?? 0,
    erro: g.erro ?? null,
  };
}

type RespostaPlaces = {
  rating?: number; userRatingCount?: number; googleMapsUri?: string;
  reviews?: {
    rating?: number; relativePublishTimeDescription?: string; publishTime?: string;
    text?: { text?: string }; originalText?: { text?: string };
    authorAttribution?: { displayName?: string; uri?: string; photoUri?: string };
  }[];
};

/** Pede à Google a classificação e as avaliações (a API devolve no máximo 5, as mais relevantes). */
async function pedirAGoogle(placeId: string, chave: string): Promise<Copia> {
  const r = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=pt-PT`, {
    headers: { "X-Goog-Api-Key": chave, "X-Goog-FieldMask": "rating,userRatingCount,googleMapsUri,reviews" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok) {
    const corpo = await r.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(`A Google recusou o pedido (${r.status})${corpo?.error?.message ? `: ${corpo.error.message}` : ""}.`);
  }
  const j = await r.json() as RespostaPlaces;
  return {
    em: new Date().toISOString(),
    rating: typeof j.rating === "number" ? j.rating : null,
    total: j.userRatingCount ?? 0,
    url: j.googleMapsUri ?? "",
    avaliacoes: (j.reviews ?? []).map(v => ({
      autor: v.authorAttribution?.displayName ?? "",
      autorUrl: v.authorAttribution?.uri ?? "",
      foto: v.authorAttribution?.photoUri ?? "",
      estrelas: Math.max(0, Math.min(5, Math.round(v.rating ?? 0))),
      texto: (v.text?.text ?? v.originalText?.text ?? "").trim(),
      quando: v.relativePublishTimeDescription ?? "",
      data: v.publishTime ?? "",
    })).filter(v => v.texto),
  };
}

/** Grava a ficha (e a chave, se vier) e renova logo a cópia; uma chave ou ficha errada dá erro e não fica gravada. */
export async function gravarAvaliacoesGoogle(db: Db, d: { placeId: string; chave?: string }) {
  const g = await ler(db);
  const chave = d.chave?.trim() || chaveDe(g);
  if (!chave) throw new Error("Cole a chave da Google Places API.");
  const copia = await pedirAGoogle(d.placeId, chave);
  await gravarDefinicao(db, ID_AVALIACOES_GOOGLE, { placeId: d.placeId, chaveSelada: sealSecret(chave), copia });
}

export async function desligarAvaliacoesGoogle(db: Db) {
  await gravarDefinicao(db, ID_AVALIACOES_GOOGLE, {});
}

/**
 * Avaliações para o site. Com a cópia fora de prazo (ou `forcar`), pede de novo à Google; se a Google falhar,
 * fica a cópia anterior e o erro aparece no backoffice.
 */
export async function avaliacoesGoogle(db: Db, forcar = false): Promise<Copia | null> {
  const g = await ler(db);
  const chave = chaveDe(g);
  if (!g.placeId || !chave) return null;
  const fresca = g.copia && Date.now() - Date.parse(g.copia.em) < VALIDADE_MS;
  if (fresca && !forcar) return g.copia!;
  if (!forcar && g.erroEm && Date.now() - Date.parse(g.erroEm) < PAUSA_ERRO_MS) return g.copia ?? null;
  try {
    const copia = await pedirAGoogle(g.placeId, chave);
    await gravarDefinicao(db, ID_AVALIACOES_GOOGLE, { placeId: g.placeId, chaveSelada: g.chaveSelada, copia });
    return copia;
  } catch (err) {
    await gravarDefinicao(db, ID_AVALIACOES_GOOGLE, { ...g, erro: err instanceof Error ? err.message : "falhou o pedido à Google", erroEm: new Date().toISOString() });
    if (forcar) throw err;
    return g.copia ?? null;
  }
}
