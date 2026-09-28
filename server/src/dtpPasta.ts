export type DtpFasePasta = "antes" | "durante" | "depois";
export type DtpAmbitoPasta = "turma" | "formando" | "formador";

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

export function dtpFasePasta(fase: DtpFasePasta | string | undefined) {
  if (fase === "durante") return "02-Durante";
  if (fase === "depois") return "03-Fecho";
  return "01-Antes da turma";
}

export function pastaSegura(nome: string) {
  const base = nome.replace(/[/\\]/g, " ").replace(/\s+/g, " ").trim();
  return (base || "documento").slice(0, 120);
}

export function dtpZipRelPath(opts: {
  root: string;
  fase?: DtpFasePasta | string;
  ambito?: DtpAmbitoPasta | string;
  itemLabel?: string;
  pessoa?: string;
  kind?: string;
  fileName: string;
}) {
  const root = pastaSegura(opts.root);
  const file = pastaSegura(opts.fileName).replace(/[/\\]/g, "_");
  const label = pastaSegura(opts.itemLabel || opts.kind || "documento");
  if (opts.ambito === "formando" || opts.kind === "formando-doc" || opts.kind === "pip") {
    const pessoa = pastaSegura(opts.pessoa || "formando");
    return [root, "04-Formandos", pessoa, label, file].join("/");
  }
  if (opts.ambito === "formador" || opts.kind === "formador-doc") {
    return [root, "05-Formador", label, file].join("/");
  }
  if (opts.kind === "certificado") {
    const pessoa = pastaSegura(opts.pessoa || "formando");
    return [root, "03-Fecho", "Certificados", pessoa, file].join("/");
  }
  if (opts.kind === "simulacao") {
    return [root, "02-Durante", label, file].join("/");
  }
  return [root, dtpFasePasta(opts.fase), label, file].join("/");
}

export function dtpDriveSegments(ctx: {
  kind: string;
  regime?: string;
  turma?: string;
  formando?: string;
  label?: string;
  fase?: string;
}, rootName: string) {
  const regime = ctx.regime === "fin" ? "fin" as const : ctx.regime === "gold" ? "gold" as const : undefined;
  const segs = [rootName];
  if (regime === "fin") segs.push("Financiada");
  else if (regime === "gold") segs.push("Gold");

  const dtpKinds = new Set(["dtp", "formando-doc", "pip", "simulacao", "certificado"]);
  const inDtp = Boolean(ctx.turma) && (dtpKinds.has(ctx.kind) || ctx.kind === "formador-doc");
  if (!inDtp) return null;

  segs.push(pastaSegura(dtpPastaNome(regime ?? "gold", ctx.turma ?? "turma")));
  if (ctx.kind === "formando-doc" || ctx.kind === "pip") {
    segs.push("04-Formandos");
    if (ctx.formando) segs.push(pastaSegura(ctx.formando));
    if (ctx.label) segs.push(pastaSegura(ctx.label));
    return segs;
  }
  if (ctx.kind === "formador-doc") {
    segs.push("05-Formador");
    if (ctx.label) segs.push(pastaSegura(ctx.label));
    return segs;
  }
  if (ctx.kind === "certificado") {
    segs.push("03-Fecho", "Certificados");
    if (ctx.formando) segs.push(pastaSegura(ctx.formando));
    return segs;
  }
  if (ctx.kind === "simulacao") {
    segs.push("02-Durante", pastaSegura(ctx.label || "Simulacoes"));
    if (ctx.formando) segs.push(pastaSegura(ctx.formando));
    return segs;
  }
  segs.push(dtpFasePasta(ctx.fase));
  if (ctx.label) segs.push(pastaSegura(ctx.label));
  return segs;
}
