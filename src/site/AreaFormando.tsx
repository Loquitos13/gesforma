import { FormEvent, ReactNode, useEffect, useState } from "react";
import {
  ApiError, apiAreaFormando, apiAreaFormandoDocumentoUpload, apiChangeOwnPassword, apiGoogleLoginStatus, apiLogin, apiLogout, apiMe, apiMicrosoftLoginStatus,
  apiPatchAreaFormando, apiRecuperarAcesso, apiReporPalavraPasse, googleLoginStartUrl, microsoftLoginStartUrl,
  type AreaFormandoDados, type FormandoFinDocsBloco, type SessionUser,
} from "../partilhado/api";
import { destinoPosLogin } from "../partilhado/destinoPerfil";
import { mensagemPalavraPasse } from "../partilhado/passwordPolicy";

type Separador = "courses" | "agenda" | "certificates" | "documents" | "notifications" | "payments" | "profile";

function DocumentosFinArea({ blocos, onAtualizar, avisar }: {
  blocos: FormandoFinDocsBloco[];
  onAtualizar: () => void;
  avisar: (texto: string) => void;
}) {
  const [formandoId, setFormandoId] = useState(blocos[0]?.formandoId ?? 0);
  const [tipo, setTipo] = useState("");
  const [ficheiro, setFicheiro] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const bloco = blocos.find(b => b.formandoId === formandoId) ?? blocos[0];
  if (!bloco) {
    return <p className="mt-7 text-sm text-[#1C3350]/55">Não há formação financiada associada a esta conta.</p>;
  }
  const permitidos = bloco.documentos.filter(d => d.estado === "recusado" || (d.required && d.estado !== "validado"));
  async function enviar(event: FormEvent) {
    event.preventDefault();
    if (!ficheiro || !tipo) return;
    setBusy(true);
    try {
      await apiAreaFormandoDocumentoUpload(bloco.formandoId, tipo, ficheiro);
      avisar("Documento enviado. A secretaria irá validar.");
      setFicheiro(null);
      onAtualizar();
    } catch (err) {
      avisar(err instanceof ApiError ? err.message : "Não foi possível enviar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-7 space-y-6">
      {blocos.length > 1 && (
        <label className="block text-xs font-bold uppercase tracking-wider text-[#1C3350]/60">
          Formação
          <select value={formandoId} onChange={e => setFormandoId(Number(e.target.value))} className="mt-2 w-full max-w-md border border-[#1C3350]/20 px-4 py-3 text-base font-normal normal-case">
            {blocos.map(b => <option key={b.formandoId} value={b.formandoId}>{b.curso}</option>)}
          </select>
        </label>
      )}
      <ul className="space-y-2 border border-[#1C3350]/10 bg-white p-5">
        {bloco.documentos.map(doc => (
          <li key={doc.id} className={`rounded-lg border px-4 py-3 text-sm ${doc.estado === "validado" ? "border-emerald-200 bg-emerald-50" : doc.estado === "recusado" ? "border-red-200 bg-red-50" : "border-[#1C3350]/10"}`}>
            <div className="flex justify-between gap-3">
              <strong>{doc.label}</strong>
              <span className="text-xs font-bold uppercase text-[#1C3350]/45">
                {doc.estado === "validado" ? "Validado" : doc.estado === "recusado" ? "Recusado" : doc.estado === "pendente" ? "Por validar" : "Em falta"}
              </span>
            </div>
            {doc.observacao && <p className="mt-1 text-xs text-red-700">{doc.observacao}</p>}
            {doc.validadoPor && <p className="mt-1 text-xs text-[#1C3350]/45">{doc.validadoPor}{doc.validadoEm ? ` · ${doc.validadoEm}` : ""}</p>}
          </li>
        ))}
      </ul>
      {permitidos.length > 0 && (
        <form onSubmit={e => { void enviar(e); }} className="border border-[#1C3350]/10 bg-white p-6 space-y-4">
          <h2 className="font-serif text-xl font-bold">Enviar documento</h2>
          <label className="block text-xs font-bold uppercase tracking-wider text-[#1C3350]/60">
            Tipo
            <select required value={tipo} onChange={e => setTipo(e.target.value)} className="mt-2 w-full border border-[#1C3350]/20 px-4 py-3 text-base font-normal normal-case">
              <option value="">Escolher…</option>
              {permitidos.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </label>
          <label className="block text-xs font-bold uppercase tracking-wider text-[#1C3350]/60">
            Ficheiro
            <input required type="file" onChange={e => setFicheiro(e.target.files?.[0] ?? null)} className="mt-2 w-full text-sm font-normal normal-case" />
          </label>
          <button disabled={busy} type="submit" className="bg-[#A60000] px-6 py-3 font-bold text-white disabled:opacity-50">{busy ? "A enviar…" : "Submeter"}</button>
        </form>
      )}
      {bloco.completo && <p className="text-sm font-semibold text-emerald-700">Todos os documentos obrigatórios estão validados.</p>}
    </div>
  );
}

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
          <a href="/noticias" className="hover:text-[#A60000]">Notícias</a>
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
            <a href="/noticias">Notícias</a>
            <a href="/#empresas">Empresas</a>
            <a href="/area-formando" className="border-t border-[#1C3350]/10 pt-5 text-[#A60000]">Área de formando</a>
          </div>
        </nav>
      )}
    </header>
  );
}

function irPosLogin(role: string) {
  const params = new URLSearchParams(window.location.search);
  window.location.assign(destinoPosLogin(role, params.get("destino")));
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
    const q = new URLSearchParams(window.location.search).get("login");
    if (!q) return;
    const msgs: Record<string, string> = {
      "sem-cliente": "O cliente Google ainda não está configurado. Entre com email ou peça à administração para gravar o OAuth.",
      "sem-cliente-microsoft": "A aplicação Microsoft ainda não está configurada. Entre com email ou registe-a nas Configurações.",
      "sem-conta": "Esta conta não tem acesso. O email tem de existir como utilizador ou formando com acesso gerado.",
      inactivo: "Esta conta está desactivada.",
      "oauth-falhou": "Não foi possível concluir a autenticação. Tente de novo.",
      "pedido-invalido": "O pedido expirou. Tente de novo.",
    };
    setErro(msgs[q] ?? "Não foi possível entrar com a conta externa.");
    const limpo = new URLSearchParams(window.location.search);
    limpo.delete("login");
    const resto = limpo.toString();
    window.history.replaceState({}, "", resto ? `/area-formando?${resto}` : "/area-formando");
  }, []);

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
        await apiRecuperarAcesso(email.trim());
        setEnviado(true);
        return;
      }
      const r = await apiLogin(email.trim(), password);
      if (r.user.mustChangePassword) {
        setTrocar(r.user);
        return;
      }
      if (r.user.role !== "formando") {
        irPosLogin(r.user.role);
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
        irPosLogin(user.role);
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
              <h1 className="mt-3 font-serif text-4xl font-bold text-[#1C3350]">{recuperar ? "Redefina a sua palavra-passe." : "Entrar na ENA."}</h1>
              <p className="mt-4 leading-7 text-[#1C3350]/60">{recuperar ? "Indique o email associado à sua conta." : "Formandos acedem à área reservada. Colaboradores da escola entram no GesForma consoante o perfil."}</p>
              {!recuperar && !enviado && (
                <p className="mt-2 text-xs text-[#1C3350]/45">Ligação encriptada. Após várias tentativas falhadas, o acesso pausa alguns minutos para proteger a sua conta.</p>
              )}
              {enviado ? (
                <div className="mt-8 border-l-4 border-[#FFA900] bg-white p-6">
                  <strong>Verifique o seu email</strong>
                  <p className="mt-2 text-sm leading-6 text-[#1C3350]/60">Se existir uma conta de formando com esse email, as instruções seguem para lá. Sem SMTP configurado, a mensagem fica no registo da API.</p>
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
                  <p className="text-sm text-[#1C3350]/55">Formandos: o acesso é criado na ficha no GesForma. Equipa: use o email registado na escola.</p>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}

function Sala({ curso, sessoes, onVoltar }: { curso: AreaFormandoDados["cursos"][number]; sessoes: AreaFormandoDados["agenda"]; onVoltar: () => void }) {
  const modulos = curso.modulos.length ? curso.modulos : ["O cronograma desta turma ainda não tem módulos."];
  const [activo, setActivo] = useState(0);
  return (
    <main className="min-h-[75vh] bg-[#F9F9F9]">
      <section className="bg-[#1C3350] px-5 py-10 text-white lg:px-8">
        <div className="mx-auto flex max-w-[1240px] flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <button type="button" onClick={onVoltar} className="text-sm font-bold text-white/70 hover:text-white">Voltar aos cursos</button>
            <h1 className="mt-3 font-serif text-4xl font-bold">{curso.titulo}</h1>
            {curso.turma && <p className="mt-2 text-sm text-white/60">{curso.turma}</p>}
          </div>
          <p className="text-sm font-bold text-[#FFA900]">{curso.progresso}% das sessões já decorreram</p>
        </div>
      </section>
      <section className="mx-auto grid max-w-[1240px] gap-6 px-5 py-8 lg:grid-cols-[280px_1fr] lg:px-8">
        <ol className="border border-[#1C3350]/10 bg-white">
          {modulos.map((modulo, index) => (
            <li key={modulo}>
              <button type="button" onClick={() => setActivo(index)} className={`flex w-full items-start gap-3 border-b border-[#1C3350]/10 px-4 py-4 text-left text-sm ${activo === index ? "bg-[#FFF1D1]" : "hover:bg-[#F9F9F9]"}`}>
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center bg-[#EDEEF1] text-xs font-bold text-[#1C3350]">{index + 1}</span>
                <span><span className="block text-[10px] font-bold uppercase tracking-wider text-[#1C3350]/45">Módulo {index + 1}</span>{modulo}</span>
              </button>
            </li>
          ))}
        </ol>
        <article className="border border-[#1C3350]/10 bg-white p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-wider text-[#A60000]">Módulo {activo + 1}</p>
          <h2 className="mt-2 font-serif text-3xl font-bold text-[#1C3350]">{modulos[activo]}</h2>
          <p className="mt-4 leading-7 text-[#1C3350]/60">O Moodle ainda não está ligado. As sessões são as do cronograma da turma no GesForma.</p>
          <ul className="mt-6 space-y-3">
            {sessoes.length === 0 && <li className="text-sm text-[#1C3350]/50">Esta turma ainda não tem sessões datadas.</li>}
            {sessoes.map(sessao => (
              <li key={sessao.id} className="flex justify-between gap-4 border-b border-[#1C3350]/10 py-3 text-sm">
                <span><strong>{sessao.dia} {sessao.mes}</strong><span className="mt-1 block text-[#1C3350]/55">{sessao.titulo}</span></span>
                <span className="text-[#1C3350]/55">{sessao.horas}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  );
}


function Painel({ dados, onDados, onSair, avisar }: {
  dados: AreaFormandoDados;
  onDados: (dados: AreaFormandoDados) => void;
  onSair: () => void;
  avisar: (texto: string) => void;
}) {
  const [tab, setTab] = useState<Separador>("courses");
  const [sala, setSala] = useState<string | null>(null);
  const [perfilGuardado, setPerfilGuardado] = useState(false);
  const nome = `${dados.pessoa.nome} ${dados.pessoa.apelido}`.trim() || "Formando";
  const cursoSala = dados.cursos.find(curso => curso.id === sala);
  if (cursoSala) {
    return <Sala curso={cursoSala} sessoes={dados.agenda.filter(s => s.cursoId === cursoSala.id)} onVoltar={() => setSala(null)} />;
  }

  async function gravarPerfil(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const seguinte = await apiPatchAreaFormando({
      nome: String(form.get("nome") ?? "").trim(),
      apelido: String(form.get("apelido") ?? "").trim(),
      telf: String(form.get("telf") ?? "").trim(),
      novidades: form.get("novidades") === "on",
    });
    onDados(seguinte);
    setPerfilGuardado(true);
    window.setTimeout(() => setPerfilGuardado(false), 2500);
    avisar("A ficha no GesForma ficou com estes dados.");
  }

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
            {[[String(dados.resumo.cursos), "Cursos no registo"], [`${dados.resumo.progresso}%`, "Sessões já decorridas"], [String(dados.resumo.certificados), dados.resumo.certificados === 1 ? "Certificado disponível" : "Certificados disponíveis"]].map(([value, label]) => (
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
              ...(dados.documentosFin?.length ? [["documents", "Documentos"] as const] : []),
              ["notifications", "Notificações"],
              ["payments", "Pagamentos"],
              ["profile", "O meu perfil"],
            ] as const).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setTab(value)} className={`whitespace-nowrap border-b-2 px-5 py-4 text-sm font-bold ${tab === value ? "border-[#A60000] text-[#A60000]" : "border-transparent text-[#1C3350]/55"}`}>{label}</button>
            ))}
          </nav>
          {tab === "courses" && (
            <div className="mt-7 grid gap-5 lg:grid-cols-2">
              {dados.cursos.length === 0 && <p className="text-sm leading-7 text-[#1C3350]/60">A secretaria ainda não associou formações a esta conta. O acesso cria-se na ficha do formando, no GesForma.</p>}
              {dados.cursos.map(curso => (
                <article key={curso.id} className="border border-[#1C3350]/10 bg-white p-6">
                  <div className="flex items-center justify-between">
                    <span className="bg-[#FFF1D1] px-3 py-1.5 text-xs font-bold uppercase tracking-wider">{curso.regime === "fin" ? "Financiada" : "Gold"}</span>
                    <span className="text-sm font-bold">{curso.progresso}%</span>
                  </div>
                  <h2 className="mt-5 font-serif text-2xl font-bold">{curso.titulo}</h2>
                  <p className="mt-2 text-sm text-[#1C3350]/55">{curso.turma || curso.estado}{curso.ultimo ? ` · última sessão ${curso.ultimo}` : ""}</p>
                  <div className="mt-6 h-2 bg-[#EDEEF1]"><div className="h-full bg-[#A60000]" style={{ width: `${curso.progresso}%` }} /></div>
                  <div className="mt-5 flex items-center justify-between">
                    <span className="text-xs font-bold text-[#1C3350]/50">{curso.feitas} de {curso.sessoes} sessões</span>
                    <button type="button" onClick={() => setSala(curso.id)} className="flex items-center gap-2 font-bold text-[#A60000]">Ver sessões <Icon name="arrow" /></button>
                  </div>
                </article>
              ))}
            </div>
          )}
          {tab === "agenda" && (
            <div className="mt-7 border border-[#1C3350]/10 bg-white">
              {dados.agenda.length === 0 && <p className="p-6 text-sm text-[#1C3350]/55">Não há sessões no cronograma das suas turmas.</p>}
              {dados.agenda.map(sessao => (
                <div key={sessao.id} className="grid gap-4 border-b border-[#1C3350]/10 p-6 sm:grid-cols-[100px_1fr_auto] sm:items-center">
                  <div><strong className="block text-3xl text-[#A60000]">{sessao.dia}</strong><span className="text-xs font-bold uppercase">{sessao.mes}</span></div>
                  <div><strong>{sessao.titulo}</strong><p className="mt-1 text-sm text-[#1C3350]/55">{sessao.curso}{sessao.horas ? ` · ${sessao.horas}` : ""}</p></div>
                  <button type="button" onClick={() => { descarregar(`sessao-${sessao.data}.ics`, `BEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY:${sessao.titulo}\nDTSTART:${sessao.data.replace(/-/g, "")}T${(sessao.horas.slice(0, 5) || "09:00").replace("h", "").replace(":", "")}00\nEND:VEVENT\nEND:VCALENDAR`); avisar("Ficheiro de calendário descarregado."); }} className="border border-[#1C3350] px-4 py-2 text-sm font-bold">Adicionar ao calendário</button>
                </div>
              ))}
            </div>
          )}
          {tab === "documents" && dados.documentosFin?.length > 0 && (
            <DocumentosFinArea
              blocos={dados.documentosFin}
              avisar={avisar}
              onAtualizar={() => { void apiAreaFormando().then(onDados); }}
            />
          )}
          {tab === "certificates" && (
            <div className="mt-7 grid gap-4 md:grid-cols-2">
              {dados.certificados.length === 0 && <p className="text-sm text-[#1C3350]/55">Ainda não há certificados emitidos nesta ficha.</p>}
              {dados.certificados.map(cert => (
                <div key={cert.id} className="flex flex-col items-start justify-between gap-4 border border-[#1C3350]/10 bg-white p-6 sm:flex-row sm:items-center">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-[#A60000]">{cert.data || "Emitido"}</span>
                    <h2 className="mt-2 font-serif text-xl font-bold">{cert.curso}</h2>
                    <p className="mt-1 text-sm text-[#1C3350]/50">{cert.nota ? `Nota ${cert.nota}` : "Certificado da turma"}</p>
                  </div>
                  {cert.url ? <a href={cert.url} className="bg-[#1C3350] px-4 py-3 text-sm font-bold text-white" download={cert.nome || undefined}>Descarregar</a> : <span className="text-sm text-[#1C3350]/45">A secretaria ainda não anexou o ficheiro.</span>}
                </div>
              ))}
            </div>
          )}
          {tab === "notifications" && (
            <div className="mt-7 grid gap-5 lg:grid-cols-[1fr_300px]">
              <div className="bg-white">
                <div className="flex justify-between gap-4 border-b border-[#1C3350]/10 p-5">
                  <h2 className="font-serif text-2xl font-bold">Notificações</h2>
                  <button type="button" onClick={() => { void apiPatchAreaFormando({ lidas: dados.notificacoes.map(n => n.id) }).then(onDados); avisar("Todas as notificações foram marcadas como lidas."); }} className="text-xs font-bold text-[#A60000]">Marcar tudo como lido</button>
                </div>
                {dados.notificacoes.length === 0 && <p className="p-5 text-sm text-[#1C3350]/55">Não há avisos a partir do seu registo.</p>}
                {dados.notificacoes.map(item => (
                  <article key={item.id} className={`border-b border-[#1C3350]/10 p-5 ${item.porLer ? "border-l-4 border-l-[#A60000] bg-[#F9F9F9]" : ""}`}>
                    <div className="flex justify-between gap-4"><strong>{item.titulo}</strong><span className="text-xs text-[#1C3350]/40">{item.quando}</span></div>
                    <p className="mt-2 text-sm text-[#1C3350]/55">{item.texto}</p>
                  </article>
                ))}
              </div>
              <aside className="h-fit bg-white p-5">
                <h3 className="font-bold">Preferências</h3>
                <form onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); void apiPatchAreaFormando({ canais: { email: form.get("email") === "on", sms: form.get("sms") === "on", whatsapp: form.get("whatsapp") === "on", plataforma: form.get("plataforma") === "on" } }).then(seguinte => { onDados(seguinte); avisar("Preferências gravadas na conta."); }); }} className="mt-4 space-y-4">
                  {(["email", "sms", "whatsapp", "plataforma"] as const).map(canal => (
                    <label key={canal} className="flex justify-between text-sm capitalize"><span>{canal === "plataforma" ? "Na plataforma" : canal === "whatsapp" ? "WhatsApp" : canal === "sms" ? "SMS" : "Email"}</span><input name={canal} type="checkbox" defaultChecked={dados.pessoa.canais[canal]} className="accent-[#A60000]" /></label>
                  ))}
                  <button type="submit" className="mt-6 w-full bg-[#1C3350] px-4 py-3 text-sm font-bold text-white">Guardar preferências</button>
                </form>
              </aside>
            </div>
          )}
          {tab === "payments" && (
            <div className="mt-7 bg-white p-6">
              <h2 className="font-serif text-2xl font-bold">Faturas e pagamentos</h2>
              {dados.pagamentos.length === 0 && <p className="mt-4 text-sm text-[#1C3350]/55">{dados.financiada ? "A formação financiada não tem fatura nesta ficha." : "Não há pagamentos associados a este registo."}</p>}
              <div className="mt-5 space-y-3">
                {dados.pagamentos.map(pagamento => (
                  <div key={pagamento.id} className="grid gap-3 border-b border-[#1C3350]/10 py-4 text-sm sm:grid-cols-[1fr_120px_90px_90px] sm:items-center">
                    <span><strong className="block">{pagamento.curso}</strong><span className="text-[#1C3350]/45">{pagamento.metodo}</span></span>
                    <span className="text-[#1C3350]/45">{pagamento.data}</span>
                    <strong>{pagamento.valor}</strong>
                    <span className="font-bold text-[#A60000]">{pagamento.estado}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {tab === "profile" && (
            <div className="mt-7 grid gap-6 lg:grid-cols-[280px_1fr]">
              <aside className="h-fit border border-[#1C3350]/10 bg-white p-6 text-center">
                <span className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-[#1C3350] text-2xl font-bold text-white">{iniciais(nome)}</span>
                <h2 className="mt-4 font-serif text-2xl font-bold">{nome}</h2>
                <p className="mt-1 text-sm text-[#1C3350]/50">{dados.pessoa.email}</p>
                <div className="mt-6 border-t border-[#1C3350]/10 pt-5 text-left text-sm">
                  <p className="flex justify-between"><span className="text-[#1C3350]/50">Cursos</span><strong>{dados.resumo.cursos}</strong></p>
                  <p className="mt-3 flex justify-between"><span className="text-[#1C3350]/50">Certificados</span><strong>{dados.resumo.certificados}</strong></p>
                </div>
              </aside>
              <div className="border border-[#1C3350]/10 bg-white p-6 sm:p-8">
                <div className="flex items-start justify-between gap-4 border-b border-[#1C3350]/10 pb-5">
                  <div>
                    <h2 className="font-serif text-2xl font-bold">Dados pessoais</h2>
                    <p className="mt-1 text-sm text-[#1C3350]/50">O que gravar aqui actualiza a ficha do GesForma. O email de acesso fica com a secretaria.</p>
                  </div>
                  {perfilGuardado && <span className="flex items-center gap-2 bg-[#EDEEF1] px-3 py-2 text-xs font-bold text-[#A60000]"><Icon name="check" className="h-4 w-4" />Guardado</span>}
                </div>
                <form onSubmit={event => { void gravarPerfil(event); }} className="mt-6 space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#1C3350]/60">Nome<input name="nome" defaultValue={dados.pessoa.nome} className="mt-2 w-full border border-[#1C3350]/20 px-4 py-3 text-base font-normal normal-case tracking-normal outline-none focus:border-[#A60000]" /></label>
                    <label className="text-xs font-bold uppercase tracking-wider text-[#1C3350]/60">Apelido<input name="apelido" defaultValue={dados.pessoa.apelido} className="mt-2 w-full border border-[#1C3350]/20 px-4 py-3 text-base font-normal normal-case tracking-normal outline-none focus:border-[#A60000]" /></label>
                    <label className="text-xs font-bold uppercase tracking-wider text-[#1C3350]/60">Telemóvel<input name="telf" defaultValue={dados.pessoa.telf} className="mt-2 w-full border border-[#1C3350]/20 px-4 py-3 text-base font-normal normal-case tracking-normal outline-none focus:border-[#A60000]" /></label>
                    <label className="text-xs font-bold uppercase tracking-wider text-[#1C3350]/60">Email<input type="email" value={dados.pessoa.email} readOnly className="mt-2 w-full border border-[#1C3350]/10 bg-[#F9F9F9] px-4 py-3 text-base font-normal normal-case tracking-normal" /></label>
                  </div>
                  <label className="flex items-start gap-3 border-t border-[#1C3350]/10 pt-5 text-sm">
                    <input name="novidades" type="checkbox" defaultChecked={dados.pessoa.novidades} className="mt-1 accent-[#A60000]" />
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

function ReporLigacao({ token, onFeito }: { token: string; onFeito: () => void }) {
  const [nova, setNova] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  async function gravar(event: FormEvent) {
    event.preventDefault();
    setOcupado(true);
    setErro("");
    try {
      await apiReporPalavraPasse(token, nova);
      window.history.replaceState({}, "", "/area-formando");
      onFeito();
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : mensagemPalavraPasse(nova));
    } finally {
      setOcupado(false);
    }
  }
  return (
    <main className="grid min-h-[calc(100vh-80px)] place-items-center bg-[#F9F9F9] px-5 py-16">
      <form onSubmit={gravar} className="w-full max-w-md">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#A60000]">Recuperar acesso</p>
        <h1 className="mt-3 font-serif text-4xl font-bold text-[#1C3350]">Defina uma palavra-passe nova.</h1>
        {erro && <p className="mt-4 text-sm font-semibold text-[#A60000]">{erro}</p>}
        <label className="mt-8 block text-xs font-bold uppercase tracking-wider text-[#1C3350]/65">
          Palavra-passe nova
          <input required type="password" value={nova} onChange={e => setNova(e.target.value)} autoComplete="new-password" className="mt-2 w-full border border-[#1C3350]/20 bg-white px-4 py-4 text-base font-normal normal-case tracking-normal outline-none focus:border-[#A60000]" />
        </label>
        <button disabled={ocupado} className="mt-5 flex w-full items-center justify-between bg-[#A60000] px-6 py-4 font-bold text-white disabled:opacity-50">{ocupado ? "A gravar…" : "Guardar e voltar ao login"}</button>
      </form>
    </main>
  );
}

export function AreaFormando() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [troca, setTroca] = useState<SessionUser | null>(null);
  const [dados, setDados] = useState<AreaFormandoDados | null>(null);
  const [pronto, setPronto] = useState(false);
  const [aviso, setAviso] = useState("");
  const [token, setToken] = useState(() => new URLSearchParams(window.location.search).get("recuperar") ?? "");
  const [reposta, setReposta] = useState(false);

  useEffect(() => {
    let viva = true;
    apiMe()
      .then(r => {
        if (!viva) return;
        if (r.user.role !== "formando") {
          irPosLogin(r.user.role);
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

  useEffect(() => {
    if (!user) return;
    let viva = true;
    apiAreaFormando().then(r => { if (viva) setDados(r); }).catch(() => { if (viva) setDados(null); });
    return () => { viva = false; };
  }, [user]);

  function avisar(texto: string) {
    setAviso(texto);
    window.setTimeout(() => setAviso(""), 2800);
  }

  async function sair() {
    await apiLogout().catch(() => undefined);
    setUser(null);
    setDados(null);
  }

  return (
    <div className="site-ena min-h-screen bg-[#F9F9F9] text-[#1C3350]">
      <Cabecalho />
      {!pronto ? (
        <main className="grid min-h-[50vh] place-items-center text-sm font-semibold text-[#1C3350]/50">A verificar a sessão…</main>
      ) : token && !user ? (
        <ReporLigacao token={token} onFeito={() => { setToken(""); setReposta(true); }} />
      ) : user && !dados ? (
        <main className="grid min-h-[50vh] place-items-center text-sm font-semibold text-[#1C3350]/50">A ler o registo…</main>
      ) : user && dados ? (
        <Painel dados={dados} onDados={setDados} onSair={() => void sair()} avisar={avisar} />
      ) : (
        <>
          {reposta && <p className="bg-[#FFF1D1] px-5 py-3 text-center text-sm font-semibold">Palavra-passe actualizada. Entre com a nova.</p>}
          <LoginFormando onEntrou={setUser} trocaInicial={troca} />
        </>
      )}
      {aviso && <p className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 bg-[#1C3350] px-4 py-3 text-sm font-semibold text-white shadow-lg" role="status">{aviso}</p>}
    </div>
  );
}
