import { useEffect, useState } from "react";
import { apiCursoFicha } from "./api";
import { idCursoPorNome } from "./cursoLocais";
import { useLists } from "./ListsContext";
import { emptyPlano, type PlanoSessaoData } from "./TurmaExtras";

export type PlanoCurso = {
  ordem: number;
  objetivosGerais: string;
  objetivosEspecificos: string;
  conteudo: string;
};

export type ValorFormadorCurso = { nome: string; valorHora: string };

export function planoTemTexto(p?: PlanoSessaoData | null) {
  if (!p) return false;
  if (p.objetivosGerais.trim() || p.objetivosEspecificos.trim()) return true;
  return Object.values(p.momentos).some(m => Object.values(m).some(v => String(v).trim()));
}

export function herdarPlanoCurso(modelos: PlanoCurso[], n: number, actual: PlanoSessaoData): PlanoSessaoData {
  if (planoTemTexto(actual)) return actual;
  const base = modelos.find(p => p.ordem === n) ?? modelos[n - 1];
  if (!base || (!base.objetivosGerais && !base.objetivosEspecificos && !base.conteudo)) return actual;
  const vazio = emptyPlano();
  return {
    ...vazio,
    ...actual,
    objetivosGerais: base.objetivosGerais,
    objetivosEspecificos: base.objetivosEspecificos,
    momentos: {
      ...vazio.momentos,
      ...actual.momentos,
      desenvolvimento: {
        ...(actual.momentos?.desenvolvimento ?? vazio.momentos.desenvolvimento),
        conteudo: base.conteudo || actual.momentos?.desenvolvimento?.conteudo || "",
      },
    },
  };
}

function lerPlanos(raw: unknown): PlanoCurso[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const ordem = Number(row.ordem);
    if (!Number.isFinite(ordem) || ordem < 1) return [];
    return [{
      ordem,
      objetivosGerais: String(row.objetivosGerais ?? ""),
      objetivosEspecificos: String(row.objetivosEspecificos ?? ""),
      conteudo: String(row.conteudo ?? ""),
    }];
  });
}

export function usePlanosCurso(regime: "gold" | "fin", cursoNome: string) {
  const { cursosGold, cursosFin } = useLists();
  const [planos, setPlanos] = useState<PlanoCurso[]>([]);
  const [valores, setValores] = useState<ValorFormadorCurso[]>([]);
  useEffect(() => {
    const id = idCursoPorNome(regime, cursoNome, cursosGold, cursosFin);
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
  }, [cursoNome, cursosFin, cursosGold, regime]);
  return { planos, valores };
}
