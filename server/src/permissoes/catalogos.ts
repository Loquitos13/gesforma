import { EQUIPA, FIN, type Regra } from "./perfis.js";

/**
 * Catálogos (datas, locais, horários, áreas, módulos, conteúdos) e opções. Só a equipa; o formador fica de fora.
 * Cada item tem regime: o handler (rotas/catalogos.ts) só deixa ler e escrever os do regime que o perfil vê.
 * As inscrições da Financiada criam fichas de formandos: só a equipa da Financiada.
 */
export const regras: Regra[] = [
  ["*", "/v1/catalogos/inscricoes_fin", FIN],
  ["*", "/v1/catalog/inscricoes_fin*", FIN],
  ["*", "/v1/catalogos*", EQUIPA],
  ["*", "/v1/catalog/*", EQUIPA],
];
