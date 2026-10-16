// Página do curso em blocos soltos: banner, síntese, dados, objetivos, programa, turmas e cartão de inscrição.
// Cada bloco lê o curso da página (CursoAtualCtx), por isso pode ir para qualquer secção ou coluna.
import { createContext, useContext, useEffect, useState, type ComponentType, type ReactNode } from "react";
import type { ComponentConfig, Slot } from "@puckeditor/core";
import { Icon, OfertaCtx, type Course } from "../SiteLanding";
import { CursoDaRotaCtx } from "./blocosCursoPagina";
import { campoCurso, simNao } from "./campos";
import { campoAparencia, campoTipografia } from "./camposGrupos";
import { estiloBloco, estiloTexto, estiloVazio, juntar, tipoVazia, type Estilo, type Tipografia } from "./estilos";

type Estado = "a-carregar" | "erro" | "pronto";
/** O curso da página e o local escolhido (partilhado: escolha do local, dados, turmas e cartão seguem-no). */
type CursoAtual = { estado: Estado; curso: Course | null; editar: boolean; local: string; setLocal: (l: string) => void };

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
  const [local, setLocal] = useState("");
  // Outro curso: o local volta ao único que houver (ou a nenhum).
  useEffect(() => {
    const ls = curso ? locaisDo(curso) : [];
    setLocal(ls.length === 1 ? ls[0]! : "");
  }, [curso]);
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
  return <CursoAtualCtx.Provider value={{ estado, curso, editar, local, setLocal }}>{children}</CursoAtualCtx.Provider>;
}

// ─── Local, preço e variáveis ────────────────────────────────────────────────

export const locaisDo = (c: Course) => [...new Set(c.sessoes.map(s => s.local.trim()).filter(Boolean))];

const euros = (n: number) => `${n.toLocaleString("pt-PT", { maximumFractionDigits: 2 })} €`;

/**
 * Preço a mostrar: o das datas desse local (o preço de cada data já segue as regras da ficha por local,
 * por horário ou pelos dois). Preços diferentes no local → «A partir de»; sem datas → o preço do curso.
 */
export function precoNoLocal(c: Course, local: string) {
  const precos = c.sessoes.filter(s => !local || s.local === local).map(s => s.preco).filter((n): n is number => n != null);
  if (!precos.length) return c.price;
  const min = Math.min(...precos);
  return precos.every(p => p === min) ? euros(min) : `A partir de ${euros(min)}`;
}

/** Variáveis que os textos do curso podem usar: {{curso}}, {{preco}}, … */
export const VARIAVEIS_CURSO: [string, string][] = [
  ["curso", "Nome do curso"], ["area", "Área"], ["formato", "Formato (presencial, b-learning…)"], ["duracao", "Duração"],
  ["descricao", "Síntese"], ["inscricao", "Tipo de inscrição"], ["regime", "ENA Gold ou Financiada"],
  ["local", "Local escolhido"], ["locais", "Todos os locais"], ["horarios", "Horários (do local escolhido)"],
  ["inicio", "Próximo início (data · local)"], ["proxima_data", "Próxima data de início"],
  ["preco", "Preço (segue o local escolhido)"], ["preco_desde", "Preço mais baixo"], ["datas", "Número de datas"],
];

export function variaveisCurso(c: Course, local: string): Record<string, string> {
  const doLocal = c.sessoes.filter(s => !local || s.local === local);
  const prox = doLocal[0];
  return {
    curso: c.title, area: c.area, formato: c.format, duracao: c.duration, descricao: c.description,
    inscricao: c.enrollment, regime: c.funding === "Gold" ? "ENA Gold" : "Financiada",
    local, locais: locaisDo(c).join(", "),
    horarios: [...new Set(doLocal.map(s => s.horario).filter(Boolean))].join(", "),
    inicio: prox ? [prox.data, prox.local].filter(Boolean).join(" · ") : c.start,
    proxima_data: prox?.data ?? c.start,
    preco: precoNoLocal(c, local), preco_desde: c.precoDesde != null ? euros(c.precoDesde) : c.price,
    datas: String(doLocal.length),
  };
}

export const preencherVariaveis = (texto: string, vars: Record<string, string>) =>
  texto.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k: string) => (k in vars ? vars[k]! : m));

export const ajudaVariaveis = `Variáveis: ${VARIAVEIS_CURSO.map(([k]) => `{{${k}}}`).join(" ")}`;

/** Campo da raiz: o curso que o editor mostra (no site é sempre o da rota). */
export const campoPrevisualizar = campoCurso("No editor, ver com o curso");

export function useCurso() {
  return useContext(CursoAtualCtx)?.curso ?? null;
}

/** Local escolhido na página (e como o mudar). */
export function useLocalCurso() {
  const ctx = useContext(CursoAtualCtx);
  return { local: ctx?.local ?? "", setLocal: ctx?.setLocal ?? (() => undefined), editar: ctx?.editar ?? false };
}

export type Base = { aparencia: Estilo; puck?: { dragRef?: ((el: Element | null) => void) | null } };

/** Invólucro comum: aparência do bloco, pega de arrastar e aviso quando ainda não há curso. */
export function Caixa({ p, className, children, as: Tag = "div" }: { p: Base; className?: string; children: (c: Course) => ReactNode; as?: "div" | "section" | "aside" }) {
  const curso = useCurso();
  const c = estiloBloco(p.aparencia);
  return (
    <Tag ref={p.puck?.dragRef ?? undefined} className={juntar(className, c.className)} style={c.style}>
      {curso ? children(curso) : <p className="px-5 py-8 text-center text-sm opacity-60">Sem curso para mostrar: escolha um em «Página» › «No editor, ver com o curso».</p>}
    </Tag>
  );
}

export function Titulo({ texto, t, className }: { texto: string; t: Tipografia; className: string }) {
  if (!texto) return null;
  const e = estiloTexto(t);
  return <h2 className={juntar(className, e.className)} style={e.style}>{texto}</h2>;
}

/** Espaço de blocos entre o título de um bloco do curso e o seu conteúdo (ex.: um texto antes dos objetivos). */
export const campoEntreTitulo = { type: "slot" as const, label: "Blocos entre o título e o conteúdo" };

export function ZonaEntreTitulo({ zona }: { zona?: unknown }) {
  // Páginas gravadas antes deste espaço não o têm.
  const Zona = zona as ComponentType<{ className?: string; minEmptyHeight?: number }> | undefined;
  return Zona ? <Zona className="ena-zona mt-4 flex flex-col gap-3" minEmptyHeight={40} /> : null;
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
            {/* As mudanças de linha da ficha do curso (ex.: lista de destaques) mantêm-se. */}
            <p className={juntar("mt-4 whitespace-pre-line text-lg leading-8 opacity-75", t.className)} style={t.style}>{curso.description}</p>
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
  render: p => <DadosCurso {...p} />,
};

/** Com um local escolhido, o início, o local e o investimento são os desse local. */
function DadosCurso(p: DadosProps) {
  const { local } = useLocalCurso();
  return (
    <Caixa p={p}>
      {curso => {
        const v = variaveisCurso(curso, local);
        const itens = ([
          [p.duracao, curso.duration, "Duração"], [p.inicio, local ? v.inicio : curso.start, "Início"],
          [p.local, local || localDo(curso), "Local"], [p.investimento, precoNoLocal(curso, local), "Investimento"],
        ] as const).filter(([x]) => x);
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
  );
}

// ─── Objetivos, programa e turmas ────────────────────────────────────────────

type ListaProps = Base & { titulo: string; tTitulo: Tipografia; entreTitulo: Slot };
const camposLista = (padrao: string) => ({
  fields: {
    titulo: { type: "text" as const, label: "Título (vazio = esconder)" }, tTitulo: campoTipografia("Tipografia do título"),
    entreTitulo: campoEntreTitulo, aparencia: campoAparencia(),
  },
  defaultProps: { titulo: padrao, tTitulo: tipoVazia(), entreTitulo: [], aparencia: estiloVazio() },
});

export const CursoObjetivos: ComponentConfig<ListaProps> = {
  label: "Curso · Objetivos",
  ...camposLista("Objetivos"),
  render: p => (
    <Caixa p={p}>
      {curso => curso.objetivos.length === 0 ? null : (
        <>
          <Titulo texto={p.titulo} t={p.tTitulo} className="font-serif text-3xl" />
          <ZonaEntreTitulo zona={p.entreTitulo} />
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
          <ZonaEntreTitulo zona={p.entreTitulo} />
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

type FuncionamentoProps = ListaProps & { texto: Tipografia };

/** O texto «Funcionamento» da ficha do curso (sessões, plataforma, assiduidade, certificado). */
export const CursoFuncionamento: ComponentConfig<FuncionamentoProps> = {
  label: "Curso · Funcionamento",
  fields: { ...camposLista("Funcionamento").fields, texto: campoTipografia("Tipografia do texto") },
  defaultProps: { ...camposLista("Funcionamento").defaultProps, texto: tipoVazia() },
  render: p => (
    <Caixa p={p}>
      {curso => {
        if (!curso.funcionamento.trim()) return null;
        const t = estiloTexto(p.texto);
        return (
          <>
            <Titulo texto={p.titulo} t={p.tTitulo} className="font-serif text-3xl" />
            <ZonaEntreTitulo zona={p.entreTitulo} />
            <p className={juntar("mt-5 whitespace-pre-line leading-7 opacity-75", t.className)} style={t.style}>{curso.funcionamento}</p>
          </>
        );
      }}
    </Caixa>
  ),
};

type TurmasProps = ListaProps & { soLocal: boolean; mostrarPreco: boolean };

export const CursoTurmas: ComponentConfig<TurmasProps> = {
  label: "Curso · Próximas turmas",
  fields: {
    ...camposLista("Próximas turmas").fields,
    soLocal: simNao("Só as do local escolhido"),
    mostrarPreco: simNao("Preço de cada turma"),
  },
  defaultProps: { ...camposLista("Próximas turmas").defaultProps, soLocal: true, mostrarPreco: true },
  render: p => <TurmasCurso {...p} />,
};

// No render, o espaço de blocos já chega como componente (não como lista).
function TurmasCurso(p: Omit<TurmasProps, "entreTitulo"> & { entreTitulo?: unknown }) {
  const { local } = useLocalCurso();
  return (
    <Caixa p={p}>
      {curso => {
        const lista = curso.sessoes.filter(s => !p.soLocal || !local || s.local === local);
        return lista.length === 0 ? null : (
          <>
            <Titulo texto={p.titulo} t={p.tTitulo} className="border-b border-black/15 pb-4 font-serif text-3xl" />
            <ZonaEntreTitulo zona={p.entreTitulo} />
            <div className="divide-y divide-black/15">
              {lista.map(s => (
                <div key={`${s.data}-${s.local}-${s.horario}`} className="flex flex-wrap items-center justify-between gap-3 py-5">
                  <strong>{s.data}</strong>
                  <span className="text-sm opacity-65">
                    {[s.local, s.horario, p.mostrarPreco && s.preco != null ? euros(s.preco) : ""].filter(Boolean).join(" · ")}
                  </span>
                </div>
              ))}
            </div>
          </>
        );
      }}
    </Caixa>
  );
}


