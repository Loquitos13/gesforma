/**
 * Email à pessoa de uma pré-inscrição, enviado pelo GesForma com o endereço do local do pedido como remetente
 * (ccplisboa@ena.pt para Lisboa…, o email de cada local em Edição de cursos › Locais). Um «mailto:» abria o Outlook
 * sempre com a conta predefinida do computador; aqui o remetente segue o local, as respostas vão para essa caixa e
 * uma cópia oculta fica lá como registo. O envio fica no histórico da pré-inscrição.
 */
import type { Db } from "./db/pool.js";
import { addLeadNota } from "./crmDossier.js";
import { sendMail } from "./mailer.js";
import { mapPreinscricao } from "./ops.js";
import * as leads from "./repos/leads.js";
import { isEmail, normalizeEmail } from "./security.js";

export type Remetente = { local: string; email: string };

const chave = (v: unknown) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

export class EmailLeadErro extends Error {
  constructor(message: string, readonly estado = 400) { super(message); }
}

/** Os remetentes possíveis (um por local com email) e o do local da pré-inscrição, que vem primeiro. */
export async function remetentesDoLead(db: Db, id: number) {
  const row = await leads.leadComEtiqueta(db, id);
  if (!row) return null;
  const lead = mapPreinscricao(row) as { email?: string; nome?: string; apelido?: string; curso?: string; local?: string; regime?: string };
  const regime = String(row.regime ?? "gold") === "fin" ? "fin" : "gold";
  const r = await db.query<{ regime: string; payload: Record<string, unknown> }>(
    "SELECT regime, payload FROM catalog_items WHERE kind = 'locais' ORDER BY id");
  const porLocal = new Map<string, Remetente & { regime: string }>();
  for (const { regime: reg, payload: l } of r.rows) {
    const estado = String(l.status ?? "Ativo");
    if (estado === "Inactivo" || estado === "Inativo") continue;
    const nome = String(l.nome ?? "").trim();
    const email = normalizeEmail(String(l.email ?? ""));
    if (!nome || !isEmail(email)) continue;
    const k = chave(nome);
    // O mesmo local nos dois regimes: fica o do regime da pré-inscrição.
    if (!porLocal.has(k) || reg === regime) porLocal.set(k, { local: nome, email, regime: reg });
  }
  // Um endereço aparece uma vez (vários locais podem partilhar a mesma caixa).
  const vistos = new Set<string>();
  const todos = [...porLocal.values()].filter(x => !vistos.has(x.email) && Boolean(vistos.add(x.email)));
  const doLocal = todos.find(x => chave(x.local) === chave(lead.local));
  const remetentes: Remetente[] = [...(doLocal ? [doLocal] : []), ...todos.filter(x => x !== doLocal)]
    .map(({ local, email }) => ({ local, email }));
  return {
    para: normalizeEmail(String(lead.email ?? "")),
    nome: `${lead.nome ?? ""} ${lead.apelido ?? ""}`.replace(/\s+/g, " ").trim(),
    curso: String(lead.curso ?? ""),
    local: String(lead.local ?? ""),
    sugerido: doLocal?.email ?? "",
    remetentes,
  };
}

/** Envia e regista na pré-inscrição. O remetente tem de ser o email de um dos locais. */
export async function enviarEmailLead(db: Db, id: number, actorId: string, d: { de: string; assunto: string; texto: string }) {
  const info = await remetentesDoLead(db, id);
  if (!info) throw new EmailLeadErro("pré-inscrição inexistente", 404);
  if (!isEmail(info.para)) throw new EmailLeadErro("A pré-inscrição não tem um email válido.");
  const de = info.remetentes.find(r => r.email === normalizeEmail(d.de));
  if (!de) throw new EmailLeadErro("Escolha como remetente o email de um dos locais (Edição de cursos › Locais).");
  const html = d.texto.split("\n").map(l => (l ? `<p>${l.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>` : "<br>")).join("");
  const mailId = await sendMail(db, {
    to: info.para, name: info.nome, subject: d.assunto, text: d.texto, html,
    de: { nome: `ENA · ${de.local}`, email: de.email },
    bcc: de.email,
  });
  if (String(mailId).startsWith("log:")) {
    throw new EmailLeadErro("O email não saiu: o SMTP não está configurado (Configurações › Emails).", 503);
  }
  await addLeadNota(db, id, actorId, `Email enviado de ${de.email}: ${d.assunto}`, "Email", "");
  return { para: info.para, de: de.email };
}
