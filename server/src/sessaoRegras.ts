/**
 * Regras do sumário e da folha de presenças que o servidor impõe,
 * independentemente do que o cliente envia.
 */
import { hojeLisboa } from "./datas.js";

export type SumarioIn = {
  conteudos: string;
  atividades: string;
  observacoes: string;
  assinado: boolean;
  assinadoEm?: string;
  presencasValidadas?: boolean;
};

const PEDAGOGIA = new Set(["admin", "secretaria", "financiada"]);

export function podeValidarPresencas(role: string) {
  return PEDAGOGIA.has(role);
}

/**
 * - `assinadoEm` é a hora do servidor no momento da primeira assinatura;
 * - só a equipa pedagógica valida presenças (o valor do formador é ignorado);
 * - o formador não assina uma sessão com data futura.
 */
export function sumarioComRegras(
  role: string,
  anterior: Partial<SumarioIn> | null,
  novo: SumarioIn,
  dataSessao: string,
  agora = new Date(),
): { ok: true; sumario: SumarioIn } | { ok: false; erro: string } {
  const hoje = hojeLisboa(agora);
  const jaAssinado = Boolean(anterior?.assinado);
  if (novo.assinado && !jaAssinado && role === "formador" && /^\d{4}-\d{2}-\d{2}$/.test(dataSessao) && dataSessao > hoje) {
    return { ok: false, erro: "Não pode assinar o sumário de uma sessão que ainda não aconteceu." };
  }
  const assinadoEm = novo.assinado
    ? (jaAssinado && anterior?.assinadoEm ? anterior.assinadoEm : agora.toISOString())
    : undefined;
  const presencasValidadas = podeValidarPresencas(role)
    ? Boolean(novo.presencasValidadas)
    : Boolean(anterior?.presencasValidadas);
  return { ok: true, sumario: { ...novo, assinadoEm, presencasValidadas } };
}
