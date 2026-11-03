/**
 * Emails automáticos com modelo editável (Sistema › Emails › Modelos). Cada email tem um `tipo`: se o modelo existir,
 * o assunto, o texto e o botão vêm dele (com as variáveis preenchidas); se tiver sido apagado, sai o texto de reserva
 * (o mesmo que o modelo traz de origem).
 *
 * Variáveis: texto simples (`{{curso}}`) ou listas (`{{…_itens}}`, uma por linha, saem com «•»). O botão usa
 * `{{link}}` (o endereço próprio de cada email: área do formando, ligação pessoal, inquérito…).
 */
import { renderModelo } from "./automations.js";
import { config } from "./config.js";
import type { Db } from "./db/pool.js";
import { renderAutomaticEmail } from "./emailHtml.js";
import { sendMail } from "./mailer.js";
import { modeloEmail } from "./repos/emails.js";
import { fillVars } from "./security.js";
import type { AreaEmail } from "../../src/partilhado/emailAreas.js";

export type ReservaEmail = { assunto: string; linhas: string[]; cta?: string };

export type EnvioModelo = {
  tipo: string;
  /** Área do modelo (Gold, Financiada, Contabilidade); sem ela, o da Gold. */
  area?: AreaEmail;
  para: string;
  nome: string;
  /** Variáveis do modelo; as listas (`…_itens`) podem vir em array. */
  vars: Record<string, string | string[]>;
  /** Endereço do botão ({{link}}). */
  link?: string;
  /** O texto de origem do modelo, para quando o modelo foi apagado. */
  reserva: ReservaEmail;
  anexos?: { nome: string; tipo: string; conteudo: Buffer }[];
  de?: { nome: string; email: string };
};

/** Prepara o email (assunto, texto e html) sem o enviar. */
export async function montarModelo(db: Db, e: Omit<EnvioModelo, "para" | "anexos" | "de"> & { email?: string }) {
  const vars: Record<string, string> = { email: e.email ?? "" };
  for (const [k, v] of Object.entries(e.vars)) vars[k] = Array.isArray(v) ? v.filter(Boolean).join("\n") : v;
  vars.nome ??= e.nome;
  vars.link = e.link ?? "";
  const modelo = await modeloEmail(db, e.tipo, e.area ?? "gold");
  if (modelo) return renderModelo({ ...modelo, template_tipo: modelo.tipo }, e.nome, vars);
  const mail = renderAutomaticEmail({
    nome: e.nome, xml: "", linhas: e.reserva.linhas, cta: e.reserva.cta ?? "", href: e.link ?? "", vars, origin: config.appOrigin,
  });
  return { subject: fillVars(e.reserva.assunto, vars), ...mail };
}

/** Envia o email do modelo `tipo` (ou o texto de reserva). */
export async function enviarModelo(db: Db, e: EnvioModelo) {
  const mail = await montarModelo(db, { ...e, email: e.para });
  return sendMail(db, {
    to: e.para, name: e.nome, subject: mail.subject, text: mail.text, html: mail.html,
    ...(e.anexos ? { anexos: e.anexos } : {}), ...(e.de ? { de: e.de } : {}),
  });
}

/**
 * Variáveis próprias de cada modelo de email automático (além das gerais: nome, email, curso…), com um exemplo
 * para a pré-visualização. `link` é o endereço do botão.
 */
export const VARIAVEIS_DOS_MODELOS: Record<string, Record<string, string>> = {
  acesso_formando_pago: { palavra_passe: "Palavra-passe temporária: Ab12cd34 (vai ser pedida uma nova no primeiro acesso).", link: "/area-formando" },
  acesso_formando: { palavra_passe: "Palavra-passe temporária: Ab12cd34 (vai ser pedida uma nova no primeiro acesso).", link: "/area-formando" },
  pedido_pagamento: { valor: "125,00", link: "(página de pagamento)" },
  pedido_pagamento_formando: { valor: "125,00", iban: "PT50 0000 0000 0000 0000 0000 0", titular: "ENA", link: "/area-formando" },
  comprovativo_recusado: { motivo: "O comprovativo não está legível.", link: "(página de pagamento)" },
  turma_cheia: { local: "V.N.Gaia", turmas_itens: "CCP-VNG-PL · Pós-laboral · início 02-12-2026 · 4 vagas", sem_turmas: "", link: "(ligação pessoal)" },
  documentos_em_falta: { link: "(ligação pessoal)" },
  lembrete_turma: { situacao: "Ainda falta escolher a turma.", link: "(ligação pessoal)" },
  lembrete_docs_fin_inicio: { link: "(área segura dos documentos)" },
  plano_aprovado: { sessao: "3", data_sessao: " (12-11-2026)", revisto_por: " (Coordenação)", comentario_itens: "Bom trabalho.", link: "(sessões da turma)" },
  plano_devolvido: { sessao: "3", data_sessao: " (12-11-2026)", revisto_por: " (Coordenação)", comentario_itens: "Falta o tempo da conclusão.", link: "(sessões da turma)" },
  inquerito_turma: { publico: "Formandos", inqueritos_itens: "Inquérito de satisfação: https://…", link: "(inquérito)" },
  comprovativo_contabilidade: {
    nome_formando: "Ana Silva", nif: "123456789", telemovel: "910000000", email_formando: "ana@exemplo.pt",
    iban_formando: "—", valor: "125,00", iban: "PT50 0000 0000 0000 0000 0000 0",
  },
  pedido_contacto: { sobre_curso: " sobre Formação de Formadores - CCP" },
  pedido_proposta: {
    nome_contacto: "Ana Silva", empresa: "Empresa, Lda.", email_contacto: "ana@empresa.pt", telefone: "910000000",
    servico: "Formação à medida", mensagem: "Gostaria de receber uma proposta.",
  },
};
