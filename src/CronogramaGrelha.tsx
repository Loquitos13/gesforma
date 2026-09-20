import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useCatalogs } from "./CatalogsContext";
import { modulosOptsForCurso } from "./FormKit";
import {
  addDays,
  aplicarEvento,
  buildLinha,
  cellLabel,
  cellTone,
  datesFromRange,
  defaultSlot,
  dayNum,
  eventosDoDia,
  EVENTO_OPTS,
  generateEnaCronograma,
  grelhaPeriodo,
  grupoLinha,
  linhaId,
  linhaLabel,
  linhasFromSessoes,
  mergeLinhas,
  METODOLOGIA_OPTS,
  monthSpans,
  normHora,
  setMatricula,
  weekdayCode,
  type EventoDia,
  type GrelhaLinha,
} from "./cronogramaGrelha";
import { mapLocalTurma, type LocalCatalogo } from "./cronogramaLocal";
import { imprimirCronogramaEna } from "./cronogramaPrint";
import { casarModulo, codigoModulo, formatDiaMes, sessaoModulos, type SessaoCronograma, type SessaoModalidade } from "./turmaModel";

function HoraField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const n = normHora(value) || "09:00";
  const [h, m] = n.split(":");
  const hours = Array.from({ length: 17 }, (_, i) => String(i + 7).padStart(2, "0"));
  const mins = ["00", "15", "30", "45"];
  if (m && !mins.includes(m)) mins.push(m);
  mins.sort();
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold text-slate-500 mb-1">{label}</span>
      <div className="flex items-center gap-1">
        <select
          value={h}
          onChange={e => onChange(`${e.target.value}:${m}`)}
          className="flex-1 px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
        >
          {hours.map(x => <option key={x} value={x}>{x}h</option>)}
        </select>
        <span className="text-slate-400 text-xs">:</span>
        <select
          value={m}
          onChange={e => onChange(`${h}:${e.target.value}`)}
          className="flex-1 px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
        >
          {mins.map(x => <option key={x} value={x}>{x}</option>)}
        </select>
      </div>
    </label>
  );
}

const TONE: Record<string, string> = {
  presencial: "bg-[#a60000] text-white",
  sincrona: "bg-[#1d4ed8] text-white",
  auto: "bg-slate-200 text-slate-700",
  avaliacao: "bg-amber-400 text-amber-950",
  matricula: "bg-[#15803d] text-white",
  empty: "bg-white hover:bg-slate-50 text-slate-400",
};

type EventoMod = Exclude<SessaoModalidade, "matricula">;

type EventoForm = {
  mod: EventoMod;
  horaInicio: string;
  horaFim: string;
  modulos: string[];
  formadores: string[];
};

function semHoras(mod: EventoMod) {
  return mod === "auto" || mod === "avaliacao";
}

function formInicial(alvo: EventoDia | null, linha: GrelhaLinha | undefined, horario: string): EventoForm {
  if (alvo) {
    return {
      mod: alvo.linha.modalidade,
      horaInicio: alvo.linha.horaInicio,
      horaFim: alvo.linha.horaFim,
      modulos: [...new Set(alvo.sessoes.flatMap(sessaoModulos))],
      formadores: [...new Set(alvo.sessoes.flatMap(s => s.formadores ?? []))],
    };
  }
  const mod = linha?.modalidade ?? "presencial";
  const slot = semHoras(mod)
    ? { horaInicio: "", horaFim: "" }
    : linha
      ? { horaInicio: linha.horaInicio, horaFim: linha.horaFim }
      : defaultSlot(horario, mod);
  return { mod, horaInicio: slot.horaInicio, horaFim: slot.horaFim, modulos: [], formadores: [] };
}

/** A que opção da lista corresponde um módulo já guardado na sessão. */
function opcaoDoModulo(modulo: string, catalogo: string[]) {
  return casarModulo(modulo, catalogo) ?? modulo;
}

function moduloEscolhido(modulos: string[], opcao: string, catalogo: string[]) {
  return modulos.some(m => opcaoDoModulo(m, catalogo) === opcao);
}

function alternarModulo(modulos: string[], opcao: string, catalogo: string[]) {
  return moduloEscolhido(modulos, opcao, catalogo)
    ? modulos.filter(m => opcaoDoModulo(m, catalogo) !== opcao)
    : [...modulos, opcao];
}

function EventoModal({
  date,
  linha,
  sessoes,
  horario,
  moduloOpts,
  formador,
  onClose,
  onApply,
}: {
  date: string;
  linha?: GrelhaLinha;
  sessoes: SessaoCronograma[];
  horario: string;
  moduloOpts: { value: string; sub?: string }[];
  formador?: string;
  onClose: () => void;
  onApply: (next: SessaoCronograma[], extra: GrelhaLinha) => void;
}) {
  const eventos = useMemo(() => eventosDoDia(sessoes, date), [sessoes, date]);
  const inicial = linha
    ? eventos.find(e => e.linha.id === linha.id) ?? null
    : eventos.length === 1 ? eventos[0]! : null;
  const [alvo, setAlvo] = useState<EventoDia | null>(inicial);
  const [form, setForm] = useState<EventoForm>(() => formInicial(inicial, linha, horario));
  const [erro, setErro] = useState("");
  const editing = Boolean(alvo);
  const catalogo = useMemo(() => moduloOpts.map(o => o.value), [moduloOpts]);
  // Módulos que já estão nas sessões deste dia mas não casam com o catálogo do
  // curso entram na lista à mesma, para não ficarem escolhidos sem se verem.
  const opcoes = useMemo(() => {
    const fora = [...new Set(eventos.flatMap(e => e.sessoes.flatMap(sessaoModulos)))]
      .filter(m => !casarModulo(m, catalogo));
    return [...catalogo, ...fora];
  }, [catalogo, eventos]);

  function abrir(ev: EventoDia | null) {
    setAlvo(ev);
    setForm(formInicial(ev, ev ? undefined : linha, horario));
    setErro("");
  }

  function escolherMod(next: EventoMod) {
    setForm(f => {
      if (semHoras(next)) return { ...f, mod: next, horaInicio: "", horaFim: "" };
      if (!semHoras(f.mod)) return { ...f, mod: next };
      const d = defaultSlot(horario, next);
      return { ...f, mod: next, horaInicio: d.horaInicio, horaFim: d.horaFim };
    });
    setErro("");
  }

  function guardar() {
    const precisaHora = !semHoras(form.mod);
    const hi = precisaHora ? normHora(form.horaInicio) : "";
    const hf = precisaHora ? normHora(form.horaFim) : "";
    if (precisaHora && (!hi || !hf)) {
      setErro("Escolha a hora de início e de fim.");
      return;
    }
    if (precisaHora && hi >= hf) {
      setErro("A hora de fim tem de ser depois da de início.");
      return;
    }
    if (form.mod === "avaliacao" && !form.modulos.length) {
      setErro("Escolha o módulo a que se refere o prazo de avaliação.");
      return;
    }
    const nextLinha = buildLinha(form.mod, hi, hf);
    const lectiva = form.mod === "presencial" || form.mod === "sincrona";
    const next = aplicarEvento(sessoes, date, nextLinha, {
      modulos: form.modulos,
      formadores: lectiva
        ? (form.formadores.length ? form.formadores : formador && formador !== "A definir" ? [formador] : [])
        : [],
      modalidade: form.mod,
    }, alvo?.linha ?? null);
    onApply(next, nextLinha);
    onClose();
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] bg-slate-900/40 flex items-center justify-center p-4" onClick={onClose}>
      <form
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl p-5 space-y-3"
        onClick={e => e.stopPropagation()}
        onSubmit={e => { e.preventDefault(); guardar(); }}
      >
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
            {editing ? "Editar evento" : "Adicionar evento"}
          </p>
          <p className="text-sm font-semibold text-slate-800 mt-0.5">{formatDiaMes(date)}</p>
        </div>
        {eventos.length > 0 && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Eventos deste dia</p>
            <div className="flex flex-wrap gap-1.5">
              {eventos.map(ev => {
                const on = alvo?.linha.id === ev.linha.id;
                const codes = [...new Set(ev.sessoes.flatMap(s => (s.modulos ?? []).map(codigoModulo)).filter(Boolean))];
                return (
                  <button
                    key={ev.linha.id}
                    type="button"
                    onClick={() => abrir(ev)}
                    className={`px-2 py-1 text-[11px] font-semibold rounded-lg border ${on ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
                  >
                    {linhaLabel(ev.linha)}{codes.length ? ` · ${codes.join("/")}` : ""}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => abrir(null)}
                className={`px-2 py-1 text-[11px] font-semibold rounded-lg border ${alvo ? "border-slate-200 bg-white text-slate-600 hover:bg-slate-50" : "border-slate-800 bg-slate-800 text-white"}`}
              >
                + Novo
              </button>
            </div>
          </div>
        )}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Metodologia</p>
          <div className="grid gap-1 sm:grid-cols-2">
            {EVENTO_OPTS.map(opt => (
              <label key={opt.value} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input type="radio" name="evento-metodologia" checked={form.mod === opt.value} onChange={() => escolherMod(opt.value)} />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
        {!semHoras(form.mod) && (
          <div className="grid grid-cols-2 gap-3 sm:max-w-md">
            <HoraField label="Início" value={form.horaInicio} onChange={v => setForm(f => ({ ...f, horaInicio: v }))} />
            <HoraField label="Fim" value={form.horaFim} onChange={v => setForm(f => ({ ...f, horaFim: v }))} />
          </div>
        )}
        {form.mod === "auto" && (
          <p className="text-[11px] text-slate-500">O e-learning não tem hora de sala - ocupa o dia na grelha.</p>
        )}
        {form.mod === "avaliacao" && (
          <p className="text-[11px] text-slate-500">Marca este dia como limite de entrega de tarefas / avaliação dos módulos escolhidos.</p>
        )}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">
            Módulos{" "}
            <span className="font-medium normal-case tracking-normal text-slate-400">
              {form.mod === "avaliacao" ? "(obrigatório)" : "(opcional, pode ser mais do que um)"}
            </span>
          </p>
          <div className="max-h-56 overflow-auto border border-slate-100 rounded-lg p-2 grid gap-1 sm:grid-cols-2">
            {opcoes.map(valor => (
              <label key={valor} className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 shrink-0"
                  checked={moduloEscolhido(form.modulos, valor, catalogo)}
                  onChange={() => setForm(f => ({ ...f, modulos: alternarModulo(f.modulos, valor, catalogo) }))}
                />
                <span><span className="font-semibold">{codigoModulo(valor)}</span> · {valor.replace(/^[^·]+·\s*/, "")}</span>
              </label>
            ))}
            {!opcoes.length && <p className="text-xs text-slate-400">Não há módulos neste curso.</p>}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Só aparecem na grelha os módulos escolhidos aqui.</p>
        </div>
        {erro && <p className="text-[11px] text-red-600">{erro}</p>}
        <div className="flex flex-wrap gap-2 pt-1">
          {alvo && (
            <button
              type="button"
              onClick={() => {
                onApply(aplicarEvento(sessoes, date, alvo.linha, null), alvo.linha);
                onClose();
              }}
              className="flex-1 sm:flex-none sm:mr-auto px-4 py-2 text-xs font-semibold rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-300"
            >
              Remover
            </button>
          )}
          <button type="button" onClick={onClose} className="flex-1 sm:flex-none px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
            Cancelar
          </button>
          <button type="submit" className="flex-1 sm:flex-none px-5 py-2 text-xs font-semibold rounded-lg bg-[#0F172A] text-white hover:bg-slate-800">
            {editing ? "Guardar" : "Adicionar"}
          </button>
        </div>
      </form>
    </div>,
    document.body,
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
  const [evento, setEvento] = useState<{ date: string; linha?: GrelhaLinha } | null>(null);
  const [addLinha, setAddLinha] = useState(false);
  const [novaMod, setNovaMod] = useState<Exclude<SessaoModalidade, "matricula" | "avaliacao">>("presencial");
  const [novaInicio, setNovaInicio] = useState(() => defaultSlot(horario, "presencial").horaInicio);
  const [novaFim, setNovaFim] = useState(() => defaultSlot(horario, "presencial").horaFim);
  const [addErro, setAddErro] = useState("");
  const { lists } = useCatalogs();
  const locaisCatalogo = useMemo<LocalCatalogo[]>(() => {
    const gold = (lists["locais:gold"] ?? []) as LocalCatalogo[];
    const fin = (lists["locais:fin"] ?? []) as LocalCatalogo[];
    return [...gold, ...fin];
  }, [lists]);
  const localMapeado = useMemo(() => mapLocalTurma(local, locaisCatalogo), [local, locaisCatalogo]);

  useEffect(() => {
    setLinhas(prev => mergeLinhas(linhasFromSessoes(sessoes, horario), prev));
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

  function aplicarEventoGrelha(next: SessaoCronograma[], extra: GrelhaLinha) {
    setLinhas(xs => mergeLinhas(linhasFromSessoes(next, horario), [...xs, extra]));
    onChange(next);
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
            <span className="font-semibold text-slate-800">{inicio ? formatDiaMes(inicio) : "-"}</span>
          </p>
          <p className="flex items-center gap-2">
            <span className="text-slate-500 w-40 flex-shrink-0">Local de realização</span>
            <span className="font-semibold text-slate-800">{localMapeado.localizacao}</span>
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
                <th key={`n-${d}`} className={`border-b border-slate-100 px-0 py-0 text-center font-bold w-8 min-w-8 ${d === matricula ? "bg-[#15803d]/30" : d === inicio ? "bg-emerald-50" : ""}`}>
                  <button
                    type="button"
                    onClick={() => setEvento({ date: d })}
                    title={`Adicionar evento em ${formatDiaMes(d)}`}
                    className="block w-8 min-w-8 py-1 hover:bg-slate-100"
                  >
                    {dayNum(d)}
                  </button>
                </th>
              ))}
            </tr>
            <tr>
              {dates.map(d => (
                <th key={`w-${d}`} className={`border-b border-slate-200 px-0 py-0 text-center font-medium text-slate-500 ${d === matricula ? "bg-[#15803d]/20" : ""}`}>
                  <button
                    type="button"
                    onClick={() => setEvento({ date: d })}
                    title={`Adicionar evento em ${formatDiaMes(d)}`}
                    className="block w-8 min-w-8 py-0.5 hover:bg-slate-100"
                  >
                    {weekdayCode(d)}
                  </button>
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
                    <div className="flex items-center gap-1">
                      <p className="text-[11px] font-medium text-slate-600 leading-tight flex-1">{linhaLabel(linha)}</p>
                      {!dates.some(d => cellLabel(sessoes, d, linha)) && (
                        <button
                          type="button"
                          title="Remover linha"
                          onClick={() => setLinhas(xs => xs.filter(x => x.id !== linha.id))}
                          className="text-slate-300 hover:text-red-600 text-xs px-1"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </th>
                  {dates.map(d => {
                    const tone = d === matricula && grupo === "presencial" && i === 0 && !cellLabel(sessoes, d, linha)
                      ? "matricula"
                      : cellTone(sessoes, d, linha);
                    const label = d === matricula && tone === "matricula" ? "Matrícula" : cellLabel(sessoes, d, linha);
                    return (
                      <td key={`${linha.id}-${d}`} className="relative border border-slate-100 p-0 text-center align-middle">
                        <button
                          type="button"
                          onClick={() => setEvento({ date: d, linha })}
                          className={`block w-8 min-w-8 h-10 px-0.5 text-[9px] font-bold leading-tight ${TONE[tone] ?? TONE.empty} ${d === matricula ? "ring-1 ring-[#15803d]" : ""}`}
                          title={`${formatDiaMes(d)} · ${linhaLabel(linha)}`}
                        >
                          {label}
                        </button>
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
          <button type="button" onClick={() => { setAddLinha(v => !v); setAddErro(""); }} className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
            + Linha de horário
          </button>
          {addLinha && (
            <form
              className="absolute z-30 mt-1 w-[20rem] rounded-xl border border-slate-200 bg-white shadow-lg p-3 space-y-2"
              onSubmit={e => {
                e.preventDefault();
                const precisaHora = novaMod !== "auto";
                const hi = precisaHora ? normHora(novaInicio) : "";
                const hf = precisaHora ? normHora(novaFim) : "";
                if (precisaHora && (!hi || !hf)) {
                  setAddErro("Escolha a hora de início e de fim.");
                  return;
                }
                if (precisaHora && hi >= hf) {
                  setAddErro("A hora de fim tem de ser depois da de início.");
                  return;
                }
                const linha: GrelhaLinha = { id: "", modalidade: novaMod, horaInicio: hi, horaFim: hf };
                linha.id = linhaId(linha);
                if (linhas.some(l => l.id === linha.id)) {
                  setAddErro("Esta linha já existe na grelha. Escolha outro horário.");
                  return;
                }
                setLinhas(xs => [...xs, linha]);
                setAddLinha(false);
                setAddErro("");
              }}
            >
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Metodologia</p>
              <div className="space-y-1">
                {METODOLOGIA_OPTS.map(opt => (
                  <label key={opt.value} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="metodologia"
                      checked={novaMod === opt.value}
                      onChange={() => {
                        setNovaMod(opt.value);
                        const slot = defaultSlot(horario, opt.value);
                        setNovaInicio(slot.horaInicio);
                        setNovaFim(slot.horaFim);
                        setAddErro("");
                      }}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
              {novaMod !== "auto" && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <HoraField label="Início" value={novaInicio} onChange={setNovaInicio} />
                  <HoraField label="Fim" value={novaFim} onChange={setNovaFim} />
                </div>
              )}
              {novaMod === "auto" && (
                <p className="text-[11px] text-slate-500">O e-learning não tem hora de sala - ocupa o dia na grelha.</p>
              )}
              {addErro && <p className="text-[11px] text-red-600">{addErro}</p>}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setAddLinha(false)} className="flex-1 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
                  Cancelar
                </button>
                <button type="submit" className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-[#0F172A] text-white hover:bg-slate-800">
                  Adicionar
                </button>
              </div>
            </form>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            imprimirCronogramaEna({
              horario,
              curso,
              matricula,
              inicio,
              fim: fim || dates[dates.length - 1],
              local: localMapeado,
              dates,
              linhas,
              sessoes,
            });
          }}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        >
          Imprimir / PDF
        </button>
      </div>

      {evento && (
        <EventoModal
          date={evento.date}
          linha={evento.linha}
          sessoes={sessoes}
          horario={horario}
          moduloOpts={moduloOpts}
          formador={formador}
          onClose={() => setEvento(null)}
          onApply={aplicarEventoGrelha}
        />
      )}

      <p className="text-[11px] text-slate-500 px-1">
        Clique num dia (número ou célula) para adicionar um evento ou marcar o limite de entrega / avaliação de um módulo.
        Clicar num evento já marcado abre-o preenchido para edição. Se o horário ainda não existir, a grelha cria uma linha nova.
      </p>

      <ul className="text-[11px] text-slate-600 space-y-1 px-1">
        <li className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-sm bg-[#15803d]" /> Data limite de matrícula e instruções de início (email)</li>
        <li className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-sm bg-[#a60000]" /> Aulas presenciais em sala, por módulo</li>
        <li className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-sm bg-[#1d4ed8]" /> Sessão síncrona em vídeo-conferência</li>
        <li className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-sm bg-slate-300" /> E-learning / auto-aprendizagem</li>
        <li className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-sm bg-amber-400" /> Data limite de avaliação do(s) módulo(s)</li>
      </ul>
    </div>
  );
}
