export type FormadorRegime = "gold" | "fin";

export type HorarioDia = { inicio: string; fim: string };

export type DiaDisponibilidade = {
  data: string;
  estado: "disponivel" | "indisponivel";
  horarios: HorarioDia[];
};

const HORA = /^\d{2}:\d{2}$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

export function diasDisponibilidade(v: unknown): DiaDisponibilidade[] {
  if (!Array.isArray(v)) return [];
  const out: DiaDisponibilidade[] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const data = String(row.data ?? "");
    if (!DATA.test(data)) continue;
    const estado = row.estado === "indisponivel" ? "indisponivel" : "disponivel";
    const horarios = Array.isArray(row.horarios)
      ? row.horarios.flatMap(h => {
          if (!h || typeof h !== "object") return [];
          const inicio = String((h as { inicio?: string }).inicio ?? "");
          const fim = String((h as { fim?: string }).fim ?? "");
          if (!HORA.test(inicio) || !HORA.test(fim) || fim <= inicio) return [];
          return [{ inicio, fim }];
        })
      : [];
    out.push({ data, estado, horarios: estado === "indisponivel" ? [] : horarios });
  }
  out.sort((a, b) => a.data.localeCompare(b.data));
  return out;
}

export function horaCabeNoDia(horarios: HorarioDia[], inicio: string, fim: string) {
  if (!horarios.length) return true;
  return horarios.some(h => h.inicio <= inicio && h.fim >= fim);
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
  disponibilidade: DiaDisponibilidade[];
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

export function nomesDoCampoFormador(formador: string | undefined) {
  return (formador ?? "").split("·").map(s => s.trim()).filter(Boolean);
}
