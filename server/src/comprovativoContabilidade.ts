/**
 * Comprovativo de pagamento recebido na ligação pessoal: segue para a contabilidade (Configurações › Entidade › Email da
 * contabilidade) com o ficheiro em anexo, os dados da pessoa e os dados de faturação. Modelo editável
 * «comprovativo_contabilidade» (área Contabilidade). Sem email da contabilidade, não sai nada.
 *
 * A seguir ao comprovativo, a ligação pede os dados de faturação; o email à contabilidade espera por eles:
 *  · já confirmados (por exemplo, outro comprovativo depois de uma recusa): sai logo;
 *  · confirmados depois: sai nesse momento;
 *  · sem eles ao fim de «Esperar pelos dados de faturação» (Entidade; 24 horas por omissão): sai com os dados da ficha,
 *    marcados como por confirmar, e volta a sair, com os confirmados, se a pessoa os confirmar depois.
 * Uma hora depois do comprovativo, ainda sem os dados confirmados, a pessoa recebe um lembrete («lembrete_faturacao»).
 * Com o pagamento confirmado, o comprovativo recusado ou a desistência, já não sai nada.
 */
import { logLeadEvent } from "./crmDossier.js";
import type { Db } from "./db/pool.js";
import { situacaoPagamento } from "./docsCurso.js";
import { COMPROVATIVO, documentosUrl, ensureDocsToken, listarDocsLead } from "./docsLink.js";
import { readDriveContent } from "./driveFicheiros.js";
import { enviarModelo } from "./emailModelo.js";
import { dadosConfirmados, sugestaoFaturacao, type DadosFaturacao } from "./faturacao.js";
import { emailsDaEquipa } from "./equipaDestinatarios.js";
import { lerEntidade, type Entidade } from "./regrasConfig.js";
import * as repo from "./repos/comprovativoContabilidade.js";
import * as leads from "./repos/leads.js";
import * as pags from "./repos/pagamentosLead.js";
import { isEmail, normalizeEmail } from "./security.js";
import { areaDoRegime } from "../../src/partilhado/emailAreas.js";

const fmtEuros = (v: number) => v.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ou = (v: unknown) => String(v ?? "").trim() || "—";
const nomeDe = (lead: Record<string, unknown>) => `${lead.nome ?? ""} ${lead.apelido ?? ""}`.replace(/\s+/g, " ").trim();

/** Minutos depois do comprovativo, sem os dados de faturação confirmados, até ao lembrete à pessoa. */
export const LEMBRETE_FATURACAO_MIN = 60;
/** Depois de uma falha (email, Drive), a volta automática só tenta de novo ao fim destes minutos. */
const TENTAR_DEPOIS_MIN = 15;

/** Horas que o email à contabilidade espera pelos dados de faturação (Configurações › Entidade; 24 por omissão). */
export function horasDeEspera(ent: Pick<Entidade, "esperaFaturacaoHoras">) {
  const n = Number(String(ent.esperaFaturacaoHoras ?? "").trim().replace(",", "."));
  return ent.esperaFaturacaoHoras?.trim() && Number.isFinite(n) && n >= 0 ? Math.min(n, 168) : 24;
}

export type FaturacaoNoEmail = { dados: DadosFaturacao; confirmados: boolean };
type Ficheiro = { nome: string; mime: string; bytes: Buffer };

/**
 * Envia o email a cada utilizador com o perfil Contabilidade (false: não há nenhum activo). Sem `faturacao`, vão os dados da ficha, por confirmar.
 * Sem `ficheiro` (não foi possível lê-lo), sai sem anexo: o comprovativo está em Pagamentos.
 */
export async function enviarComprovativoContabilidade(db: Db, lead: Record<string, unknown>, ficheiro: Ficheiro | null, faturacao?: FaturacaoNoEmail) {
  const ent = await lerEntidade(db);
  const destinos = await emailsDaEquipa(db, ["contabilidade"]);
  if (!destinos.length) return false;
  const pag = lead.pagamento_id ? await pags.pagamento(db, String(lead.pagamento_id)) : null;
  const valor = Number(pag?.valor ?? lead.preco) || 0;
  const fat = faturacao ?? { dados: sugestaoFaturacao(lead), confirmados: false };
  const linhas = [
    "Chegou um comprovativo de pagamento (em anexo).",
    "Nome: {{nome_formando}}<br>NIF: {{nif}}<br>Telemóvel: {{telemovel}}<br>Email: {{email_formando}}<br>IBAN: {{iban_formando}}",
    "Curso: {{curso}}<br>Valor: € {{valor}}",
    "Conta de destino: {{iban}}",
    "Dados de faturação ({{faturacao_estado}}):<br>Nome ou empresa: {{faturacao_nome}}<br>NIF: {{faturacao_nif}}<br>Morada fiscal: {{faturacao_morada}}<br>Código postal: {{faturacao_codigo_postal}}<br>Email da fatura: {{faturacao_email}}",
  ];
  for (const pessoa of destinos) await enviarModelo(db, {
    tipo: "comprovativo_contabilidade", area: "contabilidade", para: pessoa.email, nome: pessoa.nome,
    vars: {
      nome_formando: nomeDe(lead) || "—", nif: ou(lead.nif), telemovel: ou(lead.telf), email_formando: ou(lead.email),
      iban_formando: ou(lead.iban), curso: ou(lead.curso), valor: fmtEuros(valor),
      iban: ent.iban.replace(/(.{4})/g, "$1 ").trim() || "—",
      faturacao_estado: fat.confirmados ? "confirmados pela pessoa" : "por confirmar: são os da ficha da pré-inscrição",
      faturacao_nome: ou(fat.dados.nome), faturacao_nif: ou(fat.dados.nif), faturacao_morada: ou(fat.dados.moradaFiscal),
      faturacao_codigo_postal: ou(fat.dados.codigoPostal), faturacao_email: ou(fat.dados.email),
    },
    reserva: { assunto: "Comprovativo de pagamento · {{nome_formando}} · {{curso}}", linhas },
    ...(ficheiro ? { anexos: [{ nome: ficheiro.nome, tipo: ficheiro.mime || "application/octet-stream", conteudo: ficheiro.bytes }] } : {}),
  });
  return true;
}

/** Reserva o envio, envia e regista no histórico; uma falha devolve a reserva (para tentar de novo). */
async function enviarAgora(db: Db, lead: Record<string, unknown>, ficheiro: Ficheiro | null, fat: FaturacaoNoEmail) {
  const leadId = Number(lead.id);
  const reserva = await repo.reservarEnvio(db, leadId, fat.confirmados);
  if (!reserva) return false;
  let saiu: boolean;
  try {
    saiu = await enviarComprovativoContabilidade(db, lead, ficheiro, fat);
  } catch (err) {
    await repo.libertarEnvio(db, leadId, reserva);
    throw err;
  }
  if (saiu) {
    const nota = [
      fat.confirmados ? "Com os dados de faturação confirmados." : "Com os dados da ficha: a pessoa ainda não confirmou os dados de faturação.",
      ficheiro ? "" : "Sem o ficheiro em anexo (não foi possível lê-lo): está em Pagamentos.",
    ].filter(Boolean).join(" ");
    await logLeadEvent(db, leadId, undefined, "seguimento", "Comprovativo enviado à contabilidade", nota);
  }
  return saiu;
}

/** Ainda é preciso? O pagamento por confirmar, sem desistência, e o último comprovativo não recusado. */
async function aindaPorConfirmar(db: Db, lead: Record<string, unknown>) {
  if (String(lead.estado ?? "") === "Desistiu") return false;
  if ((await situacaoPagamento(db, lead)).estado !== "pedido") return false;
  const comp = (await listarDocsLead(db, Number(lead.id))).find(d => d.tipo === COMPROVATIVO.id);
  return Boolean(comp) && comp?.estado !== "recusado";
}

async function lerComprovativo(db: Db, driveFileId: string): Promise<Ficheiro | null> {
  const c = await readDriveContent(db, driveFileId).catch(() => null);
  return c?.bytes ? { nome: c.name, mime: c.mime, bytes: c.bytes } : null;
}

/**
 * Comprovativo anexado na ligação pessoal. Com os dados de faturação já confirmados, segue logo para a contabilidade;
 * sem eles, espera (a ligação pede-os no passo seguinte).
 */
export async function comprovativoRecebido(db: Db, lead: Record<string, unknown>, ficheiro: Ficheiro & { driveFileId: string }) {
  const leadId = Number(lead.id);
  await repo.registarComprovativo(db, leadId, ficheiro.driveFileId);
  const dados = await dadosConfirmados(db, leadId);
  if (!dados) return false;
  return enviarAgora(db, lead, ficheiro, { dados, confirmados: true });
}

/** A pessoa confirmou os dados de faturação (ligação pessoal ou página da faturação): o comprovativo à espera segue já. */
export async function faturacaoConfirmada(db: Db, leadId: number) {
  const pend = await repo.comprovativoDoLead(db, leadId);
  if (!pend || (pend.enviado_em && pend.enviado_com_dados)) return false;
  const lead = await leads.lead(db, leadId) as Record<string, unknown> | null;
  if (!lead || !(await aindaPorConfirmar(db, lead))) {
    await repo.arrumar(db, leadId);
    return false;
  }
  const dados = await dadosConfirmados(db, leadId);
  if (!dados) return false;
  return enviarAgora(db, lead, await lerComprovativo(db, pend.drive_file_id), { dados, confirmados: true });
}

/** Lembrete à pessoa para confirmar os dados de faturação (um por pré-inscrição). */
async function lembrarFaturacao(db: Db, lead: Record<string, unknown>) {
  const leadId = Number(lead.id);
  const email = normalizeEmail(String(lead.email ?? ""));
  if (!(await repo.reservarLembrete(db, leadId)) || !isEmail(email)) return false;
  const curso = String(lead.curso ?? "");
  try {
    const link = `${documentosUrl(await ensureDocsToken(db, leadId))}?passo=pagamento`;
    await enviarModelo(db, {
      tipo: "lembrete_faturacao", area: areaDoRegime(lead.regime), para: email, nome: nomeDe(lead), vars: { curso }, link,
      reserva: {
        assunto: "Confirme os dados de faturação · {{curso}}",
        linhas: [
          "Recebemos o comprovativo do pagamento da inscrição em {{curso}}. Obrigado!",
          "Para emitirmos a fatura, falta confirmar os dados de faturação: nome ou empresa, NIF, morada fiscal, código postal e o email para onde enviamos a fatura.",
          "Já vêm preenchidos com os seus dados. Se a fatura for em nome de uma empresa, altere-os antes de confirmar.",
        ],
        cta: "Confirmar os dados de faturação",
      },
    });
  } catch (err) {
    await repo.libertarLembrete(db, leadId);
    throw err;
  }
  const nota = "Lembrete automático · confirmar os dados de faturação";
  await leads.inserirContacto(db, { leadId, actorId: null, nota, meio: "Email" });
  await logLeadEvent(db, leadId, undefined, "contacto", "Lembrete · dados de faturação", nota);
  return true;
}

/**
 * Volta automática (worker local, cron na Vercel): lembretes à pessoa e emails à contabilidade cujo prazo terminou sem
 * os dados de faturação confirmados. `fim`: prazo (0 = um lote).
 */
export async function enviarComprovativosPendentes(db: Db, fim = 0) {
  const lista = await repo.pendentes(db, horasDeEspera(await lerEntidade(db)), LEMBRETE_FATURACAO_MIN, 25);
  let lembretes = 0;
  let contabilidade = 0;
  for (const p of lista) {
    if (fim && Date.now() >= fim) break;
    const lead = await leads.lead(db, p.preinscricao_id) as Record<string, unknown> | null;
    if (!lead || !(await aindaPorConfirmar(db, lead))) {
      await repo.arrumar(db, p.preinscricao_id);
      continue;
    }
    try {
      if (p.lembrete && await lembrarFaturacao(db, lead)) lembretes += 1;
      if (p.contabilidade) {
        const dados = await dadosConfirmados(db, p.preinscricao_id);
        const fat = dados ? { dados, confirmados: true } : { dados: sugestaoFaturacao(lead), confirmados: false };
        if (await enviarAgora(db, lead, await lerComprovativo(db, p.drive_file_id), fat)) contabilidade += 1;
      }
    } catch (err) {
      console.error("[pagamentos] comprovativo à espera dos dados de faturação:", err);
      await repo.adiar(db, p.preinscricao_id, TENTAR_DEPOIS_MIN);
    }
  }
  return { lembretes, contabilidade };
}
