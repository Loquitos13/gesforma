// Continuação de SiteLandingSeccoes.tsx (partido para ficar abaixo das 500 linhas).
import { FormEvent, ReactNode, useEffect, useState } from "react";
import { ApiError, apiPublicPreinscricao } from "../partilhado/api";
import { InscricaoSite, useInscricao } from "./SiteInscricao";
import { ePrepago, ePreinscricao, objectivosEva } from "../partilhado/siteConteudo";
import { Course, OfertaCtx, SiteTextoCtx, useSiteTexto, useSiteTextoState, useOferta, useOfertaState, Icon } from "./SiteLanding";
import { CabecalhoSite, molduraDaPagina, PaginaSite, RodapeSite, usePagina } from "./PaginaSite";

function WhatsAppAssistant() {
  const t = useSiteTexto();
  const nomeEva = t("evaNome").trim() || "Eva";
  const objectivos = objectivosEva(t("evaObjetivos"));
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
  const [handoffBusy, setHandoffBusy] = useState(false);
  const [handoffErro, setHandoffErro] = useState("");
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
        path === "direct" ? !ePreinscricao(course.enrollment) : true,
  );
  const availableFormats = Array.from(new Set(pathCourses.map((course) => course.format)));
  const goalAreas: Record<string, string[]> = Object.fromEntries(
    objectivos.filter(item => item.areas.length).map(item => [item.rotulo, item.areas]),
  );
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
    setHandoffErro("");
  };
  const chooseCourse = (course: Course) => {
    setChosen(course);
    transition("confirm");
  };
  const progress = { welcome: 0, name: 1, goal: 2, path: 3, format: 4, courses: 4, confirm: 4, handoff: 4 }[step];
  const botCopy = {
    welcome: t("evaBoasVindas"),
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
    const dados = new FormData(event.currentTarget as HTMLFormElement);
    const nome = String(dados.get("nome") ?? "").trim();
    const email = String(dados.get("email") ?? "").trim();
    const telf = String(dados.get("telf") ?? "").trim();
    if (!nome || !email || !telf) return;
    setHandoffBusy(true);
    setHandoffErro("");
    void apiPublicPreinscricao({
      nome,
      email,
      telf,
      origem: "WhatsApp",
      consentimento: dados.get("consentimento") === "on",
      curso: chosen?.nomeOferta || chosen?.title || "Contacto pelo site",
      regime: chosen?.regime ?? "gold",
    }).then(() => setHandoffSent(true))
      .catch(err => setHandoffErro(err instanceof ApiError ? err.message : "Não foi possível registar o contacto."))
      .finally(() => setHandoffBusy(false));
  }

  return (
    <>
      {open && (
        <aside className="fixed bottom-24 right-4 z-50 flex max-h-[min(680px,calc(100vh-120px))] w-[calc(100vw-32px)] max-w-[390px] flex-col overflow-hidden rounded-2xl bg-[#F4F6F4] shadow-[0_24px_80px_rgba(20,38,61,.3)] sm:right-6" aria-label="Assistente de pré-inscrição">
          <header className="flex items-center justify-between bg-[#075E54] p-4 text-white">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white/15"><Icon name="whatsapp" className="h-6 w-6" /></span>
              <div><strong className="block text-sm">{nomeEva} · Assistente ENA</strong><span className="flex items-center gap-1.5 text-xs text-white/70"><span className="h-2 w-2 rounded-full bg-[#25D366]" />Responde de imediato</span></div>
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
                {objectivos.map((item) => <button type="button" key={item.rotulo} onClick={() => { setGoal(item.rotulo); transition("path"); }} className="rounded-xl bg-[#DCF8C6] px-4 py-3 text-left text-sm font-bold shadow-sm">{item.rotulo}</button>)}
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
                  {ePreinscricao(chosen.enrollment)
                    ? `Perfeito, ${name}. A pré-inscrição pede os seus dados e, quando existir, a turma. A equipa da ENA confirma os próximos passos.`
                    : ePrepago(chosen.enrollment)
                      ? `Perfeito, ${name}. Primeiro os seus dados. O pagamento fica no passo seguinte.`
                      : `Perfeito, ${name}. Este curso abre no Moodle. A pré-inscrição não se aplica.`}
                </div>
                <div className="ml-auto grid max-w-[90%] gap-2">
                  <label className="flex items-start gap-2 rounded-xl bg-white p-3 text-xs leading-5 shadow-sm"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 accent-[#075E54]" />Aceito que os dados desta conversa sejam usados para tratar a inscrição.</label>
                  <button type="button" disabled={!consent || !chosen} onClick={() => { if (chosen) abrir(chosen); }} className="flex w-full items-center justify-between rounded-xl bg-[#075E54] px-4 py-3 text-sm font-bold text-white disabled:opacity-40">{chosen && ePreinscricao(chosen.enrollment) ? "Fazer pré-inscrição" : chosen && ePrepago(chosen.enrollment) ? "Inscrever-me agora" : "Aceder ao curso"}<Icon name="arrow" className="h-4 w-4" /></button>
                  <button type="button" onClick={() => setSummarySent(true)} className="rounded-xl bg-[#DCF8C6] px-4 py-3 text-left text-sm font-bold">{summarySent ? "Resumo enviado para o seu email" : "Enviar-me este resumo por email"}</button>
                  <button type="button" onClick={() => transition("courses")} className="rounded-xl bg-[#DCF8C6] px-4 py-3 text-left text-sm font-bold">Ver outras recomendações</button>
                  <button type="button" onClick={restart} className="px-4 py-2 text-left text-xs font-bold text-[#075E54] underline">Recomeçar conversa</button>
                </div>
              </>
            )}
            {!typing && step === "handoff" && (
              handoffSent ? <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-white p-4 text-sm leading-6 shadow-sm"><strong className="text-[#075E54]">Pedido registado.</strong><p className="mt-1 text-[#1C3350]/60">Ficou na base de dados e o email automático segue para o endereço indicado.</p>{(!chosen || ePreinscricao(chosen.enrollment)) && <a href="/pre-inscricao" className="mt-3 inline-flex font-bold text-[#075E54] underline">Completar a pré-inscrição</a>}</div> :
                <form onSubmit={enviar} className="ml-auto max-w-[92%] space-y-2 rounded-2xl rounded-tr-sm bg-[#DCF8C6] p-3 shadow-sm">
                  <input name="nome" required defaultValue={name} placeholder="Nome" className="w-full rounded-lg bg-white px-3 py-2.5 text-sm outline-none" />
                  <input name="email" required type="email" placeholder="Email" className="w-full rounded-lg bg-white px-3 py-2.5 text-sm outline-none" />
                  <input name="telf" required type="tel" placeholder="Telefone" className="w-full rounded-lg bg-white px-3 py-2.5 text-sm outline-none" />
                  <label className="flex items-start gap-2 rounded-lg bg-white px-3 py-2 text-xs leading-5"><input name="consentimento" type="checkbox" required className="mt-1 accent-[#075E54]" />Aceito que a ENA use estes dados para me contactar sobre a formação.</label>
                  {handoffErro && <p className="text-xs font-semibold text-[#A60000]">{handoffErro}</p>}
                  <button type="submit" disabled={handoffBusy} className="w-full rounded-lg bg-[#075E54] px-4 py-3 text-sm font-bold text-white disabled:opacity-40">{handoffBusy ? "A registar…" : "Pedir contacto humano"}</button>
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

export function SiteFrame({ children, inicio = false }: { children?: ReactNode; inicio?: boolean }) {
  const oferta = useOfertaState();
  const texto = useSiteTextoState();
  const pagina = usePagina("inicio");
  const moldura = molduraDaPagina(pagina);
  const titulo = texto.ler("tituloSeparador");
  useEffect(() => {
    const prev = document.title;
    document.title = titulo || "ENA";
    return () => { document.title = prev; };
  }, [titulo]);
  return (
    <OfertaCtx.Provider value={oferta}>
      <SiteTextoCtx.Provider value={texto}>
      <InscricaoSite>
        <div className="site-ena min-h-screen" style={moldura?.tema}>
          <a href="#conteudo" className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:left-4 focus-visible:top-4 focus-visible:z-[80] focus-visible:bg-[#FFA900] focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-bold focus-visible:text-[#14263D]">Saltar para o conteúdo</a>
          {inicio ? (
            <div id="conteudo">{pagina ? <PaginaSite dados={pagina} /> : <div className="min-h-screen" aria-busy="true" />}</div>
          ) : (
            <>
              {moldura?.cabecalho ? <CabecalhoSite {...moldura.cabecalho} /> : !pagina && <div className="h-20" aria-hidden="true" />}
              <div id="conteudo">{children}</div>
              {moldura?.rodape && <RodapeSite {...moldura.rodape} />}
            </>
          )}
          <WhatsAppAssistant />
        </div>
      </InscricaoSite>
      </SiteTextoCtx.Provider>
    </OfertaCtx.Provider>
  );
}

export function SiteLanding() {
  return <SiteFrame inicio />;
}
