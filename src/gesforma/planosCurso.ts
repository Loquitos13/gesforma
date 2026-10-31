import { useEffect, useState } from "react";
import { apiCursoFicha } from "../partilhado/api";
import { useOpcoes } from "../partilhado/dados/useOpcoes";
import { emptyPlano, type MomentoKey, type PlanoSessaoData } from "../partilhado/TurmaExtras";
import { modulosDoPlano } from "../partilhado/planosModulo";

/**
 * Plano de sessão da ficha do curso: o plano completo (os três momentos) e um sumário padrão.
 * Cada plano vai para as sessões do seu módulo / tema (sem módulo, a sessão n recebe o plano com a ordem n);
 * o servidor grava-o nas sessões sem plano.
 */
export type PlanoCurso = {
  ordem: number;
  objetivosGerais: string;
  objetivosEspecificos: string;
  momentos: PlanoSessaoData["momentos"];
  /** Sumário padrão: o servidor grava-o como sumário da sessão (Gold) em todas as turmas do curso. */
  sumario: { conteudos: string; atividades: string };
  /** Módulos / temas do programa: o plano vai para as sessões desses módulos (vazio: para a sessão com este número). */
  modulos: string[];
};

export type ValorFormadorCurso = { nome: string; valorHora: string };

const MOMENTOS: MomentoKey[] = ["introducao", "desenvolvimento", "conclusao"];

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
    modulos: modulosDoPlano(row),
  };
}

export function novoPlanoCurso(ordem: number): PlanoCurso {
  return { ordem, objetivosGerais: "", objetivosEspecificos: "", momentos: emptyPlano().momentos, sumario: { conteudos: "", atividades: "" }, modulos: [] };
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
