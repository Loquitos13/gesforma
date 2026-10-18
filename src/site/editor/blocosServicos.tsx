// Bloco «Serviços» (página Empresas): um cartão por serviço ativo de Gestão › Empresas / Business, com ligação à página dele.
import type { CSSProperties } from "react";
import type { ComponentConfig } from "@puckeditor/core";
import { Icon } from "../SiteLanding";
import { campoCor, campoNumero, simNao } from "./campos";
import { campoAparencia, campoTipografia } from "./camposGrupos";
import { corSegura, estiloBloco, estiloTexto, estiloVazio, juntar, lados, ligacaoSegura, tipoVazia, type Estilo, type Tipografia } from "./estilos";
import { slugServico } from "../../partilhado/siteServicos";
import { useServicos } from "./blocosServico";

type ServicosProps = {
  aviso?: string; colunas: number | null; colunasTab: number | null; colunasTel: number | null; espaco: number | null;
  mostrarBotoes: boolean; textoPagina?: string; corBotao: string; tipoEtiqueta: Tipografia; tipoTitulo: Tipografia; tipoTexto: Tipografia;
  cartao: Estilo; aparencia: Estilo;
  puck?: { dragRef?: ((el: Element | null) => void) | null };
};

export const Servicos: ComponentConfig<ServicosProps> = {
  label: "Serviços",
  fields: {
    // Os serviços em si escrevem-se no backoffice; aqui só o aspeto dos cartões.
    aviso: {
      type: "custom", label: "Serviços",
      render: () => <p className="text-[12px] leading-5 text-[#6b7685]">Os serviços (textos, imagens, vídeo, logótipos, ordem) escrevem-se em <strong>Gestão › Empresas / Business</strong>. Aparecem aqui todos os ativos.</p>,
    } as never,
    colunas: campoNumero("Colunas (computador)", "") as never,
    colunasTab: campoNumero("Colunas (tablet)", "") as never,
    colunasTel: campoNumero("Colunas (telemóvel)", "") as never,
    espaco: campoNumero("Espaço entre cartões"),
    mostrarBotoes: simNao("Botões nos cartões"),
    textoPagina: { type: "text", label: "Texto da ligação à página de cada serviço (vazio = sem ligação)" },
    corBotao: campoCor("Cor dos botões"),
    tipoEtiqueta: campoTipografia("Tipografia da etiqueta"),
    tipoTitulo: campoTipografia("Tipografia do título"),
    tipoTexto: campoTipografia("Tipografia do texto"),
    cartao: campoAparencia("Aparência de cada cartão"),
    aparencia: campoAparencia(),
  },
  defaultProps: {
    colunas: 3, colunasTab: 2, colunasTel: 1, espaco: 16, mostrarBotoes: true, textoPagina: "Saber mais", corBotao: "var(--c-destaque)",
    tipoEtiqueta: tipoVazia({ tamanho: 11, peso: "800", espacamento: 1.6, transformacao: "uppercase", cor: "var(--c-destaque)" }),
    tipoTitulo: tipoVazia({ tamanho: 20, peso: "700", cor: "var(--c-primaria)" }),
    tipoTexto: tipoVazia({ tamanho: 15, alturaLinha: 1.6, cor: "var(--c-suave)" }),
    cartao: estiloVazio({ fundoCor: "#ffffff", preenchimento: lados(22, 24), bordaTopo: 3, bordaCor: "var(--c-acento)" }),
    aparencia: estiloVazio(),
  },
  render: function Render({ puck, colunas, colunasTab, colunasTel, espaco, mostrarBotoes, textoPagina = "Saber mais", corBotao, tipoEtiqueta, tipoTitulo, tipoTexto, cartao, aparencia }: ServicosProps) {
    const c = estiloBloco(aparencia, {
      gap: espaco != null ? `${espaco}px` : undefined,
      ["--cols" as string]: String(colunas || 3), ["--cols-tab" as string]: String(colunasTab || 2), ["--cols-tel" as string]: String(colunasTel || 1),
    } as CSSProperties);
    const itens = useServicos();
    const k = estiloBloco(cartao);
    const [te, tt, tx] = [estiloTexto(tipoEtiqueta), estiloTexto(tipoTitulo), estiloTexto(tipoTexto)];
    return (
      <div ref={puck?.dragRef ?? undefined} className={juntar(c.className, "ena-grelha")} style={c.style}>
        {(itens ?? []).map((s, i) => {
          const pontos = (s.pontos ?? "").split("\n").map(p => p.trim()).filter(Boolean);
          const href = ligacaoSegura(s.ligacao);
          const slug = slugServico(s);
          const pagina = slug ? `/empresas/${slug}` : "";
          const cor = corSegura(corBotao) || "var(--c-destaque)";
          return (
            <article key={i} className={juntar("flex h-full flex-col", k.className)} style={k.style}>
              {s.imagem && <img src={s.imagem} alt="" className="mb-5 h-14 w-14 object-contain" />}
              {s.etiqueta && <span className={juntar("mb-2 block", te.className)} style={te.style}>{s.etiqueta}</span>}
              {s.titulo && <h3 className={tt.className} style={tt.style}>{pagina && textoPagina ? <a href={pagina} className="hover:underline">{s.titulo}</a> : s.titulo}</h3>}
              {s.texto && <p className={juntar("mt-3 whitespace-pre-line", tx.className)} style={tx.style}>{s.texto}</p>}
              {pontos.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {pontos.map(p => (
                    <li key={p} className={juntar("flex gap-2", tx.className)} style={tx.style}>
                      <span style={{ color: corSegura(corBotao) || "var(--c-destaque)" }}><Icon name="check" className="mt-1 h-4 w-4 shrink-0" /></span>{p}
                    </li>
                  ))}
                </ul>
              )}
              {((mostrarBotoes && s.rotulo && href) || (pagina && textoPagina)) && (
                <div className="mt-auto flex flex-wrap gap-x-6 gap-y-2 pt-6">
                  {pagina && textoPagina && (
                    <a href={pagina} className="inline-flex w-fit items-center gap-2 text-sm font-extrabold uppercase tracking-[0.06em] hover:underline" style={{ color: cor }}>
                      {textoPagina}<span className="sr-only">: {s.titulo}</span> <Icon name="arrow" className="h-4 w-4" />
                    </a>
                  )}
                  {mostrarBotoes && s.rotulo && href && (
                    <a href={href} className="inline-flex w-fit items-center gap-2 text-sm font-extrabold uppercase tracking-[0.06em] hover:underline" style={{ color: cor }}>
                      {s.rotulo} <Icon name="arrow" className="h-4 w-4" />
                    </a>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    );
  },
};
