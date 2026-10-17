// Bloco «Testemunhos»: opiniões de formandos (editáveis) e um botão que leva às avaliações da ENA no Google.
import type { CSSProperties } from "react";
import type { ComponentConfig } from "@puckeditor/core";
import { Icon } from "../SiteLanding";
import { campoCor, campoImagem, campoNumero, simNao } from "./campos";
import { campoAparencia, campoTipografia } from "./camposGrupos";
import { corSegura, estiloBloco, estiloTexto, estiloVazio, juntar, lados, ligacaoSegura, tipoVazia, type Estilo, type Tipografia } from "./estilos";

type Testemunho = { nome: string; curso: string; texto: string; estrelas: number | null; foto: string };

type TestemunhosProps = {
  titulo: string; tipoTitulo: Tipografia;
  itens: Testemunho[]; colunas: number | null; colunasTab: number | null; colunasTel: number | null; espaco: number | null;
  corEstrelas: string; tipoTexto: Tipografia; tipoNome: Tipografia; tipoCurso: Tipografia; tipoBotao: Tipografia;
  tamanhoFoto: number | null; alinhar: "esquerda" | "centro";
  mostrarBotao: boolean; textoBotao: string; ligacaoBotao: string; corBotao: string; corTextoBotao: string;
  cartao: Estilo; aparencia: Estilo;
  puck?: { dragRef?: ((el: Element | null) => void) | null };
};

export const Testemunhos: ComponentConfig<TestemunhosProps> = {
  label: "Testemunhos",
  fields: {
    titulo: { type: "text", label: "Título (vazio = esconder)" },
    tipoTitulo: campoTipografia("Tipografia do título"),
    itens: {
      type: "array", label: "Testemunhos",
      arrayFields: {
        nome: { type: "text", label: "Nome" },
        curso: { type: "text", label: "Curso (opcional)" },
        texto: { type: "textarea", label: "Testemunho" },
        estrelas: campoNumero("Estrelas (1 a 5, vazio = sem estrelas)", "") as never,
        foto: campoImagem("Fotografia (opcional)") as never,
      },
      defaultItemProps: { nome: "", curso: "", texto: "", estrelas: 5, foto: "" },
      getItemSummary: item => item.nome || "Testemunho",
    },
    colunas: campoNumero("Colunas (computador)", "") as never,
    colunasTab: campoNumero("Colunas (tablet)", "") as never,
    colunasTel: campoNumero("Colunas (telemóvel)", "") as never,
    espaco: campoNumero("Espaço entre cartões"),
    corEstrelas: campoCor("Cor das estrelas"),
    tipoTexto: campoTipografia("Tipografia do testemunho"),
    tipoNome: campoTipografia("Tipografia do nome"),
    tipoCurso: campoTipografia("Tipografia do curso"),
    tamanhoFoto: campoNumero("Tamanho da fotografia"),
    alinhar: { type: "radio", label: "Título, cartões e botão", options: [{ label: "À esquerda", value: "esquerda" }, { label: "Ao centro", value: "centro" }] },
    mostrarBotao: simNao("Botão para as avaliações no Google"),
    textoBotao: { type: "text", label: "Texto do botão" },
    ligacaoBotao: { type: "text", label: "Ligação do botão (o endereço de avaliações da ENA no Google)" },
    corBotao: campoCor("Cor do botão"),
    corTextoBotao: campoCor("Cor do texto do botão"),
    tipoBotao: campoTipografia("Tipografia do botão"),
    cartao: campoAparencia("Tamanho e aparência de cada cartão (largura, altura mínima, espaço interior, bordas, sombra)"),
    aparencia: campoAparencia(),
  },
  defaultProps: {
    titulo: "O que dizem os nossos formandos", tipoTitulo: tipoVazia({ fonte: "tema-titulos", tamanho: 32, peso: "700", cor: "var(--c-primaria)" }),
    itens: [],
    colunas: 3, colunasTab: 2, colunasTel: 1, espaco: 24, corEstrelas: "var(--c-acento)",
    tipoTexto: tipoVazia({ tamanho: 15, alturaLinha: 1.6, cor: "var(--c-suave)" }),
    tipoNome: tipoVazia({ tamanho: 14, peso: "800", cor: "var(--c-primaria)" }),
    tipoCurso: tipoVazia({ tamanho: 12, cor: "var(--c-suave)" }), tipoBotao: tipoVazia(),
    tamanhoFoto: 40, alinhar: "esquerda",
    mostrarBotao: true, textoBotao: "Veja e deixe a sua avaliação no Google",
    // shortcut: pesquisa genérica; trocar pelo link «Pedir avaliações» do Perfil da Empresa da ENA no Google.
    ligacaoBotao: "https://www.google.com/search?q=ena",
    corBotao: "var(--c-primaria)", corTextoBotao: "#ffffff",
    cartao: estiloVazio({ fundoCor: "#ffffff", preenchimento: lados(24, 24), bordaTopo: 3, bordaCor: "var(--c-acento)" }),
    aparencia: estiloVazio({ margem: lados(48, 0, 0, 0) }),
  },
  render: ({ puck, titulo, tipoTitulo, itens, colunas, colunasTab, colunasTel, espaco, corEstrelas, tipoTexto, tipoNome, tipoCurso, tipoBotao, tamanhoFoto, alinhar, mostrarBotao, textoBotao, ligacaoBotao, corBotao, corTextoBotao, cartao, aparencia }) => {
    const c = estiloBloco(aparencia);
    const k = estiloBloco(cartao);
    const [tt, tx, tn, tc, tb] = [estiloTexto(tipoTitulo), estiloTexto(tipoTexto), estiloTexto(tipoNome), estiloTexto(tipoCurso), estiloTexto(tipoBotao)];
    const href = ligacaoSegura(ligacaoBotao);
    const lista = (itens ?? []).filter(t => t.texto?.trim() || t.nome?.trim());
    const centro = alinhar === "centro";
    const foto = `${tamanhoFoto ?? 40}px`;
    return (
      <section ref={puck?.dragRef ?? undefined} className={juntar(c.className, "flex flex-col", centro ? "items-center text-center" : "items-start")} style={c.style}>
        {titulo && <h2 className={tt.className} style={tt.style}>{titulo}</h2>}
        {lista.length > 0 && (
          <div className="ena-grelha mt-6 w-full" style={{
            justifyItems: centro ? "center" : undefined,
            gap: `${espaco ?? 24}px`,
            ["--cols" as string]: String(colunas || 3), ["--cols-tab" as string]: String(colunasTab || 2), ["--cols-tel" as string]: String(colunasTel || 1),
          } as CSSProperties}>
            {lista.map((t, i) => {
              const n = Math.max(0, Math.min(5, Math.round(t.estrelas ?? 0)));
              return (
                <figure key={i} className={juntar("flex h-full flex-col", k.className)} style={k.style}>
                  {n > 0 && <span className="mb-3 text-lg tracking-[0.15em]" style={{ color: corSegura(corEstrelas) || "var(--c-acento)" }} aria-label={`${n} em 5 estrelas`}>{"★".repeat(n)}</span>}
                  <blockquote className={juntar("whitespace-pre-line", tx.className)} style={tx.style}>{t.texto}</blockquote>
                  <figcaption className={juntar("mt-auto flex items-center gap-3 pt-5", centro && "justify-center")}>
                    {t.foto && <img src={t.foto} alt="" className="shrink-0 rounded-full object-cover" style={{ width: foto, height: foto }} />}
                    <span>
                      <span className={juntar("block", tn.className)} style={tn.style}>{t.nome}</span>
                      {t.curso && <span className={juntar("block", tc.className)} style={tc.style}>{t.curso}</span>}
                    </span>
                  </figcaption>
                </figure>
              );
            })}
          </div>
        )}
        {mostrarBotao && href && (
          <a href={href} target="_blank" rel="noreferrer"
            className={juntar("mt-6 inline-flex items-center gap-3 px-5 py-3 text-xs font-extrabold uppercase tracking-[0.08em] hover:brightness-110", tb.className)}
            style={{ ...tb.style, background: corSegura(corBotao) || "var(--c-primaria)", color: corSegura(corTextoBotao) || "#ffffff" }}>
            {textoBotao || "Avaliações no Google"} <Icon name="arrow" />
          </a>
        )}
      </section>
    );
  },
};
