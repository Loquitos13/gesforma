/**
 * Ordem do cronograma: as sessões gravam-se por ordem cronológica (data e hora de início), porque o número de cada
 * sessão (1, 2, 3…) é a sua posição entre as lectivas. Partilhado pelo backoffice e pelo servidor, para os números que
 * o ecrã mostra serem os que o servidor grava. As datas em dd-mm-aaaa (ou dd/mm/aaaa) passam a aaaa-mm-dd.
 */

/** «dd-mm-aaaa» / «dd/mm/aaaa» → «aaaa-mm-dd»; as outras ficam como estão. */
export function dataIsoDaSessao(data: unknown) {
  const s = typeof data === "string" ? data.trim() : "";
  const pt = /^(\d{2})[-/](\d{2})[-/](\d{4})$/.exec(s);
  return pt ? `${pt[3]}-${pt[2]}-${pt[1]}` : s;
}

type Item = { data?: unknown; horaInicio?: unknown };

/** As sessões por data e hora (as sem data no fim); as do mesmo instante mantêm a ordem que tinham. */
export function ordenarCronograma<T>(itens: readonly T[]): T[] {
  const chaves = itens.map((item, i) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return { item, data: "", hora: "", i };
    const o = item as Item;
    const data = dataIsoDaSessao(o.data);
    const normal = data !== o.data && typeof o.data === "string" ? ({ ...item, data } as T) : item;
    return { item: normal, data: /^\d{4}-\d{2}-\d{2}/.test(data) ? data : "", hora: typeof o.horaInicio === "string" ? o.horaInicio.padStart(5, "0") : "", i };
  });
  return chaves
    .sort((a, b) => (a.data ? 0 : 1) - (b.data ? 0 : 1) || a.data.localeCompare(b.data) || a.hora.localeCompare(b.hora) || a.i - b.i)
    .map(c => c.item);
}
