// API do diretório comercial: clientes, parceiros, propostas, contratos e modelos.
import { api, enviar, qs, type Pagina } from "./cliente";

export type EstadoProposta = "Enviada" | "Negociação" | "Aceite" | "Recusada" | "Expirada";
export type EstadoContrato = "Rascunho" | "Por assinar" | "Assinado" | "Cancelado";
export const ESTADOS_PROPOSTA: EstadoProposta[] = ["Enviada", "Negociação", "Aceite", "Recusada", "Expirada"];
export const ESTADOS_CONTRATO: EstadoContrato[] = ["Rascunho", "Por assinar", "Assinado", "Cancelado"];

export type ClienteResumo = {
  id: number; nome: string; email: string; telf: string; nif: string; notas: string;
  propostas: number; emAberto: number; contratos: number; ultimoEstado: string; ultimoCurso: string;
};
export type ClienteFicha = {
  id: number; nome: string; email: string; telf: string; nif: string; notas: string; criadoEm: string | null;
  propostas: { id: number; curso: string; valor: number; estado: string; corpo: string; enviadaEm: string | null; respostaCliente: string; comercial: string; contratoId: number | null }[];
  contratos: { id: number; curso: string; valor: number; estado: string; criadoEm: string | null; assinadoEm: string | null; propostaId: number | null }[];
};
export type DadosCliente = { nome: string; email: string; telf: string; nif: string; notas: string };

export type Parceiro = {
  id: number; nome: string; email: string; telf: string; tipo: string; notas: string;
  comercialId: string | null; comercial: string; retribuicao: string; criadoEm: string | null;
};
export type DadosParceiro = Omit<Parceiro, "id" | "comercial" | "criadoEm">;

export type TipoModelo = "proposta" | "contrato";
export type Modelo = { id: number; tipo: TipoModelo; nome: string; curso: string; valor: number; corpo: string; usos: number; alteradoEm: string | null };
export type DadosModelo = { nome: string; curso: string; valor: number; corpo: string };

export type Proposta = {
  id: number; clienteId: number | null; clienteNome: string; clienteEmail: string; curso: string; valor: number;
  estado: string; enviadaEm: string | null; respostaCliente: string; respostaEm: string | null; notas: string; corpo: string;
  templateId: number | null; preinscricaoId: number | null; regime: string; comercialId: string; comercial: string; contratoId: number | null;
};
export type Contrato = {
  id: number; clienteId: number | null; clienteNome: string; clienteEmail: string; curso: string; valor: number; estado: string;
  notas: string; corpo: string; templateId: number | null; modelo: string; propostaId: number | null;
  assinadoEm: string | null; criadoEm: string | null; alteradoEm: string | null; comercial: string;
};
export type Fase = { estado: string; n: number; valor: number };

type Sinal = { signal?: AbortSignal };

export const apiClientes = (f: { q?: string; estado?: string; pagina?: number; porPagina?: number; ordem?: string }, o: Sinal = {}) =>
  api<Pagina<ClienteResumo> & { resumo: { clientes: number; emAberto: number; comContrato: number } }>(
    `/v1/crm/clientes${qs(f)}`, { silencioso: true, signal: o.signal },
  );
export const apiCliente = (id: number, o: Sinal = {}) => api<{ cliente: ClienteFicha }>(`/v1/crm/clientes/${id}`, { silencioso: true, signal: o.signal });
export const apiCriarCliente = (d: DadosCliente) => enviar.post<{ cliente: DadosCliente & { id: number } }>("/v1/crm/clientes", d);
export const apiAlterarCliente = (id: number, d: Partial<DadosCliente>) => enviar.patch<{ ok: true }>(`/v1/crm/clientes/${id}`, d);
export const apiApagarCliente = (id: number) => enviar.delete<{ ok: true }>(`/v1/crm/clientes/${id}`);
export const apiPropostaCliente = (id: number, d: { curso: string; valor: number; corpo: string; templateId?: number | null; comercialId?: string; notas?: string }) =>
  enviar.post<{ proposta: { id: number } }>(`/v1/crm/clientes/${id}/propostas`, d);

export const apiParceiros = (f: { q?: string; tipo?: string; comercial?: string }, o: Sinal = {}) =>
  api<{ parceiros: Parceiro[] }>(`/v1/crm/parceiros${qs(f)}`, { silencioso: true, signal: o.signal });
export const apiCriarParceiro = (d: DadosParceiro) => enviar.post<{ parceiro: Parceiro }>("/v1/crm/parceiros", d);
export const apiAlterarParceiro = (id: number, d: Partial<DadosParceiro>) => enviar.patch<{ ok: true }>(`/v1/crm/parceiros/${id}`, d);
export const apiApagarParceiro = (id: number) => enviar.delete<{ ok: true }>(`/v1/crm/parceiros/${id}`);

export const apiModelos = (tipo: TipoModelo, o: Sinal = {}) => api<{ modelos: Modelo[] }>(`/v1/crm/modelos/${tipo}`, { silencioso: true, signal: o.signal });
export const apiCriarModelo = (tipo: TipoModelo, d: DadosModelo) => enviar.post<{ modelo: Modelo }>(`/v1/crm/modelos/${tipo}`, d);
export const apiAlterarModelo = (tipo: TipoModelo, id: number, d: Partial<DadosModelo>) => enviar.patch<{ modelo: Modelo }>(`/v1/crm/modelos/${tipo}/${id}`, d);
export const apiApagarModelo = (tipo: TipoModelo, id: number) => enviar.delete<{ ok: true }>(`/v1/crm/modelos/${tipo}/${id}`);

export const apiPropostas = (f: { q?: string; estado?: string; comercial?: string; regime?: string; cliente?: number; pagina?: number }, o: Sinal = {}) =>
  api<Pagina<Proposta> & { fases: Fase[] }>(`/v1/crm/propostas${qs(f)}`, { silencioso: true, signal: o.signal });
export const apiProposta = (id: number, o: Sinal = {}) => api<{ proposta: Proposta }>(`/v1/crm/propostas/${id}`, { silencioso: true, signal: o.signal });
/** O texto, o curso e o valor deixam de se alterar quando já há um contrato assinado desta proposta (409). */
export const apiAlterarProposta = (id: number, d: { estado?: string; respostaCliente?: string; valor?: number; notas?: string; curso?: string; corpo?: string }) =>
  enviar.patch<{ proposta: Proposta }>(`/v1/equipa/propostas/${id}`, d);

export const apiContratos = (f: { q?: string; estado?: string; pagina?: number }, o: Sinal = {}) =>
  api<Pagina<Contrato> & { fases: Fase[] }>(`/v1/crm/contratos${qs(f)}`, { silencioso: true, signal: o.signal });
export const apiContrato = (id: number, o: Sinal = {}) => api<{ contrato: Contrato }>(`/v1/crm/contratos/${id}`, { silencioso: true, signal: o.signal });
export const apiCriarContrato = (d: {
  clienteNome: string; clienteEmail?: string; curso?: string; valor?: number; notas?: string; corpo?: string;
  templateId?: number | null; clienteId?: number | null; propostaId?: number | null; comercialId?: string;
}) => enviar.post<{ contrato: Contrato }>("/v1/crm/contratos", d);
export const apiAlterarContrato = (id: number, d: Partial<Pick<Contrato, "clienteNome" | "clienteEmail" | "curso" | "valor" | "estado" | "notas" | "corpo">>) =>
  enviar.patch<{ contrato: Contrato }>(`/v1/crm/contratos/${id}`, d);
export const apiApagarContrato = (id: number) => enviar.delete<{ ok: true }>(`/v1/crm/contratos/${id}`);
