/**
 * Propostas, contratos e modelos (proposta e contrato) do diretório comercial.
 */
import { Filtros, many, one, padraoPesquisa, paginar, valor, type AtorCrm, type Consulta } from "./sql.js";

const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0));
const txt = (v: unknown) => String(v ?? "");
const iso = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString() : String(v));
const idOuNull = (v: unknown) => (v == null ? null : num(v));

/** Ids partilhados das tabelas operacionais (sequência ops_id_seq). */
export async function proximoIdOps(c: Consulta) {
  return num(await valor(c, "SELECT nextval('ops_id_seq')::int AS id"));
}

// ─── Modelos ─────────────────────────────────────────────────────────────────

export type TipoModelo = "proposta" | "contrato";
const TABELA_MODELO: Record<TipoModelo, string> = { proposta: "proposta_templates", contrato: "contrato_templates" };
const TABELA_USO: Record<TipoModelo, string> = { proposta: "propostas_comerciais", contrato: "contratos_comerciais" };

export type DadosModelo = { nome: string; curso: string; valor: number; corpo: string };

/** Modelos de um tipo, com o número de documentos criados a partir de cada um. */
export async function listarModelos(c: Consulta, tipo: TipoModelo) {
  const linhas = await many(
    c,
    `SELECT t.id, t.nome, t.curso, t.valor, t.corpo, t.updated_at,
            (SELECT count(*)::int FROM ${TABELA_USO[tipo]} d WHERE d.template_id = t.id) AS usos
       FROM ${TABELA_MODELO[tipo]} t ORDER BY t.nome ASC`,
  );
  return linhas.map(r => ({
    id: num(r.id), tipo, nome: txt(r.nome), curso: txt(r.curso), valor: num(r.valor), corpo: txt(r.corpo),
    usos: num(r.usos), alteradoEm: iso(r.updated_at),
  }));
}

export async function obterModelo(c: Consulta, tipo: TipoModelo, id: number) {
  const r = await one(c, `SELECT id, nome, curso, valor, corpo FROM ${TABELA_MODELO[tipo]} WHERE id = $1`, [id]);
  return r ? { id: num(r.id), nome: txt(r.nome), curso: txt(r.curso), valor: num(r.valor), corpo: txt(r.corpo) } : null;
}

export async function criarModelo(c: Consulta, tipo: TipoModelo, d: DadosModelo) {
  const id = await valor<number>(
    c,
    `INSERT INTO ${TABELA_MODELO[tipo]} (nome, curso, valor, corpo) VALUES ($1,$2,$3,$4) RETURNING id`,
    [d.nome, d.curso, d.valor, d.corpo],
  );
  return num(id);
}

export async function alterarModelo(c: Consulta, tipo: TipoModelo, id: number, d: Partial<DadosModelo>) {
  const r = await one(
    c,
    `UPDATE ${TABELA_MODELO[tipo]} SET nome = COALESCE($2, nome), curso = COALESCE($3, curso),
            valor = COALESCE($4, valor), corpo = COALESCE($5, corpo), updated_at = now()
      WHERE id = $1 RETURNING id`,
    [id, d.nome ?? null, d.curso ?? null, d.valor ?? null, d.corpo ?? null],
  );
  return Boolean(r);
}

/** Apaga o modelo. Os documentos já criados guardam o seu texto e perdem só a ligação. */
export async function apagarModelo(c: Consulta, tipo: TipoModelo, id: number) {
  const r = await one(c, `DELETE FROM ${TABELA_MODELO[tipo]} WHERE id = $1 RETURNING id`, [id]);
  if (r) await many(c, `UPDATE ${TABELA_USO[tipo]} SET template_id = NULL WHERE template_id = $1 RETURNING id`, [id]);
  return Boolean(r);
}

// ─── Propostas ───────────────────────────────────────────────────────────────

export type FiltroPropostas = {
  q?: string; estado?: string; comercial?: string; regime?: "gold" | "fin"; clienteId?: number;
  pagina?: number; porPagina?: number; ator?: AtorCrm;
};

export async function listarPropostas(c: Consulta, f: FiltroPropostas) {
  const w = new Filtros();
  const q = padraoPesquisa(f.q);
  w.add("(p.cliente_nome ILIKE ? OR p.cliente_email ILIKE ? OR p.curso ILIKE ?)", q, q, q);
  w.add("p.estado = ?", f.estado);
  w.add("p.comercial_id::text = ?", f.comercial);
  w.add("p.regime = ?", f.regime);
  w.add("p.cliente_id = ?", f.clienteId);
  w.visivelPara(f.ator, "p.comercial_id", "p.regime");
  const sql = `
    SELECT p.id, p.cliente_id, p.cliente_nome, p.cliente_email, p.curso, p.valor, p.estado, p.enviada_em,
           p.resposta_cliente, p.resposta_em, p.notas, p.corpo, p.template_id, p.preinscricao_id, p.regime,
           p.comercial_id, u.name AS comercial,
           (SELECT k.id FROM contratos_comerciais k WHERE k.proposta_id = p.id ORDER BY k.id LIMIT 1) AS contrato_id
      FROM propostas_comerciais p LEFT JOIN users u ON u.id = p.comercial_id ${w.where}`;
  const pag = await paginar(c, sql, w.params, { pagina: f.pagina, porPagina: f.porPagina, ordem: "ORDER BY p.enviada_em DESC, p.id DESC" });
  return { ...pag, linhas: pag.linhas.map(mapProposta) };
}

export function mapProposta(r: Record<string, unknown>) {
  return {
    id: num(r.id), clienteId: idOuNull(r.cliente_id), clienteNome: txt(r.cliente_nome), clienteEmail: txt(r.cliente_email),
    curso: txt(r.curso), valor: num(r.valor), estado: txt(r.estado || "Enviada"), enviadaEm: iso(r.enviada_em),
    respostaCliente: txt(r.resposta_cliente), respostaEm: iso(r.resposta_em), notas: txt(r.notas), corpo: txt(r.corpo),
    templateId: idOuNull(r.template_id), preinscricaoId: idOuNull(r.preinscricao_id), regime: txt(r.regime || "gold"),
    comercialId: txt(r.comercial_id), comercial: txt(r.comercial), contratoId: idOuNull(r.contrato_id),
  };
}

/** Contagem das propostas por estado (as fases do separador Propostas). */
export async function propostasPorEstado(c: Consulta, regime?: "gold" | "fin", ator?: AtorCrm) {
  const w = new Filtros([regime ?? null]).sempre("$1::text IS NULL OR regime = $1").visivelPara(ator, "comercial_id", "regime");
  const linhas = await many<{ estado: string; n: number; valor: number }>(
    c,
    `SELECT estado, count(*)::int AS n, coalesce(sum(valor), 0)::float AS valor
       FROM propostas_comerciais ${w.where} GROUP BY estado`,
    w.params,
  );
  return linhas.map(l => ({ estado: l.estado, n: num(l.n), valor: num(l.valor) }));
}

export type NovaProposta = {
  comercialId: string; clienteId: number | null; preinscricaoId: number | null; clienteNome: string; clienteEmail: string;
  curso: string; valor: number; estado: string; respostaCliente: string; notas: string; corpo: string;
  templateId: number | null; regime: "gold" | "fin";
};

export async function criarProposta(c: Consulta, d: NovaProposta) {
  const id = await proximoIdOps(c);
  await one(
    c,
    `INSERT INTO propostas_comerciais
       (id, comercial_id, preinscricao_id, cliente_id, cliente_nome, cliente_email, curso, valor, estado,
        resposta_cliente, resposta_em, notas, regime, corpo, template_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, CASE WHEN $10 <> '' THEN now() END, $11,$12,$13,$14) RETURNING id`,
    [id, d.comercialId, d.preinscricaoId, d.clienteId, d.clienteNome, d.clienteEmail, d.curso, d.valor, d.estado,
      d.respostaCliente, d.notas, d.regime, d.corpo, d.templateId],
  );
  return id;
}

export async function obterProposta(c: Consulta, id: number) {
  const r = await one(
    c,
    `SELECT p.*, u.name AS comercial,
            (SELECT k.id FROM contratos_comerciais k WHERE k.proposta_id = p.id ORDER BY k.id LIMIT 1) AS contrato_id
       FROM propostas_comerciais p LEFT JOIN users u ON u.id = p.comercial_id WHERE p.id = $1`,
    [id],
  );
  return r ? mapProposta(r) : null;
}

// ─── Contratos ───────────────────────────────────────────────────────────────

export async function listarContratos(c: Consulta, f: { q?: string; estado?: string; pagina?: number; porPagina?: number; ator?: AtorCrm }) {
  const w = new Filtros();
  const q = padraoPesquisa(f.q);
  w.add("(k.cliente_nome ILIKE ? OR k.cliente_email ILIKE ? OR k.curso ILIKE ?)", q, q, q);
  w.add("k.estado = ?", f.estado);
  w.visivelPara(f.ator, "k.comercial_id", "k.formando_regime");
  const sql = `
    SELECT k.id, k.cliente_id, k.cliente_nome, k.cliente_email, k.curso, k.valor, k.estado, k.notas, k.corpo,
           k.template_id, k.proposta_id, k.assinado_em, k.created_at, k.updated_at, u.name AS comercial, t.nome AS modelo
      FROM contratos_comerciais k
      LEFT JOIN users u ON u.id = k.comercial_id
      LEFT JOIN contrato_templates t ON t.id = k.template_id ${w.where}`;
  const pag = await paginar(c, sql, w.params, { pagina: f.pagina, porPagina: f.porPagina, ordem: "ORDER BY k.created_at DESC, k.id DESC" });
  return { ...pag, linhas: pag.linhas.map(mapContrato) };
}

function mapContrato(r: Record<string, unknown>) {
  return {
    id: num(r.id), clienteId: idOuNull(r.cliente_id), clienteNome: txt(r.cliente_nome), clienteEmail: txt(r.cliente_email),
    curso: txt(r.curso), valor: num(r.valor), estado: txt(r.estado), notas: txt(r.notas), corpo: txt(r.corpo),
    templateId: idOuNull(r.template_id), modelo: txt(r.modelo), propostaId: idOuNull(r.proposta_id),
    assinadoEm: iso(r.assinado_em), criadoEm: iso(r.created_at), alteradoEm: iso(r.updated_at), comercial: txt(r.comercial),
  };
}

export async function contratosPorEstado(c: Consulta, ator?: AtorCrm) {
  const w = new Filtros().visivelPara(ator, "comercial_id", "formando_regime");
  const linhas = await many<{ estado: string; n: number; valor: number }>(
    c,
    `SELECT estado, count(*)::int AS n, coalesce(sum(valor), 0)::float AS valor FROM contratos_comerciais ${w.where} GROUP BY estado`,
    w.params,
  );
  return linhas.map(l => ({ estado: l.estado, n: num(l.n), valor: num(l.valor) }));
}

export type NovoContrato = {
  comercialId: string; clienteId: number | null; propostaId: number | null; clienteNome: string; clienteEmail: string;
  curso: string; valor: number; notas: string; corpo: string; templateId: number | null; regime: "gold" | "fin";
};

export async function criarContrato(c: Consulta, d: NovoContrato) {
  const id = await proximoIdOps(c);
  await one(
    c,
    `INSERT INTO contratos_comerciais
       (id, comercial_id, cliente_id, proposta_id, cliente_nome, cliente_email, curso, valor, estado, notas, corpo, template_id,
        assinado_em, formando_regime)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Rascunho',$9,$10,$11,NULL,$12) RETURNING id`,
    [id, d.comercialId, d.clienteId, d.propostaId, d.clienteNome, d.clienteEmail, d.curso, d.valor, d.notas, d.corpo, d.templateId, d.regime],
  );
  return id;
}

export async function obterContrato(c: Consulta, id: number) {
  const r = await one(
    c,
    `SELECT k.*, u.name AS comercial, t.nome AS modelo FROM contratos_comerciais k
       LEFT JOIN users u ON u.id = k.comercial_id LEFT JOIN contrato_templates t ON t.id = k.template_id
      WHERE k.id = $1`,
    [id],
  );
  return r ? mapContrato(r) : null;
}

export type AlteracaoContrato = Partial<{
  clienteNome: string; clienteEmail: string; curso: string; valor: number; estado: string; notas: string; corpo: string;
}>;

export async function alterarContrato(c: Consulta, id: number, d: AlteracaoContrato) {
  const r = await one(
    c,
    `UPDATE contratos_comerciais SET
       cliente_nome = COALESCE($2, cliente_nome), cliente_email = COALESCE($3, cliente_email),
       curso = COALESCE($4, curso), valor = COALESCE($5, valor), estado = COALESCE($6, estado),
       notas = COALESCE($7, notas), corpo = COALESCE($8, corpo),
       -- A data da assinatura nunca se apaga: um contrato assinado e depois cancelado continua a ter sido assinado.
       assinado_em = CASE WHEN $6 = 'Assinado' AND assinado_em IS NULL THEN now() ELSE assinado_em END,
       updated_at = now()
     WHERE id = $1 RETURNING id`,
    [id, d.clienteNome ?? null, d.clienteEmail ?? null, d.curso ?? null, d.valor ?? null, d.estado ?? null, d.notas ?? null, d.corpo ?? null],
  );
  return Boolean(r);
}

export async function apagarContrato(c: Consulta, id: number) {
  const r = await one(c, "DELETE FROM contratos_comerciais WHERE id = $1 RETURNING id", [id]);
  return Boolean(r);
}

export async function obterClienteBasico(c: Consulta, id: number) {
  return one<{ nome: string; email: string }>(c, "SELECT nome, email FROM crm_clientes WHERE id = $1", [id]);
}
