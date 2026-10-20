import type { Metodo } from "./perfis.js";

/**
 * O comercial (Gold) só vende. Lista do que pode chamar; tudo o resto é 403, mesmo que a matriz geral
 * o deixasse (as regras de `permissoes.ts` continuam a aplicar-se por cima: isto só restringe).
 *
 * Fica: CRM (pré-inscrições e os seus documentos, clientes, parceiros, propostas, contratos e assinaturas),
 * equipa (os seus objetivos e propostas), campanhas, painel Gold (só vendas), pesquisa,
 * notificações, opções para os formulários e os cronogramas das turmas (só leitura, `/v1/cronogramas/gold`).
 * Sai: turmas, cursos (edição), formandos, formadores, dossiê, inquéritos, blog, listas de opções e o resto da gestão.
 */
export const COMERCIAL_PERMITIDO: [Metodo, string][] = [
  ["*", "/v1/crm*"],
  ["*", "/v1/preinscricoes*"],
  ["*", "/v1/alertas/documentos*"],
  ["*", "/v1/assinaturas*"],
  ["*", "/v1/equipa*"],
  ["*", "/v1/campanhas*"],
  ["GET", "/v1/painel/gold"],
  ["GET", "/v1/cronogramas/gold"],
  ["GET", "/v1/search"],
  ["*", "/v1/notificacoes*"],
  ["POST", "/v1/events"],
  // Opções dos formulários de venda (curso, turma, local, horário…). Formadores, módulos e conteúdos não.
  ["GET", "/v1/opcoes"],
  ...(["cursos", "turmas", "locais", "datas", "horarios", "areas", "tematicas", "financiadores", "comerciais", "campanhas", "lista"]
    .map(k => ["GET", `/v1/opcoes/${k}`] as [Metodo, string])),
  // Documentos da pré-inscrição e PDFs dos seus contratos (o handler limita a esses ficheiros).
  ["GET", "/v1/drive/status"],
  ["GET", "/v1/drive/files*"],
];
