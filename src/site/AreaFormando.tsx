import { FormEvent, ReactNode, useEffect, useState } from "react";
import {
  ApiError, apiChangeOwnPassword, apiGoogleLoginStatus, apiLogin, apiLogout, apiMe, apiMicrosoftLoginStatus,
  googleLoginStartUrl, microsoftLoginStartUrl, type SessionUser,
} from "../partilhado/api";
import { destinoDoPerfil } from "../partilhado/destinoPerfil";
import { mensagemPalavraPasse } from "../partilhado/passwordPolicy";

type Separador = "courses" | "agenda" | "certificates" | "notifications" | "payments" | "profile";

type CursoArea = {
  id: string;
  title: string;
  format: string;
  progress: number;
  aulas: string;
  ultimo: string;
  modules: string[];
};

const CURSOS: CursoArea[] = [
  {
    id: "gestao-projetos",
    title: "Gestão de Projetos: da ideia ao impacto",
    format: "E-learning",
    progress: 75,
    aulas: "3 de 4 aulas",
    ultimo: "ontem",
    modules: ["Definição de objetivos e âmbito", "Planeamento e gestão de risco", "Ferramentas de acompanhamento", "Avaliação e comunicação de impacto"],
  },
  {
    id: "excel",
    title: "Excel para Gestão e Análise de Dados",
    format: "E-learning",
    progress: 50,
    aulas: "2 de 4 aulas",
    ultimo: "há 5 dias",
    modules: ["Folhas e fórmulas", "Tabelas e filtros", "Gráficos", "Dashboards"],
  },
];

function Icon({ name, className = "h-5 w-5" }: { name: "arrow" | "check" | "close" | "menu"; className?: string }) {
  const paths: Record<string, ReactNode> = {
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="M6 6l12 12M18 6 6 18" />,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  };
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

function descarregar(nome: string, texto: string) {
  const blob = new Blob([texto], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  link.click();
  URL.revokeObjectURL(url);
}

function primeiroNome(nome: string) {
  return nome.trim().split(/\s+/)[0] || nome;
}

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  return ((partes[0]?.[0] ?? "") + (partes.length > 1 ? partes[partes.length - 1]?.[0] ?? "" : "")).toUpperCase() || "ENA";
}

function Cabecalho() {
  const [aberto, setAberto] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-[#1C3350]/10 bg-[#F9F9F9]/95 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-[1240px] items-center justify-between px-5 lg:px-8">
        <a href="/" className="flex items-center gap-3" aria-label="ENA, página inicial">
          <img src="/imagens/ena_logo.svg" alt="ENA" className="h-9 w-auto sm:h-10" />
          <span className="hidden text-left text-[10px] font-bold uppercase leading-tight tracking-[0.12em] text-[#1C3350]/70 sm:block">Escola de<br />Negócios e Administração</span>
        </a>
        <nav className="hidden items-center gap-8 text-sm font-semibold lg:flex" aria-label="Navegação principal">
          <a href="/formacao" className="hover:text-[#A60000]">Formação</a>
          <a href="/#empresas" className="hover:text-[#A60000]">Empresas</a>
        </nav>
        <div className="hidden items-center gap-4 lg:flex">
          <a href="/area-formando" className="text-sm font-semibold underline decoration-[#A60000] decoration-2 underline-offset-4">Área de formando</a>
          <a href="/formacao" className="bg-[#1C3350] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#A60000]">Encontrar curso</a>
        </div>
        <button type="button" onClick={() => setAberto(v => !v)} className="p-2 lg:hidden" aria-label={aberto ? "Fechar menu" : "Abrir menu"}>
          <Icon name={aberto ? "close" : "menu"} />
        </button>
      </div>
      {aberto && (
        <nav className="border-t border-[#1C3350]/10 bg-[#F9F9F9] px-5 py-6 lg:hidden">
          <div className="flex flex-col gap-5 font-semibold">
            <a href="/formacao">Formação</a>
            <a href="/#empresas">Empresas</a>
            <a href="/area-formando" className="border-t border-[#1C3350]/10 pt-5 text-[#A60000]">Área de formando</a>
          </div>
        </nav>
      )}
    </header>
  );
}

function LoginFormando({ onEntrou, trocaInicial = null }: { onEntrou: (user: SessionUser) => void; trocaInicial?: SessionUser | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recuperar, setRecuperar] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [trocar, setTrocar] = useState<SessionUser | null>(trocaInicial);
  useEffect(() => { if (trocaInicial) setTrocar(trocaInicial); }, [trocaInicial]);
  const [nova, setNova] = useState("");
  const [google, setGoogle] = useState(false);
  const [microsoft, setMicrosoft] = useState(false);

  useEffect(() => {
    apiGoogleLoginStatus().then(r => setGoogle(r.configured)).catch(() => setGoogle(false));
    apiMicrosoftLoginStatus().then(r => setMicrosoft(r.configured)).catch(() => setMicrosoft(false));
  }, []);

  async function entrar(event: FormEvent) {
    event.preventDefault();
    setOcupado(true);
    setErro("");
    try {
      if (recuperar) {
        setEnviado(true);
        return;
      }
      const r = await apiLogin(email.trim(), password);
      if (r.user.mustChangePassword) {
        setTrocar(r.user);
        return;
      }
      if (r.user.role !== "formando") {
        window.location.assign(destinoDoPerfil(r.user.role));
        return;
      }
      onEntrou(r.user);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível entrar.");
    } finally {
      setOcupado(false);
    }
  }

  async function gravarPasse(event: FormEvent) {
    event.preventDefault();
    setOcupado(true);
    setErro("");
    try {
      const r = await apiChangeOwnPassword(nova);
      const user = r.user;
      if (user.role !== "formando") {
        window.location.assign(destinoDoPerfil(user.role));
        return;
      }
      onEntrou(user);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : mensagemPalavraPasse(nova));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <main className="grid min-h-[calc(100vh-80px)] lg:grid-cols-[.9fr_1.1fr]">
      <section className="hidden bg-[#1C3350] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <img src="/imagens/ena_logo.svg" alt="ENA" className="w-36 brightness-0 invert" />
        <div className="mx-auto max-w-lg">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#FFA900]">Área reservada</p>
          <h1 className="mt-5 font-serif text-5xl font-bold leading-tight">Toda a sua formação num só lugar.</h1>
          <ul className="mt-8 space-y-4 text-white/70">
            {["Continue os cursos ao seu ritmo", "Consulte sessões e materiais", "Descarregue os seus certificados"].map(item => (
              <li key={item} className="flex items-center gap-3"><Icon name="check" className="h-5 w-5 shrink-0 text-[#FFA900]" />{item}</li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-white/35">ENA — Escola de Negócios e Administração</p>
      </section>
      <section className="flex items-center justify-center bg-[#F9F9F9] px-5 py-16">
        <div className="w-full max-w-md">
          {trocar ? (
            <>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#A60000]">Primeira entrada</p>
              <h1 className="mt-3 font-serif text-4xl font-bold text-[#1C3350]">Defina uma palavra-passe nova.</h1>
              <form onSubmit={gravarPasse} className="mt-8 space-y-5">
                {erro && <p className="text-sm font-semibold text-[#A60000]">{erro}</p>}
                <label className="block text-xs font-bold uppercase tracking-wider text-[#1C3350]/65">
                  Palavra-passe nova
                  <input required type="password" value={nova} onChange={e => setNova(e.target.value)} autoComplete="new-password" className="mt-2 w-full border border-[#1C3350]/20 bg-white px-4 py-4 text-base font-normal normal-case tracking-normal outline-none focus:border-[#A60000]" />
                </label>
                <button disabled={ocupado} className="flex w-full items-center justify-between bg-[#A60000] px-6 py-4 font-bold text-white hover:bg-[#8B0000] disabled:opacity-50">
                  {ocupado ? "A gravar…" : "Guardar e entrar"}<Icon name="arrow" />
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#A60000]">{recuperar ? "Recuperar acesso" : "Bem-vindo de volta"}</p>
              <h1 className="mt-3 font-serif text-4xl font-bold text-[#1C3350]">{recuperar ? "Redefina a sua palavra-passe." : "Entrar na área do formando."}</h1>
              <p className="mt-4 leading-7 text-[#1C3350]/60">{recuperar ? "Indique o email associado à sua conta." : "Aceda aos seus cursos, sessões e certificados."}</p>
              {enviado ? (
                <div className="mt-8 border-l-4 border-[#FFA900] bg-white p-6">
                  <strong>Verifique o seu email</strong>
                  <p className="mt-2 text-sm leading-6 text-[#1C3350]/60">O envio automático da recuperação ainda não está ligado. Peça uma palavra-passe nova à secretaria.</p>
                  <button type="button" onClick={() => { setEnviado(false); setRecuperar(false); }} className="mt-4 text-sm font-bold text-[#A60000] underline">Voltar ao início de sessão</button>
                </div>
              ) : (
                <form onSubmit={entrar} className="mt-8 space-y-5">
                  {erro && <p className="text-sm font-semibold text-[#A60000]">{erro}</p>}
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#1C3350]/65">
                    Email
                    <input required type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" className="mt-2 w-full border border-[#1C3350]/20 bg-white px-4 py-4 text-base font-normal normal-case tracking-normal outline-none focus:border-[#A60000]" />
                  </label>
                  {!recuperar && (
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#1C3350]/65">
                      Palavra-passe
                      <input required type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" className="mt-2 w-full border border-[#1C3350]/20 bg-white px-4 py-4 text-base font-normal normal-case tracking-normal outline-none focus:border-[#A60000]" />
                    </label>
                  )}
                  <button disabled={ocupado} className="flex w-full items-center justify-between bg-[#A60000] px-6 py-4 font-bold text-white hover:bg-[#8B0000] disabled:opacity-50">
                    {ocupado ? "A entrar…" : recuperar ? "Enviar instruções" : "Entrar"}<Icon name="arrow" />
                  </button>
                </form>
              )}
              {!enviado && (
                <button type="button" onClick={() => { setRecuperar(v => !v); setErro(""); }} className="mt-6 text-sm font-bold underline decoration-[#FFA900] decoration-2 underline-offset-4">
                  {recuperar ? "Voltar ao início de sessão" : "Esqueci-me da palavra-passe"}
                </button>
              )}
              {!recuperar && !enviado && (
                <div className="mt-8 space-y-3 border-t border-[#1C3350]/10 pt-6">
                  <a href={google ? googleLoginStartUrl() : undefined} aria-disabled={!google} onClick={e => { if (!google) { e.preventDefault(); setErro("O Google ainda não está configurado. Entre com email."); } }} className={`flex w-full items-center justify-center border px-4 py-3 text-sm font-bold ${google ? "border-[#1C3350] text-[#1C3350] hover:bg-white" : "cursor-not-allowed border-[#1C3350]/20 text-[#1C3350]/40"}`}>Continuar com Google</a>
                  <a href={microsoft ? microsoftLoginStartUrl() : undefined} aria-disabled={!microsoft} onClick={e => { if (!microsoft) { e.preventDefault(); setErro("A Microsoft ainda não está configurada. Entre com email."); } }} className={`flex w-full items-center justify-center border px-4 py-3 text-sm font-bold ${microsoft ? "border-[#1C3350] text-[#1C3350] hover:bg-white" : "cursor-not-allowed border-[#1C3350]/20 text-[#1C3350]/40"}`}>Continuar com Microsoft</a>
                  <p className="text-sm text-[#1C3350]/55">Ainda não tem acesso? Os dados são enviados após confirmação da inscrição ou pagamento online.</p>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}

function Sala({ curso, onVoltar }: { curso: CursoArea; onVoltar: () => void }) {
  const [activo, setActivo] = useState(0);
  const [feitos, setFeitos] = useState<number[]>(() => curso.modules.map((_, i) => i).filter((_, i) => i < Math.round(curso.modules.length * curso.progress / 100)));
  const progresso = Math.round((feitos.length / curso.modules.length) * 100);
  return (
    <main className="min-h-[75vh] bg-[#F9F9F9]">
      <section className="bg-[#1C3350] px-5 py-10 text-white lg:px-8">
        <div className="mx-auto flex max-w-[1240px] flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <button type="button" onClick={onVoltar} className="text-sm font-bold text-white/70 hover:text-white">Voltar aos cursos</button>
            <h1 className="mt-3 font-serif text-4xl font-bold">{curso.title}</h1>
          </div>
          <p className="text-sm font-bold text-[#FFA900]">{progresso}% concluído</p>
        </div>
      </section>
      <section className="mx-auto grid max-w-[1240px] gap-6 px-5 py-8 lg:grid-cols-[280px_1fr] lg:px-8">
        <ol className="border border-[#1C3350]/10 bg-white">
          {curso.modules.map((modulo, index) => (
            <li key={modulo}>
              <button type="button" onClick={() => setActivo(index)} className={`flex w-full items-start gap-3 border-b border-[#1C3350]/10 px-4 py-4 text-left text-sm ${activo === index ? "bg-[#FFF1D1]" : "hover:bg-[#F9F9F9]"}`}>
                <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center text-xs font-bold ${feitos.includes(index) ? "bg-[#A60000] text-white" : "bg-[#EDEEF1] text-[#1C3350]"}`}>{index + 1}</span>
                <span><span className="block text-[10px] font-bold uppercase tracking-wider text-[#1C3350]/45">Módulo {index + 1}</span>{modulo}</span>
              </button>
            </li>
          ))}
        </ol>
        <article className="border border-[#1C3350]/10 bg-white p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-wider text-[#A60000]">Módulo {activo + 1}</p>
          <h2 className="mt-2 font-serif text-3xl font-bold text-[#1C3350]">{curso.modules[activo]}</h2>
          <p className="mt-4 leading-7 text-[#1C3350]/60">O conteúdo deste módulo abre aqui. A ligação ao Moodle ainda não está feita, por isso a aula fica neste ecrã.</p>
          <button type="button" onClick={() => setFeitos(lista => lista.includes(activo) ? lista.filter(n => n !== activo) : [...lista, activo])} className="mt-8 bg-[#A60000] px-6 py-3 font-bold text-white hover:bg-[#8B0000]">
            {feitos.includes(activo) ? "Marcar como por fazer" : "Marcar como concluído"}
          </button>
        </article>
      </section>
    </main>
  );
}

function Painel({ user, onSair, avisar }: { user: SessionUser; onSair: () => void; avisar: (texto: string) => void }) {
  const [tab, setTab] = useState<Separador>("courses");
  const [sala, setSala] = useState<CursoArea | null>(null);
  const [perfilGuardado, setPerfilGuardado] = useState(false);
  const nome = user.name || "Formando";

  if (sala) return <Sala curso={sala} onVoltar={() => setSala(null)} />;

  return (
    <main className="min-h-[75vh] bg-[#F9F9F9]">
      <section className="bg-[#1C3350] px-5 py-10 text-white lg:px-8">
        <div className="mx-auto flex max-w-[1240px] flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm text-white/55">Olá, {primeiroNome(nome)}</p>
            <h1 className="mt-1 font-serif text-4xl font-bold">Continue a aprender.</h1>
          </div>
          <button type="button" onClick={onSair} className="w-fit border border-white/30 px-4 py-2 text-sm font-bold hover:bg-white hover:text-[#1C3350]">Terminar sessão</button>
        </div>
      </section>
      <section className="px-5 py-8 lg:px-8 lg:py-12">
        <div className="mx-auto max-w-[1240px]">
          <div className="grid gap-4 sm:grid-cols-3">
            {[["2", "Cursos ativos"], ["68%", "Progresso global"], ["1", "Certificado disponível"]].map(([value, label]) => (
              <div key={label} className="border border-[#1C3350]/10 bg-white p-5">
                <strong className="font-serif text-3xl text-[#A60000]">{value}</strong>
                <span className="ml-3 text-sm text-[#1C3350]/60">{label}</span>
              </div>
            ))}
          </div>
          <nav className="mt-8 flex gap-2 overflow-x-auto border-b border-[#1C3350]/15" aria-label="Secções da área">
            {([
              ["courses", "Os meus cursos"],
              ["agenda", "Agenda"],
              ["certificates", "Certificados"],
              ["notifications", "Notificações"],
              ["payments", "Pagamentos"],
              ["profile", "O meu perfil"],
            ] as const).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setTab(value)} className={`whitespace-nowrap border-b-2 px-5 py-4 text-sm font-bold ${tab === value ? "border-[#A60000] text-[#A60000]" : "border-transparent text-[#1C3350]/55"}`}>{label}</button>
            ))}
          </nav>
          {tab === "courses" && (
            <div className="mt-7 grid gap-5 lg:grid-cols-2">
              {CURSOS.map(curso => (
                <article key={curso.id} className="border border-[#1C3350]/10 bg-white p-6">
                  <div className="flex items-center justify-between">
                    <span className="bg-[#FFF1D1] px-3 py-1.5 text-xs font-bold uppercase tracking-wider">{curso.format}</span>
                    <span className="text-sm font-bold">{curso.progress}%</span>
                  </div>
                  <h2 className="mt-5 font-serif text-2xl font-bold">{curso.title}</h2>
                  <p className="mt-2 text-sm text-[#1C3350]/55">Último acesso: {curso.ultimo}</p>
                  <div className="mt-6 h-2 bg-[#EDEEF1]"><div className="h-full bg-[#A60000]" style={{ width: `${curso.progress}%` }} /></div>
                  <div className="mt-5 flex items-center justify-between">
                    <span className="text-xs font-bold text-[#1C3350]/50">{curso.aulas}</span>
                    <button type="button" onClick={() => setSala(curso)} className="flex items-center gap-2 font-bold text-[#A60000]">Continuar no LMS <Icon name="arrow" /></button>
                  </div>
                </article>
              ))}
            </div>
          )}
          {tab === "agenda" && (
            <div className="mt-7 border border-[#1C3350]/10 bg-white">
              <div className="grid gap-4 border-b border-[#1C3350]/10 p-6 sm:grid-cols-[100px_1fr_auto] sm:items-center">
                <div><strong className="block text-3xl text-[#A60000]">24</strong><span className="text-xs font-bold uppercase">Outubro</span></div>
                <div><strong>Sessão de acompanhamento online</strong><p className="mt-1 text-sm text-[#1C3350]/55">Gestão de Projetos · 18:30—19:30</p></div>
                <button type="button" onClick={() => { descarregar("sessao-ena.ics", "BEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY:Sessão de acompanhamento ENA\nDTSTART:20251024T183000\nDTEND:20251024T193000\nEND:VEVENT\nEND:VCALENDAR"); avisar("Ficheiro de calendário descarregado."); }} className="border border-[#1C3350] px-4 py-2 text-sm font-bold">Adicionar ao calendário</button>
              </div>
              <p className="p-6 text-sm text-[#1C3350]/55">Não existem mais sessões agendadas.</p>
            </div>
          )}
          {tab === "certificates" && (
            <div className="mt-7 grid gap-4 md:grid-cols-2">
              <div className="flex flex-col items-start justify-between gap-4 border border-[#1C3350]/10 bg-white p-6 sm:flex-row sm:items-center">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#A60000]">Concluído em julho 2025</span>
                  <h2 className="mt-2 font-serif text-xl font-bold">Comunicação em Equipas</h2>
                  <p className="mt-1 text-sm text-[#1C3350]/50">Certificado DGERT · 24 horas</p>
                </div>
                <button type="button" onClick={() => { descarregar("certificado-comunicacao.txt", `Certificado ENA — Comunicação em Equipas — ${nome} — 24 horas`); avisar("Certificado descarregado."); }} className="bg-[#1C3350] px-4 py-3 text-sm font-bold text-white">Descarregar</button>
              </div>
              <div className="border border-dashed border-[#1C3350]/20 p-6 text-sm text-[#1C3350]/50">Os novos certificados ficam disponíveis após a conclusão e avaliação dos cursos.</div>
            </div>
          )}
          {tab === "notifications" && (
            <div className="mt-7 grid gap-5 lg:grid-cols-[1fr_300px]">
              <div className="bg-white">
                <div className="flex justify-between gap-4 border-b border-[#1C3350]/10 p-5">
                  <h2 className="font-serif text-2xl font-bold">Notificações</h2>
                  <button type="button" onClick={() => avisar("Todas as notificações foram marcadas como lidas.")} className="text-xs font-bold text-[#A60000]">Marcar tudo como lido</button>
                </div>
                {([
                  ["Novo módulo disponível", "O módulo “Planeamento e gestão de risco” já está disponível.", "Agora", true],
                  ["Sessão amanhã", "A sessão de acompanhamento começa amanhã às 18:30.", "Há 2 h", true],
                  ["Certificado emitido", "O certificado de Comunicação em Equipas está pronto.", "Ontem", false],
                  ["Continue o seu curso", "Faltam apenas duas aulas para concluir Gestão de Projetos.", "Há 3 dias", false],
                ] as const).map(([titulo, texto, data, porLer]) => (
                  <article key={titulo} className={`border-b border-[#1C3350]/10 p-5 ${porLer ? "border-l-4 border-l-[#A60000] bg-[#F9F9F9]" : ""}`}>
                    <div className="flex justify-between gap-4"><strong>{titulo}</strong><span className="text-xs text-[#1C3350]/40">{data}</span></div>
                    <p className="mt-2 text-sm text-[#1C3350]/55">{texto}</p>
                  </article>
                ))}
              </div>
              <aside className="h-fit bg-white p-5">
                <h3 className="font-bold">Preferências</h3>
                <div className="mt-4 space-y-4">
                  {["Email", "SMS", "WhatsApp", "Na plataforma"].map((canal, index) => (
                    <label key={canal} className="flex justify-between text-sm"><span>{canal}</span><input type="checkbox" defaultChecked={index !== 1} className="accent-[#A60000]" /></label>
                  ))}
                </div>
                <button type="button" onClick={() => avisar("Preferências de notificação guardadas neste ecrã.")} className="mt-6 w-full bg-[#1C3350] px-4 py-3 text-sm font-bold text-white">Guardar preferências</button>
              </aside>
            </div>
          )}
          {tab === "payments" && (
            <div className="mt-7 grid gap-5 lg:grid-cols-[1fr_300px]">
              <div className="bg-white p-6">
                <h2 className="font-serif text-2xl font-bold">Faturas e pagamentos</h2>
                <div className="mt-5 space-y-3">
                  {([
                    ["FT ENA/2025/0842", "Gestão de Projetos", "12 set 2025", "79 €"],
                    ["FT ENA/2025/0518", "Comunicação em Equipas", "04 jul 2025", "240 €"],
                  ] as const).map(([documento, cursoNome, data, valor]) => (
                    <div key={documento} className="grid gap-3 border-b border-[#1C3350]/10 py-4 text-sm sm:grid-cols-[150px_1fr_100px_70px_auto] sm:items-center">
                      <strong>{documento}</strong>
                      <span>{cursoNome}</span>
                      <span className="text-[#1C3350]/45">{data}</span>
                      <strong>{valor}</strong>
                      <button type="button" onClick={() => { descarregar(`${documento.replace(/\//g, "-")}.txt`, `Fatura ${documento}\n${cursoNome}\n${data}\nTotal: ${valor}`); avisar("Fatura descarregada."); }} className="text-left font-bold text-[#A60000]">Descarregar</button>
                    </div>
                  ))}
                </div>
              </div>
              <aside className="h-fit bg-white p-5">
                <h3 className="font-bold">Dados fiscais</h3>
                <p className="mt-3 text-sm leading-6 text-[#1C3350]/55">{nome}<br />NIF por indicar<br />Portugal</p>
                <button type="button" onClick={() => avisar("A edição dos dados fiscais ainda não grava na ficha.")} className="mt-5 border border-[#1C3350] px-4 py-2 text-sm font-bold">Editar dados</button>
              </aside>
            </div>
          )}
          {tab === "profile" && (
            <div className="mt-7 grid gap-6 lg:grid-cols-[280px_1fr]">
              <aside className="h-fit border border-[#1C3350]/10 bg-white p-6 text-center">
                <span className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-[#1C3350] text-2xl font-bold text-white">{iniciais(nome)}</span>
                <h2 className="mt-4 font-serif text-2xl font-bold">{nome}</h2>
                <p className="mt-1 text-sm text-[#1C3350]/50">{user.email}</p>
                <div className="mt-6 border-t border-[#1C3350]/10 pt-5 text-left text-sm">
                  <p className="flex justify-between"><span className="text-[#1C3350]/50">Cursos</span><strong>2</strong></p>
                  <p className="mt-3 flex justify-between"><span className="text-[#1C3350]/50">Concluídos</span><strong>1</strong></p>
                </div>
              </aside>
              <div className="border border-[#1C3350]/10 bg-white p-6 sm:p-8">
                <div className="flex items-start justify-between gap-4 border-b border-[#1C3350]/10 pb-5">
                  <div>
                    <h2 className="font-serif text-2xl font-bold">Dados pessoais</h2>
                    <p className="mt-1 text-sm text-[#1C3350]/50">Mantenha os seus dados de contacto atualizados.</p>
                  </div>
                  {perfilGuardado && <span className="flex items-center gap-2 bg-[#EDEEF1] px-3 py-2 text-xs font-bold text-[#A60000]"><Icon name="check" className="h-4 w-4" />Guardado</span>}
                </div>
                <form onSubmit={event => { event.preventDefault(); setPerfilGuardado(true); window.setTimeout(() => setPerfilGuardado(false), 2500); avisar("Alterações guardadas neste ecrã. A ficha do GesForma ainda não as recebe."); }} className="mt-6 space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#1C3350]/60">Nome<input defaultValue={primeiroNome(nome)} className="mt-2 w-full border border-[#1C3350]/20 px-4 py-3 text-base font-normal normal-case tracking-normal outline-none focus:border-[#A60000]" /></label>
                    <label className="text-xs font-bold uppercase tracking-wider text-[#1C3350]/60">Email<input type="email" defaultValue={user.email} className="mt-2 w-full border border-[#1C3350]/20 px-4 py-3 text-base font-normal normal-case tracking-normal outline-none focus:border-[#A60000]" /></label>
                  </div>
                  <label className="flex items-start gap-3 border-t border-[#1C3350]/10 pt-5 text-sm">
                    <input type="checkbox" defaultChecked className="mt-1 accent-[#A60000]" />
                    <span><strong className="block">Comunicações da ENA</strong><span className="mt-1 block text-[#1C3350]/50">Quero receber novidades e novas oportunidades de formação.</span></span>
                  </label>
                  <div className="flex justify-end"><button type="submit" className="bg-[#A60000] px-6 py-3 font-bold text-white hover:bg-[#8B0000]">Guardar alterações</button></div>
                </form>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export function AreaFormando() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [troca, setTroca] = useState<SessionUser | null>(null);
  const [pronto, setPronto] = useState(false);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    let viva = true;
    apiMe()
      .then(r => {
        if (!viva) return;
        if (r.user.role !== "formando") {
          window.location.replace(destinoDoPerfil(r.user.role));
          return;
        }
        if (r.user.mustChangePassword) {
          setTroca(r.user);
          return;
        }
        setUser(r.user);
      })
      .catch(() => { if (viva) setUser(null); })
      .finally(() => { if (viva) setPronto(true); });
    return () => { viva = false; };
  }, []);

  function avisar(texto: string) {
    setAviso(texto);
    window.setTimeout(() => setAviso(""), 2800);
  }

  async function sair() {
    await apiLogout().catch(() => undefined);
    setUser(null);
  }

  return (
    <div className="site-ena min-h-screen bg-[#F9F9F9] text-[#1C3350]">
      <Cabecalho />
      {!pronto ? (
        <main className="grid min-h-[50vh] place-items-center text-sm font-semibold text-[#1C3350]/50">A verificar a sessão…</main>
      ) : user ? (
        <Painel user={user} onSair={() => void sair()} avisar={avisar} />
      ) : (
        <LoginFormando onEntrou={setUser} trocaInicial={troca} />
      )}
      {aviso && <p className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 bg-[#1C3350] px-4 py-3 text-sm font-semibold text-white shadow-lg" role="status">{aviso}</p>}
    </div>
  );
}
