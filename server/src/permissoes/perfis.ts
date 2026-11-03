export type Perfil = "admin" | "secretaria" | "comercial" | "financiada" | "contabilidade" | "formador" | "formando";

export const ADMIN: Perfil[] = ["admin"];
/** Coordenação pedagógica Gold (e a administração). */
export const SECRETARIA: Perfil[] = ["admin", "secretaria"];
/**
 * As duas coordenações pedagógicas. Cada uma só trabalha na sua linha: um caminho com gold/fin exige `GOLD`/`FIN`
 * (ver podeAceder), e a coordenação Gold não está em `FIN`.
 */
export const PEDAGOGIA: Perfil[] = ["admin", "secretaria", "financiada"];
/** As coordenações fazem tudo menos os painéis, os utilizadores e as integrações (site, configurações, auditoria…). */
export const COORDENACAO: Perfil[] = PEDAGOGIA;
export const EQUIPA: Perfil[] = ["admin", "secretaria", "financiada", "comercial"];
export const COM_FORMADOR: Perfil[] = ["admin", "secretaria", "financiada", "comercial", "formador"];
export const PEDAGOGIA_E_FORMADOR: Perfil[] = ["admin", "secretaria", "financiada", "formador"];
export const MARKETING: Perfil[] = ["admin", "secretaria", "comercial"];
/** Blog (notícias do site): o marketing e as duas coordenações. */
export const BLOG: Perfil[] = ["admin", "secretaria", "comercial", "financiada"];
/** Quem trabalha na Gold (o menu Gold). */
export const GOLD: Perfil[] = ["admin", "secretaria", "comercial"];
/** Quem trabalha na Financiada (o menu Financiada): a coordenação Gold não entra. */
export const FIN: Perfil[] = ["admin", "financiada"];
/** Pagamentos (só há na Gold): a coordenação Gold e a contabilidade. */
export const PAGAMENTOS: Perfil[] = ["admin", "secretaria", "contabilidade"];
/** Notificações e pouco mais: toda a equipa do GesForma, também a contabilidade. */
export const EQUIPA_E_CONTABILIDADE: Perfil[] = ["admin", "secretaria", "financiada", "comercial", "contabilidade"];
/** Leituras abertas a toda a equipa (também o formador, que lê as notificações e os ficheiros das suas turmas). */
export const TODA_A_EQUIPA: Perfil[] = [...EQUIPA_E_CONTABILIDADE, "formador"];

export type Metodo = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "*";
/** [método, padrão do caminho, perfis]. `*` no fim do padrão apanha o resto do caminho; `:x` é um segmento qualquer. */
export type Regra = [Metodo, string, Perfil[]];
