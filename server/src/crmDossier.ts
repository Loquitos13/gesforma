import type { Db } from "./db/pool.js";
import { documentosUrl, docsDoCurso, docsCompletos, ensureDocsToken, listarDocsLead } from "./docsLink.js";
import { mapPagamento, mapPreinscricao } from "./ops.js";

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

export async function addLeadNota(db: Db, leadId: number, actorId: string | undefined, nota: string, meio = "", resultado = "") {
  const texto = nota.trim().slice(0, 2000);
  const canal = meio.trim().slice(0, 40);
  const res = resultado.trim().slice(0, 40);
  if (!texto && !res) return;
  const corpo = texto || (res ? `Tentativa · ${res}` : "Contacto registado.");
  await db.query(
    "INSERT INTO preinscricao_contactos (preinscricao_id, actor_id, nota, meio, resultado) VALUES ($1,$2,$3,$4,$5)",
    [leadId, actorId ?? null, corpo, canal, res],
  );
  await db.query(
    `UPDATE preinscricoes SET
       notas = CASE WHEN $2 = '' THEN notas ELSE trim(both from notas || E'\n' || $2) END,
       meio_contacto = CASE WHEN $3 = '' THEN meio_contacto ELSE $3 END,
       ultima_nota = $2,
       ultima_actividade_em = now(),
       ultima_resultado = CASE WHEN $4 = '' THEN ultima_resultado ELSE $4 END
     WHERE id = $1`,
    [leadId, corpo, canal, res],
  );
  await logLeadEvent(db, leadId, actorId, res ? "contacto" : "nota", canal ? `${res || "Nota"} · ${canal}` : (res || "Nota comercial"), corpo);
}

export async function fixarNota(db: Db, leadId: number, notaId: number, fixada: boolean) {
  await db.query(
    "UPDATE preinscricao_contactos SET fixada = $3 WHERE id = $1 AND preinscricao_id = $2",
    [notaId, leadId, fixada],
  );
}

export async function findDuplicados(db: Db, email: string, telf: string, exceptId = 0) {
  const mail = email.trim().toLowerCase();
  const n9 = telf.replace(/\D/g, "").slice(-9);
  const rows = await db.query(
    `SELECT id, nome, apelido, email, telf, estado, curso, inscrito
       FROM preinscricoes
      WHERE id <> $1
        AND (
          ($2 <> '' AND lower(email) = $2)
          OR ($3 <> '' AND length($3) = 9 AND (telf LIKE '%' || $3 OR telf LIKE '%' || '351' || $3))
        )
      ORDER BY id DESC LIMIT 8`,
    [exceptId, mail, n9],
  );
  return rows.rows;
}

export async function getLeadDossier(db: Db, id: number) {
  const leadQ = await db.query(
    `SELECT p.*, e.nome AS etiqueta_nome, e.cor AS etiqueta_cor, u.name AS comercial_nome
       FROM preinscricoes p
       LEFT JOIN crm_etiquetas e ON e.id = p.etiqueta_id
       LEFT JOIN users u ON u.id = p.comercial_id
      WHERE p.id = $1`,
    [id],
  );
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
    id: number; nota: string; meio: string; resultado: string; fixada: boolean; created_at: string | Date; actor_id: string | null; actor_name: string | null;
  }>(
    `SELECT c.id, c.nota, c.meio, c.resultado, c.fixada, c.created_at, c.actor_id, u.name AS actor_name
       FROM preinscricao_contactos c
       LEFT JOIN users u ON u.id = c.actor_id
      WHERE c.preinscricao_id = $1
      ORDER BY c.fixada DESC, c.created_at DESC`,
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

  const n9 = String(lead.telf ?? "").replace(/\D/g, "").slice(-9);
  const irmaos = await db.query(
    `SELECT * FROM preinscricoes
      WHERE id <> $2 AND (
        (email <> '' AND lower(email) = lower($1))
        OR (telf <> '' AND $3 <> '' AND (telf LIKE '%' || $3))
      )
      ORDER BY inscrito DESC LIMIT 20`,
    [lead.email, id, n9],
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
  const regime = String(row.regime ?? "gold") === "fin" ? "fin" : "gold";
  const pedidos = await docsDoCurso(db, lead.curso, regime);
  const ficheiros = await listarDocsLead(db, id);
  const labels = new Map(pedidos.map(p => [p.id, p.label]));
  labels.set("comprovativo", "Comprovativo de pagamento");
  const { ok, emFalta } = docsCompletos(pedidos, ficheiros.map(f => f.tipo));
  let docsUrl = "";
  try { docsUrl = documentosUrl(await ensureDocsToken(db, id)); } catch { docsUrl = ""; }
  let pagamento: { id: string; referencia: string; valor: number; estado: string; entidade: string } | null = null;
  const pagId = String(row.pagamento_id ?? "");
  if (pagId) {
    const pag = await db.query("SELECT * FROM pagamentos WHERE id = $1", [pagId]);
    if (pag.rows[0]) {
      const mapped = mapPagamento(pag.rows[0] as Record<string, unknown>);
      const settings = await db.query<{ values: unknown }>("SELECT values FROM app_settings WHERE id = 'gold'");
      const values = settings.rows[0]?.values && typeof settings.rows[0].values === "object"
        ? settings.rows[0].values as Record<string, string> : {};
      const ref = mapped.referencia.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3") || mapped.referencia;
      pagamento = {
        id: mapped.id,
        referencia: ref,
        valor: mapped.valor,
        estado: mapped.estado,
        entidade: String(values["Entidade Multibanco"] ?? ""),
      };
    }
  }

  return {
    lead,
    cliente,
    papel: cliente ? "cliente" : "potencial",
    campos: campos.map(c => ({ ...c, valor: valores[c.id] ?? "" })),
    notas: notas.rows.map(n => ({
      id: n.id,
      nota: n.nota,
      meio: n.meio || "",
      resultado: n.resultado || "",
      fixada: Boolean(n.fixada),
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
    docsUrl,
    docsCompletos: ok,
    docsEmFalta: emFalta.map(d => d.label),
    documentos: ficheiros.map(f => ({
      id: f.id,
      tipo: f.tipo,
      label: labels.get(f.tipo) ?? f.tipo,
      nome: f.nome,
      url: f.drive_url || (f.drive_file_id ? `/api/v1/drive/files/${f.drive_file_id}/content` : ""),
      createdAt: iso(f.created_at),
      estado: f.estado || "pendente",
      observacao: f.observacao || "",
    })),
    docsFechado: Boolean(row.docs_fechado_em),
    pagamento,
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
    changed.push(`${campo.rows[0]?.label ?? "campo"}: ${next || "-"}`);
  }
  if (changed.length) {
    await logLeadEvent(db, leadId, actorId, "campo", "Campos actualizados", changed.join(" · "));
  }
}

function normCor(cor: string) {
  const c = cor.trim();
  return /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : "#64748b";
}

export async function listCrmEtiquetas(db: Db) {
  const rows = await db.query<{ id: number; nome: string; cor: string }>(
    "SELECT id, nome, cor FROM crm_etiquetas ORDER BY nome",
  );
  return rows.rows.map(r => ({ id: r.id, nome: r.nome, cor: r.cor }));
}

export async function createCrmEtiqueta(db: Db, nome: string, cor: string) {
  const inserted = await db.query<{ id: number; nome: string; cor: string }>(
    "INSERT INTO crm_etiquetas (nome, cor) VALUES ($1,$2) RETURNING id, nome, cor",
    [nome.trim().slice(0, 40), normCor(cor)],
  );
  return inserted.rows[0]!;
}

export async function deleteCrmEtiqueta(db: Db, id: number) {
  await db.query("UPDATE preinscricoes SET etiqueta_id = NULL WHERE etiqueta_id = $1", [id]);
  await db.query("DELETE FROM crm_etiquetas WHERE id = $1", [id]);
}
