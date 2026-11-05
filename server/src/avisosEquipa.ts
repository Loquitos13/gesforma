/**
 * Avisos internos por regra de email (Sistema › Emails › Regras):
 *  - equipa.documentos_recebidos: a pessoa entregou os documentos obrigatórios na ligação pessoal;
 *  - equipa.comprovativo_recebido: chegou o comprovativo de pagamento;
 *    os dois vão para os utilizadores das equipas escolhidas na regra («Enviar para»; nunca a administração) e para o
 *    email do local da pessoa (Edição de cursos › Locais), como antes;
 *  - formador.atribuido: um formador passa a estar na turma (ficha da turma ou cronograma) → email do formador.
 * Sem regra activa não sai nada; cada aviso sai uma só vez a cada pessoa (chave de idempotência).
 *
 * E, sem regra (sai sempre): o pedido para falar com a equipa no WhatsApp → a equipa da área da pessoa (modelo
 * «aviso_whatsapp_humano»).
 */
import { ingestEvent } from "./automations.js";
import { config } from "./config.js";
import type { Db } from "./db/pool.js";
import { enviarModelo } from "./emailModelo.js";
import { emailsDaEquipa } from "./equipaDestinatarios.js";
import { regrasActivasPara } from "./repos/emails.js";
import { remetenteDoDestinatario } from "./remetenteLocal.js";
import { leadsPorTelefoneWhatsapp, reservarAvisoPedidoWhatsapp } from "./repos/whatsapp.js";
import { gruposPorOmissao } from "../../src/partilhado/equipasAviso.js";
import { areaDoRegime } from "../../src/partilhado/emailAreas.js";
import { isEmail, normalizeEmail } from "./security.js";

const origem = () => config.appOrigin.replace(/\/$/, "");
const dataPt = (iso: string) => (/^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}` : iso);

/**
 * Documentos (todos os obrigatórios) ou comprovativo recebidos: um email a cada utilizador das equipas da regra activa
 * da área da pré-inscrição.
 */
export async function avisarDocumentoRecebido(
  db: Db,
  lead: Record<string, unknown>,
  documento: string,
  ficheiroId: string,
  opts: { comprovativo?: boolean } = {},
) {
  const evento = opts.comprovativo ? "equipa.comprovativo_recebido" : "equipa.documentos_recebidos";
  const regime = String(lead.regime ?? "gold") === "fin" ? "fin" : "gold";
  const area = areaDoRegime(regime);
  const id = Number(lead.id);
  const vista = regime === "fin" ? "financiada" : "gold";
  const vars = {
    nome_formando: `${lead.nome ?? ""} ${lead.apelido ?? ""}`.replace(/\s+/g, " ").trim() || "—",
    documento, link: `${origem()}/gesforma/${vista}/pre-inscricoes?lead=${id}`,
  };
  // O email do local da pessoa (ex.: ccppenafiel@…) recebe também, só os das pré-inscrições desse local.
  const local = await remetenteDoDestinatario(db, String(lead.email ?? "")).catch(() => null);
  for (const regra of await regrasActivasPara(db, [evento], area)) {
    const grupos = regra.destinatarios?.length ? regra.destinatarios : gruposPorOmissao(evento, area);
    const pessoas = await emailsDaEquipa(db, grupos, { crm: true });
    if (local && !pessoas.some(p => p.email === local.email)) pessoas.push({ nome: local.nome, email: local.email });
    for (const pessoa of pessoas) {
      await ingestEvent(db, evento,
        { email: pessoa.email, nome: pessoa.nome, curso: String(lead.curso ?? ""), regime },
        `${opts.comprovativo ? "comprovativo" : "docrecebido"}:${id}:${documento}:${ficheiroId}:${regra.id}:${pessoa.email}`.slice(0, 200),
        { soRegraId: regra.id, vars, area });
    }
  }
}

type TurmaAvisos = { nome?: unknown; curso?: unknown; local?: unknown; horario?: unknown; data_inicio?: unknown; formador?: unknown; formadores?: unknown; cronograma?: unknown };

/** Nomes dos formadores da turma: o principal, os extra e os das sessões do cronograma. */
export function formadoresDaTurma(t: TurmaAvisos | null | undefined) {
  if (!t) return [] as string[];
  const sessoes = Array.isArray(t.cronograma) ? t.cronograma as { formadores?: unknown }[] : [];
  const nomes = [
    String(t.formador ?? ""),
    ...(Array.isArray(t.formadores) ? t.formadores.map(String) : []),
    ...sessoes.flatMap(s => (Array.isArray(s.formadores) ? s.formadores.map(String) : [])),
  ].map(n => n.trim()).filter(Boolean);
  return [...new Map(nomes.map(n => [n.toLowerCase(), n])).values()];
}

export async function avisarFormadoresNovos(db: Db, regime: "gold" | "fin", turmaId: number, antes: TurmaAvisos | null, depois: TurmaAvisos | null) {
  const ja = new Set(formadoresDaTurma(antes).map(n => n.toLowerCase()));
  const novos = formadoresDaTurma(depois).filter(n => !ja.has(n.toLowerCase()));
  for (const nome of novos) {
    const f = (await db.query<{ nome: string; email: string }>(
      "SELECT nome, COALESCE(email, '') AS email FROM formadores WHERE lower(trim(nome)) = lower(trim($1)) LIMIT 1", [nome])).rows[0];
    const email = normalizeEmail(f?.email ?? "");
    if (!isEmail(email)) continue;
    await ingestEvent(db, "formador.atribuido",
      { email, nome: f!.nome, curso: String(depois?.curso ?? ""), turma: String(depois?.nome ?? ""), regime },
      `formador:${regime}${turmaId}:${email}`,
      { vars: {
        data_inicio: dataPt(String(depois?.data_inicio ?? "")) || "a confirmar",
        local: String(depois?.local ?? "") || "a confirmar", horario: String(depois?.horario ?? "") || "a confirmar",
        link: `${origem()}/gesforma`,
      } }).catch(err => console.error("[emails] aviso ao formador:", err));
  }
}

/**
 * Alguém pediu, no WhatsApp, para falar com uma pessoa: aviso por email à equipa da área da pessoa (sem pré-inscrição,
 * às equipas Gold e Financiada), com a ligação para a conversa.
 */
export async function avisarWhatsappHumano(db: Db, p: { telefone: string; nome: string; mensagem: string; regime: "gold" | "fin" | null }) {
  const vista = p.regime === "fin" ? "financiada" : "gold";
  const telefone = p.telefone.startsWith("351") ? `+351 ${p.telefone.slice(3)}` : `+${p.telefone}`;
  const nome = p.nome || telefone;
  const grupos = p.regime ? [p.regime] : ["gold", "fin"];
  for (const pessoa of await emailsDaEquipa(db, grupos, { crm: true })) {
    await enviarModelo(db, {
      tipo: "aviso_whatsapp_humano", area: p.regime ?? "gold", para: pessoa.email, nome: pessoa.nome, aviso: true,
      vars: { nome_contacto: nome, telefone, mensagem: p.mensagem, assunto: p.mensagem },
      link: `${origem()}/gesforma/${vista}/whatsapp?telefone=${encodeURIComponent(p.telefone)}`,
      reserva: {
        assunto: "WhatsApp: {{nome_contacto}} quer falar com a equipa",
        linhas: [
          "{{nome_contacto}} ({{telefone}}) pediu, no WhatsApp da ENA, para falar com uma pessoa da equipa.",
          "Assunto: {{mensagem}}",
          "O assistente automático fica em pausa nesta conversa. Responda pela caixa de conversas do GesForma.",
        ],
        cta: "Abrir a conversa",
      },
    });
  }
}

/**
 * Aviso à equipa de um pedido para falar com a equipa, uma vez por pedido. Sai com o assunto (a mensagem que a pessoa
 * escreveu a seguir, como o assistente lhe pede) ou, sem ele, passados uns minutos (regras de inatividade).
 */
export async function avisarPedidoWhatsapp(db: Db, telefone: string, mensagem: string, nomePerfil = "") {
  if (!(await reservarAvisoPedidoWhatsapp(db, telefone))) return false;
  const n9 = telefone.slice(-9);
  const lead = n9.length === 9 ? (await leadsPorTelefoneWhatsapp(db, telefone, n9))[0] : undefined;
  const perfil = nomePerfil || (await db.query<{ nome_perfil: string | null }>(
    "SELECT nome_perfil FROM whatsapp_sessoes WHERE telefone = $1", [telefone])).rows[0]?.nome_perfil || "";
  const nome = lead ? `${lead.nome ?? ""} ${lead.apelido ?? ""}`.trim() : perfil;
  await avisarWhatsappHumano(db, { telefone, nome, mensagem, regime: lead ? (String(lead.regime) === "fin" ? "fin" : "gold") : null });
  return true;
}
