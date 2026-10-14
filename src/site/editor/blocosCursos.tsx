// Blocos de cursos: destaques escolhidos à mão (e por ordem) e a oferta formativa com filtros.
// O cartão do curso tem vários formatos e escolhe-se que informação mostra.
import { useContext, useMemo, useState, type CSSProperties } from "react";
import type { ComponentConfig, Field } from "@puckeditor/core";
import { OfertaCtx, type Course } from "../SiteLanding";
import { campoCor, campoCurso, campoMarcas, campoNumero, nomesCursos, simNao } from "./campos";
import { campoAparencia, campoTipografia } from "./camposGrupos";
import { corSegura, estiloBloco, estiloTexto, estiloVazio, juntar, tipoVazia, type Estilo, type Tipografia } from "./estilos";

export const INFO_CARTAO = [
  { valor: "imagem", rotulo: "Imagem" },
  { valor: "formato", rotulo: "Modalidade" },
  { valor: "regime", rotulo: "Gold / Financiada" },
  { valor: "area", rotulo: "Área" },
  { valor: "titulo", rotulo: "Título" },
  { valor: "descricao", rotulo: "Descrição" },
  { valor: "preco", rotulo: "Preço" },
  { valor: "duracao", rotulo: "Duração" },
  { valor: "inicio", rotulo: "Início / local" },
  { valor: "botao", rotulo: "Botão" },
] as const;
type Info = typeof INFO_CARTAO[number]["valor"];

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
  centrar: boolean;
  interior: number | null;
  tipoTitulo: Tipografia;
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
    mostrar: campoMarcas("Informação visível", INFO_CARTAO),
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
    centrar: simNao("Texto centrado"),
    interior: campoNumero("Espaço interior"),
    tipoTitulo: campoTipografia("Tipografia do título"),
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
export function CartaoCurso({ curso, e }: { curso: Course; e: EstiloCartao }) {
  const ver = new Set(e.mostrar ?? []);
  const href = `/formacao/${encodeURIComponent(curso.id)}`;
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
          {ver.has("regime") && etiqueta(curso.funding, curso.funding === "Gold")}
        </span>
      )}
    </a>
  );
  const corpo = (
    <div className={juntar("relative flex flex-1 flex-col", sobreposto && "justify-end bg-gradient-to-t from-[#081220]/90 via-[#081220]/45 to-transparent")} style={{ padding: pad, minHeight: sobreposto ? 320 : undefined }}>
      {sobreposto && (ver.has("formato") || ver.has("regime")) && (
        <span className="mb-3 flex flex-wrap gap-1.5" style={e.centrar ? { justifyContent: "center" } : undefined}>
          {ver.has("formato") && curso.format && etiqueta(curso.format, true)}
          {ver.has("regime") && etiqueta(curso.funding, curso.funding === "Gold")}
        </span>
      )}
      {!ver.has("imagem") && !sobreposto && (ver.has("formato") || ver.has("regime")) && (
        <span className="mb-3 flex flex-wrap gap-1.5">{ver.has("formato") && curso.format && etiqueta(curso.format, curso.format === "E-learning")}{ver.has("regime") && etiqueta(curso.funding, curso.funding === "Gold")}</span>
      )}
      {ver.has("area") && curso.area && <p className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: sobreposto ? acento : "var(--c-destaque)" }}>{curso.area}</p>}
      {ver.has("titulo") && (
        <h3 className={juntar("mt-2", tt.className)} style={{ ...tt.style, ...(sobreposto ? { color: "#fff" } : {}) }}>
          <a href={href} className="hover:opacity-80">{curso.title}</a>
        </h3>
      )}
      {ver.has("descricao") && curso.description && e.formato !== "compacto" && <p className={juntar("mt-3 text-sm leading-6", linhas)}>{curso.description}</p>}
      {(ver.has("preco") || ver.has("duracao") || ver.has("inicio") || ver.has("botao")) && (
        <div className={juntar("flex flex-wrap items-end justify-between gap-3", e.formato === "compacto" ? "mt-3" : "mt-auto pt-5")}
          style={e.formato === "compacto" || sobreposto ? undefined : { borderTop: "1px solid rgba(20,38,61,.1)", marginTop: "1.25rem" }}>
          <div className="space-y-1.5 text-xs font-semibold" style={e.centrar ? { margin: "0 auto" } : undefined}>
            {ver.has("preco") && curso.price && <span className="block text-sm font-bold" style={{ color: sobreposto ? "#fff" : corSegura(e.corTitulo) }}>{curso.price}</span>}
            {ver.has("duracao") && curso.duration && <span className="flex items-center gap-2"><Ico n="relogio" />{curso.duration}</span>}
            {ver.has("inicio") && curso.start && <span className="flex items-center gap-2"><Ico n="local" />{curso.start}</span>}
          </div>
          {ver.has("botao") && (
            <a href={href} className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-extrabold uppercase tracking-[0.08em] text-white transition-colors hover:brightness-110"
              style={{ background: "var(--c-primaria)", borderRadius: e.raio ? Math.min(e.raio, 999) : 0, ...(e.centrar ? { margin: "0 auto" } : {}) }}>
              {e.textoBotao || "Ver curso"} <Ico n="seta" />
            </a>
          )}
        </div>
      )}
    </div>
  );
  return (
    <article
      className={juntar(caixa.className, "flex min-w-0", e.formato === "lista" ? "flex-row" : e.formato === "horizontal" ? "ena-cartao-h" : "flex-col", sobreposto && "relative", e.efeito === "subir" && "ena-cartao-hover-subir", e.efeito === "zoom" && "ena-cartao-hover-zoom")}
      style={estilo}
    >
      {img}
      {corpo}
    </article>
  );
}

function Grelha({ cursos, e, vazio }: { cursos: Course[]; e: EstiloCartao; vazio: string }) {
  const lista = e.formato === "lista";
  const style = {
    gap: `${e.espaco ?? 20}px`,
    ["--cols" as string]: String(lista ? 1 : e.colunas || 3),
    ["--cols-tab" as string]: String(lista ? 1 : e.colunasTab || 2),
    ["--cols-tel" as string]: String(e.colunasTel || 1),
  } as CSSProperties;
  if (!cursos.length) return <p className="py-12 text-center text-[#3E5168]">{vazio}</p>;
  return <div className="ena-grelha" style={style}>{cursos.map(c => <CartaoCurso key={c.id} curso={c} e={e} />)}</div>;
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

type DestaqueProps = { modo: "escolhidos" | "automatico"; cursos: { cursoId: string }[]; limite: number | null; cartao: EstiloCartao; aparencia: Estilo };

export const CursosDestaque: ComponentConfig<DestaqueProps> = {
  label: "Cursos em destaque",
  fields: {
    modo: { type: "radio", label: "Que cursos", options: [{ label: "Escolhidos por mim", value: "escolhidos" }, { label: "Os mais procurados", value: "automatico" }] },
    cursos: {
      type: "array", label: "Cursos (arraste para mudar a ordem)",
      arrayFields: { cursoId: campoCurso("Curso") },
      defaultItemProps: { cursoId: "" },
      getItemSummary: (item, i) => item.cursoId ? `${(i ?? 0) + 1}. ${nomesCursos.get(item.cursoId) ?? "Curso fora da oferta"}` : "Escolha o curso",
    },
    limite: campoNumero("Quantos (nos mais procurados)", ""),
    cartao: campoCartao(),
    aparencia: campoAparencia(),
  },
  resolveFields: (data, { fields }) => {
    const f = { ...fields } as Record<string, Field>;
    if (data.props.modo === "automatico") delete f.cursos; else delete f.limite;
    return f as typeof fields;
  },
  defaultProps: { modo: "escolhidos", cursos: [], limite: 6, cartao: cartaoPadrao(), aparencia: estiloVazio() },
  render: ({ modo, cursos: escolhidos, limite, cartao, aparencia }) => {
    const { cursos, destaques, estado, recarregar } = useCursos();
    const lista = useMemo(() => {
      if (modo === "automatico") return destaques.slice(0, Math.max(1, limite ?? 6));
      const porId = new Map(cursos.map(c => [c.id, c]));
      return (escolhidos ?? []).map(x => porId.get(x.cursoId)).filter((c): c is Course => Boolean(c));
    }, [modo, escolhidos, limite, cursos, destaques]);
    const c = estiloBloco(aparencia);
    return (
      <div className={c.className} style={c.style}>
        {estado === "pronto"
          ? <Grelha cursos={lista} e={cartao} vazio={modo === "escolhidos" ? "Escolha os cursos em destaque no painel." : "Ainda não há cursos publicados."} />
          : <Estado estado={estado} recarregar={recarregar} />}
      </div>
    );
  },
};

// ─── Oferta formativa (todos os cursos, com pesquisa e filtros) ──────────────

type OfertaProps = {
  regime: "todos" | "gold" | "fin";
  ordem: "procura" | "titulo";
  pesquisa: boolean; textoPesquisa: string;
  filtros: boolean; mostrarTotal: boolean;
  limite: number | null;
  corFiltroAtivo: string;
  cartao: EstiloCartao;
  aparencia: Estilo;
};

export const OfertaFormativa: ComponentConfig<OfertaProps> = {
  label: "Oferta formativa",
  fields: {
    regime: { type: "select", label: "Cursos", options: [{ label: "Todos", value: "todos" }, { label: "Só Gold", value: "gold" }, { label: "Só Financiada", value: "fin" }] },
    ordem: { type: "select", label: "Ordem", options: [{ label: "Mais procurados primeiro", value: "procura" }, { label: "Alfabética", value: "titulo" }] },
    pesquisa: simNao("Caixa de pesquisa"),
    textoPesquisa: { type: "text", label: "Texto da pesquisa" },
    filtros: simNao("Filtros por modalidade"),
    mostrarTotal: simNao("Mostrar o número de formações"),
    limite: campoNumero("Máximo de cursos (vazio = todos)", ""),
    corFiltroAtivo: campoCor("Cor do filtro ativo"),
    cartao: campoCartao(),
    aparencia: campoAparencia(),
  },
  defaultProps: {
    regime: "todos", ordem: "procura", pesquisa: true, textoPesquisa: "Pesquisar formação", filtros: true, mostrarTotal: true,
    limite: null, corFiltroAtivo: "var(--c-acento)", cartao: cartaoPadrao(), aparencia: estiloVazio(),
  },
  render: ({ regime, ordem, pesquisa, textoPesquisa, filtros, mostrarTotal, limite, corFiltroAtivo, cartao, aparencia }) => {
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
      <div className={c.className} style={c.style}>
        {(pesquisa || filtros) && (
          <div className="mb-8 flex flex-col gap-4 border-b border-[#14263D]/10 pb-5 lg:flex-row lg:items-center">
            {filtros && (
              <div className="flex flex-wrap items-center gap-2">
                {modos.map(m => (
                  <button key={m} type="button" aria-pressed={filtro === m} onClick={() => setFiltro(m)}
                    className="px-5 py-2.5 text-sm font-bold text-[#14263D] ring-1 ring-[#14263D]/15 transition-colors"
                    style={filtro === m ? { background: ativo } : { background: "#fff" }}>{m}</button>
                ))}
              </div>
            )}
            {mostrarTotal && estado === "pronto" && <span className="text-sm font-semibold text-[#3E5168] lg:ml-auto">{lista.length} formações disponíveis</span>}
            {pesquisa && (
              <label className="flex w-full items-center gap-3 rounded-full border border-[#14263D]/20 bg-white px-4 py-3 text-[#14263D] lg:max-w-sm">
                <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
                <span className="sr-only">Pesquisar formação</span>
                <input value={q} onChange={ev => setQ(ev.target.value)} placeholder={textoPesquisa} className="w-full bg-transparent text-sm outline-none placeholder:text-[#4A6078]" />
              </label>
            )}
          </div>
        )}
        {estado === "pronto" ? <Grelha cursos={lista} e={cartao} vazio="Não encontrámos formações para esta pesquisa." /> : <Estado estado={estado} recarregar={recarregar} />}
      </div>
    );
  },
};
