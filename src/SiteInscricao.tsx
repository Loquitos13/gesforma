import { createContext, useCallback, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ApiError, apiPublicOferta, apiPublicPreinscricao } from "./api";
import { SearchSelect } from "./FormKit";
import { fmtDataPt, ofertaFiltrada, uniqueVals, type OfertaTurma } from "./oferta";
import type { Course } from "./SiteLanding";
import { ePreinscricao, ePrepago } from "./siteConteudo";
import { textoListaVazia, useOpcoesPublicas } from "./useOpcoesPublicas";

type Passo = "dados" | "pagamento" | "feito";
type OfertaEstado = "a-carregar" | "pronto" | "erro";

const InscricaoCtx = createContext<{ abrir: (curso: Course) => void } | null>(null);

export function useInscricao() {
  const ctx = useContext(InscricaoCtx);
  if (!ctx) throw new Error("useInscricao precisa do site");
  return ctx;
}

export function InscricaoSite({ children }: { children: ReactNode }) {
  const [curso, setCurso] = useState<Course | null>(null);
  const abrir = useCallback((seguinte: Course) => setCurso(seguinte), []);
  const fechar = useCallback(() => setCurso(null), []);
  return (
    <InscricaoCtx.Provider value={{ abrir }}>
      {children}
      <ModalInscricao curso={curso} onClose={fechar} />
    </InscricaoCtx.Provider>
  );
}

function norm(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function ModalInscricao({ curso, onClose }: { curso: Course | null; onClose: () => void }) {
  const aberto = Boolean(curso);
  const preinscricao = ePreinscricao(curso?.enrollment);
  const prepago = ePrepago(curso?.enrollment);
  const [passo, setPasso] = useState<Passo>("dados");
  const [nome, setNome] = useState("");
  const [apelido, setApelido] = useState("");
  const [telf, setTelf] = useState("");
  const [email, setEmail] = useState("");
  const [concelho, setConcelho] = useState("");
  const [origem, setOrigem] = useState("");
  const concelhos = useOpcoesPublicas("concelhos", aberto);
  const origens = useOpcoesPublicas("origens", aberto);
  const metodos = useOpcoesPublicas("metodos_pagamento", aberto);
  const [turmas, setTurmas] = useState<OfertaTurma[]>([]);
  const [ofertaEstado, setOfertaEstado] = useState<OfertaEstado>("a-carregar");
  const [local, setLocal] = useState("");
  const [horario, setHorario] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [turmaId, setTurmaId] = useState(0);
  const [metodo, setMetodo] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    if (!aberto) return;
    setPasso("dados");
    setErro("");
    setAviso("");
    setLocal("");
    setHorario("");
    setDataInicio("");
    setTurmaId(0);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [aberto, curso?.id, onClose]);

  useEffect(() => {
    if (!aberto) return;
    let vivo = true;
    setOfertaEstado("a-carregar");
    void apiPublicOferta()
      .then(r => { if (vivo) { setTurmas(r.turmas); setOfertaEstado("pronto"); } })
      .catch(() => { if (vivo) setOfertaEstado("erro"); });
    return () => { vivo = false; };
  }, [aberto, curso?.id]);

  useEffect(() => {
    if (metodos.estado !== "pronto") return;
    setMetodo(atual => metodos.nomes.includes(atual) ? atual : (metodos.nomes[0] ?? ""));
  }, [metodos.estado, metodos.nomes]);

  const doCurso = useMemo(() => {
    const nomes = new Set([norm(curso?.title ?? ""), norm(curso?.nomeOferta ?? "")].filter(Boolean));
    return turmas.filter(t => nomes.has(norm(t.curso)) && (!t.regime || t.regime === curso?.regime));
  }, [turmas, curso?.title, curso?.nomeOferta, curso?.regime]);
  const locais = uniqueVals(doCurso, "local");
  const horarios = uniqueVals(ofertaFiltrada(doCurso, { local }), "horario");
  const datas = ofertaFiltrada(doCurso, { local, horario });
  const turma = doCurso.find(t => t.turmaId === turmaId) ?? null;
  const precoNumero = turma?.preco ?? curso?.precoDesde ?? null;
  const precoLabel = precoNumero != null ? `${precoNumero.toLocaleString("pt-PT")} €` : curso?.price || "Sob consulta";

  function escolherLocal(valor: string) {
    setLocal(valor);
    setHorario("");
    setDataInicio("");
    setTurmaId(0);
  }
  function escolherHorario(valor: string) {
    setHorario(valor);
    setDataInicio("");
    setTurmaId(0);
  }
  function escolherTurma(id: string) {
    const hit = datas.find(t => String(t.turmaId) === id);
    setDataInicio(hit?.dataInicio ?? "");
    setTurmaId(hit?.turmaId ?? 0);
  }

  function validarDados() {
    if (!nome.trim() || !apelido.trim() || !telf.trim() || !email.trim() || !concelho || !origem) {
      return "Preencha nome, apelido, telemóvel, email, concelho e como tomou conhecimento.";
    }
    if (ofertaEstado === "a-carregar") return "A carregar as turmas libertadas.";
    if (ofertaEstado === "erro") return "Não foi possível carregar as turmas. Feche e volte a abrir o pedido.";
    if (doCurso.length && !turmaId) return "Escolha local, horário e data de início da turma.";
    return "";
  }

  function continuar(e: FormEvent) {
    e.preventDefault();
    const falha = validarDados();
    setErro(falha);
    if (falha) return;
    if (prepago) setPasso("pagamento");
    else void enviar();
  }

  function falhaPagamento() {
    if (metodos.estado === "a-carregar") return "A carregar as formas de pagamento.";
    if (metodos.estado === "erro") return "Não foi possível carregar as formas de pagamento.";
    if (!metodo) return "A secretaria ainda não definiu formas de pagamento em Listas de opções.";
    return "";
  }

  async function enviar(e?: FormEvent) {
    e?.preventDefault();
    if (!curso) return;
    const falha = validarDados();
    if (falha) { setErro(falha); setPasso("dados"); return; }
    if (prepago) {
      const pagamento = falhaPagamento();
      if (pagamento) { setErro(pagamento); return; }
    }
    setBusy(true);
    setErro("");
    try {
      const r = await apiPublicPreinscricao({
        nome: nome.trim(),
        apelido: apelido.trim(),
        telf: telf.trim(),
        email: email.trim(),
        concelho,
        origem,
        curso: turma?.curso || curso.nomeOferta || curso.title,
        local: turma?.local || local,
        horario: turma?.horario || horario,
        inicioCurso: turma?.dataInicio || dataInicio,
        turmaId: turmaId || undefined,
        preco: precoNumero ?? undefined,
        regime: curso.regime,
        pagamentoMetodo: prepago ? metodo : undefined,
        acessoImediato: prepago && !turmaId,
      });
      setAviso(r.aviso);
      setPasso("feito");
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível enviar. Tente de novo dentro de um minuto.");
    } finally {
      setBusy(false);
    }
  }

  if (!curso) return null;
  if (!preinscricao && !prepago) {
    return (
      <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="inscricao-titulo">
        <button type="button" className="absolute inset-0 bg-[#14263D]/55" aria-label="Fechar" onClick={onClose} />
        <div className="relative w-full max-w-xl bg-white px-6 py-7 shadow-[0_28px_80px_rgba(20,38,61,.28)] sm:px-8">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#A60000]">{curso.enrollment}</p>
          <h2 id="inscricao-titulo" className="mt-2 font-serif text-3xl text-[#1C3350]">{curso.title}</h2>
          <p className="mt-4 text-sm leading-7 text-[#1C3350]/75">
            Este curso não passa pelo formulário de pré-inscrição. Quem se inscreve entra no Moodle.
            O GesForma ainda não cria essa conta nem abre o curso.
          </p>
          <button type="button" onClick={onClose} className="mt-6 bg-[#1C3350] px-6 py-3 text-sm font-extrabold uppercase tracking-[0.08em] text-white">Fechar</button>
        </div>
      </div>
    );
  }
  const resumoTurma = [turma?.local || local, turma?.horario || horario, dataInicio ? fmtDataPt(dataInicio) : ""].filter(Boolean).join(" · ");
  const notaPagamento = metodo === "MB Way"
    ? `A referência MB Way segue para o telemóvel ${telf} e para ${email}.`
    : metodo === "Multibanco"
      ? `A entidade e a referência Multibanco seguem para ${email}.`
      : metodo === "Transferência"
        ? `O IBAN da transferência segue para ${email}.`
        : metodo
          ? `A ENA confirma consigo o pagamento por ${metodo}. Nada é cobrado neste ecrã.`
          : "";
  const pagamentoBloqueado = passo === "pagamento" && Boolean(falhaPagamento());

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="inscricao-titulo">
      <button type="button" className="absolute inset-0 bg-[#14263D]/55" aria-label="Fechar" onClick={onClose} />
      <div className="relative flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden bg-white shadow-[0_28px_80px_rgba(20,38,61,.28)] sm:max-h-[88vh]">
        <header className="flex items-start justify-between gap-4 border-b border-[#1C3350]/10 px-5 py-5 sm:px-8">
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#A60000]">
              {prepago ? "Check-out" : "Pré-inscrição"}
            </p>
            <h2 id="inscricao-titulo" className="mt-1 font-serif text-2xl leading-tight text-[#1C3350] sm:text-3xl">{curso.title}</h2>
            <p className="mt-2 text-sm text-[#1C3350]/60">{curso.format} · {curso.duration} · {precoLabel}</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center text-[#1C3350]/50 hover:bg-[#F4F6F8] hover:text-[#1C3350]" aria-label="Fechar">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </header>
        {prepago && passo !== "feito" && (
          <ol className="grid grid-cols-2 border-b border-[#1C3350]/10 text-xs font-extrabold uppercase tracking-[0.08em]">
            <li className={`px-5 py-3 sm:px-8 ${passo === "dados" ? "bg-[#1C3350] text-white" : "text-[#1C3350]/45"}`}>1 · Os seus dados</li>
            <li className={`px-5 py-3 sm:px-8 ${passo === "pagamento" ? "bg-[#1C3350] text-white" : "text-[#1C3350]/45"}`}>2 · Pagamento</li>
          </ol>
        )}
        <div className="overflow-y-auto px-5 py-6 sm:px-8">
          {passo === "feito" ? (
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#FFA900]">Pedido recebido</p>
              <p className="mt-3 text-lg leading-8 text-[#1C3350]/75">
                {aviso || "A secretaria da ENA entra em contacto consigo."} O pedido ficou associado a {email}.
              </p>
              {prepago && (
                <p className="mt-3 text-sm leading-6 text-[#1C3350]/65">
                  Escolheu {metodo}. {notaPagamento} O valor só fica liquidado quando o banco confirma. Neste passo não há cobrança no cartão.
                </p>
              )}
            </div>
          ) : passo === "pagamento" ? (
            <form id="inscricao-form" onSubmit={e => void enviar(e)} className="space-y-6">
              <div className="bg-[#F4F6F8] px-4 py-4 text-sm leading-6 text-[#1C3350]/75">
                <p className="font-semibold text-[#1C3350]">{nome} {apelido}</p>
                <p>{email} · {telf}</p>
                <p>{concelho} · soube pela via {origem}</p>
                <p className="mt-2">{resumoTurma || "Acesso imediato, online"}</p>
                <p className="mt-3 font-serif text-3xl text-[#1C3350]">{precoLabel}</p>
              </div>
              <fieldset>
                <legend className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#A60000]">Forma de pagamento</legend>
                <p className="mt-2 text-sm leading-6 text-[#1C3350]/65">A ENA envia a referência. O banco é que confirma o pagamento.</p>
                {metodos.estado === "a-carregar" ? (
                  <p className="mt-3 text-sm text-[#1C3350]/60">A carregar as formas de pagamento.</p>
                ) : metodos.estado === "erro" ? (
                  <p className="mt-3 text-sm text-[#A60000]">Não foi possível carregar as formas de pagamento.</p>
                ) : metodos.nomes.length === 0 ? (
                  <p className="mt-3 text-sm leading-6 text-[#1C3350]/70">A secretaria ainda não definiu formas de pagamento em Listas de opções.</p>
                ) : (
                  <div className="mt-3 grid gap-2">
                    {metodos.nomes.map(item => (
                      <label key={item} className={`flex cursor-pointer items-center justify-between border px-4 py-3 text-sm font-semibold ${metodo === item ? "border-[#1C3350] bg-[#1C3350] text-white" : "border-[#1C3350]/15"}`}>
                        <span>{item}</span>
                        <input type="radio" name="metodo" className="accent-[#FFA900]" checked={metodo === item} onChange={() => setMetodo(item)} />
                      </label>
                    ))}
                  </div>
                )}
                {notaPagamento && <p className="mt-3 text-sm leading-6 text-[#1C3350]/60">{notaPagamento}</p>}
              </fieldset>
            </form>
          ) : (
            <form id="inscricao-form" onSubmit={continuar} className="space-y-8">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#A60000]">Os seus dados</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Campo label="Nome"><input className={inputCls} value={nome} onChange={e => setNome(e.target.value)} autoComplete="given-name" required /></Campo>
                  <Campo label="Apelido"><input className={inputCls} value={apelido} onChange={e => setApelido(e.target.value)} autoComplete="family-name" required /></Campo>
                  <Campo label="Telemóvel"><input className={inputCls} value={telf} onChange={e => setTelf(e.target.value)} autoComplete="tel" inputMode="tel" required /></Campo>
                  <Campo label="Email"><input className={inputCls} type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required /></Campo>
                  <Campo label="Concelho">
                    <SearchSelect
                      value={concelho}
                      onChange={setConcelho}
                      options={concelhos.nomes.map(value => ({ value }))}
                      allowEmpty
                      placeholder="Pesquisar concelho"
                      emptyLabel="Seleccione um concelho"
                      empty={textoListaVazia(concelhos.estado, "A secretaria ainda não definiu concelhos em Listas de opções.")}
                    />
                  </Campo>
                  <Campo label="Como tomou conhecimento?">
                    <SearchSelect
                      value={origem}
                      onChange={setOrigem}
                      options={origens.nomes.map(value => ({ value }))}
                      allowEmpty
                      placeholder="Pesquisar origem"
                      emptyLabel="Seleccione a origem"
                      empty={textoListaVazia(origens.estado, "A secretaria ainda não definiu origens em Listas de opções.")}
                    />
                  </Campo>
                </div>
              </div>
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#A60000]">Dados do curso</p>
                {curso.description && <p className="mt-3 text-sm leading-6 text-[#1C3350]/65">{curso.description}</p>}
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Campo label="Curso a que se quer inscrever">
                    <input className={`${inputCls} bg-[#F4F6F8]`} value={curso.title} readOnly />
                  </Campo>
                  {ofertaEstado === "a-carregar" ? (
                    <p className="self-end text-sm text-[#1C3350]/60">A carregar local, horário e data das turmas libertadas.</p>
                  ) : ofertaEstado === "erro" ? (
                    <p className="self-end text-sm text-[#A60000]">Não foi possível carregar as turmas.</p>
                  ) : doCurso.length > 0 ? (
                    <>
                      <Campo label="Local">
                        <SearchSelect value={local} onChange={escolherLocal} options={locais.map(value => ({ value }))} allowEmpty placeholder="Seleccione o local" emptyLabel="Seleccione o local" />
                      </Campo>
                      <Campo label="Horário">
                        <SearchSelect value={horario} onChange={escolherHorario} disabled={!local} options={horarios.map(value => ({ value }))} allowEmpty placeholder="Seleccione o horário" emptyLabel={local ? "Seleccione o horário" : "Escolha primeiro o local"} />
                      </Campo>
                      <Campo label="Data de início">
                        <SearchSelect
                          value={turmaId ? String(turmaId) : ""}
                          onChange={escolherTurma}
                          disabled={!horario}
                          allowEmpty
                          placeholder="Seleccione a data"
                          emptyLabel={horario ? "Seleccione a data" : "Escolha primeiro o horário"}
                          options={datas.map(t => ({
                            value: String(t.turmaId),
                            label: fmtDataPt(t.dataInicio),
                            sub: `${t.nome}${t.vagasLivres ? ` · ${t.vagasLivres} vagas` : " · sem vagas"}${t.preco != null ? ` · ${t.preco.toLocaleString("pt-PT")} €` : ""}`,
                          }))}
                        />
                      </Campo>
                    </>
                  ) : (
                    <p className="text-sm leading-6 text-[#1C3350]/65 sm:col-span-2">
                      {prepago
                        ? "Não há turma com data marcada. O pedido segue em acesso imediato, online, e o pagamento fica no passo seguinte."
                        : "Ainda não há turma com data. O pedido fica registado na mesma e a secretaria confirma a turma. O email automático sai ao inscrever."}
                    </p>
                  )}
                </div>
                {turma?.preco != null && (
                  <p className="mt-4 text-sm font-semibold text-[#1C3350]">
                    Preço desta inscrição: {turma.preco.toLocaleString("pt-PT")} €
                    <span className="font-normal text-[#1C3350]/55"> · vale para {turma.local} e {turma.horario}</span>
                  </p>
                )}
                {turma?.cronogramaPublicado && (
                  <a className="mt-3 inline-flex text-sm font-bold text-[#A60000] underline" href={`/cronograma/${turma.regime || "gold"}/${turma.turmaId}`} target="_blank" rel="noreferrer">Ver o cronograma desta turma</a>
                )}
                {prepago && ofertaEstado === "pronto" && (
                  <p className="mt-4 text-sm leading-6 text-[#1C3350]/60">Nada é cobrado neste passo. A forma de pagamento escolhe-se a seguir.</p>
                )}
              </div>
            </form>
          )}
          {erro && <p className="mt-4 text-sm text-[#A60000]">{erro}</p>}
        </div>
        <footer className="flex flex-col-reverse gap-2 border-t border-[#1C3350]/10 px-5 py-4 sm:flex-row sm:justify-end sm:px-8">
          {passo === "pagamento" && (
            <button type="button" onClick={() => { setErro(""); setPasso("dados"); }} className="px-5 py-3 text-sm font-bold text-[#1C3350]/70">Voltar aos dados</button>
          )}
          {passo === "feito" ? (
            <button type="button" onClick={onClose} className="bg-[#1C3350] px-6 py-3 text-sm font-extrabold uppercase tracking-[0.08em] text-white">Fechar</button>
          ) : (
            <button type="submit" form="inscricao-form" disabled={busy || pagamentoBloqueado} className="bg-[#A60000] px-6 py-3 text-sm font-extrabold uppercase tracking-[0.08em] text-white hover:bg-[#8B0000] disabled:opacity-40">
              {busy ? "A enviar…" : passo === "pagamento" ? "Pedir referência" : prepago ? "Continuar para o pagamento" : "Inscrever-me"}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

const inputCls = "w-full border border-[#1C3350]/15 bg-white px-3 py-2.5 text-sm text-[#1C3350] outline-none focus:border-[#1C3350]";

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-[#1C3350]/70">{label}</span>
      {children}
    </label>
  );
}
