// Continuação de AreaFormando.tsx (partido para ficar abaixo das 500 linhas).
import { FormEvent, useEffect, useState } from "react";
import { fmtDataDDMMAAAA } from "../partilhado/horaLisboa";
import { ApiError, apiAreaFormando, apiLogout, apiMe, apiPatchAreaFormando, apiReporPalavraPasse, type AreaFormandoDados, type SessionUser } from "../partilhado/api";
import { mensagemPalavraPasse } from "../partilhado/passwordPolicy";
import { PilulaOpiniao } from "./AreaFormandoOpiniao";
import { DocumentosFinArea, Icon, descarregar, primeiroNome, iniciais, irPosLogin, LoginFormando, Sala } from "./AreaFormando";
import { OPCOES_PAINEL, type OpcoesPainel, type PainelEntrada, type Separador } from "./areaFormandoOpcoes";

export function Painel({ dados, onDados, onSair, avisar, opcoes = OPCOES_PAINEL }: {
  dados: AreaFormandoDados;
  onDados: (dados: AreaFormandoDados) => void;
  onSair: () => void;
  avisar: (texto: string) => void;
  opcoes?: OpcoesPainel;
}) {
  const visiveis = new Set(opcoes.separadores.length ? opcoes.separadores : OPCOES_PAINEL.separadores);
  const [tab, setTab] = useState<Separador>(() => OPCOES_PAINEL.separadores.find(s => visiveis.has(s)) ?? "courses");
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
      <section className="bg-[var(--c-primaria,#1C3350)] px-5 py-10 text-white lg:px-8" style={opcoes.fundoTopo ? { background: opcoes.fundoTopo } : undefined}>
        <div className="mx-auto flex max-w-[1240px] flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm text-white/55">{opcoes.saudacao} {primeiroNome(nome)}</p>
            {opcoes.titulo && <h1 className="mt-1 font-serif text-4xl font-bold">{opcoes.titulo}</h1>}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <PilulaOpiniao nome={dados.pessoa.nome} apelido={dados.pessoa.apelido} cursos={[...new Set(dados.cursos.map(c => c.titulo))]} />
            <button type="button" onClick={onSair} className="w-fit border border-white/30 px-4 py-2 text-sm font-bold hover:bg-white hover:text-[var(--c-primaria,#1C3350)]">Terminar sessão</button>
          </div>
        </div>
      </section>
      <section className="px-5 py-8 lg:px-8 lg:py-12">
        <div className="mx-auto max-w-[1240px]">
          {opcoes.resumo && <div className="grid gap-4 sm:grid-cols-3">
            {[[String(dados.resumo.cursos), "Cursos no registo"], [`${dados.resumo.progresso}%`, "Sessões já decorridas"], [String(dados.resumo.certificados), dados.resumo.certificados === 1 ? "Certificado disponível" : "Certificados disponíveis"]].map(([value, label]) => (
              <div key={label} className="border border-[var(--c-primaria,#1C3350)]/10 bg-white p-5">
                <strong className="font-serif text-3xl text-[var(--c-destaque,#A60000)]">{value}</strong>
                <span className="ml-3 text-sm text-[var(--c-primaria,#1C3350)]/60">{label}</span>
              </div>
            ))}
          </div>}
          <nav className="mt-8 flex gap-2 overflow-x-auto border-b border-[var(--c-primaria,#1C3350)]/15" aria-label="Secções da área">
            {([
              ["courses", "Os meus cursos"],
              ["agenda", "Agenda"],
              ["certificates", "Certificados"],
              ...(dados.documentosFin?.length ? [["documents", "Documentos"] as const] : []),
              ["notifications", "Notificações"],
              ["payments", "Pagamentos"],
              ["profile", "O meu perfil"],
            ] as const).filter(([value]) => visiveis.has(value)).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setTab(value)} className={`whitespace-nowrap border-b-2 px-5 py-4 text-sm font-bold ${tab === value ? "border-[var(--c-destaque,#A60000)] text-[var(--c-destaque,#A60000)]" : "border-transparent text-[var(--c-primaria,#1C3350)]/55"}`}>{label}</button>
            ))}
          </nav>
          {tab === "courses" && (
            <div className="mt-7 grid gap-5 lg:grid-cols-2">
              {dados.cursos.length === 0 && <p className="text-sm leading-7 text-[var(--c-primaria,#1C3350)]/60">A secretaria ainda não associou formações a esta conta. O acesso cria-se na ficha do formando, no GesForma.</p>}
              {dados.cursos.map(curso => (
                <article key={curso.id} className="border border-[var(--c-primaria,#1C3350)]/10 bg-white p-6">
                  <div className="flex items-center justify-between">
                    <span className="bg-[#FFF1D1] px-3 py-1.5 text-xs font-bold uppercase tracking-wider">{curso.regime === "fin" ? "Financiada" : "Gold"}</span>
                    <span className="text-sm font-bold">{curso.progresso}%</span>
                  </div>
                  <h2 className="mt-5 font-serif text-2xl font-bold">{curso.titulo}</h2>
                  <p className="mt-2 text-sm text-[var(--c-primaria,#1C3350)]/55">{curso.turma || curso.estado}{curso.ultimo ? ` · última sessão ${curso.ultimo}` : ""}</p>
                  <div className="mt-6 h-2 bg-[#EDEEF1]"><div className="h-full bg-[var(--c-destaque,#A60000)]" style={{ width: `${curso.progresso}%` }} /></div>
                  <div className="mt-5 flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--c-primaria,#1C3350)]/50">{curso.feitas} de {curso.sessoes} sessões</span>
                    <button type="button" onClick={() => setSala(curso.id)} className="flex items-center gap-2 font-bold text-[var(--c-destaque,#A60000)]">Ver sessões <Icon name="arrow" /></button>
                  </div>
                </article>
              ))}
            </div>
          )}
          {tab === "agenda" && (
            <div className="mt-7 border border-[var(--c-primaria,#1C3350)]/10 bg-white">
              {dados.agenda.length === 0 && <p className="p-6 text-sm text-[var(--c-primaria,#1C3350)]/55">Não há sessões no cronograma das suas turmas.</p>}
              {dados.agenda.map(sessao => (
                <div key={sessao.id} className="grid gap-4 border-b border-[var(--c-primaria,#1C3350)]/10 p-6 sm:grid-cols-[100px_1fr_auto] sm:items-center">
                  <div><strong className="block text-3xl text-[var(--c-destaque,#A60000)]">{sessao.dia}</strong><span className="text-xs font-bold uppercase">{sessao.mes}</span></div>
                  <div><strong>{sessao.titulo}</strong><p className="mt-1 text-sm text-[var(--c-primaria,#1C3350)]/55">{sessao.curso}{sessao.horas ? ` · ${sessao.horas}` : ""}</p></div>
                  <button type="button" onClick={() => { descarregar(`sessao-${sessao.data}.ics`, `BEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY:${sessao.titulo}\nDTSTART;TZID=Europe/Lisbon:${sessao.data.replace(/-/g, "")}T${(sessao.horas.slice(0, 5) || "09:00").replace("h", "").replace(":", "")}00\nEND:VEVENT\nEND:VCALENDAR`); avisar("Ficheiro de calendário descarregado."); }} className="border border-[var(--c-primaria,#1C3350)] px-4 py-2 text-sm font-bold">Adicionar ao calendário</button>
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
              {dados.certificados.length === 0 && <p className="text-sm text-[var(--c-primaria,#1C3350)]/55">Ainda não há certificados emitidos nesta ficha.</p>}
              {dados.certificados.map(cert => (
                <div key={cert.id} className="flex flex-col items-start justify-between gap-4 border border-[var(--c-primaria,#1C3350)]/10 bg-white p-6 sm:flex-row sm:items-center">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--c-destaque,#A60000)]">{cert.data || "Emitido"}</span>
                    <h2 className="mt-2 font-serif text-xl font-bold">{cert.curso}</h2>
                    <p className="mt-1 text-sm text-[var(--c-primaria,#1C3350)]/50">{cert.nota ? `Nota ${cert.nota}` : "Certificado da turma"}</p>
                  </div>
                  {cert.url ? <a href={cert.url} className="bg-[var(--c-primaria,#1C3350)] px-4 py-3 text-sm font-bold text-white" download={cert.nome || undefined}>Descarregar</a> : <span className="text-sm text-[var(--c-primaria,#1C3350)]/45">A secretaria ainda não anexou o ficheiro.</span>}
                </div>
              ))}
            </div>
          )}
          {tab === "notifications" && (
            <div className="mt-7 grid gap-5 lg:grid-cols-[1fr_300px]">
              <div className="bg-white">
                <div className="flex justify-between gap-4 border-b border-[var(--c-primaria,#1C3350)]/10 p-5">
                  <h2 className="font-serif text-2xl font-bold">Notificações</h2>
                  <button type="button" onClick={() => { void apiPatchAreaFormando({ lidas: dados.notificacoes.map(n => n.id) }).then(onDados); avisar("Todas as notificações foram marcadas como lidas."); }} className="text-xs font-bold text-[var(--c-destaque,#A60000)]">Marcar tudo como lido</button>
                </div>
                {dados.notificacoes.length === 0 && <p className="p-5 text-sm text-[var(--c-primaria,#1C3350)]/55">Não há avisos a partir do seu registo.</p>}
                {dados.notificacoes.map(item => (
                  <article key={item.id} className={`border-b border-[var(--c-primaria,#1C3350)]/10 p-5 ${item.porLer ? "border-l-4 border-l-[var(--c-destaque,#A60000)] bg-[#F9F9F9]" : ""}`}>
                    <div className="flex justify-between gap-4"><strong>{item.titulo}</strong><span className="text-xs text-[var(--c-primaria,#1C3350)]/40">{item.quando}</span></div>
                    <p className="mt-2 text-sm text-[var(--c-primaria,#1C3350)]/55">{item.texto}</p>
                  </article>
                ))}
              </div>
              <aside className="h-fit bg-white p-5">
                <h3 className="font-bold">Preferências</h3>
                <form onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); void apiPatchAreaFormando({ canais: { email: form.get("email") === "on", sms: form.get("sms") === "on", whatsapp: form.get("whatsapp") === "on", plataforma: form.get("plataforma") === "on" } }).then(seguinte => { onDados(seguinte); avisar("Preferências gravadas na conta."); }); }} className="mt-4 space-y-4">
                  {(["email", "sms", "whatsapp", "plataforma"] as const).map(canal => (
                    <label key={canal} className="flex justify-between text-sm capitalize"><span>{canal === "plataforma" ? "Na plataforma" : canal === "whatsapp" ? "WhatsApp" : canal === "sms" ? "SMS" : "Email"}</span><input name={canal} type="checkbox" defaultChecked={dados.pessoa.canais[canal]} className="accent-[var(--c-destaque,#A60000)]" /></label>
                  ))}
                  <button type="submit" className="mt-6 w-full bg-[var(--c-primaria,#1C3350)] px-4 py-3 text-sm font-bold text-white">Guardar preferências</button>
                </form>
              </aside>
            </div>
          )}
          {tab === "payments" && (
            <div className="mt-7 bg-white p-6">
              <h2 className="font-serif text-2xl font-bold">Faturas e pagamentos</h2>
              {dados.pagamentos.length === 0 && <p className="mt-4 text-sm text-[var(--c-primaria,#1C3350)]/55">{dados.financiada ? "A formação financiada não tem fatura nesta ficha." : "Não há pagamentos associados a este registo."}</p>}
              <div className="mt-5 space-y-3">
                {dados.pagamentos.map(pagamento => (
                  <div key={pagamento.id} className="grid gap-3 border-b border-[var(--c-primaria,#1C3350)]/10 py-4 text-sm sm:grid-cols-[1fr_120px_90px_90px] sm:items-center">
                    <span><strong className="block">{pagamento.curso}</strong><span className="text-[var(--c-primaria,#1C3350)]/45">{pagamento.metodo}</span></span>
                    <span className="text-[var(--c-primaria,#1C3350)]/45">{fmtDataDDMMAAAA(pagamento.data)}</span>
                    <strong>{pagamento.valor}</strong>
                    <span className="font-bold text-[var(--c-destaque,#A60000)]">{pagamento.estado}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {tab === "profile" && (
            <div className="mt-7 grid gap-6 lg:grid-cols-[280px_1fr]">
              <aside className="h-fit border border-[var(--c-primaria,#1C3350)]/10 bg-white p-6 text-center">
                <span className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-[var(--c-primaria,#1C3350)] text-2xl font-bold text-white">{iniciais(nome)}</span>
                <h2 className="mt-4 font-serif text-2xl font-bold">{nome}</h2>
                <p className="mt-1 text-sm text-[var(--c-primaria,#1C3350)]/50">{dados.pessoa.email}</p>
                <div className="mt-6 border-t border-[var(--c-primaria,#1C3350)]/10 pt-5 text-left text-sm">
                  <p className="flex justify-between"><span className="text-[var(--c-primaria,#1C3350)]/50">Cursos</span><strong>{dados.resumo.cursos}</strong></p>
                  <p className="mt-3 flex justify-between"><span className="text-[var(--c-primaria,#1C3350)]/50">Certificados</span><strong>{dados.resumo.certificados}</strong></p>
                </div>
              </aside>
              <div className="border border-[var(--c-primaria,#1C3350)]/10 bg-white p-6 sm:p-8">
                <div className="flex items-start justify-between gap-4 border-b border-[var(--c-primaria,#1C3350)]/10 pb-5">
                  <div>
                    <h2 className="font-serif text-2xl font-bold">Dados pessoais</h2>
                    <p className="mt-1 text-sm text-[var(--c-primaria,#1C3350)]/50">O que gravar aqui actualiza a ficha do GesForma. O email de acesso fica com a secretaria.</p>
                  </div>
                  {perfilGuardado && <span className="flex items-center gap-2 bg-[#EDEEF1] px-3 py-2 text-xs font-bold text-[var(--c-destaque,#A60000)]"><Icon name="check" className="h-4 w-4" />Guardado</span>}
                </div>
                <form onSubmit={event => { void gravarPerfil(event); }} className="mt-6 space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--c-primaria,#1C3350)]/60">Nome<input name="nome" defaultValue={dados.pessoa.nome} className="mt-2 w-full border border-[var(--c-primaria,#1C3350)]/20 px-4 py-3 text-base font-normal normal-case tracking-normal outline-none focus:border-[var(--c-destaque,#A60000)]" /></label>
                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--c-primaria,#1C3350)]/60">Apelido<input name="apelido" defaultValue={dados.pessoa.apelido} className="mt-2 w-full border border-[var(--c-primaria,#1C3350)]/20 px-4 py-3 text-base font-normal normal-case tracking-normal outline-none focus:border-[var(--c-destaque,#A60000)]" /></label>
                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--c-primaria,#1C3350)]/60">Telemóvel<input name="telf" defaultValue={dados.pessoa.telf} className="mt-2 w-full border border-[var(--c-primaria,#1C3350)]/20 px-4 py-3 text-base font-normal normal-case tracking-normal outline-none focus:border-[var(--c-destaque,#A60000)]" /></label>
                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--c-primaria,#1C3350)]/60">Email<input type="email" value={dados.pessoa.email} readOnly className="mt-2 w-full border border-[var(--c-primaria,#1C3350)]/10 bg-[#F9F9F9] px-4 py-3 text-base font-normal normal-case tracking-normal" /></label>
                  </div>
                  <label className="flex items-start gap-3 border-t border-[var(--c-primaria,#1C3350)]/10 pt-5 text-sm">
                    <input name="novidades" type="checkbox" defaultChecked={dados.pessoa.novidades} className="mt-1 accent-[var(--c-destaque,#A60000)]" />
                    <span><strong className="block">Comunicações da ENA</strong><span className="mt-1 block text-[var(--c-primaria,#1C3350)]/50">Quero receber novidades e novas oportunidades de formação.</span></span>
                  </label>
                  <div className="flex justify-end"><button type="submit" className="bg-[var(--c-destaque,#A60000)] px-6 py-3 font-bold text-white hover:bg-[#8B0000]">Guardar alterações</button></div>
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
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--c-destaque,#A60000)]">Recuperar acesso</p>
        <h1 className="mt-3 font-serif text-4xl font-bold text-[var(--c-primaria,#1C3350)]">Defina uma palavra-passe nova.</h1>
        {erro && <p className="mt-4 text-sm font-semibold text-[var(--c-destaque,#A60000)]">{erro}</p>}
        <label className="mt-8 block text-xs font-bold uppercase tracking-wider text-[var(--c-primaria,#1C3350)]/65">
          Palavra-passe nova
          <input required type="password" value={nova} onChange={e => setNova(e.target.value)} autoComplete="new-password" className="mt-2 w-full border border-[var(--c-primaria,#1C3350)]/20 bg-white px-4 py-4 text-base font-normal normal-case tracking-normal outline-none focus:border-[var(--c-destaque,#A60000)]" />
        </label>
        <button disabled={ocupado} className="mt-5 flex w-full items-center justify-between bg-[var(--c-destaque,#A60000)] px-6 py-4 font-bold text-white disabled:opacity-50">{ocupado ? "A gravar…" : "Guardar e voltar ao login"}</button>
      </form>
    </main>
  );
}

/** A área do formando sem moldura: entrada, recuperação da palavra-passe e painel (bloco do editor do site). */
export function AreaFormandoConteudo({ painel, opcoes }: { painel?: PainelEntrada; opcoes?: OpcoesPainel }) {
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

  // Os blocos à volta podem esconder-se quando há sessão (classe na raiz, lida pelo CSS do editor do site).
  useEffect(() => {
    document.documentElement.classList.toggle("ena-com-sessao", Boolean(user));
    return () => document.documentElement.classList.remove("ena-com-sessao");
  }, [user]);

  return (
    <div className="text-[var(--c-primaria,#1C3350)]">
      {!pronto ? (
        <main className="grid min-h-[50vh] place-items-center text-sm font-semibold text-[var(--c-primaria,#1C3350)]/50">A verificar a sessão…</main>
      ) : token && !user ? (
        <ReporLigacao token={token} onFeito={() => { setToken(""); setReposta(true); }} />
      ) : user && !dados ? (
        <main className="grid min-h-[50vh] place-items-center text-sm font-semibold text-[var(--c-primaria,#1C3350)]/50">A ler o registo…</main>
      ) : user && dados ? (
        <Painel dados={dados} onDados={setDados} onSair={() => void sair()} avisar={avisar} opcoes={opcoes} />
      ) : (
        <>
          {reposta && <p className="bg-[#FFF1D1] px-5 py-3 text-center text-sm font-semibold">Palavra-passe actualizada. Entre com a nova.</p>}
          <LoginFormando onEntrou={setUser} trocaInicial={troca} painel={painel} />
        </>
      )}
      {aviso && <p className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 bg-[var(--c-primaria,#1C3350)] px-4 py-3 text-sm font-semibold text-white shadow-lg" role="status">{aviso}</p>}
    </div>
  );
}
