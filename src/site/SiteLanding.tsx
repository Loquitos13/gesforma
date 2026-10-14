import { createContext, type CSSProperties, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { apiMe, type SessionUser } from "../partilhado/api";

import { botaoHero, classeAnimacaoBotao, classeSelo, descricaoDoCurso, destinoDoHero, estiloMargem, ligacaoExterna, MARGEM_MAX, MARGEM_MIN, numeroSite, rotuloBotaoInscricao, textoSite, tituloRegime, type HeroAnimacao, type HeroBadgeCor, type HeroPedido, type HeroTamanho, type InscricaoPublica, type SiteChave } from "../partilhado/siteConteudo";

export type Course = {
  id: string;
  title: string;
  area: string;
  format: string;
  duration: string;
  start: string;
  price: string;
  description: string;
  funding: "Financiada" | "Gold";
  enrollment: InscricaoPublica;
  miniatura: string | null;
  capa: string | null;
  banner: string | null;
  precoDesde: number | null;
  vendas: number;
  regime: "gold" | "fin";
  objetivos: string[];
  organizacao: "modular" | "livre";
  programa: { titulo: string; horas: string }[];
  sessoes: { data: string; local: string; horario: string }[];
  nomeOferta: string;
};

type CatalogoApi = {
  cursos: Array<{
    id: string;
    regime: "gold" | "fin";
    titulo: string;
    area: string;
    modalidade: string;
    horasLabel: string;
    inicio: string;
    precoLabel: string;
    precoDesde: number | null;
    descricao: string;
    financiamento: "Gold" | "Financiada";
    inscricao: InscricaoPublica;
    miniatura: string | null;
    capa?: string | null;
    banner?: string | null;
    vendas: number;
    objetivos?: string[];
    organizacao?: "modular" | "livre";
    programa?: { titulo: string; horas: string }[];
    sessoes?: { data: string; local: string; horario: string }[];
    nomeOferta?: string;
  }>;
  destaques: CatalogoApi["cursos"];
  ccp: CatalogoApi["cursos"][number] | null;
};

function mapCurso(curso: CatalogoApi["cursos"][number]): Course {
  return {
    id: curso.id,
    title: curso.titulo,
    area: curso.area,
    format: curso.modalidade,
    duration: curso.horasLabel,
    start: curso.inicio,
    price: curso.precoLabel,
    description: curso.descricao,
    funding: curso.financiamento,
    enrollment: curso.inscricao,
    miniatura: curso.miniatura,
    capa: curso.capa || curso.miniatura,
    banner: curso.banner ?? curso.capa ?? curso.miniatura,
    precoDesde: curso.precoDesde,
    vendas: curso.vendas,
    regime: curso.regime,
    objetivos: curso.objetivos ?? [],
    organizacao: curso.organizacao === "livre" ? "livre" : "modular",
    programa: curso.programa ?? [],
    sessoes: curso.sessoes ?? [],
    nomeOferta: curso.nomeOferta || curso.titulo,
  };
}

type OfertaEstado = {
  cursos: Course[];
  destaques: Course[];
  ccp: Course | null;
  estado: "a-carregar" | "pronto" | "erro";
  recarregar: () => void;
};

type TextoSite = {
  ler: (chave: SiteChave) => string;
  nota: string | null;
};

export const OfertaCtx = createContext<OfertaEstado | null>(null);
export const SiteTextoCtx = createContext<TextoSite>({
  ler: chave => textoSite(undefined, chave),
  nota: null,
});

export function useSiteTexto() {
  return useContext(SiteTextoCtx).ler;
}

export function useNotaInqueritos() {
  return useContext(SiteTextoCtx).nota;
}

export function useSiteTextoState(): TextoSite {
  const [gravado, setGravado] = useState<Record<string, string>>({});
  const [nota, setNota] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    fetch("/api/v1/public/site", { cache: "no-store" })
      .then(async res => (res.ok ? res.json() as Promise<{ valores?: Record<string, string>; satisfacao?: { nota?: string } | null }> : { valores: {}, satisfacao: null }))
      .then(data => {
        if (!vivo) return;
        setGravado(data.valores ?? {});
        const media = data.satisfacao?.nota?.trim();
        setNota(media || null);
      })
      .catch(() => undefined);
    return () => { vivo = false; };
  }, []);
  const ler = useCallback((chave: SiteChave) => textoSite(gravado, chave), [gravado]);
  return { ler, nota };
}

export function useOferta() {
  const ctx = useContext(OfertaCtx);
  if (!ctx) throw new Error("useOferta precisa do site");
  return ctx;
}

export function useOfertaState(): OfertaEstado {
  const [cursos, setCursos] = useState<Course[]>([]);
  const [destaques, setDestaques] = useState<Course[]>([]);
  const [ccp, setCcp] = useState<Course | null>(null);
  const [estado, setEstado] = useState<OfertaEstado["estado"]>("a-carregar");
  const [tick, setTick] = useState(0);
  const recarregar = useCallback(() => setTick(n => n + 1), []);

  useEffect(() => {
    let vivo = true;
    setEstado("a-carregar");
    fetch("/api/v1/public/catalogo", { cache: "no-store" })
      .then(async res => {
        if (!res.ok) throw new Error("oferta indisponível");
        return res.json() as Promise<CatalogoApi>;
      })
      .then(data => {
        if (!vivo) return;
        setCursos((data.cursos ?? []).map(mapCurso));
        setDestaques((data.destaques ?? []).map(mapCurso));
        setCcp(data.ccp ? mapCurso(data.ccp) : null);
        setEstado("pronto");
      })
      .catch(() => {
        if (!vivo) return;
        setEstado("erro");
      });
    return () => {
      vivo = false;
    };
  }, [tick]);

  return { cursos, destaques, ccp, estado, recarregar };
}

export function Icon({
  name,
  className = "h-5 w-5",
}: {
  name: "arrow" | "search" | "clock" | "pin" | "screen" | "check" | "close" | "menu" | "whatsapp";
  className?: string;
}) {
  const paths: Record<string, ReactNode> = {
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2" /></>,
    screen: <><rect x="3" y="4" width="18" height="13" rx="1" /><path d="M8 21h8m-4-4v4" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="M6 6l12 12M18 6 6 18" />,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    whatsapp: <><path d="M20.5 11.6a8.5 8.5 0 0 1-12.6 7.5L3.5 20.5l1.4-4.2a8.5 8.5 0 1 1 15.6-4.7Z" /><path d="M8.2 7.8c.2-.4.4-.4.7-.4h.5c.2 0 .4 0 .5.4l.8 1.9c.1.3.1.5-.1.7l-.7.8c-.2.2-.1.4 0 .6.7 1.2 1.7 2.2 2.9 2.8.2.1.4.1.6-.1l.8-1c.2-.2.4-.3.7-.2l2 .9c.3.1.4.3.4.5 0 .3-.2 1.5-1 2.1-.6.6-1.5.8-2.5.5-1-.3-4.3-1.6-6.3-5.2-.6-1.1-.8-2.2-.7-2.9.1-.7.8-1.4 1.4-1.4Z" /></>,
  };
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

export function estiloEscala(escala: number, extra?: CSSProperties): CSSProperties {
  return { ...(extra ?? {}), ["--ena-esc" as string]: String(escala) } as CSSProperties;
}

export function estiloContentor(largura: number, altura: number): CSSProperties {
  return { ["--ena-hero-l" as string]: String(largura / 100), ["--ena-hero-a" as string]: String(altura / 100) } as CSSProperties;
}

export function margemLida(t: (chave: SiteChave) => string, x: SiteChave, y: SiteChave) {
  return {
    x: numeroSite(t(x), MARGEM_MIN, MARGEM_MAX, 0),
    y: numeroSite(t(y), MARGEM_MIN, MARGEM_MAX, 0),
  };
}

function useSessaoPublica() {
  const [user, setUser] = useState<SessionUser | null>(null);
  useEffect(() => {
    let viva = true;
    apiMe().then(r => { if (viva) setUser(r.user); }).catch(() => { if (viva) setUser(null); });
    return () => { viva = false; };
  }, []);
  return user;
}

export function Header() {
  const [open, setOpen] = useState(false);
  const t = useSiteTexto();
  const sessao = useSessaoPublica();
  const formando = sessao?.role === "formando";
  const margem = margemLida(t, "margemCabecalhoX", "margemCabecalhoY");
  return (
    <header className="sticky top-0 z-40 border-b-4 border-[#FFA900] bg-white text-[#14263D]">
      <div className="ena-margem mx-auto flex max-w-[1240px] items-center justify-between" style={estiloMargem(margem.x, margem.y, { x: "1.25rem", y: "1.125rem", xLg: "2rem" })}>
        <a href="/" className="group flex items-center gap-3" aria-label="ENA, página inicial">
          <img src="/imagens/ena_logo.svg" alt="ENA" className="h-9 w-auto sm:h-10" />
          <span className="hidden text-left text-[10px] font-bold uppercase leading-tight tracking-[0.12em] text-[#14263D] sm:block">{t("marcaLinha1")}<br />{t("marcaLinha2")}</span>
        </a>
        <nav className="hidden items-center gap-8 text-sm font-semibold lg:flex" aria-label="Navegação principal">
          <a href="/formacao" className="text-[#14263D] hover:text-[#A60000]">{t("navFormacao")}</a>
          {t("navNoticias") && <a href="/noticias" className="text-[#14263D] hover:text-[#A60000]">{t("navNoticias")}</a>}
          <a href="/#empresas" className="text-[#14263D] hover:text-[#A60000]">{t("navEmpresas")}</a>
        </nav>
        <div className="hidden items-center gap-4 lg:flex">
          {formando ? (
            <a href="/area-formando" className="bg-[#A60000] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#14263D]">{t("navFormando")}</a>
          ) : (
            <a href="/area-formando" className="bg-[#A60000] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#14263D]">{t("navEntrar")}</a>
          )}
        </div>
        <button type="button" onClick={() => setOpen(!open)} className="p-2 lg:hidden" aria-label={open ? "Fechar menu" : "Abrir menu"}><Icon name={open ? "close" : "menu"} /></button>
      </div>
      {open && (
        <nav className="border-t border-[#14263D]/10 bg-white px-5 py-6 text-[#14263D] lg:hidden">
          <div className="flex flex-col gap-5 font-semibold">
            <a href="/formacao" onClick={() => setOpen(false)}>{t("navFormacao")}</a>
            {t("navNoticias") && <a href="/noticias" onClick={() => setOpen(false)}>{t("navNoticias")}</a>}
            <a href="/#empresas" onClick={() => setOpen(false)}>{t("navEmpresas")}</a>
            {formando ? (
              <a href="/area-formando" className="border-t border-[#14263D]/10 pt-5 text-[#A60000]">{t("navFormando")}</a>
            ) : (
              <a href="/area-formando" className="bg-[#A60000] px-5 py-3 text-center text-sm font-bold text-white">{t("navEntrar")}</a>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}

function Moldura({ src, alt, altura }: { src: string | null | undefined; alt: string; altura: string }) {
  return (
    <div className={`${altura} w-full overflow-hidden bg-[#E7EBF0]`}>
      {src ? <img src={src} alt={alt} className="h-full w-full object-cover" /> : null}
    </div>
  );
}

type CartaoVista = {
  posicao: 1 | 2;
  imagem: string | null;
  alt: string;
  selo: string;
  seloCor: HeroBadgeCor;
  seloClasse: string;
  ouro: boolean;
  titulo: string;
  linha: string;
  botao: string;
  tamanho: HeroTamanho;
  animacao: HeroAnimacao | "";
  acao: { tipo: "modal"; curso: Course } | { tipo: "ligacao"; href: string };
};

export function vistaCurso(posicao: 1 | 2, curso: Course, pedido?: Extract<HeroPedido, { modo: "curso" }>): CartaoVista {
  const ouro = posicao === 1;
  return {
    posicao,
    imagem: curso.capa || curso.miniatura,
    alt: curso.title,
    selo: curso.price,
    seloCor: ouro ? "ouro" : "vermelho",
    seloClasse: classeSelo(ouro ? "ouro" : "vermelho"),
    ouro,
    titulo: curso.title,
    linha: descricaoDoCurso(curso.area, pedido?.descricao ?? ""),
    botao: pedido ? botaoHero(pedido, curso.enrollment) : rotuloBotaoInscricao(curso.enrollment),
    tamanho: "medio",
    animacao: "",
    acao: pedido
      ? { tipo: "ligacao", href: destinoDoHero(pedido, curso.id) }
      : { tipo: "modal", curso },
  };
}

export function vistaDePedido(posicao: 1 | 2, pedido: HeroPedido, cursos: Course[]): CartaoVista | "automatico" | null {
  if (pedido.modo === "automatico") return "automatico";
  if (pedido.modo === "curso") {
    const curso = cursos.find(item => item.id === pedido.cursoId);
    return curso ? vistaCurso(posicao, curso, pedido) : null;
  }
  const ouro = pedido.regime === "gold";
  const titulo = tituloRegime(pedido.regime, pedido.titulo);
  return {
    posicao,
    imagem: pedido.imagem || null,
    alt: titulo,
    selo: ouro ? "Gold" : "Financiada",
    seloCor: ouro ? "ouro" : "vermelho",
    seloClasse: classeSelo(ouro ? "ouro" : "vermelho"),
    ouro,
    titulo,
    linha: pedido.descricao,
    botao: botaoHero(pedido),
    tamanho: "medio",
    animacao: "",
    acao: { tipo: "ligacao", href: destinoDoHero(pedido) },
  };
}

function LigacaoHero({ href, className, children }: { href: string; className: string; children: ReactNode }) {
  const externa = ligacaoExterna(href);
  return (
    <a href={href} className={className} {...(externa ? { target: "_blank", rel: "noreferrer" } : {})}>
      {children}
    </a>
  );
}

function medidaDoCartao(tamanho: HeroTamanho, coluna: boolean) {
  const caixa = coluna ? "mx-auto w-full" : "mx-auto lg:mx-0";
  if (tamanho === "pequeno") return { largura: `${caixa} ${coluna ? "max-w-[280px]" : "max-w-[280px] lg:w-[280px]"}`, imagem: "h-20", corpo: "p-4", titulo: "text-lg" };
  if (tamanho === "grande") return { largura: `${caixa} ${coluna ? "max-w-[420px]" : "max-w-[440px] lg:w-[420px]"}`, imagem: "h-36", corpo: "p-6", titulo: "text-2xl" };
  return { largura: `${caixa} ${coluna ? "max-w-[340px]" : "max-w-[340px] lg:w-[340px]"}`, imagem: "h-24", corpo: "p-5", titulo: "text-xl" };
}

export function CartaoFlutuante({ vista, abrir, ancora }: { vista: CartaoVista; abrir: (curso: Course) => void; ancora: "par-direita" | "par-esquerda" | "coluna" }) {
  const esquerda = vista.posicao === 1;
  const medida = medidaDoCartao(vista.tamanho, ancora === "coluna");
  const posicao = ancora === "coluna"
    ? "relative"
    : ancora === "par-esquerda"
      ? (esquerda ? "lg:absolute lg:left-4 lg:top-[8%]" : "lg:absolute lg:right-2 lg:top-[36%]")
      : (esquerda ? "lg:absolute lg:left-1 lg:top-[6%]" : "lg:absolute lg:right-4 lg:top-[34%]");
  const artigo = `${esquerda ? "ena-flutuar" : "ena-flutuar-b"} w-full overflow-hidden rounded-2xl bg-white shadow-[0_18px_50px_rgba(8,18,32,.35)] ${medida.largura} ${posicao}`;
  const botaoCls = `${esquerda
    ? "mt-4 flex w-full items-center justify-center rounded-full bg-[#A60000] px-3 py-2.5 text-center text-xs font-extrabold uppercase tracking-[0.08em] text-white transition-colors hover:bg-[#14263D]"
    : "mt-4 flex w-full items-center justify-center rounded-full bg-[#1C3350] px-4 py-2.5 text-center text-xs font-extrabold uppercase tracking-[0.08em] text-white transition-colors hover:bg-[#FFA900] hover:text-[#14263D]"} ${classeAnimacaoBotao(vista.animacao)}`;
  const acao = vista.acao;
  return (
    <article className={artigo} data-hero-tamanho={vista.tamanho} data-hero-animacao={vista.animacao} data-hero-badge={vista.selo} data-hero-badge-cor={vista.seloCor}>
      <Moldura src={vista.imagem} alt={vista.alt} altura={medida.imagem} />
      <div className={medida.corpo}>
        {vista.selo && <span className={`inline-flex rounded-md px-2.5 py-1 text-[11px] font-extrabold ${vista.seloClasse}`}>{vista.selo}</span>}
        <h2 className={`mt-3 font-serif font-bold leading-tight text-[#1C3350] ${medida.titulo}`}>{vista.titulo}</h2>
        {vista.linha && <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#3E5168]">{vista.linha}</p>}
        {acao.tipo === "modal" ? (
          <button type="button" onClick={() => abrir(acao.curso)} className={botaoCls}>{vista.botao}</button>
        ) : (
          <LigacaoHero href={acao.href} className={botaoCls}>{vista.botao}</LigacaoHero>
        )}
      </div>
    </article>
  );
}

export function FormaHero({
  src, alt, forma, cor, espessura, x, y, tamanho,
}: {
  src: string;
  alt: string;
  forma: string;
  cor: string;
  espessura: number;
  x: number;
  y: number;
  tamanho: number;
}) {
  const estilo = {
    ["--ena-forma-t" as string]: String(tamanho / 100),
    ["--ena-forma-b" as string]: String(espessura),
    ["--ena-forma-c" as string]: cor,
    ["--ena-forma-x" as string]: String(x),
    ["--ena-forma-y" as string]: String(y),
  } as CSSProperties;
  return (
    <div className="ena-hero-forma" data-hero-forma={forma} data-hero-forma-x={x} data-hero-forma-y={y} data-hero-forma-tamanho={tamanho} data-hero-forma-borda={espessura} style={estilo}>
      <div className="ena-hero-forma-miolo">
        {src ? <img src={src} alt={alt} /> : null}
      </div>
    </div>
  );
}

export function OndaHero() {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute bottom-0 left-0 z-10 h-20 w-full sm:h-24" viewBox="0 0 1200 140" preserveAspectRatio="none">
      <path d="M0 140V72C90 36 180 108 320 78C460 48 540 18 700 42C860 66 940 112 1080 82C1140 68 1170 88 1200 74V140H0Z" fill="#A60000" />
      <path d="M0 140V104C140 78 240 124 420 106C600 88 700 126 900 108C1040 96 1120 122 1200 104V140H0Z" fill="#FFA900" />
    </svg>
  );
}
