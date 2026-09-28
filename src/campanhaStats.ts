export type CampanhaBase = {
  id: number;
  nome: string;
  data: string;
  encarregado: string;
  custo: number;
  curso?: string | null;
  fim?: string | null;
  canal?: string | null;
  notas?: string | null;
};

export type CampanhaOrigem = { origem: string; n: number };

export type CampanhaNums = {
  preinscricoes: number;
  pagos: number;
  receita: number;
  contactados: number;
  naoContactados: number;
  desistiram: number;
  formandos: number;
  conversaoPct: number;
  ticketMedio: number;
  receitaEstimada: number;
  origens: CampanhaOrigem[];
};

function norm(s: string) {
  return s.trim().toLowerCase();
}

function same(a: string | undefined, b: string | undefined) {
  return Boolean(a && b && norm(a) === norm(b));
}

export function leadsDaCampanha<T extends { campanha?: string; curso?: string }>(
  campanha: Pick<CampanhaBase, "nome" | "curso">,
  leads: T[],
): T[] {
  return leads.filter(l =>
    same(l.campanha, campanha.nome) || same(l.curso, campanha.curso ?? undefined),
  );
}

export function campanhaNums(
  campanha: CampanhaBase,
  leads: { campanha?: string; curso?: string; email?: string; estado?: string; preco?: number; origem?: string }[],
  formandos: { email?: string; curso?: string; pago?: boolean; valor?: number }[],
  pagamentos: { curso?: string; estado?: string; valor?: number }[],
): CampanhaNums {
  const leadsC = leadsDaCampanha(campanha, leads);
  const emails = new Set(leadsC.map(l => norm(l.email ?? "")).filter(Boolean));
  const pagosLead = leadsC.filter(l => /pago|formando/i.test(l.estado ?? ""));
  const formandosC = formandos.filter(f =>
    Boolean(f.pago) && (
      (f.email && emails.has(norm(f.email)))
      || same(f.curso, campanha.curso ?? undefined)
    ),
  );
  const pagamentosC = pagamentos.filter(p =>
    /pago/i.test(p.estado ?? "") && (
      same(p.curso, campanha.curso ?? undefined)
      || (campanha.curso == null && leadsC.some(l => same(l.curso, p.curso)))
    ),
  );
  const receitaPag = pagamentosC.reduce((s, p) => s + Number(p.valor ?? 0), 0);
  const receitaForm = formandosC.reduce((s, f) => s + Number(f.valor ?? 0), 0);
  const receitaLead = pagosLead.reduce((s, l) => s + Number(l.preco ?? 0), 0);
  const receita = Math.round(receitaPag || receitaForm || receitaLead);
  const pagos = Math.max(pagosLead.length, formandosC.length, pagamentosC.length);
  const naoContactados = leadsC.filter(l => /não contactado|nao contactado/i.test(l.estado ?? "")).length;
  const desistiram = leadsC.filter(l => /desist/i.test(l.estado ?? "")).length;
  const formandosN = leadsC.filter(l => /formando/i.test(l.estado ?? "")).length;
  const contactados = Math.max(0, leadsC.length - naoContactados);
  const origensMap = new Map<string, number>();
  for (const l of leadsC) {
    const key = (l.origem ?? "").trim() || "Sem origem";
    origensMap.set(key, (origensMap.get(key) ?? 0) + 1);
  }
  const origens = [...origensMap.entries()]
    .map(([origem, n]) => ({ origem, n }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 4);
  const receitaEstimada = Math.round(leadsC.reduce((s, l) => s + Number(l.preco ?? 0), 0));
  return {
    preinscricoes: leadsC.length,
    pagos,
    receita,
    contactados,
    naoContactados,
    desistiram,
    formandos: formandosN,
    conversaoPct: leadsC.length ? Math.round((pagos / leadsC.length) * 100) : 0,
    ticketMedio: pagos ? Math.round(receita / pagos) : 0,
    receitaEstimada,
    origens,
  };
}

export function roiLabel(receita: number, custo: number) {
  if (!custo) return "-";
  return `${Math.round(((receita - custo) / custo) * 100)}%`;
}

export function euro(n: number) {
  return `€ ${n.toLocaleString("pt-PT")}`;
}
