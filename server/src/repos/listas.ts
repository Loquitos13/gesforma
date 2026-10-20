/**
 * Listas de opções (origens, métodos de pagamento, concelhos, …), guardadas em `catalog_items`
 * com `kind = 'lista_opcoes'`. Cada lista sabe onde os seus valores são usados, para contar
 * e para renomear em todos os registos numa só transacção.
 */
import { many, one, valor, type Consulta } from "./sql.js";
import type { TxQuery } from "../db/pool.js";

/** Onde se usa o valor: expressão de contagem e UPDATE para renomear. `$1` = valor antigo, `$2` = novo. */
type Uso = { rotulo: string; contar: string; renomear: string };

const col = (tabela: string, coluna: string, rotulo: string): Uso => ({
  rotulo,
  contar: `SELECT count(*) FROM ${tabela} WHERE lower(trim(${coluna})) = lower(trim($1))`,
  renomear: `UPDATE ${tabela} SET ${coluna} = $2 WHERE lower(trim(${coluna})) = lower(trim($1))`,
});

const payloadCampo = (kind: string, campo: string, rotulo: string, extra = ""): Uso => ({
  rotulo,
  contar: `SELECT count(*) FROM catalog_items WHERE kind = '${kind}' ${extra} AND lower(trim(payload->>'${campo}')) = lower(trim($1))`,
  renomear: `UPDATE catalog_items SET payload = jsonb_set(payload, '{${campo}}', to_jsonb($2::text))
              WHERE kind = '${kind}' ${extra} AND lower(trim(payload->>'${campo}')) = lower(trim($1))`,
});

/**
 * O mesmo valor copiado na ficha do curso (`curso_fichas.payload`): a ficha manda sobre a tabela no
 * editor e no site, por isso muda com ela (senão a próxima gravação da ficha desfaz o renomear).
 * Não conta como uso: é o mesmo curso já contado na tabela.
 */
const fichaCampo = (regime: "gold" | "fin", campo: string) =>
  `UPDATE curso_fichas SET payload = jsonb_set(payload, '{${campo}}', to_jsonb($2::text))
    WHERE regime = '${regime}' AND jsonb_typeof(payload) = 'object' AND lower(trim(payload->>'${campo}')) = lower(trim($1))`;

/** Definição de cada lista. As expressões só usam nomes fixos deste ficheiro. */
export const LISTAS: Record<string, { titulo: string; descricao: string; usos: Uso[]; acompanham?: string[] }> = {
  origens: { titulo: "Como conheceu a ENA", descricao: "Formulário do site, pré-inscrições e estatísticas do painel.", usos: [col("preinscricoes", "origem", "pré-inscrições")] },
  meios_contacto: {
    titulo: "Meio de contacto", descricao: "Registo de contactos no CRM.",
    usos: [col("preinscricoes", "meio_contacto", "pré-inscrições"), col("preinscricao_contactos", "meio", "contactos")],
  },
  metodos_pagamento: { titulo: "Método de pagamento", descricao: "Pagamentos e fichas criadas à mão.", usos: [col("pagamentos", "metodo", "pagamentos")] },
  motivos_desistencia: { titulo: "Motivo de desistência", descricao: "Pré-inscrições marcadas como desistência.", usos: [col("preinscricoes", "motivo_desistencia", "pré-inscrições")] },
  resultados_contacto: {
    titulo: "Resultado do contacto", descricao: "Registo de contactos no CRM.",
    usos: [col("preinscricao_contactos", "resultado", "contactos"), col("preinscricoes", "ultima_resultado", "pré-inscrições")],
  },
  tipos_modulo: { titulo: "Tipo de módulo", descricao: "Módulos dos cursos.", usos: [payloadCampo("modulos", "tipo", "módulos")] },
  tipos_conteudo: { titulo: "Tipo de conteúdo", descricao: "Conteúdos dos cursos.", usos: [payloadCampo("conteudos", "tipo", "conteúdos")] },
  tipos_parceria: { titulo: "Tipo de parceria", descricao: "Parceiros do CRM.", usos: [col("crm_parceiros", "tipo", "parceiros")] },
  tipos_curso: {
    titulo: "Tipo comercial", descricao: "Cursos Gold.", usos: [col("cursos_gold", "tipo", "cursos")], acompanham: [fichaCampo("gold", "tipo")],
  },
  regimes_curso: {
    titulo: "Modalidade", descricao: "Cursos Gold e financiados.",
    usos: [col("cursos_gold", "regime", "cursos Gold"), col("cursos_fin", "regime", "cursos financiados")],
    acompanham: [fichaCampo("gold", "regime"), fichaCampo("fin", "regime")],
  },
  categorias_gold: {
    titulo: "Categoria Gold", descricao: "Cursos Gold.", usos: [col("cursos_gold", "categoria", "cursos")], acompanham: [fichaCampo("gold", "categoria")],
  },
  areas_fin: {
    titulo: "Área financiada", descricao: "Fichas dos cursos financiados.",
    usos: [{
      rotulo: "cursos",
      contar: "SELECT count(*) FROM curso_fichas WHERE regime = 'fin' AND lower(trim(payload->>'categoria')) = lower(trim($1))",
      renomear: `UPDATE curso_fichas SET payload = jsonb_set(payload, '{categoria}', to_jsonb($2::text))
                  WHERE regime = 'fin' AND lower(trim(payload->>'categoria')) = lower(trim($1))`,
    }],
  },
  concelhos: { titulo: "Concelho", descricao: "Pré-inscrições.", usos: [col("preinscricoes", "concelho", "pré-inscrições")] },
  financiadores: { titulo: "Financiador", descricao: "Turmas financiadas.", usos: [col("turmas_fin", "financiador", "turmas")] },
};

export const IDS_LISTAS = Object.keys(LISTAS);

export function listaValida(lista: string) {
  return Object.prototype.hasOwnProperty.call(LISTAS, lista);
}

export type OpcaoLista = { id: number; nome: string; uso: number; usoPor: Record<string, number> };

/** Resumo de todas as listas: número de opções. */
export async function resumoListas(c: Consulta) {
  const linhas = await many<{ lista: string; n: number }>(c,
    "SELECT payload->>'lista' AS lista, count(*)::int AS n FROM catalog_items WHERE kind = 'lista_opcoes' GROUP BY 1");
  const porLista = new Map(linhas.map(l => [l.lista, Number(l.n)]));
  return IDS_LISTAS.map(id => ({ id, titulo: LISTAS[id]!.titulo, descricao: LISTAS[id]!.descricao, opcoes: porLista.get(id) ?? 0 }));
}

/** Opções de uma lista, com quantos registos usam cada uma. */
export async function opcoesDaLista(c: Consulta, lista: string): Promise<OpcaoLista[]> {
  const def = LISTAS[lista];
  if (!def) return [];
  const usos = def.usos.map((u, i) => `(${u.contar.replace(/\$1/g, "o.nome")})::int AS u${i}`).join(", ");
  const linhas = await many<Record<string, unknown>>(c,
    `SELECT o.id, o.nome${usos ? `, ${usos}` : ""}
       FROM (SELECT id, payload->>'nome' AS nome FROM catalog_items WHERE kind = 'lista_opcoes' AND payload->>'lista' = $1) o
      ORDER BY o.id`,
    [lista]);
  return linhas.map(l => {
    const usoPor: Record<string, number> = {};
    def.usos.forEach((u, i) => { usoPor[u.rotulo] = (usoPor[u.rotulo] ?? 0) + Number(l[`u${i}`] ?? 0); });
    return { id: Number(l.id), nome: String(l.nome ?? ""), uso: Object.values(usoPor).reduce((a, b) => a + b, 0), usoPor };
  });
}

export async function obterOpcao(c: Consulta, lista: string, id: number) {
  return one<{ id: number; nome: string }>(c,
    "SELECT id, payload->>'nome' AS nome FROM catalog_items WHERE kind = 'lista_opcoes' AND payload->>'lista' = $1 AND id = $2", [lista, id]);
}

export async function existeNome(c: Consulta, lista: string, nome: string, excetoId?: number) {
  const n = await valor<number>(c,
    `SELECT count(*)::int FROM catalog_items WHERE kind = 'lista_opcoes' AND payload->>'lista' = $1
        AND lower(trim(payload->>'nome')) = lower(trim($2)) AND ($3::int IS NULL OR id <> $3)`,
    [lista, nome, excetoId ?? null]);
  return Number(n ?? 0) > 0;
}

export async function criarOpcao(c: Consulta, lista: string, nome: string) {
  const id = Number(await valor<number>(c, "SELECT nextval('ops_id_seq')::int AS id"));
  await many(c, "INSERT INTO catalog_items (id, kind, regime, payload) VALUES ($1, 'lista_opcoes', 'gold', $2::jsonb)", [id, { lista, nome }]);
  return id;
}

/** Renomeia a opção e todos os registos que a usam, numa só transacção. Devolve quantos registos mudaram. */
export async function renomearOpcao(q: TxQuery, lista: string, id: number, antigo: string, novo: string) {
  const def = LISTAS[lista];
  if (!def) return 0;
  await q("UPDATE catalog_items SET payload = jsonb_set(payload, '{nome}', to_jsonb($2::text)), updated_at = now() WHERE id = $1 AND kind = 'lista_opcoes'", [id, novo]);
  let mudados = 0;
  for (const u of def.usos) {
    const r = await q<{ n: number }>(`SELECT (${u.contar})::int AS n`, [antigo]);
    mudados += Number(r.rows[0]?.n ?? 0);
    await q(u.renomear, [antigo, novo]);
  }
  for (const sql of def.acompanham ?? []) await q(sql, [antigo, novo]);
  return mudados;
}

export async function apagarOpcao(c: Consulta, lista: string, id: number) {
  await many(c, "DELETE FROM catalog_items WHERE kind = 'lista_opcoes' AND payload->>'lista' = $1 AND id = $2", [lista, id]);
}

/** Valores públicos de uma lista (formulário do site). */
export async function nomesPublicos(c: Consulta, lista: string) {
  const linhas = await many<{ nome: string }>(c,
    "SELECT payload->>'nome' AS nome FROM catalog_items WHERE kind = 'lista_opcoes' AND payload->>'lista' = $1 ORDER BY id", [lista]);
  return linhas.map(l => l.nome).filter(Boolean);
}
