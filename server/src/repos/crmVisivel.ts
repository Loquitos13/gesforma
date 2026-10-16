import { Filtros, valor, type AtorCrm, type Consulta } from "./sql.js";

/** Tabelas comerciais com dono e regime (as mesmas colunas que as políticas RLS usam). */
export const TABELAS_CRM = {
  preinscricoes: { dono: "comercial_id", regime: "regime" },
  propostas_comerciais: { dono: "comercial_id", regime: "regime" },
  contratos_comerciais: { dono: "comercial_id", regime: "formando_regime" },
} as const;

export type TabelaCrm = keyof typeof TABELAS_CRM;

/** Dono de um documento novo: o comercial só cria em seu nome (o WITH CHECK do RLS); os outros podem indicar quem. */
export function donoDoPedido(ator: AtorCrm, pedido?: string | null) {
  return ator.role === "comercial" ? ator.id : pedido ?? ator.id;
}

/** A linha existe e este ator pode vê-la (`Filtros.visivelPara`). */
export async function linhaVisivel(c: Consulta, tabela: TabelaCrm, id: number, ator: AtorCrm) {
  const { dono, regime } = TABELAS_CRM[tabela];
  const w = new Filtros([id]).sempre("id = $1").visivelPara(ator, dono, regime);
  return Boolean(await valor(c, `SELECT 1 FROM ${tabela} ${w.where}`, w.params));
}
