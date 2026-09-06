import { emptySessao, generateCronograma, horasCronograma, type SessaoCronograma } from "./turmaModel";

const iCls = "w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent";

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

export function CronogramaEditor({
  sessoes, onChange, inicio, horario, horas, formador, curso, accent = "gold",
}: {
  sessoes: SessaoCronograma[];
  onChange: (next: SessaoCronograma[]) => void;
  inicio: string;
  horario: string;
  horas: number;
  formador: string;
  curso?: string;
  accent?: "gold" | "fin";
}) {
  const gold = accent === "gold";
  const totalH = Math.round(horasCronograma(sessoes) * 10) / 10;
  const btn = gold ? "bg-amber-500 hover:bg-amber-600 text-white" : "bg-blue-600 hover:bg-blue-700 text-white";
  const ghost = gold ? "border-amber-200 text-amber-700 hover:bg-amber-50" : "border-blue-200 text-blue-700 hover:bg-blue-50";

  function gerar() {
    if (!inicio) return;
    onChange(generateCronograma({ inicio, horario, horas, formador, curso }));
  }

  function patch(id: string, p: Partial<SessaoCronograma>) {
    onChange(sessoes.map(s => s.id === id ? { ...s, ...p } : s));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cronograma</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {sessoes.length === 0
              ? "Ainda não há sessões. Gere a partir da data de início e do horário."
              : `${sessoes.length} sessões · ${totalH}h calendarizadas${horas ? ` de ${horas}h` : ""}`}
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button type="button" onClick={gerar} disabled={!inicio} className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${btn} disabled:opacity-40`}>
            {sessoes.length ? "Regenerar" : "Gerar cronograma"}
          </button>
          <button type="button" onClick={() => onChange([...sessoes, emptySessao(formador)])} className={`px-3 py-1.5 text-xs font-semibold rounded-lg border ${ghost}`}>
            + Sessão
          </button>
        </div>
      </div>

      {sessoes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center">
          <p className="text-sm font-semibold text-slate-700">Sem cronograma</p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Defina a data de início e o horário e clique em Gerar. Sem cronograma a turma pode ficar ativa, mas as sessões do cockpit ficam vazias.
          </p>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
            {sessoes.map((s, i) => (
              <div key={s.id} className="p-2.5 grid grid-cols-[1.5rem_1fr_auto] gap-2 items-start">
                <span className={`mt-1.5 w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center ${gold ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>{i + 1}</span>
                <div className="grid grid-cols-2 gap-1.5 min-w-0">
                  <input type="date" value={s.data} onChange={e => patch(s.id, { data: e.target.value })} className={iCls} />
                  <div className="grid grid-cols-2 gap-1.5">
                    <input type="time" value={s.horaInicio} onChange={e => patch(s.id, { horaInicio: e.target.value })} className={iCls} />
                    <input type="time" value={s.horaFim} onChange={e => patch(s.id, { horaFim: e.target.value })} className={iCls} />
                  </div>
                  <input
                    value={s.modulo}
                    onChange={e => patch(s.id, { modulo: e.target.value })}
                    placeholder="Módulo / conteúdo"
                    className={`${iCls} col-span-2`}
                  />
                </div>
                <button type="button" title="Remover sessão" onClick={() => onChange(sessoes.filter(x => x.id !== s.id))} className="mt-1 p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                </button>
              </div>
            ))}
          </div>
        </div>
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
