import { useCatalogList, useCatalogs } from "./CatalogsContext";
import { precoDaInscricao, type EscolhaPreco, type RegraPreco } from "../server/src/precoInscricao.ts";

export { precoDaInscricao };
export type { EscolhaPreco, RegraPreco };
import {
  blogTematicasOpts,
  cursosFinOpts,
  cursosGoldOpts,
  horariosOpts,
  locaisOpts,
  optsFromCursos,
  type SelectOption,
} from "./FormKit";
import { useLists } from "./ListsContext";

function nomesParaOpcoes(nomes: string[], extra?: (nome: string) => string | undefined): SelectOption[] {
  const vistos = new Set<string>();
  const out: SelectOption[] = [];
  for (const bruto of nomes) {
    const value = bruto.trim();
    const chave = value.toLowerCase();
    if (!value || vistos.has(chave)) continue;
    vistos.add(chave);
    const sub = extra?.(value);
    out.push(sub ? { value, sub } : { value });
  }
  return out;
}

/** Edições Gold com preço: por local, por horário, ou pelos dois. */
export function useRegrasPreco(): RegraPreco[] {
  const { lists, ready } = useCatalogs();
  if (!ready) return [];
  const rows = (lists["datas:gold"] ?? []) as Array<Record<string, unknown>>;
  return rows.map(r => ({
    curso: String(r.curso ?? ""),
    local: String(r.local ?? ""),
    horario: String(r.horario ?? ""),
    inicio: String(r.inicio ?? ""),
    preco: Number(r.preco ?? 0),
    status: String(r.status ?? ""),
  }));
}

/** Preço que está na ficha do curso. Zero quando o curso ainda não tem preço. */
export function precoDoCurso(cursos: { nome: string; preco: number }[], nome: string) {
  const alvo = nome.trim().toLowerCase();
  if (!alvo) return 0;
  const curso = cursos.find(c => c.nome.trim().toLowerCase() === alvo);
  return curso && curso.preco > 0 ? curso.preco : 0;
}

/** Cursos Gold ou financiados que existem na base. A lista fixa só aparece se a base ainda estiver vazia. */
export function useCursosOpts(regime: "gold" | "fin"): SelectOption[] {
  const { cursosGold, cursosFin } = useLists();
  const live = regime === "gold" ? optsFromCursos(cursosGold) : optsFromCursos(cursosFin);
  if (live.length) return live;
  return regime === "gold" ? cursosGoldOpts : cursosFinOpts;
}

/** Horários do catálogo Gold. A lista fixa só aparece se o catálogo ainda estiver vazio. */
export function useHorariosOpts(): SelectOption[] {
  const [lista] = useCatalogList<{ id: number; nome?: string }>("horarios", "gold", []);
  const live = nomesParaOpcoes(lista.map(h => String(h.nome ?? "")));
  return live.length ? live : horariosOpts;
}

/** Locais do catálogo do regime. A lista fixa só aparece se o catálogo ainda estiver vazio. */
export function useLocaisOpts(regime: "gold" | "fin"): SelectOption[] {
  const [lista] = useCatalogList<{ id: number; nome?: string; salas?: number }>("locais", regime, []);
  const live = nomesParaOpcoes(
    lista.map(l => String(l.nome ?? "")),
    nome => {
      const row = lista.find(l => String(l.nome ?? "").trim() === nome);
      return row?.salas ? `${row.salas} salas` : undefined;
    },
  );
  return live.length ? live : locaisOpts;
}

/** Temáticas do blog que estão no catálogo. */
export function useTematicasOpts(): SelectOption[] {
  const [lista] = useCatalogList<{ id: number; nome?: string; slug?: string }>("blog_tematicas", "gold", []);
  const live = nomesParaOpcoes(
    lista.map(t => String(t.nome ?? "")),
    nome => lista.find(t => String(t.nome ?? "").trim() === nome)?.slug,
  );
  return live.length ? live : blogTematicasOpts;
}
