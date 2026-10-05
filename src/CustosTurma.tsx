import { useEffect, useMemo, useState } from "react";
import { horasDoFormador, type TurmaGold } from "./turmaModel";
import { useFormadores } from "./FormadoresContext";

function eur(v: number) {
  return `€ ${v.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function CustosTurmaCard({
  turma,
  canEdit,
  onSala,
}: {
  turma: TurmaGold;
  canEdit: boolean;
  onSala: (valor: number) => void;
}) {
  const { formadores } = useFormadores();
  const [sala, setSala] = useState(String(turma.custoHoraSala ?? 0));
  useEffect(() => { setSala(String(turma.custoHoraSala ?? 0)); }, [turma.custoHoraSala, turma.id]);
  const linhas = useMemo(() => {
    const nomes = new Set<string>();
    if (turma.formador.trim()) nomes.add(turma.formador.trim());
    for (const n of turma.formadores ?? []) if (n.trim()) nomes.add(n.trim());
    for (const s of turma.cronograma) for (const n of s.formadores ?? []) if (n.trim()) nomes.add(n.trim());
    return [...nomes].map(nome => {
      const horas = horasDoFormador(turma.cronograma, nome);
      const custoHora = formadores.find(f => f.nome.toLowerCase() === nome.toLowerCase())?.custoHora ?? 0;
      return { nome, horas, custoHora, total: Math.round(horas * custoHora * 100) / 100 };
    });
  }, [formadores, turma]);
  const formadoresTotal = linhas.reduce((s, l) => s + l.total, 0);
  const custoSala = Number(sala) || 0;
  const salaTotal = Math.round((turma.horas || 0) * custoSala * 100) / 100;
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Custos da turma</p>
      <p className="text-[11px] text-slate-500 mb-3">Horas de cada formador no cronograma, mais as horas da sala alugada.</p>
      <div className="space-y-1.5">
        {linhas.length === 0 && <p className="text-xs text-slate-400">Ainda sem formador nesta turma.</p>}
        {linhas.map(l => (
          <div key={l.nome} className="flex items-center justify-between gap-2 text-xs">
            <span className="text-slate-700 truncate">{l.nome}</span>
            <span className="text-slate-500 shrink-0">{l.horas} h × {eur(l.custoHora)} = <span className="font-semibold text-slate-800">{eur(l.total)}</span></span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-slate-100 pt-3">
        <label className="text-[11px] font-semibold uppercase text-slate-500">
          Custo hora da sala (€)
          <input
            type="number"
            min={0}
            step="0.5"
            disabled={!canEdit}
            value={sala}
            onChange={e => setSala(e.target.value)}
            onBlur={() => onSala(Math.max(0, Number(sala) || 0))}
            className="mt-1 block w-28 px-2 py-1.5 text-sm border border-slate-200 rounded-lg disabled:bg-slate-50"
          />
        </label>
        <div className="text-right text-xs text-slate-500">
          <p>Sala · {turma.horas || 0} h = <span className="font-semibold text-slate-800">{eur(salaTotal)}</span></p>
          <p className="mt-1 text-sm font-bold text-slate-800">Total {eur(Math.round((formadoresTotal + salaTotal) * 100) / 100)}</p>
        </div>
      </div>
    </div>
  );
}
