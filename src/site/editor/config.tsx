// Configuração do editor visual (Puck): tema da página e blocos disponíveis.
import { createContext, useContext, type CSSProperties, type ElementType, type ReactNode } from "react";
import type { ComponentConfig, Config, Field } from "@puckeditor/core";
import type { PaginaSite } from "../../partilhado/siteBlocos";
import { AreaFormando } from "./blocosArea";
import { Catalogo } from "./blocosCatalogo";
import { ListaNoticias } from "./blocosNoticias";
import { Botao, Coluna, Espaco, Imagem, Logotipos, Pilares, Seccao, Separador, Texto, Titulo } from "./blocosBase";
import { CursosDestaque, OfertaFormativa } from "./blocosCursos";
import { Cabecalho, CabecalhoSite, Rodape, RodapeSite, type CabecalhoProps, type RodapeProps } from "./blocosMoldura";
import { campoCor, campoFonte, campoNumero } from "./campos";
import {
  AvisoDispositivoCtx, CampoDispositivo, criarVariantes, dispositivoEmEdicao, efetivas, MedirDispositivo, registarAlteracao,
  useDispositivo, type Variantes,
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
  return <Orig {...efetivas(props, d, slots)} />;
}

/**
 * Junta a um bloco (ou à raiz) a edição por ecrã: o campo "Ecrã" no topo do painel, o registo das
 * alterações no ecrã em edição (resolveData) e o desenho com os valores do ecrã onde está.
 */
function responsivo<C extends Partial<ComponentConfig<any>>>(cfg: C): C {
  const campos = (cfg.fields ?? {}) as Record<string, Field & { label?: string }>;
  const slots = Object.entries(campos).filter(([, f]) => f.type === "slot").map(([k]) => k);
  const rotulos = Object.fromEntries(Object.entries(campos).map(([k, f]) => [k, f.label ?? k]));
  const Orig = cfg.render as unknown as ElementType;
  const campoEcra: Field = { type: "custom", label: "Ecrã", render: ({ value, onChange }) => <CampoDispositivo value={value as Variantes | undefined} onChange={onChange} rotulos={rotulos} /> };
  return {
    ...cfg,
    fields: { __disp: campoEcra, ...campos },
    resolveData: async (data: { props: Record<string, unknown> }, params: { changed: Record<string, boolean>; trigger: string }) => {
      const props = data.props;
      const v = props.__disp as Variantes | undefined;
      if (!v) return { ...data, props: { ...props, __disp: criarVariantes(props, slots) } };
      if (params.trigger !== "replace") return data;
      const d = dispositivoEmEdicao();
      const mudou = Object.keys(params.changed).filter(k => params.changed[k] && k !== "id" && !slots.includes(k));
      // "Voltar a herdar" no campo Ecrã: as props passam aos valores do ecrã.
      if (mudou.includes("__disp")) return { ...data, props: efetivas(props, d, slots) };
      if (!mudou.length) return data;
      return { ...data, props: { ...props, __disp: registarAlteracao(v, props, mudou, d) } };
    },
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
  Seccao, Coluna, Espaco, Separador, Titulo, Texto, Botao, Imagem, Pilares, Logotipos,
  CursosDestaque, OfertaFormativa, Catalogo, ListaNoticias, AreaFormando, Cabecalho, Rodape,
}).map(([k, c]) => [k, responsivo(c as ComponentConfig<any>)])) as Config["components"];

const categoriasBase = {
  estrutura: { title: "Estrutura", components: ["Seccao", "Coluna", "Espaco", "Separador"] },
  conteudo: { title: "Conteúdo", components: ["Titulo", "Texto", "Botao", "Imagem", "Pilares", "Logotipos"] },
  cursos: { title: "Cursos", components: ["CursosDestaque", "OfertaFormativa", "Catalogo"] },
  especiais: { title: "Notícias e área do formando", components: ["ListaNoticias", "AreaFormando"] },
};

/** A página inicial guarda o tema, o cabeçalho e o rodapé; as outras só o conteúdo do meio. */
export const configSite: Config = {
  // A raiz guarda o tema com as variantes por ecrã: o invólucro escolhe as do ecrã.
  root: {
    ...responsivo({ fields: camposTema, render: () => <></> }),
    defaultProps: temaPadrao,
    render: ({ children, puck: _p, ...tema }: { children: ReactNode; puck?: unknown } & Record<string, unknown>) => <InvolucroTema tema={tema as Partial<TemaSite>}>{children}</InvolucroTema>,
  } as Config["root"],
  categories: { ...categoriasBase, moldura: { title: "Cabeçalho e rodapé", components: ["Cabecalho", "Rodape"] } },
  components: componentes,
};

export const configOutraPagina: Config = {
  root: {
    fields: {},
    render: ({ children, puck }: { children: ReactNode; puck?: { isEditing?: boolean } }) => <RaizOutra editar={Boolean(puck?.isEditing)}>{children}</RaizOutra>,
  },
  categories: { ...categoriasBase, moldura: { title: "Cabeçalho e rodapé (só na página inicial)", components: [], visible: false } },
  components: componentes,
};

export const configPara = (pagina: PaginaSite) => (pagina === "inicio" ? configSite : configOutraPagina);
