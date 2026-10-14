// Configuração do editor visual (Puck): tema da página e blocos disponíveis.
import type { CSSProperties, ReactNode } from "react";
import type { Config } from "@puckeditor/core";
import { Botao, Coluna, Espaco, Imagem, Logotipos, Pilares, Seccao, Separador, Texto, Titulo } from "./blocosBase";
import { CursosDestaque, OfertaFormativa } from "./blocosCursos";
import { Cabecalho, Rodape } from "./blocosMoldura";
import { campoCor, campoFonte, campoNumero } from "./campos";
import { corSegura, pilhaFonte } from "./estilos";

export type TemaSite = {
  corPrimaria: string; corDestaque: string; corAcento: string; corFundo: string; corTexto: string; corSuave: string;
  fonteTitulos: string; fonteTexto: string; tamanhoBase: number | null; largura: number | null;
};

export const temaPadrao: TemaSite = {
  corPrimaria: "#14263D", corDestaque: "#A60000", corAcento: "#FFA900", corFundo: "#F6F3EE", corTexto: "#1C3350", corSuave: "#3E5168",
  fonteTitulos: "Atkinson Hyperlegible", fonteTexto: "Atkinson Hyperlegible", tamanhoBase: 16, largura: 1240,
};

/** Variáveis do tema (cores, fontes, largura) no invólucro da página. */
export function estiloTema(t: Partial<TemaSite> | undefined): CSSProperties {
  const v = { ...temaPadrao, ...(t ?? {}) };
  const cor = (x: string, padrao: string) => corSegura(x) && !x.startsWith("var(") ? x : padrao;
  // O tema não se pode referir às próprias fontes ("fonte do tema"): isso fica com a fonte por omissão.
  const fonte = (nome: string) => (nome.startsWith("tema-") ? undefined : pilhaFonte(nome));
  const titulos = fonte(v.fonteTitulos) ?? pilhaFonte(temaPadrao.fonteTitulos)!;
  const texto = fonte(v.fonteTexto) ?? pilhaFonte(temaPadrao.fonteTexto)!;
  return {
    ["--c-primaria" as string]: cor(v.corPrimaria, temaPadrao.corPrimaria),
    ["--c-destaque" as string]: cor(v.corDestaque, temaPadrao.corDestaque),
    ["--c-acento" as string]: cor(v.corAcento, temaPadrao.corAcento),
    ["--c-fundo" as string]: cor(v.corFundo, temaPadrao.corFundo),
    ["--c-texto" as string]: cor(v.corTexto, temaPadrao.corTexto),
    ["--c-suave" as string]: cor(v.corSuave, temaPadrao.corSuave),
    ["--f-titulos" as string]: titulos,
    ["--f-texto" as string]: texto,
    ["--font-serif" as string]: titulos,
    ["--font-sans" as string]: texto,
    ["--largura" as string]: `${v.largura || 1240}px`,
    fontFamily: texto,
    fontSize: v.tamanhoBase ? `${v.tamanhoBase}px` : undefined,
    background: "var(--c-fundo)",
    color: "var(--c-texto)",
  } as CSSProperties;
}

export function InvolucroTema({ tema, children }: { tema: Partial<TemaSite> | undefined; children: ReactNode }) {
  return <div className="site-ena min-h-screen" style={estiloTema(tema)}>{children}</div>;
}

export const configSite: Config = {
  root: {
    fields: {
      corPrimaria: campoCor("Cor primária", false),
      corDestaque: campoCor("Cor de destaque", false),
      corAcento: campoCor("Cor de acento", false),
      corFundo: campoCor("Cor de fundo da página", false),
      corTexto: campoCor("Cor do texto", false),
      corSuave: campoCor("Cor do texto suave", false),
      fonteTitulos: campoFonte("Fonte dos títulos"),
      fonteTexto: campoFonte("Fonte do texto"),
      tamanhoBase: campoNumero("Tamanho base do texto"),
      largura: campoNumero("Largura do conteúdo"),
    },
    defaultProps: temaPadrao,
    render: ({ children, puck: _p, ...tema }: { children: ReactNode; puck?: unknown } & Record<string, unknown>) => <InvolucroTema tema={tema as Partial<TemaSite>}>{children}</InvolucroTema>,
  },
  categories: {
    estrutura: { title: "Estrutura", components: ["Seccao", "Coluna", "Espaco", "Separador"] },
    conteudo: { title: "Conteúdo", components: ["Titulo", "Texto", "Botao", "Imagem", "Pilares", "Logotipos"] },
    cursos: { title: "Cursos", components: ["CursosDestaque", "OfertaFormativa"] },
    moldura: { title: "Cabeçalho e rodapé", components: ["Cabecalho", "Rodape"] },
  },
  components: {
    Seccao, Coluna, Espaco, Separador, Titulo, Texto, Botao, Imagem, Pilares, Logotipos, CursosDestaque, OfertaFormativa, Cabecalho, Rodape,
  } as Config["components"],
};
