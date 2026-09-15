export type CtaAmbito = "preinscricao" | "plataforma";

export type CtaDestino = {
  ambito: CtaAmbito;
  href: string;
  funcao: string;
};

export const PLATAFORMA_BASE = "https://formandos.ena.pt";

export const CTA_BY_TIPO: Record<string, CtaDestino> = {
  welcome: {
    ambito: "preinscricao",
    href: "{{preinscricao_url}}",
    funcao: "Abrir a pré-inscrição no site",
  },
  payment: {
    ambito: "plataforma",
    href: "{{plataforma_url}}/turma/{{turma}}",
    funcao: "Abrir a turma na plataforma do formando",
  },
  sale_followup: {
    ambito: "plataforma",
    href: "{{plataforma_url}}/secretaria?turma={{turma}}",
    funcao: "Abrir a secretaria na plataforma do formando",
  },
  reminder_24h: {
    ambito: "plataforma",
    href: "{{plataforma_url}}/turma/{{turma}}/cronograma",
    funcao: "Abrir o cronograma da turma",
  },
  certificate: {
    ambito: "plataforma",
    href: "{{plataforma_url}}/turma/{{turma}}/certificados",
    funcao: "Descarregar o certificado na plataforma",
  },
  reengagement: {
    ambito: "preinscricao",
    href: "{{preinscricao_url}}&retomar=1",
    funcao: "Retomar a pré-inscrição",
  },
};

export function isCtaAmbito(value: string | undefined): value is CtaAmbito {
  return value === "preinscricao" || value === "plataforma";
}

export function ctaDestino(tipo: string): CtaDestino {
  return CTA_BY_TIPO[tipo] ?? {
    ambito: "plataforma",
    href: "{{plataforma_url}}",
    funcao: "Abrir a plataforma do formando",
  };
}

export function buildCtaVars(p: { nome: string; email: string; curso: string; turma: string }) {
  const q = new URLSearchParams({ email: p.email, curso: p.curso, turma: p.turma });
  return {
    nome: p.nome,
    email: p.email,
    curso: p.curso,
    turma: p.turma,
    preinscricao_url: `${PLATAFORMA_BASE}/pre-inscricao?${q.toString()}`,
    plataforma_url: PLATAFORMA_BASE,
  };
}

export function fillCtaHref(href: string, vars: Record<string, string>) {
  return href.replace(/\{\{(\w+)\}\}/g, (_, k: string) => {
    if (k === "preinscricao_url" || k === "plataforma_url") return vars[k] ?? "";
    return encodeURIComponent(vars[k] ?? "");
  });
}
