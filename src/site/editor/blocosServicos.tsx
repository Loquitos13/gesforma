// Bloco «Serviços» (página Empresas): um cartão por serviço ativo de Gestão › Empresas / Business, com ligação à página dele.
import type { CSSProperties } from "react";
import type { ComponentConfig } from "@puckeditor/core";
import { Icon } from "../SiteLanding";
import { campoCor, campoNumero } from "./campos";
import { campoAparencia, campoTipografia } from "./camposGrupos";
import { corSegura, estiloBloco, estiloTexto, estiloVazio, juntar, lados, tipoVazia, type Estilo, type Tipografia } from "./estilos";
import { servicosDeTopo, slugServico } from "../../partilhado/siteServicos";
import { TextoEmLinha, TextoFormatado } from "../../partilhado/TextoFormatadoVista";
import { linhasPontos } from "../../partilhado/textoFormatado";
import { campoServico, useServicos } from "./blocosServico";

/** Textos do cartão de um serviço só nesta página (vazio = os do backoffice). */
type TextosCartao = { slug: string; titulo: string; texto: string; pontos: string };

type ServicosProps = {
  aviso?: string; porServico?: TextosCartao[]; colunas: number | null; colunasTab: number | null; colunasTel: number | null; espaco: number | null;
  textoPagina?: string; corBotao: string; tipoEtiqueta: Tipografia; tipoTitulo: Tipografia; tipoTexto: Tipografia;
  cartao: Estilo; aparencia: Estilo;
  puck?: { dragRef?: ((el: Element | null) => void) | null };
};

export const Servicos: ComponentConfig<ServicosProps> = {
  label: "Serviços",
  fields: {
    // Os serviços em si escrevem-se no backoffice; aqui só o aspeto dos cartões.
    aviso: {
      type: "custom", label: "Serviços",
      render: () => <p className="text-[12px] leading-5 text-[#6b7685]">Os serviços (textos, imagens, vídeo, logótipos, ordem) escrevem-se em <strong>Gestão › Empresas / Business</strong>. Aparecem aqui todos os ativos, menos os que estão dentro de outro serviço (esses aparecem na página dele).</p>,
    } as never,
    porServico: {
      // Atenção: o que se escrever aqui passa à frente do texto do backoffice (que avisa, na ficha do serviço, quando isto acontece).
      type: "array", label: "Textos só desta página (passam à frente dos de Gestão › Empresas / Business; vazio = os de lá)",
      arrayFields: {
        slug: campoServico("Serviço"),
        titulo: { type: "text", label: "Título no cartão" },
        texto: { type: "textarea", label: "Descrição no cartão" },
        pontos: { type: "textarea", label: "Pontos no cartão (um por linha)" },
      },
      defaultItemProps: { slug: "", titulo: "", texto: "", pontos: "" },
      getItemSummary: (item: TextosCartao) => item.titulo || item.slug || "Escolha o serviço",
    } as never,
    colunas: campoNumero("Colunas (computador)", "") as never,
    colunasTab: campoNumero("Colunas (tablet)", "") as never,
    colunasTel: campoNumero("Colunas (telemóvel)", "") as never,
    espaco: campoNumero("Espaço entre cartões"),
    textoPagina: { type: "text", label: "Texto da ligação à página de cada serviço (vazio = sem ligação)" },
    corBotao: campoCor("Cor dos botões"),
    tipoEtiqueta: campoTipografia("Tipografia da etiqueta"),
    tipoTitulo: campoTipografia("Tipografia do título"),
    tipoTexto: campoTipografia("Tipografia do texto"),
    cartao: campoAparencia("Aparência de cada cartão"),
    aparencia: campoAparencia(),
  },
  defaultProps: {
    porServico: [],
    colunas: 3, colunasTab: 2, colunasTel: 1, espaco: 16, textoPagina: "Saber mais", corBotao: "var(--c-destaque)",
    tipoEtiqueta: tipoVazia({ tamanho: 11, peso: "800", espacamento: 1.6, transformacao: "uppercase", cor: "var(--c-destaque)" }),
    tipoTitulo: tipoVazia({ tamanho: 20, peso: "700", cor: "var(--c-primaria)" }),
    tipoTexto: tipoVazia({ tamanho: 15, alturaLinha: 1.6, cor: "var(--c-suave)" }),
    cartao: estiloVazio({ fundoCor: "#ffffff", preenchimento: lados(22, 24), bordaTopo: 3, bordaCor: "var(--c-acento)" }),
    aparencia: estiloVazio(),
  },
  render: function Render({ puck, porServico, colunas, colunasTab, colunasTel, espaco, textoPagina = "Saber mais", corBotao, tipoEtiqueta, tipoTitulo, tipoTexto, cartao, aparencia }: ServicosProps) {
    const c = estiloBloco(aparencia, {
      gap: espaco != null ? `${espaco}px` : undefined,
      ["--cols" as string]: String(colunas || 3), ["--cols-tab" as string]: String(colunasTab || 2), ["--cols-tel" as string]: String(colunasTel || 1),
    } as CSSProperties);
    const itens = useServicos();
    const k = estiloBloco(cartao);
    const [te, tt, tx] = [estiloTexto(tipoEtiqueta), estiloTexto(tipoTitulo), estiloTexto(tipoTexto)];
    return (
      <div ref={puck?.dragRef ?? undefined} className={juntar(c.className, "ena-grelha")} style={c.style}>
        {/* Os serviços «dentro» de outro (ex.: os dois da Certifica) aparecem na página dele, não aqui. */}
        {servicosDeTopo(itens ?? []).map((original, i) => {
          const proprio = (porServico ?? []).find(x => x.slug && x.slug === original.slug);
          // Cada texto do cartão pode mudar só nesta página; o que ficar vazio vem do backoffice.
          const s = { ...original, titulo: proprio?.titulo?.trim() || original.titulo, texto: proprio?.texto?.trim() || original.texto, pontos: proprio?.pontos?.trim() || original.pontos };
          const pontos = linhasPontos(s.pontos);
          const slug = slugServico(s);
          const pagina = slug ? `/empresas/${slug}` : "";
          const cor = corSegura(corBotao) || "var(--c-destaque)";
          return (
            <article key={i} className={juntar("flex h-full flex-col", k.className)} style={k.style}>
              {s.imagem && <img src={s.imagem} alt="" className="mb-5 h-14 w-14 object-contain" />}
              {s.etiqueta && <span className={juntar("mb-2 block", te.className)} style={te.style}>{s.etiqueta}</span>}
              {s.titulo && <h3 className={tt.className} style={tt.style}>{pagina && textoPagina ? <a href={pagina} className="hover:underline">{s.titulo}</a> : s.titulo}</h3>}
              <TextoFormatado texto={s.texto} className={juntar("mt-3", tx.className)} style={tx.style} nivel={4} />
              {pontos.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {pontos.map((p, j) => (
                    <li key={j} className={juntar("flex gap-2", tx.className)} style={tx.style}>
                      <span style={{ color: corSegura(corBotao) || "var(--c-destaque)" }}><Icon name="check" className="mt-1 h-4 w-4 shrink-0" /></span><span><TextoEmLinha texto={p} /></span>
                    </li>
                  ))}
                </ul>
              )}
              {/* O «Pedir proposta» fica só na página do serviço; o cartão leva lá. */}
              {pagina && textoPagina && (
                <a href={pagina} className="mt-auto inline-flex w-fit items-center gap-2 pt-6 text-sm font-extrabold uppercase tracking-[0.06em] hover:underline" style={{ color: cor }}>
                  {textoPagina}<span className="sr-only">: {s.titulo}</span> <Icon name="arrow" className="h-4 w-4" />
                </a>
              )}
            </article>
          );
        })}
      </div>
    );
  },
};
