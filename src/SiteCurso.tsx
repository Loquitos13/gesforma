import { useEffect } from "react";
import { Icon, SiteFrame, useOferta, type Course } from "./SiteLanding";

function Pagina({ slug }: { slug: string }) {
  const { cursos, estado, recarregar } = useOferta();
  const pedido = slug.toLowerCase();
  const curso = /^(?:gold|fin)-\d+$/.test(pedido) ? null : cursos.find(item => item.id === pedido) ?? null;

  if (estado === "a-carregar") {
    return <p className="px-5 py-24 text-center text-[#1C3350]/60">A carregar o curso.</p>;
  }
  if (estado === "erro") {
    return (
      <div className="px-5 py-24 text-center">
        <p className="text-[#1C3350]/70">Não foi possível carregar o curso.</p>
        <button type="button" onClick={recarregar} className="mt-4 bg-[#1C3350] px-5 py-3 text-sm font-bold text-white">Tentar de novo</button>
      </div>
    );
  }
  if (!curso) {
    return (
      <div className="px-5 py-24 text-center">
        <h1 className="font-serif text-3xl text-[#1C3350]">Este curso não está na oferta.</h1>
        <a href="/formacao" className="mt-6 inline-flex font-bold text-[#A60000] underline">Voltar ao catálogo</a>
      </div>
    );
  }
  return <Curso curso={curso} />;
}

function Curso({ curso }: { curso: Course }) {
  useEffect(() => {
    document.title = `${curso.title} | ENA`;
  }, [curso.title]);
  const imagem = curso.banner || curso.miniatura;
  const local = curso.sessoes.find(sessao => sessao.local)?.local
    || (curso.format === "E-learning" ? "Online" : "A anunciar");

  return (
    <main className="bg-[#F9F9F9]">
      <section className="bg-[#1C3350] text-white">
        <div className="mx-auto max-w-[1240px] px-5 pt-10 lg:px-8">
          <a href="/formacao" className="inline-flex items-center gap-2 text-sm font-bold text-white/60 hover:text-white">
            <span className="rotate-180"><Icon name="arrow" /></span> Voltar à formação
          </a>
        </div>
        <div className="relative mx-auto mt-8 min-h-[280px] max-h-[420px] w-full max-w-[1240px] overflow-hidden bg-[#14263D] lg:max-h-[480px]">
          {imagem && <img src={imagem} alt="" className="max-h-[420px] w-full max-w-full object-cover lg:max-h-[480px]" />}
          <div className="absolute inset-0 bg-gradient-to-t from-[#1C3350] via-[#1C3350]/35 to-[#1C3350]/10" />
          <div className="absolute inset-x-0 bottom-0 px-5 pb-8 lg:px-8">
            <div className="flex flex-wrap gap-3">
              <span className="bg-[#A60000] px-3 py-1.5 text-xs font-extrabold uppercase tracking-wider">{curso.format}</span>
              <span className="border border-white/25 px-3 py-1.5 text-xs font-bold uppercase tracking-wider">{curso.area}</span>
              <span className="bg-[#FFA900] px-3 py-1.5 text-xs font-extrabold uppercase tracking-wider text-[#1C3350]">{curso.funding === "Gold" ? "ENA Gold" : "Financiada"}</span>
            </div>
            <h1 className="mt-4 max-w-4xl font-serif text-4xl leading-[1.05] tracking-[-0.04em] sm:text-6xl">{curso.title}</h1>
          </div>
        </div>
      </section>
      <section className="px-5 py-12 lg:px-8 lg:py-16">
        <div className="mx-auto grid max-w-[1240px] gap-12 lg:grid-cols-[1fr_360px]">
          <div className="max-w-3xl">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#A60000]">Síntese</p>
            <p className="mt-4 text-lg leading-8 text-[#1C3350]/75">{curso.description}</p>
            <div className="mt-8 grid grid-cols-2 gap-px bg-[#1C3350]/10 sm:grid-cols-4">
              {[[curso.duration, "Duração"], [curso.start, "Início"], [local, "Local"], [curso.price, "Investimento"]].map(([value, label]) => (
                <div key={label} className="bg-white p-4">
                  <span className="block text-xs uppercase tracking-wider text-[#1C3350]/45">{label}</span>
                  <strong className="mt-2 block text-sm">{value}</strong>
                </div>
              ))}
            </div>
            {curso.objetivos.length > 0 && (
              <>
                <h2 className="mt-12 font-serif text-3xl text-[#1C3350]">Objetivos</h2>
                <ul className="mt-5 space-y-3 text-[#1C3350]/75">
                  {curso.objetivos.map(item => (
                    <li key={item} className="flex gap-3"><Icon name="check" className="mt-1 h-4 w-4 shrink-0" />{item}</li>
                  ))}
                </ul>
              </>
            )}
            {curso.programa.length > 0 && (
              <>
                <h2 className="mt-12 border-b border-[#1C3350]/15 pb-4 font-serif text-3xl text-[#1C3350]">Programa</h2>
                <div className="divide-y divide-[#1C3350]/15">
                  {curso.programa.map((item, index) => (
                    <div key={item} className="flex items-center gap-5 py-5">
                      <span className="text-xs font-extrabold text-[#A60000]">{String(index + 1).padStart(2, "0")}</span>
                      <strong>{item}</strong>
                    </div>
                  ))}
                </div>
              </>
            )}
            {curso.sessoes.length > 0 && (
              <>
                <h2 className="mt-12 border-b border-[#1C3350]/15 pb-4 font-serif text-3xl text-[#1C3350]">Próximas turmas</h2>
                <div className="divide-y divide-[#1C3350]/15">
                  {curso.sessoes.map(sessao => (
                    <div key={`${sessao.data}-${sessao.local}-${sessao.horario}`} className="flex flex-wrap items-center justify-between gap-3 py-5">
                      <strong>{sessao.data}</strong>
                      <span className="text-sm text-[#1C3350]/65">{[sessao.local, sessao.horario].filter(Boolean).join(" · ")}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          <aside className="h-fit bg-white p-7 shadow-[0_18px_50px_rgba(18,52,59,.1)] lg:sticky lg:top-28">
            <div className="mb-5 h-36 max-h-36 w-full max-w-full overflow-hidden bg-[#E7EBF0]">
              {curso.miniatura && <img src={curso.miniatura} alt="" className="h-full max-h-36 w-full object-cover" />}
            </div>
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#A60000]">{curso.enrollment}</p>
            <h2 className="mt-3 font-serif text-3xl text-[#1C3350]">{curso.price}</h2>
            <p className="mt-4 text-sm leading-6 text-[#1C3350]/65">Faça uma pré-inscrição sem compromisso. A equipa da ENA entra em contacto consigo.</p>
            <a href="/pre-inscricao" className="mt-7 flex w-full items-center justify-between bg-[#A60000] px-5 py-4 text-xs font-extrabold uppercase tracking-[0.08em] text-white hover:bg-[#8B0000]">
              Inscrever-me agora <Icon name="arrow" />
            </a>
          </aside>
        </div>
      </section>
    </main>
  );
}

export function SiteCurso({ slug }: { slug: string }) {
  return (
    <SiteFrame>
      <Pagina slug={slug} />
    </SiteFrame>
  );
}
