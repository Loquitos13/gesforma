/**
 * Planos de sessão do curso (ficha do curso) levados para as turmas desse curso.
 * O plano do curso com a ordem n vai para a sessão lectiva n da turma (presencial ou síncrona).
 * O plano e o sumário (conteúdos e atividades; só na Gold, a Financiada não tem sumário) são iguais em todas as turmas:
 * gravam-se nas sessões sem eles, marcados `origem: "curso"`. Enquanto a turma não os altera (gravar na turma tira a
 * marca) nem os assina, acompanham as mudanças da ficha do curso. Nunca em turmas fechadas.
 */
import type { Db } from "./db/pool.js";
import { asObj } from "./pedagogia/util.js";
import { lerFicha } from "./repos/cursos.js";
import { cursoPorNome } from "./repos/leadDocs.js";
import { gravarSessao, listarSessoes } from "./repos/pedagogiaSessoes.js";
import { turmaParaPlanos, turmasAbertasDoCurso } from "./repos/planosCurso.js";
import type { Regime } from "./repos/sql.js";
import { sessaoLectivaN } from "./sessaoAcesso.js";
import { atribuirPlanos, modulosEmFalta } from "../../src/partilhado/planosModulo.js";

const MOMENTOS = ["introducao", "desenvolvimento", "conclusao"] as const;
const CAMPOS = ["conteudo", "atividades", "metodos", "avaliacao", "recursos", "materiais", "tempo"] as const;

type Momento = Record<(typeof CAMPOS)[number], string>;
export type PlanoSessao = {
  objetivosGerais: string;
  objetivosEspecificos: string;
  momentos: Record<(typeof MOMENTOS)[number], Momento>;
};

const txt = (v: unknown, max = 4000) => String(v ?? "").slice(0, max);

function momento(raw: unknown): Momento {
  const o = asObj(raw);
  return Object.fromEntries(CAMPOS.map(k => [k, txt(o[k])])) as Momento;
}

/**
 * Plano do curso no formato da sessão da turma. Aceita o formato antigo da ficha
 * ({ objetivosGerais, objetivosEspecificos, conteudo }): o conteúdo vai para o desenvolvimento.
 */
export function planoDaLinha(raw: unknown): { ordem: number; plano: PlanoSessao } | null {
  const o = asObj(raw);
  const ordem = Number(o.ordem);
  if (!Number.isInteger(ordem) || ordem < 1) return null;
  const m = asObj(o.momentos);
  const momentos = Object.fromEntries(MOMENTOS.map(k => [k, momento(m[k])])) as PlanoSessao["momentos"];
  if (!momentos.desenvolvimento.conteudo.trim() && String(o.conteudo ?? "").trim()) momentos.desenvolvimento.conteudo = txt(o.conteudo);
  return { ordem, plano: { objetivosGerais: txt(o.objetivosGerais), objetivosEspecificos: txt(o.objetivosEspecificos), momentos } };
}

export function planoTemTexto(raw: unknown) {
  const p = asObj(raw);
  if (String(p.objetivosGerais ?? "").trim() || String(p.objetivosEspecificos ?? "").trim()) return true;
  return Object.values(asObj(p.momentos)).some(m => Object.values(asObj(m)).some(v => String(v ?? "").trim()));
}

type SumarioCurso = { conteudos: string; atividades: string };

type ModeloCurso = { ordem: number; modulo: string; plano: PlanoSessao | null; sumario: SumarioCurso | null };

/** Plano e sumário padrão de cada sessão da ficha do curso (só os que têm texto), com o módulo / tema a que se ligam. */
async function modelosDoCurso(db: Db, regime: Regime, cursoId: number) {
  const ficha = await lerFicha(db, regime, cursoId);
  const linhas = asObj(ficha?.payload).planosSessao;
  const out: ModeloCurso[] = [];
  for (const l of Array.isArray(linhas) ? linhas : []) {
    const p = planoDaLinha(l);
    if (!p) continue;
    const s = asObj(asObj(l).sumario);
    const sumario = { conteudos: txt(s.conteudos, 6000), atividades: txt(s.atividades, 6000) };
    const temSumario = regime === "gold" && Boolean(sumario.conteudos.trim() || sumario.atividades.trim());
    if (planoTemTexto(p.plano) || temSumario) {
      out.push({ ordem: p.ordem, modulo: txt(asObj(l).modulo, 300), plano: planoTemTexto(p.plano) ? p.plano : null, sumario: temSumario ? sumario : null });
    }
  }
  return out;
}

/**
 * Antes de gravar o cronograma de uma turma: as sessões lectivas sem módulo que vão receber um plano do curso ligado a
 * um módulo ficam com esse módulo (assim a turma nova herda o plano e o módulo de cada sessão).
 */
export async function comModulosDosPlanos<T>(db: Db, regime: Regime, curso: string, cronograma: T[]): Promise<T[]> {
  const cursoId = (await cursoPorNome(db, regime, curso))?.id;
  if (!cursoId || !Array.isArray(cronograma)) return cronograma;
  const modelos = (await modelosDoCurso(db, regime, Number(cursoId))).filter(m => m.plano);
  if (!modelos.some(m => m.modulo.trim())) return cronograma;
  const indices: number[] = [];
  cronograma.forEach((item, i) => {
    const m = String((item as { modalidade?: unknown } | null)?.modalidade ?? "presencial");
    if (item && typeof item === "object" && (m === "presencial" || m === "sincrona")) indices.push(i);
  });
  const lectivas = indices.map(i => cronograma[i] as { modulos?: unknown });
  const falta = modulosEmFalta(modelos, lectivas);
  if (!falta.size) return cronograma;
  const out = [...cronograma];
  for (const [pos, modulo] of falta) {
    const i = indices[pos]!;
    out[i] = { ...(out[i] as object), modulos: [modulo] } as T;
  }
  return out;
}

/** As sessões lectivas da turma, pela ordem (a n-ésima é a sessão n). */
function sessoesLectivas(cronograma: unknown) {
  const out: { id?: unknown; modulos?: unknown }[] = [];
  for (let n = 1; sessaoLectivaN(cronograma, n); n++) out.push(sessaoLectivaN(cronograma, n) as { id?: unknown; modulos?: unknown });
  return out;
}

/** Posições (n) das sessões cujo plano vem da ficha do curso: o formador vê-o mas não o altera. */
export async function ordensComPlanoDoCurso(db: Db, regime: Regime, turmaId: number) {
  const turma = await turmaParaPlanos(db, regime, turmaId);
  if (!turma) return new Set<number>();
  const cursoId = turma.curso_id ?? (await cursoPorNome(db, regime, turma.curso))?.id ?? null;
  if (!cursoId) return new Set<number>();
  const modelos = await modelosDoCurso(db, regime, Number(cursoId));
  const atribuidos = atribuirPlanos(modelos, sessoesLectivas(turma.cronograma));
  return new Set(atribuidos.flatMap((m, i) => (m?.plano ? [i + 1] : [])));
}

export type ResultadoImportacao = { importados: number; mantidos: number; semModelo: number; sumarios?: number; fechada?: boolean };

/** Igualdade sem depender da ordem das chaves (o jsonb reordena-as) nem dos campos vazios. */
function estavel(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(estavel);
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined && x !== null).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, estavel(x)]));
  }
  return v;
}
const igual = (a: unknown, b: unknown) => JSON.stringify(estavel(a)) === JSON.stringify(estavel(b));

export async function importarPlanosCurso(db: Db, regime: Regime, turmaId: number, o: { substituir?: boolean } = {}): Promise<ResultadoImportacao> {
  const vazio = { importados: 0, mantidos: 0, semModelo: 0, sumarios: 0 };
  const turma = await turmaParaPlanos(db, regime, turmaId);
  if (!turma) return vazio;
  if (turma.fechada_em) return { ...vazio, fechada: true };
  const cursoId = turma.curso_id ?? (await cursoPorNome(db, regime, turma.curso))?.id ?? null;
  if (!cursoId) return vazio;
  const modelos = await modelosDoCurso(db, regime, Number(cursoId));
  if (!modelos.length) return vazio;
  const actuais = new Map((await listarSessoes(db, regime, turmaId)).map(s => [String(s.sessao_id ?? ""), s]));
  const r = { ...vazio };
  // Cada plano vai para a sessão do seu módulo (ou, sem módulo, para a sessão n); depois de gravado fica preso ao id.
  const lectivas = sessoesLectivas(turma.cronograma);
  const atribuidos = atribuirPlanos(modelos, lectivas);
  for (let n = 1; n <= lectivas.length; n++) {
    const sessaoId = String(lectivas[n - 1]?.id ?? "");
    const modelo = atribuidos[n - 1];
    const linha = actuais.get(sessaoId);
    if (!modelo || !sessaoId) {
      // Esta sessão já não recebe plano do curso (ex.: os planos passaram a ir por módulo): o plano e o sumário que
      // vieram do curso e que a turma não alterou nem assinou saem, para não ficarem planos de outra sessão.
      const p0 = asObj(linha?.plano);
      const s0 = asObj(linha?.sumario);
      const limpar: { plano?: unknown; sumario?: unknown } = {};
      if (p0.origem === "curso" && p0.assinado !== true) limpar.plano = {};
      if (s0.origem === "curso" && s0.assinado !== true && s0.presencasValidadas !== true) limpar.sumario = {};
      if (sessaoId && (limpar.plano || limpar.sumario)) await gravarSessao(db, regime, turmaId, { id: sessaoId, n }, limpar);
      r.semModelo += 1;
      continue;
    }
    const partes: { plano?: unknown; sumario?: unknown } = {};

    const plano = asObj(linha?.plano);
    // Sem plano, ainda o do curso (não alterado na turma) ou, ao substituir, um não assinado.
    const herdavel = !planoTemTexto(plano) || (plano.origem === "curso" && plano.assinado !== true) || (o.substituir && plano.assinado !== true);
    if (modelo.plano && herdavel) {
      // Definido pela coordenação na ficha do curso: chega à turma já aprovado.
      const novo = { ...modelo.plano, origem: "curso", estado: "aprovado", assinado: false, revistoPor: "Ficha do curso" };
      if (!igual({ ...plano, revistoEm: undefined }, { ...novo, revistoEm: undefined })) partes.plano = { ...novo, revistoEm: new Date().toISOString() };
    }

    const sumario = asObj(linha?.sumario);
    const sumarioVazio = !String(sumario.conteudos ?? "").trim() && !String(sumario.atividades ?? "").trim();
    if (modelo.sumario && sumario.assinado !== true && (sumarioVazio || sumario.origem === "curso" || o.substituir)) {
      const novo = { ...sumario, conteudos: modelo.sumario.conteudos, atividades: modelo.sumario.atividades, assinado: false, origem: "curso" };
      if (!igual(sumario, novo)) partes.sumario = novo;
    }

    if (!partes.plano && !partes.sumario) { r.mantidos += 1; continue; }
    await gravarSessao(db, regime, turmaId, { id: sessaoId, n }, partes);
    if (partes.plano) r.importados += 1;
    if (partes.sumario) r.sumarios += 1;
  }
  return r;
}

/** Depois de gravar a ficha do curso: leva os planos e os sumários às turmas abertas do curso. */
export async function importarParaTurmasDoCurso(db: Db, regime: Regime, cursoId: number) {
  let importados = 0;
  for (const id of await turmasAbertasDoCurso(db, regime, cursoId)) {
    const r = await importarPlanosCurso(db, regime, id);
    importados += r.importados + (r.sumarios ?? 0);
  }
  return importados;
}

const SUMARIO_COPIA = ["conteudos", "atividades"] as const;
const sumarioTemTexto = (raw: unknown) => SUMARIO_COPIA.some(k => String(asObj(raw)[k] ?? "").trim());

/**
 * Turma padrão: copia de outra turma do mesmo curso o plano e o sumário (conteúdos e atividades) de cada sessão,
 * pela ordem das sessões lectivas. As observações e as assinaturas nunca se copiam; o que está assinado nunca muda.
 */
export async function importarDeTurma(db: Db, regime: Regime, turmaId: number, origemId: number, o: { substituir?: boolean } = {}) {
  const r = { importados: 0, sumarios: 0, mantidos: 0, semModelo: 0, fechada: false };
  const [turma, origem] = await Promise.all([turmaParaPlanos(db, regime, turmaId), turmaParaPlanos(db, regime, origemId)]);
  if (!turma || !origem) return r;
  if (turma.fechada_em) return { ...r, fechada: true };
  const daOrigem = new Map((await listarSessoes(db, regime, origemId)).map(s => [String(s.sessao_id ?? ""), s]));
  const actuais = new Map((await listarSessoes(db, regime, turmaId)).map(s => [String(s.sessao_id ?? ""), s]));
  for (let n = 1; sessaoLectivaN(turma.cronograma, n); n++) {
    const sessaoId = String(sessaoLectivaN(turma.cronograma, n)?.id ?? "");
    const fonte = daOrigem.get(String(sessaoLectivaN(origem.cronograma, n)?.id ?? ""));
    if (!sessaoId || !fonte) { r.semModelo += 1; continue; }
    const actual = actuais.get(sessaoId);
    const partes: { plano?: unknown; sumario?: unknown } = {};
    const planoActual = asObj(actual?.plano);
    if (planoTemTexto(fonte.plano) && planoActual.assinado !== true && (o.substituir || !planoTemTexto(planoActual))) {
      partes.plano = { ...asObj(fonte.plano), assinado: false, assinadoEm: undefined, estado: undefined, comentario: undefined, submetidoEm: undefined, revistoPor: undefined, revistoEm: undefined };
    }
    const sumarioActual = asObj(actual?.sumario);
    if (sumarioTemTexto(fonte.sumario) && sumarioActual.assinado !== true && (o.substituir || !sumarioTemTexto(sumarioActual))) {
      const s = asObj(fonte.sumario);
      partes.sumario = { ...sumarioActual, conteudos: txt(s.conteudos), atividades: txt(s.atividades), assinado: false, assinadoEm: undefined };
    }
    if (!partes.plano && !partes.sumario) { r.mantidos += 1; continue; }
    await gravarSessao(db, regime, turmaId, { id: sessaoId, n }, partes);
    if (partes.plano) r.importados += 1;
    if (partes.sumario) r.sumarios += 1;
  }
  return r;
}
