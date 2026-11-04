// API do domínio "pagamentos": lista com indicadores, confirmar/recusar comprovativo, registo manual.
import { api, enviar, enviarFicheiro, qs, type Pagina } from "./cliente";
import { abrirPdf, descarregar } from "./ficheiros";
import type { DadosFaturacao } from "./publico";

export type SituacaoPagamento = "a_confirmar" | "pedido" | "recusado" | "pago" | "cancelado" | "reembolsado";

export type LinhaPagamento = {
  id: string;
  nome: string;
  email: string;
  curso: string;
  valor: number;
  metodo: string;
  estado: string;
  situacao: SituacaoPagamento;
  criado: string;
  pago_em: string | null;
  recusado_em: string | null;
  recusa_motivo: string;
  referencia: string;
  formando_id: number | null;
  lead_id: number | null;
  lead_regime: string | null;
  pedido_em: string | null;
  comprovativo_id: number | null;
  comprovativo_nome: string | null;
  comprovativo_ficheiro: string | null;
  comprovativo_em: string | null;
  /** Fatura anexada pela contabilidade (null: ainda sem fatura). */
  fatura_em: string | null;
  /** A ação de formação: turma (código), local, horário e data de início. */
  turma_nome?: string | null; turma_local?: string; turma_horario?: string; turma_inicio?: string;
};

/** Fatura do pagamento (PDF anexado pela contabilidade e enviado por email). */
export type FaturaPagamento = {
  numero: string; nome: string; driveFileId: string; anexadaEm: string; enviadaEm: string | null; enviadaPara: string;
};

/** Dados de faturação: os confirmados pela pessoa, ou os da ficha da pré-inscrição (por confirmar). */
export type FaturacaoPagamento = { dados: DadosFaturacao; confirmado: boolean };

export type DetalhePagamentoResposta = {
  pagamento: LinhaPagamento;
  faturacao: FaturacaoPagamento | null;
  fatura: FaturaPagamento | null;
  /** Para onde vai a fatura: o email da faturação e o da pessoa (sem repetir). */
  destinosFatura: string[];
};

export type IndicadoresPagamentos = {
  receita: number;
  pagamentos: number;
  ticketMedio: number;
  esteMes: number;
  mesAnteriorAteHoje: number;
  porReceber: number;
  porReceberN: number;
  metodos: { metodo: string; valor: number; n: number }[];
};

export type RespostaPagamentos = Pagina<LinhaPagamento> & {
  contagens: { situacao: SituacaoPagamento; total: number; valor: number }[];
  indicadores: IndicadoresPagamentos;
  gateway: { ligado: boolean; estado: string };
};

export type FiltrosPagamentos = {
  situacao?: string; curso?: string; metodo?: string; de?: string; ate?: string; q?: string; pagina?: number; porPagina?: number; ordem?: string;
  /** «por_emitir»: pagos sem fatura; «emitida»: com fatura. */
  fatura?: string;
};

export function apiPagamentos(f: FiltrosPagamentos, signal?: AbortSignal) {
  return api<RespostaPagamentos>(`/v1/pagamentos${qs(f)}`, { signal });
}

export function apiPagamento(id: string, signal?: AbortSignal) {
  return api<DetalhePagamentoResposta>(`/v1/pagamentos/${encodeURIComponent(id)}`, { signal });
}

/** Anexa a fatura (PDF) ao pagamento; com `enviar`, segue logo por email para o email da faturação e o da pessoa. */
export function apiAnexarFatura(id: string, ficheiro: File, opcoes: { numero: string; enviar: boolean }) {
  return enviarFicheiro<{ fatura: FaturaPagamento; enviadaPara: string[] }>(
    `/v1/pagamentos/${encodeURIComponent(id)}/fatura`, ficheiro, { numero: opcoes.numero, enviar: opcoes.enviar ? "1" : "0" });
}

/** Volta a enviar a fatura já anexada. */
export function apiEnviarFatura(id: string) {
  return enviar.post<{ fatura: FaturaPagamento; enviadaPara: string[] }>(`/v1/pagamentos/${encodeURIComponent(id)}/fatura/enviar`);
}

export function apiConfirmarPagamento(id: string) {
  return enviar.post<{ detalhe: LinhaPagamento }>(`/v1/pagamentos/${encodeURIComponent(id)}/confirmar`);
}

export function apiRecusarPagamento(id: string, motivo: string) {
  return enviar.post<{ detalhe: LinhaPagamento; avisado: boolean }>(`/v1/pagamentos/${encodeURIComponent(id)}/recusar`, { motivo });
}

export type NovoPagamento = {
  nome: string; valor: number; metodo: string; curso?: string; email?: string; estado: "Pendente" | "Pago"; formandoId?: number;
  /** Uma por formulário aberto: o servidor não regista duas vezes o mesmo pedido. */
  chave?: string;
};

export function apiRegistarPagamento(corpo: NovoPagamento) {
  return enviar.post<{ pagamento: { id: string } }>("/v1/pagamentos", corpo);
}

export function apiMudarEstadoPagamento(id: string, estado: "Cancelado" | "Reembolsado" | "Pendente") {
  return enviar.patch<{ pagamento: unknown }>(`/v1/pagamentos/${encodeURIComponent(id)}`, { estado });
}

export function apiApagarPagamento(id: string) {
  return enviar.delete<{ ok: true }>(`/v1/pagamentos/${encodeURIComponent(id)}`);
}

/** Volta a enviar o pedido de pagamento (email com IBAN e ligação para o comprovativo). */
export function apiReenviarPedidoPagamento(leadId: number) {
  return enviar.post<{ ok: true; valor: number; semIban?: boolean }>(`/v1/crm/leads/${leadId}/pedir-pagamento`);
}

/** Endereço do ficheiro na Drive do GesForma (abre no browser). */
export function urlFicheiro(id: string) {
  return `${(import.meta.env.VITE_API_URL as string | undefined) || "/api"}/v1/drive/files/${encodeURIComponent(id)}/content`;
}

// ─── Exportação e recibos ────────────────────────────────────────────────────

/** Descarrega o Excel com os mesmos filtros da lista (sem paginação). */
export function apiExportarPagamentos(f: FiltrosPagamentos) {
  const { pagina: _p, porPagina: _pp, ordem: _o, ...filtros } = f;
  return descarregar(`/v1/pagamentos/exportar${qs(filtros)}`, "pagamentos.xlsx");
}

export type Recibo = {
  numero: string; emitidoEm: string; actualizadoEm: string; noDrive: boolean; driveFileId: string | null;
  enviadoEm: string | null; enviadoPara: string | null;
};

export function apiEstadoRecibo(id: string, signal?: AbortSignal) {
  return api<{ recibo: Recibo | null }>(`/v1/pagamentos/${encodeURIComponent(id)}/recibo/estado`, { signal });
}

/** Emite o recibo (ou volta a gerá-lo com o mesmo número). */
export function apiEmitirRecibo(id: string) {
  return enviar.post<{ recibo: Recibo; novo: boolean; avisoDrive: string | null }>(`/v1/pagamentos/${encodeURIComponent(id)}/recibo`);
}

export function apiAbrirRecibo(id: string) {
  return abrirPdf(`/v1/pagamentos/${encodeURIComponent(id)}/recibo`, "recibo.pdf");
}

export function apiEnviarRecibo(id: string, para?: string) {
  return enviar.post<{ recibo: Recibo }>(`/v1/pagamentos/${encodeURIComponent(id)}/recibo/enviar`, para ? { para } : {});
}
