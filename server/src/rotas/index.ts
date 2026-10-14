import type { FastifyInstance } from "fastify";
import { registar as painel } from "./painel.js";
import { registar as notificacoes } from "./notificacoes.js";
import { registar as crm } from "./crm.js";
import { registar as preinscricoesPublicas } from "./preinscricoesPublicas.js";
import { registar as ligacaoPessoal } from "./ligacaoPessoal.js";
import { registar as crmDiretorio } from "./crmDiretorio.js";
import { registar as equipa } from "./equipa.js";
import { registar as campanhas } from "./campanhas.js";
import { registar as formandos } from "./formandos.js";
import { registar as areaFormando } from "./areaFormando.js";
import { registar as turmas } from "./turmas.js";
import { registar as formadores } from "./formadores.js";
import { registar as pedagogia } from "./pedagogia/index.js";
import { registar as dtp } from "./dtp.js";
import { registar as inqueritos } from "./inqueritos.js";
import { registar as cursos } from "./cursos.js";
import { registar as catalogos } from "./catalogos.js";
import { registar as listas } from "./listas.js";
import { registar as blog } from "./blog.js";
import { registar as site } from "./site.js";
import { registar as auth } from "./auth.js";
import { registar as emails } from "./emails.js";
import { registar as utilizadores } from "./utilizadores.js";
import { registar as pagamentos } from "./pagamentos.js";
import { registar as configuracoes } from "./configuracoes.js";
import { registar as drive } from "./drive.js";
import { registar as auditoria } from "./auditoria.js";
import { registar as sistema } from "./sistema.js";
import type { Deps, ModuloRotas } from "./tipos.js";

/**
 * Todos os módulos de rotas por domínio. Cada domínio vive em `rotas/<dominio>.ts`
 * e regista só as suas rotas; a ordem não importa (não há rotas repetidas).
 */
const MODULOS: Record<string, ModuloRotas> = {
  painel,
  notificacoes,
  crm,
  preinscricoesPublicas,
  ligacaoPessoal,
  crmDiretorio,
  equipa,
  campanhas,
  formandos,
  areaFormando,
  turmas,
  formadores,
  pedagogia,
  dtp,
  inqueritos,
  cursos,
  catalogos,
  listas,
  blog,
  site,
  auth,
  emails,
  utilizadores,
  pagamentos,
  configuracoes,
  drive,
  auditoria,
  sistema,
};

export async function registarRotas(app: FastifyInstance, deps: Deps) {
  for (const registar of Object.values(MODULOS)) {
    await registar(app, deps);
  }
}
