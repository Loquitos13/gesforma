// Continuação de FolhaCcpGrelha.tsx (partido para ficar abaixo das 500 linhas).
import { useEffect, useMemo, useRef, useState, type ClipboardEvent } from "react";
import { type FolhaModelo } from "./folhaCcp";
import { celulaEntrada, montarFolhasCcp } from "./folhaCcpFolhas";
import type { EstruturaCcp } from "./avaliacaoCcp";
import type { TopicoPrograma } from "./cursoPrograma";
import { Pessoa, Alteracao, Sel, normSel, inSel, parseNota, notaColada, chave, colunasDaFaixa, faixaTemEntrada, projetarLinha } from "./FolhaCcpView";
import { canto, BarraFormula, CelulaTd } from "./FolhaCcpGrelha";

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
