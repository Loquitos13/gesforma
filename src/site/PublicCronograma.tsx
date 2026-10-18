import { useEffect, useMemo, useState } from "react";
import { apiPublicCronograma, type CronogramaPublico, type Regime } from "../partilhado/api";
import { imprimirCronogramaEna } from "../partilhado/cronogramaPrint";
import { FolhaAjustada, folhaDe } from "./CronogramaFolha";

/** O cronograma público é a mesma folha do Imprimir / PDF da turma. */
export function PublicCronograma({ regime, turmaId }: { regime: Regime; turmaId: number }) {
  const [dados, setDados] = useState<CronogramaPublico | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let vivo = true;
    apiPublicCronograma(regime, turmaId)
      .then(r => { if (vivo) setDados(r); })
      .catch(() => { if (vivo) setErro("Este cronograma ainda não está publicado."); });
    return () => { vivo = false; };
  }, [regime, turmaId]);

  const folha = useMemo(() => dados && folhaDe({
    nome: dados.nome, local: dados.local, horario: dados.horario, dataInicio: dados.inicio,
    plano: dados.sessoes.map((s, i) => ({ id: `s${i}`, ...s })),
  }, dados.curso, dados.entidade), [dados]);
  useEffect(() => { if (dados) document.title = `Cronograma · ${dados.nome || dados.curso}`; }, [dados]);

  return (
    <div className="flex min-h-screen flex-col bg-[#f4f1ea]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7e1d6] bg-white px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h1 className="text-base font-semibold text-slate-900">Cronograma{dados ? ` · ${dados.curso}` : ""}</h1>
          {dados && <p className="mt-0.5 text-xs text-slate-500">{[dados.local, dados.horario].filter(Boolean).join(" · ")}</p>}
        </div>
        {folha && (
          <button type="button" onClick={() => imprimirCronogramaEna({ ...folha.input, embutido: false })}
            className="rounded-lg bg-[#1b2330] px-4 py-2 text-xs font-semibold text-white">
            Imprimir / PDF
          </button>
        )}
      </div>
      {erro && <p className="p-6 text-sm text-slate-600">{erro}</p>}
      {!erro && !dados && <p className="p-6 text-sm text-slate-400">A ler o cronograma…</p>}
      {dados && <FolhaAjustada folha={folha} titulo={`Cronograma ${dados.nome}`} className="flex-1" />}
    </div>
  );
}
