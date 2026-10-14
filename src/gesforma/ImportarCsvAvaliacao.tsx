// Continuação de ImportarCsvPainel.tsx (partido para ficar abaixo das 500 linhas).
import { useEffect, useMemo, useRef, useState } from "react";
import { novoParametroId, type ParametroAvaliacao } from "./avaliacaoCurso";
import { blocosDoCsv, colunaLetra, colunasParticipantes, parametrosDoCsv, parseCsv, refCelula, type BlocoCsv, type Celula, type PapelCelula, type ParametroCsv } from "./csvAvaliacao";
import { lerLivroExcel, type FolhaImportada } from "./vistaExcel";
import { AvisoImportacao, BarraFormula, GrelhaFolha, BlocoCard } from "./ImportarCsvPainel";

export function ImportarCsvAvaliacao({
  modo,
  unidade,
  saveClass,
  onAplicar,
  onAplicarBlocos,
  onAplicarBloco,
  compacto = false,
}: {
  modo: "modulos" | "final";
  unidade: string;
  saveClass: string;
  onAplicar?: (parametros: ParametroAvaliacao[]) => void;
  /** No CCP, o CSV de uma folha mete os blocos todos dessa folha. */
  onAplicarBlocos?: (blocos: BlocoCsv[]) => AvisoImportacao;
  onAplicarBloco?: (bloco: BlocoCsv) => AvisoImportacao;
  compacto?: boolean;
}) {
  const [folhas, setFolhas] = useState<FolhaImportada[]>([]);
  const [folhaIdx, setFolhaIdx] = useState(0);
  const [nomeFicheiro, setNomeFicheiro] = useState("");
  const [papel, setPapel] = useState<PapelCelula>("nome");
  const papelRef = useRef<PapelCelula>("nome");
  const [nome, setNome] = useState<Celula | null>(null);
  const [valor, setValor] = useState<Celula | null>(null);
  const [media, setMedia] = useState<Celula | null>(null);
  const [foco, setFoco] = useState<Celula | null>(null);
  const [erroFicheiro, setErroFicheiro] = useState("");
  const [aberto, setAberto] = useState(!compacto);
  const [notaFolha, setNotaFolha] = useState<AvisoImportacao | null>(null);
  const [notasBloco, setNotasBloco] = useState<Record<number, AvisoImportacao>>({});
  const grelhaRef = useRef<HTMLDivElement>(null);
  const mediaLabel = modo === "modulos" ? `Média do ${unidade}` : "Média final";

  const folha = folhas[folhaIdx] ?? null;
  const grid = folha?.grid ?? null;
  const participantes = useMemo(() => (grid ? colunasParticipantes(grid) : new Set<number>()), [grid]);
  const blocos = useMemo(() => (grid ? blocosDoCsv(grid) : []), [grid]);

  useEffect(() => {
    const caixa = grelhaRef.current;
    const main = caixa?.closest("main");
    if (!caixa || !main) return;
    const folhaCaixa = caixa.getBoundingClientRect();
    const area = main.getBoundingClientRect();
    if (folhaCaixa.top >= area.top + 8 && folhaCaixa.bottom <= area.bottom - 8) return;
    main.scrollTop += folhaCaixa.top - area.top - 8;
  }, [folhaIdx, nomeFicheiro]);

  const leitura = useMemo(() => {
    if (!grid || !nome || !valor || !media) return { erro: "", parametros: [] as ParametroCsv[] };
    return parametrosDoCsv(grid, nome, valor, media);
  }, [grid, media, nome, valor]);

  function escolher(next: PapelCelula) {
    papelRef.current = next;
    setPapel(next);
  }

  function escolherFolha(i: number) {
    setFolhaIdx(i);
    setNome(null);
    setValor(null);
    setMedia(null);
    setFoco(null);
    setPapel("nome");
    papelRef.current = "nome";
    setNotaFolha(null);
    setNotasBloco({});
  }

  function marcar(celula: Celula) {
    if (participantes.has(celula.c)) return;
    const actual = papelRef.current;
    if (actual === "nome") setNome(celula);
    else if (actual === "valor") setValor(celula);
    else setMedia(celula);
  }

  function aplicar(lista: ParametroCsv[]) {
    onAplicar?.(lista.map(p => ({ id: novoParametroId(), label: p.label, peso: p.peso })));
  }

  function usarFolha() {
    if (!onAplicarBlocos) return;
    setNotaFolha(onAplicarBlocos(blocos));
    setNotasBloco({});
  }

  function usarBloco(bloco: BlocoCsv, indice: number) {
    if (onAplicarBloco) {
      setNotasBloco(prev => ({ ...prev, [indice]: onAplicarBloco(bloco) }));
      return;
    }
    aplicar(bloco.parametros);
    setNotasBloco(prev => ({
      ...prev,
      [indice]: { ok: true, mensagem: `${bloco.parametros.length} ${bloco.parametros.length === 1 ? "parâmetro ficou" : "parâmetros ficaram"} na avaliação, na lista por cima desta folha.` },
    }));
  }

  async function lerFicheiro(file: File) {
    const lower = file.name.toLowerCase();
    try {
      const lista = lower.endsWith(".xlsx") || lower.endsWith(".xls")
        ? await lerLivroExcel(await file.arrayBuffer())
        : [{ nome: file.name, grid: parseCsv(await file.text()), formulas: [], vista: null }];
      if (!lista.length) {
        setFolhas([]);
        setErroFicheiro("O ficheiro não tem células.");
        return;
      }
      setErroFicheiro("");
      setNomeFicheiro(file.name);
      setFolhas(lista);
      setFolhaIdx(0);
      setNome(null);
      setValor(null);
      setMedia(null);
      setFoco(null);
      setPapel("nome");
      papelRef.current = "nome";
      setNotaFolha(null);
      setNotasBloco({});
    } catch {
      setFolhas([]);
      setErroFicheiro("Não consegui ler este ficheiro. Use CSV ou Excel (.xlsx).");
    }
  }

  const visiveis = grid ?? [];
  const colunas = visiveis.reduce((m, linha) => Math.max(m, linha.length), 0);
  const nFormulas = (folha?.formulas ?? []).reduce((n, linha) => n + linha.filter(Boolean).length, 0);
  const formulaFoco = foco ? folha?.formulas[foco.r]?.[foco.c] ?? "" : "";
  const valorFoco = foco ? visiveis[foco.r]?.[foco.c] ?? "" : "";

  if (compacto && !aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} className="text-xs font-semibold text-slate-600 underline underline-offset-2">
        {onAplicarBlocos ? "Importar o CSV ou o Excel desta folha" : "Importar este bloco de um CSV ou Excel"}
      </button>
    );
  }

  return (
    <div className={`min-w-0 max-w-full rounded-xl border border-slate-200 bg-white space-y-4 ${compacto ? "p-3" : "p-4 sm:p-5"}`}>
      <div>
        <p className="text-sm font-semibold text-slate-800">
          {onAplicarBlocos ? "Importar a folha" : "Importar parâmetros de CSV ou Excel"}
        </p>
        <p className="text-xs text-slate-500 mt-0.5">
          {onAplicarBlocos
            ? "Um CSV é uma folha. No Excel, escolha o separador. Entram os blocos todos dessa folha na tabela, não um de cada vez. As colunas de participantes não são parâmetros."
            : `A folha aparece como no ficheiro, com cores, letras e todas as colunas. Cada célula traz a fórmula do Excel: clique para a ler. As colunas de participantes continuam visíveis e não servem de parâmetro. Escolha o nome, o peso e a ${mediaLabel.toLowerCase()} nas restantes, ou use um bloco encontrado.`}
        </p>
      </div>
      <label className="relative inline-flex items-center overflow-clip px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer">
        Escolher CSV ou Excel
        <input
          type="file"
          accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          aria-label="Escolher CSV ou Excel"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          onChange={e => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void lerFicheiro(file);
          }}
        />
      </label>
      {nomeFicheiro && <p className="text-xs text-slate-500">{nomeFicheiro}</p>}
      {erroFicheiro && <p className="text-xs text-red-600">{erroFicheiro}</p>}
      {grid && folha && (
        <>
          {folhas.length > 1 && (
            <div className="flex gap-1 overflow-x-auto">
              {folhas.map((item, i) => (
                <button
                  key={item.nome}
                  type="button"
                  onClick={() => escolherFolha(i)}
                  className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border whitespace-nowrap ${
                    i === folhaIdx ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {item.nome}
                </button>
              ))}
            </div>
          )}
          <p className="text-xs text-slate-500">
            {colunas} colunas, de {colunaLetra(0)} a {colunaLetra(Math.max(0, colunas - 1))}.
            {participantes.size > 0
              ? ` ${participantes.size} colunas de participantes continuam visíveis e não entram como parâmetros.`
              : " Sem colunas de participantes."}
            {nFormulas > 0 ? ` ${nFormulas} ${nFormulas === 1 ? "fórmula" : "fórmulas"}.` : ""}
          </p>
          <BarraFormula celula={foco} formula={formulaFoco} valor={valorFoco} />
          <div ref={grelhaRef}>
            <GrelhaFolha
              grid={visiveis}
              formulas={folha.formulas}
              vista={folha.vista}
              participantes={participantes}
              nome={nome}
              valor={valor}
              media={media}
              onMarcar={celula => {
                setFoco(celula);
                marcar(celula);
              }}
            />
          </div>
          {blocos.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800">Blocos nesta folha</p>
                {onAplicarBlocos && (
                  <button type="button" onClick={usarFolha} className={`px-3 py-1.5 text-xs font-semibold rounded-lg text-white ${saveClass}`}>
                    Usar os blocos desta folha
                  </button>
                )}
              </div>
              {notaFolha && (
                <p className={`text-xs rounded-lg border px-3 py-2 ${notaFolha.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
                  {notaFolha.mensagem}
                </p>
              )}
              {blocos.map((bloco, indice) => (
                <BlocoCard
                  key={`${bloco.titulo}-${indice}`}
                  bloco={bloco}
                  saveClass={saveClass}
                  nota={notasBloco[indice]}
                  onAplicar={() => usarBloco(bloco, indice)}
                />
              ))}
            </div>
          )}
          {blocos.length === 0 && (
            <p className="text-xs text-slate-500">
              {onAplicarBlocos
                ? "Não encontrei blocos de parâmetros nesta folha."
                : "Não encontrei blocos de parâmetros. Escolha as células à mão."}
            </p>
          )}
          {!onAplicarBlocos && <>
          <div className="flex flex-wrap gap-2">
            {([
              ["nome", "Nome do parâmetro", nome ? refCelula(nome) : ""],
              ["valor", "Peso do parâmetro", valor ? refCelula(valor) : ""],
              ["media", mediaLabel, media ? refCelula(media) : ""],
            ] as const).map(([id, label, ref]) => (
              <button
                key={id}
                type="button"
                onClick={() => escolher(id)}
                className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border ${
                  papel === id ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {label}{ref ? ` · ${ref}` : ""}
              </button>
            ))}
          </div>
          {leitura.erro && nome && valor && media && <p className="text-xs text-red-600">{leitura.erro}</p>}
          {leitura.parametros.length > 0 && (
            <ul className="text-xs text-slate-600 space-y-1">
              {leitura.parametros.map(p => (
                <li key={p.label}>{p.label} · peso {p.peso}</li>
              ))}
            </ul>
          )}
          {onAplicar && (
          <button
            type="button"
            disabled={!leitura.parametros.length}
            onClick={() => aplicar(leitura.parametros)}
            className={`px-3 py-2 text-xs font-semibold rounded-lg text-white disabled:opacity-40 ${saveClass}`}
          >
            Usar estas células
          </button>
          )}
          </>}
        </>
      )}
    </div>
  );
}
