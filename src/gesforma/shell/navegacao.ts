import { comercialAbre } from "../../partilhado/vistasComercial";
import type { Vista } from "../rotasGesforma";
import type { NomeIcone } from "./Icones";

export type ItemMenu = { label: string; view?: Vista; icon: NomeIcone; children?: { label: string; view: Vista }[] };
export type GrupoMenu = { group: string; items: ItemMenu[] };

/** Estrutura do menu (a mesma de sempre: Gold, Financiada, Gestão, Sistema). */
export const MENU: GrupoMenu[] = [
  { group: "Gold", items: [
    { label: "Painel", view: "gold-painel", icon: "home" },
    { label: "CRM", icon: "crm", children: [
      { label: "Pré-inscrições", view: "gold-preinscricoes" },
      { label: "Clientes", view: "gold-crm-clientes" },
      { label: "Parceiros", view: "gold-crm-parceiros" },
      { label: "Contratos", view: "gold-crm-contratos" },
    ] },
    { label: "Equipa", view: "gold-equipa", icon: "pessoas" },
    { label: "Formandos", view: "gold-formandos-turmas", icon: "pessoas" },
    { label: "Campanhas", view: "gold-campanhas", icon: "campanha" },
    // Só no menu do comercial (as turmas, só leitura): os outros perfis Gold têm as Turmas.
    { label: "Cronogramas", view: "gold-cronogramas", icon: "calendario" },
    { label: "Edição de Cursos", icon: "livro", children: [
      { label: "Cursos Gold", view: "gold-cursos" }, { label: "Módulos", view: "gold-modulos" },
      { label: "Conteúdos", view: "gold-conteudos" }, { label: "Datas", view: "gold-datas" },
      { label: "Locais", view: "gold-locais" }, { label: "Horários", view: "gold-horarios" },
      { label: "Áreas Temáticas", view: "gold-areas-tematicas" },
    ] },
    { label: "Turmas", view: "gold-turmas", icon: "turma" },
    { label: "Formadores", view: "gold-formadores", icon: "pessoa" },
    { label: "Dossiê TP", view: "gold-dtp", icon: "pasta" },
    { label: "Inquéritos", view: "gold-inqueritos", icon: "doc" },
  ] },
  { group: "Financiada", items: [
    { label: "Painel", view: "fin-painel", icon: "home" },
    { label: "CRM", icon: "crm", children: [
      { label: "Pré-inscrições", view: "fin-preinscricoes" },
      { label: "Clientes", view: "fin-crm-clientes" },
      { label: "Parceiros", view: "fin-crm-parceiros" },
      { label: "Contratos", view: "fin-crm-contratos" },
    ] },
    { label: "Equipa", view: "fin-equipa", icon: "pessoas" },
    { label: "Inscrições", view: "fin-inscricoes", icon: "inscricao" },
    { label: "Formandos", view: "fin-formandos", icon: "pessoas" },
    { label: "Turmas", view: "fin-turmas", icon: "turma" },
    { label: "Formadores", view: "fin-formadores", icon: "pessoa" },
    { label: "Edição de Cursos", icon: "livro", children: [
      { label: "Cursos", view: "fin-cursos" }, { label: "Módulos", view: "fin-modulos" },
      { label: "Conteúdos", view: "fin-conteudos" }, { label: "Datas", view: "fin-datas" },
      { label: "Locais", view: "fin-locais" }, { label: "Áreas Temáticas", view: "fin-areas-tematicas" },
    ] },
    { label: "Dossiê TP", view: "fin-dtp", icon: "pasta" },
    { label: "Inquéritos", view: "fin-inqueritos", icon: "doc" },
  ] },
  { group: "Gestão", items: [
    { label: "Blog", icon: "blog", children: [{ label: "Posts", view: "blog-posts" }, { label: "Temáticas", view: "blog-tematicas" }] },
    { label: "Empresas / Business", view: "empresas-servicos", icon: "site" },
    { label: "Listas de opções", view: "listas-opcoes", icon: "lista" },
  ] },
  { group: "Sistema", items: [
    { label: "Gestão", icon: "pessoas", children: [{ label: "Utilizadores", view: "utilizadores" }] },
    { label: "Emails Automáticos", view: "emails", icon: "email" },
    { label: "Pagamentos", view: "pagamentos", icon: "cartao" },
    { label: "Site", view: "site", icon: "site" },
    { label: "Configurações", view: "configuracoes", icon: "config" },
  ] },
];

export const MENU_FORMADOR: GrupoMenu = {
  group: "Formador",
  items: [
    { label: "As minhas turmas", view: "formador-turmas", icon: "turma" },
    { label: "Calendário", view: "formador-calendario", icon: "calendario" },
    { label: "Documentos e perfil", view: "formador-perfil", icon: "pessoa" },
  ],
};

/** Vistas que o formador pode abrir. */
export const VISTAS_FORMADOR = new Set<Vista>(["formador-turmas", "formador-calendario", "formador-perfil", "gold-cockpit-turma", "fin-cockpit-turma", "gold-turmas"]);

/** Cada perfil começa no seu painel: a Comercial Gold não entra na Financiada e vice-versa. */
export function painelDoPerfil(role: string): Vista {
  if (role === "formador") return "formador-turmas";
  return role === "financiada" ? "fin-painel" : "gold-painel";
}

function gruposDoPerfil(role: string): string[] {
  if (role === "formador") return ["Formador"];
  if (role === "financiada") return ["Financiada", "Gestão"];
  return ["Gold", "Financiada", "Gestão", "Sistema"];
}

/** O comercial só vende: do menu ficam as vistas de `VISTAS_COMERCIAL` (submenus sem filhos desaparecem). */
function soVendas(g: GrupoMenu): GrupoMenu {
  const items: ItemMenu[] = [];
  for (const item of g.items) {
    if (item.view) {
      if (comercialAbre(item.view)) items.push(item);
      continue;
    }
    const children = item.children?.filter(c => comercialAbre(c.view)) ?? [];
    if (children.length) items.push({ ...item, children });
  }
  return { ...g, items };
}

export function menuDoPerfil(role: string): GrupoMenu[] {
  if (role === "formador") return [MENU_FORMADOR];
  if (role === "comercial") return MENU.map(soVendas).filter(g => g.items.length);
  const permitidos = gruposDoPerfil(role);
  return MENU
    .filter(g => permitidos.includes(g.group))
    // «Cronogramas» é a vista de vendas das turmas: quem gere turmas usa as Turmas.
    .map(g => ({ ...g, items: g.items.filter(item => item.view !== "gold-cronogramas") }))
    .map(g => (g.group !== "Sistema" || role === "admin")
      ? g
      : { ...g, items: g.items.filter(item => item.label !== "Gestão" && item.view !== "site") })
    // Os serviços para empresas são conteúdo do site: só a administração os edita (o servidor também o impõe).
    .map(g => (g.group === "Gestão" && role !== "admin") ? { ...g, items: g.items.filter(item => item.view !== "empresas-servicos") } : g)
    // O blog é da secretaria: a Financiada vê só as listas de opções em Gestão (o comercial não tem Gestão, ver soVendas).
    .map(g => (g.group === "Gestão" && role === "financiada") ? { ...g, items: g.items.filter(item => item.label !== "Blog") } : g);
}

/** Vistas sem entrada própria no menu que qualquer perfil da equipa pode abrir. */
const VISTAS_LIVRES = new Set<Vista>(["notificacoes"]);

/**
 * A vista existe no menu deste perfil (ou é uma ficha/cockpit de uma vista que existe)?
 * Evita abrir pelo endereço ecrãs de outra área que só iam mostrar erros de acesso; o servidor continua a decidir.
 */
export function vistaNoMenuDoPerfil(role: string, v: Vista): boolean {
  if (VISTAS_LIVRES.has(v)) return true;
  if (role === "comercial") return comercialAbre(v);
  // Os cronogramas (só leitura) abrem-se pelo endereço a quem vê as turmas Gold.
  if (v === "gold-cronogramas") return vistaNoMenuDoPerfil(role, "gold-turmas");
  const alvos = v === "formador-ficha" || v === "formadores" ? ["gold-formadores", "fin-formadores"] as Vista[] : [vistaDoMenu(v)];
  return menuDoPerfil(role).some(g => g.items.some(item =>
    (item.view && alvos.includes(item.view)) || item.children?.some(c => alvos.includes(c.view))));
}

/** Vista do menu que fica marcada quando se está numa vista "filha" (ficha, cockpit…). */
export function vistaDoMenu(v: Vista): Vista {
  switch (v) {
    case "painel": return "gold-painel";
    case "gold-cockpit-turma": return "gold-turmas";
    case "fin-cockpit-turma":
    case "fin-presencas": return "fin-turmas";
    case "gold-curso-ficha": return "gold-cursos";
    case "fin-curso-ficha": return "fin-cursos";
    case "gold-formandos-gold":
    case "gold-formando-ficha": return "gold-formandos-turmas";
    case "fin-formando-ficha": return "fin-formandos";
    case "formador-ficha":
    case "formadores": return "gold-formadores";
    case "equipa": return "gold-equipa";
    default: return v;
  }
}

export const TITULOS: Partial<Record<Vista, string>> = {
  painel: "Painel", "gold-painel": "Painel", "fin-painel": "Painel",
  "gold-preinscricoes": "Pré-inscrições", "fin-preinscricoes": "Pré-inscrições",
  "gold-crm-clientes": "Clientes", "fin-crm-clientes": "Clientes",
  "gold-crm-parceiros": "Parceiros", "fin-crm-parceiros": "Parceiros",
  "gold-crm-contratos": "Contratos", "fin-crm-contratos": "Contratos",
  "formador-turmas": "As minhas turmas", "formador-calendario": "Calendário", "formador-perfil": "Perfil",
  "gold-equipa": "Equipa", "fin-equipa": "Equipa", equipa: "Equipa",
  "gold-formandos-turmas": "Formandos", "gold-formandos-gold": "Formandos", "gold-formando-ficha": "Ficha do formando",
  "fin-formandos": "Formandos", "fin-formando-ficha": "Ficha do formando", "fin-inscricoes": "Inscrições",
  "gold-campanhas": "Campanhas", "gold-cursos": "Cursos", "gold-curso-ficha": "Ficha do curso",
  "gold-datas": "Datas", "gold-horarios": "Horários", "gold-locais": "Locais", "gold-areas-tematicas": "Áreas Temáticas",
  "gold-modulos": "Módulos", "gold-conteudos": "Conteúdos",
  "gold-turmas": "Turmas", "gold-cronogramas": "Cronogramas", "gold-formadores": "Formadores", formadores: "Formadores", "formador-ficha": "Ficha do formador",
  "gold-cockpit-turma": "Turma", "gold-dtp": "Dossiê TP", "gold-inqueritos": "Inquéritos",
  "fin-cursos": "Cursos", "fin-curso-ficha": "Ficha do curso", "fin-turmas": "Turmas", "fin-formadores": "Formadores",
  "fin-presencas": "Sessões da turma", "fin-dtp": "Dossiê TP", "fin-cockpit-turma": "Turma", "fin-inqueritos": "Inquéritos",
  "fin-modulos": "Módulos", "fin-conteudos": "Conteúdos", "fin-datas": "Datas", "fin-locais": "Locais", "fin-areas-tematicas": "Áreas Temáticas",
  notificacoes: "Notificações",
  "blog-posts": "Posts", "blog-tematicas": "Temáticas", "listas-opcoes": "Listas de opções",
  emails: "Emails automáticos", pagamentos: "Pagamentos", configuracoes: "Configurações", utilizadores: "Utilizadores", site: "Site",
};

/** Grupo e submenu de uma vista, para as migalhas ("Gold / CRM / Pré-inscrições"). */
export function caminhoNoMenu(v: Vista): { grupo?: string; pai?: string; painel?: Vista } {
  const alvo = vistaDoMenu(v);
  for (const g of [...MENU, MENU_FORMADOR]) {
    for (const item of g.items) {
      if (item.view === alvo) return { grupo: g.group, painel: painelDoGrupo(g.group) };
      if (item.children?.some(c => c.view === alvo)) return { grupo: g.group, pai: item.label, painel: painelDoGrupo(g.group) };
    }
  }
  return {};
}

function painelDoGrupo(grupo: string): Vista | undefined {
  if (grupo === "Gold") return "gold-painel";
  if (grupo === "Financiada") return "fin-painel";
  if (grupo === "Sistema") return "configuracoes";
  return undefined;
}
