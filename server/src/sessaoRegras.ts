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

// ── Plano de sessão: o formador preenche e submete; a coordenação revê, edita, aprova ou devolve com comentários ──

export type EstadoPlano = "rascunho" | "submetido" | "aprovado" | "devolvido";
const ESTADOS_PLANO = new Set<EstadoPlano>(["rascunho", "submetido", "aprovado", "devolvido"]);

export type PlanoIn = { assinado?: boolean; estado?: EstadoPlano; comentario?: string; [k: string]: unknown };

/** Planos gravados antes da aprovação: assinado conta como aprovado. */
export function estadoDoPlano(p: Partial<PlanoIn> | null | undefined): EstadoPlano {
  if (p?.estado && ESTADOS_PLANO.has(p.estado)) return p.estado;
  return p?.assinado ? "aprovado" : "rascunho";
}

/**
 * - só a coordenação (admin, secretaria, financiada) aprova ou devolve; devolver pede comentários;
 * - o formador grava em rascunho ou assina e submete; um plano devolvido continua devolvido até ele o submeter de novo;
 * - os comentários e quem reviu são da coordenação: o formador não os muda;
 * - `assinado` acompanha a aprovação (é o que o resto da plataforma lê).
 * `revisto` diz se a coordenação acabou de aprovar ou devolver (para avisar o formador).
 */
export function planoComRegras(
  role: string,
  quem: string,
  anterior: Partial<PlanoIn> | null,
  novo: PlanoIn,
  agora = new Date(),
): { ok: true; plano: PlanoIn; revisto: "aprovado" | "devolvido" | null; submetido: boolean } | { ok: false; erro: string; codigo: 400 | 403 } {
  const antes = estadoDoPlano(anterior);
  const coordenacao = PEDAGOGIA.has(role);
  const pedido = novo.estado && ESTADOS_PLANO.has(novo.estado) ? novo.estado : null;
  // Campos que só o servidor escreve: o que vem do pedido não conta.
  const base = {
    ...novo,
    submetidoEm: anterior?.submetidoEm, revistoPor: anterior?.revistoPor, revistoEm: anterior?.revistoEm,
    assinaturaFormador: anterior?.assinaturaFormador,
  } as PlanoIn;
  if (!coordenacao) {
    if (pedido === "aprovado" || pedido === "devolvido") {
      return { ok: false, erro: "Só a coordenação pedagógica aprova ou devolve o plano de sessão.", codigo: 403 };
    }
    // Alterar um plano já submetido (assinado) volta a rascunho: tem de ser assinado e submetido outra vez.
    const estado: EstadoPlano = pedido ?? (antes === "devolvido" ? "devolvido" : "rascunho");
    const submetido = estado === "submetido" && antes !== "submetido";
    // Submeter é assinar: fica quem assinou (a conta com que entrou) e quando (hora do servidor).
    // Mexer no plano depois de assinado tira a assinatura até voltar a submeter.
    const assinatura = submetido ? { nome: quem, em: agora.toISOString() } : estado === "submetido" ? anterior?.assinaturaFormador : undefined;
    return {
      ok: true, revisto: null, submetido,
      plano: {
        ...base, estado, assinado: false, comentario: anterior?.comentario, assinaturaFormador: assinatura,
        ...(submetido ? { submetidoEm: agora.toISOString() } : {}),
      },
    };
  }
  const estado: EstadoPlano = pedido ?? antes;
  const comentario = (novo.comentario ?? anterior?.comentario ?? "").trim();
  if (estado === "devolvido" && antes !== "devolvido" && !comentario) {
    return { ok: false, erro: "Para devolver o plano, escreva o que o formador tem de corrigir.", codigo: 400 };
  }
  const revisto = (estado === "aprovado" || estado === "devolvido") && estado !== antes ? estado : null;
  return {
    ok: true, revisto, submetido: false,
    plano: {
      ...base, estado, assinado: estado === "aprovado", comentario: comentario || undefined,
      ...(revisto ? { revistoPor: quem, revistoEm: agora.toISOString() } : {}),
    },
  };
}
