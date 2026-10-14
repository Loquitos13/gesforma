import { type CelulaFolha, type FaixaBloco, type FolhaModelo, type LarguraColuna } from "./folhaCcp";

export type Pessoa = { id: number; nome: string };

export type Alteracao = {
  formandoId: number;
  moduloId: string;
  parametroId: string;
  valor: number | null;
};

export type Sel = { r0: number; c0: number; r1: number; c1: number };

export const LARGURA: Record<LarguraColuna, string> = {
  gutter: "w-3 min-w-3 bg-slate-50",
  codigo: "min-w-[4.5rem] w-20",
  texto: "min-w-[16rem] max-w-[24rem]",
  grupo: "min-w-[9rem] max-w-[14rem]",
  param: "min-w-[16rem] max-w-[28rem]",
  peso: "min-w-[3rem] w-14",
  formando: "min-w-[3.25rem] w-14",
};

export function normSel(s: Sel): Sel {
  return {
    r0: Math.min(s.r0, s.r1),
    c0: Math.min(s.c0, s.c1),
    r1: Math.max(s.r0, s.r1),
    c1: Math.max(s.c0, s.c1),
  };
}

export function inSel(s: Sel | null, r: number, c: number) {
  if (!s) return false;
  const n = normSel(s);
  return r >= n.r0 && r <= n.r1 && c >= n.c0 && c <= n.c1;
}

export function parseNota(raw: string, min: number, max: number) {
  const t = raw.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return Math.min(hi, Math.max(lo, n));
}

/** Célula vazia limpa a nota. Texto que não é número fica de fora, para um cabeçalho colado não apagar a grelha. */
export function notaColada(raw: string, min: number, max: number): number | null | undefined {
  if (!raw.trim()) return null;
  const t = raw.trim().replace(",", ".");
  if (!Number.isFinite(Number(t))) return undefined;
  return parseNota(raw, min, max);
}

export function chave(formandoId: number, moduloId: string, parametroId: string) {
  return `${formandoId}|${moduloId}|${parametroId}`;
}

export function colunasDaFaixa(faixa: FaixaBloco, total: number) {
  const cols: number[] = [];
  for (const trecho of faixa.trechos) {
    for (let c = trecho.de; c < trecho.ate && c < total; c++) cols.push(c);
  }
  return cols;
}

export function faixaTemEntrada(folha: FolhaModelo, faixa: FaixaBloco) {
  const cols = new Set(colunasDaFaixa(faixa, folha.larguras.length));
  return folha.linhas.some(linha => linha.some((cel, c) => cols.has(c) && cel.tipo === "entrada"));
}

export function projetarLinha(linha: CelulaFolha[], colunas: number[]) {
  const vis = new Set(colunas);
  const mostrado = new Set<number>();
  const out: { cel: CelulaFolha; c: number; span: number }[] = [];
  for (const c of colunas) {
    if (mostrado.has(c)) continue;
    let origem = c;
    let cel = linha[c];
    if (!cel || cel.tipo === "ocupado") {
      while (origem > 0 && (!linha[origem] || linha[origem].tipo === "ocupado")) origem--;
      cel = linha[origem];
      if (!cel || cel.tipo === "ocupado" || !vis.has(origem) || mostrado.has(origem)) continue;
    }
    const bruto = cel.tipo === "texto" && cel.span && cel.span > 1 ? cel.span : 1;
    let span = 0;
    for (let i = 0; i < bruto; i++) {
      if (!vis.has(origem + i)) break;
      mostrado.add(origem + i);
      span++;
    }
    if (!span) continue;
    out.push({ cel, c: origem, span });
  }
  return out;
}
