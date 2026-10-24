import { createContext, useCallback, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ApiError, apiPublicOferta, apiPublicPreinscricao } from "../partilhado/api";
import { SearchSelect } from "../partilhado/FormKit";
import { ofertaFiltrada, uniqueVals, vagasPublicas, type OfertaTurma } from "../partilhado/oferta";
import type { Course } from "./SiteLanding";
import { ePreinscricao, ePrepago } from "../partilhado/siteConteudo";
import { textoListaVazia, useOpcoesPublicas } from "./useOpcoesPublicas";
import { ConsentimentoRgpd } from "./ConsentimentoRgpd";
import { fmtDataCalendario as fmtDataPt, hojeLisboa } from "../partilhado/horaLisboa";
import { eur } from "../partilhado/ui/formatos";
import { INSCRICAO_FIN_VAZIA, erroTelefoneFin, partirNomeCompleto, validarInscricaoFin, type InscricaoFin } from "../partilhado/dadosPessoaisFin";
import { LISTA_PAISES } from "../partilhado/execucaoFisica";
import { CampoFin, CamposInscricaoFin, INPUT_MODAL, errosDoServidor, type ErrosForm } from "./DadosPessoaisFin";

type Passo = "turma" | "dados" | "pagamento" | "feito";
/** Como se abre o pedido: o curso e, quando a página do curso o deu, o local já escolhido. */
export type AbrirInscricao = (curso: Course, opcoes?: { local?: string }) => void;
type OfertaEstado = "a-carregar" | "pronto" | "erro";

const InscricaoCtx = createContext<{ abrir: AbrirInscricao } | null>(null);

export function useInscricao() {
  const ctx = useContext(InscricaoCtx);
  if (!ctx) throw new Error("useInscricao precisa do site");
  return ctx;
}

/** Como `useInscricao`, mas fora do site (pré-visualização do editor) abre a página do curso. */
export function useInscricaoOpcional() {
  const ctx = useContext(InscricaoCtx);
  const fora: AbrirInscricao = curso => { window.location.assign(`/formacao/${encodeURIComponent(curso.id)}`); };
  return ctx ?? { abrir: fora };
}

export function InscricaoSite({ children }: { children: ReactNode }) {
  const [curso, setCurso] = useState<Course | null>(null);
  const [localInicial, setLocalInicial] = useState("");
  const abrir = useCallback<AbrirInscricao>((seguinte, opcoes) => { setLocalInicial(opcoes?.local ?? ""); setCurso(seguinte); }, []);
  const fechar = useCallback(() => setCurso(null), []);
  return (
    <InscricaoCtx.Provider value={{ abrir }}>
      {children}
      <ModalInscricao curso={curso} localInicial={localInicial} onClose={fechar} />
    </InscricaoCtx.Provider>
  );
}

function norm(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function ModalInscricao({ curso, localInicial, onClose }: { curso: Course | null; localInicial: string; onClose: () => void }) {
  const aberto = Boolean(curso);
  const preinscricao = ePreinscricao(curso?.enrollment);
  const prepago = ePrepago(curso?.enrollment);
  // Financiada: nome completo, género, data de nascimento, nacionalidade, habilitações, telemóvel e email.
  const fin = curso?.regime === "fin";
  const [dadosFin, setDadosFin] = useState<InscricaoFin>(INSCRICAO_FIN_VAZIA);
  const [errosFin, setErrosFin] = useState<ErrosForm>({});
  const [passo, setPasso] = useState<Passo>("dados");
  const [nome, setNome] = useState("");
  const [apelido, setApelido] = useState("");
  const [telf, setTelf] = useState("");
  const [email, setEmail] = useState("");
  const [concelho, setConcelho] = useState("");
  const [origem, setOrigem] = useState("");
  const [consentimento, setConsentimento] = useState(false);
  const concelhos = useOpcoesPublicas("concelhos", aberto);
  const origens = useOpcoesPublicas("origens", aberto);
  const metodos = useOpcoesPublicas("metodos_pagamento", aberto);
  const [turmas, setTurmas] = useState<OfertaTurma[]>([]);
  const [ofertaEstado, setOfertaEstado] = useState<OfertaEstado>("a-carregar");
  const [local, setLocal] = useState("");
  const [horario, setHorario] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [turmaId, setTurmaId] = useState(0);
  const [trocarLocal, setTrocarLocal] = useState(false);
  const [metodo, setMetodo] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    if (!aberto) return;
    setPasso("turma");
    setDadosFin(INSCRICAO_FIN_VAZIA);
    setErrosFin({});
    setErro("");
    setAviso("");
    setLocal(localInicial);
    setTrocarLocal(false);
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
  }, [aberto, curso?.id, localInicial, onClose]);

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
    // Só as datas de início ainda por vir (as mesmas que a página do curso mostra).
    const hoje = hojeLisboa();
    return turmas.filter(t => nomes.has(norm(t.curso)) && (!t.regime || t.regime === curso?.regime) && (!t.dataInicio || t.dataInicio >= hoje));
  }, [turmas, curso?.title, curso?.nomeOferta, curso?.regime]);
  const locais = uniqueVals(doCurso, "local");
  // Turmas do local escolhido, pela data de início (com horário, preço, vagas e cronograma).
  const datas = useMemo(
    () => [...ofertaFiltrada(doCurso, { local })].sort((a, b) => a.dataInicio.localeCompare(b.dataInicio) || a.horario.localeCompare(b.horario)),
    [doCurso, local],
  );
  // Pré-inscrição num local registado sem turmas (ex.: Sala Virtual): fica o local, sem data de início.
  const localSemTurmas = preinscricao && ofertaEstado === "pronto" && Boolean(local) && !locais.includes(local);
  const precisaTurma = doCurso.length > 0 && !localSemTurmas;
  // Sem turmas com data (ou nesse local), o pedido começa nos dados.
  useEffect(() => {
    if (passo === "turma" && ofertaEstado !== "a-carregar" && !precisaTurma) setPasso("dados");
  }, [passo, ofertaEstado, precisaTurma]);
  // Um só local: fica escolhido. Um local vindo da página que não tem turmas: limpa-se (na pré-inscrição fica).
  useEffect(() => {
    if (ofertaEstado !== "pronto") return;
    if (locais.length === 1 && !local) setLocal(locais[0]!);
    else if (local && locais.length && !locais.includes(local) && !preinscricao) setLocal("");
  }, [ofertaEstado, locais, local, preinscricao]);
  const turma = doCurso.find(t => t.turmaId === turmaId) ?? null;
  const precoNumero = turma?.preco ?? curso?.precoDesde ?? null;
  // Sem turma escolhida, o preço do cabeçalho é o das datas do local (o mais baixo, se variam).
  const precosLocal = datas.map(t => t.preco).filter((n): n is number => n != null);
  const minLocal = precosLocal.length ? Math.min(...precosLocal) : null;
  const precoLabel = turma?.preco != null
    ? eur(turma.preco, true)
    : minLocal != null
      ? `${precosLocal.every(p => p === minLocal) ? "" : "A partir de "}${eur(minLocal, true)}`
      : precoNumero != null ? eur(precoNumero, true) : curso?.price || "Sob consulta";

  function escolherLocal(valor: string) {
    setLocal(valor);
    setHorario("");
    setDataInicio("");
    setTurmaId(0);
  }
  function escolherTurma(t: OfertaTurma) {
    if (vagasNumero(t) <= 0) return;
    setHorario(t.horario);
    setDataInicio(t.dataInicio);
    setTurmaId(t.turmaId);
    setErro("");
  }
  function continuarTurma() {
    if (precisaTurma && !turmaId) { setErro("Escolha a data de início da turma."); return; }
    setErro("");
    setPasso("dados");
  }

  function errosDoFin(d: InscricaoFin, telefone: string): ErrosForm {
    const e: ErrosForm = { ...validarInscricaoFin(d, hojeLisboa(), LISTA_PAISES) };
    const t = erroTelefoneFin(telefone);
    if (t) e.telf = t;
    if (!email.trim()) e.email = "Indique o email.";
    return e;
  }
  function mudarFin(d: InscricaoFin) {
    setDadosFin(d);
    // Depois da primeira tentativa, os erros acompanham o que se escreve.
    if (Object.keys(errosFin).length) setErrosFin(errosDoFin(d, telf));
  }

  function validarDados() {
    if (fin) {
      const e = errosDoFin(dadosFin, telf);
      setErrosFin(e);
      if (Object.keys(e).length) return "Corrija os campos assinalados.";
    } else if (!nome.trim() || !apelido.trim() || !telf.trim() || !email.trim() || !concelho || !origem) {
      return "Preencha nome, apelido, telemóvel, email, concelho e como tomou conhecimento.";
    }
    if (!consentimento) return "Para enviar, aceite a política de privacidade.";
    if (ofertaEstado === "a-carregar") return "A carregar as turmas libertadas.";
    if (ofertaEstado === "erro") return "Não foi possível carregar as turmas. Feche e volte a abrir o pedido.";
    if (precisaTurma && !turmaId) return "Escolha primeiro a data de início da turma.";
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
    if (falha) { setErro(falha); setPasso(precisaTurma && !turmaId ? "turma" : "dados"); return; }
    if (prepago) {
      const pagamento = falhaPagamento();
      if (pagamento) { setErro(pagamento); return; }
    }
    setBusy(true);
    setErro("");
    try {
      const nomes = fin ? partirNomeCompleto(dadosFin.nomeCompleto) : { nome: nome.trim(), apelido: apelido.trim() };
      const r = await apiPublicPreinscricao({
        nome: nomes.nome,
        apelido: nomes.apelido,
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
        consentimento,
        ...(fin ? { dadosFin } : {}),
      });
      setAviso(r.aviso);
      setPasso("feito");
    } catch (err) {
      if (fin && err instanceof ApiError && err.campos?.length) setErrosFin(errosDoServidor(err.campos));
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
  // Sem gateway de pagamento: o pagamento é pedido pela secretaria, por email, depois da pré-inscrição.
  const notaPagamento = /transfer/i.test(metodo)
    ? `O IBAN da transferência segue para ${email}.`
    : metodo
      ? `A ENA confirma consigo o pagamento por ${metodo}. Nada é cobrado neste ecrã.`
      : "";
  const pagamentoBloqueado = passo === "pagamento" && Boolean(falhaPagamento());
  const passos: [Passo, string][] = [
    ...(precisaTurma || ofertaEstado === "a-carregar" ? [["turma", "Local, data de início e horário"] as [Passo, string]] : []),
    ["dados", "Os seus dados"],
    ...(prepago ? [["pagamento", "Pagamento"] as [Passo, string]] : []),
  ];

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
        {passo !== "feito" && passos.length > 1 && (
          <ol className="grid border-b border-[#1C3350]/10 text-xs font-extrabold uppercase tracking-[0.08em]" style={{ gridTemplateColumns: `repeat(${passos.length}, minmax(0, 1fr))` }}>
            {passos.map(([id, rotulo], i) => (
              <li key={id} className={`px-5 py-3 sm:px-8 ${passo === id ? "bg-[#1C3350] text-white" : "text-[#1C3350]/45"}`}>{i + 1} · {rotulo}</li>
            ))}
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
          ) : passo === "turma" ? (
            <form id="inscricao-form" onSubmit={e => { e.preventDefault(); continuarTurma(); }} className="space-y-6">
              {ofertaEstado === "a-carregar" ? (
                <p className="text-sm text-[#1C3350]/60">A carregar as datas das turmas.</p>
              ) : ofertaEstado === "erro" ? (
                <p className="text-sm text-[#A60000]">Não foi possível carregar as turmas. Feche e volte a abrir o pedido.</p>
              ) : (
                <>
                  {/* O local escolhe-se na página do curso; aqui só aparece em resumo (com «Alterar»). */}
                  {local && !trocarLocal ? (
                    <p className="flex flex-wrap items-center gap-3 text-sm text-[#1C3350]">
                      <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#A60000]">Local</span>
                      <strong>{local}</strong>
                      {locais.length > 1 && <button type="button" onClick={() => setTrocarLocal(true)} className="font-bold text-[#A60000] underline">Alterar</button>}
                    </p>
                  ) : (
                    <fieldset>
                      <legend className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#A60000]">Local</legend>
                      <p className="mt-1 text-xs text-[#1C3350]/60">Selecione o local para ver as datas de início e os cronogramas.</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {locais.map(l => (
                          <button key={l} type="button" onClick={() => { escolherLocal(l); setTrocarLocal(false); }} aria-pressed={local === l}
                            className={`border px-4 py-2 text-sm font-bold ${local === l ? "border-[#1C3350] bg-[#1C3350] text-white" : "border-[#1C3350]/20 text-[#1C3350] hover:border-[#1C3350]"}`}>
                            {l}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  )}
                  <fieldset>
                    <legend className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#A60000]">Data de início e horário</legend>
                    {local && <p className="mt-1 text-xs text-[#1C3350]/60">Veja o cronograma, selecione a data pretendida e clique em Continuar.</p>}
                    {!local ? (
                      <p className="mt-3 text-sm text-[#1C3350]/60">Escolha o local para ver as datas de início.</p>
                    ) : (
                      <div className="mt-3 grid gap-2">
                        {datas.map(t => {
                          const vagas = vagasNumero(t);
                          const ativo = t.turmaId === turmaId;
                          return (
                            <div key={t.turmaId} className={`flex flex-wrap items-center gap-x-5 gap-y-3 border px-5 py-5 sm:min-h-[88px] ${ativo ? "border-[#1C3350] bg-[#1C3350] text-white" : "border-[#1C3350]/15"} ${vagas <= 0 ? "opacity-50" : ""}`}>
                              <button type="button" disabled={vagas <= 0} onClick={() => escolherTurma(t)} aria-pressed={ativo}
                                className="flex min-w-0 flex-1 flex-wrap items-center gap-x-5 gap-y-1.5 text-left disabled:cursor-not-allowed">
                                <strong className="text-lg">{fmtDataPt(t.dataInicio)}</strong>
                                <span className="text-sm opacity-80">{t.horario}</span>
                                {t.preco != null && <span className="text-base font-bold">{eur(t.preco, true)}</span>}
                                <span className="text-xs opacity-65">{vagasPublicas(t)}</span>
                              </button>
                              {/* O cronograma é o da turma (já traz o nome dela); só existe no site depois de publicado. */}
                              {t.cronogramaPublicado ? (
                                <a href={`/cronograma/${t.regime || "gold"}/${t.turmaId}`} target="_blank" rel="noreferrer"
                                  className={`inline-flex shrink-0 items-center gap-2 border px-4 py-2.5 text-xs font-extrabold uppercase tracking-[0.08em] ${ativo ? "border-white/40 text-white hover:bg-white hover:text-[#1C3350]" : "border-[#A60000] text-[#A60000] hover:bg-[#A60000] hover:text-white"}`}>
                                  Ver cronograma
                                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M14 4h6v6M20 4 10 14M18 14v6H4V6h6" /></svg>
                                </a>
                              ) : (
                                <span className="shrink-0 text-xs opacity-55">Cronograma em breve</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </fieldset>
                </>
              )}
            </form>
          ) : passo === "pagamento" ? (
            <form id="inscricao-form" onSubmit={e => void enviar(e)} className="space-y-6">
              <div className="bg-[#F4F6F8] px-4 py-4 text-sm leading-6 text-[#1C3350]/75">
                <p className="font-semibold text-[#1C3350]">{fin ? dadosFin.nomeCompleto : `${nome} ${apelido}`}</p>
                <p>{email} · {telf}</p>
                {!fin && <p>{concelho} · soube pela via {origem}</p>}
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
                {fin ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <CamposInscricaoFin valor={dadosFin} onMudar={mudarFin} erros={errosFin} />
                  <CampoFin id="fin-telf" rotulo="Número de telemóvel" erro={errosFin.telf}>
                    {p => <input {...p} className={INPUT_MODAL} value={telf} onChange={e => setTelf(e.target.value)} autoComplete="tel" inputMode="tel" required />}
                  </CampoFin>
                  <CampoFin id="fin-email" rotulo="Email" erro={errosFin.email}>
                    {p => <input {...p} className={INPUT_MODAL} type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required />}
                  </CampoFin>
                </div>
                ) : (
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
                )}
              </div>
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#A60000]">Turma</p>
                {turma ? (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 bg-[#F4F6F8] px-4 py-3 text-sm text-[#1C3350]">
                    <span><strong>{fmtDataPt(turma.dataInicio)}</strong> · {turma.local} · {turma.horario}{turma.preco != null ? ` · ${eur(turma.preco, true)}` : ""}</span>
                    <button type="button" onClick={() => setPasso("turma")} className="text-sm font-bold text-[#A60000] underline">Alterar</button>
                  </div>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-[#1C3350]/65">
                    {prepago
                      ? "Não há turma com data marcada. O pedido segue em acesso imediato, online, e o pagamento fica no passo seguinte."
                      : "Ainda não há turma com data. O pedido fica registado na mesma e a secretaria confirma a turma. O email automático sai ao inscrever."}
                  </p>
                )}
                <ConsentimentoRgpd aceite={consentimento} onMudar={setConsentimento} className="mt-5" />
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
          {passo === "dados" && doCurso.length > 0 && (
            <button type="button" onClick={() => { setErro(""); setPasso("turma"); }} className="px-5 py-3 text-sm font-bold text-[#1C3350]/70">Voltar à data</button>
          )}
          {passo === "feito" ? (
            <button type="button" onClick={onClose} className="bg-[#1C3350] px-6 py-3 text-sm font-extrabold uppercase tracking-[0.08em] text-white">Fechar</button>
          ) : (
            <button type="submit" form="inscricao-form" disabled={busy || pagamentoBloqueado} className="bg-[#A60000] px-6 py-3 text-sm font-extrabold uppercase tracking-[0.08em] text-white hover:bg-[#8B0000] disabled:opacity-40">
              {busy ? "A enviar…" : passo === "turma" ? "Continuar para os dados" : passo === "pagamento" ? "Confirmar pedido" : prepago ? "Continuar para o pagamento" : "Inscrever-me"}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

/** Vagas que o site mostra (as anunciadas pelo comercial, nunca acima das livres). */
function vagasNumero(t: OfertaTurma) {
  return t.vagasMostradas ?? t.vagasLivres;
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
