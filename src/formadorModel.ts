export type FormadorRegime = "gold" | "fin";

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
};

export const FORMADORES_SEED: Formador[] = [
  { id: 7, nome: "Isac Silva", telf: "914 547 554", email: "isacsilva1992@gmail.com", especialidade: "CCP e pedagogia", ccp: "F-44821", nif: "221 448 210", regimes: ["gold", "fin"], estado: "Ativo" },
  { id: 8, nome: "Ivan Esteves", telf: "912 370 557", email: "exsorio2@gmail.com", especialidade: "Comunicação", ccp: "F-51209", nif: "198 220 114", regimes: ["gold"], estado: "Ativo" },
  { id: 11, nome: "António Cardeal", telf: "915 258 691", email: "antoniocardeal71@gmail.com", especialidade: "Comunicar em contexto profissional", ccp: "F-39012", nif: "176 901 332", regimes: ["fin"], estado: "Ativo" },
  { id: 12, nome: "Cátia Pinheiro", telf: "912 919 291", email: "catiapinheiro@ena.pt", especialidade: "Estética facial", ccp: "F-60118", nif: "245 118 009", regimes: ["fin"], estado: "Ativo" },
  { id: 19, nome: "Vânia Fernandes", telf: "967 432 879", email: "fernandes.c.vania@gmail.com", especialidade: "Primeiros socorros", ccp: "F-44790", nif: "203 774 881", regimes: ["gold", "fin"], estado: "Ativo" },
  { id: 20, nome: "Rosana Suarez", telf: "938 039 001", email: "roxana.suarez.costa@gmail.com", especialidade: "Massagem", ccp: "F-55802", nif: "189 330 447", regimes: ["fin"], estado: "Ativo" },
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
