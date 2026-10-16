export type Vista =
  | "painel" | "gold-painel" | "fin-painel" | "gold-preinscricoes" | "fin-preinscricoes" | "gold-equipa" | "fin-equipa"
  | "gold-crm-clientes" | "gold-crm-parceiros" | "gold-crm-contratos" | "fin-crm-clientes" | "fin-crm-parceiros" | "fin-crm-contratos"
  | "formador-turmas" | "formador-calendario" | "formador-perfil"
  | "gold-formandos-turmas" | "gold-formandos-gold" | "gold-formando-ficha" | "fin-formando-ficha" | "formador-ficha"
  | "gold-campanhas" | "gold-cursos" | "gold-datas" | "gold-horarios" | "gold-locais" | "gold-areas-tematicas"
  | "gold-modulos" | "gold-conteudos" | "gold-turmas" | "gold-formadores" | "gold-cockpit-turma" | "gold-curso-ficha" | "gold-dtp" | "gold-inqueritos"
  | "fin-inscricoes" | "fin-formandos" | "fin-cursos" | "fin-curso-ficha" | "fin-turmas" | "fin-formadores" | "fin-presencas" | "fin-dtp" | "fin-cockpit-turma" | "fin-inqueritos" | "fin-despesas"
  | "fin-modulos" | "fin-conteudos" | "fin-datas" | "fin-locais" | "fin-areas-tematicas"
  | "formadores" | "blog-posts" | "blog-tematicas"
  | "emails" | "pagamentos" | "configuracoes" | "utilizadores" | "equipa" | "notificacoes" | "listas-opcoes" | "site";

export type Separador = "overview" | "cronograma" | "sessoes" | "avaliacao" | "documentos" | "dtp" | "certificados";

export type Destino = {
  view: Vista;
  turmaId?: number;
  tab?: Separador;
  cursoId?: number | "new";
  cursoNome?: string;
  formandoId?: number;
  formandoOrigem?: "gold-turma" | "gold-avulso" | "fin";
  formadorId?: number;
  leadId?: number;
  /**
   * Filtros a aplicar na vista de destino (ex.: `{ fila: "contactar" }` no CRM). Vão para a query
   * do URL, onde a vista os lê com `useFiltrosUrl`.
   */
  filtros?: Record<string, string>;
};


const CAMINHOS: Record<Vista, string> = {
  painel: "/gesforma",
  "gold-painel": "/gesforma/gold",
  "fin-painel": "/gesforma/financiada",
  "gold-preinscricoes": "/gesforma/gold/pre-inscricoes",
  "fin-preinscricoes": "/gesforma/financiada/pre-inscricoes",
  "gold-crm-clientes": "/gesforma/gold/clientes",
  "fin-crm-clientes": "/gesforma/financiada/clientes",
  "gold-crm-parceiros": "/gesforma/gold/parceiros",
  "fin-crm-parceiros": "/gesforma/financiada/parceiros",
  "gold-crm-contratos": "/gesforma/gold/contratos",
  "fin-crm-contratos": "/gesforma/financiada/contratos",
  "gold-equipa": "/gesforma/gold/equipa",
  "fin-equipa": "/gesforma/financiada/equipa",
  equipa: "/gesforma/equipa",
  "formador-turmas": "/gesforma/formador/turmas",
  "formador-calendario": "/gesforma/formador/calendario",
  "formador-perfil": "/gesforma/formador/perfil",
  "gold-formandos-turmas": "/gesforma/gold/formandos",
  "gold-formandos-gold": "/gesforma/gold/formandos/avulsos",
  "gold-formando-ficha": "/gesforma/gold/formandos",
  "fin-formando-ficha": "/gesforma/financiada/formandos",
  "formador-ficha": "/gesforma/formadores",
  "gold-campanhas": "/gesforma/gold/campanhas",
  "gold-cursos": "/gesforma/gold/cursos",
  "gold-curso-ficha": "/gesforma/gold/cursos/novo",
  "gold-datas": "/gesforma/gold/datas",
  "gold-horarios": "/gesforma/gold/horarios",
  "gold-locais": "/gesforma/gold/locais",
  "gold-areas-tematicas": "/gesforma/gold/areas-tematicas",
  "gold-modulos": "/gesforma/gold/modulos",
  "gold-conteudos": "/gesforma/gold/conteudos",
  "gold-turmas": "/gesforma/gold/turmas",
  "gold-cockpit-turma": "/gesforma/gold/turmas",
  "gold-formadores": "/gesforma/gold/formadores",
  formadores: "/gesforma/formadores",
  "gold-dtp": "/gesforma/gold/dossie",
  "gold-inqueritos": "/gesforma/gold/inqueritos",
  "fin-inscricoes": "/gesforma/financiada/inscricoes",
  "fin-formandos": "/gesforma/financiada/formandos",
  "fin-cursos": "/gesforma/financiada/cursos",
  "fin-curso-ficha": "/gesforma/financiada/cursos/novo",
  "fin-turmas": "/gesforma/financiada/turmas",
  "fin-cockpit-turma": "/gesforma/financiada/turmas",
  "fin-presencas": "/gesforma/financiada/turmas",
  "fin-formadores": "/gesforma/financiada/formadores",
  "fin-modulos": "/gesforma/financiada/modulos",
  "fin-conteudos": "/gesforma/financiada/conteudos",
  "fin-datas": "/gesforma/financiada/datas",
  "fin-locais": "/gesforma/financiada/locais",
  "fin-areas-tematicas": "/gesforma/financiada/areas-tematicas",
  "fin-dtp": "/gesforma/financiada/dossie",
  "fin-inqueritos": "/gesforma/financiada/inqueritos",
  "fin-despesas": "/gesforma/financiada/despesas",
  "blog-posts": "/gesforma/blog/posts",
  "blog-tematicas": "/gesforma/blog/tematicas",
  "listas-opcoes": "/gesforma/listas",
  utilizadores: "/gesforma/sistema/utilizadores",
  emails: "/gesforma/sistema/emails",
  pagamentos: "/gesforma/sistema/pagamentos",
  site: "/gesforma/sistema/site",
  configuracoes: "/gesforma/sistema/configuracoes",
  notificacoes: "/gesforma/notificacoes",
};

/** Fichas com o id no caminho: não entram no mapa caminho → vista. */
const FICHAS = new Set<Vista>(["gold-formando-ficha", "fin-formando-ficha", "formador-ficha"]);

const POR_CAMINHO = new Map<string, Vista>(
  (Object.entries(CAMINHOS) as [Vista, string][])
    .filter(([vista]) => !FICHAS.has(vista) && vista !== "gold-curso-ficha" && vista !== "fin-curso-ficha" && vista !== "gold-cockpit-turma" && vista !== "fin-cockpit-turma" && vista !== "fin-presencas")
    .map(([vista, caminho]) => [caminho, vista]),
);

const SEPARADORES = new Set<Separador>(["overview", "cronograma", "sessoes", "avaliacao", "documentos", "dtp", "certificados"]);

function separadorDe(valor: string | null): Separador | undefined {
  return valor && SEPARADORES.has(valor as Separador) ? valor as Separador : undefined;
}

function numeroDe(valor: string | null) {
  if (!valor || !/^\d+$/.test(valor)) return undefined;
  const n = Number(valor);
  return Number.isSafeInteger(n) ? n : undefined;
}

function cursoDe(valor: string): number | "new" | undefined {
  if (valor === "novo") return "new";
  return numeroDe(valor);
}

export function caminhoDaVista(destino: Destino, drive = ""): string | null {
  const vista = destino.view;
  if ((vista === "gold-cockpit-turma" || vista === "fin-cockpit-turma" || vista === "fin-presencas") && !destino.turmaId) return null;
  if ((vista === "gold-curso-ficha" || vista === "fin-curso-ficha") && destino.cursoId == null) return null;
  if ((vista === "gold-formando-ficha" || vista === "fin-formando-ficha") && !destino.formandoId) return null;
  if (vista === "formador-ficha" && !destino.formadorId) return null;
  let path = CAMINHOS[vista];
  if (vista === "gold-curso-ficha") path = `/gesforma/gold/cursos/${destino.cursoId === "new" ? "novo" : destino.cursoId}`;
  if (vista === "fin-curso-ficha") path = `/gesforma/financiada/cursos/${destino.cursoId === "new" ? "novo" : destino.cursoId}`;
  if (vista === "gold-cockpit-turma") path = `/gesforma/gold/turmas/${destino.turmaId}`;
  if (vista === "fin-cockpit-turma") path = `/gesforma/financiada/turmas/${destino.turmaId}`;
  if (vista === "fin-presencas") path = `/gesforma/financiada/turmas/${destino.turmaId}/sessoes`;
  if (vista === "gold-formando-ficha") path = `/gesforma/gold/formandos/${destino.formandoId}`;
  if (vista === "fin-formando-ficha") path = `/gesforma/financiada/formandos/${destino.formandoId}`;
  if (vista === "formador-ficha") path = `/gesforma/formadores/${destino.formadorId}`;
  const q = new URLSearchParams();
  if (destino.tab && destino.tab !== "overview" && (vista === "gold-cockpit-turma" || vista === "fin-cockpit-turma")) q.set("separador", destino.tab);
  if (destino.cursoNome && (vista === "gold-modulos" || vista === "fin-modulos")) q.set("curso", destino.cursoNome);
  if (destino.formandoId && (vista === "gold-formandos-turmas" || vista === "gold-formandos-gold" || vista === "fin-formandos")) {
    q.set("formando", String(destino.formandoId));
    if (destino.formandoOrigem) q.set("origem", destino.formandoOrigem);
  }
  if (destino.formadorId && (vista === "gold-formadores" || vista === "fin-formadores" || vista === "formadores")) q.set("formador", String(destino.formadorId));
  if (destino.leadId && (vista === "gold-preinscricoes" || vista === "fin-preinscricoes")) q.set("lead", String(destino.leadId));
  if (drive && vista === "configuracoes") q.set("drive", drive);
  // Os parâmetros do router ganham a um filtro com o mesmo nome.
  for (const [chave, valor] of Object.entries(destino.filtros ?? {})) {
    if (!q.has(chave) && valor !== "") q.set(chave, valor);
  }
  const extra = q.toString();
  return extra ? `${path}?${extra}` : path;
}

export function vistaDoCaminho(pathname: string, search = ""): Destino | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const tab = separadorDe(q.get("separador"));
  const formandoId = numeroDe(q.get("formando"));
  const origem = q.get("origem");
  const formandoOrigem: Destino["formandoOrigem"] = origem === "gold-turma" || origem === "gold-avulso" || origem === "fin" ? origem : undefined;
  const formadorId = numeroDe(q.get("formador"));
  const leadId = numeroDe(q.get("lead"));
  const cursoNome = q.get("curso") || undefined;
  const comum = { tab, formandoId, formandoOrigem, formadorId, leadId, cursoNome };

  const fichaGold = /^\/gesforma\/gold\/cursos\/([^/]+)$/.exec(path);
  if (fichaGold && fichaGold[1] !== undefined && POR_CAMINHO.get(path) == null) {
    const cursoId = cursoDe(fichaGold[1]);
    if (cursoId == null) return null;
    return { view: "gold-curso-ficha", cursoId, ...comum };
  }
  const fichaFin = /^\/gesforma\/financiada\/cursos\/([^/]+)$/.exec(path);
  if (fichaFin && fichaFin[1] !== undefined && POR_CAMINHO.get(path) == null) {
    const cursoId = cursoDe(fichaFin[1]);
    if (cursoId == null) return null;
    return { view: "fin-curso-ficha", cursoId, ...comum };
  }
  const fichaFormandoGold = /^\/gesforma\/gold\/formandos\/(\d+)$/.exec(path);
  if (fichaFormandoGold) return { ...comum, view: "gold-formando-ficha", formandoId: Number(fichaFormandoGold[1]) };
  const fichaFormandoFin = /^\/gesforma\/financiada\/formandos\/(\d+)$/.exec(path);
  if (fichaFormandoFin) return { ...comum, view: "fin-formando-ficha", formandoId: Number(fichaFormandoFin[1]) };
  const fichaFormador = /^\/gesforma\/formadores\/(\d+)$/.exec(path);
  if (fichaFormador) return { ...comum, view: "formador-ficha", formadorId: Number(fichaFormador[1]) };
  const sessoes = /^\/gesforma\/financiada\/turmas\/(\d+)\/sessoes$/.exec(path);
  if (sessoes) return { view: "fin-presencas", turmaId: Number(sessoes[1]), ...comum };
  const turmaGold = /^\/gesforma\/gold\/turmas\/(\d+)$/.exec(path);
  if (turmaGold) return { view: "gold-cockpit-turma", turmaId: Number(turmaGold[1]), ...comum };
  const turmaFin = /^\/gesforma\/financiada\/turmas\/(\d+)$/.exec(path);
  if (turmaFin) return { view: "fin-cockpit-turma", turmaId: Number(turmaFin[1]), ...comum };

  const vista = POR_CAMINHO.get(path);
  if (!vista) return null;
  return { view: vista, ...comum };
}

export function gesformaNoEndereco(pathname: string) {
  const path = pathname.replace(/\/+$/, "") || "/";
  return path.startsWith("/gesforma");
}
