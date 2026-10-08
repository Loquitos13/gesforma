import { useMemo, useRef, useState } from "react";
import { novoParametroId, type ParametroAvaliacao } from "./avaliacaoCurso";
import {
  blocosDoCsv,
  colunaLetra,
  colunasParticipantes,
  parametrosDoCsv,
  limparGrelha,
  parseCsv,
  refCelula,
  segmentosGrelha,
  type BlocoCsv,
  type Celula,
  type PapelCelula,
  type ParametroCsv,
} from "./csvAvaliacao";

export function ImportarCsvAvaliacao({
  modo,
  unidade,
  saveClass,
  onAplicar,
  compacto = false,
}: {
  modo: "modulos" | "final";
  unidade: string;
  saveClass: string;
  onAplicar: (parametros: ParametroAvaliacao[]) => void;
  compacto?: boolean;
}) {
  const [folhas, setFolhas] = useState<{ nome: string; grid: string[][] }[]>([]);
  const [folhaIdx, setFolhaIdx] = useState(0);
  const [nomeFicheiro, setNomeFicheiro] = useState("");
  const [papel, setPapel] = useState<PapelCelula>("nome");
  const papelRef = useRef<PapelCelula>("nome");
  const [nome, setNome] = useState<Celula | null>(null);
  const [valor, setValor] = useState<Celula | null>(null);
  const [media, setMedia] = useState<Celula | null>(null);
  const [erroFicheiro, setErroFicheiro] = useState("");
  const [aberto, setAberto] = useState(!compacto);
  const mediaLabel = modo === "modulos" ? `Média do ${unidade}` : "Média final";

  const grid = folhas[folhaIdx]?.grid ?? null;
  const participantes = useMemo(() => (grid ? colunasParticipantes(grid) : new Set<number>()), [grid]);
  const blocos = useMemo(() => (grid ? blocosDoCsv(grid) : []), [grid]);
  const segmentos = useMemo(() => (grid ? segmentosGrelha(grid) : []), [grid]);

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
    setPapel("nome");
    papelRef.current = "nome";
  }

  function marcar(celula: Celula) {
    if (participantes.has(celula.c)) return;
    const actual = papelRef.current;
    if (actual === "nome") setNome(celula);
    else if (actual === "valor") setValor(celula);
    else setMedia(celula);
  }

  function estilo(r: number, c: number) {
    if (participantes.has(c)) return "bg-slate-50 text-slate-300 cursor-not-allowed";
    if (nome && nome.r === r && nome.c === c) return "bg-amber-100 ring-2 ring-amber-400";
    if (valor && valor.r === r && valor.c === c) return "bg-emerald-100 ring-2 ring-emerald-400";
    if (media && media.r === r && media.c === c) return "bg-violet-100 ring-2 ring-violet-400";
    return "hover:bg-slate-50";
  }

  function aplicar(lista: ParametroCsv[]) {
    onAplicar(lista.map(p => ({ id: novoParametroId(), label: p.label, peso: p.peso })));
  }

  async function lerFicheiro(file: File) {
    const lower = file.name.toLowerCase();
    try {
      let lista: { nome: string; grid: string[][] }[];
      if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
        const XLSX = await import("xlsx");
        const livro = XLSX.read(await file.arrayBuffer(), { type: "array" });
        lista = livro.SheetNames.map(nome => {
          const bruto = XLSX.utils.sheet_to_json(livro.Sheets[nome]!, {
            header: 1,
            raw: false,
            defval: "",
          }) as unknown[][];
          return {
            nome,
            grid: limparGrelha(bruto.map(linha => (Array.isArray(linha) ? linha : []).map(celula => String(celula ?? "").trim()))),
          };
        }).filter(folha => folha.grid.length);
      } else {
        lista = [{ nome: file.name, grid: parseCsv(await file.text()) }];
      }
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
      setPapel("nome");
      papelRef.current = "nome";
    } catch {
      setFolhas([]);
      setErroFicheiro("Não consegui ler este ficheiro. Use CSV ou Excel (.xlsx).");
    }
  }

  const visiveis = grid ?? [];
  const colunas = visiveis.reduce((m, linha) => Math.max(m, linha.length), 0);
  const gruposParticipantes = segmentos.filter(s => s.tipo === "participantes").length;

  if (compacto && !aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} className="text-xs font-semibold text-slate-600 underline underline-offset-2">
        Importar este bloco de um CSV ou Excel
      </button>
    );
  }

  return (
    <div className={`rounded-xl border border-slate-200 bg-white space-y-4 ${compacto ? "p-3" : "p-4 sm:p-5"}`}>
      <div>
        <p className="text-sm font-semibold text-slate-800">Importar parâmetros de CSV ou Excel</p>
        <p className="text-xs text-slate-500 mt-0.5">
          Aceita CSV e Excel (.xlsx). Num livro com vários separadores, escolha a folha. As colunas de participantes ficam de fora, mesmo quando a grelha vai até BM ou mais. Use um bloco encontrado ou escolha à mão a célula do nome, a do peso e a da {mediaLabel.toLowerCase()}.
        </p>
      </div>
      <label className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer">
        Escolher CSV ou Excel
        <input
          type="file"
          accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          className="sr-only"
          onChange={e => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void lerFicheiro(file);
          }}
        />
      </label>
      {nomeFicheiro && <p className="text-xs text-slate-500">{nomeFicheiro}</p>}
      {erroFicheiro && <p className="text-xs text-red-600">{erroFicheiro}</p>}
      {grid && (
        <>
          {folhas.length > 1 && (
            <div className="flex gap-1 overflow-x-auto">
              {folhas.map((folha, i) => (
                <button
                  key={folha.nome}
                  type="button"
                  onClick={() => escolherFolha(i)}
                  className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border whitespace-nowrap ${
                    i === folhaIdx ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {folha.nome}
                </button>
              ))}
            </div>
          )}
          <p className="text-xs text-slate-500">
            {colunas} colunas, até {colunaLetra(colunas - 1)}.
            {gruposParticipantes > 0
              ? ` ${participantes.size} colunas de participantes em ${gruposParticipantes} ${gruposParticipantes === 1 ? "grupo" : "grupos"}, ignoradas.`
              : " Sem colunas de participantes."}
          </p>
          {blocos.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-800">Blocos nesta folha</p>
              {blocos.map(bloco => (
                <BlocoCard key={bloco.titulo} bloco={bloco} saveClass={saveClass} onAplicar={() => aplicar(bloco.parametros)} />
              ))}
            </div>
          )}
          {blocos.length === 0 && (
            <p className="text-xs text-slate-500">Não encontrei blocos de parâmetros. Escolha as células à mão.</p>
          )}
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
          <div className="max-h-[28rem] overflow-auto rounded-lg border border-slate-200">
            <table className="text-xs border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="sticky top-0 left-0 z-30 bg-slate-100 border-b border-r border-slate-200 px-2 py-1 text-slate-400 font-medium" />
                  {segmentos.map(seg => seg.tipo === "coluna" ? (
                    <th key={`h-${seg.c}`} className="sticky top-0 z-20 bg-slate-100 border-b border-r border-slate-200 px-2 py-1 text-left font-medium text-slate-500 min-w-[5.5rem]">
                      {colunaLetra(seg.c)}
                    </th>
                  ) : (
                    <th key={`h-${seg.de}`} className="sticky top-0 z-20 bg-slate-50 border-b border-r border-slate-200 px-2 py-1 text-left font-medium text-slate-400 min-w-[7rem]">
                      {colunaLetra(seg.de)} a {colunaLetra(seg.ate)}
                      <span className="block font-normal text-[10px]">{seg.quantidade} formandos</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visiveis.map((linha, r) => (
                  <tr key={r}>
                    <th className="sticky left-0 z-10 bg-slate-100 border-b border-r border-slate-200 px-2 py-1 text-slate-400 font-medium">{r + 1}</th>
                    {segmentos.map(seg => seg.tipo === "coluna" ? (
                      <td key={seg.c} className="border-b border-r border-slate-100 p-0">
                        <button
                          type="button"
                          onClick={() => marcar({ r, c: seg.c })}
                          className={`block min-w-[5.5rem] max-w-[14rem] truncate px-2 py-1.5 text-left ${estilo(r, seg.c)}`}
                          title={linha[seg.c] || refCelula({ r, c: seg.c })}
                        >
                          {linha[seg.c] || " "}
                        </button>
                      </td>
                    ) : (
                      <td key={`p-${seg.de}`} className="border-b border-r border-slate-100 bg-slate-50 px-2 py-1.5 text-slate-300" title="Participantes, ignorados" />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {leitura.erro && nome && valor && media && <p className="text-xs text-red-600">{leitura.erro}</p>}
          {leitura.parametros.length > 0 && (
            <ul className="text-xs text-slate-600 space-y-1">
              {leitura.parametros.map(p => (
                <li key={p.label}>{p.label} · peso {p.peso}</li>
              ))}
            </ul>
          )}
          <button
            type="button"
            disabled={!leitura.parametros.length}
            onClick={() => aplicar(leitura.parametros)}
            className={`px-3 py-2 text-xs font-semibold rounded-lg text-white disabled:opacity-40 ${saveClass}`}
          >
            Usar estas células
          </button>
        </>
      )}
    </div>
  );
}

function BlocoCard({
  bloco,
  saveClass,
  onAplicar,
}: {
  bloco: BlocoCsv;
  saveClass: string;
  onAplicar: () => void;
}) {
  const iguais = bloco.parametros.every(p => p.peso === bloco.parametros[0]?.peso);
  return (
    <div className="rounded-lg border border-slate-200 p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800">{bloco.titulo}</p>
        <button type="button" onClick={onAplicar} className={`px-3 py-1.5 text-xs font-semibold rounded-lg text-white ${saveClass}`}>
          Usar este bloco
        </button>
      </div>
      <ul className="text-xs text-slate-600 space-y-1 max-h-36 overflow-auto">
        {bloco.parametros.map(p => (
          <li key={p.label} className="truncate" title={p.label}>
            {p.label}{iguais ? "" : ` · peso ${p.peso}`}
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-slate-400">
        {bloco.parametros.length} {bloco.parametros.length === 1 ? "parâmetro" : "parâmetros"}
        {iguais ? ", peso igual" : ""}. A linha da média não entra.
      </p>
    </div>
  );
}
