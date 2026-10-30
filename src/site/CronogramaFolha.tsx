import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { TurmaPercurso } from "../partilhado/api";
import { apiPublicEntidade, type EntidadePublica } from "../partilhado/api/publico";
import { useRecurso } from "../partilhado/dados/useRecurso";
import { mapLocalTurma } from "../partilhado/cronogramaLocal";
import { comFimCronograma, datesFromRange, FIM_CRONOGRAMA_ID, grelhaPeriodo, linhasFromSessoes, saltosVazios, sessoesSemFim } from "../partilhado/cronogramaGrelha";
import { buildCronogramaPrintHtml, medidasFolha } from "../partilhado/cronogramaPrint";
import { codigoInternoTurma } from "../partilhado/turmaCodigo";
import type { SessaoModalidade, SessaoCronograma } from "../partilhado/turmaModel";

const MODALIDADES = new Set<SessaoModalidade>(["presencial", "sincrona", "auto", "avaliacao", "matricula"]);
const NIVEIS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];

/** O que a folha precisa da turma: a área do formando e a página pública do cronograma dão o mesmo. */
export type TurmaFolha = Pick<TurmaPercurso, "nome" | "local" | "horario" | "dataInicio" | "plano"> & { dataFim?: string };

function planoParaSessoes(turma: TurmaFolha): SessaoCronograma[] {
  return sessoesSemFim((turma.plano ?? []).map(s => ({
    id: s.id,
    data: s.data,
    horaInicio: s.horaInicio,
    horaFim: s.horaFim,
    modulos: s.modulos,
    formadores: s.formadores,
    modalidade: MODALIDADES.has(s.modalidade as SessaoModalidade) ? s.modalidade as SessaoModalidade : undefined,
  })));
}

export function folhaDe(turma: TurmaFolha, curso: string, entidade?: EntidadePublica, cores: "gold" | "fin" = "gold") {
  const sessoes = planoParaSessoes(turma);
  if (!sessoes.length) return null;
  // A «Data de fim» da turma conta mesmo que seja depois da última sessão.
  const fimGuardado = turma.dataFim || (turma.plano ?? []).find(s => s.id === FIM_CRONOGRAMA_ID)?.data || "";
  const periodo = grelhaPeriodo(comFimCronograma(sessoes, fimGuardado), turma.dataInicio);
  const matricula = periodo.matricula ?? "";
  const inicio = turma.dataInicio;
  const fim = periodo.fim || inicio;
  const start = [matricula, inicio, periodo.inicio].filter(Boolean).sort()[0] ?? inicio;
  // Os intervalos longos sem eventos saltam-se, como na grelha da turma.
  const todos = datesFromRange(start, fim);
  const saltos = saltosVazios(todos, sessoes, matricula, inicio);
  const dates = todos.filter(d => !saltos.some(x => d >= x.de && d <= x.ate));
  const linhas = linhasFromSessoes(sessoes, turma.horario);
  const input = {
    horario: turma.horario,
    curso,
    nome: turma.nome,
    codigo: codigoInternoTurma(curso, turma.local, turma.horario, inicio),
    matricula,
    inicio,
    fim,
    local: mapLocalTurma(turma.local),
    dates,
    linhas,
    sessoes,
    embutido: true,
    entidade,
    cores,
  };
  const { page } = medidasFolha(input);
  return { html: buildCronogramaPrintHtml(input), larguraMm: page.largura, alturaMm: page.altura, input };
}

function nivelPerto(zoom: number) {
  let idx = 0;
  let dist = Infinity;
  NIVEIS.forEach((n, i) => {
    const d = Math.abs(n - zoom);
    if (d < dist) { dist = d; idx = i; }
  });
  return idx;
}

/** A folha de Imprimir / PDF, numa janela com zoom. */
export function CronogramaModal({
  turma, curso, open, onClose,
}: {
  turma: TurmaPercurso;
  curso: string;
  open: boolean;
  onClose: () => void;
}) {
  const { dados: ent } = useRecurso(open ? "publico:entidade" : null, signal => apiPublicEntidade(signal));
  const folha = useMemo(() => folhaDe(turma, curso, ent?.entidade), [turma, curso, ent]);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (open) setZoom(1);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "+" || e.key === "=") setZoom(z => NIVEIS[Math.min(NIVEIS.length - 1, nivelPerto(z) + 1)] ?? z);
      if (e.key === "-" || e.key === "_") setZoom(z => NIVEIS[Math.max(0, nivelPerto(z) - 1)] ?? z);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  const idx = nivelPerto(zoom);

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="cronograma-modal-titulo">
      <button type="button" className="absolute inset-0 bg-[#1b2330]/55" aria-label="Fechar cronograma" onClick={onClose} />
      <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-[min(92vh,920px)] sm:max-w-6xl sm:rounded-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#efeae1] px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 id="cronograma-modal-titulo" className="text-base font-semibold">Cronograma · {turma.nome}</h2>
            <p className="mt-0.5 text-xs text-[#8a8172]">{turma.local} · {turma.horario}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-[#e7e1d6] bg-[#faf8f4]">
              <button type="button" disabled={!folha || idx <= 0} onClick={() => setZoom(z => NIVEIS[Math.max(0, nivelPerto(z) - 1)] ?? z)} className="px-3 py-2 text-sm font-semibold disabled:opacity-30" aria-label="Diminuir">−</button>
              <span className="min-w-12 text-center text-xs font-semibold tabular-nums">{Math.round(zoom * 100)}%</span>
              <button type="button" disabled={!folha || idx >= NIVEIS.length - 1} onClick={() => setZoom(z => NIVEIS[Math.min(NIVEIS.length - 1, nivelPerto(z) + 1)] ?? z)} className="px-3 py-2 text-sm font-semibold disabled:opacity-30" aria-label="Aumentar">+</button>
            </div>
            <button type="button" disabled={!folha || zoom === 1} onClick={() => setZoom(1)} className="rounded-lg border border-[#e7e1d6] px-3 py-2 text-xs font-semibold disabled:opacity-40">Ajustar</button>
            <button type="button" onClick={onClose} className="rounded-lg bg-[#1b2330] px-3 py-2 text-xs font-semibold text-white">Fechar</button>
          </div>
        </div>
        <FolhaAjustada folha={folha} zoom={zoom} titulo={`Cronograma ${turma.nome}`} className="min-h-0 flex-1" />
      </div>
    </div>,
    document.body,
  );
}

/** A folha à largura da caixa (vezes o zoom), tal e qual sai no Imprimir / PDF. */
export function FolhaAjustada({ folha, zoom = 1, titulo, className = "" }: {
  folha: ReturnType<typeof folhaDe>; zoom?: number; titulo: string; className?: string;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(0);
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const medir = () => setLargura(el.clientWidth);
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, [folha]);
  const pxW = folha ? folha.larguraMm * 3.779527 : 0;
  const pxH = folha ? folha.alturaMm * 3.779527 : 0;
  const fit = largura > 0 && pxW > 0 ? largura / pxW : 0;
  const escala = fit * zoom;
  return (
    <div ref={caixa} className={`overflow-auto bg-[#f4f1ea] p-3 sm:p-5 ${className}`}>
      {!folha && <p className="text-sm text-[#5c564c]">Ainda sem cronograma nesta turma.</p>}
      {folha && escala > 0 && (
        <div className="mx-auto bg-white shadow-sm" style={{ width: Math.ceil(pxW * escala), height: Math.ceil(pxH * escala) }}>
          <iframe
            title={titulo}
            srcDoc={folha.html}
            // Sem scripts; a mesma origem só deixa carregar o logótipo da entidade.
            sandbox="allow-same-origin"
            className="pointer-events-none border-0 bg-white"
            style={{ width: pxW, height: pxH, transform: `scale(${escala})`, transformOrigin: "top left" }}
          />
        </div>
      )}
    </div>
  );
}
