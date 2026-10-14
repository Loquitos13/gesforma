/** Dossiê técnico-pedagógico: factos da turma, itens com estado, resumo e matriz turma × secção. */
import type { Db } from "../db/pool.js";
import { contagemCertificadosFin } from "../dossieGerado.js";
import {
  aplicarPercursoNoItem, buildDtpItems, comporModelo, dtpPct, estadoPorFicheirosCurso, parseDtpModelo, tipoPercursoDoItem,
  DTP_MODELO_VAZIO, type CursoFicheiroRef, type DtpCounts, type DtpFacts, type DtpItem, type DtpModelo, type DtpPercurso,
} from "../dtpModel.js";
import { DTP_CATEGORIAS, dtpCategoriaDe } from "../dtpPasta.js";
import { TOPICOS_FIN, topicoFinDe } from "../dtpTopicosFin.js";
import * as repo from "../repos/dtp.js";
import { listarDocumentos } from "../repos/pedagogiaSessoes.js";
import { cursoIdDaTurma, formandosDaTurma, listarTurmasDtp, mapaCursos, type TurmaRow } from "../repos/pedagogiaTurma.js";
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

export async function turmaFacts(db: Db, regime: Regime, turma: TurmaRow): Promise<DtpFacts> {
  const sessoesTotal = asArr(turma.cronograma).length;
  const [sessoesRows, docRows, certRows, formandos] = await Promise.all([
    repo.sessoesParaFactos(db, regime, turma.id),
    listarDocumentos(db, regime, turma.id),
    repo.certificadosEmitidos(db, regime, turma.id),
    formandosDaTurma(db, regime, turma),
  ]);
  const planos = sessoesRows.filter(r => planoPreenchido(r.plano)).length;
  const sumarios = sessoesRows.filter(r => Boolean(asObj(r.sumario).assinado)).length;
  const presencas = sessoesRows.filter(r => asArr(r.presencas).length > 0).length;

  const docByLabel = (re: RegExp) => docRows.find(d => re.test(d.label));
  const pip = pipCounts(docByLabel(/^pip$/i)?.payload ?? docByLabel(/pip/i)?.payload);
  const simIni = simCounts(docRows.find(d => /simula/i.test(d.label) && /inicial/i.test(d.label))?.payload);
  const simFim = simCounts(docRows.find(d => /simula/i.test(d.label) && /final/i.test(d.label))?.payload);

  const docs: Record<string, DtpCounts> = {};
  const total = formandos.length;
  if (total > 0) {
    const rows = await repo.docsValidadosDosFormandos(db, regime, formandos.map(f => f.id));
    const porPessoa = new Map<number, Set<string>>();
    const contagem = new Map<string, number>();
    for (const r of rows) {
      contagem.set(r.doc_id, (contagem.get(r.doc_id) ?? 0) + 1);
      const set = porPessoa.get(r.formando_id) ?? new Set<string>();
      set.add(r.doc_id);
      porPessoa.set(r.formando_id, set);
    }
    for (const [docId, n] of contagem) docs[docId] = { done: n, total };
    const tem = (f: { id: number; docs: Record<string, unknown> }, id: string) => Boolean(porPessoa.get(f.id)?.has(id) || asObj(f.docs[id]).ok);
    if (regime === "fin") {
      for (const key of CHAVES_FIN) docs[key] = { done: formandos.filter(f => tem(f, key)).length, total };
      docs["rgpd-contratos"] = { done: formandos.filter(f => tem(f, "contrato") && tem(f, "rgpd")).length, total };
    }
    const bases = regime === "gold" ? ["cc", "contrato", "pip", "exp", "regulamento"] : CHAVES_FIN;
    for (const key of bases) docs[key] ??= { done: 0, total };
  }

  let inqueritosFormador: DtpCounts | null = null;
  let inqueritosFormandos: DtpCounts | null = null;
  let inqueritosPos: DtpCounts | null = null;
  if (regime === "fin") {
    const envios = await repo.inqueritosEnviadosATurma(db, regime, turma.id).catch(() => []);
    const contar = (publico: string): DtpCounts => {
      const lista = envios.filter(r => r.publico === publico);
      if (!lista.length) return { done: 0, total: 1 };
      return { done: lista.filter(r => r.enviado === true || String(r.enviado) === "t" || String(r.enviado) === "true").length, total: lista.length };
    };
    inqueritosFormador = contar("formador");
    inqueritosFormandos = contar("formando");
    inqueritosPos = contar("pos");
  }

  return {
    inqueritosFormador,
    inqueritosFormandos,
    inqueritosPos,
    sessoes: { done: sessoesTotal, total: sessoesTotal },
    planos: { done: planos, total: sessoesTotal },
    sumarios: { done: sumarios, total: sessoesTotal },
    presencas: { done: presencas, total: sessoesTotal },
    formandos: total,
    certificados: regime === "fin"
      ? await contagemCertificadosFin(db, turma.id)
      : { done: certRows.filter(r => r.emitido).length, total },
    contratos: docs.contrato ?? { done: 0, total },
    pip,
    simInicial: simIni,
    simFinal: simFim,
    docs,
  };
}

/** Contagem do percurso público (Gold) por tipo de documento, pelos emails dos formandos da turma. */
async function percursoGoldDaTurma(db: Db, turma: TurmaRow) {
  const formandos = await repo.emailsFormandosGold(db, turma.id, turma.nome);
  const total = formandos.length;
  const porTipo = new Map<string, Pick<DtpPercurso, "submetidos" | "validados" | "recusados">>();
  if (total === 0) return { total, porTipo };
  const emails = [...new Set(formandos.map(r => r.email).filter(Boolean))];
  const leads = await repo.leadsDosEmails(db, emails, turma.curso, turma.id);
  const porEmail = new Map(leads.map(r => [r.email, r.id]));
  const docs = await repo.docsDasPreinscricoes(db, [...new Set(leads.map(r => r.id))]);
  const rank = { validado: 3, pendente: 2, recusado: 1 } as const;
  const melhor = new Map<string, keyof typeof rank>();
  for (const doc of docs) {
    const estado = doc.estado === "validado" || doc.estado === "recusado" ? doc.estado : "pendente";
    const chave = `${doc.preinscricao_id}:${doc.tipo}`;
    const anterior = melhor.get(chave);
    if (!anterior || rank[estado] > rank[anterior]) melhor.set(chave, estado);
  }
  for (const tipo of new Set(docs.map(d => d.tipo).filter(Boolean))) {
    const c = { submetidos: 0, validados: 0, recusados: 0 };
    for (const f of formandos) {
      const leadId = f.email ? porEmail.get(f.email) : undefined;
      const estado = leadId == null ? undefined : melhor.get(`${leadId}:${tipo}`);
      if (estado === "validado") c.validados += 1;
      else if (estado === "pendente") c.submetidos += 1;
      else if (estado === "recusado") c.recusados += 1;
    }
    porTipo.set(tipo, c);
  }
  return { total, porTipo };
}

export async function dtpForTurma(db: Db, regime: Regime, turma: TurmaRow, modeloPre?: DtpModelo, entidadePre?: string | null) {
  const carregado = modeloPre ? { modelo: modeloPre, entidade: entidadePre ?? null } : await modeloDaTurma(db, regime, turma);
  const [facts, manual, anexos, cursoId] = await Promise.all([
    turmaFacts(db, regime, turma),
    repo.estadosManuais(db, regime, turma.id),
    repo.anexosDaTurma(db, regime, turma.id).catch(() => []),
    cursoIdDaTurma(db, regime, turma.curso),
  ]);
  const byItem = new Map(anexos.map(r => [r.item_id, r]));
  const anexoLegado: Record<string, string> = { "relatorio-pos": "inqueritos-turma" };
  const ficheiros = cursoId == null ? [] : await repo.ficheirosDoCurso(db, regime, cursoId).catch(() => []);
  const refs: CursoFicheiroRef[] = ficheiros.map(f => ({ ambito: f.ambito, requisitoId: f.requisito_id, pessoaId: f.pessoa_id, pessoaNome: f.pessoa_nome }));
  const formandosCurso = refs.some(f => f.ambito === "formando") ? await formandosDaTurma(db, regime, turma) : [];
  let items: DtpItem[] = buildDtpItems(regime, facts, manual, carregado.modelo).map(item => {
    const a = byItem.get(item.id) ?? (anexoLegado[item.id] ? byItem.get(anexoLegado[item.id]!) : undefined);
    const anexo = a?.drive_file_id ? { fileName: a.file_name, url: a.drive_url, driveFileId: a.drive_file_id } : null;
    let next = item;
    if (anexo && item.origem === "manual" && item.estado === "falta") {
      next = { ...item, estado: "ok" as const, detalhe: `Ficheiro no Drive: ${anexo.fileName}` };
    }
    const porPartes = estadoPorFicheirosCurso(next.id, refs, formandosCurso, turma.formador ?? "");
    if (porPartes?.estado === "ok") return { ...next, anexo, estado: "ok" as const, detalhe: porPartes.detalhe };
    if (porPartes?.estado === "parcial" && next.estado !== "ok") return { ...next, anexo, estado: "parcial" as const, detalhe: porPartes.detalhe };
    return { ...next, anexo };
  });
  if (regime === "gold") {
    const percurso = await percursoGoldDaTurma(db, turma);
    items = items.map(item => {
      const tipo = tipoPercursoDoItem(item);
      if (!tipo) return item;
      const contagem = percurso.porTipo.get(tipo) ?? { submetidos: 0, validados: 0, recusados: 0 };
      return aplicarPercursoNoItem(item, { ...contagem, total: percurso.total }, Boolean(manual[item.id]));
    });
  }
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

/** Itens do dossiê ainda em falta (usado quando as regras o exigem). */
export async function dtpEmFalta(db: Db, regime: Regime, turma: TurmaRow) {
  const dtp = await dtpForTurma(db, regime, turma);
  return dtp.items.filter(i => i.estado !== "ok").map(i => i.label);
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
    return { turma, modelo: regime === "gold" ? comporModelo(entidade, curso) : curso };
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
  const linhas = await emLotes(await modelosPorTurma(db, regime), 6, async ({ turma, modelo }) => {
    const dtp = await dtpForTurma(db, regime, turma, modelo, null);
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
