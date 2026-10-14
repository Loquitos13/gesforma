import { useEffect, useMemo, useState } from "react";
import { ArtigoBlocos } from "../partilhado/ArtigoBlocos";
import { apiNoticia } from "../partilhado/api";
import { lerDocumento } from "../partilhado/blogBlocos";
import { SiteFrame } from "./SiteLandingRodape";

type Item = { titulo: string; slug: string; data: string; tematica: string; excerto?: string };

function dataPt(iso: string) {
  const data = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(data.getTime())) return iso;
  return data.toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" });
}

function CorpoArtigo({ corpo }: { corpo: string }) {
  const doc = useMemo(() => lerDocumento(corpo), [corpo]);
  if (!doc.blocos.length) {
    return <p className="mx-auto mt-8 max-w-[760px] text-[#1C3350]/60">Este artigo ainda não tem texto. O corpo edita-se no post, em Gestão → Blog.</p>;
  }
  return <ArtigoBlocos doc={doc} />;
}

function Artigo({ slug }: { slug: string }) {
  const [estado, setEstado] = useState<"a-carregar" | "pronto" | "erro">("a-carregar");
  const [titulo, setTitulo] = useState("");
  const [corpo, setCorpo] = useState("");
  const [data, setData] = useState("");
  const [tematica, setTematica] = useState("");
  const [outras, setOutras] = useState<Item[]>([]);
  useEffect(() => {
    apiNoticia(slug)
      .then(r => {
        setTitulo(r.noticia.titulo);
        setCorpo(r.noticia.corpo);
        setData(r.noticia.data);
        setTematica(r.noticia.tematica);
        setOutras(r.outras);
        setEstado("pronto");
      })
      .catch(() => setEstado("erro"));
  }, [slug]);
  return (
    <main className="mx-auto max-w-[1100px] px-5 py-12 lg:px-8">
      <a href="/noticias" className="text-sm font-bold text-[#A60000]">Todas as notícias</a>
      {estado === "a-carregar" && <p className="mt-8 text-sm text-[#1C3350]/50">A abrir o artigo…</p>}
      {estado === "erro" && <p className="mt-8 text-sm font-semibold text-[#A60000]">Este artigo não está publicado.</p>}
      {estado === "pronto" && (
        <article className="mt-6">
          <div className="mx-auto max-w-[760px]">
            <p className="text-xs font-bold uppercase tracking-wider text-[#A60000]">{tematica || "Notícia"} · {dataPt(data)}</p>
            <h1 className="mt-3 font-serif text-4xl font-bold text-[#1C3350]">{titulo}</h1>
          </div>
          <CorpoArtigo corpo={corpo} />
        </article>
      )}
      {outras.length > 0 && (
        <aside className="mt-12 border-t border-[#1C3350]/10 pt-6">
          <h2 className="font-serif text-2xl font-bold">Outras notícias</h2>
          <ul className="mt-4 space-y-3">
            {outras.map(item => <li key={item.slug}><a href={`/noticias/${encodeURIComponent(item.slug)}`} className="font-semibold hover:text-[#A60000]">{item.titulo}</a></li>)}
          </ul>
        </aside>
      )}
    </main>
  );
}

/** Um artigo do blog (a lista de notícias é uma página do editor do site). */
export function Noticias({ slug }: { slug: string }) {
  return <SiteFrame><Artigo slug={slug} /></SiteFrame>;
}
