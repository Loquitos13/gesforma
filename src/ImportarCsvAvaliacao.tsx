import { useMemo, useRef, useState, type CSSProperties } from "react";
import { novoParametroId, type ParametroAvaliacao } from "./avaliacaoCurso";
import {
  blocosDoCsv,
  colunaLetra,
  colunasParticipantes,
  parametrosDoCsv,
  parseCsv,
  refCelula,
  type BlocoCsv,
  type Celula,
  type PapelCelula,
  type ParametroCsv,
} from "./csvAvaliacao";
import { lerLivroExcel, type EstiloCelula, type FolhaImportada, type UniaoCelula, type VistaFolha } from "./vistaExcel";

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
  const mediaLabel = modo === "modulos" ? `Média do ${unidade}` : "Média final";

  const folha = folhas[folhaIdx] ?? null;
  const grid = folha?.grid ?? null;
  const participantes = useMemo(() => (grid ? colunasParticipantes(grid) : new Set<number>()), [grid]);
  const blocos = useMemo(() => (grid ? blocosDoCsv(grid) : []), [grid]);

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
  }

  function marcar(celula: Celula) {
    if (participantes.has(celula.c)) return;
    const actual = papelRef.current;
    if (actual === "nome") setNome(celula);
    else if (actual === "valor") setValor(celula);
    else setMedia(celula);
  }

  function aplicar(lista: ParametroCsv[]) {
    onAplicar(lista.map(p => ({ id: novoParametroId(), label: p.label, peso: p.peso })));
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
        Importar este bloco de um CSV ou Excel
      </button>
    );
  }

  return (
    <div className={`min-w-0 max-w-full rounded-xl border border-slate-200 bg-white space-y-4 ${compacto ? "p-3" : "p-4 sm:p-5"}`}>
      <div>
        <p className="text-sm font-semibold text-slate-800">Importar parâmetros de CSV ou Excel</p>
        <p className="text-xs text-slate-500 mt-0.5">
          A folha aparece como no ficheiro, com cores, letras e todas as colunas. Cada célula traz a fórmula do Excel: clique para a ler. As colunas de participantes continuam visíveis e não servem de parâmetro. Escolha o nome, o peso e a {mediaLabel.toLowerCase()} nas restantes, ou use um bloco encontrado.
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
          <BarraFormula celula={foco} formula={formulaFoco} valor={valorFoco} />
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

function marcaDe(r: number, c: number, nome: Celula | null, valor: Celula | null, media: Celula | null) {
  if (nome && nome.r === r && nome.c === c) return "inset 0 0 0 2px #d97706";
  if (valor && valor.r === r && valor.c === c) return "inset 0 0 0 2px #059669";
  if (media && media.r === r && media.c === c) return "inset 0 0 0 2px #7c3aed";
  return undefined;
}

function BarraFormula({ celula, formula, valor }: { celula: Celula | null; formula: string; valor: string }) {
  const texto = formula ? `=${formula}` : valor;
  return (
    <div data-formula-bar className="flex min-w-0 max-w-full items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
      <span className="shrink-0 rounded bg-white px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-500 border border-slate-200">
        {celula ? refCelula(celula) : "fx"}
      </span>
      <p className="min-w-0 flex-1 break-all font-mono text-[11px] leading-snug text-slate-700">
        {celula ? (texto || "Célula sem fórmula") : "Clique numa célula para ver a fórmula do Excel."}
      </p>
    </div>
  );
}

function GrelhaFolha({
  grid,
  formulas,
  vista,
  participantes,
  nome,
  valor,
  media,
  onMarcar,
}: {
  grid: string[][];
  formulas: string[][];
  vista: VistaFolha | null;
  participantes: Set<number>;
  nome: Celula | null;
  valor: Celula | null;
  media: Celula | null;
  onMarcar: (celula: Celula) => void;
}) {
  const largura = grid.reduce((m, linha) => Math.max(m, linha.length), 0);
  const ocupadas = useMemo(() => mapaUnioes(vista?.unioes ?? []), [vista]);
  const soma = 36 + Array.from({ length: largura }, (_, c) => vista?.larguras[c] ?? 96).reduce((a, b) => a + b, 0);

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain rounded-lg border border-slate-200">
      <table
        data-grelha-importada="1"
        className="border-collapse text-[13px] text-slate-800"
        style={{ width: vista ? soma : undefined, minWidth: vista ? soma : undefined, tableLayout: vista ? "fixed" : "auto" }}
      >
        <colgroup>
          <col style={{ width: 36 }} />
          {Array.from({ length: largura }, (_, c) => (
            <col key={c} style={{ width: vista?.larguras[c] ?? 96 }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className="sticky left-0 z-30 bg-slate-100 border border-slate-200" />
            {Array.from({ length: largura }, (_, c) => (
              <th key={c} className="bg-slate-100 border border-slate-200 px-1 py-1 text-center text-[10px] font-medium text-slate-500">
                {colunaLetra(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.map((linha, r) => (
            <tr key={r} style={{ height: vista?.alturas[r] }}>
              <th className="sticky left-0 z-10 bg-slate-100 border border-slate-200 px-1 text-[10px] font-medium text-slate-400">
                {r + 1}
              </th>
              {Array.from({ length: largura }, (_, c) => {
                if (ocupadas.cobertas.has(`${r}:${c}`)) return null;
                const uniao = ocupadas.origem.get(`${r}:${c}`);
                const estilo = vista?.estilos[r]?.[c] ?? null;
                const texto = linha[c] ?? "";
                const formula = formulas[r]?.[c] ?? "";
                const formando = participantes.has(c);
                const larguraCelula = somaLarguras(vista, c, uniao?.colunas ?? 1);
                const transborda = textoTransborda(texto, estilo, larguraCelula);
                return (
                  <td
                    key={c}
                    colSpan={uniao?.colunas}
                    rowSpan={uniao?.linhas}
                    data-celula={refCelula({ r, c })}
                    data-formula={formula}
                    data-bg={estilo?.bg ?? ""}
                    className="border border-slate-300 p-0 align-middle"
                    style={estiloCelula(estilo, marcaDe(r, c, nome, valor, media), transborda)}
                  >
                    <button
                      type="button"
                      title={formula ? `=${formula}` : (formando ? "Coluna de participantes" : texto || refCelula({ r, c }))}
                      onClick={() => onMarcar({ r, c })}
                      className={`relative block w-full bg-transparent border-0 p-1 font-inherit text-inherit ${
                        formando ? "cursor-default" : "cursor-pointer"
                      } ${estilo?.rotacao === 90 ? "[writing-mode:vertical-rl] rotate-180" : ""} ${
                        estilo?.rotacao === 255 ? "[writing-mode:vertical-rl] [text-orientation:upright]" : ""
                      }`}
                      style={{
                        textAlign: "inherit",
                        whiteSpace: estilo?.quebra ? "normal" : "nowrap",
                        overflowWrap: estilo?.quebra ? "break-word" : "normal",
                        lineHeight: 1.15,
                      }}
                    >
                      {formula && (
                        <span className="pointer-events-none absolute top-0 right-0 border-t-[6px] border-r-[6px] border-t-transparent border-r-emerald-600" aria-hidden />
                      )}
                      {transborda ? <span className="absolute left-1 top-1/2 -translate-y-1/2 whitespace-nowrap">{texto}</span> : null}
                      {transborda ? "\u00a0" : (texto || (formula.length > 0 && formula.length <= 28 ? `=${formula}` : "\u00a0"))}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {vista && soma > 720 && (
        <p className="sticky left-0 px-2 py-1 text-[11px] text-slate-400">Deslize a folha para o lado. A ficha fica no sítio.</p>
      )}
    </div>
  );
}

function estiloCelula(estilo: EstiloCelula | null, marca?: string, transborda = false): CSSProperties {
  return {
    backgroundColor: estilo?.bg,
    color: estilo?.cor,
    fontWeight: estilo?.negrito ? 700 : undefined,
    fontSize: estilo?.tamanho ? `${estilo.tamanho}px` : undefined,
    fontFamily: estilo?.fonte ? `"${estilo.fonte}", Arial, sans-serif` : undefined,
    textAlign: estilo?.alinhamento,
    verticalAlign: estilo?.vertical === "middle" ? "middle" : estilo?.vertical,
    boxShadow: marca,
    overflow: "visible",
    position: transborda ? "relative" : undefined,
    zIndex: transborda ? 1 : undefined,
  };
}

function somaLarguras(vista: VistaFolha | null, c: number, n: number) {
  let soma = 0;
  for (let i = 0; i < n; i++) soma += vista?.larguras[c + i] ?? 96;
  return soma;
}

function textoTransborda(texto: string, estilo: EstiloCelula | null, largura: number) {
  if (!texto || estilo?.quebra || estilo?.rotacao) return false;
  const tamanho = estilo?.tamanho ?? 13;
  return texto.length * tamanho * 0.52 > largura + 8;
}

function mapaUnioes(unioes: UniaoCelula[]) {
  const cobertas = new Set<string>();
  const origem = new Map<string, UniaoCelula>();
  for (const uniao of unioes) {
    if (uniao.linhas < 2 && uniao.colunas < 2) continue;
    origem.set(`${uniao.r}:${uniao.c}`, uniao);
    for (let r = uniao.r; r < uniao.r + uniao.linhas; r++) {
      for (let c = uniao.c; c < uniao.c + uniao.colunas; c++) {
        if (r !== uniao.r || c !== uniao.c) cobertas.add(`${r}:${c}`);
      }
    }
  }
  return { cobertas, origem };
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
      <ul className="text-xs text-slate-600 space-y-1">
        {bloco.parametros.map(p => (
          <li key={p.label}>
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
