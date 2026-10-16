import type { Db } from "./db/pool.js";
import { mapPreinscricao } from "./ops.js";
import * as repo from "./repos/crmLeads.js";
import type { AtorCrm } from "./repos/sql.js";
import type { CrmDir, CrmFila, CrmFiltros, CrmSort } from "./repos/crmLeads.js";

export type { CrmDir, CrmFila, CrmSort } from "./repos/crmLeads.js";

export type CrmListParams = CrmFiltros & {
  page?: number;
  perPage?: number;
  sort?: CrmSort;
  dir?: CrmDir;
  kanban?: boolean;
};

/** Linha da lista: a ficha mais o estado dos documentos e do percurso. */
function itemLista(r: Record<string, unknown>) {
  return {
    ...mapPreinscricao(r),
    docsEnviados: Number(r.docs_enviados ?? 0),
    docsValidados: Number(r.docs_validados ?? 0),
    docsRecusados: Number(r.docs_recusados ?? 0),
    percursoConcluido: Boolean(r.percurso_concluido_em),
    validada: Boolean(r.validada_em),
    pagamentoPedido: Boolean(r.pagamento_pedido_em),
    consentimento: Boolean(r.consentimento_em),
  };
}

const ESTADOS_PIPELINE = ["Não contactado", "1º Contacto", "2º Contacto", "Pago", "Pré-inscrição", "Formando", "Desistiu"];

/** Lista paginada do CRM com contagens das filas, facetas dos filtros e (opcional) colunas do pipeline. */
export async function queryCrmLeads(db: Db, params: CrmListParams, hoje: string) {
  const page = Math.max(1, params.page ?? 1);
  const perPage = Math.min(100, Math.max(10, params.perPage ?? 50));
  const regime = params.regime === "gold" || params.regime === "fin" ? params.regime : "";
  const { total, linhas } = await repo.pagina(db, params, hoje, { pagina: page, porPagina: perPage, sort: params.sort, dir: params.dir });
  const ator = params.ator;
  const c = await repo.contagens(db, hoje, regime, ator);
  const porEstado: Record<string, number> = {};
  for (const r of await repo.porEstado(db, regime, ator)) porEstado[r.estado] = r.n;
  const [cursos, locais, origens, campanhas] = await Promise.all([
    repo.faceta(db, "curso", regime, ator), repo.faceta(db, "local", regime, ator), repo.faceta(db, "origem", regime, ator), repo.faceta(db, "campanha", regime, ator),
  ]);

  let columns: { estado: string; total: number; valor?: number; items: ReturnType<typeof itemLista>[] }[] | undefined;
  if (params.kanban) {
    columns = [];
    for (const estado of ESTADOS_PIPELINE) {
      const col = await repo.colunaPipeline(db, { ...params, estado: undefined }, hoje, estado, params.sort, params.dir);
      columns.push({ estado, total: col.total, valor: col.valor, items: col.linhas.map(r => itemLista(r)) });
    }
  }

  const n = (k: string) => Number(c[k] ?? 0);
  return {
    items: linhas.map(r => itemLista(r)),
    total,
    page,
    perPage,
    counts: {
      total: n("total"),
      abertos: n("abertos"),
      porContactar: n("por_contactar"),
      conversa: n("conversa"),
      pagos: n("pagos"),
      formando: n("formando"),
      atrasados: n("atrasados"),
      hoje: n("hoje"),
      marcadosHoje: n("marcados_hoje"),
      converter: n("pagos"),
      valorAberto: n("valor_aberto"),
      preinscricoes: n("preinscricoes"),
      manuais: n("manuais"),
      filaPre: n("fila_pre"),
      filaSec: n("fila_sec"),
      desistiu: n("desistiu"),
      semContacto2d: n("sem_contacto_2d"),
    },
    porEstado,
    facets: { cursos, locais, origens, campanhas },
    columns,
  };
}

export async function searchCrmLeads(db: Db, q: string, limit = 12, ator?: AtorCrm) {
  return (await repo.pesquisar(db, q.trim(), limit, ator)).map(r => itemLista(r));
}

export async function exportCrmLeads(db: Db, params: CrmListParams, hoje: string) {
  return (await repo.todas(db, params, hoje, params.sort, params.dir)).map(r => itemLista(r));
}
