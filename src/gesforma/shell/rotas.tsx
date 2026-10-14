import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import type { Vista } from "../rotasGesforma";
import type { VistaProps } from "./tipos";

type Ecra = LazyExoticComponent<ComponentType<VistaProps>>;

// Cada vista carrega só quando é aberta. Um ficheiro por vista em vistas/<area>/.
const PainelGold = lazy(() => import("../vistas/painel/PainelGold"));
const PainelFin = lazy(() => import("../vistas/painel/PainelFin"));
const Preinscricoes = lazy(() => import("../vistas/crm/Preinscricoes"));
const Clientes = lazy(() => import("../vistas/crm/Clientes"));
const Parceiros = lazy(() => import("../vistas/crm/Parceiros"));
const Contratos = lazy(() => import("../vistas/crm/Contratos"));
const Equipa = lazy(() => import("../vistas/equipa/Equipa"));
const Formandos = lazy(() => import("../vistas/formandos/Formandos"));
const FormandoFicha = lazy(() => import("../vistas/formandos/FormandoFicha"));
const Inscricoes = lazy(() => import("../vistas/formandos/Inscricoes"));
const Campanhas = lazy(() => import("../vistas/campanhas/Campanhas"));
const Cursos = lazy(() => import("../vistas/cursos/Cursos"));
const CursoFicha = lazy(() => import("../vistas/cursos/CursoFicha"));
const Modulos = lazy(() => import("../vistas/cursos/Modulos"));
const Conteudos = lazy(() => import("../vistas/cursos/Conteudos"));
const Tabelas = lazy(() => import("../vistas/cursos/Tabelas"));
const Turmas = lazy(() => import("../vistas/turmas/Turmas"));
const Cockpit = lazy(() => import("../vistas/turmas/Cockpit"));
const Formadores = lazy(() => import("../vistas/formadores/Formadores"));
const FormadorFicha = lazy(() => import("../vistas/formadores/FormadorFicha"));
const AreaCalendario = lazy(() => import("../vistas/formadores/AreaCalendario"));
const AreaPerfil = lazy(() => import("../vistas/formadores/AreaPerfil"));
const Dossie = lazy(() => import("../vistas/dtp/Dossie"));
const Inqueritos = lazy(() => import("../vistas/inqueritos/Inqueritos"));
const Blog = lazy(() => import("../vistas/gestao/Blog"));
const ListasOpcoes = lazy(() => import("../vistas/gestao/ListasOpcoes"));
const Utilizadores = lazy(() => import("../vistas/sistema/Utilizadores"));
const Emails = lazy(() => import("../vistas/sistema/Emails"));
const Pagamentos = lazy(() => import("../vistas/sistema/Pagamentos"));
const Site = lazy(() => import("../vistas/sistema/Site"));
const Configuracoes = lazy(() => import("../vistas/sistema/Configuracoes"));
const Notificacoes = lazy(() => import("./Notificacoes"));

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
  "fin-areas-tematicas": Tabelas,
  "gold-turmas": Turmas,
  "fin-turmas": Turmas,
  "formador-turmas": Turmas,
  "gold-cockpit-turma": Cockpit,
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
  "listas-opcoes": ListasOpcoes,
  utilizadores: Utilizadores,
  emails: Emails,
  pagamentos: Pagamentos,
  site: Site,
  configuracoes: Configuracoes,
  notificacoes: Notificacoes,
};
