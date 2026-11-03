import { ADMIN, BLOG, COORDENACAO, EQUIPA, FIN, GOLD, MARKETING, PAGAMENTOS, PEDAGOGIA, SECRETARIA, type Perfil } from "./perfis.js";

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
  // TODO (cliente): se a validação do comprovativo pela contabilidade também confirma o pagamento e conclui a
  // inscrição. Até lá, confirmar e recusar ficam com a coordenação Gold.
  "pagamentos.confirmar": SECRETARIA,
  "pagamentos.faturas": PAGAMENTOS,
  "emails.gerir": [...EQUIPA, "contabilidade"] as Perfil[],
  "emails.historico": SECRETARIA,
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
  "configuracoes.editar": COORDENACAO,
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
