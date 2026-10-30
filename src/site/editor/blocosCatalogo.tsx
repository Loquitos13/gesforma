// Bloco "Catálogo": pesquisa, separadores Gold/Financiada, filtros, comparador e a lista de cursos.
// Os textos, o que aparece e o aspecto dos cartões editam-se no painel; as cores vêm do tema.
import { useContext, useMemo, useState, type ComponentType, type CSSProperties } from "react";
import type { ComponentConfig, Slot } from "@puckeditor/core";
import { rotuloBotaoInscricao } from "../../partilhado/siteConteudo";
import { TextoFormatado } from "../../partilhado/TextoFormatadoVista";
import { useInscricaoOpcional } from "../SiteInscricao";
import { Icon, OfertaCtx, type Course } from "../SiteLanding";
import { cartaoPadrao, CartaoCurso, campoCartao, type EstiloCartao } from "./blocosCursos";
import { simNao } from "./campos";
import { campoAparencia } from "./camposGrupos";
import { estiloBloco, estiloVazio, juntar, type Estilo } from "./estilos";
import { ordenarAreas } from "../../partilhado/areasFormacao";

type Linha = "Todas" | "Financiada" | "Gold";
type Acesso = "Todas" | "Acesso direto" | "Pré-pago" | "Pré-inscrição";

type CatalogoProps = {
  zonaTopo: Slot; zonaLista: Slot;
  topo: boolean; kicker: string; titulo: string; subtitulo: string; textoPesquisa: string;
  separadores: boolean; filtros: boolean; comparador: boolean; guardar: boolean; etiquetas: boolean;
  vista: "linhas" | "cartoes"; cartao: EstiloCartao;
  aparencia: Estilo;
};

const LINHAS: [Linha, string, string][] = [
  ["Todas", "Toda a formação", "Explore a oferta completa da ENA"],
  ["Financiada", "Formação financiada", "Percursos elegíveis com financiamento"],
  ["Gold", "ENA Gold", "Formação premium autofinanciada"],
];

function Radio<T extends string>({ nome, legenda, opcoes, valor, mudar, rotulo }: {
  nome: string; legenda: string; opcoes: readonly T[]; valor: T; mudar: (v: T) => void; rotulo?: (v: T) => string;
}) {
  return (
    <fieldset className="mt-6 border-t border-[var(--c-primaria)]/10 pt-5 first:mt-5 first:border-0 first:pt-0">
      <legend className="text-xs font-bold uppercase tracking-wider opacity-60">{legenda}</legend>
      <div className="mt-3 space-y-3">
        {opcoes.map(o => (
          <label key={o} className="flex cursor-pointer items-center gap-3 text-sm">
            <input type="radio" name={nome} checked={valor === o} onChange={() => mudar(o)} className="accent-[var(--c-destaque)]" />
            {rotulo ? rotulo(o) : o}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function LinhaCurso({ c, guardado, comparado, onGuardar, onComparar, guardar, comparador, etiquetas }: {
  c: Course; guardado: boolean; comparado: boolean; onGuardar: () => void; onComparar: () => void; guardar: boolean; comparador: boolean; etiquetas: boolean;
}) {
  const { abrir } = useInscricaoOpcional();
  const gold = c.funding === "Gold";
  return (
    <article className="group grid overflow-hidden border border-[var(--c-primaria)]/12 bg-white transition-shadow hover:shadow-[0_18px_40px_rgba(28,51,80,.14)] md:grid-cols-[12px_220px_minmax(0,1fr)_auto] lg:grid-cols-[12px_300px_minmax(0,1fr)_auto] md:items-stretch">
      <div className="h-1.5 md:h-auto" style={{ background: gold ? "var(--c-acento)" : "var(--c-destaque)" }} />
      {/* Fotografia larga, com a modalidade e o regime em cima (as cores já distinguem, a etiqueta diz o nome). */}
      <a href={`/formacao/${c.id}`} tabIndex={-1} aria-hidden="true" className="relative block aspect-[16/9] overflow-hidden bg-[#E7EBF0] md:aspect-auto md:min-h-44">
        {(c.capa || c.miniatura) && <img src={c.capa || c.miniatura || ""} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />}
        <span className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {c.format && <span className="bg-[#14263D] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-white">{c.format}</span>}
          <span className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em]" style={gold ? { background: "var(--c-acento)", color: "#14263D" } : { background: "var(--c-destaque)", color: "#fff" }}>{gold ? "Gold" : "Financiada"}</span>
        </span>
      </a>
      {/* Todo o texto leva à página do curso (o título estica-se por cima do bloco); «Guardar» fica por cima disso. */}
      <div className="relative cursor-pointer p-6">
        {(etiquetas || guardar) && <div className="flex flex-wrap items-center gap-3">
          {etiquetas && <>
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-50">{c.enrollment}</span>
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--c-destaque)]">{c.area}</span>
          </>}
          {guardar && <button type="button" onClick={onGuardar} className={`relative z-10 ml-auto text-xs font-bold ${guardado ? "text-[var(--c-destaque)]" : "opacity-45"}`}>{guardado ? "Guardado" : "Guardar"}</button>}
        </div>}
        <h2 className={juntar("font-serif text-2xl font-bold", (etiquetas || guardar) && "mt-3")}><a href={`/formacao/${c.id}`} className="after:absolute after:inset-0 hover:text-[var(--c-destaque)] group-hover:text-[var(--c-destaque)]">{c.title}</a></h2>
        <TextoFormatado texto={c.resumo} className="mt-2 max-w-2xl text-sm leading-6 opacity-60" nivel={4} />
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-xs font-bold opacity-60">
          <span className="flex items-center gap-2"><Icon name="clock" className="h-4 w-4" />{c.duration}</span>
          <span className="flex items-center gap-2"><Icon name={c.format === "E-learning" ? "screen" : "pin"} className="h-4 w-4" />{c.start}</span>
          <span>{c.price}</span>
        </div>
      </div>
      <div className="flex flex-col justify-center gap-2 border-t border-[var(--c-primaria)]/10 p-5 md:min-w-[190px] md:border-l md:border-t-0">
        <button type="button" onClick={() => abrir(c)} className="flex w-full items-center justify-center gap-3 bg-[var(--c-destaque)] px-4 py-3 text-sm font-bold text-white hover:brightness-90">{rotuloBotaoInscricao(c.enrollment)} <Icon name="arrow" className="h-4 w-4" /></button>
        {comparador && (
          <label className="flex items-center justify-center gap-2 text-xs font-bold opacity-50">
            <input type="checkbox" checked={comparado} onChange={onComparar} className="accent-[var(--c-destaque)]" />
            Comparar
          </label>
        )}
      </div>
    </article>
  );
}


/** Zona onde se largam blocos dentro de um bloco fechado (no site, vazia não ocupa espaço). */
export type Zona = ComponentType<{ className?: string; style?: CSSProperties; minEmptyHeight?: number }>;

function CatalogoVista(p: Omit<CatalogoProps, "zonaTopo" | "zonaLista"> & { zonaTopo?: Zona; zonaLista?: Zona; refRaiz?: ((el: Element | null) => void) | null }) {
  const ZonaTopo = p.zonaTopo;
  const ZonaLista = p.zonaLista;
  const ctx = useContext(OfertaCtx);
  const cursos = ctx?.cursos ?? [];
  const estado = ctx?.estado ?? "a-carregar";
  const { abrir } = useInscricaoOpcional();
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const inicial = params?.get("linha") ?? null;
  const [q, setQ] = useState("");
  const [formato, setFormato] = useState("Todos");
  // «?area=…» vem dos botões das áreas na página inicial (Oferta formativa).
  const [area, setArea] = useState(params?.get("area")?.trim() || "Todas");
  const [linha, setLinha] = useState<Linha>(inicial === "financiada" ? "Financiada" : inicial === "gold" ? "Gold" : "Todas");
  const [acesso, setAcesso] = useState<Acesso>("Todas");
  const [guardados, setGuardados] = useState<string[]>([]);
  const [comparar, setComparar] = useState<string[]>([]);
  const [aComparar, setAComparar] = useState(false);

  const areas = useMemo(() => ["Todas", ...ordenarAreas([...new Set(cursos.map(c => c.area).filter(Boolean))])], [cursos]);
  const modalidades = useMemo(() => ["Todos", ...["Presencial", "B-learning", "E-learning"].filter(m => cursos.some(c => c.format === m))], [cursos]);
  const lista = cursos.filter(c =>
    (formato === "Todos" || c.format === formato) && (area === "Todas" || c.area === area)
    && (linha === "Todas" || c.funding === linha) && (acesso === "Todas" || c.enrollment === acesso)
    && `${c.title} ${c.area}`.toLowerCase().includes(q.trim().toLowerCase()));
  const comparados = cursos.filter(c => comparar.includes(c.id));
  const mudarLinha = (l: Linha) => { setLinha(l); if (l !== "Gold") setAcesso("Todas"); };
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const nAtivos = [area !== "Todas", formato !== "Todos", linha !== "Todas", linha === "Gold" && acesso !== "Todas"].filter(Boolean).length;
  const limpar = () => { setFormato("Todos"); setArea("Todas"); mudarLinha("Todas"); setQ(""); };
  const c = estiloBloco(p.aparencia);
  const pesquisa = (
    <label className="flex items-center gap-3 bg-white px-5 py-4 text-[var(--c-primaria)] lg:w-[390px]">
      <Icon name="search" />
      <span className="sr-only">Pesquisar cursos</span>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder={p.textoPesquisa} className="w-full bg-transparent outline-none placeholder:opacity-50" />
    </label>
  );

  return (
    <div ref={p.refRaiz ?? undefined} className={c.className} style={c.style}>
      {p.topo && (
        <section className="bg-[var(--c-primaria)] px-5 py-10 text-white lg:px-8 lg:py-12">
          <div className="mx-auto" style={{ maxWidth: "var(--largura)" }}>
            {p.kicker && <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--c-acento)]">{p.kicker}</p>}
            <div className="mt-3 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
              <div className="min-w-0">
                {p.titulo && <h1 className="font-serif text-4xl font-bold leading-tight tracking-[-0.03em] sm:text-5xl">{p.titulo}</h1>}
                {p.subtitulo && <p className="mt-3 max-w-xl text-lg text-white/65">{p.subtitulo}</p>}
              </div>
              {pesquisa}
            </div>
          </div>
        </section>
      )}
      {ZonaTopo && <ZonaTopo className="flex flex-col ena-zona" minEmptyHeight={40} />}
      {p.separadores && (
        <section className="border-b-4 border-[var(--c-acento)] bg-[var(--c-primaria)] px-5 lg:px-8">
          <div className="mx-auto flex flex-col gap-2 py-3 sm:flex-row" style={{ maxWidth: "var(--largura)" }}>
            {LINHAS.map(([v, t, d]) => (
              <button key={v} type="button" onClick={() => mudarLinha(v)}
                aria-pressed={linha === v}
                // A borda mostra que os outros separadores também se podem escolher.
                className="flex-1 border px-6 py-4 text-left transition-colors hover:bg-white/10"
                style={linha === v ? { background: "var(--c-acento)", color: "var(--c-primaria)", borderColor: "var(--c-acento)" } : { color: "#fff", borderColor: "rgba(255,255,255,.35)" }}>
                <strong className="block text-sm">{t}</strong>
                <span className="mt-1 block text-xs opacity-60">{d}</span>
              </button>
            ))}
          </div>
        </section>
      )}
      <section className="px-5 py-10 lg:px-8 lg:py-14">
        <div className={juntar("mx-auto grid gap-8", p.filtros && "lg:grid-cols-[240px_1fr]")} style={{ maxWidth: "var(--largura)" }}>
          {p.filtros && (
            // Telemóvel: fechados por omissão, abrem no botão «Filtros». Computador: sempre à vista, com scroll próprio
            // quando são mais altos do que o ecrã (ficavam cortados por estarem fixos ao fazer scroll).
            <div>
            <button type="button" aria-expanded={filtrosAbertos} aria-controls="catalogo-filtros" onClick={() => setFiltrosAbertos(a => !a)}
              className="flex w-full items-center justify-between border-t-4 border-[var(--c-acento)] bg-white px-5 py-4 text-sm font-bold lg:hidden">
              <span>Filtros{nAtivos ? ` · ${nAtivos} ${nAtivos === 1 ? "ativo" : "ativos"}` : ""}</span>
              <svg aria-hidden="true" className={juntar("h-4 w-4 transition-transform", filtrosAbertos && "rotate-180")} viewBox="0 0 20 20" fill="currentColor"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" /></svg>
            </button>
            <aside id="catalogo-filtros" className={juntar(
              "h-fit bg-white p-5 lg:sticky lg:top-6 lg:block lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:border-t-4 lg:border-[var(--c-acento)]",
              filtrosAbertos ? "block pt-0 lg:pt-5" : "hidden",
            )}>
              <div className="flex items-center justify-between border-b border-[var(--c-primaria)]/10 pb-4">
                <strong className="hidden lg:inline">Filtros</strong>
                <button type="button" onClick={limpar} className="text-xs font-bold text-[var(--c-destaque)] underline">Limpar</button>
              </div>
              {/* Ordem: área, modalidade e, por fim, a linha de formação (com o acesso Gold). */}
              <Radio nome="area" legenda="Área de formação" opcoes={areas} valor={area} mudar={setArea} />
              <Radio nome="formato" legenda="Modalidade" opcoes={modalidades} valor={formato} mudar={setFormato} />
              <Radio nome="linha" legenda="Linha de formação" opcoes={["Todas", "Financiada", "Gold"] as const} valor={linha} mudar={mudarLinha} rotulo={v => (v === "Gold" ? "ENA Gold" : v)} />
              {linha === "Gold" && <Radio nome="acesso" legenda="Acesso Gold" opcoes={["Todas", "Pré-inscrição", "Pré-pago", "Acesso direto"] as const} valor={acesso} mudar={setAcesso} />}
              <button type="button" onClick={() => setFiltrosAbertos(false)}
                className="mt-6 w-full bg-[var(--c-destaque)] px-4 py-3 text-sm font-bold text-white lg:hidden">
                Ver {estado === "pronto" ? lista.length : ""} formações
              </button>
            </aside>
            </div>
          )}
          <div>
            {!p.topo && <div className="mb-6">{pesquisa}</div>}
            {ZonaLista && <ZonaLista className="flex flex-col gap-4 ena-zona" minEmptyHeight={40} />}
            <p className="mb-6 text-sm opacity-60"><strong>{estado === "pronto" ? lista.length : "…"}</strong> formações encontradas</p>
            {estado === "a-carregar" && <p className="py-16 text-center opacity-70">A carregar o catálogo.</p>}
            {estado === "erro" && <p className="py-16 text-center">Não foi possível carregar os cursos.</p>}
            {estado === "pronto" && lista.length === 0 && (
              <div className="border border-dashed border-[var(--c-primaria)]/25 bg-white px-6 py-16 text-center">
                <h2 className="font-serif text-2xl font-bold">Não encontrámos resultados.</h2>
                <p className="mt-2 text-sm opacity-60">Experimente remover alguns filtros ou usar outro termo.</p>
              </div>
            )}
            {estado === "pronto" && p.vista === "linhas" && (
              <div className="space-y-4">
                {lista.map(x => (
                  <LinhaCurso key={x.id} c={x} guardar={p.guardar} comparador={p.comparador} etiquetas={Boolean(p.etiquetas)}
                    guardado={guardados.includes(x.id)} comparado={comparar.includes(x.id)}
                    onGuardar={() => setGuardados(g => g.includes(x.id) ? g.filter(i => i !== x.id) : [...g, x.id])}
                    onComparar={() => setComparar(g => g.includes(x.id) ? g.filter(i => i !== x.id) : g.length < 3 ? [...g, x.id] : g)} />
                ))}
              </div>
            )}
            {estado === "pronto" && p.vista === "cartoes" && lista.length > 0 && (
              <div className="ena-grelha" style={{ gap: `${p.cartao.espaco ?? 20}px`, ["--cols" as string]: String(p.cartao.colunas || 2), ["--cols-tab" as string]: String(p.cartao.colunasTab || 2), ["--cols-tel" as string]: String(p.cartao.colunasTel || 1) }}>
                {lista.map(x => <CartaoCurso key={x.id} curso={x} e={p.cartao} />)}
              </div>
            )}
          </div>
        </div>
      </section>
      {p.comparador && comparar.length > 0 && (
        <div className="fixed bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-4 bg-[var(--c-primaria)] px-5 py-3 text-white shadow-xl">
          <span className="text-sm font-bold">{comparar.length} {comparar.length === 1 ? "curso selecionado" : "cursos selecionados"}</span>
          <button type="button" disabled={comparar.length < 2} onClick={() => setAComparar(true)} className="bg-[var(--c-acento)] px-4 py-2 text-xs font-bold text-[var(--c-primaria)] disabled:opacity-40">Comparar agora</button>
          <button type="button" onClick={() => setComparar([])} className="text-xs text-white/60">Limpar</button>
        </div>
      )}
      {aComparar && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-[#14263D]/50 p-4" role="dialog" aria-modal="true" aria-label="Comparar formações">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-auto bg-[#F9F9F9] p-6">
            <div className="flex items-start justify-between gap-4">
              <h2 className="font-serif text-3xl font-bold">Compare as formações</h2>
              <button type="button" onClick={() => setAComparar(false)} className="p-2" aria-label="Fechar"><Icon name="close" /></button>
            </div>
            <div className="mt-6 grid gap-px bg-black/10" style={{ gridTemplateColumns: `repeat(${comparados.length}, minmax(0, 1fr))` }}>
              {comparados.map(x => (
                <article key={x.id} className="bg-white p-5">
                  {x.miniatura && <img src={x.miniatura} alt="" className="mb-4 h-28 w-full object-cover" />}
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--c-destaque)]">{x.funding === "Gold" ? "ENA Gold" : "Financiada"}</span>
                  <h3 className="mt-2 font-bold">{x.title}</h3>
                  <div className="mt-5 space-y-3 text-sm">
                    <p><span className="block text-xs opacity-40">Modalidade</span>{x.format}</p>
                    <p><span className="block text-xs opacity-40">Duração</span>{x.duration}</p>
                    <p><span className="block text-xs opacity-40">Acesso</span>{x.enrollment}</p>
                    <p><span className="block text-xs opacity-40">Investimento</span><strong>{x.price}</strong></p>
                  </div>
                  <button type="button" onClick={() => abrir(x)} className="mt-5 block w-full bg-[var(--c-primaria)] px-4 py-3 text-center text-sm font-bold text-white">{rotuloBotaoInscricao(x.enrollment)}</button>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const Catalogo: ComponentConfig<CatalogoProps> = {
  label: "Catálogo de cursos",
  fields: {
    zonaTopo: { type: "slot", label: "Blocos entre a pesquisa e os separadores" },
    zonaLista: { type: "slot", label: "Blocos antes da lista de cursos" },
    topo: simNao("Faixa do topo com pesquisa"),
    kicker: { type: "text", label: "Etiqueta do topo" },
    titulo: { type: "textarea", label: "Título do topo" },
    subtitulo: { type: "textarea", label: "Texto do topo" },
    textoPesquisa: { type: "text", label: "Texto da pesquisa" },
    separadores: simNao("Separadores Gold / Financiada"),
    filtros: simNao("Filtros ao lado"),
    comparador: simNao("Comparador de cursos"),
    guardar: simNao("Botão «Guardar»"),
    etiquetas: simNao("Etiquetas em cada curso (linha, acesso, área, modalidade)"),
    vista: { type: "radio", label: "Lista", options: [{ label: "Em linhas", value: "linhas" }, { label: "Em cartões", value: "cartoes" }] },
    cartao: campoCartao("Cartão (vista em cartões)"),
    aparencia: campoAparencia(),
  },
  resolveFields: (data, { fields }) => {
    const f = { ...fields };
    if (data.props.vista !== "cartoes") delete (f as Record<string, unknown>).cartao;
    return f;
  },
  defaultProps: {
    zonaTopo: [], zonaLista: [],
    topo: true, kicker: "Oferta formativa ENA", titulo: "Encontre o curso certo para si.",
    subtitulo: "Pesquise por tema, modalidade ou área e descubra o próximo passo do seu percurso.",
    textoPesquisa: "Nome do curso ou área...", separadores: true, filtros: true, comparador: false, guardar: false, etiquetas: false,
    vista: "linhas", cartao: cartaoPadrao({ colunas: 2 }), aparencia: estiloVazio(),
  },
  render: ({ puck, ...p }) => <CatalogoVista {...(p as unknown as Parameters<typeof CatalogoVista>[0])} refRaiz={puck?.dragRef} />,
};
