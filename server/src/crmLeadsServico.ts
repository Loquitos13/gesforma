/**
 * Regras do CRM de pré-inscrições usadas pelas rotas: criar à mão, editar, contactar,
 * acções em lote, apagar e entregar à secretaria. O SQL está em `repos/leads*.ts`.
 */
import { ingestEvent } from "./automations.js";
import { camposEmFalta, estadoPodeEntregar, podeArrastar } from "./crmRegras.js";
import { addLeadNota, findDuplicados, logLeadEvent } from "./crmDossier.js";
import type { Db } from "./db/pool.js";
import { firePreinscricaoEmail, listarDocsLead, notificarDocumentos } from "./docsLink.js";
import { apagarFicheiroSubstituido } from "./driveFicheiros.js";
import { campanhaDoPedido, origemDaLista } from "./leadOpcoes.js";
import { mapPreinscricao, newPublicId, nextOpsId } from "./ops.js";
import { marcarLeadPago } from "./pagamentoPedido.js";
import { moverDocsDoLead } from "./percurso.js";
import { readPreinscricaoPii, writePreinscricaoPii } from "./pii.js";
import { precoParaOferta } from "./precoOferta.js";
import { linhaVisivel } from "./repos/crmVisivel.js";
import * as leads from "./repos/leads.js";
import * as escrita from "./repos/leadsEscrita.js";
import { isEmail, normalizeEmail } from "./security.js";

export class CrmErro extends Error {
  constructor(message: string, readonly codigo = 400, readonly extra: Record<string, unknown> = {}) {
    super(message);
  }
}

export type Actor = { id: string; role: string };

export type DadosLead = Partial<{
  nome: string; apelido: string; email: string; telf: string; concelho: string; origem: string; nota: string;
  curso: string; local: string; inicioCurso: string; horario: string; turmaId: number; preco: number;
  campanha: string; campanhaId: number | null; estado: string; proximoContacto: string; notas: string;
  comercialId: string | null; meioContacto: string; etiquetaId: number | null; nif: string; moradaFiscal: string;
  codigoPostal: string; motivoDesistencia: string; pagamentoMetodo: string; regime: "gold" | "fin";
}>;

function nowStamp() {
  return new Date().toISOString().slice(0, 16).replace("T", " ");
}

export function regimeDaLinha(row: { regime?: unknown } | null | undefined): "gold" | "fin" {
  return String(row?.regime ?? "") === "fin" ? "fin" : "gold";
}

/** O perfil decide o regime: comercial → Gold, financiada → Fin; os restantes escolhem. */
export function regimeDoPedido(role: string | undefined, pedido?: string): "gold" | "fin" {
  if (role === "financiada") return "fin";
  if (role === "comercial") return "gold";
  return pedido === "fin" ? "fin" : "gold";
}

export function staffValida(role: string | undefined) {
  return role === "admin" || role === "secretaria" || role === "financiada";
}

export async function leadMapeado(db: Db, id: number) {
  const row = await leads.leadComEtiqueta(db, id);
  return row ? mapPreinscricao(row) : null;
}

/** Pré-inscrição completa (NIF e morada) passa sozinha à secretaria. */
export async function entregarSeCompleto(db: Db, id: number, actorId: string) {
  const mapped = await leadMapeado(db, id);
  if (!mapped || mapped.secretariaEm || !estadoPodeEntregar(mapped.estado) || camposEmFalta(mapped).length) return mapped;
  await leads.entregarASecretaria(db, id, true);
  await logLeadEvent(db, id, actorId, "estado", "Entregue à secretaria", "Pré-inscrição completa - passou automaticamente à secretaria.");
  return (await leadMapeado(db, id)) ?? mapped;
}

/** Pré-inscrição registada pela equipa (telefone, balcão, email). */
export async function criarLeadManual(db: Db, actor: Actor, d: DadosLead) {
  const telf = (d.telf ?? "").trim();
  const email = (d.email ?? "").trim() ? normalizeEmail(d.email!) : "";
  if (!telf && !email) throw new CrmErro("indique telemóvel ou email");
  if (email && !isEmail(email)) throw new CrmErro("email inválido");
  const dups = await findDuplicados(db, email, telf, 0, actor);
  const id = await nextOpsId(db);
  const regime = regimeDoPedido(actor.role, d.regime);
  // O comercial só cria pré-inscrições suas (a mesma regra que o RLS impõe na escrita).
  const comercialId = actor.role === "comercial" ? actor.id : d.comercialId ?? (actor.role === "financiada" ? actor.id : null);
  const curso = d.curso ?? "";
  const precoOferta = regime === "fin" || !curso ? null : await precoParaOferta(db, curso, d.local || "", d.horario || "");
  const origem = await origemDaLista(db, d.origem ?? "", "Telefone");
  const campanha = await campanhaDoPedido(db, { campanhaId: d.campanhaId, campanha: d.campanha });
  const pii = writePreinscricaoPii({ nif: d.nif, moradaFiscal: d.moradaFiscal, codigoPostal: d.codigoPostal, telf });
  await escrita.inserirLead(db, {
    id, inscrito: nowStamp(), nome: d.nome ?? "", apelido: d.apelido ?? "", email, telf: pii.telf || telf,
    inicioCurso: d.inicioCurso || "-", concelho: d.concelho ?? "", local: d.local ?? "", curso,
    preco: precoOferta ?? d.preco ?? 0, estado: d.estado || "Não contactado",
    campanha: campanha.campanha, campanhaId: campanha.campanhaId, origem, entrada: "manual",
    meioContacto: d.meioContacto || origem, horario: d.horario ?? "", turmaId: d.turmaId ?? null,
    pagamentoMetodo: d.pagamentoMetodo ?? "", regime, piiEnc: pii.pii_enc ?? "", publicId: newPublicId(),
    comercialId, etiquetaId: d.etiquetaId ?? null,
    nif: pii.nif ?? "", moradaFiscal: pii.morada_fiscal ?? "", codigoPostal: pii.codigo_postal ?? "",
  });
  await firePreinscricaoEmail(db, { id, email, nome: d.nome ?? "", apelido: d.apelido, curso }, "preinscricao.created", `preinscricao:${id}:${email}`)
    .catch(() => undefined);
  await logLeadEvent(db, id, actor.id, "criacao", "Pré-inscrição manual criada", `${origem} · ${curso}`);
  const nota = (d.nota ?? "").trim();
  if (nota) await addLeadNota(db, id, actor.id, nota, d.meioContacto || origem);
  return { preinscricao: (await leadMapeado(db, id)) ?? { id }, duplicados: dups };
}

/** Editar a ficha no CRM, com as regras de mudança de etapa. */
export async function actualizarLeadCrm(db: Db, actor: Actor, id: number, d: DadosLead) {
  const before = await leads.lead(db, id);
  if (!before) throw new CrmErro("pré-inscrição inexistente", 404);
  const regime = regimeDaLinha(before);
  if (d.email && !isEmail(normalizeEmail(d.email))) throw new CrmErro("email inválido");
  if (d.turmaId) {
    const t = await leads.cursoDaTurma(db, regime, d.turmaId);
    const cursoLead = String(d.curso ?? before.curso ?? "");
    if (!t || String(t.curso ?? "").trim().toLowerCase() !== cursoLead.trim().toLowerCase()) {
      throw new CrmErro("A turma não existe ou é de outro curso.");
    }
  }
  if (regime !== "fin" && (d.curso !== undefined || d.local !== undefined || d.horario !== undefined || d.preco !== undefined)) {
    const curso = d.curso ?? String(before.curso ?? "");
    const resolved = curso ? await precoParaOferta(db, curso, d.local ?? String(before.local ?? ""), d.horario ?? String(before.horario ?? "")) : null;
    if (resolved != null) d.preco = resolved;
  }
  const estadoAntes = String(before.estado);
  if (d.estado && d.estado !== estadoAntes) {
    const gate = podeArrastar(estadoAntes, d.estado, {
      role: actor.role,
      secretariaEm: before.secretaria_em ? String(before.secretaria_em) : null,
      motivo: d.motivoDesistencia,
      regime,
    });
    if (!gate.ok) throw new CrmErro(gate.erro ?? "Mudança de etapa não permitida.", 409);
    if (d.estado === "Desistiu" && !(d.motivoDesistencia || String(before.motivo_desistencia ?? ""))) {
      throw new CrmErro("indique o motivo da desistência");
    }
    if (d.estado === "Formando" && actor.role === "comercial") throw new CrmErro("Só a secretaria inscreve na turma.", 409);
  }
  if (actor.role === "comercial" && d.comercialId && d.comercialId !== actor.id) throw new CrmErro("O comercial não passa pré-inscrições a outra pessoa.", 403);
  const prev = readPreinscricaoPii(before);
  const mudaPii = d.nif !== undefined || d.moradaFiscal !== undefined || d.codigoPostal !== undefined || d.telf !== undefined;
  const pii = mudaPii
    ? writePreinscricaoPii({
      nif: d.nif !== undefined ? d.nif.replace(/\s/g, "") : prev.nif,
      moradaFiscal: d.moradaFiscal ?? prev.moradaFiscal,
      codigoPostal: d.codigoPostal ?? prev.codigoPostal,
      telf: d.telf ?? prev.telf,
    })
    : null;
  const origem = d.origem !== undefined ? await origemDaLista(db, d.origem, String(before.origem ?? "Outro")) : undefined;
  const campanha = d.campanhaId !== undefined || d.campanha !== undefined
    ? await campanhaDoPedido(db, { campanhaId: d.campanhaId, campanha: d.campanha })
    : null;
  await escrita.actualizarLead(db, id, {
    nome: d.nome, apelido: d.apelido, email: d.email ? normalizeEmail(d.email) : undefined,
    telf: pii ? pii.telf : d.telf, concelho: d.concelho, origem, curso: d.curso, local: d.local,
    inicioCurso: d.inicioCurso, preco: d.preco, campanha: campanha?.campanha, campanhaId: campanha ? campanha.campanhaId : undefined,
    estado: d.estado, proximoContacto: d.proximoContacto, notas: d.notas, comercialId: d.comercialId ?? undefined,
    meioContacto: d.meioContacto, etiquetaId: d.etiquetaId, horario: d.horario, turmaId: d.turmaId,
    nif: pii ? pii.nif : d.nif?.replace(/\s/g, ""), moradaFiscal: pii ? pii.morada_fiscal : d.moradaFiscal,
    codigoPostal: pii ? pii.codigo_postal : d.codigoPostal, motivoDesistencia: d.motivoDesistencia,
    pagamentoMetodo: d.pagamentoMetodo, piiEnc: pii?.pii_enc ?? undefined, publicId: newPublicId(),
  });
  if (d.estado && d.estado !== estadoAntes) await logLeadEvent(db, id, actor.id, "estado", `Passou a ${d.estado}`, `De ${estadoAntes}`);
  if (d.proximoContacto && d.proximoContacto !== String(before.proximo_contacto ?? "")) {
    await logLeadEvent(db, id, actor.id, "seguimento", "Próximo contacto", d.proximoContacto);
  }
  if (d.estado === "Pré-inscrição" && estadoAntes !== "Pré-inscrição") await notificarDocumentos(db, id, actor.id).catch(() => undefined);
  if (d.estado === "Formando") {
    const depois = await leads.lead(db, id);
    const turmaId = d.turmaId || Number(depois?.turma_id) || Number(before.turma_escolhida_id) || 0;
    if (turmaId) await moverDocsDoLead(db, id, turmaId).catch(() => undefined);
  }
  const pagoManual = d.estado === "Pago" && estadoAntes !== "Pago";
  if (pagoManual) await marcarLeadPago(db, id);
  return { preinscricao: await entregarSeCompleto(db, id, actor.id), pagoManual };
}

/** Regista o contacto: «Não contactado» passa a «1º Contacto». */
export async function contactarLead(db: Db, actor: Actor, id: number, nota: string, meio: string) {
  const current = await leads.lead(db, id);
  if (!current) throw new CrmErro("pré-inscrição inexistente", 404);
  const estado = String(current.estado);
  const nextEstado = estado === "Não contactado" ? "1º Contacto" : estado;
  await leads.registarContacto(db, id, nextEstado, nota, meio);
  await leads.inserirContacto(db, { leadId: id, actorId: actor.id, nota, meio });
  await logLeadEvent(db, id, actor.id, "contacto", meio ? `Contacto · ${meio}` : (nextEstado === estado ? "Contacto registado" : "1.º contacto"), nota || `Passou a ${nextEstado}`);
  const email = normalizeEmail(String(current.email ?? ""));
  if (isEmail(email)) {
    await ingestEvent(db, "preinscricao.contacted", {
      email, nome: `${current.nome} ${current.apelido}`.trim(), curso: String(current.curso ?? ""), preinscricaoId: id,
    }, `contacted:${id}:${email}`).catch(() => undefined);
  }
  return leadMapeado(db, id);
}

export type AccaoLote = {
  ids: number[];
  acao: "contactar" | "estado" | "seguimento" | "atribuir" | "etiqueta" | "adiar";
  estado?: string; proximoContacto?: string; nota?: string; comercialId?: string; etiquetaId?: number | null; dias?: number;
  motivoDesistencia?: string;
};

/**
 * Acções em lote. Devolve quantas pré-inscrições mudaram.
 * «Pago» não se faz em lote: confirma dinheiro recebido, um a um, com o comprovativo.
 */
export async function aplicarLote(db: Db, actor: Actor, d: AccaoLote) {
  if (d.acao === "estado" && d.estado === "Pago") throw new CrmErro("«Pago» não se marca em lote: confirme cada pagamento na ficha.", 409);
  if (d.acao === "estado" && d.estado === "Desistiu" && !(d.motivoDesistencia ?? "").trim()) throw new CrmErro("indique o motivo da desistência");
  if (d.acao === "atribuir" && actor.role === "comercial" && d.comercialId !== actor.id) throw new CrmErro("O comercial não passa pré-inscrições a outra pessoa.", 403);
  let updated = 0;
  for (const id of d.ids) {
    const current = await leads.lead(db, id);
    if (!current || !(await linhaVisivel(db, "preinscricoes", id, actor))) continue;
    const nota = (d.nota ?? "").trim();
    if (d.acao === "contactar") {
      const nextEstado = String(current.estado) === "Não contactado" ? "1º Contacto" : String(current.estado);
      await leads.registarContacto(db, id, nextEstado, nota);
      await leads.inserirContacto(db, { leadId: id, actorId: actor.id, nota });
      await logLeadEvent(db, id, actor.id, "contacto", "Contacto em lote", nota || `Passou a ${nextEstado}`);
    } else if (d.acao === "estado" && d.estado) {
      // As mesmas regras da ficha (etapas, motivo, ligação pessoal ao passar a Pré-inscrição); a que não pode, fica.
      if (d.estado === String(current.estado)) continue;
      try {
        await actualizarLeadCrm(db, actor, id, { estado: d.estado, motivoDesistencia: d.motivoDesistencia });
      } catch (err) {
        if (err instanceof CrmErro) continue;
        throw err;
      }
    } else if (d.acao === "seguimento") {
      await leads.agendarSeguimento(db, id, d.proximoContacto ?? null, nota);
      await logLeadEvent(db, id, actor.id, "seguimento", "Seguimento em lote", d.proximoContacto ? `Próximo contacto ${d.proximoContacto}` : nota);
    } else if (d.acao === "atribuir" && d.comercialId) {
      await leads.atribuirComercial(db, id, d.comercialId);
      await logLeadEvent(db, id, actor.id, "estado", "Comercial atribuído", d.comercialId);
    } else if (d.acao === "etiqueta") {
      await leads.marcarEtiqueta(db, id, d.etiquetaId ?? null);
    } else if (d.acao === "adiar") {
      const dias = d.dias ?? 2;
      const base = String(current.proximo_contacto || "").slice(0, 10);
      const start = /^\d{4}-\d{2}-\d{2}$/.test(base) && base >= new Date().toISOString().slice(0, 10) ? new Date(`${base}T12:00:00`) : new Date();
      start.setDate(start.getDate() + dias);
      const next = start.toISOString().slice(0, 10);
      await leads.definirProximoContacto(db, id, next);
      await logLeadEvent(db, id, actor.id, "seguimento", `Adiado ${dias} dias`, next);
    } else continue;
    updated += 1;
  }
  return { updated };
}

/** Apaga a pré-inscrição e os ficheiros na Drive. Validadas só o admin apaga. */
export async function apagarLead(db: Db, actor: Actor, id: number) {
  const antes = await leads.lead(db, id);
  if (!antes) throw new CrmErro("pré-inscrição inexistente", 404);
  if ((antes.validada_em || antes.estado === "Formando") && actor.role !== "admin") {
    throw new CrmErro("Uma pré-inscrição validada não se apaga. Marque-a como Desistiu.", 409);
  }
  const ficheiros = await listarDocsLead(db, id);
  for (const f of ficheiros) {
    if (f.drive_file_id) await apagarFicheiroSubstituido(db, f.drive_file_id).catch(() => undefined);
  }
  await leads.apagar(db, id);
  return {
    nome: `${antes.nome ?? ""} ${antes.apelido ?? ""}`.trim(), curso: antes.curso, estado: antes.estado, ficheiros: ficheiros.length,
  };
}

/** Etapas do funil que passam a «Pré-inscrição» ao completar (as seguintes e as fechadas ficam). */
const ANTES_DA_PREINSCRICAO = ["Não contactado", "1º Contacto", "2º Contacto"];

/** Completar a pré-inscrição (NIF e morada fiscal) e entregá-la à secretaria. */
export async function completarLead(db: Db, actor: Actor, id: number, d: DadosLead) {
  const before = await leads.lead(db, id);
  if (!before) throw new CrmErro("pré-inscrição inexistente", 404);
  const email = (d.email ?? "").trim() ? normalizeEmail(d.email!) : "";
  if (email && !isEmail(email)) throw new CrmErro("email inválido");
  const texto = (v: string | undefined) => (v ?? "").trim();
  // Mesmo caminho do PATCH: junta com a PII guardada (cifrada ou legada) e cifra de novo.
  const prev = readPreinscricaoPii(before);
  const junta = {
    nif: texto(d.nif).replace(/\s/g, "") || prev.nif, moradaFiscal: texto(d.moradaFiscal) || prev.moradaFiscal,
    codigoPostal: texto(d.codigoPostal) || prev.codigoPostal, telf: texto(d.telf) || prev.telf,
  };
  const simples = { nome: texto(d.nome), apelido: texto(d.apelido), email, concelho: texto(d.concelho), curso: texto(d.curso),
    local: texto(d.local), horario: texto(d.horario), inicioCurso: texto(d.inicioCurso) };
  const atual = mapPreinscricao(before);
  const candidato = { ...atual, ...Object.fromEntries(Object.entries(simples).filter(([, v]) => v)), ...junta };
  const falta = camposEmFalta(candidato);
  if (falta.length) throw new CrmErro(`Falta: ${falta.map(f => f.label).join(", ")}`, 400, { falta: falta.map(f => f.key) });
  const pii = writePreinscricaoPii(junta);
  await escrita.completarLead(db, id, {
    ...simples, telf: pii.telf, nif: pii.nif, moradaFiscal: pii.morada_fiscal, codigoPostal: pii.codigo_postal, piiEnc: pii.pii_enc,
    preInscricao: ANTES_DA_PREINSCRICAO.includes(String(before.estado)),
  });
  const mapped = await leadMapeado(db, id);
  if (!mapped) throw new CrmErro("pré-inscrição inexistente", 404);
  if (!mapped.secretariaEm) {
    await leads.entregarASecretaria(db, id, false);
    await logLeadEvent(db, id, actor.id, "estado", "Entregue à secretaria", "Pré-inscrição completa (NIF e morada fiscal).");
  }
  // A ligação pessoal só segue na etapa «Pré-inscrição» (as automações do email fariam avançar uma inscrição já paga).
  if (mapped.estado === "Pré-inscrição") await notificarDocumentos(db, id, actor.id).catch(() => undefined);
}
