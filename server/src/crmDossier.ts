import type { Db } from "./db/pool.js";
import type { AtorCrm, Consulta } from "./repos/sql.js";
import { documentosUrl, docsDoCurso, docsCompletos, ensureDocsToken, listarDocsLead } from "./docsLink.js";
import { faltaPedirPagamento, faltaValidarPreinscricao, situacaoPagamento } from "./docsCurso.js";
import { mapPagamento, mapPreinscricao } from "./ops.js";
import { turmasParaValidacao } from "./percurso.js";
import * as repo from "./repos/leadDossier.js";
import * as leads from "./repos/leads.js";

export type CrmCampoTipo = "texto" | "numero" | "data" | "lista";

function slugify(label: string) {
  const base = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
  return base || `campo_${Date.now().toString(36)}`;
}

function parseOpcoes(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw) as unknown;
      return Array.isArray(p) ? p.map(String).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function iso(v: string | Date | null | undefined) {
  if (!v) return new Date().toISOString();
  return v instanceof Date ? v.toISOString() : String(v);
}

export async function logLeadEvent(
  db: Consulta,
  leadId: number,
  actorId: string | undefined,
  tipo: string,
  titulo: string,
  detalhe = "",
) {
  await repo.inserirEvento(db, { leadId, actorId, tipo, titulo, detalhe });
}

export async function listCrmCampos(db: Db) {
  const rows = await repo.camposActivos(db);
  return rows.map(r => ({
    id: r.id,
    label: r.label,
    chave: r.chave,
    tipo: r.tipo as CrmCampoTipo,
    opcoes: parseOpcoes(r.opcoes),
  }));
}

export async function createCrmCampo(db: Db, label: string, tipo: CrmCampoTipo, opcoes: string[]) {
  const chave = slugify(label);
  const id = await repo.gravarCampo(db, label, chave, tipo, opcoes);
  return { id, label, chave, tipo, opcoes };
}

export async function addLeadNota(db: Db, leadId: number, actorId: string | undefined, nota: string, meio = "", resultado = "") {
  const texto = nota.trim().slice(0, 2000);
  const canal = meio.trim().slice(0, 40);
  const res = resultado.trim().slice(0, 40);
  if (!texto && !res) return;
  const corpo = texto || (res ? `Tentativa · ${res}` : "Contacto registado.");
  await leads.inserirContacto(db, { leadId, actorId, nota: corpo, meio: canal, resultado: res });
  await leads.juntarNota(db, leadId, corpo, canal, res);
  await logLeadEvent(db, leadId, actorId, res ? "contacto" : "nota", canal ? `${res || "Nota"} · ${canal}` : (res || "Nota comercial"), corpo);
}

export async function fixarNota(db: Db, leadId: number, notaId: number, fixada: boolean) {
  await repo.fixarNota(db, leadId, notaId, fixada);
}

export async function findDuplicados(db: Db, email: string, telf: string, exceptId = 0, ator?: AtorCrm) {
  const mail = email.trim().toLowerCase();
  const n9 = telf.replace(/\D/g, "").slice(-9);
  return repo.duplicados(db, mail, n9, exceptId, ator);
}

export async function getLeadDossier(db: Db, id: number, ator?: AtorCrm) {
  const row = await leads.leadComEtiqueta(db, id);
  if (!row) return null;
  const lead = mapPreinscricao(row);
  const campos = await listCrmCampos(db);
  const valores: Record<number, string> = {};
  for (const v of await repo.valoresDosCampos(db, id)) valores[v.campo_id] = v.valor;
  const notas = await repo.notas(db, id);
  const eventos = await repo.eventos(db, id);
  const n9 = String(lead.telf ?? "").replace(/\D/g, "").slice(-9);
  const irmaos = await repo.outrosPedidos(db, id, lead.email, n9, ator);
  const propostas = await repo.propostasDoLead(db, id, lead.email, ator);

  const cliente = lead.estado === "Formando" || lead.estado === "Pago";
  const regime = String(row.regime ?? "gold") === "fin" ? "fin" : "gold";
  const pedidos = await docsDoCurso(db, lead.curso, regime);
  const ficheiros = await listarDocsLead(db, id);
  const labels = new Map(pedidos.map(p => [p.id, p.label]));
  labels.set("comprovativo", "Comprovativo de pagamento");
  const { ok, emFalta } = docsCompletos(pedidos, ficheiros.map(f => f.tipo));
  let docsUrl = "";
  try { docsUrl = documentosUrl(await ensureDocsToken(db, id)); } catch { docsUrl = ""; }
  // Pagamento por transferência com comprovativo: sem referências nem entidade Multibanco.
  let pagamento: { id: string; valor: number; estado: string; metodo: string } | null = null;
  const pagId = String(row.pagamento_id ?? "");
  if (pagId) {
    const pag = await repo.pagamento(db, pagId);
    if (pag) {
      const mapped = mapPagamento(pag);
      pagamento = { id: mapped.id, valor: mapped.valor, estado: mapped.estado, metodo: mapped.metodo };
    }
  }

  return {
    lead,
    cliente,
    papel: cliente ? "cliente" : "potencial",
    campos: campos.map(c => ({ ...c, valor: valores[c.id] ?? "" })),
    notas: notas.map(n => ({
      id: n.id,
      nota: n.nota,
      meio: n.meio || "",
      resultado: n.resultado || "",
      fixada: Boolean(n.fixada),
      createdAt: iso(n.created_at),
      actorName: n.actor_name,
    })),
    eventos: eventos.map(e => ({
      id: e.id,
      tipo: e.tipo,
      titulo: e.titulo,
      detalhe: e.detalhe,
      createdAt: iso(e.created_at),
      actorName: e.actor_name,
    })),
    outrosPedidos: irmaos.map(r => mapPreinscricao(r)),
    propostas: propostas.map(p => ({
      id: p.id,
      curso: p.curso,
      estado: p.estado,
      valor: Number(p.valor) || 0,
      enviadaEm: p.enviada_em ? iso(p.enviada_em) : "",
    })),
    consentimento: {
      em: row.consentimento_em ? iso(row.consentimento_em as string | Date) : null,
      ip: String(row.consentimento_ip ?? ""),
      versao: String(row.consentimento_versao ?? ""),
    },
    docsUrl,
    docsCompletos: ok,
    docsEmFalta: emFalta.map(d => d.label),
    documentos: ficheiros.map(f => ({
      id: f.id,
      tipo: f.tipo,
      label: labels.get(f.tipo) ?? f.tipo,
      nome: f.nome,
      url: f.drive_url || (f.drive_file_id ? `/api/v1/drive/files/${f.drive_file_id}/content` : ""),
      createdAt: iso(f.created_at),
      estado: f.estado || "pendente",
      observacao: f.observacao || "",
    })),
    docsFechado: Boolean(row.validada_em),
    pagamento,
    /** Turmas activas do mesmo curso, com vagas (validação e inscrição). */
    turmasDestino: lead.curso ? await turmasParaValidacao(db, regime, lead.curso) : [],
    ...(await resumoPercurso(db, row, regime, pedidos, ficheiros)),
  };
}

async function resumoPercurso(
  db: Db,
  row: Record<string, unknown>,
  regime: "gold" | "fin",
  pedidos: { id: string; label: string; required: boolean }[],
  ficheiros: { tipo: string; estado?: string }[],
) {
  const turmaId = Number(row.turma_escolhida_id || 0);
  let turmaEscolhida: { id: number; nome: string; local: string; horario: string; dataInicio: string; livres: number } | null = null;
  if (turmaId) {
    const t = await repo.turmaEscolhida(db, regime, turmaId);
    if (t) {
      turmaEscolhida = {
        id: t.id,
        nome: t.nome,
        local: t.local,
        horario: t.horario,
        dataInicio: String(t.data_inicio ?? ""),
        livres: Math.max(0, Number(t.vagas) - Number(t.ocupadas)),
      };
    }
  }
  const pagamento = (await situacaoPagamento(db, row)).estado;
  const regras = {
    validada: Boolean(row.validada_em),
    concluido: Boolean(row.percurso_concluido_em),
    turma: turmaEscolhida,
    pedidos,
    ficheiros,
    pagamento,
    turmaPelaSecretaria: regime === "fin",
  };
  const faltaValidar = faltaValidarPreinscricao(regras);
  const faltaPedir = faltaPedirPagamento(regras);
  return {
    percursoConcluido: Boolean(row.percurso_concluido_em),
    validadaEm: row.validada_em ? String(row.validada_em) : null,
    recusaMotivo: String(row.recusa_motivo ?? ""),
    turmaEscolhida,
    podeValidar: faltaValidar === "",
    faltaValidar,
    turmaPelaSecretaria: regime === "fin",
    /** Gold com preço: isento | por_pedir | pedido | pago. */
    estadoPagamento: pagamento,
    pagamentoPedidoEm: row.pagamento_pedido_em ? String(row.pagamento_pedido_em) : null,
    podePedirPagamento: faltaPedir === "",
    faltaPedirPagamento: faltaPedir,
  };
}

export async function setCampoValores(
  db: Db,
  leadId: number,
  actorId: string | undefined,
  valores: { campoId: number; valor: string }[],
) {
  const changed: string[] = [];
  for (const v of valores) {
    const next = v.valor.slice(0, 2000);
    const old = await repo.valorDoCampo(db, leadId, v.campoId);
    if (old === next) continue;
    await repo.gravarValorCampo(db, leadId, v.campoId, next);
    changed.push(`${await repo.rotuloDoCampo(db, v.campoId)}: ${next || "-"}`);
  }
  if (changed.length) {
    await logLeadEvent(db, leadId, actorId, "campo", "Campos actualizados", changed.join(" · "));
  }
}

function normCor(cor: string) {
  const c = cor.trim();
  return /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : "#64748b";
}

export async function listCrmEtiquetas(db: Db) {
  return (await repo.etiquetas(db)).map(r => ({ id: r.id, nome: r.nome, cor: r.cor }));
}

export async function createCrmEtiqueta(db: Db, nome: string, cor: string) {
  return repo.criarEtiqueta(db, nome.trim().slice(0, 40), normCor(cor));
}

export async function deleteCrmEtiqueta(db: Db, id: number) {
  await repo.apagarEtiqueta(db, id);
}
