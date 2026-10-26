import { useEffect, useMemo, useState } from "react";
import { apiCursoFichas, type Regime } from "./api";
import type { SelectOption } from "./FormKit";
import { useOpcoes } from "./dados/useOpcoes";

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

function semPrefixoCurso(s: string) {
  return s.trim().toLowerCase().replace(/^curso de\s+/, "");
}

/** A string guardada aponta para este curso, mesmo que seja o nome curto, a UFCD ou «Curso de …». */
export function refereCurso(
  stored: string,
  curso: { nome?: string; nomeComercial?: string; ufcd?: string; ufcdCod?: string },
) {
  const raw = stored.trim();
  const low = raw.toLowerCase();
  if (!low) return false;
  const aliases = [curso.nome, curso.nomeComercial, curso.ufcd, curso.ufcdCod]
    .map(s => (s || "").trim())
    .filter(Boolean);
  if (aliases.some(a => a.toLowerCase() === low)) return true;
  const canonical = (curso.nome || curso.nomeComercial || curso.ufcd || "").trim();
  if (!canonical) return false;
  if (raw.length >= 18 && canonical.toLowerCase().startsWith(low)) {
    const next = canonical[raw.length] ?? "";
    if (next === " " || next === ":" || next === "-" || next === "–") return true;
  }
  const base = semPrefixoCurso(raw);
  return base.length >= 8 && (semPrefixoCurso(canonical) === base || aliases.some(a => semPrefixoCurso(a) === base));
}

export function idCursoPorNome(
  regime: "gold" | "fin",
  cursoNome: string | undefined,
  cursosGold: { id: number; nome?: string }[],
  cursosFin: { id: number; nome?: string; nomeComercial?: string; ufcd?: string; ufcdCod?: string }[],
) {
  const nome = (cursoNome ?? "").trim();
  if (!nome) return null;
  if (regime === "gold") {
    const exact = cursosGold.find(c => (c.nome || "") === nome);
    if (exact) return exact.id;
    const loose = cursosGold.filter(c => refereCurso(nome, c));
    return loose.length === 1 ? loose[0]!.id : null;
  }
  const exact = cursosFin.find(c => c.ufcd === nome || c.nomeComercial === nome || c.ufcdCod === nome);
  if (exact) return exact.id;
  const loose = cursosFin.filter(c => refereCurso(nome, c));
  return loose.length === 1 ? loose[0]!.id : null;
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
  const catalogo = useOpcoes("locais", { regime });
  const cursoId = matchCursoId(cursos, cursoNome);
  const nomes = useMemo(
    () => (cursoId != null ? (byCursoId[cursoId] ?? []) : []),
    [byCursoId, cursoId],
  );
  // Primeiro os locais da ficha do curso; depois os outros do catálogo (uma turma pode ser noutro sítio,
  // ex.: curso marcado como e-learning na ficha, com turmas presenciais).
  const options = useMemo(() => {
    const doCurso = new Set(nomes.map(n => n.toLowerCase()));
    const outros = catalogo.opcoes.map(o => o.valor).filter(n => n && !doCurso.has(n.toLowerCase()));
    return [
      ...nomes.map(value => ({ value, sub: "Local do curso" })),
      ...outros.map(value => ({ value, sub: "Outro local (não está na ficha do curso)" })),
    ];
  }, [nomes, catalogo.opcoes]);
  const ready = Boolean(cursoNome.trim());
  const empty = !ready
    ? "Escolha primeiro o curso."
    : !loaded
      ? "A carregar locais do curso…"
      : options.length === 0
        ? "Não há locais. Crie-os em Edição de cursos › Locais."
        : "Nenhum local corresponde à pesquisa.";
  const placeholder = !ready ? "Escolha primeiro o curso…" : "Pesquisar local…";
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
