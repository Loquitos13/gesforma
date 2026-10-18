// Página de cada notícia (/noticias/<slug>): um só modelo no editor, preenchido com o artigo (escrito em Gestão › Blog).
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ComponentConfig } from "@puckeditor/core";
import { ArtigoBlocos } from "../../partilhado/ArtigoBlocos";
import { apiNoticia, apiNoticias } from "../../partilhado/api";
import { lerDocumento, textoDoCorpo } from "../../partilhado/blogBlocos";
import { OfertaCtx } from "../SiteLanding";
import { Partilhar, REDES_PARTILHA } from "./redesSociais";
import { CursoDaRotaCtx } from "./blocosCursoPagina";
import { Titulo, type Base } from "./blocosCurso";
import { campoCor, campoNumero, simNao } from "./campos";
import { campoAparencia, campoTipografia } from "./camposGrupos";
import { corSegura, estiloBloco, estiloTexto, estiloVazio, juntar, tipoVazia, type Tipografia } from "./estilos";

type Noticia = { titulo: string; slug: string; data: string; tematica: string; corpo: string };
type Outra = { titulo: string; slug: string; data: string; tematica: string };
type Atual = { estado: "a-carregar" | "pronto" | "erro"; noticia: Noticia | null; outras: Outra[] };
const NoticiaCtx = createContext<Atual>({ estado: "a-carregar", noticia: null, outras: [] });

export function dataPt(iso: string) {
  const data = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return Number.isNaN(data.getTime()) ? iso : data.toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" });
}

/** Raiz da página: a notícia da rota (no editor, a da pré-visualização ou a mais recente). */
export function RaizNoticia({ previsualizar, editar, children }: { previsualizar: string; editar: boolean; children: ReactNode }) {
  const rota = useContext(CursoDaRotaCtx) ?? "";
  const [slugEditor, setSlugEditor] = useState("");
  const [atual, setAtual] = useState<Atual>({ estado: "a-carregar", noticia: null, outras: [] });
  // No editor, sem escolha, abre a notícia mais recente.
  useEffect(() => {
    if (!editar || previsualizar) return;
    void apiNoticias().then(r => setSlugEditor(r.noticias[0]?.slug ?? "")).catch(() => undefined);
  }, [editar, previsualizar]);
  const slug = editar ? previsualizar || slugEditor : rota;
  useEffect(() => {
    if (!slug) return;
    let vivo = true;
    apiNoticia(slug)
      .then(r => { if (vivo) setAtual({ estado: "pronto", noticia: r.noticia, outras: r.outras }); })
      .catch(() => { if (vivo) setAtual({ estado: "erro", noticia: null, outras: [] }); });
    return () => { vivo = false; };
  }, [slug]);
  useEffect(() => { if (!editar && atual.noticia) document.title = `${atual.noticia.titulo} | ENA`; }, [atual.noticia, editar]);
  if (!editar && atual.estado === "erro") {
    return (
      <div className="px-5 py-24 text-center">
        <h1 className="font-serif text-3xl">Esta notícia não está publicada.</h1>
        <a href="/noticias" className="mt-6 inline-flex font-bold text-[var(--c-destaque)] underline">Ver as notícias</a>
      </div>
    );
  }
  return <NoticiaCtx.Provider value={atual}>{children}</NoticiaCtx.Provider>;
}

/** No editor: com que notícia se vê o modelo. */
export const campoPrevisualizarNoticia = {
  type: "custom" as const,
  label: "No editor, ver com a notícia",
  render: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => <EscolherNoticia value={value} onChange={onChange} />,
};

function EscolherNoticia({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [lista, setLista] = useState<Outra[]>([]);
  useEffect(() => { void apiNoticias().then(r => setLista(r.noticias)).catch(() => undefined); }, []);
  return (
    <select value={value ?? ""} onChange={e => onChange(e.target.value)} className="w-full rounded border border-[#d5dbe3] bg-white px-2 py-1.5 text-sm">
      <option value="">A mais recente</option>
      {lista.map(n => <option key={n.slug} value={n.slug}>{n.titulo}</option>)}
    </select>
  );
}

/** Invólucro: aparência, pega de arrastar e espera pela notícia. */
function CaixaNoticia({ p, children }: { p: Base; children: (n: Noticia, outras: Outra[]) => ReactNode }) {
  const { noticia, outras, estado } = useContext(NoticiaCtx);
  const editar = Boolean((p.puck as { isEditing?: boolean } | undefined)?.isEditing);
  const c = estiloBloco(p.aparencia);
  if (!noticia) {
    return <div ref={p.puck?.dragRef ?? undefined} className="min-h-24 px-5 py-8 text-center text-sm opacity-60" aria-busy={estado === "a-carregar"}>
      {editar && estado !== "a-carregar" ? "Sem notícias publicadas para mostrar (Gestão › Blog)." : null}
    </div>;
  }
  return <div ref={p.puck?.dragRef ?? undefined} className={c.className} style={c.style}>{children(noticia, outras)}</div>;
}

// ─── Cabeçalho ──────────────────────────────────────────────────────────────

type CabecalhoProps = Base & { voltar: string; tTitulo: Tipografia; tEtiqueta: Tipografia; excerto?: boolean; leitura?: boolean; partilhar?: boolean };

export const NoticiaCabecalho: ComponentConfig<CabecalhoProps> = {
  label: "Notícia · Cabeçalho",
  fields: {
    voltar: { type: "text", label: "Ligação para voltar às notícias (vazio = esconder)" },
    excerto: simNao("Excerto (escreve-se no artigo, em Gestão › Blog)") as never,
    leitura: simNao("Tempo de leitura") as never,
    partilhar: simNao("Botões para partilhar (LinkedIn, Facebook, WhatsApp, X e copiar ligação)") as never,
    tEtiqueta: campoTipografia("Tipografia da temática e da data"),
    tTitulo: campoTipografia("Tipografia do título"),
    aparencia: campoAparencia(),
  },
  defaultProps: { voltar: "Todas as notícias", excerto: true, leitura: true, partilhar: true, tEtiqueta: tipoVazia(), tTitulo: tipoVazia(), aparencia: estiloVazio() },
  render: p => (
    <CaixaNoticia p={p}>
      {n => {
        const [e, t] = [estiloTexto(p.tEtiqueta), estiloTexto(p.tTitulo)];
        const meta = lerDocumento(n.corpo).meta;
        // Cerca de 200 palavras por minuto.
        const minutos = Math.max(1, Math.round(textoDoCorpo(n.corpo).split(" ").filter(Boolean).length / 200));
        return (
          <div className="mx-auto max-w-[760px]">
            {p.voltar && <a href="/noticias" className="text-sm font-bold text-[var(--c-destaque)]">← {p.voltar}</a>}
            <p className={juntar("mt-6 text-xs font-bold uppercase tracking-wider text-[var(--c-destaque)]", e.className)} style={e.style}>{n.tematica || "Notícia"} · {dataPt(n.data)}</p>
            <h1 className={juntar("mt-3 font-serif text-4xl font-bold", t.className)} style={t.style}>{n.titulo}</h1>
            {p.excerto !== false && meta?.excerto && <p className="mt-4 text-xl leading-8 opacity-75">{meta.excerto}</p>}
            {(p.leitura !== false || p.partilhar !== false) && (
              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
                {p.leitura !== false && <span className="text-sm opacity-70">{minutos} min de leitura</span>}
                {p.partilhar !== false && <Partilhar redes={REDES_PARTILHA} titulo={n.titulo} />}
              </div>
            )}
          </div>
        );
      }}
    </CaixaNoticia>
  ),
};

// ─── Corpo ──────────────────────────────────────────────────────────────────

function Corpo({ corpo }: { corpo: string }) {
  const doc = useMemo(() => lerDocumento(corpo), [corpo]);
  if (!doc.blocos.length) return <p className="mx-auto mt-8 max-w-[760px] opacity-60">Este artigo ainda não tem texto. O corpo edita-se no post, em Gestão › Blog.</p>;
  return <ArtigoBlocos doc={doc} />;
}

export const NoticiaCorpo: ComponentConfig<Base> = {
  label: "Notícia · Texto do artigo",
  fields: { aparencia: campoAparencia() },
  defaultProps: { aparencia: estiloVazio() },
  render: p => <CaixaNoticia p={p}>{n => <Corpo corpo={n.corpo} />}</CaixaNoticia>,
};

// ─── Outras notícias ────────────────────────────────────────────────────────

type OutrasProps = Base & { titulo: string; tTitulo: Tipografia; colunas: number | null };

export const NoticiaOutras: ComponentConfig<OutrasProps> = {
  label: "Notícia · Outras notícias",
  fields: {
    titulo: { type: "text", label: "Título (vazio = esconder)" },
    colunas: campoNumero("Colunas (computador)") as never,
    tTitulo: campoTipografia("Tipografia do título"),
    aparencia: campoAparencia(),
  },
  defaultProps: { titulo: "Outras notícias", colunas: 3, tTitulo: tipoVazia(), aparencia: estiloVazio() },
  render: p => (
    <CaixaNoticia p={p}>
      {(_n, outras) => outras.length === 0 ? null : (
        <>
          <Titulo texto={p.titulo} t={p.tTitulo} className="mb-6 font-serif text-2xl font-bold" />
          <div className="ena-grelha" style={{ gap: "16px", ["--cols" as string]: String(p.colunas || 3), ["--cols-tab" as string]: "2", ["--cols-tel" as string]: "1" }}>
            {outras.map(o => (
              <a key={o.slug} href={`/noticias/${encodeURIComponent(o.slug)}`} className="flex flex-col gap-2 border-t-[3px] border-[var(--c-acento)] bg-white p-5 hover:shadow-md">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--c-destaque)]">{o.tematica || "Notícia"} · {dataPt(o.data)}</span>
                <strong className="text-lg leading-snug text-[var(--c-primaria)]">{o.titulo}</strong>
              </a>
            ))}
          </div>
        </>
      )}
    </CaixaNoticia>
  ),
};

// ─── Imagem de destaque ─────────────────────────────────────────────────────

type ImagemProps = Base & { proporcao: "16/9" | "21/9" | "3/2" };

export const NoticiaImagem: ComponentConfig<ImagemProps> = {
  label: "Notícia · Imagem de destaque",
  fields: {
    proporcao: { type: "select", label: "Proporção", options: [{ label: "21:9 (larga)", value: "21/9" }, { label: "16:9", value: "16/9" }, { label: "3:2", value: "3/2" }] },
    aparencia: campoAparencia(),
  },
  defaultProps: { proporcao: "21/9", aparencia: estiloVazio() },
  render: p => (
    <CaixaNoticia p={p}>
      {n => {
        const meta = lerDocumento(n.corpo).meta;
        if (!meta?.capa) return (p.puck as { isEditing?: boolean } | undefined)?.isEditing
          ? <p className="border border-dashed border-black/20 px-5 py-6 text-center text-sm opacity-60">Esta notícia não tem imagem de destaque (junta-se no artigo, em Gestão › Blog).</p> : null;
        return (
          <figure className="mx-auto max-w-[1040px]">
            <img src={meta.capa} alt={meta.capaAlt} className="w-full object-cover" style={{ aspectRatio: p.proporcao }} />
            {meta.capaLegenda && <figcaption className="mt-2 text-sm opacity-60">{meta.capaLegenda}</figcaption>}
          </figure>
        );
      }}
    </CaixaNoticia>
  ),
};

// ─── Curso relacionado ──────────────────────────────────────────────────────

type CursoProps = Base & { etiqueta: string; botao: string; corFundo: string };

export const NoticiaCurso: ComponentConfig<CursoProps> = {
  label: "Notícia · Curso relacionado",
  fields: {
    etiqueta: { type: "text", label: "Etiqueta" },
    botao: { type: "text", label: "Texto do botão" },
    corFundo: campoCor("Fundo"),
    aparencia: campoAparencia(),
  },
  defaultProps: { etiqueta: "Curso relacionado", botao: "Ver o curso", corFundo: "var(--c-primaria)", aparencia: estiloVazio() },
  render: p => <CaixaNoticia p={p}>{n => <CursoDaNoticia p={p} corpo={n.corpo} />}</CaixaNoticia>,
};

function CursoDaNoticia({ p, corpo }: { p: CursoProps; corpo: string }) {
  const cursos = useContext(OfertaCtx)?.cursos ?? [];
  const id = lerDocumento(corpo).meta?.curso;
  const c = id ? cursos.find(x => x.id === id) : undefined;
  if (!c) return (p.puck as { isEditing?: boolean } | undefined)?.isEditing
    ? <p className="border border-dashed border-black/20 px-5 py-6 text-center text-sm opacity-60">Esta notícia não tem curso relacionado (escolhe-se no artigo, em Gestão › Blog).</p> : null;
  return (
    <aside className="mx-auto flex max-w-[760px] flex-wrap items-center justify-between gap-4 p-6 text-white" style={{ background: corSegura(p.corFundo) ?? "var(--c-primaria)" }}>
      <div className="flex flex-col gap-1">
        {p.etiqueta && <span className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--c-acento)]">{p.etiqueta}</span>}
        <strong className="text-xl">{c.title}</strong>
        <span className="text-sm text-white/75">{[c.format, c.duration, c.price].filter(Boolean).join(" · ")}</span>
      </div>
      <a href={`/formacao/${encodeURIComponent(c.id)}`} className="bg-[var(--c-acento)] px-5 py-3 text-sm font-bold text-[var(--c-primaria)] hover:brightness-95">{p.botao} →</a>
    </aside>
  );
}
