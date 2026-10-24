// Frase e título antes dos locais na página do curso: mudam sozinhos conforme o curso (Gold ou Financiada,
// presencial, online síncrono com cronograma, ou assíncrono). Os textos antigos gravados nas páginas passam a estes.
import type { Course } from "../SiteLanding";

export type ComponenteCurso = "presencial" | "sincrono" | "assincrono";

const VIRTUAL = /sala virtual|e-?learning|moodle|zoom|dist[aâ]ncia|online/i;

/** Presencial se algum local não é virtual; síncrono com Sala Virtual (ou datas); senão assíncrono. */
export function componenteCurso(c: Course): ComponenteCurso {
  const locais = [...c.sessoes.map(s => `${s.local} ${s.morada ?? ""}`), ...(c.locais ?? []).map(l => `${l.nome} ${l.morada}`)]
    .filter(l => l.trim());
  if (locais.some(l => !VIRTUAL.test(l))) return "presencial";
  if (c.sincronia === "sincrono" || c.sincronia === "misto" || locais.some(l => /sala virtual|zoom/i.test(l))) return "sincrono";
  if (c.sincronia === "assincrono") return "assincrono";
  return c.sessoes.length ? "sincrono" : "assincrono";
}

const FRASES = {
  goldPresencial: "Veja os locais onde realizamos o curso, o investimento necessário e próximas datas do curso.",
  goldSincrono: "Veja o investimento necessário, próximas datas do curso e respetivo cronograma.",
  goldAssincrono: "Veja o investimento necessário e como pode aceder ao curso.",
  finPresencial: "Veja os locais onde realizamos o curso e próximas datas do curso.",
  finPresencialAntiga: "Veja os locais onde realizamos o curso, próximas datas do curso e financiamento.",
  fin: "Veja próximas datas do curso e financiamento.",
};

const TITULOS = {
  presencial: "Onde posso fazer o curso?",
  sincrono: "Quando e como posso fazer o curso?",
  assincrono: "Como posso fazer o curso?",
};

export function fraseLocais(c: Course) {
  const comp = componenteCurso(c);
  if (c.funding !== "Gold") return comp === "presencial" ? FRASES.finPresencial : FRASES.fin;
  return comp === "presencial" ? FRASES.goldPresencial : comp === "sincrono" ? FRASES.goldSincrono : FRASES.goldAssincrono;
}

export function tituloLocais(c: Course) {
  return TITULOS[componenteCurso(c)];
}

const norma = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const CONHECIDAS_FRASE = new Set([...Object.values(FRASES), "Veja os locais onde realizamos o curso, o investimento necessário, e próximas datas do curso."].map(norma));
const CONHECIDOS_TITULO = new Set([...Object.values(TITULOS), "Onde quer fazer o curso?"].map(norma));

/** Um texto da página que é uma destas frases (ou títulos) passa à do curso; os outros ficam como estão. */
export function textoAutomaticoCurso(texto: string, c: Course | null) {
  if (!c || !texto) return texto;
  const n = norma(texto);
  if (CONHECIDAS_FRASE.has(n)) return fraseLocais(c);
  if (CONHECIDOS_TITULO.has(n)) return tituloLocais(c);
  return texto;
}
