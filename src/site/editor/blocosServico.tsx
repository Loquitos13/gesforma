// Página de cada serviço (/empresas/<serviço>): um só modelo no editor, preenchido com os dados de cada serviço
// (título, texto, imagens, vídeo e logótipos), que se escrevem no backoffice em Gestão › Empresas / Business.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { ComponentConfig } from "@puckeditor/core";
import { slugServico, videoServico, type ServicoSite } from "../../partilhado/siteServicos";
import { Icon } from "../SiteLanding";
import { Carrossel1a1, Cartoes } from "./carrossel";
import { CursoDaRotaCtx } from "./blocosCursoPagina";
import { Formulario } from "./blocosFormulario";
import { campoNumero, simNao } from "./campos";
import { campoAparencia, campoTipografia } from "./camposGrupos";
import { Titulo, type Base } from "./blocosCurso";
import { estiloBloco, estiloTexto, estiloVazio, juntar, lados, ligacaoSegura, tipoVazia, type Tipografia } from "./estilos";

type Estado = "a-carregar" | "pronto";
type ServicoAtual = { estado: Estado; servico: ServicoSite | null; servicos: ServicoSite[] };
const ServicoAtualCtx = createContext<ServicoAtual>({ estado: "a-carregar", servico: null, servicos: [] });

let pedido: Promise<ServicoSite[]> | null = null;
/** Os serviços ativos, pela ordem do backoffice (uma leitura por carregamento da página). */
function lerServicos() {
  pedido ??= fetch("/api/v1/public/servicos", { cache: "no-store" })
    .then(r => (r.ok ? r.json() as Promise<{ servicos: ServicoSite[] }> : { servicos: [] }))
    .then(r => r.servicos ?? [])
    .catch(() => []);
  return pedido;
}

export function useServicos() {
  const [servicos, setServicos] = useState<ServicoSite[] | null>(null);
  useEffect(() => {
    let vivo = true;
    void lerServicos().then(s => { if (vivo) setServicos(s); });
    return () => { vivo = false; };
  }, []);
  return servicos;
}

/** Raiz da página: escolhe o serviço da rota (no editor, o da pré-visualização) e trata do que não existe. */
export function RaizServico({ previsualizar, editar, children }: { previsualizar: string; editar: boolean; children: ReactNode }) {
  const servicos = useServicos();
  const rota = (useContext(CursoDaRotaCtx) ?? "").toLowerCase();
  const pedidoSlug = editar ? previsualizar : rota;
  const servico = servicos ? servicos.find(s => slugServico(s) === pedidoSlug) ?? (editar ? servicos[0] ?? null : null) : null;
  useEffect(() => { if (!editar && servico) document.title = `${servico.titulo} | ENA`; }, [servico, editar]);
  if (!editar && servicos && !servico) {
    return (
      <div className="px-5 py-24 text-center">
        <h1 className="font-serif text-3xl">Este serviço não existe.</h1>
        <a href="/empresas" className="mt-6 inline-flex font-bold text-[var(--c-destaque)] underline">Ver os serviços para empresas</a>
      </div>
    );
  }
  return <ServicoAtualCtx.Provider value={{ estado: servicos ? "pronto" : "a-carregar", servico, servicos: servicos ?? [] }}>{children}</ServicoAtualCtx.Provider>;
}

/** No editor: com que serviço se vê o modelo. */
export const campoPrevisualizarServico = {
  type: "custom" as const,
  label: "No editor, ver com o serviço",
  render: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => <EscolherServico value={value} onChange={onChange} vazio="O primeiro serviço" />,
};

/** Escolher um dos serviços registados (ex.: os textos de um cartão no bloco «Serviços»). */
export const campoServico = (label: string) => ({
  type: "custom" as const,
  label,
  render: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => <EscolherServico value={value} onChange={onChange} vazio="Escolha o serviço" />,
});

function EscolherServico({ value, onChange, vazio }: { value: string; onChange: (v: string) => void; vazio: string }) {
  const servicos = useServicos() ?? [];
  return (
    <select value={value ?? ""} onChange={e => onChange(e.target.value)} className="w-full rounded border border-[#d5dbe3] bg-white px-2 py-1.5 text-sm">
      <option value="">{vazio}</option>
      {servicos.map(s => <option key={slugServico(s)} value={slugServico(s)}>{s.titulo}</option>)}
    </select>
  );
}

/** Invólucro dos blocos do serviço: aparência, pega de arrastar e nada quando o serviço não tem o conteúdo. */
/** A página-mãe do serviço (ex.: a Certifica para a Certificação Inicial), se estiver ativa. */
function useServicoPai(s: ServicoSite) {
  const { servicos } = useContext(ServicoAtualCtx);
  const proprio = slugServico(s);
  return s.pai && s.pai !== proprio ? servicos.find(x => slugServico(x) === s.pai) ?? null : null;
}

function CaixaServico({ p, tem, vazio, children }: { p: Base; tem: (s: ServicoSite) => boolean; vazio: string; children: (s: ServicoSite) => ReactNode }) {
  const { servico, estado } = useContext(ServicoAtualCtx);
  const editar = Boolean((p.puck as { isEditing?: boolean } | undefined)?.isEditing);
  const c = estiloBloco(p.aparencia);
  if (estado === "a-carregar") return <div ref={p.puck?.dragRef ?? undefined} className="min-h-24" aria-busy="true" />;
  if (!servico || !tem(servico)) {
    // No site some; no editor fica um aviso para o bloco não se perder.
    return editar ? <p ref={p.puck?.dragRef ?? undefined} className="border border-dashed border-black/20 px-5 py-6 text-center text-sm opacity-60">{vazio}</p> : null;
  }
  return <div ref={p.puck?.dragRef ?? undefined} className={c.className} style={c.style}>{children(servico)}</div>;
}

const ONDE = "Escreve-se no backoffice em Gestão › Empresas / Business.";

// ─── Banner ─────────────────────────────────────────────────────────────────

type BannerProps = Base & { etiqueta: string; voltar: string; tTitulo: Tipografia; tTexto: Tipografia; botao: boolean; alturaMin?: number | null };

export const ServicoBanner: ComponentConfig<BannerProps> = {
  label: "Serviço · Banner",
  fields: {
    etiqueta: { type: "text", label: "Etiqueta por cima do título (vazio = esconder; a etiqueta do serviço tem prioridade)" },
    voltar: { type: "text", label: "Ligação para voltar a Empresas (vazio = esconder; num serviço dentro de outro leva à página dele)" },
    botao: simNao("Botão do serviço (ex.: «Pedir proposta»)"),
    alturaMin: campoNumero("Altura mínima (píxeis)") as never,
    tTitulo: campoTipografia("Tipografia do título"),
    tTexto: campoTipografia("Tipografia do texto"),
    aparencia: campoAparencia(),
  },
  defaultProps: {
    etiqueta: "Serviços para empresas", voltar: "Voltar a Empresas", botao: true, alturaMin: 320, tTitulo: tipoVazia(), tTexto: tipoVazia(),
    aparencia: estiloVazio({ fundoCor: "var(--c-primaria)" }),
  },
  render: p => (
    <CaixaServico p={p} tem={s => Boolean(s.titulo)} vazio={`O serviço não tem título. ${ONDE}`}>
      {s => <BannerServico p={p} s={s} />}
    </CaixaServico>
  ),
};

function BannerServico({ p, s }: { p: BannerProps; s: ServicoSite }) {
  const [t, x] = [estiloTexto(p.tTitulo), estiloTexto(p.tTexto)];
  // Serviço dentro de outro (ex.: Alargamento, dentro da Certifica): o «Voltar» leva à página-mãe.
  const mae = useServicoPai(s);
  const voltar = mae ? { href: `/empresas/${slugServico(mae)}`, texto: `Voltar a ${mae.titulo}` } : { href: "/empresas", texto: p.voltar };
  const href = ligacaoSegura(s.ligacao);
  const etiqueta = s.etiqueta?.trim() || p.etiqueta;
  return (
    // A imagem do topo (capa) fica à direita, da altura toda e até à beira do ecrã; o texto alinha com o resto da página.
    // A margem esquerda é a das secções da página (32 px + o que sobra da largura do conteúdo), para o título alinhar com o resto.
    <div className={juntar("grid text-white", s.capa && "lg:grid-cols-2")}
      style={{ minHeight: p.alturaMin ? `${p.alturaMin}px` : undefined, paddingLeft: "max(20px, calc(32px + max(0px, (100% - 64px - var(--largura)) / 2)))" }}>
      <div className="flex flex-col justify-center gap-4 py-12 pr-5 lg:pr-12">
        {p.voltar && <a href={voltar.href} className="inline-flex items-center gap-2 text-sm font-bold text-white/70 hover:text-white"><span aria-hidden="true">←</span>{voltar.texto}</a>}
        {etiqueta && <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--c-acento)]">{etiqueta}</p>}
        <h1 className={juntar("font-serif text-4xl font-bold leading-tight sm:text-5xl", t.className)} style={t.style}>{s.titulo}</h1>
        {s.texto && <p className={juntar("max-w-2xl whitespace-pre-line text-lg leading-8 text-white/75", x.className)} style={x.style}>{s.texto.split("\n")[0]}</p>}
        {p.botao && s.rotulo && href && (
          <a href={href} className="mt-2 inline-flex w-fit items-center gap-3 bg-[var(--c-acento)] px-6 py-3 text-sm font-bold text-[var(--c-primaria)] hover:brightness-95">
            {s.rotulo} <Icon name="arrow" className="h-4 w-4" />
          </a>
        )}
      </div>
      {s.capa && <img src={s.capa} alt="" className="h-full min-h-64 w-full object-cover" />}
    </div>
  );
}

// ─── Texto completo e pontos ────────────────────────────────────────────────

type DetalheProps = Base & { titulo: string; tTitulo: Tipografia; tTexto: Tipografia; pontos: boolean };

export const ServicoDetalhe: ComponentConfig<DetalheProps> = {
  label: "Serviço · Texto e pontos",
  fields: {
    titulo: { type: "text", label: "Título (vazio = esconder; o título do texto do serviço tem prioridade)" },
    pontos: simNao("Caixa com os pontos do serviço, ao lado do texto"),
    tTitulo: campoTipografia("Tipografia do título"),
    tTexto: campoTipografia("Tipografia do texto"),
    aparencia: campoAparencia(),
  },
  defaultProps: { titulo: "Sobre o serviço", pontos: true, tTitulo: tipoVazia(), tTexto: tipoVazia(), aparencia: estiloVazio() },
  render: p => (
    <CaixaServico p={p} tem={s => Boolean((s.detalhe || s.texto || s.pontos)?.trim())} vazio={`O serviço não tem texto. ${ONDE}`}>
      {s => {
        const x = estiloTexto(p.tTexto);
        const pontos = p.pontos ? (s.pontos ?? "").split("\n").map(l => l.trim()).filter(Boolean) : [];
        return (
          <div className={juntar("grid gap-10", pontos.length > 0 && "lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]")}>
            <div>
              <Titulo texto={s.tituloDetalhe?.trim() || p.titulo} t={p.tTitulo} className="font-serif text-3xl font-bold" />
              <p className={juntar("mt-4 whitespace-pre-line text-lg leading-8 opacity-75", x.className)} style={x.style}>{s.detalhe?.trim() || s.texto}</p>
            </div>
            {pontos.length > 0 && (
              <ul className="flex flex-col gap-3 self-start border-t-[3px] border-[var(--c-acento)] bg-white p-6">
                {pontos.map(l => <li key={l} className="flex gap-2"><span className="text-[var(--c-destaque)]"><Icon name="check" className="mt-1 h-4 w-4 shrink-0" /></span>{l}</li>)}
              </ul>
            )}
          </div>
        );
      }}
    </CaixaServico>
  ),
};

// ─── Cartões do serviço (ex.: vantagens, passos) ────────────────────────────

type CartoesProps = Base & { titulo: string; tTitulo: Tipografia; colunas: number | null; textoLigacao?: string };

function colunasCartoes(s: ServicoSite, colunas: number | null) {
  const cartoes = (s.cartoes ?? []).filter(c => c.titulo?.trim());
  const n = colunas || 4;
  return cartoes.some(c => ligacaoSegura(c.ligacao)) ? Math.max(1, Math.min(n, cartoes.length)) : n;
}

export const ServicoCartoes: ComponentConfig<CartoesProps> = {
  label: "Serviço · Cartões",
  fields: {
    titulo: { type: "text", label: "Título (vazio = esconder)" },
    colunas: campoNumero("Colunas (computador)") as never,
    textoLigacao: { type: "text", label: "Texto da ligação dos cartões com ligação (quando o cartão não tem o seu)" },
    tTitulo: campoTipografia("Tipografia do título"),
    aparencia: campoAparencia(),
  },
  defaultProps: { titulo: "", colunas: 4, textoLigacao: "Saber mais", tTitulo: tipoVazia(), aparencia: estiloVazio() },
  render: p => (
    <CaixaServico p={p} tem={s => (s.cartoes ?? []).some(c => c.titulo?.trim())} vazio={`O serviço não tem cartões. ${ONDE}`}>
      {s => (
        <>
          <Titulo texto={p.titulo} t={p.tTitulo} className="mb-6 font-serif text-3xl font-bold" />
          {/* Cartões com ligação (ex.: os dois da Certifica) ocupam a largura toda, sem colunas vazias. */}
          <div className="ena-grelha" style={{ gap: "16px", ["--cols" as string]: String(colunasCartoes(s, p.colunas)), ["--cols-tab" as string]: "2", ["--cols-tel" as string]: "1" }}>
            {(s.cartoes ?? []).filter(c => c.titulo?.trim()).map((c, i) => {
              // Cartão com ligação (ex.: na Certifica, um por serviço): título e botão levam à página.
              const href = ligacaoSegura(c.ligacao);
              const rotulo = c.rotulo?.trim() || p.textoLigacao || "Saber mais";
              return (
                <article key={i} className="flex flex-col gap-2 border-t-[3px] border-[var(--c-acento)] bg-white p-6">
                  <h3 className="text-lg font-bold text-[var(--c-primaria)]">{href ? <a href={href} className="hover:underline">{c.titulo}</a> : c.titulo}</h3>
                  {c.texto && <p className="whitespace-pre-line text-[15px] leading-6 opacity-75">{c.texto}</p>}
                  {href && (
                    <a href={href} className="mt-auto inline-flex w-fit items-center gap-2 pt-4 text-sm font-extrabold uppercase tracking-[0.06em] text-[var(--c-destaque)] hover:underline">
                      {rotulo}<span className="sr-only">: {c.titulo}</span> <Icon name="arrow" className="h-4 w-4" />
                    </a>
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}
    </CaixaServico>
  ),
};

// ─── Faixa final (pedido de proposta) ───────────────────────────────────────

type ChamadaProps = Base & { etiqueta: string; titulo: string; texto: string; formulario?: boolean; textoBotao?: string; mensagemOk?: string };

export const ServicoChamada: ComponentConfig<ChamadaProps> = {
  label: "Serviço · Faixa final",
  fields: {
    etiqueta: { type: "text", label: "Etiqueta (vazio = esconder)" },
    titulo: { type: "text", label: "Título (o da faixa final do serviço tem prioridade)" },
    texto: { type: "textarea", label: "Texto (o da faixa final do serviço tem prioridade)" },
    formulario: simNao("Formulário de pedido de proposta (com este serviço já escolhido)") as never,
    textoBotao: { type: "text", label: "Formulário: texto do botão" },
    mensagemOk: { type: "textarea", label: "Formulário: mensagem depois de enviar" },
    aparencia: campoAparencia(),
  },
  defaultProps: {
    etiqueta: "Fale connosco", titulo: "Fale connosco sobre a sua equipa.", texto: "Conte-nos o que precisa. Respondemos com uma proposta à medida.",
    formulario: true, textoBotao: "Enviar pedido", mensagemOk: "Obrigado! Recebemos o seu pedido e vamos responder com uma proposta.",
    aparencia: estiloVazio({ fundoCor: "var(--c-primaria)" }),
  },
  render: p => (
    <CaixaServico p={p} tem={() => true} vazio="">
      {s => {
        const href = ligacaoSegura(s.ligacao);
        // Páginas gravadas antes desta opção não a têm: o formulário aparece.
        const comFormulario = p.formulario !== false;
        return (
          // «#proposta»: o botão do topo pode levar aqui.
          <div id="proposta" className="scroll-mt-24 px-5 py-14 text-white lg:px-8">
          <div className={juntar("mx-auto grid items-start gap-10", comFormulario && "lg:grid-cols-2")} style={{ maxWidth: "var(--largura)" }}>
            <div className="flex flex-col items-start gap-4">
              {p.etiqueta && <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--c-acento)]">{p.etiqueta}</p>}
              <h2 className="font-serif text-3xl font-bold">{s.ctaTitulo?.trim() || p.titulo}</h2>
              <p className="max-w-2xl whitespace-pre-line text-lg leading-8 text-white/75">{s.ctaTexto?.trim() || p.texto}</p>
              {!comFormulario && s.rotulo && href && (
                <a href={href} className="mt-2 inline-flex items-center gap-3 bg-[var(--c-acento)] px-6 py-3 text-sm font-bold text-[var(--c-primaria)] hover:brightness-95">
                  {s.rotulo} <Icon name="arrow" className="h-4 w-4" />
                </a>
              )}
            </div>
            {comFormulario && (
              <Formulario servicoInicial={s.titulo} servicos textoBotao={p.textoBotao || "Enviar pedido"}
                mensagemOk={p.mensagemOk || "Obrigado! Recebemos o seu pedido e vamos responder com uma proposta."}
                corBotao="var(--c-destaque)" corTextoBotao="#ffffff" puck={p.puck as never}
                aparencia={estiloVazio({ fundoCor: "#ffffff", preenchimento: lados(24) })} />
            )}
          </div>
          </div>
        );
      }}
    </CaixaServico>
  ),
};

// ─── Imagens ────────────────────────────────────────────────────────────────

type GaleriaProps = Base & { titulo: string; tTitulo: Tipografia; segundos: number | null; altura: number | null };

export const ServicoGaleria: ComponentConfig<GaleriaProps> = {
  label: "Serviço · Imagens (carrossel)",
  fields: {
    titulo: { type: "text", label: "Título (vazio = esconder)" },
    altura: campoNumero("Altura das imagens (píxeis)"),
    segundos: campoNumero("Passar sozinho a cada (segundos, 0 = não)"),
    tTitulo: campoTipografia("Tipografia do título"),
    aparencia: campoAparencia(),
  },
  defaultProps: { titulo: "", altura: 420, segundos: 6, tTitulo: tipoVazia(), aparencia: estiloVazio() },
  render: p => (
    <CaixaServico p={p} tem={s => (s.imagens ?? []).some(i => i.imagem)} vazio={`O serviço não tem imagens. ${ONDE}`}>
      {s => {
        const imagens = (s.imagens ?? []).filter(i => i.imagem);
        const figura = (i: (typeof imagens)[number]) => (
          <figure>
            <img src={i.imagem} alt={i.legenda} className="w-full object-cover" style={{ height: `min(${p.altura || 420}px, 70vw)` }} />
            {i.legenda && <figcaption className="mt-2 text-sm opacity-60">{i.legenda}</figcaption>}
          </figure>
        );
        return (
          <>
            <Titulo texto={p.titulo} t={p.tTitulo} className="mb-6 font-serif text-3xl font-bold" />
            {imagens.length === 1 ? figura(imagens[0]!) : (
              <Carrossel1a1 itens={imagens.map(i => figura(i))} rotulo={p.titulo || `Imagens: ${s.titulo}`} nomeItem="imagem"
                segundos={p.segundos ?? 0} setas transicao="deslizar" largura={null} />
            )}
          </>
        );
      }}
    </CaixaServico>
  ),
};

// ─── Vídeo ──────────────────────────────────────────────────────────────────

type VideoProps = Base & { titulo: string; tTitulo: Tipografia };

export const ServicoVideo: ComponentConfig<VideoProps> = {
  label: "Serviço · Vídeo",
  fields: { titulo: { type: "text", label: "Título (vazio = esconder)" }, tTitulo: campoTipografia("Tipografia do título"), aparencia: campoAparencia() },
  defaultProps: { titulo: "", tTitulo: tipoVazia(), aparencia: estiloVazio() },
  render: p => (
    <CaixaServico p={p} tem={s => Boolean(videoServico(s.video))} vazio={`O serviço não tem vídeo (YouTube, Vimeo ou .mp4). ${ONDE}`}>
      {s => {
        const v = videoServico(s.video)!;
        return (
          <>
            <Titulo texto={p.titulo} t={p.tTitulo} className="mb-6 font-serif text-3xl font-bold" />
            <div className="aspect-video w-full overflow-hidden bg-black">
              {v.tipo === "iframe"
                ? <iframe src={v.src} title={`Vídeo: ${s.titulo}`} className="h-full w-full" allow="encrypted-media; picture-in-picture; fullscreen" loading="lazy" />
                : <video src={v.src} controls preload="metadata" className="h-full w-full" aria-label={`Vídeo: ${s.titulo}`} />}
            </div>
          </>
        );
      }}
    </CaixaServico>
  ),
};

// ─── Logótipos ──────────────────────────────────────────────────────────────

type LogosProps = Base & { titulo: string; tTitulo: Tipografia; altura: number | null; carrossel: boolean; segundos: number | null; cinzento: boolean };

export const ServicoLogos: ComponentConfig<LogosProps> = {
  label: "Serviço · Logótipos",
  fields: {
    titulo: { type: "text", label: "Título (vazio = esconder)" },
    carrossel: simNao("Em carrossel (senão, em grelha)"),
    segundos: campoNumero("Passar sozinho a cada (segundos, 0 = não)"),
    altura: campoNumero("Altura dos logótipos"),
    cinzento: simNao("A cinzento (cor ao passar o rato)"),
    tTitulo: campoTipografia("Tipografia do título"),
    aparencia: campoAparencia(),
  },
  defaultProps: { titulo: "Quem confia em nós", carrossel: true, segundos: 4, altura: 56, cinzento: true, tTitulo: tipoVazia(), aparencia: estiloVazio() },
  render: p => (
    <CaixaServico p={p} tem={s => (s.logos ?? []).some(l => l.imagem)} vazio={`O serviço não tem logótipos. ${ONDE}`}>
      {s => {
        const logos = (s.logos ?? []).filter(l => l.imagem).map((l, i) => {
          const img = <img src={l.imagem} alt={l.alt} style={{ height: `${p.altura || 56}px` }} className={juntar("w-auto object-contain transition", p.cinzento && "opacity-70 grayscale hover:opacity-100 hover:grayscale-0")} />;
          const href = ligacaoSegura(l.ligacao);
          return <div key={i} className="flex shrink-0 snap-start items-center justify-center px-6">{href ? <a href={href} target="_blank" rel="noreferrer">{img}</a> : img}</div>;
        });
        return (
          <>
            <Titulo texto={p.titulo} t={p.tTitulo} className="mb-6 font-serif text-3xl font-bold" />
            {p.carrossel
              ? <Cartoes carrossel segundos={p.segundos ?? 0} setas style={{ ["--cols" as string]: "5", ["--cols-tab" as string]: "3", ["--cols-tel" as string]: "2" }} rotulo={p.titulo || "Logótipos"}>{logos}</Cartoes>
              : <div className="flex flex-wrap items-center justify-center gap-8">{logos}</div>}
          </>
        );
      }}
    </CaixaServico>
  ),
};
