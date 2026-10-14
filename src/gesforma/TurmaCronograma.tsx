import { SESSAO_MODALIDADE_OPTS } from "../partilhado/cronogramaGrelha";

import { MultiSearchSelect } from "../partilhado/FormKit";

import { useFormadoresTodos, useOpcoesFormador } from "../partilhado/dados/comuns";

import { sessaoCabeNoSlot } from "../partilhado/disponibilidade";
import { formadorIndisponivel } from "../partilhado/sessaoAcesso";
import { formatDiaMes, formatHoraRange, formadoresLabel, modulosLabel, sessaoDuracaoHoras, sessaoFormadores, sessaoModalidade, sessaoModulos, weekdayShort, type SessaoCronograma, type SessaoEstado } from "../partilhado/turmaModel";

const iCls = "w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent";

const ESTADO_UI: Record<SessaoEstado, { label: string; cls: string }> = {
  realizada: { label: "Realizada", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  hoje: { label: "Hoje", cls: "bg-amber-100 text-amber-800 border-amber-200" },
  proxima: { label: "Próxima", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  agendada: { label: "Agendada", cls: "bg-white text-slate-600 border-slate-200" },
  "por-agendar": { label: "Por agendar", cls: "bg-orange-50 text-orange-700 border-orange-200" },
};

export function TurmaActivaToggle({
  activa, onChange, accent = "gold", compact = false, light = false,
}: {
  activa: boolean;
  onChange: (v: boolean) => void;
  accent?: "gold" | "fin";
  compact?: boolean;
  light?: boolean;
}) {
  const on = accent === "gold" ? "bg-emerald-500" : "bg-emerald-500";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activa}
      onClick={() => onChange(!activa)}
      className={`flex items-center gap-2 text-left ${compact ? "" : "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 hover:bg-slate-100"}`}
    >
      <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${activa ? on : "bg-slate-300"}`}>
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${activa ? "translate-x-4.5" : "translate-x-0.5"}`} />
      </span>
      <span className="min-w-0">
        <span className={`block text-xs font-bold ${light ? (activa ? "text-emerald-300" : "text-slate-300") : (activa ? "text-emerald-700" : "text-slate-500")}`}>{activa ? "Liberada" : "Não liberada"}</span>
        {!compact && (
          <span className="block text-xs text-slate-500 leading-snug">
            {activa
              ? "Visível na pré-inscrição (site e WhatsApp) para este curso + local + horário + data."
              : "Fechada a novas pré-inscrições. Os formandos já inscritos mantêm-se."}
          </span>
        )}
      </span>
    </button>
  );
}

export function TurmaInactivaBanner({ nome, onActivate }: { nome: string; onActivate?: () => void }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1">
        <p className="text-sm font-bold text-slate-800">Turma inativa</p>
        <p className="text-xs text-slate-500 mt-0.5">
          {nome} não está libertada: não aparece na pré-inscrição (site nem WhatsApp) nem na conversão de pré-inscrições. Não é possível adicionar ou mover formandos para aqui.
        </p>
      </div>
      {onActivate && (
        <button onClick={onActivate} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 whitespace-nowrap">
          Ativar turma
        </button>
      )}
    </div>
  );
}

export function IconPlus() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  );
}

function IconChev({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}>
      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  );
}

export function KpiCard({
  label, value, hint, bar, accent = "gold",
}: {
  label: string;
  value: string;
  hint?: string;
  bar?: number;
  accent?: "gold" | "fin";
}) {
  const fill = accent === "gold" ? "bg-amber-500" : "bg-blue-600";
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-xl font-bold text-slate-800 mt-1 leading-tight truncate">{value}</p>
      {hint && <p className="text-xs text-slate-500 mt-0.5 truncate">{hint}</p>}
      {typeof bar === "number" && (
        <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div className={`h-full rounded-full ${bar > 100 ? "bg-red-500" : fill}`} style={{ width: `${Math.min(100, Math.max(0, bar))}%` }} />
        </div>
      )}
    </div>
  );
}

export function SessaoRow({
  n, sessao, estado, gold, expanded, onToggle, onPatch, onRemove, moduloOpts, formadoresTurma, cronogramaDesta, outras,
}: {
  n: number;
  sessao: SessaoCronograma;
  estado: SessaoEstado;
  gold: boolean;
  expanded: boolean;
  onToggle: () => void;
  onPatch: (p: Partial<SessaoCronograma>) => void;
  onRemove: () => void;
  moduloOpts: { value: string; sub?: string }[];
  formadoresTurma: string[];
  cronogramaDesta: SessaoCronograma[];
  /** Sessões dos mesmos formadores noutras turmas. */
  outras: { cronograma: SessaoCronograma[] }[];
}) {
  const chip = ESTADO_UI[estado];
  const horas = sessaoDuracaoHoras(sessao);
  const catalogo = useOpcoesFormador(sessaoFormadores(sessao), gold ? "gold" : "fin");
  const formadores = useFormadoresTodos();
  const pool = formadoresTurma.length
    ? catalogo.filter(o => formadoresTurma.some(n => n.toLowerCase() === o.value.toLowerCase()))
    : catalogo;
  const formadorOpts = pool.map(o => {
    const overlap = formadorIndisponivel(o.value, sessao.data, sessao.horaInicio, sessao.horaFim, [{ cronograma: cronogramaDesta }, ...outras], { id: sessao.id, cronograma: cronogramaDesta });
    const ficha = formadores.find(f => f.nome.toLowerCase() === o.value.toLowerCase());
    const foraSlot = gold && Boolean(ficha) && !sessaoCabeNoSlot(sessao.data, sessao.horaInicio, sessao.horaFim, ficha?.disponibilidade);
    if (!overlap && !foraSlot) return o;
    return { ...o, disabled: true, sub: foraSlot && !overlap ? "Fora da disponibilidade CCP" : "Indisponível neste horário" };
  });
  const ring = estado === "proxima" || estado === "hoje"
    ? gold ? "ring-1 ring-amber-200 bg-amber-50/40" : "ring-1 ring-blue-200 bg-blue-50/40"
    : estado === "realizada" ? "opacity-80" : "";

  return (
    <div className={`rounded-xl border border-slate-200 bg-white ${ring} ${expanded ? "relative z-20" : "relative z-0"}`}>
      <div className="flex items-stretch gap-0">
        <button
          type="button"
          onClick={onToggle}
          className="flex-1 min-w-0 text-left px-3 py-3 sm:px-4 grid grid-cols-[auto_1fr] sm:grid-cols-[auto_auto_1fr_auto] gap-3 items-center"
        >
          <span className={`w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 ${gold ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"}`}>
            {n}
          </span>
          <div className="min-w-0 sm:w-[7.5rem]">
            <div className="flex items-center gap-1.5">
              <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${gold ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>
                {weekdayShort(sessao.data)}
              </span>
              <span className="text-sm font-semibold text-slate-800">{formatDiaMes(sessao.data)}</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {formatHoraRange(sessao.horaInicio, sessao.horaFim)}
              {horas > 0 ? ` · ${horas % 1 === 0 ? horas : horas.toFixed(1)}h` : ""}
            </p>
          </div>
          <div className="min-w-0 col-span-2 sm:col-span-1 sm:pl-2">
            <p className="text-sm font-medium text-slate-800 truncate">{modulosLabel(sessaoModulos(sessao))}</p>
            <p className="text-xs text-slate-500 truncate">{formadoresLabel(sessaoFormadores(sessao))}</p>
          </div>
          <span className={`hidden sm:inline-flex text-[11px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${chip.cls}`}>
            {chip.label}
          </span>
        </button>
        <div className="flex items-center gap-0.5 pr-2">
          <span className={`sm:hidden text-[10px] font-semibold px-1.5 py-0.5 rounded-full border whitespace-nowrap ${chip.cls}`}>{chip.label}</span>
          <button type="button" onClick={onToggle} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg" aria-expanded={expanded} aria-label={expanded ? "Fechar edição" : "Editar sessão"}>
            <IconChev open={expanded} />
          </button>
          <button type="button" title="Remover sessão" onClick={onRemove} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
            <IconTrash />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="px-3 pb-3 sm:px-4 sm:pb-4 border-t border-slate-100 pt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="col-span-2 sm:col-span-4">
            <span className="block text-[11px] font-semibold text-slate-500 mb-1">Metodologia da sessão</span>
            <div className="flex flex-wrap gap-1.5">
              {SESSAO_MODALIDADE_OPTS.map(opt => {
                const on = sessaoModalidade(sessao) === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onPatch(opt.value === "auto"
                      ? { modalidade: opt.value, horaInicio: "", horaFim: "" }
                      : { modalidade: opt.value })}
                    className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border ${on
                      ? gold ? "border-amber-400 bg-amber-50 text-amber-800" : "border-blue-400 bg-blue-50 text-blue-800"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {sessaoModalidade(sessao) === "auto" && (
              <p className="text-[11px] text-slate-400 mt-1">
                Sessões assíncronas não ocupam sala nem horas de contacto: passam para a linha de auto-aprendizagem da grelha.
              </p>
            )}
          </div>
          <label className="block">
            <span className="block text-[11px] font-semibold text-slate-500 mb-1">Data</span>
            <input type="date" value={sessao.data} onChange={e => onPatch({ data: e.target.value })} className={iCls} />
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold text-slate-500 mb-1">Início</span>
            <input type="time" value={sessao.horaInicio} onChange={e => onPatch({ horaInicio: e.target.value })} className={iCls} disabled={sessaoModalidade(sessao) === "auto"} />
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold text-slate-500 mb-1">Fim</span>
            <input type="time" value={sessao.horaFim} onChange={e => onPatch({ horaFim: e.target.value })} className={iCls} disabled={sessaoModalidade(sessao) === "auto"} />
          </label>
          <label className="block col-span-2 sm:col-span-4">
            <span className="block text-[11px] font-semibold text-slate-500 mb-1">Formadores desta sessão</span>
            <MultiSearchSelect
              values={sessaoFormadores(sessao)}
              onChange={formadores => onPatch({ formadores })}
              options={formadorOpts}
              placeholder="Pesquisar formador…"
              noneLabel="Selecionar formadores…"
              unitSingular="formador"
              unitPlural="formadores"
            />
            <p className="text-[11px] text-slate-400 mt-1">Só formadores desta turma. Quem já tem sessão neste horário fica indisponível.</p>
          </label>
          <label className="block col-span-2 sm:col-span-4">
            <span className="block text-[11px] font-semibold text-slate-500 mb-1">Módulos desta sessão</span>
            <MultiSearchSelect
              values={sessaoModulos(sessao)}
              onChange={modulos => onPatch({ modulos })}
              options={moduloOpts}
              placeholder="Pesquisar módulo do curso…"
              empty="Não há módulos para este curso."
              noneLabel="Selecionar módulos…"
              unitSingular="módulo"
              unitPlural="módulos"
            />
            <p className="text-[11px] text-slate-400 mt-1">Pode associar mais do que um módulo à mesma sessão.</p>
          </label>
        </div>
      )}
    </div>
  );
}
