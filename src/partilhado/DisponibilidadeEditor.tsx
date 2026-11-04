import { useState } from "react";
import {
  JANELAS, SLOTS_CCP, alternarSlotNoDia, comDatasIndisponiveis, datasIndisponiveis, slotNoDia, type SlotId,
} from "./disponibilidade";

const DIAS = [
  { n: 1, curto: "Seg", label: "Segunda" },
  { n: 2, curto: "Ter", label: "Terça" },
  { n: 3, curto: "Qua", label: "Quarta" },
  { n: 4, curto: "Qui", label: "Quinta" },
  { n: 5, curto: "Sex", label: "Sexta" },
  { n: 6, curto: "Sáb", label: "Sábado" },
];

/** Eixo do calendário: das 9h às 23h, 28 px por hora. */
const INICIO = 9 * 60;
const FIM = 23 * 60;
const PX_HORA = 28;
const HORAS = Array.from({ length: (FIM - INICIO) / 60 + 1 }, (_, i) => 9 + i);
/** Margem em cima e em baixo para as etiquetas das 9h e das 23h não ficarem cortadas. */
const MARGEM = 10;
const y = (min: number) => MARGEM + ((min - INICIO) / 60) * PX_HORA;

/**
 * Disponibilidade em calendário semanal (segunda a sábado, 9h–23h). Os blocos são as janelas CCP e marcam-se dia a dia
 * (ex.: laboral só à segunda e à quarta); o sábado tem manhã e tarde. Por baixo, os dias (ou períodos) indisponíveis.
 */
export function DisponibilidadeEditor({
  value,
  onChange,
  locked,
  nota,
}: {
  value: string[] | undefined;
  onChange?: (next: string[]) => void;
  locked?: boolean;
  nota?: string;
}) {
  const [sobre, setSobre] = useState<string | null>(null);
  const [novaDe, setNovaDe] = useState("");
  const [novaAte, setNovaAte] = useState("");
  const editavel = !locked && Boolean(onChange);
  const datas = datasIndisponiveis(value);
  function toggle(id: SlotId, dia: number) {
    if (!editavel) return;
    onChange!(alternarSlotNoDia(value, id, dia));
  }
  function juntarData() {
    if (!editavel || !novaDe) return;
    onChange!(comDatasIndisponiveis(value, [...datas, { de: novaDe, ate: novaAte && novaAte > novaDe ? novaAte : novaDe }]));
    setNovaDe("");
    setNovaAte("");
  }
  function tirarData(i: number) {
    if (!editavel) return;
    onChange!(comDatasIndisponiveis(value, datas.filter((_, j) => j !== i)));
  }
  const fmt = (iso: string) => `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}`;
  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="grid grid-cols-[2.25rem_repeat(6,minmax(0,1fr))] border-b border-slate-200 bg-slate-50">
          <span />
          {DIAS.map(d => (
            <span key={d.n} className="py-1.5 text-center text-[11px] font-semibold text-slate-500">
              <span className="sm:hidden">{d.curto}</span><span className="hidden sm:inline">{d.label}</span>
            </span>
          ))}
        </div>
        <div className="grid grid-cols-[2.25rem_repeat(6,minmax(0,1fr))]" style={{ height: y(FIM) + MARGEM }}>
          <div className="relative">
            {HORAS.map(h => (
              <span key={h} className="absolute right-1.5 -translate-y-1/2 text-[10px] tabular-nums text-slate-400" style={{ top: y(h * 60) }}>{h}h</span>
            ))}
          </div>
          {DIAS.map(d => (
            <div key={d.n} className="relative border-l border-slate-100">
              {HORAS.map(h => <span key={h} className="absolute inset-x-0 border-t border-slate-100" style={{ top: y(h * 60) }} />)}
              {SLOTS_CCP.filter(s => JANELAS[s.id].dias.includes(d.n)).map(s => {
                const j = JANELAS[s.id];
                const on = slotNoDia(value ?? null, s.id, d.n);
                const realce = sobre === `${s.id}@${d.n}`;
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={!editavel}
                    aria-pressed={on}
                    aria-label={`${s.label}, ${d.label}, ${s.horas}: ${on ? "disponível" : "indisponível"}`}
                    title={`${s.label} · ${d.label} · ${s.horas}`}
                    onClick={() => toggle(s.id, d.n)}
                    onMouseEnter={() => setSobre(`${s.id}@${d.n}`)}
                    onMouseLeave={() => setSobre(null)}
                    className={`absolute inset-x-0.5 sm:inset-x-1 rounded-md border px-0 sm:px-1.5 py-1 text-left text-[10px] sm:text-[11px] leading-tight overflow-hidden transition-colors ${
                      on ? "border-amber-300 bg-amber-100 text-amber-950" : "border-dashed border-slate-300 bg-slate-50 text-slate-400"
                    } ${realce && editavel ? "ring-2 ring-amber-400" : ""} ${editavel ? "cursor-pointer" : "cursor-default"}`}
                    style={{ top: y(j.inicio), height: y(j.fim) - y(j.inicio) }}
                  >
                    <span className="hidden sm:block font-semibold truncate">{s.label.replace("Sábado ", "")}</span>
                    <span className="hidden sm:block truncate">{s.horas.replace(" a ", "–")}</span>
                    {!on && <span className="hidden sm:block truncate">Indisponível</span>}
                    {/* No telemóvel a coluna é estreita: só o início e o fim, um por linha. */}
                    <span className="sm:hidden block text-center tabular-nums">{s.horas.split(" a ")[0]}</span>
                    <span className="sm:hidden block text-center tabular-nums">{s.horas.split(" a ")[1]}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-slate-400">
        {editavel ? "Clique num bloco para o marcar ou desmarcar nesse dia (ex.: laboral só à segunda e à quarta). " : ""}O sábado tem manhã e tarde.
      </p>
      <div className="rounded-lg border border-slate-200 bg-white p-2.5 space-y-2">
        <p className="text-[12px] font-semibold text-slate-700">Datas indisponíveis</p>
        {datas.length === 0 && <p className="text-[11px] text-slate-400">Nenhuma. {editavel ? "Junte um dia (ou um período) em que não pode dar formação." : ""}</p>}
        {datas.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {datas.map((d, i) => (
              <li key={`${d.de}-${d.ate}`} className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[11px] text-red-900">
                {d.ate !== d.de ? `${fmt(d.de)} a ${fmt(d.ate)}` : fmt(d.de)}
                {editavel && <button type="button" className="text-red-700 hover:text-red-900" aria-label={`Tirar ${fmt(d.de)}`} onClick={() => tirarData(i)}>×</button>}
              </li>
            ))}
          </ul>
        )}
        {editavel && (
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-[11px] text-slate-500">Dia<input type="date" value={novaDe} onChange={e => setNovaDe(e.target.value)} className="block rounded border border-slate-300 px-2 py-1 text-xs" /></label>
            <label className="text-[11px] text-slate-500">Até (opcional)<input type="date" value={novaAte} min={novaDe || undefined} onChange={e => setNovaAte(e.target.value)} className="block rounded border border-slate-300 px-2 py-1 text-xs" /></label>
            <button type="button" disabled={!novaDe} onClick={juntarData} className="rounded border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40">Juntar</button>
          </div>
        )}
      </div>
      {nota && <p className="text-[11px] text-slate-500">{nota}</p>}
    </div>
  );
}
