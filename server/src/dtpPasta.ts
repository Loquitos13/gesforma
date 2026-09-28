export type DtpFasePasta = "antes" | "durante" | "depois";
export type DtpAmbitoPasta = "turma" | "formando" | "formador";
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
  const turma = turmaNome.trim() || "turma";
  return `DTP ${tag} ${turma}`;
}

export function dtpZipNome(regime: "gold" | "fin", turmaNome: string) {
  const tag = regime === "fin" ? "Financiada" : "Gold";
  return `DTP-${tag}-${slugTurma(turmaNome)}.zip`;
}

export function pastaSegura(nome: string) {
  const base = nome.replace(/[/\\]/g, " ").replace(/\s+/g, " ").trim();
  return (base || "documento").slice(0, 120);
}

export function dtpCategoriaDe(item: {
  id?: string;
  ambito?: string;
  kind?: string;
  categoria?: string;
}): DtpCategoriaId {
  const known = DTP_CATEGORIAS.find(c => c.id === item.categoria);
  if (known) return known.id;
  if (item.kind === "certificado") return "certificacao";
  if (item.kind === "simulacao") return "avaliacao";
  if (item.kind === "pip" || item.kind === "formando-doc" || item.ambito === "formando") return "formandos";
  if (item.kind === "formador-doc" || item.ambito === "formador") return "formador";
  const raw = (item.id ?? "").replace(/^extra:/, "");
  return ID_CAT[raw] ?? "identificacao";
}

export function dtpCategoriaPasta(item: Parameters<typeof dtpCategoriaDe>[0] | DtpCategoriaId) {
  const id = typeof item === "string" ? item : dtpCategoriaDe(item);
  return DTP_CATEGORIAS.find(c => c.id === id)?.pasta ?? "01-Identificacao e programa";
}

/** @deprecated Use dtpCategoriaPasta. Mantido só para chamadas antigas. */
export function dtpFasePasta(fase: DtpFasePasta | string | undefined) {
  if (fase === "durante") return dtpCategoriaPasta("pedagogia");
  if (fase === "depois") return dtpCategoriaPasta("certificacao");
  return dtpCategoriaPasta("identificacao");
}

export function dtpZipRelPath(opts: {
  root: string;
  fase?: DtpFasePasta | string;
  ambito?: DtpAmbitoPasta | string;
  itemId?: string;
  itemLabel?: string;
  pessoa?: string;
  kind?: string;
  fileName: string;
}) {
  const root = pastaSegura(opts.root);
  const file = pastaSegura(opts.fileName).replace(/[/\\]/g, "_");
  const label = pastaSegura(opts.itemLabel || opts.kind || "documento");
  const cat = dtpCategoriaDe({
    id: opts.itemId,
    ambito: opts.ambito,
    kind: opts.kind,
  });
  const pasta = dtpCategoriaPasta(cat);
  if (cat === "formandos" && (opts.ambito === "formando" || opts.kind === "formando-doc" || opts.kind === "pip" || opts.pessoa)) {
    const pessoa = pastaSegura(opts.pessoa || "formando");
    return [root, pasta, pessoa, label, file].join("/");
  }
  if (cat === "formador" || opts.kind === "formador-doc") {
    return [root, pasta, label, file].join("/");
  }
  if (opts.kind === "certificado") {
    const pessoa = pastaSegura(opts.pessoa || "formando");
    return [root, pasta, "Certificados", pessoa, file].join("/");
  }
  return [root, pasta, label, file].join("/");
}

export function dtpDriveSegments(ctx: {
  kind: string;
  regime?: string;
  turma?: string;
  formando?: string;
  label?: string;
  fase?: string;
  itemId?: string;
}, rootName: string) {
  const regime = ctx.regime === "fin" ? "fin" as const : ctx.regime === "gold" ? "gold" as const : undefined;
  const segs = [rootName];
  if (regime === "fin") segs.push("Financiada");
  else if (regime === "gold") segs.push("Gold");

  const dtpKinds = new Set(["dtp", "formando-doc", "pip", "simulacao", "certificado"]);
  const inDtp = Boolean(ctx.turma) && (dtpKinds.has(ctx.kind) || ctx.kind === "formador-doc");
  if (!inDtp) return null;

  segs.push(pastaSegura(dtpPastaNome(regime ?? "gold", ctx.turma ?? "turma")));
  const cat = dtpCategoriaDe({
    id: ctx.itemId,
    kind: ctx.kind,
    ambito: ctx.kind === "formando-doc" || ctx.kind === "pip" ? "formando" : ctx.kind === "formador-doc" ? "formador" : undefined,
  });
  segs.push(dtpCategoriaPasta(cat));
  if (cat === "formandos" && (ctx.kind === "formando-doc" || ctx.kind === "pip")) {
    if (ctx.formando) segs.push(pastaSegura(ctx.formando));
    if (ctx.label) segs.push(pastaSegura(ctx.label));
    return segs;
  }
  if (ctx.kind === "formador-doc") {
    if (ctx.label) segs.push(pastaSegura(ctx.label));
    return segs;
  }
  if (ctx.kind === "certificado") {
    segs.push("Certificados");
    if (ctx.formando) segs.push(pastaSegura(ctx.formando));
    return segs;
  }
  if (ctx.label) segs.push(pastaSegura(ctx.label));
  return segs;
}
