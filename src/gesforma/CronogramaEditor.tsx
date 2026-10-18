// Continuação de TurmaCronograma.tsx (partido para ficar abaixo das 500 linhas).
import { useMemo, useState } from "react";
import { CronogramaGrelha } from "./CronogramaGrelhaEditor";
import { sessoesSemFim } from "../partilhado/cronogramaGrelha";
import { generateEnaCronograma } from "../partilhado/cronogramaGrelhaGerar";
import { MultiSearchSelect } from "../partilhado/FormKit";
import { useProgramaDoCurso } from "./cursoPrograma";
import { useOpcoesFormador, useSessoesNoutrasTurmas } from "../partilhado/dados/comuns";
import { descarregarCronograma } from "./cronogramaExport";
import { apiPublicarCronograma } from "../partilhado/api";
import { toastError, toastOk } from "../partilhado/toastBus";
import { ConfirmarPerigo } from "../partilhado/ui";
import { hojeIso, emptySessao, formatDiaMes, formatHoraRange, formatMesAno, formadoresNasSessoes, groupCronogramaByMonth, horasCronograma, isSessaoLectiva, modulosDoFormador, modulosLabel, periodoCronograma, proximaSessao, sessaoEstado, sessaoFormadores, sessaoModulos, type SessaoCronograma } from "../partilhado/turmaModel";
import { IconPlus, KpiCard, SessaoRow } from "./TurmaCronograma";

export function CronogramaEditor({
  sessoes, onChange, inicio, horario, horas, formador, formadoresTurma, curso, nome, local, accent = "gold",
  layout = "compact", turmaId, identidade,
}: {
  sessoes: SessaoCronograma[];
  onChange: (next: SessaoCronograma[]) => void;
  inicio: string;
  horario: string;
  horas: number;
  formador: string;
  formadoresTurma?: string[];
  curso?: string;
  nome?: string;
  local?: string;
  accent?: "gold" | "fin";
  layout?: "page" | "compact";
  turmaId?: number;
  identidade?: string;
}) {
  const gold = accent === "gold";
  const page = layout === "page";
  const programa = useProgramaDoCurso(accent, curso);
  const moduloOpts = programa.options;
  const nomesFormadores = useMemo(
    () => [...new Set([formador, ...(formadoresTurma ?? []), ...sessoes.flatMap(s => sessaoFormadores(s))].map(n => n.trim()).filter(Boolean))],
    [formador, formadoresTurma, sessoes],
  );
  const outras = useSessoesNoutrasTurmas(nomesFormadores, { regime: accent, id: turmaId });
  const totalH = Math.round(horasCronograma(sessoes) * 10) / 10;
  const next = proximaSessao(sessoes);
  const periodo = periodoCronograma(sessoes);
  const plano = useMemo(() => sessoesSemFim(sessoes), [sessoes]);
  const lectivas = useMemo(() => plano.filter(isSessaoLectiva), [plano]);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [aRemover, setARemover] = useState<{ sessao: SessaoCronograma; n: number } | null>(null);
  const [publicando, setPublicando] = useState(false);
  const [publicadoUrl, setPublicadoUrl] = useState<string | null>(null);
  // A sessão aberta continua na lista mesmo depois de passar a assíncrona, para
  // dar para voltar atrás sem a ir procurar à grelha.
  const listadas = useMemo(
    () => sessoes.filter(s => isSessaoLectiva(s) || (openId !== null && s.id === openId)),
    [sessoes, openId],
  );
  const groups = useMemo(() => groupCronogramaByMonth(listadas), [listadas]);

  const btn = gold ? "bg-amber-500 hover:bg-amber-600 text-white" : "bg-blue-600 hover:bg-blue-700 text-white";
  const ghost = gold ? "border-amber-200 text-amber-800 hover:bg-amber-50" : "border-blue-200 text-blue-800 hover:bg-blue-50";
  const soft = gold ? "bg-amber-50 text-amber-800 border-amber-100" : "bg-blue-50 text-blue-800 border-blue-100";

  function aplicarGerado() {
    if (!inicio) return;
    onChange(generateEnaCronograma({ inicio, horario, horas, formador, curso, modulos: moduloOpts.map(o => o.value) }));
    setConfirmRegen(false);
    setOpenId(null);
  }

  function pedirGerar() {
    if (!inicio) return;
    if (plano.length) setConfirmRegen(true);
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
      <KpiCard accent={accent} label="Sessões lectivas" value={String(lectivas.length)} hint={lectivas.length ? `${groups.length} ${groups.length === 1 ? "mês" : "meses"} no plano` : "Ainda por gerar"} />
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
            value={next ? formatDiaMes(next.data) : "-"}
            hint={next ? `${formatHoraRange(next.horaInicio, next.horaFim)} · ${modulosLabel(sessaoModulos(next))}` : "Sem sessões futuras"}
          />
          <KpiCard
            accent={accent}
            label="Período"
            value={periodo ? `${formatDiaMes(periodo.inicio)} a ${formatDiaMes(periodo.fim)}` : "-"}
            hint={periodo ? `${formatMesAno(periodo.inicio)}${periodo.inicio.slice(0, 7) !== periodo.fim.slice(0, 7) ? ` → ${formatMesAno(periodo.fim)}` : ""}` : "Defina datas nas sessões"}
          />
        </>
      )}
    </div>
  );

  const actions = (
    <div className="flex gap-2 flex-shrink-0 flex-wrap">
      <button type="button" onClick={pedirGerar} disabled={!inicio} className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg ${btn} disabled:opacity-40`}>
        {plano.length ? "Regenerar grelha" : "Gerar grelha ENA"}
      </button>
      <button type="button" onClick={addSessao} className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border bg-white ${ghost}`}>
        <IconPlus /> Sessão
      </button>
      <button
        type="button"
        disabled={plano.length === 0 || publicando || turmaId == null}
        title={turmaId == null ? "Grave a turma antes de publicar o cronograma." : "Coloca o cronograma na página pública e no dossiê."}
        onClick={() => {
          if (turmaId == null) return;
          setPublicando(true);
          void apiPublicarCronograma(accent, turmaId, sessoes)
            .then(r => {
              setPublicadoUrl(r.url);
              toastOk("Cronograma publicado no sítio e arquivado no dossiê.");
            })
            .catch(err => toastError(err, "Não foi possível publicar o cronograma."))
            .finally(() => setPublicando(false));
        }}
        className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border bg-white ${ghost} disabled:opacity-40`}
      >
        {publicando ? "A publicar…" : "Publicar no sítio e no dossiê"}
      </button>
      <button
        type="button"
        disabled={plano.length === 0}
        onClick={() => descarregarCronograma({ curso, local, horario, inicio, formador, nome: nome || curso, sessoes: plano })}
        className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border bg-white ${ghost} disabled:opacity-40`}
      >
        Descarregar
      </button>
    </div>
  );

  return (
    <div className={page ? "space-y-4" : "space-y-3"}>
      <div className={`flex flex-col sm:flex-row sm:items-start justify-between gap-3 ${page ? "bg-white rounded-xl border border-slate-200 px-4 py-4" : ""}`}>
        <div className="min-w-0">
          <p className={page ? "text-base font-bold text-slate-800" : "text-xs font-bold text-slate-500 uppercase tracking-wider"}>
            {page ? "Cronograma da turma" : "Cronograma"}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {plano.length === 0
              ? "A grelha segue o modelo da ENA: aulas presenciais, sessões síncronas e auto-aprendizagem por dia."
              : page
                ? "Arraste uma sessão na grelha para mudar dia, hora ou metodologia. Clique na célula para editar. As sessões lectivas abrem-se no separador Sessões."
                : `${lectivas.length} sessões lectivas · ${totalH}h em sala ou síncronas${horas ? ` de ${horas}h` : ""}`}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {horario && <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${soft}`}>{horario}</span>}
            {inicio && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-600">Início {formatDiaMes(inicio)}</span>}
            {formador && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-600">{formador}</span>}
          </div>
          {publicadoUrl && (
            <a href={publicadoUrl} target="_blank" rel="noreferrer" className="inline-block mt-2 text-xs font-semibold text-blue-700 hover:underline">
              Ver no sítio
            </a>
          )}
        </div>
        {actions}
      </div>

      {confirmRegen && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-amber-900">Substituir o cronograma atual?</p>
            <p className="text-xs text-amber-800 mt-0.5">
              As {plano.length} sessões existentes são apagadas e geradas de novo a partir de {inicio ? formatDiaMes(inicio) : "a data de início"} · {horario || "horário da turma"}.
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

      {plano.length > 0 && kpiGrid}

      <CronogramaGrelha
        sessoes={sessoes}
        onChange={onChange}
        inicio={inicio}
        horario={horario}
        horas={horas}
        formador={formador}
        curso={curso}
        nome={nome}
        local={local}
        accent={accent}
        compact={!page}
        identidade={identidade ?? (turmaId != null ? String(turmaId) : "")}
      />

      {!page && listadas.length > 0 && (
        <div className="max-h-80 overflow-y-auto space-y-3 pr-0.5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Sessões lectivas (presencial e síncrona)</p>
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
                    estado={sessaoEstado(sessao, hojeIso(), next?.id)}
                    gold={gold}
                    expanded={openId === sessao.id}
                    onToggle={() => setOpenId(id => id === sessao.id ? null : sessao.id)}
                    moduloOpts={moduloOpts}
                    formadoresTurma={[formador, ...(formadoresTurma ?? [])].map(n => n.trim()).filter(Boolean)}
                    cronogramaDesta={sessoes}
                    outras={outras}
                    onPatch={p => patch(sessao.id, p)}
                    onRemove={() => setARemover({ sessao, n })}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <ConfirmarPerigo
        aberto={aRemover !== null}
        onFechar={() => setARemover(null)}
        titulo={`Remover a sessão ${aRemover?.n ?? ""}?`}
        acao="Remover sessão"
        descricao={`A sessão de ${aRemover?.sessao.data ? formatDiaMes(aRemover.sessao.data) : "data por definir"} sai do cronograma. Se já tiver sumário, presenças ou plano assinado, o servidor recusa a remoção.`}
        onConfirmar={() => {
          if (!aRemover) return;
          onChange(sessoes.filter(x => x.id !== aRemover.sessao.id));
          if (openId === aRemover.sessao.id) setOpenId(null);
        }}
      />
    </div>
  );
}

export function FormadoresAtribuidosCard({
  sessoes, fallback, extra, onOpen, onChangeExtra,
}: {
  sessoes: SessaoCronograma[];
  fallback?: string;
  extra?: string[];
  onOpen?: (nome: string) => void;
  onChangeExtra?: (nomes: string[]) => void;
}) {
  const listaBase = formadoresNasSessoes(sessoes, fallback);
  const extraNomes = (extra ?? []).map(n => n.trim()).filter(Boolean);
  const lista = [
    ...listaBase,
    ...extraNomes.filter(n => !listaBase.some(f => f.nome.toLowerCase() === n.toLowerCase())).map(nome => ({ nome, sessoes: 0 })),
  ];
  const catalogo = useOpcoesFormador(lista.map(f => f.nome));
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 space-y-2">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Formadores</p>
        {onChangeExtra && (
          <MultiSearchSelect
            values={extraNomes}
            onChange={onChangeExtra}
            options={catalogo}
            noneLabel="Adicionar formadores opcionais…"
            unitSingular="formador"
            unitPlural="formadores"
          />
        )}
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
            const opt = catalogo.find(o => o.value === f.nome);
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
                  {/* Mapa formador × módulo desta turma (das sessões do cronograma). */}
                  {modulosDoFormador(sessoes, f.nome).length > 0 && (
                    <p className="mt-0.5 text-xs text-slate-600">{modulosDoFormador(sessoes, f.nome).map(m => `${m.modulo} · ${m.horas} h`).join("  ·  ")}</p>
                  )}
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
        ? `Não há turmas libertadas para «${curso}». Active uma turma Gold (local + horário + data) ou crie uma nova.`
        : "Não há turmas libertadas. Só turmas activas aparecem na pré-inscrição."}
    </p>
  );
}
