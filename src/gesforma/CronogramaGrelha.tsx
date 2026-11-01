import { useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { SearchSelect } from "../partilhado/FormKit";

import { type GrelhaLinha, sessoesSemFim, aplicarEvento, buildLinha, defaultSlot, diasDaRepeticao, eventosDoDia, EVENTO_OPTS, linhaLabel, normHora, preencherIntervalo, type EventoDia, type Repeticao } from "../partilhado/cronogramaGrelha";

import { somarMinutos, textoDeMinutos } from "../partilhado/duracaoSessao";
import { SEM_PLANO, atribuirPlanos, planoDaSessao } from "../partilhado/planosModulo";
import { nomesDosPlanos, type PlanoCurso } from "./planosCurso";
import { type SessaoModalidade, isSessaoLectiva, casarModulo, codigoModulo, formatDiaMes, ordenarCodigos, ordenarModulos, sessaoModulos, type SessaoCronograma } from "../partilhado/turmaModel";

export function HoraField({
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
  // De 5 em 5 minutos (ex.: 10:50); um valor já gravado fora disso continua na lista.
  const mins = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));
  if (m && !mins.includes(m)) mins.push(m);
  mins.sort();
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold text-slate-500 mb-1">{label}</span>
      <div className="flex items-center gap-1">
        <div className="flex-1">
          <SearchSelect value={h ?? "09"} onChange={v => onChange(`${v}:${m}`)} options={hours.map(x => ({ value: x, sub: "horas" }))} />
        </div>
        <span className="text-slate-400 text-xs">:</span>
        <div className="flex-1">
          <SearchSelect value={m ?? "00"} onChange={v => onChange(`${h}:${v}`)} options={mins.map(x => ({ value: x, sub: "minutos" }))} />
        </div>
      </div>
    </label>
  );
}

const DIA_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export const TONE: Record<string, string> = {
  presencial: "bg-[#a60000] text-white",
  sincrona: "bg-[#1d4ed8] text-white",
  auto: "bg-slate-200 text-slate-700",
  avaliacao: "bg-[#e00000] text-white",
  matricula: "bg-[#15803d] text-white",
  empty: "bg-white hover:bg-slate-50 text-slate-400",
};

/** Gold (modelo do CCP): aulas presenciais a amarelo. As datas limite de avaliação são sempre a vermelho. */
export const TONE_GOLD: Record<string, string> = {
  ...TONE,
  presencial: "bg-[#ffc000] text-slate-900",
};

type EventoMod = Exclude<SessaoModalidade, "matricula">;

type EventoForm = {
  /** Plano da ficha do curso com que a sessão é marcada (o `id`; null = personalizada). */
  planoId: string | null;
  mod: EventoMod;
  horaInicio: string;
  horaFim: string;
  modulos: string[];
  formadores: string[];
};

function semHoras(mod: EventoMod) {
  return mod === "auto" || mod === "avaliacao";
}

function modulosDoAlvo(alvo: EventoDia | null, catalogo: string[]) {
  if (!alvo || !catalogo.length) return [];
  const casados = [...new Set(alvo.sessoes.flatMap(sessaoModulos))]
    .map(m => casarModulo(m, catalogo))
    .filter((m): m is string => Boolean(m));
  return ordenarModulos([...new Set(casados)]);
}

function formInicial(alvo: EventoDia | null, linha: GrelhaLinha | undefined, horario: string, catalogo: string[]): EventoForm {
  if (alvo) {
    return {
      planoId: alvo.sessoes.map(planoDaSessao).find(n => n != null) ?? null,
      mod: alvo.linha.modalidade,
      horaInicio: alvo.linha.horaInicio,
      horaFim: alvo.linha.horaFim,
      modulos: modulosDoAlvo(alvo, catalogo),
      formadores: [...new Set(alvo.sessoes.flatMap(s => s.formadores ?? []))],
    };
  }
  const mod = linha?.modalidade ?? "presencial";
  const slot = semHoras(mod)
    ? { horaInicio: "", horaFim: "" }
    : linha
      ? { horaInicio: linha.horaInicio, horaFim: linha.horaFim }
      : defaultSlot(horario, mod);
  return { planoId: null, mod, horaInicio: slot.horaInicio, horaFim: slot.horaFim, modulos: [], formadores: [] };
}

/** Planos da ficha do curso ainda sem sessão no cronograma (o `atual` conta como livre: é o do evento aberto). */
export function planosPorAgendar(planos: PlanoCurso[], sessoes: SessaoCronograma[], atual: string | null = null) {
  // A mesma regra do servidor: os planos que as aulas já levam (marcados ou livres pelo módulo / número).
  const lectivas = sessoesSemFim(sessoes).filter(isSessaoLectiva);
  const usados = new Set(atribuirPlanos(planos, lectivas).filter((p): p is PlanoCurso => p != null).map(p => p.id));
  if (atual != null) usados.delete(atual);
  return [...planos].sort((a, b) => a.ordem - b.ordem).filter(p => !usados.has(p.id));
}

/** «M2 · Plano 1 · 4h30» (o nome do plano no seu módulo e a duração). */
export function rotuloPlano(p: PlanoCurso, nomes: Map<string, string>) {
  return [nomes.get(p.id) ?? `Plano ${p.ordem}`, p.duracaoMin ? textoDeMinutos(p.duracaoMin) : ""].filter(Boolean).join(" · ");
}

/** O formulário com a sessão do plano: presencial (ou síncrona), os módulos do plano e o fim pela duração. */
function comPlano(f: EventoForm, p: PlanoCurso, horario: string, catalogo: string[]): EventoForm {
  const mod = f.mod === "sincrona" ? "sincrona" : "presencial";
  const horaInicio = normHora(f.horaInicio) || defaultSlot(horario, mod).horaInicio;
  const horaFim = p.duracaoMin ? somarMinutos(horaInicio, p.duracaoMin) : normHora(f.horaFim) || defaultSlot(horario, mod).horaFim;
  return { ...f, planoId: p.id, mod, horaInicio, horaFim, modulos: ordenarModulos(p.modulos.map(m => casarModulo(m, catalogo) ?? m)) };
}

/** A que opção da lista corresponde um módulo já guardado na sessão. */
function opcaoDoModulo(modulo: string, catalogo: string[]) {
  return casarModulo(modulo, catalogo) ?? modulo;
}

function moduloEscolhido(modulos: string[], opcao: string, catalogo: string[]) {
  return modulos.some(m => opcaoDoModulo(m, catalogo) === opcao);
}

function alternarModulo(modulos: string[], opcao: string, catalogo: string[]) {
  const next = moduloEscolhido(modulos, opcao, catalogo)
    ? modulos.filter(m => opcaoDoModulo(m, catalogo) !== opcao)
    : [...modulos, opcao];
  return ordenarModulos(next);
}

/** Horários habituais (e os já usados neste cronograma) para não escrever a hora de cada módulo à mão. */
const HORARIOS_PADRAO: Record<"presencial" | "sincrona", [string, string][]> = {
  presencial: [["09:00", "13:00"], ["09:00", "13:30"], ["11:00", "13:00"], ["14:00", "18:00"], ["19:00", "22:00"], ["19:00", "23:00"]],
  sincrona: [["10:00", "11:30"], ["19:00", "20:30"], ["19:00", "22:00"]],
};

function horariosRapidos(sessoes: SessaoCronograma[], mod: string) {
  const tipo = mod === "sincrona" ? "sincrona" : "presencial";
  const usados = sessoes
    .filter(s => (s.modalidade ?? "presencial") === tipo && s.horaInicio && s.horaFim)
    .map(s => [normHora(s.horaInicio), normHora(s.horaFim)] as [string, string]);
  const vistos = new Set<string>();
  return [...usados, ...HORARIOS_PADRAO[tipo]]
    .filter(([a, b]) => a && b && !vistos.has(`${a}-${b}`) && vistos.add(`${a}-${b}`))
    .sort((x, y) => `${x[0]}${x[1]}`.localeCompare(`${y[0]}${y[1]}`))
    .slice(0, 10)
    .map(([horaInicio, horaFim]) => ({ horaInicio, horaFim }));
}

export function EventoModal({
  date,
  linha,
  sessoes,
  horario,
  moduloOpts,
  unidade = "módulo",
  formador,
  planos = [],
  onClose,
  onApply,
}: {
  date: string;
  linha?: GrelhaLinha;
  sessoes: SessaoCronograma[];
  horario: string;
  moduloOpts: { value: string; sub?: string }[];
  unidade?: string;
  formador?: string;
  /** Planos de sessão da ficha do curso: os que ainda não têm dia aparecem para escolher. */
  planos?: PlanoCurso[];
  onClose: () => void;
  onApply: (next: SessaoCronograma[], extra: GrelhaLinha) => void;
}) {
  const eventos = useMemo(() => eventosDoDia(sessoes, date), [sessoes, date]);
  const inicial = linha
    ? eventos.find(e => e.linha.id === linha.id) ?? null
    : eventos.length === 1 ? eventos[0]! : null;
  const [alvo, setAlvo] = useState<EventoDia | null>(inicial);
  const catalogoInicial = moduloOpts.map(o => o.value);
  // Evento novo num dia: já com a próxima sessão por agendar (se o curso tiver planos).
  const [form, setForm] = useState<EventoForm>(() => {
    const f = formInicial(inicial, linha, horario, catalogoInicial);
    const proxima = !inicial && !semHoras(f.mod) ? planosPorAgendar(planos, sessoes)[0] : undefined;
    return proxima ? comPlano(f, proxima, horario, catalogoInicial) : f;
  });
  const [erro, setErro] = useState("");
  const [aRemover, setARemover] = useState(false);
  // O mesmo evento até outra data, sem ter de marcar os dias um a um: o e-learning todos os dias, uma sessão
  // presencial ou síncrona por omissão uma vez por semana (no mesmo dia da semana).
  const [ate, setAte] = useState("");
  const [repeticao, setRepeticao] = useState<Repeticao>(() => (formInicial(inicial, linha, horario, catalogoInicial).mod === "auto" ? "dias" : "semanal"));
  const editing = Boolean(alvo);
  const catalogo = useMemo(() => moduloOpts.map(o => o.value), [moduloOpts]);
  const opcoes = catalogo;

  const livres = planosPorAgendar(planos, sessoes, form.planoId);
  const planoEscolhido = planos.find(p => p.id === form.planoId) ?? null;
  const nomes = useMemo(() => nomesDosPlanos(planos), [planos]);

  function escolherPlano(p: PlanoCurso | null) {
    setForm(f => (p ? comPlano(f, p, horario, catalogo) : { ...f, planoId: null }));
    setErro("");
  }

  function mudarInicio(v: string) {
    // Com um plano, o fim acompanha o início (a sessão dura o tempo do plano).
    setForm(f => ({ ...f, horaInicio: v, horaFim: planoEscolhido?.duracaoMin ? somarMinutos(normHora(v), planoEscolhido.duracaoMin) : f.horaFim }));
  }

  function abrir(ev: EventoDia | null) {
    setAlvo(ev);
    let f = formInicial(ev, ev ? undefined : linha, horario, catalogo);
    const proxima = !ev && !semHoras(f.mod) ? planosPorAgendar(planos, sessoes)[0] : undefined;
    if (proxima) f = comPlano(f, proxima, horario, catalogo);
    setForm(f);
    if (!ate) setRepeticao(f.mod === "auto" ? "dias" : "semanal");
    setErro("");
    setARemover(false);
  }

  function remover() {
    if (!alvo) return;
    onApply(aplicarEvento(sessoes, date, alvo.linha, null), alvo.linha);
    onClose();
  }

  function escolherMod(next: EventoMod) {
    if (!ate) setRepeticao(next === "auto" ? "dias" : "semanal");
    setForm(f => {
      if (semHoras(next)) return { ...f, planoId: null, mod: next, horaInicio: "", horaFim: "" };
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
    const dados = {
      modulos: ordenarModulos(form.modulos),
      formadores: lectiva
        ? (form.formadores.length ? form.formadores : formador && formador !== "A definir" ? [formador] : [])
        : [],
      modalidade: form.mod,
      // Com planos no curso, a aula «Personalizado» fica marcada («-») para não receber um plano livre ao gravar.
      planoId: form.planoId ?? (planos.length && lectiva ? SEM_PLANO : null),
    };
    if (ate && ate <= date) {
      setErro("A data «Repetir até» tem de ser depois deste dia.");
      return;
    }
    let next = aplicarEvento(sessoes, date, nextLinha, dados, alvo?.linha ?? null);
    if (ate && form.planoId != null) {
      // Com sessões do curso: cada dia seguinte recebe a próxima sessão por agendar, à mesma hora de início.
      for (const d of diasDaRepeticao(date, ate, repeticao).filter(d => d > date)) {
        const p = planosPorAgendar(planos, next)[0];
        if (!p) break;
        const f = comPlano({ ...form, horaInicio: hi, horaFim: hf }, p, horario, catalogo);
        const l = buildLinha(f.mod, f.horaInicio, f.horaFim);
        if (next.some(s => s.data === d && s.horaInicio && normHora(s.horaInicio) < f.horaFim && normHora(s.horaFim) > f.horaInicio)) continue;
        next = aplicarEvento(next, d, l, { ...dados, modulos: f.modulos, planoId: p.id });
      }
    } else if (ate) next = preencherIntervalo(next, date, ate, nextLinha, { ...dados, planoId: null }, repeticao);
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
                const codes = ordenarCodigos(ev.sessoes.flatMap(s => (s.modulos ?? []).map(codigoModulo)));
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
        {planos.length > 0 && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">
              Plano do curso <span className="font-medium normal-case tracking-normal text-slate-400">({planosPorAgendar(planos, sessoes).length} por agendar)</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {livres.map(p => {
                const on = form.planoId === p.id;
                return (
                  <button key={p.ordem} type="button" onClick={() => escolherPlano(p)} title={p.objetivosGerais || undefined}
                    className={`px-2 py-1 text-[11px] font-semibold rounded-lg border ${on ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
                    {rotuloPlano(p, nomes)}
                  </button>
                );
              })}
              <button type="button" onClick={() => escolherPlano(null)}
                className={`px-2 py-1 text-[11px] font-semibold rounded-lg border ${form.planoId == null ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
                Personalizado
              </button>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              {planoEscolhido
                ? `Leva o plano ${nomes.get(planoEscolhido.id) ?? ""}${planoEscolhido.duracaoMin ? `, dura ${textoDeMinutos(planoEscolhido.duracaoMin)}` : ""} e fica com os ${unidade === "capítulo" ? "capítulos" : "módulos"} do plano.`
                : "Personalizado: e-learning / auto-aprendizagem, avaliações ou outra sessão, sem plano do curso."}
            </p>
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
            <HoraField label="Início" value={form.horaInicio} onChange={mudarInicio} />
            <HoraField label="Fim" value={form.horaFim} onChange={v => setForm(f => ({ ...f, horaFim: v }))} />
          </div>
        )}
        {!semHoras(form.mod) && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500">Horários:</span>
            {horariosRapidos(sessoes, form.mod).map(h => {
              const ativo = normHora(form.horaInicio) === h.horaInicio && normHora(form.horaFim) === h.horaFim;
              return (
                <button key={`${h.horaInicio}-${h.horaFim}`} type="button" onClick={() => setForm(f => ({ ...f, ...h }))}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${ativo ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
                  {h.horaInicio}–{h.horaFim}
                </button>
              );
            })}
          </div>
        )}
        {form.mod === "auto" && <p className="text-[11px] text-slate-500">O e-learning não tem hora de sala - ocupa o dia na grelha.</p>}
        <div className="space-y-1 rounded-lg border border-slate-100 bg-slate-50 p-2">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-[11px] font-semibold text-slate-600">Repetir até
              <input type="date" aria-label="Repetir até" value={ate} min={date} onChange={e => { setAte(e.target.value); setErro(""); }}
                className="mt-1 block px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white" />
            </label>
            <label className="text-[11px] font-semibold text-slate-600">Frequência
              <select aria-label="Frequência da repetição" value={repeticao} onChange={e => setRepeticao(e.target.value as Repeticao)}
                className="mt-1 block px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white">
                <option value="semanal">Todas as semanas ({DIA_SEMANA[new Date(`${date}T12:00:00`).getDay()]})</option>
                <option value="uteis">Todos os dias úteis</option>
                <option value="dias">Todos os dias</option>
              </select>
            </label>
            {ate && <button type="button" onClick={() => setAte("")} className="pb-1.5 text-[11px] text-slate-500 underline">Só este dia</button>}
          </div>
          <p className="m-0 text-[11px] text-slate-500">
            {ate && ate > date
              ? form.planoId != null
                ? `Os planos por agendar, um por dia (${diasDaRepeticao(date, ate, repeticao).length} dias), até ${ate.split("-").reverse().join("-")}. Os dias com uma aula à mesma hora são saltados.`
                : `${diasDaRepeticao(date, ate, repeticao).length} dias com este evento, até ${ate.split("-").reverse().join("-")}. Os dias que já o têm ficam como estão.`
              : form.planoId != null
                ? "Opcional: os planos seguintes por agendar, um por dia, à mesma hora de início, até ao dia escolhido."
                : "Opcional: o mesmo evento, com a mesma hora e os mesmos módulos, até ao dia escolhido."}
          </p>
        </div>
        {form.mod === "avaliacao" && (
          <p className="text-[11px] text-slate-500">Marca este dia como limite de entrega de tarefas / avaliação dos módulos escolhidos.</p>
        )}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">
            {unidade === "capítulo" ? "Capítulos" : "Módulos"}{" "}
            <span className="font-medium normal-case tracking-normal text-slate-400">
              {form.mod === "avaliacao" ? "(obrigatório)" : "(opcional, pode ser mais do que um)"}
            </span>
          </p>
          <div className="border border-slate-100 rounded-lg p-2 grid gap-1.5 sm:grid-cols-2">
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
            {!opcoes.length && <p className="text-xs text-slate-400">Defina o programa na ficha do curso para escolher {unidade === "capítulo" ? "capítulos" : "módulos"}.</p>}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Só aparecem na grelha os módulos escolhidos aqui.</p>
        </div>
        {erro && <p className="text-[11px] text-red-600">{erro}</p>}
        <div className="flex flex-wrap gap-2 pt-1">
          {alvo && (
            <button
              type="button"
              onClick={() => setARemover(true)}
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
      {aRemover && alvo && (
        <div
          className="fixed inset-0 z-[90] bg-slate-900/50 flex items-center justify-center p-4"
          onClick={e => { e.stopPropagation(); setARemover(false); }}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div>
              <p className="text-sm font-bold text-slate-800">Remover evento</p>
              <p className="text-xs text-slate-600 mt-1">
                {linhaLabel(alvo.linha)} sai do cronograma em {formatDiaMes(date)}.
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Os módulos marcados neste evento deixam de aparecer na grelha deste dia.</p>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setARemover(false)} className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
                Cancelar
              </button>
              <button type="button" onClick={remover} className="px-5 py-2 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700">
                Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
