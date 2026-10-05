import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiCreateFormador, apiDeleteFormador, apiPatchFormador } from "./api";
import { formadoresAtivos, formadorSub, FORMADORES_SEED, type Formador, type FormadorRegime } from "./formadorModel";
import { formadoresOptsWithFrom, formadoresToOpts, type SelectOption } from "./FormKit";
import { loadOps } from "./opsCache";
import { persist, toastError } from "./toastBus";

type FormadoresCtx = {
  formadores: Formador[];
  addFormador: (f: Omit<Formador, "id">) => Promise<{ id?: number; acesso?: { email: string; password?: string; criado: boolean } | null } | undefined>;
  patchFormador: (id: number, patch: Partial<Formador>) => void;
  removeFormador: (id: number) => void;
  options: (current?: string | string[], regime?: FormadorRegime) => SelectOption[];
};

const Ctx = createContext<FormadoresCtx | null>(null);

function asFormador(r: {
  id: number; nome: string; telf: string; email: string; especialidade: string; ccp: string; nif: string;
  regimes: string[]; estado: string; disponibilidade?: string[]; custoHora?: number; alocado?: boolean; temAcesso?: boolean;
}): Formador {
  return {
    id: r.id,
    nome: r.nome,
    telf: r.telf,
    email: r.email,
    especialidade: r.especialidade,
    ccp: r.ccp,
    nif: r.nif,
    regimes: r.regimes.filter((x): x is FormadorRegime => x === "gold" || x === "fin"),
    estado: r.estado === "Inactivo" ? "Inactivo" : "Ativo",
    disponibilidade: r.disponibilidade,
    custoHora: r.custoHora ?? 0,
    alocado: Boolean(r.alocado),
    temAcesso: Boolean(r.temAcesso),
  };
}

export function FormadoresProvider({ children }: { children: ReactNode }) {
  const [formadores, setFormadores] = useState<Formador[]>(() => FORMADORES_SEED.map(f => ({ ...f, regimes: [...f.regimes] })));

  useEffect(() => {
    let alive = true;
    loadOps().then(snap => {
      if (!alive) return;
      setFormadores(snap.formadores.map(asFormador));
    }).catch(() => {
      if (!alive) return;
      toastError(new Error("A API não respondeu. A lista de formadores ficou vazia."));
      setFormadores([]);
    });
    return () => { alive = false; };
  }, []);

  const addFormador = useCallback(async (draft: Omit<Formador, "id">) => {
    const created: Formador = { ...draft, id: -Date.now() };
    setFormadores(xs => [created, ...xs]);
    const r = await persist(apiCreateFormador(created).then(res => {
      if (res.formador) setFormadores(xs => xs.map(f => f.id === created.id ? asFormador(res.formador) : f));
      return res;
    }), () => setFormadores(xs => xs.filter(f => f.id !== created.id)));
    return r?.formador ? { id: asFormador(r.formador).id, acesso: r.acesso } : undefined;
  }, []);

  const patchFormador = useCallback((id: number, patch: Partial<Formador>) => {
    if (id < 0) return;
    setFormadores(xs => xs.map(f => f.id === id ? { ...f, ...patch } : f));
    void persist(apiPatchFormador(id, patch));
  }, []);

  const removeFormador = useCallback((id: number) => {
    let before: Formador | undefined;
    setFormadores(xs => {
      before = xs.find(f => f.id === id);
      return xs.filter(f => f.id !== id);
    });
    void persist(apiDeleteFormador(id), () => {
      if (before) setFormadores(xs => [before!, ...xs]);
    });
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
