import { useState } from "react";
import { videoDoCurso } from "../../../../partilhado/siteServicos";
import { normalizarCodigoCurso } from "../../../../partilhado/codigoCurso";
import { LISTA_CNAEF } from "../../../../partilhado/execucaoFisica";
import { SearchSelect } from "../../../../partilhado/FormKit";
import { Cartao, Campo, Entrada } from "../../../../partilhado/ui";
import { RecorteMiniatura, type FonteRecorte } from "../../../RecorteMiniatura";
import { slugify, urlImagem, type MediaSlot } from "./modelo";
import type { FichaCurso } from "./useFichaCurso";

function CartaoImagem({ rotulo, ajuda, valor, aGravar, desativado, onFicheiro, onClick }: {
  rotulo: string; ajuda: string; valor: MediaSlot | null; aGravar: boolean; desativado?: boolean;
  onFicheiro?: (f: File) => void; onClick?: () => void;
}) {
  const src = urlImagem(valor?.url);
  const conteudo = (
    <>
      {src ? <img src={src} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
        : <span className="pointer-events-none absolute inset-0 grid place-items-center text-[13px] text-tinta-suave">{desativado ? "Grave o curso primeiro" : "Arrastar ou clicar"}</span>}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/55 to-transparent px-3 py-2 text-[12px] text-white">
        <span className="truncate">{valor?.name || rotulo}</span>
        <span className="rounded bg-white/20 px-2 py-0.5 font-semibold">{aGravar ? "A gravar…" : onClick ? "Recortar" : "Alterar"}</span>
      </span>
    </>
  );
  const classe = "relative block h-40 w-full overflow-hidden rounded-cartao border-2 border-dashed border-linha-forte bg-fundo hover:border-ligacao focus-within:ring-2 focus-within:ring-ligacao";
  return (
    <div>
      <p className="m-0 mb-1.5 text-[13px] font-medium text-tinta">{rotulo}</p>
      {onClick ? (
        <button type="button" disabled={desativado || aGravar} aria-label={`${rotulo}: recortar`} className={`${classe} disabled:opacity-60`} onClick={onClick}>{conteudo}</button>
      ) : (
        <label
          className={`${classe} ${desativado ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f && !desativado) onFicheiro?.(f); }}
        >
          {conteudo}
          <input
            type="file" accept="image/jpeg,image/png,image/webp,image/gif" aria-label={rotulo} disabled={desativado || aGravar}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onFicheiro?.(f); }}
          />
        </label>
      )}
      <p className="m-0 mt-1 text-xs text-tinta-suave">{ajuda}</p>
    </div>
  );
}

export function TabIdentidade({ f }: { f: FichaCurso }) {
  const { data, patch, falhas, regime, cursoId, imagemAGravar, carregarImagem } = f;
  const [slugLivre, setSlugLivre] = useState(false);
  const [recorte, setRecorte] = useState<{ aberto: boolean; ficheiro: File | null }>({ aberto: false, ficheiro: null });
  const semId = cursoId == null;

  const fontes = ([
    urlImagem(data.banner?.url) ? { id: "banner", rotulo: "Banner", nome: data.banner?.name || "banner.jpg", url: urlImagem(data.banner?.url) } : null,
    urlImagem(data.capa?.url) ? { id: "capa", rotulo: "Capa", nome: data.capa?.name || "capa.jpg", url: urlImagem(data.capa?.url) } : null,
  ] as (FonteRecorte | null)[]).filter((x): x is FonteRecorte => Boolean(x));

  return (
    <div className="space-y-4">
      <Cartao titulo="Imagens" subtitulo="O banner abre a página do curso. A capa, inteira, entra no cartão do curso. A miniatura é um recorte 2:3 para o catálogo.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <CartaoImagem rotulo="Banner" ajuda="Recomendado 1600×600." valor={data.banner} aGravar={imagemAGravar === "banner"} desativado={semId} onFicheiro={x => void carregarImagem("banner", x)} />
          <CartaoImagem rotulo="Capa" ajuda="JPG, PNG, WebP ou GIF, até 8 MB." valor={data.capa} aGravar={imagemAGravar === "capa"} desativado={semId} onFicheiro={x => void carregarImagem("capa", x)} />
          <CartaoImagem rotulo="Miniatura" ajuda="Recorte do banner, da capa ou de outra fotografia." valor={data.miniatura} aGravar={imagemAGravar === "miniatura"} desativado={semId} onClick={() => setRecorte({ aberto: true, ficheiro: null })} />
        </div>
      </Cartao>

      <Cartao titulo="O que o visitante lê">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Campo className="sm:col-span-3" rotulo={regime === "fin" ? "Nome comercial" : "Título"} obrigatorio erro={falhas.titulo}
            ajuda={regime === "fin" ? "Título no site. Pode ser mais comercial do que a designação oficial da UFCD." : "Nome no site. Evite códigos internos."}>
            {p => (
              <Entrada {...p} value={data.titulo}
                onChange={e => patch({ titulo: e.target.value, slug: slugLivre ? data.slug : slugify(e.target.value) })}
                onBlur={() => { if (semId) void f.guardar({ rascunho: true }); }} />
            )}
          </Campo>
          {regime === "fin" && (
            <>
              <Campo rotulo="Código UFCD ou UC" obrigatorio erro={falhas.ufcdCod} ajuda="Do Catálogo Nacional de Qualificações: 8995 (UFCD) ou UC00277.">
                {p => <Entrada {...p} value={data.ufcdCod} placeholder="8995 ou UC00277" onChange={e => patch({ ufcdCod: normalizarCodigoCurso(e.target.value) })} />}
              </Campo>
              <Campo className="sm:col-span-2" rotulo="Designação oficial" obrigatorio erro={falhas.ufcd} ajuda="Nome da UFCD no CNQ.">
                {p => <Entrada {...p} value={data.ufcd} onChange={e => patch({ ufcd: e.target.value })} />}
              </Campo>
              {/* O seletor com pesquisa não é um input: o rótulo vai à parte. */}
              <div className="sm:col-span-3 min-w-0">
                <span className="mb-1 block text-xs font-semibold text-[#3A4352]">Área de formação (CNAEF)</span>
                <SearchSelect value={data.areaCnaef} onChange={v => patch({ areaCnaef: v })} allowEmpty emptyLabel="Escolher…"
                  placeholder="Pesquisar área ou código…" options={LISTA_CNAEF.map(value => ({ value }))} />
                <span className="mt-1 block text-xs text-tinta-suave">A coluna «Área de Formação» da execução física do reembolso.</span>
              </div>
            </>
          )}
          <Campo className="sm:col-span-2" rotulo="Endereço da página" obrigatorio erro={falhas.slug} ajuda="Mudar o endereço de uma página publicada parte as ligações antigas.">
            {p => (
              <div className="flex items-center rounded-controlo border border-linha-forte bg-fundo">
                <span className="px-3 text-xs text-tinta-suave whitespace-nowrap">/formacao/</span>
                <Entrada {...p} className="rounded-l-none border-0 border-l border-linha" value={data.slug}
                  onChange={e => { setSlugLivre(true); patch({ slug: slugify(e.target.value) }); }} />
              </div>
            )}
          </Campo>
          <Campo rotulo="Vídeo de apresentação"
            ajuda={data.video && !videoDoCurso(data.video)
              ? "Não reconhecido: use o endereço do YouTube ou do Vimeo (ou o ID do YouTube), ou um ficheiro .mp4 com https."
              : "Endereço do YouTube ou do Vimeo (ou o ID do YouTube). Aparece na página do curso; a posição e o tamanho mudam-se no editor do site (bloco «Curso · Vídeo de apresentação»)."}>
            {p => <Entrada {...p} value={data.video} placeholder="https://www.youtube.com/watch?v=…" onChange={e => patch({ video: e.target.value.trim() })} />}
          </Campo>
        </div>
      </Cartao>

      {recorte.aberto && (
        <RecorteMiniatura
          fontes={fontes}
          ficheiroInicial={recorte.ficheiro}
          aGravar={imagemAGravar === "miniatura"}
          onCancelar={() => setRecorte({ aberto: false, ficheiro: null })}
          onConfirmar={async file => { if (await carregarImagem("miniatura", file)) setRecorte({ aberto: false, ficheiro: null }); }}
        />
      )}
    </div>
  );
}
