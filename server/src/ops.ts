import { randomUUID } from "node:crypto";
import type { Db } from "./db/pool.js";
import { opaqueRef } from "./fieldCrypto.js";
import { readFormandoDocs, readFormandoPii, readPreinscricaoPii } from "./pii.js";
import { proximoIdOps } from "./repos/ops.js";
import { stampLisboa } from "./datas.js";

export function newPublicId() {
  return randomUUID();
}

export async function nextOpsId(db: Db) {
  return (await proximoIdOps(db)) ?? Date.now() % 100000;
}

function num(v: unknown) {
  return typeof v === "number" ? v : Number(v ?? 0);
}

function asObj(v: unknown) {
  if (v && typeof v === "object") return v as Record<string, unknown>;
  if (typeof v === "string") {
    try { return JSON.parse(v) as Record<string, unknown>; } catch { return {}; }
  }
  return {};
}

const SLOTS_CCP = ["laboral", "pos-laboral", "sabado-manha", "sabado-tarde"];

function slotsCcp(raw: unknown) {
  if (raw == null) return [...SLOTS_CCP];
  const arr = asArr(raw);
  if (arr.some(item => item && typeof item === "object")) return [...SLOTS_CCP];
  return arr.map(item => String(item));
}

function mapaValores(v: unknown) {
  const obj = asObj(v);
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(obj)) {
    const n = Number(val);
    if (k.trim() && Number.isFinite(n)) out[k] = n;
  }
  return out;
}

function asArr(v: unknown) {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p : [];
    } catch { return []; }
  }
  return [];
}

export function mapPreinscricao(r: Record<string, unknown>) {
  const pii = readPreinscricaoPii(r);
  const id = num(r.id);
  const publicId = String(r.public_id ?? "");
  return {
    id,
    publicId,
    ref: opaqueRef("pre", id, publicId || null),
    inscrito: String(r.inscrito ?? ""),
    nome: String(r.nome ?? ""),
    apelido: String(r.apelido ?? ""),
    email: String(r.email ?? ""),
    telf: pii.telf || String(r.telf ?? ""),
    inicioCurso: String(r.inicio_curso ?? "-"),
    concelho: String(r.concelho ?? ""),
    local: String(r.local ?? ""),
    curso: String(r.curso ?? ""),
    preco: num(r.preco),
    estado: String(r.estado ?? "Não contactado"),
    campanha: String(r.campanha ?? ""),
    origem: String(r.origem ?? "Website"),
    horario: String(r.horario ?? ""),
    turmaId: r.turma_id == null || r.turma_id === "" ? 0 : num(r.turma_id),
    entrada: String(r.entrada ?? "preinscricao") === "manual" ? "manual" : "preinscricao",
    meioContacto: String(r.meio_contacto ?? ""),
    etiquetaId: r.etiqueta_id == null || r.etiqueta_id === "" ? null : num(r.etiqueta_id),
    etiquetaNome: String(r.etiqueta_nome ?? ""),
    etiquetaCor: String(r.etiqueta_cor ?? ""),
    contactadoEm: r.contactado_em ? String(r.contactado_em) : null,
    notas: String(r.notas ?? ""),
    proximoContacto: String(r.proximo_contacto ?? ""),
    comercialId: r.comercial_id ? String(r.comercial_id) : null,
    comercialNome: String(r.comercial_nome ?? ""),
    nif: pii.nif ?? String(r.nif ?? ""),
    moradaFiscal: pii.moradaFiscal ?? String(r.morada_fiscal ?? ""),
    codigoPostal: pii.codigoPostal ?? String(r.codigo_postal ?? ""),
    motivoDesistencia: String(r.motivo_desistencia ?? ""),
    pagamentoMetodo: String(r.pagamento_metodo ?? ""),
    secretariaEm: r.secretaria_em ? String(r.secretaria_em) : null,
    ultimaNota: String(r.ultima_nota ?? ""),
    ultimaActividadeEm: r.ultima_actividade_em ? String(r.ultima_actividade_em) : null,
    ultimaResultado: String(r.ultima_resultado ?? ""),
    regime: String(r.regime ?? "gold") === "fin" ? "fin" as const : "gold" as const,
  };
}

export function mapFormandoGold(r: Record<string, unknown>) {
  const pii = readFormandoPii(r);
  const id = num(r.id);
  const publicId = String(r.public_id ?? "");
  return {
    id,
    publicId,
    ref: opaqueRef("gold", id, publicId || null),
    nome: String(r.nome ?? ""),
    apelido: String(r.apelido ?? ""),
    telf: pii.telf || String(r.telf ?? ""),
    email: String(r.email ?? ""),
    inscrito: String(r.inscrito ?? ""),
    local: String(r.local ?? ""),
    curso: String(r.curso ?? ""),
    turma: String(r.turma ?? ""),
    turmaId: r.turma_id == null ? 0 : num(r.turma_id),
    estado: String(r.estado ?? "Formando"),
    pago: Boolean(r.pago),
    valor: num(r.valor),
    metodo: String(r.metodo ?? "-"),
    temAcesso: Boolean(r.user_id),
  };
}

export function mapFormandoFin(r: Record<string, unknown>) {
  const docs = readFormandoDocs(r);
  const pii = readFormandoPii(r);
  const doc = (k: string) => {
    const d = asObj(docs[k]);
    return { ok: Boolean(d.ok), data: String(d.data ?? "") };
  };
  const id = num(r.id);
  const publicId = String(r.public_id ?? "");
  return {
    id,
    publicId,
    ref: opaqueRef("fin", id, publicId || null),
    nome: String(r.nome ?? ""),
    apelido: String(r.apelido ?? ""),
    turma: String(r.turma ?? ""),
    turmaId: r.turma_id == null || r.turma_id === "" ? 0 : num(r.turma_id),
    telf: pii.telf || String(r.telf ?? ""),
    email: String(r.email ?? ""),
    curso: String(r.curso ?? ""),
    estado: String(r.estado ?? "Elegível"),
    cc: doc("cc"),
    ch: doc("ch"),
    cu: doc("cu"),
    ci: doc("ci"),
    ce: doc("ce"),
    morada: doc("morada"),
    contrato: doc("contrato"),
    rgpd: doc("rgpd"),
    temAcesso: Boolean(r.user_id),
  };
}

export function mapCursoGold(r: Record<string, unknown>) {
  return {
    id: num(r.id),
    nome: String(r.nome ?? ""),
    categoria: String(r.categoria ?? ""),
    tipo: String(r.tipo ?? "Gold"),
    preco: num(r.preco),
    regime: String(r.regime ?? ""),
    horas: num(r.horas),
    estado: String(r.estado ?? "Ativo"),
  };
}

export function mapCursoFin(r: Record<string, unknown>) {
  return {
    id: num(r.id),
    ufcdCod: String(r.ufcd_cod ?? ""),
    ufcd: String(r.ufcd ?? ""),
    nomeComercial: String(r.nome_comercial ?? ""),
    regime: String(r.regime ?? ""),
    horas: num(r.horas),
    estado: String(r.estado ?? "Ativo"),
  };
}

export function mapTurmaGold(r: Record<string, unknown>) {
  return {
    id: num(r.id),
    dataInicio: String(r.data_inicio ?? ""),
    nome: String(r.nome ?? ""),
    curso: String(r.curso ?? ""),
    local: String(r.local ?? ""),
    horario: String(r.horario ?? ""),
    totalAlunos: num(r.total_alunos),
    vagas: num(r.vagas),
    toleranciaVagas: num(r.tolerancia_vagas),
    vagasAnunciadas: r.vagas_anunciadas == null ? null : num(r.vagas_anunciadas),
    estado: String(r.estado ?? "Ativa"),
    formador: String(r.formador ?? ""),
    formadores: asArr(r.formadores).map(x => String(x)).filter(Boolean),
    horas: num(r.horas),
    custoHoraSala: num(r.custo_hora_sala),
    valoresHoraFormador: mapaValores(r.valores_hora_formador),
    cronograma: asArr(r.cronograma),
    drivePastaId: String(r.drive_pasta_id ?? ""),
    driveDossieId: String(r.drive_dossie_id ?? ""),
  };
}

export function mapTurmaFin(r: Record<string, unknown>) {
  return {
    id: num(r.id),
    dataInicio: String(r.data_inicio ?? ""),
    nome: String(r.nome ?? ""),
    curso: String(r.curso ?? ""),
    ufcdCod: String(r.ufcd_cod ?? ""),
    local: String(r.local ?? ""),
    horario: String(r.horario ?? ""),
    alunos: num(r.alunos),
    alunosTotal: num(r.alunos_total),
    toleranciaVagas: num(r.tolerancia_vagas),
    vagasAnunciadas: r.vagas_anunciadas == null ? null : num(r.vagas_anunciadas),
    estado: String(r.estado ?? "A montar"),
    horas: num(r.horas),
    formador: String(r.formador ?? ""),
    formadores: asArr(r.formadores).map(x => String(x)).filter(Boolean),
    activa: Boolean(r.activa),
    valoresHoraFormador: mapaValores(r.valores_hora_formador),
    cronograma: asArr(r.cronograma),
    drivePastaId: String(r.drive_pasta_id ?? ""),
    driveDossieId: String(r.drive_dossie_id ?? ""),
    fechadaEm: r.fechada_em ? stampLisboa(r.fechada_em as Date | string) || String(r.fechada_em) : "",
    fechadaPor: String(r.fechada_por ?? ""),
  };
}

// Pagamentos: regras em ./pagamentos.ts e SQL em ./repos/pagamentos.ts. Mantém-se a exportação para quem já usa ops.
export { confirmarPagamento, findPagamentoPorReferencia, mapPagamento } from "./pagamentos.js";
