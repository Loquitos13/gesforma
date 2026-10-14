// Critérios-tipo da simulação pedagógica, lidos da API (conteudos_modelo, tipo "criterios").
import { useMemo } from "react";
import type { Opcao, Regime } from "../partilhado/api/catalogos";
import { useOpcoes } from "../partilhado/dados/useOpcoes";
import type { CriterioAvaliacao } from "../partilhado/TurmaExtras";

/** O curso casa com o padrão do modelo? "ccp" casa com o nome; "ufcd:<código>" com o código UFCD. */
export function casaPadrao(padrao: string, curso: string | undefined) {
  const nome = (curso ?? "").toLowerCase();
  if (!nome) return false;
  if (padrao === "ccp") return /ccp|formadores/.test(nome);
  if (padrao.startsWith("ufcd:")) return nome.includes(padrao.slice(5));
  return nome.includes(padrao.toLowerCase());
}

/** Critérios do primeiro modelo "criterios" que casa com o curso (ou nenhum). */
export function criteriosDoModelo(modelos: Opcao[], curso: string | undefined): CriterioAvaliacao[] {
  const m = modelos.find(o => o.extra?.tipo === "criterios" && casaPadrao(String(o.extra?.padrao ?? ""), curso));
  const lista = Array.isArray(m?.extra?.criterios) ? m!.extra!.criterios as unknown[] : [];
  return lista.flatMap(x => {
    const c = x as { id?: unknown; label?: unknown };
    return typeof c.id === "string" && typeof c.label === "string" ? [{ id: c.id, label: c.label }] : [];
  });
}

export function useCriteriosModelo(regime: Regime, curso: string | undefined) {
  const { opcoes } = useOpcoes("modelos_conteudo", { regime });
  return useMemo(() => criteriosDoModelo(opcoes, curso), [opcoes, curso]);
}
