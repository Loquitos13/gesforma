// Continuação de ImportarCsvAvaliacao.tsx (partido para ficar abaixo das 500 linhas).
import { useMemo, type CSSProperties } from "react";

import { colunaLetra, refCelula, type BlocoCsv, type Celula } from "./csvAvaliacao";
import { type EstiloCelula, type UniaoCelula, type VistaFolha } from "./vistaExcel";

export type AvisoImportacao = { ok: boolean; mensagem: string };

function marcaDe(r: number, c: number, nome: Celula | null, valor: Celula | null, media: Celula | null) {
  if (nome && nome.r === r && nome.c === c) return "inset 0 0 0 2px #d97706";
  if (valor && valor.r === r && valor.c === c) return "inset 0 0 0 2px #059669";
  if (media && media.r === r && media.c === c) return "inset 0 0 0 2px #7c3aed";
  return undefined;
}

export function BarraFormula({ celula, formula, valor }: { celula: Celula | null; formula: string; valor: string }) {
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

export function GrelhaFolha({
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

export function BlocoCard({
  bloco,
  saveClass,
  nota,
  onAplicar,
}: {
  bloco: BlocoCsv;
  saveClass: string;
  nota?: AvisoImportacao;
  onAplicar: () => void;
}) {
  const iguais = bloco.parametros.every(p => p.peso === bloco.parametros[0]?.peso);
  return (
    <div className="rounded-lg border border-slate-200 p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800">{bloco.titulo}</p>
        <button type="button" onClick={onAplicar} className={`px-3 py-1.5 text-xs font-semibold rounded-lg text-white ${saveClass}`}>
          {nota?.ok ? "Na folha" : "Usar este bloco"}
        </button>
      </div>
      {nota && (
        <p className={`text-xs rounded-lg border px-3 py-2 ${nota.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
          {nota.mensagem}
        </p>
      )}
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
