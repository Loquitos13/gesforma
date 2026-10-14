import { many, type Consulta, type Regime } from "./sql.js";

/** Uma opção para selects e filtros. `valor` é o que se grava; `rotulo` o que se mostra. */
export type Opcao = { valor: string; rotulo: string; id?: number; regime?: Regime; extra?: Record<string, unknown> };

/** Tipos de opções servidos por `GET /v1/opcoes/:kind`. */
export const KINDS_OPCOES = [
  "cursos", "turmas", "formadores", "locais", "datas", "horarios", "areas", "modulos", "conteudos",
  "tematicas", "financiadores", "comerciais", "campanhas", "lista", "modelos_conteudo",
] as const;
export type KindOpcoes = (typeof KINDS_OPCOES)[number];

const ATIVO = "coalesce(payload->>'status', payload->>'estado', 'Ativo') NOT IN ('Inactivo', 'Inativo', 'Arquivado')";

/** Itens de `catalog_items` de um tipo, com o rótulo tirado do campo certo. */
async function doCatalogo(c: Consulta, kind: string, regime: Regime | undefined, rotulo: string, todos: boolean) {
  const linhas = await many<{ id: number; regime: Regime; rotulo: string; payload: Record<string, unknown> }>(
    c,
    `SELECT id, regime, ${rotulo} AS rotulo, payload
       FROM catalog_items
      WHERE kind = $1 AND ($2::text IS NULL OR regime = $2) ${todos ? "" : `AND ${ATIVO}`}
      ORDER BY rotulo`,
    [kind, regime ?? null],
  );
  return linhas
    .filter(l => (l.rotulo ?? "").trim())
    .map(l => ({ valor: l.rotulo, rotulo: l.rotulo, id: l.id, regime: l.regime, extra: l.payload }));
}

/**
 * Opções de um tipo. `regime` filtra quando faz sentido; `lista` escolhe a lista de
 * opções (`origens`, `metodos_pagamento`, …) quando `kind = "lista"`. `todos` inclui inactivos.
 */
export async function listarOpcoes(
  c: Consulta,
  kind: KindOpcoes,
  opts: { regime?: Regime; lista?: string; todos?: boolean } = {},
): Promise<Opcao[]> {
  const { regime, todos = false } = opts;
  switch (kind) {
    case "cursos": {
      const linhas = await many<{ id: number; regime: Regime; nome: string; estado: string; ufcd: string; ufcd_cod: string; horas: number }>(
        c,
        `SELECT id, 'gold' AS regime, nome, estado, '' AS ufcd, '' AS ufcd_cod, horas FROM cursos_gold WHERE $1::text IS NULL OR $1 = 'gold'
         UNION ALL
         SELECT id, 'fin' AS regime, coalesce(nullif(nome_comercial, ''), ufcd) AS nome, estado, ufcd, ufcd_cod, horas FROM cursos_fin WHERE $1::text IS NULL OR $1 = 'fin'
         ORDER BY nome`,
        [regime ?? null],
      );
      return linhas
        .filter(l => todos || !/inactiv|inativ/i.test(l.estado))
        .map(l => ({
          valor: l.nome, rotulo: l.nome, id: l.id, regime: l.regime,
          extra: { horas: Number(l.horas ?? 0), ...(l.regime === "fin" ? { ufcd: l.ufcd, ufcdCod: l.ufcd_cod } : {}) },
        }));
    }
    case "turmas": {
      const linhas = await many<{ id: number; regime: Regime; nome: string; curso: string; data_inicio: string; fechada: boolean }>(
        c,
        `SELECT id, 'gold' AS regime, nome, curso, data_inicio, false AS fechada FROM turmas_gold WHERE $1::text IS NULL OR $1 = 'gold'
         UNION ALL
         SELECT id, 'fin' AS regime, nome, curso, data_inicio, fechada_em IS NOT NULL AS fechada FROM turmas_fin WHERE $1::text IS NULL OR $1 = 'fin'
         ORDER BY data_inicio DESC, nome`,
        [regime ?? null],
      );
      return linhas
        .filter(l => todos || !l.fechada)
        .map(l => ({ valor: l.nome, rotulo: l.nome, id: l.id, regime: l.regime, extra: { curso: l.curso, inicio: l.data_inicio } }));
    }
    case "formadores": {
      const linhas = await many<{ id: number; nome: string; estado: string; regimes: unknown }>(
        c,
        `SELECT id, nome, estado, regimes FROM formadores
          WHERE $1::text IS NULL OR regimes @> to_jsonb(ARRAY[$1::text]) OR jsonb_array_length(regimes) = 0
          ORDER BY nome`,
        [regime ?? null],
      );
      return linhas
        .filter(l => todos || !/inactiv|inativ/i.test(l.estado))
        .map(l => ({ valor: l.nome, rotulo: l.nome, id: l.id }));
    }
    case "locais":
    case "horarios":
    case "areas":
      return doCatalogo(c, kind, regime, "payload->>'nome'", todos);
    case "tematicas":
      return doCatalogo(c, "blog_tematicas", undefined, "payload->>'nome'", todos);
    case "modulos":
      return doCatalogo(c, "modulos", regime, "trim(coalesce(payload->>'codigo', '') || ' ' || coalesce(payload->>'nome', ''))", todos);
    case "conteudos":
      return doCatalogo(c, "conteudos", regime, "payload->>'titulo'", todos);
    case "datas":
      return doCatalogo(c, "datas", regime, "coalesce(payload->>'curso', '') || ' · ' || coalesce(payload->>'inicio', '')", todos);
    case "financiadores": {
      const linhas = await many<{ nome: string }>(
        c,
        `SELECT DISTINCT nome FROM (
           SELECT trim(financiador) AS nome FROM turmas_fin
           UNION ALL
           SELECT payload->>'nome' FROM catalog_items WHERE kind = 'lista_opcoes' AND payload->>'lista' = 'financiadores'
         ) f WHERE coalesce(nome, '') <> '' ORDER BY nome`,
      );
      return linhas.map(l => ({ valor: l.nome, rotulo: l.nome }));
    }
    case "comerciais": {
      const linhas = await many<{ id: string; name: string }>(
        c,
        "SELECT id::text AS id, name FROM users WHERE active = true AND role IN ('comercial', 'secretaria', 'admin') ORDER BY name",
      );
      return linhas.map(l => ({ valor: l.id, rotulo: l.name }));
    }
    case "campanhas": {
      const linhas = await many<{ id: number; nome: string }>(c, "SELECT id, nome FROM campanhas ORDER BY data DESC, nome");
      return linhas.map(l => ({ valor: l.nome, rotulo: l.nome, id: l.id }));
    }
    case "lista": {
      const lista = (opts.lista ?? "").trim();
      if (!/^[a-z][a-z0-9_]{1,40}$/.test(lista)) return [];
      const linhas = await many<{ id: number; nome: string }>(
        c,
        `SELECT id, payload->>'nome' AS nome FROM catalog_items
          WHERE kind = 'lista_opcoes' AND payload->>'lista' = $1 ORDER BY id`,
        [lista],
      );
      return linhas.filter(l => l.nome).map(l => ({ valor: l.nome, rotulo: l.nome, id: l.id }));
    }
    case "modelos_conteudo": {
      const linhas = await many<{ chave: string; tipo: string; regime: Regime; padrao: string; payload: Record<string, unknown> }>(
        c,
        "SELECT chave, tipo, regime, padrao, payload FROM conteudos_modelo WHERE $1::text IS NULL OR regime = $1 ORDER BY chave",
        [regime ?? null],
      );
      return linhas.map(l => ({ valor: l.chave, rotulo: l.padrao, regime: l.regime, extra: { tipo: l.tipo, padrao: l.padrao, ...l.payload } }));
    }
  }
  return [];
}
