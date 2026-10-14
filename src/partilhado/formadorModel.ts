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
  disponibilidade?: string[];
  custoHora?: number;
  alocado?: boolean;
  temAcesso?: boolean;
};


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
    disponibilidade: ["laboral", "pos-laboral", "sabado-manha", "sabado-tarde"],
    custoHora: 0,
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
