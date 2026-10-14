// API do domínio "pagamentos": lista com indicadores, confirmar/recusar comprovativo, registo manual.
import { api, enviar, qs, type Pagina } from "./cliente";
import { abrirPdf, descarregar } from "./ficheiros";

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
};

export function apiPagamentos(f: FiltrosPagamentos, signal?: AbortSignal) {
  return api<RespostaPagamentos>(`/v1/pagamentos${qs(f)}`, { signal, silencioso: true });
}

export function apiPagamento(id: string, signal?: AbortSignal) {
  return api<{ pagamento: LinhaPagamento }>(`/v1/pagamentos/${encodeURIComponent(id)}`, { signal, silencioso: true });
}

export function apiConfirmarPagamento(id: string) {
  return enviar.post<{ detalhe: LinhaPagamento }>(`/v1/pagamentos/${encodeURIComponent(id)}/confirmar`);
}

export function apiRecusarPagamento(id: string, motivo: string) {
  return enviar.post<{ detalhe: LinhaPagamento; avisado: boolean }>(`/v1/pagamentos/${encodeURIComponent(id)}/recusar`, { motivo });
}

export type NovoPagamento = {
  nome: string; valor: number; metodo: string; curso?: string; email?: string; estado: "Pendente" | "Pago"; formandoId?: number;
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
  return api<{ recibo: Recibo | null }>(`/v1/pagamentos/${encodeURIComponent(id)}/recibo/estado`, { signal, silencioso: true });
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
