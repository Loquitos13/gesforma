// Página do curso: escolha do local e cartão de inscrição feito de blocos (imagem, textos com variáveis
// do curso e botão). O local escolhido é da página: os dados, as turmas, o preço e o botão seguem-no.
import type { ComponentType } from "react";
import type { ComponentConfig, Slot } from "@puckeditor/core";
import { ePrepago, ePreinscricao, rotuloBotaoInscricao } from "../../partilhado/siteConteudo";
import { useInscricaoOpcional } from "../SiteInscricao";
import { Icon, type Course } from "../SiteLanding";
import {
  ajudaVariaveis, Caixa, locaisDo, precoNoLocal, preencherVariaveis, Titulo, useLocalCurso, variaveisCurso, type Base,
} from "./blocosCurso";
import { campoCor, campoNumero, simNao } from "./campos";
import { campoAparencia, campoTipografia } from "./camposGrupos";
import { corSegura, estiloTexto, estiloVazio, juntar, tipoVazia, type Tipografia } from "./estilos";

// ─── Escolha do local ────────────────────────────────────────────────────────

type LocalProps = Base & {
  titulo: string; tTitulo: Tipografia; mostrarPreco: boolean; mostrarMorada: boolean; abrirPedido: boolean;
  colunas: number | null; colunasTab: number | null; colunasTel: number | null;
};

export const CursoEscolhaLocal: ComponentConfig<LocalProps> = {
  label: "Curso · Escolha do local",
  fields: {
    titulo: { type: "text", label: "Título (vazio = esconder)" },
    tTitulo: campoTipografia("Tipografia do título"),
    mostrarMorada: simNao("Morada de cada local (Edição de cursos › Locais)"),
    mostrarPreco: simNao("Preço em cada local"),
    abrirPedido: simNao("Ao clicar num local, abre logo a pré-inscrição"),
    colunas: campoNumero("Colunas (computador)", ""),
    colunasTab: campoNumero("Colunas (tablet)", ""),
    colunasTel: campoNumero("Colunas (telemóvel)", ""),
    aparencia: campoAparencia(),
  },
  defaultProps: {
    titulo: "Onde quer fazer o curso?", tTitulo: tipoVazia(), mostrarMorada: true, mostrarPreco: true,
    abrirPedido: true, colunas: 3, colunasTab: 2, colunasTel: 1, aparencia: estiloVazio(),
  },
  render: p => <EscolhaLocal {...p} />,
};

function EscolhaLocal(p: LocalProps) {
  const { local, setLocal, editar } = useLocalCurso();
  const { abrir } = useInscricaoOpcional();
  return (
    <Caixa p={p}>
      {curso => {
        const locais = locaisDo(curso);
        if (!locais.length) return null;
        return (
          <fieldset>
            {p.titulo && <legend className="mb-4"><Titulo texto={p.titulo} t={p.tTitulo} className="font-serif text-2xl" /></legend>}
            {/* Cartões grandes (nome, morada e preço), em grelha, como no site da ENA. */}
            <div className="ena-grelha gap-4" style={{
              ["--cols" as string]: String(p.colunas || 3), ["--cols-tab" as string]: String(p.colunasTab || 2), ["--cols-tel" as string]: String(p.colunasTel || 1),
            }}>
              {locais.map(l => {
                const ativo = local === l;
                const morada = curso.sessoes.find(s => s.local === l && s.morada)?.morada;
                return (
                  <button key={l} type="button" aria-pressed={ativo} onClick={() => {
                      // No site, o clique escolhe o local e abre o pedido já nele (datas de início e horário).
                      if (p.abrirPedido !== false && !editar) { setLocal(l); abrir(curso, { local: l }); return; }
                      setLocal(ativo && locais.length > 1 ? "" : l);
                    }}
                    className={`flex min-h-[96px] flex-col items-start gap-2 border-2 bg-white px-5 py-5 text-left shadow-[0_8px_24px_rgba(18,52,59,.08)] transition ${ativo ? "border-[var(--c-destaque)]" : "border-transparent hover:border-black/15"}`}>
                    <span className="flex w-full items-start justify-between gap-3">
                      <strong className="text-sm font-extrabold uppercase tracking-[0.04em] text-[var(--c-primaria)]">{l}</strong>
                      {ativo && <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--c-destaque)] text-white"><Icon name="check" className="h-3 w-3" /></span>}
                    </span>
                    {p.mostrarMorada && morada && <span className="text-xs leading-5 opacity-65">{morada}</span>}
                    {p.mostrarPreco && <span className="mt-auto text-sm font-bold text-[var(--c-destaque)]">{precoNoLocal(curso, l)}</span>}
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      }}
    </Caixa>
  );
}

// ─── Texto com variáveis do curso ────────────────────────────────────────────

const ESTILOS_TEXTO = {
  etiqueta: { tag: "p", cls: "text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--c-destaque)]" },
  titulo: { tag: "h2", cls: "font-serif text-3xl" },
  destaque: { tag: "p", cls: "font-serif text-3xl" },
  texto: { tag: "p", cls: "text-sm leading-6 opacity-65" },
} as const;

type TextoProps = Base & {
  texto: string; estilo: keyof typeof ESTILOS_TEXTO; tipografia: Tipografia;
  porInscricao: boolean; textoPrepago: string; textoPreinscricao: string; textoDireto: string;
};

export const CursoTexto: ComponentConfig<TextoProps> = {
  label: "Curso · Texto com variáveis",
  fields: {
    texto: { type: "textarea", label: `Texto. ${ajudaVariaveis}` },
    estilo: {
      type: "select", label: "Estilo",
      options: [{ label: "Etiqueta", value: "etiqueta" }, { label: "Título", value: "titulo" }, { label: "Destaque (ex.: preço)", value: "destaque" }, { label: "Texto", value: "texto" }],
    },
    porInscricao: simNao("Texto diferente por tipo de inscrição (substitui o texto acima)"),
    textoPrepago: { type: "textarea", label: "Pré-pago" },
    textoPreinscricao: { type: "textarea", label: "Pré-inscrição" },
    textoDireto: { type: "textarea", label: "Acesso direto" },
    tipografia: campoTipografia(),
    aparencia: campoAparencia(),
  },
  defaultProps: {
    texto: "{{curso}}", estilo: "texto", porInscricao: false, textoPrepago: "", textoPreinscricao: "", textoDireto: "",
    tipografia: tipoVazia(), aparencia: estiloVazio(),
  },
  render: p => <TextoCurso {...p} />,
};

function TextoCurso(p: TextoProps) {
  const { local } = useLocalCurso();
  const e = ESTILOS_TEXTO[p.estilo] ?? ESTILOS_TEXTO.texto;
  const t = estiloTexto(p.tipografia);
  const Tag = e.tag;
  return (
    <Caixa p={p}>
      {curso => {
        const base = p.porInscricao
          ? (ePrepago(curso.enrollment) ? p.textoPrepago : ePreinscricao(curso.enrollment) ? p.textoPreinscricao : p.textoDireto)
          : p.texto;
        const texto = preencherVariaveis(base ?? "", variaveisCurso(curso, local)).trim();
        return texto ? <Tag className={juntar(e.cls, "whitespace-pre-line", t.className)} style={t.style}>{texto}</Tag> : null;
      }}
    </Caixa>
  );
}

// ─── Imagem do curso ─────────────────────────────────────────────────────────

type ImagemProps = Base & { imagem: "capa" | "miniatura" | "banner"; altura: number | null; ajuste: "cover" | "contain" };

export const CursoImagem: ComponentConfig<ImagemProps> = {
  label: "Curso · Imagem",
  fields: {
    imagem: { type: "select", label: "Imagem", options: [{ label: "Capa", value: "capa" }, { label: "Miniatura", value: "miniatura" }, { label: "Banner", value: "banner" }] },
    altura: campoNumero("Altura"),
    ajuste: { type: "select", label: "Ajuste", options: [{ label: "Preencher (corta)", value: "cover" }, { label: "Inteira", value: "contain" }] },
    aparencia: campoAparencia(),
  },
  defaultProps: { imagem: "capa", altura: 144, ajuste: "cover", aparencia: estiloVazio() },
  render: p => (
    <Caixa p={p}>
      {curso => {
        const src = curso[p.imagem] || curso.capa || curso.miniatura;
        return (
          <div className="w-full overflow-hidden bg-[#E7EBF0]" style={{ height: p.altura ? `${p.altura}px` : undefined }}>
            {src && <img src={src} alt="" className="h-full w-full" style={{ objectFit: p.ajuste }} />}
          </div>
        );
      }}
    </Caixa>
  ),
};

// ─── Botão de inscrição ──────────────────────────────────────────────────────

type BotaoProps = Base & { texto: string; cor: string; corTexto: string; larguraTotal: boolean; seta: boolean };

export const CursoBotaoInscricao: ComponentConfig<BotaoProps> = {
  label: "Curso · Botão de inscrição",
  fields: {
    texto: { type: "text", label: `Texto (vazio = conforme a inscrição). ${ajudaVariaveis}` },
    cor: campoCor("Cor do botão"),
    corTexto: campoCor("Cor do texto"),
    larguraTotal: simNao("Ocupa a largura toda"),
    seta: simNao("Seta"),
    aparencia: campoAparencia(),
  },
  defaultProps: { texto: "", cor: "var(--c-destaque)", corTexto: "#ffffff", larguraTotal: true, seta: true, aparencia: estiloVazio() },
  render: p => <BotaoCurso {...p} />,
};

/** Abre a pré-inscrição já no local escolhido na página (as datas de início e os dados vêm a seguir). */
function BotaoCurso(p: BotaoProps) {
  const { local } = useLocalCurso();
  const { abrir } = useInscricaoOpcional();
  return (
    <Caixa p={p}>
      {curso => {
        const texto = p.texto.trim() ? preencherVariaveis(p.texto, variaveisCurso(curso, local)) : rotuloBotaoInscricao(curso.enrollment);
        return (
          <button type="button" onClick={() => abrir(curso, local ? { local } : undefined)}
            className={juntar("flex items-center justify-between gap-4 px-5 py-4 text-xs font-extrabold uppercase tracking-[0.08em] hover:brightness-90", p.larguraTotal ? "w-full" : "w-fit")}
            style={{ background: corSegura(p.cor) || "var(--c-destaque)", color: corSegura(p.corTexto) || "#ffffff" }}>
            {texto} {p.seta && <Icon name="arrow" />}
          </button>
        );
      }}
    </Caixa>
  );
}

// ─── Cartão de inscrição ─────────────────────────────────────────────────────

type CartaoProps = Base & {
  conteudo: Slot; fixo: boolean; cartao: boolean; espaco: number | null;
  /** Só nas páginas gravadas antes de o cartão ser feito de blocos. */
  mostrarImagem?: boolean; textoPrepago?: string; textoPreinscricao?: string; textoDireto?: string;
};

const TEXTO_INSCRICAO = {
  textoPrepago: "Primeiro recolhemos os seus dados. O pagamento fica no passo seguinte.",
  textoPreinscricao: "Escolha a data de início (com o cronograma de cada turma). A seguir pedimos os seus dados.",
  textoDireto: "Este curso abre no Moodle. Não há formulário de pré-inscrição.",
};

/** Blocos do cartão por omissão: imagem, tipo de inscrição, preço do local, texto e botão. */
export const blocosCartaoPadrao = (textos: Partial<typeof TEXTO_INSCRICAO> = {}) => [
  { type: "CursoImagem", props: { ...CursoImagem.defaultProps } },
  { type: "CursoTexto", props: { ...CursoTexto.defaultProps, texto: "{{inscricao}}", estilo: "etiqueta" } },
  { type: "CursoTexto", props: { ...CursoTexto.defaultProps, texto: "{{preco}}", estilo: "destaque" } },
  { type: "CursoTexto", props: { ...CursoTexto.defaultProps, texto: "", estilo: "texto", porInscricao: true, ...TEXTO_INSCRICAO, ...textos } },
  { type: "CursoBotaoInscricao", props: { ...CursoBotaoInscricao.defaultProps } },
];

export const CursoInscricao: ComponentConfig<CartaoProps> = {
  label: "Curso · Cartão de inscrição",
  fields: {
    conteudo: { type: "slot", label: "Blocos no cartão" },
    cartao: simNao("Aspeto de cartão (fundo branco, barra e sombra)"),
    fixo: simNao("Acompanha o scroll (computador)"),
    espaco: campoNumero("Espaço entre os blocos"),
    aparencia: campoAparencia(),
  },
  defaultProps: { conteudo: blocosCartaoPadrao() as never, cartao: true, fixo: true, espaco: 16, aparencia: estiloVazio() },
  render: ({ conteudo: Conteudo, ...p }) => (
    <Caixa p={p} as="aside" className={juntar(
      "h-fit",
      p.cartao && "border-t-4 border-[var(--c-destaque)] bg-white p-7 shadow-[0_18px_50px_rgba(18,52,59,.18)]",
      p.fixo && "lg:sticky lg:top-28",
    )}>
      {curso => p.textoPrepago !== undefined
        ? <CartaoAntigo p={p} curso={curso} Conteudo={Conteudo} />
        : <Conteudo className="flex flex-col" style={{ gap: `${p.espaco ?? 16}px` }} minEmptyHeight={60} />}
    </Caixa>
  ),
};

/** Cartão gravado antes dos blocos (só até a página voltar a ser publicada pelo editor, que o converte). */
function CartaoAntigo({ p, curso, Conteudo }: { p: Omit<CartaoProps, "conteudo">; curso: Course; Conteudo: ComponentType<{ className?: string; minEmptyHeight?: number }> }) {
  const { local } = useLocalCurso();
  const { abrir } = useInscricaoOpcional();
  return (
    <>
      {p.mostrarImagem !== false && (
        <div className="mb-5 h-36 w-full overflow-hidden bg-[#E7EBF0]">
          {(curso.capa || curso.miniatura) && <img src={curso.capa || curso.miniatura || ""} alt="" className="h-full w-full object-cover" />}
        </div>
      )}
      <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--c-destaque)]">{curso.enrollment}</p>
      <h2 className="mt-3 font-serif text-3xl">{precoNoLocal(curso, local)}</h2>
      <p className="mt-4 text-sm leading-6 opacity-65">
        {ePrepago(curso.enrollment) ? p.textoPrepago : ePreinscricao(curso.enrollment) ? p.textoPreinscricao : p.textoDireto}
      </p>
      <button type="button" onClick={() => abrir(curso, local ? { local } : undefined)} className="mt-7 flex w-full items-center justify-between bg-[var(--c-destaque)] px-5 py-4 text-xs font-extrabold uppercase tracking-[0.08em] text-white hover:brightness-90">
        {rotuloBotaoInscricao(curso.enrollment)} <Icon name="arrow" />
      </button>
      <Conteudo className="mt-5 flex flex-col gap-3 empty:hidden" minEmptyHeight={30} />
    </>
  );
}
