export type Perfil = "admin" | "secretaria" | "comercial" | "financiada" | "formador" | "formando";

export const ADMIN: Perfil[] = ["admin"];
export const SECRETARIA: Perfil[] = ["admin", "secretaria"];
/** Secretaria Gold e equipa pedagógica da Financiada. */
export const PEDAGOGIA: Perfil[] = ["admin", "secretaria", "financiada"];
export const EQUIPA: Perfil[] = ["admin", "secretaria", "financiada", "comercial"];
export const COM_FORMADOR: Perfil[] = ["admin", "secretaria", "financiada", "comercial", "formador"];
export const PEDAGOGIA_E_FORMADOR: Perfil[] = ["admin", "secretaria", "financiada", "formador"];
export const MARKETING: Perfil[] = ["admin", "secretaria", "comercial"];
/** Quem trabalha na Gold (o menu Gold). */
export const GOLD: Perfil[] = ["admin", "secretaria", "comercial"];
/** Quem trabalha na Financiada (o menu Financiada). */
export const FIN: Perfil[] = ["admin", "secretaria", "financiada"];

export type Metodo = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "*";
/** [método, padrão do caminho, perfis]. `*` no fim do padrão apanha o resto do caminho; `:x` é um segmento qualquer. */
export type Regra = [Metodo, string, Perfil[]];
