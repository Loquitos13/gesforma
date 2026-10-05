import { useEffect, useMemo, useState } from "react";
import { apiCursoFicha, type Regime } from "./api";
import { idCursoPorNome } from "./cursoLocais";
import { useLists } from "./ListsContext";

export type ModoAvaliacao = "modulos" | "final";

export type ParametroAvaliacao = {
  id: string;
  label: string;
  peso: number;
};

export type MomentoAvaliacao = { id: string; label: string };

export type AvaliacaoCurso = {
  modo: ModoAvaliacao;
  escalaMin: number;
  escalaMax: number;
  unidade: string;
  minimoAprovacao: number;
  pesosEquitativos: boolean;
  parametros: ParametroAvaliacao[];
  /** Quando existe, a grelha da turma usa estes momentos em vez dos módulos do programa. */
  momentos?: MomentoAvaliacao[];
};

export function cursoECcp(nome: string | undefined) {
  return /ccp/i.test(nome ?? "");
}

/** Grelha de observação das simulações pedagógicas do CCP (inicial e final). */
export function avaliacaoCcp(): AvaliacaoCurso {
  return {
    modo: "modulos",
    escalaMin: 0,
    escalaMax: 20,
    unidade: "valores",
    minimoAprovacao: 10,
    pesosEquitativos: false,
    momentos: [
      { id: "ccp-sim-inicial", label: "Simulação inicial" },
      { id: "ccp-sim-final", label: "Simulação final" },
    ],
    parametros: [
      { id: "ccp-planificacao", label: "Planificação da sessão", peso: 20 },
      { id: "ccp-comunicacao", label: "Comunicação e relação pedagógica", peso: 20 },
      { id: "ccp-metodos", label: "Métodos e técnicas", peso: 20 },
      { id: "ccp-recursos", label: "Recursos didáticos", peso: 15 },
      { id: "ccp-grupo", label: "Gestão do grupo e do tempo", peso: 15 },
      { id: "ccp-avaliacao", label: "Avaliação das aprendizagens", peso: 10 },
    ],
  };
}

export type NotaAvaliacao = {
  formandoId: number;
  moduloId: string;
  parametroId: string;
  nota: number | null;
};

export const MODULO_FINAL = "_final";

export function avaliacaoPadrao(): AvaliacaoCurso {
  return {
    modo: "final",
    escalaMin: 0,
    escalaMax: 20,
    unidade: "valores",
    minimoAprovacao: 10,
    pesosEquitativos: true,
    parametros: [],
  };
}

export function novoParametroId() {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function parseAvaliacaoCurso(payload: Record<string, unknown> | undefined): AvaliacaoCurso {
  const raw = payload?.avaliacaoCurso;
  const base = avaliacaoPadrao();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const parametros = Array.isArray(o.parametros)
    ? o.parametros.map((item, i) => {
        const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
        return {
          id: String(row.id ?? novoParametroId()),
          label: String(row.label ?? `Parâmetro ${i + 1}`),
          peso: Number(row.peso) > 0 ? Number(row.peso) : 1,
        };
      }).filter(p => p.label.trim())
    : [];
  const escalaMin = Number(o.escalaMin);
  const escalaMax = Number(o.escalaMax);
  const minimo = Number(o.minimoAprovacao);
  return {
    modo: o.modo === "modulos" ? "modulos" : "final",
    escalaMin: Number.isFinite(escalaMin) ? escalaMin : base.escalaMin,
    escalaMax: Number.isFinite(escalaMax) && escalaMax > (Number.isFinite(escalaMin) ? escalaMin : 0)
      ? escalaMax
      : base.escalaMax,
    unidade: String(o.unidade ?? base.unidade).trim() || base.unidade,
    minimoAprovacao: Number.isFinite(minimo) ? minimo : base.minimoAprovacao,
    pesosEquitativos: o.pesosEquitativos !== false,
    parametros,
    momentos: Array.isArray(o.momentos)
      ? o.momentos.flatMap(item => {
        if (!item || typeof item !== "object") return [];
        const row = item as Record<string, unknown>;
        const id = String(row.id ?? "").trim();
        const label = String(row.label ?? "").trim();
        return id && label ? [{ id, label }] : [];
      })
      : undefined,
  };
}

export function fracoesPeso(cfg: AvaliacaoCurso): Record<string, number> {
  const params = cfg.parametros;
  if (!params.length) return {};
  if (cfg.pesosEquitativos) {
    const f = 1 / params.length;
    return Object.fromEntries(params.map(p => [p.id, f]));
  }
  const soma = params.reduce((a, p) => a + (p.peso > 0 ? p.peso : 0), 0);
  if (soma <= 0) {
    const f = 1 / params.length;
    return Object.fromEntries(params.map(p => [p.id, f]));
  }
  return Object.fromEntries(params.map(p => [p.id, (p.peso > 0 ? p.peso : 0) / soma]));
}

export function chaveNota(formandoId: number, moduloId: string, parametroId: string) {
  return `${formandoId}|${moduloId}|${parametroId}`;
}

export function mapaNotas(notas: NotaAvaliacao[]) {
  const m = new Map<string, number | null>();
  for (const n of notas) m.set(chaveNota(n.formandoId, n.moduloId, n.parametroId), n.nota);
  return m;
}

function notaDe(mapa: Map<string, number | null>, formandoId: number, moduloId: string, parametroId: string) {
  const v = mapa.get(chaveNota(formandoId, moduloId, parametroId));
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Nota ponderada dos parâmetros. Null se faltar algum. */
export function notaPonderada(
  cfg: AvaliacaoCurso,
  mapa: Map<string, number | null>,
  formandoId: number,
  moduloId: string,
): number | null {
  if (!cfg.parametros.length) return null;
  const frac = fracoesPeso(cfg);
  let acc = 0;
  for (const p of cfg.parametros) {
    const n = notaDe(mapa, formandoId, moduloId, p.id);
    if (n == null) return null;
    acc += n * (frac[p.id] ?? 0);
  }
  return roundNota(acc);
}

export function notaFinalFormando(
  cfg: AvaliacaoCurso,
  mapa: Map<string, number | null>,
  formandoId: number,
  moduloIds: string[],
): number | null {
  if (cfg.modo === "final") return notaPonderada(cfg, mapa, formandoId, MODULO_FINAL);
  if (!moduloIds.length) return null;
  const notas: number[] = [];
  for (const id of moduloIds) {
    const n = notaPonderada(cfg, mapa, formandoId, id);
    if (n == null) return null;
    notas.push(n);
  }
  const media = notas.reduce((a, b) => a + b, 0) / notas.length;
  return roundNota(media);
}

export function clampNota(n: number, cfg: AvaliacaoCurso) {
  const lo = Math.min(cfg.escalaMin, cfg.escalaMax);
  const hi = Math.max(cfg.escalaMin, cfg.escalaMax);
  return roundNota(Math.min(hi, Math.max(lo, n)));
}

export function listaNotas(mapa: Map<string, number | null>): NotaAvaliacao[] {
  const out: NotaAvaliacao[] = [];
  for (const [k, v] of mapa) {
    const [fid, moduloId, parametroId] = k.split("|");
    if (!parametroId) continue;
    out.push({
      formandoId: Number(fid),
      moduloId: moduloId ?? "",
      parametroId,
      nota: v,
    });
  }
  return out;
}

export function roundNota(n: number) {
  return Math.round(n * 100) / 100;
}

export function formatNota(n: number | null, unidade: string) {
  if (n == null) return "-";
  const txt = Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return unidade === "%" ? `${txt} %` : `${txt} ${unidade}`;
}

export function aprovado(nota: number | null, minimo: number) {
  if (nota == null) return null;
  return nota >= minimo;
}

export function useAvaliacaoCurso(regime: Regime, cursoNome: string | undefined) {
  const { cursosGold, cursosFin } = useLists();
  const [cfg, setCfg] = useState<AvaliacaoCurso>(avaliacaoPadrao);

  const cursoId = useMemo(() => {
    if (!cursoNome) return null;
    return idCursoPorNome(regime, cursoNome, cursosGold, cursosFin);
  }, [cursoNome, cursosFin, cursosGold, regime]);

  useEffect(() => {
    const ccp = cursoECcp(cursoNome);
    if (cursoId == null) { setCfg(ccp ? avaliacaoCcp() : avaliacaoPadrao()); return; }
    let alive = true;
    apiCursoFicha(regime, cursoId)
      .then(r => {
        if (!alive) return;
        const parsed = parseAvaliacaoCurso(r.ficha?.payload);
        setCfg(parsed.parametros.length === 0 && ccp ? avaliacaoCcp() : parsed);
      })
      .catch(() => { if (alive) setCfg(ccp ? avaliacaoCcp() : avaliacaoPadrao()); });
    return () => { alive = false; };
  }, [cursoId, cursoNome, regime]);

  return cfg;
}

