// Bloco "Área do formando": o painel de quem entrou (cursos, agenda, certificados…) e a entrada.
// No editor mostra o painel com dados de exemplo (ou a entrada, à escolha); no site faz o percurso todo.
import type { ComponentConfig } from "@puckeditor/core";
import { moradaSegura } from "../../partilhado/siteConteudo";
import { LoginFormando, PAINEL_ENTRADA, type PainelEntrada, type Separador } from "../AreaFormando";
import { AreaFormandoConteudo, OPCOES_PAINEL, Painel, type OpcoesPainel } from "../AreaFormandoPainel";
import { campoCor, campoImagem, campoMarcas, simNao } from "./campos";
import { campoAparencia } from "./camposGrupos";
import { corSegura, estiloBloco, estiloVazio, type Estilo } from "./estilos";
import { AREA_EXEMPLO } from "./exemploArea";

const SEPARADORES: { valor: Separador; rotulo: string }[] = [
  { valor: "courses", rotulo: "Os meus cursos" }, { valor: "agenda", rotulo: "Agenda" },
  { valor: "certificates", rotulo: "Certificados" }, { valor: "documents", rotulo: "Documentos (Financiada)" },
  { valor: "notifications", rotulo: "Notificações" }, { valor: "payments", rotulo: "Pagamentos" },
  { valor: "profile", rotulo: "O meu perfil" },
];

type Props = {
  previsualizar: "painel" | "entrada";
  saudacao: string; tituloPainel: string; fundoTopo: string; resumo: boolean; separadores: Separador[];
  mostrar: boolean; kicker: string; titulo: string; itens: { texto: string }[]; rodape: string;
  fundo: string; imagem: string; fundoFormulario: string; aparencia: Estilo;
};

function entradaDe(p: Props): PainelEntrada {
  return {
    mostrar: p.mostrar, kicker: p.kicker, titulo: p.titulo, rodape: p.rodape,
    itens: (p.itens ?? []).map(i => i.texto).filter(Boolean),
    fundo: corSegura(p.fundo) ?? PAINEL_ENTRADA.fundo,
    fundoFormulario: corSegura(p.fundoFormulario) ?? PAINEL_ENTRADA.fundoFormulario,
    imagem: p.imagem ? moradaSegura(p.imagem) : "",
  };
}

function painelDe(p: Props): OpcoesPainel {
  return {
    saudacao: p.saudacao ?? OPCOES_PAINEL.saudacao, titulo: p.tituloPainel ?? OPCOES_PAINEL.titulo,
    fundoTopo: corSegura(p.fundoTopo) ?? "", resumo: p.resumo !== false,
    separadores: Array.isArray(p.separadores) ? p.separadores : OPCOES_PAINEL.separadores,
  };
}

export const AreaFormando: ComponentConfig<Props> = {
  label: "Área do formando",
  fields: {
    previsualizar: {
      type: "radio", label: "No editor, mostrar",
      options: [{ label: "Painel do formando", value: "painel" }, { label: "Ecrã de entrada", value: "entrada" }],
    },
    saudacao: { type: "text", label: "Painel · saudação (antes do nome)" },
    tituloPainel: { type: "text", label: "Painel · título" },
    fundoTopo: campoCor("Painel · fundo do topo"),
    resumo: simNao("Painel · números do resumo"),
    separadores: campoMarcas("Painel · separadores visíveis", SEPARADORES),
    mostrar: simNao("Entrada · painel ao lado do formulário"),
    kicker: { type: "text", label: "Entrada · etiqueta" },
    titulo: { type: "textarea", label: "Entrada · título" },
    itens: {
      type: "array", label: "Entrada · vantagens (lista com visto)",
      arrayFields: { texto: { type: "text", label: "Texto" } },
      defaultItemProps: { texto: "" },
      getItemSummary: i => i.texto || "Vantagem",
    },
    rodape: { type: "text", label: "Entrada · texto no fundo do painel" },
    fundo: campoCor("Entrada · fundo do painel"),
    imagem: campoImagem("Entrada · imagem de fundo do painel"),
    fundoFormulario: campoCor("Entrada · fundo do formulário"),
    aparencia: campoAparencia(),
  },
  defaultProps: {
    previsualizar: "painel",
    saudacao: OPCOES_PAINEL.saudacao, tituloPainel: OPCOES_PAINEL.titulo, fundoTopo: "var(--c-primaria)", resumo: true,
    separadores: [...OPCOES_PAINEL.separadores],
    mostrar: true, kicker: PAINEL_ENTRADA.kicker, titulo: PAINEL_ENTRADA.titulo,
    itens: PAINEL_ENTRADA.itens.map(texto => ({ texto })), rodape: PAINEL_ENTRADA.rodape,
    fundo: "var(--c-primaria)", imagem: "", fundoFormulario: "#F9F9F9", aparencia: estiloVazio(),
  },
  render: ({ puck, ...resto }) => {
    const p = resto as Props;
    const c = estiloBloco(p.aparencia);
    const entrada = entradaDe(p);
    const opcoes = painelDe(p);
    let conteudo;
    if (!puck?.isEditing) conteudo = <AreaFormandoConteudo painel={entrada} opcoes={opcoes} />;
    else if (p.previsualizar === "entrada") conteudo = <LoginFormando onEntrou={() => undefined} painel={entrada} />;
    else conteudo = <Painel dados={AREA_EXEMPLO} onDados={() => undefined} onSair={() => undefined} avisar={() => undefined} opcoes={opcoes} />;
    return <div ref={puck?.dragRef ?? undefined} className={c.className} style={c.style}>{conteudo}</div>;
  },
};
