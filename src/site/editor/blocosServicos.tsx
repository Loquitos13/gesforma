// Bloco «Serviços» (página Empresas): cartões com imagem, título, texto, lista de pontos e botão, todos editáveis.
import type { CSSProperties } from "react";
import type { ComponentConfig } from "@puckeditor/core";
import { Icon } from "../SiteLanding";
import { campoCor, campoImagem, campoNumero, simNao } from "./campos";
import { campoAparencia, campoTipografia } from "./camposGrupos";
import { corSegura, estiloBloco, estiloTexto, estiloVazio, juntar, lados, ligacaoSegura, tipoVazia, type Estilo, type Tipografia } from "./estilos";

type Servico = { imagem: string; etiqueta: string; titulo: string; texto: string; pontos: string; rotulo: string; ligacao: string };

type ServicosProps = {
  itens: Servico[]; colunas: number | null; colunasTab: number | null; colunasTel: number | null; espaco: number | null;
  mostrarBotoes: boolean; corBotao: string; tipoEtiqueta: Tipografia; tipoTitulo: Tipografia; tipoTexto: Tipografia;
  cartao: Estilo; aparencia: Estilo;
  puck?: { dragRef?: ((el: Element | null) => void) | null };
};

const novo = (titulo: string, texto: string, pontos: string): Servico =>
  ({ imagem: "", etiqueta: "", titulo, texto, pontos, rotulo: "Pedir proposta", ligacao: "#contactos" });

export const Servicos: ComponentConfig<ServicosProps> = {
  label: "Serviços",
  fields: {
    itens: {
      type: "array", label: "Serviços",
      arrayFields: {
        imagem: campoImagem("Imagem ou ícone (opcional)"),
        etiqueta: { type: "text", label: "Etiqueta (ex.: «Mais procurado»)" },
        titulo: { type: "text", label: "Título" },
        texto: { type: "textarea", label: "Descrição" },
        pontos: { type: "textarea", label: "Pontos (um por linha)" },
        rotulo: { type: "text", label: "Texto do botão (vazio = sem botão)" },
        ligacao: { type: "text", label: "Ligação do botão (página, #secção, mailto: ou tel:)" },
      },
      defaultItemProps: novo("Novo serviço", "", ""),
      getItemSummary: item => item.titulo || "Serviço",
    },
    colunas: campoNumero("Colunas (computador)", "") as never,
    colunasTab: campoNumero("Colunas (tablet)", "") as never,
    colunasTel: campoNumero("Colunas (telemóvel)", "") as never,
    espaco: campoNumero("Espaço entre cartões"),
    mostrarBotoes: simNao("Botões nos cartões"),
    corBotao: campoCor("Cor dos botões"),
    tipoEtiqueta: campoTipografia("Tipografia da etiqueta"),
    tipoTitulo: campoTipografia("Tipografia do título"),
    tipoTexto: campoTipografia("Tipografia do texto"),
    cartao: campoAparencia("Aparência de cada cartão"),
    aparencia: campoAparencia(),
  },
  defaultProps: {
    itens: [
      novo("Formação à medida", "Programas desenhados para os objetivos e o ritmo da sua equipa.", "Diagnóstico de necessidades\nConteúdos à medida\nPresencial, online ou misto"),
      novo("Formação certificada", "Cursos certificados pela DGERT, com certificado para cada colaborador.", "Entidade certificada DGERT\nCertificados no SIGO\nFormadores certificados"),
      novo("Gestão da formação obrigatória", "Tratamos das 40 horas anuais de formação a que os colaboradores têm direito.", "Plano anual de formação\nRelatório Único\nDossiê técnico-pedagógico"),
    ],
    colunas: 3, colunasTab: 2, colunasTel: 1, espaco: 24, mostrarBotoes: true, corBotao: "var(--c-destaque)",
    tipoEtiqueta: tipoVazia({ tamanho: 11, peso: "800", espacamento: 1.6, transformacao: "uppercase", cor: "var(--c-destaque)" }),
    tipoTitulo: tipoVazia({ tamanho: 20, peso: "700", cor: "var(--c-primaria)" }),
    tipoTexto: tipoVazia({ tamanho: 15, alturaLinha: 1.6, cor: "var(--c-suave)" }),
    cartao: estiloVazio({ fundoCor: "#ffffff", preenchimento: lados(28, 28), bordaTopo: 3, bordaCor: "var(--c-acento)" }),
    aparencia: estiloVazio(),
  },
  render: ({ puck, itens, colunas, colunasTab, colunasTel, espaco, mostrarBotoes, corBotao, tipoEtiqueta, tipoTitulo, tipoTexto, cartao, aparencia }) => {
    const c = estiloBloco(aparencia, {
      gap: espaco != null ? `${espaco}px` : undefined,
      ["--cols" as string]: String(colunas || 3), ["--cols-tab" as string]: String(colunasTab || 2), ["--cols-tel" as string]: String(colunasTel || 1),
    } as CSSProperties);
    const k = estiloBloco(cartao);
    const [te, tt, tx] = [estiloTexto(tipoEtiqueta), estiloTexto(tipoTitulo), estiloTexto(tipoTexto)];
    return (
      <div ref={puck?.dragRef ?? undefined} className={juntar(c.className, "ena-grelha")} style={c.style}>
        {(itens ?? []).map((s, i) => {
          const pontos = (s.pontos ?? "").split("\n").map(p => p.trim()).filter(Boolean);
          const href = ligacaoSegura(s.ligacao);
          return (
            <article key={i} className={juntar("flex h-full flex-col", k.className)} style={k.style}>
              {s.imagem && <img src={s.imagem} alt="" className="mb-5 h-14 w-14 object-contain" />}
              {s.etiqueta && <span className={juntar("mb-2 block", te.className)} style={te.style}>{s.etiqueta}</span>}
              {s.titulo && <h3 className={tt.className} style={tt.style}>{s.titulo}</h3>}
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
              {mostrarBotoes && s.rotulo && href && (
                <a href={href} className="mt-auto inline-flex w-fit items-center gap-2 pt-6 text-sm font-extrabold uppercase tracking-[0.06em] hover:underline"
                  style={{ color: corSegura(corBotao) || "var(--c-destaque)" }}>
                  {s.rotulo} <Icon name="arrow" className="h-4 w-4" />
                </a>
              )}
            </article>
          );
        })}
      </div>
    );
  },
};
