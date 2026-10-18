import { z } from "zod";

/**
 * Validação por tipo de item do catálogo. Os campos conhecidos são validados;
 * os restantes passam (o catálogo também guarda preferências do ecrã).
 */
const emailOuVazio = z.string().trim().max(254).refine(v => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "email inválido");

const inscricaoFin = z.object({
  nome: z.string().trim().min(1).max(80),
  apelido: z.string().trim().max(80).optional(),
  email: emailOuVazio.optional(),
  telf: z.string().trim().max(30).optional(),
  curso: z.string().trim().max(200).optional(),
  turma: z.string().trim().max(120).optional(),
  estado: z.enum(["Recebida", "Em análise", "Elegível", "Indeferido", "Colocado na turma"]).optional(),
  docs: z.record(z.boolean()).optional(),
}).passthrough();

const pergunta = z.object({
  id: z.number().int(),
  tipo: z.enum(["escala", "multipla", "simnao", "texto"]),
  texto: z.string().trim().min(1).max(500),
  opcoes: z.array(z.string().max(200)).max(20).optional(),
}).passthrough();

const inquerito = z.object({
  titulo: z.string().trim().min(1).max(200),
  perguntas: z.array(pergunta).max(60),
}).passthrough();

/** Telefone, telemóvel ou WhatsApp: algarismos, espaços, «+», «(», «)», «-» e «.». */
const numeroOuVazio = z.string().trim().max(30).refine(v => v === "" || /^[+\d][\d\s().-]{5,}$/.test(v), "número inválido");

/** Local: os contactos para dúvidas aparecem no cartão do local na página do curso. */
const local = z.object({
  nome: z.string().trim().min(1).max(120),
  telemovel: numeroOuVazio.optional(),
  telefone: numeroOuVazio.optional(),
  email: emailOuVazio.optional(),
  whatsapp: numeroOuVazio.optional(),
}).passthrough();

const SCHEMAS: Record<string, z.ZodTypeAny> = {
  inscricoes_fin: inscricaoFin,
  inqueritos: inquerito,
  locais: local,
};

/** Devolve a mensagem de erro, ou null se o payload é válido para o tipo. */
export function erroPayloadCatalogo(kind: string, payload: unknown): string | null {
  const schema = SCHEMAS[kind];
  if (!schema) return null;
  const r = schema.safeParse(payload);
  if (r.success) return null;
  const i = r.error.issues[0];
  return i ? `${i.path.join(".") || "payload"}: ${i.message}` : "payload inválido";
}
