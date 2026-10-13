/**
 * Estados canónicos e transições permitidas (formandos, turmas, pagamentos).
 * O cliente pode enviar variantes ("Concluido", "desistente"): normalizam-se para o canónico.
 * Um estado antigo fora da lista pode passar a qualquer estado válido.
 * O administrador pode corrigir para qualquer estado válido (fica no registo de auditoria).
 */

export type Maquina = "formandoGold" | "formandoFin" | "turmaFin" | "turmaGold" | "pagamento";

const TRANSICOES: Record<Maquina, Record<string, string[]>> = {
  formandoGold: {
    "Formando": ["Desistiu", "Concluído"],
    "Desistiu": ["Formando"],
    "Concluído": ["Certificado", "Formando"],
    "Certificado": [],
  },
  formandoFin: {
    "Em análise": ["Elegível", "Indeferido", "Desistiu"],
    "Elegível": ["Colocado na turma", "A frequentar", "Desistiu", "Indeferido", "Em análise"],
    "Colocado na turma": ["A frequentar", "Desistiu", "Elegível"],
    "A frequentar": ["Concluído", "Desistiu"],
    "Concluído": ["Certificado", "A frequentar"],
    "Desistiu": ["Elegível", "A frequentar"],
    "Indeferido": ["Em análise"],
    "Certificado": [],
  },
  turmaFin: {
    "A montar": ["A decorrer", "Cancelada"],
    "A decorrer": ["A montar", "Cancelada"],
    // "Concluída" só se atinge pelo fecho formal da turma.
    "Concluída": [],
    "Cancelada": ["A montar"],
  },
  turmaGold: {
    "Ativa": ["Inativa"],
    "Inativa": ["Ativa"],
  },
  pagamento: {
    "Pendente": ["Pago", "Cancelado"],
    "Pago": ["Reembolsado"],
    "Cancelado": ["Pendente"],
    "Reembolsado": [],
  },
};

/** Estados a que só se chega por um fluxo próprio, nunca por PATCH. */
const SO_POR_FLUXO: Partial<Record<Maquina, Record<string, string>>> = {
  turmaFin: { "Concluída": "A turma conclui-se com o fecho formal." },
};

const SINONIMOS: Record<string, string> = {
  "ativo": "Ativa", "activa": "Ativa", "activo": "Ativa",
  "inativo": "Inativa", "inactiva": "Inativa", "inactivo": "Inativa",
  "desistente": "Desistiu", "desistencia": "Desistiu",
  "concluido": "Concluído", "concluida": "Concluído",
  "certificada": "Certificado",
  "elegivel": "Elegível", "em analise": "Em análise",
  "pago": "Pago", "paga": "Pago", "pendente": "Pendente", "reembolsado": "Reembolsado", "cancelado": "Cancelado",
  "a frequentar": "A frequentar", "em formacao": "A frequentar",
  "encerrada": "Concluída", "fechada": "Concluída",
};

function chave(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

export function estadosDe(m: Maquina) {
  return Object.keys(TRANSICOES[m]);
}

/** Devolve o estado canónico, ou null se não pertence à máquina. */
export function normalizarEstado(m: Maquina, valor: string): string | null {
  const k = chave(valor);
  if (!k) return null;
  const direto = estadosDe(m).find(e => chave(e) === k);
  if (direto) return direto;
  const sin = SINONIMOS[k];
  if (sin && estadosDe(m).includes(sin)) return sin;
  if (m === "turmaFin" && (k === "concluida" || k === "concluido")) return "Concluída";
  return null;
}

export type ResultadoTransicao = { ok: true; estado: string; mudou: boolean } | { ok: false; erro: string };

export function validarTransicao(m: Maquina, atual: string, pedido: string, role: string): ResultadoTransicao {
  const novo = normalizarEstado(m, pedido);
  if (!novo) return { ok: false, erro: `Estado inválido: «${pedido}». Use: ${estadosDe(m).join(", ")}.` };
  const de = normalizarEstado(m, atual);
  if (de === novo) return { ok: true, estado: novo, mudou: false };
  const fluxo = SO_POR_FLUXO[m]?.[novo];
  if (fluxo) return { ok: false, erro: fluxo };
  if (!de) return { ok: true, estado: novo, mudou: true };
  if (TRANSICOES[m][de]!.includes(novo) || role === "admin") return { ok: true, estado: novo, mudou: true };
  return { ok: false, erro: `Não é possível passar de «${de}» para «${novo}».` };
}

/** Estados em que o formando não ocupa vaga. */
export function ocupaVaga(estado: string) {
  const k = chave(estado);
  return !(k.startsWith("desist") || k === "indeferido");
}
