/**
 * Dossiê da pré-inscrição: eventos, notas, campos personalizados, etiquetas, duplicados
 * e o que está ligado (outros pedidos, propostas, pagamento, turma escolhida).
 */
import { Filtros, many, one, type AtorCrm, type Consulta, type Regime } from "./sql.js";

type Linha = Record<string, unknown>;

export async function inserirEvento(
  c: Consulta,
  e: { leadId: number; actorId?: string | null; tipo: string; titulo: string; detalhe?: string },
) {
  await many(c,
    "INSERT INTO lead_eventos (lead_id, actor_id, tipo, titulo, detalhe) VALUES ($1,$2,$3,$4,$5)",
    [e.leadId, e.actorId ?? null, e.tipo, e.titulo.slice(0, 160), (e.detalhe ?? "").slice(0, 2000)]);
}

export async function eventos(c: Consulta, leadId: number, limite = 200) {
  return many<{ id: number; tipo: string; titulo: string; detalhe: string; created_at: string | Date; actor_name: string | null }>(c,
    `SELECT e.id, e.tipo, e.titulo, e.detalhe, e.created_at, u.name AS actor_name
       FROM lead_eventos e
       LEFT JOIN users u ON u.id = e.actor_id
      WHERE e.lead_id = $1
      ORDER BY e.created_at DESC, e.id DESC
      LIMIT $2`,
    [leadId, limite]);
}

export async function notas(c: Consulta, leadId: number) {
  return many<{
    id: number; nota: string; meio: string; resultado: string; fixada: boolean;
    created_at: string | Date; actor_id: string | null; actor_name: string | null;
  }>(c,
    `SELECT c.id, c.nota, c.meio, c.resultado, c.fixada, c.created_at, c.actor_id, u.name AS actor_name
       FROM preinscricao_contactos c
       LEFT JOIN users u ON u.id = c.actor_id
      WHERE c.preinscricao_id = $1
      ORDER BY c.fixada DESC, c.created_at DESC`,
    [leadId]);
}

export async function fixarNota(c: Consulta, leadId: number, notaId: number, fixada: boolean) {
  await many(c, "UPDATE preinscricao_contactos SET fixada = $3 WHERE id = $1 AND preinscricao_id = $2", [notaId, leadId, fixada]);
}

/* ── Campos personalizados ───────────────────────────────────────────────── */

export async function camposActivos(c: Consulta) {
  return many<{ id: number; label: string; chave: string; tipo: string; opcoes: unknown }>(c,
    "SELECT id, label, chave, tipo, opcoes FROM crm_campos WHERE activo = true ORDER BY id");
}

export async function gravarCampo(c: Consulta, label: string, chave: string, tipo: string, opcoes: string[]) {
  const row = await one<{ id: number }>(c,
    `INSERT INTO crm_campos (label, chave, tipo, opcoes)
     VALUES ($1, $2, $3, $4::jsonb)
     ON CONFLICT (chave) DO UPDATE SET label = EXCLUDED.label, tipo = EXCLUDED.tipo, opcoes = EXCLUDED.opcoes, activo = true
     RETURNING id`,
    [label, chave, tipo, JSON.stringify(opcoes)]);
  return Number(row!.id);
}

export async function valoresDosCampos(c: Consulta, leadId: number) {
  return many<{ campo_id: number; valor: string }>(c, "SELECT campo_id, valor FROM crm_campo_valores WHERE lead_id = $1", [leadId]);
}

export async function valorDoCampo(c: Consulta, leadId: number, campoId: number) {
  const r = await one<{ valor: string }>(c, "SELECT valor FROM crm_campo_valores WHERE lead_id = $1 AND campo_id = $2", [leadId, campoId]);
  return r?.valor ?? "";
}

export async function gravarValorCampo(c: Consulta, leadId: number, campoId: number, valor: string) {
  await many(c,
    `INSERT INTO crm_campo_valores (lead_id, campo_id, valor, updated_at)
     VALUES ($1,$2,$3, now())
     ON CONFLICT (lead_id, campo_id) DO UPDATE SET valor = EXCLUDED.valor, updated_at = now()`,
    [leadId, campoId, valor]);
}

export async function rotuloDoCampo(c: Consulta, campoId: number) {
  return (await one<{ label: string }>(c, "SELECT label FROM crm_campos WHERE id = $1", [campoId]))?.label ?? "campo";
}

/* ── Etiquetas ───────────────────────────────────────────────────────────── */

export async function etiquetas(c: Consulta) {
  return many<{ id: number; nome: string; cor: string }>(c, "SELECT id, nome, cor FROM crm_etiquetas ORDER BY nome");
}

export async function criarEtiqueta(c: Consulta, nome: string, cor: string) {
  return (await one<{ id: number; nome: string; cor: string }>(c,
    "INSERT INTO crm_etiquetas (nome, cor) VALUES ($1,$2) RETURNING id, nome, cor", [nome, cor]))!;
}

export async function apagarEtiqueta(c: Consulta, id: number) {
  await many(c, "UPDATE preinscricoes SET etiqueta_id = NULL WHERE etiqueta_id = $1", [id]);
  await many(c, "DELETE FROM crm_etiquetas WHERE id = $1", [id]);
}

/* ── Duplicados e pedidos ligados ────────────────────────────────────────── */

/** Pedidos com o mesmo email ou os mesmos 9 dígitos de telemóvel. */
export async function duplicados(c: Consulta, email: string, n9: string, excetoId: number, ator?: AtorCrm) {
  const w = new Filtros([excetoId, email, n9]).sempre(`id <> $1
        AND (
          ($2 <> '' AND lower(email) = $2)
          OR ($3 <> '' AND length($3) = 9 AND (telf LIKE '%' || $3 OR telf LIKE '%' || '351' || $3))
        )`).visivelPara(ator, "comercial_id", "regime");
  return many<Linha>(c,
    `SELECT id, nome, apelido, email, telf, estado, curso, inscrito
       FROM preinscricoes ${w.where}
      ORDER BY id DESC LIMIT 8`,
    w.params);
}

export async function outrosPedidos(c: Consulta, leadId: number, email: string, n9: string, ator?: AtorCrm) {
  const w = new Filtros([email, leadId, n9]).sempre(`id <> $2 AND (
        (email <> '' AND lower(email) = lower($1))
        OR (telf <> '' AND $3 <> '' AND (telf LIKE '%' || $3))
      )`).visivelPara(ator, "comercial_id", "regime");
  return many<Linha>(c, `SELECT * FROM preinscricoes ${w.where} ORDER BY inscrito DESC LIMIT 20`, w.params);
}

export async function propostasDoLead(c: Consulta, leadId: number, email: string, ator?: AtorCrm) {
  const w = new Filtros([leadId, email]).sempre(`preinscricao_id = $1
         OR (cliente_email <> '' AND lower(cliente_email) = lower($2))`).visivelPara(ator, "comercial_id", "regime");
  return many<{ id: number; curso: string; estado: string; valor: number | string; enviada_em: Date | string | null }>(c,
    `SELECT id, curso, estado, valor, enviada_em FROM propostas_comerciais ${w.where} ORDER BY enviada_em DESC LIMIT 20`,
    w.params);
}

export async function pagamento(c: Consulta, id: string) {
  return one<Linha>(c, "SELECT * FROM pagamentos WHERE id = $1", [id]);
}

/** Turma escolhida na ligação pessoal, com a ocupação (sem reservas). */
export async function turmaEscolhida(c: Consulta, regime: Regime, turmaId: number) {
  const sql = regime === "fin"
    ? "SELECT id, nome, local, horario, data_inicio, alunos AS ocupadas, alunos_total AS vagas FROM turmas_fin WHERE id = $1"
    : "SELECT id, nome, local, horario, data_inicio, total_alunos AS ocupadas, vagas FROM turmas_gold WHERE id = $1";
  return one<{ id: number; nome: string; local: string; horario: string; data_inicio: string; ocupadas: number; vagas: number }>(c, sql, [turmaId]);
}
