// Blocos de base do editor visual: estrutura (secção, coluna) e conteúdo (título, texto, botão, imagem…).
import type { CSSProperties, ElementType, ReactNode } from "react";
import type { ComponentConfig, Slot } from "@puckeditor/core";
import { campoCor, campoImagem, campoNumero, simNao } from "./campos";
import { campoAparencia, campoTipografia } from "./camposGrupos";
import { corSegura, em, estiloBloco, estiloTexto, estiloVazio, juntar, lados, ligacaoSegura, tipoVazia, type Estilo, type Tipografia } from "./estilos";

type Texto = string | ReactNode;
const ALINHAR_ITENS = { inicio: "flex-start", centro: "center", fim: "flex-end", esticar: "stretch" } as const;
const JUSTIFICAR = { inicio: "flex-start", centro: "center", fim: "flex-end", entre: "space-between" } as const;

const opcoesAlinhar = [
  { label: "Início", value: "inicio" }, { label: "Centro", value: "centro" }, { label: "Fim", value: "fim" }, { label: "Esticar", value: "esticar" },
];

/** Atributos comuns de um bloco: âncora, classes e estilo. */
function caixa(a: Partial<Estilo> | undefined, extra?: CSSProperties) {
  const e = estiloBloco(a, extra);
  return { id: a?.ancora?.trim() ? a.ancora.trim().replace(/[^\w-]/g, "").slice(0, 80) : undefined, className: e.className, style: e.style };
}

// ─── Secção ──────────────────────────────────────────────────────────────────

type SeccaoProps = {
  conteudo: Slot;
  disposicao: "pilha" | "grelha" | "linha";
  colunas: number; colunasTab: number; colunasTel: number;
  espaco: number | null;
  alinharItens: keyof typeof ALINHAR_ITENS;
  larguraConteudo: "tema" | "total";
  aparencia: Estilo;
};

export const Seccao: ComponentConfig<SeccaoProps> = {
  label: "Secção",
  fields: {
    conteudo: { type: "slot" },
    disposicao: {
      type: "select", label: "Disposição dos blocos",
      options: [{ label: "Uns por baixo dos outros", value: "pilha" }, { label: "Grelha (colunas)", value: "grelha" }, { label: "Lado a lado", value: "linha" }],
    },
    colunas: campoNumero("Colunas no computador", "") as never,
    colunasTab: campoNumero("Colunas no tablet", "") as never,
    colunasTel: campoNumero("Colunas no telemóvel", "") as never,
    espaco: campoNumero("Espaço entre blocos"),
    alinharItens: { type: "select", label: "Alinhamento vertical", options: opcoesAlinhar },
    larguraConteudo: { type: "select", label: "Largura do conteúdo", options: [{ label: "Do tema", value: "tema" }, { label: "Ecrã inteiro", value: "total" }] },
    aparencia: campoAparencia(),
  },
  defaultProps: {
    conteudo: [], disposicao: "pilha", colunas: 2, colunasTab: 2, colunasTel: 1, espaco: 24, alinharItens: "esticar", larguraConteudo: "tema",
    aparencia: estiloVazio({ preenchimento: lados(80, 32), preenchimentoTel: lados(48, 20) }),
  },
  render: ({ conteudo: Conteudo, disposicao, colunas, colunasTab, colunasTel, espaco, alinharItens, larguraConteudo, aparencia }) => {
    const c = caixa(aparencia);
    const interior: CSSProperties = {
      gap: espaco != null ? `${espaco}px` : undefined,
      alignItems: ALINHAR_ITENS[alinharItens] ?? "stretch",
      maxWidth: larguraConteudo === "total" ? undefined : "var(--largura)",
      marginLeft: "auto", marginRight: "auto", width: "100%",
      ...(disposicao === "grelha" ? { ["--cols" as string]: String(colunas || 1), ["--cols-tab" as string]: String(colunasTab || colunas || 1), ["--cols-tel" as string]: String(colunasTel || 1) } : {}),
    };
    const cls = disposicao === "grelha" ? "ena-grelha" : disposicao === "linha" ? "flex flex-wrap" : "flex flex-col";
    return (
      <section id={c.id} className={c.className} style={c.style}>
        <Conteudo className={cls} style={interior} minEmptyHeight={80} />
      </section>
    );
  },
};

// ─── Coluna ──────────────────────────────────────────────────────────────────

type ColunaProps = {
  conteudo: Slot;
  disposicao: "pilha" | "linha";
  espaco: number | null;
  alinharItens: keyof typeof ALINHAR_ITENS;
  justificar: keyof typeof JUSTIFICAR;
  ocupar: number | null;
  aparencia: Estilo;
};

export const Coluna: ComponentConfig<ColunaProps> = {
  label: "Coluna / caixa",
  fields: {
    conteudo: { type: "slot" },
    disposicao: { type: "select", label: "Disposição", options: [{ label: "Uns por baixo dos outros", value: "pilha" }, { label: "Lado a lado", value: "linha" }] },
    espaco: campoNumero("Espaço entre blocos"),
    alinharItens: { type: "select", label: "Alinhar (eixo cruzado)", options: opcoesAlinhar },
    justificar: {
      type: "select", label: "Distribuir (eixo principal)",
      options: [{ label: "Início", value: "inicio" }, { label: "Centro", value: "centro" }, { label: "Fim", value: "fim" }, { label: "Espalhar", value: "entre" }],
    },
    ocupar: campoNumero("Ocupa quantas colunas da grelha", ""),
    aparencia: campoAparencia(),
  },
  defaultProps: { conteudo: [], disposicao: "pilha", espaco: 16, alinharItens: "esticar", justificar: "inicio", ocupar: null, aparencia: estiloVazio() },
  render: ({ conteudo: Conteudo, disposicao, espaco, alinharItens, justificar, ocupar, aparencia }) => {
    const c = caixa(aparencia, ocupar ? { gridColumn: `span ${ocupar} / span ${ocupar}` } : undefined);
    return (
      <div id={c.id} className={juntar(c.className, "min-w-0")} style={c.style}>
        <Conteudo
          className={disposicao === "linha" ? "flex flex-wrap" : "flex flex-col"}
          style={{ gap: espaco != null ? `${espaco}px` : undefined, alignItems: ALINHAR_ITENS[alinharItens], justifyContent: JUSTIFICAR[justificar], height: "100%" }}
          minEmptyHeight={60}
        />
      </div>
    );
  },
};

// ─── Título e texto ──────────────────────────────────────────────────────────

type TituloProps = { texto: Texto; nivel: "h1" | "h2" | "h3" | "h4" | "p"; ligacao: string; tipografia: Tipografia; aparencia: Estilo };

export const Titulo: ComponentConfig<TituloProps> = {
  label: "Título",
  fields: {
    texto: { type: "textarea", label: "Texto", contentEditable: true },
    nivel: {
      type: "select", label: "Nível (para o Google e leitores de ecrã)",
      options: [{ label: "H1 (um por página)", value: "h1" }, { label: "H2", value: "h2" }, { label: "H3", value: "h3" }, { label: "H4", value: "h4" }, { label: "Parágrafo", value: "p" }],
    },
    ligacao: { type: "text", label: "Ligação (opcional)" },
    tipografia: campoTipografia(),
    aparencia: campoAparencia(),
  },
  defaultProps: {
    texto: "Título", nivel: "h2", ligacao: "",
    tipografia: tipoVazia({ fonte: "tema-titulos", tamanho: 44, tamanhoTel: 32, peso: "700", alturaLinha: 1.1, cor: "var(--c-primaria)" }),
    aparencia: estiloVazio(),
  },
  render: ({ texto, nivel, ligacao, tipografia, aparencia }) => {
    const c = caixa(aparencia);
    const t = estiloTexto(tipografia);
    const Tag = nivel as ElementType;
    const href = ligacaoSegura(ligacao);
    return (
      <Tag id={c.id} className={juntar(c.className, t.className, "whitespace-pre-line")} style={{ ...c.style, ...t.style }}>
        {href ? <a href={href} className="hover:opacity-80">{texto}</a> : texto}
      </Tag>
    );
  },
};

type TextoProps = { texto: Texto; tipografia: Tipografia; linhas: number | null; aparencia: Estilo };

export const Texto: ComponentConfig<TextoProps> = {
  label: "Texto",
  fields: {
    texto: { type: "textarea", label: "Texto", contentEditable: true },
    linhas: campoNumero("Cortar ao fim de N linhas (vazio = mostrar tudo)", ""),
    tipografia: campoTipografia(),
    aparencia: campoAparencia(),
  },
  defaultProps: {
    texto: "Escreva aqui o texto.", linhas: null,
    tipografia: tipoVazia({ tamanho: 17, alturaLinha: 1.65, cor: "var(--c-suave)" }),
    aparencia: estiloVazio(),
  },
  render: ({ texto, tipografia, linhas, aparencia }) => {
    const c = caixa(aparencia);
    const t = estiloTexto(tipografia);
    const corte = linhas && linhas >= 1 && linhas <= 4 ? `ena-linhas-${linhas}` : "";
    return <p id={c.id} className={juntar(c.className, t.className, corte, "whitespace-pre-line")} style={{ ...c.style, ...t.style }}>{texto}</p>;
  },
};

// ─── Botão ───────────────────────────────────────────────────────────────────

type BotaoProps = {
  rotulo: Texto; ligacao: string; novaJanela: boolean; variante: "cheio" | "contorno" | "texto";
  cor: string; corTexto: string; corHover: string; seta: boolean; larguraTotal: boolean;
  tipografia: Tipografia; aparencia: Estilo;
};

export const Botao: ComponentConfig<BotaoProps> = {
  label: "Botão",
  fields: {
    rotulo: { type: "text", label: "Texto do botão", contentEditable: true },
    ligacao: { type: "text", label: "Ligação (/formacao, #empresas, https://…)" },
    novaJanela: simNao("Abrir noutra janela"),
    variante: { type: "select", label: "Estilo", options: [{ label: "Cheio", value: "cheio" }, { label: "Contorno", value: "contorno" }, { label: "Só texto", value: "texto" }] },
    cor: campoCor("Cor principal"),
    corTexto: campoCor("Cor do texto"),
    corHover: campoCor("Cor ao passar o rato"),
    seta: simNao("Mostrar seta"),
    larguraTotal: simNao("Ocupar a largura toda"),
    tipografia: campoTipografia(),
    aparencia: campoAparencia(),
  },
  defaultProps: {
    rotulo: "Ver formações", ligacao: "/formacao", novaJanela: false, variante: "cheio",
    cor: "var(--c-destaque)", corTexto: "#ffffff", corHover: "var(--c-primaria)", seta: true, larguraTotal: false,
    tipografia: tipoVazia({ tamanho: 15, peso: "700" }),
    aparencia: estiloVazio({ preenchimento: lados(14, 26), raio: 0 }),
  },
  render: ({ rotulo, ligacao, novaJanela, variante, cor, corTexto, corHover, seta, larguraTotal, tipografia, aparencia }) => {
    const c = caixa(aparencia);
    const t = estiloTexto(tipografia);
    const principal = corSegura(cor) ?? "var(--c-destaque)";
    const vars = {
      ["--bt-cor" as string]: principal,
      ["--bt-texto" as string]: corSegura(corTexto) ?? "#fff",
      ["--bt-hover" as string]: corSegura(corHover) ?? principal,
    } as CSSProperties;
    const visual = variante === "cheio"
      ? "bg-[var(--bt-cor)] text-[var(--bt-texto)] hover:bg-[var(--bt-hover)]"
      : variante === "contorno"
        ? "border-2 border-[var(--bt-cor)] text-[var(--bt-cor)] hover:bg-[var(--bt-hover)] hover:border-[var(--bt-hover)] hover:text-[var(--bt-texto)]"
        : "text-[var(--bt-cor)] underline-offset-4 hover:underline hover:text-[var(--bt-hover)]";
    const href = ligacaoSegura(ligacao) || "#";
    return (
      <a
        id={c.id}
        href={href}
        {...(novaJanela ? { target: "_blank", rel: "noreferrer" } : {})}
        className={juntar(c.className, t.className, "group inline-flex items-center justify-center gap-3 transition-colors", visual, larguraTotal ? "w-full" : "w-fit")}
        style={{ ...vars, ...c.style, ...t.style }}
      >
        {rotulo}
        {seta && <svg aria-hidden="true" className="h-5 w-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="M5 12h14m-5-5 5 5-5 5" /></svg>}
      </a>
    );
  },
};

// ─── Imagem, espaço, separador ───────────────────────────────────────────────

type ImagemProps = { src: string; alt: string; proporcao: "" | "16/9" | "4/3" | "1/1" | "3/4" | "21/9"; ajuste: "cover" | "contain"; ligacao: string; aparencia: Estilo };

export const Imagem: ComponentConfig<ImagemProps> = {
  label: "Imagem",
  fields: {
    src: campoImagem("Imagem"),
    alt: { type: "text", label: "Descrição (para quem não vê a imagem)" },
    proporcao: {
      type: "select", label: "Proporção",
      options: [{ label: "Original", value: "" }, { label: "16:9", value: "16/9" }, { label: "21:9", value: "21/9" }, { label: "4:3", value: "4/3" }, { label: "Quadrada", value: "1/1" }, { label: "Retrato 3:4", value: "3/4" }],
    },
    ajuste: { type: "select", label: "Encaixe", options: [{ label: "Preencher (corta)", value: "cover" }, { label: "Inteira", value: "contain" }] },
    ligacao: { type: "text", label: "Ligação (opcional)" },
    aparencia: campoAparencia(),
  },
  defaultProps: { src: "", alt: "", proporcao: "4/3", ajuste: "cover", ligacao: "", aparencia: estiloVazio({ largura: em(100, "%") }) },
  render: ({ src, alt, proporcao, ajuste, ligacao, aparencia }) => {
    const c = caixa(aparencia, { overflow: "hidden" });
    const img = src
      ? <img src={src} alt={alt} className="block h-full w-full" style={{ objectFit: ajuste, aspectRatio: proporcao || undefined }} />
      : <div className="grid w-full place-items-center bg-[#E7EBF0] text-sm text-[#6b7685]" style={{ aspectRatio: proporcao || "4/3" }}>Escolha uma imagem</div>;
    const href = ligacaoSegura(ligacao);
    return <div id={c.id} className={c.className} style={c.style}>{href ? <a href={href}>{img}</a> : img}</div>;
  },
};

export const Espaco: ComponentConfig<{ altura: number | null; alturaTel: number | null }> = {
  label: "Espaço",
  fields: { altura: campoNumero("Altura"), alturaTel: campoNumero("Altura no telemóvel") },
  defaultProps: { altura: 48, alturaTel: null },
  render: ({ altura, alturaTel }) => {
    const c = estiloBloco(estiloVazio({ preenchimento: lados(altura ?? 0, 0, 0, 0), preenchimentoTel: lados(alturaTel ?? altura ?? 0, 0, 0, 0) }));
    return <div aria-hidden="true" className={c.className} style={c.style} />;
  },
};

export const Separador: ComponentConfig<{ espessura: number | null; cor: string; estilo: "solid" | "dashed" | "dotted"; aparencia: Estilo }> = {
  label: "Linha separadora",
  fields: {
    espessura: campoNumero("Espessura"),
    cor: campoCor("Cor"),
    estilo: { type: "select", label: "Tipo", options: [{ label: "Contínua", value: "solid" }, { label: "Tracejada", value: "dashed" }, { label: "Pontilhada", value: "dotted" }] },
    aparencia: campoAparencia(),
  },
  defaultProps: { espessura: 1, cor: "var(--c-primaria)", estilo: "solid", aparencia: estiloVazio({ margem: lados(16, 0), opacidade: 20 }) },
  render: ({ espessura, cor, estilo, aparencia }) => {
    const c = caixa(aparencia);
    return <hr id={c.id} className={c.className} style={{ ...c.style, border: 0, borderTop: `${espessura ?? 1}px ${estilo} ${corSegura(cor) ?? "currentColor"}` }} />;
  },
};

// ─── Cartões de informação e logótipos ──────────────────────────────────────

type Pilar = { numero: string; titulo: string; texto: string; imagem: string };
type PilaresProps = {
  itens: Pilar[]; colunas: number; colunasTel: number; espaco: number | null;
  tipoNumero: Tipografia; tipoTitulo: Tipografia; tipoTexto: Tipografia; cartao: Estilo; aparencia: Estilo;
};

export const Pilares: ComponentConfig<PilaresProps> = {
  label: "Cartões de informação",
  fields: {
    itens: {
      type: "array", label: "Cartões",
      arrayFields: { numero: { type: "text", label: "Número / etiqueta" }, titulo: { type: "text", label: "Título" }, texto: { type: "textarea", label: "Texto" }, imagem: campoImagem("Imagem (opcional)") },
      defaultItemProps: { numero: "", titulo: "Novo cartão", texto: "", imagem: "" },
      getItemSummary: item => item.titulo || item.numero || "Cartão",
    },
    colunas: campoNumero("Colunas", "") as never,
    colunasTel: campoNumero("Colunas no telemóvel", "") as never,
    espaco: campoNumero("Espaço entre cartões"),
    tipoNumero: campoTipografia("Tipografia do número"),
    tipoTitulo: campoTipografia("Tipografia do título"),
    tipoTexto: campoTipografia("Tipografia do texto"),
    cartao: campoAparencia("Aparência de cada cartão"),
    aparencia: campoAparencia(),
  },
  defaultProps: {
    itens: [
      { numero: "01", titulo: "Formadores experientes", texto: "Profissionais com prática real na área.", imagem: "" },
      { numero: "02", titulo: "Certificação", texto: "Formação certificada pela DGERT.", imagem: "" },
    ],
    colunas: 2, colunasTel: 1, espaco: 28,
    tipoNumero: tipoVazia({ tamanho: 12, peso: "800", cor: "var(--c-destaque)" }),
    tipoTitulo: tipoVazia({ tamanho: 17, peso: "700", cor: "var(--c-primaria)" }),
    tipoTexto: tipoVazia({ tamanho: 14, alturaLinha: 1.6, cor: "var(--c-suave)" }),
    cartao: estiloVazio({ preenchimento: lados(20, 0, 0, 0), bordaTopo: 2, bordaCor: "var(--c-acento)" }),
    aparencia: estiloVazio(),
  },
  render: ({ itens, colunas, colunasTel, espaco, tipoNumero, tipoTitulo, tipoTexto, cartao, aparencia }) => {
    const c = caixa(aparencia, { gap: espaco != null ? `${espaco}px` : undefined, ["--cols" as string]: String(colunas || 1), ["--cols-tab" as string]: String(Math.min(colunas || 1, 2)), ["--cols-tel" as string]: String(colunasTel || 1) } as CSSProperties);
    const k = estiloBloco(cartao);
    const [tn, tt, tx] = [estiloTexto(tipoNumero), estiloTexto(tipoTitulo), estiloTexto(tipoTexto)];
    return (
      <div id={c.id} className={juntar(c.className, "ena-grelha")} style={c.style}>
        {(itens ?? []).map((p, i) => (
          <div key={i} className={k.className} style={k.style}>
            {p.imagem && <img src={p.imagem} alt="" className="mb-4 h-14 w-14 object-contain" />}
            {p.numero && <span className={juntar("block", tn.className)} style={tn.style}>{p.numero}</span>}
            {p.titulo && <h3 className={juntar("mt-2", tt.className)} style={tt.style}>{p.titulo}</h3>}
            {p.texto && <p className={juntar("mt-2 whitespace-pre-line", tx.className)} style={tx.style}>{p.texto}</p>}
          </div>
        ))}
      </div>
    );
  },
};

type Logo = { imagem: string; alt: string; ligacao: string };

export const Logotipos: ComponentConfig<{ itens: Logo[]; altura: number | null; espaco: number | null; cinzento: boolean; alinhar: "inicio" | "centro" | "fim"; aparencia: Estilo }> = {
  label: "Logótipos",
  fields: {
    itens: {
      type: "array", label: "Logótipos",
      arrayFields: { imagem: campoImagem("Imagem"), alt: { type: "text", label: "Nome" }, ligacao: { type: "text", label: "Ligação (opcional)" } },
      defaultItemProps: { imagem: "", alt: "", ligacao: "" },
      getItemSummary: item => item.alt || "Logótipo",
    },
    altura: campoNumero("Altura dos logótipos"),
    espaco: campoNumero("Espaço entre logótipos"),
    cinzento: simNao("A cinzento (cor ao passar o rato)"),
    alinhar: { type: "select", label: "Alinhar", options: [{ label: "Esquerda", value: "inicio" }, { label: "Centro", value: "centro" }, { label: "Direita", value: "fim" }] },
    aparencia: campoAparencia(),
  },
  defaultProps: { itens: [], altura: 48, espaco: 40, cinzento: true, alinhar: "centro", aparencia: estiloVazio() },
  render: ({ itens, altura, espaco, cinzento, alinhar, aparencia }) => {
    const c = caixa(aparencia, { gap: `${espaco ?? 40}px`, justifyContent: JUSTIFICAR[alinhar] });
    return (
      <div id={c.id} className={juntar(c.className, "flex flex-wrap items-center")} style={c.style}>
        {(itens ?? []).length === 0 && <p className="text-sm text-[#6b7685]">Junte logótipos no painel.</p>}
        {(itens ?? []).filter(l => l.imagem).map((l, i) => {
          const img = <img src={l.imagem} alt={l.alt} style={{ height: `${altura ?? 48}px` }} className={juntar("w-auto object-contain transition", cinzento && "opacity-70 grayscale hover:opacity-100 hover:grayscale-0")} />;
          const href = ligacaoSegura(l.ligacao);
          return href ? <a key={i} href={href} target="_blank" rel="noreferrer">{img}</a> : <span key={i}>{img}</span>;
        })}
      </div>
    );
  },
};
