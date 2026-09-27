import { useEffect, useMemo, useState } from "react";
import { apiCursoFichas, type Regime } from "./api";
import type { SelectOption } from "./FormKit";

export function locaisFromFicha(payload: Record<string, unknown> | undefined): string[] {
  const raw = payload?.locais;
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const nome = String(item ?? "").trim();
    if (!nome || seen.has(nome)) continue;
    seen.add(nome);
    out.push(nome);
  }
  return out;
}

export function matchCursoId(
  cursos: { id: number; nome?: string; nomeComercial?: string; ufcd?: string; ufcdCod?: string }[],
  selected: string,
): number | undefined {
  const n = selected.trim().toLowerCase();
  if (!n) return undefined;
  const hit = cursos.find(c =>
    (c.nome || "").trim().toLowerCase() === n
    || (c.nomeComercial || "").trim().toLowerCase() === n
    || (c.ufcd || "").trim().toLowerCase() === n
    || (c.ufcdCod || "").trim().toLowerCase() === n
  );
  return hit?.id;
}

export function optsFromLocais(nomes: string[]): SelectOption[] {
  return nomes.map(value => ({ value }));
}

export function useCursoFichaLocais(regime: Regime) {
  const [byCursoId, setByCursoId] = useState<Record<number, string[]>>({});
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let cancel = false;
    setLoaded(false);
    void apiCursoFichas(regime)
      .then(res => {
        if (cancel) return;
        const map: Record<number, string[]> = {};
        for (const f of res.fichas) map[f.cursoId] = locaisFromFicha(f.payload);
        setByCursoId(map);
        setLoaded(true);
      })
      .catch(() => {
        if (cancel) return;
        setByCursoId({});
        setLoaded(true);
      });
    return () => { cancel = true; };
  }, [regime]);
  return { byCursoId, loaded };
}

export function useLocaisOptsDoCurso(
  regime: Regime,
  cursos: { id: number; nome?: string; nomeComercial?: string; ufcd?: string; ufcdCod?: string }[],
  cursoNome: string,
) {
  const { byCursoId, loaded } = useCursoFichaLocais(regime);
  const cursoId = matchCursoId(cursos, cursoNome);
  const nomes = useMemo(
    () => (cursoId != null ? (byCursoId[cursoId] ?? []) : []),
    [byCursoId, cursoId],
  );
  const options = useMemo(() => optsFromLocais(nomes), [nomes]);
  const ready = Boolean(cursoNome.trim());
  const empty = !ready
    ? "Escolha primeiro o curso."
    : !loaded
      ? "A carregar locais do curso…"
      : nomes.length === 0
        ? "Este curso não tem locais na ficha. Associe polos no registo do curso."
        : "Nenhum local corresponde à pesquisa.";
  const placeholder = !ready ? "Escolha primeiro o curso…" : "Pesquisar local do curso…";
  return {
    options,
    loaded,
    nomes,
    disabled: !ready,
    empty,
    placeholder,
    locaisFor: (nome: string) => {
      const id = matchCursoId(cursos, nome);
      return id != null ? (byCursoId[id] ?? []) : [];
    },
  };
}
