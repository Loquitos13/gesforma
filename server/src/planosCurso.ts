/**
 * Planos de sessão do curso (ficha do curso) levados para as turmas desse curso.
 * O plano do curso com a ordem n vai para a sessão lectiva n da turma (presencial ou síncrona).
 * Só se escreve nas sessões sem plano (ou, ao substituir, nas que não estão assinadas) e nunca em turmas fechadas.
 * O sumário padrão do curso não se grava: só pré-preenche o editor do sumário no ecrã.
 */
import type { Db } from "./db/pool.js";
import { asObj } from "./pedagogia/util.js";
import { lerFicha } from "./repos/cursos.js";
import { cursoPorNome } from "./repos/leadDocs.js";
import { gravarSessao, listarSessoes } from "./repos/pedagogiaSessoes.js";
import { turmaParaPlanos, turmasAbertasDoCurso } from "./repos/planosCurso.js";
import type { Regime } from "./repos/sql.js";
import { sessaoLectivaN } from "./sessaoAcesso.js";

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

/** Planos com texto da ficha do curso, pela ordem da sessão. */
async function planosDoCurso(db: Db, regime: Regime, cursoId: number) {
  const ficha = await lerFicha(db, regime, cursoId);
  const linhas = asObj(ficha?.payload).planosSessao;
  const out = new Map<number, PlanoSessao>();
  for (const l of Array.isArray(linhas) ? linhas : []) {
    const p = planoDaLinha(l);
    if (p && planoTemTexto(p.plano)) out.set(p.ordem, p.plano);
  }
  return out;
}

/** Posições (n) das sessões cujo plano vem da ficha do curso: o formador vê-o mas não o altera. */
export async function ordensComPlanoDoCurso(db: Db, regime: Regime, turmaId: number) {
  const turma = await turmaParaPlanos(db, regime, turmaId);
  if (!turma) return new Set<number>();
  const cursoId = turma.curso_id ?? (await cursoPorNome(db, regime, turma.curso))?.id ?? null;
  return cursoId ? new Set((await planosDoCurso(db, regime, Number(cursoId))).keys()) : new Set<number>();
}

export type ResultadoImportacao = { importados: number; mantidos: number; semModelo: number; fechada?: boolean };

export async function importarPlanosCurso(db: Db, regime: Regime, turmaId: number, o: { substituir?: boolean } = {}): Promise<ResultadoImportacao> {
  const vazio = { importados: 0, mantidos: 0, semModelo: 0 };
  const turma = await turmaParaPlanos(db, regime, turmaId);
  if (!turma) return vazio;
  if (turma.fechada_em) return { ...vazio, fechada: true };
  const cursoId = turma.curso_id ?? (await cursoPorNome(db, regime, turma.curso))?.id ?? null;
  if (!cursoId) return vazio;
  const planos = await planosDoCurso(db, regime, Number(cursoId));
  if (!planos.size) return vazio;
  const actuais = new Map((await listarSessoes(db, regime, turmaId)).map(s => [String(s.sessao_id ?? ""), asObj(s.plano)]));
  const r = { ...vazio };
  // O plano n do curso vai para a sessão que hoje está na posição n; depois de gravado fica preso ao id dessa sessão.
  for (let n = 1; sessaoLectivaN(turma.cronograma, n); n++) {
    const sessaoId = String(sessaoLectivaN(turma.cronograma, n)?.id ?? "");
    const modelo = planos.get(n);
    if (!modelo) { r.semModelo += 1; continue; }
    const actual = actuais.get(sessaoId);
    const temPlano = actual != null && planoTemTexto(actual);
    if (temPlano && (!o.substituir || actual.assinado === true)) { r.mantidos += 1; continue; }
    if (!sessaoId) { r.semModelo += 1; continue; }
    await gravarSessao(db, regime, turmaId, { id: sessaoId, n }, { plano: modelo });
    r.importados += 1;
  }
  return r;
}

/** Depois de gravar a ficha do curso: leva os planos às turmas abertas do curso (sem substituir). */
export async function importarParaTurmasDoCurso(db: Db, regime: Regime, cursoId: number) {
  let importados = 0;
  for (const id of await turmasAbertasDoCurso(db, regime, cursoId)) {
    importados += (await importarPlanosCurso(db, regime, id)).importados;
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
      partes.plano = { ...asObj(fonte.plano), assinado: false, assinadoEm: undefined };
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
