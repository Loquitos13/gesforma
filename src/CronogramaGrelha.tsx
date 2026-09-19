import { useEffect, useMemo, useRef, useState } from "react";
import { modulosOptsForCurso } from "./FormKit";
import {
  addDays,
  cellLabel,
  cellTone,
  datesFromRange,
  matchLinha,
  dayNum,
  generateEnaCronograma,
  grelhaPeriodo,
  grupoLinha,
  LINHA_PRESETS,
  linhaId,
  linhaLabel,
  linhasFromSessoes,
  monthSpans,
  setMatricula,
  upsertCell,
  weekdayCode,
  type GrelhaLinha,
} from "./cronogramaGrelha";
import { codigoModulo, formatDiaMes, type SessaoCronograma } from "./turmaModel";

const TONE: Record<string, string> = {
  presencial: "bg-[#a60000] text-white",
  sincrona: "bg-[#1d4ed8] text-white",
  auto: "bg-slate-200 text-slate-700",
  avaliacao: "bg-amber-400 text-amber-950",
  matricula: "bg-[#ffa900] text-slate-900",
  empty: "bg-white hover:bg-slate-50 text-slate-400",
};

function CellEditor({
  date,
  linha,
  sessoes,
  moduloOpts,
  formador,
  onClose,
  onApply,
}: {
  date: string;
  linha: GrelhaLinha;
  sessoes: SessaoCronograma[];
  moduloOpts: { value: string; sub?: string }[];
  formador?: string;
  onClose: () => void;
  onApply: (next: SessaoCronograma[]) => void;
}) {
  const hits = sessoes.filter(s => s.data === date && matchLinha(s, linha));
  const initial = hits.flatMap(s => s.modulos ?? []);
  const [picked, setPicked] = useState<string[]>(initial);
  const [sinc, setSinc] = useState(linha.modalidade === "sincrona" && (hits.some(s => (s.modalidade ?? "") === "sincrona") || !initial.length));
  const [aval, setAval] = useState(hits.some(s => (s.modalidade ?? "") === "avaliacao"));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  function toggle(m: string) {
    setPicked(xs => xs.includes(m) ? xs.filter(x => x !== m) : [...xs, m]);
    setSinc(false);
  }

  function save() {
    if (!picked.length && !sinc && !aval) {
      onApply(upsertCell(sessoes, date, linha, null));
      onClose();
      return;
    }
    const modalidade = aval ? "avaliacao" : sinc ? "sincrona" : linha.modalidade;
    onApply(upsertCell(sessoes, date, linha, {
      modulos: picked,
      formadores: modalidade === "presencial" || modalidade === "sincrona"
        ? (formador && formador !== "A definir" ? [formador] : [])
        : [],
      modalidade,
    }));
    onClose();
  }

  return (
    <div ref={ref} className="absolute z-50 left-1/2 top-full mt-1 w-64 -translate-x-1/2 rounded-xl border border-slate-200 bg-white shadow-xl p-3 text-left">
      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">{formatDiaMes(date)}</p>
      <p className="text-xs text-slate-600 mt-0.5">{linhaLabel(linha)}</p>
      <div className="mt-2 max-h-44 overflow-auto space-y-1">
        {moduloOpts.map(o => (
          <label key={o.value} className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
            <input type="checkbox" className="mt-0.5" checked={picked.includes(o.value)} onChange={() => toggle(o.value)} />
            <span><span className="font-semibold">{codigoModulo(o.value)}</span> · {o.value.replace(/^[^·]+·\s*/, "")}</span>
          </label>
        ))}
        {!moduloOpts.length && <p className="text-xs text-slate-400">Não há módulos neste curso.</p>}
      </div>
      {linha.modalidade === "sincrona" && (
        <label className="mt-2 flex items-center gap-2 text-xs text-slate-700">
          <input type="checkbox" checked={sinc} onChange={e => { setSinc(e.target.checked); if (e.target.checked) setAval(false); }} />
          Sessão síncrona (vídeo-conferência)
        </label>
      )}
      <label className="mt-1.5 flex items-center gap-2 text-xs text-slate-700">
        <input type="checkbox" checked={aval} onChange={e => { setAval(e.target.checked); if (e.target.checked) setSinc(false); }} />
        Data limite de avaliação
      </label>
      <div className="flex gap-2 mt-3">
        <button type="button" onClick={() => { onApply(upsertCell(sessoes, date, linha, null)); onClose(); }} className="flex-1 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
          Limpar
        </button>
        <button type="button" onClick={save} className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-[#0F172A] text-white hover:bg-slate-800">
          Aplicar
        </button>
      </div>
    </div>
  );
}

export function CronogramaGrelha({
  sessoes,
  onChange,
  inicio,
  horario,
  horas,
  formador,
  curso,
  local,
  accent = "gold",
  compact = false,
}: {
  sessoes: SessaoCronograma[];
  onChange: (next: SessaoCronograma[]) => void;
  inicio: string;
  horario: string;
  horas: number;
  formador: string;
  curso?: string;
  local?: string;
  accent?: "gold" | "fin";
  compact?: boolean;
}) {
  const moduloOpts = useMemo(() => modulosOptsForCurso(curso), [curso]);
  const periodo = useMemo(() => grelhaPeriodo(sessoes, inicio), [sessoes, inicio]);
  const [fim, setFim] = useState(periodo.fim);
  const [matricula, setMatriculaDate] = useState(periodo.matricula ?? "");
  const [linhas, setLinhas] = useState<GrelhaLinha[]>(() => linhasFromSessoes(sessoes, horario));
  const [open, setOpen] = useState<{ date: string; linha: string } | null>(null);
  const [addLinha, setAddLinha] = useState(false);

  useEffect(() => {
    setLinhas(linhasFromSessoes(sessoes, horario));
  }, [sessoes, horario]);

  useEffect(() => {
    if (periodo.fim) setFim(periodo.fim);
    setMatriculaDate(periodo.matricula ?? "");
  }, [periodo.fim, periodo.matricula]);

  const start = [matricula, inicio, periodo.inicio].filter(Boolean).sort()[0] ?? inicio;
  const dates = useMemo(() => datesFromRange(start, fim || addDays(inicio || start, 31)), [start, fim, inicio]);
  const months = monthSpans(dates);
  const gold = accent === "gold";

  function aplicarGerado() {
    const next = generateEnaCronograma({
      inicio,
      horario,
      horas,
      formador,
      curso,
      modulos: moduloOpts.map(o => o.value),
    });
    onChange(next);
    const p = grelhaPeriodo(next, inicio);
    setFim(p.fim);
    setMatriculaDate(p.matricula ?? "");
    setLinhas(linhasFromSessoes(next, horario));
  }

  function changeMatricula(v: string) {
    setMatriculaDate(v);
    onChange(setMatricula(sessoes, v));
  }

  function changeFim(v: string) {
    setFim(v);
  }

  return (
    <div className="space-y-3 cronograma-ena">
      <header className="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#a60000]">ENA · Escola de Negócios e Administração</p>
        <h2 className="text-lg font-bold text-slate-900 mt-1">Cronograma {horario || "da turma"}</h2>
        <p className="text-sm font-semibold text-slate-700 uppercase mt-0.5">{curso || "Curso por definir"}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mt-3 text-xs">
          <label className="flex items-center gap-2">
            <span className="text-slate-500 w-40 flex-shrink-0">Data limite de matrícula</span>
            <input type="date" value={matricula} onChange={e => changeMatricula(e.target.value)} className="flex-1 px-2 py-1 border border-slate-200 rounded-lg" />
          </label>
          <p className="flex items-center gap-2">
            <span className="text-slate-500 w-40 flex-shrink-0">Data de início</span>
            <span className="font-semibold text-slate-800">{inicio ? formatDiaMes(inicio) : "—"}</span>
          </p>
          <p className="flex items-center gap-2">
            <span className="text-slate-500 w-40 flex-shrink-0">Local de realização</span>
            <span className="font-semibold text-slate-800">{local || "—"}</span>
          </p>
          <label className="flex items-center gap-2">
            <span className="text-slate-500 w-40 flex-shrink-0">Data de fim</span>
            <input type="date" value={fim} min={inicio || undefined} onChange={e => changeFim(e.target.value)} className="flex-1 px-2 py-1 border border-slate-200 rounded-lg" />
          </label>
        </div>
      </header>

      <div className={`overflow-auto border border-slate-200 rounded-xl bg-white ${compact ? "max-h-[28rem]" : "max-h-[70vh]"}`}>
        <table className="min-w-max border-collapse text-[11px]">
          <thead>
            <tr>
              <th rowSpan={3} className="sticky left-0 z-20 bg-white border-b border-r border-slate-200 px-2 py-1 text-left w-44 min-w-[11rem]">
                <span className="sr-only">Horário</span>
              </th>
              {months.map(m => (
                <th key={m.key} colSpan={m.count} className="border-b border-slate-200 bg-slate-50 px-1 py-1 text-center text-[10px] font-bold uppercase tracking-wider text-slate-600">
                  {m.label}
                </th>
              ))}
            </tr>
            <tr>
              {dates.map(d => (
                <th key={`n-${d}`} className={`border-b border-slate-100 px-0 py-1 text-center font-bold w-8 min-w-8 ${d === matricula ? "bg-[#ffa900]/40" : d === inicio ? "bg-emerald-50" : ""}`}>
                  {dayNum(d)}
                </th>
              ))}
            </tr>
            <tr>
              {dates.map(d => (
                <th key={`w-${d}`} className={`border-b border-slate-200 px-0 py-0.5 text-center font-medium text-slate-500 ${d === matricula ? "bg-[#ffa900]/30" : ""}`}>
                  {weekdayCode(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(["presencial", "sincrona", "auto", "avaliacao"] as const).map(grupo => {
              const rows = linhas.filter(l => l.modalidade === grupo);
              if (!rows.length) return null;
              return rows.map((linha, i) => (
                <tr key={linha.id}>
                  <th className="sticky left-0 z-10 bg-white border-r border-b border-slate-200 px-2 py-1 text-left align-middle font-semibold text-slate-700 w-44 min-w-[11rem]">
                    {i === 0 && <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{grupoLinha(grupo)}</p>}
                    <p className="text-[11px] font-medium text-slate-600 leading-tight">{linhaLabel(linha)}</p>
                  </th>
                  {dates.map(d => {
                    const tone = d === matricula && grupo === "presencial" && i === 0 && !cellLabel(sessoes, d, linha)
                      ? "matricula"
                      : cellTone(sessoes, d, linha);
                    const label = d === matricula && tone === "matricula" ? "Matrícula" : cellLabel(sessoes, d, linha);
                    const opened = open?.date === d && open.linha === linha.id;
                    return (
                      <td key={`${linha.id}-${d}`} className="relative border border-slate-100 p-0 text-center align-middle">
                        <button
                          type="button"
                          onClick={() => setOpen(opened ? null : { date: d, linha: linha.id })}
                          className={`block w-8 min-w-8 h-10 px-0.5 text-[9px] font-bold leading-tight ${TONE[tone] ?? TONE.empty} ${d === matricula ? "ring-1 ring-[#ffa900]" : ""}`}
                          title={`${formatDiaMes(d)} · ${linhaLabel(linha)}`}
                        >
                          {label}
                        </button>
                        {opened && (
                          <CellEditor
                            date={d}
                            linha={linha}
                            sessoes={sessoes}
                            moduloOpts={moduloOpts}
                            formador={formador}
                            onClose={() => setOpen(null)}
                            onApply={onChange}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={aplicarGerado}
          disabled={!inicio}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg text-white disabled:opacity-40 ${gold ? "bg-amber-500 hover:bg-amber-600" : "bg-blue-600 hover:bg-blue-700"}`}
        >
          {sessoes.length ? "Gerar grelha ENA" : "Gerar cronograma ENA"}
        </button>
        <div className="relative">
          <button type="button" onClick={() => setAddLinha(v => !v)} className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
            + Linha de horário
          </button>
          {addLinha && (
            <div className="absolute z-30 mt-1 w-56 rounded-xl border border-slate-200 bg-white shadow-lg p-1">
              {LINHA_PRESETS.map(p => (
                <button
                  key={p.linha.id}
                  type="button"
                  onClick={() => {
                    const id = linhaId(p.linha);
                    setLinhas(xs => xs.some(l => l.id === id) ? xs : [...xs, { ...p.linha, id }]);
                    setAddLinha(false);
                  }}
                  className="block w-full text-left px-2.5 py-1.5 text-xs rounded-lg hover:bg-slate-50"
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button type="button" onClick={() => window.print()} className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
          Imprimir / PDF
        </button>
      </div>

      <ul className="text-[11px] text-slate-600 space-y-1 px-1">
        <li className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-sm bg-[#ffa900]" /> Data limite de matrícula e instruções de início (email)</li>
        <li className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-sm bg-[#a60000]" /> Aulas presenciais em sala, por módulo</li>
        <li className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-sm bg-[#1d4ed8]" /> Sessão síncrona em vídeo-conferência</li>
        <li className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-sm bg-slate-300" /> E-learning / auto-aprendizagem</li>
        <li className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-sm bg-amber-400" /> Data limite de avaliação do(s) módulo(s)</li>
      </ul>
    </div>
  );
}
