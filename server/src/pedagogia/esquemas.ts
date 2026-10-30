/** Esquemas zod dos pedidos da pedagogia, do dossiê e dos inquéritos. */
import { z } from "zod";
import { idNum, regime } from "../validacao.js";

export const regimeSchema = regime;
export const estadoSchema = z.enum(["ok", "parcial", "falta"]);

export const momentoSchema = z.object({
  conteudo: z.string().max(4000).default(""),
  atividades: z.string().max(4000).default(""),
  metodos: z.string().max(2000).default(""),
  avaliacao: z.string().max(2000).default(""),
  recursos: z.string().max(2000).default(""),
  materiais: z.string().max(2000).default(""),
  /** Duração do momento («30 min»); os planos antigos não a têm. */
  tempo: z.string().max(120).default(""),
});

export const planoSchema = z.object({
  objetivosGerais: z.string().max(4000).default(""),
  objetivosEspecificos: z.string().max(4000).default(""),
  momentos: z.object({
    introducao: momentoSchema,
    desenvolvimento: momentoSchema,
    conclusao: momentoSchema,
  }),
  assinado: z.boolean().optional(),
  /** Aprovação pela coordenação pedagógica (o servidor decide quem pode pôr cada estado). */
  estado: z.enum(["rascunho", "submetido", "aprovado", "devolvido"]).optional(),
  /** Comentários da coordenação ao devolver (ou ao aprovar). */
  comentario: z.string().max(4000).optional(),
});

export const sumarioSchema = z.object({
  conteudos: z.string().max(6000).default(""),
  atividades: z.string().max(6000).default(""),
  observacoes: z.string().max(4000).default(""),
  assinado: z.boolean().default(false),
  assinadoEm: z.string().max(40).optional(),
  presencasValidadas: z.boolean().optional(),
});

export const presencasSchema = z.array(z.object({
  id: z.number().int(),
  nome: z.string().max(160),
  presente: z.boolean(),
  /** Sem estado, `presente` decide: presente ou falta injustificada. */
  estado: z.enum(["presente", "falta_justificada", "falta_injustificada", "atraso"]).optional(),
  /** Minutos em falta (atraso ou saída antecipada). */
  minutos: z.number().int().min(0).max(600).optional(),
  justificacao: z.string().max(400).optional(),
}).transform(p => ({ ...p, presente: p.estado ? p.estado === "presente" || p.estado === "atraso" : p.presente }))).max(400);

/** Componente da sessão na folha de presenças: horas teóricas (T) e práticas (P); null limpa. */
export const folhaSchema = z.object({
  teoricas: z.number().min(0).max(24).nullable().optional(),
  praticas: z.number().min(0).max(24).nullable().optional(),
});

export const sessaoPatchSchema = z.object({
  /** Id da sessão no cronograma (a verdade); sem ele usa-se o n do caminho com o cronograma actual. */
  sessaoId: z.string().trim().min(1).max(120).optional(),
  plano: planoSchema.optional(),
  sumario: sumarioSchema.optional(),
  presencas: presencasSchema.optional(),
  folha: folhaSchema.optional(),
  /** Coordenação: valida (true) ou reabre (false) a folha de presenças; o formador deixa de a poder alterar. */
  validarPresencas: z.boolean().optional(),
  /** Formador: assina a folha de presenças (fica o nome da conta e a hora do servidor). */
  assinarFolha: z.literal(true).optional(),
}).refine(v => v.plano || v.sumario || v.presencas || v.folha || v.validarPresencas !== undefined || v.assinarFolha, { message: "vazio" });

export const documentoSchema = z.object({
  grupoId: z.string().min(1).max(40),
  label: z.string().min(1).max(160),
  estado: estadoSchema,
  detalhe: z.string().max(400).default(""),
  payload: z.unknown().optional(),
});

export const dtpSchema = z.object({ estado: z.union([estadoSchema, z.literal("auto")]) });

export const anexoSchema = z.object({
  driveFileId: z.string().min(1).max(80),
  fileName: z.string().max(240).default(""),
  driveUrl: z.string().max(500).optional().default(""),
});

export const certificadoSchema = z.object({
  emitido: z.boolean().optional(),
  /** A escala é a do curso: valida-se na rota (`escalaDaTurma`). */
  nota: z.number().finite().nullable().optional(),
  elearning: z.number().int().min(0).max(100).nullable().optional(),
  ficheiroId: z.string().max(80).optional(),
  ficheiroNome: z.string().max(240).optional(),
  ficheiroUrl: z.string().max(500).optional(),
  /** Só o administrador emite sem cumprir as regras de elegibilidade (fica auditado). */
  forcar: z.boolean().optional(),
});

export const avaliacaoNotasSchema = z.object({
  notas: z.array(z.object({
    formandoId: z.number().int(),
    moduloId: z.string().max(120).default(""),
    parametroId: z.string().min(1).max(80),
    /** A escala é a do curso: valida-se na rota (`escalaDaTurma`). A null apaga a célula. */
    nota: z.number().finite().nullable(),
  })).max(4000),
});

export const fichaSchema = z.object({
  payload: z.record(z.unknown()).optional(),
  criterios: z.array(z.object({ id: z.string().max(60), label: z.string().max(200) })).max(40).optional(),
}).refine(v => v.payload || v.criterios, { message: "vazio" });

export const dtpModeloSchema = z.object({
  excluidos: z.array(z.string().max(60)).max(80).default([]),
  incluidos: z.array(z.string().max(60)).max(80).optional().default([]),
  extra: z.array(z.object({
    id: z.string().max(40).optional(),
    fase: z.enum(["antes", "durante", "depois"]),
    label: z.string().trim().min(3).max(160),
    fonte: z.string().trim().max(120).optional(),
    hint: z.string().trim().max(240).optional(),
    bloqueante: z.boolean().optional(),
    ambito: z.enum(["turma", "formando", "formador"]).optional().default("turma"),
  })).max(30).default([]),
});

export const respostaSchema = z.object({
  turma: z.string().max(120).default(""),
  /** Turma da ligação enviada (?turma=<id>); validada contra os envios do inquérito. */
  turmaId: z.number().int().positive().optional(),
  formando: z.string().max(160).default(""),
  respostas: z.record(z.unknown()),
});

export const nomeEntidadeSchema = z.object({ nome: z.string().trim().min(2).max(120) });

/** Parâmetros das rotas da turma. */
export const sessaoParam = z.object({ regime, id: idNum, n: idNum });
export const itemParam = z.object({ regime, id: idNum, itemId: z.string().trim().min(1).max(80) });
export const formandoParam = z.object({ regime, id: idNum, formandoId: idNum });
export const tokenParam = z.object({ token: z.string().min(8).max(80) });

const criterioQualitativo = z.object({
  nivel: z.number().int().min(1).max(5).nullable().default(null),
  texto: z.string().max(4000).default(""),
});

/** Ficha individual de avaliação (qualitativa): a da turma (formando 0) só leva as competências a adquirir. */
export const avaliacaoQualitativaSchema = z.object({
  competencias: z.string().max(4000).optional(),
  aquisicao: criterioQualitativo.optional(),
  autonomiaAprendizagens: criterioQualitativo.optional(),
  autonomiaProblemas: criterioQualitativo.optional(),
});
