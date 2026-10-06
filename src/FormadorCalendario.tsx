import { useMemo, useState } from "react";
import { SLOTS_CCP, type SlotId } from "./disponibilidade";
import type { SessaoCronograma } from "./turmaModel";
import { sessaoFormadores } from "./turmaModel";

type Evento = { id: string; data: string; titulo: string; hora: string; turma: string };

function isoMonth(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function hojeIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
        hora: [s.horaInicio, s.horaFim].filter(Boolean).join(" a "),
        turma: t.nome,
      });
    }
  }
  return out.sort((a, b) => a.data.localeCompare(b.data) || a.hora.localeCompare(b.hora));
}

function diaDisponivel(iso: string, slots: string[] | undefined) {
  if (!slots) return false;
  const dia = new Date(`${iso}T12:00:00`).getDay();
  return SLOTS_CCP.some(slot => {
    if (!slots.includes(slot.id)) return false;
    if (slot.id.startsWith("sabado")) return dia === 6;
    return dia >= 1 && dia <= 5;
  });
}

export function FormadorCalendario({
  nome, eventos, slots,
}: {
  nome: string;
  eventos: Evento[];
  slots?: string[];
}) {
  const [cursor, setCursor] = useState(() => new Date());
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const mes = isoMonth(cursor);
  const hoje = hojeIso();
  const doMes = useMemo(() => eventos.filter(e => e.data.startsWith(mes)), [eventos, mes]);
  const primeiro = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const inicio = (primeiro.getDay() + 6) % 7;
  const dias = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells = [...Array(inicio).fill(null), ...Array.from({ length: dias }, (_, i) => i + 1)];
  const rotulo = primeiro.toLocaleDateString("pt-PT", { month: "long", year: "numeric" });
  const diaAberto = escolhido && escolhido.startsWith(mes) ? escolhido : null;
  const doDia = diaAberto ? doMes.filter(e => e.data === diaAberto) : [];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Calendário de {nome}</p>
          <p className="text-[11px] text-slate-400">{doMes.length} {doMes.length === 1 ? "sessão" : "sessões"} neste mês</p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" className="px-2 py-1 text-xs rounded border border-slate-200" onClick={() => setCursor(new Date())}>Hoje</button>
          <button type="button" className="px-2 py-1 text-xs rounded border border-slate-200" onClick={() => setCursor(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>‹</button>
          <span className="text-xs font-semibold text-slate-700 capitalize min-w-[8rem] text-center">{rotulo}</span>
          <button type="button" className="px-2 py-1 text-xs rounded border border-slate-200" onClick={() => setCursor(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>›</button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-[10px] font-semibold text-slate-400">
        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map(d => <span key={d} className="text-center">{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((dia, i) => {
          if (!dia) return <div key={`e-${i}`} />;
          const chave = `${mes}-${String(dia).padStart(2, "0")}`;
          const ev = doMes.filter(e => e.data === chave);
          const eHoje = chave === hoje;
          const livre = diaDisponivel(chave, slots);
          const aberto = chave === diaAberto;
          return (
            <button
              key={chave}
              type="button"
              onClick={() => setEscolhido(chave)}
              className={`min-h-[64px] rounded-lg border px-1 py-1 text-left ${
                aberto ? "border-violet-500 ring-2 ring-violet-200" : ev.length ? "border-violet-200 bg-violet-50" : livre ? "border-emerald-100 bg-emerald-50/60" : "border-slate-100"
              }`}
            >
              <p className={`text-[10px] font-semibold ${eHoje ? "text-amber-700" : "text-slate-500"}`}>{dia}{eHoje ? " · hoje" : ""}</p>
              {ev.slice(0, 2).map(e => (
                <p key={e.id} className="text-[9px] leading-tight text-violet-800 truncate" title={`${e.hora} ${e.titulo}`}>{e.titulo}</p>
              ))}
              {ev.length > 2 && <p className="text-[9px] text-violet-500">+{ev.length - 2}</p>}
            </button>
          );
        })}
      </div>
      {slots && (
        <p className="text-[11px] text-slate-400">Os dias a verde são janelas da disponibilidade. As sessões marcadas ficam a violeta.</p>
      )}
      {diaAberto && (
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-2 space-y-1">
          <p className="text-xs font-semibold text-slate-600">{diaAberto.split("-").reverse().join("/")}</p>
          {doDia.length === 0 && <p className="text-xs text-slate-400">Sem sessão neste dia.</p>}
          {doDia.map(e => (
            <p key={e.id} className="text-xs text-slate-700">{e.hora ? `${e.hora}: ` : ""}{e.titulo}</p>
          ))}
        </div>
      )}
      {doMes.length === 0 && (
        <p className="text-xs text-slate-400">Sem sessões neste mês. Avance para ver os meses seguintes.</p>
      )}
    </div>
  );
}
