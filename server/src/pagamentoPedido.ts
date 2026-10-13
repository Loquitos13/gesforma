import { garantirToken } from "./ligacaoPessoal.js";
import { ingestEvent, flushQueuedJobs } from "./automations.js";
import { config } from "./config.js";
import { logLeadEvent } from "./crmDossier.js";
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

async function entidadeMb(db: Db) {
  const row = await db.query<{ values: unknown }>("SELECT values FROM app_settings WHERE id = 'gold'");
  const values = row.rows[0]?.values;
  const obj = values && typeof values === "object" ? values as Record<string, string> : {};
  return String(obj["Entidade Multibanco"] ?? "").trim();
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

export async function firePagamentoRefEmail(db: Db, leadId: number) {
  const row = await db.query(
    `SELECT id, nome, apelido, email, curso, local, preco, regime, pagamento_id, horario
       FROM preinscricoes WHERE id = $1`,
    [leadId],
  );
  const lead = row.rows[0] as {
    id: number; nome: string; apelido: string; email: string; curso: string; local: string;
    preco: number; regime: string; pagamento_id: string | null; horario: string;
  } | undefined;
  if (!lead) return null;
  if (String(lead.regime ?? "gold") === "fin") return { skipped: "fin" as const };
  const email = normalizeEmail(lead.email);
  if (!isEmail(email) || Number(lead.preco) <= 0) return { skipped: "sem_pagamento" as const };

  const pag = await ensurePagamentoPendente(db, lead);
  const token = await tokenDoLead(db, lead.id);
  const url = documentosUrl(token);
  const comprovativo = `${url}?fase=pagamento`;
  const entidade = await entidadeMb(db);
  const referenciaRaw = String(pag.referencia ?? "");
  const referencia = referenciaRaw.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3") || referenciaRaw;
  const valor = Number(pag.valor ?? lead.preco) || 0;
  const nome = `${lead.nome} ${lead.apelido}`.trim();
  const r = await ingestEvent(db, "preinscricao.docs_completos", {
    email,
    nome,
    curso: lead.curso,
    turma: lead.horario || "-",
    preinscricaoId: lead.id,
    documentos_url: url,
    comprovativo_url: comprovativo,
    referencia,
    entidade: entidade || "a indicar pela secretaria",
    valor: valor.toFixed(2),
  }, `pagref:${lead.id}:${email}`).catch(() => ({ queued: 0 }));
  const nota = `Referência Multibanco ${referencia} · € ${valor.toFixed(2)}${entidade ? ` · entidade ${entidade}` : ""}. Comprovativo: ${comprovativo}`;
  await db.query(
    "INSERT INTO preinscricao_contactos (preinscricao_id, actor_id, nota, meio) VALUES ($1,$2,$3,$4)",
    [leadId, null, nota, "Email"],
  );
  await logLeadEvent(db, leadId, undefined, "seguimento", "Pedido de pagamento enviado", nota);
  await flushQueuedJobs(db, 8).catch(() => undefined);
  return { queued: r.queued ?? 0, referencia, entidade, valor, comprovativo };
}

export function comprovativoUrl(token: string) {
  return `${config.appOrigin.replace(/\/$/, "")}/documentos/${token}?fase=pagamento`;
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
