// Calendário de eventos (sessões de formação, datas das turmas, contactos): vista de mês, semana e lista. Serve o
// GesForma (Calendário, «O meu calendário» do formador) e a área do formando. Os dados vêm de quem o usa: o componente
// diz o período à vista (`onPeriodo`) e mostra os eventos que recebe.
import { useEffect, useMemo, useState } from "react";

export type EventoCal = {
  id: string;
  tipo: "sessao" | "inicio" | "matricula" | "fim" | "contacto";
  regime?: "gold" | "fin";
  data: string;
  inicio: string;
  fim: string;
  titulo: string;
  turma?: string;
  curso?: string;
  modulos?: string[];
  formadores?: string[];
  local?: string;
};

type Vista = "mes" | "semana" | "lista";
const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const deIso = (s: string) => { const [a, m, d] = s.split("-").map(Number); return new Date(a!, (m ?? 1) - 1, d ?? 1); };
const somar = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const segunda = (d: Date) => somar(d, -((d.getDay() + 6) % 7));
const dataPt = (s: string) => `${s.slice(8, 10)}-${s.slice(5, 7)}-${s.slice(0, 4)}`;
const horas = (e: EventoCal) => (e.inicio ? `${e.inicio}${e.fim ? `–${e.fim}` : ""}` : "");

/** Período à vista: do primeiro ao último dia da grelha. */
function periodo(vista: Vista, cursor: Date): [string, string] {
  if (vista === "semana") { const s = segunda(cursor); return [iso(s), iso(somar(s, 6))]; }
  if (vista === "lista") return [iso(cursor), iso(somar(cursor, 41))];
  const primeiro = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const ini = segunda(primeiro);
  return [iso(ini), iso(somar(ini, 41))];
}

const COR: Record<EventoCal["tipo"], string> = {
  sessao: "bg-sky-50 text-sky-900 border-sky-200",
  inicio: "bg-emerald-50 text-emerald-900 border-emerald-200",
  matricula: "bg-amber-50 text-amber-900 border-amber-200",
  fim: "bg-slate-100 text-slate-700 border-slate-300",
  contacto: "bg-violet-50 text-violet-900 border-violet-200",
};
const LEGENDA: [EventoCal["tipo"], string][] = [["sessao", "Sessão"], ["inicio", "Início da turma"], ["matricula", "Data limite da matrícula"], ["fim", "Fim da turma"], ["contacto", "Contacto marcado"]];

export function CalendarioEventos({ eventos, aCarregar, onPeriodo, onAbrir, mostrarRegime, vazio }: {
  eventos: EventoCal[];
  aCarregar?: boolean;
  onPeriodo?: (de: string, ate: string) => void;
  onAbrir?: (e: EventoCal) => void;
  /** Etiqueta Gold/Financiada (quem vê os dois regimes). */
  mostrarRegime?: boolean;
  vazio?: string;
}) {
  const [vista, setVista] = useState<Vista>("mes");
  const [cursor, setCursor] = useState(() => new Date());
  const [de, ate] = periodo(vista, cursor);
  useEffect(() => { onPeriodo?.(de, ate); }, [de, ate]); // eslint-disable-line react-hooks/exhaustive-deps
  const porDia = useMemo(() => {
    const m = new Map<string, EventoCal[]>();
    for (const e of eventos) m.set(e.data, [...(m.get(e.data) ?? []), e]);
    return m;
  }, [eventos]);
  const hoje = iso(new Date());
  const tipos = new Set(eventos.map(e => e.tipo));

  function mover(n: number) {
    if (vista === "mes") setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));
    else setCursor(somar(cursor, n * (vista === "semana" ? 7 : 42)));
  }
  const titulo = vista === "mes"
    ? `${MESES[cursor.getMonth()]} de ${cursor.getFullYear()}`
    : `${dataPt(de)} a ${dataPt(ate)}`;

  const Chip = ({ e, compacto }: { e: EventoCal; compacto?: boolean }) => (
    <button type="button" onClick={() => onAbrir?.(e)} title={detalhe(e)}
      className={`block w-full truncate rounded border px-1.5 py-0.5 text-left text-[11px] leading-tight ${COR[e.tipo]} ${onAbrir ? "cursor-pointer hover:brightness-95" : "cursor-default"}`}>
      {horas(e) && <span className="font-semibold tabular-nums">{e.inicio} </span>}
      {compacto ? (e.turma || e.titulo) : e.titulo}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border border-slate-200 bg-white">
          <button type="button" className="px-2.5 py-1 text-sm" aria-label="Anterior" onClick={() => mover(-1)}>‹</button>
          <button type="button" className="border-x border-slate-200 px-2.5 py-1 text-sm" onClick={() => setCursor(new Date())}>Hoje</button>
          <button type="button" className="px-2.5 py-1 text-sm" aria-label="Seguinte" onClick={() => mover(1)}>›</button>
        </div>
        <p className="m-0 text-base font-semibold capitalize text-slate-800">{titulo}</p>
        {aCarregar && <span className="text-xs text-slate-400">A carregar…</span>}
        <div role="tablist" aria-label="Vista" className="ml-auto inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5">
          {([["mes", "Mês"], ["semana", "Semana"], ["lista", "Lista"]] as const).map(([v, r]) => (
            <button key={v} type="button" role="tab" aria-selected={vista === v} onClick={() => setVista(v)}
              className={`rounded px-2.5 py-1 text-xs font-semibold ${vista === v ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}>{r}</button>
          ))}
        </div>
      </div>

      {vista === "mes" && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
            {DIAS.map(d => <span key={d} className="py-1.5 text-center text-[11px] font-semibold text-slate-500">{d}</span>)}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: 42 }, (_, i) => {
              const dia = somar(deIso(de), i);
              const k = iso(dia);
              const doMes = dia.getMonth() === cursor.getMonth();
              const lista = porDia.get(k) ?? [];
              return (
                <div key={k} className={`min-h-[92px] border-b border-r border-slate-100 p-1 ${doMes ? "" : "bg-slate-50/60"}`}>
                  <p className={`m-0 mb-1 text-right text-[11px] tabular-nums ${k === hoje ? "font-bold text-sky-700" : doMes ? "text-slate-600" : "text-slate-300"}`}>{dia.getDate()}</p>
                  <div className="space-y-0.5">
                    {lista.slice(0, 3).map(e => <Chip key={e.id} e={e} compacto />)}
                    {lista.length > 3 && (
                      <button type="button" className="text-[11px] font-semibold text-slate-500" onClick={() => { setCursor(dia); setVista("lista"); }}>
                        +{lista.length - 3} mais
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {vista === "semana" && (
        <div className="grid gap-2 sm:grid-cols-7">
          {Array.from({ length: 7 }, (_, i) => {
            const k = iso(somar(deIso(de), i));
            const lista = porDia.get(k) ?? [];
            return (
              <div key={k} className={`rounded-lg border bg-white p-2 ${k === hoje ? "border-sky-300" : "border-slate-200"}`}>
                <p className="m-0 mb-2 text-xs font-semibold text-slate-600">{DIAS[i]} · {dataPt(k).slice(0, 5)}</p>
                <div className="space-y-1">
                  {lista.length === 0 && <p className="m-0 text-[11px] text-slate-300">—</p>}
                  {lista.map(e => <Chip key={e.id} e={e} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {vista === "lista" && (
        <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {eventos.filter(e => e.data >= de && e.data <= ate).length === 0 && <p className="m-0 p-4 text-sm text-slate-500">{vazio ?? "Sem eventos neste período."}</p>}
          {[...porDia.entries()].filter(([k]) => k >= de && k <= ate).sort(([a], [b]) => a.localeCompare(b)).map(([k, lista]) => (
            <div key={k} className="flex gap-3 p-3">
              <p className={`m-0 w-24 shrink-0 text-sm font-semibold tabular-nums ${k === hoje ? "text-sky-700" : "text-slate-700"}`}>{dataPt(k)}</p>
              <ul className="m-0 flex-1 list-none space-y-1.5 p-0">
                {lista.map(e => (
                  <li key={e.id}>
                    <button type="button" onClick={() => onAbrir?.(e)} className={`w-full rounded-md border px-2.5 py-1.5 text-left text-[13px] ${COR[e.tipo]}`}>
                      <span className="font-semibold tabular-nums">{horas(e) || "Dia todo"}</span> · {e.titulo}
                      <span className="block text-xs opacity-80">{[e.turma, e.curso, e.local, e.formadores?.join(", "), mostrarRegime && e.regime ? (e.regime === "fin" ? "Financiada" : "Gold") : ""].filter(Boolean).join(" · ")}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {tipos.size > 1 && (
        <div className="flex flex-wrap gap-3 text-[11px] text-slate-500">
          {LEGENDA.filter(([t]) => tipos.has(t)).map(([t, r]) => (
            <span key={t} className="inline-flex items-center gap-1"><span className={`h-2.5 w-2.5 rounded border ${COR[t]}`} />{r}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function detalhe(e: EventoCal) {
  return [e.titulo, horas(e), e.turma, e.curso, e.local, e.formadores?.join(", ")].filter(Boolean).join(" · ");
}
