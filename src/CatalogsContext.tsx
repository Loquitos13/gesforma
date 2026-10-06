import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { apiCreateCatalog, apiDeleteCatalog, apiPatchCatalog, apiPutSettings } from "./api";
import { LISTAS_OPCOES, type ListaOpcoesId } from "./listaOpcoes";
import { loadOps } from "./opsCache";
import { persist, toastError, toastOk } from "./toastBus";

export type CatalogItem = { id: number } & Record<string, unknown>;
export type ListaOpcao = { id: number; lista: string; nome: string };

const LISTA_KEY = "lista_opcoes:gold";

type CatalogsCtx = {
  lists: Record<string, CatalogItem[]>;
  settings: Record<string, Record<string, string>>;
  saveSettings: (id: string, values: Record<string, string>) => void;
  ready: boolean;
  addListaOpcao: (lista: ListaOpcoesId | string, nome: string) => Promise<string | null>;
  removeListaOpcao: (id: number) => void;
};

const Ctx = createContext<CatalogsCtx | null>(null);

function keyOf(kind: string, regime: "gold" | "fin") {
  return `${kind}:${regime}`;
}

function sameRow(a: CatalogItem, b: CatalogItem) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function payloadOf(row: CatalogItem) {
  const { id: _id, ...rest } = row;
  return rest;
}

type CatalogRemapFn = (key: string, from: number, to: number) => void;
const catalogRemapListeners = new Set<CatalogRemapFn>();

export function catalogIdRemapSubscribe(fn: CatalogRemapFn) {
  catalogRemapListeners.add(fn);
  return () => { catalogRemapListeners.delete(fn); };
}

function emitCatalogRemap(key: string, from: number, to: number) {
  if (from === to) return;
  for (const fn of catalogRemapListeners) fn(key, from, to);
}

export function CatalogsProvider({ children }: { children: ReactNode }) {
  const [lists, setLists] = useState<Record<string, CatalogItem[]>>({});
  const [settings, setSettings] = useState<Record<string, Record<string, string>>>({});
  const [ready, setReady] = useState(false);
  const listsRef = useRef(lists);
  listsRef.current = lists;

  useEffect(() => {
    let alive = true;
    loadOps().then(snap => {
      if (!alive) return;
      setLists(snap.catalogs ?? {});
      const next: Record<string, Record<string, string>> = {};
      for (const [id, values] of Object.entries(snap.settings ?? {})) {
        next[id] = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, String(v ?? "")]));
      }
      setSettings(next);
      setReady(true);
    }).catch(() => {
      if (!alive) return;
      toastError(new Error("A API não respondeu. Os catálogos ficam vazios - o seed de demonstração não entra."));
      setLists({});
      setSettings({});
      setReady(true);
    });
    return () => { alive = false; };
  }, []);

  const saveSettings = useCallback((id: string, values: Record<string, string>) => {
    setSettings(prev => ({ ...prev, [id]: values }));
    void persist(apiPutSettings(id, values));
  }, []);

  const addListaOpcao = useCallback(async (lista: ListaOpcoesId | string, nome: string) => {
    const clean = nome.trim();
    if (!clean) return null;
    const current = (listsRef.current[LISTA_KEY] ?? []) as ListaOpcao[];
    const dup = current.find(r => r.lista === lista && r.nome.toLowerCase() === clean.toLowerCase());
    if (dup) {
      toastOk("Essa opção já existe nesta lista.");
      return dup.nome;
    }
    const tempId = Math.max(10_000, ...current.map(x => x.id), Date.now() % 100_000) + 1;
    const temp: ListaOpcao = { id: tempId, lista, nome: clean };
    setLists(prev => ({ ...prev, [LISTA_KEY]: [...((prev[LISTA_KEY] ?? []) as CatalogItem[]), temp] }));
    try {
      const r = await apiCreateCatalog("lista_opcoes", "gold", { lista, nome: clean });
      if (r.item?.id) {
        setLists(xs => ({
          ...xs,
          [LISTA_KEY]: ((xs[LISTA_KEY] ?? []) as CatalogItem[]).map(x => x.id === tempId ? { ...x, id: r.item.id, nome: String(r.item.nome ?? clean), lista } : x),
        }));
      }
      toastOk("Opção guardada no catálogo.");
      return clean;
    } catch (err) {
      setLists(prev => ({
        ...prev,
        [LISTA_KEY]: ((prev[LISTA_KEY] ?? []) as CatalogItem[]).filter(x => x.id !== tempId),
      }));
      toastError(err, "Não foi possível guardar a opção.");
      return null;
    }
  }, []);

  const removeListaOpcao = useCallback((id: number) => {
    setLists(prev => ({
      ...prev,
      [LISTA_KEY]: ((prev[LISTA_KEY] ?? []) as CatalogItem[]).filter(x => x.id !== id),
    }));
    void persist(apiDeleteCatalog("lista_opcoes", id));
  }, []);

  const value = useMemo(
    () => ({ lists, settings, saveSettings, ready, addListaOpcao, removeListaOpcao }),
    [lists, settings, saveSettings, ready, addListaOpcao, removeListaOpcao],
  );

  return <CatalogState.Provider value={setLists}><Ctx.Provider value={value}>{children}</Ctx.Provider></CatalogState.Provider>;
}

const CatalogState = createContext<Dispatch<SetStateAction<Record<string, CatalogItem[]>>> | null>(null);

export function useCatalogs() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCatalogs precisa de CatalogsProvider");
  return ctx;
}

export function useCatalogList<T extends { id: number }>(kind: string, regime: "gold" | "fin", seed: T[]): [T[], Dispatch<SetStateAction<T[]>>] {
  const { lists, ready } = useCatalogs();
  const setLists = useContext(CatalogState);
  if (!setLists) throw new Error("useCatalogList precisa de CatalogsProvider");
  const key = keyOf(kind, regime);
  const lista = (ready ? (lists[key] as T[] | undefined) ?? [] : seed);
  const inflight = useRef(new Map<number, Promise<number>>());

  const setLista = useCallback<Dispatch<SetStateAction<T[]>>>((updater) => {
    setLists(prev => {
      const current = ((prev[key] as T[] | undefined) ?? (ready ? [] : seed));
      const next = typeof updater === "function" ? (updater as (p: T[]) => T[])(current) : updater;
      if (ready) {
        const prevIds = new Set(current.map(x => x.id));
        const nextIds = new Set(next.map(x => x.id));
        for (const row of next) {
          const before = current.find(x => x.id === row.id);
          if (!before) {
            const tempId = row.id;
            if (inflight.current.has(tempId)) continue;
            const created = apiCreateCatalog(kind, regime, payloadOf(row)).then(r => {
              const realId = r.item?.id ?? tempId;
              if (realId !== tempId) {
                setLists(xs => ({
                  ...xs,
                  [key]: ((xs[key] ?? []) as CatalogItem[]).map(x => x.id === tempId ? { ...x, id: realId } : x),
                }));
                emitCatalogRemap(key, tempId, realId);
              }
              return realId;
            }).catch(err => {
              toastError(err, "Não foi possível criar o item do catálogo.");
              setLists(xs => ({
                ...xs,
                [key]: ((xs[key] ?? []) as CatalogItem[]).filter(x => x.id !== tempId),
              }));
              inflight.current.delete(tempId);
              throw err;
            });
            inflight.current.set(tempId, created);
          } else if (!sameRow(before, row)) {
            const pending = inflight.current.get(row.id);
            if (pending) {
              const queued = pending.then(realId => persist(apiPatchCatalog(kind, realId, payloadOf(row), regime)).then(() => realId));
              inflight.current.set(row.id, queued);
            } else {
              void persist(apiPatchCatalog(kind, row.id, payloadOf(row), regime));
            }
          }
        }
        for (const id of prevIds) {
          if (!nextIds.has(id)) {
            const pending = inflight.current.get(id);
            if (pending) {
              void pending.then(realId => persist(apiDeleteCatalog(kind, realId)));
              inflight.current.delete(id);
            } else {
              void persist(apiDeleteCatalog(kind, id));
            }
          }
        }
      }
      return { ...prev, [key]: next as CatalogItem[] };
    });
  }, [kind, regime, key, ready, seed, setLists]);

  return [lista, setLista];
}

export function useListaOpcoes(lista: ListaOpcoesId | string): {
  nomes: string[];
  rows: ListaOpcao[];
  add: (nome: string) => Promise<string | null>;
} {
  const { lists, addListaOpcao, ready } = useCatalogs();
  const fallback = lista in LISTAS_OPCOES ? [...LISTAS_OPCOES[lista as ListaOpcoesId].fallback] : [];
  const rows = ((lists[LISTA_KEY] ?? []) as ListaOpcao[]).filter(r => String(r.lista) === lista && String(r.nome ?? "").trim());
  const nomes = (ready ? rows.map(r => String(r.nome)) : (rows.length ? rows.map(r => String(r.nome)) : fallback));
  const unique = [...new Set(nomes.length ? nomes : fallback)];
  return {
    nomes: unique,
    rows,
    add: (nome: string) => addListaOpcao(lista, nome),
  };
}

export function useSettingsDraft(cardId: string, fallback: Record<string, string>) {
  const { settings, saveSettings } = useCatalogs();
  return {
    values: settings[cardId] ?? fallback,
    save: (values: Record<string, string>) => saveSettings(cardId, values),
  };
}
