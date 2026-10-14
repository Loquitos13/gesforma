import type { Db } from "./db/pool.js";
import { comporModelo, DTP_MODELO_VAZIO, parseDtpModelo } from "./dtpModel.js";
import * as repo from "./repos/leadDocs.js";

export type DocPedido = { id: string; label: string; required: boolean; modelo?: string };

const GOLD: DocPedido[] = [
  { id: "cc", label: "Cartão de Cidadão", required: true },
  { id: "contrato", label: "Contrato de formação", required: true },
  { id: "regulamento", label: "Regulamento de formação aceite", required: true },
  { id: "pip", label: "PIP - Projeto de Intervenção Pedagógica", required: false },
  { id: "exp", label: "Comprovativo de 5 anos de experiência", required: false },
];

const FIN: DocPedido[] = [
  { id: "cc", label: "Cartão de Cidadão", required: true },
  { id: "ch", label: "Certificado de habilitações", required: true },
  { id: "cu", label: "Curriculum vitae", required: true },
  { id: "morada", label: "Comprovativo de morada", required: true },
  { id: "ci", label: "IBAN / comprovativo de NIB", required: true },
  { id: "ce", label: "Comprovativo de situação perante o emprego", required: true },
  { id: "contrato", label: "Contrato de formação", required: true },
  { id: "rgpd", label: "Declaração RGPD", required: true },
];

export const COMPROVATIVO: DocPedido = {
  id: "comprovativo",
  label: "Comprovativo de pagamento",
  required: false,
};

/**
 * Estado do pagamento de uma pré-inscrição Gold com preço:
 * `por_pedir` até a secretaria validar os documentos e pedir o pagamento; `pedido` com o passo
 * de pagamento aberto na ligação pessoal; `pago` depois de confirmado. Sem preço ou na Financiada: `isento`.
 */
export type EstadoPagamentoLead = "isento" | "por_pedir" | "pedido" | "pago";

export function estadoPagamentoLead(lead: { regime?: unknown; preco?: unknown; pagamento_pedido_em?: unknown }, pago: boolean): EstadoPagamentoLead {
  if (String(lead.regime ?? "gold") === "fin" || !(Number(lead.preco) > 0)) return "isento";
  if (pago) return "pago";
  return lead.pagamento_pedido_em ? "pedido" : "por_pedir";
}

/** Estado do pagamento da pré-inscrição, lendo o pagamento ligado. */
export async function situacaoPagamento(
  db: Db,
  lead: { regime?: unknown; preco?: unknown; pagamento_id?: unknown; pagamento_pedido_em?: unknown },
) {
  let pago = false;
  if (lead.pagamento_id) {
    pago = /^pago$/i.test(String((await repo.estadoDoPagamento(db, String(lead.pagamento_id))) ?? ""));
  }
  const estado = estadoPagamentoLead(lead, pago);
  // O comprovativo só é pedido com o passo de pagamento aberto.
  return { estado, pago: estado === "pago", pedeComprovativo: estado === "pedido" };
}

export type DocExtraPreinscricao = { id: string; label: string; required: boolean };

export type DocsPreinscricaoCfg = {
  ocultos: string[];
  extra: DocExtraPreinscricao[];
};

const CFG_VAZIA: DocsPreinscricaoCfg = { ocultos: [], extra: [] };

export function cursoPedeDocsPreinscricao(regime: "gold" | "fin", tipo: string) {
  if (regime === "fin") return true;
  const t = tipo.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  return t.includes("pre-inscr") || t.includes("preinscr");
}

export function docsBase(regime: "gold" | "fin"): DocPedido[] {
  return (regime === "fin" ? FIN : GOLD).map(d => ({ ...d }));
}

function parseCfg(raw: unknown): DocsPreinscricaoCfg {
  if (!raw) return CFG_VAZIA;
  const v = typeof raw === "string" ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : raw;
  if (!v || typeof v !== "object") return CFG_VAZIA;
  const row = v as { ocultos?: unknown; extra?: unknown };
  const ocultos = Array.isArray(row.ocultos) ? row.ocultos.map(String) : [];
  const extra = Array.isArray(row.extra)
    ? row.extra.flatMap(item => {
      if (!item || typeof item !== "object") return [];
      const x = item as { id?: unknown; label?: unknown; required?: unknown };
      const id = String(x.id ?? "").trim();
      const label = String(x.label ?? "").trim();
      if (!id || !label) return [];
      return [{ id, label, required: Boolean(x.required) }];
    })
    : [];
  return { ocultos, extra };
}

export async function lerDocsPreinscricao(db: Db, regime: "gold" | "fin", cursoId: number): Promise<DocsPreinscricaoCfg> {
  return parseCfg(await repo.configDocsDoCurso(db, regime, cursoId));
}

export async function gravarDocsPreinscricao(db: Db, regime: "gold" | "fin", cursoId: number, cfg: DocsPreinscricaoCfg) {
  await repo.gravarConfigDocs(db, regime, cursoId, cfg);
}

export async function listarModelosConsentimento(db: Db, regime: "gold" | "fin", cursoId: number) {
  return repo.modelosConsentimento(db, regime, cursoId);
}

export async function limparModelosFora(db: Db, regime: "gold" | "fin", cursoId: number, activos: string[]) {
  await repo.apagarModelosFora(db, regime, cursoId, activos);
}

async function idCursoPorNome(db: Db, regime: "gold" | "fin", curso: string) {
  return (await repo.cursoPorNome(db, regime, curso, true))?.id ?? null;
}

export async function ficheiroModelo(db: Db, regime: "gold" | "fin", curso: string, docId: string) {
  const cursoId = await idCursoPorNome(db, regime, curso);
  if (cursoId == null) return null;
  const pedidos = await docsDoCurso(db, curso, regime);
  if (!pedidos.some(p => p.id === docId && p.modelo)) return null;
  const found = await repo.modeloMaisRecente(db, regime, cursoId, docId);
  if (!found?.drive_file_id) return null;
  return { nome: found.nome, driveFileId: found.drive_file_id };
}

export async function docsDoCurso(db: Db, curso: string, regime: "gold" | "fin"): Promise<DocPedido[]> {
  const base = docsBase(regime);
  const found = await repo.cursoPorNome(db, regime, curso);
  if (!found) return regime === "fin" ? base : [];
  if (!cursoPedeDocsPreinscricao(regime, String(found.tipo ?? ""))) return [];
  const cfg = await lerDocsPreinscricao(db, regime, found.id);
  const ocultos = new Set(cfg.ocultos);
  const kept = base.filter(d => !ocultos.has(d.id));
  const seen = new Set(kept.map(d => d.id));
  for (const extra of cfg.extra) {
    if (seen.has(extra.id)) continue;
    seen.add(extra.id);
    kept.push({ id: extra.id, label: extra.label, required: extra.required });
  }
  const cursoModelo = parseDtpModelo(await repo.modeloDtpDoCurso(db, regime, found.id) ?? undefined);
  let composto = cursoModelo;
  if (regime === "gold") {
    const entidade = await repo.modeloDtpDaEntidade(db, found.id);
    composto = comporModelo(parseDtpModelo(entidade ?? DTP_MODELO_VAZIO), cursoModelo);
  }
  for (const extra of composto.extra) {
    if (extra.ambito !== "formando" || !extra.id || seen.has(extra.id)) continue;
    seen.add(extra.id);
    kept.push({ id: extra.id, label: extra.label || extra.id, required: Boolean(extra.bloqueante) });
  }
  const modelos = await listarModelosConsentimento(db, regime, found.id);
  const porNome = new Map(modelos.map(m => [m.requisito_id, m.nome]));
  return kept.map(d => {
    const nome = porNome.get(d.id);
    return nome ? { ...d, modelo: nome, required: true } : d;
  });
}

export function docsCompletos(pedidos: DocPedido[], tiposEntregues: string[]) {
  const got = new Set(tiposEntregues);
  const emFalta = pedidos.filter(d => d.required && !got.has(d.id));
  return { ok: emFalta.length === 0, emFalta };
}

/** Texto vazio quando a secretaria já pode validar a pré-inscrição inteira. */
export function faltaValidarPreinscricao(input: {
  validada: boolean;
  concluido: boolean;
  turma: { livres: number } | null;
  pedidos: DocPedido[];
  ficheiros: { tipo: string; estado?: string }[];
  pagamento: EstadoPagamentoLead;
  /** Financiada: a turma é escolhida pela secretaria no momento da validação. */
  turmaPelaSecretaria?: boolean;
}) {
  const docs = faltaDocsValidados(input);
  if (docs) return docs;
  if (input.pagamento === "por_pedir") return "Documentos validados: falta pedir o pagamento.";
  if (input.pagamento === "pedido") return "Aguarda o pagamento. A pré-inscrição valida-se quando o pagamento for confirmado.";
  return "";
}

/** Texto vazio quando a secretaria já pode pedir (ou voltar a pedir) o pagamento. */
export function faltaPedirPagamento(input: Parameters<typeof faltaValidarPreinscricao>[0]) {
  if (input.pagamento === "isento") return "Esta pré-inscrição não tem pagamento.";
  if (input.pagamento === "pago") return "O pagamento já está confirmado.";
  return faltaDocsValidados(input);
}

function faltaDocsValidados(input: Parameters<typeof faltaValidarPreinscricao>[0]) {
  if (input.validada) return "A pré-inscrição já foi validada.";
  if (!input.concluido) return "A pessoa ainda não concluiu o envio dos documentos na ligação pessoal.";
  if (!input.turma && !input.turmaPelaSecretaria) return "Ainda não há cronograma escolhido.";
  if (input.turma && input.turma.livres <= 0) return "A turma escolhida está cheia.";
  const by = new Map(input.ficheiros.map(f => [f.tipo, f.estado || "pendente"]));
  const faltam = input.pedidos
    .filter(d => d.required && d.id !== COMPROVATIVO.id && by.get(d.id) !== "validado")
    .map(d => d.label);
  if (faltam.length) return `Falta validar: ${faltam.join(", ")}.`;
  return "";
}
