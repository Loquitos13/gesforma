// API do domínio "crm": pré-inscrições (lista com filas e filtros, ficha, notas, documentos, validação e pagamento).
import { BASE, api, enviar, qs } from "./cliente";

export type RegimeCrm = "gold" | "fin";
export type CrmFila = "contactar" | "atrasados" | "hoje" | "agenda" | "converter" | "abertos" | "secretaria" | "preinscricao" | "minhas";
export type CrmSort = "inscrito" | "proximo" | "valor" | "nome" | "actividade" | "comercial" | "origem" | "meio" | "etiqueta" | "curso" | "turma" | "estado";
export type CrmDir = "asc" | "desc";

/** Pré-inscrição como vem do servidor (`mapPreinscricao` + estado dos documentos na lista). */
export type Lead = {
  id: number;
  ref: string;
  inscrito: string;
  nome: string;
  apelido: string;
  email: string;
  telf: string;
  inicioCurso: string;
  concelho: string;
  local: string;
  curso: string;
  preco: number;
  estado: string;
  campanha: string;
  origem: string;
  horario: string;
  turmaId: number;
  entrada: "preinscricao" | "manual";
  meioContacto: string;
  etiquetaId: number | null;
  etiquetaNome: string;
  etiquetaCor: string;
  contactadoEm: string | null;
  notas: string;
  proximoContacto: string;
  comercialId: string | null;
  comercialNome: string;
  nif: string;
  moradaFiscal: string;
  codigoPostal: string;
  motivoDesistencia: string;
  pagamentoMetodo: string;
  secretariaEm: string | null;
  ultimaNota: string;
  ultimaActividadeEm: string | null;
  ultimaResultado: string;
  regime: RegimeCrm;
  docsEnviados?: number;
  docsValidados?: number;
  docsRecusados?: number;
  percursoConcluido?: boolean;
  validada?: boolean;
  pagamentoPedido?: boolean;
  consentimento?: boolean;
};

export type FiltrosCrm = {
  q?: string;
  estado?: string;
  curso?: string;
  local?: string;
  origem?: string;
  entrada?: "" | "preinscricao" | "manual";
  campanhaId?: string;
  comercialId?: string;
  fila?: CrmFila | "";
  regime: RegimeCrm;
  de?: string;
  ate?: string;
  page?: number;
  perPage?: number;
  sort?: CrmSort;
  dir?: CrmDir;
  kanban?: boolean;
};

export type ContagensCrm = {
  total: number; abertos: number; porContactar: number; conversa: number; pagos: number; formando: number;
  atrasados: number; hoje: number; marcadosHoje: number; converter: number; valorAberto: number;
  preinscricoes: number; manuais: number; filaPre: number; filaSec: number; desistiu: number; semContacto2d: number;
};

export type ListaCrm = {
  items: Lead[];
  total: number;
  page: number;
  perPage: number;
  counts: ContagensCrm;
  porEstado: Record<string, number>;
  facets: { cursos: string[]; locais: string[]; origens: string[]; campanhas: string[] };
  columns?: { estado: string; total: number; valor?: number; items: Lead[] }[];
};

function qsCrm(f: FiltrosCrm) {
  return qs({
    q: f.q, estado: f.estado, curso: f.curso, local: f.local, origem: f.origem, entrada: f.entrada,
    campanhaId: f.campanhaId, comercialId: f.comercialId, fila: f.fila, regime: f.regime, de: f.de, ate: f.ate,
    page: f.page, perPage: f.perPage, sort: f.sort, dir: f.dir, kanban: f.kanban,
  });
}

export const apiLeads = (f: FiltrosCrm, signal?: AbortSignal) => api<ListaCrm>(`/v1/crm/leads${qsCrm(f)}`, { signal });

/** Descarrega o CSV do filtro actual (máx. 2 000 linhas). */
export async function apiExportarLeads(f: FiltrosCrm) {

  const res = await fetch(`${BASE}/v1/crm/export${qsCrm(f)}`, { credentials: "include", headers: { "X-Gesforma-Client": "web" } });
  if (!res.ok) throw new Error("A exportação falhou.");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pre-inscricoes-${f.regime}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Ficha ───────────────────────────────────────────────────────────────── */

export type CampoCrm = { id: number; label: string; chave: string; tipo: "texto" | "numero" | "data" | "lista"; opcoes: string[]; valor?: string };
export type EventoLead = { id: number; tipo: string; titulo: string; detalhe: string; createdAt: string; actorName: string | null };
export type NotaLead = { id: number; nota: string; meio: string; resultado: string; fixada: boolean; createdAt: string; actorName: string | null };
export type DocumentoLead = { id: number; tipo: string; label: string; nome: string; url: string; createdAt: string; estado: string; observacao: string };
export type TurmaDestino = { id: number; nome: string; local: string; horario: string; dataInicio: string; livres: number };
export type EstadoPagamentoLead = "isento" | "por_pedir" | "pedido" | "pago";

export type DossieLead = {
  lead: Lead;
  cliente: boolean;
  campos: CampoCrm[];
  notas: NotaLead[];
  eventos: EventoLead[];
  outrosPedidos: Lead[];
  propostas: { id: number; curso: string; estado: string; valor: number; enviadaEm: string }[];
  consentimento: { em: string | null; ip: string; versao: string };
  docsUrl: string;
  docsCompletos: boolean;
  docsEmFalta: string[];
  documentos: DocumentoLead[];
  docsFechado: boolean;
  pagamento: { id: string; valor: number; estado: string; metodo: string } | null;
  turmasDestino: TurmaDestino[];
  percursoConcluido: boolean;
  validadaEm: string | null;
  recusaMotivo: string;
  turmaEscolhida: TurmaDestino | null;
  podeValidar: boolean;
  faltaValidar: string;
  turmaPelaSecretaria: boolean;
  estadoPagamento: EstadoPagamentoLead;
  pagamentoPedidoEm: string | null;
  podePedirPagamento: boolean;
  faltaPedirPagamento: string;
  /**
   * Financiada: os dados pessoais do formulário e da ligação pessoal (só para admin, secretaria e financiada).
   * N.º do documento, NISS, IBAN e NIF da entidade empregadora vêm mascarados (últimos 4).
   */
  dadosFin?: DadosPessoaisFinLead | null;
};

export type DadosPessoaisFinLead = {
  genero: string; dataNascimento: string; nacionalidade: string; habilitacoes: string; morada: string;
  tipoDocumento: string; numeroDocumento: string; validadeDocumento: string; nif: string; niss: string; iban: string;
  situacaoEmprego: string; nifEntidadeEmpregadora: string; termosAceitesEm: string | null; termosVersao: string;
};

export const apiDossie = (id: number, signal?: AbortSignal) => api<DossieLead>(`/v1/crm/leads/${id}`, { signal });

export type DadosLead = Partial<{
  nome: string; apelido: string; email: string; telf: string; concelho: string; origem: string; nota: string;
  curso: string; local: string; inicioCurso: string; horario: string; turmaId: number; campanha: string;
  campanhaId: number | null; estado: string; proximoContacto: string; comercialId: string | null; meioContacto: string;
  etiquetaId: number | null; nif: string; moradaFiscal: string; codigoPostal: string; motivoDesistencia: string;
  pagamentoMetodo: string; regime: RegimeCrm;
}>;

export const apiCriarLead = (d: DadosLead & { nome: string }) =>
  enviar.post<{ preinscricao: Lead; duplicados: { id: number; nome: string; apelido: string; estado: string; curso: string }[] }>("/v1/preinscricoes", d);
export const apiEditarLead = (id: number, d: DadosLead) => enviar.patch<{ preinscricao: Lead }>(`/v1/preinscricoes/${id}`, d);
export const apiApagarLead = (id: number) => enviar.delete<{ ok: boolean }>(`/v1/preinscricoes/${id}`);
export const apiCompletar = (id: number, d: DadosLead) => enviar.post<DossieLead>(`/v1/crm/leads/${id}/completar`, d);

export const apiNota = (id: number, nota: string, meio = "", resultado = "") =>
  enviar.post<DossieLead>(`/v1/crm/leads/${id}/notas`, { nota, meio, resultado });
export const apiFixarNota = (id: number, nid: number, fixada: boolean) =>
  enviar.post<DossieLead>(`/v1/crm/leads/${id}/notas/${nid}/fixar`, { fixada });
export const apiGravarCampos = (id: number, valores: { campoId: number; valor: string }[]) =>
  enviar.post<DossieLead>(`/v1/crm/leads/${id}/campos`, { valores });
export const apiCriarCampo = (label: string, tipo: CampoCrm["tipo"]) =>
  enviar.post<{ campo: CampoCrm }>("/v1/crm/campos", { label, tipo });

export const apiValidarDoc = (id: number, docId: number) => enviar.post<DossieLead>(`/v1/crm/leads/${id}/documentos/${docId}/validar`, {});
export const apiRecusarDoc = (id: number, docId: number, observacao: string) =>
  enviar.post<DossieLead>(`/v1/crm/leads/${id}/documentos/${docId}/recusar`, { observacao });
export const apiAlertarDocs = (id: number) => enviar.post<{ ok: boolean }>(`/v1/crm/leads/${id}/documentos/alertar`, {});

export const apiValidarPreinscricao = (id: number, turmaId?: number) =>
  enviar.post<DossieLead>(`/v1/crm/leads/${id}/validar-preinscricao`, turmaId ? { turmaId } : {});
export const apiPedirPagamento = (id: number) =>
  enviar.post<DossieLead & { pedido: { valor: number; iban: string; semIban: boolean } }>(`/v1/crm/leads/${id}/pedir-pagamento`, {});
/** Gold pago: volta a concluir a inscrição que ficou a meio (ficha, conta e email de acesso). */
export const apiConcluirInscricao = (id: number) => enviar.post<DossieLead>(`/v1/crm/leads/${id}/concluir-inscricao`, {});
export const apiNovaLigacao = (id: number) => enviar.post<{ ok: boolean; url: string | null }>(`/v1/crm/leads/${id}/nova-ligacao`, {});
export const apiTurmaCheia = (id: number) =>
  enviar.post<{ ok: boolean; enviadas: number; turmas: TurmaDestino[] }>(`/v1/crm/leads/${id}/turma-cheia`, {});

/** Gold: a secretaria inscreve a pessoa numa turma (cria a ficha de formando; liga-se à pré-inscrição validada). */
export const apiInscreverGold = (l: Lead, turmaId: number) =>
  enviar.post<{ formando: { id: number } }>("/v1/formandos-gold", {
    nome: l.nome, apelido: l.apelido, email: l.email, telf: l.telf, turmaId, estado: "Formando",
    pago: l.estado === "Pago", valor: l.preco, metodo: l.pagamentoMetodo || "-",
  });

/* ── Lote, etiquetas, comerciais, duplicados ─────────────────────────────── */

export type AccaoLote = {
  ids: number[];
  acao: "contactar" | "estado" | "seguimento" | "atribuir" | "etiqueta" | "adiar";
  estado?: string; proximoContacto?: string; nota?: string; comercialId?: string; etiquetaId?: number | null; dias?: number;
  motivoDesistencia?: string;
};
export const apiLote = (a: AccaoLote) => enviar.post<{ updated: number }>("/v1/crm/lote", a);

export type Etiqueta = { id: number; nome: string; cor: string };
export const apiEtiquetas = (signal?: AbortSignal) => api<{ etiquetas: Etiqueta[] }>("/v1/crm/etiquetas", { signal });
export const apiCriarEtiqueta = (nome: string, cor: string) => enviar.post<{ etiqueta: Etiqueta }>("/v1/crm/etiquetas", { nome, cor });
export const apiComerciais = (regime: RegimeCrm, signal?: AbortSignal) =>
  api<{ comerciais: { id: string; name: string }[] }>(`/v1/crm/comerciais${qs({ regime })}`, { signal });
export const apiDuplicados = (email: string, telf: string, exceptId = 0, signal?: AbortSignal) =>
  api<{ duplicados: { id: number; nome: string; apelido: string; estado: string; curso: string }[] }>(
    `/v1/crm/duplicados${qs({ email, telf, exceptId })}`, { signal });

/** Dados de faturação da inscrição (botão «Contabilidade» da ficha). */
export type FaturacaoLead =
  | { pedido: false }
  | {
      pedido: true; pedidoEm: string; preenchidoEm: string | null; url: string;
      dados: { nome: string; nif: string; moradaFiscal: string; codigoPostal: string; email: string } | null;
    };

export const apiFaturacaoLead = (id: number, signal?: AbortSignal) => api<FaturacaoLead>(`/v1/crm/leads/${id}/faturacao`, { signal });
export const apiPedirFaturacao = (id: number) => enviar.post<FaturacaoLead>(`/v1/crm/leads/${id}/faturacao/pedir`, {});
