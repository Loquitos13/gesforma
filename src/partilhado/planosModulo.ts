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

/** Para cada sessão (pela ordem do cronograma), o plano que lhe cabe, ou null. */
export function atribuirPlanos<P extends { ordem: number; modulo?: string | null }>(planos: P[], sessoes: { modulos?: unknown }[]): (P | null)[] {
  const porModulo = new Map<string, P[]>();
  const semModulo = new Map<number, P>();
  for (const p of [...planos].sort((a, b) => a.ordem - b.ordem)) {
    const k = p.modulo?.trim() ? chaveModuloPlano(p.modulo) : "";
    if (k) porModulo.set(k, [...(porModulo.get(k) ?? []), p]);
    else if (!semModulo.has(p.ordem)) semModulo.set(p.ordem, p);
  }
  const usados = new Map<string, number>();
  return sessoes.map((s, i) => {
    const modulos = Array.isArray(s.modulos) ? s.modulos.map(m => chaveModuloPlano(String(m ?? ""))).filter(Boolean) : [];
    for (const k of modulos) {
      const grupo = porModulo.get(k);
      const j = usados.get(k) ?? 0;
      if (grupo && j < grupo.length) {
        usados.set(k, j + 1);
        return grupo[j]!;
      }
    }
    return semModulo.get(i + 1) ?? null;
  });
}
