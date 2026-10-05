export const LISTAS_OPCOES = {
  origens: {
    titulo: "Origem / Como conheceu",
    fallback: [
      "Website", "Facebook", "Instagram", "Google", "LinkedIn", "IEFP",
      "Referência", "Telefone", "WhatsApp", "Email", "Balcão", "Indicação", "Outro",
    ],
  },
  meios_contacto: {
    titulo: "Meio de contacto",
    fallback: ["Telefone", "WhatsApp", "Email", "SMS", "Presencial"],
  },
  metodos_pagamento: {
    titulo: "Método de pagamento",
    fallback: ["MB Way", "Multibanco", "Transferência", "Numerário", "Cartão", "PayPal"],
  },
  motivos_desistencia: {
    titulo: "Motivo de desistência",
    fallback: ["Preço", "Horário", "Local", "Sem vagas", "Concorrência", "Silêncio", "Não elegível", "Outro"],
  },
  resultados_contacto: {
    titulo: "Resultado do contacto",
    fallback: ["Atendeu", "Não atendeu", "Mailbox", "Interessado", "A pensar", "Recusou"],
  },
  tipos_modulo: {
    titulo: "Tipo de módulo",
    fallback: ["Teórico-prático", "Teórico", "Prático", "B-learning"],
  },
  tipos_conteudo: {
    titulo: "Tipo de conteúdo",
    fallback: ["PDF", "Vídeo", "Link"],
  },
  tipos_parceria: {
    titulo: "Tipo de parceria",
    fallback: [
      "Protocolo de Estágio",
      "Empresa Cliente",
      "Entidade Formadora",
      "Agente Comercial",
      "Instituição de Ensino",
      "Associação Setorial",
    ],
  },
  tipos_curso: {
    titulo: "Tipo comercial",
    fallback: ["E-learning", "Pré-inscrição"],
  },
  regimes_curso: {
    titulo: "Modalidade",
    fallback: ["b-learning", "e-learning", "presencial"],
  },
  categorias_gold: {
    titulo: "Categoria Gold",
    fallback: ["CCP e Gestão da Formação", "Saúde e bem estar", "Desenvolvimento Pessoal"],
  },
  areas_fin: {
    titulo: "Área financiada",
    fallback: ["Saúde e segurança", "Marketing digital", "TIC e cibersegurança", "Formação de formadores"],
  },
} as const;

export type ListaOpcoesId = keyof typeof LISTAS_OPCOES;

export const LISTA_OPCOES_IDS = Object.keys(LISTAS_OPCOES) as ListaOpcoesId[];

export function isListaOpcoesId(value: string): value is ListaOpcoesId {
  return value in LISTAS_OPCOES;
}
