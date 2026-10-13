import { garantirToken } from "./ligacaoPessoal.js";
import { config } from "./config.js";
import { getLeadDossier, logLeadEvent } from "./crmDossier.js";
import { renderAutomaticEmail } from "./emailHtml.js";
import { sendMail } from "./mailer.js";
import { lerEntidade } from "./regrasConfig.js";
import type { Db } from "./db/pool.js";
import { confirmarPagamento, nextOpsId } from "./ops.js";
import { precoParaOferta } from "./precoOferta.js";
import { isEmail, normalizeEmail } from "./security.js";

function documentosUrl(token: string) {
  return `${config.appOrigin.replace(/\/$/, "")}/documentos/${token}`;
}

async function tokenDoLead(db: Db, id: number) {
  return garantirToken(db, id);
}

function nowStamp() {
  return new Date().toISOString().slice(0, 16).replace("T", " ");
}

function refMb(leadId: number, valor: number) {
  const n = String(100000000 + ((leadId * 7919) + Math.round(valor * 100)) % 900000000).slice(0, 9);
  return `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6, 9)}`;
}

async function alinharPrecoLead(
  db: Db,
  lead: { id: number; curso: string; local?: string; horario?: string; preco: number },
) {
  if (!lead.curso) return lead.preco;
  const resolved = await precoParaOferta(db, lead.curso, lead.local ?? "", lead.horario ?? "");
  if (resolved == null) return lead.preco;
  if (resolved !== Number(lead.preco)) {
    await db.query("UPDATE preinscricoes SET preco = $2 WHERE id = $1", [lead.id, resolved]);
  }
  return resolved;
}

export async function ensurePagamentoPendente(
  db: Db,
  lead: { id: number; nome: string; apelido: string; email: string; curso: string; local?: string; horario?: string; preco: number; pagamento_id?: string | null },
) {
  lead.preco = await alinharPrecoLead(db, lead);
  if (lead.pagamento_id) {
    const existing = await db.query("SELECT * FROM pagamentos WHERE id = $1", [lead.pagamento_id]);
    const row = existing.rows[0] as Record<string, unknown> | undefined;
    if (row) {
      if (String(row.estado ?? "") !== "Pago" && Number(row.valor) !== lead.preco) {
        const referencia = refMb(lead.id, lead.preco).replace(/\s/g, "");
        await db.query("UPDATE pagamentos SET valor = $2, referencia = $3 WHERE id = $1 AND estado <> 'Pago'", [
          row.id, lead.preco, referencia,
        ]);
        row.valor = lead.preco;
        row.referencia = referencia;
      }
      return row;
    }
  }
  const email = normalizeEmail(lead.email);
  const dup = await db.query(
    `SELECT * FROM pagamentos
      WHERE estado <> 'Pago' AND lower(email) = $1 AND curso = $2
      ORDER BY data DESC LIMIT 1`,
    [email, lead.curso],
  );
  if (dup.rows[0]) {
    const existente = dup.rows[0] as Record<string, unknown>;
    if (String(existente.estado ?? "") !== "Pago" && Number(existente.valor) !== lead.preco) {
      const referencia = refMb(lead.id, lead.preco).replace(/\s/g, "");
      await db.query("UPDATE pagamentos SET valor = $2, referencia = $3 WHERE id = $1 AND estado <> 'Pago'", [
        existente.id, lead.preco, referencia,
      ]);
      existente.valor = lead.preco;
      existente.referencia = referencia;
    }
    await db.query("UPDATE preinscricoes SET pagamento_id = $2 WHERE id = $1 AND (pagamento_id IS NULL OR pagamento_id = '')", [
      lead.id, String(existente.id),
    ]);
    return existente;
  }
  const id = String(await nextOpsId(db));
  const valor = Number(lead.preco) || 0;
  const referencia = refMb(lead.id, valor).replace(/\s/g, "");
  const nome = `${lead.nome} ${lead.apelido}`.trim();
  await db.query(
    "INSERT INTO pagamentos (id, nome, valor, metodo, curso, data, estado, email, referencia) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
    [id, nome, valor, "Multibanco", lead.curso, nowStamp(), "Pendente", email, referencia],
  );
  await db.query("UPDATE preinscricoes SET pagamento_id = $2 WHERE id = $1", [lead.id, id]);
  const row = await db.query("SELECT * FROM pagamentos WHERE id = $1", [id]);
  return (row.rows[0] ?? { id, referencia, valor, estado: "Pendente" }) as Record<string, unknown>;
}

export class PedidoPagamentoErro extends Error {}

function fmtEuros(v: number) {
  return v.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * A secretaria pede o pagamento depois de validar os documentos (Gold com preço).
 * Abre o passo de pagamento na ligação pessoal e envia o email com o valor, o IBAN e a ligação.
 * Pode repetir-se (reenviar) enquanto o pagamento não estiver confirmado.
 */
export async function pedirPagamento(db: Db, leadId: number, actorId?: string) {
  const dossier = await getLeadDossier(db, leadId);
  if (!dossier) throw new PedidoPagamentoErro("Pré-inscrição inexistente.");
  if (!dossier.podePedirPagamento) throw new PedidoPagamentoErro(dossier.faltaPedirPagamento || "Ainda não é possível pedir o pagamento.");
  const r = await db.query(
    "SELECT id, nome, apelido, email, curso, local, preco, horario, pagamento_id FROM preinscricoes WHERE id = $1",
    [leadId],
  );
  const lead = r.rows[0] as {
    id: number; nome: string; apelido: string; email: string; curso: string; local: string;
    preco: number; horario: string; pagamento_id: string | null;
  };
  const email = normalizeEmail(lead.email);
  if (!isEmail(email)) throw new PedidoPagamentoErro("A pré-inscrição não tem um email válido.");
  const pag = await ensurePagamentoPendente(db, lead);
  await db.query("UPDATE pagamentos SET metodo = 'Transferência bancária' WHERE id = $1 AND estado <> 'Pago'", [String(pag.id)]);
  await db.query("UPDATE preinscricoes SET pagamento_pedido_em = now(), ultima_actividade_em = now() WHERE id = $1", [leadId]);

  const valor = Number(pag.valor ?? lead.preco) || 0;
  const ent = await lerEntidade(db);
  const iban = ent.iban.replace(/(.{4})/g, "$1 ").trim();
  const titular = ent.titularConta || ent.nome;
  const url = `${documentosUrl(await tokenDoLead(db, leadId))}?passo=pagamento`;
  const nome = `${lead.nome} ${lead.apelido}`.trim();
  const linhas = [
    `A secretaria validou os seus documentos de ${lead.curso}.`,
    `Para concluir a inscrição, faça o pagamento de € ${fmtEuros(valor)} por transferência bancária.`,
    iban ? `IBAN: ${iban} · Titular: ${titular}` : "A secretaria indica-lhe os dados para a transferência.",
    "Depois anexe o comprovativo na sua ligação pessoal, no passo «Pagamento».",
    "Assim que o pagamento for confirmado, recebe por email o acesso à área do formando.",
  ];
  const mail = renderAutomaticEmail({
    nome, xml: "", linhas, cta: "Abrir o passo de pagamento", href: url,
    vars: { nome, curso: lead.curso, documentos_url: url }, origin: config.appOrigin,
  });
  await sendMail(db, { to: email, name: nome, subject: `Pagamento da inscrição em ${lead.curso}`, text: mail.text, html: mail.html });
  const nota = `Pagamento pedido · € ${fmtEuros(valor)} por transferência${iban ? ` para ${iban}` : ""}.`;
  await db.query(
    "INSERT INTO preinscricao_contactos (preinscricao_id, actor_id, nota, meio) VALUES ($1,$2,$3,$4)",
    [leadId, actorId ?? null, nota, "Email"],
  );
  await logLeadEvent(db, leadId, actorId, "seguimento", "Pagamento pedido", nota);
  return { ok: true as const, valor, iban, semIban: !iban };
}

/**
 * A secretaria marca a pré-inscrição como paga: confirma o pagamento ligado ou, se não existir,
 * regista-o na hora (para a tesouraria ter o movimento). O email de confirmação sai uma só vez.
 */
export async function marcarLeadPago(db: Db, leadId: number) {
  const r = await db.query<{ id: number; nome: string; apelido: string; email: string; curso: string; preco: unknown; pagamento_id: string | null; pagamento_metodo: string }>(
    "SELECT id, nome, apelido, email, curso, preco, pagamento_id, COALESCE(pagamento_metodo, '') AS pagamento_metodo FROM preinscricoes WHERE id = $1",
    [leadId],
  );
  const lead = r.rows[0];
  if (!lead) return null;
  let pag = lead.pagamento_id
    ? (await db.query("SELECT * FROM pagamentos WHERE id = $1", [lead.pagamento_id])).rows[0] as Record<string, unknown> | undefined
    : undefined;
  if (!pag) {
    const id = `TRX-${await nextOpsId(db)}`;
    await db.query(
      "INSERT INTO pagamentos (id, nome, valor, metodo, curso, data, estado, email, referencia) VALUES ($1,$2,$3,$4,$5,$6,'Pendente',$7,'')",
      [id, `${lead.nome} ${lead.apelido}`.trim(), Number(lead.preco) || 0, lead.pagamento_metodo || "Manual", lead.curso, nowStamp(), normalizeEmail(lead.email)],
    );
    await db.query("UPDATE preinscricoes SET pagamento_id = $2 WHERE id = $1", [leadId, id]);
    pag = (await db.query("SELECT * FROM pagamentos WHERE id = $1", [id])).rows[0] as Record<string, unknown>;
  }
  if (!/^pago$/i.test(String(pag.estado ?? ""))) await confirmarPagamento(db, pag);
  await db.query("UPDATE preinscricoes SET estado = 'Pago' WHERE id = $1 AND estado NOT IN ('Formando', 'Pago')", [leadId]);
  return { pagamentoId: String(pag.id) };
}
