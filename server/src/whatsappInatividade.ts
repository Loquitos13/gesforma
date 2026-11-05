/**
 * WhatsApp: fechar conversas e regras de inatividade (Configurações › WhatsApp › Regras de inatividade).
 *  - fechar: a equipa fecha a conversa (ou a regra, sem mensagens há X horas); sai a mensagem de despedida (só dentro
 *    das 24 horas da última mensagem da pessoa, regra da Meta) e o assistente volta a responder;
 *  - lembrar: quem parou a meio da pré-inscrição recebe, ao fim de X minutos, «ainda está aí?» (uma vez por pausa);
 *  - avisar a equipa: um pedido para falar com a equipa sem resposta há X horas dá um novo aviso por email (uma vez).
 * Com 0 (ou vazio) a regra fica desligada. O envio é injectado (a Cloud API vive em whatsapp.ts).
 */
import { avisarPedidoWhatsapp, avisarWhatsappHumano } from "./avisosEquipa.js";
import type { Db } from "./db/pool.js";
import { lerDefinicao } from "./repos/settings.js";
import {
  emAtendimento, HUMANO_EXPIRA_HORAS, leadsPorTelefoneWhatsapp, limparAnexosWhatsapp, marcarConversaIniciadaWhatsapp, registarMensagemWhatsapp,
} from "./repos/whatsapp.js";
import type { Resposta } from "./whatsappBot.js";

export type EnviarWhatsapp = (to: string, mensagem: Resposta) => Promise<{ sent: boolean }>;

export const DESPEDIDA_PADRAO = "Esta conversa foi encerrada. Obrigado pelo contacto! Se precisar de mais alguma coisa, escreva *menu*.";
export const LEMBRETE_PADRAO = "Ainda está aí? Pode continuar onde ficou ou escrever *menu* para recomeçar.";

/** Minutos à espera do assunto antes de o aviso à equipa sair sem ele. */
export const ESPERA_ASSUNTO_MIN = 5;

export type RegrasWhatsapp = { despedida: string; fecharHoras: number; lembreteMin: number; lembreteTexto: string; avisoEquipaHoras: number };

const numero = (v: unknown, padrao: number) => {
  const t = String(v ?? "").trim().replace(",", ".");
  if (!t) return padrao;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : padrao;
};

export async function lerRegrasWhatsapp(db: Db): Promise<RegrasWhatsapp> {
  const v = await lerDefinicao(db, "whatsapp_regras").catch(() => ({} as Record<string, unknown>));
  return {
    despedida: String(v.despedida ?? "").trim() || DESPEDIDA_PADRAO,
    fecharHoras: numero(v.fecharHoras, 24),
    lembreteMin: numero(v.lembreteMin, 30),
    lembreteTexto: String(v.lembreteTexto ?? "").trim() || LEMBRETE_PADRAO,
    avisoEquipaHoras: numero(v.avisoEquipaHoras, 4),
  };
}

/** A pessoa escreveu há menos de 24 horas (só então se pode mandar texto livre). */
async function janelaAberta(db: Db, telefone: string) {
  const r = await db.query<{ ok: boolean }>(
    "SELECT COALESCE(max(created_at) > now() - interval '24 hours', false) AS ok FROM whatsapp_mensagens WHERE telefone = $1 AND direccao = 'in'",
    [telefone]);
  return Boolean(r.rows[0]?.ok);
}

/**
 * Fecha a conversa: despedida à pessoa (se a janela das 24 horas estiver aberta), o bot volta a responder e a conversa
 * passa a «Fechadas». Devolve se a despedida saiu.
 */
export async function fecharConversaWhatsapp(db: Db, telefone: string, por: string, enviar: EnviarWhatsapp) {
  const { despedida } = await lerRegrasWhatsapp(db);
  // Fechada por inatividade depois de a equipa responder: sem despedida e o assistente continua calado na conversa.
  const daEquipa = por === "Inatividade" && Boolean((await db.query<{ humano_por: string | null }>(
    "SELECT humano_por FROM whatsapp_sessoes WHERE telefone = $1", [telefone])).rows[0]?.humano_por);
  let saiu = false;
  if (despedida && !daEquipa && await janelaAberta(db, telefone)) {
    saiu = (await enviar(telefone, despedida).catch(() => ({ sent: false }))).sent;
    if (saiu) await registarMensagemWhatsapp(db, telefone, "out", despedida, undefined, por);
  }
  // Marca no histórico: o histórico fica todo; se a pessoa voltar a escrever, a conversa reabre por baixo.
  await registarMensagemWhatsapp(db, telefone, "evento", por === "Inatividade" ? "Conversa fechada por inatividade" : `Conversa fechada por ${por}`);
  await db.query(
    `INSERT INTO whatsapp_sessoes (telefone, passo, fechada_em, fechada_por, actualizado_em) VALUES ($1, 'menu', now(), $2, now())
     ON CONFLICT (telefone) DO UPDATE SET passo = 'menu', dados = '{}'::jsonb,
       humano_desde = CASE WHEN $3 THEN whatsapp_sessoes.humano_desde END, humano_por = CASE WHEN $3 THEN whatsapp_sessoes.humano_por END,
       fechada_em = now(), fechada_por = $2, lembrete_em = NULL, aviso_equipa_em = NULL, lida_em = now()`,
    [telefone, por.slice(0, 120), daEquipa]);
  return { despedida: saiu };
}

/** A pessoa voltou a escrever: a conversa reabre (com o assistente), com uma marca no histórico. */
export async function reabrirConversaWhatsapp(db: Db, telefone: string) {
  const r = await db.query(
    "UPDATE whatsapp_sessoes SET fechada_em = NULL, fechada_por = NULL WHERE telefone = $1 AND fechada_em IS NOT NULL RETURNING telefone", [telefone]);
  if (r.rows.length) {
    await registarMensagemWhatsapp(db, telefone, "evento", "Conversa reaberta");
    await marcarConversaIniciadaWhatsapp(db, telefone);
  }
  return r.rows.length > 0;
}

type Sessao = { telefone: string; passo: string; humano_desde: string | null; humano_por: string | null; ultima: string; ultima_in: string | null; resposta_equipa: string | null };

/** Uma volta das regras de inatividade (corre a cada minuto dentro da API). */
export async function verificarInatividade(db: Db, enviar: EnviarWhatsapp) {
  const r = await lerRegrasWhatsapp(db);
  // Ficheiros recebidos que ninguém guardou na ficha: apagam-se ao fim de 30 dias.
  await limparAnexosWhatsapp(db).catch(() => undefined);
  // Pedidos para falar com a equipa sem assunto ao fim de uns minutos: o aviso sai sem ele (sempre, mesmo sem regras).
  const semAssunto = (await db.query<{ telefone: string }>(
    `SELECT telefone FROM whatsapp_sessoes WHERE fechada_em IS NULL AND aviso_pedido_em IS NULL AND humano_desde IS NOT NULL
        AND humano_desde < now() - make_interval(mins => $1) AND humano_desde > now() - make_interval(hours => $2)`,
    [ESPERA_ASSUNTO_MIN, HUMANO_EXPIRA_HORAS])).rows;
  for (const s of semAssunto) {
    await avisarPedidoWhatsapp(db, s.telefone, "(ainda sem assunto: a pessoa não escreveu mais nada)").catch(err => console.error("[whatsapp] aviso à equipa:", err));
  }
  if (!r.fecharHoras && !r.lembreteMin && !r.avisoEquipaHoras) return { fechadas: 0, lembretes: 0, avisos: 0 };
  const sessoes = (await db.query<Sessao>(
    `SELECT s.telefone, s.passo, s.humano_desde::text AS humano_desde, s.humano_por,
            (SELECT max(created_at)::text FROM whatsapp_mensagens m WHERE m.telefone = s.telefone AND m.direccao <> 'evento') AS ultima,
            (SELECT max(created_at)::text FROM whatsapp_mensagens m WHERE m.telefone = s.telefone AND m.direccao = 'in') AS ultima_in,
            (SELECT max(created_at)::text FROM whatsapp_mensagens m WHERE m.telefone = s.telefone AND m.direccao = 'out'
               AND m.autor IS NOT NULL AND m.autor <> '') AS resposta_equipa
       FROM whatsapp_sessoes s
      WHERE s.fechada_em IS NULL
        AND EXISTS (SELECT 1 FROM whatsapp_mensagens m WHERE m.telefone = s.telefone AND m.direccao <> 'evento')
      ORDER BY s.actualizado_em DESC
      LIMIT 500`)).rows.filter(s => s.ultima);
  const agora = Date.now();
  const ha = (iso: string | null) => (iso ? (agora - new Date(iso).getTime()) / 60_000 : Infinity);
  let fechadas = 0, lembretes = 0, avisos = 0;
  for (const s of sessoes) {
    const humano = emAtendimento(s, agora);
    // 1. Sem mensagens há X horas: fecha.
    if (r.fecharHoras && ha(s.ultima) >= r.fecharHoras * 60) {
      await fecharConversaWhatsapp(db, s.telefone, "Inatividade", enviar);
      fechadas++;
      continue;
    }
    // 2. Parou a meio da pré-inscrição (o bot fez a última pergunta): «ainda está aí?», uma vez por pausa.
    if (r.lembreteMin && !humano && s.passo !== "menu" && ha(s.ultima) >= r.lembreteMin && ha(s.ultima_in) < 24 * 60) {
      const marcada = await db.query(
        `UPDATE whatsapp_sessoes SET lembrete_em = now() WHERE telefone = $1
           AND (lembrete_em IS NULL OR lembrete_em < $2::timestamptz) RETURNING telefone`, [s.telefone, s.ultima]);
      if (marcada.rows.length) {
        const ok = (await enviar(s.telefone, r.lembreteTexto).catch(() => ({ sent: false }))).sent;
        if (ok) { await registarMensagemWhatsapp(db, s.telefone, "out", r.lembreteTexto); lembretes++; }
      }
    }
    // 3. Pediu para falar com a equipa e ninguém respondeu há X horas: novo aviso à equipa (uma vez por pedido).
    // À espera: a última mensagem da pessoa é mais recente do que a última resposta da equipa; conta desde ela.
    const aEspera = !s.resposta_equipa || (s.ultima_in != null && new Date(s.ultima_in).getTime() > new Date(s.resposta_equipa).getTime());
    if (r.avisoEquipaHoras && humano && aEspera && ha(s.ultima_in ?? s.humano_desde) >= r.avisoEquipaHoras * 60) {
      const marcada = await db.query(
        "UPDATE whatsapp_sessoes SET aviso_equipa_em = now() WHERE telefone = $1 AND aviso_equipa_em IS NULL RETURNING telefone", [s.telefone]);
      if (marcada.rows.length) {
        const n9 = s.telefone.slice(-9);
        const lead = (await leadsPorTelefoneWhatsapp(db, s.telefone, n9))[0];
        const nome = lead ? `${lead.nome ?? ""} ${lead.apelido ?? ""}`.trim() : (await db.query<{ nome_perfil: string | null }>(
          "SELECT nome_perfil FROM whatsapp_sessoes WHERE telefone = $1", [s.telefone])).rows[0]?.nome_perfil ?? "";
        await avisarWhatsappHumano(db, {
          telefone: s.telefone, nome,
          mensagem: `Ainda sem resposta da equipa (pedido há mais de ${r.avisoEquipaHoras} ${r.avisoEquipaHoras === 1 ? "hora" : "horas"}).`,
          regime: lead ? (String(lead.regime) === "fin" ? "fin" : "gold") : null,
        }).catch(err => console.error("[whatsapp] aviso de inatividade:", err));
        avisos++;
      }
    }
  }
  return { fechadas, lembretes, avisos };
}
