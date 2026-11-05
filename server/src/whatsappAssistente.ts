/**
 * Mensagens e menu do assistente de WhatsApp, editáveis pela administração e pelas coordenações (CRM › WhatsApp).
 * Guardado em `app_settings` (id `whatsapp_assistente`); o que falta usa os textos de origem.
 */
import { z } from "zod";
import type { Db } from "./db/pool.js";
import { gravarDefinicao, lerDefinicao } from "./repos/settings.js";

export const ID_ASSISTENTE = "whatsapp_assistente";

export const TEXTOS_PADRAO = {
  boasVindas: "Olá, sou o assistente da ENA Formação.\nComo posso ajudar?",
  pedidoRegistado: "A sua pré-inscrição já se encontra registada com sucesso. Caso tenha alguma dúvida ou necessite de ajuda durante o processo de formalização da inscrição, não hesite em contactar-nos. Teremos todo o gosto em ajudar!",
  semPedido: "Não encontro um pedido neste número.",
  falarEquipa: "Combinado. Uma pessoa da equipa da ENA vai responder-lhe aqui, nesta conversa (dias úteis, das 9h às 18h).\nPara ajudarmos mais depressa, escreva numa mensagem o assunto (por exemplo, o curso ou a dúvida).",
  ficheiro: "Recebemos o seu ficheiro. A equipa da ENA vai vê-lo.",
  notaPreco: "O preço depende do local e do horário: na página vê os valores de cada um.",
  fimGold: "O pagamento *não* se faz neste chat.",
  fimFin: "A coordenação da Formação Financiada contacta-o para confirmar a turma.",
};
export type TextosAssistente = typeof TEXTOS_PADRAO;

export type AcaoMenu = "preinscricao" | "estado" | "cursos" | "equipa" | "faq";
export type ItemMenu = { acao: AcaoMenu; titulo: string; descricao?: string; ativo: boolean; resposta?: string };

export const MENU_PADRAO: ItemMenu[] = [
  { acao: "preinscricao", titulo: "Pré-inscrição", descricao: "Dados pessoais + curso, local, horário e data", ativo: true },
  { acao: "estado", titulo: "Estado do meu pedido", ativo: true },
  { acao: "cursos", titulo: "Lista de cursos", ativo: true },
  { acao: "equipa", titulo: "Falar com a equipa", descricao: "Uma pessoa da ENA responde-lhe aqui", ativo: true },
];

export type Assistente = { textos: TextosAssistente; menu: ItemMenu[] };

const FIXAS = ["preinscricao", "estado", "cursos", "equipa"] as const;

/** Limites do WhatsApp: lista com até 10 linhas, título até 24 caracteres, descrição até 72. */
const esquema = z.object({
  textos: z.object(Object.fromEntries(Object.keys(TEXTOS_PADRAO).map(k => [k, z.string().max(1000).optional()]))).partial().default({}),
  menu: z.array(z.object({
    acao: z.enum(["preinscricao", "estado", "cursos", "equipa", "faq"]),
    titulo: z.string().trim().min(1, "Cada opção precisa de um nome.").max(24, "O nome de uma opção tem no máximo 24 caracteres (limite do WhatsApp)."),
    descricao: z.string().trim().max(72, "A descrição de uma opção tem no máximo 72 caracteres (limite do WhatsApp).").optional(),
    ativo: z.boolean(),
    resposta: z.string().trim().max(1000).optional(),
  })).max(10, "O menu tem no máximo 10 opções (limite do WhatsApp)."),
});

function normalizar(raw: Record<string, unknown>): Assistente {
  const p = esquema.safeParse(raw);
  const textos = { ...TEXTOS_PADRAO };
  let menu = MENU_PADRAO;
  if (p.success) {
    for (const [k, v] of Object.entries(p.data.textos)) if (typeof v === "string" && v.trim()) textos[k as keyof TextosAssistente] = v.trim();
    if (p.data.menu.length) menu = p.data.menu;
  }
  return { textos, menu };
}

export async function lerAssistente(db: Db): Promise<Assistente> {
  return normalizar(await lerDefinicao(db, ID_ASSISTENTE).catch(() => ({})));
}

/** Valida e grava. As quatro opções fixas ficam sempre (podem ser escondidas); as perguntas frequentes precisam de resposta. */
export async function gravarAssistente(db: Db, body: unknown): Promise<{ ok: true; assistente: Assistente } | { ok: false; erro: string }> {
  const p = esquema.safeParse(body);
  if (!p.success) return { ok: false, erro: p.error.issues[0]?.message ?? "Dados inválidos." };
  for (const a of FIXAS) {
    if (p.data.menu.filter(i => i.acao === a).length !== 1) return { ok: false, erro: "As opções de origem do menu não se apagam: esconda-as." };
  }
  if (p.data.menu.some(i => i.acao === "faq" && !i.resposta)) return { ok: false, erro: "Cada pergunta frequente precisa de uma resposta." };
  if (!p.data.menu.some(i => i.ativo)) return { ok: false, erro: "Deixe pelo menos uma opção visível no menu." };
  const textos = Object.fromEntries(Object.entries(p.data.textos).filter(([, v]) => typeof v === "string" && v.trim()).map(([k, v]) => [k, (v as string).trim()]));
  const menu = p.data.menu.map(i => ({
    acao: i.acao, titulo: i.titulo, ativo: i.ativo,
    ...(i.descricao ? { descricao: i.descricao } : {}),
    ...(i.acao === "faq" ? { resposta: i.resposta } : {}),
  }));
  await gravarDefinicao(db, ID_ASSISTENTE, { textos, menu });
  return { ok: true, assistente: normalizar({ textos, menu }) };
}
