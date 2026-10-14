// Grupos de campos comuns a todos os blocos: Aparência (caixa) e Tipografia.
import type { Field } from "@puckeditor/core";
import { campoCor, campoFonte, campoImagem, campoLados, campoMedida, campoNumero, simNao } from "./campos";

export const campoAparencia = (label = "Aparência"): Field => ({
  type: "object",
  label,
  objectFields: {
    margem: campoLados("Margem exterior"),
    preenchimento: campoLados("Espaço interior"),
    margemTel: campoLados("Margem exterior no telemóvel"),
    preenchimentoTel: campoLados("Espaço interior no telemóvel"),
    largura: campoMedida("Largura"),
    larguraMax: campoMedida("Largura máxima"),
    alturaMin: campoMedida("Altura mínima"),
    alinhar: {
      type: "select", label: "Alinhar o bloco",
      options: [{ label: "Normal", value: "" }, { label: "À esquerda", value: "inicio" }, { label: "Ao centro", value: "centro" }, { label: "À direita", value: "fim" }],
    },
    deslocX: campoNumero("Mover na horizontal"),
    deslocY: campoNumero("Mover na vertical"),
    camada: campoNumero("Camada (à frente / atrás)", ""),
    fundoCor: campoCor("Cor de fundo"),
    fundoImagem: campoImagem("Imagem de fundo"),
    fundoSobreposicao: campoCor("Película sobre a imagem"),
    bordaLargura: campoNumero("Espessura da borda"),
    bordaTopo: campoNumero("Barra no topo"),
    bordaCor: campoCor("Cor da borda"),
    bordaEstilo: {
      type: "select", label: "Tipo de borda",
      options: [{ label: "Contínua", value: "solid" }, { label: "Tracejada", value: "dashed" }, { label: "Pontilhada", value: "dotted" }],
    },
    raio: campoNumero("Cantos arredondados"),
    sombra: {
      type: "select", label: "Sombra",
      options: [{ label: "Nenhuma", value: "" }, { label: "Suave", value: "suave" }, { label: "Média", value: "media" }, { label: "Forte", value: "forte" }],
    },
    opacidade: campoNumero("Opacidade", "%"),
    ocultarTel: simNao("Esconder no telemóvel"),
    ocultarTab: simNao("Esconder no tablet"),
    ocultarPc: simNao("Esconder no computador"),
    ancora: { type: "text", label: "Âncora (para ligações #nome)" },
  },
});

export const campoTipografia = (label = "Tipografia"): Field => ({
  type: "object",
  label,
  objectFields: {
    fonte: campoFonte("Fonte"),
    tamanho: campoNumero("Tamanho"),
    tamanhoTel: campoNumero("Tamanho no telemóvel"),
    peso: {
      type: "select", label: "Peso",
      options: [
        { label: "Herdado", value: "" }, { label: "Fino (300)", value: "300" }, { label: "Normal (400)", value: "400" },
        { label: "Médio (500)", value: "500" }, { label: "Semi-negrito (600)", value: "600" }, { label: "Negrito (700)", value: "700" },
        { label: "Extra (800)", value: "800" }, { label: "Preto (900)", value: "900" },
      ],
    },
    alturaLinha: campoNumero("Altura da linha", "×", 0.05),
    espacamento: campoNumero("Espaço entre letras", "px", 0.1),
    cor: campoCor("Cor"),
    alinhamento: {
      type: "select", label: "Alinhamento",
      options: [{ label: "Herdado", value: "" }, { label: "Esquerda", value: "left" }, { label: "Centro", value: "center" }, { label: "Direita", value: "right" }, { label: "Justificado", value: "justify" }],
    },
    transformacao: {
      type: "select", label: "Maiúsculas",
      options: [{ label: "Como escrito", value: "" }, { label: "MAIÚSCULAS", value: "uppercase" }, { label: "minúsculas", value: "lowercase" }, { label: "Iniciais", value: "capitalize" }],
    },
    italico: simNao("Itálico"),
  },
});
