export type CtaAmbito = "preinscricao" | "contacto";

export type CtaDestino = {
  ambito: CtaAmbito;
  href: string;
  funcao: string;
};

export const SECRETARIA_MAIL = "formacao@ena.pt";
export const SECRETARIA_HREF = `mailto:${SECRETARIA_MAIL}`;

function appOrigin() {
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return "";
}

export const CTA_BY_TIPO: Record<string, CtaDestino> = {
  welcome: {
    ambito: "contacto",
    href: SECRETARIA_HREF,
    funcao: "Abrir o email da secretaria",
  },
  payment: {
    ambito: "contacto",
    href: SECRETARIA_HREF,
    funcao: "Confirmar turma e horário com a secretaria",
  },
  sale_followup: {
    ambito: "contacto",
    href: SECRETARIA_HREF,
    funcao: "Pedir fatura, recibo ou alteração de dados",
  },
  reminder_24h: {
    ambito: "contacto",
    href: SECRETARIA_HREF,
    funcao: "Confirmar a primeira sessão com a secretaria",
  },
  certificate: {
    ambito: "contacto",
    href: SECRETARIA_HREF,
    funcao: "Pedir o certificado em PDF à secretaria",
  },
  reengagement: {
    ambito: "preinscricao",
    href: "{{preinscricao_url}}",
    funcao: "Voltar a deixar os dados no formulário público",
  },
};

export function isCtaAmbito(value: string | undefined): value is CtaAmbito {
  return value === "preinscricao" || value === "contacto";
}

export function ctaDestino(tipo: string): CtaDestino {
  return CTA_BY_TIPO[tipo] ?? {
    ambito: "contacto",
    href: SECRETARIA_HREF,
    funcao: "Falar com a secretaria",
  };
}

export function ctaAmbitoLabel(ambito: CtaAmbito) {
  return ambito === "preinscricao" ? "Pré-inscrição" : "Contacto da secretaria";
}

export function hrefForAmbito(tipo: string, ambito: CtaAmbito) {
  const def = ctaDestino(tipo);
  if (def.ambito === ambito) return def.href;
  return ambito === "preinscricao" ? "{{preinscricao_url}}" : SECRETARIA_HREF;
}

export function buildCtaVars(p: { nome: string; email: string; curso: string; turma: string }) {
  const q = new URLSearchParams({ email: p.email, curso: p.curso, turma: p.turma });
  return {
    nome: p.nome,
    email: p.email,
    curso: p.curso,
    turma: p.turma,
    preinscricao_url: `${appOrigin()}/pre-inscricao?${q.toString()}`,
    secretaria_url: SECRETARIA_HREF,
  };
}

export function fillCtaHref(href: string, vars: Record<string, string>) {
  return href.replace(/\{\{(\w+)\}\}/g, (_, k: string) => {
    if (k === "preinscricao_url" || k === "secretaria_url") return vars[k] ?? "";
    return encodeURIComponent(vars[k] ?? "");
  });
}
