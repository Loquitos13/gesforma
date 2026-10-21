/**
 * Ligação pessoal da Financiada: antes dos documentos, a pessoa indica a morada, a identificação (documento, NIF,
 * NISS, IBAN, situação face ao emprego) e aceita os termos e o uso dos dados. Cada passo grava-se logo (validado
 * com as regras de src/partilhado/dadosPessoaisFin.ts) no pacote cifrado da pré-inscrição; sem os três passos o
 * servidor recusa documentos, consentimentos e a conclusão. Os valores nunca vão para o histórico nem para o log.
 */
import type { Db } from "./db/pool.js";
import { logLeadEvent } from "./crmDossier.js";
import { hojeLisboa } from "./datas.js";
import { readPreinscricaoPii, writePreinscricaoPii, type DadosFinPreinscricao, type PreinscricaoPii } from "./pii.js";
import * as escrita from "./repos/leadsEscrita.js";
import * as leads from "./repos/leads.js";
import { nomesPublicos } from "./repos/listas.js";
import {
  CAMPOS_SENSIVEIS_FIN, CONSENTIMENTO_DADOS_FIN, TERMOS_FIN, TERMOS_FIN_VERSAO, mascararFim, normalizarIdentificacaoFin,
  normalizarMoradaFin, situacaoEmpregoFin, validarIdentificacaoFin, validarMoradaFin,
  type CampoSensivelFin, type IdentificacaoFinForm, type MoradaFin,
} from "../../src/partilhado/dadosPessoaisFin.js";

export class DadosFinErro extends Error {
  constructor(message: string, readonly campos?: Record<string, string>) { super(message); }
}

const ehFin = (lead: Record<string, unknown>) => String(lead.regime ?? "gold") === "fin";

function moradaGuardada(pii: PreinscricaoPii, lead: Record<string, unknown>): MoradaFin | null {
  const m = { morada: pii.moradaFiscal ?? "", localidade: pii.fin?.localidade ?? "", codigoPostal: pii.codigoPostal ?? "", concelho: String(lead.concelho ?? "") };
  return Object.keys(validarMoradaFin(m)).length ? null : m;
}

/** Campos sensíveis já gravados (ao retomar vêm mascarados; em branco, mantêm-se). */
function sensiveisGuardados(pii: PreinscricaoPii): CampoSensivelFin[] {
  const f = pii.fin ?? {};
  const valores: Record<CampoSensivelFin, string> = {
    numeroDocumento: f.numeroDocumento ?? "", nif: pii.nif ?? "", niss: f.niss ?? "", iban: f.iban ?? "",
    nifEntidadeEmpregadora: f.nifEntidadeEmpregadora ?? "",
  };
  return CAMPOS_SENSIVEIS_FIN.filter(k => valores[k]);
}

function identificacaoCompleta(pii: PreinscricaoPii) {
  const f = pii.fin ?? {};
  const sit = situacaoEmpregoFin(f.situacaoEmprego ?? "");
  return Boolean(f.tipoDocumento && f.numeroDocumento && f.validadeDocumento && pii.nif && f.niss && f.iban && sit
    && (!sit.pedeNifEntidade || f.nifEntidadeEmpregadora));
}

/** O que a ligação mostra dos dados da Financiada (sensíveis mascarados) e o passo em que a pessoa está. */
export function vistaDadosFin(lead: Record<string, unknown>) {
  if (!ehFin(lead)) return null;
  const pii = readPreinscricaoPii(lead);
  const f = pii.fin ?? {};
  const morada = moradaGuardada(pii, lead);
  const identificacao = identificacaoCompleta(pii);
  const termos = lead.termos_fin_em ? { em: new Date(String(lead.termos_fin_em)).toISOString(), versao: String(lead.termos_fin_versao ?? "") } : null;
  return {
    morada: morada ?? { morada: pii.moradaFiscal ?? "", localidade: f.localidade ?? "", codigoPostal: pii.codigoPostal ?? "", concelho: String(lead.concelho ?? "") },
    moradaCompleta: Boolean(morada),
    identificacao: {
      tipoDocumento: f.tipoDocumento ?? "",
      validadeDocumento: f.validadeDocumento ?? "",
      situacaoEmprego: f.situacaoEmprego ?? "",
      // Mascarados: para os mudar, a pessoa volta a escrevê-los.
      mascarados: {
        numeroDocumento: mascararFim(f.numeroDocumento ?? ""),
        nif: mascararFim(pii.nif ?? ""),
        niss: mascararFim(f.niss ?? ""),
        iban: mascararFim(f.iban ?? ""),
        nifEntidadeEmpregadora: mascararFim(f.nifEntidadeEmpregadora ?? ""),
      },
      guardados: sensiveisGuardados(pii),
    },
    identificacaoCompleta: identificacao,
    termos,
    termosVersao: TERMOS_FIN_VERSAO,
    termosTexto: [...TERMOS_FIN],
    consentimentoTexto: CONSENTIMENTO_DADOS_FIN,
    completo: Boolean(morada) && identificacao && Boolean(termos && termos.versao === TERMOS_FIN_VERSAO),
  };
}

/** Financiada sem os três passos (morada, identificação, termos): a mensagem; noutros casos, "". */
export function faltaDadosFin(lead: Record<string, unknown>) {
  const v = vistaDadosFin(lead);
  if (!v || v.completo) return "";
  if (!v.moradaCompleta) return "Indique primeiro a morada.";
  if (!v.identificacaoCompleta) return "Indique primeiro os dados de identificação.";
  return "Aceite primeiro os termos e condições e o uso dos dados pessoais.";
}

async function leadAberto(db: Db, leadId: number) {
  const lead = await leads.lead(db, leadId);
  if (!lead) throw new DadosFinErro("Pré-inscrição inexistente.");
  if (!ehFin(lead)) throw new DadosFinErro("Este passo é só da formação financiada.");
  if (lead.validada_em) throw new DadosFinErro("A secretaria já validou esta pré-inscrição.");
  return lead;
}

function falhar(erros: Record<string, string | undefined>) {
  const campos = Object.fromEntries(Object.entries(erros).filter(([, v]) => v)) as Record<string, string>;
  const primeiro = Object.values(campos)[0];
  if (primeiro) throw new DadosFinErro(primeiro, campos);
}

async function gravarPacote(db: Db, leadId: number, prev: PreinscricaoPii, mudar: Partial<PreinscricaoPii> & { fin?: DadosFinPreinscricao }) {
  const pack = writePreinscricaoPii({ ...prev, ...mudar, fin: { ...prev.fin, ...mudar.fin } });
  await escrita.gravarPiiDoPedido(db, leadId, pack);
}

export async function gravarMoradaFin(db: Db, leadId: number, d: MoradaFin) {
  const lead = await leadAberto(db, leadId);
  const concelhos = await nomesPublicos(db, "concelhos");
  falhar(validarMoradaFin(d, concelhos));
  const m = normalizarMoradaFin(d);
  const prev = readPreinscricaoPii(lead);
  await db.tx(async q => {
    await escrita.gravarPiiDoPedido(q, leadId, writePreinscricaoPii({
      ...prev, moradaFiscal: m.morada, codigoPostal: m.codigoPostal, fin: { ...prev.fin, localidade: m.localidade },
    }));
    await escrita.gravarConcelho(q, leadId, m.concelho);
  });
  await logLeadEvent(db, leadId, undefined, "campo", "Morada indicada na ligação", "Morada, localidade, código postal e concelho.");
  return { ok: true as const };
}

export async function gravarIdentificacaoFin(db: Db, leadId: number, d: IdentificacaoFinForm) {
  const lead = await leadAberto(db, leadId);
  const prev = readPreinscricaoPii(lead);
  const guardados = sensiveisGuardados(prev);
  const sit = situacaoEmpregoFin(d.situacaoEmprego);
  // Independente sem NIF próprio indicado à parte: o NIF de trabalhador independente é o seu.
  const entrada = sit?.pedeNifEntidade === "independente" && !d.nifEntidadeEmpregadora.trim() && !guardados.includes("nifEntidadeEmpregadora")
    ? { ...d, nifEntidadeEmpregadora: d.nif.trim() || prev.nif || "" }
    : d;
  falhar(validarIdentificacaoFin(entrada, hojeLisboa(), guardados));
  const n = normalizarIdentificacaoFin(entrada);
  const manter = (novo: string, antigo: string | undefined) => novo || antigo || "";
  const prevFin = prev.fin ?? {};
  // Mudar de documento sem reescrever o número não faz sentido (o número é do outro documento).
  if (n.tipoDocumento !== prevFin.tipoDocumento && !n.numeroDocumento && prevFin.numeroDocumento) {
    falhar({ numeroDocumento: "Indique o número do novo documento." });
  }
  await gravarPacote(db, leadId, prev, {
    nif: manter(n.nif, prev.nif),
    fin: {
      tipoDocumento: n.tipoDocumento,
      numeroDocumento: manter(n.numeroDocumento, prevFin.numeroDocumento),
      validadeDocumento: n.validadeDocumento,
      niss: manter(n.niss, prevFin.niss),
      iban: manter(n.iban, prevFin.iban),
      situacaoEmprego: n.situacaoEmprego,
      situacaoEmpregoEntrada: sit?.valor ?? "",
      nifEntidadeEmpregadora: sit?.pedeNifEntidade ? manter(n.nifEntidadeEmpregadora, prevFin.nifEntidadeEmpregadora) : "",
    },
  });
  await logLeadEvent(db, leadId, undefined, "campo", "Identificação indicada na ligação",
    "Documento, validade, NIF, NISS, IBAN e situação face ao emprego (cifrados).");
  return { ok: true as const };
}

export async function aceitarTermosFin(db: Db, leadId: number, d: { termos: boolean; dados: boolean }, meta: { ip?: string } = {}) {
  const lead = await leadAberto(db, leadId);
  falhar({
    termos: d.termos ? undefined : "Para continuar, aceite os termos e condições.",
    dados: d.dados ? undefined : "Para continuar, autorize o uso dos dados pessoais para a inscrição e o financiamento.",
  });
  const pii = readPreinscricaoPii(lead);
  if (!moradaGuardada(pii, lead) || !identificacaoCompleta(pii)) throw new DadosFinErro("Complete primeiro a morada e a identificação.");
  const ip = (meta.ip ?? "").slice(0, 64);
  await escrita.gravarTermosFin(db, leadId, ip, TERMOS_FIN_VERSAO);
  await logLeadEvent(db, leadId, undefined, "campo", "Termos e uso dos dados aceites", `Versão ${TERMOS_FIN_VERSAO}${ip ? ` · IP ${ip}` : ""}`);
  return { ok: true as const };
}
