/**
 * Campanhas por email aos pré-inscritos que pararam: há mais de um mês, já contactados (os lembretes
 * automáticos contam), com documentos em falta ou que não passaram a formando. O email leva os
 * cronogramas das próximas turmas do curso e a ligação pessoal; cada envio fica registado como contacto.
 */
import { flushQueuedJobs, ingestEvent } from "./automations.js";
import { config } from "./config.js";
import { logLeadEvent } from "./crmDossier.js";
import type { Db } from "./db/pool.js";
import { hojeLisboa } from "./datas.js";
import { docsDoCurso } from "./docsCurso.js";
import { documentosUrl, ensureDocsToken, listarDocsLead } from "./docsLink.js";
import { fmtDataPt, listOfertaFin, listOfertaGold, type OfertaTurma } from "./ofertaGold.js";
import * as repo from "./repos/campanhasEmail.js";
import type { AtorCrm } from "./repos/sql.js";
import * as leads from "./repos/leads.js";
import { isEmail, normalizeEmail } from "./security.js";

export type Criterios = repo.CriteriosCampanha & { soDocsEmFalta?: boolean };

type PedidosPorCurso = Map<string, Promise<Awaited<ReturnType<typeof docsDoCurso>>>>;

/** Documentos obrigatórios ainda por enviar (ou recusados) desta pré-inscrição. */
async function docsEmFalta(db: Db, lead: { id: number; curso: string; regime: string }, cache: PedidosPorCurso) {
  const regime = lead.regime === "fin" ? "fin" : "gold";
  const chave = `${regime}:${lead.curso.trim().toLowerCase()}`;
  if (!cache.has(chave)) cache.set(chave, docsDoCurso(db, lead.curso, regime));
  const pedidos = await cache.get(chave)!;
  const ficheiros = new Map((await listarDocsLead(db, lead.id)).map(f => [f.tipo, f]));
  return pedidos.filter(d => d.required).filter(d => {
    const f = ficheiros.get(d.id);
    return !f || f.estado === "recusado";
  }).map(d => d.label);
}

/** Quem cumpre os critérios; com `soIds`, só essas pré-inscrições (para o envio). */
export async function candidatosCampanha(db: Db, k: Criterios, ator?: AtorCrm, soIds?: Set<number>) {
  const linhas = (await repo.candidatos(db, k, ator)).filter(l => !soIds || soIds.has(Number(l.id)));
  const cache: PedidosPorCurso = new Map();
  const out = [];
  for (const l of linhas) {
    const emFalta = await docsEmFalta(db, l, cache);
    if (k.soDocsEmFalta && emFalta.length === 0) continue;
    out.push({
      id: Number(l.id), nome: `${l.nome} ${l.apelido}`.trim(), email: l.email, curso: l.curso,
      regime: l.regime === "fin" ? "fin" as const : "gold" as const, estado: l.estado,
      inscritoEm: l.created_at, contactos: Number(l.contactos), ultimoEnvio: l.ultimo_envio,
      docsEmFalta: emFalta,
      motivo: emFalta.length ? `Faltam documentos: ${emFalta.join(", ")}` : "Ainda não passou a formando",
    });
  }
  return out;
}

const mesmoCurso = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Próximas turmas do curso com o cronograma publicado (até 3), como linhas para o email. */
function cronogramasDe(oferta: OfertaTurma[], curso: string) {
  const hoje = hojeLisboa();
  const origem = config.appOrigin.replace(/\/$/, "");
  return oferta
    .filter(t => mesmoCurso(t.curso, curso) && t.cronogramaPublicado && t.dataInicio >= hoje)
    .sort((a, b) => a.dataInicio.localeCompare(b.dataInicio))
    .slice(0, 3)
    .map(t => `${[t.local, t.horario, `início ${fmtDataPt(t.dataInicio)}`].filter(Boolean).join(" · ")}: ${origem}/cronograma/${t.regime}/${t.turmaId}`);
}

export class CampanhaErro extends Error {}

/** Chave de idempotência do email de campanha: estável para a mesma pré-inscrição, email e dia. */
export function chaveCampanha(leadId: number, email: string, dia: string) {
  return `campanha:${leadId}:${email}:${dia}`;
}

/** Põe os emails na fila (o cron envia-os) e regista o envio e um contacto em cada pré-inscrição. */
export async function enviarCampanha(db: Db, ator: AtorCrm, p: { ids: number[]; campanhaId: number | null; criterios: Criterios }) {
  const actorId = ator.id;
  if (p.campanhaId && !(await repo.existeCampanha(db, p.campanhaId))) throw new CampanhaErro("Campanha não encontrada.");
  // Só sai para quem continua a cumprir os critérios (a lista pode ter mudado entretanto) e o ator vê.
  const alvo = await candidatosCampanha(db, p.criterios, ator, new Set(p.ids));
  if (!alvo.length) throw new CampanhaErro("Nenhuma das pré-inscrições escolhidas cumpre os critérios.");
  const [gold, fin] = await Promise.all([listOfertaGold(db), listOfertaFin(db)]);
  const envioId = await repo.criarEnvio(db, {
    campanhaId: p.campanhaId, assunto: "Campanha aos pré-inscritos", criterios: p.criterios, total: alvo.length, actorId,
  });
  let postos = 0;
  // Uma campanha por pré-inscrição e email em cada dia (de Lisboa): um duplo clique ou uma repetição do pedido
  // cria outro registo de envio, mas não volta a pôr o email na fila nem a registar o contacto.
  const dia = hojeLisboa();
  for (const c of alvo) {
    const email = normalizeEmail(c.email);
    if (!isEmail(email)) { await repo.registarDestino(db, envioId, c.id, false, "email inválido"); continue; }
    try {
      const url = documentosUrl(await ensureDocsToken(db, c.id));
      const r = await ingestEvent(db, "campanha.preinscritos", {
        email, nome: c.nome, curso: c.curso, preinscricaoId: c.id, documentos_url: url,
        documentos_em_falta_itens: c.docsEmFalta, cronogramas_itens: cronogramasDe(c.regime === "fin" ? fin : gold, c.curso),
      }, chaveCampanha(c.id, email, dia));
      if (r.duplicate) { await repo.registarDestino(db, envioId, c.id, false, "já recebeu esta campanha hoje"); continue; }
      if (!r.queued) { await repo.registarDestino(db, envioId, c.id, false, "regra «Campanha aos pré-inscritos» desligada"); continue; }
      await repo.registarDestino(db, envioId, c.id, true);
      const nota = `Campanha por email${p.campanhaId ? ` (campanha #${p.campanhaId})` : ""} · ${c.motivo}`.slice(0, 1000);
      await leads.inserirContacto(db, { leadId: c.id, actorId, nota, meio: "Email" });
      await logLeadEvent(db, c.id, actorId, "contacto", "Campanha por email", nota);
      postos += 1;
    } catch (err) {
      await repo.registarDestino(db, envioId, c.id, false, err instanceof Error ? err.message : "falha");
    }
  }
  await repo.fecharEnvio(db, envioId);
  await flushQueuedJobs(db, 10).catch(() => undefined);
  return { envioId, total: alvo.length, postos };
}
