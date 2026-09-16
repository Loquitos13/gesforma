import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiCreateTurmaFin, apiCreateTurmaGold, apiDeleteTurmaFin, apiDeleteTurmaGold, apiPatchTurmaFin, apiPatchTurmaGold } from "./api";
import { loadOps } from "./opsCache";
import { generateCronograma, seedFinTurmas, seedGoldTurmas, type SessaoCronograma, type TurmaFin, type TurmaGold } from "./turmaModel";

type TurmasCtx = {
  gold: TurmaGold[];
  fin: TurmaFin[];
  patchGold: (id: number, patch: Partial<TurmaGold>) => void;
  addGold: (turma: TurmaGold) => void;
  removeGold: (id: number) => void;
  setGoldCronograma: (id: number, cronograma: SessaoCronograma[]) => void;
  toggleGold: (id: number, activa: boolean) => void;
  patchFin: (id: number, patch: Partial<TurmaFin>) => void;
  addFin: (turma: TurmaFin) => void;
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
    }).catch(() => undefined);
    return () => { alive = false; };
  }, []);

  const patchGold = useCallback((id: number, patch: Partial<TurmaGold>) => {
    setGold(xs => xs.map(t => t.id === id ? { ...t, ...patch } : t));
    void apiPatchTurmaGold(id, patch).catch(() => undefined);
  }, []);
  const addGold = useCallback((turma: TurmaGold) => {
    setGold(xs => [turma, ...xs]);
    void apiCreateTurmaGold(turma).then(r => {
      if (r.turma) setGold(xs => xs.map(t => t.id === turma.id ? hydrateGold(r.turma) : t));
    }).catch(() => undefined);
  }, []);
  const removeGold = useCallback((id: number) => {
    setGold(xs => xs.filter(t => t.id !== id));
    void apiDeleteTurmaGold(id).catch(() => undefined);
  }, []);
  const setGoldCronograma = useCallback((id: number, cronograma: SessaoCronograma[]) => {
    setGold(xs => xs.map(t => t.id === id ? { ...t, cronograma } : t));
    void apiPatchTurmaGold(id, { cronograma }).catch(() => undefined);
  }, []);
  const toggleGold = useCallback((id: number, activa: boolean) => {
    const estado = activa ? "Ativa" : "Inativa";
    setGold(xs => xs.map(t => t.id === id ? { ...t, estado } : t));
    void apiPatchTurmaGold(id, { estado }).catch(() => undefined);
  }, []);

  const patchFin = useCallback((id: number, patch: Partial<TurmaFin>) => {
    setFin(xs => xs.map(t => t.id === id ? { ...t, ...patch } : t));
    void apiPatchTurmaFin(id, patch).catch(() => undefined);
  }, []);
  const addFin = useCallback((turma: TurmaFin) => {
    setFin(xs => [turma, ...xs]);
    void apiCreateTurmaFin(turma).then(r => {
      if (r.turma) setFin(xs => xs.map(t => t.id === turma.id ? hydrateFin(r.turma) : t));
    }).catch(() => undefined);
  }, []);
  const removeFin = useCallback((id: number) => {
    setFin(xs => xs.filter(t => t.id !== id));
    void apiDeleteTurmaFin(id).catch(() => undefined);
  }, []);
  const setFinCronograma = useCallback((id: number, cronograma: SessaoCronograma[]) => {
    setFin(xs => xs.map(t => t.id === id ? { ...t, cronograma } : t));
    void apiPatchTurmaFin(id, { cronograma }).catch(() => undefined);
  }, []);
  const toggleFin = useCallback((id: number, activa: boolean) => {
    setFin(xs => xs.map(t => t.id === id ? { ...t, activa } : t));
    void apiPatchTurmaFin(id, { activa }).catch(() => undefined);
  }, []);

  const value = useMemo(() => ({
    gold, fin, patchGold, addGold, removeGold, setGoldCronograma, toggleGold, patchFin, addFin, removeFin, setFinCronograma, toggleFin,
  }), [gold, fin, patchGold, addGold, removeGold, setGoldCronograma, toggleGold, patchFin, addFin, removeFin, setFinCronograma, toggleFin]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTurmas() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTurmas precisa de TurmasProvider");
  return ctx;
}
