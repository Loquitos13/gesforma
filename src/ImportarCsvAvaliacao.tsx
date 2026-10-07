import { useMemo, useRef, useState } from "react";
import { novoParametroId, type ParametroAvaliacao } from "./avaliacaoCurso";
import { parametrosDoCsv, parseCsv, refCelula, type Celula, type PapelCelula } from "./csvAvaliacao";

export function ImportarCsvAvaliacao({
  modo,
  unidade,
  saveClass,
  onAplicar,
}: {
  modo: "modulos" | "final";
  unidade: string;
  saveClass: string;
  onAplicar: (parametros: ParametroAvaliacao[]) => void;
}) {
  const [grid, setGrid] = useState<string[][] | null>(null);
  const [nomeFicheiro, setNomeFicheiro] = useState("");
  const [papel, setPapel] = useState<PapelCelula>("nome");
  const papelRef = useRef<PapelCelula>("nome");
  const [nome, setNome] = useState<Celula | null>(null);
  const [valor, setValor] = useState<Celula | null>(null);
  const [media, setMedia] = useState<Celula | null>(null);
  const [erroFicheiro, setErroFicheiro] = useState("");
  const mediaLabel = modo === "modulos" ? `Média do ${unidade}` : "Média final";

  const leitura = useMemo(() => {
    if (!grid || !nome || !valor || !media) return { erro: "", parametros: [] as { label: string; peso: number }[] };
    return parametrosDoCsv(grid, nome, valor, media);
  }, [grid, media, nome, valor]);

  function escolher(next: PapelCelula) {
    papelRef.current = next;
    setPapel(next);
  }

  function marcar(celula: Celula) {
    const actual = papelRef.current;
    if (actual === "nome") setNome(celula);
    else if (actual === "valor") setValor(celula);
    else setMedia(celula);
  }

  function estilo(r: number, c: number) {
    if (nome && nome.r === r && nome.c === c) return "bg-amber-100 ring-2 ring-amber-400";
    if (valor && valor.r === r && valor.c === c) return "bg-emerald-100 ring-2 ring-emerald-400";
    if (media && media.r === r && media.c === c) return "bg-violet-100 ring-2 ring-violet-400";
    return "hover:bg-slate-50";
  }

  async function lerFicheiro(file: File) {
    const text = await file.text();
    const linhas = parseCsv(text);
    if (!linhas.length) {
      setGrid(null);
      setErroFicheiro("O ficheiro não tem células.");
      return;
    }
    setErroFicheiro("");
    setNomeFicheiro(file.name);
    setGrid(linhas);
    setNome(null);
    setValor(null);
    setMedia(null);
    setPapel("nome");
  }

  const visiveis = grid?.slice(0, 12) ?? [];
  const colunas = visiveis.reduce((m, linha) => Math.max(m, linha.length), 0);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
      <div>
        <p className="text-sm font-semibold text-slate-800">Importar parâmetros de um CSV</p>
        <p className="text-xs text-slate-500 mt-0.5">
          Escolha a primeira célula com o nome do parâmetro, a célula do valor desse parâmetro e a célula da {mediaLabel.toLowerCase()}. As células seguintes, na mesma linha ou na mesma coluna, entram como parâmetros. A média não entra na lista.
        </p>
      </div>
      <label className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer">
        Escolher CSV
        <input
          type="file"
          accept=".csv,text/csv"
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
          <div className="flex flex-wrap gap-2">
            {([
              ["nome", "Nome do parâmetro", nome ? refCelula(nome) : ""],
              ["valor", "Valor do parâmetro", valor ? refCelula(valor) : ""],
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
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="text-xs">
              <tbody>
                {visiveis.map((linha, r) => (
                  <tr key={r}>
                    {Array.from({ length: colunas }, (_, c) => (
                      <td key={c} className="border-b border-r border-slate-100 p-0">
                        <button
                          type="button"
                          onClick={() => marcar({ r, c })}
                          className={`block min-w-[5.5rem] max-w-[14rem] truncate px-2 py-1.5 text-left ${estilo(r, c)}`}
                          title={linha[c] || refCelula({ r, c })}
                        >
                          {linha[c] || " "}
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {grid.length > visiveis.length && (
            <p className="text-[11px] text-slate-400">A grelha mostra as primeiras {visiveis.length} linhas. A leitura usa o ficheiro todo.</p>
          )}
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
            onClick={() => onAplicar(leitura.parametros.map(p => ({ id: novoParametroId(), label: p.label, peso: p.peso })))}
            className={`px-3 py-2 text-xs font-semibold rounded-lg text-white disabled:opacity-40 ${saveClass}`}
          >
            Usar estes parâmetros
          </button>
        </>
      )}
    </div>
  );
}
