import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import type { Vista } from "../rotasGesforma";
import type { VistaProps } from "./tipos";

type Ecra = LazyExoticComponent<ComponentType<VistaProps>> & { preload?: () => Promise<unknown> };

/** lazy() com `preload`: o menu descarrega o código da vista ao passar o rato. */
function carregavel(carregar: () => Promise<{ default: ComponentType<VistaProps> }>): Ecra {
  let pedido: Promise<{ default: ComponentType<VistaProps> }> | undefined;
  const uma = () => (pedido ??= carregar());
  const ecra: Ecra = lazy(uma);
  ecra.preload = uma;
  return ecra;
}

// Cada vista carrega só quando é aberta. Um ficheiro por vista em vistas/<area>/.
const PainelGold = carregavel(() => import("../vistas/painel/PainelGold"));
const PainelFin = carregavel(() => import("../vistas/painel/PainelFin"));
const Preinscricoes = carregavel(() => import("../vistas/crm/Preinscricoes"));
const Clientes = carregavel(() => import("../vistas/crm/Clientes"));
const Parceiros = carregavel(() => import("../vistas/crm/Parceiros"));
const Contratos = carregavel(() => import("../vistas/crm/Contratos"));
const Equipa = carregavel(() => import("../vistas/equipa/Equipa"));
const Formandos = carregavel(() => import("../vistas/formandos/Formandos"));
const FormandoFicha = carregavel(() => import("../vistas/formandos/FormandoFicha"));
const Inscricoes = carregavel(() => import("../vistas/formandos/Inscricoes"));
const Campanhas = carregavel(() => import("../vistas/campanhas/Campanhas"));
const Cursos = carregavel(() => import("../vistas/cursos/Cursos"));
const CursoFicha = carregavel(() => import("../vistas/cursos/CursoFicha"));
const Modulos = carregavel(() => import("../vistas/cursos/Modulos"));
const Conteudos = carregavel(() => import("../vistas/cursos/Conteudos"));
const Tabelas = carregavel(() => import("../vistas/cursos/Tabelas"));
const Turmas = carregavel(() => import("../vistas/turmas/Turmas"));
const Cockpit = carregavel(() => import("../vistas/turmas/Cockpit"));
const Cronogramas = carregavel(() => import("../vistas/cronogramas/Cronogramas"));
const Formadores = carregavel(() => import("../vistas/formadores/Formadores"));
const FormadorFicha = carregavel(() => import("../vistas/formadores/FormadorFicha"));
const AreaCalendario = carregavel(() => import("../vistas/formadores/AreaCalendario"));
const AreaPerfil = carregavel(() => import("../vistas/formadores/AreaPerfil"));
const Dossie = carregavel(() => import("../vistas/dtp/Dossie"));
const Inqueritos = carregavel(() => import("../vistas/inqueritos/Inqueritos"));
const Blog = carregavel(() => import("../vistas/gestao/Blog"));
const ListasOpcoes = carregavel(() => import("../vistas/gestao/ListasOpcoes"));
const Utilizadores = carregavel(() => import("../vistas/sistema/Utilizadores"));
const Emails = carregavel(() => import("../vistas/sistema/Emails"));
const Pagamentos = carregavel(() => import("../vistas/sistema/Pagamentos"));
const Site = carregavel(() => import("../vistas/sistema/Site"));
const ServicosEmpresas = carregavel(() => import("../vistas/empresas/Servicos"));
const Configuracoes = carregavel(() => import("../vistas/sistema/Configuracoes"));
const Notificacoes = carregavel(() => import("./Notificacoes"));

/** Vista → ecrã. Vistas Gold e Financiada partilham o ecrã; o ecrã lê `view` para saber o regime. */
export const ROTAS: Record<Vista, Ecra> = {
  painel: PainelGold,
  "gold-painel": PainelGold,
  "fin-painel": PainelFin,
  "gold-preinscricoes": Preinscricoes,
  "fin-preinscricoes": Preinscricoes,
  "gold-crm-clientes": Clientes,
  "fin-crm-clientes": Clientes,
  "gold-crm-parceiros": Parceiros,
  "fin-crm-parceiros": Parceiros,
  "gold-crm-contratos": Contratos,
  "fin-crm-contratos": Contratos,
  "gold-equipa": Equipa,
  "fin-equipa": Equipa,
  equipa: Equipa,
  "gold-formandos-turmas": Formandos,
  "gold-formandos-gold": Formandos,
  "fin-formandos": Formandos,
  "gold-formando-ficha": FormandoFicha,
  "fin-formando-ficha": FormandoFicha,
  "fin-inscricoes": Inscricoes,
  "gold-campanhas": Campanhas,
  "gold-cursos": Cursos,
  "fin-cursos": Cursos,
  "gold-curso-ficha": CursoFicha,
  "fin-curso-ficha": CursoFicha,
  "gold-modulos": Modulos,
  "fin-modulos": Modulos,
  "gold-conteudos": Conteudos,
  "fin-conteudos": Conteudos,
  "gold-datas": Tabelas,
  "gold-locais": Tabelas,
  "gold-horarios": Tabelas,
  "gold-areas-tematicas": Tabelas,
  "fin-datas": Tabelas,
  "fin-locais": Tabelas,
  "fin-programas": Tabelas,
  "fin-areas-tematicas": Tabelas,
  "gold-turmas": Turmas,
  "fin-turmas": Turmas,
  "formador-turmas": Turmas,
  "gold-cockpit-turma": Cockpit,
  "gold-cronogramas": Cronogramas,
  "fin-cockpit-turma": Cockpit,
  "fin-presencas": Cockpit,
  "gold-formadores": Formadores,
  "fin-formadores": Formadores,
  formadores: Formadores,
  "formador-ficha": FormadorFicha,
  "formador-calendario": AreaCalendario,
  "formador-perfil": AreaPerfil,
  "gold-dtp": Dossie,
  "fin-dtp": Dossie,
  "gold-inqueritos": Inqueritos,
  "fin-inqueritos": Inqueritos,
  "blog-posts": Blog,
  "blog-tematicas": Blog,
  "empresas-servicos": ServicosEmpresas,
  "listas-opcoes": ListasOpcoes,
  utilizadores: Utilizadores,
  emails: Emails,
  pagamentos: Pagamentos,
  site: Site,
  configuracoes: Configuracoes,
  notificacoes: Notificacoes,
};

/** Descarrega antecipadamente o código de uma vista (ex.: hover no menu). */
export function preCarregarVista(view: Vista) {
  void ROTAS[view]?.preload?.().catch(() => undefined);
}
