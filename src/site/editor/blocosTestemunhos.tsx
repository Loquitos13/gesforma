// Bloco «Testemunhos»: opiniões de formandos (editáveis) e um botão que leva às avaliações da ENA no Google.
import { useEffect, useState, type CSSProperties } from "react";
import type { ComponentConfig } from "@puckeditor/core";
import { Carrossel1a1, type Transicao } from "./carrossel";
import { apiAvaliacoesGooglePublicas, apiTestemunhosPublicos, type AvaliacoesGooglePublicas, type DadosTestemunho } from "../../partilhado/api/site";
import { Icon } from "../SiteLanding";
import { campoCor, campoImagem, campoNumero, simNao } from "./campos";
import { campoAparencia, campoTipografia } from "./camposGrupos";
import { corSegura, estiloBloco, estiloTexto, estiloVazio, juntar, lados, ligacaoSegura, tipoVazia, type Estilo, type Tipografia } from "./estilos";

type Testemunho = { nome: string; curso: string; texto: string; estrelas: number | null; foto: string; google?: string };

type TestemunhosProps = {
  titulo: string; tipoTitulo: Tipografia;
  itens: Testemunho[]; colunas: number | null; colunasTab: number | null; colunasTel: number | null; espaco: number | null;
  corEstrelas: string; tipoTexto: Tipografia; tipoNome: Tipografia; tipoCurso: Tipografia; tipoBotao: Tipografia;
  tamanhoFoto: number | null; alinhar: "esquerda" | "centro";
  disposicao: "grelha" | "carrossel"; segundos: number | null; setas: boolean; transicao: Transicao; larguraCarrossel: number | null;
  google: "nao" | "juntar" | "so"; googleMinimo: number | null; googleResumo: boolean; formandos: boolean;
  mostrarBotao: boolean; textoBotao: string; ligacaoBotao: string; corBotao: string; corTextoBotao: string;
  cartao: Estilo; aparencia: Estilo;
  puck?: { dragRef?: ((el: Element | null) => void) | null; isEditing?: boolean };
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
    formandos: simNao("Juntar os testemunhos aprovados dos formandos (Sistema › Site › Testemunhos)"),
    google: {
      type: "radio", label: "Avaliações do Google (configuradas em Configurações › Avaliações Google)",
      options: [{ label: "Não mostrar", value: "nao" }, { label: "Juntar às de cima", value: "juntar" }, { label: "Só as do Google", value: "so" }],
    },
    googleMinimo: campoNumero("Google: só avaliações com pelo menos N estrelas", ""),
    googleResumo: simNao("Google: mostrar a classificação média e o número de avaliações"),
    disposicao: { type: "radio", label: "Disposição", options: [{ label: "Grelha", value: "grelha" }, { label: "Carrossel", value: "carrossel" }] },
    segundos: campoNumero("Carrossel: segundos entre testemunhos (vazio ou 0 = só com as setas)", ""),
    setas: simNao("Carrossel: setas"),
    transicao: {
      type: "radio", label: "Carrossel: transição entre testemunhos (nos dois sentidos)",
      options: [{ label: "Deslizar", value: "deslizar" }, { label: "Desvanecer", value: "desvanecer" }, { label: "Nenhuma", value: "nenhuma" }],
    },
    larguraCarrossel: campoNumero("Carrossel: largura máxima do testemunho"),
    colunas: campoNumero("Colunas na grelha (computador)", "") as never,
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
    tamanhoFoto: 40, alinhar: "centro", disposicao: "grelha", segundos: 6, setas: true, transicao: "deslizar", larguraCarrossel: 720, google: "nao", googleMinimo: 4, googleResumo: true, formandos: true,
    mostrarBotao: true, textoBotao: "Veja e deixe a sua avaliação no Google",
    // shortcut: pesquisa genérica; trocar pelo link «Pedir avaliações» do Perfil da Empresa da ENA no Google.
    ligacaoBotao: "https://www.google.com/search?q=ena",
    corBotao: "var(--c-primaria)", corTextoBotao: "#ffffff",
    cartao: estiloVazio({ fundoCor: "#ffffff", preenchimento: lados(24, 24), bordaTopo: 3, bordaCor: "var(--c-acento)" }),
    aparencia: estiloVazio({ margem: lados(48, 0, 0, 0) }),
  },
  render: ({ puck, titulo, tipoTitulo, itens, colunas, colunasTab, colunasTel, espaco, corEstrelas, tipoTexto, tipoNome, tipoCurso, tipoBotao, tamanhoFoto, alinhar, disposicao, segundos, setas, transicao, larguraCarrossel, google, googleMinimo, googleResumo, formandos, mostrarBotao, textoBotao, ligacaoBotao, corBotao, corTextoBotao, cartao, aparencia }) => {
    const c = estiloBloco(aparencia);
    const k = estiloBloco(cartao);
    const [tt, tx, tn, tc, tb] = [estiloTexto(tipoTitulo), estiloTexto(tipoTexto), estiloTexto(tipoNome), estiloTexto(tipoCurso), estiloTexto(tipoBotao)];
    const href = ligacaoSegura(ligacaoBotao);
    const g = useAvaliacoesGoogle(google === "juntar" || google === "so");
    const doGoogle: Testemunho[] = (g?.avaliacoes ?? [])
      .filter(v => v.estrelas >= (googleMinimo ?? 0))
      .map(v => ({ nome: v.autor, curso: v.quando, texto: v.texto, estrelas: v.estrelas, foto: v.foto, google: v.autorUrl || g?.url || "https://www.google.com" }));
    const daArea = useTestemunhosFormandos(formandos !== false && google !== "so");
    const manuais = google === "so" ? [] : (itens ?? []).filter(t => t.texto?.trim() || t.nome?.trim());
    const deFormandos: Testemunho[] = (daArea ?? []).map(t => ({ nome: t.nome, curso: t.curso, texto: t.texto, estrelas: t.estrelas, foto: "" }));
    const lista = [...manuais, ...deFormandos, ...doGoogle];
    const carrossel = disposicao === "carrossel";
    // O carrossel fica sempre centrado na horizontal.
    const centro = carrossel || alinhar === "centro";
    const foto = `${tamanhoFoto ?? 40}px`;
    return (
      <section ref={puck?.dragRef ?? undefined} className={juntar(c.className, "flex flex-col", centro ? "items-center text-center" : "items-start")} style={c.style}>
        {titulo && <h2 className={tt.className} style={tt.style}>{titulo}</h2>}
        {googleResumo && google !== "nao" && g?.rating != null && (
          <p className="mt-2 text-sm">
            <span className="font-bold" style={{ color: corSegura(corEstrelas) || "var(--c-acento)" }}>★ {g.rating.toLocaleString("pt-PT")}</span>
            {" "}<span className="opacity-70">· {g.total} avaliações no Google</span>
          </p>
        )}
        {lista.length === 0 && puck?.isEditing && (
          // Só no editor: explica porque o bloco está vazio (no site não aparece nada).
          <p className="mt-6 w-full border-2 border-dashed border-black/20 bg-white/60 p-4 text-left text-sm text-[#3E5168]">
            Ainda não há testemunhos para mostrar.{" "}
            {google === "nao" && "Acrescente-os em «Testemunhos», no painel à direita. Os que os formandos deixarem na área do formando aparecem aqui depois de aprovados em Sistema › Site › Testemunhos."}
            {google !== "nao" && g && !g.avaliacoes.length && (g.rating == null
              ? "As avaliações do Google ainda não estão ligadas: configure-as em Configurações › Avaliações Google (Place ID e chave), ou acrescente testemunhos no painel."
              : `A Google não devolveu avaliações com ${googleMinimo ?? 0} ou mais estrelas e texto. Baixe o mínimo de estrelas ou acrescente testemunhos no painel.`)}
            {google !== "nao" && !g && "A carregar as avaliações do Google…"}
          </p>
        )}
        {lista.length > 0 && (() => {
          const cartoes = lista.map((t, i) => {
              const n = Math.max(0, Math.min(5, Math.round(t.estrelas ?? 0)));
              return (
                <figure key={i} className={juntar("flex h-full flex-col", k.className)} style={k.style}>
                  {n > 0 && <span role="img" className="mb-3 text-lg tracking-[0.15em]" style={{ color: corSegura(corEstrelas) || "var(--c-acento)" }} aria-label={`${n} em 5 estrelas`}>{"★".repeat(n)}</span>}
                  <blockquote className={juntar("whitespace-pre-line", tx.className)} style={tx.style}>{t.texto}</blockquote>
                  <figcaption className={juntar("mt-auto flex items-center gap-3 pt-5", centro && "justify-center")}>
                    {t.foto && <img src={t.foto} alt="" className="shrink-0 rounded-full object-cover" style={{ width: foto, height: foto }} />}
                    <span>
                      <span className={juntar("block", tn.className)} style={tn.style}>{t.nome}</span>
                      {t.curso && <span className={juntar("block", tc.className)} style={tc.style}>{t.curso}</span>}
                      {/* A Google exige que a avaliação diga de onde vem e ligue ao autor. */}
                      {t.google && <a href={t.google} target="_blank" rel="noreferrer" className="block text-[11px] opacity-60 hover:underline">Avaliação no Google<span className="sr-only"> (abre noutra janela)</span></a>}
                    </span>
                  </figcaption>
                </figure>
              );
          });
          return carrossel
            ? <Carrossel1a1 itens={cartoes} rotulo={titulo || "Testemunhos"} nomeItem="testemunho" segundos={segundos ?? 0} setas={setas !== false}
                transicao={transicao ?? "deslizar"} largura={larguraCarrossel ?? 720} />
            : (
              <div className="ena-grelha mt-6 w-full" style={{
                justifyItems: centro ? "center" : undefined, gap: `${espaco ?? 24}px`,
                ["--cols" as string]: String(colunas || 3), ["--cols-tab" as string]: String(colunasTab || 2), ["--cols-tel" as string]: String(colunasTel || 1),
              } as CSSProperties}>{cartoes}</div>
            );
        })()}
        {mostrarBotao && href && (
          <a href={href} target="_blank" rel="noreferrer"
            className={juntar("mt-6 inline-flex items-center gap-3 px-5 py-3 text-xs font-extrabold uppercase tracking-[0.08em] hover:brightness-110", tb.className)}
            style={{ ...tb.style, background: corSegura(corBotao) || "var(--c-primaria)", color: corSegura(corTextoBotao) || "#ffffff" }}>
            {textoBotao || "Avaliações no Google"} <Icon name="arrow" /><span className="sr-only"> (abre noutra janela)</span>
          </a>
        )}
      </section>
    );
  },
};


/** Pede uma vez por página as avaliações do Google guardadas no servidor (vazio se não estiverem configuradas). */
let pedidoGoogle: Promise<AvaliacoesGooglePublicas | null> | null = null;
function useAvaliacoesGoogle(ativo: boolean) {
  const [dados, setDados] = useState<AvaliacoesGooglePublicas | null>(null);
  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    pedidoGoogle ??= apiAvaliacoesGooglePublicas().catch(() => null);
    void pedidoGoogle.then(d => { if (vivo) setDados(d); });
    return () => { vivo = false; };
  }, [ativo]);
  return ativo ? dados : null;
}

/** Testemunhos aprovados dos formandos (uma vez por página). */
let pedidoFormandos: Promise<DadosTestemunho[] | null> | null = null;
function useTestemunhosFormandos(ativo: boolean) {
  const [dados, setDados] = useState<DadosTestemunho[] | null>(null);
  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    pedidoFormandos ??= apiTestemunhosPublicos().then(r => r.testemunhos).catch(() => null);
    void pedidoFormandos.then(d => { if (vivo) setDados(d); });
    return () => { vivo = false; };
  }, [ativo]);
  return ativo ? dados : null;
}
