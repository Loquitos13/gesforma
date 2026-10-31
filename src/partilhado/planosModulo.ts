// Que plano da ficha do curso vai para cada sessão lectiva da turma. Um plano ligado a um módulo / tema vai para as
// sessões desse módulo, pela ordem (o 1.º plano do M1 para a 1.ª sessão do M1, o 2.º para a 2.ª…). Os planos sem
// módulo vão, como antes, pelo número da sessão (o plano n para a sessão n). Partilhado pelo servidor e pelo cockpit.

/** Código do módulo («M1 · Aprendizagem…» → «m1»); sem código, o nome todo (sem acentos nem maiúsculas). */
export function chaveModuloPlano(nome: string) {
  const raw = nome.trim();
  const codigo = raw.match(/^(M\s*\d+|C\s*\d+|UFCD\s*\d+|EX\s*\d+|AV\s*\d+)/i)?.[1];
  const base = codigo ?? raw.split("·")[0] ?? raw;
  return base.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "").toLowerCase();
}

/**
 * Para cada sessão (pela ordem do cronograma), o plano que lhe cabe, ou null. Sessão de um módulo com planos ligados:
 * o próximo plano desse módulo. As outras: o plano com o mesmo número, se ainda não foi usado (e a sessão sem módulo
 * passa a ter o módulo desse plano: `modulosEmFalta`).
 */
export function atribuirPlanos<P extends { ordem: number; modulo?: string | null }>(planos: P[], sessoes: { modulos?: unknown }[]): (P | null)[] {
  const ordenados = [...planos].sort((a, b) => a.ordem - b.ordem);
  const porModulo = new Map<string, P[]>();
  for (const p of ordenados) {
    const k = p.modulo?.trim() ? chaveModuloPlano(p.modulo) : "";
    if (k) porModulo.set(k, [...(porModulo.get(k) ?? []), p]);
  }
  const usados = new Set<P>();
  // Primeiro as sessões com módulo (cada uma leva o próximo plano desse módulo), depois as sem módulo (pelo número).
  const out: (P | null)[] = sessoes.map(() => null);
  sessoes.forEach((s, i) => {
    const modulos = Array.isArray(s.modulos) ? s.modulos.map(m => chaveModuloPlano(String(m ?? ""))).filter(Boolean) : [];
    for (const k of modulos) {
      const p = (porModulo.get(k) ?? []).find(x => !usados.has(x));
      if (p) { usados.add(p); out[i] = p; return; }
    }
  });
  sessoes.forEach((s, i) => {
    // Sessão de um módulo que tem planos na ficha fica só com os desse módulo; as outras (sem módulo, ou de um módulo
    // sem planos ligados, como quando os planos não têm módulo) vão pelo número da sessão.
    const modulos = Array.isArray(s.modulos) ? s.modulos.map(m => chaveModuloPlano(String(m ?? ""))).filter(Boolean) : [];
    if (out[i] || modulos.some(k => porModulo.has(k))) return;
    const p = ordenados.find(x => x.ordem === i + 1 && !usados.has(x));
    if (p) { usados.add(p); out[i] = p; }
  });
  return out;
}

/** Sessões sem módulo que recebem um plano com módulo: o módulo que lhes falta (posição na lista → módulo). */
export function modulosEmFalta<P extends { ordem: number; modulo?: string | null }>(planos: P[], sessoes: { modulos?: unknown }[]) {
  const atribuidos = atribuirPlanos(planos, sessoes);
  const out = new Map<number, string>();
  sessoes.forEach((s, i) => {
    const temModulo = Array.isArray(s.modulos) && s.modulos.some(m => String(m ?? "").trim());
    const modulo = atribuidos[i]?.modulo?.trim();
    if (!temModulo && modulo) out.set(i, modulo);
  });
  return out;
}
