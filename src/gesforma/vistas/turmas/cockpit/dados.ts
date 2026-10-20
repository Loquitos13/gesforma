// Dados do cockpit de uma turma: a turma, os formandos, as outras turmas (para transferir) e as
// pré-inscrições candidatas. Tudo lido da API; as escritas gravam no servidor e recarregam.
import { useCallback, useMemo, useState } from "react";
import { apiLeads, type Lead } from "../../../../partilhado/api/crm";
import {
  apiApagarFormando, apiCriarFormandoFin, apiCriarFormandoGold, apiDocumentosFormandoFin, apiListarFormandos,
  type LinhaFormando,
} from "../../../../partilhado/api/formandos";
import { apiAlterarTurma, apiTurmaGravada, apiTurmas, type DadosTurma, type Regime, type TurmaGravada } from "../../../../partilhado/api/turmas";
import { apiResultadosTurma } from "../../../../partilhado/api/pedagogia";
import { useAuth } from "../../../../partilhado/AuthGate";
import { invalidar, useRecurso } from "../../../../partilhado/dados/useRecurso";
import { toastError } from "../../../../partilhado/toastBus";
import type { FormandoFin, FormandoTurma, Preinscricao } from "../../../../partilhado/tiposFormando";
import type { SessaoCronograma, TurmaFin, TurmaGold } from "../../../../partilhado/turmaModel";

function asGold(t: TurmaGravada & { totalAlunos?: number }): TurmaGold {
  return {
    id: t.id, dataInicio: t.dataInicio, nome: t.nome, curso: t.curso, local: t.local, horario: t.horario,
    totalAlunos: Number(t.totalAlunos ?? 0), vagas: Number(t.vagas ?? 0), toleranciaVagas: t.toleranciaVagas ?? 0,
    estado: t.estado === "Inativa" ? "Inativa" : "Ativa", formador: t.formador, formadores: t.formadores ?? [],
    horas: t.horas, custoHoraSala: t.custoHoraSala ?? 0, valoresHoraFormador: t.valoresHoraFormador ?? {},
    cronograma: Array.isArray(t.cronograma) ? t.cronograma : [],
  };
}

function asFin(t: TurmaGravada & { alunos?: number; estado?: string; fechadaEm?: string; fechadaPor?: string }): TurmaFin {
  return {
    id: t.id, dataInicio: t.dataInicio, nome: t.nome, curso: t.curso, ufcdCod: t.ufcdCod ?? "", local: t.local, horario: t.horario,
    alunos: Number(t.alunos ?? 0), alunosTotal: Number(t.alunosTotal ?? 0), toleranciaVagas: t.toleranciaVagas ?? 0,
    estado: t.estado ?? "", horas: t.horas, formador: t.formador, formadores: t.formadores ?? [],
    valoresHoraFormador: t.valoresHoraFormador ?? {}, activa: Boolean(t.activa), fechadaEm: t.fechadaEm ?? "",
    fechadaPor: t.fechadaPor ?? "", cronograma: Array.isArray(t.cronograma) ? t.cronograma : [],
  };
}

const chaveTurma = (regime: Regime, id: number) => `turma:${regime}:${id}`;

/** Recarrega tudo o que mostra a turma e os seus formandos (cockpit, lista de turmas, painel). */
export function recarregarTurma(regime: Regime, id: number) {
  invalidar(chaveTurma(regime, id));
  invalidar(`cockpit:${regime}:${id}:`);
  invalidar("turmas:");
  invalidar("formandos:");
  invalidar("painel:");
  // Financiada: valores por hora, formadores e cronograma mudam as despesas automáticas dos formadores.
  if (regime === "fin") invalidar("despesas:");
}

/** A turma (formato completo, com cronograma) e as alterações a ela. */
export function useTurmaCockpit<R extends Regime>(regime: R, id: number | undefined) {
  const { dados, erro, aCarregar } = useRecurso(id ? chaveTurma(regime, id) : null, signal => apiTurmaGravada(regime, id!, signal));
  const [local, setLocal] = useState<Partial<TurmaGold & TurmaFin> | null>(null);
  const base = useMemo(() => {
    if (!dados) return undefined;
    return regime === "gold" ? asGold(dados.turma) : asFin(dados.turma);
  }, [dados, regime]);
  const turma = (base ? { ...base, ...(local ?? {}) } : undefined) as (R extends "gold" ? TurmaGold : TurmaFin) | undefined;

  const gravar = useCallback(async (patch: Partial<DadosTurma>, otimista: Partial<TurmaGold & TurmaFin>) => {
    if (!id) return false;
    setLocal(prev => ({ ...(prev ?? {}), ...otimista }));
    try {
      await apiAlterarTurma(regime, id, patch);
      recarregarTurma(regime, id);
      setLocal(null);
      return true;
    } catch (err) {
      setLocal(null);
      toastError(err, "Não foi possível gravar a turma.");
      return false;
    }
  }, [id, regime]);

  const patch = useCallback((p: Partial<DadosTurma>) => { void gravar(p, p as Partial<TurmaGold & TurmaFin>); }, [gravar]);
  /** O servidor recusa cronogramas que cruzam sessões do mesmo formador noutra turma. */
  const setCronograma = useCallback((cronograma: SessaoCronograma[]) => {
    void gravar({ cronograma }, { cronograma });
    return true;
  }, [gravar]);
  const toggle = useCallback((activa: boolean) => {
    if (regime === "gold") void gravar({ estado: activa ? "Ativa" : "Inativa" }, { estado: activa ? "Ativa" : "Inativa" } as Partial<TurmaGold>);
    else void gravar({ activa }, { activa });
  }, [gravar, regime]);

  return { turma, erro, aCarregar: aCarregar && !turma, patch, setCronograma, toggle };
}

function linhaParaGold(l: LinhaFormando): FormandoTurma {
  return {
    id: l.id, nome: l.nome, apelido: l.apelido, telf: l.telf ?? "", email: l.email, inscrito: l.inscrito,
    local: l.local, curso: l.curso, turma: l.turma?.nome ?? "", turmaId: l.turma?.id ?? 0, estado: l.estado,
    pago: l.pagamento.pago, valor: l.pagamento.valor, metodo: l.pagamento.metodo, temAcesso: l.acesso,
  };
}

/** O formador não vê fichas de formandos: só os nomes da turma, que vêm dos resultados. */
async function nomesDaTurma(regime: Regime, id: number, signal: AbortSignal) {
  const r = await apiResultadosTurma(regime, id, signal);
  return r.formandos.map(f => ({ id: f.id, nome: f.nome, estado: f.estado }));
}

/** Resultados calculados no servidor (assiduidade, elegibilidade e o que falta para o fecho). Recarregam com a turma. */
export function useResultadosTurma(regime: Regime, id: number | undefined) {
  const { dados, erro, recarregar } = useRecurso(id ? `cockpit:${regime}:${id}:resultados` : null, signal => apiResultadosTurma(regime, id!, signal));
  return { resultados: dados, erro, recarregar };
}

/** Formandos Gold da turma. */
export function useMembrosGold(id: number | undefined) {
  const formador = useAuth().user.role === "formador";
  const { dados, aCarregar, erro } = useRecurso(id ? `cockpit:gold:${id}:formandos:${formador ? "f" : "e"}` : null, async signal => {
    if (!formador) return (await apiListarFormandos({ regime: "gold", turma: String(id), separador: "todos", porPagina: 200 }, signal)).linhas.map(linhaParaGold);
    return (await nomesDaTurma("gold", id!, signal)).map((f): FormandoTurma => ({
      id: f.id, nome: f.nome, apelido: "", telf: "", email: "", inscrito: "", local: "", curso: "", turma: "", turmaId: id!,
      estado: f.estado, pago: false, valor: 0, metodo: "",
    }));
  });
  return { membros: dados ?? [], aCarregar, erro };
}

/** Formandos da Financiada na turma, com o estado de cada documento de elegibilidade. */
export function useMembrosFin(id: number | undefined) {
  const formador = useAuth().user.role === "formador";
  const { dados, aCarregar, erro } = useRecurso(id ? `cockpit:fin:${id}:formandos:${formador ? "f" : "e"}` : null, async signal => {
    if (formador) {
      const vazio = { ok: false, data: "" };
      return (await nomesDaTurma("fin", id!, signal)).map((f): FormandoFin => ({
        id: f.id, nome: f.nome, apelido: "", turma: "", turmaId: id, telf: "", email: "", curso: "", estado: f.estado,
        cc: vazio, ch: vazio, cu: vazio, ci: vazio, ce: vazio,
      }));
    }
    const lista = await apiListarFormandos({ regime: "fin", turma: String(id), separador: "todos", porPagina: 200 }, signal);
    const docs = await Promise.all(lista.linhas.map(l => apiDocumentosFormandoFin(l.id, signal).catch(() => null)));
    return lista.linhas.map((l, i): FormandoFin => {
      const porId = new Map((docs[i]?.documentos ?? []).map(d => [d.id, { ok: d.estado === "validado", data: d.validadoEm ?? "" }]));
      const doc = (k: string) => porId.get(k) ?? { ok: false, data: "" };
      return {
        id: l.id, nome: l.nome, apelido: l.apelido, turma: l.turma?.nome ?? "", turmaId: l.turma?.id, telf: l.telf ?? "",
        email: l.email, curso: l.curso, estado: l.estado, temAcesso: l.acesso,
        cc: doc("cc"), ch: doc("ch"), cu: doc("cu"), ci: doc("ci"), ce: doc("ce"),
        morada: doc("morada"), contrato: doc("contrato"), rgpd: doc("rgpd"),
      };
    });
  });
  return { membros: dados ?? [], aCarregar, erro };
}

/** Outras turmas do mesmo regime (destinos de transferência). */
export function useOutrasTurmas(regime: Regime, id: number | undefined, ativo: boolean) {
  const { dados } = useRecurso(
    ativo && id ? `turmas:${regime}:destinos` : null,
    signal => apiTurmas({ regime, porPagina: 200 }, signal),
  );
  return useMemo(() => (dados?.linhas ?? []).filter(t => t.id !== id && !t.fechadaEm), [dados, id]);
}

function leadParaPre(l: Lead): Preinscricao {
  return {
    id: l.id, inscrito: l.inscrito, nome: l.nome, apelido: l.apelido, email: l.email, telf: l.telf,
    inicioCurso: l.inicioCurso, concelho: l.concelho, local: l.local, curso: l.curso, preco: l.preco,
    estado: l.estado, campanha: l.campanha, origem: l.origem, horario: l.horario, turmaId: l.turmaId || undefined,
    pagamentoMetodo: l.pagamentoMetodo, regime: l.regime,
  };
}

/** Pré-inscrições do curso da turma (candidatas a inscrever). Só carrega com o painel aberto. */
export function useLeadsDoCurso(regime: Regime, curso: string | undefined, ativo: boolean) {
  const { dados, aCarregar } = useRecurso(
    ativo && curso ? `crm:leads:${regime}:curso:${curso}` : null,
    signal => apiLeads({ regime, curso, perPage: 100, sort: "inscrito", dir: "desc" }, signal),
  );
  return { leads: useMemo(() => (dados?.items ?? []).map(leadParaPre), [dados]), aCarregar };
}

/** Inscreve um formando na turma (cria a ficha no servidor, que recalcula a ocupação). */
export async function inscreverNaTurma(regime: Regime, turma: { id: number; nome: string; curso: string; local: string }, dados: {
  nome: string; apelido: string; email: string; telf: string; pagamento?: Record<string, unknown>;
}) {
  try {
    const r = regime === "gold"
      ? await apiCriarFormandoGold({
        nome: dados.nome, apelido: dados.apelido, email: dados.email, telf: dados.telf,
        curso: turma.curso, local: turma.local, turmaId: turma.id, ...(dados.pagamento ?? {}),
      } as Parameters<typeof apiCriarFormandoGold>[0])
      : await apiCriarFormandoFin({ nome: dados.nome, apelido: dados.apelido, email: dados.email, telf: dados.telf, curso: turma.curso, turmaId: turma.id, estado: "Elegível" });
    recarregarTurma(regime, turma.id);
    const formando = (r as { formando?: { id?: number } }).formando;
    return formando?.id;
  } catch (err) {
    toastError(err, "Não foi possível inscrever o formando.");
    return undefined;
  }
}

export async function retirarDaTurma(regime: Regime, turmaId: number, formandoId: number) {
  try {
    await apiApagarFormando(regime, formandoId);
    recarregarTurma(regime, turmaId);
    return true;
  } catch (err) {
    toastError(err, "Não foi possível eliminar o formando.");
    return false;
  }
}
