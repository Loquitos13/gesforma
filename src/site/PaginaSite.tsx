// Páginas do site feitas no editor visual: lê a versão publicada (ou o modelo base) e desenha-a.
// O cabeçalho, o rodapé e o tema da página inicial servem todas as outras páginas.
import { useEffect, useMemo, useState } from "react";
import type { Data } from "@puckeditor/core";
import type { PaginaSite as Pagina } from "../partilhado/siteBlocos";
import { CabecalhoSite, type CabecalhoProps, RodapeSite, type RodapeProps } from "./editor/blocosMoldura";
import { configPara, configSite, estiloTema, MolduraCtx, NoEcra, type Moldura, type TemaSite } from "./editor/config";
import { DesenharPagina } from "./editor/desenhar";
import { efetivas, type Disp } from "./editor/dispositivos";
import { converterPaginaCurso, modeloPagina } from "./editor/modeloBase";

const pedidos = new Map<Pagina, Promise<Data>>();

/** Sem versão publicada: o modelo base; «Cabeçalho e rodapé» fica vazio (valem os da página inicial). */
const semPublicada = (pagina: Pagina): Data => (pagina === "moldura" ? { root: { props: {} }, content: [] } as Data : modeloPagina(pagina));

/** Uma só leitura por página e carregamento; sem versão publicada usa o modelo base. */
export function lerPagina(pagina: Pagina): Promise<Data> {
  let p = pedidos.get(pagina);
  if (!p) {
    p = fetch(`/api/v1/public/site/paginas/${pagina}`, { cache: "no-store" })
      .then(r => (r.ok ? r.json() as Promise<{ dados: Data | null }> : { dados: null }))
      .then(r => (r.dados && Array.isArray(r.dados.content) ? r.dados : semPublicada(pagina)))
      .catch(() => semPublicada(pagina));
    pedidos.set(pagina, p);
  }
  return p;
}

export function usePagina(pagina: Pagina | null) {
  const [dados, setDados] = useState<Data | null>(null);
  useEffect(() => {
    if (!pagina) return;
    let vivo = true;
    void lerPagina(pagina).then(d => { if (vivo) setDados(d); });
    return () => { vivo = false; };
  }, [pagina]);
  return dados;
}

/**
 * Cabeçalho e rodapé de «Cabeçalho e rodapé» (os da página inicial, enquanto essa página não os tiver) e o tema da
 * página inicial: servem todas as páginas do site.
 */
export function molduraDoSite(inicio: Data | null, moldura: Data | null): Moldura | null {
  const base = molduraDaPagina(inicio);
  const propria = molduraDaPagina(moldura);
  if (!base && !propria) return null;
  return { cabecalho: propria?.cabecalho ?? base?.cabecalho ?? null, rodape: propria?.rodape ?? base?.rodape ?? null, tema: base?.tema };
}

/** Cabeçalho, rodapé e tema de uma página do editor. */
export function molduraDaPagina(dados: Data | null): Moldura | null {
  if (!dados) return null;
  const cab = dados.content.find(b => b.type === "Cabecalho")?.props as CabecalhoProps | undefined;
  const rod = dados.content.find(b => b.type === "Rodape")?.props as RodapeProps | undefined;
  return { cabecalho: cab ?? null, rodape: rod ?? null, tema: dados.root?.props as Partial<TemaSite> | undefined };
}

/** Tema da página inicial com os valores do ecrã (fora das páginas do editor). */
export const estiloDaMoldura = (m: Moldura | null, d: Disp) =>
  (m ? estiloTema(efetivas((m.tema ?? {}) as Record<string, unknown>, d, []) as Partial<TemaSite>) : undefined);

/** Desenha uma página do editor; as que não são a inicial levam o cabeçalho e o rodapé da inicial. */
export function PaginaSite({ pagina, dados, moldura }: { pagina: Pagina; dados: Data; moldura: Moldura | null }) {
  // Uma vez por versão da página (não a cada desenho: o vídeo recomeçava).
  const convertida = useMemo(() => (pagina === "curso" ? converterPaginaCurso(dados) : dados), [pagina, dados]);
  if (pagina === "inicio") return <MolduraCtx.Provider value={moldura}><DesenharPagina config={configSite} dados={dados} /></MolduraCtx.Provider>;
  return (
    <MolduraCtx.Provider value={moldura}>
      {/* Página do curso gravada antes de blocos novos (ex.: vídeo de apresentação): mostra-os já, sem publicar de novo. */}
      <DesenharPagina config={configPara(pagina)} dados={convertida} />
    </MolduraCtx.Provider>
  );
}

export { CabecalhoSite, NoEcra, RodapeSite };
