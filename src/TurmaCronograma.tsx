import { useMemo, useState } from "react";
import { MultiSearchSelect, SearchSelect, formadoresOptsWith, modulosOptsForCurso } from "./FormKit";
import {
  CRONOGRAMA_HOJE,
  emptySessao,
  formatDiaMes,
  formatHoraRange,
  formatMesAno,
  formadoresNasSessoes,
  generateCronograma,
  groupCronogramaByMonth,
  horasCronograma,
  modulosLabel,
  periodoCronograma,
  proximaSessao,
  sessaoDuracaoHoras,
  sessaoEstado,
  sessaoModulos,
  weekdayShort,
  type SessaoCronograma,
  type SessaoEstado,
} from "./turmaModel";

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
        <span className={`block text-xs font-bold ${light ? (activa ? "text-emerald-300" : "text-slate-300") : (activa ? "text-emerald-700" : "text-slate-500")}`}>{activa ? "Ativa" : "Inativa"}</span>
        {!compact && (
          <span className="block text-xs text-slate-500 leading-snug">
            {activa ? "Aceita novas inscrições de formandos." : "Fechada a novas inscrições. Os formandos já inscritos mantêm-se."}
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
          {nome} não aparece nas inscrições nem na conversão de pré-inscritos. Não é possível adicionar ou mover formandos para aqui.
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

function IconCalendar() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
    </svg>
  );
}

function IconPlus() {
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

function KpiCard({
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

function SessaoRow({
  n, sessao, estado, gold, expanded, onToggle, onPatch, onRemove, moduloOpts,
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
}) {
  const chip = ESTADO_UI[estado];
  const horas = sessaoDuracaoHoras(sessao);
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
            <p className="text-xs text-slate-500 truncate">{sessao.formador || "Formador por definir"}</p>
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
          <label className="block">
            <span className="block text-[11px] font-semibold text-slate-500 mb-1">Data</span>
            <input type="date" value={sessao.data} onChange={e => onPatch({ data: e.target.value })} className={iCls} />
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold text-slate-500 mb-1">Início</span>
            <input type="time" value={sessao.horaInicio} onChange={e => onPatch({ horaInicio: e.target.value })} className={iCls} />
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold text-slate-500 mb-1">Fim</span>
            <input type="time" value={sessao.horaFim} onChange={e => onPatch({ horaFim: e.target.value })} className={iCls} />
          </label>
          <label className="block col-span-2 sm:col-span-2">
            <span className="block text-[11px] font-semibold text-slate-500 mb-1">Formador</span>
            <SearchSelect
              value={sessao.formador}
              onChange={v => onPatch({ formador: v })}
              options={formadoresOptsWith(sessao.formador)}
              placeholder="Pesquisar formador…"
              allowEmpty
            />
          </label>
          <label className="block col-span-2 sm:col-span-4">
            <span className="block text-[11px] font-semibold text-slate-500 mb-1">Módulos desta sessão</span>
            <MultiSearchSelect
              values={sessaoModulos(sessao)}
              onChange={modulos => onPatch({ modulos })}
              options={moduloOpts}
              placeholder="Pesquisar módulo do curso…"
              empty="Não há módulos para este curso."
            />
            <p className="text-[11px] text-slate-400 mt-1">Pode associar mais do que um módulo à mesma sessão.</p>
          </label>
        </div>
      )}
    </div>
  );
}

export function CronogramaEditor({
  sessoes, onChange, inicio, horario, horas, formador, curso, accent = "gold",
  layout = "compact",
}: {
  sessoes: SessaoCronograma[];
  onChange: (next: SessaoCronograma[]) => void;
  inicio: string;
  horario: string;
  horas: number;
  formador: string;
  curso?: string;
  accent?: "gold" | "fin";
  layout?: "page" | "compact";
}) {
  const gold = accent === "gold";
  const page = layout === "page";
  const moduloOpts = useMemo(() => modulosOptsForCurso(curso), [curso]);
  const totalH = Math.round(horasCronograma(sessoes) * 10) / 10;
  const next = proximaSessao(sessoes);
  const periodo = periodoCronograma(sessoes);
  const groups = useMemo(() => groupCronogramaByMonth(sessoes), [sessoes]);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const btn = gold ? "bg-amber-500 hover:bg-amber-600 text-white" : "bg-blue-600 hover:bg-blue-700 text-white";
  const ghost = gold ? "border-amber-200 text-amber-800 hover:bg-amber-50" : "border-blue-200 text-blue-800 hover:bg-blue-50";
  const soft = gold ? "bg-amber-50 text-amber-800 border-amber-100" : "bg-blue-50 text-blue-800 border-blue-100";

  function aplicarGerado() {
    if (!inicio) return;
    onChange(generateCronograma({ inicio, horario, horas, formador, curso }));
    setConfirmRegen(false);
    setOpenId(null);
  }

  function pedirGerar() {
    if (!inicio) return;
    if (sessoes.length) setConfirmRegen(true);
    else aplicarGerado();
  }

  function patch(id: string, p: Partial<SessaoCronograma>) {
    onChange(sessoes.map(s => s.id === id ? { ...s, ...p } : s));
  }

  function addSessao() {
    const nova = emptySessao(formador);
    onChange([...sessoes, nova]);
    setOpenId(nova.id);
  }

  const kpiGrid = (
    <div className={`grid gap-3 ${page ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2"}`}>
      <KpiCard accent={accent} label="Sessões" value={String(sessoes.length)} hint={sessoes.length ? `${groups.length} ${groups.length === 1 ? "mês" : "meses"} no plano` : "Ainda por gerar"} />
      <KpiCard
        accent={accent}
        label="Horas"
        value={horas ? `${totalH}/${horas}h` : `${totalH}h`}
        hint={horas ? (totalH >= horas ? "Carga do curso coberta" : `Faltam ${Math.max(0, Math.round((horas - totalH) * 10) / 10)}h`) : "Sem carga definida"}
        bar={horas ? (totalH / horas) * 100 : undefined}
      />
      {page && (
        <>
          <KpiCard
            accent={accent}
            label="Próxima sessão"
            value={next ? formatDiaMes(next.data) : "—"}
            hint={next ? `${formatHoraRange(next.horaInicio, next.horaFim)} · ${modulosLabel(sessaoModulos(next))}` : "Sem sessões futuras"}
          />
          <KpiCard
            accent={accent}
            label="Período"
            value={periodo ? `${formatDiaMes(periodo.inicio)} – ${formatDiaMes(periodo.fim)}` : "—"}
            hint={periodo ? `${formatMesAno(periodo.inicio)}${periodo.inicio.slice(0, 7) !== periodo.fim.slice(0, 7) ? ` → ${formatMesAno(periodo.fim)}` : ""}` : "Defina datas nas sessões"}
          />
        </>
      )}
    </div>
  );

  const actions = (
    <div className="flex gap-2 flex-shrink-0 flex-wrap">
      <button type="button" onClick={pedirGerar} disabled={!inicio} className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg ${btn} disabled:opacity-40`}>
        {sessoes.length ? "Regenerar plano" : "Gerar cronograma"}
      </button>
      <button type="button" onClick={addSessao} className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border bg-white ${ghost}`}>
        <IconPlus /> Sessão
      </button>
    </div>
  );

  return (
    <div className={page ? "space-y-4" : "space-y-3"}>
      <div className={`flex flex-col sm:flex-row sm:items-start justify-between gap-3 ${page ? "bg-white rounded-xl border border-slate-200 px-4 py-4" : ""}`}>
        <div className="min-w-0">
          <p className={page ? "text-base font-bold text-slate-800" : "text-xs font-bold text-slate-500 uppercase tracking-wider"}>
            {page ? "Plano de sessões" : "Cronograma"}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {sessoes.length === 0
              ? "Gere o plano a partir da data de início e do horário da turma, ou adicione sessões à mão."
              : page
                ? "Clique numa sessão para ajustar data, horário, módulo ou formador. Regenerar substitui o plano atual."
                : `${sessoes.length} sessões · ${totalH}h calendarizadas${horas ? ` de ${horas}h` : ""}`}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {horario && <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${soft}`}>{horario}</span>}
            {inicio && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-600">Início {formatDiaMes(inicio)}</span>}
            {formador && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-600">{formador}</span>}
          </div>
        </div>
        {actions}
      </div>

      {confirmRegen && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-amber-900">Substituir o cronograma atual?</p>
            <p className="text-xs text-amber-800 mt-0.5">
              As {sessoes.length} sessões existentes são apagadas e geradas de novo a partir de {inicio ? formatDiaMes(inicio) : "a data de início"} · {horario || "horário da turma"}.
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button type="button" onClick={() => setConfirmRegen(false)} className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-amber-200 bg-white text-amber-900 hover:bg-amber-100">
              Cancelar
            </button>
            <button type="button" onClick={aplicarGerado} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700">
              Regenerar
            </button>
          </div>
        </div>
      )}

      {sessoes.length > 0 && kpiGrid}

      {sessoes.length === 0 ? (
        <div className={`rounded-xl border border-dashed border-slate-200 bg-white px-5 ${page ? "py-12" : "py-8"} text-center`}>
          <div className={`mx-auto mb-3 w-11 h-11 rounded-2xl flex items-center justify-center ${gold ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600"}`}>
            <IconCalendar />
          </div>
          <p className="text-sm font-semibold text-slate-800">Ainda não há sessões neste plano</p>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {inicio
              ? `Vamos marcar sessões de ${horario || "horário da turma"} a partir de ${formatDiaMes(inicio)}${horas ? `, até cobrir cerca de ${horas}h` : ""}. Sem cronograma a turma pode ficar ativa, mas o cockpit de sessões fica vazio.`
              : "Defina primeiro a data de início da turma. Depois pode gerar o plano ou adicionar a primeira sessão."}
          </p>
          <div className="flex justify-center gap-2 mt-4">
            <button type="button" onClick={pedirGerar} disabled={!inicio} className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg ${btn} disabled:opacity-40`}>
              Gerar cronograma
            </button>
            <button type="button" onClick={addSessao} className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border bg-white ${ghost}`}>
              <IconPlus /> Sessão manual
            </button>
          </div>
        </div>
      ) : (
        <div className={page ? "space-y-4" : "max-h-80 overflow-y-auto space-y-3 pr-0.5"}>
          {groups.map(g => (
            <section key={g.key} className="space-y-2">
              <div className="flex items-center gap-2 px-0.5">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{g.label}</p>
                <span className="text-[11px] text-slate-400">{g.items.length} {g.items.length === 1 ? "sessão" : "sessões"}</span>
                <span className="flex-1 h-px bg-slate-200" />
              </div>
              <div className="space-y-2">
                {g.items.map(({ sessao, n }) => (
                  <SessaoRow
                    key={sessao.id}
                    n={n}
                    sessao={sessao}
                    estado={sessaoEstado(sessao, CRONOGRAMA_HOJE, next?.id)}
                    gold={gold}
                    expanded={openId === sessao.id}
                    onToggle={() => setOpenId(id => id === sessao.id ? null : sessao.id)}
                    moduloOpts={moduloOpts}
                    onPatch={p => patch(sessao.id, p)}
                    onRemove={() => {
                      onChange(sessoes.filter(x => x.id !== sessao.id));
                      if (openId === sessao.id) setOpenId(null);
                    }}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export function FormadoresAtribuidosCard({
  sessoes, fallback, onOpen,
}: {
  sessoes: SessaoCronograma[];
  fallback?: string;
  onOpen?: (nome: string) => void;
}) {
  const lista = formadoresNasSessoes(sessoes, fallback);
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Formadores</p>
        <p className="text-xs text-slate-500 mt-0.5">
          {lista.length === 0
            ? "Ninguém atribuído nas sessões"
            : lista.length === 1
              ? "1 formador nas sessões desta turma"
              : `${lista.length} formadores nas sessões desta turma`}
        </p>
      </div>
      {lista.length === 0 ? (
        <p className="px-4 py-6 text-xs text-slate-400">Atribua formadores no cronograma. A lista aparece aqui automaticamente.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {lista.map(f => {
            const opt = formadoresOptsWith(f.nome).find(o => o.value === f.nome);
            const inicial = f.nome.trim().charAt(0).toUpperCase() || "?";
            return (
              <li key={f.nome} className="px-4 py-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-violet-700 font-bold flex-shrink-0">{inicial}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800 truncate">{f.nome}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {f.sessoes === 0 ? "Formador da turma" : f.sessoes === 1 ? "1 sessão" : `${f.sessoes} sessões`}
                    {opt?.sub ? ` · ${opt.sub}` : ""}
                  </p>
                </div>
                {onOpen && (
                  <button type="button" onClick={() => onOpen(f.nome)} className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 whitespace-nowrap">
                    Ver perfil
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function TurmaInscricaoHint({ optsLen, curso }: { optsLen: number; curso?: string }) {
  if (optsLen > 0) return null;
  return (
    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
      {curso
        ? `Não há turmas ativas para «${curso}». Ative uma turma existente ou crie uma nova.`
        : "Não há turmas ativas. Só turmas ativas aceitam novas inscrições."}
    </p>
  );
}
