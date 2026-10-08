import { useMemo, useRef, useState, type MouseEvent } from "react";
import {
  celulaEntrada,
  montarFolhasCcp,
  type CelulaFolha,
  type FolhaModelo,
  type LarguraColuna,
  type PapelTexto,
} from "./folhaCcp";
import type { EstruturaCcp } from "./avaliacaoCcp";
import type { TopicoPrograma } from "./cursoPrograma";

type Pessoa = { id: number; nome: string };

type Alteracao = {
  formandoId: number;
  moduloId: string;
  parametroId: string;
  valor: number | null;
};

type Sel = { r0: number; c0: number; r1: number; c1: number };

const LARGURA: Record<LarguraColuna, string> = {
  gutter: "w-3 min-w-3 bg-slate-50",
  codigo: "min-w-[4.5rem] w-20",
  texto: "min-w-[16rem] max-w-[24rem]",
  grupo: "min-w-[9rem] max-w-[14rem]",
  param: "min-w-[16rem] max-w-[28rem]",
  peso: "min-w-[3rem] w-14",
  formando: "min-w-[3.25rem] w-14",
};

function normSel(s: Sel): Sel {
  return {
    r0: Math.min(s.r0, s.r1),
    c0: Math.min(s.c0, s.c1),
    r1: Math.max(s.r0, s.r1),
    c1: Math.max(s.c0, s.c1),
  };
}

function inSel(s: Sel | null, r: number, c: number) {
  if (!s) return false;
  const n = normSel(s);
  return r >= n.r0 && r <= n.r1 && c >= n.c0 && c <= n.c1;
}

function parseNota(raw: string, min: number, max: number) {
  const t = raw.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return Math.min(hi, Math.max(lo, n));
}

function chave(formandoId: number, moduloId: string, parametroId: string) {
  return `${formandoId}|${moduloId}|${parametroId}`;
}

export function FolhasCcp({
  ccp,
  topicos,
  formandos,
  mapa,
  cursoNome,
  turmaNome,
  escalaMin,
  escalaMax,
  accent,
  onNota,
  onLote,
}: {
  ccp: EstruturaCcp;
  topicos: Pick<TopicoPrograma, "id" | "titulo">[];
  formandos: Pessoa[];
  mapa: Map<string, number | null>;
  cursoNome?: string;
  turmaNome?: string;
  escalaMin: number;
  escalaMax: number;
  accent: "gold" | "fin";
  onNota: (formandoId: number, moduloId: string, parametroId: string, valor: number | null) => void;
  onLote: (alteracoes: Alteracao[]) => void;
}) {
  const gold = accent === "gold";
  const folhas = useMemo(
    () => montarFolhasCcp({ ccp, topicos, formandos, mapa, cursoNome, turmaNome, escalaMax }),
    [ccp, cursoNome, escalaMax, formandos, mapa, topicos, turmaNome],
  );
  const [folhaId, setFolhaId] = useState(folhas[0]?.id ?? "");
  const folha = folhas.find(f => f.id === folhaId) ?? folhas[0];
  const [sel, setSel] = useState<Sel | null>(null);
  const dragRef = useRef<"range" | "fill" | null>(null);
  const selRef = useRef<Sel | null>(null);
  const fillValRef = useRef<number | null>(null);
  const drafts = useRef<Record<string, string>>({});
  const [, setTick] = useState(0);
  const accentBtn = gold ? "bg-amber-500 text-white" : "bg-blue-600 text-white";
  const selBg = gold ? "bg-amber-50" : "bg-blue-50";
  const handleBg = gold ? "bg-amber-500" : "bg-blue-600";
  const ring = gold ? "focus:ring-amber-400" : "focus:ring-blue-400";
  const cabeca = gold ? "bg-amber-100 text-amber-950" : "bg-blue-100 text-blue-950";

  function pintar(origem: number | null, range: Sel, actual: FolhaModelo) {
    const n = normSel(range);
    const alteracoes: Alteracao[] = [];
    for (let r = n.r0; r <= n.r1; r++) {
      const linha = actual.linhas[r] ?? [];
      for (let c = n.c0; c <= n.c1; c++) {
        const cel = linha[c];
        if (!cel || !celulaEntrada(cel)) continue;
        delete drafts.current[chave(cel.formandoId, cel.moduloId, cel.parametroId)];
        alteracoes.push({
          formandoId: cel.formandoId,
          moduloId: cel.moduloId,
          parametroId: cel.parametroId,
          valor: origem,
        });
      }
    }
    if (alteracoes.length) onLote(alteracoes);
    setTick(t => t + 1);
  }

  function valorOrigem(range: Sel, actual: FolhaModelo) {
    const n = normSel(range);
    const cel = actual.linhas[n.r0]?.[n.c0];
    if (!cel || !celulaEntrada(cel)) return null;
    const key = chave(cel.formandoId, cel.moduloId, cel.parametroId);
    const draft = drafts.current[key];
    if (draft != null && draft !== "") return parseNota(draft, escalaMin, escalaMax);
    const v = mapa.get(key);
    return typeof v === "number" ? v : null;
  }

  function onMouseUp() {
    if (dragRef.current === "fill" && selRef.current && folha) pintar(fillValRef.current, selRef.current, folha);
    dragRef.current = null;
  }

  if (!folha) return null;

  return (
    <div className="space-y-3" onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>
      <div className="flex gap-1 overflow-x-auto scrollbar-hide -mx-1 px-1">
        {folhas.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => { setFolhaId(item.id); setSel(null); selRef.current = null; }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap border ${
              item.id === folha.id ? `${accentBtn} border-transparent` : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {item.titulo}
          </button>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="max-h-[min(70vh,40rem)] overflow-auto">
          <table className="border-separate border-spacing-0 text-xs select-none">
            <tbody>
              {folha.linhas.map((linha, r) => {
                const temNomes = linha.some(cel => cel.tipo === "texto" && cel.papel === "nome");
                const visiveis = celulasVisiveis(linha);
                if (!visiveis.length) return null;
                return (
                  <tr key={r} className={temNomes ? "" : "h-7"}>
                    {visiveis.map(({ cel, c, span }) => (
                      <CelulaTd
                        key={c}
                        cel={cel}
                        r={r}
                        c={c}
                        span={span}
                        largura={folha.larguras[c] ?? "formando"}
                        selected={cel.tipo === "entrada" && inSel(sel, r, c)}
                        handle={canto(sel, folha, r, c)}
                        selBg={selBg}
                        handleBg={handleBg}
                        ring={ring}
                        cabeca={cabeca}
                        sticky={c === 1}
                        temNomes={temNomes}
                        drafts={drafts.current}
                        mapa={mapa}
                        onDraft={() => setTick(t => t + 1)}
                        onMouseDown={e => {
                          if (cel.tipo !== "entrada") return;
                          if ((e.target as HTMLElement).closest("[data-fill-handle]")) return;
                          const next = e.shiftKey && sel ? { ...sel, r1: r, c1: c } : { r0: r, c0: c, r1: r, c1: c };
                          setSel(next);
                          selRef.current = next;
                          dragRef.current = "range";
                        }}
                        onMouseEnter={() => {
                          if (!dragRef.current || !selRef.current) return;
                          const next = { ...selRef.current, r1: r, c1: c };
                          setSel(next);
                          selRef.current = next;
                        }}
                        onCommit={(valor: string) => {
                          if (cel.tipo !== "entrada") return;
                          const key = chave(cel.formandoId, cel.moduloId, cel.parametroId);
                          delete drafts.current[key];
                          onNota(cel.formandoId, cel.moduloId, cel.parametroId, parseNota(valor, escalaMin, escalaMax));
                          setTick(t => t + 1);
                        }}
                        onFill={() => {
                          const range = sel ?? { r0: r, c0: c, r1: r, c1: c };
                          fillValRef.current = valorOrigem(range, folha);
                          dragRef.current = "fill";
                        }}
                      />
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-2 text-[11px] text-slate-400 border-t border-slate-100">
          Cada grupo Participantes tem uma coluna por formando. As células brancas editam-se. As cinzentas e a escala qualitativa calculam-se. Arraste o quadrado da seleção para copiar um valor.
        </p>
      </div>
    </div>
  );
}

function celulasVisiveis(linha: CelulaFolha[]) {
  const out: { cel: CelulaFolha; c: number; span: number }[] = [];
  let skip = 0;
  linha.forEach((cel, c) => {
    if (cel.tipo === "ocupado" || skip > 0) {
      if (skip > 0) skip -= 1;
      return;
    }
    const span = cel.tipo === "texto" && cel.span && cel.span > 1 ? cel.span : 1;
    out.push({ cel, c, span });
    if (span > 1) skip = span - 1;
  });
  return out;
}

function canto(sel: Sel | null, folha: FolhaModelo, r: number, c: number) {
  if (!sel || !inSel(sel, r, c)) return false;
  const n = normSel(sel);
  let br = -1;
  let bc = -1;
  for (let rr = n.r0; rr <= n.r1; rr++) {
    for (let cc = n.c0; cc <= n.c1; cc++) {
      const cel = folha.linhas[rr]?.[cc];
      if (!cel || cel.tipo !== "entrada") continue;
      if (rr > br || (rr === br && cc >= bc)) { br = rr; bc = cc; }
    }
  }
  return r === br && c === bc;
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

function CelulaTd({
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
  drafts,
  mapa,
  onDraft,
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
  drafts: Record<string, string>;
  mapa: Map<string, number | null>;
  onDraft: () => void;
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
      className={`border border-slate-200 align-middle ${LARGURA[largura]} ${base} ${selected ? selBg : ""} ${sticky ? "sticky left-0 z-10" : ""} ${cel.tipo === "entrada" ? "p-0 relative" : ""}`}
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
        <span className="block whitespace-normal leading-snug">{cel.texto}</span>
      )}
      {cel.tipo === "valor" && (
        <span className="block px-1 py-1 leading-snug" title={cel.papel === "calculo" ? "Calculado" : cel.texto}>
          {cel.texto}
        </span>
      )}
      {cel.tipo === "entrada" && (
        <Entrada
          cel={cel}
          selected={selected}
          ring={ring}
          drafts={drafts}
          mapa={mapa}
          onDraft={onDraft}
          onCommit={onCommit}
        />
      )}
      {cel.tipo === "entrada" && handle && (
        <button
          type="button"
          data-fill-handle
          aria-label="Arrastar para preencher"
          className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-[2px] border border-white ${handleBg} cursor-crosshair z-20`}
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
  onCommit,
}: {
  cel: Extract<CelulaFolha, { tipo: "entrada" }>;
  selected: boolean;
  ring: string;
  drafts: Record<string, string>;
  mapa: Map<string, number | null>;
  onDraft: () => void;
  onCommit: (valor: string) => void;
}) {
  const key = chave(cel.formandoId, cel.moduloId, cel.parametroId);
  const stored = mapa.get(key);
  const shown = drafts[key] ?? (typeof stored === "number" ? String(stored).replace(".", ",") : "");
  return (
    <input
      className={`w-full h-8 text-center text-xs bg-white border-0 ${selected ? "ring-1 ring-inset ring-slate-400" : ""} ${ring} focus:outline-none focus:ring-2`}
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
