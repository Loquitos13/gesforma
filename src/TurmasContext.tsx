import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  apiCreateTurma,
  apiDeleteTurma,
  apiGetTurmas,
  apiPatchTurma,
  apiSaveCronograma,
  apiToggleTurma,
} from "./api";
import { seedFinTurmas, seedGoldTurmas, type SessaoCronograma, type TurmaFin, type TurmaGold } from "./turmaModel";

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

export function TurmasProvider({ children }: { children: ReactNode }) {
  const [gold, setGold] = useState<TurmaGold[]>(() => seedGoldTurmas());
  const [fin, setFin] = useState<TurmaFin[]>(() => seedFinTurmas());

  useEffect(() => {
    let alive = true;
    apiGetTurmas().then(res => {
      if (!alive) return;
      if (res?.gold?.length) setGold(res.gold);
      if (res?.fin?.length) setFin(res.fin);
    }).catch(() => undefined);
    return () => { alive = false; };
  }, []);

  const patchGold = useCallback((id: number, patch: Partial<TurmaGold>) => {
    setGold(xs => xs.map(t => t.id === id ? { ...t, ...patch } : t));
    void apiPatchTurma(id, patch).catch(() => undefined);
  }, []);

  const addGold = useCallback((turma: TurmaGold) => {
    setGold(xs => [turma, ...xs]);
    void apiCreateTurma({ ...turma, regime: "gold" }).catch(() => undefined);
  }, []);

  const removeGold = useCallback((id: number) => {
    setGold(xs => xs.filter(t => t.id !== id));
    void apiDeleteTurma(id).catch(() => undefined);
  }, []);

  const setGoldCronograma = useCallback((id: number, cronograma: SessaoCronograma[]) => {
    setGold(xs => xs.map(t => t.id === id ? { ...t, cronograma } : t));
    void apiSaveCronograma(id, cronograma).catch(() => undefined);
  }, []);

  const toggleGold = useCallback((id: number, activa: boolean) => {
    setGold(xs => xs.map(t => t.id === id ? { ...t, estado: activa ? "Ativa" : "Inativa" } : t));
    void apiToggleTurma(id, activa).catch(() => undefined);
  }, []);

  const patchFin = useCallback((id: number, patch: Partial<TurmaFin>) => {
    setFin(xs => xs.map(t => t.id === id ? { ...t, ...patch } : t));
    void apiPatchTurma(id, patch).catch(() => undefined);
  }, []);

  const addFin = useCallback((turma: TurmaFin) => {
    setFin(xs => [turma, ...xs]);
    void apiCreateTurma({ ...turma, regime: "fin" }).catch(() => undefined);
  }, []);

  const removeFin = useCallback((id: number) => {
    setFin(xs => xs.filter(t => t.id !== id));
    void apiDeleteTurma(id).catch(() => undefined);
  }, []);

  const setFinCronograma = useCallback((id: number, cronograma: SessaoCronograma[]) => {
    setFin(xs => xs.map(t => t.id === id ? { ...t, cronograma } : t));
    void apiSaveCronograma(id, cronograma).catch(() => undefined);
  }, []);

  const toggleFin = useCallback((id: number, activa: boolean) => {
    setFin(xs => xs.map(t => t.id === id ? { ...t, activa } : t));
    void apiToggleTurma(id, activa).catch(() => undefined);
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
