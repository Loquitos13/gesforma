import { createContext, FormEvent, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { InscricaoSite, useInscricao } from "./SiteInscricao";

export type Course = {
  id: string;
  title: string;
  area: string;
  format: string;
  duration: string;
  start: string;
  price: string;
  description: string;
  funding: "Financiada" | "Gold";
  enrollment: "Acesso direto" | "Pré-inscrição";
  miniatura: string | null;
  banner: string | null;
  precoDesde: number | null;
  vendas: number;
  regime: "gold" | "fin";
  objetivos: string[];
  organizacao: "modular" | "livre";
  programa: { titulo: string; horas: string }[];
  sessoes: { data: string; local: string; horario: string }[];
  nomeOferta: string;
};

type CatalogoApi = {
  cursos: Array<{
    id: string;
    regime: "gold" | "fin";
    titulo: string;
    area: string;
    modalidade: string;
    horasLabel: string;
    inicio: string;
    precoLabel: string;
    precoDesde: number | null;
    descricao: string;
    financiamento: "Gold" | "Financiada";
    inscricao: "Acesso direto" | "Pré-inscrição";
    miniatura: string | null;
    banner?: string | null;
    vendas: number;
    objetivos?: string[];
    organizacao?: "modular" | "livre";
    programa?: { titulo: string; horas: string }[];
    sessoes?: { data: string; local: string; horario: string }[];
    nomeOferta?: string;
  }>;
  destaques: CatalogoApi["cursos"];
  ccp: CatalogoApi["cursos"][number] | null;
};

function mapCurso(curso: CatalogoApi["cursos"][number]): Course {
  return {
    id: curso.id,
    title: curso.titulo,
    area: curso.area,
    format: curso.modalidade,
    duration: curso.horasLabel,
    start: curso.inicio,
    price: curso.precoLabel,
    description: curso.descricao,
    funding: curso.financiamento,
    enrollment: curso.inscricao,
    miniatura: curso.miniatura,
    banner: curso.banner ?? curso.miniatura,
    precoDesde: curso.precoDesde,
    vendas: curso.vendas,
    regime: curso.regime,
    objetivos: curso.objetivos ?? [],
    organizacao: curso.organizacao === "livre" ? "livre" : "modular",
    programa: curso.programa ?? [],
    sessoes: curso.sessoes ?? [],
    nomeOferta: curso.nomeOferta || curso.titulo,
  };
}

type OfertaEstado = {
  cursos: Course[];
  destaques: Course[];
  ccp: Course | null;
  estado: "a-carregar" | "pronto" | "erro";
  recarregar: () => void;
};

const OfertaCtx = createContext<OfertaEstado | null>(null);

export function useOferta() {
  const ctx = useContext(OfertaCtx);
  if (!ctx) throw new Error("useOferta precisa do site");
  return ctx;
}

function useOfertaState(): OfertaEstado {
  const [cursos, setCursos] = useState<Course[]>([]);
  const [destaques, setDestaques] = useState<Course[]>([]);
  const [ccp, setCcp] = useState<Course | null>(null);
  const [estado, setEstado] = useState<OfertaEstado["estado"]>("a-carregar");
  const [tick, setTick] = useState(0);
  const recarregar = useCallback(() => setTick(n => n + 1), []);

  useEffect(() => {
    let vivo = true;
    setEstado("a-carregar");
    fetch("/api/v1/public/catalogo", { cache: "no-store" })
      .then(async res => {
        if (!res.ok) throw new Error("oferta indisponível");
        return res.json() as Promise<CatalogoApi>;
      })
      .then(data => {
        if (!vivo) return;
        setCursos((data.cursos ?? []).map(mapCurso));
        setDestaques((data.destaques ?? []).map(mapCurso));
        setCcp(data.ccp ? mapCurso(data.ccp) : null);
        setEstado("pronto");
      })
      .catch(() => {
        if (!vivo) return;
        setEstado("erro");
      });
    return () => {
      vivo = false;
    };
  }, [tick]);

  return { cursos, destaques, ccp, estado, recarregar };
}


export function Icon({
  name,
  className = "h-5 w-5",
}: {
  name: "arrow" | "search" | "clock" | "pin" | "screen" | "check" | "close" | "menu" | "whatsapp";
  className?: string;
}) {
  const paths: Record<string, ReactNode> = {
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2" /></>,
    screen: <><rect x="3" y="4" width="18" height="13" rx="1" /><path d="M8 21h8m-4-4v4" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="M6 6l12 12M18 6 6 18" />,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    whatsapp: <><path d="M20.5 11.6a8.5 8.5 0 0 1-12.6 7.5L3.5 20.5l1.4-4.2a8.5 8.5 0 1 1 15.6-4.7Z" /><path d="M8.2 7.8c.2-.4.4-.4.7-.4h.5c.2 0 .4 0 .5.4l.8 1.9c.1.3.1.5-.1.7l-.7.8c-.2.2-.1.4 0 .6.7 1.2 1.7 2.2 2.9 2.8.2.1.4.1.6-.1l.8-1c.2-.2.4-.3.7-.2l2 .9c.3.1.4.3.4.5 0 .3-.2 1.5-1 2.1-.6.6-1.5.8-2.5.5-1-.3-4.3-1.6-6.3-5.2-.6-1.1-.8-2.2-.7-2.9.1-.7.8-1.4 1.4-1.4Z" /></>,
  };
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-[#1C3350]/10 bg-[#F9F9F9]/95 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-[1240px] items-center justify-between px-5 lg:px-8">
        <a href="/" className="group flex items-center gap-3" aria-label="ENA, página inicial">
          <img src="/imagens/ena_logo.svg" alt="ENA" className="h-9 w-auto sm:h-10" />
          <span className="hidden text-left text-[10px] font-bold uppercase leading-tight tracking-[0.12em] text-[#1C3350]/70 sm:block">Escola de<br />Negócios e Administração</span>
        </a>
        <nav className="hidden items-center gap-8 text-sm font-semibold lg:flex" aria-label="Navegação principal">
          <a href="/formacao" className="hover:text-[#A60000]">Formação</a>
          <a href="/#empresas" className="hover:text-[#A60000]">Empresas</a>
        </nav>
        <div className="hidden items-center gap-4 lg:flex">
          <a href="/entrar" className="text-sm font-semibold underline decoration-[#A60000] decoration-2 underline-offset-4">Área de formando</a>
          <a href="/entrar" className="bg-[#1C3350] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#A60000]">Iniciar Sessão</a>
        </div>
        <button type="button" onClick={() => setOpen(!open)} className="p-2 lg:hidden" aria-label={open ? "Fechar menu" : "Abrir menu"}><Icon name={open ? "close" : "menu"} /></button>
      </div>
      {open && (
        <nav className="border-t border-[#1C3350]/10 bg-[#F9F9F9] px-5 py-6 lg:hidden">
          <div className="flex flex-col gap-5 font-semibold">
            <a href="/formacao" onClick={() => setOpen(false)}>Formação</a>
            <a href="/#empresas" onClick={() => setOpen(false)}>Empresas</a>
            <a href="/entrar" className="border-t border-[#1C3350]/10 pt-5 text-[#A60000]">Área de formando</a>
            <a href="/entrar" className="bg-[#1C3350] px-5 py-3 text-center text-sm font-bold text-white">Iniciar Sessão</a>
          </div>
        </nav>
      )}
    </header>
  );
}

function Moldura({ src, alt }: { src: string | null | undefined; alt: string }) {
  return (
    <div className="h-24 max-h-24 w-full max-w-full overflow-hidden bg-[#E7EBF0]">
      {src ? <img src={src} alt={alt} className="h-full max-h-24 w-full max-w-full object-cover" /> : null}
    </div>
  );
}

function SplitHero() {
  const { ccp, cursos } = useOferta();
  const { abrir } = useInscricao();
  const financiada = cursos.find(curso => curso.regime === "fin" && curso.miniatura) ?? cursos.find(curso => curso.regime === "fin");
  const preco = ccp?.precoDesde != null ? `A partir de ${ccp.precoDesde.toLocaleString("pt-PT")}€` : "A partir de 100€";
  return (
    <section className="px-4 pb-2 pt-4 sm:px-6 lg:px-8" aria-label="Destaques">
      <div className="relative mx-auto grid max-w-[1240px] overflow-hidden rounded-[32px] bg-white shadow-[0_28px_80px_rgba(20,38,61,.08)] lg:min-h-[860px] lg:grid-cols-[minmax(0,.78fr)_minmax(0,1.22fr)]">
        <div className="relative z-20 flex flex-col justify-center px-6 pb-4 pt-10 sm:px-8 lg:px-10 lg:py-12">
          <h1 className="max-w-[18ch] font-serif text-[2rem] font-bold leading-[1.08] tracking-[-0.03em] text-[#1C3350] sm:text-4xl">
            Certifique o seu futuro com formação de referência.
          </h1>
          <p className="mt-4 max-w-xs text-sm leading-6 text-[#1C3350]/60">
            Formação de formadores com CCP e formação financiada com subsídio de alimentação.
          </p>
          <a href="/formacao" className="mt-5 inline-flex w-fit items-center rounded-full border border-[#1C3350]/30 px-5 py-2.5 text-sm font-semibold text-[#1C3350]/80 transition-colors hover:bg-[#1C3350] hover:text-white">
            Explorar todos os cursos
          </a>
        </div>
        <div className="relative z-20 flex flex-col gap-6 px-4 pb-32 pt-2 lg:block lg:h-auto lg:min-h-full lg:px-0 lg:pb-0 lg:pt-0">
          <div className="relative mx-auto h-[180px] w-[180px] shrink-0 overflow-hidden rounded-full bg-[#E7EBF0] shadow-[0_0_0_10px_#E7EBF0] sm:h-[220px] sm:w-[220px] lg:absolute lg:right-[-4rem] lg:top-1/2 lg:mx-0 lg:h-[620px] lg:w-[620px] lg:-translate-y-1/2 lg:shadow-[0_0_0_14px_#E7EBF0]">
            <img
              src="https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=1400&q=80"
              alt="Sessão de formação em sala"
              className="h-full w-full object-cover object-[center_30%]"
            />
          </div>
          <div className="relative z-20 flex flex-col gap-6 lg:absolute lg:inset-0 lg:block">
            <article className="ena-flutuar w-full overflow-hidden rounded-2xl bg-white shadow-[0_18px_50px_rgba(28,51,80,.16)] lg:absolute lg:left-0 lg:top-[8%] lg:w-[360px]">
              <Moldura src={ccp?.miniatura} alt={ccp?.title ?? "Formação de Formadores"} />
              <div className="p-5">
                <span className="inline-flex rounded-md bg-[#FFF1D1] px-2.5 py-1 text-[11px] font-extrabold text-[#C47A00]">{preco}</span>
                <h2 className="mt-3 font-serif text-xl font-bold leading-tight text-[#1C3350]">{ccp?.title ?? "Formação de Formadores (CCP)"}</h2>
                <p className="mt-2 text-sm text-[#1C3350]/55">{ccp?.area ?? "Formação de formadores"}</p>
                {ccp ? (
                  <button type="button" onClick={() => abrir(ccp)} className="mt-4 flex w-full items-center justify-center rounded-full bg-[#1C3350] px-3 py-2.5 text-center text-xs font-extrabold uppercase tracking-[0.08em] text-white transition-colors hover:bg-[#A60000]">Inscrever-me agora</button>
                ) : (
                  <a href="/formacao" className="mt-4 flex w-full items-center justify-center rounded-full bg-[#1C3350] px-3 py-2.5 text-center text-xs font-extrabold uppercase tracking-[0.08em] text-white transition-colors hover:bg-[#A60000]">Explorar cursos</a>
                )}
              </div>
            </article>
            <article className="ena-flutuar-b w-full overflow-hidden rounded-2xl bg-white shadow-[0_18px_50px_rgba(28,51,80,.16)] lg:absolute lg:right-3 lg:top-[46%] lg:w-[360px]">
              <Moldura src={financiada?.miniatura} alt="Formação financiada" />
              <div className="p-5">
                <span className="inline-flex rounded-md bg-[#FFF1D1] px-2.5 py-1 text-[11px] font-extrabold text-[#C47A00]">Grátis + Subsídio</span>
                <h2 className="mt-3 font-serif text-xl font-bold leading-tight text-[#1C3350]">Formação Financiada</h2>
                <p className="mt-2 text-sm text-[#1C3350]/55">Grátis + subsídio</p>
                <a href="/formacao?linha=financiada" className="mt-4 flex w-full items-center justify-center rounded-full bg-[#1C3350] px-4 py-2.5 text-center text-xs font-extrabold uppercase tracking-[0.08em] text-white transition-colors hover:bg-[#A60000]">Explorar cursos</a>
              </div>
            </article>
          </div>
        </div>
        <svg aria-hidden="true" className="pointer-events-none absolute bottom-0 left-0 z-10 h-24 w-full sm:h-28" viewBox="0 0 1200 140" preserveAspectRatio="none">
          <path d="M0 140V72C90 36 180 108 320 78C460 48 540 18 700 42C860 66 940 112 1080 82C1140 68 1170 88 1200 74V140H0Z" fill="#1C3350" />
          <path d="M0 140V104C140 78 240 124 420 106C600 88 700 126 900 108C1040 96 1120 122 1200 104V140H0Z" fill="#FFA900" />
        </svg>
      </div>
    </section>
  );
}

function Home() {
  const { destaques, estado, recarregar } = useOferta();
  const [filter, setFilter] = useState("Todos");
  const [query, setQuery] = useState("");
  const filtros = useMemo(() => {
    const modos = new Set(destaques.map(curso => curso.format));
    return ["Todos", ...["Presencial", "B-learning", "E-learning"].filter(modo => modos.has(modo))];
  }, [destaques]);
  const filtered = useMemo(
    () => destaques.filter((course) =>
      (filter === "Todos" || course.format === filter) &&
      `${course.title} ${course.area}`.toLowerCase().includes(query.toLowerCase())),
    [destaques, filter, query],
  );

  return (
    <main>
      <SplitHero />

      <section id="formacao" className="scroll-mt-24 bg-[#F9F9F9] px-5 py-20 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-[1240px]">
          <div className="flex flex-col justify-between gap-7 lg:flex-row lg:items-end">
            <div>
              <p className="mb-4 text-xs font-extrabold uppercase tracking-[0.18em] text-[#A60000]">Oferta formativa</p>
              <h2 className="font-serif text-4xl leading-tight tracking-[-0.03em] text-[#1C3350] sm:text-5xl">Encontre a formação certa<br className="hidden sm:block" /> para o seu momento.</h2>
            </div>
            <label className="flex w-full items-center gap-3 border-b-2 border-[#1C3350] pb-3 lg:max-w-sm">
              <Icon name="search" />
              <span className="sr-only">Pesquisar formação</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar curso ou área..." className="w-full bg-transparent text-sm outline-none placeholder:text-[#1C3350]/45" />
            </label>
          </div>
          <div className="mt-10 flex flex-wrap gap-2 border-b border-[#1C3350]/15 pb-5">
            {filtros.map((item) => (
              <button key={item} type="button" onClick={() => setFilter(item)} className={`px-5 py-2.5 text-sm font-bold transition-colors ${filter === item ? "bg-[#1C3350] text-white" : "bg-white text-[#1C3350] hover:bg-[#1C3350]/10"}`}>
                {item}
              </button>
            ))}
            <span className="ml-auto hidden self-center text-sm text-[#1C3350]/55 sm:block">{filtered.length} formações disponíveis</span>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {estado === "pronto" && filtered.map((course) => (
              <article key={course.id} className="group flex min-h-[390px] max-w-full flex-col overflow-hidden border border-[#1C3350]/12 bg-white transition-all hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(18,52,59,.12)]">
                <a href={`/formacao/${course.id}`} className="relative block h-44 max-h-44 w-full max-w-full overflow-hidden bg-[#E7EBF0]">
                  {course.miniatura && <img src={course.miniatura} alt="" className="h-full max-h-44 w-full max-w-full object-cover" />}
                  <span className={`absolute left-4 top-4 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.1em] ${course.format === "E-learning" ? "bg-[#FFA900] text-[#1C3350]" : "bg-[#1C3350] text-white"}`}>{course.format}</span>
                </a>
                <div className="flex flex-1 flex-col p-6">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#A60000]">{course.area}</p>
                  <h3 className="mt-3 font-serif text-2xl leading-tight text-[#1C3350]"><a href={`/formacao/${course.id}`} className="hover:text-[#A60000]">{course.title}</a></h3>
                  <p className="mt-4 text-sm leading-6 text-[#1C3350]/65">{course.description}</p>
                  <div className="mt-auto flex items-end justify-between border-t border-[#1C3350]/10 pt-5">
                    <div className="space-y-2 text-xs font-semibold text-[#1C3350]/65">
                      <span className="flex items-center gap-2"><Icon name="clock" className="h-4 w-4" />{course.duration}</span>
                      <span className="flex items-center gap-2"><Icon name={course.format === "E-learning" ? "screen" : "pin"} className="h-4 w-4" />{course.start}</span>
                    </div>
                    <a href={`/formacao/${course.id}`} aria-label={`Ver ${course.title}`} className="grid h-11 w-11 place-items-center bg-[#1C3350] text-white transition-colors group-hover:bg-[#A60000]"><Icon name="arrow" /></a>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {estado === "a-carregar" && <p className="py-20 text-center text-[#1C3350]/60">A carregar a oferta formativa.</p>}
          {estado === "erro" && (
            <div className="py-16 text-center">
              <p className="text-[#1C3350]/70">Não foi possível carregar os cursos.</p>
              <button type="button" onClick={recarregar} className="mt-4 bg-[#1C3350] px-5 py-3 text-sm font-bold text-white">Tentar de novo</button>
            </div>
          )}
          {estado === "pronto" && filtered.length === 0 && <p className="py-20 text-center text-[#1C3350]/60">Não encontrámos formações para esta pesquisa.</p>}
        </div>
      </section>

      <section id="metodo" className="bg-white px-5 py-20 lg:px-8 lg:py-28">
        <div className="mx-auto grid max-w-[1240px] gap-14 lg:grid-cols-[.85fr_1.15fr] lg:items-center">
          <div className="relative">
            <div className="aspect-[4/5] overflow-hidden">
              <img src="https://images.unsplash.com/photo-1570616969692-54d6ba3d0397?auto=format&fit=crop&w=1200&q=80" alt="Sessão de formação colaborativa" className="h-full w-full object-cover" />
            </div>
            <div className="absolute -bottom-7 -right-3 w-44 bg-[#A60000] p-5 text-white sm:right-8">
              <strong className="block font-serif text-4xl">4,8/5</strong>
              <span className="mt-1 block text-xs font-bold uppercase tracking-wider">Satisfação média</span>
            </div>
          </div>
          <div>
            <p className="mb-4 text-xs font-extrabold uppercase tracking-[0.18em] text-[#A60000]">Mais do que aprender</p>
            <h2 className="font-serif text-4xl leading-tight tracking-[-0.03em] text-[#1C3350] sm:text-5xl">Conhecimento que se transforma em ação.</h2>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[#1C3350]/65">Na ENA, cada percurso é desenhado para criar impacto real — no trabalho, nas equipas e na comunidade.</p>
            <div className="mt-10 grid gap-x-8 gap-y-7 sm:grid-cols-2">
              {[
                ["01", "Formadores no terreno", "Especialistas com experiência real e gosto por ensinar."],
                ["02", "Aprendizagem prática", "Casos, ferramentas e desafios que fazem parte do dia a dia."],
                ["03", "Acompanhamento próximo", "Uma equipa disponível antes, durante e depois da formação."],
                ["04", "Formatos flexíveis", "Presencial, online ou à medida da sua organização."],
              ].map(([number, title, text]) => (
                <div key={number} className="border-t border-[#1C3350]/20 pt-5">
                  <span className="text-xs font-extrabold text-[#A60000]">{number}</span>
                  <h3 className="mt-2 font-bold text-[#1C3350]">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#1C3350]/60">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="empresas" className="scroll-mt-24 bg-[#EDEEF1] px-5 py-16 lg:px-8">
        <div className="mx-auto flex max-w-[1240px] flex-col justify-between gap-8 lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#A60000]">Formação à medida</p>
            <h2 className="mt-4 font-serif text-4xl text-[#1C3350]">A sua organização tem desafios únicos.</h2>
            <p className="mt-4 text-[#1C3350]/65">Desenhamos programas que respondem às necessidades da sua equipa e aos objetivos do seu negócio.</p>
          </div>
          <a href="#contactos" className="group flex min-w-fit items-center justify-between gap-10 bg-[#1C3350] px-7 py-5 font-bold text-white hover:bg-[#A60000]">Conhecer soluções <Icon name="arrow" className="transition-transform group-hover:translate-x-1" /></a>
        </div>
      </section>
    </main>
  );
}

function Footer() {
  return (
    <footer id="contactos" className="scroll-mt-24 bg-[#14263D] px-5 py-14 text-white lg:px-8">
      <div className="mx-auto max-w-[1240px]">
        <div className="grid gap-10 border-b border-white/15 pb-12 md:grid-cols-4">
          <div className="md:col-span-2"><span className="grid h-12 w-12 place-items-center bg-[#A60000] text-sm font-extrabold">ENA</span><p className="mt-5 max-w-sm text-sm leading-6 text-white/55">Capacitamos pessoas e organizações através de experiências de aprendizagem relevantes, práticas e transformadoras.</p></div>
          <div><strong className="text-sm">Contactos</strong><p className="mt-4 text-sm leading-7 text-white/55">formacao@ena.pt<br />+351 210 000 000<br />2ª a 6ª, 09h—18h</p></div>
          <div><strong className="text-sm">Ligações úteis</strong><div className="mt-4 flex flex-col gap-3 text-sm text-white/55"><a href="/formacao">Formação</a><a href="https://ena.pt/politica-de-privacidade" target="_blank" rel="noreferrer">Política de privacidade</a><a href="https://www.livroreclamacoes.pt/Inicio/" target="_blank" rel="noreferrer">Livro de reclamações</a></div></div>
        </div>
        <div className="flex flex-col justify-between gap-3 pt-6 text-xs text-white/35 sm:flex-row"><span>© 2025 ENA. Todos os direitos reservados.</span><span>Aprender. Evoluir. Transformar.</span></div>
      </div>
    </footer>
  );
}

function WhatsAppAssistant() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"welcome" | "name" | "goal" | "path" | "format" | "courses" | "confirm" | "handoff">("welcome");
  const [typing, setTyping] = useState(false);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [path, setPath] = useState<"all" | "funded" | "gold" | "direct">("all");
  const [format, setFormat] = useState("Todos");
  const { cursos } = useOferta();
  const { abrir } = useInscricao();
  const [chosen, setChosen] = useState<Course | null>(null);
  const [consent, setConsent] = useState(false);
  const [summarySent, setSummarySent] = useState(false);
  const [handoffSent, setHandoffSent] = useState(false);
  const transition = (next: typeof step) => {
    setTyping(true);
    window.setTimeout(() => {
      setStep(next);
      setTyping(false);
    }, 520);
  };
  const pathCourses = cursos.filter((course) =>
    path === "funded" ? course.funding === "Financiada" :
      path === "gold" ? course.funding === "Gold" :
        path === "direct" ? course.enrollment === "Acesso direto" : true,
  );
  const availableFormats = Array.from(new Set(pathCourses.map((course) => course.format)));
  const goalAreas: Record<string, string[]> = {
    "Competências digitais": ["Digital"],
    "Gestão e liderança": ["Gestão", "Competências"],
    "Saúde e segurança": ["Saúde", "Segurança"],
  };
  const visibleCourses = pathCourses
    .filter((course) => format === "Todos" || course.format === format)
    .sort((a, b) => Number(goalAreas[goal]?.includes(b.area)) - Number(goalAreas[goal]?.includes(a.area)));
  const restart = () => {
    setStep("welcome");
    setFormat("Todos");
    setPath("all");
    setGoal("");
    setName("");
    setChosen(null);
    setTyping(false);
    setConsent(false);
    setSummarySent(false);
    setHandoffSent(false);
  };
  const chooseCourse = (course: Course) => {
    setChosen(course);
    transition("confirm");
  };
  const progress = { welcome: 0, name: 1, goal: 2, path: 3, format: 4, courses: 4, confirm: 4, handoff: 4 }[step];
  const botCopy = {
    welcome: "Olá! Sou a Eva, assistente virtual da ENA. Em menos de dois minutos ajudo a encontrar a formação certa e a tratar da inscrição.",
    name: "Antes de começarmos, como gostaria que lhe chamasse?",
    goal: `Muito prazer, ${name || "por aqui"}! O que procura desenvolver neste momento?`,
    path: "Prefere formação financiada ou uma solução ENA Gold autofinanciada?",
    format: "E em que formato gostaria de aprender?",
    courses: `${name}, selecionei ${visibleCourses.length} ${visibleCourses.length === 1 ? "opção" : "opções"} com base nas suas respostas.`,
    confirm: chosen ? `Esta é uma boa opção para ${goal.toLowerCase() || "o seu objetivo"}. Quer avançar?` : "",
    handoff: "Claro. Deixe um contacto e um consultor ENA continuará esta conversa consigo.",
  }[step];

  function enviar(event: FormEvent) {
    event.preventDefault();
    setHandoffSent(true);
  }

  return (
    <>
      {open && (
        <aside className="fixed bottom-24 right-4 z-50 flex max-h-[min(680px,calc(100vh-120px))] w-[calc(100vw-32px)] max-w-[390px] flex-col overflow-hidden rounded-2xl bg-[#F4F6F4] shadow-[0_24px_80px_rgba(20,38,61,.3)] sm:right-6" aria-label="Assistente de pré-inscrição">
          <header className="flex items-center justify-between bg-[#075E54] p-4 text-white">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white/15"><Icon name="whatsapp" className="h-6 w-6" /></span>
              <div><strong className="block text-sm">Eva · Assistente ENA</strong><span className="flex items-center gap-1.5 text-xs text-white/70"><span className="h-2 w-2 rounded-full bg-[#25D366]" />Responde de imediato</span></div>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="p-2 text-white/75 hover:text-white" aria-label="Fechar conversa"><Icon name="close" /></button>
          </header>
          {step !== "welcome" && <div className="bg-white px-4 py-2"><div className="flex items-center gap-2">{[1, 2, 3, 4].map((item) => <span key={item} className={`h-1.5 flex-1 rounded-full ${progress >= item ? "bg-[#25D366]" : "bg-[#EDEEF1]"}`} />)}</div><p className="mt-1.5 text-right text-[9px] font-bold uppercase tracking-wider text-[#1C3350]/35">Passo {Math.min(progress, 4)} de 4</p></div>}
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {name && step !== "name" && <div className="ml-auto max-w-[82%] rounded-2xl rounded-tr-sm bg-[#DCF8C6] px-3 py-2 text-sm shadow-sm">Pode chamar-me {name}.</div>}
            {goal && !["goal", "name"].includes(step) && <div className="ml-auto max-w-[82%] rounded-2xl rounded-tr-sm bg-[#DCF8C6] px-3 py-2 text-sm shadow-sm">{goal}</div>}
            {typing ? (
              <div className="flex w-fit items-center gap-1 rounded-2xl rounded-tl-sm bg-white px-4 py-4 shadow-sm" aria-label="Eva está a escrever">
                {[0, 1, 2].map((item) => <span key={item} className="h-2 w-2 animate-bounce rounded-full bg-[#1C3350]/35" style={{ animationDelay: `${item * 120}ms` }} />)}
              </div>
            ) : <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-white p-3 text-sm leading-6 shadow-sm">{botCopy}<span className="mt-1 block text-right text-[10px] text-[#1C3350]/35">agora</span></div>}

            {!typing && step === "welcome" && (
              <div className="ml-auto max-w-[88%]">
                <button type="button" onClick={() => transition("name")} className="flex w-full items-center justify-between rounded-xl bg-[#075E54] px-4 py-3 text-left text-sm font-bold text-white shadow-sm">Começar recomendação <Icon name="arrow" className="h-4 w-4" /></button>
                <button type="button" onClick={() => { setName("Visitante"); setPath("direct"); setFormat("E-learning"); transition("courses"); }} className="mt-2 w-full rounded-xl bg-[#DCF8C6] px-4 py-3 text-left text-sm font-bold text-[#1C3350] shadow-sm">Ir diretamente para cursos online</button>
              </div>
            )}

            {!typing && step === "name" && (
              <form onSubmit={(event) => { event.preventDefault(); if (name.trim()) transition("goal"); }} className="ml-auto flex max-w-[90%] gap-2 rounded-2xl rounded-tr-sm bg-[#DCF8C6] p-2 shadow-sm">
                <input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="O seu primeiro nome" className="min-w-0 flex-1 rounded-lg bg-white px-3 py-2.5 text-sm outline-none" />
                <button type="submit" disabled={!name.trim()} className="grid h-10 w-10 place-items-center rounded-lg bg-[#075E54] text-white disabled:opacity-40" aria-label="Continuar"><Icon name="arrow" className="h-4 w-4" /></button>
              </form>
            )}

            {!typing && step === "goal" && (
              <div className="ml-auto grid max-w-[90%] gap-2">
                {["Evoluir na carreira", "Competências digitais", "Gestão e liderança", "Saúde e segurança"].map((item) => <button type="button" key={item} onClick={() => { setGoal(item); transition("path"); }} className="rounded-xl bg-[#DCF8C6] px-4 py-3 text-left text-sm font-bold shadow-sm">{item}</button>)}
              </div>
            )}

            {!typing && step === "path" && (
              <div className="ml-auto grid max-w-[90%] gap-2">
                {[
                  ["funded", "Formação financiada", "Sem pagamento, sujeita a elegibilidade"],
                  ["direct", "Gold · acesso direto", "Pagamento e entrada imediata no Moodle"],
                  ["gold", "Gold · todas as opções", "Acesso direto ou pré-inscrição"],
                  ["all", "Quero comparar tudo", "Mostrar toda a oferta"],
                ].map(([value, label, description]) => <button type="button" key={value} onClick={() => { setPath(value as typeof path); transition("format"); }} className="rounded-xl bg-[#DCF8C6] px-4 py-3 text-left shadow-sm"><strong className="block text-sm">{label}</strong><span className="mt-1 block text-xs font-normal text-[#1C3350]/55">{description}</span></button>)}
              </div>
            )}

            {!typing && step === "format" && (
              <div className="ml-auto grid max-w-[88%] gap-2">
                {[...availableFormats, "Todos"].map((item) => <button type="button" key={item} onClick={() => { setFormat(item as typeof format); transition("courses"); }} className="rounded-xl bg-[#DCF8C6] px-4 py-3 text-left text-sm font-bold shadow-sm">{item === "Todos" ? "Sem preferência" : item}</button>)}
              </div>
            )}

            {!typing && step === "courses" && (
              <div className="ml-auto max-w-[94%] space-y-2">
                {visibleCourses.slice(0, 4).map((course, index) => (
                  <button type="button" key={course.id} onClick={() => chooseCourse(course)} className="w-full rounded-xl bg-white p-3 text-left shadow-sm ring-1 ring-[#1C3350]/8 hover:ring-[#25D366]">
                    <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-wider text-[#075E54]">{course.funding === "Gold" ? "ENA Gold" : "Financiada"} · {course.enrollment}</span>{index === 0 && goal && <span className="rounded-full bg-[#DCF8C6] px-2 py-0.5 text-[9px] font-bold text-[#075E54]">Recomendada</span>}</div>
                    <strong className="mt-1 block text-sm leading-5">{course.title}</strong>
                    <span className="mt-2 flex justify-between text-xs text-[#1C3350]/50"><span>{course.format} · {course.duration}</span><b className="text-[#1C3350]">{course.price}</b></span>
                  </button>
                ))}
                <div className="flex justify-between px-2 pt-1"><button type="button" onClick={() => transition("path")} className="text-xs font-bold text-[#075E54] underline">Alterar respostas</button><button type="button" onClick={restart} className="text-xs text-[#1C3350]/45 underline">Recomeçar</button></div>
              </div>
            )}

            {!typing && step === "confirm" && chosen && (
              <>
                <div className="ml-auto max-w-[90%] rounded-2xl rounded-tr-sm bg-[#DCF8C6] p-3 text-sm shadow-sm">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#075E54]">A sua escolha</span><strong className="mt-1 block">{chosen.title}</strong><span className="mt-2 block text-[#1C3350]/60">{chosen.format} · {chosen.duration} · {chosen.price}</span>
                </div>
                <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-white p-3 text-sm leading-6 shadow-sm">
                  {chosen.enrollment === "Acesso direto" ? `Perfeito, ${name}. Primeiro os seus dados e a turma. O pagamento fica no passo seguinte.` : `Perfeito, ${name}. A pré-inscrição pede os seus dados e a turma. A equipa da ENA confirma os próximos passos.`}
                </div>
                <div className="ml-auto grid max-w-[90%] gap-2">
                  <label className="flex items-start gap-2 rounded-xl bg-white p-3 text-xs leading-5 shadow-sm"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 accent-[#075E54]" />Aceito que os dados desta conversa sejam usados para tratar a inscrição.</label>
                  <button type="button" disabled={!consent || !chosen} onClick={() => { if (chosen) abrir(chosen); }} className="flex w-full items-center justify-between rounded-xl bg-[#075E54] px-4 py-3 text-sm font-bold text-white disabled:opacity-40">Fazer pré-inscrição<Icon name="arrow" className="h-4 w-4" /></button>
                  <button type="button" onClick={() => setSummarySent(true)} className="rounded-xl bg-[#DCF8C6] px-4 py-3 text-left text-sm font-bold">{summarySent ? "Resumo enviado para o seu email" : "Enviar-me este resumo por email"}</button>
                  <button type="button" onClick={() => transition("courses")} className="rounded-xl bg-[#DCF8C6] px-4 py-3 text-left text-sm font-bold">Ver outras recomendações</button>
                  <button type="button" onClick={restart} className="px-4 py-2 text-left text-xs font-bold text-[#075E54] underline">Recomeçar conversa</button>
                </div>
              </>
            )}
            {!typing && step === "handoff" && (
              handoffSent ? <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-white p-4 text-sm leading-6 shadow-sm"><strong className="text-[#075E54]">Pedido registado.</strong><p className="mt-1 text-[#1C3350]/60">Continue no formulário de pré-inscrição para a equipa ENA o contactar.</p><a href="/pre-inscricao" className="mt-3 inline-flex font-bold text-[#075E54] underline">Abrir pré-inscrição</a></div> :
                <form onSubmit={enviar} className="ml-auto max-w-[92%] space-y-2 rounded-2xl rounded-tr-sm bg-[#DCF8C6] p-3 shadow-sm">
                  <input required defaultValue={name} placeholder="Nome" className="w-full rounded-lg bg-white px-3 py-2.5 text-sm outline-none" />
                  <input required type="email" placeholder="Email" className="w-full rounded-lg bg-white px-3 py-2.5 text-sm outline-none" />
                  <input required type="tel" placeholder="Telefone" className="w-full rounded-lg bg-white px-3 py-2.5 text-sm outline-none" />
                  <button type="submit" className="w-full rounded-lg bg-[#075E54] px-4 py-3 text-sm font-bold text-white">Pedir contacto humano</button>
                </form>
            )}
          </div>
          <footer className="flex items-center justify-between border-t border-[#1C3350]/8 bg-white px-4 py-3 text-[10px] text-[#1C3350]/40"><button type="button" onClick={() => transition("handoff")} className="font-bold text-[#075E54]">Falar com uma pessoa</button><button type="button" onClick={restart} className="font-bold text-[#075E54]">Limpar conversa</button></footer>
        </aside>
      )}
      <button type="button" onClick={() => setOpen(!open)} className="fixed bottom-5 right-4 z-50 grid h-16 w-16 place-items-center rounded-full bg-[#25D366] text-white shadow-[0_12px_35px_rgba(7,94,84,.35)] transition-transform hover:scale-105 sm:right-6" aria-label={open ? "Fechar assistente" : "Abrir assistente de pré-inscrição"}>
        <Icon name={open ? "close" : "whatsapp"} className="h-8 w-8" />
        {!open && <span className="absolute -right-0.5 -top-0.5 grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-[#A60000] text-[10px] font-bold">1</span>}
      </button>
    </>
  );
}

export function SiteFrame({ children }: { children: ReactNode }) {
  const oferta = useOfertaState();
  return (
    <OfertaCtx.Provider value={oferta}>
      <InscricaoSite>
        <div className="site-ena min-h-screen bg-[#F9F9F9] text-[#1C3350]">
          <Header />
          {children}
          <Footer />
          <WhatsAppAssistant />
        </div>
      </InscricaoSite>
    </OfertaCtx.Provider>
  );
}

export function SiteLanding() {
  useEffect(() => {
    const prev = document.title;
    document.title = "ENA | Escola de Negócios e Administração";
    return () => {
      document.title = prev;
    };
  }, []);

  return (
    <SiteFrame>
      <Home />
    </SiteFrame>
  );
}
