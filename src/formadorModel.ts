export type FormadorRegime = "gold" | "fin";

export const FAIXAS_DISPONIBILIDADE = [
  { id: "laboral", label: "Laboral, 9h às 13h" },
  { id: "pos", label: "Pós-laboral, 16h30 às 23h" },
  { id: "sabado-manha", label: "Sábado de manhã, 9h às 13h" },
  { id: "sabado-tarde", label: "Sábado à tarde, 14h às 19h" },
] as const;

export type FaixaDisponibilidade = (typeof FAIXAS_DISPONIBILIDADE)[number]["id"];

const FAIXA_IDS = new Set<string>(FAIXAS_DISPONIBILIDADE.map(f => f.id));

export function faixasValidas(v: unknown): FaixaDisponibilidade[] {
  const list = Array.isArray(v) ? v : [];
  return list.map(x => String(x)).filter((x): x is FaixaDisponibilidade => FAIXA_IDS.has(x));
}

export function labelFaixa(id: string) {
  return FAIXAS_DISPONIBILIDADE.find(f => f.id === id)?.label ?? id;
}

/** Liga o nome do horário da turma à faixa que o formador marca na ficha. */
export function faixaDoHorario(horario: string): FaixaDisponibilidade | null {
  const h = horario
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[-_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!h) return null;
  if (h.includes("sabado") && h.includes("tarde")) return "sabado-tarde";
  if (h.includes("sabado")) return "sabado-manha";
  if (/\bpos\b/.test(h)) return "pos";
  if (h.includes("laboral") && h.includes("tarde")) return null;
  if (h.includes("laboral")) return "laboral";
  return null;
}

export type Formador = {
  id: number;
  nome: string;
  telf: string;
  email: string;
  especialidade: string;
  ccp: string;
  nif: string;
  regimes: FormadorRegime[];
  estado: "Ativo" | "Inactivo";
  disponibilidade: FaixaDisponibilidade[];
};

export const FORMADORES_SEED: Formador[] = [
  { id: 7, nome: "Isac Silva", telf: "914 547 554", email: "isacsilva1992@gmail.com", especialidade: "CCP e pedagogia", ccp: "F-44821", nif: "221 448 210", regimes: ["gold", "fin"], estado: "Ativo", disponibilidade: [] },
  { id: 8, nome: "Ivan Esteves", telf: "912 370 557", email: "exsorio2@gmail.com", especialidade: "Comunicação", ccp: "F-51209", nif: "198 220 114", regimes: ["gold"], estado: "Ativo", disponibilidade: [] },
  { id: 11, nome: "António Cardeal", telf: "915 258 691", email: "antoniocardeal71@gmail.com", especialidade: "Comunicar em contexto profissional", ccp: "F-39012", nif: "176 901 332", regimes: ["fin"], estado: "Ativo", disponibilidade: [] },
  { id: 12, nome: "Cátia Pinheiro", telf: "912 919 291", email: "catiapinheiro@ena.pt", especialidade: "Estética facial", ccp: "F-60118", nif: "245 118 009", regimes: ["fin"], estado: "Ativo", disponibilidade: [] },
  { id: 19, nome: "Vânia Fernandes", telf: "967 432 879", email: "fernandes.c.vania@gmail.com", especialidade: "Primeiros socorros", ccp: "F-44790", nif: "203 774 881", regimes: ["gold", "fin"], estado: "Ativo", disponibilidade: [] },
  { id: 20, nome: "Rosana Suarez", telf: "938 039 001", email: "roxana.suarez.costa@gmail.com", especialidade: "Massagem", ccp: "F-55802", nif: "189 330 447", regimes: ["fin"], estado: "Ativo", disponibilidade: [] },
];

export function emptyFormador(regime: FormadorRegime): Formador {
  return {
    id: 0,
    nome: "",
    telf: "",
    email: "",
    especialidade: "",
    ccp: "",
    nif: "",
    regimes: [regime],
    estado: "Ativo",
    disponibilidade: [],
  };
}

export function formadoresDoRegime(list: Formador[], regime: FormadorRegime) {
  return list.filter(f => f.regimes.includes(regime));
}

export function formadoresAtivos(list: Formador[], regime?: FormadorRegime) {
  return list.filter(f => f.estado === "Ativo" && (!regime || f.regimes.includes(regime)));
}

export function formadorSub(f: Pick<Formador, "telf" | "especialidade" | "ccp">) {
  return [f.telf, f.especialidade || (f.ccp ? `CCP ${f.ccp}` : "")].filter(Boolean).join(" · ");
}
