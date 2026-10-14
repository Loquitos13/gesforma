import { useMemo } from "react";
import { apiOpcoes, type KindOpcoes, type Opcao, type Regime } from "../api/catalogos";
import type { OpcaoSelecao } from "../ui/Campo";
import { useRecurso } from "./useRecurso";

/**
 * Opções para selects e filtros, sempre da API (`GET /v1/opcoes?kinds=…`, pedidos juntos em lote).
 * Nunca usar listas fixas no código.
 *
 *   const cursos = useOpcoes("cursos", { regime: "gold" });
 *   <Selecao opcoes={cursos.selecao} … />
 *   const origens = useOpcoes("lista", { lista: "origens" });
 */
export function useOpcoes(kind: KindOpcoes, opts: { regime?: Regime; lista?: string; todos?: boolean } = {}) {
  const chave = `opcoes:${kind}:${opts.regime ?? ""}:${opts.lista ?? ""}:${opts.todos ? 1 : 0}`;
  // As opções mudam pouco: cache de 10 minutos partilhada por todos os ecrãs (gravar invalida "opcoes:").
  const { dados, erro, aCarregar, recarregar } = useRecurso(chave, signal => apiOpcoes(kind, opts, signal), { validadeMs: 600_000 });
  const opcoes: Opcao[] = useMemo(() => dados?.opcoes ?? [], [dados]);
  const selecao: OpcaoSelecao[] = useMemo(() => opcoes.map(o => ({ valor: o.valor, rotulo: o.rotulo })), [opcoes]);
  return { opcoes, selecao, erro, aCarregar, recarregar };
}
