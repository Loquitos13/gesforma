import { useEffect, useMemo, useState } from "react";
import { SLOTS_CCP } from "./disponibilidade";
import { horariosSobrepoem, minutoSeguinte } from "./sessaoAcesso";
import type { SessaoCronograma } from "./turmaModel";
import { formatDiaMes, horaAgora, hojeIso, sessaoFormadores } from "./turmaModel";

type Evento = { id: string; data: string; titulo: string; hora: string; inicio: string; fim: string; turma: string };

function isoMonth(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function dataDeIso(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y || 2026, (m || 1) - 1, d || 1);
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
        id: `${t.nome}:${s.id}`,
        data: s.data,
        titulo: t.nome,
        inicio: s.horaInicio,
        fim: s.horaFim,
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

function cruza(a: Evento, b: Evento) {
  return a.id !== b.id && horariosSobrepoem(a.inicio, a.fim, b.inicio, b.fim);
}

function aDecorrer(evento: Evento, dia: string, hora: string) {
  return evento.data === dia && horariosSobrepoem(evento.inicio, evento.fim, hora, minutoSeguinte(hora));
}

export function FormadorCalendario({
  nome, eventos, slots,
}: {
  nome: string;
  eventos: Evento[];
  slots?: string[];
}) {
  const [agora, setAgora] = useState(() => new Date());
  const hoje = hojeIso(agora);
  const hora = horaAgora(agora);
  const [cursor, setCursor] = useState(() => dataDeIso(hojeIso()));
  const [escolhido, setEscolhido] = useState<string | null>(hoje);
  const mes = isoMonth(cursor);
  const doMes = useMemo(() => eventos.filter(e => e.data.startsWith(mes)), [eventos, mes]);
  const primeiro = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const inicio = (primeiro.getDay() + 6) % 7;
  const dias = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells = [...Array(inicio).fill(null), ...Array.from({ length: dias }, (_, i) => i + 1)];
  const rotulo = primeiro.toLocaleDateString("pt-PT", { month: "long", year: "numeric" });
  const diaAberto = escolhido && escolhido.startsWith(mes) ? escolhido : null;
  const doDia = diaAberto ? doMes.filter(e => e.data === diaAberto) : [];
  const diaCruza = doDia.some((e, i) => doDia.some((o, j) => j > i && cruza(e, o)));
  const mesTemHoje = hoje.startsWith(mes);
  const weekdayHoje = mesTemHoje ? (dataDeIso(hoje).getDay() + 6) % 7 : -1;

  useEffect(() => {
    const id = window.setInterval(() => setAgora(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  function irParaHoje() {
    const dia = hojeIso();
    setCursor(dataDeIso(dia));
    setEscolhido(dia);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Calendário de {nome}</p>
          <p className="text-[11px] text-slate-400">{doMes.length} {doMes.length === 1 ? "sessão" : "sessões"} neste mês</p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" className="px-2 py-1 text-xs rounded border border-slate-200" onClick={() => setCursor(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} aria-label="Mês anterior">‹</button>
          <span className="text-xs font-semibold text-slate-700 capitalize min-w-[8rem] text-center">{rotulo}</span>
          <button type="button" className="px-2 py-1 text-xs rounded border border-slate-200" onClick={() => setCursor(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} aria-label="Mês seguinte">›</button>
        </div>
      </div>
      <button type="button" onClick={irParaHoje} className={`w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left ${mesTemHoje ? "border-amber-400 bg-amber-500 text-white shadow-sm" : "border-amber-300 bg-amber-50"}`}>
        <span className="flex items-center gap-2 min-w-0">
          <span className={`inline-flex h-2.5 w-2.5 rounded-full ${mesTemHoje ? "bg-white" : "bg-amber-500"}`} aria-hidden />
          <span className={`text-xs font-bold ${mesTemHoje ? "text-white" : "text-amber-950"}`}>Hoje, {formatDiaMes(hoje)}</span>
        </span>
        <span className={`text-sm font-bold tabular-nums ${mesTemHoje ? "text-white" : "text-amber-900"}`}>{hora}</span>
      </button>
      <div className="grid grid-cols-7 gap-1 text-[10px] font-semibold text-slate-400">
        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d, i) => (
          <span key={d} className={`text-center ${i === weekdayHoje ? "text-amber-700" : ""}`}>{d}{i === weekdayHoje ? " · hoje" : ""}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((dia, i) => {
          if (!dia) return <div key={`e-${i}`} />;
          const chave = `${mes}-${String(dia).padStart(2, "0")}`;
          const ev = doMes.filter(e => e.data === chave);
          const eHoje = chave === hoje;
          const conflito = ev.some((e, idx) => ev.some((o, j) => j > idx && cruza(e, o)));
          const agoraAqui = ev.some(e => aDecorrer(e, hoje, hora));
          const livre = diaDisponivel(chave, slots);
          const aberto = chave === diaAberto;
          return (
            <button
              key={chave}
              type="button"
              onClick={() => setEscolhido(chave)}
              className={`min-h-[76px] rounded-lg border px-1 py-1 text-left ${
                eHoje
                  ? "border-amber-500 bg-amber-100 ring-2 ring-amber-400 shadow-sm"
                  : conflito
                    ? "border-red-400 bg-red-50 ring-2 ring-red-200"
                    : aberto
                      ? "border-violet-500 ring-2 ring-violet-200"
                      : ev.length
                        ? "border-violet-200 bg-violet-50"
                        : livre
                          ? "border-emerald-100 bg-emerald-50/60"
                          : "border-slate-100"
              } ${aberto && !eHoje ? "outline outline-2 outline-offset-1 outline-slate-800" : ""}`}
            >
              <div className="flex items-center justify-between gap-0.5">
                <span className={eHoje
                  ? "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white"
                  : "text-[10px] font-semibold text-slate-500"}
                >{dia}</span>
                {conflito && <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" title="Horários que se cruzam" />}
              </div>
              {eHoje && <p className="text-[9px] font-bold uppercase tracking-wide text-amber-900 leading-tight">Hoje</p>}
              {eHoje && <p className="text-[9px] font-bold tabular-nums text-amber-950 leading-tight">{hora}{agoraAqui ? " · agora" : ""}</p>}
              {ev.slice(0, eHoje && conflito ? 1 : 2).map(e => (
                <p key={e.id} className={`text-[9px] leading-tight truncate ${ev.some(o => cruza(e, o)) ? "font-semibold text-red-800" : eHoje ? "text-amber-950" : "text-violet-800"}`} title={`${e.hora} ${e.titulo}`}>{aDecorrer(e, hoje, hora) ? "● " : ""}{e.titulo}</p>
              ))}
              {ev.length > (eHoje && conflito ? 1 : 2) && <p className={`text-[9px] ${conflito ? "text-red-500" : "text-violet-500"}`}>+{ev.length - (eHoje && conflito ? 1 : 2)}</p>}
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-slate-400">
        {slots ? "Os dias a verde são janelas da disponibilidade. " : ""}
        As sessões marcadas ficam a violeta. O dia de hoje fica a âmbar, com a hora, e a sessão a decorrer marca-se no painel. Horários que se cruzam ficam a vermelho e não podem ser gravados.
      </p>
      {diaAberto && (
        <div className={`rounded-lg border p-2 space-y-1 ${diaAberto === hoje ? "border-amber-300 bg-amber-50" : diaCruza ? "border-red-200 bg-red-50" : "border-slate-100 bg-slate-50"}`}>
          <p className="text-xs font-semibold text-slate-700">
            {diaAberto === hoje ? `Hoje, ${formatDiaMes(diaAberto)} · ${hora}` : formatDiaMes(diaAberto)}
          </p>
          {diaCruza && <p className="text-xs font-semibold text-red-700">Estas sessões ocupam o mesmo horário. Separe-as antes de gravar outra em cima.</p>}
          {doDia.length === 0 && <p className="text-xs text-slate-400">Sem sessão neste dia.</p>}
          {doDia.map(e => {
            const mau = doDia.some(o => cruza(e, o));
            const agora = aDecorrer(e, hoje, hora);
            return (
              <p key={e.id} className={`text-xs ${mau ? "font-semibold text-red-800" : agora ? "font-semibold text-amber-950" : "text-slate-700"}`}>
                {agora ? "A decorrer · " : ""}{e.hora ? `${e.hora}: ` : ""}{e.titulo}
              </p>
            );
          })}
        </div>
      )}
      {doMes.length === 0 && (
        <p className="text-xs text-slate-400">Sem sessões neste mês. Avance para ver os meses seguintes.</p>
      )}
    </div>
  );
}
