// Continuação de FolhaCcpView.tsx (partido para ficar abaixo das 500 linhas).
import { type MouseEvent } from "react";
import { type CelulaFolha, type FolhaModelo, type LarguraColuna, type PapelTexto } from "./folhaCcp";

import { colunaLetra } from "./csvAvaliacao";

import { Sel, LARGURA, normSel, inSel, chave } from "./FolhaCcpView";

export function canto(sel: Sel | null, folha: FolhaModelo, r: number, c: number, colunas: number[]) {
  if (!sel || !inSel(sel, r, c)) return false;
  const vis = new Set(colunas);
  const n = normSel(sel);
  let br = -1;
  let bc = -1;
  for (let rr = n.r0; rr <= n.r1; rr++) {
    for (let cc = n.c0; cc <= n.c1; cc++) {
      if (!vis.has(cc)) continue;
      const cel = folha.linhas[rr]?.[cc];
      if (!cel || cel.tipo !== "entrada") continue;
      if (rr > br || (rr === br && cc >= bc)) { br = rr; bc = cc; }
    }
  }
  return r === br && c === bc;
}

export function BarraFormula({ folha, foco }: { folha: FolhaModelo; foco: { r: number; c: number } | null }) {
  const cel = foco ? folha.linhas[foco.r]?.[foco.c] : undefined;
  const formula = cel && (cel.tipo === "valor" || cel.tipo === "texto") ? cel.formula ?? "" : "";
  const endereco = foco ? `${colunaLetra(foco.c)}${foco.r + 1}` : "";
  return (
    <div data-formula-bar className="flex min-w-0 items-start gap-2 border-b border-slate-200 bg-slate-50 px-3 py-1.5">
      <span className="mt-0.5 shrink-0 font-mono text-[11px] font-semibold text-slate-400">{endereco || "fx"}</span>
      <span className="min-w-0 break-all font-mono text-[11px] text-slate-700">
        {formula ? `=${formula}` : "Clique numa célula cinzenta para ver a fórmula que vai buscar a nota."}
      </span>
    </div>
  );
}

function classePapel(papel: PapelTexto | "calculo" | "escala", cabeca: string) {
  if (papel === "titulo") return "bg-slate-800 text-white font-semibold text-left px-2 py-1.5";
  if (papel === "meta") return "bg-slate-50 text-slate-600 text-left px-2 py-1";
  if (papel === "cabeca") return `${cabeca} font-semibold text-center px-1 py-1`;
  if (papel === "nome") return "bg-slate-100 text-slate-700 font-medium";
  if (papel === "grupo") return "bg-slate-100 text-slate-600 font-semibold uppercase px-2 py-1";
  if (papel === "formula") return "bg-violet-50 text-violet-950 font-medium text-left px-2 py-1";
  if (papel === "calculo") return "bg-slate-100 text-slate-800 font-semibold text-center tabular-nums";
  if (papel === "escala") return "bg-emerald-50 text-emerald-800 text-center px-1";
  if (papel === "peso" || papel === "codigo") return "text-center text-slate-600 font-medium px-1";
  return "text-left text-slate-700 px-2 py-1";
}

export function CelulaTd({
  cel,
  r,
  c,
  span,
  largura,
  selected,
  handle,
  selBg,
  handleBg,
  ring,
  cabeca,
  sticky,
  temNomes,
  formulaAtiva,
  leitura,
  drafts,
  mapa,
  onDraft,
  onPreparar,
  onFocar,
  onMouseDown,
  onMouseEnter,
  onCommit,
  onFill,
}: {
  cel: CelulaFolha;
  r: number;
  c: number;
  span: number;
  largura: LarguraColuna;
  selected: boolean;
  handle: boolean;
  selBg: string;
  handleBg: string;
  ring: string;
  cabeca: string;
  sticky: boolean;
  temNomes: boolean;
  formulaAtiva: boolean;
  leitura: boolean;
  drafts: Record<string, string>;
  mapa: Map<string, number | null>;
  onDraft: () => void;
  onPreparar: (shift: boolean) => void;
  onFocar: () => void;
  onMouseDown: (e: MouseEvent) => void;
  onMouseEnter: () => void;
  onCommit: (valor: string) => void;
  onFill: () => void;
}) {
  if (cel.tipo === "ocupado") return null;
  const vazio = cel.tipo === "vazio";
  const papel = cel.tipo === "texto" ? cel.papel : cel.tipo === "valor" ? cel.papel : null;
  const base = vazio
    ? (largura === "gutter" ? "bg-slate-50" : "bg-white")
    : classePapel(papel ?? "param", cabeca);
  return (
    <td
      colSpan={span}
      className={`border border-slate-200 align-middle ${LARGURA[largura]} ${base} ${selected ? selBg : ""} ${formulaAtiva ? "ring-1 ring-inset ring-emerald-600" : ""} ${sticky ? "sticky left-0 z-10" : ""} ${cel.tipo === "entrada" || ((cel.tipo === "valor" || cel.tipo === "texto") && cel.formula) ? "p-0 relative" : ""} ${(cel.tipo === "valor" || cel.tipo === "texto") && cel.formula ? "cursor-pointer" : ""}`}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
    >
      {cel.tipo === "texto" && cel.papel === "nome" && (
        <div className="h-36 flex items-center justify-center" title={cel.texto}>
          <span className="[writing-mode:vertical-rl] rotate-180 text-[10px] leading-tight max-h-32 overflow-hidden">
            {cel.texto}
          </span>
        </div>
      )}
      {cel.tipo === "texto" && cel.papel !== "nome" && (
        <span className="relative block whitespace-pre-line leading-snug" title={cel.formula ? `=${cel.formula}` : cel.texto}>
          {cel.formula && (
            <span className="pointer-events-none absolute top-0 right-0 border-t-[7px] border-l-[7px] border-t-emerald-600 border-l-transparent" />
          )}
          {cel.texto}
        </span>
      )}
      {cel.tipo === "valor" && (
        <span className="relative block px-1 py-1 leading-snug" title={cel.formula ? `=${cel.formula}` : cel.texto}>
          {cel.formula && (
            <span className="pointer-events-none absolute top-0 right-0 border-t-[7px] border-l-[7px] border-t-emerald-600 border-l-transparent" />
          )}
          {cel.texto}
        </span>
      )}
      {cel.tipo === "entrada" && !leitura && (
        <Entrada
          cel={cel}
          selected={selected}
          ring={ring}
          drafts={drafts}
          mapa={mapa}
          onDraft={onDraft}
          onPreparar={onPreparar}
          onFocar={onFocar}
          onCommit={onCommit}
        />
      )}
      {cel.tipo === "entrada" && leitura && <span className="block h-7 bg-white" />}
      {cel.tipo === "entrada" && handle && !leitura && (
        <button
          type="button"
          data-fill-handle
          aria-label="Arrastar para preencher"
          className={`absolute bottom-0 right-0 w-3 h-3 rounded-[2px] border border-white ${handleBg} cursor-crosshair z-20`}
          onMouseDown={e => {
            e.preventDefault();
            e.stopPropagation();
            onFill();
          }}
        />
      )}
      {vazio && !temNomes && r >= 0 && c >= 0 && <span className="block h-7" />}
    </td>
  );
}

function Entrada({
  cel,
  selected,
  ring,
  drafts,
  mapa,
  onDraft,
  onPreparar,
  onFocar,
  onCommit,
}: {
  cel: Extract<CelulaFolha, { tipo: "entrada" }>;
  selected: boolean;
  ring: string;
  drafts: Record<string, string>;
  mapa: Map<string, number | null>;
  onDraft: () => void;
  onPreparar: (shift: boolean) => void;
  onFocar: () => void;
  onCommit: (valor: string) => void;
}) {
  const key = chave(cel.formandoId, cel.moduloId, cel.parametroId);
  const stored = mapa.get(key);
  const shown = drafts[key] ?? (typeof stored === "number" ? String(stored).replace(".", ",") : "");
  return (
    <input
      className={`w-full h-8 text-center text-xs bg-white border-0 shadow-[inset_0_0_0_1px_#cbd5e1] select-text ${selected ? "ring-1 ring-inset ring-slate-400" : ""} ${ring} focus:outline-none focus:ring-2`}
      onMouseDown={e => {
        e.stopPropagation();
        onPreparar(e.shiftKey);
      }}
      onFocus={onFocar}
      inputMode="decimal"
      value={shown}
      aria-label="Nota"
      data-formando={cel.formandoId}
      data-modulo={cel.moduloId}
      data-parametro={cel.parametroId}
      onChange={e => {
        drafts[key] = e.target.value;
        onDraft();
      }}
      onBlur={e => onCommit(e.target.value)}
      onKeyDown={e => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}
