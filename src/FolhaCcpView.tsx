import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type MouseEvent } from "react";
import {
  celulaEntrada,
  montarFolhasCcp,
  type CelulaFolha,
  type FaixaBloco,
  type FolhaModelo,
  type LarguraColuna,
  type PapelTexto,
} from "./folhaCcp";
import type { EstruturaCcp } from "./avaliacaoCcp";
import { colunaLetra } from "./csvAvaliacao";
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

/** Célula vazia limpa a nota. Texto que não é número fica de fora, para um cabeçalho colado não apagar a grelha. */
function notaColada(raw: string, min: number, max: number): number | null | undefined {
  if (!raw.trim()) return null;
  const t = raw.trim().replace(",", ".");
  if (!Number.isFinite(Number(t))) return undefined;
  return parseNota(raw, min, max);
}

function chave(formandoId: number, moduloId: string, parametroId: string) {
  return `${formandoId}|${moduloId}|${parametroId}`;
}

function colunasDaFaixa(faixa: FaixaBloco, total: number) {
  const cols: number[] = [];
  for (const trecho of faixa.trechos) {
    for (let c = trecho.de; c < trecho.ate && c < total; c++) cols.push(c);
  }
  return cols;
}

function faixaTemEntrada(folha: FolhaModelo, faixa: FaixaBloco) {
  const cols = new Set(colunasDaFaixa(faixa, folha.larguras.length));
  return folha.linhas.some(linha => linha.some((cel, c) => cols.has(c) && cel.tipo === "entrada"));
}

function projetarLinha(linha: CelulaFolha[], colunas: number[]) {
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
  apenasId,
  leitura = false,
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
  /** Na ficha do curso, mostra só a folha deste momento. */
  apenasId?: string;
  /** A ficha mostra a tabela. As notas editam-se na turma. */
  leitura?: boolean;
}) {
  const gold = accent === "gold";
  const folhas = useMemo(() => {
    const todas = montarFolhasCcp({ ccp, topicos, formandos, mapa, cursoNome, turmaNome, escalaMax });
    return apenasId ? todas.filter(item => item.id === apenasId) : todas;
  }, [apenasId, ccp, cursoNome, escalaMax, formandos, mapa, topicos, turmaNome]);
  const [folhaId, setFolhaId] = useState(folhas[0]?.id ?? "");
  const [faixaPorFolha, setFaixaPorFolha] = useState<Record<string, string>>({});
  const [foco, setFoco] = useState<{ r: number; c: number } | null>(null);
  const folha = folhas.find(f => f.id === folhaId) ?? folhas[0];
  const faixa = folha
    ? folha.faixas.find(item => item.id === faixaPorFolha[folha.id])
      ?? folha.faixas.find(item => faixaTemEntrada(folha, item))
      ?? folha.faixas[0]
      ?? null
    : null;
  const colunas = folha
    ? (faixa ? colunasDaFaixa(faixa, folha.larguras.length) : folha.larguras.map((_, i) => i).filter(c => folha.larguras[c] !== "gutter"))
    : [];
  const stickyCol = colunas.find(c => c > 0 && folha && ["codigo", "texto", "grupo", "param"].includes(folha.larguras[c] ?? "")) ?? colunas[0];
  const [sel, setSel] = useState<Sel | null>(null);
  const dragRef = useRef<"range" | "fill" | null>(null);
  const selRef = useRef<Sel | null>(null);
  const ancoraRef = useRef<{ r: number; c: number } | null>(null);
  const fillValRef = useRef<number | null>(null);
  const folhaRef = useRef(folha);
  const colunasRef = useRef(colunas);
  const onLoteRef = useRef(onLote);
  const pintarRef = useRef<(origem: number | null, range: Sel, actual: FolhaModelo) => void>(() => {});
  const drafts = useRef<Record<string, string>>({});
  const [, setTick] = useState(0);
  folhaRef.current = folha;
  colunasRef.current = colunas;
  onLoteRef.current = onLote;
  const accentBtn = gold ? "bg-amber-500 text-white" : "bg-blue-600 text-white";
  const selBg = gold ? "bg-amber-50" : "bg-blue-50";
  const handleBg = gold ? "bg-amber-500" : "bg-blue-600";
  const ring = gold ? "focus:ring-amber-400" : "focus:ring-blue-400";
  const cabeca = gold ? "bg-amber-100 text-amber-950" : "bg-blue-100 text-blue-950";

  function pintar(origem: number | null, range: Sel, actual: FolhaModelo) {
    const n = normSel(range);
    const visiveis = new Set(colunasRef.current);
    const alteracoes: Alteracao[] = [];
    for (let r = n.r0; r <= n.r1; r++) {
      const linha = actual.linhas[r] ?? [];
      for (let c = n.c0; c <= n.c1; c++) {
        if (!visiveis.has(c)) continue;
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
    if (alteracoes.length) onLoteRef.current(alteracoes);
    setTick(t => t + 1);
  }
  pintarRef.current = pintar;

  useEffect(() => {
    function up() {
      const actual = folhaRef.current;
      if (dragRef.current === "fill" && selRef.current && actual) {
        pintarRef.current(fillValRef.current, selRef.current, actual);
      }
      dragRef.current = null;
    }
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  function prepararSelecao(r: number, c: number, shift: boolean) {
    const base = selRef.current;
    const next = shift && base ? { ...base, r1: r, c1: c } : { r0: r, c0: c, r1: r, c1: c };
    selRef.current = next;
    ancoraRef.current = { r, c };
    dragRef.current = "range";
  }

  function focarEntrada(r: number, c: number) {
    ancoraRef.current = { r, c };
    if (dragRef.current === "fill") return;
    const actual = selRef.current;
    if (dragRef.current === "range" && actual && actual.r1 === r && actual.c1 === c) {
      setSel(actual);
      return;
    }
    const next = { r0: r, c0: c, r1: r, c1: c };
    selRef.current = next;
    setSel(next);
  }

  function colarTexto(texto: string) {
    const actual = folhaRef.current;
    const ancora = ancoraRef.current;
    if (!actual || !ancora) return;
    const linhasTexto = texto.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    if (linhasTexto.length && linhasTexto[linhasTexto.length - 1] === "") linhasTexto.pop();
    if (!linhasTexto.length) return;
    const visiveis = colunasRef.current;
    const inicio = visiveis.indexOf(ancora.c);
    if (inicio < 0) return;
    const alteracoes: Alteracao[] = [];
    for (let i = 0; i < linhasTexto.length; i++) {
      const partes = linhasTexto[i].split("\t");
      const linha = actual.linhas[ancora.r + i];
      if (!linha) continue;
      for (let j = 0; j < partes.length; j++) {
        const c = visiveis[inicio + j];
        if (c == null) continue;
        const cel = linha[c];
        if (!cel || !celulaEntrada(cel)) continue;
        const valor = notaColada(partes[j], escalaMin, escalaMax);
        if (valor === undefined) continue;
        delete drafts.current[chave(cel.formandoId, cel.moduloId, cel.parametroId)];
        alteracoes.push({
          formandoId: cel.formandoId,
          moduloId: cel.moduloId,
          parametroId: cel.parametroId,
          valor,
        });
      }
    }
    if (alteracoes.length) onLoteRef.current(alteracoes);
    setTick(t => t + 1);
  }

  function onPaste(e: ClipboardEvent<HTMLDivElement>) {
    if (leitura) return;
    const texto = e.clipboardData.getData("text/plain");
    if (!texto || !ancoraRef.current) return;
    const grelha = /[\t\r\n]/.test(texto);
    const dentroDoInput = (e.target as HTMLElement).closest("input");
    if (!grelha && dentroDoInput) return;
    e.preventDefault();
    colarTexto(texto);
  }

  function lerCelula(actual: FolhaModelo, r: number, c: number) {
    const cel = actual.linhas[r]?.[c];
    if (!cel || !celulaEntrada(cel)) return undefined;
    const key = chave(cel.formandoId, cel.moduloId, cel.parametroId);
    const draft = drafts.current[key];
    if (draft != null && draft !== "") return parseNota(draft, escalaMin, escalaMax);
    const v = mapa.get(key);
    return typeof v === "number" ? v : null;
  }

  function valorOrigem(range: Sel, actual: FolhaModelo) {
    const n = normSel(range);
    const ancora = ancoraRef.current;
    if (ancora && ancora.r >= n.r0 && ancora.r <= n.r1 && ancora.c >= n.c0 && ancora.c <= n.c1) {
      const daAncora = lerCelula(actual, ancora.r, ancora.c);
      if (daAncora !== undefined) return daAncora;
    }
    return lerCelula(actual, n.r0, n.c0) ?? null;
  }

  if (!folha) return null;

  return (
    <div className="space-y-3" onPaste={onPaste}>
      {folhas.length > 1 && (
      <div className="flex gap-1 overflow-x-auto scrollbar-hide -mx-1 px-1">
        {folhas.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => { setFolhaId(item.id); setSel(null); selRef.current = null; ancoraRef.current = null; setFoco(null); }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap border ${
              item.id === folha.id ? `${accentBtn} border-transparent` : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {item.titulo}
          </button>
        ))}
      </div>
      )}
      {folha.faixas.length > 1 && (
        <div className="flex gap-1 overflow-x-auto scrollbar-hide -mx-1 px-1" data-blocos={folha.id}>
          {folha.faixas.map(item => (
            <button
              key={item.id}
              type="button"
              data-faixa={item.id}
              onClick={() => {
                setFaixaPorFolha(prev => ({ ...prev, [folha.id]: item.id }));
                setSel(null);
                selRef.current = null;
                ancoraRef.current = null;
                setFoco(null);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap border ${
                item.id === faixa?.id ? "border-slate-800 bg-slate-800 text-white" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {item.titulo}
            </button>
          ))}
        </div>
      )}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <BarraFormula folha={folha} foco={foco} />
        <div className="max-h-[min(70vh,40rem)] overflow-auto">
          <table className="border-separate border-spacing-0 text-xs select-none">
            <tbody>
              {folha.linhas.map((linha, r) => {
                const visiveis = projetarLinha(linha, colunas);
                if (!visiveis.some(item => item.cel.tipo !== "vazio")) return null;
                const temNomes = visiveis.some(item => item.cel.tipo === "texto" && item.cel.papel === "nome");
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
                        handle={canto(sel, folha, r, c, colunas)}
                        selBg={selBg}
                        handleBg={handleBg}
                        ring={ring}
                        cabeca={cabeca}
                        sticky={c === stickyCol}
                        temNomes={temNomes}
                        drafts={drafts.current}
                        mapa={mapa}
                        onDraft={() => setTick(t => t + 1)}
                        formulaAtiva={foco?.r === r && foco?.c === c && (cel.tipo === "valor" || cel.tipo === "texto") && !!cel.formula}
                        leitura={leitura}
                        onPreparar={shift => prepararSelecao(r, c, shift)}
                        onFocar={() => focarEntrada(r, c)}
                        onMouseDown={e => {
                          if ((e.target as HTMLElement).closest("input")) return;
                          if ((cel.tipo === "valor" || cel.tipo === "texto") && cel.formula) {
                            setFoco({ r, c });
                            return;
                          }
                          if (leitura || cel.tipo !== "entrada") return;
                          if ((e.target as HTMLElement).closest("[data-fill-handle]")) return;
                          const next = e.shiftKey && sel ? { ...sel, r1: r, c1: c } : { r0: r, c0: c, r1: r, c1: c };
                          setSel(next);
                          selRef.current = next;
                          ancoraRef.current = { r, c };
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
                          const range = selRef.current ?? { r0: r, c0: c, r1: r, c1: c };
                          selRef.current = range;
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
          {leitura
            ? "Cada bloco abre-se à parte, para a folha caber no ecrã. Na turma, as células com rebordo escrevem-se e as cinzentas calculam a fórmula."
            : "Um bloco de cada vez, com uma coluna por formando. Escreva nas células com rebordo, cole um intervalo copiado do Excel, ou arraste o quadrado do canto para repetir o valor. As cinzentas usam a fórmula da folha: uma célula vazia conta como zero, como no Excel. A avaliação final vai buscar o Módulo 2, o E-learning, o Módulo 9 e o projeto."}
        </p>
      </div>
    </div>
  );
}

function canto(sel: Sel | null, folha: FolhaModelo, r: number, c: number, colunas: number[]) {
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

function BarraFormula({ folha, foco }: { folha: FolhaModelo; foco: { r: number; c: number } | null }) {
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
