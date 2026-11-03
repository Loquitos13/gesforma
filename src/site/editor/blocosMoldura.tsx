// Cabeçalho e rodapé do site como blocos editáveis: vivem na página «Cabeçalho e rodapé» do editor e servem todas as páginas.
import { campoRedes, LigacoesRedes, type LigacaoRede } from "./redesSociais";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { ComponentConfig } from "@puckeditor/core";
import { apiMe } from "../../partilhado/api";
import { campoCor, campoImagem, campoNumero, simNao } from "./campos";
import { campoAparencia, campoTipografia } from "./camposGrupos";
import { corSegura, estiloBloco, estiloTexto, estiloVazio, juntar, lados, ligacaoSegura, tipoVazia, type Estilo, type Tipografia } from "./estilos";
import { anoLisboa } from "../../partilhado/horaLisboa";

type Ligacao = { rotulo: string; ligacao: string; novaJanela?: boolean };

/** Atributos de uma ligação que abre noutra janela. */
const novaJanela = (sim?: boolean) => (sim ? { target: "_blank", rel: "noopener noreferrer" } : {});

export type CabecalhoProps = {
  logo: string; alturaLogo: number | null; linha1: string; linha2: string;
  /** Texto alternativo do logótipo (leitores de ecrã), ligação do logótipo e o texto ao lado também no telemóvel. */
  logoAlt: string; logoLigacao: string; linhasNoTelemovel: boolean;
  ligacoes: Ligacao[]; redes?: LigacaoRede[];
  botao: string; botaoSessao: string; botaoLigacao: string; botaoNovaJanela: boolean;
  /** Menu do telemóvel: fundo e texto (vazios = os do cabeçalho). */
  corMenuTel: string; corTextoMenuTel: string;
  fixo: boolean; corFundo: string; corTexto: string; corHover: string; corBotao: string; corBarra: string; barra: number | null;
  tipografia: Tipografia; aparencia: Estilo;
};

function useFormando(ativo: boolean) {
  const [formando, setFormando] = useState(false);
  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    apiMe().then(r => { if (vivo) setFormando(r.user?.role === "formando"); }).catch(() => undefined);
    return () => { vivo = false; };
  }, [ativo]);
  return formando;
}

export function CabecalhoSite(p: CabecalhoProps & { editar?: boolean; refRaiz?: ((el: Element | null) => void) | null }) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLElement | null>(null);
  // Menu do telemóvel: fecha com Esc ou com um toque fora dele.
  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    const fora = (e: PointerEvent) => { if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false); };
    document.addEventListener("keydown", tecla);
    document.addEventListener("pointerdown", fora);
    return () => { document.removeEventListener("keydown", tecla); document.removeEventListener("pointerdown", fora); };
  }, [aberto]);
  const formando = useFormando(!p.editar && Boolean(p.botaoSessao));
  const c = estiloBloco(p.aparencia, {
    background: corSegura(p.corFundo) ?? "#fff",
    color: corSegura(p.corTexto) ?? "var(--c-primaria)",
    borderBottom: p.barra ? `${p.barra}px solid ${corSegura(p.corBarra) ?? "var(--c-acento)"}` : undefined,
  });
  const t = estiloTexto(p.tipografia);
  const vars = { ["--cab-hover" as string]: corSegura(p.corHover) ?? "var(--c-destaque)", ["--cab-botao" as string]: corSegura(p.corBotao) ?? "var(--c-destaque)" } as CSSProperties;
  const ligacoes = (p.ligacoes ?? []).filter(l => l.rotulo?.trim());
  const botao = formando && p.botaoSessao ? p.botaoSessao : p.botao;
  const botaoHref = ligacaoSegura(p.botaoLigacao) || "/area-formando";
  return (
    <header ref={el => { raiz.current = el; p.refRaiz?.(el); }} className={juntar(p.fixo && !p.editar && "sticky top-0", "z-40")} style={vars}>
      <div className={c.className} style={c.style}>
        <div className="mx-auto flex items-center justify-between gap-6" style={{ maxWidth: "var(--largura)" }}>
          <a href={ligacaoSegura(p.logoLigacao ?? "") || "/"} className="flex items-center gap-3" aria-label={p.logoAlt?.trim() ? undefined : "Página inicial"}>
            {p.logo && <img src={p.logo} alt={p.logoAlt ?? ""} style={{ height: `${p.alturaLogo ?? 40}px` }} className="w-auto" />}
            {(p.linha1 || p.linha2) && (
              <span className={juntar("text-left text-[10px] font-bold uppercase leading-tight tracking-[0.12em]", p.linhasNoTelemovel ? "block" : "hidden sm:block")}>{p.linha1}{p.linha2 && <><br />{p.linha2}</>}</span>
            )}
          </a>
          <nav className={juntar("hidden items-center gap-6 whitespace-nowrap lg:flex xl:gap-8", t.className)} style={t.style} aria-label="Navegação principal">
            {ligacoes.map((l, i) => <a key={i} href={ligacaoSegura(l.ligacao) || "#"} {...novaJanela(l.novaJanela)} className="transition-colors hover:text-[var(--cab-hover)]">{l.rotulo}</a>)}
          </nav>
          <div className="flex shrink-0 items-center gap-3">
            {botao && <a href={botaoHref} {...novaJanela(p.botaoNovaJanela)} className="hidden bg-[var(--cab-botao)] px-5 py-3 text-sm font-bold text-white transition hover:brightness-110 lg:inline-flex">{botao}</a>}
            {/* À direita do botão de entrada. Sem lista própria: as redes de Sistema › Site › SEO. */}
            <LigacoesRedes redes={p.redes} pequeno className="hidden gap-1 xl:flex" />
          </div>
          <button type="button" onClick={() => setAberto(!aberto)} className="p-2 lg:hidden" aria-expanded={aberto} aria-label={aberto ? "Fechar menu" : "Abrir menu"}>
            <svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">{aberto ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}</svg>
          </button>
        </div>
      </div>
      {aberto && (
        <nav aria-label="Menu" className="border-t border-black/10 px-5 py-6 lg:hidden"
          style={{ background: corSegura(p.corMenuTel) ?? corSegura(p.corFundo) ?? "#fff", color: corSegura(p.corTextoMenuTel) ?? corSegura(p.corTexto) ?? "var(--c-primaria)" }}>
          <div className="flex flex-col gap-5 font-semibold">
            {ligacoes.map((l, i) => <a key={i} href={ligacaoSegura(l.ligacao) || "#"} {...novaJanela(l.novaJanela)} onClick={() => setAberto(false)}>{l.rotulo}</a>)}
            {botao && <a href={botaoHref} {...novaJanela(p.botaoNovaJanela)} className="bg-[var(--cab-botao)] px-5 py-3 text-center text-sm font-bold text-white">{botao}</a>}
            <LigacoesRedes redes={p.redes} />
          </div>
        </nav>
      )}
    </header>
  );
}

export const cabecalhoPadrao: CabecalhoProps = {
  logo: "/imagens/ena_logo.svg", alturaLogo: 40, linha1: "Escola de", linha2: "Negócios e Administração",
  logoAlt: "ENA – Escola de Negócios e Administração", logoLigacao: "/", linhasNoTelemovel: false, botaoNovaJanela: false, corMenuTel: "", corTextoMenuTel: "",
  ligacoes: [{ rotulo: "Formação", ligacao: "/formacao" }, { rotulo: "Notícias e artigos", ligacao: "/noticias" }, { rotulo: "Empresas", ligacao: "/empresas" }],
  redes: [], botao: "Área do formando", botaoSessao: "A minha área", botaoLigacao: "/area-formando",
  fixo: false, corFundo: "#ffffff", corTexto: "var(--c-primaria)", corHover: "var(--c-destaque)", corBotao: "var(--c-destaque)", corBarra: "var(--c-acento)", barra: 4,
  tipografia: tipoVazia({ tamanho: 14, peso: "600" }),
  aparencia: estiloVazio({ preenchimento: lados(18, 32), preenchimentoTel: lados(14, 20) }),
};

const listaLigacoes = {
  type: "array" as const, label: "Ligações do menu",
  arrayFields: { rotulo: { type: "text" as const, label: "Texto" }, ligacao: { type: "text" as const, label: "Ligação" }, novaJanela: simNao("Abre noutra janela") },
  defaultItemProps: { rotulo: "Nova ligação", ligacao: "/", novaJanela: false },
  getItemSummary: (l: Ligacao) => l.rotulo || "Ligação",
};

export const Cabecalho: ComponentConfig<CabecalhoProps> = {
  label: "Cabeçalho",
  fields: {
    logo: campoImagem("Logótipo"),
    alturaLogo: campoNumero("Altura do logótipo"),
    logoAlt: { type: "text", label: "Descrição do logótipo (para leitores de ecrã e a Google)" },
    logoLigacao: { type: "text", label: "Ligação do logótipo" },
    linha1: { type: "text", label: "Texto ao lado do logótipo (linha 1)" },
    linha2: { type: "text", label: "Linha 2" },
    linhasNoTelemovel: simNao("Mostrar o texto ao lado do logótipo também no telemóvel"),
    ligacoes: listaLigacoes,
    redes: campoRedes as never,
    botao: { type: "text", label: "Botão (vazio = sem botão)" },
    botaoSessao: { type: "text", label: "Botão quando o formando tem sessão iniciada" },
    botaoLigacao: { type: "text", label: "Ligação do botão" },
    botaoNovaJanela: simNao("O botão abre noutra janela"),
    fixo: simNao("Fica fixo no topo ao descer a página"),
    corFundo: campoCor("Fundo"),
    corTexto: campoCor("Texto"),
    corHover: campoCor("Texto ao passar o rato"),
    corBotao: campoCor("Botão"),
    corMenuTel: campoCor("Fundo do menu no telemóvel (vazio = o do cabeçalho)"),
    corTextoMenuTel: campoCor("Texto do menu no telemóvel (vazio = o do cabeçalho)"),
    barra: campoNumero("Barra inferior"),
    corBarra: campoCor("Cor da barra inferior"),
    tipografia: campoTipografia("Tipografia do menu"),
    aparencia: campoAparencia(),
  },
  defaultProps: cabecalhoPadrao,
  render: ({ puck, ...p }) => <CabecalhoSite {...p} editar={puck?.isEditing} refRaiz={puck?.dragRef} />,
};

// ─── Rodapé ──────────────────────────────────────────────────────────────────

type ColunaRodape = { titulo: string; linhas: string };

export type RodapeProps = {
  marca: string;
  /** Logótipo no lugar do quadrado da marca (vazio = o quadrado com o texto). */
  marcaImagem: string; alturaMarca: number | null; corMarca: string;
  texto: string; colunas: ColunaRodape[]; direitos: string; lema: string; redes?: LigacaoRede[];
  /** Logótipos de certificação (DGERT, IEFP, SIGO…), numa fila por cima dos direitos. */
  logos?: { imagem: string; alt: string; ligacao?: string }[]; tituloLogos?: string;
  corFundo: string; corTexto: string; corTitulos: string; corBarra: string; barra: number | null;
  tipografia: Tipografia; aparencia: Estilo;
};

/** Ícone de uma linha do rodapé pelo que ela é: telefone, email, morada ou horário (as outras ficam sem ícone). */
function iconeLinha(texto: string, url: string) {
  const d = /^tel:/i.test(url) ? "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"
    : /^mailto:/i.test(url) ? "M4 6h16v12H4zM4 7l8 6 8-6"
    : /\d{4}-\d{3}/.test(texto) ? "M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5"
    : /\d{1,2}h\d{0,2}/i.test(texto) ? "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18"
    : "";
  return d ? <svg aria-hidden="true" viewBox="0 0 24 24" className="mt-1 h-4 w-4 shrink-0 opacity-70" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg> : null;
}

/** "Texto | /ligação" numa linha vira ligação; o resto fica texto. {ano} troca pelo ano actual. */
function Linha({ linha }: { linha: string }) {
  const [texto = "", url = ""] = linha.split("|").map(s => s.trim());
  const href = url ? ligacaoSegura(url) : "";
  const icone = iconeLinha(texto, url);
  const conteudo = href
    ? <a href={href} {...(/^https?:/.test(href) ? { target: "_blank", rel: "noreferrer" } : {})} className="hover:underline hover:underline-offset-4 hover:opacity-100">{texto}</a>
    : <span>{texto}</span>;
  return icone ? <span className="flex items-start gap-2.5">{icone}{conteudo}</span> : conteudo;
}

export function RodapeSite(p: RodapeProps & { refRaiz?: ((el: Element | null) => void) | null }) {
  const c = estiloBloco(p.aparencia, {
    background: corSegura(p.corFundo) ?? "#0E1C2E",
    color: corSegura(p.corTexto) ?? "#D7E0EA",
    borderTop: p.barra ? `${p.barra}px solid ${corSegura(p.corBarra) ?? "var(--c-acento)"}` : undefined,
  });
  const t = estiloTexto(p.tipografia);
  const ano = String(anoLisboa());
  const titulos = corSegura(p.corTitulos) ?? "#fff";
  const colunas = (p.colunas ?? []).filter(x => x.titulo || x.linhas);
  const logos = (p.logos ?? []).filter(l => l.imagem);
  return (
    <footer ref={p.refRaiz ?? undefined} id="contactos" className={juntar(c.className, t.className, "scroll-mt-24")} style={{ ...c.style, ...t.style }}>
      <div className="mx-auto" style={{ maxWidth: "var(--largura)" }}>
        <div className="ena-grelha gap-x-10 gap-y-12 border-b border-white/10 pb-12" style={{ ["--cols" as string]: String(colunas.length + 2), ["--cols-tab" as string]: "2", ["--cols-tel" as string]: "1" } as CSSProperties}>
          <div style={{ gridColumn: "span 2 / span 2" }}>
            {/* Sem logótipo próprio: o da ENA em branco (o quadrado com a marca só se o logótipo faltar). */}
            {p.marcaImagem
              ? <img src={p.marcaImagem} alt={p.marca || ""} style={{ height: `${p.alturaMarca ?? 48}px` }} className="w-auto" />
              : <img src="/imagens/ena_logo.svg" alt={p.marca || "ENA"} style={{ height: `${Math.min(p.alturaMarca ?? 40, 44)}px` }} className="w-auto brightness-0 invert" />}
            {p.texto && <p className="mt-6 max-w-sm whitespace-pre-line text-sm leading-6 opacity-85">{p.texto}</p>}
            {/* Sem lista própria: as redes de Sistema › Site › SEO. */}
            <LigacoesRedes redes={p.redes} className="mt-6" />
          </div>
          {colunas.map((col, i) => (
            <div key={i}>
              {col.titulo && (
                <strong className="block text-xs font-extrabold uppercase tracking-[0.14em]" style={{ color: titulos }}>
                  {col.titulo}
                  <span aria-hidden="true" className="mt-3 block h-0.5 w-8" style={{ background: corSegura(p.corBarra) ?? "var(--c-acento)" }} />
                </strong>
              )}
              <div className="mt-5 flex flex-col gap-3 text-sm leading-6">
                {col.linhas.split("\n").filter(l => l.trim()).map((l, j) => <Linha key={j} linha={l} />)}
              </div>
            </div>
          ))}
        </div>
        {logos.length > 0 && (
          <div className="flex flex-col gap-4 border-b border-white/10 py-8 sm:flex-row sm:items-center sm:gap-8">
            {p.tituloLogos && <span className="text-xs font-extrabold uppercase tracking-[0.14em]" style={{ color: titulos }}>{p.tituloLogos}</span>}
            <div className="flex flex-wrap items-center gap-4">
              {logos.map((l, i) => {
                const img = <img src={l.imagem} alt={l.alt || ""} className="h-16 w-auto object-contain" />;
                const caixa = "grid h-20 min-w-24 place-items-center rounded-lg bg-white px-3 transition-transform hover:-translate-y-0.5";
                const href = l.ligacao ? ligacaoSegura(l.ligacao) : "";
                return href
                  ? <a key={i} href={href} target="_blank" rel="noreferrer" title={l.alt} className={caixa}>{img}</a>
                  : <span key={i} className={caixa}>{img}</span>;
              })}
            </div>
          </div>
        )}
        <div className="flex flex-col justify-between gap-3 pt-6 text-xs opacity-75 sm:flex-row">
          <span>{p.direitos.replace(/\{ano\}/g, ano)}</span>
          <span>{p.lema}</span>
        </div>
      </div>
    </footer>
  );
}

/** Contactos da sede (do site antigo): morada, telefones, email e horário da secretaria. */
export const CONTACTOS_RODAPE = [
  "R. do Conselheiro Veloso da Cruz 524, 4400-705 Vila Nova de Gaia",
  "Telefone: 223 781 100 | tel:+351223781100",
  "Telemóvel: 912 744 205 | tel:+351912744205",
  "geral@ena.pt | mailto:geral@ena.pt",
  "Secretaria: 2ª a 6ª, 9h00–13h00 e 14h00–18h00",
].join("\n");

export const LOGOS_CERTIFICACAO = [
  { imagem: "/imagens/certificacoes/dgert.jpg", alt: "DGERT – Entidade formadora certificada", ligacao: "https://www.dgert.gov.pt/" },
  { imagem: "/imagens/certificacoes/iefp.jpg", alt: "IEFP – Instituto do Emprego e Formação Profissional", ligacao: "https://www.iefp.pt/" },
];

export const rodapePadrao: RodapeProps = {
  marca: "ENA", marcaImagem: "", alturaMarca: 48, corMarca: "", texto: "Capacitamos pessoas e organizações através de experiências de aprendizagem relevantes, práticas e transformadoras.",
  colunas: [
    { titulo: "Contactos", linhas: CONTACTOS_RODAPE },
    {
      titulo: "Ligações úteis",
      linhas: [
        "Formação | /formacao", "Notícias e artigos | /noticias",
        "Política de privacidade | https://ena.pt/politica-de-privacidade", "Livro de reclamações | https://www.livroreclamacoes.pt/Inicio/",
      ].join("\n"),
    },
  ],
  direitos: "© {ano} ENA. Todos os direitos reservados.", lema: "Aprender. Evoluir. Transformar.", redes: [],
  logos: LOGOS_CERTIFICACAO, tituloLogos: "Entidade formadora certificada",
  corFundo: "#0E1C2E", corTexto: "#D7E0EA", corTitulos: "#ffffff", corBarra: "var(--c-acento)", barra: 4,
  tipografia: tipoVazia(),
  aparencia: estiloVazio({ preenchimento: lados(56, 32), preenchimentoTel: lados(40, 20) }),
};

export const Rodape: ComponentConfig<RodapeProps> = {
  label: "Rodapé",
  fields: {
    marcaImagem: campoImagem("Logótipo do rodapé (vazio = o quadrado com a marca)"),
    alturaMarca: campoNumero("Altura do logótipo do rodapé"),
    marca: { type: "text", label: "Marca (texto do quadrado; com logótipo, é a descrição dele)" },
    corMarca: campoCor("Cor do quadrado da marca"),
    texto: { type: "textarea", label: "Texto" },
    colunas: {
      type: "array", label: "Colunas",
      arrayFields: { titulo: { type: "text", label: "Título" }, linhas: { type: "textarea", label: "Linhas (\"Texto | /ligação\" cria uma ligação)" } },
      defaultItemProps: { titulo: "Nova coluna", linhas: "" },
      getItemSummary: c => c.titulo || "Coluna",
    },
    redes: campoRedes as never,
    tituloLogos: { type: "text", label: "Texto antes dos logótipos de certificação" },
    logos: {
      type: "array", label: "Logótipos de certificação (DGERT, IEFP, SIGO…)",
      arrayFields: { imagem: campoImagem("Imagem") as never, alt: { type: "text", label: "Nome" }, ligacao: { type: "text", label: "Ligação (opcional)" } },
      defaultItemProps: { imagem: "", alt: "", ligacao: "" },
      getItemSummary: (l: { alt?: string }) => l.alt || "Logótipo",
    } as never,
    direitos: { type: "text", label: "Direitos ({ano} = ano actual)" },
    lema: { type: "text", label: "Lema" },
    corFundo: campoCor("Fundo"),
    corTexto: campoCor("Texto"),
    corTitulos: campoCor("Títulos das colunas"),
    barra: campoNumero("Barra no topo"),
    corBarra: campoCor("Cor da barra"),
    tipografia: campoTipografia(),
    aparencia: campoAparencia(),
  },
  defaultProps: rodapePadrao,
  render: ({ puck, ...p }) => <RodapeSite {...p} refRaiz={puck?.dragRef} />,
};
