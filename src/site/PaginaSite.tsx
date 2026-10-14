// Páginas do site feitas no editor visual: lê a versão publicada (ou o modelo base) e desenha-a.
// O cabeçalho e o rodapé da página inicial servem também as outras páginas do site.
import { useEffect, useState } from "react";
import type { Data } from "@puckeditor/core";
import type { PaginaSite as Pagina } from "../partilhado/siteBlocos";
import { CabecalhoSite, type CabecalhoProps, RodapeSite, type RodapeProps } from "./editor/blocosMoldura";
import { configSite, estiloTema, type TemaSite } from "./editor/config";
import { DesenharPagina } from "./editor/desenhar";
import { modeloInicio } from "./editor/modeloBase";

const pedidos = new Map<Pagina, Promise<Data>>();

/** Uma só leitura por página e carregamento; sem versão publicada usa o modelo base. */
export function lerPagina(pagina: Pagina): Promise<Data> {
  let p = pedidos.get(pagina);
  if (!p) {
    p = fetch(`/api/v1/public/site/paginas/${pagina}`, { cache: "no-store" })
      .then(r => (r.ok ? r.json() as Promise<{ dados: Data | null }> : { dados: null }))
      .then(r => (r.dados && Array.isArray(r.dados.content) ? r.dados : modeloInicio()))
      .catch(() => modeloInicio());
    pedidos.set(pagina, p);
  }
  return p;
}

export function usePagina(pagina: Pagina) {
  const [dados, setDados] = useState<Data | null>(null);
  useEffect(() => {
    let vivo = true;
    void lerPagina(pagina).then(d => { if (vivo) setDados(d); });
    return () => { vivo = false; };
  }, [pagina]);
  return dados;
}

export function PaginaSite({ dados }: { dados: Data }) {
  return <DesenharPagina config={configSite} dados={dados} />;
}

/** Cabeçalho, rodapé e tema da página inicial publicada, para as outras páginas do site. */
export function molduraDaPagina(dados: Data | null) {
  if (!dados) return null;
  const cab = dados.content.find(b => b.type === "Cabecalho")?.props as CabecalhoProps | undefined;
  const rod = dados.content.find(b => b.type === "Rodape")?.props as RodapeProps | undefined;
  return { cabecalho: cab ?? null, rodape: rod ?? null, tema: estiloTema(dados.root?.props as Partial<TemaSite> | undefined) };
}

export { CabecalhoSite, RodapeSite };
