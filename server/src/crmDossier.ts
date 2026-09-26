import type { Db } from "./db/pool.js";
import { mapPreinscricao } from "./ops.js";

export type CrmCampoTipo = "texto" | "numero" | "data" | "lista";

function slugify(label: string) {
  const base = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
  return base || `campo_${Date.now().toString(36)}`;
}

function parseOpcoes(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw) as unknown;
      return Array.isArray(p) ? p.map(String).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function iso(v: string | Date | null | undefined) {
  if (!v) return new Date().toISOString();
  return v instanceof Date ? v.toISOString() : String(v);
}

export async function logLeadEvent(
  db: Db,
  leadId: number,
  actorId: string | undefined,
  tipo: string,
  titulo: string,
  detalhe = "",
) {
  await db.query(
    "INSERT INTO lead_eventos (lead_id, actor_id, tipo, titulo, detalhe) VALUES ($1,$2,$3,$4,$5)",
    [leadId, actorId ?? null, tipo, titulo.slice(0, 160), detalhe.slice(0, 2000)],
  );
}

export async function listCrmCampos(db: Db) {
  const rows = await db.query<{
    id: number; label: string; chave: string; tipo: string; opcoes: unknown; activo: boolean;
  }>("SELECT id, label, chave, tipo, opcoes, activo FROM crm_campos WHERE activo = true ORDER BY id");
  return rows.rows.map(r => ({
    id: r.id,
    label: r.label,
    chave: r.chave,
    tipo: r.tipo as CrmCampoTipo,
    opcoes: parseOpcoes(r.opcoes),
  }));
}

export async function createCrmCampo(db: Db, label: string, tipo: CrmCampoTipo, opcoes: string[]) {
  const chave = slugify(label);
  const inserted = await db.query<{ id: number }>(
    `INSERT INTO crm_campos (label, chave, tipo, opcoes)
     VALUES ($1, $2, $3, $4::jsonb)
     ON CONFLICT (chave) DO UPDATE SET label = EXCLUDED.label, tipo = EXCLUDED.tipo, opcoes = EXCLUDED.opcoes, activo = true
     RETURNING id`,
    [label, chave, tipo, JSON.stringify(opcoes)],
  );
  return { id: inserted.rows[0]!.id, label, chave, tipo, opcoes };
}

export async function addLeadNota(db: Db, leadId: number, actorId: string | undefined, nota: string) {
  const texto = nota.trim().slice(0, 2000);
  if (!texto) return;
  await db.query(
    "INSERT INTO preinscricao_contactos (preinscricao_id, actor_id, nota) VALUES ($1,$2,$3)",
    [leadId, actorId ?? null, texto],
  );
  await db.query(
    `UPDATE preinscricoes SET notas = CASE WHEN $2 = '' THEN notas ELSE trim(both from notas || E'\n' || $2) END WHERE id = $1`,
    [leadId, texto],
  );
  await logLeadEvent(db, leadId, actorId, "nota", "Nota comercial", texto);
}

export async function getLeadDossier(db: Db, id: number) {
  const leadQ = await db.query("SELECT * FROM preinscricoes WHERE id = $1", [id]);
  const row = leadQ.rows[0];
  if (!row) return null;
  const lead = mapPreinscricao(row as Record<string, unknown>);
  const campos = await listCrmCampos(db);
  const vals = await db.query<{ campo_id: number; valor: string }>(
    "SELECT campo_id, valor FROM crm_campo_valores WHERE lead_id = $1",
    [id],
  );
  const valores: Record<number, string> = {};
  for (const v of vals.rows) valores[v.campo_id] = v.valor;

  const notas = await db.query<{
    id: number; nota: string; created_at: string | Date; actor_id: string | null; actor_name: string | null;
  }>(
    `SELECT c.id, c.nota, c.created_at, c.actor_id, u.name AS actor_name
       FROM preinscricao_contactos c
       LEFT JOIN users u ON u.id = c.actor_id
      WHERE c.preinscricao_id = $1
      ORDER BY c.created_at DESC`,
    [id],
  );

  const eventos = await db.query<{
    id: number; tipo: string; titulo: string; detalhe: string; created_at: string | Date; actor_name: string | null;
  }>(
    `SELECT e.id, e.tipo, e.titulo, e.detalhe, e.created_at, u.name AS actor_name
       FROM lead_eventos e
       LEFT JOIN users u ON u.id = e.actor_id
      WHERE e.lead_id = $1
      ORDER BY e.created_at DESC, e.id DESC
      LIMIT 200`,
    [id],
  );

  const irmaos = await db.query(
    `SELECT * FROM preinscricoes
      WHERE lower(email) = lower($1) AND id <> $2 AND email <> ''
      ORDER BY inscrito DESC LIMIT 20`,
    [lead.email, id],
  );

  const propostas = await db.query<{
    id: number; curso: string; estado: string; valor: number | string; enviada_em: Date | string | null;
  }>(
    `SELECT id, curso, estado, valor, enviada_em FROM propostas_comerciais
      WHERE preinscricao_id = $1
         OR (cliente_email <> '' AND lower(cliente_email) = lower($2))
      ORDER BY enviada_em DESC LIMIT 20`,
    [id, lead.email],
  );

  const cliente = lead.estado === "Formando" || lead.estado === "Pago";

  return {
    lead,
    cliente,
    papel: cliente ? "cliente" : "potencial",
    campos: campos.map(c => ({ ...c, valor: valores[c.id] ?? "" })),
    notas: notas.rows.map(n => ({
      id: n.id,
      nota: n.nota,
      createdAt: iso(n.created_at),
      actorName: n.actor_name,
    })),
    eventos: eventos.rows.map(e => ({
      id: e.id,
      tipo: e.tipo,
      titulo: e.titulo,
      detalhe: e.detalhe,
      createdAt: iso(e.created_at),
      actorName: e.actor_name,
    })),
    outrosPedidos: irmaos.rows.map(r => mapPreinscricao(r as Record<string, unknown>)),
    propostas: propostas.rows.map(p => ({
      id: p.id,
      curso: p.curso,
      estado: p.estado,
      valor: Number(p.valor) || 0,
      enviadaEm: p.enviada_em ? iso(p.enviada_em) : "",
    })),
  };
}

export async function setCampoValores(
  db: Db,
  leadId: number,
  actorId: string | undefined,
  valores: { campoId: number; valor: string }[],
) {
  const changed: string[] = [];
  for (const v of valores) {
    const prev = await db.query<{ valor: string }>(
      "SELECT valor FROM crm_campo_valores WHERE lead_id = $1 AND campo_id = $2",
      [leadId, v.campoId],
    );
    const next = v.valor.slice(0, 2000);
    const old = prev.rows[0]?.valor ?? "";
    if (old === next) continue;
    await db.query(
      `INSERT INTO crm_campo_valores (lead_id, campo_id, valor, updated_at)
       VALUES ($1,$2,$3, now())
       ON CONFLICT (lead_id, campo_id) DO UPDATE SET valor = EXCLUDED.valor, updated_at = now()`,
      [leadId, v.campoId, next],
    );
    const campo = await db.query<{ label: string }>("SELECT label FROM crm_campos WHERE id = $1", [v.campoId]);
    changed.push(`${campo.rows[0]?.label ?? "campo"}: ${next || "—"}`);
  }
  if (changed.length) {
    await logLeadEvent(db, leadId, actorId, "campo", "Campos actualizados", changed.join(" · "));
  }
}
