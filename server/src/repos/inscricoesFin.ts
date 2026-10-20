/**
 * Inscrições da Financiada (candidaturas por UFCD/turma). Guardam-se em catalog_items
 * com kind = 'inscricoes_fin'; aqui fica a leitura paginada e as escritas do ecrã próprio.
 */
import { Filtros, many, one, ordenarPor, padraoPesquisa, paginar, type Consulta, type Pagina } from "./sql.js";

export const ESTADOS_INSCRICAO_FIN = ["Recebida", "Em análise", "Elegível", "Colocado na turma", "Indeferido"] as const;
export const DOCS_INSCRICAO_FIN = ["cc", "ch", "cu", "ci", "ce"] as const;

export type LinhaInscricaoFin = {
  id: number;
  inscrito: string;
  nome: string;
  apelido: string;
  email: string;
  telf: string;
  curso: string;
  ufcd: string;
  turma: string;
  turma_id: number | null;
  estado: string;
  docs: Record<string, boolean>;
  docs_ok: number;
  formando_id: number | null;
};

const BASE = `
  SELECT ci.id,
         COALESCE(ci.payload->>'inscrito', to_char(ci.updated_at AT TIME ZONE 'Europe/Lisbon', 'YYYY-MM-DD')) AS inscrito,
         COALESCE(ci.payload->>'nome', '') AS nome,
         COALESCE(ci.payload->>'apelido', '') AS apelido,
         COALESCE(ci.payload->>'email', '') AS email,
         COALESCE(ci.payload->>'telf', '') AS telf,
         COALESCE(ci.payload->>'curso', '') AS curso,
         COALESCE(NULLIF(c.ufcd_cod, ''), NULLIF(ci.payload->>'ufcd', ''), '') AS ufcd,
         COALESCE(NULLIF(ci.payload->>'turma', '-'), '') AS turma,
         t.id AS turma_id,
         COALESCE(ci.payload->>'estado', 'Recebida') AS estado,
         $2::int AS docs_total,
         COALESCE(ci.payload->'docs', '{}'::jsonb) AS docs,
         (SELECT count(*)::int FROM jsonb_each(CASE WHEN jsonb_typeof(ci.payload->'docs') = 'object' THEN ci.payload->'docs' ELSE '{}'::jsonb END) e
           WHERE e.key IN (SELECT jsonb_array_elements_text($1::jsonb)) AND e.value = 'true'::jsonb) AS docs_ok,
         (SELECT f.id FROM formandos_fin f
           WHERE COALESCE(ci.payload->>'email', '') <> '' AND lower(f.email) = lower(ci.payload->>'email')
             AND lower(trim(f.curso)) = lower(trim(COALESCE(ci.payload->>'curso', '')))
           ORDER BY f.id DESC LIMIT 1) AS formando_id
    FROM catalog_items ci
    LEFT JOIN LATERAL (SELECT cf.ufcd_cod FROM cursos_fin cf
                        WHERE lower(trim(cf.nome_comercial)) = lower(trim(COALESCE(ci.payload->>'curso', '')))
                           OR lower(trim(cf.ufcd)) = lower(trim(COALESCE(ci.payload->>'curso', '')))
                        ORDER BY cf.id LIMIT 1) c ON true
    LEFT JOIN LATERAL (SELECT tf.id FROM turmas_fin tf
                        WHERE lower(trim(tf.nome)) = lower(trim(COALESCE(ci.payload->>'turma', '')))
                        ORDER BY tf.id DESC LIMIT 1) t ON true
   WHERE ci.kind = 'inscricoes_fin' AND jsonb_typeof(ci.payload) = 'object'`;

const ORDEM: Record<string, string> = {
  inscrito: "x.inscrito",
  nome: "lower(x.nome), lower(x.apelido)",
  curso: "lower(x.curso)",
  turma: "lower(x.turma)",
  estado: "x.estado",
  docs: "x.docs_ok",
};

export type FiltrosInscricoesFin = {
  estado?: string; curso?: string; turma?: string; docs?: "completos" | "em_falta"; q?: string;
  pagina?: number; porPagina?: number; ordem?: string;
};

function filtros(f: FiltrosInscricoesFin, comEstado: boolean) {
  const w = new Filtros([JSON.stringify(DOCS_INSCRICAO_FIN), DOCS_INSCRICAO_FIN.length]);
  if (comEstado) w.add("x.estado = ?", f.estado);
  w.add("lower(trim(x.curso)) = lower(trim(?))", f.curso);
  w.add("lower(trim(x.turma)) = lower(trim(?))", f.turma);
  if (f.docs === "completos") w.sempre("x.docs_ok >= $2::int");
  if (f.docs === "em_falta") w.sempre("x.docs_ok < $2::int");
  const q = padraoPesquisa(f.q);
  if (q) w.add("((x.nome || ' ' || x.apelido) ILIKE ? OR x.email ILIKE ? OR x.curso ILIKE ? OR x.ufcd ILIKE ? OR x.turma ILIKE ?)", q, q, q, q, q);
  return w;
}

export async function listarInscricoesFin(c: Consulta, f: FiltrosInscricoesFin): Promise<Pagina<LinhaInscricaoFin> & { contagens: Record<string, number> }> {
  const w = filtros(f, true);
  const pagina = await paginar<LinhaInscricaoFin>(c, `SELECT * FROM (${BASE}) x ${w.where}`, w.params, {
    pagina: f.pagina, porPagina: f.porPagina, ordem: ordenarPor(ORDEM, f.ordem, "x.inscrito DESC, x.id DESC"),
  });
  const ws = filtros(f, false);
  const linhas = await many<{ estado: string; n: number }>(
    c, `SELECT x.estado, count(*)::int AS n FROM (${BASE}) x ${ws.where} GROUP BY x.estado`, ws.params,
  );
  const contagens: Record<string, number> = { todas: 0 };
  for (const l of linhas) {
    contagens[l.estado] = Number(l.n);
    contagens.todas += Number(l.n);
  }
  return { ...pagina, contagens };
}

export async function inscricaoFin(c: Consulta, id: number) {
  return one<{ id: number; payload: Record<string, unknown> }>(
    c, "SELECT id, payload FROM catalog_items WHERE id = $1 AND kind = 'inscricoes_fin'", [id],
  );
}

export async function inserirInscricaoFin(c: Consulta, id: number, payload: Record<string, unknown>) {
  await one(c, "INSERT INTO catalog_items (id, kind, regime, payload) VALUES ($1, 'inscricoes_fin', 'fin', $2::jsonb)", [id, JSON.stringify(payload)]);
}

export async function atualizarInscricaoFin(c: Consulta, id: number, payload: Record<string, unknown>) {
  await one(c, "UPDATE catalog_items SET payload = $2::jsonb, updated_at = now() WHERE id = $1 AND kind = 'inscricoes_fin'", [id, JSON.stringify(payload)]);
}

export async function apagarInscricaoFin(c: Consulta, id: number) {
  return one<{ id: number; payload: Record<string, unknown> }>(
    c, "DELETE FROM catalog_items WHERE id = $1 AND kind = 'inscricoes_fin' RETURNING id, payload", [id],
  );
}
