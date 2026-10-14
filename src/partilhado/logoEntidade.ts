import { BASE } from "./api/cliente";

/**
 * Endereço absoluto do logótipo da entidade (Configurações › Entidade). Sem logótipo carregado,
 * o servidor redirige para o logótipo ENA do site. Absoluto porque também é usado em folhas
 * abertas a partir de um blob, onde os caminhos relativos não resolvem.
 */
export function urlLogoEntidade(versao?: string | null) {
  const base = /^https?:\/\//i.test(BASE) ? BASE.replace(/\/$/, "") : `${window.location.origin}${BASE.replace(/\/$/, "")}`;
  return `${base}/v1/public/entidade/logo${versao ? `?v=${encodeURIComponent(versao)}` : ""}`;
}
