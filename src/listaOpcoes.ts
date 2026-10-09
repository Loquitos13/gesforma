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
  concelhos: {
    titulo: "Concelho",
    fallback: [
      "Águeda", "Albergaria-a-Velha", "Alcobaça", "Almada", "Amadora", "Amarante", "Aveiro",
      "Barcelos", "Beja", "Braga", "Bragança", "Caldas da Rainha", "Cascais", "Castelo Branco",
      "Chaves", "Coimbra", "Covilhã", "Évora", "Fafe", "Faro", "Figueira da Foz", "Funchal",
      "Gondomar", "Guarda", "Guimarães", "Ílhavo", "Lamego", "Leiria", "Lisboa", "Loures",
      "Maia", "Marco de Canaveses", "Matosinhos", "Odivelas", "Oeiras", "Oliveira de Azeméis",
      "Ovar", "Paços de Ferreira", "Palmela", "Paredes", "Penafiel", "Ponta Delgada", "Portalegre",
      "Portimão", "Porto", "Póvoa de Varzim", "Santa Maria da Feira", "Santarém", "Santo Tirso",
      "Seixal", "Setúbal", "Sintra", "Tomar", "Torres Vedras", "Trofa", "Valongo", "Viana do Castelo",
      "Vila do Conde", "Vila Franca de Xira", "Vila Nova de Famalicão", "Vila Nova de Gaia",
      "Vila Real", "Viseu",
    ],
  },
} as const;

export type ListaOpcoesId = keyof typeof LISTAS_OPCOES;

export const LISTA_OPCOES_IDS = Object.keys(LISTAS_OPCOES) as ListaOpcoesId[];

export function isListaOpcoesId(value: string): value is ListaOpcoesId {
  return value in LISTAS_OPCOES;
}
