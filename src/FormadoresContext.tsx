import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  apiCreateFormador,
  apiDeleteFormador,
  apiGetFormadores,
  apiPatchFormador,
} from "./api";
import { formadoresAtivos, formadorSub, FORMADORES_SEED, type Formador, type FormadorRegime } from "./formadorModel";
import { formadoresOptsWithFrom, formadoresToOpts, type SelectOption } from "./FormKit";

type FormadoresCtx = {
  formadores: Formador[];
  addFormador: (f: Omit<Formador, "id">) => Formador;
  patchFormador: (id: number, patch: Partial<Formador>) => void;
  removeFormador: (id: number) => void;
  options: (current?: string | string[], regime?: FormadorRegime) => SelectOption[];
};

const Ctx = createContext<FormadoresCtx | null>(null);

export function FormadoresProvider({ children }: { children: ReactNode }) {
  const [formadores, setFormadores] = useState<Formador[]>(() => FORMADORES_SEED.map(f => ({ ...f, regimes: [...f.regimes] })));

  useEffect(() => {
    let alive = true;
    apiGetFormadores().then(res => {
      if (!alive) return;
      if (res?.formadores?.length) {
        setFormadores(res.formadores.map((f: any) => {
          let regimesList: FormadorRegime[] = ["gold"];
          if (Array.isArray(f.regimes)) {
            regimesList = f.regimes;
          } else if (typeof f.regimes === "string") {
            try {
              const p = JSON.parse(f.regimes);
              if (Array.isArray(p)) regimesList = p;
            } catch {
              regimesList = ["gold"];
            }
          }
          return {
            id: Number(f.id) || Date.now() % 100000,
            nome: String(f.nome ?? ""),
            telf: String(f.telf ?? ""),
            email: String(f.email ?? ""),
            especialidade: String(f.especialidade ?? ""),
            ccp: String(f.ccp ?? ""),
            nif: String(f.nif ?? ""),
            regimes: regimesList,
            estado: (f.estado === "Inactivo" ? "Inactivo" : "Ativo") as "Ativo" | "Inactivo",
          };
        }));
      }
    }).catch(() => undefined);
    return () => { alive = false; };
  }, []);

  const addFormador = useCallback((draft: Omit<Formador, "id">) => {
    const created: Formador = { ...draft, id: Date.now() % 100000 };
    setFormadores(xs => [created, ...xs]);
    void apiCreateFormador(created).catch(() => undefined);
    return created;
  }, []);

  const patchFormador = useCallback((id: number, patch: Partial<Formador>) => {
    setFormadores(xs => xs.map(f => f.id === id ? { ...f, ...patch } : f));
    void apiPatchFormador(id, patch).catch(() => undefined);
  }, []);

  const removeFormador = useCallback((id: number) => {
    setFormadores(xs => xs.filter(f => f.id !== id));
    void apiDeleteFormador(id).catch(() => undefined);
  }, []);

  const options = useCallback((current?: string | string[], regime?: FormadorRegime) => {
    return formadoresOptsWithFrom(formadoresToOpts(formadoresAtivos(formadores, regime)), current);
  }, [formadores]);

  const value = useMemo(() => ({
    formadores, addFormador, patchFormador, removeFormador, options,
  }), [formadores, addFormador, patchFormador, removeFormador, options]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFormadores() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useFormadores precisa de FormadoresProvider");
  return ctx;
}

export function useFormadorOptions(current?: string | string[], regime?: FormadorRegime) {
  const { formadores } = useFormadores();
  return formadoresOptsWithFrom(formadoresToOpts(formadoresAtivos(formadores, regime)), current);
}

export function useFormadorByNome(nome: string | undefined) {
  const { formadores } = useFormadores();
  if (!nome?.trim()) return undefined;
  return formadores.find(f => f.nome === nome);
}

export { formadorSub };
