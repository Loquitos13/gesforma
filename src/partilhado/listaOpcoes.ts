// Identificadores e títulos das listas de opções. As opções em si vêm sempre da API (Gestão › Listas de opções).
export const LISTAS_OPCOES = {
  origens: { titulo: "Como conheceu a ENA" },
  meios_contacto: { titulo: "Meio de contacto" },
  metodos_pagamento: { titulo: "Método de pagamento" },
  motivos_desistencia: { titulo: "Motivo de desistência" },
  resultados_contacto: { titulo: "Resultado do contacto" },
  tipos_modulo: { titulo: "Tipo de módulo" },
  tipos_conteudo: { titulo: "Tipo de conteúdo" },
  tipos_parceria: { titulo: "Tipo de parceria" },
  tipos_curso: { titulo: "Tipo comercial" },
  regimes_curso: { titulo: "Modalidade" },
  categorias_gold: { titulo: "Categoria Gold" },
  areas_fin: { titulo: "Área financiada" },
  concelhos: { titulo: "Concelho" },
  financiadores: { titulo: "Financiador" },
} as const;

export type ListaOpcoesId = keyof typeof LISTAS_OPCOES;
