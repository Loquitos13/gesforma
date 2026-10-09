import { useEffect, useMemo, useState } from "react";
import { Icon, SiteFrame, useOferta, type Course } from "./SiteLanding";

function Catalogo() {
  const { cursos, estado, recarregar } = useOferta();
  const inicial = new URLSearchParams(window.location.search).get("linha");
  const [query, setQuery] = useState("");
  const [format, setFormat] = useState("Todos");
  const [area, setArea] = useState("Todas");
  const [funding, setFunding] = useState<"Todas" | "Financiada" | "Gold">(
    inicial === "financiada" ? "Financiada" : inicial === "gold" ? "Gold" : "Todas",
  );
  const [enrollment, setEnrollment] = useState<"Todas" | "Acesso direto" | "Pré-inscrição">("Todas");
  const [saved, setSaved] = useState<string[]>([]);
  const [compare, setCompare] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  const areas = useMemo(() => ["Todas", ...Array.from(new Set(cursos.map(curso => curso.area)))], [cursos]);
  const modalidades = useMemo(() => {
    const modos = new Set(cursos.map(curso => curso.format));
    return ["Todos", ...["Presencial", "B-learning", "E-learning"].filter(modo => modos.has(modo))];
  }, [cursos]);
  const results = cursos.filter(curso =>
    (format === "Todos" || curso.format === format)
    && (area === "Todas" || curso.area === area)
    && (funding === "Todas" || curso.funding === funding)
    && (enrollment === "Todas" || curso.enrollment === enrollment)
    && `${curso.title} ${curso.area}`.toLowerCase().includes(query.toLowerCase()),
  );
  const comparados = cursos.filter(curso => compare.includes(curso.id));

  function limpar() {
    setFormat("Todos");
    setArea("Todas");
    setFunding("Todas");
    setEnrollment("Todas");
    setQuery("");
  }

  function alternarComparacao(id: string) {
    setCompare(current => current.includes(id) ? current.filter(item => item !== id) : current.length < 3 ? [...current, id] : current);
  }

  return (
    <main className="min-h-[75vh] bg-[#F9F9F9]">
      <section className="bg-[#1C3350] px-5 py-14 text-white lg:px-8 lg:py-20">
        <div className="mx-auto max-w-[1240px]">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#FFA900]">Oferta formativa ENA</p>
          <div className="mt-5 flex flex-col justify-between gap-7 lg:flex-row lg:items-end">
            <div>
              <h1 className="max-w-3xl font-serif text-5xl font-bold leading-tight tracking-[-0.03em] sm:text-6xl">Encontre o curso certo para si.</h1>
              <p className="mt-4 max-w-xl text-lg text-white/65">Pesquise por tema, modalidade ou área e descubra o próximo passo do seu percurso.</p>
            </div>
            <label className="flex items-center gap-3 bg-white px-5 py-4 text-[#1C3350] lg:w-[390px]">
              <Icon name="search" />
              <span className="sr-only">Pesquisar cursos</span>
              <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Nome do curso ou área..." className="w-full bg-transparent outline-none placeholder:text-[#1C3350]/45" />
            </label>
          </div>
        </div>
      </section>
      <section className="border-b border-[#1C3350]/10 bg-white px-5 lg:px-8">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-px bg-[#1C3350]/10 sm:flex-row">
          {([
            ["Todas", "Toda a formação", "Explore a oferta completa da ENA"],
            ["Financiada", "Formação financiada", "Percursos elegíveis com financiamento"],
            ["Gold", "ENA Gold", "Formação premium autofinanciada"],
          ] as const).map(([value, title, text]) => (
            <button key={value} type="button" onClick={() => { setFunding(value); if (value !== "Gold") setEnrollment("Todas"); }} className={`flex-1 px-6 py-5 text-left transition-colors ${funding === value ? "bg-[#FFF1D1] shadow-[inset_0_-4px_0_#FFA900]" : "bg-white hover:bg-[#F9F9F9]"}`}>
              <strong className="block text-sm">{title}</strong>
              <span className="mt-1 block text-xs text-[#1C3350]/50">{text}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="px-5 py-10 lg:px-8 lg:py-14">
        <div className="mx-auto grid max-w-[1240px] gap-8 lg:grid-cols-[240px_1fr]">
          <aside className="h-fit border border-[#1C3350]/12 bg-white p-5 lg:sticky lg:top-28">
            <div className="flex items-center justify-between border-b border-[#1C3350]/10 pb-4">
              <strong>Filtros</strong>
              <button type="button" onClick={limpar} className="text-xs font-bold text-[#A60000] underline">Limpar</button>
            </div>
            <fieldset className="mt-5">
              <legend className="text-xs font-bold uppercase tracking-wider text-[#1C3350]/55">Linha de formação</legend>
              <div className="mt-3 space-y-3">
                {(["Todas", "Financiada", "Gold"] as const).map(item => (
                  <label key={item} className="flex cursor-pointer items-center gap-3 text-sm">
                    <input type="radio" name="funding" checked={funding === item} onChange={() => { setFunding(item); if (item !== "Gold") setEnrollment("Todas"); }} className="accent-[#A60000]" />
                    {item === "Gold" ? "ENA Gold" : item}
                  </label>
                ))}
              </div>
            </fieldset>
            {funding === "Gold" && (
              <fieldset className="mt-7 border-t border-[#1C3350]/10 pt-5">
                <legend className="text-xs font-bold uppercase tracking-wider text-[#1C3350]/55">Acesso Gold</legend>
                <div className="mt-3 space-y-3">
                  {(["Todas", "Acesso direto", "Pré-inscrição"] as const).map(item => (
                    <label key={item} className="flex cursor-pointer items-center gap-3 text-sm">
                      <input type="radio" name="enrollment" checked={enrollment === item} onChange={() => setEnrollment(item)} className="accent-[#A60000]" />
                      {item}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <fieldset className="mt-7 border-t border-[#1C3350]/10 pt-5">
              <legend className="text-xs font-bold uppercase tracking-wider text-[#1C3350]/55">Modalidade</legend>
              <div className="mt-3 space-y-3">
                {modalidades.map(item => (
                  <label key={item} className="flex cursor-pointer items-center gap-3 text-sm">
                    <input type="radio" name="format" checked={format === item} onChange={() => setFormat(item)} className="accent-[#A60000]" />
                    {item}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="mt-7 border-t border-[#1C3350]/10 pt-5">
              <legend className="text-xs font-bold uppercase tracking-wider text-[#1C3350]/55">Área de formação</legend>
              <div className="mt-3 space-y-3">
                {areas.map(item => (
                  <label key={item} className="flex cursor-pointer items-center gap-3 text-sm">
                    <input type="radio" name="area" checked={area === item} onChange={() => setArea(item)} className="accent-[#A60000]" />
                    {item}
                  </label>
                ))}
              </div>
            </fieldset>
          </aside>
          <div>
            <div className="mb-6 flex items-center justify-between">
              <p className="text-sm text-[#1C3350]/60"><strong className="text-[#1C3350]">{estado === "pronto" ? results.length : "…"}</strong> formações encontradas</p>
              <span className="hidden text-xs font-bold uppercase tracking-wider text-[#1C3350]/45 sm:block">Ordenado por vendas</span>
            </div>
            {estado === "a-carregar" && <p className="border border-[#1C3350]/10 bg-white px-6 py-16 text-center text-[#1C3350]/60">A carregar o catálogo.</p>}
            {estado === "erro" && (
              <div className="border border-[#1C3350]/10 bg-white px-6 py-16 text-center">
                <p className="text-[#1C3350]/70">Não foi possível carregar os cursos.</p>
                <button type="button" onClick={recarregar} className="mt-4 bg-[#1C3350] px-5 py-3 text-sm font-bold text-white">Tentar de novo</button>
              </div>
            )}
            {estado === "pronto" && (
              <div className="space-y-4">
                {results.map(course => <LinhaCurso key={course.id} course={course} saved={saved.includes(course.id)} compared={compare.includes(course.id)} onSave={() => setSaved(current => current.includes(course.id) ? current.filter(id => id !== course.id) : [...current, course.id])} onCompare={() => alternarComparacao(course.id)} />)}
              </div>
            )}
            {estado === "pronto" && results.length === 0 && (
              <div className="border border-dashed border-[#1C3350]/25 bg-white px-6 py-16 text-center">
                <h2 className="font-serif text-2xl font-bold">Não encontrámos resultados.</h2>
                <p className="mt-2 text-sm text-[#1C3350]/60">Experimente remover alguns filtros ou usar outro termo.</p>
              </div>
            )}
          </div>
        </div>
      </section>
      {compare.length > 0 && (
        <div className="fixed bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-4 bg-[#1C3350] px-5 py-3 text-white shadow-xl">
          <span className="text-sm font-bold">{compare.length} {compare.length === 1 ? "curso selecionado" : "cursos selecionados"}</span>
          <button type="button" disabled={compare.length < 2} onClick={() => setCompareOpen(true)} className="bg-[#FFA900] px-4 py-2 text-xs font-bold text-[#1C3350] disabled:opacity-40">Comparar agora</button>
          <button type="button" onClick={() => setCompare([])} className="text-xs text-white/60">Limpar</button>
        </div>
      )}
      {compareOpen && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-[#14263D]/50 p-4" role="dialog" aria-modal="true" aria-label="Comparar formações">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-auto bg-[#F9F9F9] p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#A60000]">Comparador</p>
                <h2 className="mt-2 font-serif text-3xl font-bold">Compare as formações</h2>
              </div>
              <button type="button" onClick={() => setCompareOpen(false)} className="p-2" aria-label="Fechar"><Icon name="close" /></button>
            </div>
            <div className="mt-6 grid gap-px bg-[#1C3350]/10" style={{ gridTemplateColumns: `repeat(${comparados.length}, minmax(0, 1fr))` }}>
              {comparados.map(course => (
                <article key={course.id} className="bg-white p-5">
                  {course.miniatura && <img src={course.miniatura} alt="" className="mb-4 h-28 w-full object-cover" />}
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#A60000]">{course.funding === "Gold" ? "ENA Gold" : "Financiada"}</span>
                  <h3 className="mt-2 font-bold">{course.title}</h3>
                  <div className="mt-5 space-y-3 text-sm">
                    <p><span className="block text-xs text-[#1C3350]/40">Modalidade</span>{course.format}</p>
                    <p><span className="block text-xs text-[#1C3350]/40">Duração</span>{course.duration}</p>
                    <p><span className="block text-xs text-[#1C3350]/40">Acesso</span>{course.enrollment}</p>
                    <p><span className="block text-xs text-[#1C3350]/40">Investimento</span><strong>{course.price}</strong></p>
                  </div>
                  <a href="/pre-inscricao" className="mt-5 block w-full bg-[#1C3350] px-4 py-3 text-center text-sm font-bold text-white">Pré-inscrever</a>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function LinhaCurso({
  course, saved, compared, onSave, onCompare,
}: {
  course: Course;
  saved: boolean;
  compared: boolean;
  onSave: () => void;
  onCompare: () => void;
}) {
  return (
    <article className={`group grid border border-[#1C3350]/12 bg-white transition-shadow hover:shadow-[0_14px_40px_rgba(28,51,80,.1)] ${course.miniatura ? "md:grid-cols-[12px_148px_1fr_auto]" : "md:grid-cols-[12px_1fr_auto]"}`}>
      <div className={course.funding === "Gold" ? "bg-[#FFA900]" : "bg-[#A60000]"} />
      {course.miniatura && (
        <div className="hidden bg-[#E7EBF0] md:block">
          <img src={course.miniatura} alt="" className="h-full w-full object-cover" />
        </div>
      )}
      <div className="p-6">
        {course.miniatura && <img src={course.miniatura} alt="" className="mb-4 h-36 w-full object-cover md:hidden" />}
        <div className="flex flex-wrap items-center gap-3">
          <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${course.funding === "Gold" ? "bg-[#FFF1D1] text-[#1C3350]" : "bg-[#F1E5E5] text-[#A60000]"}`}>{course.funding === "Gold" ? "ENA Gold" : "Financiada"}</span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#1C3350]/50">{course.enrollment}</span>
          <span className="h-1 w-1 rounded-full bg-[#1C3350]/25" />
          <span className="text-xs font-bold uppercase tracking-wider text-[#A60000]">{course.area}</span>
          <span className="h-1 w-1 rounded-full bg-[#1C3350]/25" />
          <span className="text-xs font-bold text-[#1C3350]/55">{course.format}</span>
          <button type="button" onClick={onSave} className={`ml-auto text-xs font-bold ${saved ? "text-[#A60000]" : "text-[#1C3350]/45"}`}>{saved ? "Guardado" : "Guardar"}</button>
        </div>
        <h2 className="mt-3 font-serif text-2xl font-bold text-[#1C3350]">{course.title}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#1C3350]/60">{course.description}</p>
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-xs font-bold text-[#1C3350]/60">
          <span className="flex items-center gap-2"><Icon name="clock" className="h-4 w-4" />{course.duration}</span>
          <span className="flex items-center gap-2"><Icon name={course.format === "E-learning" ? "screen" : "pin"} className="h-4 w-4" />{course.start}</span>
          <span>{course.price}</span>
        </div>
      </div>
      <div className="flex flex-col justify-center gap-2 border-t border-[#1C3350]/10 p-5 md:min-w-[190px] md:border-l md:border-t-0">
        <a href="/pre-inscricao" className="flex w-full items-center justify-center gap-3 bg-[#A60000] px-4 py-3 text-sm font-bold text-white hover:bg-[#8B0000]">Pré-inscrever <Icon name="arrow" className="h-4 w-4" /></a>
        <label className="flex items-center justify-center gap-2 text-xs font-bold text-[#1C3350]/50">
          <input type="checkbox" checked={compared} onChange={onCompare} className="accent-[#A60000]" />
          Comparar
        </label>
      </div>
    </article>
  );
}

export function SiteCatalog() {
  useEffect(() => {
    const prev = document.title;
    document.title = "Formação | ENA";
    return () => {
      document.title = prev;
    };
  }, []);

  return (
    <SiteFrame>
      <Catalogo />
    </SiteFrame>
  );
}
