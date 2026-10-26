// Página do curso em blocos soltos: banner, síntese, dados, objetivos, programa, turmas e cartão de inscrição.
// Cada bloco lê o curso da página (CursoAtualCtx), por isso pode ir para qualquer secção ou coluna.
import { createContext, useContext, useEffect, useState, type ComponentType, type ReactNode } from "react";
import type { ComponentConfig, Slot } from "@puckeditor/core";
import { Icon, OfertaCtx, type Course } from "../SiteLanding";
import { CursoDaRotaCtx } from "./blocosCursoPagina";
import { campoCor, campoCurso, campoNumero, simNao } from "./campos";
import { TOPICOS_CURSO, type ChaveTopicoCurso } from "../../partilhado/topicosCurso";
import { campoAparencia, campoTipografia } from "./camposGrupos";
import { eur } from "../../partilhado/ui/formatos";
import { videoDoCurso } from "../../partilhado/siteServicos";
import { fraseLocais, textoAutomaticoCurso, tituloLocais } from "./textosLocais";
import { TextoEmLinha, TextoFormatado } from "../../partilhado/TextoFormatadoVista";
import { corSegura, estiloBloco, estiloTexto, estiloVazio, juntar, lados, tipoVazia, type Estilo, type Tipografia } from "./estilos";

type Estado = "a-carregar" | "erro" | "pronto";
/** O curso da página e o local escolhido (partilhado: escolha do local, dados, turmas e cartão seguem-no). */
type CursoAtual = { estado: Estado; curso: Course | null; editar: boolean; local: string; setLocal: (l: string) => void };

/** O curso que a página mostra (dado pela raiz da página do curso). */
export const CursoAtualCtx = createContext<CursoAtual | null>(null);

/** No site: o curso da rota. No editor: o escolhido para pré-visualizar (ou o primeiro da oferta). */
export function useCursoAtual(previsualizar: string, editar: boolean) {
  const ctx = useContext(OfertaCtx);
  const rota = useContext(CursoDaRotaCtx);
  const cursos = ctx?.cursos ?? [];
  const estado = (ctx?.estado ?? "a-carregar") as Estado;
  if (editar) return { estado, curso: cursos.find(c => c.id === previsualizar) ?? cursos[0] ?? null, recarregar: ctx?.recarregar };
  const pedido = (rota ?? "").toLowerCase();
  const curso = /^(?:gold|fin)-\d+$/.test(pedido) ? null : cursos.find(c => c.id === pedido) ?? null;
  return { estado, curso, recarregar: ctx?.recarregar };
}

/** Raiz da página do curso: escolhe o curso e trata dos estados (a carregar, erro, curso que não existe). */
export function RaizCurso({ previsualizar, editar, children }: { previsualizar: string; editar: boolean; children: ReactNode }) {
  const { estado, curso, recarregar } = useCursoAtual(previsualizar, editar);
  const [local, setLocal] = useState("");
  // Outro curso: o local volta ao único que houver (ou a nenhum).
  useEffect(() => {
    const ls = curso ? locaisDo(curso) : [];
    setLocal(ls.length === 1 ? ls[0]! : "");
  }, [curso]);
  useEffect(() => { if (!editar && curso) document.title = `${curso.title} | ENA`; }, [curso, editar]);
  if (!editar) {
    if (estado === "a-carregar") return <p className="px-5 py-24 text-center opacity-60">A carregar o curso.</p>;
    if (estado === "erro") {
      return (
        <div className="px-5 py-24 text-center">
          <p className="opacity-70">Não foi possível carregar o curso.</p>
          {recarregar && <button type="button" onClick={recarregar} className="mt-4 bg-[var(--c-primaria)] px-5 py-3 text-sm font-bold text-white">Tentar de novo</button>}
        </div>
      );
    }
    if (!curso) {
      return (
        <div className="px-5 py-24 text-center">
          <h1 className="font-serif text-3xl">Este curso não está na oferta.</h1>
          <a href="/formacao" className="mt-6 inline-flex font-bold text-[var(--c-destaque)] underline">Voltar ao catálogo</a>
        </div>
      );
    }
  }
  return <CursoAtualCtx.Provider value={{ estado, curso, editar, local, setLocal }}>{children}</CursoAtualCtx.Provider>;
}

// ─── Local, preço e variáveis ────────────────────────────────────────────────

export const locaisDo = (c: Course) => [...new Set(c.sessoes.map(s => s.local.trim()).filter(Boolean))];

const euros = (n: number) => eur(n, true);

/**
 * Preço a mostrar: o das datas desse local (o preço de cada data já segue as regras da ficha por local,
 * por horário ou pelos dois). Preços diferentes no local → «A partir de»; sem datas → o preço do curso.
 */
export function precoNoLocal(c: Course, local: string) {
  const precos = c.sessoes.filter(s => !local || s.local === local).map(s => s.preco).filter((n): n is number => n != null);
  if (!precos.length) return c.price;
  const min = Math.min(...precos);
  return precos.every(p => p === min) ? euros(min) : `A partir de ${euros(min)}`;
}

/** Variáveis que os textos do curso podem usar: {{curso}}, {{preco}}, … */
export const VARIAVEIS_CURSO: [string, string][] = [
  ["curso", "Nome do curso"], ["area", "Área"], ["formato", "Formato (presencial, b-learning…)"], ["duracao", "Duração"],
  ["descricao", "Texto completo (síntese)"], ["resumo", "Texto de destaque (catálogo)"], ["inscricao", "Tipo de inscrição"], ["regime", "ENA Gold ou Financiada"],
  ["local", "Local escolhido"], ["locais", "Todos os locais"], ["horarios", "Horários (do local escolhido)"],
  ["inicio", "Próximo início (data · local)"], ["inicio_resumo", "«Vários locais e datas» quando há mais do que um (senão, o próximo início)"],
  ["proxima_data", "Próxima data de início"],
  ["preco", "Preço (segue o local escolhido)"], ["preco_desde", "Preço mais baixo"], ["datas", "Número de datas"],
  ["frase_locais", "Frase antes dos locais (muda com o tipo de curso)"], ["titulo_locais", "Título dos locais (onde, quando e como)"],
];

export function variaveisCurso(c: Course, local: string): Record<string, string> {
  const doLocal = c.sessoes.filter(s => !local || s.local === local);
  const prox = doLocal[0];
  return {
    curso: c.title, area: c.area, formato: c.format, duracao: c.duration, descricao: c.description, resumo: c.resumo,
    inscricao: c.enrollment, regime: c.funding === "Gold" ? "ENA Gold" : "Financiada",
    local, locais: locaisDo(c).join(", "),
    horarios: [...new Set(doLocal.map(s => s.horario).filter(Boolean))].join(", "),
    inicio: prox ? [prox.data, prox.local].filter(Boolean).join(" · ") : c.start,
    inicio_resumo: new Set(doLocal.map(s => s.local)).size > 1 || new Set(doLocal.map(s => s.data)).size > 1
      ? "Vários locais e datas" : prox ? [prox.data, prox.local].filter(Boolean).join(" · ") : c.start,
    proxima_data: prox?.data ?? c.start,
    preco: precoNoLocal(c, local), preco_desde: c.precoDesde != null ? euros(c.precoDesde) : c.price,
    datas: String(doLocal.length),
    frase_locais: fraseLocais(c), titulo_locais: tituloLocais(c),
  };
}

export const preencherVariaveis = (texto: string, vars: Record<string, string>) =>
  texto.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k: string) => (k in vars ? vars[k]! : m));

export const ajudaVariaveis = `Variáveis: ${VARIAVEIS_CURSO.map(([k]) => `{{${k}}}`).join(" ")}`;

/** Campo da raiz: o curso que o editor mostra (no site é sempre o da rota). */
export const campoPrevisualizar = campoCurso("No editor, ver com o curso");

export function useCurso() {
  return useContext(CursoAtualCtx)?.curso ?? null;
}

/** Local escolhido na página (e como o mudar). */
export function useLocalCurso() {
  const ctx = useContext(CursoAtualCtx);
  return { local: ctx?.local ?? "", setLocal: ctx?.setLocal ?? (() => undefined), editar: ctx?.editar ?? false };
}

export type Base = { aparencia: Estilo; puck?: { dragRef?: ((el: Element | null) => void) | null } };

/** Invólucro comum: aparência do bloco, pega de arrastar e aviso quando ainda não há curso. */
export function Caixa({ p, className, children, as: Tag = "div" }: { p: Base; className?: string; children: (c: Course) => ReactNode; as?: "div" | "section" | "aside" }) {
  const curso = useCurso();
  const c = estiloBloco(p.aparencia);
  return (
    <Tag ref={p.puck?.dragRef ?? undefined} className={juntar(className, c.className)} style={c.style}>
      {curso ? children(curso) : <p className="px-5 py-8 text-center text-sm opacity-60">Sem curso para mostrar: escolha um em «Página» › «No editor, ver com o curso».</p>}
    </Tag>
  );
}

export function Titulo({ texto, t, className }: { texto: string; t: Tipografia; className: string }) {
  if (!texto) return null;
  const e = estiloTexto(t);
  return <h2 className={juntar(className, e.className)} style={e.style}>{texto}</h2>;
}

/** Espaço de blocos entre o título de um bloco do curso e o seu conteúdo (ex.: um texto antes dos objetivos). */
export const campoEntreTitulo = { type: "slot" as const, label: "Blocos entre o título e o conteúdo" };

export function ZonaEntreTitulo({ zona }: { zona?: unknown }) {
  // Páginas gravadas antes deste espaço não o têm.
  const Zona = zona as ComponentType<{ className?: string; minEmptyHeight?: number }> | undefined;
  return Zona ? <Zona className="ena-zona mt-4 flex flex-col gap-3" minEmptyHeight={40} /> : null;
}

function duracaoModulo(raw: string) {
  const s = raw.trim().toLowerCase().replace(/\s+/g, "");
  const m = /^(\d+)(?:h|:)?(\d{0,2})(?:min)?$/.exec(s);
  if (!m) return raw.trim();
  const horas = Number(m[1]);
  const minutos = m[2] ? Number(m[2]) : 0;
  return minutos ? `${horas} h ${String(minutos).padStart(2, "0")} min` : `${horas} h`;
}

const localDo = (c: Course) => c.sessoes.find(s => s.local)?.local || c.locais?.[0]?.nome || (c.format === "E-learning" ? "Online" : "A anunciar");

// ─── Banner ──────────────────────────────────────────────────────────────────

type BannerProps = Base & {
  voltar: string; mostrarImagem: boolean; mostrarEtiquetas: boolean; titulo: Tipografia;
  altura: number | null; larguraTotal: boolean; posicaoImagem: "center" | "top" | "bottom";
};

export const CursoBanner: ComponentConfig<BannerProps> = {
  label: "Curso · Banner",
  fields: {
    voltar: { type: "text", label: "Texto «voltar à formação» (vazio = esconder)" },
    mostrarImagem: simNao("Imagem do curso"),
    mostrarEtiquetas: simNao("Etiquetas (formato, área, regime)"),
    altura: campoNumero("Altura do banner em píxeis, ex.: 200 a 600 (vazio = automática). Nunca fica mais baixo do que o título precisa, nem mais alto do que 70% da largura do ecrã", ""),
    larguraTotal: simNao("Ocupar a largura toda do ecrã"),
    posicaoImagem: {
      type: "select", label: "Parte da imagem que fica visível",
      options: [{ label: "Centro", value: "center" }, { label: "Cima", value: "top" }, { label: "Baixo", value: "bottom" }],
    },
    titulo: campoTipografia("Tipografia do título"),
    aparencia: campoAparencia(),
  },
  defaultProps: {
    voltar: "Voltar à formação", mostrarImagem: true, mostrarEtiquetas: true,
    altura: null, larguraTotal: false, posicaoImagem: "center",
    titulo: tipoVazia(), aparencia: estiloVazio({ fundoCor: "var(--c-primaria)" }),
  },
  render: p => (
    <Caixa p={p} as="section" className="text-white">
      {curso => {
        const imagem = p.mostrarImagem ? curso.banner || curso.miniatura : null;
        const t = estiloTexto(p.titulo);
        return (
          <>
            {p.voltar && (
              <div className="mx-auto px-5 pt-10 lg:px-8" style={{ maxWidth: "var(--largura)" }}>
                <a href="/formacao" className="inline-flex items-center gap-2 text-sm font-bold text-white/60 hover:text-white">
                  <span className="rotate-180"><Icon name="arrow" /></span> {p.voltar}
                </a>
              </div>
            )}
            {/* Com altura escolhida: responsiva (no máximo 70% da largura do ecrã) e mínima, cresce se o título precisar
                (nunca o corta). Sem altura: como sempre. */}
            <div className={juntar("relative mx-auto mt-8 w-full overflow-hidden bg-black/20", p.altura ? "flex flex-col justify-end" : "min-h-[280px] max-h-[480px]")}
              style={{ maxWidth: p.larguraTotal ? undefined : "var(--largura)", ...(p.altura ? { minHeight: `min(${p.altura}px, 70vw)` } : {}) }}>
              {imagem && <img src={imagem} alt="" className={juntar("w-full object-cover", p.altura ? "absolute inset-0 h-full" : "max-h-[480px]")}
                style={{ objectPosition: p.posicaoImagem ?? "center" }} />}
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--c-primaria)] via-[var(--c-primaria)]/35 to-transparent" />
              <div className={juntar("px-5 pb-8 lg:px-8", p.altura ? "relative pt-8" : "absolute inset-x-0 bottom-0")}>
                {p.mostrarEtiquetas && (
                  <div className="flex flex-wrap gap-3">
                    {curso.format && <span className="bg-[var(--c-destaque)] px-3 py-1.5 text-xs font-extrabold uppercase tracking-wider">{curso.format}</span>}
                    {curso.area && <span className="border border-white/25 px-3 py-1.5 text-xs font-bold uppercase tracking-wider">{curso.area}</span>}
                    <span className="bg-[var(--c-acento)] px-3 py-1.5 text-xs font-extrabold uppercase tracking-wider text-[var(--c-primaria)]">{curso.funding === "Gold" ? "ENA Gold" : "Financiada"}</span>
                  </div>
                )}
                <h1 className={juntar("mt-4 max-w-4xl font-serif text-4xl leading-[1.05] tracking-[-0.04em] sm:text-6xl", t.className)} style={t.style}>{curso.title}</h1>
              </div>
            </div>
          </>
        );
      }}
    </Caixa>
  ),
};

// ─── Síntese ─────────────────────────────────────────────────────────────────

type SinteseProps = Base & { etiqueta: string; tEtiqueta: Tipografia; texto: Tipografia };

export const CursoSintese: ComponentConfig<SinteseProps> = {
  label: "Curso · Enquadramento",
  fields: {
    etiqueta: { type: "text", label: "Etiqueta (vazio = esconder)" },
    tEtiqueta: campoTipografia("Tipografia da etiqueta"),
    texto: campoTipografia("Tipografia do texto"),
    aparencia: campoAparencia(),
  },
  defaultProps: { etiqueta: "Enquadramento", tEtiqueta: tipoVazia(), texto: tipoVazia(), aparencia: estiloVazio() },
  render: p => (
    <Caixa p={p}>
      {curso => {
        const e = estiloTexto(p.tEtiqueta);
        const t = estiloTexto(p.texto);
        // A etiqueta antiga «Síntese» (páginas gravadas antes) passa a «Enquadramento».
        const titulo = /^s[ií]ntese$/i.test(p.etiqueta.trim()) ? "Enquadramento" : p.etiqueta;
        return (
          <CartaoCurso titulo={titulo} t={e}>
            <TextoFormatado texto={textoAutomaticoCurso(curso.description, curso)} className={juntar(TEXTO_CARTAO, t.className)} style={t.style} nivel={4} />
          </CartaoCurso>
        );
      }}
    </Caixa>
  ),
};

// ─── Vídeo de apresentação ───────────────────────────────────────────────────

type VideoCursoProps = Base & {
  titulo: string; tTitulo: Tipografia;
  /** Largura em % da coluna (20 a 100) e máximo em píxeis (vazio = sem máximo). */
  largura: number | null; larguraMax: number | null;
  alinhar: "esquerda" | "centro" | "direita";
  proporcao: "16/9" | "4/3" | "1/1" | "9/16";
  raio: number | null; sombra: boolean;
};

/**
 * Leitor do vídeo (YouTube, Vimeo ou .mp4). O site responde com «Referrer-Policy: no-referrer»; o YouTube recusa
 * leitores sem a origem da página (erro 153): este pedido, e só este, leva a origem.
 */
export function LeitorVideo({ v, titulo }: { v: { tipo: "iframe" | "video"; src: string }; titulo: string }) {
  return v.tipo === "iframe"
    ? <iframe src={v.src} title={titulo} className="h-full w-full" allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
    : <video src={v.src} controls preload="metadata" className="h-full w-full" aria-label={titulo} />;
}

/** O vídeo de apresentação da ficha do curso (Identidade › Vídeo): YouTube, Vimeo ou .mp4. Sem vídeo, não aparece. */
export const CursoVideo: ComponentConfig<VideoCursoProps> = {
  label: "Curso · Vídeo de apresentação",
  fields: {
    titulo: { type: "text", label: "Título (vazio = sem título)" },
    tTitulo: campoTipografia("Tipografia do título"),
    largura: campoNumero("Largura (% da coluna, 20 a 100)"),
    larguraMax: campoNumero("Largura máxima (píxeis, vazio = sem máximo)"),
    alinhar: {
      type: "select", label: "Posição",
      options: [{ label: "À esquerda", value: "esquerda" }, { label: "Ao centro", value: "centro" }, { label: "À direita", value: "direita" }],
    },
    proporcao: {
      type: "select", label: "Formato",
      options: [{ label: "Panorâmico (16:9)", value: "16/9" }, { label: "Clássico (4:3)", value: "4/3" }, { label: "Quadrado (1:1)", value: "1/1" }, { label: "Vertical (9:16)", value: "9/16" }],
    },
    raio: campoNumero("Cantos arredondados"),
    sombra: simNao("Sombra"),
    aparencia: campoAparencia(),
  },
  defaultProps: {
    titulo: "", tTitulo: tipoVazia(), largura: 100, larguraMax: null, alinhar: "centro", proporcao: "16/9", raio: 8, sombra: true,
    aparencia: estiloVazio({ margem: lados(32, 0, 0, 0) }),
  },
  render: p => <VideoCurso {...p} />,
};

function VideoCurso(p: VideoCursoProps) {
  const { editar } = useLocalCurso();
  return (
    <Caixa p={p}>
      {curso => {
        const v = videoDoCurso(curso.video);
        // No editor fica um lugar marcado, para se poder escolher e mudar de sítio mesmo sem vídeo neste curso.
        if (!v) return editar ? (
          <div className="grid place-items-center border-2 border-dashed border-black/15 bg-black/[0.03] p-6 text-center text-sm opacity-70" style={{ aspectRatio: "16/9" }}>
            Vídeo de apresentação: este curso não tem vídeo (Ficha do curso › Identidade › Vídeo). No site, sem vídeo, este bloco não aparece.
          </div>
        ) : null;
        const t = estiloTexto(p.tTitulo);
        const largura = Math.min(100, Math.max(20, p.largura ?? 100));
        const margem = p.alinhar === "esquerda" ? "0 auto 0 0" : p.alinhar === "direita" ? "0 0 0 auto" : "0 auto";
        return (
          <div style={{ width: `${largura}%`, maxWidth: p.larguraMax ? `${p.larguraMax}px` : undefined, margin: margem }}>
            {p.titulo && <h3 className={juntar("mb-4 font-serif text-xl font-bold text-[var(--c-primaria)]", t.className)} style={t.style}>{p.titulo}</h3>}
            <div className={juntar("w-full overflow-hidden bg-black", p.sombra !== false && "shadow-[0_8px_30px_rgba(20,38,61,.18)]")}
              style={{ aspectRatio: p.proporcao || "16/9", borderRadius: p.raio ? `${p.raio}px` : undefined }}>
              <LeitorVideo v={v} titulo={`Vídeo de apresentação: ${curso.title}`} />
            </div>
          </div>
        );
      }}
    </Caixa>
  );
}

// ─── Dados (duração, início, local, investimento) ────────────────────────────

type DadosProps = Base & { duracao: boolean; inicio: boolean; local: boolean; investimento: boolean };

export const CursoDados: ComponentConfig<DadosProps> = {
  label: "Curso · Dados",
  fields: {
    duracao: simNao("Duração"), inicio: simNao("Início"), local: simNao("Local"), investimento: simNao("Investimento"),
    aparencia: campoAparencia(),
  },
  defaultProps: { duracao: true, inicio: true, local: true, investimento: true, aparencia: estiloVazio() },
  render: p => <DadosCurso {...p} />,
};

/** Com um local escolhido, o início, o local e o investimento são os desse local. */
function DadosCurso(p: DadosProps) {
  const { local } = useLocalCurso();
  return (
    <Caixa p={p}>
      {curso => {
        const v = variaveisCurso(curso, local);
        const itens = ([
          [p.duracao, curso.duration, "Duração"], [p.inicio, local ? v.inicio : curso.start, "Início"],
          [p.local, local || localDo(curso), "Local"], [p.investimento, precoNoLocal(curso, local), "Investimento"],
        ] as const).filter(([x]) => x);
        return (
          <div className="grid grid-cols-2 gap-px bg-black/10 sm:grid-cols-4">
            {itens.map(([, valor, rotulo]) => (
              <div key={rotulo} className="border-t-4 border-[var(--c-acento)] bg-white p-4">
                <span className="block text-xs uppercase tracking-wider opacity-45">{rotulo}</span>
                <strong className="mt-2 block text-sm">{valor}</strong>
              </div>
            ))}
          </div>
        );
      }}
    </Caixa>
  );
}

// ─── Objetivos, programa e turmas ────────────────────────────────────────────

type ListaProps = Base & { titulo: string; tTitulo: Tipografia; entreTitulo: Slot };
const camposLista = (padrao: string) => ({
  fields: {
    titulo: { type: "text" as const, label: "Título (vazio = esconder)" }, tTitulo: campoTipografia("Tipografia do título"),
    entreTitulo: campoEntreTitulo, aparencia: campoAparencia(),
  },
  defaultProps: { titulo: padrao, tTitulo: tipoVazia(), entreTitulo: [], aparencia: estiloVazio() },
});

export const CursoObjetivos: ComponentConfig<ListaProps> = {
  label: "Curso · Objetivos",
  ...camposLista("Objetivos"),
  render: p => (
    <Caixa p={p}>
      {curso => curso.objetivos.length === 0 ? null : (
        <CartaoCurso titulo={p.titulo} t={estiloTexto(p.tTitulo)} zona={p.entreTitulo}>
          <ul className={juntar("mt-4 space-y-2", TEXTO_CARTAO)}>
            {curso.objetivos.map(o => <li key={o} className="flex gap-3"><Icon name="check" className="mt-1.5 h-4 w-4 shrink-0 text-[var(--c-destaque)]" /><span><TextoEmLinha texto={o} /></span></li>)}
          </ul>
        </CartaoCurso>
      )}
    </Caixa>
  ),
};

export const CursoPrograma: ComponentConfig<ListaProps & { espacoLinhas: number | null }> = {
  label: "Curso · Programa",
  fields: { ...camposLista("Programa").fields, espacoLinhas: campoNumero("Espaço entre as linhas dos módulos") },
  defaultProps: { ...camposLista("Programa").defaultProps, espacoLinhas: 12 },
  render: p => (
    <Caixa p={p}>
      {curso => curso.programa.length === 0 ? null : (
        <CartaoCurso titulo={p.titulo} t={estiloTexto(p.tTitulo)} zona={p.entreTitulo}>
          <div className="mt-2 divide-y divide-black/10 text-sm">
            {curso.programa.map((m, i) => (
              <div key={`${m.titulo}-${i}`} className="flex items-baseline gap-4" style={{ paddingBlock: `${p.espacoLinhas ?? 12}px` }}>
                <span className="w-24 shrink-0 text-sm font-extrabold text-[var(--c-destaque)]">{curso.organizacao === "livre" ? String(i + 1).padStart(2, "0") : `Módulo ${i + 1}`}</span>
                <strong>{m.titulo}</strong>
                {m.horas && <span className="ml-auto shrink-0 text-sm opacity-55">{duracaoModulo(m.horas)}</span>}
              </div>
            ))}
          </div>
        </CartaoCurso>
      )}
    </Caixa>
  ),
};

type FuncionamentoProps = Base & {
  /** Títulos dos cartões (vazio = o nome do tópico). */
  titulos: Partial<Record<ChaveTopicoCurso, string>>;
  tTitulo: Tipografia; texto: Tipografia; corLinha: string; colunas: number | null;
};

/** Classes do texto dentro dos cartões da página do curso (iguais em todos). */
const TEXTO_CARTAO = "text-sm leading-7 opacity-80";

/**
 * Cartão comum da página do curso (enquadramento, objetivos, programa e os 4 tópicos): fundo branco, título com a
 * linha de destaque por baixo e o texto com o mesmo tamanho em todos.
 */
function CartaoCurso({ titulo, t, corLinha, zona, children }: {
  titulo: string; t: ReturnType<typeof estiloTexto>; corLinha?: string; zona?: unknown; children: ReactNode;
}) {
  return (
    <section className="rounded-lg bg-white p-6 shadow-[0_2px_14px_rgba(20,38,61,.08)] ring-1 ring-black/5">
      {titulo && (
        <h3 className={juntar("inline-block border-b-2 pb-2 font-serif text-xl font-bold text-[var(--c-primaria)]", t.className)}
          style={{ ...t.style, borderColor: corSegura(corLinha) ?? "var(--c-acento)" }}>{titulo}</h3>
      )}
      {zona ? <ZonaEntreTitulo zona={zona} /> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Metodologias, certificação/avaliação, destinatários e requisitos (ficha do curso › Conteúdo do site), em cartões. */
export const CursoFuncionamento: ComponentConfig<FuncionamentoProps> = {
  label: "Curso · Metodologias, certificação, destinatários e requisitos",
  fields: {
    titulos: {
      type: "object", label: "Títulos dos cartões (vazio = o nome do tópico)",
      objectFields: Object.fromEntries(TOPICOS_CURSO.map(t => [t.chave, { type: "text" as const, label: t.rotulo }])) as never,
    },
    tTitulo: campoTipografia("Tipografia dos títulos"),
    texto: campoTipografia("Tipografia do texto"),
    corLinha: campoCor("Cor da linha por baixo do título"),
    colunas: campoNumero("Colunas no computador (1 ou 2)"),
    aparencia: campoAparencia(),
  },
  defaultProps: { titulos: {}, tTitulo: tipoVazia(), texto: tipoVazia(), corLinha: "var(--c-acento)", colunas: 1, aparencia: estiloVazio() },
  render: p => (
    <Caixa p={p}>
      {curso => {
        const topicos = TOPICOS_CURSO.filter(t => curso.topicos?.[t.chave]?.trim());
        if (!topicos.length) return null;
        const tt = estiloTexto(p.tTitulo);
        const t = estiloTexto(p.texto);
        return (
          <div className={juntar("grid gap-5", p.colunas === 2 && "md:grid-cols-2")}>
            {topicos.map(x => (
              <CartaoCurso key={x.chave} titulo={p.titulos?.[x.chave]?.trim() || x.rotulo} t={tt} corLinha={p.corLinha}>
                <TextoFormatado texto={curso.topicos[x.chave]} className={juntar(TEXTO_CARTAO, t.className)} style={t.style} nivel={4} />
              </CartaoCurso>
            ))}
          </div>
        );
      }}
    </Caixa>
  ),
};

type TurmasProps = ListaProps & { soLocal: boolean; mostrarPreco: boolean };

export const CursoTurmas: ComponentConfig<TurmasProps> = {
  label: "Curso · Próximas turmas",
  fields: {
    ...camposLista("Próximas turmas").fields,
    soLocal: simNao("Só as do local escolhido"),
    mostrarPreco: simNao("Preço de cada turma"),
  },
  defaultProps: { ...camposLista("Próximas turmas").defaultProps, soLocal: true, mostrarPreco: true },
  render: p => <TurmasCurso {...p} />,
};

// No render, o espaço de blocos já chega como componente (não como lista).
function TurmasCurso(p: Omit<TurmasProps, "entreTitulo"> & { entreTitulo?: unknown }) {
  const { local } = useLocalCurso();
  return (
    <Caixa p={p}>
      {curso => {
        const lista = curso.sessoes.filter(s => !p.soLocal || !local || s.local === local);
        return lista.length === 0 ? null : (
          <>
            <Titulo texto={p.titulo} t={p.tTitulo} className="border-b border-black/15 pb-4 font-serif text-3xl" />
            <ZonaEntreTitulo zona={p.entreTitulo} />
            <div className="divide-y divide-black/15">
              {lista.map(s => (
                <div key={`${s.data}-${s.local}-${s.horario}`} className="flex flex-wrap items-center justify-between gap-3 py-5">
                  <strong>{s.data}</strong>
                  <span className="text-sm opacity-65">
                    {[s.local, s.horario, p.mostrarPreco && s.preco != null ? euros(s.preco) : ""].filter(Boolean).join(" · ")}
                  </span>
                </div>
              ))}
            </div>
          </>
        );
      }}
    </Caixa>
  );
}


