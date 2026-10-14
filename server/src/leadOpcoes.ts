import type { Db } from "./db/pool.js";
import * as leads from "./repos/leads.js";

/**
 * «Como conheceu a ENA» vem sempre da lista de opções `origens` (as estatísticas agrupam por estes valores).
 * Um texto que não está na lista passa a «Outro»; sem lista configurada guarda-se o texto como veio.
 */
export async function origemDaLista(db: Db, texto: string, omissao = "Website") {
  const pedido = texto.trim() || omissao;
  const opcao = await leads.opcaoDaLista(db, "origens", pedido);
  if (opcao) return opcao;
  if (!(await leads.listaTemOpcoes(db, "origens"))) return pedido;
  return (await leads.opcaoDaLista(db, "origens", "Outro")) ?? "Outro";
}

/** Campanha da pré-inscrição: pelo id (CRM) ou pelo nome (ligação com `?campanha=`). Nome e id ficam alinhados. */
export async function campanhaDoPedido(db: Db, pedido: { campanhaId?: number | null; campanha?: string }) {
  if (pedido.campanhaId) {
    const c = await leads.campanhaPorId(db, pedido.campanhaId);
    if (c) return { campanha: c.nome, campanhaId: c.id };
  }
  const nome = (pedido.campanha ?? "").trim();
  if (!nome) return { campanha: "", campanhaId: null };
  const c = await leads.campanhaPorNome(db, nome);
  return c ? { campanha: c.nome, campanhaId: c.id } : { campanha: nome, campanhaId: null };
}
