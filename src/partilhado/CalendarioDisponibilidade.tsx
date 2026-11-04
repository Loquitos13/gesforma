import { useState } from "react";
import {
  alternarDiaInteiro, comDatasIndisponiveis, datasIndisponiveis, disponibilidadeDoDia, excecoesListaveis, horaCurta,
  juntarHorasNoDia, tirarEntrada, type Intervalo,
} from "./disponibilidade";

const pad = (n: number) => String(n).padStart(2, "0");
const isoDe = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmt = (iso: string) => `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}`;
const faixa = (iv: Intervalo) => `${horaCurta(iv.inicio)}–${horaCurta(iv.fim)}`;
const paraMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return Number.isFinite(h) ? h! * 60 + (Number.isFinite(m) ? m! : 0) : NaN;
};

/**
 * Disponibilidade em calendário mensal: cada dia mostra, com as horas, a verde o que está disponível e a vermelho o que
 * não está (a semana tipo, com as exceções desse dia). Com edição, um clique num dia abre o painel para marcar o dia
 * inteiro ou horas específicas como indisponíveis (ou horas disponíveis a mais).
 */
export function CalendarioDisponibilidade({
  value, onChange, editavel,
}: {
  value: string[] | undefined;
  onChange?: (next: string[]) => void;
  editavel: boolean;
}) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [aberto, setAberto] = useState<string | null>(null);
  const [tipo, setTipo] = useState<"fora" | "livre">("fora");
  const [de, setDe] = useState("09:00");
  const [ate, setAte] = useState("13:00");
  const [periodoDe, setPeriodoDe] = useState("");
  const [periodoAte, setPeriodoAte] = useState("");
  const hoje = isoDe(new Date());
  const disp = value ?? null;
  const mudar = (next: string[]) => { if (editavel) onChange?.(next); };

  const inicioSemana = (cursor.getDay() + 6) % 7;
  const nDias = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells = [...Array<null>(inicioSemana).fill(null), ...Array.from({ length: nDias }, (_, i) => i + 1)];
  const rotuloBase = cursor.toLocaleDateString("pt-PT", { month: "long", year: "numeric" });
  const rotulo = rotuloBase.charAt(0).toUpperCase() + rotuloBase.slice(1);
  const mesIso = `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}`;
  const diaAberto = aberto && aberto.startsWith(mesIso) ? aberto : null;
  const periodos = datasIndisponiveis(disp).filter(p => p.ate !== p.de);

  function juntarHoras() {
    if (!diaAberto) return;
    const a = paraMin(de);
    const b = paraMin(ate === "00:00" ? "24:00" : ate);
    if (!(b > a)) return;
    mudar(juntarHorasNoDia(disp, diaAberto, tipo, a, b));
  }

  function juntarPeriodo() {
    if (!periodoDe) return;
    mudar(comDatasIndisponiveis(disp, [...datasIndisponiveis(disp), { de: periodoDe, ate: periodoAte && periodoAte > periodoDe ? periodoAte : periodoDe }]));
    setPeriodoDe("");
    setPeriodoAte("");
  }

  const doAberto = diaAberto ? disponibilidadeDoDia(disp, diaAberto) : null;
  const excecoes = diaAberto ? excecoesListaveis(disp, diaAberto) : [];
  const periodoDoAberto = diaAberto ? periodos.find(p => diaAberto >= p.de && diaAberto <= p.ate) : undefined;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2.5 space-y-2">
      <div className="flex items-center justify-center">
        <div className="flex items-center gap-1">
          <button type="button" className="px-2 py-0.5 text-xs rounded border border-slate-200" aria-label="Mês anterior" onClick={() => setCursor(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>‹</button>
          <span className="text-xs font-semibold text-slate-700 min-w-[8rem] text-center">{rotulo}</span>
          <button type="button" className="px-2 py-0.5 text-xs rounded border border-slate-200" aria-label="Mês seguinte" onClick={() => setCursor(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>›</button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-[10px] font-semibold text-slate-400">
        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map(d => <span key={d} className="text-center">{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((dia, i) => {
          if (!dia) return <div key={`v-${i}`} />;
          const iso = `${mesIso}-${pad(dia)}`;
          const { disponivel, indisponivel, diaInteiro } = disponibilidadeDoDia(disp, iso);
          const domingo = new Date(`${iso}T12:00:00`).getDay() === 0;
          // Sem nada disponível num dia de semana (ou marcado todo o dia): vermelho. O domingo, sem nada, fica neutro.
          const todoVermelho = diaInteiro || (!disponivel.length && !indisponivel.length && !domingo);
          const passado = iso < hoje;
          const fundo = todoVermelho
            ? "border-red-200 bg-red-50"
            : disponivel.length
              ? indisponivel.length ? "border-amber-200 bg-white" : "border-emerald-200 bg-emerald-50/60"
              : indisponivel.length ? "border-red-200 bg-red-50" : "border-slate-100 bg-slate-50/50";
          return (
            <button
              key={iso}
              type="button"
              onClick={() => setAberto(a => (a === iso ? null : iso))}
              className={`min-h-[64px] rounded-md border px-0.5 sm:px-1 py-0.5 text-left align-top ${fundo} ${passado ? "opacity-60" : ""} ${
                iso === diaAberto ? "outline outline-2 outline-offset-1 outline-slate-800" : ""} ${iso === hoje ? "ring-2 ring-amber-400" : ""}`}
              aria-label={`${fmt(iso)}: ${todoVermelho ? "indisponível" : [
                ...disponivel.map(iv => `disponível ${faixa(iv)}`), ...indisponivel.map(iv => `indisponível ${faixa(iv)}`)].join(", ") || "sem horário"}`}
            >
              <span className="block text-[10px] font-semibold text-slate-500">{dia}</span>
              {todoVermelho ? (
                <span className="mt-0.5 block rounded bg-red-500 px-0.5 text-[9px] font-semibold leading-tight text-white truncate">
                  <span className="hidden sm:inline">Indisponível</span><span className="sm:hidden">✕</span>
                </span>
              ) : (
                [...disponivel.map(iv => ({ iv, ok: true })), ...indisponivel.map(iv => ({ iv, ok: false }))]
                  .sort((a, b) => a.iv.inicio - b.iv.inicio)
                  .map(({ iv, ok }) => (
                    <span
                      key={`${ok}-${iv.inicio}`}
                      className={`mt-0.5 block rounded px-0.5 text-[9px] font-semibold leading-tight tabular-nums truncate ${ok ? "bg-emerald-500 text-white" : "bg-red-500 text-white"}`}
                      title={`${ok ? "Disponível" : "Indisponível"} ${faixa(iv)}`}
                    >
                      <span className="hidden sm:inline">{faixa(iv)}</span>
                      <span className="sm:hidden">{horaCurta(iv.inicio)}</span>
                    </span>
                  ))
              )}
            </button>
          );
        })}
      </div>
      <p className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />Disponível</span>
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-red-500" />Indisponível</span>
        <span className="text-slate-400">{editavel ? "Clique num dia para marcar o dia inteiro ou horas específicas." : "Clique num dia para ver o detalhe."}</span>
      </p>

      {diaAberto && doAberto && (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-2 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-700">{fmt(diaAberto)}</p>
            <button type="button" className="text-xs text-slate-500 hover:text-slate-800" onClick={() => setAberto(null)} aria-label="Fechar">×</button>
          </div>
          <div className="flex flex-wrap gap-1">
            {doAberto.disponivel.map(iv => <span key={`d${iv.inicio}`} className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-900">Disponível {faixa(iv)}</span>)}
            {doAberto.indisponivel.map(iv => <span key={`i${iv.inicio}`} className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-900">Indisponível {faixa(iv)}</span>)}
            {!doAberto.disponivel.length && !doAberto.indisponivel.length && <span className="text-[11px] text-slate-500">Sem horário disponível neste dia.</span>}
          </div>
          {periodoDoAberto && (
            <p className="text-[11px] text-red-800">
              Faz parte do período indisponível de {fmt(periodoDoAberto.de)} a {fmt(periodoDoAberto.ate)}.
              {editavel && <button type="button" className="ml-1 font-semibold underline" onClick={() => mudar(comDatasIndisponiveis(disp, datasIndisponiveis(disp).filter(p => !(p.de === periodoDoAberto.de && p.ate === periodoDoAberto.ate))))}>Tirar o período</button>}
            </p>
          )}
          {excecoes.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {excecoes.map(x => (
                <li key={x.entrada} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${x.tipo === "fora" ? "border-red-200 bg-white text-red-900" : "border-emerald-200 bg-white text-emerald-900"}`}>
                  {x.texto}
                  {editavel && <button type="button" aria-label={`Tirar: ${x.texto}`} className="font-semibold" onClick={() => mudar(tirarEntrada(disp, x.entrada))}>×</button>}
                </li>
              ))}
            </ul>
          )}
          {editavel && !periodoDoAberto && (
            <div className="space-y-2">
              <button type="button" onClick={() => mudar(alternarDiaInteiro(disp, diaAberto))}
                className={`rounded border px-3 py-1 text-xs font-semibold ${doAberto.diaInteiro ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-red-300 bg-red-50 text-red-800"}`}>
                {doAberto.diaInteiro ? "Voltar a ficar disponível neste dia" : "Indisponível todo o dia"}
              </button>
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-[11px] text-slate-500">Marcar
                  <select value={tipo} onChange={e => setTipo(e.target.value as "fora" | "livre")} className="block rounded border border-slate-300 px-2 py-1 text-xs">
                    <option value="fora">Indisponível</option>
                    <option value="livre">Disponível</option>
                  </select>
                </label>
                <label className="text-[11px] text-slate-500">Das<input type="time" step={900} value={de} onChange={e => setDe(e.target.value)} className="block rounded border border-slate-300 px-2 py-1 text-xs" /></label>
                <label className="text-[11px] text-slate-500">Às<input type="time" step={900} value={ate} onChange={e => setAte(e.target.value)} className="block rounded border border-slate-300 px-2 py-1 text-xs" /></label>
                <button type="button" onClick={juntarHoras} disabled={!(paraMin(ate === "00:00" ? "24:00" : ate) > paraMin(de))}
                  className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40">Juntar</button>
              </div>
            </div>
          )}
        </div>
      )}

      {(editavel || periodos.length > 0) && (
        <div className="border-t border-slate-100 pt-2 space-y-1.5">
          <p className="text-[11px] font-semibold text-slate-600">Períodos indisponíveis (ex.: férias)</p>
          {periodos.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {periodos.map(p => (
                <li key={`${p.de}-${p.ate}`} className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[11px] text-red-900">
                  {fmt(p.de)} a {fmt(p.ate)}
                  {editavel && <button type="button" aria-label={`Tirar ${fmt(p.de)} a ${fmt(p.ate)}`} onClick={() => mudar(comDatasIndisponiveis(disp, datasIndisponiveis(disp).filter(q => !(q.de === p.de && q.ate === p.ate))))}>×</button>}
                </li>
              ))}
            </ul>
          )}
          {editavel && (
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-[11px] text-slate-500">De<input type="date" value={periodoDe} onChange={e => setPeriodoDe(e.target.value)} className="block rounded border border-slate-300 px-2 py-1 text-xs" /></label>
              <label className="text-[11px] text-slate-500">Até<input type="date" value={periodoAte} min={periodoDe || undefined} onChange={e => setPeriodoAte(e.target.value)} className="block rounded border border-slate-300 px-2 py-1 text-xs" /></label>
              <button type="button" disabled={!periodoDe} onClick={juntarPeriodo} className="rounded border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40">Juntar</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
