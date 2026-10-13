import type { Db } from "./db/pool.js";
import {
  aprovado, avaliacaoCcp, cursoECcp, mapaNotas, notaFinalFormando, parseAvaliacaoCurso,
  type AvaliacaoCurso, type NotaAvaliacao, type TopicoRef,
} from "../../src/partilhado/avaliacaoNota.js";
import { assiduidadeDoFormando, sessoesComHoras, type Assiduidade } from "./assiduidade.js";
import { assiduidadeMinima, lerRegras, type RegrasPedagogicas } from "./regrasConfig.js";

/**
 * Resultado pedagógico de cada formando da turma, calculado no servidor:
 * nota final (mesma fórmula da grelha), assiduidade em horas e elegibilidade para certificado.
 * É a fonte de verdade para a emissão de certificados e para o fecho.
 */

export type Regime = "gold" | "fin";

type TurmaBase = { id: number; nome: string; curso: string; cronograma: unknown; fechada_em: unknown; curso_id: number | null };

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
  const table = regime === "gold" ? "turmas_gold" : "turmas_fin";
  const r = await db.query<TurmaBase>(
    `SELECT id, nome, curso, cronograma, fechada_em, curso_id FROM ${table} WHERE id = $1`,
    [id],
  );
  return r.rows[0] ?? null;
}

/** Formandos da turma (pelo id; as fichas antigas sem id contam pelo nome da turma). */
export async function formandosDaTurmaId(db: Db, regime: Regime, turma: { id: number; nome: string }) {
  const table = regime === "gold" ? "formandos_gold" : "formandos_fin";
  const r = await db.query<{ id: number; nome: string; apelido: string; estado: string }>(
    `SELECT id, nome, apelido, estado FROM ${table}
      WHERE turma_id = $1 OR (turma_id IS NULL AND lower(trim(turma)) = lower(trim($2)))
      ORDER BY nome, apelido`,
    [turma.id, turma.nome],
  );
  return r.rows.map(f => ({ id: Number(f.id), nome: `${f.nome} ${f.apelido}`.trim(), estado: String(f.estado ?? "") }));
}

async function fichaDoCurso(db: Db, regime: Regime, turma: TurmaBase) {
  const r = turma.curso_id != null
    ? await db.query<{ payload: unknown }>("SELECT payload FROM curso_fichas WHERE regime = $1 AND curso_id = $2", [regime, turma.curso_id])
    : regime === "gold"
      ? await db.query<{ payload: unknown }>(
        `SELECT f.payload FROM curso_fichas f JOIN cursos_gold c ON c.id = f.curso_id AND f.regime = 'gold'
          WHERE lower(trim(c.nome)) = lower(trim($1)) LIMIT 1`, [turma.curso])
      : await db.query<{ payload: unknown }>(
        `SELECT f.payload FROM curso_fichas f JOIN cursos_fin c ON c.id = f.curso_id AND f.regime = 'fin'
          WHERE lower(trim(c.nome_comercial)) = lower(trim($1)) OR lower(trim(c.ufcd)) = lower(trim($1)) LIMIT 1`, [turma.curso]);
  return asObj(r.rows[0]?.payload);
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
    db.query<{ sessao_n: number; presencas: unknown }>(
      "SELECT sessao_n, presencas FROM turma_sessoes WHERE regime = $1 AND turma_id = $2", [regime, turmaId],
    ),
    db.query<{ formando_id: number; modulo_id: string; parametro_id: string; nota: unknown }>(
      "SELECT formando_id, modulo_id, parametro_id, nota FROM turma_avaliacoes WHERE regime = $1 AND turma_id = $2", [regime, turmaId],
    ),
    db.query<{ formando_id: number; emitido: boolean; elearning: unknown; nota: unknown; ficheiro_id: string }>(
      "SELECT formando_id, emitido, elearning, nota, COALESCE(ficheiro_id, '') AS ficheiro_id FROM turma_certificados WHERE regime = $1 AND turma_id = $2",
      [regime, turmaId],
    ),
    fichaDoCurso(db, regime, turma),
  ]);
  const cfg = avaliacaoDoCurso(payload, turma.curso);
  const topicos = topicosDe(payload);
  const moduloIds = moduloIdsDe(cfg, topicos);
  const notas: NotaAvaliacao[] = notasRows.rows.map(n => ({
    formandoId: Number(n.formando_id),
    moduloId: n.modulo_id ?? "",
    parametroId: n.parametro_id,
    nota: n.nota == null || !Number.isFinite(Number(n.nota)) ? null : Number(n.nota),
  }));
  const mapa = mapaNotas(notas);
  const sessoes = sessoesComHoras(turma.cronograma, folhas.rows);
  const certs = new Map(certRows.rows.map(c => [Number(c.formando_id), c]));
  const minimo = assiduidadeMinima(regras, regime);
  const temGrelha = cfg.parametros.length > 0 || cfg.estrutura === "ccp";
  const dtpFalta = regras.dtpBloqueiaCertificado && opts.dtpEmFalta ? await opts.dtpEmFalta() : [];

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
    const gravadas = await db.query<{ sessao_n: number; sumario: unknown }>(
      "SELECT sessao_n, sumario FROM turma_sessoes WHERE regime = $1 AND turma_id = $2", [regime, turmaId],
    );
    const porN = new Map(gravadas.rows.map(r => [Number(r.sessao_n), asObj(r.sumario)]));
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
  const table = regime === "gold" ? "turmas_gold" : "turmas_fin";
  const r = await db.query<{ fechada_em: unknown }>(`SELECT fechada_em FROM ${table} WHERE id = $1`, [turmaId]);
  return Boolean(r.rows[0]?.fechada_em);
}

export const ERRO_TURMA_FECHADA = "A turma está fechada. Só o administrador a pode reabrir para corrigir.";
