export type DocAmbito = "turma" | "formando" | "formador";

export type DocTipo = { id: string; label: string; required?: boolean };

export const DOCS_FORMANDO_GOLD: DocTipo[] = [
  { id: "cc", label: "Cartão de Cidadão", required: true },
  { id: "contrato", label: "Contrato de formação", required: true },
  { id: "pip", label: "PIP - Projeto de Intervenção Pedagógica" },
  { id: "exp", label: "Comprovativo de 5 anos de experiência" },
  { id: "regulamento", label: "Regulamento de formação aceite", required: true },
];

export const DOCS_FORMANDO_FIN: DocTipo[] = [
  { id: "cc", label: "Cartão de Cidadão", required: true },
  { id: "ch", label: "Certificado de habilitações", required: true },
  { id: "cu", label: "Curriculum vitae", required: true },
  { id: "morada", label: "Comprovativo de morada", required: true },
  { id: "ci", label: "IBAN / comprovativo de NIB", required: true },
  { id: "ce", label: "Comprovativo de situação perante o emprego", required: true },
  { id: "contrato", label: "Contrato de formação", required: true },
  { id: "rgpd", label: "Declaração RGPD", required: true },
];

export type DocOkFin = { ok: boolean; data: string };

export function docFinDe(ficha: object, id: string): DocOkFin {
  const v = (ficha as Record<string, unknown>)[id];
  if (v && typeof v === "object" && "ok" in v) {
    const row = v as { ok?: unknown; data?: unknown };
    return { ok: Boolean(row.ok), data: String(row.data ?? "") };
  }
  return { ok: false, data: "" };
}

export function docsFinOkCount(ficha: object) {
  return DOCS_FORMANDO_FIN.filter(d => docFinDe(ficha, d.id).ok).length;
}

export function docsFinCompletos(ficha: object) {
  return DOCS_FORMANDO_FIN.every(d => !d.required || docFinDe(ficha, d.id).ok);
}

export const DOCS_FORMADOR: DocTipo[] = [
  { id: "cc", label: "Cartão de Cidadão", required: true },
  { id: "ccp", label: "Certificado de Competências Pedagógicas (CCP)", required: true },
  { id: "cv", label: "Curriculum Vitae", required: true },
  { id: "habilitacoes", label: "Certificado de Habilitações", required: true },
  { id: "nib", label: "NIB / IBAN", required: true },
  { id: "decl_irs", label: "Declaração para efeitos de IRS" },
  { id: "seguro", label: "Apólice de Seguro de Acidentes de Trabalho" },
];

export function docsFormandoBase(regime: "gold" | "fin") {
  return regime === "fin" ? DOCS_FORMANDO_FIN : DOCS_FORMANDO_GOLD;
}

export function fundirDocTipos(base: DocTipo[], extras: { id: string; label: string }[]) {
  const seen = new Set(base.map(d => d.id));
  const extra = extras
    .filter(x => x.id && x.label && !seen.has(x.id))
    .map(x => ({ id: x.id, label: x.label, required: false }));
  return [...base, ...extra];
}
