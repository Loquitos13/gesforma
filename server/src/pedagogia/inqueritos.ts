/** Regras dos inquéritos: público-alvo, perguntas e resumo das respostas. */
import type { InqueritoDocumento } from "../relatorioFinal.js";
import { inqueritosEnviados } from "../repos/inqueritos.js";
import type { Consulta } from "../repos/sql.js";
import { asArr, asObj, type Regime } from "./util.js";

export type PublicoInquerito = "formando" | "formador" | "empresa" | "pos";

export function publicoInquerito(payload: Record<string, unknown>): PublicoInquerito {
  const p = String(payload.publico ?? "formando");
  if (p === "formador" || p === "empresa" || p === "pos") return p;
  return "formando";
}

/** Item do dossiê (Financiada) onde fica o PDF das perguntas de cada público. */
export const ITEM_PERGUNTAS: Partial<Record<PublicoInquerito, string>> = {
  formador: "inquerito-formador",
  formando: "inquerito-formandos",
  pos: "inqueritos-pos",
};

export const NOME_PERGUNTAS: Partial<Record<PublicoInquerito, string>> = {
  formador: "PerguntasInqueritoFormador.pdf",
  formando: "PerguntasInqueritoFormandos.pdf",
  pos: "PerguntasInqueritoPos.pdf",
};

export type Pergunta = { id: number; tipo: string; texto: string; opcoes: string[] };

/** Perguntas com id (as que podem ter resposta). */
export function perguntasDe(payload: Record<string, unknown>): Pergunta[] {
  return asArr(payload.perguntas).map(raw => {
    const p = asObj(raw);
    return {
      id: Number(p.id) || 0,
      tipo: String(p.tipo ?? "texto"),
      texto: String(p.texto ?? ""),
      opcoes: asArr(p.opcoes).map(String),
    };
  }).filter(p => p.id);
}

/** Perguntas para o PDF (texto, tipo e opções). */
export function perguntasDoPayload(payload: Record<string, unknown>): InqueritoDocumento["perguntas"] {
  return asArr(payload.perguntas).map(raw => {
    const p = asObj(raw);
    return {
      texto: String(p.texto ?? "Pergunta"),
      tipo: String(p.tipo ?? "texto"),
      opcoes: asArr(p.opcoes).map(opcao => String(opcao)),
    };
  });
}

export type ResumoPergunta = {
  id: number;
  tipo: string;
  texto: string;
  n: number;
  media: number | null;
  distribuicao: Record<string, number>;
  pctSim: number | null;
  contagens: Record<string, number>;
  textos: string[];
};

/** Resumo de cada pergunta: média e distribuição (escala), % de sim, contagem de opções e comentários. */
export function resumirPerguntas(perguntas: Pergunta[], respostas: Record<string, unknown>[], maxTextos = 20): ResumoPergunta[] {
  return perguntas.map(p => {
    const vals = respostas.map(r => r[String(p.id)]).filter(v => v != null && v !== "");
    const base: ResumoPergunta = { id: p.id, tipo: p.tipo, texto: p.texto, n: vals.length, media: null, distribuicao: {}, pctSim: null, contagens: {}, textos: [] };
    if (p.tipo === "escala") {
      const nums = vals.map(Number).filter(n => Number.isFinite(n));
      for (const n of nums) base.distribuicao[String(n)] = (base.distribuicao[String(n)] ?? 0) + 1;
      return { ...base, n: nums.length, media: nums.length ? Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 10) / 10 : null };
    }
    if (p.tipo === "simnao") {
      const sim = vals.filter(v => /^sim$/i.test(String(v))).length;
      const nao = vals.filter(v => /^n[aã]o$/i.test(String(v))).length;
      return { ...base, n: sim + nao, pctSim: sim + nao ? Math.round((sim / (sim + nao)) * 100) : null, contagens: { Sim: sim, Não: nao } };
    }
    if (p.tipo === "multipla") {
      const contagens: Record<string, number> = {};
      for (const o of p.opcoes) contagens[o] = 0;
      for (const v of vals.flatMap(v => (Array.isArray(v) ? v : [v]))) contagens[String(v)] = (contagens[String(v)] ?? 0) + 1;
      return { ...base, contagens };
    }
    return { ...base, textos: vals.map(v => String(v).trim()).filter(Boolean).slice(0, maxTextos) };
  });
}

/** Forma antiga devolvida por `GET /v1/inqueritos/:id/respostas` (`metricas`). */
export function metricasInquerito(perguntas: Pergunta[], respostas: Record<string, unknown>[]) {
  return resumirPerguntas(perguntas, respostas).map(r => {
    if (r.tipo === "escala") return { id: r.id, tipo: r.tipo, n: r.n, media: r.media };
    if (r.tipo === "simnao") return { id: r.id, tipo: r.tipo, n: r.n, pctSim: r.pctSim };
    if (r.tipo === "multipla") return { id: r.id, tipo: r.tipo, n: r.n, contagens: r.contagens };
    return { id: r.id, tipo: r.tipo, n: r.n };
  });
}

/** Inquéritos enviados à turma de um público, para os PDFs de perguntas. */
export async function perguntasEnviadas(c: Consulta, turmaId: number, publico: PublicoInquerito, regime: Regime = "fin"): Promise<InqueritoDocumento[]> {
  const rows = await inqueritosEnviados(c, regime, turmaId);
  return rows.flatMap(row => {
    const payload = asObj(row.payload);
    if (publicoInquerito(payload) !== publico) return [];
    return [{ titulo: String(payload.titulo ?? "Inquérito"), publico, perguntas: perguntasDoPayload(payload) }];
  });
}
