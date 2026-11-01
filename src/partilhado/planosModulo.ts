// Que plano da ficha do curso vai para cada sessão lectiva da turma. Os planos pertencem aos módulos (um módulo pode ter
// vários planos; um plano pode ser de mais do que um módulo). No cronograma, cada sessão marca-se com um plano (o seu
// `id`); as sessões não marcadas recebem os planos livres: o próximo plano do seu módulo e, sem módulo, o plano com o
// mesmo número. Partilhado pelo servidor e pelo backoffice.

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

/**
 * Identificador fixo de um plano da ficha: o `id` gravado; os planos gravados antes de haver `id` usam «plano-<ordem>»
 * (o número com que foram gravados), para as sessões já ligadas a eles continuarem a apontar para o mesmo plano.
 */
export function chavePlano(p: { id?: unknown; ordem?: unknown }): string {
  const id = String(p.id ?? "").trim();
  return id || `plano-${Number(p.ordem) || 0}`;
}

/** «Personalizado»: a sessão foi marcada sem plano do curso (não recebe nenhum). */
export const SEM_PLANO = "-";

type SessaoComPlano = { planoId?: unknown; planoOrdem?: unknown };

/** O plano com que a sessão foi marcada no cronograma (`planoId`; antes, `planoOrdem`), ou null. */
export function planoDaSessao(s: SessaoComPlano | null | undefined): string | null {
  const id = String(s?.planoId ?? "").trim();
  if (id) return id === SEM_PLANO ? null : id;
  const n = Number(s?.planoOrdem);
  return Number.isInteger(n) && n >= 1 ? `plano-${n}` : null;
}

/** A sessão foi marcada no cronograma (com um plano ou «Personalizado»)? As outras recebem os planos livres. */
export function sessaoMarcada(s: SessaoComPlano | null | undefined) {
  return Boolean(String(s?.planoId ?? "").trim()) || (s?.planoOrdem != null && s.planoOrdem !== "");
}

type PlanoComModulos = { ordem: number; id?: unknown; modulos?: unknown; modulo?: unknown };

const chaves = (modulos: unknown) =>
  [...new Set((Array.isArray(modulos) ? modulos : []).map(m => chaveModuloPlano(String(m ?? ""))).filter(Boolean))].sort();

/**
 * Para cada sessão (pela ordem do cronograma), o plano que lhe cabe, ou null. Sessão de módulos com planos ligados:
 * o próximo plano com exatamente os mesmos módulos e, não havendo, o próximo que tenha algum deles. As outras: o plano
 * com o mesmo número, se ainda não foi usado (a sessão sem módulo passa a ter os módulos desse plano: `modulosEmFalta`).
 */
export function atribuirPlanos<P extends PlanoComModulos>(planos: P[], sessoes: ({ modulos?: unknown } & SessaoComPlano)[]): (P | null)[] {
  const ordenados = [...planos].sort((a, b) => a.ordem - b.ordem);
  const usados = new Set<P>();
  const out: (P | null)[] = sessoes.map(() => null);
  // 1.º As sessões marcadas no cronograma com um plano («Sessão do curso») levam esse plano.
  sessoes.forEach((s, i) => {
    const k = planoDaSessao(s);
    const p = k == null ? undefined : ordenados.find(x => chavePlano(x) === k && !usados.has(x));
    if (p) { usados.add(p); out[i] = p; }
  });
  // As marcadas («Personalizado» ou com um plano) ficam fora; as outras recebem os planos livres.
  const livre = (s: SessaoComPlano) => !sessaoMarcada(s);
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
