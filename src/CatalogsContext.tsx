import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { apiCreateCatalog, apiDeleteCatalog, apiPatchCatalog, apiPutSettings } from "./api";
import { loadOps } from "./opsCache";

export type CatalogItem = { id: number } & Record<string, unknown>;

type CatalogsCtx = {
  lists: Record<string, CatalogItem[]>;
  settings: Record<string, Record<string, string>>;
  saveSettings: (id: string, values: Record<string, string>) => void;
  ready: boolean;
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
    }).catch(() => setReady(true));
    return () => { alive = false; };
  }, []);

  const saveSettings = useCallback((id: string, values: Record<string, string>) => {
    setSettings(prev => ({ ...prev, [id]: values }));
    void apiPutSettings(id, values).catch(() => undefined);
  }, []);

  const value = useMemo(() => ({ lists, settings, saveSettings, ready }), [lists, settings, saveSettings, ready]);

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
  const lista = (ready ? (lists[key] as T[] | undefined) ?? seed : seed);

  const setLista = useCallback<Dispatch<SetStateAction<T[]>>>((updater) => {
    setLists(prev => {
      const current = ((prev[key] && prev[key]!.length ? prev[key] : seed) as T[]);
      const next = typeof updater === "function" ? (updater as (p: T[]) => T[])(current) : updater;
      if (ready) {
        const prevIds = new Set(current.map(x => x.id));
        const nextIds = new Set(next.map(x => x.id));
        for (const row of next) {
          const before = current.find(x => x.id === row.id);
          if (!before) {
            void apiCreateCatalog(kind, regime, payloadOf(row)).then(r => {
              if (r.item?.id && r.item.id !== row.id) {
                setLists(xs => ({
                  ...xs,
                  [key]: ((xs[key] ?? next) as CatalogItem[]).map(x => x.id === row.id ? { ...x, id: r.item.id } : x),
                }));
              }
            }).catch(() => undefined);
          } else if (!sameRow(before, row)) {
            void apiPatchCatalog(kind, row.id, payloadOf(row), regime).catch(() => undefined);
          }
        }
        for (const id of prevIds) {
          if (!nextIds.has(id)) void apiDeleteCatalog(kind, id).catch(() => undefined);
        }
      }
      return { ...prev, [key]: next as CatalogItem[] };
    });
  }, [kind, regime, key, ready, seed, setLists]);

  return [lista, setLista];
}

export function useSettingsDraft(cardId: string, fallback: Record<string, string>) {
  const { settings, saveSettings } = useCatalogs();
  return {
    values: settings[cardId] ?? fallback,
    save: (values: Record<string, string>) => saveSettings(cardId, values),
  };
}
