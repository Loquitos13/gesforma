// Rótulos partilhados dos inquéritos (público-alvo e tipos de pergunta).
import type { PublicoInquerito, TipoPergunta } from "../../../partilhado/api/inqueritos";

export const PUBLICOS: { valor: PublicoInquerito; rotulo: string; ajuda: string }[] = [
  { valor: "formando", rotulo: "Formandos", ajuda: "Enviado a quem frequenta a turma." },
  { valor: "formador", rotulo: "Formador", ajuda: "Enviado aos formadores da turma." },
  { valor: "pos", rotulo: "Pós-formação", ajuda: "Enviado aos formandos para responderem três meses depois da acção." },
  { valor: "empresa", rotulo: "Empresa patronal", ajuda: "Para a empresa do formando; partilha-se pela ligação pública." },
];

export function rotuloPublico(p?: string) {
  return PUBLICOS.find(x => x.valor === p)?.rotulo ?? "Formandos";
}

export const TIPOS: { valor: TipoPergunta; rotulo: string }[] = [
  { valor: "escala", rotulo: "Escala 1 a 5" },
  { valor: "simnao", rotulo: "Sim / Não" },
  { valor: "multipla", rotulo: "Escolha múltipla" },
  { valor: "texto", rotulo: "Texto livre" },
];

export const rotuloTipo = (t: TipoPergunta) => TIPOS.find(x => x.valor === t)?.rotulo ?? t;

/** Descarrega um CSV (separador ;, com BOM para o Excel abrir os acentos). */
export function descarregarCsv(nome: string, linhas: (string | number)[][]) {
  const csv = linhas.map(l => l.map(c => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nome.replace(/[^\w-]+/g, "-").toLowerCase().slice(0, 60) || "inquerito"}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
