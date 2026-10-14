import type { Db } from "./db/pool.js";
import {
  aprovado, avaliacaoCcp, cursoECcp, mapaNotas, notaFinalFormando, parseAvaliacaoCurso,
  type AvaliacaoCurso, type NotaAvaliacao, type TopicoRef,
} from "../../src/partilhado/avaliacaoNota.js";
import { assiduidadeDoFormando, sessoesComHoras, type Assiduidade } from "./assiduidade.js";
import { assiduidadeMinima, lerRegras, type RegrasPedagogicas } from "./regrasConfig.js";
import {
  certificadosParaResultados, certificadosParaResultadosLote, fichaDoCursoDaTurma, fichasPorCursoIdLote, folhasDePresenca,
  folhasDePresencaLote, formandosPorTurma, formandosPorTurmasLote, notasLote, turmaBase, turmasBaseLote, turmaFechadaEm, type TurmaBase,
} from "./repos/resultados.js";
import { listarNotas, sumariosDaTurma } from "./repos/pedagogiaSessoes.js";

/**
 * Resultado pedagógico de cada formando da turma, calculado no servidor:
 * nota final (mesma fórmula da grelha), assiduidade em horas e elegibilidade para certificado.
 * É a fonte de verdade para a emissão de certificados e para o fecho.
 */

export type Regime = "gold" | "fin";


export type ResultadoFormando = {
  id: number;
  nome: string;
  estado: string;
  nota: number | null;
  aprovado: boolean | null;
  elearning: number | null;
  assiduidade: Assiduidade;
  assiduidadeMinima: number;
  elegivel: boolean;
  motivos: string[];
  certificado: { emitido: boolean; ficheiro: boolean };
};

function asObj(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v);
      return p && typeof p === "object" ? p as Record<string, unknown> : {};
    } catch { return {}; }
  }
  return {};
}

export async function carregarTurma(db: Db, regime: Regime, id: number): Promise<TurmaBase | null> {
  return turmaBase(db, regime, id);
}

/** Formandos da turma (pelo id; as fichas antigas sem id contam pelo nome da turma). */
export async function formandosDaTurmaId(db: Db, regime: Regime, turma: { id: number; nome: string }) {
  const r = await formandosPorTurma(db, regime, turma);
  return r.map(f => ({ id: Number(f.id), nome: `${f.nome} ${f.apelido}`.trim(), estado: String(f.estado ?? "") }));
}

async function fichaDoCurso(db: Db, regime: Regime, turma: TurmaBase) {
  return asObj((await fichaDoCursoDaTurma(db, regime, turma))?.payload);
}

/** Configuração de avaliação do curso, com a regra do CCP igual à do ecrã. */
export function avaliacaoDoCurso(payload: Record<string, unknown>, cursoNome: string): AvaliacaoCurso {
  const parsed = parseAvaliacaoCurso(payload);
  return cursoECcp(cursoNome) && parsed.estrutura !== "ccp" ? avaliacaoCcp() : parsed;
}

function topicosDe(payload: Record<string, unknown>): TopicoRef[] {
  const raw = payload.topicosPrograma;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap(item => {
    const o = asObj(item);
    const id = String(o.id ?? "").trim();
    const titulo = String(o.titulo ?? o.nome ?? "").trim();
    return id && titulo ? [{ id, titulo }] : [];
  });
}

function moduloIdsDe(cfg: AvaliacaoCurso, topicos: TopicoRef[]) {
  if (cfg.modo !== "modulos") return [];
  if (topicos.length) return topicos.map(t => t.id);
  return (cfg.momentos ?? []).map(m => m.id);
}

const ATIVO = (estado: string) => !/^(desist|indeferido)/i.test(estado.trim());

export async function resultadosDaTurma(
  db: Db,
  regime: Regime,
  turmaId: number,
  opts: { regras?: RegrasPedagogicas; dtpEmFalta?: () => Promise<string[]> } = {},
) {
  const turma = await carregarTurma(db, regime, turmaId);
  if (!turma) return null;
  const regras = opts.regras ?? await lerRegras(db);
  const [formandos, folhas, notasRows, certRows, payload] = await Promise.all([
    formandosDaTurmaId(db, regime, turma),
    folhasDePresenca(db, regime, turmaId),
    listarNotas(db, regime, turmaId),
    certificadosParaResultados(db, regime, turmaId),
    fichaDoCurso(db, regime, turma),
  ]);
  const dtpFalta = regras.dtpBloqueiaCertificado && opts.dtpEmFalta ? await opts.dtpEmFalta() : [];
  return calcularResultados(turma, regras, regime, { formandos, folhas, notasRows, certRows, payload }, dtpFalta);
}

/**
 * Resultados de várias turmas de uma vez (sem a regra do Dossiê TP): uma consulta por fonte para todas,
 * com as mesmas associações e o mesmo cálculo de `resultadosDaTurma`.
 */
export async function resultadosDeTurmas(db: Db, regime: Regime, ids: number[], regrasDadas?: RegrasPedagogicas) {
  const out = new Map<number, ReturnType<typeof calcularResultados>>();
  if (!ids.length) return out;
  const regras = regrasDadas ?? await lerRegras(db);
  const turmas = await turmasBaseLote(db, regime, ids);
  if (!turmas.length) return out;
  const idsReais = turmas.map(t => t.id);
  const cursoIds = [...new Set(turmas.map(t => t.curso_id).filter((x): x is number => x != null))];
  const [formandos, folhas, notas, certs, fichas] = await Promise.all([
    formandosPorTurmasLote(db, regime, idsReais),
    folhasDePresencaLote(db, regime, idsReais),
    notasLote(db, regime, idsReais),
    certificadosParaResultadosLote(db, regime, idsReais),
    fichasPorCursoIdLote(db, regime, cursoIds),
  ]);
  const fichaDoId = new Map(fichas.map(f => [Number(f.curso_id), asObj(f.payload)]));
  const daTurma = <T extends { turma_id: number }>(linhas: T[], id: number) => linhas.filter(l => Number(l.turma_id) === id);
  for (const turma of turmas) {
    const nomeTurma = turma.nome.trim().toLowerCase();
    const lista = formandos
      .filter(f => Number(f.turma_id) === turma.id || (f.turma_id == null && f.turma.trim().toLowerCase() === nomeTurma))
      .map(f => ({ id: Number(f.id), nome: `${f.nome} ${f.apelido}`.trim(), estado: String(f.estado ?? "") }));
    // Sem id do curso a ficha procura-se pelo nome (raro): mantém-se a consulta individual.
    const payload = turma.curso_id != null ? (fichaDoId.get(turma.curso_id) ?? {}) : await fichaDoCurso(db, regime, turma);
    out.set(turma.id, calcularResultados(turma, regras, regime, {
      formandos: lista,
      folhas: daTurma(folhas, turma.id),
      notasRows: daTurma(notas, turma.id),
      certRows: daTurma(certs, turma.id),
      payload,
    }, []));
  }
  return out;
}

type Entradas = {
  formandos: { id: number; nome: string; estado: string }[];
  folhas: { sessao_n: number; presencas: unknown }[];
  notasRows: { formando_id: number; modulo_id: string; parametro_id: string; nota: unknown }[];
  certRows: { formando_id: number; emitido: boolean; elearning: unknown; nota: unknown; ficheiro_id: string }[];
  payload: Record<string, unknown>;
};

function calcularResultados(turma: TurmaBase, regras: RegrasPedagogicas, regime: Regime, e: Entradas, dtpFalta: string[]) {
  const { formandos, folhas, notasRows, certRows, payload } = e;
  const cfg = avaliacaoDoCurso(payload, turma.curso);
  const topicos = topicosDe(payload);
  const moduloIds = moduloIdsDe(cfg, topicos);
  const notas: NotaAvaliacao[] = notasRows.map(n => ({
    formandoId: Number(n.formando_id),
    moduloId: n.modulo_id ?? "",
    parametroId: n.parametro_id,
    nota: n.nota == null || !Number.isFinite(Number(n.nota)) ? null : Number(n.nota),
  }));
  const mapa = mapaNotas(notas);
  const sessoes = sessoesComHoras(turma.cronograma, folhas);
  const certs = new Map(certRows.map(c => [Number(c.formando_id), c]));
  const minimo = assiduidadeMinima(regras, regime);
  const temGrelha = cfg.parametros.length > 0 || cfg.estrutura === "ccp";

  const lista: ResultadoFormando[] = formandos.map(f => {
    const cert = certs.get(f.id);
    const assid = assiduidadeDoFormando(f, sessoes, { justificadasContam: regras.justificadasContam });
    const notaGrelha = temGrelha ? notaFinalFormando(cfg, mapa, f.id, moduloIds, topicos) : null;
    const notaCert = cert?.nota == null || !Number.isFinite(Number(cert.nota)) ? null : Number(cert.nota);
    const nota = notaGrelha ?? (temGrelha ? null : notaCert);
    const elearning = cert?.elearning == null || !Number.isFinite(Number(cert.elearning)) ? null : Number(cert.elearning);
    const aprov = temGrelha
      ? aprovado(nota, cfg.minimoAprovacao)
      : elearning != null ? elearning >= regras.elearningMin : aprovado(nota, cfg.minimoAprovacao);
    const motivos: string[] = [];
    if (!ATIVO(f.estado)) motivos.push(`Estado: ${f.estado}.`);
    if (assid.pct == null) motivos.push("Sem horas previstas no cronograma.");
    else if (assid.pct < minimo) motivos.push(`Assiduidade ${assid.pct}% abaixo do mínimo de ${minimo}%.`);
    if (aprov == null) motivos.push("Avaliação incompleta.");
    else if (!aprov) motivos.push("Sem aprovação na avaliação.");
    if (dtpFalta.length) motivos.push(`Dossiê técnico-pedagógico incompleto (${dtpFalta.length} em falta).`);
    return {
      id: f.id,
      nome: f.nome,
      estado: f.estado,
      nota,
      aprovado: aprov,
      elearning,
      assiduidade: assid,
      assiduidadeMinima: minimo,
      elegivel: motivos.length === 0,
      motivos,
      certificado: { emitido: Boolean(cert?.emitido), ficheiro: Boolean(cert?.ficheiro_id) },
    };
  });

  return {
    turma: { id: turma.id, nome: turma.nome, curso: turma.curso, fechada: Boolean(turma.fechada_em) },
    avaliacao: { modo: cfg.modo, escalaMin: cfg.escalaMin, escalaMax: cfg.escalaMax, minimoAprovacao: cfg.minimoAprovacao, unidade: cfg.unidade },
    regras,
    formandos: lista,
    resumo: {
      total: lista.length,
      elegiveis: lista.filter(f => f.elegivel).length,
      aprovados: lista.filter(f => f.aprovado === true).length,
      reprovados: lista.filter(f => f.aprovado === false).length,
      incompletos: lista.filter(f => f.aprovado == null).length,
    },
  };
}

/**
 * O que falta para fechar a turma. Lista vazia = pode fechar.
 * Sessões: cada sessão lectiva com data passada tem de ter sumário assinado e presenças validadas.
 */
export async function pendentesDoFecho(
  db: Db,
  regime: Regime,
  turmaId: number,
  opts: { regras?: RegrasPedagogicas; dtpEmFalta?: () => Promise<string[]>; hoje?: string } = {},
) {
  const regras = opts.regras ?? await lerRegras(db);
  const res = await resultadosDaTurma(db, regime, turmaId, { regras });
  if (!res) return null;
  const turma = (await carregarTurma(db, regime, turmaId))!;
  const hoje = opts.hoje ?? new Date().toISOString().slice(0, 10);
  const falta: string[] = [];
  if (regras.fechoExigeSessoes) {
    const gravadas = await sumariosDaTurma(db, regime, turmaId);
    const porN = new Map(gravadas.map(r => [Number(r.sessao_n), asObj(r.sumario)]));
    const sessoes = sessoesComHoras(turma.cronograma, []);
    const futuras = sessoes.filter(s => /^\d{4}-\d{2}-\d{2}$/.test(s.data) && s.data > hoje);
    if (futuras.length) falta.push(`${futuras.length} sessão(ões) ainda por realizar (a última a ${futuras[futuras.length - 1]!.data}).`);
    for (const s of sessoes) {
      if (futuras.includes(s)) continue;
      const sum = porN.get(s.n);
      if (!sum?.assinado) falta.push(`Sessão ${s.n}${s.data ? ` (${s.data})` : ""}: sumário por assinar.`);
      else if (!sum.presencasValidadas) falta.push(`Sessão ${s.n}${s.data ? ` (${s.data})` : ""}: presenças por validar.`);
    }
  }
  if (regras.fechoExigeNotas) {
    for (const f of res.formandos) {
      if (ATIVO(f.estado) && f.aprovado == null) falta.push(`${f.nome}: avaliação incompleta.`);
    }
  }
  if (regras.dtpBloqueiaFecho && opts.dtpEmFalta) {
    const dtp = await opts.dtpEmFalta();
    if (dtp.length) falta.push(`Dossiê técnico-pedagógico: ${dtp.slice(0, 8).join("; ")}${dtp.length > 8 ? "…" : ""}`);
  }
  return { falta, resultados: res };
}

/** Uma turma fechada não aceita alterações pedagógicas nem inscrições. */
export async function turmaFechada(db: Db, regime: Regime, turmaId: number) {
  return Boolean((await turmaFechadaEm(db, regime, turmaId))?.fechada_em);
}

export const ERRO_TURMA_FECHADA = "A turma está fechada. Só o administrador a pode reabrir para corrigir.";
