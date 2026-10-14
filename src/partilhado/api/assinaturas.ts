// API da assinatura de contratos: envio e provas (equipa), contratos do formando, selo e páginas públicas.
import { BASE, api, enviar, enviarFicheiro } from "./cliente";

type Sinal = { signal?: AbortSignal };

export type EstadoAssinatura = "enviado" | "aberto" | "assinado" | "recusado" | "expirado" | "cancelado";

export type EventoAssinatura = { id: number; tipo: string; rotulo: string; em: string | null; ip: string; userAgent: string; detalhe: Record<string, unknown> };

export type AssinaturaResumo = {
  id: number; contratoId: number; estado: EstadoAssinatura; titulo: string; signatarioNome: string; signatarioEmail: string;
  enviadoPorNome: string; enviadoEm: string | null; expiraEm: string | null; abertoEm: string | null; assinadoEm: string | null;
  recusadoEm: string | null; canceladoEm: string | null; motivo: string; metodo: string | null; metodoRotulo: string | null;
  hashOriginal: string; hashFinal: string; selado: boolean; certificadoTitular: string; certificadoFingerprint: string;
  driveFileId: string | null; reenvios: number; codigoVerificacao: string; temAssinado: boolean; nifOrigem: string;
};

export type AssinaturaDetalhe = AssinaturaResumo & { nif: string; urlVerificacao: string; hashAssinatura: string; eventos: EventoAssinatura[] };

export const apiAssinaturasDoContrato = (contratoId: number, o: Sinal = {}) =>
  api<{ assinaturas: AssinaturaResumo[] }>(`/v1/crm/contratos/${contratoId}/assinaturas`, { silencioso: true, signal: o.signal });
export const apiEnviarAssinatura = (contratoId: number, d: { nif?: string; prazoDias?: number }) =>
  enviar.post<{ assinatura: AssinaturaDetalhe }>(`/v1/crm/contratos/${contratoId}/assinatura`, d);
export const apiAssinatura = (id: number, o: Sinal = {}) =>
  api<{ assinatura: AssinaturaDetalhe }>(`/v1/assinaturas/${id}`, { silencioso: true, signal: o.signal });
export const apiReenviarAssinatura = (id: number, prazoDias?: number) =>
  enviar.post<{ assinatura: AssinaturaDetalhe }>(`/v1/assinaturas/${id}/reenviar`, { prazoDias });
export const apiCancelarAssinatura = (id: number, motivo: string) =>
  enviar.post<{ assinatura: AssinaturaDetalhe }>(`/v1/assinaturas/${id}/cancelar`, { motivo });
export const urlPdfAssinatura = (id: number, versao: "original" | "assinado") => `${BASE}/v1/assinaturas/${id}/pdf?versao=${versao}`;

export type ContratoFormando = {
  id: number; curso: string; valor: number; estado: string; modelo: string; assinadoEm: string | null; criadoEm: string | null;
  assinaturaId: number | null; assinaturaEstado: EstadoAssinatura | null;
};
export const apiContratosFormando = (regime: "gold" | "fin", id: number, o: Sinal = {}) =>
  api<{ contratos: ContratoFormando[] }>(`/v1/formandos/${regime}/${id}/contratos`, { silencioso: true, signal: o.signal });
export const apiNovoContratoFormando = (regime: "gold" | "fin", id: number, templateId: number) =>
  enviar.post<{ contratoId: number; contratos: ContratoFormando[] }>(`/v1/formandos/${regime}/${id}/contratos`, { templateId });

export type Selo = {
  titular: string; emissor: string; fingerprint: string; validoDe: string | null; validoAte: string | null;
  autoAssinado: boolean; actualizadoEm: string | null; expirado: boolean;
};
export const apiSelo = (o: Sinal = {}) => api<{ selo: Selo | null }>("/v1/assinaturas/selo", { silencioso: true, signal: o.signal });
export const apiCarregarSelo = (ficheiro: File, senha: string) => enviarFicheiro<{ selo: Selo }>("/v1/assinaturas/selo", ficheiro, { senha });
export const apiGerarSelo = () => enviar.post<{ selo: Selo }>("/v1/assinaturas/selo/gerar");
export const apiApagarSelo = () => enviar.delete<{ ok: true }>("/v1/assinaturas/selo");

// ─── Páginas públicas (sem sessão) ──────────────────────────────────────────────

export type PedidoPublico = {
  estado: EstadoAssinatura; titulo: string; entidade: string; signatario: { nome: string; email: string };
  expiraEm: string | null; assinadoEm: string | null; metodo: string | null; codigoVerificacao: string | null;
  urlVerificacao: string | null; codigoMinutos: number;
};
export const apiPedidoPublico = (token: string) => api<PedidoPublico>(`/v1/public/assinar/${encodeURIComponent(token)}`, { silencioso: true });
export const urlPdfPublico = (token: string, versao: "original" | "assinado", ver = false) =>
  `${BASE}/v1/public/assinar/${encodeURIComponent(token)}/pdf?versao=${versao}${ver ? "&ver=1" : ""}`;
export const apiPedirCodigo = (token: string) =>
  enviar.post<{ enviadoPara: string; minutos: number }>(`/v1/public/assinar/${encodeURIComponent(token)}/codigo`);
export const apiAssinar = (token: string, d: { metodo: "desenhada" | "escrita"; imagem?: string; nomeEscrito?: string; codigo: string; aceito: true }) =>
  enviar.post<{ estado: "assinado"; codigoVerificacao: string; urlVerificacao: string; hashFinal: string }>(`/v1/public/assinar/${encodeURIComponent(token)}/assinar`, d);
export const apiRecusar = (token: string, motivo: string) => enviar.post<{ estado: "recusado" }>(`/v1/public/assinar/${encodeURIComponent(token)}/recusar`, { motivo });
export const apiEnviarAssinadoExterno = (token: string, ficheiro: File) =>
  enviarFicheiro<{ estado: "assinado"; codigoVerificacao: string; urlVerificacao: string; hashFinal: string }>(`/v1/public/assinar/${encodeURIComponent(token)}/externo`, ficheiro);

export type Verificacao = {
  codigo: string; estado: EstadoAssinatura; titulo: string; entidade: string; signatario: { nome: string; nif: string };
  enviadoEm: string | null; assinadoEm: string | null; metodo: string | null; hashOriginal: string; hashFinal: string | null;
  selo: { titular: string; fingerprint: string } | null; assinaturaExterna: { titular: string } | null;
};
export const apiVerificar = (codigo: string) => api<Verificacao>(`/v1/public/verificar/${encodeURIComponent(codigo)}`, { silencioso: true });

export const ROTULO_ESTADO: Record<EstadoAssinatura, string> = {
  enviado: "Enviado", aberto: "Aberto pelo signatário", assinado: "Assinado", recusado: "Recusado", expirado: "Expirado", cancelado: "Cancelado",
};
export const TOM_ESTADO: Record<EstadoAssinatura, "info" | "aviso" | "sucesso" | "perigo" | "neutro"> = {
  enviado: "info", aberto: "aviso", assinado: "sucesso", recusado: "perigo", expirado: "neutro", cancelado: "neutro",
};
