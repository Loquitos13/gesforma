// API pública (site, ligação pessoal, inquéritos, cronograma) e área do formando.
import { api, BASE, ApiError } from "./cliente";
import type { Regime } from "./pedagogia";

export type AreaFormandoDados = {
  pessoa: {
    nome: string; apelido: string; email: string; telf: string; novidades: boolean;
    canais: { email: boolean; sms: boolean; whatsapp: boolean; plataforma: boolean };
  };
  cursos: { id: string; regime: "gold" | "fin"; titulo: string; turma: string; estado: string; progresso: number; sessoes: number; feitas: number; ultimo: string; modulos: string[] }[];
  agenda: { id: string; cursoId: string; data: string; dia: string; mes: string; ano: string; titulo: string; curso: string; horas: string; futura: boolean }[];
  certificados: { id: string; curso: string; data: string; nota: string; url: string; nome: string }[];
  pagamentos: { id: string; curso: string; data: string; valor: string; estado: string; metodo: string }[];
  notificacoes: { id: string; titulo: string; texto: string; quando: string; porLer: boolean }[];
  resumo: { cursos: number; progresso: number; certificados: number };
  financiada: boolean;
  documentosFin: FormandoFinDocsBloco[];
};

export type FormandoFinDocEstado = "validado" | "recusado" | "pendente" | "em_falta";

export type FormandoFinDocLinha = {
  id: string;
  label: string;
  required: boolean;
  estado: FormandoFinDocEstado;
  observacao: string;
  fileName: string;
  driveUrl: string;
  validadoEm: string;
  validadoPor: string;
};

export type FormandoFinDocsVista = {
  formandoId: number;
  nome: string;
  curso: string;
  email: string;
  token: string;
  url: string;
  documentos: FormandoFinDocLinha[];
  recusados: string[];
  completo: boolean;
};

export type FormandoFinDocsBloco = {
  formandoId: number;
  curso: string;
  url: string;
  completo: boolean;
  documentos: FormandoFinDocLinha[];
};

export const apiAreaFormando = () => api<AreaFormandoDados>("/v1/area-formando");

export const apiPatchAreaFormando = (body: Partial<Pick<AreaFormandoDados, "pessoa">> & { nome?: string; apelido?: string; telf?: string; novidades?: boolean; canais?: AreaFormandoDados["pessoa"]["canais"]; lidas?: string[] }) =>
  api<AreaFormandoDados>("/v1/area-formando", { method: "PATCH", body: JSON.stringify(body) });

export const apiNoticias = () => api<{ noticias: { titulo: string; slug: string; data: string; tematica: string; excerto: string }[] }>("/v1/public/noticias");

export const apiNoticia = (slug: string) =>
  api<{ noticia: { titulo: string; slug: string; data: string; tematica: string; corpo: string }; outras: { titulo: string; slug: string; data: string; tematica: string }[] }>(`/v1/public/noticias/${encodeURIComponent(slug)}`);

export type InqueritoPublico = {
  id: number;
  titulo: string;
  perguntas: { id: number; tipo: string; texto: string; opcoes: string[] }[];
};

export const apiPublicInquerito = (token: string) =>
  api<InqueritoPublico>(`/v1/public/inqueritos/${encodeURIComponent(token)}`);

export const apiPublicInqueritoResposta = (
  token: string,
  body: { turma?: string; formando?: string; respostas: Record<string, unknown> },
) => api<{ ok: boolean }>(`/v1/public/inqueritos/${encodeURIComponent(token)}/respostas`, {
  method: "POST",
  body: JSON.stringify(body),
});

export type PagamentoPercurso = {
  valor: number;
  estado: string;
  iban: string;
  titular: string;
  comprovativo: { id: number; tipo: string; nome: string; estado?: string; observacao?: string } | null;
};

export type TurmaPercurso = {
  id: number;
  nome: string;
  local: string;
  horario: string;
  dataInicio: string;
  livres: number;
  vagasMostradas?: number;
  sessoes: { data: string; inicio: string; fim: string; modalidade?: string; modulos?: string[]; formadores?: string[] }[];
  plano?: { id: string; data: string; horaInicio: string; horaFim: string; modalidade: string; modulos: string[]; formadores: string[] }[];
};

export const apiPublicDocumentos = (token: string) =>
  api<{
    nome: string; curso: string; preco?: number;
    tipos: { id: string; label: string; required?: boolean; modelo?: string }[];
    ficheiros: { id: number; tipo: string; nome: string; created_at: string; estado?: string; observacao?: string }[];
    docsCompletos?: boolean;
    emFalta?: string[];
    /** Passo de pagamento aberto: a secretaria pediu o pagamento e ainda não está confirmado. */
    precisaPagamento?: boolean;
    pago?: boolean;
    pagamento?: PagamentoPercurso | null;
    encerrada?: boolean;
    /** Ligação encerrada: o servidor só devolve o motivo e a mensagem. */
    motivo?: "validada" | "desistiu" | "formando" | "expirada";
    mensagem?: string;
    primeiroNome?: string;
    correcao?: boolean;
    passo?: 1 | 2;
    percursoConcluido?: boolean;
    /** Falso na Financiada: a turma é atribuída pela secretaria. */
    escolheTurma?: boolean;
    turmas?: TurmaPercurso[];
    recomendadas?: TurmaPercurso[];
    breves?: TurmaPercurso[];
    turmaEscolhida?: TurmaPercurso | null;
    turmaCheia?: boolean;
    criterios?: { local: string; horario: string; inicio: string };
  }>(
    `/v1/public/documentos/${encodeURIComponent(token)}`,
  );

export function urlModeloPublico(token: string, tipo: string) {
  return `${BASE}/v1/public/documentos/${encodeURIComponent(token)}/modelo/${encodeURIComponent(tipo)}`;
}

export const apiPublicConsentir = (token: string, tipo: string) =>
  api<{ ok: boolean; nome: string }>(`/v1/public/documentos/${encodeURIComponent(token)}/consentir`, {
    method: "POST", body: JSON.stringify({ tipo }),
  });

export const apiPublicEscolherTurma = (token: string, turmaId: number) =>
  api<{ ok: boolean }>(`/v1/public/documentos/${encodeURIComponent(token)}/turma`, {
    method: "POST", body: JSON.stringify({ turmaId }),
  });

export const apiPublicConcluirPercurso = (token: string) =>
  api<{ ok: boolean }>(`/v1/public/documentos/${encodeURIComponent(token)}/concluir`, {
    method: "POST", body: JSON.stringify({}),
  });

export async function apiPublicDocumentoUpload(token: string, file: File, tipo: string) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("tipo", tipo);
  const headers = new Headers();
  headers.set("Accept", "application/json");
  headers.set("X-Gesforma-Client", "web");
  const res = await fetch(`${BASE}/v1/public/documentos/${encodeURIComponent(token)}`, {
    method: "POST", credentials: "include", headers, body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, typeof data.error === "string" ? data.error : "upload recusado");
  return data as { ok: boolean; nome: string };
}

export const apiPublicOferta = () =>
  api<{
    cursos: { nome: string; preco: number; regime?: "gold" | "fin"; inscricao?: "Acesso direto" | "Pré-pago" | "Pré-inscrição" }[];
    turmas: import("../oferta").OfertaTurma[];
    edicoes?: { curso: string; local?: string; horario?: string; inicio?: string; preco: number; status?: string }[];
  }>("/v1/public/oferta");

/** Contactos públicos da entidade (Configurações › Entidade, sem NIF nem IBAN). */
export type EntidadePublica = {
  nome: string; nomeCurto: string; morada: string; codigoPostal: string; localidade: string;
  telefone: string; email: string; site: string;
};

export const apiPublicEntidade = (signal?: AbortSignal) =>
  api<{ entidade: EntidadePublica }>("/v1/public/entidade", { signal, silencioso: true });

export type CronogramaPublico = {
  nome: string;
  curso: string;
  local: string;
  horario: string;
  inicio: string;
  formador: string;
  sessoes: { data: string; horaInicio: string; horaFim: string; modalidade: string; modulos: string[]; formadores: string[] }[];
  fim?: string;
  entidade: EntidadePublica;
};

export const apiPublicCronograma = (regime: Regime, turmaId: number) =>
  api<CronogramaPublico>(`/v1/public/cronograma/${regime}/${turmaId}`);

export const apiPublicPreinscricao = (body: Record<string, unknown>) =>
  api<{ preinscricao: { id: number }; aviso: string }>("/v1/public/preinscricoes", { method: "POST", body: JSON.stringify(body) });

export const apiPublicOpcoes = (lista: string) =>
  api<{ lista: string; opcoes: string[] }>(`/v1/public/opcoes?lista=${encodeURIComponent(lista)}`);

export async function apiPublicFormandoDocumentos(token: string) {
  const headers = new Headers();
  headers.set("Accept", "application/json");
  headers.set("X-Gesforma-Client", "web");
  const res = await fetch(`${BASE}/v1/public/formando-documentos/${encodeURIComponent(token)}`, {
    credentials: "include",
    headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, typeof data.error === "string" ? data.error : "ligação inválida");
  return data as FormandoFinDocsVista;
}

export async function apiPublicFormandoDocumentoUpload(token: string, tipo: string, file: File) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("tipo", tipo);
  const headers = new Headers();
  headers.set("Accept", "application/json");
  headers.set("X-Gesforma-Client", "web");
  const res = await fetch(`${BASE}/v1/public/formando-documentos/${encodeURIComponent(token)}`, {
    method: "POST",
    credentials: "include",
    headers,
    body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, typeof data.error === "string" ? data.error : "upload recusado");
  return data as { ok: boolean; nome: string; url: string };
}

export async function apiAreaFormandoDocumentoUpload(formandoId: number, tipo: string, file: File) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("tipo", tipo);
  const headers = new Headers();
  headers.set("Accept", "application/json");
  headers.set("X-Gesforma-Client", "web");
  const res = await fetch(`${BASE}/v1/area-formando/documentos/${formandoId}`, {
    method: "POST",
    credentials: "include",
    headers,
    body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, typeof data.error === "string" ? data.error : "upload recusado");
  return data as { ok: boolean; nome: string; url: string };
}

export type DadosFaturacao = { nome: string; nif: string; moradaFiscal: string; codigoPostal: string; email: string };

export const apiPublicFaturacao = (token: string) =>
  api<{ curso: string; preenchido: boolean; dados: DadosFaturacao }>(`/v1/public/faturacao/${encodeURIComponent(token)}`);

export const apiPublicFaturacaoGravar = (token: string, dados: DadosFaturacao) =>
  api<{ ok: boolean }>(`/v1/public/faturacao/${encodeURIComponent(token)}`, { method: "POST", body: JSON.stringify(dados) });
