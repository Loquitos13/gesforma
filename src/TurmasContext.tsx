import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { seedFinTurmas, seedGoldTurmas, type SessaoCronograma, type TurmaFin, type TurmaGold } from "./turmaModel";

type TurmasCtx = {
  gold: TurmaGold[];
  fin: TurmaFin[];
  patchGold: (id: number, patch: Partial<TurmaGold>) => void;
  addGold: (turma: TurmaGold) => void;
  setGoldCronograma: (id: number, cronograma: SessaoCronograma[]) => void;
  toggleGold: (id: number, activa: boolean) => void;
  patchFin: (id: number, patch: Partial<TurmaFin>) => void;
  addFin: (turma: TurmaFin) => void;
  setFinCronograma: (id: number, cronograma: SessaoCronograma[]) => void;
  toggleFin: (id: number, activa: boolean) => void;
};

const Ctx = createContext<TurmasCtx | null>(null);

export function TurmasProvider({ children }: { children: ReactNode }) {
  const [gold, setGold] = useState<TurmaGold[]>(() => seedGoldTurmas());
  const [fin, setFin] = useState<TurmaFin[]>(() => seedFinTurmas());

  const patchGold = useCallback((id: number, patch: Partial<TurmaGold>) => {
    setGold(xs => xs.map(t => t.id === id ? { ...t, ...patch } : t));
  }, []);
  const addGold = useCallback((turma: TurmaGold) => {
    setGold(xs => [turma, ...xs]);
  }, []);
  const setGoldCronograma = useCallback((id: number, cronograma: SessaoCronograma[]) => {
    setGold(xs => xs.map(t => t.id === id ? { ...t, cronograma } : t));
  }, []);
  const toggleGold = useCallback((id: number, activa: boolean) => {
    setGold(xs => xs.map(t => t.id === id ? { ...t, estado: activa ? "Ativa" : "Inativa" } : t));
  }, []);

  const patchFin = useCallback((id: number, patch: Partial<TurmaFin>) => {
    setFin(xs => xs.map(t => t.id === id ? { ...t, ...patch } : t));
  }, []);
  const addFin = useCallback((turma: TurmaFin) => {
    setFin(xs => [turma, ...xs]);
  }, []);
  const setFinCronograma = useCallback((id: number, cronograma: SessaoCronograma[]) => {
    setFin(xs => xs.map(t => t.id === id ? { ...t, cronograma } : t));
  }, []);
  const toggleFin = useCallback((id: number, activa: boolean) => {
    setFin(xs => xs.map(t => t.id === id ? { ...t, activa } : t));
  }, []);

  const value = useMemo(() => ({
    gold, fin, patchGold, addGold, setGoldCronograma, toggleGold, patchFin, addFin, setFinCronograma, toggleFin,
  }), [gold, fin, patchGold, addGold, setGoldCronograma, toggleGold, patchFin, addFin, setFinCronograma, toggleFin]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTurmas() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTurmas precisa de TurmasProvider");
  return ctx;
}
