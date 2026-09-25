export type CampanhaBase = {
  id: number;
  nome: string;
  data: string;
  encarregado: string;
  custo: number;
  curso?: string | null;
};

export type CampanhaNums = { preinscricoes: number; pagos: number; receita: number };

function norm(s: string) {
  return s.trim().toLowerCase();
}

function same(a: string | undefined, b: string | undefined) {
  return Boolean(a && b && norm(a) === norm(b));
}

export function campanhaNums(
  campanha: CampanhaBase,
  leads: { campanha?: string; curso?: string; email?: string; estado?: string; preco?: number }[],
  formandos: { email?: string; curso?: string; pago?: boolean; valor?: number }[],
  pagamentos: { curso?: string; estado?: string; valor?: number }[],
): CampanhaNums {
  const leadsC = leads.filter(l =>
    same(l.campanha, campanha.nome) || same(l.curso, campanha.curso ?? undefined),
  );
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
  return {
    preinscricoes: leadsC.length,
    pagos: Math.max(pagosLead.length, formandosC.length, pagamentosC.length),
    receita: Math.round(receitaPag || receitaForm || receitaLead),
  };
}

export function roiLabel(receita: number, custo: number) {
  if (!custo) return "-";
  return `${Math.round(((receita - custo) / custo) * 100)}%`;
}
