/**
 * Campanhas comerciais. Os números vêm das pré-inscrições ligadas pela coluna
 * `preinscricoes.campanha_id` (nunca por nome) e dos pagamentos dessas pré-inscrições.
 */
import { Filtros, many, one, padraoPesquisa, type Consulta } from "./sql.js";

const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0));
const txt = (v: unknown) => String(v ?? "");

export type EstadoCampanha = "ativas" | "terminadas" | "todas";
export type FiltroCampanhas = { estado?: EstadoCampanha; canal?: string; curso?: string; responsavel?: string; q?: string };

/** Activa: sem fim, ou com fim a partir de hoje. */
const ATIVA = "(coalesce(c.fim, '') = '' OR c.fim >= to_char(now(), 'YYYY-MM-DD'))";

const COLUNAS = "c.id, c.nome, c.data, c.fim, c.encarregado, c.curso, c.canal, c.notas, c.custo";

/** Estatísticas por campanha, calculadas na base de dados. */
const STATS = `
  SELECT count(*)::int AS pre,
         count(*) FILTER (WHERE p.estado IN ('Pago', 'Formando') OR pg.estado ILIKE 'pago%')::int AS pagos,
         coalesce(sum(CASE WHEN pg.estado ILIKE 'pago%' THEN pg.valor
                           WHEN p.estado IN ('Pago', 'Formando') THEN p.preco ELSE 0 END), 0)::float AS receita,
         count(*) FILTER (WHERE p.estado = 'Não contactado')::int AS por_contactar,
         count(*) FILTER (WHERE p.estado = 'Desistiu')::int AS desistiram,
         count(*) FILTER (WHERE p.estado = 'Formando')::int AS formandos,
         coalesce(sum(p.preco), 0)::float AS receita_estimada
    FROM preinscricoes p LEFT JOIN pagamentos pg ON pg.id = p.pagamento_id
   WHERE p.campanha_id = c.id`;

function filtros(f: FiltroCampanhas) {
  const w = new Filtros();
  if (f.estado === "ativas") w.sempre(ATIVA);
  if (f.estado === "terminadas") w.sempre(`NOT ${ATIVA}`);
  w.add("c.canal = ?", f.canal);
  w.add("c.curso = ?", f.curso);
  w.add("c.encarregado = ?", f.responsavel);
  const q = padraoPesquisa(f.q);
  w.add("(c.nome ILIKE ? OR c.notas ILIKE ?)", q, q);
  return w;
}

function mapCampanha(r: Record<string, unknown>) {
  const pre = num(r.pre);
  const pagos = num(r.pagos);
  const receita = Math.round(num(r.receita));
  const custo = num(r.custo);
  return {
    id: num(r.id), nome: txt(r.nome), data: txt(r.data), fim: txt(r.fim), encarregado: txt(r.encarregado),
    curso: txt(r.curso), canal: txt(r.canal), notas: txt(r.notas), custo, ativa: Boolean(r.ativa),
    preinscricoes: pre, pagos, receita, porContactar: num(r.por_contactar), desistiram: num(r.desistiram),
    formandos: num(r.formandos), receitaEstimada: Math.round(num(r.receita_estimada)),
    conversao: pre ? Math.round((pagos / pre) * 100) : 0,
    ticketMedio: pagos ? Math.round(receita / pagos) : 0,
    roi: custo > 0 ? Math.round(((receita - custo) / custo) * 100) : null,
  };
}

export type CampanhaComStats = ReturnType<typeof mapCampanha>;

export async function listarCampanhas(c: Consulta, f: FiltroCampanhas = {}) {
  const w = filtros(f);
  const linhas = await many(
    c,
    `SELECT ${COLUNAS}, ${ATIVA} AS ativa, s.* FROM campanhas c LEFT JOIN LATERAL (${STATS}) s ON true
      ${w.where} ORDER BY c.data DESC, c.id DESC LIMIT 500`,
    w.params,
  );
  return linhas.map(mapCampanha);
}

export async function obterCampanha(c: Consulta, id: number) {
  const r = await one(
    c,
    `SELECT ${COLUNAS}, ${ATIVA} AS ativa, s.* FROM campanhas c LEFT JOIN LATERAL (${STATS}) s ON true WHERE c.id = $1`,
    [id],
  );
  if (!r) return null;
  const origens = await many<{ origem: string; n: number }>(
    c,
    `SELECT coalesce(nullif(trim(origem), ''), 'Sem origem') AS origem, count(*)::int AS n
       FROM preinscricoes WHERE campanha_id = $1 GROUP BY 1 ORDER BY n DESC, origem`,
    [id],
  );
  return { ...mapCampanha(r), origens: origens.map(o => ({ origem: o.origem, n: num(o.n) })) };
}

/** Totais das campanhas activas (faixa de indicadores). */
export async function resumoCampanhas(c: Consulta) {
  const r = await one(
    c,
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE t.ativa)::int AS ativas,
            coalesce(sum(t.pre) FILTER (WHERE t.ativa), 0)::int AS pre,
            coalesce(sum(t.por_contactar) FILTER (WHERE t.ativa), 0)::int AS por_contactar,
            coalesce(sum(t.pagos) FILTER (WHERE t.ativa), 0)::int AS pagos,
            coalesce(sum(t.receita) FILTER (WHERE t.ativa), 0)::float AS receita,
            coalesce(sum(t.custo) FILTER (WHERE t.ativa), 0)::float AS custo,
            coalesce(sum(t.receita) FILTER (WHERE t.ativa AND t.custo > 0), 0)::float AS receita_com_custo
       FROM (SELECT c.custo, ${ATIVA} AS ativa, s.* FROM campanhas c LEFT JOIN LATERAL (${STATS}) s ON true) t`,
  );
  const custo = num(r?.custo);
  const recComCusto = num(r?.receita_com_custo);
  return {
    total: num(r?.total), ativas: num(r?.ativas), preinscricoes: num(r?.pre), porContactar: num(r?.por_contactar),
    pagos: num(r?.pagos), receita: Math.round(num(r?.receita)), custo,
    roi: custo > 0 ? Math.round(((recComCusto - custo) / custo) * 100) : null,
  };
}

export type DadosCampanha = {
  nome: string; data: string; encarregado: string; curso: string; custo: number; fim: string; canal: string; notas: string;
};

export async function criarCampanha(c: Consulta, d: DadosCampanha) {
  const r = await one<{ id: number }>(
    c,
    `INSERT INTO campanhas (id, nome, data, encarregado, preinscricoes, pagos, receita, custo, curso, fim, canal, notas)
     VALUES (nextval('ops_id_seq')::int, $1, $2, $3, 0, 0, 0, $4, $5, $6, $7, $8) RETURNING id`,
    [d.nome, d.data, d.encarregado, d.custo, d.curso || null, d.fim, d.canal, d.notas],
  );
  return num(r?.id);
}

export async function alterarCampanha(c: Consulta, id: number, d: Partial<DadosCampanha>) {
  const r = await one(
    c,
    `UPDATE campanhas SET nome = COALESCE($2, nome), data = COALESCE($3, data), encarregado = COALESCE($4, encarregado),
            custo = COALESCE($5, custo), curso = COALESCE($6, curso), fim = COALESCE($7, fim),
            canal = COALESCE($8, canal), notas = COALESCE($9, notas)
      WHERE id = $1 RETURNING id`,
    [id, d.nome ?? null, d.data ?? null, d.encarregado ?? null, d.custo ?? null, d.curso ?? null, d.fim ?? null, d.canal ?? null, d.notas ?? null],
  );
  return Boolean(r);
}

/** Apaga a campanha; as pré-inscrições ficam, só perdem a ligação. */
export async function apagarCampanha(c: Consulta, id: number) {
  await many(c, "UPDATE preinscricoes SET campanha_id = NULL WHERE campanha_id = $1 RETURNING id", [id]);
  const r = await one(c, "DELETE FROM campanhas WHERE id = $1 RETURNING id", [id]);
  return Boolean(r);
}
