// API do domínio "pedagogia": sessões, dossiê da turma, avaliação, certificados, regras de turma e relatórios.
import { api, BASE, ApiError } from "./cliente";

export type Regime = "gold" | "fin";

export type DtpEstado = "ok" | "parcial" | "falta";

export type DtpItem = {
  id: string;
  fase: "antes" | "durante" | "depois";
  label: string;
  fonte: string;
  hint: string;
  estado: DtpEstado;
  detalhe: string;
  topico?: number;
  origem: "auto" | "manual";
  universal?: boolean;
  bloqueante?: boolean;
  obrigatorio?: boolean;
  /** Documento acrescentado na ficha do curso, fora da base do regime. */
  extra?: boolean;
  ambito?: DtpAmbito;
  anexo?: { fileName: string; url: string; driveFileId: string } | null;
  /** Ficheiros do percurso público: submetido ainda não é validado pela secretaria. */
  percurso?: { submetidos: number; validados: number; recusados: number; total: number };
};

export type DtpSnapshot = {
  items: DtpItem[];
  pct: number;
  ok: number;
  parcial: number;
  falta: number;
  total: number;
  /** Nome da entidade responsável cuja estrutura este dossiê usa. */
  entidade?: string | null;
  facts: {
    sessoes: { done: number; total: number };
    planos: { done: number; total: number };
    sumarios: { done: number; total: number };
    presencas: { done: number; total: number };
    formandos: number;
    certificados: { done: number; total: number };
  };
};

export type SessaoPedagogica = {
  n: number;
  sessaoId?: string | null;
  plano: Record<string, unknown> | null;
  sumario: Record<string, unknown> | null;
  presencas: { id: number; nome: string; presente: boolean; estado?: "presente" | "falta_justificada" | "falta_injustificada" | "atraso"; minutos?: number; justificacao?: string }[];
  /** Horas teóricas / práticas da sessão e quem validou as presenças. */
  folha?: Record<string, unknown> | null;
};

export type TurmaDocumento = {
  grupoId: string;
  label: string;
  estado: DtpEstado;
  detalhe: string;
  payload: unknown;
};

export type TurmaCertificado = {
  formandoId: number;
  emitido: boolean;
  nota: number | null;
  elearning: number | null;
  ficheiroId?: string;
  ficheiroNome?: string;
  ficheiroUrl?: string;
};

export type PedagogiaSnapshot = {
  sessoes: SessaoPedagogica[];
  documentos: TurmaDocumento[];
  certificados: TurmaCertificado[];
  dtp: DtpSnapshot;
  /** Sessões (n) com plano definido na ficha do curso: o formador só as consulta. */
  planosDoCurso?: number[];
};

/** O formador não recebe o `dtp` (fica fora do dossiê). */
export const apiPedagogia = (regime: Regime, turmaId: number) =>
  api<Omit<PedagogiaSnapshot, "dtp"> & { dtp?: DtpSnapshot }>(`/v1/turmas/${regime}/${turmaId}/pedagogia`);

export const apiSaveSessao = (
  regime: Regime,
  turmaId: number,
  n: number,
  /** `sessaoId` é a verdade (os dados seguem a sessão se ela mudar de lugar); `n` só serve sem ele. */
  body: { sessaoId?: string; plano?: unknown; sumario?: unknown; presencas?: unknown; folha?: unknown; validarPresencas?: boolean },
) => api<{ sessao: SessaoPedagogica }>(`/v1/turmas/${regime}/${turmaId}/sessoes/${n}`, { method: "PUT", body: JSON.stringify(body) });

export const apiSaveTurmaDocumento = (regime: Regime, turmaId: number, body: TurmaDocumento) =>
  api<{ ok: boolean }>(`/v1/turmas/${regime}/${turmaId}/documentos`, { method: "PUT", body: JSON.stringify(body) });

export const apiSaveDtpItem = (regime: Regime, turmaId: number, itemId: string, estado: DtpEstado | "auto") =>
  api<{ dtp: DtpSnapshot }>(`/v1/turmas/${regime}/${turmaId}/dtp/${itemId}`, { method: "PUT", body: JSON.stringify({ estado }) });

export const apiSaveDtpAnexo = (
  regime: Regime,
  turmaId: number,
  itemId: string,
  body: { driveFileId: string; fileName: string; driveUrl?: string },
) =>
  api<{ dtp: DtpSnapshot }>(`/v1/turmas/${regime}/${turmaId}/dtp/${itemId}/anexo`, { method: "PUT", body: JSON.stringify(body) });

export const apiSaveCertificado = (
  regime: Regime,
  turmaId: number,
  formandoId: number,
  body: {
    emitido?: boolean;
    nota?: number | null;
    elearning?: number | null;
    ficheiroId?: string;
    ficheiroNome?: string;
    ficheiroUrl?: string;
  },
) => api<{ ok: boolean }>(`/v1/turmas/${regime}/${turmaId}/certificados/${formandoId}`, { method: "PUT", body: JSON.stringify(body) });

export type NotaAvaliacaoApi = { formandoId: number; moduloId: string; parametroId: string; nota: number | null };

export const apiTurmaAvaliacao = (regime: Regime, turmaId: number) =>
  api<{ notas: NotaAvaliacaoApi[] }>(`/v1/turmas/${regime}/${turmaId}/avaliacao`);

export const apiSaveTurmaAvaliacao = (regime: Regime, turmaId: number, notas: NotaAvaliacaoApi[]) =>
  api<{ ok: boolean }>(`/v1/turmas/${regime}/${turmaId}/avaliacao`, { method: "PUT", body: JSON.stringify({ notas }) });

export const apiDtpResumo = (regime: Regime) => api<{ pct: Record<string, number> }>(`/v1/dtp/${regime}`);

export type DtpFase = "antes" | "durante" | "depois";

export type DtpDef = {
  id: string;
  fase: DtpFase;
  label: string;
  fonte: string;
  hint: string;
  bloqueante?: boolean;
  obrigatorio?: boolean;
  universal?: boolean;
};

export type DtpAmbito = "turma" | "formando" | "formador";

export type DtpExtra = {
  id?: string;
  fase: DtpFase;
  label: string;
  fonte?: string;
  hint?: string;
  bloqueante?: boolean;
  ambito?: DtpAmbito;
};

export type DtpModelo = {
  excluidos: string[];
  incluidos?: string[];
  extra: { id: string; fase: DtpFase; label: string; fonte: string; hint: string; bloqueante?: boolean; ambito?: DtpAmbito }[];
};

export type DtpEntidadeRef = { id: number; nome: string; modelo: DtpModelo };

export type DtpModeloResposta = {
  fases: { id: DtpFase; label: string; hint: string }[];
  base: DtpDef[];
  modelo: DtpModelo;
  entidade: DtpEntidadeRef | null;
  efectivo?: DtpModelo;
  estrutura: DtpDef[];
};

export type DtpEntidade = { id: number; nome: string; documentos: number };

export const apiDtpEntidades = () => api<{ entidades: DtpEntidade[] }>("/v1/dtp/gold/entidades");

export const apiCreateDtpEntidade = (nome: string) =>
  api<{ entidade: DtpEntidade }>("/v1/dtp/gold/entidades", { method: "POST", body: JSON.stringify({ nome }) });

export const apiDtpModelo = (regime: Regime, cursoId: number) =>
  api<DtpModeloResposta>(`/v1/cursos/${regime}/${cursoId}/dtp-modelo`);

export const apiSaveDtpModelo = (regime: Regime, cursoId: number, body: { excluidos: string[]; incluidos?: string[]; extra: DtpExtra[] }) =>
  api<DtpModeloResposta>(`/v1/cursos/${regime}/${cursoId}/dtp-modelo`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

export type TurmaRegra = {
  id: number; regime: "gold" | "fin"; curso: string; local: string; horario: string;
  vagas: number; horas: number; horasSessao: number; formador: string;
  proximaData: string; nomePrefixo: string; activa: boolean;
};

export const apiTurmaRegras = (regime?: "gold" | "fin") =>
  api<{ regras: TurmaRegra[] }>(`/v1/turma-regras${regime ? `?regime=${regime}` : ""}`);

export const apiCreateTurmaRegra = (body: Record<string, unknown>) =>
  api<{ id: number }>("/v1/turma-regras", { method: "POST", body: JSON.stringify(body) });

export const apiDeleteTurmaRegra = (id: number) =>
  api<{ ok: boolean }>(`/v1/turma-regras/${id}`, { method: "DELETE" });

export const apiAplicarTurmaRegras = (regime?: "gold" | "fin") =>
  api<{ n: number; criadas: { id: number; nome: string; regime: string }[] }>("/v1/turmas/auto-regras", {
    method: "POST", body: JSON.stringify({ regime }),
  });

export const apiPublicarCronograma = (regime: Regime, turmaId: number, sessoes: unknown[], versao?: string) =>
  api<{ ok: boolean; url: string; publicadoEm: string; ficheiro: string; versao: string }>(`/v1/turmas/${regime}/${turmaId}/cronograma/publicar`, {
    method: "POST",
    body: JSON.stringify({ sessoes, versao }),
  });

/** `aviso` quando a turma fechou mas o relatório não ficou anexado ao dossiê. */
export const apiTurmaFinFecho = (turmaId: number) =>
  api<{ ok: boolean; resumo: Record<string, unknown>; relatorioUrl: string; aviso?: string }>(`/v1/turmas/fin/${turmaId}/fecho`, { method: "POST" });

export const apiTurmaGoldFecho = (turmaId: number) =>
  api<{ ok: boolean; resumo: Record<string, unknown> }>(`/v1/turmas/gold/${turmaId}/fecho`, { method: "POST" });

/** Só o administrador (`turmas.reabrir`); o motivo fica na auditoria. */
export const apiReabrirTurma = (regime: Regime, turmaId: number, motivo: string) =>
  api<{ ok: boolean }>(`/v1/turmas/${regime}/${turmaId}/reabrir`, { method: "POST", body: JSON.stringify({ motivo }) });

export function apiRelatorioFinalTurma(turmaId: number) {
  return descarregarFicheiro(`/v1/turmas/fin/${turmaId}/relatorio-final`, "RelatorioFinalAccao.pdf", "application/pdf");
}

/** Listagem dos formandos da turma (PDF; na Financiada com os logótipos da DGERT, do programa e da UE). */
export function apiListagemFormandos(regime: Regime, turmaId: number) {
  return descarregarFicheiro(`/v1/turmas/${regime}/${turmaId}/relatorio-formandos`, "ListagemFormandos.pdf", "application/pdf");
}

export function apiRelatorioInqueritosTurma(turmaId: number) {
  return descarregarFicheiro(`/v1/turmas/fin/${turmaId}/inqueritos/relatorio`, "RelatorioPosFormacao.pdf", "application/pdf");
}

export function apiRelatorioEstatisticoTurma(turmaId: number) {
  return descarregarFicheiro(`/v1/turmas/fin/${turmaId}/relatorio-estatistico`, "RelatorioEstatistico.pdf", "application/pdf");
}

export function apiDossieGerado(turmaId: number, itemId: string, fallback: string) {
  return descarregarFicheiro(`/v1/turmas/fin/${turmaId}/dossie/${encodeURIComponent(itemId)}`, fallback, "application/pdf");
}

/** Folhas de presenças / sumário da Financiada no modelo da candidatura (todas as sessões lectivas, ou só a sessão n). */
export function apiFolhasPresencaFin(turmaId: number, sessao?: number) {
  return descarregarFicheiro(`/v1/turmas/fin/${turmaId}/folhas-presenca${sessao ? `?sessao=${sessao}` : ""}`,
    sessao ? `Folhas de presenca e sumarios - sessao ${sessao}.pdf` : "Folhas de presenca e sumarios.pdf", "application/pdf");
}

/** Plano de sessão da Financiada no modelo da candidatura (só a sessão n, ou todos). */
export function apiPlanosSessaoFin(turmaId: number, sessao?: number) {
  return descarregarFicheiro(`/v1/turmas/fin/${turmaId}/planos-sessao${sessao ? `?sessao=${sessao}` : ""}`,
    sessao ? `Planos de sessao - sessao ${sessao}.pdf` : "Planos de sessao.pdf", "application/pdf");
}

export function apiPerguntasInqueritoTurma(turmaId: number, publico: "formador" | "formando" | "pos") {
  const nome = publico === "formador"
    ? "PerguntasInqueritoFormador.pdf"
    : publico === "pos"
      ? "PerguntasInqueritoPos.pdf"
      : "PerguntasInqueritoFormandos.pdf";
  return descarregarFicheiro(`/v1/turmas/fin/${turmaId}/inqueritos/perguntas?publico=${publico}`, nome, "application/pdf");
}

export async function apiDtpExport(regime: Regime, turmaId: number, filename?: string) {
  const headers = new Headers();
  headers.set("Accept", "application/zip");
  headers.set("X-Gesforma-Client", "web");
  const res = await fetch(`${BASE}/v1/dtp/${regime}/${turmaId}/export`, { credentials: "include", headers });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, typeof data.error === "string" ? data.error : "exportação recusada");
  }
  // Na cloud o ZIP fica na pasta da turma na Drive (a resposta não leva ficheiros grandes): abre-se a ligação.
  if ((res.headers.get("content-type") ?? "").includes("application/json")) {
    const data = await res.json().catch(() => ({})) as { drive?: { url?: string } };
    if (!data.drive?.url) throw new ApiError(502, "exportação sem ligação para o ZIP");
    window.open(data.drive.url, "_blank", "noopener,noreferrer");
    return;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const cd = res.headers.get("content-disposition") ?? "";
  const named = cd.match(/filename="([^"]+)"/)?.[1];
  a.download = named || filename || `dtp-${turmaId}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function descarregarFicheiro(path: string, fallback: string, accept: string) {
  const headers = new Headers();
  headers.set("Accept", accept);
  headers.set("X-Gesforma-Client", "web");
  const res = await fetch(`${BASE}${path}`, { credentials: "include", headers });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, typeof data.error === "string" ? data.error : "exportação recusada");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const cd = res.headers.get("content-disposition") ?? "";
  const named = cd.match(/filename="([^"]+)"/)?.[1];
  a.download = named || fallback;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Resultados da turma (assiduidade, notas, elegibilidade). O formador só vê as turmas onde dá aulas. */
export type ResultadoFormandoApi = {
  id: number; nome: string; estado: string;
  nota: number | null; aprovado: boolean | null; elearning: number | null;
  assiduidade: { pct: number | null }; assiduidadeMinima: number;
  elegivel: boolean; motivos: string[];
  certificado: { emitido: boolean; ficheiro: boolean };
};

export type ResultadosTurma = {
  turma: { id: number; nome: string; curso: string; fechada: boolean };
  avaliacao: { modo: string; escalaMin: number; escalaMax: number; minimoAprovacao: number; unidade: string };
  regras: { dtpBloqueiaFecho: boolean; elearningMin: number };
  formandos: ResultadoFormandoApi[];
  /** Só para a equipa (o formador recebe null). */
  fecho: { pode: boolean; falta: string[] } | null;
};

export const apiResultadosTurma = (regime: Regime, turmaId: number, signal?: AbortSignal) =>
  api<ResultadosTurma>(`/v1/turmas/${regime}/${turmaId}/resultados`, { signal });

/** Copia para a turma os planos de sessão da ficha do curso (com `substituir`, também os já preenchidos e por assinar). */
export const apiImportarPlanosCurso = (regime: Regime, turmaId: number, substituir: boolean, origemTurmaId?: number) =>
  api<{ importados: number; mantidos: number; semModelo: number; sumarios?: number }>(`/v1/turmas/${regime}/${turmaId}/planos/importar`, {
    method: "POST", body: JSON.stringify({ substituir, ...(origemTurmaId ? { origemTurmaId } : {}) }),
  });

/** Outras turmas do mesmo curso (turma padrão de onde copiar planos e sumários). */
export const apiOrigensPlanos = (regime: Regime, turmaId: number) =>
  api<{ turmas: { id: number; nome: string; dataInicio: string }[] }>(`/v1/turmas/${regime}/${turmaId}/planos/origens`);
