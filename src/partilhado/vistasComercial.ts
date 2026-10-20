/**
 * O perfil comercial (Gold) só vende: painel de vendas, CRM (pré-inscrições, clientes, parceiros, contratos),
 * equipa (os seus objetivos e propostas), campanhas, blog e os cronogramas das turmas (só leitura).
 * Turmas, cursos, formandos, formadores, dossiê, inquéritos e listas de opções ficam de fora.
 *
 * Partilhado entre o menu do backoffice (`shell/navegacao.ts`) e o servidor (pesquisa global e notificações),
 * para nunca se oferecer ao comercial uma ligação para um ecrã que ele não abre. O servidor decide sempre
 * o acesso às rotas (`server/src/permissoes/comercial.ts`).
 */
export const VISTAS_COMERCIAL = [
  "painel", "gold-painel",
  "gold-preinscricoes", "gold-crm-clientes", "gold-crm-parceiros", "gold-crm-contratos",
  "equipa", "gold-equipa",
  "gold-campanhas",
  "gold-cronogramas",
  "blog-posts", "blog-tematicas",
  "notificacoes",
] as const;

const ABERTAS = new Set<string>(VISTAS_COMERCIAL);

/** O comercial abre esta vista do backoffice? */
export function comercialAbre(vista: string): boolean {
  return ABERTAS.has(vista);
}
