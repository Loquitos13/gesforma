import { useMemo, useState } from "react";
import type { DiaDisponibilidade, HorarioDia } from "./formadorModel";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function hoje() {
  const n = new Date();
  return iso(n.getFullYear(), n.getMonth(), n.getDate());
}

function celulas(ano: number, mes: number) {
  const primeiro = new Date(ano, mes, 1);
  const offset = (primeiro.getDay() + 6) % 7;
  const dias = new Date(ano, mes + 1, 0).getDate();
  const cells: Array<{ data: string; dia: number } | null> = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= dias; d++) cells.push({ data: iso(ano, mes, d), dia: d });
  while (cells.length % 7) cells.push(null);
  return cells;
}

export function FormadorCalendario({
  dias,
  onChange,
  disabled,
}: {
  dias: DiaDisponibilidade[];
  onChange: (next: DiaDisponibilidade[]) => void;
  disabled?: boolean;
}) {
  const agora = new Date();
  const [cursor, setCursor] = useState({ ano: agora.getFullYear(), mes: agora.getMonth() });
  const [sel, setSel] = useState(hoje());
  const porData = useMemo(() => new Map(dias.map(d => [d.data, d])), [dias]);
  const grelha = celulas(cursor.ano, cursor.mes);
  const dia = porData.get(sel);

  function guardar(next: DiaDisponibilidade | null) {
    if (disabled) return;
    const resto = dias.filter(d => d.data !== sel);
    onChange(next ? [...resto, next].sort((a, b) => a.data.localeCompare(b.data)) : resto);
  }

  function setEstado(estado: "disponivel" | "indisponivel") {
    const base = dia ?? { data: sel, estado, horarios: estado === "disponivel" ? [{ inicio: "09:00", fim: "13:00" }] : [] };
    guardar({
      ...base,
      estado,
      horarios: estado === "indisponivel" ? [] : (base.horarios.length ? base.horarios : [{ inicio: "09:00", fim: "13:00" }]),
    });
  }

  function setHorarios(horarios: HorarioDia[]) {
    guardar({ data: sel, estado: "disponivel", horarios });
  }

  return (
    <div className="contents">
      <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Calendário</p>
      <div className="flex items-center justify-between gap-2 mb-3">
        <button type="button" onClick={() => setCursor(c => c.mes === 0 ? { ano: c.ano - 1, mes: 11 } : { ...c, mes: c.mes - 1 })} className="px-2.5 py-1.5 text-sm rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" aria-label="Mês anterior">‹</button>
        <p className="text-sm font-bold text-slate-800">{MESES[cursor.mes]} {cursor.ano}</p>
        <button type="button" onClick={() => setCursor(c => c.mes === 11 ? { ano: c.ano + 1, mes: 0 } : { ...c, mes: c.mes + 1 })} className="px-2.5 py-1.5 text-sm rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" aria-label="Mês seguinte">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {DIAS.map(d => <p key={d} className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 py-1">{d}</p>)}
        {grelha.map((cell, i) => {
          if (!cell) return <div key={`v-${i}`} />;
          const marca = porData.get(cell.data);
          const on = cell.data === sel;
          const tom = marca?.estado === "disponivel"
            ? "bg-emerald-50 border-emerald-200 text-emerald-900"
            : marca?.estado === "indisponivel"
              ? "bg-rose-50 border-rose-200 text-rose-800"
              : "bg-white border-slate-200 text-slate-700";
          return (
            <button
              key={cell.data}
              type="button"
              onClick={() => setSel(cell.data)}
              className={`min-h-[52px] rounded-lg border px-1 py-1 text-left ${tom} ${on ? "ring-2 ring-amber-400" : "hover:border-slate-300"} ${cell.data === hoje() ? "font-bold" : ""}`}
            >
              <span className="block text-[11px] leading-none">{cell.dia}</span>
              {marca?.estado === "disponivel" && (
                <span className="mt-1 block text-[9px] leading-tight text-emerald-700">
                  {marca.horarios.length ? marca.horarios.map(h => `${h.inicio}`).join(" ") : "livre"}
                </span>
              )}
              {marca?.estado === "indisponivel" && <span className="mt-1 block text-[9px] text-rose-600">não</span>}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-slate-400">Verde é dia disponível, com o início de cada horário. Rosa é dia indisponível. O dia sem cor ainda não foi marcado.</p>
      </div>

      <div className="rounded-xl border border-slate-200 p-3 space-y-3">
        <p className="text-xs font-semibold text-slate-700">{sel.split("-").reverse().join("/")}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={disabled} onClick={() => setEstado("disponivel")} className={`px-3 py-1.5 text-xs font-semibold rounded-full border disabled:opacity-50 ${dia?.estado === "disponivel" ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200"}`}>Disponível</button>
          <button type="button" disabled={disabled} onClick={() => setEstado("indisponivel")} className={`px-3 py-1.5 text-xs font-semibold rounded-full border disabled:opacity-50 ${dia?.estado === "indisponivel" ? "bg-rose-600 text-white border-rose-600" : "bg-white text-slate-600 border-slate-200"}`}>Indisponível</button>
          <button type="button" disabled={disabled || !dia} onClick={() => guardar(null)} className="px-3 py-1.5 text-xs font-semibold rounded-full border border-slate-200 text-slate-500 disabled:opacity-50">Limpar</button>
        </div>
        {dia?.estado === "disponivel" && (
          <div className="space-y-2">
            {dia.horarios.map((h, i) => (
              <div key={`${h.inicio}-${i}`} className="flex items-center gap-2">
                <input type="time" disabled={disabled} value={h.inicio} onChange={e => setHorarios(dia.horarios.map((x, n) => n === i ? { ...x, inicio: e.target.value } : x))} className="px-2 py-1 text-xs border border-slate-200 rounded-lg" />
                <span className="text-xs text-slate-400">às</span>
                <input type="time" disabled={disabled} value={h.fim} onChange={e => setHorarios(dia.horarios.map((x, n) => n === i ? { ...x, fim: e.target.value } : x))} className="px-2 py-1 text-xs border border-slate-200 rounded-lg" />
                <button type="button" disabled={disabled} onClick={() => setHorarios(dia.horarios.filter((_, n) => n !== i))} className="text-xs text-slate-400 hover:text-red-600">tirar</button>
              </div>
            ))}
            <button type="button" disabled={disabled || dia.horarios.length >= 4} onClick={() => setHorarios([...dia.horarios, { inicio: "16:30", fim: "20:30" }])} className="text-xs font-semibold text-amber-700 disabled:opacity-40">+ Horário</button>
          </div>
        )}
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Quem preenche o calendário fica em aberto: a secretaria, o próprio formador com acesso, ou um calendário partilhado (por exemplo o Google Calendar). Por agora marca-se aqui, na ficha.
        </p>
      </div>
    </div>
  );
}
