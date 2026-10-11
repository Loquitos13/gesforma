import { moradaSegura } from "./siteConteudo";
import type { BlocoBlog, DocumentoBlog } from "./blogBlocos";

function Imagem({ url, alt, className }: { url: string; alt: string; className: string }) {
  const segura = moradaSegura(url);
  if (!segura) return <div className={`${className} bg-[#E7EBF0]`} />;
  return <img src={segura} alt={alt} className={`${className} object-cover`} />;
}

function Ligacao({ rotulo, destino, className }: { rotulo: string; destino: string; className: string }) {
  const segura = moradaSegura(destino);
  if (!rotulo.trim()) return null;
  if (!segura) return <span className={className}>{rotulo}</span>;
  const externa = segura.startsWith("http");
  return <a href={segura} className={className} {...(externa ? { target: "_blank", rel: "noreferrer" } : {})}>{rotulo}</a>;
}

function Hero({ bloco }: { bloco: Extract<BlocoBlog, { tipo: "hero" }> }) {
  const centro = bloco.disposicao === "texto-centro";
  const direita = bloco.disposicao === "texto-direita";
  const texto = (
    <div className={centro ? "relative z-10 mx-auto max-w-2xl px-6 py-14 text-center sm:px-10" : "relative z-10 flex flex-col justify-center px-6 py-10 sm:px-10"}>
      {bloco.titulo && <h2 className="font-serif text-3xl font-bold leading-tight text-white sm:text-4xl">{bloco.titulo}</h2>}
      {bloco.texto && <p className={`mt-4 leading-7 text-white/80 ${centro ? "" : "max-w-xl"}`}>{bloco.texto}</p>}
      {bloco.botao && (
        <Ligacao rotulo={bloco.botao} destino={bloco.destino} className={`mt-6 inline-flex bg-[#FFA900] px-5 py-3 text-sm font-bold text-[#14263D] ${centro ? "" : "self-start"}`} />
      )}
    </div>
  );
  if (centro) {
    return (
      <section className="relative overflow-hidden bg-[#14263D]">
        <Imagem url={bloco.imagem} alt={bloco.alt} className="absolute inset-0 h-full w-full opacity-40" />
        <div className="absolute inset-0 bg-[#14263D]/55" />
        {texto}
      </section>
    );
  }
  return (
    <section className={`grid overflow-hidden bg-[#14263D] lg:grid-cols-2 ${direita ? "" : ""}`}>
      <div className={direita ? "lg:order-2" : ""}>
        <Imagem url={bloco.imagem} alt={bloco.alt} className="h-64 w-full lg:h-full lg:min-h-[320px]" />
      </div>
      {texto}
    </section>
  );
}

function Seccao({ bloco }: { bloco: Extract<BlocoBlog, { tipo: "seccao" }> }) {
  const direita = bloco.disposicao === "imagem-direita";
  return (
    <section className="grid items-center gap-8 bg-white lg:grid-cols-2">
      <div className={direita ? "lg:order-2" : ""}>
        <Imagem url={bloco.imagem} alt={bloco.alt} className="aspect-[4/3] w-full" />
      </div>
      <div>
        {bloco.titulo && <h2 className="font-serif text-3xl font-bold text-[#1C3350]">{bloco.titulo}</h2>}
        {bloco.texto && <p className="mt-4 whitespace-pre-line leading-8 text-[#1C3350]/80">{bloco.texto}</p>}
      </div>
    </section>
  );
}

function BlocoPublico({ bloco }: { bloco: BlocoBlog }) {
  if (bloco.tipo === "paragrafo") {
    if (!bloco.texto.trim()) return null;
    return <p className="mx-auto max-w-[760px] whitespace-pre-line leading-8 text-[#1C3350]/80">{bloco.texto}</p>;
  }
  if (bloco.tipo === "titulo") {
    if (!bloco.texto.trim()) return null;
    const Tag = bloco.nivel === "3" ? "h3" : "h2";
    return <Tag className="mx-auto max-w-[760px] font-serif text-3xl font-bold text-[#1C3350]">{bloco.texto}</Tag>;
  }
  if (bloco.tipo === "imagem") {
    if (!moradaSegura(bloco.url)) return null;
    return (
      <figure className="mx-auto max-w-[900px]">
        <Imagem url={bloco.url} alt={bloco.alt} className="max-h-[520px] w-full" />
        {bloco.legenda && <figcaption className="mt-2 text-sm text-[#1C3350]/55">{bloco.legenda}</figcaption>}
      </figure>
    );
  }
  if (bloco.tipo === "hero") return <Hero bloco={bloco} />;
  if (bloco.tipo === "seccao") return <Seccao bloco={bloco} />;
  if (bloco.tipo === "citacao") {
    if (!bloco.texto.trim()) return null;
    return (
      <blockquote className="mx-auto max-w-[760px] border-l-4 border-[#FFA900] pl-5">
        <p className="font-serif text-2xl leading-snug text-[#1C3350]">{bloco.texto}</p>
        {bloco.autor && <footer className="mt-3 text-sm font-semibold text-[#A60000]">{bloco.autor}</footer>}
      </blockquote>
    );
  }
  if (bloco.tipo === "lista") {
    const itens = bloco.itens.split("\n").map(item => item.trim()).filter(Boolean);
    if (!itens.length) return null;
    return (
      <ul className="mx-auto max-w-[760px] list-disc space-y-2 pl-5 leading-7 text-[#1C3350]/80">
        {itens.map((item, i) => <li key={`${i}-${item}`}>{item}</li>)}
      </ul>
    );
  }
  if (bloco.tipo === "botao") {
    return (
      <p className="mx-auto max-w-[760px]">
        <Ligacao rotulo={bloco.rotulo} destino={bloco.destino} className="inline-flex bg-[#A60000] px-5 py-3 text-sm font-bold text-white" />
      </p>
    );
  }
  return <hr className="mx-auto w-24 border-t-4 border-[#FFA900]" />;
}

export function ArtigoBlocos({ doc }: { doc: DocumentoBlog }) {
  if (!doc.blocos.length) return null;
  return (
    <div className="mt-8 space-y-8">
      {doc.blocos.map(bloco => <BlocoPublico key={bloco.id} bloco={bloco} />)}
    </div>
  );
}
