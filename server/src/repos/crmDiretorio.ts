/**
 * Diretório comercial: clientes (empresas), parceiros, propostas, contratos e modelos.
 * Todo o SQL deste domínio vive aqui.
 */
import { Filtros, many, one, ordenarPor, padraoPesquisa, paginar, valor, type Consulta } from "./sql.js";

export const ESTADOS_PROPOSTA = ["Enviada", "Negociação", "Aceite", "Recusada", "Expirada"] as const;
export const ESTADOS_CONTRATO = ["Rascunho", "Por assinar", "Assinado", "Cancelado"] as const;
/** Estados de proposta ainda em aberto (texto fixo, nunca vem do pedido). */
const ABERTAS = "('Enviada', 'Negociação')";

const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0));
const txt = (v: unknown) => String(v ?? "");
const iso = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString() : String(v));
const idOuNull = (v: unknown) => (v == null ? null : num(v));

// ─── Clientes ────────────────────────────────────────────────────────────────

export type FiltroClientes = { q?: string; estado?: string; pagina?: number; porPagina?: number; ordem?: string };

/** Clientes com o resumo comercial: propostas, valor em aberto, contratos e o estado da última proposta. */
export async function listarClientes(c: Consulta, f: FiltroClientes) {
  const base = `
    SELECT c.id, c.nome, c.email, c.telf, c.nif, c.notas, c.created_at,
           (SELECT count(*)::int FROM propostas_comerciais p WHERE p.cliente_id = c.id) AS propostas,
           (SELECT coalesce(sum(p.valor), 0)::float FROM propostas_comerciais p
             WHERE p.cliente_id = c.id AND p.estado IN ${ABERTAS}) AS em_aberto,
           (SELECT count(*)::int FROM contratos_comerciais k WHERE k.cliente_id = c.id) AS contratos,
           coalesce((SELECT p.estado FROM propostas_comerciais p WHERE p.cliente_id = c.id
                      ORDER BY p.enviada_em DESC, p.id DESC LIMIT 1), 'Sem propostas') AS ultimo_estado,
           (SELECT p.curso FROM propostas_comerciais p WHERE p.cliente_id = c.id
             ORDER BY p.enviada_em DESC, p.id DESC LIMIT 1) AS ultimo_curso
      FROM crm_clientes c`;
  const w = new Filtros();
  const q = padraoPesquisa(f.q);
  w.add("(t.nome ILIKE ? OR t.email ILIKE ? OR t.nif ILIKE ?)", q, q, q);
  w.add("t.ultimo_estado = ?", f.estado);
  const sql = `SELECT * FROM (${base}) t ${w.where}`;
  const ordem = ordenarPor(
    { nome: "t.nome", emAberto: "t.em_aberto", contratos: "t.contratos", recente: "t.created_at" },
    f.ordem,
    "t.nome ASC",
  );
  const pag = await paginar(c, sql, w.params, { pagina: f.pagina, porPagina: f.porPagina, ordem });
  return { ...pag, linhas: pag.linhas.map(mapClienteResumo) };
}

function mapClienteResumo(r: Record<string, unknown>) {
  return {
    id: num(r.id), nome: txt(r.nome), email: txt(r.email), telf: txt(r.telf), nif: txt(r.nif), notas: txt(r.notas),
    propostas: num(r.propostas), emAberto: num(r.em_aberto), contratos: num(r.contratos),
    ultimoEstado: txt(r.ultimo_estado), ultimoCurso: txt(r.ultimo_curso),
  };
}

/** Totais do diretório de clientes (cabeçalho do ecrã). */
export async function resumoClientes(c: Consulta) {
  const r = await one<{ clientes: number; em_aberto: number; com_contrato: number }>(
    c,
    `SELECT (SELECT count(*)::int FROM crm_clientes) AS clientes,
            (SELECT coalesce(sum(valor), 0)::float FROM propostas_comerciais
              WHERE cliente_id IS NOT NULL AND estado IN ${ABERTAS}) AS em_aberto,
            (SELECT count(DISTINCT cliente_id)::int FROM contratos_comerciais WHERE cliente_id IS NOT NULL) AS com_contrato`,
  );
  return { clientes: num(r?.clientes), emAberto: num(r?.em_aberto), comContrato: num(r?.com_contrato) };
}

export async function obterCliente(c: Consulta, id: number) {
  const cli = await one(c, "SELECT id, nome, email, telf, nif, notas, created_at FROM crm_clientes WHERE id = $1", [id]);
  if (!cli) return null;
  const propostas = await many(
    c,
    `SELECT p.id, p.curso, p.valor, p.estado, p.corpo, p.enviada_em, p.resposta_cliente, u.name AS comercial,
            (SELECT k.id FROM contratos_comerciais k WHERE k.proposta_id = p.id ORDER BY k.id LIMIT 1) AS contrato_id
       FROM propostas_comerciais p LEFT JOIN users u ON u.id = p.comercial_id
      WHERE p.cliente_id = $1 ORDER BY p.enviada_em DESC, p.id DESC`,
    [id],
  );
  const contratos = await many(
    c,
    `SELECT k.id, k.curso, k.valor, k.estado, k.created_at, k.assinado_em, k.proposta_id
       FROM contratos_comerciais k WHERE k.cliente_id = $1 ORDER BY k.created_at DESC`,
    [id],
  );
  return {
    id: num(cli.id), nome: txt(cli.nome), email: txt(cli.email), telf: txt(cli.telf), nif: txt(cli.nif), notas: txt(cli.notas),
    criadoEm: iso(cli.created_at),
    propostas: propostas.map(p => ({
      id: num(p.id), curso: txt(p.curso), valor: num(p.valor), estado: txt(p.estado), corpo: txt(p.corpo),
      enviadaEm: iso(p.enviada_em), respostaCliente: txt(p.resposta_cliente), comercial: txt(p.comercial),
      contratoId: idOuNull(p.contrato_id),
    })),
    contratos: contratos.map(k => ({
      id: num(k.id), curso: txt(k.curso), valor: num(k.valor), estado: txt(k.estado),
      criadoEm: iso(k.created_at), assinadoEm: iso(k.assinado_em), propostaId: idOuNull(k.proposta_id),
    })),
  };
}

export type DadosCliente = { nome: string; email: string; telf: string; nif: string; notas: string };

export async function criarCliente(c: Consulta, d: DadosCliente) {
  const id = await valor<number>(
    c,
    "INSERT INTO crm_clientes (nome, email, telf, nif, notas) VALUES ($1,$2,$3,$4,$5) RETURNING id",
    [d.nome, d.email, d.telf, d.nif, d.notas],
  );
  return num(id);
}

export async function alterarCliente(c: Consulta, id: number, d: Partial<DadosCliente>) {
  const r = await one(
    c,
    `UPDATE crm_clientes SET nome = COALESCE($2, nome), email = COALESCE($3, email), telf = COALESCE($4, telf),
            nif = COALESCE($5, nif), notas = COALESCE($6, notas) WHERE id = $1 RETURNING id`,
    [id, d.nome ?? null, d.email ?? null, d.telf ?? null, d.nif ?? null, d.notas ?? null],
  );
  return Boolean(r);
}

/** Frase a explicar porque não se pode apagar (propostas ou contratos ligados), ou null. */
export async function bloqueioApagarCliente(c: Consulta, id: number) {
  const r = await one<{ p: number; k: number }>(
    c,
    `SELECT (SELECT count(*)::int FROM propostas_comerciais WHERE cliente_id = $1) AS p,
            (SELECT count(*)::int FROM contratos_comerciais WHERE cliente_id = $1) AS k`,
    [id],
  );
  const partes: string[] = [];
  if (num(r?.p)) partes.push(num(r?.p) === 1 ? "1 proposta" : `${num(r?.p)} propostas`);
  if (num(r?.k)) partes.push(num(r?.k) === 1 ? "1 contrato" : `${num(r?.k)} contratos`);
  return partes.length ? `Este cliente tem ${partes.join(" e ")}. Apague-os ou mantenha o cliente.` : null;
}

export async function apagarCliente(c: Consulta, id: number) {
  const r = await one(c, "DELETE FROM crm_clientes WHERE id = $1 RETURNING id", [id]);
  return Boolean(r);
}

// ─── Parceiros ───────────────────────────────────────────────────────────────

export type DadosParceiro = {
  nome: string; email: string; telf: string; tipo: string; notas: string; comercialId: string | null; retribuicao: string;
};

export async function listarParceiros(c: Consulta, f: { q?: string; tipo?: string; comercial?: string }) {
  const w = new Filtros();
  const q = padraoPesquisa(f.q);
  w.add("(p.nome ILIKE ? OR p.email ILIKE ? OR p.notas ILIKE ?)", q, q, q);
  w.add("p.tipo = ?", f.tipo);
  w.add("p.comercial_id::text = ?", f.comercial);
  const linhas = await many(
    c,
    `SELECT p.id, p.nome, p.email, p.telf, p.tipo, p.notas, p.comercial_id, p.retribuicao, p.created_at, u.name AS comercial
       FROM crm_parceiros p LEFT JOIN users u ON u.id = p.comercial_id
       ${w.where} ORDER BY p.nome ASC LIMIT 500`,
    w.params,
  );
  return linhas.map(r => ({
    id: num(r.id), nome: txt(r.nome), email: txt(r.email), telf: txt(r.telf), tipo: txt(r.tipo), notas: txt(r.notas),
    comercialId: r.comercial_id ? txt(r.comercial_id) : null, comercial: txt(r.comercial), retribuicao: txt(r.retribuicao),
    criadoEm: iso(r.created_at),
  }));
}

export async function criarParceiro(c: Consulta, d: DadosParceiro) {
  const id = await valor<number>(
    c,
    `INSERT INTO crm_parceiros (nome, email, telf, tipo, notas, comercial_id, retribuicao)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [d.nome, d.email, d.telf, d.tipo, d.notas, d.comercialId, d.retribuicao],
  );
  return num(id);
}

export async function alterarParceiro(c: Consulta, id: number, d: Partial<DadosParceiro>) {
  const r = await one(
    c,
    `UPDATE crm_parceiros SET nome = COALESCE($2, nome), email = COALESCE($3, email), telf = COALESCE($4, telf),
            tipo = COALESCE($5, tipo), notas = COALESCE($6, notas),
            comercial_id = CASE WHEN $8 THEN $7::uuid ELSE comercial_id END,
            retribuicao = COALESCE($9, retribuicao)
      WHERE id = $1 RETURNING id`,
    [id, d.nome ?? null, d.email ?? null, d.telf ?? null, d.tipo ?? null, d.notas ?? null,
      d.comercialId ?? null, d.comercialId !== undefined, d.retribuicao ?? null],
  );
  return Boolean(r);
}

export async function apagarParceiro(c: Consulta, id: number) {
  const r = await one(c, "DELETE FROM crm_parceiros WHERE id = $1 RETURNING id", [id]);
  return Boolean(r);
}

export async function existeUtilizador(c: Consulta, id: string) {
  return Boolean(await one(c, "SELECT id FROM users WHERE id = $1", [id]));
}
