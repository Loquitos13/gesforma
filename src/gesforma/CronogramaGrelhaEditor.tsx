// Continuação de CronogramaGrelha.tsx (partido para ficar abaixo das 500 linhas).
import { Fragment, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useOpcoes } from "../partilhado/dados/useOpcoes";
import { apiPublicEntidade } from "../partilhado/api/publico";
import { useRecurso } from "../partilhado/dados/useRecurso";
import { useProgramaDoCurso } from "./cursoPrograma";
import { type GrelhaLinha, cellSessoes, addDays, cellLabel, cellTone, comFimCronograma, datesFromRange, defaultSlot, dayNum, fimEstavel, grelhaPeriodo, grupoLinha, larguraDiasEmChars, linhaLabel, linhasFromSessoes, mergeLinhas, monthSpans, moverEvento, saltosVazios, setMatricula, sessoesSemFim, weekdayCode, grelhaTempos, type BlocoTempos, TEMPO_MIN, minutosDaHora, horaDosMinutos, horaOficial, formatHoraFaixa, linhaDaSessao, buildLinha, temasDaSessao } from "../partilhado/cronogramaGrelha";
import { generateEnaCronograma } from "../partilhado/cronogramaGrelhaGerar";
import { mapLocalTurma, type LocalCatalogo } from "../partilhado/cronogramaLocal";
import { imprimirCronogramaEna } from "../partilhado/cronogramaPrint";
import { codigoInternoTurma } from "../partilhado/turmaCodigo";
import { formatDiaMes, sessaoModalidade, type SessaoCronograma } from "../partilhado/turmaModel";
import { ConfirmarPerigo } from "../partilhado/ui";
import { TONE, TONE_GOLD, EventoModal, planosPorAgendar, rotuloPlano } from "./CronogramaGrelha";
import { nomesDosPlanos, usePlanosCurso } from "./planosCurso";

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
  onLocal,
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
  onLocal?: (local: string) => void;
  accent?: "gold" | "fin";
  compact?: boolean;
  identidade?: string;
}) {
  const programa = useProgramaDoCurso(accent, curso);
  const moduloOpts = programa.options;
  // Planos de sessão da ficha do curso: os que ainda não têm dia ficam «por agendar» até se marcarem na grelha.
  const { planos } = usePlanosCurso(accent, curso ?? "");
  const porAgendar = useMemo(() => planosPorAgendar(planos, sessoes), [planos, sessoes]);
  const nomesPlanos = useMemo(() => nomesDosPlanos(planos), [planos]);
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
  // Seleção de vários eventos para os apagar de uma vez (ids das sessões). No modo de seleção, clicar marca e não se
  // arrasta; fora dele, Ctrl/⌘ + clique também marca.
  const [selecionar, setSelecionar] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(() => new Set());
  const [apagarSel, setApagarSel] = useState(false);
  const alternarSel = (ids: string[]) => setSelecionados(prev => {
    const n = new Set(prev);
    const todos = ids.every(id => n.has(id));
    for (const id of ids) { if (todos) n.delete(id); else n.add(id); }
    return n;
  });
  const marca = (e: { ctrlKey: boolean; metaKey: boolean }) => selecionar || e.ctrlKey || e.metaKey;
  const sairSelecao = () => { setSelecionar(false); setSelecionados(new Set()); };
  const { opcoes: locaisOpcoes } = useOpcoes("locais", { todos: true });
  const { dados: entidade } = useRecurso("publico:entidade", signal => apiPublicEntidade(signal));
  const locaisCatalogo = useMemo<LocalCatalogo[]>(
    () => locaisOpcoes.map(o => ({ nome: o.rotulo, ...(o.extra ?? {}) }) as LocalCatalogo),
    [locaisOpcoes],
  );
  const localMapeado = useMemo(() => mapLocalTurma(local, locaisCatalogo), [local, locaisCatalogo]);
  // Locais ativos deste regime (Edição de Cursos › Locais), para escolher o local no cabeçalho.
  const nomesLocais = useMemo(() => [...new Set([
    ...(local ? [local] : []),
    ...locaisOpcoes
      .filter(o => (!o.regime || o.regime === accent) && !/^inativ|^inactiv|^arquiv/i.test(String((o.extra as { estado?: string; status?: string } | undefined)?.status ?? (o.extra as { estado?: string } | undefined)?.estado ?? "")))
      .map(o => o.rotulo),
  ])].filter(Boolean), [locaisOpcoes, local, accent]);

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
  // Os dias seguidos sem eventos (entre a matrícula e o início, ou um intervalo longo entre módulos) ficam numa só
  // coluna («…»); um clique mostra-os. A impressão também os salta.
  const [verSalto, setVerSalto] = useState(false);
  const [repor, setRepor] = useState(false);
  const saltosSempre = useMemo(() => saltosVazios(todosOsDias, sessoes, matricula, inicio), [todosOsDias, sessoes, matricula, inicio]);
  const saltos = verSalto ? [] : saltosSempre;
  // O PDF sai sempre encurtado, esteja a grelha aberta ou não.
  const diasImpressao = useMemo(
    () => todosOsDias.filter(d => !saltosSempre.some(x => d >= x.de && d <= x.ate)),
    [todosOsDias, saltosSempre],
  );
  const saltoApos = useMemo(() => new Map(saltos.map(x => [x.apos, x])), [saltos]);
  // Intervalos abertos: o cabeçalho deles tem o «recolher» (os dias ficam na linha de baixo, com o dia da semana).
  const abertoEm = (d: string) => (verSalto ? saltosSempre.find(x => d >= x.de && d <= x.ate) : undefined);
  const dates = useMemo(
    () => (saltos.length ? todosOsDias.filter(d => !saltos.some(x => d >= x.de && d <= x.ate)) : todosOsDias),
    [todosOsDias, saltos],
  );
  const months = monthSpans(dates).map(m => ({ ...m, count: m.count + saltos.filter(x => x.apos.slice(0, 7) === m.key).length }));
  const larguras = useMemo(() => {
    const blocosDias = new Set(sessoesSemFim(sessoes).filter(x => x.horaInicio && x.horaFim).map(x => x.data));
    // As aulas mostram o nome do módulo ou o tema: a coluna alarga até à palavra mais comprida (com limite).
    const temas = (d: string) => sessoesSemFim(sessoes).filter(x => x.data === d).flatMap(temasDaSessao)
      .flatMap(t => [t.codigo, ...t.titulo.split(/\s+/).map(p => p.slice(0, 14))]);
    const rotulos = dates.map(d => [...linhas.map(l => cellLabel(sessoes, d, l)), ...temas(d), ...(blocosDias.has(d) ? ["00:00–00:00"] : [])].filter(Boolean));
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
  const tons = gold ? TONE_GOLD : TONE;

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
          {onLocal ? (
            <label className="flex items-start gap-2">
              <span className="text-slate-500 w-40 flex-shrink-0 pt-1">Local de realização</span>
              <span className="flex-1 min-w-0">
                <select value={local ?? ""} onChange={e => onLocal(e.target.value)} className="w-full px-2 py-1 border border-slate-200 rounded-lg bg-white">
                  <option value="">Escolher…</option>
                  {nomesLocais.map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                <span className="mt-0.5 block text-[11px] text-slate-500">
                  {localMapeado.morada || "Sem morada: acrescente-a em Edição de Cursos › Locais."}
                </span>
              </span>
            </label>
          ) : (
            <p className="flex items-center gap-2">
              <span className="text-slate-500 w-40 flex-shrink-0">Local de realização</span>
              <span className="font-semibold text-slate-800">{localMapeado.localizacao}</span>
            </p>
          )}
          <label className="flex items-center gap-2">
            <span className="text-slate-500 w-40 flex-shrink-0">Data de fim</span>
            <input type="date" value={fim} min={inicio || undefined} onChange={e => changeFim(e.target.value)} className="flex-1 px-2 py-1 border border-slate-200 rounded-lg" />
          </label>
        </div>
      </header>

      {planos.length > 0 && (
        <div className={`rounded-xl border px-4 py-3 ${porAgendar.length ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
          <p className="text-xs font-semibold text-slate-800">
            {porAgendar.length
              ? `${porAgendar.length} de ${planos.length} planos do curso por agendar. Clique num dia (ou numa hora) da grelha para marcar o próximo; e-learning, avaliações e outras sessões marcam-se como «Personalizado».`
              : `Os ${planos.length} planos do curso estão todos agendados.`}
          </p>
          {porAgendar.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {porAgendar.map(p => (
                <span key={p.id} title={p.objetivosGerais || undefined} className="rounded-lg border border-amber-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700">{rotuloPlano(p, nomesPlanos)}</span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className={`overflow-auto border border-slate-200 rounded-xl bg-white ${compact ? "max-h-[28rem]" : "max-h-[70vh]"}`}>
        <table className="min-w-max border-collapse text-[11px]">
          <thead>
            <tr>
              <th rowSpan={3} className="sticky left-0 z-20 bg-white border-b border-r border-slate-200 px-2 py-1 text-left w-44 min-w-[11rem]">
                <span className="sr-only">Horário</span>
                {sessoesSemFim(sessoes).length > 0 && (
                  <button type="button" onClick={() => setRepor(true)} title="Repor o cronograma (fica em branco)" aria-label="Repor o cronograma"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" />
                    </svg>
                    Repor
                  </button>
                )}
              </th>
              {months.map(m => (
                <th key={m.key} colSpan={m.count} className="border-b border-slate-200 bg-slate-50 px-1 py-1 text-center text-[10px] font-bold uppercase tracking-wider text-slate-600 whitespace-nowrap">
                  {m.label}
                </th>
              ))}
            </tr>
            <tr>
              {dates.map((d, di) => {
                const aberto = abertoEm(d);
                if (aberto && d !== aberto.de) return null;
                if (aberto) return (
                  <th key={`n-${d}`} colSpan={aberto.n} className="border-b border-x border-slate-200 bg-slate-50 px-0 py-0 text-center">
                    <button type="button" onClick={() => setVerSalto(false)}
                      title={`${aberto.n} dias sem eventos (${formatDiaMes(aberto.de)} a ${formatDiaMes(aberto.ate)}). Clique para os recolher numa coluna «…».`}
                      className="block w-full py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800">
                      ‹ Recolher {aberto.n} dias sem eventos ›
                    </button>
                  </th>
                );
                return (
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
                {saltoApos.has(d) && colunaSalto(`n-${d}`, (
                  <button type="button" onClick={() => setVerSalto(true)} title={`${saltoApos.get(d)!.n} dias sem eventos (${formatDiaMes(saltoApos.get(d)!.de)} a ${formatDiaMes(saltoApos.get(d)!.ate)}). Clique para os mostrar.`}
                    className="block w-full py-1 text-slate-500 hover:bg-slate-100">…</button>
                ), 2)}
                </Fragment>
                );
              })}
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
                    {abertoEm(d) ? <><span className="block font-bold text-slate-700">{dayNum(d)}</span>{weekdayCode(d)}</> : weekdayCode(d)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: tempos.n }, (_, r) => (
              <tr key={`tempo-${r}`} style={{ height: "2.4rem" }}>
                <th className="sticky left-0 z-10 bg-white border-r border-b border-slate-200 px-2 py-1 text-left align-middle font-semibold text-slate-700 w-44 min-w-[11rem]">
                  {r === 0 && <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Horário das aulas</p>}
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
                        <td key={chave} rowSpan={tempos.n} className={`border border-slate-100 px-0.5 text-center align-middle text-[9px] font-bold ${tons.matricula}`}>Matrícula</td>,
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
                                draggable={!selecionar}
                                onDragStart={e => {
                                  if (selecionar) { e.preventDefault(); return; }
                                  arrastou.current = false;
                                  setArrasto({ date: d, linha: linhaSes });
                                  e.dataTransfer.effectAllowed = "move";
                                  e.dataTransfer.setData("text/plain", chave);
                                }}
                                onDragEnd={() => { setArrasto(null); setSobre(null); }}
                                onClick={e => {
                                  if (arrastou.current) { arrastou.current = false; return; }
                                  if (marca(e)) { if (ses.id) alternarSel([ses.id]); return; }
                                  setEvento({ date: d, linha: linhaSes });
                                }}
                                aria-pressed={selecionar ? selecionados.has(ses.id) : undefined}
                                style={{ top: `${topo}%`, height: `${altura}%`, left: `${(coluna / colunas) * 100}%`, width: `${100 / colunas}%` }}
                                className={`absolute flex flex-col items-center justify-center overflow-hidden border border-white/50 px-0.5 text-[9px] font-bold leading-tight ${selecionar ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"} ${selecionados.has(ses.id) ? "ring-4 ring-inset ring-slate-900" : ""} ${tons[sessaoModalidade(ses)] ?? tons.presencial}`}
                                title={`${formatDiaMes(d)} · ${formatHoraFaixa(ses.horaInicio, ses.horaFim)} · arraste para mudar de dia ou hora; clique para editar`}
                              >
                                {temasDaSessao(ses).length
                                  ? temasDaSessao(ses).map((t, ti) => (
                                      <span key={ti} className="block w-full">
                                        {t.codigo && <span className="block">{t.codigo}</span>}
                                        {t.titulo && <span className={`block line-clamp-2 ${t.codigo ? "font-medium" : ""}`}>{t.titulo}</span>}
                                      </span>
                                    ))
                                  : <span className="font-medium opacity-80">{sessaoModalidade(ses) === "sincrona" ? "Síncrona" : unidade === "capítulo" ? "Tema por definir" : "Módulo por definir"}</span>}
                                <span className="block font-medium opacity-80">{horaOficial(ses.horaInicio)}–{horaOficial(ses.horaFim)}</span>
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
                          onClick={() => { if (!selecionar) setEvento({ date: d, linha: buildLinha("presencial", horaDosMinutos(ini), horaDosMinutos(ini + duracaoPadrao)) }); }}
                          className={`block h-full min-h-[2.3rem] w-full ${tons.empty}`} />
                      </td>,
                    );
                  }
                  if (saltoApos.has(d)) cells.push(<td key={`salto-${chave}`} className="border border-slate-100 bg-slate-50" aria-hidden="true" />);
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
                          draggable={preenchida && !selecionar}
                          onDragStart={e => {
                            if (!preenchida || selecionar) { e.preventDefault(); return; }
                            arrastou.current = false;
                            setArrasto({ date: d, linha });
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData("text/plain", chave);
                          }}
                          onDragEnd={() => { setArrasto(null); setSobre(null); }}
                          onClick={e => {
                            if (arrastou.current) {
                              arrastou.current = false;
                              return;
                            }
                            if (marca(e)) { if (preenchida) alternarSel(cellSessoes(sessoes, d, linha).map(x => x.id)); return; }
                            setEvento({ date: d, linha });
                          }}
                          className={`block w-full min-h-10 px-0.5 py-1 text-[9px] font-bold leading-tight whitespace-normal ${tons[tone] ?? tons.empty} ${preenchida ? (selecionar ? "cursor-pointer" : "cursor-grab active:cursor-grabbing") : ""} ${preenchida && cellSessoes(sessoes, d, linha).some(x => selecionados.has(x.id)) ? "ring-4 ring-inset ring-slate-900" : ""}`}
                          title={preenchida
                            ? `${formatDiaMes(d)} · ${linhaLabel(linha)} · arraste para mudar dia, hora ou metodologia; clique para editar os ${unidade === "capítulo" ? "capítulos" : "módulos"}`
                            : `${formatDiaMes(d)} · ${linhaLabel(linha)}`}
                        >
                          {label}
                        </button>
                      </td>
                    );
                  }).flatMap((td, di) => (saltoApos.has(dates[di]!)
                    ? [td, <td key={`salto-${linha.id}-${dates[di]}`} className="border border-slate-100 bg-slate-50" aria-hidden="true" />]
                    : [td]))}
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>

      {(selecionar || selecionados.size > 0) && (
        <div className="sticky bottom-2 z-30 flex flex-wrap items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 shadow-lg">
          <p className="mr-auto text-xs font-semibold text-slate-700">
            {selecionados.size
              ? `${selecionados.size} ${selecionados.size === 1 ? "evento selecionado" : "eventos selecionados"}`
              : "Clique nos eventos a apagar (aulas, e-learning, avaliações)."}
          </p>
          <button type="button" disabled={!selecionados.size} onClick={() => setApagarSel(true)}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-40">Apagar selecionados</button>
          <button type="button" onClick={sairSelecao}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Cancelar</button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {!selecionar && sessoesSemFim(sessoes).some(x => sessaoModalidade(x) !== "matricula") && (
          <button type="button" onClick={() => setSelecionar(true)} title="Marcar vários eventos e apagá-los de uma vez (também com Ctrl/⌘ + clique)."
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
            Selecionar eventos
          </button>
        )}
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
              fim: fim || todosOsDias[todosOsDias.length - 1],
              local: localMapeado,
              dates: diasImpressao,
              linhas,
              sessoes: sessoesSemFim(sessoes),
              entidade: entidade?.entidade,
              cores: gold ? "gold" : "fin",
            });
          }}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        >
          Imprimir / PDF
        </button>
      </div>

      <ConfirmarPerigo aberto={apagarSel} onFechar={() => setApagarSel(false)} titulo={`Apagar ${selecionados.size} ${selecionados.size === 1 ? "evento" : "eventos"}?`} acao="Apagar"
        descricao="Os eventos selecionados saem do cronograma. Sessões com sumário, presenças ou plano assinado são recusadas ao gravar."
        onConfirmar={() => {
          setApagarSel(false);
          gravar(sessoesSemFim(sessoes).filter(x => !selecionados.has(x.id)));
          sairSelecao();
        }} />

      <ConfirmarPerigo aberto={repor} onFechar={() => setRepor(false)} titulo="Repor o cronograma?" acao="Repor"
        descricao={`As ${sessoesSemFim(sessoes).length} entradas do cronograma (aulas, e-learning, avaliações e matrícula) são apagadas e a grelha fica em branco. Sessões com sumário, presenças ou plano assinado são recusadas ao gravar.`}
        onConfirmar={() => {
          setRepor(false);
          setMatriculaDate("");
          setFim("");
          setLinhas(linhasFromSessoes([], horario));
          onChange([]);
        }} />

      {evento && (
        <EventoModal
          date={evento.date}
          linha={evento.linha}
          sessoes={sessoes}
          horario={horario}
          moduloOpts={moduloOpts}
          unidade={unidade}
          formador={formador}
          planos={planos}
          onClose={() => setEvento(null)}
          onApply={aplicarEventoGrelha}
        />
      )}

      <p className="text-[11px] text-slate-500 px-1">
        Arraste uma sessão para outra célula para mudar o dia, a hora ou a metodologia. Os {unidade === "capítulo" ? "capítulos" : "módulos"} só se alteram ao clicar na sessão. Clique numa célula vazia para adicionar.
      </p>

      <ul className="text-[11px] text-slate-600 space-y-1 px-1">
        <li className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-sm bg-[#15803d]" /> Data limite de matrícula e instruções de início (email)</li>
        <li className="flex items-center gap-2"><span className={`w-3.5 h-3.5 rounded-sm ${gold ? "bg-[#ffc000]" : "bg-[#a60000]"}`} /> Aulas presenciais em sala, por módulo</li>
        <li className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-sm bg-[#1d4ed8]" /> Sessão síncrona em vídeo-conferência</li>
        <li className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-sm bg-slate-300" /> E-learning / auto-aprendizagem</li>
        <li className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-sm bg-[#e00000]" /> Data limite de avaliação do(s) módulo(s)</li>
      </ul>
    </div>
  );
}
