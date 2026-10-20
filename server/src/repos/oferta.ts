/** Oferta pública, preços e cronogramas das turmas: leituras usadas pelo site, inscrições e conflitos de horário. */
import { many, one, type Consulta, type Regime } from "./sql.js";

export function turmasGoldActivas(c: Consulta) {
  return many<{
    id: number; nome: string; curso: string; local: string; horario: string;
    data_inicio: string; total_alunos: number; vagas: number; tolerancia: number; tem_cronograma: boolean;
    vagas_anunciadas: number | null;
  }>(c,
    `SELECT id, nome, curso, local, horario, data_inicio, total_alunos, vagas, vagas_anunciadas,
            COALESCE(tolerancia_vagas, 0) AS tolerancia,
            -- Com sessões no cronograma já se mostra no site, mesmo sem «Publicar».
            (cronograma_publicado_em IS NOT NULL OR EXISTS (
              SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(cronograma) = 'array' THEN cronograma ELSE '[]'::jsonb END) e
               WHERE e->>'id' IS DISTINCT FROM 'fim-cronograma')) AS tem_cronograma
       FROM turmas_gold
      WHERE estado = 'Ativa'
      ORDER BY curso, local, horario, data_inicio`);
}

/** Cronograma e publicação das turmas Gold activas (vista «Cronogramas» do comercial). */
export function cronogramasGoldActivos(c: Consulta) {
  return many<{ id: number; cronograma: unknown; cronograma_publicado_em: string | null }>(c,
    "SELECT id, cronograma, cronograma_publicado_em FROM turmas_gold WHERE estado = 'Ativa'");
}

export function turmasFinActivas(c: Consulta) {
  return many<{
    id: number; nome: string; curso: string; local: string; horario: string;
    data_inicio: string; alunos: number; alunos_total: number; tolerancia: number; tem_cronograma: boolean;
    vagas_anunciadas: number | null;
  }>(c,
    `SELECT id, nome, curso, local, horario, data_inicio, alunos, alunos_total, vagas_anunciadas,
            COALESCE(tolerancia_vagas, 0) AS tolerancia,
            -- Com sessões no cronograma já se mostra no site, mesmo sem «Publicar».
            (cronograma_publicado_em IS NOT NULL OR EXISTS (
              SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(cronograma) = 'array' THEN cronograma ELSE '[]'::jsonb END) e
               WHERE e->>'id' IS DISTINCT FROM 'fim-cronograma')) AS tem_cronograma
       FROM turmas_fin
      WHERE activa = true
      ORDER BY curso, local, horario, data_inicio`);
}

export function cursosGoldOferta(c: Consulta) {
  return many<{ nome: string; preco: number; tipo: string; regime: string; estado: string }>(c,
    "SELECT nome, preco, tipo, regime, estado FROM cursos_gold ORDER BY nome");
}

export function cursosFinOferta(c: Consulta) {
  return many<{ nome: string; estado: string }>(c,
    "SELECT COALESCE(NULLIF(trim(nome_comercial), ''), ufcd) AS nome, estado FROM cursos_fin ORDER BY nome");
}

export function cursosGoldActivos(c: Consulta) {
  return many<{ nome: string; preco: number }>(c, "SELECT nome, preco FROM cursos_gold WHERE estado = 'Ativo' ORDER BY nome");
}

/** Preço base de cada curso Gold e o payload da ficha (preços por local/horário). */
export function cursosGoldComFicha(c: Consulta) {
  return many<{ nome: string; preco: number; payload: unknown }>(c,
    `SELECT cg.nome, cg.preco, cf.payload
       FROM cursos_gold cg
       LEFT JOIN curso_fichas cf ON cf.regime = 'gold' AND cf.curso_id = cg.id`);
}

/** Payload da ficha do curso, procurado pelo nome (ou, na Financiada, pela UFCD). */
export async function fichaDoCursoPorNome(c: Consulta, regime: Regime, nome: string): Promise<unknown> {
  const row = regime === "fin"
    ? await one<{ payload: unknown }>(c,
      `SELECT f.payload
         FROM curso_fichas f
         JOIN cursos_fin c ON c.id = f.curso_id AND f.regime = 'fin'
        WHERE lower(trim(c.nome_comercial)) = lower(trim($1))
           OR lower(trim(c.ufcd)) = lower(trim($1))
           OR c.ufcd_cod = $1
        LIMIT 1`, [nome])
    : await one<{ payload: unknown }>(c,
      `SELECT f.payload
         FROM curso_fichas f
         JOIN cursos_gold c ON c.id = f.curso_id AND f.regime = 'gold'
        WHERE lower(trim(c.nome)) = lower(trim($1))
        LIMIT 1`, [nome]);
  return row?.payload ?? null;
}

/** Cronogramas de todas as turmas dos dois regimes (para detectar sobreposições do formador). */
export async function cronogramasDasTurmas(c: Consulta) {
  // Em sequência: pode correr dentro de uma transacção.
  const gold = await many<{ id: number; nome: string; cronograma: unknown }>(c, "SELECT id, nome, cronograma FROM turmas_gold");
  const fin = await many<{ id: number; nome: string; cronograma: unknown }>(c, "SELECT id, nome, cronograma FROM turmas_fin");
  return { gold, fin };
}
