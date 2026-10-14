import { firePreinscricaoEmail } from "./docsLink.js";
import { precoParaOferta } from "./precoOferta.js";
import { findDuplicados, logLeadEvent } from "./crmDossier.js";
import type { Db } from "./db/pool.js";
import { newPublicId, nextOpsId } from "./ops.js";
import { opaqueRef } from "./fieldCrypto.js";
import { writePreinscricaoPii } from "./pii.js";
import { resolverTurmaOferta } from "./ofertaGold.js";
import { isEmail, normalizeEmail, sanitizeHeader, textoDePessoa } from "./security.js";
import { campanhaDoPedido, origemDaLista } from "./leadOpcoes.js";
import * as leads from "./repos/leads.js";
import * as escrita from "./repos/leadsEscrita.js";

async function metodoPagamentoConhecido(db: Db, nome: string) {
  return Boolean(await leads.opcaoDaLista(db, "metodos_pagamento", nome));
}

function nowStamp() {
  return new Date().toISOString().slice(0, 16).replace("T", " ");
}

export type PreinscricaoPublicaInput = {
  nome: string;
  apelido?: string;
  email: string;
  telf?: string;
  concelho?: string;
  origem?: string;
  curso?: string;
  local?: string;
  inicioCurso?: string;
  horario?: string;
  turmaId?: number;
  campanha?: string;
  campanhaId?: number;
  meioContacto?: string;
  pagamentoMetodo?: string;
  acessoImediato?: boolean;
  regime?: "gold" | "fin";
  /** Aceitação da política de privacidade no formulário (RGPD). */
  consentimento?: boolean;
};

/** Curso activo da oferta com este nome. Devolve o nome canónico e o preço base (Gold). */
async function cursoDaOferta(db: Db, regime: "gold" | "fin", nome: string) {
  if (!nome.trim()) return null;
  return escrita.cursoActivoDaOferta(db, regime, nome);
}

/** O consentimento passa a obrigatório quando o administrador o activa (Sistema → Site). */
async function regrasConsentimento(db: Db) {
  const v = await escrita.valoresSettings(db, "site");
  return {
    exigir: ["1", "true", "sim"].includes(String(v.rgpdObrigatorio ?? "").trim().toLowerCase()),
    versao: String(v.rgpdVersao ?? "").trim().slice(0, 40) || "1",
  };
}

/** Texto do consentimento e endereço da política de privacidade (Sistema → Site), para canais sem formulário. */
export async function politicaPrivacidade(db: Db) {
  const v = await escrita.valoresSettings(db, "site");
  return {
    texto: String(v.rgpdTexto ?? "").trim(),
    url: String(v.rodapePrivacidadeUrl ?? "").trim(),
  };
}

const MINUTOS_REENVIO = 10;

/**
 * Pré-inscrição vinda do site. A resposta nunca devolve dados da ficha: só a referência opaca e o aviso.
 * O preço vem sempre da oferta (nunca do pedido). Um curso fora da oferta fica como contacto, sem pedido de pagamento.
 */
export async function criarPreinscricaoPublica(
  db: Db,
  input: PreinscricaoPublicaInput,
  meta: { ip?: string } = {},
) {
  const email = normalizeEmail(input.email);
  if (!isEmail(email)) return { error: "email inválido" as const };
  const consent = await regrasConsentimento(db);
  if (consent.exigir && input.consentimento !== true) {
    return { error: "aceite a política de privacidade" as const };
  }
  // O regime vem do catálogo onde o curso existe, não do navegador: um curso financiado vai sempre
  // para as pré-inscrições financiadas e um Gold para as Gold. O regime enviado só desempata nomes repetidos.
  const pedidoCurso = sanitizeHeader(input.curso || "");
  const preferido = input.regime === "fin" ? "fin" : "gold";
  const outro = preferido === "fin" ? "gold" : "fin";
  const noPreferido = await cursoDaOferta(db, preferido, pedidoCurso);
  const noOutro = noPreferido ? null : await cursoDaOferta(db, outro, pedidoCurso);
  const regime = noOutro ? outro : preferido;
  const oferta = noPreferido ?? noOutro;
  const curso = oferta?.nome ?? (pedidoCurso || "Contacto pelo site");
  const origem = await origemDaLista(db, sanitizeHeader(input.origem || ""), "Website");
  const campanha = await campanhaDoPedido(db, { campanhaId: input.campanhaId, campanha: sanitizeHeader(input.campanha || "") });
  const meio = sanitizeHeader(input.meioContacto || origem);
  const telf = sanitizeHeader(input.telf || "");
  // Financiada: a turma é atribuída pela secretaria; o local e o horário ficam só como preferência.
  const turma = oferta && regime === "gold"
    ? await resolverTurmaOferta(db, {
      turmaId: input.turmaId,
      curso,
      local: input.local,
      horario: input.horario,
      dataInicio: input.inicioCurso,
      regime,
    })
    : null;
  if (regime === "gold" && input.turmaId && !turma) return { error: "a turma escolhida já não está libertada" as const };
  const acessoImediato = Boolean(input.acessoImediato) && !turma;
  const local = sanitizeHeader(turma?.local || input.local || (acessoImediato ? "Online" : ""));
  const horario = sanitizeHeader(turma?.horario || input.horario || "");
  const pedidoInicio = input.inicioCurso && input.inicioCurso !== "-" ? input.inicioCurso : "";
  const inicio = turma?.dataInicio || pedidoInicio || (acessoImediato ? "Acesso imediato" : "A confirmar");
  const turmaId = turma?.turmaId ?? null;
  const metodo = sanitizeHeader(input.pagamentoMetodo || "");
  if (metodo && !(await metodoPagamentoConhecido(db, metodo))) {
    return { error: "forma de pagamento desconhecida" as const };
  }

  // Duplicado só quando há um pedido ABERTO do mesmo email para o MESMO curso.
  const existente = await escrita.pedidoAberto(db, email, curso);
  if (existente) {
    const ultimo = existente.ligacao_reenviada_em ? new Date(String(existente.ligacao_reenviada_em)).getTime() : 0;
    if (Date.now() - ultimo > MINUTOS_REENVIO * 60_000) {
      await firePreinscricaoEmail(db, {
        id: existente.id, email, nome: existente.nome, apelido: existente.apelido, curso: existente.curso,
      }, "preinscricao.created", `preinscricao:${existente.id}:${email}:${Date.now()}`).catch(() => undefined);
      await escrita.marcarLigacaoReenviada(db, existente.id);
      await logLeadEvent(db, existente.id, undefined, "contacto", "Novo pedido no site · ligação reenviada", origem);
    }
    return {
      duplicado: true as const,
      preinscricao: { id: existente.id, ref: opaqueRef("pre", existente.id, existente.public_id || null) },
      aviso: "Já temos o seu pedido para este curso. Reenviámos para o seu email a ligação pessoal para continuar.",
    };
  }

  const preco = oferta && regime === "gold"
    ? (await precoParaOferta(db, curso, local, horario)) ?? oferta.preco
    : 0;
  const id = await nextOpsId(db);
  const publicId = newPublicId();
  const piiPack = writePreinscricaoPii({ telf });
  await escrita.inserirLead(db, {
    id, inscrito: nowStamp(), nome: textoDePessoa(input.nome), apelido: textoDePessoa(input.apelido || ""), email,
    telf: piiPack.telf || telf, inicioCurso: inicio, concelho: textoDePessoa(input.concelho || ""),
    local, curso, preco, estado: "Não contactado", campanha: campanha.campanha, campanhaId: campanha.campanhaId,
    origem, entrada: "preinscricao", meioContacto: meio, horario, turmaId, pagamentoMetodo: metodo, regime,
    piiEnc: piiPack.pii_enc ?? "", publicId,
    consentimento: input.consentimento === true ? { ip: (meta.ip ?? "").slice(0, 64), versao: consent.versao } : null,
  });
  const detalhe = [origem, curso, local, horario, inicio !== "-" ? inicio : ""].filter(Boolean).join(" · ");
  await logLeadEvent(db, id, undefined, "criacao", "Pré-inscrição recebida", detalhe);
  if (!oferta) await logLeadEvent(db, id, undefined, "campo", "Curso fora da oferta", `Pedido: ${pedidoCurso || "sem curso"}. Sem pedido de pagamento.`);
  const outros = await findDuplicados(db, email, telf, id).catch(() => []);
  if (Array.isArray(outros) && outros.length) {
    await logLeadEvent(db, id, undefined, "campo", "Possível duplicado", `Outros pedidos com o mesmo contacto: ${outros.map(o => `#${(o as { id: number }).id}`).join(", ")}`);
  }
  await firePreinscricaoEmail(db, { id, email, nome: input.nome, apelido: input.apelido, curso, regime }, "preinscricao.created", `preinscricao:${id}:${email}`).catch(() => undefined);
  return {
    duplicado: false as const,
    preinscricao: { id, ref: opaqueRef("pre", id, publicId) },
    aviso: "Enviámos um email com a ligação para submeter os documentos do curso.",
  };
}
