// API do domínio "emails": regras, modelos, pré-visualização e histórico de envios.
import { api, enviar, qs, type Pagina } from "./cliente";

export type CtaAmbito = "preinscricao" | "contacto" | "documentos" | "pagamento";

export type OpcoesEmail = {
  gatilhos: { valor: string; evento: string; descricao: string }[];
  atrasos: string[];
  modelos: { tipo: string; nome: string }[];
  ambitos: { valor: CtaAmbito; rotulo: string }[];
  variaveis: string[];
  remetente: string;
  contacto: string;
};

export type RegraEmail = {
  id: number;
  nome: string;
  gatilho: string;
  evento: string;
  template: string;
  templateNome: string | null;
  atraso: string;
  curso: string | null;
  ativo: boolean;
  envios: number;
  abertos: number;
  falhados: number;
  emFila: number;
  taxaAbertura: number;
  ultimoEnvio: string | null;
};

export type ModeloEmail = {
  id: number;
  tipo: string;
  nome: string;
  assunto: string;
  body_lines: unknown;
  body_xml: string;
  cta: string;
  cta_href: string;
  cta_ambito: CtaAmbito | string;
  updated_at: string;
  funcao: string;
};

export type EnvioEmail = {
  id: string; para: string; nome: string; assunto: string; estado: "queued" | "sent" | "failed" | "cancelled";
  agendado: string; enviado: string | null; aberto: string | null; erro: string | null; regra: string; regra_id: number;
  tentativas: number; teste: boolean;
};

export type EstatisticasEnvios = { sent: number; queued: number; failed: number; abertos: number };

export const apiOpcoesEmail = (signal?: AbortSignal) => api<OpcoesEmail>("/v1/email/opcoes", { signal, silencioso: true });
export const apiRegrasEmail = (signal?: AbortSignal) => api<{ rules: RegraEmail[] }>("/v1/email/regras", { signal, silencioso: true });
export const apiModelosEmail = (signal?: AbortSignal) => api<{ templates: ModeloEmail[] }>("/v1/email/templates", { signal, silencioso: true });

export type CorpoRegra = { nome: string; gatilho: string; templateTipo: string; atraso: string; curso: string | null; ativo: boolean };

export const apiCriarRegra = (corpo: CorpoRegra) => enviar.post<{ id: number }>("/v1/email/rules", corpo);
export const apiAlterarRegra = (id: number, corpo: Partial<CorpoRegra>) => enviar.patch<{ ok: true }>(`/v1/email/rules/${id}`, corpo);
export const apiApagarRegra = (id: number) => enviar.delete<{ ok: true }>(`/v1/email/rules/${id}`);
export const apiTestarRegra = (id: number) => enviar.post<{ ok: true; to: string; logged: boolean }>(`/v1/email/rules/${id}/teste`);

export type CorpoModelo = { nome?: string; assunto?: string; body_xml?: string; cta?: string; cta_href?: string; cta_ambito?: CtaAmbito };

export const apiAlterarModelo = (id: number, corpo: CorpoModelo) => enviar.patch<{ template: ModeloEmail }>(`/v1/email/templates/${id}`, corpo);

export type Previsualizacao = { assunto: string; html: string; texto: string; para: string; de: string };

export const apiPrevisualizarEmail = (corpo: CorpoModelo & { tipo: string; curso?: string | null }, signal?: AbortSignal) =>
  api<Previsualizacao>("/v1/email/previsualizar", { method: "POST", body: JSON.stringify(corpo), signal, silencioso: true });

export type FiltrosEnvios = { regra?: string; estado?: string; q?: string; de?: string; ate?: string; pagina?: number; porPagina?: number };

export const apiEnviosEmail = (f: FiltrosEnvios, signal?: AbortSignal) =>
  api<Pagina<EnvioEmail> & { stats: EstatisticasEnvios }>(`/v1/email/envios${qs(f)}`, { signal, silencioso: true });
export const apiEnvioEmail = (id: string, signal?: AbortSignal) =>
  api<{ envio: { id: string; assunto: string; html: string; texto: string; para: string } }>(`/v1/email/envios/${id}`, { signal, silencioso: true });
export const apiReenviarEnvio = (id: string) => enviar.post<{ ok: true }>(`/v1/email/envios/${id}/reenviar`);
export const apiCancelarEnvio = (id: string) => enviar.post<{ ok: true }>(`/v1/email/envios/${id}/cancelar`);
