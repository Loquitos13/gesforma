import { useEffect, useMemo, useRef, useState } from "react";
import type { TurmaPercurso } from "./api";
import { mapLocalTurma } from "./cronogramaLocal";
import {
  datesFromRange,
  grelhaPeriodo,
  linhasFromSessoes,
  sessoesSemFim,
} from "./cronogramaGrelha";
import { buildCronogramaPrintHtml, largurasColunaMm, printPageSize } from "./cronogramaPrint";
import { codigoInternoTurma } from "./turmaCodigo";
import type { SessaoCronograma, SessaoModalidade } from "./turmaModel";

const MODALIDADES = new Set<SessaoModalidade>(["presencial", "sincrona", "auto", "avaliacao", "matricula"]);

function planoParaSessoes(turma: TurmaPercurso): SessaoCronograma[] {
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

function folhaDe(turma: TurmaPercurso, curso: string) {
  const sessoes = planoParaSessoes(turma);
  if (!sessoes.length) return null;
  const periodo = grelhaPeriodo(sessoes, turma.dataInicio);
  const matricula = periodo.matricula ?? "";
  const inicio = turma.dataInicio;
  const fim = periodo.fim || inicio;
  const start = [matricula, inicio, periodo.inicio].filter(Boolean).sort()[0] ?? inicio;
  const dates = datesFromRange(start, fim);
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
  };
  const page = printPageSize(largurasColunaMm(dates, linhas, sessoes), linhas.length);
  return { html: buildCronogramaPrintHtml(input), larguraMm: page.largura, alturaMm: page.altura };
}

/** A mesma folha do PDF da turma, à largura do cartão. */
export function CronogramaFolha({ turma, curso }: { turma: TurmaPercurso; curso: string }) {
  const folha = useMemo(() => folhaDe(turma, curso), [turma, curso]);
  const caixa = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(0);
  const temFolha = Boolean(folha);

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const medir = () => setLargura(el.clientWidth);
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, [temFolha]);

  if (!folha) {
    return <p className="border-t border-[#efeae1] px-4 py-3 text-xs text-[#8a8172]">Ainda sem cronograma nesta turma.</p>;
  }

  const pxW = folha.larguraMm * 3.779527;
  const pxH = folha.alturaMm * 3.779527;
  // A folha oficial é larga. Encolhe até caber no cartão, sem descer abaixo de um tamanho legível.
  const escala = largura > 0 ? Math.min(1, Math.max(0.55, largura / pxW)) : 0;
  const w = Math.ceil(pxW * (escala || 1));
  const h = Math.ceil(pxH * (escala || 1));

  return (
    <div
      ref={caixa}
      className="max-h-[340px] overflow-auto border-t border-[#efeae1] bg-white"
      style={{ height: escala ? Math.min(340, h) : 160 }}
    >
      {escala > 0 && (
        <div style={{ width: w, height: h }}>
          <iframe
            title={`Cronograma ${turma.nome}`}
            srcDoc={folha.html}
            sandbox=""
            className="pointer-events-none border-0 bg-white"
            style={{ width: pxW, height: pxH, transform: `scale(${escala})`, transformOrigin: "top left" }}
          />
        </div>
      )}
    </div>
  );
}
