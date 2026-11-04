import { many, one, valor, type Consulta } from "./sql.js";

/** WhatsApp (Meta Cloud API): configuração, sessões do assistente e mensagens. */

export type WhatsappGuardado = { token_sealed: string | null; phone_id: string | null; verify_token: string | null; display_phone: string | null };

export function whatsappGuardado(c: Consulta) {
  return one<WhatsappGuardado>(c, "SELECT token_sealed, phone_id, verify_token, display_phone FROM whatsapp_config WHERE id = 'meta'");
}

export async function gravarWhatsapp(c: Consulta, w: { tokenSealed: string; phoneId: string; verifyToken: string; displayPhone: string }) {
  await one(
    c,
    `INSERT INTO whatsapp_config (id, token_sealed, phone_id, verify_token, display_phone, updated_at)
     VALUES ('meta', $1, $2, $3, $4, now())
     ON CONFLICT (id) DO UPDATE SET token_sealed = EXCLUDED.token_sealed, phone_id = EXCLUDED.phone_id,
       verify_token = EXCLUDED.verify_token, display_phone = EXCLUDED.display_phone, updated_at = now()`,
    [w.tokenSealed, w.phoneId, w.verifyToken, w.displayPhone],
  );
}

export async function apagarWhatsapp(c: Consulta) {
  await one(c, "DELETE FROM whatsapp_config WHERE id = 'meta'");
}

export async function contarSessoesWhatsapp(c: Consulta) {
  return Number((await valor<number>(c, "SELECT count(*)::int FROM whatsapp_sessoes")) ?? 0);
}

export function sessaoWhatsapp(c: Consulta, telefone: string) {
  return one<{ passo: string; dados: unknown; lead_id: number | null; humano_desde: string | null; fechada_em: string | null; fechada_por: string | null }>(
    c,
    `SELECT passo, dados, lead_id, humano_desde::text AS humano_desde, fechada_em::text AS fechada_em, fechada_por
       FROM whatsapp_sessoes WHERE telefone = $1`,
    [telefone],
  );
}

/** Horas sem resposta da equipa ao fim das quais o assistente volta a responder nessa conversa. */
export const HUMANO_EXPIRA_HORAS = 72;

/** A pessoa pediu para falar com a equipa: o bot fica em pausa nesta conversa (uma pausa já caducada recomeça agora). */
export async function pedirHumanoWhatsapp(c: Consulta, telefone: string) {
  await one(
    c,
    `INSERT INTO whatsapp_sessoes (telefone, passo, humano_desde, actualizado_em) VALUES ($1, 'menu', now(), now())
     ON CONFLICT (telefone) DO UPDATE SET passo = 'menu', dados = '{}'::jsonb, actualizado_em = now(),
       aviso_pedido_em = CASE WHEN whatsapp_sessoes.humano_desde IS NULL
                                OR whatsapp_sessoes.humano_desde < now() - make_interval(hours => $2)
                              THEN NULL ELSE whatsapp_sessoes.aviso_pedido_em END,
       humano_desde = CASE WHEN whatsapp_sessoes.humano_desde IS NULL
                             OR whatsapp_sessoes.humano_desde < now() - make_interval(hours => $2)
                           THEN now() ELSE whatsapp_sessoes.humano_desde END`,
    [telefone, HUMANO_EXPIRA_HORAS],
  );
}

/** A equipa respondeu: a pausa do bot conta de novo a partir de agora. */
export async function refrescarHumanoWhatsapp(c: Consulta, telefone: string, por: string) {
  await one(
    c,
    `INSERT INTO whatsapp_sessoes (telefone, passo, humano_desde, humano_por, lida_em, actualizado_em) VALUES ($1, 'menu', now(), $2, now(), now())
     ON CONFLICT (telefone) DO UPDATE SET humano_desde = now(), humano_por = $2, lida_em = now(), actualizado_em = now()`,
    [telefone, por],
  );
}

/** Devolve a conversa ao assistente automático. */
export async function libertarHumanoWhatsapp(c: Consulta, telefone: string) {
  await one(c, "UPDATE whatsapp_sessoes SET humano_desde = NULL, humano_por = NULL, passo = 'menu', dados = '{}'::jsonb WHERE telefone = $1", [telefone]);
}

export async function marcarLidaWhatsapp(c: Consulta, telefone: string) {
  await one(c, "UPDATE whatsapp_sessoes SET lida_em = now() WHERE telefone = $1", [telefone]);
}

export async function gravarNomePerfilWhatsapp(c: Consulta, telefone: string, nome: string) {
  await one(
    c,
    `INSERT INTO whatsapp_sessoes (telefone, nome_perfil, actualizado_em) VALUES ($1, $2, now())
     ON CONFLICT (telefone) DO UPDATE SET nome_perfil = EXCLUDED.nome_perfil`,
    [telefone, nome.slice(0, 120)],
  );
}

/** Quando chegou a última mensagem da pessoa (as respostas livres só valem até 24 horas depois). */
export function ultimaEntradaWhatsapp(c: Consulta, telefone: string) {
  return valor<string>(c, "SELECT max(created_at)::text FROM whatsapp_mensagens WHERE telefone = $1 AND direccao = 'in'", [telefone]);
}

export type ConversaResumo = {
  telefone: string; nome_perfil: string | null; humano_desde: string | null; humano_por: string | null;
  ultima_em: string; ultima: string; ultima_direccao: string; ultima_entrada: string | null; por_ler: number;
  fechada_em: string | null; fechada_por: string | null;
};

/** Conversas, as mais recentes primeiro; as que pedem uma pessoa vêm à frente. */
export function conversasWhatsapp(c: Consulta, limite = 200) {
  return many<ConversaResumo>(
    c,
    `WITH ult AS (
       SELECT DISTINCT ON (telefone) telefone, corpo, direccao, created_at
         FROM whatsapp_mensagens WHERE direccao <> 'evento' ORDER BY telefone, id DESC
     )
     SELECT u.telefone, s.nome_perfil, s.humano_desde::text AS humano_desde, s.humano_por,
            s.fechada_em::text AS fechada_em, s.fechada_por,
            u.created_at::text AS ultima_em, left(u.corpo, 160) AS ultima, u.direccao AS ultima_direccao,
            (SELECT max(created_at)::text FROM whatsapp_mensagens m WHERE m.telefone = u.telefone AND m.direccao = 'in') AS ultima_entrada,
            (SELECT count(*)::int FROM whatsapp_mensagens m WHERE m.telefone = u.telefone AND m.direccao = 'in'
               AND m.created_at > COALESCE(s.lida_em, '-infinity'::timestamptz)) AS por_ler
       FROM ult u LEFT JOIN whatsapp_sessoes s ON s.telefone = u.telefone
      ORDER BY (s.fechada_em IS NULL) DESC,
               (s.humano_desde IS NOT NULL AND s.humano_desde > now() - make_interval(hours => $2)) DESC, u.created_at DESC
      LIMIT $1`,
    [limite, HUMANO_EXPIRA_HORAS],
  );
}

export async function gravarSessaoWhatsapp(c: Consulta, telefone: string, passo: string, dados: unknown, leadId: number | null) {
  await one(
    c,
    `INSERT INTO whatsapp_sessoes (telefone, passo, dados, lead_id, actualizado_em) VALUES ($1, $2, $3::jsonb, $4, now())
     ON CONFLICT (telefone) DO UPDATE SET passo = EXCLUDED.passo, dados = EXCLUDED.dados, lead_id = EXCLUDED.lead_id, actualizado_em = now()`,
    [telefone, passo, JSON.stringify(dados), leadId],
  );
}

export async function registarMensagemWhatsapp(c: Consulta, telefone: string, direccao: "in" | "out" | "evento", corpo: string, wamid?: string, autor?: string) {
  await one(
    c, "INSERT INTO whatsapp_mensagens (telefone, direccao, corpo, wamid, autor) VALUES ($1, $2, $3, $4, $5)",
    [telefone, direccao, corpo.slice(0, 4000), wamid || null, autor || null],
  );
}

/**
 * Regista uma mensagem recebida com o seu id da Meta, uma só vez: devolve `false` se esse id já estava registado (a Meta
 * pode entregar a mesma mensagem mais de uma vez, até em simultâneo).
 */
export async function registarEntradaWhatsapp(c: Consulta, telefone: string, corpo: string, wamid: string, anexoId?: number) {
  const r = await one<{ id: string }>(
    c,
    `INSERT INTO whatsapp_mensagens (telefone, direccao, corpo, wamid, anexo_id) VALUES ($1, 'in', $2, $3, $4)
     ON CONFLICT (wamid) DO NOTHING RETURNING id::text AS id`,
    [telefone, corpo.slice(0, 4000), wamid, anexoId ?? null],
  );
  return Boolean(r);
}

export async function wamidJaVisto(c: Consulta, wamid: string) {
  return Boolean(await one(c, "SELECT 1 FROM whatsapp_mensagens WHERE wamid = $1 LIMIT 1", [wamid]));
}

/** As últimas mensagens da conversa, pela ordem em que aconteceram. */
export function conversaWhatsapp(c: Consulta, telefone: string, limite = 200) {
  return many<{ direccao: string; corpo: string; created_at: string; autor: string | null; anexo_id: number | null }>(
    c,
    `SELECT direccao, corpo, created_at, autor, anexo_id FROM (
       SELECT id, direccao, corpo, created_at::text AS created_at, autor, anexo_id FROM whatsapp_mensagens
        WHERE telefone = $1 ORDER BY id DESC LIMIT $2
     ) x ORDER BY id ASC`,
    [telefone, limite],
  );
}

/** Pré-inscrições com este telefone (últimos 9 dígitos, com ou sem indicativo). */
export function leadsPorTelefoneWhatsapp(c: Consulta, telefone: string, ultimos9: string) {
  return many<Record<string, unknown>>(
    c,
    "SELECT * FROM preinscricoes WHERE telf LIKE $1 OR telf LIKE $2 OR telf LIKE $3 ORDER BY id DESC LIMIT 8",
    [`%${ultimos9}%`, `%351${ultimos9}%`, `%${telefone}%`],
  );
}

/** Reserva o aviso à equipa do pedido em curso (uma vez por pedido): `true` só a quem o reservou. */
export async function reservarAvisoPedidoWhatsapp(c: Consulta, telefone: string) {
  return Boolean(await one(
    c, "UPDATE whatsapp_sessoes SET aviso_pedido_em = now() WHERE telefone = $1 AND humano_desde IS NOT NULL AND aviso_pedido_em IS NULL RETURNING telefone",
    [telefone],
  ));
}

/** Apaga a conversa (mensagens e sessão) de vez. */
export async function apagarConversaWhatsapp(c: Consulta, telefone: string) {
  await one(c, "DELETE FROM whatsapp_anexos WHERE telefone = $1", [telefone]);
  await one(c, "DELETE FROM whatsapp_mensagens WHERE telefone = $1", [telefone]);
  await one(c, "DELETE FROM whatsapp_sessoes WHERE telefone = $1", [telefone]);
}

/**
 * Conversas em que a pessoa pediu alguém da equipa e ainda espera: o pedido está activo, a conversa aberta e a equipa
 * ainda não respondeu (ou a pessoa escreveu depois da última resposta da equipa).
 */
export function pedidosPendentesWhatsapp(c: Consulta) {
  return many<{ telefone: string; nome_perfil: string | null; humano_desde: string }>(
    c,
    `SELECT s.telefone, s.nome_perfil, s.humano_desde::text AS humano_desde
       FROM whatsapp_sessoes s
      WHERE s.fechada_em IS NULL AND s.humano_desde IS NOT NULL AND s.humano_desde > now() - make_interval(hours => $1)
        AND COALESCE((SELECT max(created_at) FROM whatsapp_mensagens m
                       WHERE m.telefone = s.telefone AND m.direccao = 'out' AND m.autor IS NOT NULL AND m.autor <> ''),
                   '-infinity'::timestamptz)
          < COALESCE((SELECT max(created_at) FROM whatsapp_mensagens m WHERE m.telefone = s.telefone AND m.direccao = 'in'), s.humano_desde)
      ORDER BY s.humano_desde
      LIMIT 100`,
    [HUMANO_EXPIRA_HORAS],
  );
}

/** A conversa começou agora (primeira mensagem da pessoa, ou reaberta). */
export async function marcarConversaIniciadaWhatsapp(c: Consulta, telefone: string) {
  await one(
    c,
    `INSERT INTO whatsapp_sessoes (telefone, conversa_iniciada_em, actualizado_em) VALUES ($1, now(), now())
     ON CONFLICT (telefone) DO UPDATE SET conversa_iniciada_em = now()`,
    [telefone],
  );
}

/** Quantas mensagens a pessoa já escreveu nesta conversa (para saber se é a primeira). */
export async function entradasWhatsapp(c: Consulta, telefone: string) {
  return Number((await valor<number>(c, "SELECT count(*)::int FROM whatsapp_mensagens WHERE telefone = $1 AND direccao = 'in'", [telefone])) ?? 0);
}

/** Conversas abertas com mensagens por ler (contador do menu) e quando começou cada uma (alerta «nova conversa»). */
export function conversasPorLerWhatsapp(c: Consulta) {
  return many<{ telefone: string; nome_perfil: string | null; conversa_iniciada_em: string | null; lida_em: string | null; por_ler: number }>(
    c,
    `SELECT * FROM (
       SELECT s.telefone, s.nome_perfil, s.conversa_iniciada_em::text AS conversa_iniciada_em, s.lida_em::text AS lida_em,
              (SELECT count(*)::int FROM whatsapp_mensagens m WHERE m.telefone = s.telefone AND m.direccao = 'in'
                 AND m.created_at > COALESCE(s.lida_em, '-infinity'::timestamptz)) AS por_ler
         FROM whatsapp_sessoes s WHERE s.fechada_em IS NULL
     ) x WHERE x.por_ler > 0
     ORDER BY x.conversa_iniciada_em DESC NULLS LAST
     LIMIT 200`,
  );
}

export type AnexoWhatsapp = {
  id: number; telefone: string; nome: string; mime: string; tamanho: number; created_at: string;
  guardado_em: string | null; guardado_por: string | null; preinscricao_id: number | null; doc_tipo: string | null;
};

/** Guarda o ficheiro recebido (fica à espera de alguém o passar para a ficha) e a mensagem que o mostra. */
export async function registarAnexoRecebidoWhatsapp(
  c: Consulta, a: { telefone: string; wamid: string; nome: string; mime: string; bytes: Buffer; legenda: string },
) {
  const id = Number(await valor<number>(
    c,
    `INSERT INTO whatsapp_anexos (telefone, wamid, nome, mime, tamanho, conteudo) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [a.telefone, a.wamid || null, a.nome.slice(0, 160), a.mime.slice(0, 120), a.bytes.length, a.bytes],
  ));
  return id;
}

export function anexoWhatsapp(c: Consulta, id: number) {
  return one<AnexoWhatsapp & { conteudo: Uint8Array | null; drive_file_id: string | null }>(
    c,
    `SELECT id, telefone, nome, mime, tamanho, conteudo, created_at::text AS created_at, guardado_em::text AS guardado_em,
            guardado_por, preinscricao_id, doc_tipo, drive_file_id FROM whatsapp_anexos WHERE id = $1`,
    [id],
  );
}

export function anexosDaConversaWhatsapp(c: Consulta, telefone: string) {
  return many<AnexoWhatsapp>(
    c,
    `SELECT id, telefone, nome, mime, tamanho, created_at::text AS created_at, guardado_em::text AS guardado_em,
            guardado_por, preinscricao_id, doc_tipo FROM whatsapp_anexos WHERE telefone = $1 ORDER BY id`,
    [telefone],
  );
}

/** Marca o anexo como guardado na ficha (uma vez): `false` se já estava. */
export async function marcarAnexoGuardadoWhatsapp(c: Consulta, id: number, por: string, preinscricaoId: number, tipo: string) {
  return Boolean(await one(
    c,
    `UPDATE whatsapp_anexos SET guardado_em = now(), guardado_por = $2, preinscricao_id = $3, doc_tipo = $4
      WHERE id = $1 AND guardado_em IS NULL RETURNING id`,
    [id, por.slice(0, 120), preinscricaoId, tipo],
  ));
}

/** Guardado na ficha: o conteúdo sai da base de dados (fica o ficheiro da Drive). */
export async function passarAnexoParaDriveWhatsapp(c: Consulta, id: number, driveFileId: string) {
  await one(c, "UPDATE whatsapp_anexos SET conteudo = NULL, drive_file_id = $2 WHERE id = $1", [id, driveFileId]);
}

/** Apaga os anexos não guardados com mais de 30 dias (o conteúdo; a mensagem fica no histórico). */
export async function limparAnexosWhatsapp(c: Consulta) {
  await one(c, "DELETE FROM whatsapp_anexos WHERE guardado_em IS NULL AND created_at < now() - interval '30 days'");
}
