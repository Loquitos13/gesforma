import { useEffect, useState } from "react";
import { apiCursoFicha } from "../partilhado/api";
import { useOpcoes } from "../partilhado/dados/useOpcoes";
import { emptyPlano, type MomentoKey, type PlanoSessaoData, type SumarioSessaoData } from "../partilhado/TurmaExtras";

/**
 * Plano de sessão da ficha do curso: o plano completo (os três momentos) e um sumário padrão.
 * A sessão n da turma recebe o plano com a ordem n (o servidor grava-o nas sessões sem plano).
 */
export type PlanoCurso = {
  ordem: number;
  objetivosGerais: string;
  objetivosEspecificos: string;
  momentos: PlanoSessaoData["momentos"];
  /** Sumário padrão: só pré-preenche o sumário da sessão, nunca é gravado sozinho. */
  sumario: { conteudos: string; atividades: string };
};

export type ValorFormadorCurso = { nome: string; valorHora: string };

const MOMENTOS: MomentoKey[] = ["introducao", "desenvolvimento", "conclusao"];

export function planoTemTexto(p?: Pick<PlanoSessaoData, "objetivosGerais" | "objetivosEspecificos" | "momentos"> | null) {
  if (!p) return false;
  if (p.objetivosGerais.trim() || p.objetivosEspecificos.trim()) return true;
  return Object.values(p.momentos).some(m => Object.values(m).some(v => String(v).trim()));
}

/** Lê uma linha da ficha (formato novo, ou o antigo com `conteudo` solto, que vai para o desenvolvimento). */
export function normalizarPlanoCurso(item: unknown, ordemOmissao = 1): PlanoCurso {
  const row = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
  const ordem = Number(row.ordem);
  const vazio = emptyPlano();
  const raw = (row.momentos && typeof row.momentos === "object" ? row.momentos : {}) as Record<string, unknown>;
  const momentos = Object.fromEntries(MOMENTOS.map(k => {
    const m = (raw[k] && typeof raw[k] === "object" ? raw[k] : {}) as Record<string, unknown>;
    return [k, Object.fromEntries(Object.keys(vazio.momentos[k]).map(c => [c, String(m[c] ?? "")]))];
  })) as PlanoSessaoData["momentos"];
  if (!momentos.desenvolvimento.conteudo.trim() && String(row.conteudo ?? "").trim()) momentos.desenvolvimento.conteudo = String(row.conteudo);
  const s = (row.sumario && typeof row.sumario === "object" ? row.sumario : {}) as Record<string, unknown>;
  return {
    ordem: Number.isFinite(ordem) && ordem >= 1 ? ordem : ordemOmissao,
    objetivosGerais: String(row.objetivosGerais ?? ""),
    objetivosEspecificos: String(row.objetivosEspecificos ?? ""),
    momentos,
    sumario: { conteudos: String(s.conteudos ?? ""), atividades: String(s.atividades ?? "") },
  };
}

export function novoPlanoCurso(ordem: number): PlanoCurso {
  return { ordem, objetivosGerais: "", objetivosEspecificos: "", momentos: emptyPlano().momentos, sumario: { conteudos: "", atividades: "" } };
}

const modeloDaSessao = (modelos: PlanoCurso[], n: number) => modelos.find(p => p.ordem === n);

/** Sessão ainda sem plano: mostra o do curso (o servidor também o grava ao importar). */
export function herdarPlanoCurso(modelos: PlanoCurso[], n: number, actual: PlanoSessaoData): PlanoSessaoData {
  if (planoTemTexto(actual)) return actual;
  const base = modeloDaSessao(modelos, n);
  if (!base || !planoTemTexto(base)) return actual;
  return { ...actual, objetivosGerais: base.objetivosGerais, objetivosEspecificos: base.objetivosEspecificos, momentos: base.momentos };
}

/** Sumário vazio e por assinar: começa com o sumário padrão do curso. */
export function herdarSumarioCurso(modelos: PlanoCurso[], n: number, actual: SumarioSessaoData): SumarioSessaoData {
  if (actual.assinado || actual.conteudos.trim() || actual.atividades.trim()) return actual;
  const base = modeloDaSessao(modelos, n)?.sumario;
  if (!base || (!base.conteudos.trim() && !base.atividades.trim())) return actual;
  return { ...actual, conteudos: base.conteudos, atividades: base.atividades };
}

function lerPlanos(raw: unknown): PlanoCurso[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item, i) => {
    if (!item || typeof item !== "object") return [];
    const ordem = Number((item as { ordem?: unknown }).ordem);
    if (!Number.isFinite(ordem) || ordem < 1) return [];
    return [normalizarPlanoCurso(item, i + 1)];
  });
}

export function usePlanosCurso(regime: "gold" | "fin", cursoNome: string) {
  const cursos = useOpcoes("cursos", { regime, todos: true });
  const alvo = cursoNome.trim().toLowerCase();
  const id = cursos.opcoes.find(o => o.valor.toLowerCase() === alvo || String(o.extra?.ufcd ?? "").toLowerCase() === alvo)?.id ?? null;
  const [planos, setPlanos] = useState<PlanoCurso[]>([]);
  const [valores, setValores] = useState<ValorFormadorCurso[]>([]);
  useEffect(() => {
    if (id == null) { setPlanos([]); setValores([]); return; }
    let vivo = true;
    apiCursoFicha(regime, id)
      .then(r => {
        if (!vivo) return;
        const payload = r.ficha?.payload as { planosSessao?: unknown; valoresFormador?: unknown } | undefined;
        setPlanos(lerPlanos(payload?.planosSessao));
        const vals = Array.isArray(payload?.valoresFormador) ? payload.valoresFormador : [];
        setValores(vals.flatMap(item => {
          if (!item || typeof item !== "object") return [];
          const row = item as { nome?: unknown; valorHora?: unknown };
          const nome = String(row.nome ?? "").trim();
          if (!nome) return [];
          return [{ nome, valorHora: String(row.valorHora ?? "") }];
        }));
      })
      .catch(() => { if (vivo) { setPlanos([]); setValores([]); } });
    return () => { vivo = false; };
  }, [id, regime]);
  return { planos, valores };
}
