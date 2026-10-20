// API do domínio "formandos": listas, ficha e acções (server/src/rotas/formandos.ts).
import type { DadosFinanciamento } from "../execucaoFisica";
import { api, enviar, qs, type Pagina } from "./cliente";
import { hojeLisboa } from "../horaLisboa";

export type Regime = "gold" | "fin";
export type SituacaoPagamento = "pago" | "por_pagar" | "oferta" | "isento";
export type SeparadorFormandos = "turmas" | "avulsos" | "pendencias" | "elegiveis" | "docs_em_falta" | "todos";

export type FiltrosFormandos = {
  regime: Regime;
  separador?: SeparadorFormandos;
  q?: string;
  curso?: string;
  turma?: string;
  local?: string;
  estado?: string;
  pagamento?: string;
  docs?: string;
  acesso?: string;
  pagina?: number;
  porPagina?: number;
  ordem?: string;
};

export type LinhaFormando = {
  id: number;
  nome: string;
  apelido: string;
  email: string;
  telf: string;
  curso: string;
  local: string;
  turma: { id: number; nome: string } | null;
  ufcd: string;
  estado: string;
  inscrito: string;
  pagamento: { situacao: SituacaoPagamento; valor: number; metodo: string; pago: boolean };
  acesso: boolean;
  docs: { validados: number; recusados: number };
};

export type ListaFormandos = Pagina<LinhaFormando> & { contagens: Record<string, number>; docsObrigatorios: number };

export function apiListarFormandos(f: FiltrosFormandos, signal?: AbortSignal) {
  return api<ListaFormandos>(`/v1/formandos${qs(f)}`, { signal });
}

export type DocFicha = {
  id: string;
  label: string;
  required: boolean;
  estado: "validado" | "recusado" | "pendente" | "em_falta" | string;
  observacao: string;
  fileName: string;
  driveUrl: string;
  validadoEm: string;
  validadoPor: string;
};

export type FichaFormando = {
  regime: Regime;
  id: number;
  publicId: string;
  nome: string;
  apelido: string;
  email: string;
  telf: string;
  estado: string;
  curso: string;
  local: string;
  inscrito: string;
  turma: null | { id: number; nome: string; curso: string; local: string; horario: string; inicio: string; estado: string; ufcd: string; fechada: boolean };
  acesso: { tem: boolean; ativa: boolean; mudarPalavraPasse: boolean; ultimoAcesso: string | null; criadaEm: string | null };
  documentos: DocFicha[];
  docsResumo: { validados: number; total: number; recusados: number };
  ligacaoDocumentos: string | null;
  pagamento: null | {
    valor: number; metodo: string; pago: boolean; situacao: SituacaoPagamento; pedidoEm: string | null; temIban: boolean;
    movimentos: { id: string; valor: number; metodo: string; estado: string; data: string; pagoEm: string | null }[];
  };
  resultado: null | {
    assiduidade: { pct: number | null; horasPrevistas: number; horasPresente: number; minimo: number };
    nota: number | null; aprovado: boolean | null; elegivel: boolean; motivos: string[];
  };
  certificado: null | { emitido: boolean; emitidoEm: string | null; nota: number | null; url: string; nome: string };
  origem: null | { preinscricaoId: number; estado: string; comoConheceu: string };
  passos: { id: string; rotulo: string; feito: boolean }[];
  notas: { id: number; autor: string; texto: string; data: string | null }[];
  historico: { id: number; acao: string; autor: string; data: string | null }[];
};

export function apiFichaFormando(regime: Regime, id: number, signal?: AbortSignal) {
  return api<{ ficha: FichaFormando }>(`/v1/formandos/${regime}/${id}`, { signal }).then(r => r.ficha);
}

// ─── Escrita ─────────────────────────────────────────────────────────────────

export type NovaFichaGold = {
  nome: string; apelido?: string; email: string; telf?: string; curso?: string; local?: string;
  turmaId?: number; pago?: boolean; valor?: number; metodo?: string;
};

export function apiCriarFormandoGold(corpo: NovaFichaGold) {
  return enviar.post<{ formando: { id: number } }>("/v1/formandos-gold", corpo);
}

export function apiAlterarFormandoGold(id: number, corpo: Partial<NovaFichaGold> & { estado?: string }) {
  return enviar.patch<{ formando: { id: number } | null }>(`/v1/formandos-gold/${id}`, corpo);
}

export type NovaFichaFin = { nome: string; apelido?: string; email?: string; telf?: string; curso?: string; turmaId?: number; estado?: string };

export function apiCriarFormandoFin(corpo: NovaFichaFin) {
  return enviar.post<{ formando: { id: number } }>("/v1/formandos-fin", corpo);
}

export function apiAlterarFormandoFin(id: number, corpo: Partial<NovaFichaFin>) {
  return enviar.patch<{ formando: { id: number } | null }>(`/v1/formandos-fin/${id}`, corpo);
}

export function apiApagarFormando(regime: Regime, id: number) {
  return enviar.delete<{ ok: boolean }>(`/v1/formandos-${regime}/${id}`);
}

export function apiAcessoFormando(regime: Regime, id: number, opts: { repor?: boolean; enviarEmail?: boolean }) {
  return enviar.post<{ acesso: { email: string; password?: string; criado: boolean; reposto: boolean; emailEnviado: boolean } }>(
    `/v1/formandos/${regime}/${id}/acesso`, opts,
  );
}

export function apiValidarDocFormando(regime: Regime, id: number, docId: string) {
  return enviar.post<unknown>(`/v1/formandos/${regime}/${id}/documentos/${encodeURIComponent(docId)}/validar`);
}

export function apiRecusarDocFormando(regime: Regime, id: number, docId: string, observacao: string) {
  return enviar.post<unknown>(`/v1/formandos/${regime}/${id}/documentos/${encodeURIComponent(docId)}/recusar`, { observacao });
}

/** Marca um documento como entregue (sem ficheiro no GesForma, ex.: em papel) ou retira a marca. */
export function apiMarcarDocFormando(regime: Regime, id: number, docId: string, ok: boolean) {
  return enviar.put<{ ok: boolean }>(`/v1/formandos/${regime}/${id}/docs`, {
    docs: [{ id: docId, ok, fileName: "", data: ok ? hojeLisboa() : "" }],
  });
}

export function apiNotaFormando(regime: Regime, id: number, texto: string) {
  return enviar.post<{ nota: { id: number } }>(`/v1/formandos/${regime}/${id}/notas`, { texto });
}

export function apiPedirPagamentoFormando(id: number) {
  return enviar.post<{ ok: boolean; valor: number }>(`/v1/formandos/gold/${id}/pedir-pagamento`);
}

export function apiRegistarPagamentoFormando(id: number, corpo: { metodo: string; valor?: number; data?: string }) {
  return enviar.post<{ ok: boolean }>(`/v1/formandos/gold/${id}/registar-pagamento`, corpo);
}

export function apiLembreteDocsFin(id: number) {
  return enviar.post<{ ok: boolean }>(`/v1/formandos-fin/${id}/lembrete-documentos`);
}

/** Dados para o financiamento (execução física). `daInscricao`: campos que ainda vêm da pré-inscrição. */
export type FinanciamentoFormando = { dados: DadosFinanciamento; daInscricao: (keyof DadosFinanciamento)[] };

export function apiFinanciamentoFormando(id: number, signal?: AbortSignal) {
  return api<FinanciamentoFormando>(`/v1/formandos-fin/${id}/financiamento`, { signal });
}

export function apiAlterarFinanciamentoFormando(id: number, corpo: Partial<DadosFinanciamento>) {
  return enviar.patch<FinanciamentoFormando>(`/v1/formandos-fin/${id}/financiamento`, corpo);
}

// ─── Financiada › Inscrições ─────────────────────────────────────────────────

export const ESTADOS_INSCRICAO_FIN = ["Recebida", "Em análise", "Elegível", "Colocado na turma", "Indeferido"] as const;
export type EstadoInscricaoFin = (typeof ESTADOS_INSCRICAO_FIN)[number];

export type LinhaInscricaoFin = {
  id: number; inscrito: string; nome: string; apelido: string; email: string; telf: string; curso: string; ufcd: string;
  turma: string; turmaId: number | null; estado: EstadoInscricaoFin; docs: Record<string, boolean>; docsValidados: number; formandoId: number | null;
};

export type ListaInscricoesFin = Pagina<LinhaInscricaoFin> & { contagens: Record<string, number>; docsTipos: string[] };

export type FiltrosInscricoesFin = { estado?: string; curso?: string; turma?: string; docs?: string; q?: string; pagina?: number; porPagina?: number; ordem?: string };

export function apiListarInscricoesFin(f: FiltrosInscricoesFin, signal?: AbortSignal) {
  return api<ListaInscricoesFin>(`/v1/inscricoes-fin${qs(f)}`, { signal });
}

export type CorpoInscricaoFin = {
  nome: string; apelido?: string; email?: string; telf?: string; curso: string; turma?: string; estado?: EstadoInscricaoFin; docs?: Record<string, boolean>;
};

export function apiCriarInscricaoFin(corpo: CorpoInscricaoFin) {
  return enviar.post<{ id: number; aviso: string | null }>("/v1/inscricoes-fin", corpo);
}

export function apiAlterarInscricaoFin(id: number, corpo: Partial<CorpoInscricaoFin>) {
  return enviar.patch<{ id: number; aviso: string | null }>(`/v1/inscricoes-fin/${id}`, corpo);
}

export function apiApagarInscricaoFin(id: number) {
  return enviar.delete<{ ok: boolean }>(`/v1/inscricoes-fin/${id}`);
}

/** Documentos de elegibilidade de um formando da Financiada (estado de cada um). */
export type DocsFormandoFin = { formandoId: number; documentos: { id: string; label: string; required: boolean; estado: string; validadoEm: string }[] };

export function apiDocumentosFormandoFin(id: number, signal?: AbortSignal) {
  return api<DocsFormandoFin>(`/v1/formandos/fin/${id}/documentos`, { signal });
}
