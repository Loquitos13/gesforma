// Bloco "Lista de notícias": os artigos activos do blog (Gestão › Blog), com filtro por temática.
import { useEffect, useState, type CSSProperties } from "react";
import type { ComponentConfig } from "@puckeditor/core";
import { apiNoticias } from "../../partilhado/api/publico";
import { campoCor, campoNumero, simNao } from "./campos";
import { campoAparencia, campoTipografia } from "./camposGrupos";
import { corSegura, estiloBloco, estiloTexto, estiloVazio, juntar, lados, tipoVazia, type Estilo, type Tipografia } from "./estilos";

type Noticia = { titulo: string; slug: string; data: string; tematica: string; excerto: string };

function dataPt(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" });
}

let pedido: Promise<Noticia[]> | null = null;
const lerNoticias = () => (pedido ??= apiNoticias().then(r => r.noticias).catch(e => { pedido = null; throw e; }));

type Props = {
  filtros: boolean; limite: number | null; colunas: number | null; colunasTab?: number | null; colunasTel?: number | null; espaco: number | null;
  mostrarData: boolean; mostrarTema: boolean; mostrarExcerto: boolean; textoVazio: string;
  corFiltroAtivo: string; tipoTitulo: Tipografia; cartao: Estilo; aparencia: Estilo;
};

function ListaVista(p: Props) {
  const [itens, setItens] = useState<Noticia[] | null>(null);
  const [erro, setErro] = useState(false);
  const [tema, setTema] = useState("Todas");
  useEffect(() => { lerNoticias().then(setItens).catch(() => setErro(true)); }, []);
  const temas = ["Todas", ...new Set((itens ?? []).map(i => i.tematica).filter(Boolean))];
  const visiveis = (itens ?? []).filter(i => tema === "Todas" || i.tematica === tema).slice(0, p.limite && p.limite > 0 ? p.limite : undefined);
  const c = estiloBloco(p.aparencia);
  const k = estiloBloco(p.cartao);
  const t = estiloTexto(p.tipoTitulo);
  const ativo = corSegura(p.corFiltroAtivo) ?? "var(--c-primaria)";
  const grelha = { gap: `${p.espaco ?? 20}px`, ["--cols" as string]: String(p.colunas || 2), ["--cols-tab" as string]: String(p.colunasTab ?? Math.min(p.colunas || 2, 2)), ["--cols-tel" as string]: String(p.colunasTel || 1) } as CSSProperties;
  return (
    <div className={c.className} style={c.style}>
      {p.filtros && temas.length > 1 && (
        <div className="mb-8 flex flex-wrap gap-2">
          {temas.map(x => (
            <button key={x} type="button" onClick={() => setTema(x)} aria-pressed={tema === x}
              className="px-4 py-2 text-sm font-bold" style={tema === x ? { background: ativo, color: "#fff" } : { background: "#fff" }}>{x}</button>
          ))}
        </div>
      )}
      {erro && <p className="text-sm font-semibold text-[var(--c-destaque)]">Não foi possível ler as notícias.</p>}
      {itens && visiveis.length === 0 && <p className="text-sm opacity-60">{p.textoVazio}</p>}
      {!itens && !erro && <p className="text-sm opacity-60">A carregar as notícias…</p>}
      <div className="ena-grelha" style={grelha}>
        {visiveis.map(i => (
          <a key={i.slug} href={`/noticias/${encodeURIComponent(i.slug)}`} className={juntar(k.className, "block transition hover:brightness-95")} style={k.style}>
            {(p.mostrarTema || p.mostrarData) && (
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--c-destaque)]">
                {[p.mostrarTema ? i.tematica || "Notícia" : "", p.mostrarData ? dataPt(i.data) : ""].filter(Boolean).join(" · ")}
              </span>
            )}
            <h2 className={juntar("mt-3", t.className)} style={t.style}>{i.titulo}</h2>
            {p.mostrarExcerto && i.excerto && <p className="mt-3 text-sm leading-6 opacity-60">{i.excerto}</p>}
          </a>
        ))}
      </div>
    </div>
  );
}

export const ListaNoticias: ComponentConfig<Props> = {
  label: "Lista de notícias",
  fields: {
    filtros: simNao("Filtro por temática"),
    limite: campoNumero("Máximo de notícias (vazio = todas)", ""),
    colunas: campoNumero("Colunas", ""),
    espaco: campoNumero("Espaço entre notícias"),
    mostrarData: simNao("Mostrar a data"),
    mostrarTema: simNao("Mostrar a temática"),
    mostrarExcerto: simNao("Mostrar o resumo"),
    textoVazio: { type: "text", label: "Texto quando não há notícias" },
    corFiltroAtivo: campoCor("Cor do filtro ativo"),
    tipoTitulo: campoTipografia("Tipografia do título"),
    cartao: campoAparencia("Aparência de cada notícia"),
    aparencia: campoAparencia(),
  },
  defaultProps: {
    filtros: true, limite: null, colunas: 2, colunasTel: 1, espaco: 20, mostrarData: true, mostrarTema: true, mostrarExcerto: true,
    textoVazio: "Ainda não há artigos publicados.", corFiltroAtivo: "var(--c-primaria)",
    tipoTitulo: tipoVazia({ fonte: "tema-titulos", tamanho: 24, peso: "700", cor: "var(--c-primaria)" }),
    cartao: estiloVazio({ fundoCor: "#ffffff", preenchimento: lados(24), bordaLargura: 1, bordaCor: "rgba(28,51,80,0.1)" }),
    aparencia: estiloVazio(),
  },
  render: ({ puck: _p, ...p }) => <ListaVista {...(p as Props)} />,
};
