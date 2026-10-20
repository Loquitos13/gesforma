/**
 * Itens dos catálogos (`catalog_items`): datas, locais, horários, áreas, módulos, conteúdos,
 * temáticas do blog, inquéritos, inscrições Fin, etc. Inclui o uso de cada item, contado em SQL.
 */
import { many, one, valor, type Consulta, type Regime } from "./sql.js";

export type ItemCatalogo = { id: number; regime: Regime; payload: Record<string, unknown>; uso?: Record<string, number> };

const T = { gold: { turmas: "turmas_gold", cursos: "cursos_gold" }, fin: { turmas: "turmas_fin", cursos: "cursos_fin" } } as const;

const nome = "lower(trim(coalesce(ci.payload->>'nome', '')))";

/**
 * Expressões de uso por tipo e regime. Cada chave é um contador devolvido em `uso`.
 * Só usam nomes de tabelas fixos deste ficheiro; nada vem do pedido.
 */
function usoSql(kind: string, regime: Regime): Record<string, string> {
  const turmas = T[regime].turmas;
  switch (kind) {
    case "locais":
      return {
        turmas: `(SELECT count(*) FROM ${turmas} t WHERE lower(trim(t.local)) = ${nome})`,
        datas: `(SELECT count(*) FROM catalog_items d WHERE d.kind = 'datas' AND d.regime = ci.regime AND lower(trim(d.payload->>'local')) = ${nome})`,
      };
    case "horarios":
      return {
        turmas: `(SELECT count(*) FROM ${turmas} t WHERE lower(trim(t.horario)) = ${nome})`,
        datas: `(SELECT count(*) FROM catalog_items d WHERE d.kind = 'datas' AND d.regime = ci.regime AND lower(trim(d.payload->>'horario')) = ${nome})`,
      };
    case "areas":
      return regime === "gold"
        ? { cursos: `(SELECT count(*) FROM cursos_gold c WHERE lower(trim(c.categoria)) = ${nome})` }
        : { cursos: `(SELECT count(*) FROM curso_fichas f WHERE f.regime = 'fin' AND lower(trim(f.payload->>'categoria')) = ${nome})` };
    case "modulos":
      return {
        conteudos: `(SELECT count(*) FROM catalog_items x WHERE x.kind = 'conteudos' AND x.regime = ci.regime
                      AND x.payload->>'modulo' = ci.payload->>'codigo' AND x.payload->>'curso' = ci.payload->>'curso')`,
      };
    case "datas":
      return {
        turmas: `(SELECT count(*) FROM ${turmas} t WHERE t.curso = ci.payload->>'curso' AND t.data_inicio = ci.payload->>'inicio')`,
        preinscricoes: `(SELECT count(*) FROM preinscricoes p WHERE p.curso = ci.payload->>'curso' AND p.inicio_curso = ci.payload->>'inicio')`,
      };
    case "blog_tematicas":
      return { posts: `(SELECT count(*) FROM blog_posts b WHERE lower(trim(b.tematica)) = ${nome})` };
    default:
      return {};
  }
}

/** Itens de um tipo, com o uso de cada um. `regime` omitido devolve os dois. */
export async function listarItens(c: Consulta, kind: string, regime?: Regime): Promise<ItemCatalogo[]> {
  const regimes: Regime[] = regime ? [regime] : ["gold", "fin"];
  const out: ItemCatalogo[] = [];
  for (const r of regimes) {
    const uso = usoSql(kind, r);
    const cols = Object.entries(uso).map(([k, expr]) => `${expr}::int AS "uso_${k}"`).join(", ");
    const linhas = await many<Record<string, unknown>>(c,
      `SELECT ci.id, ci.regime, ci.payload${cols ? `, ${cols}` : ""}
         FROM catalog_items ci WHERE ci.kind = $1 AND ci.regime = $2 ORDER BY ci.id`,
      [kind, r]);
    for (const l of linhas) {
      const contagem: Record<string, number> = {};
      for (const k of Object.keys(uso)) contagem[k] = Number(l[`uso_${k}`] ?? 0);
      out.push({ id: Number(l.id), regime: l.regime as Regime, payload: (l.payload ?? {}) as Record<string, unknown>, uso: contagem });
    }
  }
  return out;
}

export async function obterItem(c: Consulta, kind: string, id: number) {
  const l = await one<{ id: number; regime: Regime; payload: Record<string, unknown> }>(c,
    "SELECT id, regime, payload FROM catalog_items WHERE kind = $1 AND id = $2", [kind, id]);
  return l ? { id: Number(l.id), regime: l.regime, payload: l.payload ?? {} } : null;
}

export async function usoDoItem(c: Consulta, kind: string, id: number): Promise<Record<string, number>> {
  const item = await obterItem(c, kind, id);
  if (!item) return {};
  const uso = usoSql(kind, item.regime);
  const entradas = Object.entries(uso);
  if (!entradas.length) return {};
  const l = await one<Record<string, unknown>>(c,
    `SELECT ${entradas.map(([k, expr]) => `${expr}::int AS "uso_${k}"`).join(", ")} FROM catalog_items ci WHERE ci.kind = $1 AND ci.id = $2`,
    [kind, id]);
  return Object.fromEntries(entradas.map(([k]) => [k, Number(l?.[`uso_${k}`] ?? 0)]));
}

export async function proximoIdCatalogo(c: Consulta) {
  return Number(await valor<number>(c, "SELECT nextval('ops_id_seq')::int AS id"));
}

export async function criarItem(c: Consulta, id: number, kind: string, regime: Regime, payload: Record<string, unknown>) {
  await many(c, "INSERT INTO catalog_items (id, kind, regime, payload) VALUES ($1,$2,$3,$4::jsonb)", [id, kind, regime, payload]);
}

export async function actualizarItem(c: Consulta, kind: string, id: number, payload: Record<string, unknown> | null, regime: Regime | null) {
  await many(c,
    `UPDATE catalog_items SET payload = COALESCE($3::jsonb, payload), regime = COALESCE($4, regime), updated_at = now()
      WHERE id = $1 AND kind = $2`,
    [id, kind, payload, regime]);
}

export async function apagarItem(c: Consulta, kind: string, id: number) {
  await many(c, "DELETE FROM catalog_items WHERE id = $1 AND kind = $2", [id, kind]);
}

/** Ao mudar o código de um módulo, os conteúdos desse módulo acompanham. */
export async function propagarCodigoModulo(c: Consulta, regime: Regime, curso: string, antigo: string, novo: string) {
  if (!antigo || !novo || antigo === novo) return;
  await many(c, `UPDATE catalog_items SET payload = jsonb_set(payload, '{modulo}', to_jsonb($4::text))
                  WHERE kind = 'conteudos' AND regime = $1 AND payload->>'curso' = $2 AND payload->>'modulo' = $3`,
  [regime, curso, antigo, novo]);
}

/** Ao renomear um local, horário ou área, os registos que o usam passam a mostrar o novo nome. */
export async function propagarNome(c: Consulta, kind: string, regime: Regime, antigo: string, novo: string) {
  const de = antigo.trim();
  const para = novo.trim();
  if (!de || !para || de === para) return;
  const turmas = T[regime].turmas;
  if (kind === "locais") {
    await many(c, `UPDATE ${turmas} SET local = $2 WHERE lower(trim(local)) = lower($1)`, [de, para]);
    await many(c, `UPDATE catalog_items SET payload = jsonb_set(payload, '{local}', to_jsonb($3::text))
                    WHERE kind = 'datas' AND regime = $1 AND lower(trim(payload->>'local')) = lower($2)`, [regime, de, para]);
  } else if (kind === "horarios") {
    await many(c, `UPDATE ${turmas} SET horario = $2 WHERE lower(trim(horario)) = lower($1)`, [de, para]);
    await many(c, `UPDATE catalog_items SET payload = jsonb_set(payload, '{horario}', to_jsonb($3::text))
                    WHERE kind = 'datas' AND regime = $1 AND lower(trim(payload->>'horario')) = lower($2)`, [regime, de, para]);
  } else if (kind === "areas") {
    if (regime === "gold") {
      await many(c, "UPDATE cursos_gold SET categoria = $2 WHERE lower(trim(categoria)) = lower($1)", [de, para]);
      // A ficha guarda a categoria e manda sobre a tabela: muda com ela.
      await many(c, `UPDATE curso_fichas SET payload = jsonb_set(payload, '{categoria}', to_jsonb($2::text))
                      WHERE regime = 'gold' AND jsonb_typeof(payload) = 'object' AND lower(trim(payload->>'categoria')) = lower($1)`, [de, para]);
    } else {
      await many(c, `UPDATE curso_fichas SET payload = jsonb_set(payload, '{categoria}', to_jsonb($2::text))
                      WHERE regime = 'fin' AND lower(trim(payload->>'categoria')) = lower($1)`, [de, para]);
    }
  } else if (kind === "blog_tematicas") {
    await many(c, "UPDATE blog_posts SET tematica = $2 WHERE lower(trim(tematica)) = lower($1)", [de, para]);
  }
}
