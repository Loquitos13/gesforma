// Configuração do editor visual (Puck): tema da página e blocos disponíveis.
import { createContext, useContext, type CSSProperties, type ElementType, type ReactNode } from "react";
import type { ComponentConfig, Config, Data, Field } from "@puckeditor/core";
import type { BlocoSite, PaginaSite } from "../../partilhado/siteBlocos";
import { AreaFormando } from "./blocosArea";
import { Catalogo } from "./blocosCatalogo";
import { DetalheCurso } from "./blocosCursoPagina";
import { Servicos } from "./blocosServicos";
import { Testemunhos } from "./blocosTestemunhos";
import { CursoRelevantes } from "./blocosCursoRelevantes";
import {
  CursoBanner, CursoDados, CursoFuncionamento, CursoObjetivos, CursoPrograma, CursoSintese, CursoTurmas, RaizCurso, campoPrevisualizar, CursoVideo,
} from "./blocosCurso";
import { CursoBotaoInscricao, CursoEscolhaLocal, CursoImagem, CursoInscricao, CursoTexto } from "./blocosCursoCartao";
import { ListaNoticias } from "./blocosNoticias";
import { campoPrevisualizarServico, RaizServico, ServicoBanner, ServicoCartoes, ServicoChamada, ServicoDetalhe, ServicoGaleria, ServicoLogos, ServicoVideo } from "./blocosServico";
import { FormularioProposta } from "./blocosFormulario";
import { campoPrevisualizarNoticia, NoticiaCabecalho, NoticiaCorpo, NoticiaCurso, NoticiaImagem, NoticiaOutras, RaizNoticia } from "./blocosNoticia";
import { RedesSociais } from "./blocosRedes";
import { Botao, Coluna, Espaco, Imagem, Logotipos, Pilares, Seccao, Separador, Texto, Titulo } from "./blocosBase";
import { CursosDestaque, OfertaFormativa } from "./blocosCursos";
import { Cabecalho, CabecalhoSite, Rodape, RodapeSite, type CabecalhoProps, type RodapeProps } from "./blocosMoldura";
import { campoCor, campoFonte, campoNumero } from "./campos";
import {
  AvisoDispositivoCtx, CampoDispositivo, efetivas, MedirDispositivo, paraDesenhoEdicao, useDispositivo, type Variantes,
} from "./dispositivos";
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

/** Invólucro da página: mede o ecrã (no editor, o da pré-visualização) e aplica o tema desse ecrã. */
export function InvolucroTema({ tema, children }: { tema: Partial<TemaSite> | undefined; children: ReactNode }) {
  const aviso = useContext(AvisoDispositivoCtx);
  return (
    <MedirDispositivo aoMudar={aviso ?? undefined}>
      {ref => <TemaDoEcra refEl={ref} tema={tema}>{children}</TemaDoEcra>}
    </MedirDispositivo>
  );
}

function TemaDoEcra({ refEl, tema, children }: { refEl: (el: HTMLDivElement | null) => void; tema: Partial<TemaSite> | undefined; children: ReactNode }) {
  const d = useDispositivo();
  const t = efetivas((tema ?? {}) as Record<string, unknown>, d, []) as Partial<TemaSite>;
  return <div ref={refEl} className="site-ena min-h-screen" style={estiloTema(t)}>{children}</div>;
}

/** Props de um bloco com os valores do ecrã onde está (cabeçalho e rodapé fora do editor). */
export function NoEcra<P extends object>({ props, children }: { props: P; children: (p: P) => ReactNode }) {
  const d = useDispositivo();
  return <>{children(efetivas(props as Record<string, unknown>, d, []) as P)}</>;
}

// ─── Edição por ecrã em todos os blocos ──────────────────────────────────────

function Responsivo({ Orig, props, slots }: { Orig: ElementType; props: Record<string, unknown>; slots: string[] }) {
  const d = useDispositivo();
  // No editor, as props já são as do ecrã em edição (o painel escreve-as); no site, vêm das variantes.
  const editar = (props.puck as { isEditing?: boolean } | undefined)?.isEditing;
  return <Orig {...(editar ? paraDesenhoEdicao(props, d) : efetivas(props, d, slots))} />;
}

/**
 * Junta a um bloco (ou à raiz) a edição por ecrã: o campo "Ecrã" no topo do painel e o desenho com os
 * valores do ecrã onde está. O registo das alterações faz-se no editor (registarNoEcra), não num
 * resolveData: esse passo assíncrono deixava as caixas de selecção a mostrar o valor antigo.
 */
function responsivo<C extends Partial<ComponentConfig<any>>>(cfg: C): C {
  const campos = (cfg.fields ?? {}) as Record<string, Field & { label?: string }>;
  const slots = Object.entries(campos).filter(([, f]) => f.type === "slot").map(([k]) => k);
  const rotulos = Object.fromEntries(Object.entries(campos).map(([k, f]) => [k, f.label ?? k]));
  const Orig = cfg.render as unknown as ElementType;
  const campoEcra: Field = { type: "custom", label: "Ecrã", render: ({ value, onChange }) => <CampoDispositivo value={value as Variantes | undefined} onChange={onChange} rotulos={rotulos} /> };
  return {
    ...cfg,
    // Sem a div extra do Puck à volta: cada bloco liga a pega de arrastar ao seu elemento (puck.dragRef),
    // para o editor ter a mesma estrutura do site (alinhamentos e margens iguais).
    inline: true,
    fields: { __disp: campoEcra, ...campos },
    render: (props: Record<string, unknown>) => <Responsivo Orig={Orig} props={props} slots={slots} />,
  } as C;
}

const camposTema = {
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
};

/** Cabeçalho, rodapé e tema da página inicial: as outras páginas do site usam-nos. */
export type Moldura = { cabecalho: CabecalhoProps | null; rodape: RodapeProps | null; tema: Partial<TemaSite> | undefined };
export const MolduraCtx = createContext<Moldura | null>(null);

function RaizOutra({ children, editar }: { children: ReactNode; editar: boolean }) {
  const m = useContext(MolduraCtx);
  return (
    <InvolucroTema tema={m?.tema}>
      {m?.cabecalho && <NoEcra props={m.cabecalho}>{p => <CabecalhoSite {...p} editar={editar} />}</NoEcra>}
      {children}
      {m?.rodape && <NoEcra props={m.rodape}>{p => <RodapeSite {...p} />}</NoEcra>}
    </InvolucroTema>
  );
}

const componentes = Object.fromEntries(Object.entries({
  Seccao, Coluna, Espaco, Separador, Titulo, Texto, Botao, Imagem, Pilares, Logotipos, Servicos, Testemunhos,
  CursosDestaque, OfertaFormativa, Catalogo, DetalheCurso, ListaNoticias, AreaFormando, Cabecalho, Rodape,
  CursoBanner, CursoSintese, CursoDados, CursoObjetivos, CursoPrograma, CursoFuncionamento, CursoTurmas, CursoRelevantes, CursoInscricao,
  CursoEscolhaLocal, CursoTexto, CursoImagem, CursoBotaoInscricao, CursoVideo,
  ServicoBanner, ServicoDetalhe, ServicoGaleria, ServicoVideo, ServicoLogos, ServicoCartoes, ServicoChamada, FormularioProposta,
  NoticiaCabecalho, NoticiaCorpo, NoticiaOutras, NoticiaImagem, NoticiaCurso, RedesSociais,
  // Cada bloco do editor tem de estar em BLOCOS_SITE (o servidor recusa publicar blocos que não conhece): falha no build.
} satisfies Record<BlocoSite, unknown>).map(([k, c]) => [k, responsivo(c as ComponentConfig<any>)])) as Config["components"];

const categoriasBase = {
  estrutura: { title: "Estrutura", components: ["Seccao", "Coluna", "Espaco", "Separador"] },
  conteudo: { title: "Conteúdo", components: ["Titulo", "Texto", "Botao", "Imagem", "Pilares", "Servicos", "Testemunhos", "Logotipos", "RedesSociais", "FormularioProposta"] },
  cursos: { title: "Cursos", components: ["CursosDestaque", "OfertaFormativa", "Catalogo"] },
  especiais: { title: "Notícias e área do formando", components: ["ListaNoticias", "AreaFormando"] },
  // Blocos que só fazem sentido na página do curso (lêem o curso da página).
  paginaCurso: {
    title: "Página do curso",
    components: ["CursoBanner", "CursoSintese", "CursoVideo", "CursoDados", "CursoObjetivos", "CursoPrograma", "CursoFuncionamento", "CursoTurmas", "CursoRelevantes", "CursoEscolhaLocal",
      "CursoInscricao", "CursoTexto", "CursoImagem", "CursoBotaoInscricao", "DetalheCurso",
    ],
    visible: false,
  },
  // Blocos que só fazem sentido na página de serviço (lêem o serviço da página).
  paginaServico: { title: "Página de serviço", components: ["ServicoBanner", "ServicoDetalhe", "ServicoCartoes", "ServicoGaleria", "ServicoVideo", "ServicoLogos", "ServicoChamada"], visible: false },
  paginaNoticia: { title: "Página de notícia", components: ["NoticiaCabecalho", "NoticiaImagem", "NoticiaCorpo", "NoticiaCurso", "NoticiaOutras"], visible: false },
};

/**
 * Na página inicial, o cabeçalho e o rodapé são os de «Cabeçalho e rodapé» (partilhados por todo o site): os blocos
 * que lá estão só marcam o lugar e mostram os partilhados; editam-se nessa página.
 */
const avisoMoldura: Field = {
  type: "custom", label: "Cabeçalho e rodapé",
  render: () => (
    <p className="m-0 text-[13px] leading-5 text-[#3d4a5a]">
      O cabeçalho e o rodapé são os mesmos em todas as páginas: editam-se na página «Cabeçalho e rodapé» (lista de páginas, à esquerda).
    </p>
  ),
};

function CabecalhoPartilhado({ puck, ...proprio }: CabecalhoProps & { puck?: { isEditing?: boolean; dragRef?: ((el: Element | null) => void) | null } }) {
  const m = useContext(MolduraCtx);
  const editar = Boolean(puck?.isEditing);
  if (m?.cabecalho) return <NoEcra props={m.cabecalho}>{p => <CabecalhoSite {...p} editar={editar} refRaiz={puck?.dragRef} />}</NoEcra>;
  return <CabecalhoSite {...proprio} editar={editar} refRaiz={puck?.dragRef} />;
}

function RodapePartilhado({ puck, ...proprio }: RodapeProps & { puck?: { dragRef?: ((el: Element | null) => void) | null } }) {
  const m = useContext(MolduraCtx);
  if (m?.rodape) return <NoEcra props={m.rodape}>{p => <RodapeSite {...p} refRaiz={puck?.dragRef} />}</NoEcra>;
  return <RodapeSite {...proprio} refRaiz={puck?.dragRef} />;
}

const componentesInicio = {
  ...componentes,
  Cabecalho: { ...Cabecalho, inline: true, fields: { aviso: avisoMoldura }, render: CabecalhoPartilhado as never },
  Rodape: { ...Rodape, inline: true, fields: { aviso: avisoMoldura }, render: RodapePartilhado as never },
} as Config["components"];

/** A página inicial guarda o tema; o cabeçalho e o rodapé vêm de «Cabeçalho e rodapé»; as outras só o conteúdo do meio. */
export const configSite: Config = {
  // A raiz guarda o tema com as variantes por ecrã: o invólucro escolhe as do ecrã.
  root: {
    ...responsivo({ fields: camposTema, render: () => <></> }),
    defaultProps: temaPadrao,
    render: ({ children, puck: _p, ...tema }: { children: ReactNode; puck?: unknown } & Record<string, unknown>) => <InvolucroTema tema={tema as Partial<TemaSite>}>{children}</InvolucroTema>,
  } as Config["root"],
  categories: { ...categoriasBase, moldura: { title: "Cabeçalho e rodapé (página própria)", components: [], visible: false } },
  components: componentesInicio,
};

/** «Cabeçalho e rodapé»: os dois blocos partilhados por todas as páginas, com o tema da página inicial. */
export const configMoldura: Config = {
  root: {
    fields: {},
    render: ({ children }: { children: ReactNode }) => {
      const m = useContext(MolduraCtx);
      return <InvolucroTema tema={m?.tema}>{children}</InvolucroTema>;
    },
  },
  categories: {
    moldura: { title: "Cabeçalho e rodapé", components: ["Cabecalho", "Rodape"] },
    ...Object.fromEntries(Object.entries(categoriasBase).map(([k, c]) => [k, { ...c, visible: false }])),
  },
  components: componentes,
};

export const configOutraPagina: Config = {
  root: {
    fields: {},
    render: ({ children, puck }: { children: ReactNode; puck?: { isEditing?: boolean } }) => <RaizOutra editar={Boolean(puck?.isEditing)}>{children}</RaizOutra>,
  },
  categories: { ...categoriasBase, moldura: { title: "Cabeçalho e rodapé (página própria)", components: [], visible: false } },
  components: componentes,
};

/** Página do curso: a raiz escolhe o curso (no editor, o da pré-visualização) e os blocos «Curso · …» lêem-no. */
export const configPaginaCurso: Config = {
  root: {
    fields: { previsualizar: campoPrevisualizar },
    defaultProps: { previsualizar: "" },
    render: ({ children, puck, previsualizar }: { children: ReactNode; puck?: { isEditing?: boolean }; previsualizar?: string }) => (
      <RaizOutra editar={Boolean(puck?.isEditing)}>
        <RaizCurso previsualizar={previsualizar ?? ""} editar={Boolean(puck?.isEditing)}>{children}</RaizCurso>
      </RaizOutra>
    ),
  } as Config["root"],
  categories: {
    paginaCurso: { ...categoriasBase.paginaCurso, components: categoriasBase.paginaCurso.components.filter(c => c !== "DetalheCurso"), visible: true },
    ...Object.fromEntries(Object.entries(categoriasBase).filter(([k]) => k !== "paginaCurso")),
    moldura: { title: "Cabeçalho e rodapé (página própria)", components: [], visible: false },
    antigos: { title: "Antigos", components: ["DetalheCurso"], visible: false },
  },
  components: componentes,
};

type No = { type: string; props: Record<string, unknown> };
const eObjeto = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const eListaDeBlocos = (v: unknown): v is No[] => Array.isArray(v) && v.every(b => eObjeto(b) && typeof b.type === "string" && eObjeto(b.props));

/**
 * Blocos gravados antes de uma opção existir não a têm: o painel mostrava-a em branco (ex.: «Mostrar o botão»
 * sem Sim nem Não). Ao abrir no editor, as opções em falta (e as de dentro dos grupos) ganham o valor por omissão.
 */
export function completarPadroes(d: Data): Data {
  const completar = (lista: No[]): No[] => lista.map(b => {
    const padrao = (componentes[b.type]?.defaultProps ?? {}) as Record<string, unknown>;
    const props: Record<string, unknown> = { ...b.props };
    for (const [k, v] of Object.entries(padrao)) {
      if (props[k] === undefined) props[k] = v;
      else if (eObjeto(v) && eObjeto(props[k])) props[k] = { ...v, ...(props[k] as object) };
    }
    for (const [k, v] of Object.entries(props)) if (eListaDeBlocos(v)) props[k] = completar(v);
    return { ...b, props };
  });
  return { ...d, content: completar((d.content ?? []) as No[]) as Data["content"] };
}

/** Página de cada serviço: a raiz escolhe o serviço (no editor, o da pré-visualização) e os blocos «Serviço · …» lêem-no. */
export const configPaginaServico: Config = {
  root: {
    fields: { previsualizar: campoPrevisualizarServico },
    defaultProps: { previsualizar: "" },
    render: ({ children, puck, previsualizar }: { children: ReactNode; puck?: { isEditing?: boolean }; previsualizar?: string }) => (
      <RaizOutra editar={Boolean(puck?.isEditing)}>
        <RaizServico previsualizar={previsualizar ?? ""} editar={Boolean(puck?.isEditing)}>{children}</RaizServico>
      </RaizOutra>
    ),
  } as Config["root"],
  categories: {
    paginaServico: { ...categoriasBase.paginaServico, visible: true },
    ...Object.fromEntries(Object.entries(categoriasBase).filter(([k]) => k !== "paginaServico")),
    moldura: { title: "Cabeçalho e rodapé (página própria)", components: [], visible: false },
  },
  components: componentes,
};

/** Página de cada notícia: a raiz escolhe a notícia (no editor, a da pré-visualização) e os blocos «Notícia · …» lêem-na. */
export const configPaginaNoticia: Config = {
  root: {
    fields: { previsualizar: campoPrevisualizarNoticia },
    defaultProps: { previsualizar: "" },
    render: ({ children, puck, previsualizar }: { children: ReactNode; puck?: { isEditing?: boolean }; previsualizar?: string }) => (
      <RaizOutra editar={Boolean(puck?.isEditing)}>
        <RaizNoticia previsualizar={previsualizar ?? ""} editar={Boolean(puck?.isEditing)}>{children}</RaizNoticia>
      </RaizOutra>
    ),
  } as Config["root"],
  categories: {
    paginaNoticia: { ...categoriasBase.paginaNoticia, visible: true },
    ...Object.fromEntries(Object.entries(categoriasBase).filter(([k]) => k !== "paginaNoticia")),
    moldura: { title: "Cabeçalho e rodapé (página própria)", components: [], visible: false },
  },
  components: componentes,
};

export const configPara = (pagina: PaginaSite) =>
  (pagina === "inicio" ? configSite : pagina === "moldura" ? configMoldura : pagina === "curso" ? configPaginaCurso : pagina === "servico" ? configPaginaServico
    : pagina === "noticia" ? configPaginaNoticia : configOutraPagina);
