/** Dossiê técnico-pedagógico: factos da turma, itens com estado, resumo e matriz turma × secção. */
import { sessoesLectivas } from "../assiduidade.js";
import type { Db } from "../db/pool.js";
import {
  aplicarPercursoNoItem, buildDtpItems, comporModelo, dtpEstrutura, dtpPct, estadoPorFicheirosCurso, parseDtpModelo, tipoPercursoDoItem,
  DTP_MODELO_VAZIO, type CursoFicheiroRef, type DtpCounts, type DtpEstado, type DtpFacts, type DtpItem, type DtpModelo, type DtpPercurso,
} from "../dtpModel.js";
import { DTP_CATEGORIAS, dtpCategoriaDe } from "../dtpPasta.js";
import { TOPICOS_FIN, topicoFinDe } from "../dtpTopicosFin.js";
import * as repo from "../repos/dtp.js";
import { listarDocumentos } from "../repos/pedagogiaSessoes.js";
import { cursoIdDaTurma, formandosDaTurma, listarTurmasDtp, mapaCursos, type FormandoTurma, type TurmaRow } from "../repos/pedagogiaTurma.js";
import type { AnexoLinha } from "../repos/dtp.js";
import { resultadosDaTurma } from "../resultados.js";
import { fontesEmLote } from "./dtpLote.js";
import { asArr, asObj, pipCounts, planoPreenchido, simCounts, type Regime } from "./util.js";

export type EntidadeDtp = { id: number; nome: string; modelo: DtpModelo };

export const mapModelo = (row: { excluidos: unknown; extra: unknown; incluidos?: unknown } | null | undefined): DtpModelo => parseDtpModelo(row ?? undefined);

export async function loadModelo(db: Db, regime: Regime, cursoId: number | null): Promise<DtpModelo> {
  if (cursoId == null) return DTP_MODELO_VAZIO;
  return mapModelo(await repo.modeloDoCurso(db, regime, cursoId));
}

export async function entidadeDoCurso(db: Db, cursoId: number | null): Promise<EntidadeDtp | null> {
  if (cursoId == null) return null;
  const found = await repo.entidadeDoCurso(db, cursoId);
  if (!found) return null;
  return { id: Number(found.id), nome: String(found.nome ?? ""), modelo: mapModelo(found) };
}

export async function packDoCurso(db: Db, regime: Regime, cursoId: number | null) {
  const curso = await loadModelo(db, regime, cursoId);
  if (regime !== "gold") return { curso, entidade: null as EntidadeDtp | null, efectivo: curso };
  const entidade = await entidadeDoCurso(db, cursoId);
  return { curso, entidade, efectivo: comporModelo(entidade?.modelo ?? DTP_MODELO_VAZIO, curso) };
}

async function modeloDaTurma(db: Db, regime: Regime, turma: TurmaRow) {
  const pack = await packDoCurso(db, regime, await cursoIdDaTurma(db, regime, turma.curso));
  return { modelo: pack.efectivo, entidade: pack.entidade?.nome ?? null };
}

const CHAVES_FIN = ["cc", "ch", "cu", "ci", "ce", "morada", "contrato", "rgpd"];

type EstadoPercurso = "validado" | "pendente" | "recusado";
type ContagemPercurso = Pick<DtpPercurso, "submetidos" | "validados" | "recusados"> & { porFormando?: Map<number, EstadoPercurso> };

/** Resultado de cada formando (resultados.ts), só o que o dossiê usa: pauta e certificados. */
export type ResultadoDtp = { id: number; aprovado: boolean | null; elegivel: boolean; certificado: { emitido: boolean; ficheiro: boolean } };

/** Formadores da turma (responsável + equipa), em minúsculas. */
export function nomesFormadoresDaTurma(turma: { formador?: unknown; formadores?: unknown }) {
  return [...new Set([String(turma.formador ?? ""), ...asArr(turma.formadores).map(String)].map(n => n.trim().toLowerCase()).filter(Boolean))];
}

/** Tudo o que o dossiê de uma turma lê da base. Carrega-se por turma ou em lote (ver dtpLote.ts). */
export type FontesTurma = {
  sessoes: { sessao_n: number; plano: unknown; sumario: unknown; presencas: unknown }[];
  docs: { label: string; payload: unknown }[];
  /** Formandos que contam (sem desistentes/indeferidos na Gold, sem indeferidos na Financiada). */
  formandos: FormandoTurma[];
  docsValidados: { formando_id: number; doc_id: string }[];
  inqueritos: { publico: string; enviado: unknown }[];
  resultados: ResultadoDtp[];
  /** Formadores da turma encontrados na base, com os documentos carregados. */
  formadores: { nome: string; ccp_validade: string | null; docs: string[] | null }[];
  manual: Record<string, DtpEstado>;
  anexos: AnexoLinha[];
  ficheiros: { ambito: string; requisito_id: string; pessoa_id: number | null; pessoa_nome: string }[];
  percurso: { total: number; porTipo: Map<string, ContagemPercurso> } | null;
  /** Gold: pagamentos pagos da turma e quantos já têm recibo. */
  recibos?: { pagos: number; comRecibo: number } | null;
};

async function fontesDaTurma(db: Db, regime: Regime, turma: TurmaRow): Promise<FontesTurma> {
  const [sessoes, docs, formandos, manual, anexos, cursoId, res, formadores] = await Promise.all([
    repo.sessoesParaFactos(db, regime, turma.id),
    listarDocumentos(db, regime, turma.id),
    formandosDaTurma(db, regime, turma, { soQueContam: true }),
    repo.estadosManuais(db, regime, turma.id),
    repo.anexosDaTurma(db, regime, turma.id).catch(() => []),
    cursoIdDaTurma(db, regime, turma.curso),
    // Sem a regra do dossiê (dtpEmFalta): não há recursão.
    resultadosDaTurma(db, regime, turma.id),
    repo.docsDosFormadores(db, nomesFormadoresDaTurma(turma)),
  ]);
  const [docsValidados, inqueritos, ficheiros, percurso, recibos] = await Promise.all([
    formandos.length ? repo.docsValidadosDosFormandos(db, regime, formandos.map(f => f.id)) : Promise.resolve([]),
    repo.inqueritosEnviadosATurma(db, regime, turma.id).catch(() => []),
    cursoId == null ? Promise.resolve([]) : repo.ficheirosDoCurso(db, regime, cursoId).catch(() => []),
    regime === "gold" ? percursoGoldDaTurma(db, turma) : Promise.resolve(null),
    regime === "gold" ? repo.recibosDasTurmasGold(db, [turma.id]).catch(() => []) : Promise.resolve([]),
  ]);
  const resultados = res?.formandos ?? [];
  const r = recibos[0];
  return {
    sessoes, docs, formandos, docsValidados, inqueritos, resultados, formadores, manual, anexos, ficheiros, percurso,
    recibos: r ? { pagos: Number(r.pagos), comRecibo: Number(r.com_recibo) } : null,
  };
}

/**
 * Documentos dos formadores da turma: cada formador conta se tem o documento carregado na ficha.
 * O CCP conta só se a validade não tiver expirado na data de início da turma (é aí que a auditoria o exige;
 * usar hoje faria cair o item em turmas já fechadas).
 */
function docsFormadores(turma: TurmaRow, f: FontesTurma): Record<string, DtpCounts> {
  const nomes = nomesFormadoresDaTurma(turma);
  const total = nomes.length;
  const porNome = new Map(f.formadores.map(x => [x.nome, x]));
  const inicio = String(turma.data_inicio ?? "").slice(0, 10);
  const out: Record<string, DtpCounts> = {};
  for (const doc of ["cc", "cv", "ccp", "habilitacoes"]) {
    const done = nomes.filter(n => {
      const fm = porNome.get(n);
      if (!fm || !(fm.docs ?? []).includes(doc)) return false;
      if (doc !== "ccp" || !fm.ccp_validade) return true;
      return !/^\d{4}-\d{2}-\d{2}$/.test(inicio) || fm.ccp_validade.slice(0, 10) >= inicio;
    }).length;
    out[doc] = { done, total };
  }
  return out;
}

const sim = (v: unknown) => v === true || v === "true" || v === "t";

function factosDe(regime: Regime, turma: TurmaRow, f: FontesTurma): DtpFacts {
  // Planos, sumários e presenças só existem nas sessões lectivas (presencial e síncrona).
  const sessoesTotal = sessoesLectivas(turma.cronograma).length;
  const lectivas = f.sessoes.filter(r => Number(r.sessao_n) >= 1 && Number(r.sessao_n) <= sessoesTotal);
  const planos = lectivas.filter(r => planoPreenchido(r.plano)).length;
  const sumarios = lectivas.filter(r => Boolean(asObj(r.sumario).assinado)).length;
  // Folha conta quando as presenças foram validadas (o que o fecho exige). A Financiada não tem sumário.
  const presencas = lectivas.filter(r => sim(asObj(r.sumario).presencasValidadas)).length;

  const docByLabel = (re: RegExp) => f.docs.find(d => re.test(d.label));
  const pip = pipCounts(docByLabel(/^pip$/i)?.payload ?? docByLabel(/pip/i)?.payload);
  const simIni = simCounts(f.docs.find(d => /simula/i.test(d.label) && /inicial/i.test(d.label))?.payload);
  const simFim = simCounts(f.docs.find(d => /simula/i.test(d.label) && /final/i.test(d.label))?.payload);

  const docs: Record<string, DtpCounts> = {};
  const total = f.formandos.length;
  if (total > 0) {
    const porPessoa = new Map<number, Set<string>>();
    const contagem = new Map<string, number>();
    for (const r of f.docsValidados) {
      contagem.set(r.doc_id, (contagem.get(r.doc_id) ?? 0) + 1);
      const set = porPessoa.get(r.formando_id) ?? new Set<string>();
      set.add(r.doc_id);
      porPessoa.set(r.formando_id, set);
    }
    for (const [docId, n] of contagem) docs[docId] = { done: n, total };
    const tem = (p: { id: number; docs: Record<string, unknown> }, id: string) => Boolean(porPessoa.get(p.id)?.has(id) || asObj(p.docs[id]).ok);
    if (regime === "fin") {
      for (const key of CHAVES_FIN) docs[key] = { done: f.formandos.filter(p => tem(p, key)).length, total };
      docs["rgpd-contratos"] = { done: f.formandos.filter(p => tem(p, "contrato") && tem(p, "rgpd")).length, total };
    }
    const bases = regime === "gold" ? ["cc", "contrato", "pip", "exp", "regulamento"] : CHAVES_FIN;
    for (const key of bases) docs[key] ??= { done: 0, total };
  }

  // Total = inquéritos enviados à turma; sem nenhum enviado fica em falta.
  const contar = (publico: string): DtpCounts => {
    const lista = f.inqueritos.filter(r => r.publico === publico);
    if (!lista.length) return { done: 0, total: 1 };
    return { done: lista.filter(r => sim(r.enviado)).length, total: lista.length };
  };
  const inqueritosFormador = regime === "fin" ? contar("formador") : null;
  const inqueritosFormandos = contar("formando");
  const inqueritosPos = regime === "fin" ? contar("pos") : null;

  // Pauta e certificados: só os formandos que contam no dossiê.
  const ids = new Set(f.formandos.map(p => p.id));
  const res = f.resultados.filter(r => ids.has(r.id));
  const elegiveis = res.filter(r => r.elegivel);
  const pauta: DtpCounts | null = total > 0 ? { done: res.filter(r => r.aprovado != null).length, total } : null;

  return {
    inqueritosFormador,
    inqueritosFormandos,
    inqueritosPos,
    sessoes: { done: sessoesTotal, total: sessoesTotal },
    planos: { done: planos, total: sessoesTotal },
    sumarios: { done: sumarios, total: sessoesTotal },
    presencas: { done: presencas, total: sessoesTotal },
    formandos: total,
    // Elegíveis com aproveitamento: na Financiada conta o PDF externo, na Gold o certificado emitido.
    certificados: {
      done: elegiveis.filter(r => (regime === "fin" ? r.certificado.ficheiro : r.certificado.emitido)).length,
      total: elegiveis.length,
    },
    pauta,
    formadorDocs: docsFormadores(turma, f),
    contratos: docs.contrato ?? { done: 0, total },
    pip,
    simInicial: simIni,
    simFinal: simFim,
    docs,
  };
}

/** Contagem do percurso público (Gold) por tipo, a partir das pré-inscrições escolhidas e dos seus documentos. */
export function contarPercurso(
  formandos: { id?: number; email: string }[],
  porEmail: Map<string, number>,
  docs: { preinscricao_id: number; tipo: string; estado: string }[],
) {
  const total = formandos.length;
  const porTipo = new Map<string, ContagemPercurso>();
  if (total === 0) return { total, porTipo };
  const rank = { validado: 3, pendente: 2, recusado: 1 } as const;
  const melhor = new Map<string, keyof typeof rank>();
  for (const doc of docs) {
    const estado = doc.estado === "validado" || doc.estado === "recusado" ? doc.estado : "pendente";
    const chave = `${doc.preinscricao_id}:${doc.tipo}`;
    const anterior = melhor.get(chave);
    if (!anterior || rank[estado] > rank[anterior]) melhor.set(chave, estado);
  }
  for (const tipo of new Set(docs.map(d => d.tipo).filter(Boolean))) {
    const c = { submetidos: 0, validados: 0, recusados: 0, porFormando: new Map<number, EstadoPercurso>() };
    for (const f of formandos) {
      const leadId = f.email ? porEmail.get(f.email) : undefined;
      const estado = leadId == null ? undefined : melhor.get(`${leadId}:${tipo}`);
      if (estado && f.id != null) c.porFormando.set(f.id, estado);
      if (estado === "validado") c.validados += 1;
      else if (estado === "pendente") c.submetidos += 1;
      else if (estado === "recusado") c.recusados += 1;
    }
    porTipo.set(tipo, c);
  }
  return { total, porTipo };
}

async function percursoGoldDaTurma(db: Db, turma: TurmaRow) {
  const formandos = (await repo.emailsFormandosGold(db, turma.id, turma.nome)).map(r => ({ id: Number(r.id), email: r.email }));
  if (!formandos.length) return { total: 0, porTipo: new Map<string, ContagemPercurso>() };
  const emails = [...new Set(formandos.map(r => r.email).filter(Boolean))];
  const leads = await repo.leadsDosEmails(db, emails, turma.curso, turma.id);
  const porEmail = new Map(leads.map(r => [r.email, r.id]));
  const docs = await repo.docsDasPreinscricoes(db, [...new Set(leads.map(r => r.id))]);
  return contarPercurso(formandos, porEmail, docs);
}

/** Documento da ficha do formando que corresponde ao item (o mesmo que os factos contam). */
function docDaFichaDoItem(item: { auto?: string }) {
  if (item.auto === "contratos") return "contrato";
  return item.auto?.startsWith("doc-") ? item.auto.slice("doc-".length) : null;
}

/** Percurso + ficha do formando, por formando: conta como entregue se uma das fontes tem o documento validado. */
function fundirPercurso(item: DtpItem, c: ContagemPercurso, total: number, f: FontesTurma): DtpPercurso {
  const doc = docDaFichaDoItem(item);
  if (!c.porFormando || !doc) return { submetidos: c.submetidos, validados: c.validados, recusados: c.recusados, total };
  const naFicha = new Set(f.docsValidados.filter(d => d.doc_id === doc).map(d => Number(d.formando_id)));
  const out = { submetidos: 0, validados: 0, recusados: 0, total };
  for (const p of f.formandos) {
    const estado = naFicha.has(p.id) ? "validado" : c.porFormando.get(p.id);
    if (estado === "validado") out.validados += 1;
    else if (estado === "pendente") out.submetidos += 1;
    else if (estado === "recusado") out.recusados += 1;
  }
  return out;
}

function itensDe(regime: Regime, turma: TurmaRow, f: FontesTurma, modelo: DtpModelo) {
  const facts = factosDe(regime, turma, f);
  const byItem = new Map(f.anexos.map(r => [r.item_id, r]));
  const anexoLegado: Record<string, string> = { "relatorio-pos": "inqueritos-turma" };
  const refs: CursoFicheiroRef[] = f.ficheiros.map(x => ({ ambito: x.ambito, requisitoId: x.requisito_id, pessoaId: x.pessoa_id, pessoaNome: x.pessoa_nome }));
  const formandosCurso = refs.some(x => x.ambito === "formando") ? f.formandos : [];
  let items: DtpItem[] = buildDtpItems(regime, facts, f.manual, modelo).map(item => {
    const a = byItem.get(item.id) ?? (anexoLegado[item.id] ? byItem.get(anexoLegado[item.id]!) : undefined);
    const anexo = a?.drive_file_id ? { fileName: a.file_name, url: a.drive_url, driveFileId: a.drive_file_id } : null;
    let next = item;
    // Só os itens sem regra automática ficam no dossiê com um anexo; os outros dependem dos dados.
    if (anexo && !item.auto && item.origem === "manual" && item.estado === "falta") {
      next = { ...item, estado: "ok" as const, detalhe: `Ficheiro no Drive: ${anexo.fileName}` };
    }
    const porPartes = estadoPorFicheirosCurso(next.id, refs, formandosCurso, turma.formador ?? "");
    if (porPartes?.estado === "ok") return { ...next, anexo, estado: "ok" as const, detalhe: porPartes.detalhe };
    if (porPartes?.estado === "parcial" && next.estado !== "ok") return { ...next, anexo, estado: "parcial" as const, detalhe: porPartes.detalhe };
    return { ...next, anexo };
  });
  if (regime === "gold" && f.percurso) {
    const percurso = f.percurso;
    items = items.map(item => {
      const tipo = tipoPercursoDoItem(item);
      if (!tipo) return item;
      const contagem = percurso.porTipo.get(tipo) ?? { submetidos: 0, validados: 0, recusados: 0 };
      const depois = aplicarPercursoNoItem(item, fundirPercurso(item, contagem, percurso.total, f), Boolean(f.manual[item.id]));
      // O percurso junta-se à ficha: nunca tira o visto que os dados já deram.
      return item.estado === "ok" ? { ...item, percurso: depois.percurso } : depois;
    });
  }
  // Gold: cada pagamento pago com o seu recibo emitido (na Drive) também conta para os comprovativos.
  const rec = regime === "gold" ? f.recibos : null;
  if (rec && rec.pagos > 0) {
    items = items.map(item => {
      if (item.id !== "recibos" || f.manual[item.id] || item.estado === "ok") return item;
      const detalhe = `${rec.comRecibo}/${rec.pagos} pagamentos com recibo emitido.`;
      if (rec.comRecibo >= rec.pagos) return { ...item, estado: "ok" as const, detalhe };
      return rec.comRecibo > 0 ? { ...item, estado: "parcial" as const, detalhe } : { ...item, detalhe: `${detalhe} ${item.detalhe ?? ""}`.trim() };
    });
  }
  return { items, facts };
}

/** Dossiê de uma turma. Com `fontes` (carregadas em lote) não faz consultas por turma. */
export async function dtpForTurma(
  db: Db, regime: Regime, turma: TurmaRow, modeloPre?: DtpModelo, entidadePre?: string | null, fontes?: FontesTurma,
) {
  const carregado = modeloPre ? { modelo: modeloPre, entidade: entidadePre ?? null } : await modeloDaTurma(db, regime, turma);
  const { items, facts } = itensDe(regime, turma, fontes ?? await fontesDaTurma(db, regime, turma), carregado.modelo);
  return {
    items,
    pct: dtpPct(items),
    ok: items.filter(i => i.estado === "ok").length,
    parcial: items.filter(i => i.estado === "parcial").length,
    falta: items.filter(i => i.estado === "falta").length,
    total: items.length,
    facts,
    entidade: carregado.entidade,
  };
}

/** Itens que só se fecham com o certificado emitido. */
const ITENS_CERTIFICADO = new Set(["certificados", "entrega-certificados"]);
/** Avaliação de impacto pós-formação: faz-se meses depois do fim, não pode travar o fecho. */
const ITENS_POS_FORMACAO = new Set(["inqueritos-pos", "relatorio-pos"]);

/**
 * Itens do dossiê ainda em falta (usado quando as regras o exigem).
 * - certificado: o próprio certificado e a fase de fecho (relatório, satisfação, pauta…) vêm depois; não contam.
 * - fecho: não contam a pós-formação nem, na Financiada, o relatório final (o fecho gera-o e anexa-o).
 *   Os certificados contam só se houver elegíveis: depois de fechada só o administrador os emite,
 *   e sem elegíveis o item nunca fecharia.
 */
export async function dtpEmFalta(db: Db, regime: Regime, turma: TurmaRow, para: "certificado" | "fecho" = "fecho") {
  const dtp = await dtpForTurma(db, regime, turma);
  const ignora = (i: DtpItem) => para === "certificado"
    ? ITENS_CERTIFICADO.has(i.id) || i.fase === "depois"
    : ITENS_POS_FORMACAO.has(i.id) || (regime === "fin" && i.id === "relatorio")
      || (ITENS_CERTIFICADO.has(i.id) && dtp.facts.certificados.total <= 0);
  return dtp.items.filter(i => i.estado !== "ok" && !ignora(i)).map(i => i.label);
}

/** Itens do dossiê desta turma (base do regime + extras do modelo do curso). */
export async function estruturaDoDossie(db: Db, regime: Regime, turma: TurmaRow) {
  return dtpEstrutura(regime, (await modeloDaTurma(db, regime, turma)).modelo);
}

/** Modelo efectivo de cada turma do regime, carregado de uma vez. */
async function modelosPorTurma(db: Db, regime: Regime) {
  const [turmas, modelos, entidades, ligacoes, cursos] = await Promise.all([
    listarTurmasDtp(db, regime),
    repo.modelosDosCursos(db, regime),
    regime === "gold" ? repo.listarEntidades(db) : Promise.resolve([]),
    regime === "gold" ? repo.entidadesDosCursosGold(db) : Promise.resolve([]),
    mapaCursos(db, regime),
  ]);
  const porCurso = new Map<number, DtpModelo>(modelos.map(r => [Number(r.curso_id), mapModelo(r)]));
  const porEntidade = new Map<number, DtpModelo>(entidades.map(r => [Number(r.id), mapModelo(r)]));
  const entidadePorCurso = new Map<number, number>();
  for (const l of ligacoes) if (l.entidade_responsavel_id != null) entidadePorCurso.set(Number(l.id), Number(l.entidade_responsavel_id));
  return turmas.map(turma => {
    const cursoId = cursos.get(turma.curso.trim().toLowerCase()) ?? null;
    const curso = cursoId != null ? porCurso.get(cursoId) ?? DTP_MODELO_VAZIO : DTP_MODELO_VAZIO;
    const entidadeId = cursoId != null ? entidadePorCurso.get(cursoId) : undefined;
    const entidade = entidadeId != null ? porEntidade.get(entidadeId) ?? DTP_MODELO_VAZIO : DTP_MODELO_VAZIO;
    return { turma, cursoId, modelo: regime === "gold" ? comporModelo(entidade, curso) : curso };
  });
}

/** Corre `fn` sobre a lista com no máximo `n` pedidos em paralelo (Postgres aguenta; PGlite serializa). */
async function emLotes<T, R>(lista: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(lista.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, lista.length) }, async () => {
    while (i < lista.length) { const k = i++; out[k] = await fn(lista[k]!); }
  }));
  return out;
}

export type EstadoSeccao = "completo" | "parcial" | "falta" | "bloqueante" | "na";

/** Secções do dossiê do regime: pastas 01–06 (Gold) ou tópicos 1–14 (Financiada). */
export function seccoesDtp(regime: Regime) {
  return regime === "gold"
    ? DTP_CATEGORIAS.map(c => ({ id: c.id, label: c.label, pasta: c.pasta }))
    : TOPICOS_FIN.map(t => ({ id: String(t.n), label: t.label, pasta: t.pasta }));
}

function seccaoDoItem(regime: Regime, item: DtpItem) {
  return regime === "gold" ? dtpCategoriaDe(item) : String(item.topico ?? topicoFinDe(item.id));
}

function estadoDaSeccao(itens: DtpItem[]): EstadoSeccao {
  if (!itens.length) return "na";
  if (itens.every(i => i.estado === "ok")) return "completo";
  if (itens.some(i => i.estado !== "ok" && i.bloqueante)) return "bloqueante";
  if (itens.some(i => i.estado !== "falta")) return "parcial";
  return "falta";
}

/** Matriz turma × secção do dossiê, com o que falta em cada turma. */
export async function dtpMatriz(db: Db, regime: Regime) {
  const seccoes = seccoesDtp(regime);
  const porTurma = await modelosPorTurma(db, regime);
  const fontes = await fontesEmLote(db, regime, porTurma.map(p => ({ turma: p.turma, cursoId: p.cursoId })));
  const linhas = await emLotes(porTurma, 6, async ({ turma, modelo }) => {
    const dtp = await dtpForTurma(db, regime, turma, modelo, null, fontes.get(turma.id));
    const celulas = seccoes.map(s => {
      const itens = dtp.items.filter(i => seccaoDoItem(regime, i) === s.id);
      return { seccao: s.id, estado: estadoDaSeccao(itens), ok: itens.filter(i => i.estado === "ok").length, total: itens.length };
    });
    return {
      id: turma.id,
      nome: turma.nome,
      curso: turma.curso,
      estado: turma.estado,
      inicio: turma.data_inicio.slice(0, 10),
      financiador: turma.financiador,
      fechada: Boolean(turma.fechada),
      pct: dtp.pct,
      ok: dtp.ok,
      parcial: dtp.parcial,
      falta: dtp.falta,
      total: dtp.total,
      bloqueantes: dtp.items.filter(i => i.estado !== "ok" && i.bloqueante).length,
      celulas,
      emFalta: dtp.items
        .filter(i => i.estado !== "ok")
        .map(i => ({ id: i.id, label: i.label, estado: i.estado, bloqueante: Boolean(i.bloqueante), seccao: seccaoDoItem(regime, i), detalhe: i.detalhe })),
    };
  });
  return { seccoes, turmas: linhas };
}
