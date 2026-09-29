import { useEffect, useState } from "react";
import {
  apiAplicarTurmaRegras, apiCreateTurmaRegra, apiDeleteTurmaRegra, apiTurmaRegras, type TurmaRegra,
} from "./api";
import { persist, toastOk } from "./toastBus";

const inp = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700";

export function TurmaRegrasPanel({
  regime,
  cursos,
  locais,
  horarios,
  onApplied,
}: {
  regime: "gold" | "fin";
  cursos: string[];
  locais: string[];
  horarios: string[];
  onApplied?: () => void;
}) {
  const [regras, setRegras] = useState<TurmaRegra[]>([]);
  const [open, setOpen] = useState(false);
  const [curso, setCurso] = useState(cursos[0] ?? "");
  const [local, setLocal] = useState(locais[0] ?? "");
  const [horario, setHorario] = useState(regime === "fin" ? "Pós Laboral" : (horarios[0] ?? "Pós Laboral"));
  const [proxima, setProxima] = useState(new Date().toISOString().slice(0, 10));
  const [vagas, setVagas] = useState(regime === "fin" ? 20 : 16);
  const [horas, setHoras] = useState(regime === "fin" ? 25 : 90);
  const [busy, setBusy] = useState(false);

  function recarregar() {
    apiTurmaRegras(regime).then(r => setRegras(r.regras)).catch(() => setRegras([]));
  }
  useEffect(() => { recarregar(); }, [regime]);

  async function criar() {
    if (!curso.trim()) return;
    const id = await persist(apiCreateTurmaRegra({
      regime, curso, local, horario,
      vagas, horas, horasSessao: 3, proximaData: proxima, activa: true,
    }));
    if (!id) return;
    toastOk("Regra gravada. Aplicar cria a turma e o cronograma.");
    recarregar();
    setOpen(false);
  }

  async function aplicar() {
    setBusy(true);
    try {
      const r = await apiAplicarTurmaRegras(regime);
      toastOk(r.n ? `${r.n} turma(s) criada(s) com cronograma.` : "Nenhuma turma nova: as regras já tinham turma nessa data.");
      onApplied?.();
      recarregar();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-800">Regras de turma e cronograma</p>
          <p className="text-xs text-slate-500">
            {regime === "fin"
              ? "Sessões de 3 horas. Aplicar cria a turma financiada e o calendário."
              : "Aplicar cria a turma Gold (curso + local + horário + data) e gera as sessões."}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setOpen(o => !o)} className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200">
            {open ? "Fechar" : "+ Regra"}
          </button>
          <button type="button" disabled={busy || regras.length === 0} onClick={() => void aplicar()}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg text-white disabled:opacity-40 ${regime === "fin" ? "bg-blue-600" : "bg-amber-500"}`}>
            {busy ? "A criar…" : "Aplicar regras"}
          </button>
        </div>
      </div>
      {open && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
          <label className="text-xs font-semibold text-slate-500">Curso
            <select className={`${inp} mt-1`} value={curso} onChange={e => setCurso(e.target.value)}>
              {cursos.map(c => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-500">Local
            <select className={`${inp} mt-1`} value={local} onChange={e => setLocal(e.target.value)}>
              {locais.map(c => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-500">Horário
            <select className={`${inp} mt-1`} value={horario} onChange={e => setHorario(e.target.value)}>
              {(horarios.length ? horarios : ["Pós Laboral", "Sábado manhã", "Laboral Manhã"]).map(c => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-500">Próxima data
            <input type="date" className={`${inp} mt-1`} value={proxima} onChange={e => setProxima(e.target.value)} />
          </label>
          <label className="text-xs font-semibold text-slate-500">Vagas
            <input type="number" className={`${inp} mt-1`} value={vagas} onChange={e => setVagas(Number(e.target.value))} />
          </label>
          <label className="text-xs font-semibold text-slate-500">Horas do curso
            <input type="number" className={`${inp} mt-1`} value={horas} onChange={e => setHoras(Number(e.target.value))} />
          </label>
          <p className="text-[11px] text-slate-500 sm:col-span-2">Cada sessão dura 3 horas{regime === "fin" ? " (financiada)" : " nesta regra"}.</p>
          <button type="button" onClick={() => void criar()} className="px-3 py-2 text-sm font-semibold rounded-lg bg-slate-800 text-white">Gravar regra</button>
        </div>
      )}
      {regras.length > 0 && (
        <ul className="text-xs text-slate-600 space-y-1">
          {regras.map(r => (
            <li key={r.id} className="flex items-center justify-between gap-2">
              <span>{r.curso} · {r.local} · {r.horario} · próxima {r.proximaData || "—"} · {r.horasSessao}h/sessão</span>
              <button type="button" className="text-red-600 font-semibold" onClick={() => void persist(apiDeleteTurmaRegra(r.id)).then(() => recarregar())}>Apagar</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
