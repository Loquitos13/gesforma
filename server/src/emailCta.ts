import { config } from "./config.js";

export type CtaAmbito = "preinscricao" | "contacto" | "documentos" | "pagamento";

export type CtaDestino = {
  ambito: CtaAmbito;
  href: string;
  funcao: string;
};

/** Email de contacto da secretaria: o de resposta (MAIL_REPLY_TO) ou o remetente (MAIL_FROM). */
function emailContacto() {
  const bruto = (config.mailReplyTo || config.mailFrom || "").trim();
  const m = bruto.match(/<([^>]+)>/);
  return (m ? m[1]! : bruto).trim().toLowerCase();
}

export const SECRETARIA_MAIL = emailContacto();
export const SECRETARIA_HREF = `mailto:${SECRETARIA_MAIL}`;

export const CTA_BY_TIPO: Record<string, CtaDestino> = {
  welcome: {
    ambito: "documentos",
    href: "{{documentos_url}}",
    funcao: "Enviar os documentos da pré-inscrição",
  },
  lembrete_docs: {
    ambito: "documentos",
    href: "{{documentos_url}}",
    funcao: "Enviar os documentos em falta",
  },
  lembrete_docs_final: {
    ambito: "documentos",
    href: "{{documentos_url}}",
    funcao: "Enviar os documentos em falta (último lembrete)",
  },
  campanha_preinscritos: {
    ambito: "documentos",
    href: "{{documentos_url}}",
    funcao: "Retomar a inscrição: enviar os documentos",
  },
  faturacao: {
    ambito: "contacto",
    href: "{{faturacao_url}}",
    funcao: "Preencher os dados de faturação",
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
  unpaid_3d: {
    ambito: "pagamento",
    href: "{{comprovativo_url}}",
    funcao: "Enviar o comprovativo de pagamento",
  },
  pagamento_ref: {
    ambito: "pagamento",
    href: "{{comprovativo_url}}",
    funcao: "Anexar o comprovativo de pagamento",
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
  return value === "preinscricao" || value === "contacto" || value === "documentos" || value === "pagamento";
}

export function ctaDestino(tipo: string): CtaDestino {
  return CTA_BY_TIPO[tipo] ?? {
    ambito: "contacto",
    href: SECRETARIA_HREF,
    funcao: "Falar com a secretaria",
  };
}

export function hrefForAmbito(tipo: string, ambito: CtaAmbito) {
  const def = ctaDestino(tipo);
  if (def.ambito === ambito) return def.href;
  if (ambito === "preinscricao") return "{{preinscricao_url}}";
  if (ambito === "documentos") return "{{documentos_url}}";
  if (ambito === "pagamento") return "{{comprovativo_url}}";
  return SECRETARIA_HREF;
}

/** O botão segue o âmbito. Documentos, pagamento e pré-inscrição não usam um href antigo gravado no template. */
export function hrefDoBotao(tipo: string, ambito: string | undefined, stored: string) {
  const dest = ctaDestino(tipo);
  const amb = isCtaAmbito(ambito) ? ambito : dest.ambito;
  if (amb === "documentos" || amb === "pagamento" || amb === "preinscricao") return hrefForAmbito(tipo, amb);
  return stored.trim() || dest.href;
}

export function buildCtaVars(p: {
  nome: string; email: string; curso: string; turma: string;
  documentosUrl?: string; comprovativoUrl?: string;
  referencia?: string; entidade?: string; valor?: string; documentosLista?: string;
  /** Listas (um item por linha): documentos pedidos, documentos em falta, telefones por zona. */
  documentosItens?: string[]; emFaltaItens?: string[]; telefonesItens?: string[]; cronogramasItens?: string[];
}) {
  const origin = config.appOrigin.replace(/\/$/, "");
  const q = new URLSearchParams({ email: p.email, curso: p.curso, turma: p.turma });
  const docs = p.documentosUrl || `${origin}/pre-inscricao?${q.toString()}`;
  return {
    nome: p.nome,
    email: p.email,
    curso: p.curso,
    turma: p.turma,
    preinscricao_url: `${origin}/pre-inscricao?${q.toString()}`,
    documentos_url: docs,
    comprovativo_url: p.comprovativoUrl || `${docs}?passo=pagamento`,
    secretaria_url: SECRETARIA_HREF,
    referencia: p.referencia ?? "",
    entidade: p.entidade ?? "",
    valor: p.valor ?? "",
    documentos_lista: p.documentosLista ?? "",
    documentos_itens: (p.documentosItens ?? []).join("\n"),
    documentos_em_falta_itens: (p.emFaltaItens ?? []).join("\n"),
    telefones_itens: (p.telefonesItens ?? []).join("\n"),
    cronogramas_itens: (p.cronogramasItens ?? []).join("\n"),
  };
}

export function fillCtaHref(href: string, vars: Record<string, string>) {
  return href.replace(/\{\{(\w+)\}\}/g, (_, k: string) => {
    if (k === "preinscricao_url" || k === "secretaria_url" || k === "documentos_url" || k === "comprovativo_url" || k === "faturacao_url") {
      return vars[k] ?? "";
    }
    return encodeURIComponent(vars[k] ?? "");
  });
}
