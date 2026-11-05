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
      { label: "WhatsApp", view: "gold-whatsapp" },
    ] },
    { label: "Equipa", view: "gold-equipa", icon: "pessoas" },
    { label: "Formandos", view: "gold-formandos-turmas", icon: "pessoas" },
    { label: "Campanhas", view: "gold-campanhas", icon: "campanha" },
    // Só no menu do comercial (as turmas, só leitura): os outros perfis Gold têm as Turmas.
    { label: "Cronogramas", view: "gold-cronogramas", icon: "calendario" },
    { label: "Edição de Cursos", icon: "livro", children: [
      { label: "Cursos Gold", view: "gold-cursos" }, { label: "Módulos", view: "gold-modulos" },
      { label: "Conteúdos", view: "gold-conteudos" },
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
      { label: "WhatsApp", view: "fin-whatsapp" },
    ] },
    { label: "Equipa", view: "fin-equipa", icon: "pessoas" },
    { label: "Inscrições", view: "fin-inscricoes", icon: "inscricao" },
    { label: "Formandos", view: "fin-formandos", icon: "pessoas" },
    { label: "Turmas", view: "fin-turmas", icon: "turma" },
    { label: "Formadores", view: "fin-formadores", icon: "pessoa" },
    { label: "Edição de Cursos", icon: "livro", children: [
      { label: "Cursos", view: "fin-cursos" }, { label: "Módulos", view: "fin-modulos" },
      { label: "Conteúdos", view: "fin-conteudos" }, { label: "Datas", view: "fin-datas" },
      { label: "Locais", view: "fin-locais" }, { label: "Programas", view: "fin-programas" },
      { label: "Áreas Temáticas", view: "fin-areas-tematicas" },
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
    { label: "Utilizadores", view: "utilizadores", icon: "pessoas" },
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
export const VISTAS_FORMADOR = new Set<Vista>(["formador-turmas", "formador-calendario", "formador-perfil", "gold-cockpit-turma", "fin-cockpit-turma", "fin-presencas", "gold-turmas"]);

/**
 * Onde cada perfil começa. As coordenações não têm painel (pedido do cliente): começam nas pré-inscrições da sua
 * linha; a contabilidade começa nos pagamentos.
 */
/**
 * Perfil personalizado: a «chave» do perfil leva os perfis somados («personalizado:secretaria,contabilidade»). As funções
 * deste ficheiro recebem a chave e somam os menus e as vistas de cada perfil.
 */
export function chaveDoPerfil(u: { role: string; perfis?: readonly string[] | null }) {
  return u.role === "personalizado" ? `personalizado:${(u.perfis ?? []).join(",")}` : u.role;
}

/** Os perfis por trás da chave (um só, fora do perfil personalizado). */
export function perfisDaChave(role: string): string[] {
  return role.startsWith("personalizado:") ? role.slice("personalizado:".length).split(",").filter(Boolean) : [role];
}

const ePersonalizado = (role: string) => role.startsWith("personalizado:");

/** Junta os menus de vários perfis pela ordem do menu geral (itens e submenus sem repetir). */
function somarMenus(menus: GrupoMenu[][]): GrupoMenu[] {
  const out: GrupoMenu[] = [];
  for (const g of MENU) {
    const destes = menus.flatMap(m => m.filter(x => x.group === g.group));
    if (!destes.length) continue;
    const items: ItemMenu[] = [];
    for (const item of g.items) {
      const iguais = destes.flatMap(d => d.items.filter(i => i.label === item.label && i.view === item.view));
      if (!iguais.length) continue;
      if (!item.children) { items.push(iguais[0]!); continue; }
      const children = item.children.filter(c => iguais.some(i => i.children?.some(x => x.view === c.view)));
      if (children.length) items.push({ ...item, children });
    }
    if (items.length) out.push({ ...g, items });
  }
  return out;
}

export function painelDoPerfil(role: string): Vista {
  if (ePersonalizado(role)) {
    const perfis = perfisDaChave(role);
    // Começa no ecrã do primeiro perfil da Gold/Financiada que tiver; só contabilidade, nos pagamentos.
    const p = ["secretaria", "financiada", "comercial", "contabilidade"].find(x => perfis.includes(x));
    return p ? painelDoPerfil(p) : "notificacoes";
  }
  if (role === "formador") return "formador-turmas";
  if (role === "contabilidade") return "pagamentos";
  if (role === "secretaria") return "gold-preinscricoes";
  if (role === "financiada") return "fin-preinscricoes";
  return "gold-painel";
}

/** Cada coordenação só tem a sua linha (Gold ou Financiada); a contabilidade só o Sistema (pagamentos e emails). */
function gruposDoPerfil(role: string): string[] {
  if (role === "formador") return ["Formador"];
  if (role === "contabilidade") return ["Sistema"];
  if (role === "financiada") return ["Financiada", "Gestão", "Sistema"];
  if (role === "secretaria") return ["Gold", "Gestão", "Sistema"];
  return ["Gold", "Financiada", "Gestão", "Sistema"];
}

/** O Sistema de cada perfil: os utilizadores (e as integrações, dentro das Configurações) são só da administração. */
const SISTEMA_DO_PERFIL: Record<string, Vista[]> = {
  // As coordenações: emails e site (pagamentos, configurações e utilizadores não).
  secretaria: ["emails", "site"],
  financiada: ["emails", "site"],
  contabilidade: ["pagamentos", "emails"],
};

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
  if (ePersonalizado(role)) return somarMenus(perfisDaChave(role).map(p => menuDoPerfil(p)));
  if (role === "formador") return [MENU_FORMADOR];
  if (role === "comercial") return MENU.map(soVendas).filter(g => g.items.length);
  const permitidos = gruposDoPerfil(role);
  const semPainel = role !== "admin";
  return MENU
    .filter(g => permitidos.includes(g.group))
    // «Cronogramas» é a vista de vendas das turmas: quem gere turmas usa as Turmas. Os painéis são só da administração.
    .map(g => ({ ...g, items: g.items.filter(item => item.view !== "gold-cronogramas" && !(semPainel && (item.view === "gold-painel" || item.view === "fin-painel"))) }))
    .map(g => (g.group !== "Sistema" || role === "admin")
      ? g
      : { ...g, items: g.items.filter(item => item.view != null && (SISTEMA_DO_PERFIL[role] ?? []).includes(item.view)) })
    .filter(g => g.items.length);
}

/** Vistas sem entrada própria no menu que qualquer perfil da equipa pode abrir. */
const VISTAS_LIVRES = new Set<Vista>(["notificacoes"]);

/**
 * A vista existe no menu deste perfil (ou é uma ficha/cockpit de uma vista que existe)?
 * Evita abrir pelo endereço ecrãs de outra área que só iam mostrar erros de acesso; o servidor continua a decidir.
 */
export function vistaNoMenuDoPerfil(role: string, v: Vista): boolean {
  if (VISTAS_LIVRES.has(v)) return true;
  if (ePersonalizado(role)) return perfisDaChave(role).some(p => vistaNoMenuDoPerfil(p, v));
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
  "gold-whatsapp": "WhatsApp", "fin-whatsapp": "WhatsApp",
  "formador-turmas": "As minhas turmas", "formador-calendario": "Calendário", "formador-perfil": "Perfil",
  "gold-equipa": "Equipa", "fin-equipa": "Equipa", equipa: "Equipa",
  "gold-formandos-turmas": "Formandos", "gold-formandos-gold": "Formandos", "gold-formando-ficha": "Ficha do formando",
  "fin-formandos": "Formandos", "fin-formando-ficha": "Ficha do formando", "fin-inscricoes": "Inscrições",
  "gold-campanhas": "Campanhas", "gold-cursos": "Cursos", "gold-curso-ficha": "Ficha do curso",
  "gold-horarios": "Horários", "gold-locais": "Locais", "gold-areas-tematicas": "Áreas Temáticas",
  "gold-modulos": "Módulos", "gold-conteudos": "Conteúdos",
  "gold-turmas": "Turmas", "gold-cronogramas": "Cronogramas", "gold-formadores": "Formadores", formadores: "Formadores", "formador-ficha": "Ficha do formador",
  "gold-cockpit-turma": "Turma", "gold-dtp": "Dossiê TP", "gold-inqueritos": "Inquéritos",
  "fin-cursos": "Cursos", "fin-curso-ficha": "Ficha do curso", "fin-turmas": "Turmas", "fin-formadores": "Formadores",
  "fin-presencas": "Sessões da turma", "fin-dtp": "Dossiê TP", "fin-cockpit-turma": "Turma", "fin-inqueritos": "Inquéritos",
  "fin-modulos": "Módulos", "fin-conteudos": "Conteúdos", "fin-datas": "Datas", "fin-locais": "Locais", "fin-programas": "Programas", "fin-areas-tematicas": "Áreas Temáticas",
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
