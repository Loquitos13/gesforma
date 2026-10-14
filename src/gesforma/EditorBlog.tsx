import { useLayoutEffect, useRef, useState } from "react";
import { apiBlogImagem } from "../partilhado/api";
import { ArtigoBlocos } from "../partilhado/ArtigoBlocos";
import {
  blocoNovo, gravarDocumento, idBloco, lerDocumento, TIPOS_BLOCO,
  type BlocoBlog, type DocumentoBlog, type TipoBloco,
} from "../partilhado/blogBlocos";
import { useOpcoes } from "../partilhado/dados/useOpcoes";
import { SearchSelect } from "../partilhado/FormKit";
import { moradaSegura } from "../partilhado/siteConteudo";

const campo = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-amber-400";

export function EditorBlog({
  chave, corpoInicial, onCorpo, titulo, slug, tematica, estado,
  onTitulo, onSlug, onTematica, onEstado,
}: {
  chave: string;
  corpoInicial: string;
  onCorpo: (corpo: string) => void;
  titulo: string;
  slug: string;
  tematica: string;
  estado: string;
  onTitulo: (valor: string) => void;
  onSlug: (valor: string) => void;
  onTematica: (valor: string) => void;
  onEstado: (valor: string) => void;
}) {
  const tematicas = useOpcoes("tematicas");
  const inicialRef = useRef(corpoInicial);
  const chaveRef = useRef(chave);
  const onCorpoRef = useRef(onCorpo);
  onCorpoRef.current = onCorpo;
  if (chaveRef.current !== chave) {
    chaveRef.current = chave;
    inicialRef.current = corpoInicial;
  }
  const [doc, setDoc] = useState<DocumentoBlog>({ v: 1, blocos: [] });
  const docRef = useRef(doc);
  const [vista, setVista] = useState<"editar" | "site">("editar");
  const [menu, setMenu] = useState<number | "fim" | null>(null);
  const [aEnviar, setAEnviar] = useState<string | null>(null);
  const [erro, setErro] = useState("");

  useLayoutEffect(() => {
    const lido = lerDocumento(inicialRef.current);
    docRef.current = lido;
    setDoc(lido);
    setMenu(null);
    setVista("editar");
    setErro("");
    onCorpoRef.current(gravarDocumento(lido));
  }, [chave]);

  function aplicar(next: DocumentoBlog) {
    docRef.current = next;
    setDoc(next);
    onCorpoRef.current(gravarDocumento(next));
  }

  function mudar(id: string, patch: Record<string, string>) {
    aplicar({
      v: 1,
      blocos: docRef.current.blocos.map(bloco => (bloco.id === id ? { ...bloco, ...patch } as BlocoBlog : bloco)),
    });
  }

  function inserir(tipo: TipoBloco, depois: number) {
    if (docRef.current.blocos.length >= 80) {
      setErro("Um artigo leva no máximo 80 blocos.");
      setMenu(null);
      return;
    }
    const blocos = [...docRef.current.blocos];
    const em = depois < 0 ? blocos.length : Math.min(blocos.length, depois + 1);
    blocos.splice(em, 0, blocoNovo(tipo));
    aplicar({ v: 1, blocos });
    setMenu(null);
    setErro("");
  }

  function mover(indice: number, direcao: -1 | 1) {
    const destino = indice + direcao;
    const blocos = [...docRef.current.blocos];
    if (destino < 0 || destino >= blocos.length) return;
    const [bloco] = blocos.splice(indice, 1);
    blocos.splice(destino, 0, bloco);
    aplicar({ v: 1, blocos });
  }

  function duplicar(indice: number) {
    if (docRef.current.blocos.length >= 80) {
      setErro("Um artigo leva no máximo 80 blocos.");
      return;
    }
    const blocos = [...docRef.current.blocos];
    blocos.splice(indice + 1, 0, { ...blocos[indice], id: idBloco() });
    aplicar({ v: 1, blocos });
  }

  function remover(indice: number) {
    aplicar({ v: 1, blocos: docRef.current.blocos.filter((_, i) => i !== indice) });
    setMenu(null);
  }

  async function carregar(id: string, campoImagem: "url" | "imagem", file: File) {
    setAEnviar(id);
    setErro("");
    try {
      const resposta = await apiBlogImagem(file);
      mudar(id, { [campoImagem]: resposta.url });
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível carregar a imagem.");
    } finally {
      setAEnviar(null);
    }
  }

  return (
    <div data-editor-blog className="space-y-4">
      <input
        value={titulo}
        onChange={e => onTitulo(e.target.value)}
        placeholder="Título do artigo"
        className="w-full border-0 bg-transparent text-2xl font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none"
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Slug</span>
          <input className={`${campo} mt-1`} value={slug} onChange={e => onSlug(e.target.value)} placeholder="Se ficar vazio, gera-se do título" />
        </label>
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Temática</span>
          <div className="mt-1">
            <SearchSelect value={tematica} onChange={onTematica} options={tematicas.opcoes.map(o => ({ value: o.valor }))} placeholder="Pesquisar temática…" />
          </div>
        </label>
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Estado</span>
          <div className="mt-1 flex flex-wrap gap-2">
            {["Ativo", "Inactivo"].map(opcao => (
              <button key={opcao} type="button" onClick={() => onEstado(opcao)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${estado === opcao ? "border-amber-500 bg-amber-500 text-white" : "border-slate-200 bg-white text-slate-600"}`}>
                {opcao === "Ativo" ? "Ativo · no site" : "Inactivo · fora do site"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">Blocos do artigo. A imagem entra no post; o site mostra-a quando o estado é Ativo.</p>
        <button type="button" onClick={() => setVista(vista === "editar" ? "site" : "editar")} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
          {vista === "editar" ? "Ver como no site" : "Voltar a editar"}
        </button>
      </div>

      {vista === "site" ? (
        <div className="site-ena rounded-xl bg-[#F6F3EE] px-4 py-8 sm:px-8">
          <h1 className="mx-auto max-w-[760px] font-serif text-4xl font-bold text-[#1C3350]">{titulo || "Sem título"}</h1>
          {doc.blocos.length ? <ArtigoBlocos doc={doc} /> : <p className="mx-auto mt-8 max-w-[760px] text-[#1C3350]/60">O artigo ainda está vazio.</p>}
        </div>
      ) : (
        <div className="space-y-3 rounded-xl bg-slate-100 p-3 sm:p-4">
          {doc.blocos.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
              <p className="text-sm text-slate-600">O artigo ainda está vazio. Comece por um parágrafo ou por um hero.</p>
            </div>
          )}
          {doc.blocos.map((bloco, indice) => (
            <div key={bloco.id}>
              <article className="group rounded-xl border border-slate-200 bg-white shadow-sm" onFocus={() => setMenu(menu === "fim" ? null : menu)}>
                <header className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-amber-700">{TIPOS_BLOCO.find(t => t.tipo === bloco.tipo)?.nome}</span>
                  <div className="ml-auto flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                    <BotaoBloco label="Subir" disabled={indice === 0} onClick={() => mover(indice, -1)}>↑</BotaoBloco>
                    <BotaoBloco label="Descer" disabled={indice === doc.blocos.length - 1} onClick={() => mover(indice, 1)}>↓</BotaoBloco>
                    <BotaoBloco label="Duplicar" onClick={() => duplicar(indice)}>Duplicar</BotaoBloco>
                    <BotaoBloco label="Remover bloco" onClick={() => remover(indice)}>Remover</BotaoBloco>
                  </div>
                </header>
                <div className="space-y-2 p-3">
                  <CamposBloco bloco={bloco} aEnviar={aEnviar === bloco.id} onMudar={patch => mudar(bloco.id, patch)} onFile={file => void carregar(bloco.id, bloco.tipo === "imagem" ? "url" : "imagem", file)} />
                </div>
              </article>
              <Inserir aberto={menu === indice} onAbrir={() => setMenu(menu === indice ? null : indice)} onEscolher={tipo => inserir(tipo, indice)} />
            </div>
          ))}
          <Inserir aberto={menu === "fim"} noFim onAbrir={() => setMenu(menu === "fim" ? null : "fim")} onEscolher={tipo => inserir(tipo, doc.blocos.length - 1)} />
        </div>
      )}
      {erro && <p className="text-xs font-medium text-red-600">{erro}</p>}
    </div>
  );
}

function BotaoBloco({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: string }) {
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className="rounded-md px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-30">
      {children}
    </button>
  );
}

function Inserir({ aberto, noFim, onAbrir, onEscolher }: { aberto: boolean; noFim?: boolean; onAbrir: () => void; onEscolher: (tipo: TipoBloco) => void }) {
  return (
    <div className={noFim ? "pt-1" : "py-1"}>
      <button type="button" onClick={onAbrir} className={`text-xs font-semibold text-slate-600 hover:text-amber-700 ${noFim ? "w-full rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2" : "mx-auto flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 bg-white"}`}>
        {noFim ? "Adicionar bloco" : "+"}
      </button>
      {aberto && (
        <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-3">
          {TIPOS_BLOCO.map(tipo => (
            <button key={tipo.tipo} type="button" onClick={() => onEscolher(tipo.tipo)} className="rounded-lg border border-slate-100 px-3 py-2 text-left hover:border-amber-400 hover:bg-amber-50">
              <span className="block text-sm font-semibold text-slate-800">{tipo.nome}</span>
              <span className="block text-[11px] text-slate-500">{tipo.nota}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CamposBloco({
  bloco, aEnviar, onMudar, onFile,
}: {
  bloco: BlocoBlog;
  aEnviar: boolean;
  onMudar: (patch: Record<string, string>) => void;
  onFile: (file: File) => void;
}) {
  if (bloco.tipo === "paragrafo") {
    return <textarea className={`${campo} min-h-28`} value={bloco.texto} onChange={e => onMudar({ texto: e.target.value })} placeholder="Escreva o parágrafo." />;
  }
  if (bloco.tipo === "titulo") {
    return (
      <div className="space-y-2">
        <input className={`${campo} text-lg font-semibold`} value={bloco.texto} onChange={e => onMudar({ texto: e.target.value })} placeholder="Título da secção" />
        <Chips valor={bloco.nivel} opcoes={[{ id: "2", nome: "Título grande" }, { id: "3", nome: "Título menor" }]} onEscolher={nivel => onMudar({ nivel })} />
      </div>
    );
  }
  if (bloco.tipo === "imagem") {
    return (
      <CampoImagem url={bloco.url} alt={bloco.alt} legenda={bloco.legenda} aEnviar={aEnviar} onUrl={url => onMudar({ url })} onAlt={alt => onMudar({ alt })} onLegenda={legenda => onMudar({ legenda })} onFile={onFile} comLegenda />
    );
  }
  if (bloco.tipo === "hero") {
    return (
      <div className="space-y-2">
        <Chips
          valor={bloco.disposicao}
          opcoes={[
            { id: "texto-esquerda", nome: "Texto à esquerda" },
            { id: "texto-centro", nome: "Texto ao centro" },
            { id: "texto-direita", nome: "Texto à direita" },
          ]}
          onEscolher={disposicao => onMudar({ disposicao })}
        />
        <input className={`${campo} font-semibold`} value={bloco.titulo} onChange={e => onMudar({ titulo: e.target.value })} placeholder="Título do hero" />
        <textarea className={`${campo} min-h-20`} value={bloco.texto} onChange={e => onMudar({ texto: e.target.value })} placeholder="Texto de apoio" />
        <CampoImagem url={bloco.imagem} alt={bloco.alt} aEnviar={aEnviar} onUrl={imagem => onMudar({ imagem })} onAlt={alt => onMudar({ alt })} onFile={onFile} />
        <div className="grid gap-2 sm:grid-cols-2">
          <input className={campo} value={bloco.botao} onChange={e => onMudar({ botao: e.target.value })} placeholder="Texto do botão" />
          <input className={campo} value={bloco.destino} onChange={e => onMudar({ destino: e.target.value })} placeholder="Endereço do botão, por exemplo /formacao" />
        </div>
      </div>
    );
  }
  if (bloco.tipo === "seccao") {
    return (
      <div className="space-y-2">
        <Chips
          valor={bloco.disposicao}
          opcoes={[{ id: "imagem-esquerda", nome: "Imagem à esquerda" }, { id: "imagem-direita", nome: "Imagem à direita" }]}
          onEscolher={disposicao => onMudar({ disposicao })}
        />
        <input className={`${campo} font-semibold`} value={bloco.titulo} onChange={e => onMudar({ titulo: e.target.value })} placeholder="Título da secção" />
        <textarea className={`${campo} min-h-24`} value={bloco.texto} onChange={e => onMudar({ texto: e.target.value })} placeholder="Texto ao lado da imagem" />
        <CampoImagem url={bloco.imagem} alt={bloco.alt} aEnviar={aEnviar} onUrl={imagem => onMudar({ imagem })} onAlt={alt => onMudar({ alt })} onFile={onFile} />
      </div>
    );
  }
  if (bloco.tipo === "citacao") {
    return (
      <div className="space-y-2">
        <textarea className={`${campo} min-h-20`} value={bloco.texto} onChange={e => onMudar({ texto: e.target.value })} placeholder="A frase em destaque" />
        <input className={campo} value={bloco.autor} onChange={e => onMudar({ autor: e.target.value })} placeholder="Autor" />
      </div>
    );
  }
  if (bloco.tipo === "lista") {
    return <textarea className={`${campo} min-h-28`} value={bloco.itens} onChange={e => onMudar({ itens: e.target.value })} placeholder={"Um item por linha"} />;
  }
  if (bloco.tipo === "botao") {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        <input className={campo} value={bloco.rotulo} onChange={e => onMudar({ rotulo: e.target.value })} placeholder="Texto do botão" />
        <input className={campo} value={bloco.destino} onChange={e => onMudar({ destino: e.target.value })} placeholder="Endereço, por exemplo /formacao" />
      </div>
    );
  }
  return <p className="text-sm text-slate-500">No site aparece uma linha dourada entre os blocos.</p>;
}

function Chips({ valor, opcoes, onEscolher }: { valor: string; opcoes: { id: string; nome: string }[]; onEscolher: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {opcoes.map(opcao => (
        <button key={opcao.id} type="button" onClick={() => onEscolher(opcao.id)} className={`rounded-full border px-3 py-1 text-xs font-semibold ${valor === opcao.id ? "border-[#14263D] bg-[#14263D] text-white" : "border-slate-200 bg-white text-slate-600"}`}>
          {opcao.nome}
        </button>
      ))}
    </div>
  );
}

function CampoImagem({
  url, alt, legenda, aEnviar, onUrl, onAlt, onLegenda, onFile, comLegenda,
}: {
  url: string;
  alt: string;
  legenda?: string;
  aEnviar: boolean;
  onUrl: (url: string) => void;
  onAlt: (alt: string) => void;
  onLegenda?: (legenda: string) => void;
  onFile: (file: File) => void;
  comLegenda?: boolean;
}) {
  const segura = moradaSegura(url);
  return (
    <div className="space-y-2">
      {segura ? <img src={segura} alt={alt} className="h-36 w-full rounded-lg object-cover" /> : url.trim() ? <p className="rounded-lg bg-slate-100 px-3 py-6 text-center text-xs text-slate-500">O endereço da imagem não é válido.</p> : <div className="h-24 rounded-lg bg-[#E7EBF0]" />}
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="inline-flex shrink-0 cursor-pointer items-center">
          <span className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">{aEnviar ? "A gravar a imagem…" : "Carregar imagem"}</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            disabled={aEnviar}
            onChange={e => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) onFile(file);
            }}
          />
        </label>
        <input className={campo} value={url} onChange={e => onUrl(e.target.value)} placeholder="Ou cole o endereço da imagem" />
      </div>
      <input className={campo} value={alt} onChange={e => onAlt(e.target.value)} placeholder="Descrição da imagem" />
      {comLegenda && <input className={campo} value={legenda ?? ""} onChange={e => onLegenda?.(e.target.value)} placeholder="Legenda" />}
      <p className="text-[11px] text-slate-400">JPG, PNG, WebP ou GIF, até 8 MB.</p>
    </div>
  );
}
