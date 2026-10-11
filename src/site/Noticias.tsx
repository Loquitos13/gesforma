import { useEffect, useState } from "react";
import { apiNoticia, apiNoticias } from "../partilhado/api";
import { SiteFrame } from "./SiteLanding";

type Item = { titulo: string; slug: string; data: string; tematica: string; excerto?: string };

function dataPt(iso: string) {
  const data = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(data.getTime())) return iso;
  return data.toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" });
}

function Lista() {
  const [itens, setItens] = useState<Item[] | null>(null);
  const [erro, setErro] = useState(false);
  const [tema, setTema] = useState("Todas");
  useEffect(() => {
    apiNoticias().then(r => setItens(r.noticias)).catch(() => setErro(true));
  }, []);
  const temas = ["Todas", ...new Set((itens ?? []).map(item => item.tematica).filter(Boolean))];
  const visiveis = (itens ?? []).filter(item => tema === "Todas" || item.tematica === tema);
  return (
    <main className="mx-auto max-w-[1240px] px-5 py-12 lg:px-8">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#A60000]">ENA</p>
      <h1 className="mt-3 font-serif text-4xl font-bold text-[#1C3350] sm:text-5xl">Notícias</h1>
      <p className="mt-4 max-w-2xl leading-7 text-[#1C3350]/60">Os artigos publicados em Gestão → Blog. Um post inactivo fica de fora desta lista.</p>
      {temas.length > 1 && (
        <div className="mt-8 flex flex-wrap gap-2">
          {temas.map(item => (
            <button key={item} type="button" onClick={() => setTema(item)} className={`px-4 py-2 text-sm font-bold ${tema === item ? "bg-[#1C3350] text-white" : "bg-white text-[#1C3350]"}`}>{item}</button>
          ))}
        </div>
      )}
      {erro && <p className="mt-10 text-sm font-semibold text-[#A60000]">Não foi possível ler as notícias.</p>}
      {itens && visiveis.length === 0 && <p className="mt-10 text-sm text-[#1C3350]/60">Ainda não há artigos publicados.</p>}
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {visiveis.map(item => (
          <a key={item.slug} href={`/noticias/${encodeURIComponent(item.slug)}`} className="border border-[#1C3350]/10 bg-white p-6 hover:border-[#A60000]">
            <span className="text-xs font-bold uppercase tracking-wider text-[#A60000]">{item.tematica || "Notícia"} · {dataPt(item.data)}</span>
            <h2 className="mt-3 font-serif text-2xl font-bold">{item.titulo}</h2>
            {item.excerto && <p className="mt-3 text-sm leading-6 text-[#1C3350]/60">{item.excerto}</p>}
          </a>
        ))}
      </div>
    </main>
  );
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
    <main className="mx-auto max-w-[760px] px-5 py-12 lg:px-8">
      <a href="/noticias" className="text-sm font-bold text-[#A60000]">Todas as notícias</a>
      {estado === "a-carregar" && <p className="mt-8 text-sm text-[#1C3350]/50">A abrir o artigo…</p>}
      {estado === "erro" && <p className="mt-8 text-sm font-semibold text-[#A60000]">Este artigo não está publicado.</p>}
      {estado === "pronto" && (
        <article className="mt-6">
          <p className="text-xs font-bold uppercase tracking-wider text-[#A60000]">{tematica || "Notícia"} · {dataPt(data)}</p>
          <h1 className="mt-3 font-serif text-4xl font-bold text-[#1C3350]">{titulo}</h1>
          {corpo.trim() ? (
            <div className="mt-8 space-y-4 text-base leading-8 text-[#1C3350]/80">
              {corpo.split(/\n{2,}/).map(parte => <p key={parte.slice(0, 40)}>{parte}</p>)}
            </div>
          ) : (
            <p className="mt-8 text-[#1C3350]/60">Este artigo ainda não tem texto. O corpo edita-se no post, em Gestão → Blog.</p>
          )}
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

export function Noticias({ slug = "" }: { slug?: string }) {
  return <SiteFrame>{slug ? <Artigo slug={slug} /> : <Lista />}</SiteFrame>;
}
