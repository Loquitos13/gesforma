import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  apiDtpResumo,
  apiDtpModelo,
  apiCursoFicha,
  apiPedagogia,
  apiSaveCertificado,
  apiSaveDtpAnexo,
  apiSaveDtpItem,
  apiSaveSessao,
  apiSaveTurmaDocumento,
  type DtpEstado,
  type DtpSnapshot,
  type PedagogiaSnapshot,
  type Regime,
  type TurmaCertificado,
  type TurmaDocumento,
} from "../partilhado/api";
import { useCursoId } from "../partilhado/dados/comuns";
import { persist } from "../partilhado/toastBus";
import { emptyPlano, emptySumario, type CriterioAvaliacao, type PlanoSessaoData, type SumarioSessaoData } from "../partilhado/TurmaExtras";
import { naPosicaoActual, type SessaoCronograma } from "../partilhado/turmaModel";
import { useCriteriosModelo } from "./criteriosModelo";
import { useProgramaDoCurso } from "./cursoPrograma";

export type PresencaRow = { id: number; nome: string; presente: boolean };

/** Junta as presenças já gravadas à lista de formandos da turma, para a folha abrir no estado real. */
export function presencasDaSessao(
  formandos: { id: number; nome: string }[],
  guardadas: PresencaRow[] | undefined,
) {
  if (!guardadas?.length) return formandos.map(f => ({ ...f, presente: true }));
  return formandos.map(f => ({ ...f, presente: guardadas.find(g => g.id === f.id)?.presente ?? true }));
}

/** Critérios de avaliação da simulação pedagógica: os da ficha do curso, ou a grelha-tipo (API) que casa com o curso. */
export function useCriteriosAvaliacao(regime: Regime, cursoNome: string | undefined) {
  const modelo = useCriteriosModelo(regime, cursoNome);
  const [criterios, setCriterios] = useState<CriterioAvaliacao[] | null>(null);
  const cursoId = useCursoId(regime, cursoNome);

  useEffect(() => {
    if (cursoId == null) { setCriterios(null); return; }
    let alive = true;
    apiCursoFicha(regime, cursoId)
      .then(r => { if (alive) setCriterios(r.ficha?.criterios ?? null); })
      .catch(() => { if (alive) setCriterios(null); });
    return () => { alive = false; };
  }, [cursoId, regime]);

  if (criterios?.length) return criterios;
  return modelo;
}

/** Programa pedagógico da ficha do curso (módulos ou capítulos). */
export function useCursoPrograma(regime: Regime, cursoNome: string | undefined) {
  return useProgramaDoCurso(regime, cursoNome).labels;
}

const vazio: PedagogiaSnapshot = {
  sessoes: [],
  documentos: [],
  certificados: [],
  dtp: {
    items: [], pct: 0, ok: 0, parcial: 0, falta: 0, total: 0,
    facts: {
      sessoes: { done: 0, total: 0 }, planos: { done: 0, total: 0 }, sumarios: { done: 0, total: 0 },
      presencas: { done: 0, total: 0 }, formandos: 0, certificados: { done: 0, total: 0 },
    },
  },
};

/**
 * Dossiê pedagógico da turma: planos, sumários, presenças, documentos, DTP e certificados.
 * Com o `cronograma` que o ecrã mostra, os dados de cada sessão seguem o id dela: o `n` do servidor é a posição
 * de quando se leu, e depois de mexer na grelha as sessões mudam de lugar antes de a pedagogia recarregar.
 */
export function useTurmaPedagogia(regime: Regime, turmaId: number | undefined, cronograma?: SessaoCronograma[]) {
  const [snap, setSnap] = useState<PedagogiaSnapshot>(vazio);
  const [estado, setEstado] = useState<"loading" | "ready" | "offline">("loading");
  const pedido = useRef(0);

  const recarregar = useCallback(async () => {
    if (turmaId == null || turmaId <= 0) return;
    const token = ++pedido.current;
    try {
      const r = await apiPedagogia(regime, turmaId);
      if (pedido.current !== token) return;
      setSnap(r);
      setEstado("ready");
    } catch {
      if (pedido.current !== token) return;
      setSnap(vazio);
      setEstado("offline");
    }
  }, [regime, turmaId]);

  useEffect(() => {
    setEstado("loading");
    void recarregar();
  }, [recarregar]);

  const sessoesActuais = useMemo(
    () => (cronograma ? naPosicaoActual(snap.sessoes, cronograma) : snap.sessoes),
    [snap.sessoes, cronograma],
  );

  const planos = useMemo(() => {
    const out: Record<number, PlanoSessaoData> = {};
    for (const s of sessoesActuais) {
      if (s.plano) out[s.n] = s.plano as unknown as PlanoSessaoData;
    }
    return out;
  }, [sessoesActuais]);

  const sumarios = useMemo(() => {
    const out: Record<number, SumarioSessaoData> = {};
    for (const s of sessoesActuais) {
      if (s.sumario) out[s.n] = s.sumario as unknown as SumarioSessaoData;
    }
    return out;
  }, [sessoesActuais]);

  const presencas = useMemo(() => {
    const out: Record<number, PresencaRow[]> = {};
    for (const s of sessoesActuais) {
      if (s.presencas.length) out[s.n] = s.presencas;
    }
    return out;
  }, [sessoesActuais]);

  const certificados = useMemo(() => {
    const out: Record<number, TurmaCertificado> = {};
    for (const c of snap.certificados) out[c.formandoId] = c;
    return out;
  }, [snap.certificados]);

  const mergeSessao = useCallback((n: number, sessaoId: string | undefined, patch: Partial<{ plano: unknown; sumario: unknown; presencas: PresencaRow[] }>) => {
    setSnap(prev => {
      const esta = (s: typeof prev.sessoes[number]) => (sessaoId && s.sessaoId ? s.sessaoId === sessaoId : s.n === n);
      const existe = prev.sessoes.some(esta);
      const sessoes = existe
        ? prev.sessoes.map(s => (esta(s) ? { ...s, ...patch } as typeof s : s))
        : [...prev.sessoes, { n, sessaoId, plano: null, sumario: null, presencas: [], ...patch } as typeof prev.sessoes[number]];
      return { ...prev, sessoes: sessoes.sort((a, b) => a.n - b.n) };
    });
  }, []);

  const guardarPlano = useCallback(async (n: number, plano: PlanoSessaoData, sessaoId?: string) => {
    mergeSessao(n, sessaoId, { plano });
    if (turmaId == null || turmaId <= 0) return;
    await persist(apiSaveSessao(regime, turmaId, n, { sessaoId, plano }));
    void recarregar();
  }, [mergeSessao, recarregar, regime, turmaId]);

  const guardarSumario = useCallback(async (n: number, sumario: SumarioSessaoData, sessaoId?: string) => {
    mergeSessao(n, sessaoId, { sumario });
    if (turmaId == null || turmaId <= 0) return;
    await persist(apiSaveSessao(regime, turmaId, n, { sessaoId, sumario }));
    void recarregar();
  }, [mergeSessao, recarregar, regime, turmaId]);

  const guardarPresencas = useCallback(async (n: number, rows: PresencaRow[], sessaoId?: string) => {
    mergeSessao(n, sessaoId, { presencas: rows });
    if (turmaId == null || turmaId <= 0) return;
    await persist(apiSaveSessao(regime, turmaId, n, { sessaoId, presencas: rows }));
    void recarregar();
  }, [mergeSessao, recarregar, regime, turmaId]);

  const guardarDocumento = useCallback(async (doc: TurmaDocumento) => {
    setSnap(prev => {
      const existe = prev.documentos.some(d => d.grupoId === doc.grupoId && d.label === doc.label);
      return {
        ...prev,
        documentos: existe
          ? prev.documentos.map(d => (d.grupoId === doc.grupoId && d.label === doc.label ? { ...d, ...doc } : d))
          : [...prev.documentos, doc],
      };
    });
    if (turmaId == null || turmaId <= 0) return;
    await persist(apiSaveTurmaDocumento(regime, turmaId, doc));
    void recarregar();
  }, [recarregar, regime, turmaId]);

  const guardarDtp = useCallback(async (itemId: string, estadoNovo: DtpEstado | "auto") => {
    if (turmaId == null || turmaId <= 0) return;
    const r = await persist(apiSaveDtpItem(regime, turmaId, itemId, estadoNovo));
    if (r) setSnap(prev => ({ ...prev, dtp: r.dtp }));
  }, [regime, turmaId]);

  const guardarDtpAnexo = useCallback(async (itemId: string, file: { id: string; name: string; openUrl: string }) => {
    if (turmaId == null || turmaId <= 0) return;
    const r = await persist(apiSaveDtpAnexo(regime, turmaId, itemId, {
      driveFileId: file.id, fileName: file.name, driveUrl: file.openUrl,
    }));
    if (r) setSnap(prev => ({ ...prev, dtp: r.dtp }));
  }, [regime, turmaId]);

  const guardarCertificado = useCallback(async (formandoId: number, patch: {
    emitido?: boolean;
    nota?: number | null;
    elearning?: number | null;
    ficheiroId?: string;
    ficheiroNome?: string;
    ficheiroUrl?: string;
  }) => {
    setSnap(prev => {
      const existe = prev.certificados.some(c => c.formandoId === formandoId);
      const base: TurmaCertificado = { formandoId, emitido: false, nota: null, elearning: null };
      return {
        ...prev,
        certificados: existe
          ? prev.certificados.map(c => (c.formandoId === formandoId ? { ...c, ...patch } : c))
          : [...prev.certificados, { ...base, ...patch }],
      };
    });
    if (turmaId == null || turmaId <= 0) return;
    await persist(apiSaveCertificado(regime, turmaId, formandoId, patch));
    void recarregar();
  }, [recarregar, regime, turmaId]);

  return {
    estado,
    dtp: snap.dtp,
    documentos: snap.documentos,
    planosDoCurso: snap.planosDoCurso ?? [],
    planos,
    sumarios,
    presencas,
    certificados,
    plano: (n: number) => planos[n] ?? emptyPlano(),
    sumario: (n: number) => sumarios[n] ?? emptySumario(),
    guardarPlano,
    guardarSumario,
    guardarPresencas,
    guardarDocumento,
    guardarDtp,
    guardarDtpAnexo,
    guardarCertificado,
    recarregar,
  };
}

export type DtpResumo = { pct: Record<number, number>; estado: "loading" | "ready" | "offline" };

/** Percentagens do DTP por turma, para a lista de Dossiê TP e para o chip do cockpit. */
export function useDtpResumo(regime: Regime): DtpResumo {
  const [pct, setPct] = useState<Record<number, number>>({});
  const [estado, setEstado] = useState<DtpResumo["estado"]>("loading");
  useEffect(() => {
    let alive = true;
    apiDtpResumo(regime)
      .then(r => {
        if (!alive) return;
        setPct(Object.fromEntries(Object.entries(r.pct).map(([k, v]) => [Number(k), v])));
        setEstado("ready");
      })
      .catch(() => { if (alive) setEstado("offline"); });
    return () => { alive = false; };
  }, [regime]);
  return { pct, estado };
}

export function dtpSnapshotPct(dtp: DtpSnapshot) {
  return dtp.total > 0 ? dtp.pct : 0;
}
