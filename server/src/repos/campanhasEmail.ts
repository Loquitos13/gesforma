/** Campanhas por email aos pré-inscritos parados: candidatos, envios e destinatários. */
import { many, one, valor, type Consulta } from "./sql.js";

export type CriteriosCampanha = { dias: number; contactos: number; curso?: string };

export type Candidato = {
  id: number; nome: string; apelido: string; email: string; curso: string; regime: string; estado: string;
  created_at: string; contactos: number; ultimo_envio: string | null;
};

/**
 * Pré-inscrições abertas há mais de `dias` dias, com pelo menos `contactos` contactos (os lembretes
 * automáticos contam) e que ainda não passaram a formando nem desistiram.
 */
export async function candidatos(c: Consulta, k: CriteriosCampanha) {
  return many<Candidato>(c,
    `SELECT p.id, p.nome, p.apelido, p.email, p.curso, COALESCE(p.regime, 'gold') AS regime, p.estado,
            p.created_at::text AS created_at, x.n::int AS contactos,
            (SELECT max(e.criado_em)::text FROM campanha_envio_destinos d JOIN campanha_envios e ON e.id = d.envio_id
              WHERE d.preinscricao_id = p.id) AS ultimo_envio
       FROM preinscricoes p
       JOIN LATERAL (SELECT count(*) AS n FROM preinscricao_contactos pc WHERE pc.preinscricao_id = p.id) x ON true
      WHERE p.estado NOT IN ('Formando', 'Desistiu')
        AND p.created_at <= now() - make_interval(days => $1::int)
        AND x.n >= $2
        AND btrim(p.email) <> ''
        AND ($3::text = '' OR lower(btrim(p.curso)) = lower(btrim($3::text)))
      ORDER BY p.created_at
      LIMIT 500`,
    [k.dias, k.contactos, k.curso ?? ""]);
}

export async function criarEnvio(c: Consulta, e: { campanhaId: number | null; assunto: string; criterios: unknown; total: number; actorId: string }) {
  return Number(await valor<number>(c,
    `INSERT INTO campanha_envios (campanha_id, assunto, criterios, total, criado_por)
     VALUES ($1, $2, $3::jsonb, $4, $5) RETURNING id`,
    [e.campanhaId, e.assunto, JSON.stringify(e.criterios), e.total, e.actorId]));
}

export async function registarDestino(c: Consulta, envioId: number, leadId: number, enviado: boolean, erro = "") {
  await many(c,
    `INSERT INTO campanha_envio_destinos (envio_id, preinscricao_id, enviado, erro) VALUES ($1, $2, $3, $4)
     ON CONFLICT (envio_id, preinscricao_id) DO UPDATE SET enviado = EXCLUDED.enviado, erro = EXCLUDED.erro`,
    [envioId, leadId, enviado, erro.slice(0, 300)]);
}

export async function fecharEnvio(c: Consulta, envioId: number) {
  await many(c,
    "UPDATE campanha_envios SET enviados = (SELECT count(*) FROM campanha_envio_destinos WHERE envio_id = $1 AND enviado) WHERE id = $1",
    [envioId]);
}

export async function listarEnvios(c: Consulta) {
  return many<{ id: number; campanha_id: number | null; campanha: string | null; assunto: string; criterios: unknown; total: number; enviados: number; criado_em: string; autor: string | null }>(c,
    `SELECT e.id, e.campanha_id, ca.nome AS campanha, e.assunto, e.criterios, e.total, e.enviados, e.criado_em::text AS criado_em, u.name AS autor
       FROM campanha_envios e
       LEFT JOIN campanhas ca ON ca.id = e.campanha_id
       LEFT JOIN users u ON u.id = e.criado_por
      ORDER BY e.criado_em DESC LIMIT 50`);
}

export async function destinosDoEnvio(c: Consulta, envioId: number) {
  return many<{ preinscricao_id: number; nome: string; apelido: string; curso: string; estado: string; enviado: boolean; erro: string }>(c,
    `SELECT d.preinscricao_id, p.nome, p.apelido, p.curso, p.estado, d.enviado, d.erro
       FROM campanha_envio_destinos d JOIN preinscricoes p ON p.id = d.preinscricao_id
      WHERE d.envio_id = $1 ORDER BY p.nome`,
    [envioId]);
}

export async function existeCampanha(c: Consulta, id: number) {
  return Boolean(await one(c, "SELECT 1 FROM campanhas WHERE id = $1", [id]));
}
