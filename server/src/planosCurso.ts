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

/** Planos com texto da ficha do curso, pela ordem da sessão. */
async function planosDoCurso(db: Db, regime: Regime, cursoId: number) {
  return new Map([...(await modelosDoCurso(db, regime, cursoId))].flatMap(([n, m]) => (m.plano ? [[n, m.plano] as const] : [])));
}

/** Plano e sumário padrão de cada sessão da ficha do curso (só os que têm texto). */
async function modelosDoCurso(db: Db, regime: Regime, cursoId: number) {
  const ficha = await lerFicha(db, regime, cursoId);
  const linhas = asObj(ficha?.payload).planosSessao;
  const out = new Map<number, { plano: PlanoSessao | null; sumario: SumarioCurso | null }>();
  for (const l of Array.isArray(linhas) ? linhas : []) {
    const p = planoDaLinha(l);
    if (!p) continue;
    const s = asObj(asObj(l).sumario);
    const sumario = { conteudos: txt(s.conteudos, 6000), atividades: txt(s.atividades, 6000) };
    const temSumario = regime === "gold" && Boolean(sumario.conteudos.trim() || sumario.atividades.trim());
    if (planoTemTexto(p.plano) || temSumario) out.set(p.ordem, { plano: planoTemTexto(p.plano) ? p.plano : null, sumario: temSumario ? sumario : null });
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
  if (!modelos.size) return vazio;
  const actuais = new Map((await listarSessoes(db, regime, turmaId)).map(s => [String(s.sessao_id ?? ""), s]));
  const r = { ...vazio };
  // O plano n do curso vai para a sessão que hoje está na posição n; depois de gravado fica preso ao id dessa sessão.
  for (let n = 1; sessaoLectivaN(turma.cronograma, n); n++) {
    const sessaoId = String(sessaoLectivaN(turma.cronograma, n)?.id ?? "");
    const modelo = modelos.get(n);
    if (!modelo || !sessaoId) { r.semModelo += 1; continue; }
    const linha = actuais.get(sessaoId);
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
