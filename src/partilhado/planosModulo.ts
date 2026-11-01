// Que plano da ficha do curso vai para cada sessão lectiva da turma. Um plano ligado a um ou mais módulos / temas vai
// para as sessões desses módulos, pela ordem (o 1.º plano do M1 para a 1.ª sessão do M1, o 2.º para a 2.ª…; um plano
// do M3 e M4 para as sessões do M3 e M4). Os planos sem módulo vão pelo número da sessão (o plano n para a sessão n).
// Partilhado pelo servidor e pelo backoffice.

/** Código do módulo («M1 · Aprendizagem…» → «m1»); sem código, o nome todo (sem acentos nem maiúsculas). */
export function chaveModuloPlano(nome: string) {
  const raw = nome.trim();
  const codigo = raw.match(/^(M\s*\d+|C\s*\d+|UFCD\s*\d+|EX\s*\d+|AV\s*\d+)/i)?.[1];
  const base = codigo ?? raw.split("·")[0] ?? raw;
  return base.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "").toLowerCase();
}

/** Os módulos de um plano: a lista `modulos` (ou o `modulo` único dos planos gravados antes), sem vazios. */
export function modulosDoPlano(p: { modulos?: unknown; modulo?: unknown }): string[] {
  const lista = Array.isArray(p.modulos) ? p.modulos : p.modulo ? [p.modulo] : [];
  return [...new Set(lista.map(m => String(m ?? "").trim()).filter(Boolean))];
}

/** Plano da ficha do curso com que a sessão foi marcada no cronograma (`planoOrdem`), ou null (0 = «Personalizado»). */
export function planoDaSessao(s: { planoOrdem?: unknown } | null | undefined): number | null {
  const n = Number(s?.planoOrdem);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

type PlanoComModulos = { ordem: number; modulos?: unknown; modulo?: unknown };

const chaves = (modulos: unknown) =>
  [...new Set((Array.isArray(modulos) ? modulos : []).map(m => chaveModuloPlano(String(m ?? ""))).filter(Boolean))].sort();

/**
 * Para cada sessão (pela ordem do cronograma), o plano que lhe cabe, ou null. Sessão de módulos com planos ligados:
 * o próximo plano com exatamente os mesmos módulos e, não havendo, o próximo que tenha algum deles. As outras: o plano
 * com o mesmo número, se ainda não foi usado (a sessão sem módulo passa a ter os módulos desse plano: `modulosEmFalta`).
 */
export function atribuirPlanos<P extends PlanoComModulos>(planos: P[], sessoes: { modulos?: unknown; planoOrdem?: unknown }[]): (P | null)[] {
  const ordenados = [...planos].sort((a, b) => a.ordem - b.ordem);
  const usados = new Set<P>();
  const out: (P | null)[] = sessoes.map(() => null);
  // 1.º As sessões marcadas no cronograma com um plano («Sessão do curso») levam esse plano.
  sessoes.forEach((s, i) => {
    const n = planoDaSessao(s);
    const p = n == null ? undefined : ordenados.find(x => x.ordem === n && !usados.has(x));
    if (p) { usados.add(p); out[i] = p; }
  });
  // As marcadas «Personalizado» (planoOrdem 0) ou com um plano ficam fora; as outras recebem os planos livres.
  const livre = (s: { planoOrdem?: unknown }) => s.planoOrdem == null || s.planoOrdem === "";
  const restantes = ordenados.filter(p => !usados.has(p));
  const comModulos = restantes.map(p => ({ p, k: chaves(modulosDoPlano(p)) })).filter(x => x.k.length);
  const ligados = new Set(comModulos.flatMap(x => x.k));
  sessoes.forEach((s, i) => {
    if (!livre(s)) return;
    const k = chaves(s.modulos);
    if (!k.length) return;
    const mesmos = comModulos.find(x => !usados.has(x.p) && x.k.join("+") === k.join("+"));
    const algum = mesmos ?? comModulos.find(x => !usados.has(x.p) && x.k.some(m => k.includes(m)));
    if (algum) { usados.add(algum.p); out[i] = algum.p; }
  });
  sessoes.forEach((s, i) => {
    // Sessão de módulos com planos ligados fica só com esses; as outras vão pelo número da sessão.
    if (!livre(s) || out[i] || chaves(s.modulos).some(m => ligados.has(m))) return;
    const p = restantes.find(x => x.ordem === i + 1 && !usados.has(x));
    if (p) { usados.add(p); out[i] = p; }
  });
  return out;
}

/** Sessões sem módulo que recebem um plano com módulos: os módulos que lhes faltam (posição na lista → módulos). */
export function modulosEmFalta<P extends PlanoComModulos>(planos: P[], sessoes: { modulos?: unknown }[]) {
  const atribuidos = atribuirPlanos(planos, sessoes);
  const out = new Map<number, string[]>();
  sessoes.forEach((s, i) => {
    const modulos = atribuidos[i] ? modulosDoPlano(atribuidos[i]!) : [];
    if (!chaves(s.modulos).length && modulos.length) out.set(i, modulos);
  });
  return out;
}
