// Aba Documentos do cockpit: grupos e itens ligados ao dossiê real (estado e detalhe vêm do servidor).
import { I } from "./base";

export type DocEstado = "ok" | "parcial" | "falta";

export type DocItem = { label: string; detalhe: string; estado: DocEstado; bloqueante?: boolean; payload?: unknown };

export type GrupoDocs = { id: string; label: string; color: string; icon: React.ReactNode; items: DocItem[] };

const GRUPOS: Record<string, { label: string; icon: React.ReactNode; gold: string; fin: string }> = {
  turma: { label: "Documentos da turma", icon: I.school, gold: "bg-amber-50 border-amber-200 text-amber-800", fin: "bg-blue-50 border-blue-200 text-blue-800" },
  sessoes: { label: "Documentos das sessões", icon: I.calendar, gold: "bg-slate-50 border-slate-200 text-slate-700", fin: "bg-slate-50 border-slate-200 text-slate-700" },
  formandos: { label: "Documentos dos formandos", icon: I.users, gold: "bg-blue-50 border-blue-200 text-blue-800", fin: "bg-emerald-50 border-emerald-200 text-emerald-800" },
  formadores: { label: "Documentos dos formadores", icon: I.person, gold: "bg-violet-50 border-violet-200 text-violet-800", fin: "bg-violet-50 border-violet-200 text-violet-800" },
};

export function metaGrupo(id: string, regime: "gold" | "fin") {
  const m = GRUPOS[id] ?? GRUPOS.turma!;
  return { id, label: m.label, icon: m.icon, color: regime === "fin" ? m.fin : m.gold };
}

/**
 * Documentos que a secretaria acompanha nesta aba (Gold). O rótulo é a chave gravada em
 * turma_documentos; o estado e o detalhe vêm do item do dossiê (`dtpId`), calculados no servidor.
 */
const DOCS_GOLD: { grupo: string; label: string; dtpId: string }[] = [
  { grupo: "turma", label: "Programa de formação", dtpId: "programa" },
  { grupo: "turma", label: "Regulamento de formação", dtpId: "regulamento" },
  { grupo: "turma", label: "Cronograma da turma", dtpId: "cronograma" },
  { grupo: "turma", label: "Registo de ocorrências", dtpId: "ocorrencias" },
  { grupo: "turma", label: "Relatório final da turma", dtpId: "relatorio" },
  { grupo: "sessoes", label: "Planos de sessão", dtpId: "planos" },
  { grupo: "sessoes", label: "Sumários assinados", dtpId: "sumarios" },
  { grupo: "sessoes", label: "Folhas de presença", dtpId: "presencas" },
  { grupo: "formandos", label: "Contratos de formação", dtpId: "contratos-f" },
  { grupo: "formandos", label: "PIP", dtpId: "pip" },
  { grupo: "formandos", label: "Simulação pedagógica inicial", dtpId: "sim-ini" },
  { grupo: "formandos", label: "Simulação pedagógica final", dtpId: "sim-fim" },
  { grupo: "formandos", label: "Comprovativo de 5 anos de experiência", dtpId: "exp-formandos" },
  { grupo: "formadores", label: "CCP / CCPE do formador", dtpId: "ccp-formador" },
  { grupo: "formadores", label: "CV do formador", dtpId: "cv-formador" },
  { grupo: "formadores", label: "Contrato do formador", dtpId: "contrato-formador" },
];

export type ItemDtp = { id: string; estado: DocEstado; detalhe: string; hint?: string; bloqueante?: boolean };

/** Grupos Gold a partir do dossiê da turma. Itens que o modelo do curso excluiu não aparecem. */
export function gruposGold(itens: ItemDtp[]): GrupoDocs[] {
  const porId = new Map(itens.map(i => [i.id, i]));
  return Object.keys(GRUPOS).map(id => ({
    ...metaGrupo(id, "gold"),
    items: DOCS_GOLD.filter(d => d.grupo === id && porId.has(d.dtpId)).map(d => {
      const it = porId.get(d.dtpId)!;
      return { label: d.label, detalhe: it.detalhe || it.hint || "", estado: it.estado, bloqueante: it.bloqueante };
    }),
  })).filter(g => g.items.length);
}

/** Lista de pessoas/sessões a marcar: a gravada, ou os nomes reais por marcar. */
export function listaDe(nomes: string[], gravada: unknown) {
  if (Array.isArray(gravada) && gravada.length) return (gravada as { id: string; nome: string; ok: boolean }[]).map(i => ({ ...i }));
  return nomes.map((nome, i) => ({ id: String(i + 1), nome, ok: false }));
}
