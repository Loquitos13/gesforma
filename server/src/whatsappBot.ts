/** Assistente de WhatsApp: conversa por passos (menu, pré-inscrição, consulta do pedido). */
import { logLeadEvent } from "./crmDossier.js";
import type { Db } from "./db/pool.js";
import { mapPreinscricao } from "./ops.js";
import { criarPreinscricaoPublica, politicaPrivacidade } from "./preinscricaoPublica.js";
import { filtrarOferta, fmtDataPt, listCursosGoldActivos, listOfertaGold, uniqueOferta, type OfertaTurma } from "./ofertaGold.js";
import { isEmail, normalizeEmail, sanitizeHeader, sanitizeText } from "./security.js";
import {
  gravarSessaoWhatsapp, leadsPorTelefoneWhatsapp, registarMensagemWhatsapp, sessaoWhatsapp, ultimoLeadPorEmail, wamidJaVisto,
} from "./repos/whatsapp.js";

type Passo = "menu" | "nome" | "apelido" | "email" | "concelho" | "curso" | "local" | "horario" | "data" | "consentimento" | "consulta";

type Dados = {
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

const MENU = [
  "Olá, sou o assistente da ENA Formação.",
  "Como posso ajudar?",
  "1 · Pré-inscrição num curso (dados pessoais + curso, local, horário e data)",
  "2 · Ver o estado do meu pedido",
  "3 · Lista de cursos",
  "Escreva o número ou *menu* para voltar aqui.",
].join("\n");

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

async function cursosActivos(db: Db) {
  return listCursosGoldActivos(db);
}

function pickOpcao(text: string, opcoes: string[]) {
  const n = Number(text);
  if (Number.isInteger(n) && n >= 1 && n <= opcoes.length) return opcoes[n - 1] ?? null;
  const q = text.toLowerCase();
  return opcoes.find(o => o.toLowerCase() === q)
    ?? opcoes.find(o => o.toLowerCase().includes(q) || q.includes(o.toLowerCase().slice(0, 10)))
    ?? null;
}

function listaNumerada(titulo: string, items: string[], extra = "") {
  if (!items.length) return extra || "Não há opções libertadas. Escreva *menu*.";
  return [titulo, ...items.map((c, i) => `${i + 1}. ${c}`), "", "Responda com o número."].join("\n");
}

async function leadsPorTelefone(db: Db, telefone: string) {
  const n9 = last9(telefone);
  if (n9.length < 9) return [];
  const rows = await leadsPorTelefoneWhatsapp(db, telefone, n9);
  return rows.map(r => mapPreinscricao(r));
}

function textoEstado(lead: ReturnType<typeof mapPreinscricao>) {
  const nome = `${lead.nome} ${lead.apelido}`.trim();
  const linhas = [
    `Pedido nº ${lead.id} · ${nome}`,
    `Curso: ${lead.curso || "-"}`,
    lead.local ? `Local: ${lead.local}` : "",
    lead.horario ? `Horário: ${lead.horario}` : "",
    lead.inicioCurso && lead.inicioCurso !== "-" ? `Início: ${fmtDataPt(lead.inicioCurso)}` : "",
    `Estado: ${lead.estado}`,
  ].filter(Boolean);
  if (lead.estado === "Pago" || lead.estado === "Formando" || lead.estado === "Pré-inscrição") {
    linhas.push(lead.estado === "Pré-inscrição"
      ? "O pedido está na pré-inscrição. A secretaria trata da inscrição na turma."
      : "A inscrição está confirmada do lado da secretaria. Qualquer dúvida, ligue para a ENA.");
  } else if (lead.estado === "Não contactado") {
    linhas.push("Ainda está na fila. A secretaria contacta-o em breve - não precisa de se pré-inscrever outra vez.");
  } else {
    linhas.push("Já houve contacto comercial. Se quiser actualizar dados, a secretaria trata disso.");
  }
  linhas.push("O pagamento não se confirma por aqui: a secretaria confirma-o quando recebe a transferência e o comprovativo.");
  return linhas.join("\n");
}

async function getSessao(db: Db, telefone: string) {
  const r = await sessaoWhatsapp(db, telefone);
  return {
    passo: (r?.passo ?? "menu") as Passo,
    dados: parseDados(r?.dados),
    leadId: r?.lead_id ?? null,
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

async function wamidVisto(db: Db, wamid: string) {
  if (!wamid) return false;
  return wamidJaVisto(db, wamid);
}

/** Pergunta de consentimento (RGPD) antes de gravar a pré-inscrição: o mesmo texto e a mesma política do formulário do site. */
async function pedidoConsentimento(db: Db) {
  const { texto, url } = await politicaPrivacidade(db);
  const base = texto || "Aceita que a ENA trate os seus dados para gerir esta pré-inscrição e o contactar sobre a formação?";
  return [base, url ? `Política de privacidade: ${url}` : "", "Responda *sim* para aceitar ou *não* para cancelar."].filter(Boolean).join("\n");
}

function isMenuCmd(t: string) {
  return /^(menu|olá|ola|oi|bom dia|boa tarde|boa noite|inicio|início|start|hi|hello)$/i.test(t);
}

export async function handleWhatsappText(db: Db, telefoneRaw: string, textRaw: string, wamid = "") {
  const telefone = digitsPhone(telefoneRaw);
  const text = sanitizeText(textRaw, 500).trim();
  const replies: string[] = [];

  if (!telefone || !text) {
    return { replies: ["Não percebi. Escreva *menu* para recomeçar."], telefone };
  }
  if (wamid && await wamidVisto(db, wamid)) {
    return { replies: [], telefone, duplicado: true };
  }

  await logMsg(db, telefone, "in", text, wamid || undefined);
  const sess = await getSessao(db, telefone);
  let passo = sess.passo;
  let dados = { ...sess.dados };
  let leadId = sess.leadId;

  const say = (m: string) => { replies.push(m); };

  if (isMenuCmd(text) || text === "0") {
    passo = "menu";
    dados = {};
    say(MENU);
    await saveSessao(db, telefone, passo, dados, leadId);
    for (const r of replies) await logMsg(db, telefone, "out", r);
    return { replies, telefone, passo, leadId };
  }

  if (passo === "menu") {
    if (text === "1" || /pr[eé]-?inscri/i.test(text) || /^inscrever/i.test(text)) {
      passo = "nome";
      say("Vamos à pré-inscrição. Qual é o *primeiro nome*?");
    } else if (text === "2" || /estado|pedido|inscri/i.test(text)) {
      const leads = await leadsPorTelefone(db, telefone);
      if (leads[0]) {
        leadId = leads[0].id;
        say(textoEstado(leads[0]));
        if (leads.length > 1) say(`Há mais ${leads.length - 1} pedido(s) neste número. A secretaria vê o histórico completo no CRM.`);
        passo = "menu";
      } else {
        passo = "consulta";
        say("Não encontro um pedido neste número. Envie o *email* da pré-inscrição, ou escreva *1* para se pré-inscrever.");
      }
    } else if (text === "3" || /curso/i.test(text)) {
      const cursos = await cursosActivos(db);
      say(listaNumerada("Cursos Gold activos:", cursos.map(c => `${c.nome} · € ${c.preco}`)));
      say("Esse valor é o do curso. O local ou o horário podem ter outro preço, e a inscrição fica com o que escolher.");
      passo = "menu";
    } else {
      say(MENU);
    }
  } else if (passo === "consulta") {
    if (text === "1") {
      passo = "nome";
      say("Qual é o *primeiro nome*?");
    } else if (isEmail(text)) {
      const email = normalizeEmail(text);
      const encontrado = await ultimoLeadPorEmail(db, email);
      if (encontrado) {
        const lead = mapPreinscricao(encontrado);
        leadId = lead.id;
        say(textoEstado(lead));
        passo = "menu";
      } else {
        say("Não há pré-inscrição com esse email. Escreva *1* para criar uma, ou *menu*.");
      }
    } else {
      say("Envie o email, *1* para pré-inscrição, ou *menu*.");
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
    const cursos = await cursosActivos(db);
    say("Agora os *dados do curso*. A turma é o conjunto local + horário + data de início, e só entra se estiver *liberada* (turma Gold activa).");
    say(listaNumerada("Curso a que se quer inscrever:", cursos.map(c => c.nome)));
  } else if (passo === "curso") {
    const cursos = await cursosActivos(db);
    const curso = pickOpcao(text, cursos.map(c => c.nome)) || sanitizeHeader(text).slice(0, 200);
    dados.curso = curso;
    dados.local = undefined;
    dados.horario = undefined;
    dados.dataInicio = undefined;
    const oferta = filtrarOferta(await listOfertaGold(db), { curso });
    const locais = uniqueOferta(oferta, "local");
    if (!locais.length) {
      say(`Ainda não há turma liberada para *${curso}* (falta local + horário + data). Escolha outro curso ou escreva *menu*.`);
    } else {
      passo = "local";
      say(listaNumerada(`Local para ${curso}:`, locais));
    }
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
        if (created.duplicado) {
          say(`Já tínhamos este email. ${created.aviso}`);
          const mapped = created.preinscricao as ReturnType<typeof mapPreinscricao>;
          if ("estado" in mapped) say(textoEstado(mapped));
        } else {
          const preco = "preco" in created.preinscricao ? Number(created.preinscricao.preco) : turma.preco;
          say(`Pré-inscrição nº ${leadId} gravada.\n${turma.curso}\n${turma.local} · ${turma.horario} · ${fmtDataPt(turma.dataInicio)}\nPreço: € ${Number.isFinite(preco) ? preco : turma.preco ?? "-"}\n${created.aviso}\n\nO pagamento *não* se faz neste chat.`);
        }
        passo = "menu";
        dados = {};
      }
    }
  }

  await saveSessao(db, telefone, passo, dados, leadId);
  for (const r of replies) await logMsg(db, telefone, "out", r);
  return { replies, telefone, passo, leadId };
}
