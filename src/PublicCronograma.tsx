import { useEffect, useState } from "react";
import { apiPublicCronograma, type CronogramaPublico, type Regime } from "./api";

const MODALIDADE: Record<string, string> = {
  presencial: "Presencial",
  sincrona: "Síncrona",
  auto: "Auto-aprendizagem",
  avaliacao: "Avaliação",
  matricula: "Matrícula",
};

function dataPt(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

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

  const meta = dados
    ? [dados.curso, dados.local, dados.horario, dados.inicio ? `início ${dataPt(dados.inicio)}` : "", dados.formador].filter(Boolean).join(" · ")
    : "";

  return (
    <div className="min-h-screen bg-white px-4 py-10 sm:px-8">
      <div className="mx-auto w-full max-w-4xl">
        <img
          src="/imagens/ena-logo-nobg.png"
          alt="ENA"
          className="h-10 w-auto mb-10"
          onError={e => { (e.currentTarget as HTMLImageElement).src = "/imagens/ena_logo.svg"; }}
        />
        {erro && <p className="text-sm text-slate-600">{erro}</p>}
        {!erro && !dados && <p className="text-sm text-slate-400">A ler o cronograma…</p>}
        {dados && (
          <>
            <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#ffa900]">Cronograma</p>
            <h1 className="mt-3 text-2xl font-semibold text-slate-900">{dados.nome || dados.curso}</h1>
            {meta && <p className="mt-2 text-sm text-slate-500">{meta}</p>}
            <div className="mt-8 overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="border-b border-slate-200 py-2 pr-3 font-semibold">Data</th>
                    <th className="border-b border-slate-200 py-2 pr-3 font-semibold">Horas</th>
                    <th className="border-b border-slate-200 py-2 pr-3 font-semibold">Modalidade</th>
                    <th className="border-b border-slate-200 py-2 pr-3 font-semibold">Módulo</th>
                    <th className="border-b border-slate-200 py-2 font-semibold">Formador</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.sessoes.map((s, i) => (
                    <tr key={`${s.data}-${s.horaInicio}-${i}`} className="align-top">
                      <td className="border-b border-slate-100 py-2.5 pr-3 text-slate-800">{s.data ? dataPt(s.data) : "—"}</td>
                      <td className="border-b border-slate-100 py-2.5 pr-3 whitespace-nowrap">{s.horaInicio && s.horaFim ? `${s.horaInicio}–${s.horaFim}` : "—"}</td>
                      <td className="border-b border-slate-100 py-2.5 pr-3">{MODALIDADE[s.modalidade] ?? (s.modalidade || "—")}</td>
                      <td className="border-b border-slate-100 py-2.5 pr-3">{s.modulos.join(", ") || "—"}</td>
                      <td className="border-b border-slate-100 py-2.5">{s.formadores.join(", ") || dados.formador || "—"}</td>
                    </tr>
                  ))}
                  {dados.sessoes.length === 0 && (
                    <tr><td colSpan={5} className="py-6 text-slate-400">Ainda sem sessões neste cronograma.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
