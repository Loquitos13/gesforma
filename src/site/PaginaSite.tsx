// Páginas do site feitas no editor visual: lê a versão publicada (ou o modelo base) e desenha-a.
// O cabeçalho, o rodapé e o tema da página inicial servem todas as outras páginas.
import { useEffect, useState } from "react";
import type { Data } from "@puckeditor/core";
import type { PaginaSite as Pagina } from "../partilhado/siteBlocos";
import { CabecalhoSite, type CabecalhoProps, RodapeSite, type RodapeProps } from "./editor/blocosMoldura";
import { configOutraPagina, configPaginaCurso, configSite, estiloTema, MolduraCtx, NoEcra, type Moldura, type TemaSite } from "./editor/config";
import { DesenharPagina } from "./editor/desenhar";
import { efetivas, type Disp } from "./editor/dispositivos";
import { modeloPagina } from "./editor/modeloBase";

const pedidos = new Map<Pagina, Promise<Data>>();

/** Uma só leitura por página e carregamento; sem versão publicada usa o modelo base. */
export function lerPagina(pagina: Pagina): Promise<Data> {
  let p = pedidos.get(pagina);
  if (!p) {
    p = fetch(`/api/v1/public/site/paginas/${pagina}`, { cache: "no-store" })
      .then(r => (r.ok ? r.json() as Promise<{ dados: Data | null }> : { dados: null }))
      .then(r => (r.dados && Array.isArray(r.dados.content) ? r.dados : modeloPagina(pagina)))
      .catch(() => modeloPagina(pagina));
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

/** Cabeçalho, rodapé e tema da página inicial (as outras páginas usam-nos). */
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
  if (pagina === "inicio") return <DesenharPagina config={configSite} dados={dados} />;
  return (
    <MolduraCtx.Provider value={moldura}>
      <DesenharPagina config={pagina === "curso" ? configPaginaCurso : configOutraPagina} dados={dados} />
    </MolduraCtx.Provider>
  );
}

export { CabecalhoSite, NoEcra, RodapeSite };
