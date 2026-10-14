import { ADMIN, EQUIPA, FIN, GOLD, MARKETING, PEDAGOGIA, SECRETARIA, type Perfil } from "./perfis.js";

/**
 * Capacidades que o cliente usa para mostrar ou esconder acções (`/v1/me` → `pode`).
 * São só para a interface: quem decide é sempre o servidor (`podeAceder` e os handlers).
 * Uma nova capacidade acrescenta-se aqui e em mais lado nenhum.
 */
export const CAPACIDADES = {
  "gold.ver": GOLD,
  "fin.ver": FIN,
  "gestao.ver": EQUIPA,
  "sistema.ver": SECRETARIA,
  "sistema.admin": ADMIN,
  "crm.escrever": EQUIPA,
  "crm.apagar": PEDAGOGIA,
  "crm.validarDocumentos": PEDAGOGIA,
  "pagamentos.ver": SECRETARIA,
  "pagamentos.confirmar": SECRETARIA,
  "emails.gerir": SECRETARIA,
  "cursos.editar": MARKETING,
  "cursos.apagar": SECRETARIA,
  "cursosFin.editar": PEDAGOGIA,
  "campanhas.gerir": MARKETING,
  "blog.gerir": MARKETING,
  "formadores.gerir": PEDAGOGIA,
  "turmas.gerir": EQUIPA,
  "turmasFin.gerir": PEDAGOGIA,
  "formandosFin.gerir": PEDAGOGIA,
  "formandos.apagar": SECRETARIA,
  "pedagogia.gerir": PEDAGOGIA,
  "turmas.reabrir": ADMIN,
  "utilizadores.gerir": ADMIN,
  "configuracoes.editar": SECRETARIA,
  "configuracoes.integracoes": ADMIN,
  "site.editar": ADMIN,
  "auditoria.ver": ADMIN,
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
