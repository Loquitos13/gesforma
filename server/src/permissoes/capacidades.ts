import { ADMIN, BLOG, CONTABILIDADE, COORDENACAO, EQUIPA, FIN, GOLD, MARKETING, PAGAMENTOS, PEDAGOGIA, SECRETARIA, type Perfil } from "./perfis.js";

/**
 * Capacidades que o cliente usa para mostrar ou esconder acções (`/v1/me` → `pode`).
 * São só para a interface: quem decide é sempre o servidor (`podeAceder` e os handlers).
 * Uma nova capacidade acrescenta-se aqui e em mais lado nenhum.
 */
export const CAPACIDADES = {
  "gold.ver": GOLD,
  "fin.ver": FIN,
  "gestao.ver": EQUIPA,
  "sistema.ver": COORDENACAO,
  "sistema.admin": ADMIN,
  "crm.escrever": EQUIPA,
  "crm.apagar": PEDAGOGIA,
  "crm.validarDocumentos": PEDAGOGIA,
  "pagamentos.ver": PAGAMENTOS,
  // Confirmar o pagamento em Pagamentos é da contabilidade.
  "pagamentos.confirmar": CONTABILIDADE,
  // Validar ou recusar o comprovativo na ficha da pré-inscrição (confirma o pagamento; não insere na turma).
  "pagamentos.validarComprovativo": EQUIPA,
  // Inserir na turma (Gold) quem já tem o pagamento confirmado: o comercial e a coordenação.
  "crm.inserirNaTurma": EQUIPA,
  // Pagamento de quem já é formando, registado na ficha (numerário, transferência): a coordenação Gold.
  "pagamentos.registarFicha": SECRETARIA,
  // Acesso à área do formando da Gold (palavra-passe gerada): a coordenação Gold.
  "formandosGold.gerir": SECRETARIA,
  // Anexar e enviar a fatura (PDF) de um pagamento confirmado.
  "pagamentos.faturas": CONTABILIDADE,
  // Pedir (e reenviar) o pagamento de uma pré-inscrição: a coordenação, que valida os documentos.
  "pagamentos.pedir": PEDAGOGIA,
  // Eliminar de vez uma conversa do WhatsApp (CRM › WhatsApp).
  "whatsapp.eliminar": PEDAGOGIA,
  "emails.gerir": [...EQUIPA, "contabilidade"] as Perfil[],
  // Histórico dos envios: as coordenações e a contabilidade, cada uma só da sua área.
  "emails.historico": [...COORDENACAO, "contabilidade"] as Perfil[],
  // O comercial só vende: não edita cursos nem gere turmas (ver permissoes/comercial.ts).
  "cursos.editar": SECRETARIA,
  "cursos.apagar": SECRETARIA,
  "cursosFin.editar": FIN,
  "campanhas.gerir": MARKETING,
  "campanhas.apagar": SECRETARIA,
  "blog.gerir": BLOG,
  "formadores.gerir": PEDAGOGIA,
  "turmas.gerir": PEDAGOGIA,
  "turmasFin.gerir": PEDAGOGIA,
  "formandosFin.gerir": PEDAGOGIA,
  "formandos.apagar": SECRETARIA,
  "pedagogia.gerir": PEDAGOGIA,
  "turmas.reabrir": PEDAGOGIA,
  // Utilizadores e integrações ficam com a administração; o resto do Sistema também é das coordenações.
  "utilizadores.gerir": ADMIN,
  // Configurações: só a administração (as coordenações editam o Site, não as Configurações).
  "configuracoes.editar": ADMIN,
  "configuracoes.integracoes": ADMIN,
  "site.editar": COORDENACAO,
  "auditoria.ver": COORDENACAO,
  "formador.area": ["formador"] as Perfil[],
} satisfies Record<string, Perfil[]>;

export type Capacidade = keyof typeof CAPACIDADES;

export function capacidadesDe(role: string): Capacidade[] {
  return (Object.entries(CAPACIDADES) as [Capacidade, Perfil[]][])
    .filter(([, perfis]) => perfis.includes(role as Perfil))
    .map(([k]) => k);
}

export function pode(role: string, capacidade: Capacidade): boolean {
  return (CAPACIDADES[capacidade] as Perfil[]).includes(role as Perfil);
}
