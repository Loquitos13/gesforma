/**
 * Avisos internos por regra de email (Sistema › Emails › Regras):
 *  - equipa.documentos_recebidos: chegou um documento ou o comprovativo na ligação pessoal → email do local da pessoa
 *    (Edição de cursos › Locais) ou, sem ele, o da entidade;
 *  - formador.atribuido: um formador passa a estar na turma (ficha da turma ou cronograma) → email do formador.
 * Sem regra activa não sai nada; cada aviso sai uma só vez (chave de idempotência).
 *
 * E, sem regra (sai sempre): o pedido para falar com a equipa no WhatsApp → email da entidade (modelo
 * «aviso_whatsapp_humano»).
 */
import { ingestEvent } from "./automations.js";
import { enviarModelo } from "./emailModelo.js";
import { config } from "./config.js";
import type { Db } from "./db/pool.js";
import { lerEntidade } from "./regrasConfig.js";
import { remetenteDoDestinatario } from "./remetenteLocal.js";
import { isEmail, normalizeEmail } from "./security.js";

const origem = () => config.appOrigin.replace(/\/$/, "");
const dataPt = (iso: string) => (/^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}` : iso);

export async function avisarDocumentoRecebido(
  db: Db,
  lead: Record<string, unknown>,
  documento: string,
  ficheiroId: string,
) {
  const local = await remetenteDoDestinatario(db, String(lead.email ?? "")).catch(() => null);
  const para = normalizeEmail(local?.email || (await lerEntidade(db)).email);
  if (!isEmail(para)) return;
  const id = Number(lead.id);
  const vista = String(lead.regime ?? "gold") === "fin" ? "financiada" : "gold";
  await ingestEvent(db, "equipa.documentos_recebidos",
    { email: para, nome: "Equipa", curso: String(lead.curso ?? ""), regime: String(lead.regime ?? "gold") },
    `docrecebido:${id}:${documento}:${ficheiroId}`,
    { vars: {
      nome_formando: `${lead.nome ?? ""} ${lead.apelido ?? ""}`.replace(/\s+/g, " ").trim() || "—",
      documento, link: `${origem()}/gesforma/${vista}/pre-inscricoes?lead=${id}`,
    } });
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

/** Alguém pediu, no WhatsApp, para falar com uma pessoa: aviso por email à entidade, com a ligação para a conversa. */
export async function avisarWhatsappHumano(db: Db, p: { telefone: string; nome: string; mensagem: string; regime: "gold" | "fin" }) {
  const para = normalizeEmail((await lerEntidade(db)).email);
  if (!isEmail(para)) return;
  const vista = p.regime === "fin" ? "financiada" : "gold";
  const telefone = p.telefone.startsWith("351") ? `+351 ${p.telefone.slice(3)}` : `+${p.telefone}`;
  const nome = p.nome || telefone;
  await enviarModelo(db, {
    tipo: "aviso_whatsapp_humano", area: p.regime, para, nome: "Equipa",
    vars: { nome_contacto: nome, telefone, mensagem: p.mensagem },
    link: `${origem()}/gesforma/${vista}/whatsapp?telefone=${encodeURIComponent(p.telefone)}`,
    reserva: {
      assunto: "WhatsApp: {{nome_contacto}} quer falar com a equipa",
      linhas: [
        "{{nome_contacto}} ({{telefone}}) pediu, no WhatsApp da ENA, para falar com uma pessoa da equipa.",
        "Última mensagem: {{mensagem}}",
        "O assistente automático fica em pausa nesta conversa. Responda pela caixa de conversas do GesForma.",
      ],
      cta: "Abrir a conversa",
    },
  });
}
