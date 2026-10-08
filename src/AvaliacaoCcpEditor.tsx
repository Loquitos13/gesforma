import { useState } from "react";
import { novoParametroId, type ParametroAvaliacao } from "./avaliacaoCurso";
import {
  aplicarLivroCcp,
  ROTULO_MOMENTO_CCP,
  textoFormulaCcp,
  type BlocoCcp,
  type EstruturaCcp,
  type IdInstrumentoCcp,
  type InstrumentoCcp,
  type PrevisaoLivroCcp,
} from "./avaliacaoCcp";
import { ImportarCsvAvaliacao } from "./ImportarCsvAvaliacao";
import { lerLivroExcel } from "./vistaExcel";

const ORDEM_MOMENTOS: IdInstrumentoCcp[] = ["sim-inicial", "elearning", "sim-final", "projeto"];

const AJUDA: Record<string, string> = {
  elearning: "A mesma grelha em cada módulo do programa, excepto o 2 e o 9. O OP2 avalia-se uma vez e entra a meias com a média desses módulos.",
  "sim-inicial": "É a avaliação do módulo 2. A nota do módulo é (1×CP1 + 1×CP2 + 2×CP3) / 4.",
  "sim-final": "É a avaliação do módulo 9, com a mesma regra da simulação inicial.",
  projeto: "Grelha única, fora da lista de módulos. Entra na nota final com o peso indicado.",
};

export function AvaliacaoCcpEditor({
  ccp,
  saveClass,
  inputClass,
  onChange,
}: {
  ccp: EstruturaCcp;
  saveClass: string;
  inputClass: string;
  onChange: (ccp: EstruturaCcp) => void;
}) {
  function patchInstrumento(id: string, partial: Partial<InstrumentoCcp>) {
    onChange({
      instrumentos: ccp.instrumentos.map(i => i.id === id ? { ...i, ...partial } : i),
    });
  }

  function patchBloco(instrumentoId: string, blocoId: string, partial: Partial<BlocoCcp>) {
    onChange({
      instrumentos: ccp.instrumentos.map(i => i.id !== instrumentoId ? i : {
        ...i,
        blocos: i.blocos.map(b => b.id === blocoId ? { ...b, ...partial } : b),
      }),
    });
  }

  const [previsao, setPrevisao] = useState<(PrevisaoLivroCcp & { ficheiro: string }) | null>(null);
  const [erroLivro, setErroLivro] = useState("");
  const [livroAplicado, setLivroAplicado] = useState(false);

  async function lerLivro(file: File) {
    setLivroAplicado(false);
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
      setPrevisao(null);
      setErroLivro("Use o Excel com as cinco folhas. Um CSV só tem uma.");
      return;
    }
    try {
      const folhas = await lerLivroExcel(await file.arrayBuffer());
      if (!folhas.length) {
        setPrevisao(null);
        setErroLivro("O ficheiro não tem células.");
        return;
      }
      setErroLivro("");
      setPrevisao({ ...aplicarLivroCcp(ccp, folhas), ficheiro: file.name });
    } catch {
      setPrevisao(null);
      setErroLivro("Não consegui ler este Excel.");
    }
  }

  function aplicarLivro() {
    if (!previsao?.aplicados.length) return;
    onChange(previsao.ccp);
    setLivroAplicado(true);
  }

  function patchParametro(instrumentoId: string, blocoId: string, parametroId: string, partial: Partial<ParametroAvaliacao>) {
    const instrumento = ccp.instrumentos.find(i => i.id === instrumentoId);
    const bloco = instrumento?.blocos.find(b => b.id === blocoId);
    if (!bloco) return;
    patchBloco(instrumentoId, blocoId, {
      parametros: bloco.parametros.map(p => p.id === parametroId ? { ...p, ...partial } : p),
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <p className="text-sm font-semibold text-slate-800">Avaliação do CCP</p>
        <p className="text-xs text-slate-500 mt-1">
          Não é uma lista única de parâmetros. O e-learning cobre todos os módulos do programa excepto o 2 e o 9. Esses dois são as simulações pedagógicas. O projeto de intervenção avalia-se à parte. A nota final junta os quatro instrumentos: {textoFormulaCcp(ccp)}.
        </p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">Importar todas as folhas</p>
          <p className="text-xs text-slate-500 mt-1">
            Cada folha traz blocos diferentes. Um Excel mete-os todos de uma vez no Módulo 2, no E-learning, no Módulo 9 e no projeto de intervenção. A avaliação final não se importa: na turma, a nota de cada participante nestes quatro momentos atualiza essa folha.
          </p>
        </div>
        <label className="relative inline-flex items-center overflow-clip px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer">
          Escolher Excel
          <input
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            aria-label="Escolher o Excel com todas as folhas"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            onChange={e => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void lerLivro(file);
            }}
          />
        </label>
        {erroLivro && <p className="text-xs text-red-600">{erroLivro}</p>}
        {previsao && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">{previsao.ficheiro}</p>
            {ORDEM_MOMENTOS.map(id => {
              const linhas = previsao.aplicados.filter(item => item.instrumentoId === id);
              return (
                <div key={id}>
                  <p className="text-xs font-semibold text-slate-700">{ROTULO_MOMENTO_CCP[id]}</p>
                  {linhas.length ? (
                    <ul className="mt-1 space-y-0.5">
                      {linhas.map(item => (
                        <li key={item.blocoId} className="text-xs text-slate-600">
                          {item.titulo}: {item.quantidade} {item.quantidade === 1 ? "parâmetro" : "parâmetros"}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-400 mt-1">Nenhum bloco nesta folha.</p>
                  )}
                </div>
              );
            })}
            {previsao.pesos.length > 0 && (
              <p className="text-xs text-slate-600">
                Pesos na avaliação final: {previsao.pesos.map(item => `${ROTULO_MOMENTO_CCP[item.instrumentoId]} ${item.peso}`).join(", ")}.
              </p>
            )}
            {previsao.avisos.map(aviso => (
              <p key={aviso} className="text-xs text-amber-700">{aviso}</p>
            ))}
            {!livroAplicado && (
              <button
                type="button"
                disabled={!previsao.aplicados.length}
                className={`px-3 py-2 text-xs font-semibold rounded-lg text-white disabled:opacity-40 ${saveClass}`}
                onClick={aplicarLivro}
              >
                Aplicar a todos os momentos
              </button>
            )}
            {livroAplicado && (
              <p className="text-xs text-slate-600">
                Os quatro momentos ficaram com estes blocos. Grave a ficha para o curso os guardar. Na turma, edite a nota de cada participante. A avaliação final atualiza-se.
              </p>
            )}
          </div>
        )}
      </div>
      {ccp.instrumentos.map(instrumento => (
        <div key={instrumento.id} className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-800">{ROTULO_MOMENTO_CCP[instrumento.id]}</p>
              <p className="text-[11px] text-slate-400">{instrumento.titulo}</p>
              <p className="text-xs text-slate-500 mt-0.5">{AJUDA[instrumento.id]}</p>
            </div>
            <label className="text-xs text-slate-500">
              Peso na nota final
              <input
                className={`${inputClass} w-24 mt-1`}
                type="number"
                min={0}
                step="1"
                value={instrumento.pesoFinal}
                onChange={e => patchInstrumento(instrumento.id, { pesoFinal: Number(e.target.value) || 0 })}
              />
            </label>
          </div>
          {instrumento.blocos.map(bloco => (
            <div key={bloco.id} className="rounded-lg border border-slate-100 p-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-slate-700">{bloco.titulo}</p>
                  <p className="text-[11px] text-slate-400">
                    {bloco.ambito === "por-modulo" ? "Repete-se em cada módulo de e-learning" : "Uma grelha para a turma"}
                    {bloco.peso !== 1 ? ` · peso ${bloco.peso} dentro deste instrumento` : ""}
                  </p>
                </div>
                <label className="text-[11px] text-slate-500">
                  Peso do bloco
                  <input
                    className={`${inputClass} w-20 mt-1`}
                    type="number"
                    min={0}
                    step="0.1"
                    value={bloco.peso}
                    onChange={e => patchBloco(instrumento.id, bloco.id, { peso: Number(e.target.value) || 0 })}
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={bloco.pesosEquitativos}
                  onChange={e => patchBloco(instrumento.id, bloco.id, { pesosEquitativos: e.target.checked })}
                />
                Pesos iguais neste bloco
              </label>
              <div className="space-y-2 max-h-64 overflow-auto">
                {bloco.parametros.map((param, i) => (
                  <div key={param.id} className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono text-slate-400 w-5">{i + 1}</span>
                    <input
                      className={`${inputClass} min-w-[10rem] flex-1`}
                      value={param.label}
                      onChange={e => patchParametro(instrumento.id, bloco.id, param.id, { label: e.target.value })}
                    />
                    <input
                      className={`${inputClass} w-20`}
                      type="number"
                      min={0}
                      step="0.1"
                      disabled={bloco.pesosEquitativos}
                      value={param.peso}
                      onChange={e => patchParametro(instrumento.id, bloco.id, param.id, { peso: Number(e.target.value) || 0 })}
                    />
                    <button
                      type="button"
                      className="px-2 py-2 text-xs text-slate-400 hover:text-red-500"
                      onClick={() => patchBloco(instrumento.id, bloco.id, {
                        parametros: bloco.parametros.filter(x => x.id !== param.id),
                      })}
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className={`px-3 py-2 text-xs font-semibold rounded-lg text-white ${saveClass}`}
                onClick={() => patchBloco(instrumento.id, bloco.id, {
                  parametros: [...bloco.parametros, { id: novoParametroId(), label: "", peso: 1 }],
                })}
              >
                + Parâmetro
              </button>
              <ImportarCsvAvaliacao
                modo="final"
                unidade="bloco"
                saveClass={saveClass}
                compacto
                onAplicar={parametros => patchBloco(instrumento.id, bloco.id, {
                  parametros: parametros.map(item => ({ ...item, id: novoParametroId() })),
                  pesosEquitativos: parametros.length > 0 && parametros.every(item => item.peso === parametros[0]?.peso),
                })}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
