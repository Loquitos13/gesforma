/**
 * Formandos (Gold e Financiada): listas paginadas e leituras da ficha.
 * As escritas estão em `formandosEscrita.ts` e os documentos em `formandosDocs.ts`.
 */
import { DOCS_FORMANDO_FIN, DOCS_FORMANDO_GOLD } from "../../../src/partilhado/dossierDocs.js";
import { Filtros, many, one, ordenarPor, padraoPesquisa, paginar, tabelaRegime, type Consulta, type Pagina, type Regime } from "./sql.js";

/** Documentos que contam para "documentos completos" em cada regime. */
export function docsObrigatorios(regime: Regime): string[] {
  const base = regime === "fin" ? DOCS_FORMANDO_FIN : DOCS_FORMANDO_GOLD;
  return base.filter(d => d.required).map(d => d.id);
}

export type FiltrosFormandos = {
  regime: Regime;
  separador?: "turmas" | "avulsos" | "pendencias" | "elegiveis" | "docs_em_falta" | "todos";
  q?: string;
  curso?: string;
  turma?: number;
  local?: string;
  estado?: string;
  pagamento?: "pago" | "por_pagar" | "oferta" | "isento";
  docs?: "completos" | "em_falta";
  acesso?: "com" | "sem";
  pagina?: number;
  porPagina?: number;
  ordem?: string;
};

export type LinhaFormando = {
  id: number;
  nome: string;
  apelido: string;
  email: string;
  telf: string | null;
  pii_enc: string | null;
  curso: string;
  local: string;
  turma_id: number | null;
  turma_nome: string | null;
  ufcd: string | null;
  estado: string;
  inscrito: string;
  pago: boolean;
  valor: number | string;
  metodo: string;
  situacao_pagamento: string;
  tem_acesso: boolean;
  docs_ok: number;
  docs_recusados: number;
};

const SITUACAO = `CASE WHEN lower(trim(f.metodo)) = 'oferta' THEN 'oferta'
                       WHEN f.pago THEN 'pago'
                       WHEN f.valor <= 0 THEN 'isento'
                       ELSE 'por_pagar' END`;

const ATIVO = "NOT (lower(x.estado) LIKE 'desist%' OR lower(x.estado) = 'indeferido')";

function base(regime: Regime) {
  const formandos = tabelaRegime("formandos", regime);
  const turmas = tabelaRegime("turmas", regime);
  const gold = regime === "gold";
  return `SELECT f.id, f.nome, f.apelido, f.email, f.telf, f.pii_enc, f.curso,
                 ${gold ? "f.local" : "COALESCE(t.local, '')"} AS local,
                 f.turma_id, t.nome AS turma_nome,
                 ${gold ? "NULL::text" : "NULLIF(t.ufcd_cod, '')"} AS ufcd,
                 f.estado,
                 ${gold ? "f.inscrito" : "''"} AS inscrito,
                 ${gold ? "f.pago" : "true"} AS pago,
                 ${gold ? "f.valor" : "0"} AS valor,
                 ${gold ? "f.metodo" : "'Financiada'"} AS metodo,
                 ${gold ? SITUACAO : "'isento'"} AS situacao_pagamento,
                 (f.user_id IS NOT NULL) AS tem_acesso,
                 $2::int AS docs_total,
                 (SELECT count(*)::int FROM formando_docs d
                   WHERE d.regime = '${regime}' AND d.formando_id = f.id AND d.estado = 'validado' AND d.doc_id IN (SELECT jsonb_array_elements_text($1::jsonb))) AS docs_ok,
                 (SELECT count(*)::int FROM formando_docs d
                   WHERE d.regime = '${regime}' AND d.formando_id = f.id AND d.estado = 'recusado') AS docs_recusados
            FROM ${formandos} f
            LEFT JOIN ${turmas} t ON t.id = f.turma_id`;
}

/** Condição de cada separador (sobre a subconsulta `x`). `$2` é o número de documentos obrigatórios. */
function condSeparador(regime: Regime, separador: FiltrosFormandos["separador"]): string | null {
  const docsFalta = "x.docs_ok < $2::int";
  if (regime === "gold") {
    if (separador === "turmas") return "x.turma_id IS NOT NULL";
    if (separador === "avulsos") return "x.turma_id IS NULL";
    if (separador === "pendencias") {
      return `${ATIVO} AND (x.situacao_pagamento = 'por_pagar' OR NOT x.tem_acesso OR (x.turma_id IS NOT NULL AND ${docsFalta}))`;
    }
    return null;
  }
  if (separador === "elegiveis") return `${ATIVO} AND x.docs_ok >= $2::int`;
  if (separador === "docs_em_falta") return `${ATIVO} AND ${docsFalta}`;
  return null;
}

const ORDEM: Record<string, string> = {
  nome: "lower(x.nome), lower(x.apelido)",
  curso: "lower(x.curso)",
  turma: "lower(x.turma_nome)",
  estado: "x.estado",
  inscrito: "x.inscrito",
  valor: "x.valor",
  docs: "x.docs_ok",
  id: "x.id",
};

function filtrosComuns(f: FiltrosFormandos, obrig: string[]) {
  const w = new Filtros([JSON.stringify(obrig), obrig.length]);
  const sep = condSeparador(f.regime, f.separador);
  if (sep) w.sempre(sep);
  const q = padraoPesquisa(f.q);
  if (q) {
    w.add(
      `((x.nome || ' ' || x.apelido) ILIKE ? OR x.email ILIKE ? OR x.curso ILIKE ? OR COALESCE(x.turma_nome, '') ILIKE ? OR x.id::text = ?)`,
      q, q, q, q, (f.q ?? "").trim().replace(/^#/, ""),
    );
  }
  w.add("lower(trim(x.curso)) = lower(trim(?))", f.curso);
  w.add("x.turma_id = ?", f.turma);
  w.add("lower(trim(x.local)) = lower(trim(?))", f.local);
  w.add("x.estado = ?", f.estado);
  w.add("x.situacao_pagamento = ?", f.regime === "gold" ? f.pagamento : undefined);
  if (f.docs === "completos") w.sempre("x.docs_ok >= $2::int");
  if (f.docs === "em_falta") w.sempre("x.docs_ok < $2::int");
  if (f.acesso === "com") w.sempre("x.tem_acesso");
  if (f.acesso === "sem") w.sempre("NOT x.tem_acesso");
  return w;
}

/** Lista paginada com os totais de cada separador (para as contagens nos separadores). */
export async function listarFormandos(c: Consulta, f: FiltrosFormandos): Promise<Pagina<LinhaFormando> & { contagens: Record<string, number> }> {
  const obrig = docsObrigatorios(f.regime);
  const w = filtrosComuns(f, obrig);
  const sql = `SELECT * FROM (${base(f.regime)}) x ${w.where}`;
  const pagina = await paginar<LinhaFormando>(c, sql, w.params, {
    pagina: f.pagina, porPagina: f.porPagina, ordem: ordenarPor(ORDEM, f.ordem, "x.id DESC"),
  });
  // Contagens dos separadores com os mesmos filtros, menos o separador.
  const semSep = filtrosComuns({ ...f, separador: "todos" }, obrig);
  const separadores = f.regime === "gold" ? ["turmas", "avulsos", "pendencias"] as const : ["elegiveis", "docs_em_falta"] as const;
  const partes = separadores.map(s => `count(*) FILTER (WHERE ${condSeparador(f.regime, s)})::int AS ${s}`);
  const cont = await one<Record<string, number>>(
    c,
    `SELECT count(*)::int AS todos, ${partes.join(", ")} FROM (${base(f.regime)}) x ${semSep.where}`,
    semSep.params,
  );
  const contagens: Record<string, number> = {};
  for (const [k, v] of Object.entries(cont ?? {})) contagens[k] = Number(v ?? 0);
  return { ...pagina, contagens };
}

/** Linha completa da ficha (com as colunas cifradas, para o serviço decifrar). */
export async function linhaFormando(c: Consulta, regime: Regime, id: number) {
  return one(c, `SELECT * FROM ${tabelaRegime("formandos", regime)} WHERE id = $1`, [id]);
}

export async function turmaDoFormando(c: Consulta, regime: Regime, turmaId: number) {
  const gold = regime === "gold";
  return one<{ id: number; nome: string; curso: string; local: string; horario: string; data_inicio: string; estado: string; ufcd: string; fechada: boolean }>(
    c,
    `SELECT id, nome, curso, local, horario, data_inicio, estado,
            ${gold ? "''" : "COALESCE(ufcd_cod, '')"} AS ufcd, (fechada_em IS NOT NULL) AS fechada
       FROM ${tabelaRegime("turmas", regime)} WHERE id = $1`,
    [turmaId],
  );
}

/** Estado da conta da área do formando (último acesso = última sessão aberta). */
export async function contaDoFormando(c: Consulta, userId: string) {
  return one<{ ativa: boolean; mudar_palavra_passe: boolean; ultimo_acesso: string | Date | null; criada_em: string | Date | null }>(
    c,
    `SELECT u.active AS ativa, u.must_change_password AS mudar_palavra_passe, u.created_at AS criada_em,
            (SELECT max(s.created_at) FROM sessions s WHERE s.user_id = u.id) AS ultimo_acesso
       FROM users u WHERE u.id = $1::uuid`,
    [userId],
  );
}

/** Pagamentos ligados ao formando Gold (pelo id e, nos antigos, pelo email e curso). */
export async function pagamentosDoFormando(c: Consulta, id: number, email: string, curso: string) {
  return many<{ id: string; valor: unknown; metodo: string; estado: string; data: string; pago_em: string | Date | null }>(
    c,
    `SELECT id, valor, metodo, estado, data, pago_em FROM pagamentos
      WHERE formando_id = $1
         OR (formando_id IS NULL AND $2 <> '' AND lower(email) = lower($2) AND lower(trim(curso)) = lower(trim($3)))
      ORDER BY COALESCE(pago_em, now()) DESC, id DESC
      LIMIT 20`,
    [id, email, curso],
  );
}

/** Pré-inscrição de origem (mesmo email e curso), para a ficha mostrar de onde veio. */
export async function preinscricaoDoFormando(c: Consulta, regime: Regime, email: string, curso: string) {
  if (!email) return null;
  return one<{ id: number; estado: string; validada_em: string | Date | null; pagamento_pedido_em: string | Date | null; origem: string }>(
    c,
    `SELECT id, estado, validada_em, pagamento_pedido_em, COALESCE(origem, '') AS origem FROM preinscricoes
      WHERE COALESCE(regime, 'gold') = $1 AND lower(email) = lower($2) AND lower(trim(curso)) = lower(trim($3))
      ORDER BY id DESC LIMIT 1`,
    [regime, email, curso],
  );
}

export async function certificadoDoFormando(c: Consulta, regime: Regime, turmaId: number, formandoId: number) {
  return one<{ emitido: boolean; nota: unknown; emitido_em: string | Date | null; ficheiro_url: string; ficheiro_nome: string }>(
    c,
    `SELECT emitido, nota, emitido_em, COALESCE(ficheiro_url, '') AS ficheiro_url, COALESCE(ficheiro_nome, '') AS ficheiro_nome
       FROM turma_certificados WHERE regime = $1 AND turma_id = $2 AND formando_id = $3`,
    [regime, turmaId, formandoId],
  );
}

/** Histórico da ficha: registo de auditoria das acções sobre este formando. */
export async function historicoDoFormando(c: Consulta, regime: Regime, id: number, limite = 40) {
  const entidades = regime === "gold" ? ["formandos_gold", "formando"] : ["formandos_fin", "formando_fin", "formando"];
  return many<{ id: number; action: string; created_at: string | Date; autor: string; meta: unknown }>(
    c,
    `SELECT a.id, a.action, a.created_at, COALESCE(u.name, '') AS autor, a.meta
       FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
      WHERE a.entity IN (SELECT jsonb_array_elements_text($1::jsonb)) AND a.entity_id = $2
        AND (a.entity <> 'formando' OR COALESCE(a.meta->>'regime', $3) = $3)
      ORDER BY a.created_at DESC
      LIMIT $4`,
    [JSON.stringify(entidades), String(id), regime, limite],
  );
}
