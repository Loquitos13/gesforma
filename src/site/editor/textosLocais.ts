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

/** Pré-pago e acesso direto (Gold): a pessoa paga e acede, sem escolher datas (é o caso «assíncrono» das regras). */
function eAcessoPago(c: Course) {
  return c.funding === "Gold" && c.enrollment !== "Pré-inscrição";
}

export function fraseLocais(c: Course) {
  const comp = componenteCurso(c);
  if (c.funding !== "Gold") return comp === "presencial" ? FRASES.finPresencial : FRASES.fin;
  if (eAcessoPago(c)) return FRASES.goldAssincrono;
  return comp === "presencial" ? FRASES.goldPresencial : comp === "sincrono" ? FRASES.goldSincrono : FRASES.goldAssincrono;
}

export function tituloLocais(c: Course) {
  if (eAcessoPago(c)) return TITULOS.assincrono;
  const comp = componenteCurso(c);
  // Pré-inscrição sem datas nem local físico: continua a ser «quando e como» (as datas vêm com a turma).
  return TITULOS[comp === "assincrono" ? "sincrono" : comp];
}

const norma = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Uma frase do tipo «Veja os locais…/o investimento…/próximas datas…» (com pequenas variações de escrita). */
function eFraseLocais(linha: string) {
  const n = norma(linha);
  return n.length < 200 && /^veja /.test(n) && /locais onde realizamos|investimento necessario|proximas datas|como pode aceder/.test(n);
}

/** «Onde / Quando e como / Como (quer|posso) fazer o curso?» */
function eTituloLocais(linha: string) {
  return /^(onde|quando e como|como) (quer|posso|pode) fazer o curso$/.test(norma(linha));
}

/**
 * Num texto da página do curso, cada linha que seja a frase ou o título dos locais passa à do curso
 * (as páginas e as fichas já gravadas mudam sozinhas); o resto fica como está.
 */
export function textoAutomaticoCurso(texto: string, c: Course | null) {
  if (!c || !texto) return texto;
  return texto.split("\n").map(linha => {
    if (eFraseLocais(linha)) return fraseLocais(c);
    if (eTituloLocais(linha)) return tituloLocais(c);
    return linha;
  }).join("\n");
}
