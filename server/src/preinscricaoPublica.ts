import { firePreinscricaoEmail, herdarDocsValidados } from "./docsLink.js";
import { dentroDoLimite } from "./limitePedidos.js";
import { fechoDaLigacao, regenerarToken } from "./ligacaoPessoal.js";
import { gravarTurmaEscolhida } from "./repos/percurso.js";
import { precoParaOferta } from "./precoOferta.js";
import { findDuplicados, logLeadEvent } from "./crmDossier.js";
import type { Db } from "./db/pool.js";
import { newPublicId, nextOpsId } from "./ops.js";
import { opaqueRef } from "./fieldCrypto.js";
import { readPreinscricaoPii, writePreinscricaoPii, type DadosFinPreinscricao } from "./pii.js";
import {
  HABILITACOES_FIN, erroTelefoneFin, partirNomeCompleto, validarInscricaoFin, type InscricaoFin,
} from "../../src/partilhado/dadosPessoaisFin.js";
import { resolverTurmaOferta } from "./ofertaGold.js";
import { isEmail, normalizeEmail, sanitizeHeader, textoDePessoa } from "./security.js";
import { campanhaDoPedido, origemDaLista } from "./leadOpcoes.js";
import * as leads from "./repos/leads.js";
import * as escrita from "./repos/leadsEscrita.js";
import { carimboUtc, hojeLisboa } from "./datas.js";
import { LISTA_PAISES } from "../../src/partilhado/execucaoFisica.js";

async function metodoPagamentoConhecido(db: Db, nome: string) {
  return Boolean(await leads.opcaoDaLista(db, "metodos_pagamento", nome));
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
  /** Financiada: nome completo, género, data de nascimento, nacionalidade e habilitações (ignorados num curso Gold). */
  dadosFin?: InscricaoFin;
};

/** Os dados da financiada como ficam no pacote cifrado da pré-inscrição. */
function inscricaoParaPacote(d: InscricaoFin): DadosFinPreinscricao {
  return {
    genero: d.genero,
    dataNascimento: d.dataNascimento,
    nacionalidade: d.nacionalidade,
    habilitacoes: d.habilitacoes,
    habilitacoesEntrada: HABILITACOES_FIN.find(h => h.rotulo === d.habilitacoes)?.valor ?? "",
  };
}

/** Curso activo da oferta com este nome. Devolve o nome canónico e o preço base (Gold). */
async function cursoDaOferta(db: Db, regime: "gold" | "fin", nome: string) {
  if (!nome.trim()) return null;
  return escrita.cursoActivoDaOferta(db, regime, nome);
}

/**
 * Preço que a pré-inscrição pública grava para este curso, local e horário (o mesmo que o site mostra).
 * Só a formação Gold da oferta tem preço; fora da oferta ou financiada, null.
 */
export async function precoDaPreinscricaoPublica(db: Db, cursoNome: string, local: string, horario: string) {
  const oferta = await cursoDaOferta(db, "gold", sanitizeHeader(cursoNome));
  if (!oferta) return null;
  return (await precoParaOferta(db, oferta.nome, sanitizeHeader(local), sanitizeHeader(horario))) ?? oferta.preco;
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

/** O que o histórico da ficha diz dos dados pessoais da financiada: os nomes dos campos, nunca os valores. */
const CAMPOS_DADOS_FIN = "Género, data de nascimento, nacionalidade e habilitações (cifrados).";

/** Pedidos do formulário público contados na base de dados: por IP e por email, por hora. */
export const PREINSCRICOES_POR_IP = 30;
export const PREINSCRICOES_POR_EMAIL = 6;

/** Curso dos pedidos fora da oferta: o texto livre do formulário nunca vai para os emails, só para as notas da ficha. */
export const CURSO_CONTACTO = "Contacto pelo site";

/** A mesma resposta para pedido novo e repetido: o formulário não revela quem já tem pré-inscrição. */
export const AVISO_PREINSCRICAO = "Recebemos o seu pedido. Vai receber no seu email a ligação pessoal para continuar.";

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
  if (meta.ip && !(await dentroDoLimite(db, "preinscricao-ip", meta.ip, PREINSCRICOES_POR_IP, 3600))) {
    return { error: "demasiados pedidos: tente mais tarde" as const };
  }
  if (!(await dentroDoLimite(db, "preinscricao-email", email, PREINSCRICOES_POR_EMAIL, 3600))) {
    return { error: "demasiados pedidos: tente mais tarde" as const };
  }
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
  const curso = oferta?.nome ?? CURSO_CONTACTO;
  const notas = !oferta && pedidoCurso && pedidoCurso !== CURSO_CONTACTO ? `Pedido no site: ${pedidoCurso}` : "";
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
  if (turma && turma.vagasLivres <= 0) return { error: "a turma escolhida já não tem vagas: escolha outra data" as const };
  // Financiada: o formulário do site manda os dados pessoais (validados aqui, com as regras do site); o nome da
  // ficha passa a ser o nome completo e o telemóvel é obrigatório. Sem eles (contacto pela assistente), fica como antes.
  let dadosFin: InscricaoFin | null = null;
  if (regime === "fin" && input.dadosFin) {
    const erros: Record<string, string> = { ...validarInscricaoFin(input.dadosFin, hojeLisboa(), LISTA_PAISES) };
    const erroTelf = erroTelefoneFin(input.telf || "");
    if (erroTelf) erros.telf = erroTelf;
    const primeiro = Object.values(erros)[0];
    if (primeiro) return { error: primeiro, campos: erros };
    dadosFin = { ...input.dadosFin, nomeCompleto: input.dadosFin.nomeCompleto.trim().replace(/\s+/g, " ") };
  }
  const nomes = dadosFin ? partirNomeCompleto(dadosFin.nomeCompleto) : { nome: input.nome, apelido: input.apelido || "" };
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

  const preco = oferta && regime === "gold"
    ? (await precoParaOferta(db, curso, local, horario)) ?? oferta.preco
    : 0;
  const id = await nextOpsId(db);
  const publicId = newPublicId();
  const finPack = dadosFin ? inscricaoParaPacote(dadosFin) : undefined;
  const piiPack = writePreinscricaoPii({ telf, fin: finPack });
  // Duplicado só quando há um pedido ABERTO do mesmo email para o MESMO curso. A verificação e a
  // inserção correm na mesma transacção, com o par email+curso trancado: um duplo clique não cria dois.
  const existente = await db.tx(async q => {
    await escrita.bloquearPedido(q, email, curso);
    const aberto = await escrita.pedidoAberto(q, email, curso);
    if (aberto) {
      // Pedido repetido com os dados pessoais: só entram se o pedido aberto ainda não os tem (nunca substituem).
      if (finPack && aberto.regime === "fin") {
        const linha = await escrita.piiDoPedido(q, aberto.id);
        const prev = linha ? readPreinscricaoPii(linha) : {};
        if (!prev.fin || !Object.keys(prev.fin).length) {
          await escrita.gravarPiiDoPedido(q, aberto.id, writePreinscricaoPii({ ...prev, fin: finPack }));
          return { ...aberto, dadosFinJuntos: true };
        }
      }
      return { ...aberto, dadosFinJuntos: false };
    }
    await escrita.inserirLead(q, {
      id, inscrito: carimboUtc(), nome: textoDePessoa(nomes.nome), apelido: textoDePessoa(nomes.apelido), email,
      telf: piiPack.telf || telf, inicioCurso: inicio, concelho: textoDePessoa(input.concelho || ""),
      local, curso, preco, estado: "Não contactado", campanha: campanha.campanha, campanhaId: campanha.campanhaId,
      origem, entrada: "preinscricao", meioContacto: meio, horario, turmaId, pagamentoMetodo: metodo, regime,
      piiEnc: piiPack.pii_enc ?? "", publicId,
      consentimento: input.consentimento === true ? { ip: (meta.ip ?? "").slice(0, 64), versao: consent.versao } : null,
      notas,
    });
    return null;
  });
  if (existente) {
    // O pedido repetido conta como recente (aparece no topo da lista) com o local, horário e turma escolhidos agora.
    const anterior = await escrita.renovarPedido(db, existente.id, { inscrito: carimboUtc(), local, horario, inicioCurso: inicio });
    if (turma) await gravarTurmaEscolhida(db, existente.id, { id: turma.turmaId, local, horario, dataInicio: turma.dataInicio, preco });
    await logLeadEvent(db, existente.id, undefined, "campo", "Pedido repetido no site",
      [notas, /^\d{4}-\d{2}-\d{2}/.test(anterior) ? `Primeiro pedido: ${anterior.slice(0, 10).split("-").reverse().join("-")}` : "", [local, horario, inicio !== "-" ? inicio : ""].filter(Boolean).join(" · ")].filter(Boolean).join(" · "));
    // Só os nomes dos campos: os valores nunca vão para o histórico.
    if (existente.dadosFinJuntos) await logLeadEvent(db, existente.id, undefined, "campo", "Dados pessoais recebidos no site", CAMPOS_DADOS_FIN);
    const ultimo = existente.ligacao_reenviada_em ? new Date(String(existente.ligacao_reenviada_em)).getTime() : 0;
    if (Date.now() - ultimo > MINUTOS_REENVIO * 60_000) {
      // Ligação expirada (90 dias sem uso, sem documentos pendentes): reenviá-la igual mandava uma ligação que já não abre.
      if (await fechoDaLigacao(db, existente) === "expirada") await regenerarToken(db, existente.id);
      await firePreinscricaoEmail(db, {
        id: existente.id, email, nome: existente.nome, apelido: existente.apelido, curso: existente.curso,
        regime: existente.regime === "fin" ? "fin" : "gold",
      }, "preinscricao.created", `preinscricao:${existente.id}:${email}:${Date.now()}`).catch(() => undefined);
      await escrita.marcarLigacaoReenviada(db, existente.id);
      await logLeadEvent(db, existente.id, undefined, "contacto", "Novo pedido no site · ligação reenviada", origem);
    }
    return {
      duplicado: true as const,
      preinscricao: { id: existente.id, ref: opaqueRef("pre", existente.id, existente.public_id || null) },
      aviso: AVISO_PREINSCRICAO,
    };
  }

  // A turma escolhida no site (data e cronograma) fica como a turma do percurso: a ligação pessoal
  // já não volta a pedir o cronograma, salvo se a secretaria a der como cheia.
  if (turma) {
    await gravarTurmaEscolhida(db, id, { id: turma.turmaId, local, horario, dataInicio: turma.dataInicio, preco });
  }
  const detalhe = [origem, curso, local, horario, inicio !== "-" ? inicio : ""].filter(Boolean).join(" · ");
  await logLeadEvent(db, id, undefined, "criacao", "Pré-inscrição recebida", detalhe);
  // Documentos que esta pessoa já tem validados noutra pré-inscrição ficam logo guardados (não se voltam a pedir).
  await herdarDocsValidados(db, id).catch(() => 0);
  if (dadosFin) await logLeadEvent(db, id, undefined, "campo", "Dados pessoais recebidos no site", CAMPOS_DADOS_FIN);
  if (!oferta) await logLeadEvent(db, id, undefined, "campo", "Curso fora da oferta", `Pedido: ${pedidoCurso || "sem curso"}. Sem pedido de pagamento.`);
  const outros = await findDuplicados(db, email, telf, id).catch(() => []);
  if (Array.isArray(outros) && outros.length) {
    await logLeadEvent(db, id, undefined, "campo", "Possível duplicado", `Outros pedidos com o mesmo contacto: ${outros.map(o => `#${(o as { id: number }).id}`).join(", ")}`);
  }
  await firePreinscricaoEmail(db, { id, email, nome: nomes.nome, apelido: nomes.apelido, curso, regime }, "preinscricao.created", `preinscricao:${id}:${email}`).catch(() => undefined);
  return {
    duplicado: false as const,
    preinscricao: { id, ref: opaqueRef("pre", id, publicId) },
    aviso: AVISO_PREINSCRICAO,
  };
}
