// Página do curso em blocos soltos: banner, síntese, dados, objetivos, programa, turmas e cartão de inscrição.
// Cada bloco lê o curso da página (CursoAtualCtx), por isso pode ir para qualquer secção ou coluna.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { ComponentConfig, Slot } from "@puckeditor/core";
import { ePrepago, ePreinscricao, rotuloBotaoInscricao } from "../../partilhado/siteConteudo";
import { useInscricaoOpcional } from "../SiteInscricao";
import { Icon, OfertaCtx, type Course } from "../SiteLanding";
import { CursoDaRotaCtx } from "./blocosCursoPagina";
import { campoCurso, simNao } from "./campos";
import { campoAparencia, campoTipografia } from "./camposGrupos";
import { estiloBloco, estiloTexto, estiloVazio, juntar, tipoVazia, type Estilo, type Tipografia } from "./estilos";

type Estado = "a-carregar" | "erro" | "pronto";
type CursoAtual = { estado: Estado; curso: Course | null; editar: boolean };

/** O curso que a página mostra (dado pela raiz da página do curso). */
export const CursoAtualCtx = createContext<CursoAtual | null>(null);

/** No site: o curso da rota. No editor: o escolhido para pré-visualizar (ou o primeiro da oferta). */
export function useCursoAtual(previsualizar: string, editar: boolean) {
  const ctx = useContext(OfertaCtx);
  const rota = useContext(CursoDaRotaCtx);
  const cursos = ctx?.cursos ?? [];
  const estado = (ctx?.estado ?? "a-carregar") as Estado;
  if (editar) return { estado, curso: cursos.find(c => c.id === previsualizar) ?? cursos[0] ?? null, recarregar: ctx?.recarregar };
  const pedido = (rota ?? "").toLowerCase();
  const curso = /^(?:gold|fin)-\d+$/.test(pedido) ? null : cursos.find(c => c.id === pedido) ?? null;
  return { estado, curso, recarregar: ctx?.recarregar };
}

/** Raiz da página do curso: escolhe o curso e trata dos estados (a carregar, erro, curso que não existe). */
export function RaizCurso({ previsualizar, editar, children }: { previsualizar: string; editar: boolean; children: ReactNode }) {
  const { estado, curso, recarregar } = useCursoAtual(previsualizar, editar);
  useEffect(() => { if (!editar && curso) document.title = `${curso.title} | ENA`; }, [curso, editar]);
  if (!editar) {
    if (estado === "a-carregar") return <p className="px-5 py-24 text-center opacity-60">A carregar o curso.</p>;
    if (estado === "erro") {
      return (
        <div className="px-5 py-24 text-center">
          <p className="opacity-70">Não foi possível carregar o curso.</p>
          {recarregar && <button type="button" onClick={recarregar} className="mt-4 bg-[var(--c-primaria)] px-5 py-3 text-sm font-bold text-white">Tentar de novo</button>}
        </div>
      );
    }
    if (!curso) {
      return (
        <div className="px-5 py-24 text-center">
          <h1 className="font-serif text-3xl">Este curso não está na oferta.</h1>
          <a href="/formacao" className="mt-6 inline-flex font-bold text-[var(--c-destaque)] underline">Voltar ao catálogo</a>
        </div>
      );
    }
  }
  return <CursoAtualCtx.Provider value={{ estado, curso, editar }}>{children}</CursoAtualCtx.Provider>;
}

/** Campo da raiz: o curso que o editor mostra (no site é sempre o da rota). */
export const campoPrevisualizar = campoCurso("No editor, ver com o curso");

function useCurso() {
  return useContext(CursoAtualCtx)?.curso ?? null;
}

type Base = { aparencia: Estilo; puck?: { dragRef?: ((el: Element | null) => void) | null } };

/** Invólucro comum: aparência do bloco, pega de arrastar e aviso quando ainda não há curso. */
function Caixa({ p, className, children, as: Tag = "div" }: { p: Base; className?: string; children: (c: Course) => ReactNode; as?: "div" | "section" | "aside" }) {
  const curso = useCurso();
  const c = estiloBloco(p.aparencia);
  return (
    <Tag ref={p.puck?.dragRef ?? undefined} className={juntar(className, c.className)} style={c.style}>
      {curso ? children(curso) : <p className="px-5 py-8 text-center text-sm opacity-60">Sem curso para mostrar: escolha um em «Página» › «No editor, ver com o curso».</p>}
    </Tag>
  );
}

function Titulo({ texto, t, className }: { texto: string; t: Tipografia; className: string }) {
  if (!texto) return null;
  const e = estiloTexto(t);
  return <h2 className={juntar(className, e.className)} style={e.style}>{texto}</h2>;
}

function duracaoModulo(raw: string) {
  const s = raw.trim().toLowerCase().replace(/\s+/g, "");
  const m = /^(\d+)(?:h|:)?(\d{0,2})(?:min)?$/.exec(s);
  if (!m) return raw.trim();
  const horas = Number(m[1]);
  const minutos = m[2] ? Number(m[2]) : 0;
  return minutos ? `${horas} h ${String(minutos).padStart(2, "0")} min` : `${horas} h`;
}

const localDo = (c: Course) => c.sessoes.find(s => s.local)?.local || (c.format === "E-learning" ? "Online" : "A anunciar");

// ─── Banner ──────────────────────────────────────────────────────────────────

type BannerProps = Base & { voltar: string; mostrarImagem: boolean; mostrarEtiquetas: boolean; titulo: Tipografia };

export const CursoBanner: ComponentConfig<BannerProps> = {
  label: "Curso · Banner",
  fields: {
    voltar: { type: "text", label: "Texto «voltar à formação» (vazio = esconder)" },
    mostrarImagem: simNao("Imagem do curso"),
    mostrarEtiquetas: simNao("Etiquetas (formato, área, regime)"),
    titulo: campoTipografia("Tipografia do título"),
    aparencia: campoAparencia(),
  },
  defaultProps: {
    voltar: "Voltar à formação", mostrarImagem: true, mostrarEtiquetas: true,
    titulo: tipoVazia(), aparencia: estiloVazio({ fundoCor: "var(--c-primaria)" }),
  },
  render: p => (
    <Caixa p={p} as="section" className="text-white">
      {curso => {
        const imagem = p.mostrarImagem ? curso.banner || curso.miniatura : null;
        const t = estiloTexto(p.titulo);
        return (
          <>
            {p.voltar && (
              <div className="mx-auto px-5 pt-10 lg:px-8" style={{ maxWidth: "var(--largura)" }}>
                <a href="/formacao" className="inline-flex items-center gap-2 text-sm font-bold text-white/60 hover:text-white">
                  <span className="rotate-180"><Icon name="arrow" /></span> {p.voltar}
                </a>
              </div>
            )}
            <div className="relative mx-auto mt-8 min-h-[280px] max-h-[480px] w-full overflow-hidden bg-black/20" style={{ maxWidth: "var(--largura)" }}>
              {imagem && <img src={imagem} alt="" className="max-h-[480px] w-full object-cover" />}
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--c-primaria)] via-[var(--c-primaria)]/35 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 px-5 pb-8 lg:px-8">
                {p.mostrarEtiquetas && (
                  <div className="flex flex-wrap gap-3">
                    {curso.format && <span className="bg-[var(--c-destaque)] px-3 py-1.5 text-xs font-extrabold uppercase tracking-wider">{curso.format}</span>}
                    {curso.area && <span className="border border-white/25 px-3 py-1.5 text-xs font-bold uppercase tracking-wider">{curso.area}</span>}
                    <span className="bg-[var(--c-acento)] px-3 py-1.5 text-xs font-extrabold uppercase tracking-wider text-[var(--c-primaria)]">{curso.funding === "Gold" ? "ENA Gold" : "Financiada"}</span>
                  </div>
                )}
                <h1 className={juntar("mt-4 max-w-4xl font-serif text-4xl leading-[1.05] tracking-[-0.04em] sm:text-6xl", t.className)} style={t.style}>{curso.title}</h1>
              </div>
            </div>
          </>
        );
      }}
    </Caixa>
  ),
};

// ─── Síntese ─────────────────────────────────────────────────────────────────

type SinteseProps = Base & { etiqueta: string; tEtiqueta: Tipografia; texto: Tipografia };

export const CursoSintese: ComponentConfig<SinteseProps> = {
  label: "Curso · Síntese",
  fields: {
    etiqueta: { type: "text", label: "Etiqueta (vazio = esconder)" },
    tEtiqueta: campoTipografia("Tipografia da etiqueta"),
    texto: campoTipografia("Tipografia do texto"),
    aparencia: campoAparencia(),
  },
  defaultProps: { etiqueta: "Síntese", tEtiqueta: tipoVazia(), texto: tipoVazia(), aparencia: estiloVazio() },
  render: p => (
    <Caixa p={p}>
      {curso => {
        const e = estiloTexto(p.tEtiqueta);
        const t = estiloTexto(p.texto);
        return (
          <>
            {p.etiqueta && <p className={juntar("text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--c-destaque)]", e.className)} style={e.style}>{p.etiqueta}</p>}
            <p className={juntar("mt-4 text-lg leading-8 opacity-75", t.className)} style={t.style}>{curso.description}</p>
          </>
        );
      }}
    </Caixa>
  ),
};

// ─── Dados (duração, início, local, investimento) ────────────────────────────

type DadosProps = Base & { duracao: boolean; inicio: boolean; local: boolean; investimento: boolean };

export const CursoDados: ComponentConfig<DadosProps> = {
  label: "Curso · Dados",
  fields: {
    duracao: simNao("Duração"), inicio: simNao("Início"), local: simNao("Local"), investimento: simNao("Investimento"),
    aparencia: campoAparencia(),
  },
  defaultProps: { duracao: true, inicio: true, local: true, investimento: true, aparencia: estiloVazio() },
  render: p => (
    <Caixa p={p}>
      {curso => {
        const itens = ([
          [p.duracao, curso.duration, "Duração"], [p.inicio, curso.start, "Início"],
          [p.local, localDo(curso), "Local"], [p.investimento, curso.price, "Investimento"],
        ] as const).filter(([v]) => v);
        return (
          <div className="grid grid-cols-2 gap-px bg-black/10 sm:grid-cols-4">
            {itens.map(([, valor, rotulo]) => (
              <div key={rotulo} className="border-t-4 border-[var(--c-acento)] bg-white p-4">
                <span className="block text-xs uppercase tracking-wider opacity-45">{rotulo}</span>
                <strong className="mt-2 block text-sm">{valor}</strong>
              </div>
            ))}
          </div>
        );
      }}
    </Caixa>
  ),
};

// ─── Objetivos, programa e turmas ────────────────────────────────────────────

type ListaProps = Base & { titulo: string; tTitulo: Tipografia };
const camposLista = (padrao: string) => ({
  fields: { titulo: { type: "text" as const, label: "Título (vazio = esconder)" }, tTitulo: campoTipografia("Tipografia do título"), aparencia: campoAparencia() },
  defaultProps: { titulo: padrao, tTitulo: tipoVazia(), aparencia: estiloVazio() },
});

export const CursoObjetivos: ComponentConfig<ListaProps> = {
  label: "Curso · Objetivos",
  ...camposLista("Objetivos"),
  render: p => (
    <Caixa p={p}>
      {curso => curso.objetivos.length === 0 ? null : (
        <>
          <Titulo texto={p.titulo} t={p.tTitulo} className="font-serif text-3xl" />
          <ul className="mt-5 space-y-3 opacity-75">
            {curso.objetivos.map(o => <li key={o} className="flex gap-3"><Icon name="check" className="mt-1 h-4 w-4 shrink-0" />{o}</li>)}
          </ul>
        </>
      )}
    </Caixa>
  ),
};

export const CursoPrograma: ComponentConfig<ListaProps> = {
  label: "Curso · Programa",
  ...camposLista("Programa"),
  render: p => (
    <Caixa p={p}>
      {curso => curso.programa.length === 0 ? null : (
        <>
          <Titulo texto={p.titulo} t={p.tTitulo} className="border-b border-black/15 pb-4 font-serif text-3xl" />
          <div className="divide-y divide-black/15">
            {curso.programa.map((m, i) => (
              <div key={`${m.titulo}-${i}`} className="flex items-baseline gap-4 py-5">
                <span className="w-24 shrink-0 text-sm font-extrabold text-[var(--c-destaque)]">{curso.organizacao === "livre" ? String(i + 1).padStart(2, "0") : `Módulo ${i + 1}`}</span>
                <strong>{m.titulo}</strong>
                {m.horas && <span className="ml-auto shrink-0 text-sm opacity-55">{duracaoModulo(m.horas)}</span>}
              </div>
            ))}
          </div>
        </>
      )}
    </Caixa>
  ),
};

export const CursoTurmas: ComponentConfig<ListaProps> = {
  label: "Curso · Próximas turmas",
  ...camposLista("Próximas turmas"),
  render: p => (
    <Caixa p={p}>
      {curso => curso.sessoes.length === 0 ? null : (
        <>
          <Titulo texto={p.titulo} t={p.tTitulo} className="border-b border-black/15 pb-4 font-serif text-3xl" />
          <div className="divide-y divide-black/15">
            {curso.sessoes.map(s => (
              <div key={`${s.data}-${s.local}-${s.horario}`} className="flex flex-wrap items-center justify-between gap-3 py-5">
                <strong>{s.data}</strong>
                <span className="text-sm opacity-65">{[s.local, s.horario].filter(Boolean).join(" · ")}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Caixa>
  ),
};

// ─── Cartão de inscrição ─────────────────────────────────────────────────────

type CartaoProps = Base & {
  conteudo: Slot; mostrarImagem: boolean; fixo: boolean; rotuloLocal: string;
  textoPrepago: string; textoPreinscricao: string; textoDireto: string;
};

/**
 * Escolha do local e botão de inscrição: o pedido abre já nesse local, com as datas de início
 * (e o cronograma de cada turma); os dados pessoais vêm a seguir.
 */
function BotaoInscricao({ curso, rotuloLocal }: { curso: Course; rotuloLocal: string }) {
  const { abrir } = useInscricaoOpcional();
  const locais = [...new Set(curso.sessoes.map(s => s.local.trim()).filter(Boolean))];
  const [local, setLocal] = useState(locais.length === 1 ? locais[0]! : "");
  const falta = locais.length > 1 && !local;
  return (
    <>
      {locais.length > 1 && (
        <fieldset className="mt-6">
          <legend className="text-xs font-extrabold uppercase tracking-[0.14em] opacity-60">{rotuloLocal}</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {locais.map(l => (
              <button key={l} type="button" aria-pressed={local === l} onClick={() => setLocal(l)}
                className={`border px-3 py-2 text-sm font-bold ${local === l ? "border-[var(--c-primaria)] bg-[var(--c-primaria)] text-white" : "border-black/15 hover:border-[var(--c-primaria)]"}`}>
                {l}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <button type="button" disabled={falta} onClick={() => abrir(curso, local ? { local } : undefined)}
        className="mt-7 flex w-full items-center justify-between bg-[var(--c-destaque)] px-5 py-4 text-xs font-extrabold uppercase tracking-[0.08em] text-white hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-50">
        {falta ? "Escolha o local" : rotuloBotaoInscricao(curso.enrollment)} <Icon name="arrow" />
      </button>
    </>
  );
}

export const CursoInscricao: ComponentConfig<CartaoProps> = {
  label: "Curso · Cartão de inscrição",
  fields: {
    conteudo: { type: "slot", label: "Blocos no cartão" },
    mostrarImagem: simNao("Imagem no cartão"),
    fixo: simNao("Acompanha o scroll (computador)"),
    rotuloLocal: { type: "text", label: "Título da escolha do local" },
    textoPrepago: { type: "textarea", label: "Texto (pré-pago)" },
    textoPreinscricao: { type: "textarea", label: "Texto (pré-inscrição)" },
    textoDireto: { type: "textarea", label: "Texto (acesso direto)" },
    aparencia: campoAparencia(),
  },
  defaultProps: {
    conteudo: [], mostrarImagem: true, fixo: true, rotuloLocal: "Onde quer fazer o curso?",
    textoPrepago: "Primeiro recolhemos os seus dados. O pagamento fica no passo seguinte.",
    textoPreinscricao: "Escolha o local e a data de início (com o cronograma de cada turma). A seguir pedimos os seus dados.",
    textoDireto: "Este curso abre no Moodle. Não há formulário de pré-inscrição.",
    aparencia: estiloVazio(),
  },
  render: ({ conteudo: Conteudo, ...p }) => (
    <Caixa p={p} as="aside" className={juntar("h-fit border-t-4 border-[var(--c-destaque)] bg-white p-7 shadow-[0_18px_50px_rgba(18,52,59,.18)]", p.fixo && "lg:sticky lg:top-28")}>
      {curso => (
        <>
          {p.mostrarImagem && (
            <div className="mb-5 h-36 w-full overflow-hidden bg-[#E7EBF0]">
              {(curso.capa || curso.miniatura) && <img src={curso.capa || curso.miniatura || ""} alt="" className="h-full w-full object-cover" />}
            </div>
          )}
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--c-destaque)]">{curso.enrollment}</p>
          <h2 className="mt-3 font-serif text-3xl">{curso.price}</h2>
          <p className="mt-4 text-sm leading-6 opacity-65">
            {ePrepago(curso.enrollment) ? p.textoPrepago : ePreinscricao(curso.enrollment) ? p.textoPreinscricao : p.textoDireto}
          </p>
          <BotaoInscricao curso={curso} rotuloLocal={p.rotuloLocal} />
          <Conteudo className="mt-5 flex flex-col gap-3 empty:hidden" minEmptyHeight={30} />
        </>
      )}
    </Caixa>
  ),
};

export const BLOCOS_CURSO = ["CursoBanner", "CursoSintese", "CursoDados", "CursoObjetivos", "CursoPrograma", "CursoTurmas", "CursoInscricao"] as const;
