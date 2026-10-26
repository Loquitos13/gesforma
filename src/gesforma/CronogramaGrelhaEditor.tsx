// Continuação de CronogramaGrelha.tsx (partido para ficar abaixo das 500 linhas).
import { Fragment, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useOpcoes } from "../partilhado/dados/useOpcoes";
import { apiPublicEntidade } from "../partilhado/api/publico";
import { useRecurso } from "../partilhado/dados/useRecurso";
import { useProgramaDoCurso } from "./cursoPrograma";
import { type GrelhaLinha, addDays, cellLabel, cellTone, comFimCronograma, datesFromRange, defaultSlot, dayNum, fimEstavel, grelhaPeriodo, grupoLinha, larguraDiasEmChars, linhaLabel, linhasFromSessoes, mergeLinhas, monthSpans, moverEvento, saltoMatricula, setMatricula, sessoesSemFim, weekdayCode, grelhaTempos, type BlocoTempos, TEMPO_MIN, minutosDaHora, horaDosMinutos, horaOficial, formatHoraFaixa, linhaDaSessao, buildLinha } from "../partilhado/cronogramaGrelha";
import { generateEnaCronograma } from "../partilhado/cronogramaGrelhaGerar";
import { mapLocalTurma, type LocalCatalogo } from "../partilhado/cronogramaLocal";
import { imprimirCronogramaEna } from "../partilhado/cronogramaPrint";
import { codigoInternoTurma } from "../partilhado/turmaCodigo";
import { formatDiaMes, sessaoModalidade, type SessaoCronograma } from "../partilhado/turmaModel";
import { TONE, EventoModal } from "./CronogramaGrelha";

export function CronogramaGrelha({
  sessoes,
  onChange,
  inicio,
  horario,
  horas,
  formador,
  curso,
  nome,
  local,
  accent = "gold",
  compact = false,
  identidade = "",
}: {
  sessoes: SessaoCronograma[];
  onChange: (next: SessaoCronograma[]) => void;
  inicio: string;
  horario: string;
  horas: number;
  formador: string;
  curso?: string;
  nome?: string;
  local?: string;
  accent?: "gold" | "fin";
  compact?: boolean;
  identidade?: string;
}) {
  const programa = useProgramaDoCurso(accent, curso);
  const moduloOpts = programa.options;
  const unidade = programa.unidade.singular;
  const periodo = useMemo(() => grelhaPeriodo(sessoes, inicio), [sessoes, inicio]);
  const [fim, setFim] = useState(periodo.fim);
  const [matricula, setMatriculaDate] = useState(periodo.matricula ?? "");
  const [vista, setVista] = useState(identidade);
  if (identidade !== vista) {
    setVista(identidade);
    setFim(periodo.fim);
    setMatriculaDate(periodo.matricula ?? "");
  }
  const [linhas, setLinhas] = useState<GrelhaLinha[]>(() => linhasFromSessoes(sessoes, horario));
  const [evento, setEvento] = useState<{ date: string; linha?: GrelhaLinha } | null>(null);
  const [arrasto, setArrasto] = useState<{ date: string; linha: GrelhaLinha } | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const arrastou = useRef(false);
  const { opcoes: locaisOpcoes } = useOpcoes("locais", { todos: true });
  const { dados: entidade } = useRecurso("publico:entidade", signal => apiPublicEntidade(signal));
  const locaisCatalogo = useMemo<LocalCatalogo[]>(
    () => locaisOpcoes.map(o => ({ nome: o.rotulo, ...(o.extra ?? {}) }) as LocalCatalogo),
    [locaisOpcoes],
  );
  const localMapeado = useMemo(() => mapLocalTurma(local, locaisCatalogo), [local, locaisCatalogo]);

  useEffect(() => {
    setLinhas(prev => mergeLinhas(linhasFromSessoes(sessoes, horario), prev));
  }, [sessoes, horario]);

  useEffect(() => {
    setMatriculaDate(periodo.matricula ?? "");
  }, [periodo.matricula]);

  useEffect(() => {
    setFim(prev => {
      if (!periodo.fim) return prev;
      if (!prev || periodo.fim > prev) return periodo.fim;
      return prev;
    });
  }, [periodo.fim]);

  const start = [matricula, inicio, periodo.inicio].filter(Boolean).sort()[0] ?? inicio;
  const todosOsDias = useMemo(() => datesFromRange(start, fim || addDays(inicio || start, 31)), [start, fim, inicio]);
  // Os dias vazios entre a matrícula e o início ficam numa só coluna («…»); um clique mostra-os.
  const [verSalto, setVerSalto] = useState(false);
  const salto = verSalto ? null : saltoMatricula(todosOsDias, sessoes, matricula, inicio);
  const dates = useMemo(() => (salto ? todosOsDias.filter(d => d < salto.de || d > salto.ate) : todosOsDias), [todosOsDias, salto?.de, salto?.ate]);
  const months = monthSpans(dates).map(m => (salto && m.key === matricula.slice(0, 7) ? { ...m, count: m.count + 1 } : m));
  const larguras = useMemo(() => {
    const rotulos = dates.map(d => linhas.map(l => cellLabel(sessoes, d, l)).filter(Boolean));
    return larguraDiasEmChars(dates, rotulos);
  }, [dates, linhas, sessoes]);
  const colunaSalto = (chave: string, conteudo?: ReactNode, rowSpan?: number) => (
    <th key={`salto-${chave}`} rowSpan={rowSpan} className="border-b border-x border-slate-200 bg-slate-50 px-0 py-0 text-center align-middle font-medium text-slate-400 min-w-[2.4rem]">
      {conteudo}
    </th>
  );
  // Aulas presenciais e síncronas numa grelha de tempos de 45 minutos.
  const tempos = useMemo(() => grelhaTempos(sessoes, dates, horario), [sessoes, dates, horario]);
  const blocosPorDia = useMemo(() => {
    const m = new Map<string, BlocoTempos[]>();
    for (const b of tempos.blocos) m.set(b.date, [...(m.get(b.date) ?? []), b]);
    return m;
  }, [tempos]);
  const slotPadrao = defaultSlot(horario, "presencial");
  const duracaoPadrao = Math.max(TEMPO_MIN, (minutosDaHora(slotPadrao.horaFim) ?? 0) - (minutosDaHora(slotPadrao.horaInicio) ?? 0));
  const codigo = codigoInternoTurma(curso ?? "", local ?? "", horario, inicio);
  const gold = accent === "gold";

  function gravar(next: SessaoCronograma[], fimForcado?: string) {
    const alvo = fimForcado ?? fimEstavel(next, fim);
    setFim(alvo);
    onChange(comFimCronograma(next, alvo));
    return alvo;
  }

  function aplicarGerado() {
    const next = generateEnaCronograma({
      inicio,
      horario,
      horas,
      formador,
      curso,
      modulos: moduloOpts.map(o => o.value),
    });
    const p = grelhaPeriodo(next, inicio);
    setMatriculaDate(p.matricula ?? "");
    setLinhas(linhasFromSessoes(next, horario));
    gravar(next, p.fim);
  }

  function changeMatricula(v: string) {
    setMatriculaDate(v);
    gravar(setMatricula(sessoesSemFim(sessoes), v));
  }

  function changeFim(v: string) {
    gravar(sessoes, v);
  }

  function aplicarEventoGrelha(next: SessaoCronograma[], extra: GrelhaLinha) {
    setLinhas(xs => mergeLinhas(linhasFromSessoes(next, horario), [...xs, extra]));
    gravar(next);
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
                <th key={m.key} colSpan={m.count} className="border-b border-slate-200 bg-slate-50 px-1 py-1 text-center text-[10px] font-bold uppercase tracking-wider text-slate-600 whitespace-nowrap">
                  {m.label}
                </th>
              ))}
            </tr>
            <tr>
              {dates.map((d, di) => (
                <Fragment key={`n-${d}`}>
                <th style={{ minWidth: `${Math.max(2.1, (larguras[di] ?? 2) * 0.62)}rem` }} className={`border-b border-slate-100 px-0 py-0 text-center font-bold ${d === matricula ? "bg-[#15803d]/30" : d === inicio ? "bg-emerald-50" : ""}`}>
                  <button
                    type="button"
                    onClick={() => setEvento({ date: d })}
                    title={`Adicionar evento em ${formatDiaMes(d)}`}
                    className="block w-full py-1 hover:bg-slate-100"
                  >
                    {dayNum(d)}
                  </button>
                </th>
                {salto && d === matricula && colunaSalto("n", (
                  <button type="button" onClick={() => setVerSalto(true)} title={`${salto.n} dias sem eventos entre a matrícula e o início (${formatDiaMes(salto.de)} a ${formatDiaMes(salto.ate)}). Clique para os mostrar.`}
                    className="block w-full py-1 text-slate-500 hover:bg-slate-100">…</button>
                ), 2)}
                </Fragment>
              ))}
            </tr>
            <tr>
              {dates.map(d => (
                <th key={`w-${d}`} className={`border-b border-slate-200 px-0 py-0 text-center font-medium text-slate-500 ${d === matricula ? "bg-[#15803d]/20" : ""}`}>
                  <button
                    type="button"
                    onClick={() => setEvento({ date: d })}
                    title={`Adicionar evento em ${formatDiaMes(d)}`}
                    className="block w-full py-0.5 hover:bg-slate-100"
                  >
                    {weekdayCode(d)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: tempos.n }, (_, r) => (
              <tr key={`tempo-${r}`} style={{ height: "2.4rem" }}>
                <th className="sticky left-0 z-10 bg-white border-r border-b border-slate-200 px-2 py-1 text-left align-middle font-semibold text-slate-700 w-44 min-w-[11rem]">
                  {r === 0 && <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Horário das aulas · tempos de {tempos.tempo} min</p>}
                  <p className="text-[11px] font-medium text-slate-600 leading-tight">{horaOficial(tempos.inicioDaLinha(r))} – {horaOficial(tempos.inicioDaLinha(r + 1))}</p>
                </th>
                {dates.flatMap(d => {
                  const doDia = blocosPorDia.get(d) ?? [];
                  const bloco = doDia.find(b => b.linha <= r && r < b.linha + b.linhas);
                  const chave = `t${r}-${d}`;
                  const cells: ReactNode[] = [];
                  if (d === matricula && !doDia.length) {
                    if (r === 0) {
                      cells.push(
                        <td key={chave} rowSpan={tempos.n} className={`border border-slate-100 px-0.5 text-center align-middle text-[9px] font-bold ${TONE.matricula}`}>Matrícula</td>,
                      );
                    }
                  } else if (bloco) {
                    if (bloco.linha === r) {
                      cells.push(
                        <td key={chave} rowSpan={bloco.linhas} className="relative border border-slate-100 p-0 bg-white">
                          {bloco.sessoes.map(({ s: ses, topo, altura, coluna, colunas }) => {
                            const linhaSes = linhaDaSessao(ses)!;
                            return (
                              <button
                                key={ses.id ?? `${ses.horaInicio}-${coluna}`}
                                type="button"
                                draggable
                                onDragStart={e => {
                                  arrastou.current = false;
                                  setArrasto({ date: d, linha: linhaSes });
                                  e.dataTransfer.effectAllowed = "move";
                                  e.dataTransfer.setData("text/plain", chave);
                                }}
                                onDragEnd={() => { setArrasto(null); setSobre(null); }}
                                onClick={() => {
                                  if (arrastou.current) { arrastou.current = false; return; }
                                  setEvento({ date: d, linha: linhaSes });
                                }}
                                style={{ top: `${topo}%`, height: `${altura}%`, left: `${(coluna / colunas) * 100}%`, width: `${100 / colunas}%` }}
                                className={`absolute flex flex-col items-center justify-center overflow-hidden border border-white/50 px-0.5 text-[9px] font-bold leading-tight cursor-grab active:cursor-grabbing ${TONE[sessaoModalidade(ses)] ?? TONE.presencial}`}
                                title={`${formatDiaMes(d)} · ${formatHoraFaixa(ses.horaInicio, ses.horaFim)} · arraste para mudar de dia ou hora; clique para editar`}
                              >
                                <span>{cellLabel(sessoes, d, linhaSes)}</span>
                                <span className="font-medium opacity-80">{horaOficial(ses.horaInicio)}–{horaOficial(ses.horaFim)}</span>
                              </button>
                            );
                          })}
                        </td>,
                      );
                    }
                  } else {
                    const ini = minutosDaHora(tempos.inicioDaLinha(r))!;
                    const aSoltar = sobre === chave && arrasto;
                    cells.push(
                      <td
                        key={chave}
                        className={`border border-slate-100 p-0 ${aSoltar ? "ring-2 ring-amber-400 ring-inset" : ""} ${d === matricula ? "bg-[#15803d]/10" : ""}`}
                        onDragOver={e => { if (!arrasto) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; setSobre(chave); }}
                        onDragLeave={() => { if (sobre === chave) setSobre(null); }}
                        onDrop={e => {
                          e.preventDefault();
                          setSobre(null);
                          if (!arrasto) return;
                          arrastou.current = true;
                          // Mantém a duração (do e-learning para aula: a duração habitual do horário).
                          const de = arrasto.linha;
                          const mod = de.modalidade === "sincrona" ? "sincrona" : "presencial";
                          const dur = de.horaInicio && de.horaFim ? minutosDaHora(de.horaFim)! - minutosDaHora(de.horaInicio)! : duracaoPadrao;
                          gravar(moverEvento(sessoesSemFim(sessoes), arrasto.date, de, d, buildLinha(mod, horaDosMinutos(ini), horaDosMinutos(ini + dur))));
                          setArrasto(null);
                        }}
                      >
                        <button type="button" aria-label={`${formatDiaMes(d)} às ${horaOficial(tempos.inicioDaLinha(r))}: adicionar aula`}
                          onClick={() => setEvento({ date: d, linha: buildLinha("presencial", horaDosMinutos(ini), horaDosMinutos(ini + duracaoPadrao)) })}
                          className={`block h-full min-h-[2.3rem] w-full ${TONE.empty}`} />
                      </td>,
                    );
                  }
                  if (salto && d === matricula) cells.push(<td key={`salto-${chave}`} className="border border-slate-100 bg-slate-50" aria-hidden="true" />);
                  return cells;
                })}
              </tr>
            ))}
            {(["auto", "avaliacao"] as const).map(grupo => {
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
                    const tone = cellTone(sessoes, d, linha);
                    const label = cellLabel(sessoes, d, linha);
                    const chave = `${linha.id}-${d}`;
                    const preenchida = Boolean(label) && tone !== "empty" && tone !== "matricula";
                    const aSoltar = sobre === chave && arrasto && !(arrasto.date === d && arrasto.linha.id === linha.id);
                    return (
                      <td
                        key={chave}
                        className={`relative border border-slate-100 p-0 text-center align-middle ${aSoltar ? "ring-2 ring-amber-400 ring-inset" : ""}`}
                        onDragOver={e => {
                          if (!arrasto || tone === "matricula") return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          setSobre(chave);
                        }}
                        onDragLeave={() => { if (sobre === chave) setSobre(null); }}
                        onDrop={e => {
                          e.preventDefault();
                          setSobre(null);
                          if (!arrasto || tone === "matricula") return;
                          arrastou.current = true;
                          gravar(moverEvento(sessoesSemFim(sessoes), arrasto.date, arrasto.linha, d, linha));
                          setArrasto(null);
                        }}
                      >
                        <button
                          type="button"
                          draggable={preenchida}
                          onDragStart={e => {
                            if (!preenchida) return;
                            arrastou.current = false;
                            setArrasto({ date: d, linha });
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData("text/plain", chave);
                          }}
                          onDragEnd={() => { setArrasto(null); setSobre(null); }}
                          onClick={() => {
                            if (arrastou.current) {
                              arrastou.current = false;
                              return;
                            }
                            setEvento({ date: d, linha });
                          }}
                          className={`block w-full min-h-10 px-0.5 py-1 text-[9px] font-bold leading-tight whitespace-normal ${TONE[tone] ?? TONE.empty} ${preenchida ? "cursor-grab active:cursor-grabbing" : ""}`}
                          title={preenchida
                            ? `${formatDiaMes(d)} · ${linhaLabel(linha)} · arraste para mudar dia, hora ou metodologia; clique para editar os ${unidade === "capítulo" ? "capítulos" : "módulos"}`
                            : `${formatDiaMes(d)} · ${linhaLabel(linha)}`}
                        >
                          {label}
                        </button>
                      </td>
                    );
                  }).flatMap((td, di) => (salto && dates[di] === matricula
                    ? [td, <td key={`salto-${linha.id}`} className="border border-slate-100 bg-slate-50" aria-hidden="true" />]
                    : [td]))}
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
          {sessoesSemFim(sessoes).length ? "Gerar grelha ENA" : "Gerar cronograma ENA"}
        </button>
        {!linhas.some(l => l.modalidade === "auto") && (
          <button type="button" onClick={() => setLinhas(xs => mergeLinhas(xs, [buildLinha("auto", "", "")]))}
            title="As aulas presenciais e síncronas marcam-se na grelha de tempos; o e-learning ocupa o dia numa linha própria."
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
            + Linha de e-learning
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            imprimirCronogramaEna({
              horario,
              curso,
              nome,
              codigo,
              matricula,
              inicio,
              fim: fim || dates[dates.length - 1],
              local: localMapeado,
              dates,
              linhas,
              sessoes: sessoesSemFim(sessoes),
              entidade: entidade?.entidade,
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
          unidade={unidade}
          formador={formador}
          onClose={() => setEvento(null)}
          onApply={aplicarEventoGrelha}
        />
      )}

      <p className="text-[11px] text-slate-500 px-1">
        Arraste uma sessão para outra célula para mudar o dia, a hora ou a metodologia. Os {unidade === "capítulo" ? "capítulos" : "módulos"} só se alteram ao clicar na sessão. Clique numa célula vazia para adicionar.
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
