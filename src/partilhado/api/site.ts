// API do domínio "site": definições (`app_settings`), conteúdo do site e imagens do topo.
import type { ServicoSite } from "../siteServicos";
import { api, enviar, enviarFicheiro } from "./cliente";

/** Avaliações da ENA no Google (cópia guardada no servidor; lista vazia se não estiver configurado). */
export type AvaliacoesGooglePublicas = {
  rating: number | null; total: number; url: string;
  avaliacoes: { autor: string; autorUrl: string; foto: string; estrelas: number; texto: string; quando: string; data: string }[];
};
export const apiAvaliacoesGooglePublicas = () => api<AvaliacoesGooglePublicas>("/v1/public/avaliacoes-google");

/** Testemunhos dos formandos: o próprio (área do formando), a revisão (backoffice) e os aprovados (site). */
export type EstadoTestemunho = "pendente" | "aprovado" | "recusado";
export type TestemunhoFormando = { id: number; nome: string; curso: string; texto: string; estrelas: number; autorizaPublicar: boolean; estado: EstadoTestemunho; atualizadoEm: string };
export type DadosTestemunho = Pick<TestemunhoFormando, "nome" | "curso" | "texto" | "estrelas" | "autorizaPublicar">;
export const apiMeuTestemunho = () => api<{ testemunho: TestemunhoFormando | null }>("/v1/area-formando/testemunho");
export const apiGravarMeuTestemunho = (d: DadosTestemunho) => enviar.put<{ testemunho: TestemunhoFormando }>("/v1/area-formando/testemunho", d);
export const apiApagarMeuTestemunho = () => enviar.delete<{ ok: boolean }>("/v1/area-formando/testemunho");
export const apiTestemunhos = (estado?: EstadoTestemunho, signal?: AbortSignal) =>
  api<{ testemunhos: (TestemunhoFormando & { email: string })[] }>(`/v1/testemunhos${estado ? `?estado=${estado}` : ""}`, { signal });
export const apiReverTestemunho = (id: number, estado: EstadoTestemunho) => enviar.patch<{ id: number; estado: EstadoTestemunho }>(`/v1/testemunhos/${id}`, { estado });
export const apiApagarTestemunho = (id: number) => enviar.delete<{ ok: boolean }>(`/v1/testemunhos/${id}`);
export type CursoSugerido = { id: string; titulo: string; area: string; modalidade: string; inicio: string; preco: string; imagem: string | null };
export const apiSugestoesCursos = () => api<{ cursos: CursoSugerido[] }>("/v1/area-formando/sugestoes");
export const apiTestemunhosPublicos = () => api<{ testemunhos: DadosTestemunho[] }>("/v1/public/testemunhos");

export type Definicoes = Record<string, Record<string, string>>;

export const apiDefinicoes = (signal?: AbortSignal) => api<{ settings: Definicoes }>("/v1/settings", { signal });

export const apiGravarDefinicao = (id: string, values: Record<string, string>) =>
  enviar.put<{ ok: boolean; id: string; values: Record<string, string> }>(`/v1/settings/${encodeURIComponent(id)}`, { values });

/** Páginas do editor visual (JSON dos blocos do Puck). */
export type PaginaEditor = { rascunho: unknown; publicado: unknown; publicadoEm: string | null; atualizadoEm: string | null };
export const apiPaginaSite = (pagina: string, signal?: AbortSignal) =>
  api<PaginaEditor>(`/v1/site/paginas/${encodeURIComponent(pagina)}`, { signal });
export const apiRascunhoPagina = (pagina: string, dados: unknown) =>
  enviar.put<{ ok: boolean }>(`/v1/site/paginas/${encodeURIComponent(pagina)}/rascunho`, { dados });
export const apiPublicarPagina = (pagina: string, dados: unknown) =>
  enviar.put<{ ok: boolean }>(`/v1/site/paginas/${encodeURIComponent(pagina)}/publicar`, { dados });
export const apiImagemSite = (ficheiro: File) => enviarFicheiro<{ nome: string; url: string }>("/v1/site/imagem", ficheiro);

/** Serviços para empresas (Gestão › Empresas / Business). */
export type DadosServico = Omit<ServicoSite, "slug">;
export type Servico = { id: number; slug: string; ordem: number; ativo: boolean; dados: DadosServico; atualizadoEm: string };
export type GravarServico = { slug: string; ordem?: number; ativo: boolean; dados: DadosServico };
export const apiServicos = (signal?: AbortSignal) => api<{ servicos: Servico[] }>("/v1/servicos", { signal });
export const apiCriarServico = (s: GravarServico) => enviar.post<{ servico: Servico }>("/v1/servicos", s);
export const apiGravarServico = (id: number, s: GravarServico) => enviar.put<{ servico: Servico }>(`/v1/servicos/${id}`, s);
export const apiApagarServico = (id: number) => enviar.delete<{ ok: boolean }>(`/v1/servicos/${id}`);

/** Pedidos de proposta do site (formulários das páginas Empresas e de serviço). */
export type EstadoPedido = "novo" | "contactado" | "proposta" | "arquivado";
export type PedidoProposta = { id: number; nome: string; empresa: string; email: string; telefone: string; servico: string; mensagem: string; estado: EstadoPedido; clienteId: number | null; criadoEm: string };
export const apiPedidosProposta = (estado?: EstadoPedido, signal?: AbortSignal) =>
  api<{ pedidos: PedidoProposta[] }>(`/v1/pedidos-proposta${estado ? `?estado=${estado}` : ""}`, { signal });
export const apiEstadoPedido = (id: number, estado: EstadoPedido) => enviar.patch<{ id: number; estado: EstadoPedido }>(`/v1/pedidos-proposta/${id}`, { estado });
