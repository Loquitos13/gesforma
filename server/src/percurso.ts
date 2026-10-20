import type { Db } from "./db/pool.js";
import { COMPROVATIVO, docsCompletos, docsDoCurso, ficheiroModelo, situacaoPagamento } from "./docsCurso.js";
import { lerEntidade } from "./regrasConfig.js";
import { avisarDocumentosEmFalta, listarDocsLead } from "./docsLink.js";
import { idsRecusados } from "./lembretePre.js";
import { modulosPorOrdem, sessoesPublicas } from "./cronogramaPublico.js";
import { precoParaOferta } from "./precoOferta.js";
import * as dossie from "./repos/leadDossier.js";
import * as docsRepo from "./repos/leadDocs.js";
import * as leads from "./repos/leads.js";
import * as repo from "./repos/percurso.js";
import type { TurmaPercursoRow } from "./repos/percurso.js";
import { hojeLisboa } from "./datas.js";

export {
  enviarSugestaoTurmaCheia, ligarPreinscricaoAoFormandoGold, moverDocsDoLead, moverDocsParaTurma, validarPreinscricao,
} from "./percursoValidacao.js";

export class PercursoErro extends Error {}

export type SessaoPublica = {
  data: string;
  inicio: string;
  fim: string;
  modalidade: string;
  modulos: string[];
  formadores: string[];
};

export type PlanoPublico = {
  id: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  modalidade: string;
  modulos: string[];
  formadores: string[];
};

export type TurmaPublica = {
  id: number;
  nome: string;
  local: string;
  horario: string;
  dataInicio: string;
  livres: number;
  /** As vagas que a página mostra (anunciadas pelo comercial, nunca acima das livres). */
  vagasMostradas: number;
  sessoes: SessaoPublica[];
  plano: PlanoPublico[];
};

export type PedidoTurma = { local?: string; horario?: string; inicio?: string };

export function norm(v: string) {
  return v.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function pedidoUtil(v: string | undefined) {
  const n = norm(v ?? "");
  return Boolean(n) && n !== "-" && !n.startsWith("a definir") && !n.startsWith("por definir");
}

function servePedido(t: TurmaPublica, pedido?: PedidoTurma) {
  if (!pedido) return true;
  if (pedidoUtil(pedido.local) && norm(t.local) !== norm(pedido.local ?? "")) return false;
  if (pedidoUtil(pedido.horario) && norm(t.horario) !== norm(pedido.horario ?? "")) return false;
  const inicio = isoData(pedido.inicio ?? "");
  if (inicio && isoData(t.dataInicio) !== inicio) return false;
  return true;
}

function hojeIso() {
  return hojeLisboa();
}

function isoData(raw: string) {
  const s = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  return "";
}

function sessoesDe(raw: unknown): SessaoPublica[] {
  return sessoesPublicas(raw)
    .filter(s => s.modalidade !== "matricula" && s.data)
    .map(s => ({
      data: s.data,
      inicio: s.horaInicio,
      fim: s.horaFim,
      modalidade: s.modalidade,
      modulos: modulosPorOrdem(s.modulos),
      formadores: s.formadores,
    }));
}

function planoDe(raw: unknown): PlanoPublico[] {
  return sessoesPublicas(raw).map((s, i) => ({
    id: `p${i}`,
    data: s.data,
    horaInicio: s.horaInicio,
    horaFim: s.horaFim,
    modalidade: s.modalidade,
    modulos: modulosPorOrdem(s.modulos),
    formadores: s.formadores,
  }));
}

function turmaActiva(regime: "gold" | "fin", row: TurmaPercursoRow) {
  if (row.fechada_em) return false;
  if (regime === "fin") return row.activa !== false && row.estado !== "Inativa" && row.estado !== "Cancelada" && row.estado !== "Concluída";
  return row.estado === "Ativa" || row.estado === "Ativo";
}

/** Uma turma que já começou deixa de aparecer na escolha pública. */
function aindaNaoComecou(row: TurmaPercursoRow) {
  const inicio = isoData(String(row.data_inicio ?? ""));
  return !inicio || inicio >= hojeIso();
}

function mapTurma(row: TurmaPercursoRow): TurmaPublica {
  const limite = Number(row.vagas) + Math.max(0, Number(row.tolerancia) || 0);
  const livres = Math.max(0, limite - Number(row.ocupadas));
  return {
    id: Number(row.id),
    nome: row.nome,
    local: row.local,
    horario: row.horario,
    dataInicio: isoData(row.data_inicio) || row.data_inicio,
    livres,
    vagasMostradas: row.vagas_anunciadas == null ? livres : Math.min(Math.max(0, Number(row.vagas_anunciadas)), livres),
    sessoes: sessoesDe(row.cronograma),
    plano: planoDe(row.cronograma),
  };
}

async function turmasRegime(db: Db, regime: "gold" | "fin", curso: string) {
  const rows = await repo.turmasDoCurso(db, regime, curso);
  return rows.filter(r => turmaActiva(regime, r) && aindaNaoComecou(r)).map(mapTurma);
}

export async function turmasParaEscolha(db: Db, curso: string, regime: "gold" | "fin", pedido?: PedidoTurma) {
  const hoje = hojeIso();
  const lista = (await turmasRegime(db, regime, curso)).filter(t => t.livres > 0 && servePedido(t, pedido));
  return lista.sort((a, b) => {
    const af = a.dataInicio >= hoje ? 0 : 1;
    const bf = b.dataInicio >= hoje ? 0 : 1;
    if (af !== bf) return af - bf;
    return a.dataInicio.localeCompare(b.dataInicio) || a.nome.localeCompare(b.nome);
  });
}

/** Outro horário, no mesmo curso e no mesmo local, com vagas restantes. */
export async function recomendacoesOutroHorario(
  db: Db,
  curso: string,
  regime: "gold" | "fin",
  pedido: PedidoTurma | undefined,
  exceptoIds: number[],
) {
  if (!pedidoUtil(pedido?.local) || !pedidoUtil(pedido?.horario)) return [];
  const hoje = hojeIso();
  const sitio = norm(pedido?.local ?? "");
  const hora = norm(pedido?.horario ?? "");
  const fora = new Set(exceptoIds);
  const vistos = new Set<string>();
  const lista = (await turmasRegime(db, regime, curso))
    .filter(t => t.livres > 0 && !fora.has(t.id) && norm(t.local) === sitio && t.dataInicio >= hoje)
    .filter(t => norm(t.horario) !== hora)
    .sort((a, b) => a.dataInicio.localeCompare(b.dataInicio) || a.nome.localeCompare(b.nome, "pt"));
  const out: TurmaPublica[] = [];
  for (const t of lista) {
    const chave = norm(t.horario);
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    out.push(t);
    if (out.length >= 3) break;
  }
  return out;
}

/** Mesmo curso, local e horário, com início posterior ao pedido. */
export async function turmasParaBreve(
  db: Db,
  curso: string,
  regime: "gold" | "fin",
  pedido: PedidoTurma | undefined,
  exceptoIds: number[],
) {
  if (!pedidoUtil(pedido?.local) || !pedidoUtil(pedido?.horario)) return [];
  const hoje = hojeIso();
  const sitio = norm(pedido?.local ?? "");
  const hora = norm(pedido?.horario ?? "");
  const fora = new Set(exceptoIds);
  const inicio = isoData(pedido?.inicio ?? "");
  const lista = (await turmasRegime(db, regime, curso))
    .filter(t => t.livres > 0 && !fora.has(t.id) && norm(t.local) === sitio && norm(t.horario) === hora && t.dataInicio >= hoje)
    .filter(t => (inicio ? t.dataInicio > inicio : true))
    .sort((a, b) => a.dataInicio.localeCompare(b.dataInicio) || a.nome.localeCompare(b.nome, "pt"));
  return lista.slice(0, 3);
}

/** Próximas turmas do mesmo curso e do mesmo local, no mesmo horário ou noutro. */
export async function sugestoesTurmaCheia(
  db: Db,
  curso: string,
  regime: "gold" | "fin",
  local: string,
  horario: string,
  exceptoId = 0,
) {
  const hoje = hojeIso();
  const sitio = norm(local);
  const hora = norm(horario);
  return (await turmasRegime(db, regime, curso))
    .filter(t => t.id !== exceptoId && t.livres > 0 && norm(t.local) === sitio && t.dataInicio >= hoje)
    .sort((a, b) => {
      const ah = norm(a.horario) === hora ? 0 : 1;
      const bh = norm(b.horario) === hora ? 0 : 1;
      if (ah !== bh) return ah - bh;
      return a.dataInicio.localeCompare(b.dataInicio);
    });
}

/** Turmas activas do curso onde a secretaria pode colocar a pessoa ao validar (também as já começadas). */
export async function turmasParaValidacao(db: Db, regime: "gold" | "fin", curso: string) {
  const rows = await repo.turmasDoCurso(db, regime, curso);
  return rows.filter(r => turmaActiva(regime, r)).map(r => {
    const t = mapTurma(r);
    return { id: t.id, nome: t.nome, local: t.local, horario: t.horario, dataInicio: t.dataInicio, livres: t.livres };
  });
}

/** Turma activa por id (com vagas livres já a descontar reservas). */
export async function turmaPorId(db: Db, regime: "gold" | "fin", id: number) {
  const found = await repo.turmaPorId(db, regime, id);
  if (!found || !turmaActiva(regime, found)) return null;
  return mapTurma(found);
}

export function regimeDe(raw: unknown): "gold" | "fin" {
  return String(raw ?? "") === "fin" ? "fin" : "gold";
}

export async function evento(db: Db, leadId: number, actorId: string | undefined, titulo: string, detalhe = "") {
  await dossie.inserirEvento(db, { leadId, actorId, tipo: "campo", titulo, detalhe });
}

export async function escolherTurmaPublica(db: Db, leadId: number, turmaId: number) {
  const row = await leads.lead(db, leadId);
  if (!row) throw new PercursoErro("Pré-inscrição inexistente.");
  if (row.validada_em) throw new PercursoErro("A secretaria já validou esta pré-inscrição.");
  const regime = regimeDe(row.regime);
  if (regime === "fin") throw new PercursoErro("Na formação financiada a turma é atribuída pela secretaria.");
  // Com o pagamento pedido (ou já pago) o valor é o desta turma: mudar daqui pagaria o preço da anterior.
  if (row.pagamento_pedido_em || /^(pendente|pago)$/i.test(await repo.estadoPagamentoLigado(db, leadId))) {
    throw new PercursoErro("O pagamento desta inscrição já foi pedido para a turma escolhida. Para mudar de turma, contacte a secretaria.");
  }
  const turma = await turmaPorId(db, regime, turmaId);
  if (!turma) throw new PercursoErro("Turma indisponível.");
  const pedido = {
    local: String(row.local ?? ""),
    horario: String(row.horario ?? ""),
    inicio: String(row.inicio_curso ?? ""),
  };
  const curso = String(row.curso ?? "");
  const oferecidas = await turmasParaEscolha(db, curso, regime, pedido);
  const recomendadas = await recomendacoesOutroHorario(db, curso, regime, pedido, oferecidas.map(t => t.id));
  const breves = await turmasParaBreve(db, curso, regime, pedido, [...oferecidas, ...recomendadas].map(t => t.id));
  const recusadas = new Set(idsRecusados(row.turmas_recusadas));
  if (recusadas.has(turmaId)) throw new PercursoErro("Essa turma foi dada como cheia pela secretaria. Escolha outra.");
  const escolhida = oferecidas.find(t => t.id === turmaId)
    ?? recomendadas.find(t => t.id === turmaId)
    ?? breves.find(t => t.id === turmaId);
  if (!escolhida || recusadas.has(escolhida.id)) throw new PercursoErro("Essa turma não tem vaga ou não é deste curso.");
  const preco = regime === "gold" ? await precoParaOferta(db, curso, escolhida.local, escolhida.horario) : null;
  await repo.gravarTurmaEscolhida(db, leadId, { ...escolhida, preco });
  await evento(db, leadId, undefined, "Cronograma escolhido", `${escolhida.nome} · ${escolhida.local} · ${escolhida.horario}`);
  return escolhida;
}

function entregueAceite(estado: string | undefined) {
  return Boolean(estado) && estado !== "recusado";
}

export async function concluirPercurso(db: Db, leadId: number) {
  const row = await leads.lead(db, leadId);
  if (!row) throw new PercursoErro("Pré-inscrição inexistente.");
  if (row.validada_em) throw new PercursoErro("A secretaria já validou esta pré-inscrição.");
  const regime = regimeDe(row.regime);
  // Concluir o percurso é documentos + turma; o pagamento vem depois, pedido pela secretaria.
  const pedidos = await docsDoCurso(db, String(row.curso ?? ""), regime);
  const ficheiros = await listarDocsLead(db, leadId);
  const by = new Map(ficheiros.map(f => [f.tipo, f]));
  const emFalta = pedidos.filter(d => d.required && !entregueAceite(by.get(d.id)?.estado)).map(d => {
    const ficheiro = by.get(d.id);
    return { label: d.label, recusado: ficheiro?.estado === "recusado", observacao: ficheiro?.observacao ?? "" };
  });
  if (!row.turma_escolhida_id && regime !== "fin") throw new PercursoErro("Escolha o cronograma antes de concluir.");
  if (!row.percurso_concluido_em) {
    await repo.marcarConcluido(db, leadId);
    let avisou = false;
    if (emFalta.length) {
      const aviso = await avisarDocumentosEmFalta(db, leadId, emFalta).catch(() => null);
      avisou = Boolean(aviso && "enviado" in aviso && aviso.enviado);
    }
    await evento(db, leadId, undefined, "Percurso de pré-inscrição concluído",
      avisou ? "Aguarda validação. Email com os documentos em falta." : "Aguarda validação da secretaria");
  }
  return { ok: true as const, emFalta: emFalta.filter(d => !d.recusado).map(d => d.label) };
}

type Ficheiro = { id: number; tipo: string; nome: string; created_at: string; estado: string; observacao: string };

export async function vistaDocumentosPublica(db: Db, lead: Record<string, unknown>) {
  const id = Number(lead.id);
  const regime = regimeDe(lead.regime);
  const curso = String(lead.curso ?? "");
  const pag = await situacaoPagamento(db, lead);
  const pedidos = await docsDoCurso(db, curso, regime);
  const docs = await listarDocsLead(db, id) as Ficheiro[];
  const { ok, emFalta } = docsCompletos(pedidos, docs.map(d => d.tipo));
  // O passo de pagamento só abre depois de a secretaria validar os documentos e pedir o pagamento.
  let pagamento: { valor: number; estado: string; iban: string; titular: string; comprovativo: Ficheiro | null } | null = null;
  if ((pag.estado === "pedido" || pag.estado === "pago") && lead.pagamento_id) {
    const r = await repo.valorEstadoPagamento(db, String(lead.pagamento_id));
    const ent = await lerEntidade(db);
    pagamento = {
      valor: Number(r?.valor ?? lead.preco) || 0,
      estado: String(r?.estado ?? "Pendente"),
      iban: ent.iban.replace(/(.{4})/g, "$1 ").trim(),
      titular: ent.titularConta || ent.nome,
      comprovativo: docs.find(d => d.tipo === COMPROVATIVO.id) ?? null,
    };
  }
  const turmaId = Number(lead.turma_escolhida_id || 0);
  const criterios = {
    local: String(lead.local ?? ""),
    horario: String(lead.horario ?? ""),
    inicio: String(lead.inicio_curso ?? ""),
  };
  const recusadas = new Set(idsRecusados(lead.turmas_recusadas));
  // Financiada: a pessoa só envia documentos; a turma é atribuída pela secretaria.
  const escolheTurma = regime !== "fin";
  const turmas = escolheTurma ? (await turmasParaEscolha(db, curso, regime, criterios)).filter(t => !recusadas.has(t.id)) : [];
  const recomendadas = escolheTurma ? (await recomendacoesOutroHorario(db, curso, regime, criterios, turmas.map(t => t.id))).filter(t => !recusadas.has(t.id)) : [];
  const breves = escolheTurma ? (await turmasParaBreve(db, curso, regime, criterios, [...turmas, ...recomendadas].map(t => t.id))).filter(t => !recusadas.has(t.id)) : [];
  const turmaBruta = turmaId && !recusadas.has(turmaId)
    ? turmas.find(t => t.id === turmaId) ?? await turmaPorId(db, regime, turmaId)
    : null;
  const turmaEscolhida = turmaBruta && recusadas.has(turmaBruta.id) ? null : turmaBruta;
  const recusados = docs.filter(d => d.estado === "recusado" && d.tipo !== COMPROVATIVO.id);
  const encerrada = Boolean(lead.validada_em);
  const percursoConcluido = Boolean(lead.percurso_concluido_em) && (Boolean(turmaEscolhida) || !escolheTurma) && recusados.length === 0;
  return {
    nome: `${lead.nome ?? ""} ${lead.apelido ?? ""}`.trim(),
    curso,
    preco: Number(lead.preco) || 0,
    tipos: pedidos,
    ficheiros: docs.map(d => ({
      id: d.id, tipo: d.tipo, nome: d.nome, created_at: d.created_at,
      estado: d.estado, observacao: d.observacao,
    })),
    docsCompletos: ok,
    emFalta: emFalta.map(d => d.label),
    pagamento,
    /** Passo de pagamento aberto: a secretaria pediu o pagamento e ainda não está confirmado. */
    precisaPagamento: pag.estado === "pedido",
    pago: pag.pago,
    encerrada,
    correcao: !encerrada && recusados.length > 0,
    passo: (turmaEscolhida ? 2 : 1) as 1 | 2,
    percursoConcluido,
    escolheTurma,
    turmas,
    recomendadas,
    breves,
    turmaEscolhida,
    turmaCheia: recusadas.size > 0 && !turmaEscolhida,
    criterios: {
      local: pedidoUtil(criterios.local) ? criterios.local : "",
      horario: pedidoUtil(criterios.horario) ? criterios.horario : "",
      inicio: isoData(criterios.inicio),
    },
  };
}

export async function registarConsentimento(db: Db, leadId: number, tipo: string, meta: { ip?: string } = {}) {
  const row = await leads.lead(db, leadId);
  if (!row) throw new PercursoErro("Pré-inscrição inexistente.");
  if (row.validada_em) throw new PercursoErro("A secretaria já validou esta pré-inscrição.");
  const regime = regimeDe(row.regime);
  const pedidos = await docsDoCurso(db, String(row.curso ?? ""), regime);
  const pedido = pedidos.find(p => p.id === tipo && p.modelo);
  if (!pedido) throw new PercursoErro("Este documento não está preparado para consentimento.");
  const ja = await docsRepo.estadosDoTipo(db, leadId, tipo);
  if (ja.some(r => r.estado === "validado")) throw new PercursoErro("Este documento já foi validado pela secretaria.");
  // Prova do consentimento: quando, de onde e que versão do modelo (ficheiro da secretaria) foi aceite.
  const modelo = await ficheiroModelo(db, regime, String(row.curso ?? ""), tipo);
  const versao = modelo ? `${modelo.nome} · ${modelo.driveFileId}` : pedido.modelo ?? "";
  await docsRepo.substituirDoc(db, {
    leadId, tipo, nome: `Consentimento · ${pedido.label}`, driveFileId: "", driveUrl: "",
    consentimentoIp: (meta.ip ?? "").slice(0, 64), consentimentoModelo: versao.slice(0, 300),
  });
  await evento(db, leadId, undefined, "Consentimento", `${pedido.label}${versao ? ` · modelo ${versao}` : ""}${meta.ip ? ` · IP ${meta.ip}` : ""}`);
  return { ok: true as const, nome: pedido.label };
}
