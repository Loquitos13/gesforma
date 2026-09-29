import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiCreateTurmaFin, apiCreateTurmaGold, apiDeleteTurmaFin, apiDeleteTurmaGold, apiPatchTurmaFin, apiPatchTurmaGold } from "./api";
import { loadOps } from "./opsCache";
import { persist, toastError } from "./toastBus";
import { generateCronograma, seedFinTurmas, seedGoldTurmas, type SessaoCronograma, type TurmaFin, type TurmaGold } from "./turmaModel";

type TurmasCtx = {
  gold: TurmaGold[];
  fin: TurmaFin[];
  reload: () => Promise<void>;
  patchGold: (id: number, patch: Partial<TurmaGold>) => void;
  addGold: (turma: TurmaGold) => Promise<number | undefined>;
  removeGold: (id: number) => void;
  setGoldCronograma: (id: number, cronograma: SessaoCronograma[]) => void;
  toggleGold: (id: number, activa: boolean) => void;
  patchFin: (id: number, patch: Partial<TurmaFin>) => void;
  addFin: (turma: TurmaFin) => Promise<number | undefined>;
  removeFin: (id: number) => void;
  setFinCronograma: (id: number, cronograma: SessaoCronograma[]) => void;
  toggleFin: (id: number, activa: boolean) => void;
};

const Ctx = createContext<TurmasCtx | null>(null);

function asCronograma(raw: unknown): SessaoCronograma[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is SessaoCronograma => !!x && typeof x === "object" && "id" in x);
}

function hydrateGold(t: Omit<TurmaGold, "cronograma" | "estado"> & { estado: string; cronograma?: unknown }): TurmaGold {
  const cronograma = asCronograma(t.cronograma);
  return {
    ...t,
    estado: t.estado === "Inativa" ? "Inativa" : "Ativa",
    cronograma: cronograma.length ? cronograma : generateCronograma({
      inicio: t.dataInicio,
      horario: t.horario,
      horas: t.horas || 90,
      formador: t.formador,
      curso: t.curso,
    }),
  };
}

function hydrateFin(t: Omit<TurmaFin, "cronograma"> & { cronograma?: unknown }): TurmaFin {
  const cronograma = asCronograma(t.cronograma);
  return {
    ...t,
    cronograma: cronograma.length ? cronograma : generateCronograma({
      inicio: t.dataInicio,
      horario: t.horario === "Online" ? "Pós Laboral" : t.horario,
      horas: t.horas || 25,
      formador: t.formador,
      curso: t.curso,
      hoursPerSession: 3,
    }),
  };
}

export function TurmasProvider({ children }: { children: ReactNode }) {
  const [gold, setGold] = useState<TurmaGold[]>(() => seedGoldTurmas());
  const [fin, setFin] = useState<TurmaFin[]>(() => seedFinTurmas());

  useEffect(() => {
    let alive = true;
    loadOps().then(snap => {
      if (!alive) return;
      setGold(snap.turmasGold.map(hydrateGold));
      setFin(snap.turmasFin.map(hydrateFin));
    }).catch(() => {
      if (!alive) return;
      toastError(new Error("A API não respondeu. As turmas de demonstração saíram da lista."));
      setGold([]);
      setFin([]);
    });
    return () => { alive = false; };
  }, []);

  const patchGold = useCallback((id: number, patch: Partial<TurmaGold>) => {
    if (id < 0) return;
    setGold(xs => xs.map(t => t.id === id ? { ...t, ...patch } : t));
    void persist(apiPatchTurmaGold(id, patch));
  }, []);
  const addGold = useCallback(async (turma: TurmaGold) => {
    setGold(xs => [turma, ...xs]);
    const r = await persist(apiCreateTurmaGold(turma).then(res => {
      if (res.turma) setGold(xs => xs.map(t => t.id === turma.id ? hydrateGold(res.turma) : t));
      return res;
    }), () => setGold(xs => xs.filter(t => t.id !== turma.id)));
    return r?.turma?.id;
  }, []);
  const removeGold = useCallback((id: number) => {
    let before: TurmaGold | undefined;
    setGold(xs => {
      before = xs.find(t => t.id === id);
      return xs.filter(t => t.id !== id);
    });
    void persist(apiDeleteTurmaGold(id), () => {
      if (before) setGold(xs => [before!, ...xs]);
    });
  }, []);
  const setGoldCronograma = useCallback((id: number, cronograma: SessaoCronograma[]) => {
    if (id < 0) return;
    setGold(xs => xs.map(t => t.id === id ? { ...t, cronograma } : t));
    void persist(apiPatchTurmaGold(id, { cronograma }));
  }, []);
  const toggleGold = useCallback((id: number, activa: boolean) => {
    if (id < 0) return;
    const estado = activa ? "Ativa" : "Inativa";
    setGold(xs => xs.map(t => t.id === id ? { ...t, estado } : t));
    void persist(apiPatchTurmaGold(id, { estado }));
  }, []);

  const patchFin = useCallback((id: number, patch: Partial<TurmaFin>) => {
    if (id < 0) return;
    setFin(xs => xs.map(t => t.id === id ? { ...t, ...patch } : t));
    void persist(apiPatchTurmaFin(id, patch));
  }, []);
  const addFin = useCallback(async (turma: TurmaFin) => {
    setFin(xs => [turma, ...xs]);
    const r = await persist(apiCreateTurmaFin(turma).then(res => {
      if (res.turma) setFin(xs => xs.map(t => t.id === turma.id ? hydrateFin(res.turma) : t));
      return res;
    }), () => setFin(xs => xs.filter(t => t.id !== turma.id)));
    return r?.turma?.id;
  }, []);
  const removeFin = useCallback((id: number) => {
    let before: TurmaFin | undefined;
    setFin(xs => {
      before = xs.find(t => t.id === id);
      return xs.filter(t => t.id !== id);
    });
    void persist(apiDeleteTurmaFin(id), () => {
      if (before) setFin(xs => [before!, ...xs]);
    });
  }, []);
  const setFinCronograma = useCallback((id: number, cronograma: SessaoCronograma[]) => {
    if (id < 0) return;
    setFin(xs => xs.map(t => t.id === id ? { ...t, cronograma } : t));
    void persist(apiPatchTurmaFin(id, { cronograma }));
  }, []);
  const toggleFin = useCallback((id: number, activa: boolean) => {
    if (id < 0) return;
    setFin(xs => xs.map(t => t.id === id ? { ...t, activa } : t));
    void persist(apiPatchTurmaFin(id, { activa }));
  }, []);

  const reload = useCallback(async () => {
    const snap = await loadOps();
    setGold(snap.turmasGold.map(hydrateGold));
    setFin(snap.turmasFin.map(hydrateFin));
  }, []);

  const value = useMemo(() => ({
    gold, fin, reload, patchGold, addGold, removeGold, setGoldCronograma, toggleGold, patchFin, addFin, removeFin, setFinCronograma, toggleFin,
  }), [gold, fin, reload, patchGold, addGold, removeGold, setGoldCronograma, toggleGold, patchFin, addFin, removeFin, setFinCronograma, toggleFin]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTurmas() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTurmas precisa de TurmasProvider");
  return ctx;
}
