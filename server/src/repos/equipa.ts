/**
 * Equipa comercial (Gold) e da Financiada: carteira de cada pessoa, propostas, objectivos e o
 * período escolhido comparado com o período anterior. Agregados sempre em SQL.
 */
import type { Periodo } from "./sql.js";
import { many, one, type Consulta } from "./sql.js";

export type Regime = "gold" | "fin";

const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0));
const txt = (v: unknown) => String(v ?? "");
const iso = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString() : String(v));

/** Perfil das contas que formam a equipa de cada regime. */
export function perfilDaEquipa(regime: Regime) {
  return regime === "fin" ? "financiada" : "comercial";
}

export async function listarMembros(c: Consulta, regime: Regime, id?: string) {
  const linhas = await many(
    c,
    `SELECT u.id, u.name, u.email, u.active,
            (SELECT max(s.created_at) FROM sessions s WHERE s.user_id = u.id) AS ultimo_acesso,
            o.meta_pct, o.meta_leads, o.meta_propostas, o.telefone, o.nota
       FROM users u LEFT JOIN comercial_objetivos o ON o.comercial_id = u.id
      WHERE u.role = $1 AND ($2::uuid IS NULL OR u.id = $2::uuid)
      ORDER BY u.active DESC, u.name ASC`,
    [perfilDaEquipa(regime), id ?? null],
  );
  return linhas.map(r => ({
    id: txt(r.id), nome: txt(r.name), email: txt(r.email), ativo: Boolean(r.active), ultimoAcesso: iso(r.ultimo_acesso),
    telefone: txt(r.telefone), nota: txt(r.nota),
    objetivo: { conversao: r.meta_pct == null ? null : num(r.meta_pct), leads: num(r.meta_leads), propostas: num(r.meta_propostas) },
  }));
}

export type Indicadores = { leads: number; pagos: number; receita: number; propostas: number; aceites: number; conversao: number };
export type Carteira = {
  leads: number; porContactar: number; emConversa: number; pagamentoPedido: number; pagos: number; formandos: number;
  receita: number; conversao: number; maisAntigoPorContactar: string | null;
  propostas: number; propostasAbertas: number; aceites: number; recusadas: number; pipeline: number; sucessoPropostas: number;
};

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

/**
 * Indicadores por pessoa num só passo: carteira actual (tudo o que tem atribuído) e,
 * para o período e o período anterior, pré-inscrições entradas, pagas e receita
 * (coorte pela data de entrada) e propostas enviadas/aceites (pela data de envio).
 */
export async function indicadoresEquipa(c: Consulta, regime: Regime, p: Periodo & { anterior: Periodo }, id?: string) {
  const params = [regime, p.de, p.ate, p.anterior.de, p.anterior.ate, id ?? null];
  const leads = await many(
    c,
    `SELECT comercial_id::text AS id,
            count(*)::int AS leads,
            count(*) FILTER (WHERE estado = 'Não contactado')::int AS por_contactar,
            count(*) FILTER (WHERE estado IN ('1º Contacto', '2º Contacto'))::int AS em_conversa,
            count(*) FILTER (WHERE pagamento_pedido_em IS NOT NULL AND estado NOT IN ('Pago', 'Formando', 'Desistiu'))::int AS pagamento_pedido,
            count(*) FILTER (WHERE estado IN ('Pago', 'Formando'))::int AS pagos,
            count(*) FILTER (WHERE estado = 'Formando')::int AS formandos,
            coalesce(sum(preco) FILTER (WHERE estado IN ('Pago', 'Formando')), 0)::float AS receita,
            min(created_at) FILTER (WHERE estado = 'Não contactado') AS mais_antigo,
            count(*) FILTER (WHERE created_at::date BETWEEN $2::date AND $3::date)::int AS leads_a,
            count(*) FILTER (WHERE created_at::date BETWEEN $2::date AND $3::date AND estado IN ('Pago', 'Formando'))::int AS pagos_a,
            coalesce(sum(preco) FILTER (WHERE created_at::date BETWEEN $2::date AND $3::date AND estado IN ('Pago', 'Formando')), 0)::float AS receita_a,
            count(*) FILTER (WHERE created_at::date BETWEEN $4::date AND $5::date)::int AS leads_b,
            count(*) FILTER (WHERE created_at::date BETWEEN $4::date AND $5::date AND estado IN ('Pago', 'Formando'))::int AS pagos_b,
            coalesce(sum(preco) FILTER (WHERE created_at::date BETWEEN $4::date AND $5::date AND estado IN ('Pago', 'Formando')), 0)::float AS receita_b
       FROM preinscricoes
      WHERE regime = $1 AND comercial_id IS NOT NULL AND ($6::uuid IS NULL OR comercial_id = $6::uuid)
      GROUP BY comercial_id`,
    params,
  );
  const props = await many(
    c,
    `SELECT comercial_id::text AS id,
            count(*)::int AS propostas,
            count(*) FILTER (WHERE estado IN ('Enviada', 'Negociação'))::int AS abertas,
            count(*) FILTER (WHERE estado = 'Aceite')::int AS aceites,
            count(*) FILTER (WHERE estado = 'Recusada')::int AS recusadas,
            coalesce(sum(valor) FILTER (WHERE estado IN ('Enviada', 'Negociação')), 0)::float AS pipeline,
            count(*) FILTER (WHERE enviada_em::date BETWEEN $2::date AND $3::date)::int AS propostas_a,
            count(*) FILTER (WHERE enviada_em::date BETWEEN $2::date AND $3::date AND estado = 'Aceite')::int AS aceites_a,
            count(*) FILTER (WHERE enviada_em::date BETWEEN $4::date AND $5::date)::int AS propostas_b,
            count(*) FILTER (WHERE enviada_em::date BETWEEN $4::date AND $5::date AND estado = 'Aceite')::int AS aceites_b
       FROM propostas_comerciais
      WHERE regime = $1 AND ($6::uuid IS NULL OR comercial_id = $6::uuid)
      GROUP BY comercial_id`,
    params,
  );
  const out = new Map<string, { carteira: Carteira; atual: Indicadores; anterior: Indicadores }>();
  const vazio = (): { carteira: Carteira; atual: Indicadores; anterior: Indicadores } => ({
    carteira: {
      leads: 0, porContactar: 0, emConversa: 0, pagamentoPedido: 0, pagos: 0, formandos: 0, receita: 0, conversao: 0,
      maisAntigoPorContactar: null, propostas: 0, propostasAbertas: 0, aceites: 0, recusadas: 0, pipeline: 0, sucessoPropostas: 0,
    },
    atual: { leads: 0, pagos: 0, receita: 0, propostas: 0, aceites: 0, conversao: 0 },
    anterior: { leads: 0, pagos: 0, receita: 0, propostas: 0, aceites: 0, conversao: 0 },
  });
  const de = (k: string) => {
    if (!out.has(k)) out.set(k, vazio());
    return out.get(k)!;
  };
  for (const r of leads) {
    const e = de(txt(r.id));
    Object.assign(e.carteira, {
      leads: num(r.leads), porContactar: num(r.por_contactar), emConversa: num(r.em_conversa),
      pagamentoPedido: num(r.pagamento_pedido), pagos: num(r.pagos), formandos: num(r.formandos), receita: num(r.receita),
      conversao: pct(num(r.pagos), num(r.leads)), maisAntigoPorContactar: iso(r.mais_antigo),
    });
    Object.assign(e.atual, { leads: num(r.leads_a), pagos: num(r.pagos_a), receita: num(r.receita_a), conversao: pct(num(r.pagos_a), num(r.leads_a)) });
    Object.assign(e.anterior, { leads: num(r.leads_b), pagos: num(r.pagos_b), receita: num(r.receita_b), conversao: pct(num(r.pagos_b), num(r.leads_b)) });
  }
  for (const r of props) {
    const e = de(txt(r.id));
    Object.assign(e.carteira, {
      propostas: num(r.propostas), propostasAbertas: num(r.abertas), aceites: num(r.aceites), recusadas: num(r.recusadas),
      pipeline: num(r.pipeline), sucessoPropostas: pct(num(r.aceites), num(r.propostas)),
    });
    Object.assign(e.atual, { propostas: num(r.propostas_a), aceites: num(r.aceites_a) });
    Object.assign(e.anterior, { propostas: num(r.propostas_b), aceites: num(r.aceites_b) });
  }
  return { porPessoa: (k: string) => out.get(k) ?? vazio() };
}

/** O que a pessoa tem para seguir: propostas sem resposta há 5+ dias e pagamentos pedidos à espera. */
export async function aSeguir(c: Consulta, regime: Regime, id: string) {
  const propostas = await many(
    c,
    `SELECT id, cliente_nome, curso, enviada_em, (now()::date - enviada_em::date) AS dias
       FROM propostas_comerciais
      WHERE regime = $1 AND comercial_id = $2 AND estado IN ('Enviada', 'Negociação')
        AND coalesce(resposta_cliente, '') = '' AND enviada_em < now() - interval '5 days'
      ORDER BY enviada_em ASC LIMIT 10`,
    [regime, id],
  );
  const pagamentos = await many(
    c,
    `SELECT id, nome, apelido, curso, pagamento_pedido_em
       FROM preinscricoes
      WHERE regime = $1 AND comercial_id = $2 AND pagamento_pedido_em IS NOT NULL
        AND estado NOT IN ('Pago', 'Formando', 'Desistiu')
      ORDER BY pagamento_pedido_em ASC LIMIT 10`,
    [regime, id],
  );
  return [
    ...propostas.map(p => ({
      tipo: "proposta" as const, id: num(p.id), titulo: txt(p.cliente_nome),
      detalhe: `${txt(p.curso) || "Proposta"} · enviada há ${num(p.dias)} dias, sem resposta`,
    })),
    ...pagamentos.map(l => ({
      tipo: "pagamento" as const, id: num(l.id), titulo: `${txt(l.nome)} ${txt(l.apelido)}`.trim(),
      detalhe: `${txt(l.curso)} · pagamento pedido, à espera do comprovativo`,
    })),
  ];
}

export async function leadsDoMembro(c: Consulta, regime: Regime, id: string) {
  return many(c, "SELECT * FROM preinscricoes WHERE comercial_id = $1 AND regime = $2 ORDER BY created_at DESC LIMIT 200", [id, regime]);
}

export async function notasDoMembro(c: Consulta, regime: Regime, id: string) {
  const linhas = await many(
    c,
    `SELECT c.id, c.preinscricao_id, c.nota, c.created_at, p.nome, p.apelido, p.curso
       FROM preinscricao_contactos c JOIN preinscricoes p ON p.id = c.preinscricao_id
      WHERE p.comercial_id = $1 AND p.regime = $2 ORDER BY c.created_at DESC LIMIT 200`,
    [id, regime],
  );
  return linhas.map(r => ({
    id: num(r.id), preinscricaoId: num(r.preinscricao_id), leadNome: `${txt(r.nome)} ${txt(r.apelido)}`.trim(),
    leadCurso: txt(r.curso), nota: txt(r.nota), criadaEm: iso(r.created_at),
  }));
}

export async function membroExiste(c: Consulta, regime: Regime, id: string) {
  return Boolean(await one(c, "SELECT id FROM users WHERE id = $1::uuid AND role = $2", [id, perfilDaEquipa(regime)]));
}

export async function regimeDaProposta(c: Consulta, id: number) {
  const r = await one<{ regime: string }>(c, "SELECT regime FROM propostas_comerciais WHERE id = $1", [id]);
  return r ? (r.regime === "fin" ? "fin" : "gold") as Regime : null;
}

export async function alterarProposta(c: Consulta, id: number, d: Partial<{ estado: string; respostaCliente: string; valor: number; notas: string; curso: string }>) {
  await one(
    c,
    `UPDATE propostas_comerciais SET
       estado = COALESCE($2, estado), resposta_cliente = COALESCE($3, resposta_cliente), valor = COALESCE($4, valor),
       notas = COALESCE($5, notas), curso = COALESCE($6, curso),
       resposta_em = CASE WHEN $3 IS NOT NULL AND $3 <> '' THEN now() ELSE resposta_em END
     WHERE id = $1 RETURNING id`,
    [id, d.estado ?? null, d.respostaCliente ?? null, d.valor ?? null, d.notas ?? null, d.curso ?? null],
  );
}

export async function leadDaNota(c: Consulta, id: number) {
  return one<{ id: number; regime: string }>(c, "SELECT id, regime FROM preinscricoes WHERE id = $1", [id]);
}

/** Atribui a pré-inscrição ao comercial (se ainda não tiver) e regista a nota no diário e nas notas do lead. */
export async function registarNota(c: Consulta, leadId: number, comercialId: string, actorId: string, nota: string) {
  await one(c, "UPDATE preinscricoes SET comercial_id = COALESCE(comercial_id, $2::uuid) WHERE id = $1 RETURNING id", [leadId, comercialId]);
  await one(c, "INSERT INTO preinscricao_contactos (preinscricao_id, actor_id, nota) VALUES ($1,$2,$3) RETURNING id", [leadId, actorId, nota]);
  const linha = `[${new Date().toISOString().slice(0, 16).replace("T", " ")}] ${nota}`;
  await one(
    c,
    "UPDATE preinscricoes SET notas = CASE WHEN notas = '' THEN $2 ELSE trim(both from notas || E'\\n' || $2) END WHERE id = $1 RETURNING id",
    [leadId, linha],
  );
}

export async function atribuirLead(c: Consulta, leadId: number, comercialId: string) {
  await one(c, "UPDATE preinscricoes SET comercial_id = COALESCE(comercial_id, $2::uuid) WHERE id = $1 RETURNING id", [leadId, comercialId]);
}

export async function gravarObjetivo(c: Consulta, id: string, d: { metaPct?: number; metaLeads?: number; metaPropostas?: number }) {
  await one(
    c,
    `INSERT INTO comercial_objetivos (comercial_id, meta_pct, meta_leads, meta_propostas, updated_at)
     VALUES ($1, COALESCE($2, 0), COALESCE($3, 0), COALESCE($4, 0), now())
     ON CONFLICT (comercial_id) DO UPDATE SET
       meta_pct = COALESCE($2, comercial_objetivos.meta_pct),
       meta_leads = COALESCE($3, comercial_objetivos.meta_leads),
       meta_propostas = COALESCE($4, comercial_objetivos.meta_propostas),
       updated_at = now()
     RETURNING comercial_id`,
    [id, d.metaPct ?? null, d.metaLeads ?? null, d.metaPropostas ?? null],
  );
}

export async function gravarPerfil(c: Consulta, id: string, d: { nome?: string; telefone?: string; nota?: string }) {
  if (d.nome) await one(c, "UPDATE users SET name = $2 WHERE id = $1 RETURNING id", [id, d.nome]);
  await one(
    c,
    `INSERT INTO comercial_objetivos (comercial_id, telefone, nota, updated_at)
     VALUES ($1, COALESCE($2, ''), COALESCE($3, ''), now())
     ON CONFLICT (comercial_id) DO UPDATE SET
       telefone = COALESCE($2, comercial_objetivos.telefone),
       nota = COALESCE($3, comercial_objetivos.nota),
       updated_at = now()
     RETURNING comercial_id`,
    [id, d.telefone ?? null, d.nota ?? null],
  );
}
