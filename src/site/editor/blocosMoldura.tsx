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
  ligacoes: [{ rotulo: "Formação", ligacao: "/formacao" }, { rotulo: "Notícias", ligacao: "/noticias" }, { rotulo: "Empresas", ligacao: "/empresas" }],
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
  corFundo: string; corTexto: string; corTitulos: string; corBarra: string; barra: number | null;
  tipografia: Tipografia; aparencia: Estilo;
};

/** "Texto | /ligação" numa linha vira ligação; o resto fica texto. {ano} troca pelo ano actual. */
function Linha({ linha }: { linha: string }) {
  const [texto, url] = linha.split("|").map(s => s.trim());
  const href = url ? ligacaoSegura(url) : "";
  if (href) return <a href={href} {...(/^https?:/.test(href) ? { target: "_blank", rel: "noreferrer" } : {})} className="underline decoration-current/30 underline-offset-4 hover:opacity-80">{texto}</a>;
  return <span>{texto}</span>;
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
  return (
    <footer ref={p.refRaiz ?? undefined} id="contactos" className={juntar(c.className, t.className, "scroll-mt-24")} style={{ ...c.style, ...t.style }}>
      <div className="mx-auto" style={{ maxWidth: "var(--largura)" }}>
        <div className="ena-grelha gap-10 border-b border-white/15 pb-12" style={{ ["--cols" as string]: String(colunas.length + 2), ["--cols-tab" as string]: "2", ["--cols-tel" as string]: "1" } as CSSProperties}>
          <div style={{ gridColumn: "span 2 / span 2" }}>
            {p.marcaImagem
              ? <img src={p.marcaImagem} alt={p.marca || ""} style={{ height: `${p.alturaMarca ?? 48}px` }} className="w-auto" />
              : p.marca && <span className="grid h-12 w-12 place-items-center text-sm font-extrabold text-white" style={{ background: corSegura(p.corMarca) ?? "var(--c-destaque)" }}>{p.marca}</span>}
            {p.texto && <p className="mt-5 max-w-sm whitespace-pre-line text-sm leading-6">{p.texto}</p>}
            {/* Sem lista própria: as redes de Sistema › Site › SEO. */}
            <LigacoesRedes redes={p.redes} className="mt-6" />
          </div>
          {colunas.map((col, i) => (
            <div key={i}>
              {col.titulo && <strong className="text-sm" style={{ color: titulos }}>{col.titulo}</strong>}
              <div className="mt-4 flex flex-col gap-2 text-sm leading-6">
                {col.linhas.split("\n").filter(l => l.trim()).map((l, j) => <Linha key={j} linha={l} />)}
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col justify-between gap-3 pt-6 text-xs opacity-80 sm:flex-row">
          <span>{p.direitos.replace(/\{ano\}/g, ano)}</span>
          <span>{p.lema}</span>
        </div>
      </div>
    </footer>
  );
}

export const rodapePadrao: RodapeProps = {
  marca: "ENA", marcaImagem: "", alturaMarca: 48, corMarca: "", texto: "Capacitamos pessoas e organizações através de experiências de aprendizagem relevantes, práticas e transformadoras.",
  colunas: [
    { titulo: "Contactos", linhas: "2ª a 6ª, 09h—18h" },
    {
      titulo: "Ligações úteis",
      linhas: [
        "Formação | /formacao", "Notícias | /noticias",
        "Política de privacidade | https://ena.pt/politica-de-privacidade", "Livro de reclamações | https://www.livroreclamacoes.pt/Inicio/",
      ].join("\n"),
    },
  ],
  direitos: "© {ano} ENA. Todos os direitos reservados.", lema: "Aprender. Evoluir. Transformar.", redes: [],
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
