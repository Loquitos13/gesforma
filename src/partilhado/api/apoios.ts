// API dos apoios da Financiada (server/src/rotas/formandos/apoios.ts).
import { api, enviar, qs } from "./cliente";
import { descarregarFicheiro } from "./pedagogia";

export type TipoApoio = "bolsa" | "alimentacao" | "transporte" | "acolhimento" | "alojamento";
export type ModoApoio = "hora" | "dia" | "mes";
export type EstadoApoio = "calculado" | "aprovado" | "pago" | "anulado";
export type AmbitoRegra = "turma" | "financiador" | "geral";

export type RegraApoio = {
  tipo: TipoApoio;
  ativo: boolean;
  modo: ModoApoio;
  valor: number;
  minHorasDia: number;
  tetoMensal: number | null;
  assiduidadeMinima: number | null;
  requerIban: boolean;
  notas: string;
};

export type RegraGuardada = RegraApoio & { id: number; financiador: string; turmaId: number | null; ambito: AmbitoRegra };

export type RegrasApoios = {
  tipos: { id: TipoApoio; rotulo: string }[];
  financiadores: string[];
  turmas: { id: number; nome: string; financiador: string }[];
  regras: RegraGuardada[];
};

export type LinhaCalculo = {
  tipo: TipoApoio;
  rotulo: string;
  modo: ModoApoio;
  dias: number;
  horas: number;
  valor: number;
  valorBruto: number;
  aplicadoTeto: boolean;
  exclusao: string;
  bloqueadoIban: boolean;
  ambito: AmbitoRegra;
};

export type CalculoMes = {
  periodo: string;
  horasPrevistas: number;
  horasPresente: number;
  assiduidade: number | null;
  diasComPresenca: number;
  temIban: boolean;
  linhas: LinhaCalculo[];
  total: number;
};

export type Apoio = {
  id: number;
  formandoId: number;
  formando?: string;
  turmaId: number;
  periodo: string;
  tipo: TipoApoio;
  rotulo: string;
  dias: number;
  horas: number;
  valorCalculado: number;
  ajuste: number;
  motivoAjuste: string;
  valor: number;
  estado: EstadoApoio;
  pagoEm: string | null;
  referencia: string;
  notas: string;
  atualizadoEm: string;
};

export type ApoiosFormando = {
  formandoId: number;
  iban: { tem: boolean; mascarado: string; titular: string };
  turma: { id: number; nome: string; financiador: string } | null;
  regras: (RegraApoio & { ambito: AmbitoRegra })[];
  meses: string[];
  mes: string | null;
  simulacao: CalculoMes | null;
  registos: Apoio[];
  totais: { pago: number; porPagar: number };
};

export type ApoiosTurma = {
  turma: { id: number; nome: string; curso: string; financiador: string };
  meses: string[];
  registos: Apoio[];
  totais: Partial<Record<EstadoApoio, { n: number; valor: number }>>;
};

export type PreviaFormando = Omit<CalculoMes, "linhas"> & {
  formandoId: number;
  nome: string;
  linhas: (LinhaCalculo & { estadoAtual: EstadoApoio | null })[];
};

export type ResultadoProcessar = {
  mes: string;
  confirmado: boolean;
  contagem?: { criado: number; atualizado: number; mantido: number; semDireito: number; semIban: number };
  formandos: PreviaFormando[];
};

export const apiRegrasApoios = (signal?: AbortSignal) => api<RegrasApoios>("/v1/apoios/regras", { signal });

export const apiGravarRegrasApoios = (financiador: string, turmaId: number | null, regras: RegraApoio[]) =>
  enviar.put<{ ok: true }>("/v1/apoios/regras", { financiador, turmaId, regras });

export const apiApoiosFormando = (id: number, mes?: string, signal?: AbortSignal) =>
  api<ApoiosFormando>(`/v1/formandos/fin/${id}/apoios${qs({ mes })}`, { signal });

export const apiIbanFormando = (id: number, iban: string, titular: string) =>
  enviar.put<{ ok: true; iban: ApoiosFormando["iban"] }>(`/v1/formandos/fin/${id}/apoios/iban`, { iban, titular });

export const apiApoiosTurma = (turmaId: number, mes?: string, signal?: AbortSignal) =>
  api<ApoiosTurma>(`/v1/apoios/turmas/${turmaId}${qs({ mes })}`, { signal });

export type LoteApoios = {
  turma: { id: number; nome: string };
  mes: string;
  registos: Apoio[];
  bancos: Record<number, { iban: string; titular: string }>;
};

/** Apoios do mês com IBAN completo, para preparar as transferências (fica auditado). */
export const apiLoteApoios = (turmaId: number, mes: string) =>
  api<LoteApoios>(`/v1/apoios/turmas/${turmaId}/lote${qs({ mes })}`);

export const apiProcessarApoios =(turmaId: number, mes: string, confirmar: boolean) =>
  enviar.post<ResultadoProcessar>(`/v1/apoios/turmas/${turmaId}/processar`, { mes, confirmar });

export const apiEstadoApoiosTurma = (
  turmaId: number,
  corpo: { mes: string; de: EstadoApoio; para: EstadoApoio; pagoEm?: string; referencia?: string; ids?: number[] },
) => enviar.post<{ ok: true; alterados: number; semDireito?: { id: number; formandoId: number; formando: string; tipo: string; motivo: string }[] }>(
  `/v1/apoios/turmas/${turmaId}/estado`, corpo,
);

export const apiAlterarApoio = (
  id: number,
  corpo: { estado?: EstadoApoio; pagoEm?: string | null; referencia?: string; notas?: string; ajuste?: number; motivoAjuste?: string },
) => enviar.patch<{ ok: true; apoio: Apoio }>(`/v1/apoios/${id}`, corpo);

/** Processamento do subsídio de alimentação em PDF: um mês, ou a ação inteira sem `mes`. */
export const apiPdfSubsidioAlimentacao = (turmaId: number, mes?: string) =>
  descarregarFicheiro(`/v1/apoios/turmas/${turmaId}/subsidio-alimentacao${qs({ mes })}`, `Subsidio de alimentacao${mes ? ` ${mes}` : ""}.pdf`, "application/pdf");
