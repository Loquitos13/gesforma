// Blocos de cursos: destaques escolhidos à mão (e por ordem) e a oferta formativa com filtros.
// O cartão do curso tem vários formatos e escolhe-se que informação mostra.
import { useContext, useMemo, useState, type ComponentType, type CSSProperties } from "react";
import type { ComponentConfig, Field, Slot } from "@puckeditor/core";
import { OfertaCtx, type Course } from "../SiteLanding";
import { campoCor, campoCurso, campoImagem, campoMarcas, campoNumero, campoOrdemCursos, nomesCursos, simNao } from "./campos";
import { campoAparencia, campoTipografia } from "./camposGrupos";
import { corSegura, estiloBloco, estiloTexto, estiloVazio, juntar, ligacaoSegura, tipoVazia, type Estilo, type Tipografia } from "./estilos";
import { ajudaVariaveis, preencherVariaveis, variaveisCurso } from "./blocosCurso";

export const INFO_CARTAO = [
  { valor: "imagem", rotulo: "Imagem" },
  { valor: "formato", rotulo: "Modalidade" },
  { valor: "regime", rotulo: "Gold / Financiada" },
  { valor: "area", rotulo: "Área" },
  { valor: "titulo", rotulo: "Título" },
  { valor: "descricao", rotulo: "Texto de destaque" },
  { valor: "preco", rotulo: "Preço" },
  { valor: "duracao", rotulo: "Duração" },
  { valor: "inicio", rotulo: "Início / local" },
  { valor: "botao", rotulo: "Botão" },
] as const;
type Info = typeof INFO_CARTAO[number]["valor"];

/** Etiquetas que todos os cartões de curso mostram: modalidade (E-learning, B-learning, Presencial) e regime. */
const SEMPRE_VISIVEL: Info[] = ["formato", "regime"];

export type EstiloCartao = {
  formato: "vertical" | "horizontal" | "sobreposto" | "compacto" | "lista";
  mostrar: Info[];
  proporcao: "16/9" | "4/3" | "3/2" | "1/1";
  linhasDescricao: number | null;
  textoBotao: string;
  colunas: number; colunasTab: number; colunasTel: number;
  espaco: number | null;
  corFundo: string; corAcento: string; corTitulo: string; corTexto: string;
  raio: number | null;
  barraTopo: number | null;
  sombra: "" | "suave" | "media" | "forte";
  efeito: "" | "subir" | "zoom";
  disposicao?: "" | "diagonal" | "diagonal-inversa";
  desvio?: number | null;
  animacao?: "" | "flutuar" | "balancar";
  animacaoBotao?: "" | "pulsar" | "saltar";
  corBotao?: string; corTextoBotao?: string;
  centrar: boolean;
  interior: number | null;
  tipoTitulo: Tipografia;
  /** Textos do preço e do início (vazio = os do curso); `porCurso` muda-os só num curso (ex.: CCP). */
  textoPreco?: string; textoInicio?: string;
  porCurso?: { cursoId: string; preco: string; inicio: string }[];
};

export const cartaoPadrao = (extra: Partial<EstiloCartao> = {}): EstiloCartao => ({
  formato: "vertical",
  mostrar: ["imagem", "formato", "area", "titulo", "descricao", "preco", "duracao", "inicio", "botao"],
  proporcao: "16/9", linhasDescricao: 3, textoBotao: "Ver curso",
  colunas: 3, colunasTab: 2, colunasTel: 1, espaco: 20,
  corFundo: "#ffffff", corAcento: "var(--c-acento)", corTitulo: "var(--c-primaria)", corTexto: "var(--c-suave)",
  raio: 0, barraTopo: 4, sombra: "suave", efeito: "subir", centrar: false, interior: 24,
  tipoTitulo: tipoVazia({ fonte: "tema-titulos", tamanho: 22, alturaLinha: 1.2 }),
  ...extra,
});

export const campoCartao = (label = "Cartão do curso"): Field => ({
  type: "object",
  label,
  objectFields: {
    formato: {
      type: "select", label: "Formato",
      options: [
        { label: "Vertical (imagem em cima)", value: "vertical" }, { label: "Horizontal (imagem ao lado)", value: "horizontal" },
        { label: "Texto sobre a imagem", value: "sobreposto" }, { label: "Compacto", value: "compacto" }, { label: "Lista (linha)", value: "lista" },
      ],
    },
    // A modalidade e o Gold / Financiada aparecem sempre (pedido do cliente): não se desligam no painel.
    mostrar: campoMarcas("Informação visível", INFO_CARTAO.filter(i => !SEMPRE_VISIVEL.includes(i.valor))),
    proporcao: { type: "select", label: "Proporção da imagem", options: [{ label: "16:9", value: "16/9" }, { label: "3:2", value: "3/2" }, { label: "4:3", value: "4/3" }, { label: "Quadrada", value: "1/1" }] },
    linhasDescricao: campoNumero("Linhas da descrição (1 a 4)", ""),
    textoBotao: { type: "text", label: "Texto do botão" },
    colunas: campoNumero("Colunas", ""),
    espaco: campoNumero("Espaço entre cartões"),
    corFundo: campoCor("Fundo do cartão"),
    corAcento: campoCor("Cor de destaque (barra, etiquetas)"),
    corTitulo: campoCor("Cor do título"),
    corTexto: campoCor("Cor do texto"),
    raio: campoNumero("Cantos arredondados"),
    barraTopo: campoNumero("Barra no topo"),
    sombra: { type: "select", label: "Sombra", options: [{ label: "Nenhuma", value: "" }, { label: "Suave", value: "suave" }, { label: "Média", value: "media" }, { label: "Forte", value: "forte" }] },
    efeito: { type: "select", label: "Ao passar o rato", options: [{ label: "Nada", value: "" }, { label: "Sobe", value: "subir" }, { label: "Zoom na imagem", value: "zoom" }] },
    disposicao: { type: "select", label: "Disposição (computador)", options: [{ label: "Grelha", value: "" }, { label: "Diagonal (desce para a direita)", value: "diagonal" }, { label: "Diagonal (sobe para a direita)", value: "diagonal-inversa" }] },
    desvio: campoNumero("Desvio da diagonal (por cartão)"),
    animacao: { type: "select", label: "Animação do cartão", options: [{ label: "Nenhuma", value: "" }, { label: "Flutuar", value: "flutuar" }, { label: "Balançar", value: "balancar" }] },
    animacaoBotao: { type: "select", label: "Animação do botão", options: [{ label: "Nenhuma", value: "" }, { label: "Pulsar", value: "pulsar" }, { label: "Saltar", value: "saltar" }] },
    corBotao: campoCor("Cor do botão"),
    corTextoBotao: campoCor("Cor do texto do botão"),
    centrar: simNao("Texto centrado"),
    interior: campoNumero("Espaço interior"),
    tipoTitulo: campoTipografia("Tipografia do título"),
    textoPreco: { type: "text", label: `Texto do preço (vazio = o do curso). Ex.: «A partir de {{preco_desde}}». ${ajudaVariaveis}` },
    textoInicio: { type: "text", label: "Texto do início/local (vazio = o do curso). Ex.: «{{inicio_resumo}}» ou «Vários locais e datas»" },
    porCurso: {
      type: "array", label: "Textos só de um curso (preço e início)",
      arrayFields: {
        cursoId: campoCurso("Curso"),
        preco: { type: "text", label: "Preço (vazio = o geral). Ex.: «A partir de 115 €»" },
        inicio: { type: "text", label: "Início/local (vazio = o geral). Ex.: «Vários locais e datas»" },
      },
      defaultItemProps: { cursoId: "", preco: "", inicio: "" },
      getItemSummary: item => (item.cursoId ? nomesCursos.get(item.cursoId) ?? "Curso fora da oferta" : "Escolha o curso"),
    },
  },
});

const ICONES = {
  relogio: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  local: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2" /></>,
  seta: <path d="M5 12h14m-5-5 5 5-5 5" />,
};
const Ico = ({ n, cls = "h-4 w-4" }: { n: keyof typeof ICONES; cls?: string }) => (
  <svg aria-hidden="true" className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{ICONES[n]}</svg>
);

/** Um cartão de curso com o estilo escolhido no editor (landing e catálogo). */
/** O que um cartão em destaque pode mudar em relação ao curso (vazio = dados do curso). */
export type ExtraCartao = { etiqueta?: string; botao?: string; ligacao?: string; corBotao?: string; corTextoBotao?: string; animacao?: string; animacaoBotao?: string };

// Por cartão: vazio = o do estilo do cartão; "nenhuma" desliga a animação só nesse cartão.
const SOBREPOR_ANIMACAO = [{ label: "Igual aos outros cartões", value: "" }, { label: "Sem animação", value: "nenhuma" }];

export function CartaoCurso({ curso, e, extra, ordem }: { curso: Course; e: EstiloCartao; extra?: ExtraCartao; ordem?: CSSProperties }) {
  const ver = new Set<Info>([...(e.mostrar ?? []), ...SEMPRE_VISIVEL]);
  const doCurso = curso.id ? e.porCurso?.find(x => x.cursoId === curso.id) : undefined;
  const vars = variaveisCurso(curso, "");
  const textoCartao = (proprio: string | undefined, geral: string | undefined, original: string) =>
    (proprio?.trim() || geral?.trim()) ? preencherVariaveis((proprio?.trim() || geral!.trim()), vars) : original;
  const precoTxt = textoCartao(doCurso?.preco, e.textoPreco, curso.price);
  const inicioTxt = textoCartao(doCurso?.inicio, e.textoInicio, curso.start);
  const href = (extra?.ligacao && ligacaoSegura(extra.ligacao)) || (curso.id ? `/formacao/${encodeURIComponent(curso.id)}` : "#");
  const acento = corSegura(e.corAcento) ?? "var(--c-acento)";
  const caixa = estiloBloco(estiloVazio({ raio: e.raio, sombra: e.sombra }));
  const tt = estiloTexto({ ...e.tipoTitulo, cor: e.tipoTitulo?.cor || e.corTitulo });
  const imagem = curso.capa || curso.miniatura;
  const sobreposto = e.formato === "sobreposto";
  const horizontal = e.formato === "horizontal" || e.formato === "lista";
  const estilo: CSSProperties = {
    ...caixa.style,
    background: sobreposto ? "#14263D" : corSegura(e.corFundo) ?? "#fff",
    color: sobreposto ? "#fff" : corSegura(e.corTexto) ?? "var(--c-suave)",
    borderTop: e.barraTopo ? `${e.barraTopo}px solid ${acento}` : undefined,
    textAlign: e.centrar ? "center" : undefined,
    overflow: "hidden",
  };
  const linhas = e.linhasDescricao && e.linhasDescricao >= 1 && e.linhasDescricao <= 4 ? `ena-linhas-${e.linhasDescricao}` : "";
  const pad = `${e.interior ?? 24}px`;
  const animacao = extra?.animacao || e.animacao;
  const animacaoBotao = extra?.animacaoBotao || e.animacaoBotao;
  const etiqueta = (texto: string, forte = false) => (
    <span className="inline-flex px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.1em]"
      style={forte ? { background: acento, color: "#14263D" } : { background: "#14263D", color: "#fff" }}>{texto}</span>
  );
  const img = ver.has("imagem") && (
    <a href={href} tabIndex={-1} aria-hidden="true"
      className={juntar("relative block overflow-hidden bg-[#E7EBF0]", horizontal && "shrink-0", e.formato === "lista" ? "w-28 sm:w-40" : e.formato === "horizontal" ? "ena-cartao-h-img" : "w-full", sobreposto && "absolute inset-0")}
      style={e.formato === "lista" || sobreposto ? undefined : { aspectRatio: e.proporcao }}>
      {imagem && <img src={imagem} alt="" className="h-full w-full object-cover" />}
      {!sobreposto && (ver.has("formato") || ver.has("regime")) && (
        <span className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {ver.has("formato") && curso.format && etiqueta(curso.format, curso.format === "E-learning")}
          {ver.has("regime") && etiqueta(extra?.etiqueta || curso.funding, curso.funding === "Gold")}
        </span>
      )}
    </a>
  );
  const corpo = (
    <div className={juntar("relative flex flex-1 flex-col", sobreposto && "justify-end bg-gradient-to-t from-[#081220]/90 via-[#081220]/45 to-transparent")} style={{ padding: pad, minHeight: sobreposto ? 320 : undefined }}>
      {sobreposto && (ver.has("formato") || ver.has("regime")) && (
        <span className="mb-3 flex flex-wrap gap-1.5" style={e.centrar ? { justifyContent: "center" } : undefined}>
          {ver.has("formato") && curso.format && etiqueta(curso.format, true)}
          {ver.has("regime") && etiqueta(extra?.etiqueta || curso.funding, curso.funding === "Gold")}
        </span>
      )}
      {!ver.has("imagem") && !sobreposto && (ver.has("formato") || ver.has("regime")) && (
        <span className="mb-3 flex flex-wrap gap-1.5">{ver.has("formato") && curso.format && etiqueta(curso.format, curso.format === "E-learning")}{ver.has("regime") && etiqueta(extra?.etiqueta || curso.funding, curso.funding === "Gold")}</span>
      )}
      {ver.has("area") && curso.area && <p className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: sobreposto ? acento : "var(--c-destaque)" }}>{curso.area}</p>}
      {ver.has("titulo") && (
        <h3 className={juntar("mt-2", tt.className)} style={{ ...tt.style, ...(sobreposto ? { color: "#fff" } : {}) }}>
          <a href={href} className="hover:opacity-80">{curso.title}</a>
        </h3>
      )}
      {ver.has("descricao") && curso.resumo && e.formato !== "compacto" && <p className={juntar("mt-3 text-sm leading-6", linhas)}>{curso.resumo}</p>}
      {(ver.has("preco") || ver.has("duracao") || ver.has("inicio") || ver.has("botao")) && (
        <div className={juntar("flex flex-wrap items-end justify-between gap-3", e.formato === "compacto" ? "mt-3" : "mt-auto pt-5")}
          style={e.formato === "compacto" || sobreposto ? undefined : { borderTop: "1px solid rgba(20,38,61,.1)", marginTop: "1.25rem" }}>
          <div className="space-y-1.5 text-xs font-semibold" style={e.centrar ? { margin: "0 auto" } : undefined}>
            {ver.has("preco") && curso.funding === "Gold" && precoTxt && <span className="block text-sm font-bold" style={{ color: sobreposto ? "#fff" : corSegura(e.corTitulo) }}>{precoTxt}</span>}
            {ver.has("duracao") && curso.duration && <span className="flex items-center gap-2"><Ico n="relogio" />{curso.duration}</span>}
            {ver.has("inicio") && inicioTxt && <span className="flex items-center gap-2"><Ico n="local" />{inicioTxt}</span>}
          </div>
          {ver.has("botao") && (
            <a href={href} className={juntar("inline-flex items-center gap-2 px-4 py-2.5 text-xs font-extrabold uppercase tracking-[0.08em] text-white transition-colors hover:brightness-110", animacaoBotao && `ena-anim-${animacaoBotao}`)}
              style={{ background: corSegura(extra?.corBotao) ?? corSegura(e.corBotao) ?? "var(--c-primaria)", color: corSegura(extra?.corTextoBotao) ?? corSegura(e.corTextoBotao) ?? "#ffffff",borderRadius: e.raio ? Math.min(e.raio, 999) : 0, ...(e.centrar ? { margin: "0 auto" } : {}) }}>
              {extra?.botao || e.textoBotao || "Ver curso"} <Ico n="seta" />
            </a>
          )}
        </div>
      )}
    </div>
  );
  return (
    <article
      className={juntar(caixa.className, "flex min-w-0", e.formato === "lista" ? "flex-row" : e.formato === "horizontal" ? "ena-cartao-h" : "flex-col", sobreposto && "relative", e.efeito === "subir" && "ena-cartao-hover-subir", e.efeito === "zoom" && "ena-cartao-hover-zoom", animacao && `ena-anim-${animacao}`)}
      style={{ ...estilo, ...ordem }}
    >
      {img}
      {corpo}
    </article>
  );
}

function Grelha({ cursos, e, vazio, extras }: { cursos: Course[]; e: EstiloCartao; vazio: string; extras?: (ExtraCartao | undefined)[] }) {
  const lista = e.formato === "lista";
  const diagonal = !!e.disposicao && cursos.length > 1;
  // Numa coluna a diagonal desloca para o lado; em várias colunas desloca para baixo.
  const eixo = lista || (e.colunas || 3) <= 1 ? "x" : "y";
  const d = e.desvio ?? 48;
  const posicao = (i: number): CSSProperties => {
    const k = e.disposicao === "diagonal-inversa" ? cursos.length - 1 - i : i;
    return {
      ["--i" as string]: String(i),
      ...(diagonal && (eixo === "x"
        ? { ["--dl" as string]: `${k * d}px`, ["--dr" as string]: `${(cursos.length - 1 - k) * d}px` }
        : { ["--dt" as string]: `${k * d}px` })),
    } as CSSProperties;
  };
  const style = {
    gap: `${e.espaco ?? 20}px`,
    ["--cols" as string]: String(lista ? 1 : e.colunas || 3),
    ["--cols-tab" as string]: String(lista ? 1 : e.colunasTab || 2),
    ["--cols-tel" as string]: String(e.colunasTel || 1),
  } as CSSProperties;
  if (!cursos.length) return <p className="py-12 text-center text-[#3E5168]">{vazio}</p>;
  return (
    <div className={juntar("ena-grelha", diagonal && `ena-diagonal-${eixo}`)} style={style}>
      {cursos.map((c, i) => <CartaoCurso key={`${c.id}-${i}`} curso={c} e={e} extra={extras?.[i]} ordem={posicao(i)} />)}
    </div>
  );
}

function useCursos() {
  const ctx = useContext(OfertaCtx);
  return { cursos: ctx?.cursos ?? [], destaques: ctx?.destaques ?? [], estado: ctx?.estado ?? "a-carregar", recarregar: ctx?.recarregar };
}

function Estado({ estado, recarregar }: { estado: string; recarregar?: () => void }) {
  if (estado === "a-carregar") return <p className="py-12 text-center text-[#3E5168]">A carregar a oferta formativa.</p>;
  return (
    <div className="py-12 text-center">
      <p>Não foi possível carregar os cursos.</p>
      {recarregar && <button type="button" onClick={recarregar} className="mt-3 bg-[#FFA900] px-5 py-3 text-sm font-bold text-[#14263D]">Tentar de novo</button>}
    </div>
  );
}

// ─── Cursos em destaque ──────────────────────────────────────────────────────

/** Um cartão em destaque: um curso, com imagem e textos que podem substituir os do curso (ou um cartão livre). */
type ItemDestaque = { cursoId: string; imagem?: string; titulo?: string; texto?: string; etiqueta?: string; botao?: string; ligacao?: string; corBotao?: string; corTextoBotao?: string; animacao?: string; animacaoBotao?: string };
type DestaqueProps = { modo: "lista" | "escolhidos" | "automatico"; ordem: string[]; cursos: ItemDestaque[]; limite: number | null; cartao: EstiloCartao; aparencia: Estilo };

/** Curso vazio, para cartões livres (sem curso): só mostram o que se escreve no cartão. */
const CURSO_LIVRE: Course = {
  id: "", title: "", area: "", format: "", duration: "", start: "", price: "", description: "", resumo: "", funding: "Gold",
  enrollment: "Pré-inscrição", miniatura: null, capa: null, banner: null, precoDesde: null, vendas: 0, regime: "gold",
  objetivos: [], funcionamento: "", contactosLocais: [], organizacao: "modular", programa: [], sessoes: [], nomeOferta: "",
};

function cartaoDe(x: ItemDestaque, curso: Course | undefined): Course | null {
  if (!curso && !x.titulo?.trim()) return null;
  const c = curso ?? CURSO_LIVRE;
  const imagem = x.imagem?.trim() || null;
  return {
    ...c,
    title: x.titulo?.trim() || c.title,
    resumo: x.texto?.trim() || c.resumo,
    capa: imagem ?? c.capa,
    miniatura: imagem ?? c.miniatura,
  };
}

export const CursosDestaque: ComponentConfig<DestaqueProps> = {
  label: "Cursos em destaque",
  fields: {
    modo: {
      type: "radio", label: "Que cursos",
      options: [
        { label: "Escolher e ordenar na lista de cursos", value: "lista" },
        { label: "Cartões personalizados", value: "escolhidos" },
        { label: "Os mais procurados", value: "automatico" },
      ],
    },
    ordem: campoOrdemCursos("Cursos em destaque (Gold e Financiada)"),
    cursos: {
      type: "array", label: "Cursos (arraste para mudar a ordem)",
      arrayFields: {
        cursoId: campoCurso("Curso (vazio = cartão livre)"),
        imagem: campoImagem("Imagem (vazio = a do curso)") as never,
        titulo: { type: "text", label: "Título (vazio = o do curso)" },
        texto: { type: "textarea", label: "Texto (vazio = o texto de destaque do curso)" },
        etiqueta: { type: "text", label: "Etiqueta (vazio = Gold / Financiada)" },
        botao: { type: "text", label: "Texto do botão (vazio = o do cartão)" },
        ligacao: { type: "text", label: "Ligação (vazio = página do curso)" },
        corBotao: campoCor("Cor do botão (vazio = a do cartão)") as never,
        corTextoBotao: campoCor("Cor do texto do botão (vazio = a do cartão)") as never,
        animacao: { type: "select", label: "Animação deste cartão", options: [...SOBREPOR_ANIMACAO, { label: "Flutuar", value: "flutuar" }, { label: "Balançar", value: "balancar" }] },
        animacaoBotao: { type: "select", label: "Animação do botão deste cartão", options: [...SOBREPOR_ANIMACAO, { label: "Pulsar", value: "pulsar" }, { label: "Saltar", value: "saltar" }] },
      },
      defaultItemProps: { cursoId: "", imagem: "", titulo: "", texto: "", etiqueta: "", botao: "", ligacao: "", corBotao: "", corTextoBotao: "", animacao: "", animacaoBotao: "" },
      getItemSummary: (item, i) => `${(i ?? 0) + 1}. ${item.titulo?.trim() || (item.cursoId ? nomesCursos.get(item.cursoId) ?? "Curso fora da oferta" : "Escolha o curso")}`,
    },
    limite: campoNumero("Quantos (nos mais procurados)", ""),
    cartao: campoCartao(),
    aparencia: campoAparencia(),
  },
  resolveFields: (data, { fields }) => {
    const f = { ...fields } as Record<string, Field>;
    if (data.props.modo !== "escolhidos") delete f.cursos;
    if (data.props.modo !== "automatico") delete f.limite;
    if (data.props.modo !== "lista") delete f.ordem;
    return f as typeof fields;
  },
  defaultProps: { modo: "lista", ordem: [], cursos: [], limite: 6, cartao: cartaoPadrao(), aparencia: estiloVazio() },
  render: ({ puck, modo, ordem, cursos: escolhidos, limite, cartao, aparencia }) => {
    const { cursos, destaques, estado, recarregar } = useCursos();
    const { lista, extras } = useMemo(() => {
      if (modo === "automatico") return { lista: destaques.slice(0, Math.max(1, limite ?? 6)), extras: [] as ExtraCartao[] };
      const porId = new Map(cursos.map(c => [c.id, c]));
      if (modo === "lista") return { lista: (ordem ?? []).map(id => porId.get(id)).filter((c): c is Course => Boolean(c)), extras: [] as ExtraCartao[] };
      const itens = (escolhidos ?? []).map(x => ({ x, c: cartaoDe(x, porId.get(x.cursoId)) })).filter(i => i.c);
      return { lista: itens.map(i => i.c!), extras: itens.map(({ x }) => ({ etiqueta: x.etiqueta, botao: x.botao, ligacao: x.ligacao, corBotao: x.corBotao, corTextoBotao: x.corTextoBotao, animacao: x.animacao, animacaoBotao: x.animacaoBotao })) };
    }, [modo, ordem, escolhidos, limite, cursos, destaques]);
    const c = estiloBloco(aparencia);
    return (
      <div ref={puck?.dragRef ?? undefined} className={c.className} style={c.style}>
        {estado === "pronto"
          ? <Grelha cursos={lista} extras={extras} e={cartao} vazio={modo === "automatico" ? "Ainda não há cursos publicados." : "Escolha os cursos em destaque no painel."} />
          : <Estado estado={estado} recarregar={recarregar} />}
      </div>
    );
  },
};

// ─── Oferta formativa (todos os cursos, com pesquisa e filtros) ──────────────

type OfertaProps = {
  zonaMeio: Slot; zonaCursos: Slot;
  regime: "todos" | "gold" | "fin";
  ordem: "procura" | "titulo";
  pesquisa: boolean; textoPesquisa: string;
  filtros: boolean; mostrarTotal: boolean;
  limite: number | null;
  corFiltroAtivo: string;
  tipoFiltros: Tipografia; tipoTotal: Tipografia; tipoPesquisa: Tipografia;
  larguraPesquisa: number | null; raioPesquisa: number | null; fundoPesquisa: string;
  cartao: EstiloCartao;
  aparencia: Estilo;
};

export const OfertaFormativa: ComponentConfig<OfertaProps> = {
  label: "Oferta formativa",
  fields: {
    zonaMeio: { type: "slot", label: "Blocos entre os filtros e a pesquisa" },
    zonaCursos: { type: "slot", label: "Blocos antes dos cursos" },
    regime: { type: "select", label: "Cursos", options: [{ label: "Todos", value: "todos" }, { label: "Só Gold", value: "gold" }, { label: "Só Financiada", value: "fin" }] },
    ordem: { type: "select", label: "Ordem", options: [{ label: "Mais procurados primeiro", value: "procura" }, { label: "Alfabética", value: "titulo" }] },
    pesquisa: simNao("Caixa de pesquisa"),
    textoPesquisa: { type: "text", label: "Texto da pesquisa" },
    filtros: simNao("Filtros por modalidade"),
    mostrarTotal: simNao("Mostrar o número de formações"),
    limite: campoNumero("Máximo de cursos (vazio = todos)", ""),
    corFiltroAtivo: campoCor("Cor do filtro ativo"),
    tipoFiltros: campoTipografia("Tipografia dos botões de filtro"),
    tipoTotal: campoTipografia("Tipografia do número de formações"),
    tipoPesquisa: campoTipografia("Tipografia da pesquisa"),
    larguraPesquisa: campoNumero("Largura máxima da pesquisa"),
    raioPesquisa: campoNumero("Cantos da pesquisa"),
    fundoPesquisa: campoCor("Fundo da pesquisa"),
    cartao: campoCartao(),
    aparencia: campoAparencia(),
  },
  defaultProps: {
    zonaMeio: [], zonaCursos: [],
    regime: "todos", ordem: "procura", pesquisa: true, textoPesquisa: "Pesquisar formação", filtros: true, mostrarTotal: true,
    limite: null, corFiltroAtivo: "var(--c-acento)",
    tipoFiltros: tipoVazia({ tamanho: 14, peso: "700" }), tipoTotal: tipoVazia({ tamanho: 14, peso: "600" }), tipoPesquisa: tipoVazia({ tamanho: 14 }),
    larguraPesquisa: 384, raioPesquisa: 999, fundoPesquisa: "#ffffff",
    cartao: cartaoPadrao(), aparencia: estiloVazio(),
  },
  render: ({ puck, zonaMeio, zonaCursos, regime, ordem, pesquisa, textoPesquisa, filtros, mostrarTotal, limite, corFiltroAtivo, tipoFiltros, tipoTotal, tipoPesquisa, larguraPesquisa, raioPesquisa, fundoPesquisa, cartao, aparencia }) => {
    const tf = estiloTexto(tipoFiltros);
    const tt = estiloTexto(tipoTotal);
    const tp = estiloTexto(tipoPesquisa);
    const ZonaMeio = zonaMeio as unknown as ComponentType<{ className?: string; minEmptyHeight?: number }> | undefined;
    const ZonaCursos = zonaCursos as unknown as ComponentType<{ className?: string; minEmptyHeight?: number }> | undefined;
    const { cursos, estado, recarregar } = useCursos();
    const [filtro, setFiltro] = useState("Todos");
    const [q, setQ] = useState("");
    const base = useMemo(() => {
      const r = cursos.filter(c => regime === "todos" || c.regime === regime);
      return ordem === "titulo" ? [...r].sort((a, b) => a.title.localeCompare(b.title, "pt")) : [...r].sort((a, b) => b.vendas - a.vendas);
    }, [cursos, regime, ordem]);
    const modos = useMemo(() => ["Todos", ...["Presencial", "B-learning", "E-learning"].filter(m => base.some(c => c.format === m))], [base]);
    const lista = base
      .filter(c => (filtro === "Todos" || c.format === filtro) && `${c.title} ${c.area}`.toLowerCase().includes(q.trim().toLowerCase()))
      .slice(0, limite && limite > 0 ? limite : undefined);
    const c = estiloBloco(aparencia);
    const ativo = corSegura(corFiltroAtivo) ?? "var(--c-acento)";
    return (
      <div ref={puck?.dragRef ?? undefined} className={c.className} style={c.style}>
        {(pesquisa || filtros) && (
          <div className="mb-8 flex flex-col gap-4 border-b border-[#14263D]/10 pb-5 lg:flex-row lg:items-center">
            {filtros && (
              <div className="flex flex-wrap items-center gap-2">
                {modos.map(m => (
                  <button key={m} type="button" aria-pressed={filtro === m} onClick={() => setFiltro(m)}
                    className={juntar("px-5 py-2.5 text-sm font-bold text-[#14263D] ring-1 ring-[#14263D]/15 transition-colors", tf.className)}
                    style={{ ...tf.style, background: filtro === m ? ativo : "#fff" }}>{m}</button>
                ))}
              </div>
            )}
            {ZonaMeio && <ZonaMeio className="flex min-w-0 flex-1 flex-wrap items-center gap-3 ena-zona" minEmptyHeight={40} />}
            {mostrarTotal && estado === "pronto" && <span className={juntar("text-sm font-semibold text-[#3E5168] lg:ml-auto", tt.className)} style={tt.style}>{lista.length} formações disponíveis</span>}
            {pesquisa && (
              <label className="flex w-full items-center gap-3 border border-[#14263D]/20 px-4 py-3 text-[#14263D]"
                style={{ maxWidth: larguraPesquisa === undefined ? 384 : larguraPesquisa ? `${larguraPesquisa}px` : undefined, borderRadius: `${raioPesquisa ?? 999}px`, background: corSegura(fundoPesquisa) ?? "#fff" }}>
                <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
                <span className="sr-only">Pesquisar formação</span>
                <input value={q} onChange={ev => setQ(ev.target.value)} placeholder={textoPesquisa} className={juntar("w-full bg-transparent text-sm outline-none placeholder:text-[#4A6078] placeholder:opacity-80", tp.className)} style={tp.style} />
              </label>
            )}
          </div>
        )}
        {ZonaCursos && <ZonaCursos className="mb-6 flex flex-col gap-4 ena-zona" minEmptyHeight={40} />}
        {estado === "pronto" ? <Grelha cursos={lista} e={cartao} vazio="Não encontrámos formações para esta pesquisa." /> : <Estado estado={estado} recarregar={recarregar} />}
      </div>
    );
  },
};
