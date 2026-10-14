/**
 * Blocos do painel calculados em SQL: funil, "como conheceu", próximas turmas,
 * desagregação, métodos de pagamento e as filas de "a tratar hoje".
 */
import { DOCS_FORMANDO_FIN } from "../../../src/partilhado/dossierDocs.js";
import { sqlReservas } from "../inscricao.js";
import { pgTextArray } from "../pedagogia/util.js";
import {
  DIA_FORMANDO, DIA_LEAD, DIA_PAGO, JOINS_PAGAMENTO, LEAD_ABERTO, OCUPA, PAGO, PENDENTE,
  filtrarFormandosGold, filtrarLeads, filtrarPagamentos, filtrarTurmas, type FiltroPainel,
} from "./estatisticas.js";
import { Filtros, many, one, type Consulta } from "./sql.js";

/** Pré-inscrições criadas no período ($1..$2). */
function noPeriodo(f: FiltroPainel) {
  return filtrarLeads(f, new Filtros([f.de, f.ate])).sempre(`${DIA_LEAD} BETWEEN $1::date AND $2::date`);
}

/** Documentos da ligação pessoal: algum enviado e nenhum por rever ou recusado. */
const DOCS_REVISTOS = `(EXISTS (SELECT 1 FROM preinscricao_docs d WHERE d.preinscricao_id = p.id AND d.tipo <> 'comprovativo')
  AND NOT EXISTS (SELECT 1 FROM preinscricao_docs d WHERE d.preinscricao_id = p.id AND d.tipo <> 'comprovativo'
                   AND COALESCE(d.estado, 'pendente') IN ('pendente', 'recusado')))`;

const PAGOU = `EXISTS (SELECT 1 FROM pagamentos pg WHERE pg.estado ILIKE 'pago%'
  AND (pg.id = p.pagamento_id OR (pg.email <> '' AND lower(pg.email) = lower(p.email) AND lower(trim(pg.curso)) = lower(trim(p.curso)))))`;

const E_FORMANDO_GOLD = `(p.estado = 'Formando' OR EXISTS (SELECT 1 FROM formandos_gold f
  WHERE p.email <> '' AND lower(f.email) = lower(p.email) AND lower(trim(f.curso)) = lower(trim(p.curso))))`;

/** Curso Gold vendido com acesso directo (pago antes, e-learning) — o "pré-pago" do funil antigo. */
const CURSO_PRE_PAGO = `EXISTS (SELECT 1 FROM cursos_gold cg WHERE lower(trim(cg.nome)) = lower(trim(p.curso))
  AND translate(lower(coalesce(cg.tipo, '')), 'áàâãéêíóôõúç', 'aaaaeeiooouc') NOT LIKE '%pre%inscr%'
  AND (translate(lower(coalesce(cg.tipo, '')), 'áàâãéêíóôõúç', 'aaaaeeiooouc') LIKE '%e-learning%'
       OR (lower(trim(coalesce(cg.tipo, ''))) IN ('gold', 'pago') AND lower(trim(coalesce(cg.regime, ''))) = 'e-learning')))`;

/** Formando financiado com todos os documentos obrigatórios validados ($n = lista de ids). */
export const DOCS_FIN_COMPLETOS = (ids: string) => `NOT EXISTS (SELECT 1 FROM unnest(${ids}::text[]) req(id)
  WHERE NOT EXISTS (SELECT 1 FROM formando_docs fd WHERE fd.regime = 'fin' AND fd.formando_id = ff.id AND fd.doc_id = req.id
                     AND COALESCE(fd.estado, '') <> 'recusado' AND (fd.estado = 'validado' OR fd.ok)))`;

/** Ids dos documentos obrigatórios, em texto de array do Postgres ($n::text[]). */
export const DOCS_FIN_OBRIGATORIOS = pgTextArray(DOCS_FORMANDO_FIN.filter(d => d.required).map(d => d.id));

export type EtapaFunil = { id: string; rotulo: string; n: number };

export async function funil(c: Consulta, f: FiltroPainel): Promise<{ principal: EtapaFunil[]; prePagos: EtapaFunil[] | null }> {
  const w = noPeriodo(f);
  if (f.regime === "fin") {
    const r = await one(c, `SELECT count(*)::int AS pre,
        count(*) FILTER (WHERE ${DOCS_REVISTOS} OR p.validada_em IS NOT NULL)::int AS docs,
        count(*) FILTER (WHERE p.validada_em IS NOT NULL)::int AS validadas,
        count(*) FILTER (WHERE p.validada_em IS NOT NULL AND (COALESCE(p.turma_escolhida_id, p.turma_id) IS NOT NULL OR p.estado = 'Formando'))::int AS colocadas,
        count(*) FILTER (WHERE EXISTS (SELECT 1 FROM turma_certificados tc JOIN formandos_fin ff ON ff.id = tc.formando_id
                                        WHERE tc.regime = 'fin' AND tc.emitido AND p.email <> '' AND lower(ff.email) = lower(p.email)))::int AS certificadas
      FROM preinscricoes p ${w.where}`, w.params);
    return {
      principal: [
        { id: "pre", rotulo: "Pré-inscrições", n: Number(r?.pre ?? 0) },
        { id: "docs", rotulo: "Documentos completos", n: Number(r?.docs ?? 0) },
        { id: "validadas", rotulo: "Inscrições validadas", n: Number(r?.validadas ?? 0) },
        { id: "colocadas", rotulo: "Colocadas em turma", n: Number(r?.colocadas ?? 0) },
        { id: "certificadas", rotulo: "Concluíram (certificadas)", n: Number(r?.certificadas ?? 0) },
      ],
      prePagos: null,
    };
  }
  const r = await one(c, `SELECT count(*)::int AS pre,
      count(*) FILTER (WHERE p.contactado_em IS NOT NULL)::int AS contactadas,
      count(*) FILTER (WHERE ${DOCS_REVISTOS} OR p.validada_em IS NOT NULL OR ${E_FORMANDO_GOLD})::int AS docs,
      count(*) FILTER (WHERE p.pagamento_pedido_em IS NOT NULL OR ${PAGOU} OR p.estado IN ('Pago', 'Formando'))::int AS pedido,
      count(*) FILTER (WHERE ${E_FORMANDO_GOLD})::int AS formandos,
      count(*) FILTER (WHERE ${CURSO_PRE_PAGO})::int AS pp_base,
      count(*) FILTER (WHERE ${CURSO_PRE_PAGO} AND (${PAGOU} OR p.estado IN ('Pago', 'Formando')))::int AS pp_pagos,
      count(*) FILTER (WHERE ${CURSO_PRE_PAGO} AND ${E_FORMANDO_GOLD})::int AS pp_formandos
    FROM preinscricoes p ${w.where}`, w.params);
  const ppBase = Number(r?.pp_base ?? 0);
  return {
    principal: [
      { id: "pre", rotulo: "Pré-inscrições", n: Number(r?.pre ?? 0) },
      { id: "contactadas", rotulo: "Contactadas", n: Number(r?.contactadas ?? 0) },
      { id: "docs", rotulo: "Documentos validados", n: Number(r?.docs ?? 0) },
      { id: "pedido", rotulo: "Pagamento pedido", n: Number(r?.pedido ?? 0) },
      { id: "formandos", rotulo: "Formandos", n: Number(r?.formandos ?? 0) },
    ],
    prePagos: ppBase > 0 ? [
      { id: "base", rotulo: "Acesso directo", n: ppBase },
      { id: "pagos", rotulo: "Pagaram", n: Number(r?.pp_pagos ?? 0) },
      { id: "formandos", rotulo: "Formandos", n: Number(r?.pp_formandos ?? 0) },
    ] : null,
  };
}

/** "Como conheceu a ENA" no período, com quantas pré-inscrições passaram a formando. */
export async function conheceu(c: Consulta, f: FiltroPainel) {
  const w = noPeriodo(f);
  const convertida = f.regime === "fin" ? "p.validada_em IS NOT NULL" : E_FORMANDO_GOLD;
  const linhas = await many<{ origem: string; n: number; convertidas: number }>(c, `
    SELECT COALESCE(NULLIF(trim(p.origem), ''), 'Outro') AS origem, count(*)::int AS n,
           count(*) FILTER (WHERE ${convertida})::int AS convertidas
      FROM preinscricoes p ${w.where}
     GROUP BY 1 ORDER BY 2 DESC, 1`, w.params);
  return linhas.map(l => ({ rotulo: l.origem, n: Number(l.n), convertidas: Number(l.convertidas) }));
}

/** Próximas turmas (início a partir de hoje) com ocupação: formandos + reservas. */
export async function proximasTurmas(c: Consulta, f: FiltroPainel, limite = 6) {
  const fin = f.regime === "fin";
  // $1 (lista de documentos obrigatórios) só existe na Financiada: um parâmetro sem uso é recusado pelo Postgres.
  const w = filtrarTurmas(f, new Filtros(fin ? [DOCS_FIN_OBRIGATORIOS] : []))
    .sempre("t.fechada_em IS NULL")
    .sempre("t.data_inicio ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'")
    .sempre("t.data_inicio::date >= (now() AT TIME ZONE 'Europe/Lisbon')::date")
    .sempre(fin ? "t.activa = true" : "t.estado !~* 'cancel|fechad'");
  const formandos = fin ? "formandos_fin" : "formandos_gold";
  const linhas = await many<{ id: number; nome: string; curso: string; local: string; inicio: string; capacidade: number; ocupadas: number; reservas: number; docs: number | null }>(c, `
    SELECT t.id, t.nome, t.curso, t.local, substring(t.data_inicio from 1 for 10) AS inicio,
           ${fin ? "t.alunos_total" : "t.vagas"} AS capacidade,
           (SELECT count(*)::int FROM ${formandos} ff WHERE ff.turma_id = t.id AND ${OCUPA("ff")}) AS ocupadas,
           ${sqlReservas(f.regime, "t.id")} AS reservas,
           ${fin ? `(SELECT count(*)::int FROM formandos_fin ff WHERE ff.turma_id = t.id AND ${OCUPA("ff")} AND ${DOCS_FIN_COMPLETOS("$1")})` : "NULL::int"} AS docs
      FROM ${fin ? "turmas_fin" : "turmas_gold"} t ${w.where}
     ORDER BY t.data_inicio, t.id
     LIMIT ${Math.max(1, Math.min(20, Math.trunc(limite)))}`, w.params);
  return linhas.map(l => ({
    id: Number(l.id), nome: l.nome, curso: l.curso, local: l.local, inicio: l.inicio,
    capacidade: Number(l.capacidade ?? 0), ocupadas: Number(l.ocupadas ?? 0), reservas: Number(l.reservas ?? 0),
    docsCompletos: l.docs == null ? null : Number(l.docs),
  }));
}

export type Eixo = "curso" | "local" | "horario";

const CHAVES: Record<Eixo, { lead: string; formando: string; pagamento: string; vazio: string }> = {
  curso: { lead: "p.curso", formando: "fg.curso", pagamento: "pg.curso", vazio: "Sem curso" },
  local: { lead: "p.local", formando: "fg.local", pagamento: "COALESCE(tp.local, fp.local)", vazio: "Sem local" },
  horario: {
    lead: "p.horario",
    formando: "(SELECT t.horario FROM turmas_gold t WHERE t.id = fg.turma_id)",
    pagamento: "COALESCE(tp.horario, tfp.horario)",
    vazio: "Sem horário",
  },
};

/**
 * Desagregação do período por curso, local ou horário: pré-inscrições, formandos
 * (Gold: fichas novas; Financiada: inscrições validadas) e receita (só Gold).
 */
export async function desagregacao(c: Consulta, f: FiltroPainel, eixo: Eixo) {
  const k = CHAVES[eixo];
  const chave = (expr: string) => `COALESCE(NULLIF(trim(${expr}), ''), '${k.vazio}')`;
  // Os três blocos partilham $1/$2 (período) e numeram os seus filtros a seguir.
  const wl = filtrarLeads(f, new Filtros([f.de, f.ate])).sempre(`${DIA_LEAD} BETWEEN $1::date AND $2::date`);
  const fin = f.regime === "fin";
  const wf = fin
    ? filtrarLeads(f, new Filtros(wl.params)).sempre("p.validada_em IS NOT NULL")
      .sempre("(p.validada_em AT TIME ZONE 'Europe/Lisbon')::date BETWEEN $1::date AND $2::date")
    : filtrarFormandosGold(f, new Filtros(wl.params)).sempre(OCUPA("fg")).sempre(`${DIA_FORMANDO} BETWEEN $1::date AND $2::date`);
  const wp = filtrarPagamentos(f, new Filtros(wf.params)).sempre(PAGO).sempre(`${DIA_PAGO} BETWEEN $1::date AND $2::date`);
  const formandos = fin
    ? `SELECT ${chave(k.lead)} AS chave, count(*)::int AS n FROM preinscricoes p ${wf.where} GROUP BY 1`
    : `SELECT ${chave(k.formando)} AS chave, count(*)::int AS n FROM formandos_gold fg ${wf.where} GROUP BY 1`;
  const receita = fin
    ? "SELECT NULL::text AS chave, 0::float AS v WHERE false"
    : `SELECT ${chave(k.pagamento)} AS chave, COALESCE(sum(pg.valor), 0)::float AS v FROM pagamentos pg ${JOINS_PAGAMENTO} ${wp.where} GROUP BY 1`;
  const linhas = await many<{ chave: string; pre: number; formandos: number; receita: number }>(c, `
    WITH l AS (SELECT ${chave(k.lead)} AS chave, count(*)::int AS n FROM preinscricoes p ${wl.where} GROUP BY 1),
         fo AS (${formandos}),
         r AS (${receita})
    SELECT COALESCE(l.chave, fo.chave, r.chave) AS chave,
           COALESCE(l.n, 0)::int AS pre, COALESCE(fo.n, 0)::int AS formandos, COALESCE(r.v, 0)::float AS receita
      FROM l FULL JOIN fo ON fo.chave = l.chave
             FULL JOIN r ON r.chave = COALESCE(l.chave, fo.chave)
     ORDER BY 2 DESC, 4 DESC, 1
     LIMIT 15`, fin ? wf.params : wp.params);
  return linhas.map(l => ({ chave: l.chave, pre: Number(l.pre), formandos: Number(l.formandos), receita: Math.round(Number(l.receita)) }));
}

/** Pagamentos confirmados no período por método, e o que está por receber (sem limite de datas). */
export async function metodosPagamento(c: Consulta, f: FiltroPainel) {
  const w = filtrarPagamentos(f, new Filtros([f.de, f.ate])).sempre(PAGO).sempre(`${DIA_PAGO} BETWEEN $1::date AND $2::date`);
  const metodos = await many<{ metodo: string; valor: number; n: number }>(c, `
    SELECT COALESCE(NULLIF(trim(pg.metodo), ''), 'Sem método') AS metodo, COALESCE(sum(pg.valor), 0)::float AS valor, count(*)::int AS n
      FROM pagamentos pg ${JOINS_PAGAMENTO} ${w.where}
     GROUP BY 1 ORDER BY 2 DESC`, w.params);
  const wr = filtrarPagamentos(f).sempre(PENDENTE);
  const pend = await one(c, `SELECT COALESCE(sum(pg.valor), 0)::float AS valor, count(*)::int AS n
                               FROM pagamentos pg ${JOINS_PAGAMENTO} ${wr.where}`, wr.params);
  return {
    metodos: metodos.map(m => ({ metodo: m.metodo, valor: Math.round(Number(m.valor)), n: Number(m.n) })),
    porReceber: { valor: Math.round(Number(pend?.valor ?? 0)), n: Number(pend?.n ?? 0) },
  };
}

export type Tarefa = { id: string; n: number; detalhe: string; leadId?: number | null };

/** Filas de trabalho Gold que não dependem do cronograma. */
export async function tarefasGold(c: Consulta, f: FiltroPainel): Promise<Tarefa[]> {
  const w = filtrarLeads(f).sempre(LEAD_ABERTO).sempre("p.validada_em IS NULL");
  const r = await one(c, `SELECT
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM preinscricao_docs d WHERE d.preinscricao_id = p.id
                                      AND d.tipo <> 'comprovativo' AND COALESCE(d.estado, 'pendente') = 'pendente'))::int AS docs_leads,
      (SELECT count(*)::int FROM preinscricao_docs d WHERE d.preinscricao_id IN (SELECT p.id FROM preinscricoes p ${w.where})
          AND d.tipo <> 'comprovativo' AND COALESCE(d.estado, 'pendente') = 'pendente') AS docs_n,
      count(*) FILTER (WHERE COALESCE(p.preco, 0) > 0 AND p.pagamento_pedido_em IS NULL AND p.percurso_concluido_em IS NOT NULL
                         AND ${DOCS_REVISTOS} AND NOT ${PAGOU})::int AS pedir,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM preinscricao_docs d WHERE d.preinscricao_id = p.id
                                      AND d.tipo = 'comprovativo' AND COALESCE(d.estado, 'pendente') = 'pendente'))::int AS comprovativos,
      count(*) FILTER (WHERE p.estado = 'Pré-inscrição' AND p.secretaria_em IS NOT NULL)::int AS secretaria
    FROM preinscricoes p ${w.where}`, w.params);
  const ws = filtrarLeads(f).sempre("p.validada_em IS NOT NULL").sempre(LEAD_ABERTO).sempre("p.email <> ''")
    .sempre("NOT EXISTS (SELECT 1 FROM formandos_gold fg WHERE lower(fg.email) = lower(p.email) AND lower(trim(fg.curso)) = lower(trim(p.curso)))");
  const semFicha = await one(c, `SELECT count(*)::int AS n, (array_agg(p.id ORDER BY p.validada_em))[1] AS id FROM preinscricoes p ${ws.where}`, ws.params);
  const docsLeads = Number(r?.docs_leads ?? 0);
  return [
    { id: "documentos", n: docsLeads, detalhe: `${Number(r?.docs_n ?? 0)} documentos por rever` },
    { id: "pedirPagamento", n: Number(r?.pedir ?? 0), detalhe: "Documentos validados, pagamento por pedir" },
    { id: "comprovativos", n: Number(r?.comprovativos ?? 0), detalhe: "Transferências por confirmar" },
    { id: "semFicha", n: Number(semFicha?.n ?? 0), detalhe: "Validadas: falta inscrever na turma", leadId: semFicha?.id == null ? null : Number(semFicha.id) },
    { id: "secretaria", n: Number(r?.secretaria ?? 0), detalhe: "Dossiê completo na secretaria" },
  ];
}

/** Filas de trabalho da Financiada que não dependem do cronograma. */
export async function tarefasFin(c: Consulta, f: FiltroPainel): Promise<Tarefa[]> {
  const w = filtrarLeads(f).sempre(LEAD_ABERTO).sempre("p.validada_em IS NULL");
  const r = await one(c, `SELECT
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM preinscricao_docs d WHERE d.preinscricao_id = p.id
                                      AND COALESCE(d.estado, 'pendente') = 'pendente'))::int AS docs_leads,
      count(*) FILTER (WHERE p.percurso_concluido_em IS NOT NULL AND ${DOCS_REVISTOS})::int AS colocar
    FROM preinscricoes p ${w.where}`, w.params);
  const wf = new Filtros([DOCS_FIN_OBRIGATORIOS]);
  wf.add("lower(trim(ff.curso)) = lower(trim(?))", f.curso);
  wf.add("EXISTS (SELECT 1 FROM turmas_fin t WHERE t.id = ff.turma_id AND t.local = ?)", f.local);
  wf.add("EXISTS (SELECT 1 FROM turmas_fin t WHERE t.id = ff.turma_id AND t.horario = ?)", f.horario);
  wf.add("EXISTS (SELECT 1 FROM turmas_fin t WHERE t.id = ff.turma_id AND t.financiador = ?)", f.financiador);
  wf.sempre(OCUPA("ff"));
  const fo = await one(c, `SELECT
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM formando_docs fd WHERE fd.regime = 'fin' AND fd.formando_id = ff.id
                        AND fd.file_name <> '' AND COALESCE(fd.estado, 'pendente') = 'pendente' AND NOT fd.ok))::int AS docs,
      count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM formando_docs fd WHERE fd.regime = 'fin' AND fd.formando_id = ff.id
                        AND fd.doc_id = 'ci' AND COALESCE(fd.estado, '') <> 'recusado' AND (fd.estado = 'validado' OR fd.ok)))::int AS iban,
      count(*) FILTER (WHERE NOT (${DOCS_FIN_COMPLETOS("$1")}))::int AS incompletos
    FROM formandos_fin ff ${wf.where}`, wf.params);
  return [
    { id: "documentos", n: Number(r?.docs_leads ?? 0) + Number(fo?.docs ?? 0), detalhe: `${Number(fo?.docs ?? 0)} formandos e ${Number(r?.docs_leads ?? 0)} pré-inscrições com documentos por rever` },
    { id: "colocar", n: Number(r?.colocar ?? 0), detalhe: "Documentos revistos, falta validar e colocar em turma" },
    { id: "iban", n: Number(fo?.iban ?? 0), detalhe: "Sem IBAN validado não há apoios" },
    { id: "incompletos", n: Number(fo?.incompletos ?? 0), detalhe: "Formandos sem os documentos obrigatórios todos" },
  ];
}
