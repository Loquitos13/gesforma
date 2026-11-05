/** Assistente de WhatsApp: conversa por passos (menu, pré-inscrição, consulta do pedido). */
import { logLeadEvent } from "./crmDossier.js";
import type { Db } from "./db/pool.js";
import { mapPreinscricao } from "./ops.js";
import { criarPreinscricaoPublica, politicaPrivacidade } from "./preinscricaoPublica.js";
import { listarCatalogoPublico } from "./catalogoPublico.js";
import { config } from "./config.js";
import {
  filtrarOferta, fmtDataPt, listCursosGoldActivos, listCursosOferta, listOfertaFin, listOfertaGold, uniqueOferta, type OfertaTurma,
} from "./ofertaGold.js";
import { isEmail, normalizeEmail, sanitizeHeader, sanitizeText } from "./security.js";
import { avisarPedidoWhatsapp } from "./avisosEquipa.js";
import { reabrirConversaWhatsapp } from "./whatsappInatividade.js";
import { lerAssistente, TEXTOS_PADRAO, type Assistente, type AcaoMenu, type ItemMenu } from "./whatsappAssistente.js";
import {
  emAtendimento, gravarNomePerfilWhatsapp, gravarSessaoWhatsapp, leadsPorTelefoneWhatsapp, libertarHumanoWhatsapp,
  entradasWhatsapp, marcarConversaIniciadaWhatsapp, pedirHumanoWhatsapp, registarEntradaWhatsapp, registarMensagemWhatsapp, sessaoWhatsapp,
} from "./repos/whatsapp.js";

type Passo =
  | "menu" | "regime" | "regimeLista" | "cursoSite" | "nome" | "apelido" | "email" | "concelho" | "curso" | "local" | "localFin" | "horario" | "data"
  | "consentimento";

type Dados = {
  /** Gold (pago, com turma) ou Financiada (a turma é atribuída pela coordenação). */
  regime?: "gold" | "fin";
  /** Lista de cursos mostrada (opção 3): o regime, para a escolha do curso dar a página certa. */
  listaRegime?: "gold" | "fin";
  /** Curso visto na lista (opção 3): a pré-inscrição a seguir já não pergunta o regime nem o curso. */
  cursoInteresse?: string;
  nome?: string;
  apelido?: string;
  email?: string;
  concelho?: string;
  curso?: string;
  local?: string;
  horario?: string;
  dataInicio?: string;
  turmaId?: number;
};

/** Uma opção de resposta: botão (até 3) ou linha de lista (até 10) no WhatsApp. O `id` é o que volta quando se toca. */
export type Opcao = { id: string; titulo: string; descricao?: string };
/**
 * Mensagem do bot: texto simples ou texto com opções (botões ou lista no WhatsApp). `simples` é a mesma mensagem só em
 * texto (opções numeradas): o que fica no histórico, no simulador e o que sai quando as opções não cabem em botões/lista.
 */
export type Resposta = string | { texto: string; opcoes: Opcao[]; simples: string; botao?: string; rodape?: string };

export function textoDaResposta(r: Resposta) {
  return typeof r === "string" ? r : r.simples;
}

/** Opções visíveis do menu, pela ordem configurada: o número (e o id do botão) é a posição. */
function opcoesVisiveis(a: Assistente) {
  return a.menu.filter(i => i.ativo);
}

/** Número com que a pessoa escolhe uma acção no menu, ou 0 se está escondida. */
function numeroDe(a: Assistente, acao: AcaoMenu) {
  return opcoesVisiveis(a).findIndex(i => i.acao === acao) + 1;
}

function menuDe(a: Assistente): Resposta {
  const itens = opcoesVisiveis(a);
  return {
    texto: a.textos.boasVindas,
    opcoes: itens.map((i, n) => ({ id: String(n + 1), titulo: i.titulo, ...(i.descricao ? { descricao: i.descricao } : {}) })),
    botao: "Ver opções",
    rodape: "Escreva *menu* para voltar aqui.",
    simples: [
      a.textos.boasVindas,
      ...itens.map((i, n) => `${n + 1} · ${i.titulo}${i.descricao ? ` (${i.descricao})` : ""}`),
      "Escreva o número ou *menu* para voltar aqui.",
    ].join("\n"),
  };
}

/** A opção do menu escolhida: pelo número, pelo nome tocado ou por palavras (só as visíveis). */
function escolhaDoMenu(a: Assistente, text: string): ItemMenu | null {
  const itens = opcoesVisiveis(a);
  const n = Number(text);
  if (Number.isInteger(n) && n >= 1 && n <= itens.length) return itens[n - 1]!;
  const q = text.trim().toLowerCase();
  const porNome = itens.find(i => i.titulo.toLowerCase() === q);
  if (porNome) return porNome;
  const tem = (acao: AcaoMenu) => itens.find(i => i.acao === acao) ?? null;
  if (/pr[eé]-?inscri/i.test(text) || /^inscrever/i.test(text)) return tem("preinscricao");
  if (/estado|pedido|inscri/i.test(text)) return tem("estado");
  if (/curso/i.test(text)) return tem("cursos");
  return null;
}

export function digitsPhone(raw: string) {
  const d = raw.replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("351") && d.length >= 12) return d.slice(0, 15);
  if (d.length === 9) return `351${d}`;
  return d.slice(0, 15);
}

function last9(raw: string) {
  const d = raw.replace(/\D/g, "");
  return d.slice(-9);
}

function parseDados(raw: unknown): Dados {
  if (raw && typeof raw === "object") return raw as Dados;
  if (typeof raw === "string") {
    try { return JSON.parse(raw) as Dados; } catch { return {}; }
  }
  return {};
}

/** Página do curso no site (onde estão os locais, horários e preços), ou "" se o curso não está no catálogo. */
async function paginaDoCurso(db: Db, regime: "gold" | "fin", curso: string) {
  const chave = curso.trim().toLowerCase();
  const c = (await listarCatalogoPublico(db)).cursos.find(x => x.regime === regime && x.titulo.trim().toLowerCase() === chave);
  return c ? `${config.appOrigin.replace(/\/$/, "")}/formacao/${c.id}` : "";
}

/** Nomes da lista de cursos da opção 3 (sem preços: o preço depende do local e do horário). */
async function nomesDaLista(db: Db, regime: "gold" | "fin") {
  return regime === "gold" ? (await cursosActivos(db)).map(c => c.nome) : cursosFin(db);
}

async function cursosActivos(db: Db) {
  return listCursosGoldActivos(db);
}

/** Cursos da Financiada visíveis no site (os mesmos do catálogo). */
async function cursosFin(db: Db) {
  return (await listCursosOferta(db)).filter(c => c.regime === "fin").map(c => c.nome);
}

/** Locais de um curso da Financiada: os da ficha do curso e os das turmas abertas. */
async function locaisFin(db: Db, curso: string) {
  const chave = curso.trim().toLowerCase();
  const doCatalogo = (await listarCatalogoPublico(db)).cursos
    .find(c => c.regime === "fin" && c.titulo.trim().toLowerCase() === chave)?.locais.map(l => l.nome) ?? [];
  const dasTurmas = uniqueOferta(filtrarOferta(await listOfertaFin(db), { curso }), "local");
  return [...new Set([...doCatalogo, ...dasTurmas].filter(l => l.trim()))];
}

/** Gold ou Financiada, antes de listar cursos. */
const ESCOLHA_REGIME = (titulo: string): Resposta => ({
  texto: titulo,
  opcoes: [
    { id: "gold", titulo: "Formação Gold", descricao: "Cursos pagos, com turmas e datas marcadas" },
    { id: "fin", titulo: "Formação Financiada", descricao: "Gratuita para quem cumpre os requisitos" },
  ],
  simples: [titulo, "1 · Formação Gold (cursos pagos, com turmas e datas marcadas)", "2 · Formação Financiada (gratuita para quem cumpre os requisitos)", "", "Responda com o número."].join("\n"),
});

function lerRegime(t: string): "gold" | "fin" | null {
  const q = t.trim().toLowerCase();
  if (q === "1" || q === "gold" || /\bgold\b/.test(q)) return "gold";
  if (q === "2" || q === "fin" || /financ/.test(q)) return "fin";
  return null;
}

/** Regime escrito por extenso na mensagem («quero a financiada»); os números não contam (são opções do menu). */
function regimeNoTexto(t: string): "gold" | "fin" | null {
  if (/\bgold\b/i.test(t)) return "gold";
  if (/financ/i.test(t)) return "fin";
  return null;
}

function pickOpcao(text: string, opcoes: string[]) {
  const n = Number(text);
  if (Number.isInteger(n) && n >= 1 && n <= opcoes.length) return opcoes[n - 1] ?? null;
  const q = text.toLowerCase();
  return opcoes.find(o => o.toLowerCase() === q)
    ?? opcoes.find(o => o.toLowerCase().includes(q) || q.includes(o.toLowerCase().slice(0, 10)))
    ?? null;
}

/** Escolha entre opções: no WhatsApp sai em botões ou lista; em texto, numerada. */
function listaNumerada(titulo: string, items: string[], extra = ""): Resposta {
  if (!items.length) return extra || "Não há opções libertadas. Escreva *menu*.";
  return {
    texto: titulo,
    opcoes: items.map((c, i) => ({ id: String(i + 1), titulo: c })),
    botao: "Escolher",
    simples: listaTexto(titulo, items),
  };
}

/** Lista só para ler (sem escolha). */
function listaTexto(titulo: string, items: string[]) {
  if (!items.length) return "Não há opções libertadas. Escreva *menu*.";
  return [titulo, ...items.map((c, i) => `${i + 1}. ${c}`), "", "Responda com o número."].join("\n");
}

async function leadsPorTelefone(db: Db, telefone: string) {
  const n9 = last9(telefone);
  if (n9.length < 9) return [];
  const rows = await leadsPorTelefoneWhatsapp(db, telefone, n9);
  return rows.map(r => mapPreinscricao(r));
}

async function getSessao(db: Db, telefone: string) {
  const r = await sessaoWhatsapp(db, telefone);
  return {
    passo: (r?.passo ?? "menu") as Passo,
    dados: parseDados(r?.dados),
    leadId: r?.lead_id ?? null,
    // Atendimento por uma pessoa: o bot não responde até a conversa voltar ao assistente (ou o pedido caducar sem resposta).
    humano: emAtendimento(r),
  };
}

/** A pessoa quer falar com alguém da equipa (opção 4 ou a frase da página: «falar com um operador»). */
function querPessoa(t: string) {
  return /\b(operador|operadora|humano|atendente|assistente humano|pessoa real)\b|falar com (algu[eé]m|uma pessoa|a equipa|um colaborador)/i.test(t);
}

export const RESPOSTA_HUMANO = `${TEXTOS_PADRAO.falarEquipa}\nPara voltar ao assistente automático, escreva *menu*.`;

function respostaHumano(a: Assistente): Resposta {
  return {
    texto: a.textos.falarEquipa,
    opcoes: [{ id: "menu", titulo: "Voltar ao assistente" }],
    simples: `${a.textos.falarEquipa}\nPara voltar ao assistente automático, escreva *menu*.`,
  };
}

async function saveSessao(db: Db, telefone: string, passo: Passo, dados: Dados, leadId: number | null) {
  await gravarSessaoWhatsapp(db, telefone, passo, dados, leadId);
}

async function logMsg(db: Db, telefone: string, direccao: "in" | "out", corpo: string, wamid?: string) {
  try {
    await registarMensagemWhatsapp(db, telefone, direccao, corpo, wamid);
  } catch {
    /* wamid duplicado */
  }
}

/** Pergunta de consentimento (RGPD) antes de gravar a pré-inscrição: o mesmo texto e a mesma política do formulário do site. */
async function pedidoConsentimento(db: Db): Promise<Resposta> {
  const { texto, url } = await politicaPrivacidade(db);
  const base = texto || "Aceita que a ENA trate os seus dados para gerir esta pré-inscrição e o contactar sobre a formação?";
  return {
    texto: [base, url ? `Política de privacidade: ${url}` : ""].filter(Boolean).join("\n"),
    opcoes: [{ id: "sim", titulo: "Sim, aceito" }, { id: "não", titulo: "Não" }],
    simples: [base, url ? `Política de privacidade: ${url}` : "", "Responda *sim* para aceitar ou *não* para cancelar."].filter(Boolean).join("\n"),
  };
}

function isMenuCmd(t: string) {
  return /^(menu|olá|ola|oi|bom dia|boa tarde|boa noite|inicio|início|start|hi|hello)$/i.test(t);
}

/**
 * Uma mensagem recebida. `rotulo` é o texto do botão ou da linha da lista tocada (o `textRaw` é então o id da opção):
 * fica no histórico em vez do id.
 */
export async function handleWhatsappText(
  db: Db, telefoneRaw: string, textRaw: string, wamid = "", nomePerfil = "", rotulo = "", anexoId?: number,
) {
  const telefone = digitsPhone(telefoneRaw);
  const text = sanitizeText(textRaw, 500).trim();
  const replies: string[] = [];
  const mensagens: Resposta[] = [];

  if (!telefone || !text) {
    const r = "Não percebi. Escreva *menu* para recomeçar.";
    return { replies: [r], mensagens: [r] as Resposta[], telefone };
  }
  const corpoEntrada = sanitizeText(rotulo, 500).trim() || text;
  // Com id da Meta, o registo é também a reserva: a mesma mensagem entregue duas vezes só tem uma resposta.
  if (wamid) {
    if (!(await registarEntradaWhatsapp(db, telefone, corpoEntrada, wamid, anexoId))) return { replies: [], mensagens, telefone, duplicado: true };
  } else {
    await logMsg(db, telefone, "in", corpoEntrada);
  }
  // Conversa fechada e a pessoa voltou a escrever: reabre com o assistente (o histórico fica). Primeira mensagem de
  // sempre: conversa nova. As duas dão o alerta «nova conversa» no GesForma.
  const reaberta = await reabrirConversaWhatsapp(db, telefone);
  if (!reaberta && (await entradasWhatsapp(db, telefone)) === 1) await marcarConversaIniciadaWhatsapp(db, telefone);
  const perfil = sanitizeHeader(nomePerfil).slice(0, 120);
  if (perfil) await gravarNomePerfilWhatsapp(db, telefone, perfil).catch(() => undefined);
  const sess = await getSessao(db, telefone);
  const ass = await lerAssistente(db);
  const MENU = menuDe(ass);
  const nEquipa = numeroDe(ass, "equipa");
  const nPre = numeroDe(ass, "preinscricao");
  let passo = sess.passo;
  let dados = { ...sess.dados };
  let leadId = sess.leadId;

  const say = (m: Resposta) => { replies.push(textoDaResposta(m)); mensagens.push(m); };

  // Em atendimento por uma pessoa o bot fica calado; só *menu* devolve a conversa ao assistente.
  if (sess.humano) {
    if (!/^(menu|0)$/i.test(text)) {
      // A primeira mensagem depois do pedido é o assunto: é com ela que sai o aviso à equipa (uma vez por pedido).
      await avisarPedidoWhatsapp(db, telefone, corpoEntrada, perfil).catch(err => console.error("[whatsapp] aviso à equipa:", err));
      return { replies, mensagens, telefone, passo, leadId, humano: true };
    }
    await libertarHumanoWhatsapp(db, telefone);
    say(MENU);
    for (const r of replies) await logMsg(db, telefone, "out", r);
    return { replies, mensagens, telefone, passo: "menu" as Passo, leadId };
  }

  // Ficheiro enviado pela pessoa: fica na caixa de conversas para a equipa ver (e, se for o caso, guardar na ficha).
  if (anexoId) {
    say(`${ass.textos.ficheiro} ${nEquipa ? `Se quiser falar com uma pessoa, escreva *${nEquipa}*; para voltar ao início, escreva *menu*.` : "Para voltar ao início, escreva *menu*."}`);
    for (const r of replies) await logMsg(db, telefone, "out", r);
    return { replies, mensagens, telefone, passo, leadId };
  }

  const escolha = passo === "menu" || (passo as string) === "consulta" ? escolhaDoMenu(ass, text) : null;
  const pelaOpcao = escolha?.acao === "equipa";
  if (pelaOpcao || (nEquipa && querPessoa(text))) {
    await pedirHumanoWhatsapp(db, telefone);
    say(respostaHumano(ass));
    for (const r of replies) await logMsg(db, telefone, "out", r);
    const lead = (await leadsPorTelefone(db, telefone))[0];
    // Pedido escrito com o assunto (ex.: a frase do site, «… falar com um operador sobre o curso X»): o aviso sai já.
    // Pela opção 4, o assistente pede o assunto e o aviso espera por ele (ou sai sem ele, passados uns minutos).
    if (!pelaOpcao && text.length > 25) {
      await avisarPedidoWhatsapp(db, telefone, corpoEntrada, perfil).catch(err => console.error("[whatsapp] aviso à equipa:", err));
    }
    if (lead) await logLeadEvent(db, lead.id, undefined, "whatsapp", "Pediu para falar com a equipa no WhatsApp", corpoEntrada).catch(() => undefined);
    return { replies, mensagens, telefone, passo: "menu" as Passo, leadId: lead?.id ?? leadId, humano: true };
  }

  if (isMenuCmd(text) || text === "0") {
    passo = "menu";
    dados = {};
    say(MENU);
    await saveSessao(db, telefone, passo, dados, leadId);
    for (const r of replies) await logMsg(db, telefone, "out", r);
    return { replies, mensagens, telefone, passo, leadId };
  }

  /** Curso da Financiada escolhido: o local preferido, ou o consentimento se não houver locais. */
  const escolherCursoFin = async (curso: string) => {
    dados.curso = curso;
    dados.local = undefined;
    const locais = await locaisFin(db, curso);
    if (locais.length) {
      passo = "localFin";
      say(listaNumerada(`Onde prefere fazer ${curso}?`, locais));
    } else {
      passo = "consentimento";
      say(await pedidoConsentimento(db));
    }
  };
  /** Curso Gold escolhido: os locais das turmas abertas. */
  const escolherCursoGold = async (curso: string) => {
    dados.curso = curso;
    dados.local = undefined;
    dados.horario = undefined;
    dados.dataInicio = undefined;
    const locais = uniqueOferta(filtrarOferta(await listOfertaGold(db), { curso }), "local");
    if (!locais.length) {
      say(`Ainda não há turma liberada para *${curso}* (falta local + horário + data). Escolha outro curso ou escreva *menu*.`);
    } else {
      passo = "local";
      say(listaNumerada(`Local para ${curso}:`, locais));
    }
  };

  if (passo === "menu" || (passo as string) === "consulta") {
    if (escolha?.acao === "preinscricao") {
      // Regime já identificado na conversa (curso visto na lista ou escrito na mensagem): não se pergunta outra vez.
      const regime = dados.listaRegime ?? regimeNoTexto(text);
      const cursoInteresse = dados.listaRegime ? dados.cursoInteresse : undefined;
      dados = {};
      if (regime) {
        dados.regime = regime;
        if (cursoInteresse) dados.cursoInteresse = cursoInteresse;
        passo = "nome";
        say(`Vamos à pré-inscrição em ${regime === "gold" ? "Formação Gold" : "Formação Financiada"}${cursoInteresse ? ` (${cursoInteresse})` : ""}.\nQual é o *primeiro nome*?`);
      } else {
        passo = "regime";
        say(ESCOLHA_REGIME("Vamos à pré-inscrição. Que formação procura?"));
      }
    } else if (escolha?.acao === "estado") {
      const leads = await leadsPorTelefone(db, telefone);
      if (leads[0]) {
        leadId = leads[0].id;
        say(ass.textos.pedidoRegistado);
        passo = "menu";
      } else {
        passo = "menu";
        say(`${ass.textos.semPedido} ${nPre ? `Escreva *${nPre}* para se pré-inscrever ou contacte a secretaria.` : "Contacte a secretaria."}`);
      }
    } else if (escolha?.acao === "cursos") {
      const regime = regimeNoTexto(text);
      if (regime) {
        const nomes = await nomesDaLista(db, regime);
        say(listaNumerada(`${regime === "gold" ? "Cursos Gold" : "Cursos de Formação Financiada"}:\nEscolha um curso para ver a página dele no site (locais, horários e preços).`, nomes));
        dados = { listaRegime: regime };
        passo = nomes.length ? "cursoSite" : "menu";
      } else {
        passo = "regimeLista";
        say(ESCOLHA_REGIME("Que cursos quer ver?"));
      }
    } else if (escolha?.acao === "faq") {
      say(`${escolha.resposta ?? ""}\n\nEscreva *menu* para voltar às opções.`.trim());
    } else {
      say(MENU);
    }
  } else if (passo === "regime") {
    const regime = lerRegime(text);
    if (!regime) say(ESCOLHA_REGIME("Não percebi. Que formação procura?"));
    else {
      dados.regime = regime;
      passo = "nome";
      say("Qual é o *primeiro nome*?");
    }
  } else if (passo === "regimeLista") {
    const regime = lerRegime(text);
    if (!regime) say(ESCOLHA_REGIME("Não percebi. Que cursos quer ver?"));
    else {
      // Sem preços: depende do local e do horário. Escolher um curso dá a página dele no site.
      const nomes = await nomesDaLista(db, regime);
      say(listaNumerada(`${regime === "gold" ? "Cursos Gold" : "Cursos de Formação Financiada"}:\nEscolha um curso para ver a página dele no site (locais, horários e preços).`, nomes));
      dados.listaRegime = regime;
      passo = nomes.length ? "cursoSite" : "menu";
    }
  } else if (passo === "cursoSite") {
    const regime = dados.listaRegime ?? "gold";
    const nomes = await nomesDaLista(db, regime);
    const n = Number(text);
    const curso = Number.isInteger(n) && n >= 1 && n <= nomes.length ? nomes[n - 1]! : "";
    // O regime e o curso ficam: escrever o número da pré-inscrição a seguir já não os pergunta.
    dados = curso ? { listaRegime: regime, cursoInteresse: curso } : {};
    passo = "menu";
    if (!curso) say(MENU);
    else {
      const url = await paginaDoCurso(db, regime, curso);
      say([curso, url,
        regime === "gold" ? ass.textos.notaPreco : "",
        nPre ? `Para se pré-inscrever aqui, escreva *${nPre}*; para voltar ao início, *menu*.` : "Para voltar ao início, escreva *menu*."].filter(Boolean).join("\n\n"));
    }
  } else if (passo === "nome") {
    dados.nome = sanitizeHeader(text).slice(0, 80);
    if (!dados.nome) say("Indique o primeiro nome.");
    else {
      passo = "apelido";
      say("E o *apelido*?");
    }
  } else if (passo === "apelido") {
    dados.apelido = sanitizeHeader(text).slice(0, 80);
    passo = "email";
    say("Qual é o *email*? (é por aqui que a secretaria confirma o pedido)");
  } else if (passo === "email") {
    if (!isEmail(text)) say("Esse email não parece válido. Tente outra vez (ex.: nome@dominio.pt).");
    else {
      dados.email = normalizeEmail(text);
      passo = "concelho";
      say("Em que *concelho* vive?");
    }
  } else if (passo === "concelho") {
    dados.concelho = sanitizeHeader(text).slice(0, 80);
    passo = "curso";
    // Curso já escolhido na lista: segue para o local, sem a lista de cursos.
    const interesse = dados.cursoInteresse ?? "";
    const doInteresse = interesse
      ? (dados.regime === "fin" ? await cursosFin(db) : (await cursosActivos(db)).map(c => c.nome)).find(c => c.toLowerCase() === interesse.toLowerCase())
      : undefined;
    dados.cursoInteresse = undefined;
    if (doInteresse) {
      if (dados.regime === "fin") await escolherCursoFin(doInteresse);
      else await escolherCursoGold(doInteresse);
    } else if (dados.regime === "fin") {
      say(listaNumerada("Curso de Formação Financiada a que se quer pré-inscrever:", await cursosFin(db), "Neste momento não há cursos de Formação Financiada abertos. Escreva *menu*."));
      await saveSessao(db, telefone, passo, dados, leadId);
      for (const r of replies) await logMsg(db, telefone, "out", r);
      return { replies, mensagens, telefone, passo, leadId };
    } else {
      const cursos = await cursosActivos(db);
      say("Agora o *curso*. Depois escolhe o local, o horário e a data de início entre as turmas abertas.");
      say(listaNumerada("Curso a que se quer inscrever:", cursos.map(c => c.nome)));
    }
  } else if (passo === "curso" && dados.regime === "fin") {
    const cursos = await cursosFin(db);
    const curso = pickOpcao(text, cursos);
    if (!curso) say(listaNumerada("Não percebi o curso. Escolha um número:", cursos));
    else await escolherCursoFin(curso);
  } else if (passo === "localFin") {
    const locais = await locaisFin(db, dados.curso ?? "");
    const local = pickOpcao(text, locais);
    if (!local) say(listaNumerada("Não percebi o local. Escolha um número:", locais));
    else {
      dados.local = local;
      passo = "consentimento";
      say(await pedidoConsentimento(db));
    }
  } else if (passo === "consentimento" && dados.regime === "fin") {
    const resposta = text.trim().toLowerCase();
    if (/^(n|não|nao|2)$/.test(resposta)) {
      say("Sem a sua autorização não registamos a pré-inscrição. Escreva *menu* se mudar de ideias.");
      passo = "menu";
      dados = {};
    } else if (!/^(s|sim|aceito|1)$/.test(resposta)) {
      say("Responda *sim* para aceitar ou *não* para cancelar.");
    } else {
      // Financiada: a turma é atribuída pela coordenação; o local fica como preferência. Os dados pessoais pedem-se
      // depois, na ligação pessoal que segue por email.
      const created = await criarPreinscricaoPublica(db, {
        nome: dados.nome || "WhatsApp", apelido: dados.apelido || "", email: dados.email || "", telf: telefone,
        concelho: dados.concelho || "", curso: dados.curso || "", local: dados.local || "", regime: "fin",
        origem: "WhatsApp", meioContacto: "WhatsApp", consentimento: true,
      }, { ip: "WhatsApp" });
      if ("error" in created) {
        say(created.error === "email inválido" ? "O email ficou inválido. Escreva *menu* e recomece." : "Não foi possível registar a pré-inscrição. Escreva *menu* e tente outra vez.");
      } else {
        leadId = created.preinscricao.id;
        await logLeadEvent(db, leadId, undefined, "whatsapp", created.duplicado ? "Consulta WhatsApp" : "Pré-inscrição via WhatsApp", telefone);
        say(`${dados.curso}${dados.local ? `\nLocal preferido: ${dados.local}` : ""}\n${created.aviso}\n\n${ass.textos.fimFin}`);
      }
      passo = "menu";
      dados = {};
    }
  } else if (passo === "curso") {
    const cursos = await cursosActivos(db);
    await escolherCursoGold(pickOpcao(text, cursos.map(c => c.nome)) || sanitizeHeader(text).slice(0, 200));
  } else if (passo === "local") {
    const oferta = filtrarOferta(await listOfertaGold(db), { curso: dados.curso });
    const locais = uniqueOferta(oferta, "local");
    const local = pickOpcao(text, locais);
    if (!local) {
      say(listaNumerada("Não percebi o local. Escolha um número:", locais));
    } else {
      dados.local = local;
      dados.horario = undefined;
      dados.dataInicio = undefined;
      const horarios = uniqueOferta(filtrarOferta(oferta, { local }), "horario");
      if (!horarios.length) {
        say(`Neste local ainda não há horário liberado. Escreva *menu* ou escolha outro local.`);
      } else {
        passo = "horario";
        say(listaNumerada(`Horário em ${local}:`, horarios, "O horário depende do local e só aparece se a turma estiver activa."));
      }
    }
  } else if (passo === "horario") {
    const oferta = filtrarOferta(await listOfertaGold(db), { curso: dados.curso, local: dados.local });
    const horarios = uniqueOferta(oferta, "horario");
    const horario = pickOpcao(text, horarios);
    if (!horario) {
      say(listaNumerada("Não percebi o horário. Escolha um número:", horarios));
    } else {
      dados.horario = horario;
      const datas = oferta.filter(t => t.horario === horario);
      if (!datas.length) {
        say("Não há data de início libertada para este horário. Escreva *menu*.");
      } else {
        passo = "data";
        say(listaNumerada(
          `Data de início (${dados.local} · ${horario}):`,
          datas.map(t => `${fmtDataPt(t.dataInicio)}${(t.vagasMostradas ?? t.vagasLivres) ? ` · ${t.vagasMostradas ?? t.vagasLivres} vagas` : " · lotada"}`),
        ));
      }
    }
  } else if (passo === "data") {
    const oferta = filtrarOferta(await listOfertaGold(db), {
      curso: dados.curso, local: dados.local, horario: dados.horario,
    });
    const n = Number(text);
    const turma: OfertaTurma | undefined = (Number.isInteger(n) && n >= 1 && n <= oferta.length)
      ? oferta[n - 1]
      : oferta.find(t => t.dataInicio === text || fmtDataPt(t.dataInicio) === text);
    if (!turma) {
      say(listaNumerada("Escolha a data pelo número:", oferta.map(t => `${fmtDataPt(t.dataInicio)} · ${t.nome}`)));
    } else {
      dados.dataInicio = turma.dataInicio;
      dados.turmaId = turma.turmaId;
      passo = "consentimento";
      say(await pedidoConsentimento(db));
    }
  } else if (passo === "consentimento") {
    const resposta = text.trim().toLowerCase();
    const turma = (await listOfertaGold(db)).find(t => t.turmaId === dados.turmaId);
    if (/^(n|não|nao|2)$/.test(resposta)) {
      say("Sem a sua autorização não registamos a pré-inscrição. Escreva *menu* se mudar de ideias.");
      passo = "menu";
      dados = {};
    } else if (!/^(s|sim|aceito|1)$/.test(resposta)) {
      say("Responda *sim* para aceitar ou *não* para cancelar.");
    } else if (!turma) {
      say("Essa turma já não está liberada. Escreva *menu* e escolha outra.");
      passo = "menu";
    } else {
      const created = await criarPreinscricaoPublica(db, {
        nome: dados.nome || "WhatsApp",
        apelido: dados.apelido || "",
        email: dados.email || "",
        telf: telefone,
        concelho: dados.concelho || "",
        curso: turma.curso,
        local: turma.local,
        horario: turma.horario,
        inicioCurso: turma.dataInicio,
        turmaId: turma.turmaId,
        origem: "WhatsApp",
        meioContacto: "WhatsApp",
        consentimento: true,
      }, { ip: "WhatsApp" });
      if ("error" in created) {
        say(created.error === "email inválido"
          ? "O email ficou inválido. Escreva *menu* e recomece."
          : "Essa turma já não está liberada. Escreva *menu* e escolha outra.");
        passo = "menu";
      } else {
        leadId = created.preinscricao.id;
        await logLeadEvent(db, leadId, undefined, "whatsapp", created.duplicado ? "Consulta WhatsApp" : "Pré-inscrição via WhatsApp", telefone);
        // A mesma resposta com email novo ou já conhecido (como o formulário do site): não confirma quem já está inscrito.
        const url = await paginaDoCurso(db, "gold", turma.curso);
        say(`${turma.curso}\n${turma.local} · ${turma.horario} · ${fmtDataPt(turma.dataInicio)}${url ? `\n${url}` : ""}\n${created.aviso}\n\n${ass.textos.fimGold}`);
        passo = "menu";
        dados = {};
      }
    }
  }

  await saveSessao(db, telefone, passo, dados, leadId);
  for (const r of replies) await logMsg(db, telefone, "out", r);
  return { replies, mensagens, telefone, passo, leadId };
}
