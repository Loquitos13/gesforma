export type DtpCategoriaId =
  | "identificacao"
  | "formandos"
  | "formador"
  | "pedagogia"
  | "avaliacao"
  | "certificacao";

export const DTP_CATEGORIAS: { id: DtpCategoriaId; pasta: string; label: string; hint: string }[] = [
  { id: "identificacao", pasta: "01-Identificacao e programa", label: "Identificação e programa", hint: "Turma, UFCD, programa, regulamento, instalações e divulgação." },
  { id: "formandos", pasta: "02-Formandos", label: "Formandos", hint: "Fichas, contratos, elegibilidade, RGPD, PIP e recibos." },
  { id: "formador", pasta: "03-Formador", label: "Formador", hint: "Contrato, CV, CCP, habilitações e avaliação de desempenho." },
  { id: "pedagogia", pasta: "04-Pedagogia", label: "Pedagogia", hint: "Cronograma, planos, sumários, presenças, horas e materiais." },
  { id: "avaliacao", pasta: "05-Avaliacao", label: "Avaliação", hint: "Instrumentos, simulações, pauta e satisfação." },
  { id: "certificacao", pasta: "06-Certificacao e relatorios", label: "Certificação e relatórios", hint: "Certificados, execução e relatório final." },
];

const ID_CAT: Record<string, DtpCategoriaId> = {
  "id-turma": "identificacao",
  ufcd: "identificacao",
  programa: "identificacao",
  regulamento: "identificacao",
  enquadramento: "identificacao",
  instalacoes: "identificacao",
  divulgacao: "identificacao",
  fichas: "formandos",
  "contratos-f": "formandos",
  cc: "formandos",
  ch: "formandos",
  "cv-formando": "formandos",
  iban: "formandos",
  emprego: "formandos",
  "exp-formandos": "formandos",
  rgpd: "formandos",
  recibos: "formandos",
  pip: "formandos",
  "contrato-formador": "formador",
  "cv-formador": "formador",
  "ccp-formador": "formador",
  "habil-formador": "formador",
  "aval-formador": "formador",
  cronograma: "pedagogia",
  planos: "pedagogia",
  sumarios: "pedagogia",
  presencas: "pedagogia",
  horas: "pedagogia",
  ocorrencias: "pedagogia",
  materiais: "pedagogia",
  "sim-ini": "avaliacao",
  "sim-fim": "avaliacao",
  instrumentos: "avaliacao",
  pauta: "avaliacao",
  satisfacao: "avaliacao",
  certificados: "certificacao",
  execucao: "certificacao",
  relatorio: "certificacao",
};

export function slugTurma(nome: string) {
  const s = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return s || "turma";
}

export function dtpPastaNome(regime: "gold" | "fin", turmaNome: string) {
  const tag = regime === "fin" ? "Financiada" : "Gold";
  return `DTP ${tag} ${turmaNome.trim() || "turma"}`;
}

export function dtpZipNome(regime: "gold" | "fin", turmaNome: string) {
  const tag = regime === "fin" ? "Financiada" : "Gold";
  return `DTP-${tag}-${slugTurma(turmaNome)}.zip`;
}

export function dtpCategoriaDe(item: { id?: string; ambito?: string; kind?: string }): DtpCategoriaId {
  if (item.kind === "certificado") return "certificacao";
  if (item.kind === "simulacao") return "avaliacao";
  if (item.kind === "pip" || item.kind === "formando-doc" || item.ambito === "formando") return "formandos";
  if (item.kind === "formador-doc" || item.ambito === "formador") return "formador";
  const raw = (item.id ?? "").replace(/^extra:/, "");
  return ID_CAT[raw] ?? "identificacao";
}

export function dtpCategoriaPasta(item: { id?: string; ambito?: string; kind?: string } | DtpCategoriaId) {
  const id = typeof item === "string" ? item : dtpCategoriaDe(item);
  return DTP_CATEGORIAS.find(c => c.id === id)?.pasta ?? "01-Identificacao e programa";
}
