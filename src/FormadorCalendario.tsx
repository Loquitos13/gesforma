import { useMemo, useState } from "react";
import type { SessaoCronograma } from "./turmaModel";
import { sessaoFormadores } from "./turmaModel";

type Evento = { id: string; data: string; titulo: string; hora: string; turma: string };

function isoMonth(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function eventosDoFormador(
  nome: string,
  turmas: { nome: string; cronograma: SessaoCronograma[] }[],
): Evento[] {
  const alvo = nome.trim().toLowerCase();
  const out: Evento[] = [];
  for (const t of turmas) {
    for (const s of t.cronograma) {
      if (!s.data) continue;
      if (!sessaoFormadores(s).some(f => f.toLowerCase() === alvo)) continue;
      out.push({
        id: s.id,
        data: s.data,
        titulo: t.nome,
        hora: [s.horaInicio, s.horaFim].filter(Boolean).join("–"),
        turma: t.nome,
      });
    }
  }
  return out.sort((a, b) => a.data.localeCompare(b.data) || a.hora.localeCompare(b.hora));
}

export function FormadorCalendario({ nome, eventos }: { nome: string; eventos: Evento[] }) {
  const [cursor, setCursor] = useState(() => new Date());
  const mes = isoMonth(cursor);
  const doMes = useMemo(() => eventos.filter(e => e.data.startsWith(mes)), [eventos, mes]);
  const primeiro = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const inicio = (primeiro.getDay() + 6) % 7;
  const dias = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells = [...Array(inicio).fill(null), ...Array.from({ length: dias }, (_, i) => i + 1)];
  const rotulo = primeiro.toLocaleDateString("pt-PT", { month: "long", year: "numeric" });

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Calendário de {nome}</p>
        <div className="flex items-center gap-1">
          <button type="button" className="px-2 py-1 text-xs rounded border border-slate-200" onClick={() => setCursor(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>‹</button>
          <span className="text-xs font-semibold text-slate-700 capitalize min-w-[8rem] text-center">{rotulo}</span>
          <button type="button" className="px-2 py-1 text-xs rounded border border-slate-200" onClick={() => setCursor(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>›</button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-[10px] font-semibold text-slate-400 mb-1">
        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map(d => <span key={d} className="text-center">{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((dia, i) => {
          if (!dia) return <div key={`e-${i}`} />;
          const chave = `${mes}-${String(dia).padStart(2, "0")}`;
          const ev = doMes.filter(e => e.data === chave);
          return (
            <div key={chave} className={`min-h-[52px] rounded-lg border px-1 py-1 ${ev.length ? "border-violet-200 bg-violet-50" : "border-slate-100"}`}>
              <p className="text-[10px] font-semibold text-slate-500">{dia}</p>
              {ev.slice(0, 2).map(e => (
                <p key={e.id} className="text-[9px] leading-tight text-violet-800 truncate" title={`${e.hora} ${e.titulo}`}>{e.hora}</p>
              ))}
            </div>
          );
        })}
      </div>
      {doMes.length === 0 && (
        <p className="text-xs text-slate-400 mt-2">Sem sessões neste mês. O calendário mantém-se para consultar os outros meses.</p>
      )}
    </div>
  );
}
