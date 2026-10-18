// Bloco «Redes sociais (Siga-nos)»: um cartão por rede, com ícone, descrição e botão para seguir a ENA.
import type { ComponentConfig } from "@puckeditor/core";
import { campoCor, campoNumero } from "./campos";
import { campoAparencia } from "./camposGrupos";
import { corSegura, estiloBloco, estiloVazio, juntar, lados, ligacaoSegura, type Estilo } from "./estilos";
import { IconeRede, REDES, type Rede } from "./redesSociais";

type CartaoRede = { rede: Rede; ligacao: string; descricao: string; botao: string };
type RedesProps = {
  etiqueta: string; titulo: string; texto: string; redes: CartaoRede[]; colunas: number | null;
  corCartao: string; corIcone: string; aparencia: Estilo;
  puck?: { dragRef?: ((el: Element | null) => void) | null; isEditing?: boolean };
};

const OPCOES = Object.entries(REDES).map(([value, r]) => ({ label: r.nome, value }));

export const RedesSociais: ComponentConfig<RedesProps> = {
  label: "Redes sociais (Siga-nos)",
  fields: {
    etiqueta: { type: "text", label: "Etiqueta (vazio = esconder)" },
    titulo: { type: "text", label: "Título" },
    texto: { type: "textarea", label: "Texto" },
    redes: {
      type: "array", label: "Redes",
      arrayFields: {
        rede: { type: "select", label: "Rede", options: OPCOES },
        ligacao: { type: "text", label: "Endereço da página (https://…)" },
        descricao: { type: "textarea", label: "O que se encontra lá" },
        botao: { type: "text", label: "Texto do botão (vazio = «Seguir no …»)" },
      },
      defaultItemProps: { rede: "instagram", ligacao: "", descricao: "", botao: "" },
      getItemSummary: item => REDES[item.rede]?.nome ?? "Rede",
    },
    colunas: campoNumero("Colunas (computador)") as never,
    corCartao: campoCor("Fundo dos cartões"),
    corIcone: campoCor("Cor dos ícones e botões"),
    aparencia: campoAparencia(),
  },
  defaultProps: {
    etiqueta: "Redes sociais", titulo: "Siga a ENA", texto: "Acompanhe as novidades, os cursos e o dia a dia da escola.",
    redes: [
      { rede: "instagram", ligacao: "https://www.instagram.com/ena_escolaformacao/", descricao: "Carrosséis de imagens, histórias e reels: conheça-nos melhor.", botao: "" },
      { rede: "facebook", ligacao: "https://www.facebook.com/ENA.escola.negocios.administracao", descricao: "Novidades e notícias da ENA.", botao: "" },
      { rede: "linkedin", ligacao: "https://www.linkedin.com/company/10536784", descricao: "A ENA para empresas e profissionais.", botao: "" },
    ],
    colunas: 3, corCartao: "#ffffff", corIcone: "var(--c-destaque)",
    aparencia: estiloVazio({ preenchimento: lados(56, 32), preenchimentoTel: lados(40, 20) }),
  },
  render: ({ puck, etiqueta, titulo, texto, redes, colunas, corCartao, corIcone, aparencia }) => {
    const c = estiloBloco(aparencia);
    const cor = corSegura(corIcone) ?? "var(--c-destaque)";
    const lista = (redes ?? []).filter(r => REDES[r.rede] && (puck?.isEditing || ligacaoSegura(r.ligacao)));
    return (
      <section ref={puck?.dragRef ?? undefined} className={c.className} style={c.style} aria-label={titulo || "Redes sociais"}>
        <div className="mx-auto" style={{ maxWidth: "var(--largura)" }}>
          {etiqueta && <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--c-destaque)]">{etiqueta}</p>}
          {titulo && <h2 className="mt-2 font-serif text-3xl font-bold sm:text-4xl">{titulo}</h2>}
          {texto && <p className="mt-3 max-w-2xl text-lg leading-8 opacity-75">{texto}</p>}
          <ul className="ena-grelha mt-8" style={{ gap: "16px", ["--cols" as string]: String(colunas || 3), ["--cols-tab" as string]: "2", ["--cols-tel" as string]: "1" }}>
            {lista.map((r, i) => {
              const nome = REDES[r.rede].nome;
              const href = ligacaoSegura(r.ligacao);
              return (
                <li key={i} className="flex flex-col gap-4 p-6" style={{ background: corSegura(corCartao) ?? "#ffffff" }}>
                  <span className="grid h-14 w-14 place-items-center rounded-full text-white" style={{ background: cor }}><IconeRede rede={r.rede} className="h-7 w-7" /></span>
                  <div>
                    <h3 className="text-xl font-bold">{nome}</h3>
                    {r.descricao && <p className="mt-1 text-[15px] leading-6 opacity-75">{r.descricao}</p>}
                  </div>
                  {href && (
                    <a href={href} target="_blank" rel="noreferrer" className={juntar("mt-auto inline-flex w-fit items-center gap-2 px-5 py-3 text-sm font-bold text-white hover:brightness-110")} style={{ background: cor }}>
                      {r.botao?.trim() || `Seguir no ${nome}`}<span className="sr-only"> (abre noutra janela)</span>
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    );
  },
};
