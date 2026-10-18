import { many, one, type Consulta } from "./sql.js";

/** O conteúdo de um serviço (título, textos, imagens, vídeo, logótipos): o que o site mostra. */
export type DadosServico = Record<string, unknown>;
export type LinhaServico = { id: number; slug: string; ordem: number; ativo: boolean; dados: DadosServico; atualizadoEm: string };

const COLUNAS = `id, slug, ordem, ativo, dados, atualizado_em AS "atualizadoEm"`;

export function listar(c: Consulta) {
  return many<LinhaServico>(c, `SELECT ${COLUNAS} FROM servicos ORDER BY ordem, id`);
}

/** Para o site: só os ativos, pela ordem. */
export function ativos(c: Consulta) {
  return many<LinhaServico>(c, `SELECT ${COLUNAS} FROM servicos WHERE ativo ORDER BY ordem, id`);
}

export function criar(c: Consulta, s: { slug: string; ordem: number; ativo: boolean; dados: DadosServico }) {
  return one<LinhaServico>(c,
    `INSERT INTO servicos (slug, ordem, ativo, dados) VALUES ($1, $2, $3, $4::jsonb) RETURNING ${COLUNAS}`,
    [s.slug, s.ordem, s.ativo, JSON.stringify(s.dados)]);
}

export function atualizar(c: Consulta, id: number, s: { slug: string; ordem: number; ativo: boolean; dados: DadosServico }) {
  return one<LinhaServico>(c,
    `UPDATE servicos SET slug = $2, ordem = $3, ativo = $4, dados = $5::jsonb, atualizado_em = now() WHERE id = $1 RETURNING ${COLUNAS}`,
    [id, s.slug, s.ordem, s.ativo, JSON.stringify(s.dados)]);
}

export function apagar(c: Consulta, id: number) {
  return one(c, "DELETE FROM servicos WHERE id = $1 RETURNING id", [id]);
}

/** Próxima posição (fim da lista) para um serviço novo. */
export async function proximaOrdem(c: Consulta) {
  const r = await one<{ ordem: number }>(c, "SELECT COALESCE(MAX(ordem), 0) + 10 AS ordem FROM servicos");
  return Number(r?.ordem ?? 10);
}
