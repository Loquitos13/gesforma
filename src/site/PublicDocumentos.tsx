import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ApiError, apiPublicConcluirPercurso, apiPublicConsentir, apiPublicDocumentoUpload, apiPublicDocumentos, apiPublicEscolherTurma,
  type PagamentoPercurso, type TurmaPercurso,
} from "../partilhado/api";
import { LeituraConsentimento } from "./LeituraConsentimento";
import { PassoPagamento } from "./PassoPagamento";
import { CampoFicheiro, CartaoTurma, textoTurmas } from "./PercursoPartes";
import { fmtDataCalendario as fmtData } from "../partilhado/horaLisboa";

type TipoDoc = { id: string; label: string; required?: boolean; modelo?: string };
type Ficheiro = { id: number; tipo: string; nome: string; estado?: string; observacao?: string };

const PASSOS = ["Documentos", "Cronograma"] as const;

function passoPedido(): 1 | 2 | null {
  const passo = new URLSearchParams(window.location.search).get("passo");
  if (passo === "documentos") return 1;
  if (passo === "cronograma") return 2;
  return null;
}

const TITULO_FECHO: Record<string, string> = {
  validada: "Pré-inscrição validada",
  formando: "Inscrição concluída",
  desistiu: "Pré-inscrição cancelada",
  expirada: "Ligação expirada",
};

export function PublicDocumentos({ token }: { token: string }) {
  const [nome, setNome] = useState("");
  const [curso, setCurso] = useState("");
  const [tipos, setTipos] = useState<TipoDoc[]>([]);
  const [ficheiros, setFicheiros] = useState<Ficheiro[]>([]);
  const [estado, setEstado] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [passoServidor, setPassoServidor] = useState<1 | 2>(1);
  const [passo, setPasso] = useState<1 | 2>(1);
  const [turmas, setTurmas] = useState<TurmaPercurso[]>([]);
  const [recomendadas, setRecomendadas] = useState<TurmaPercurso[]>([]);
  const [breves, setBreves] = useState<TurmaPercurso[]>([]);
  const [turmaEscolhida, setTurmaEscolhida] = useState<TurmaPercurso | null>(null);
  const [percursoConcluido, setPercursoConcluido] = useState(false);
  const [emFalta, setEmFalta] = useState<string[]>([]);
  const [turmaCheia, setTurmaCheia] = useState(false);
  const [encerrada, setEncerrada] = useState(false);
  const [fecho, setFecho] = useState<{ motivo: string; mensagem: string }>({ motivo: "", mensagem: "" });
  const [escolheTurma, setEscolheTurma] = useState(true);
  // O passo do cronograma só aparece sem turma escolhida: a turma escolhe-se no site; aqui só volta
  // quando a secretaria a dá como cheia (fica sem turma e com as turmas recomendadas).
  const [pedeCronograma, setPedeCronograma] = useState(true);
  /** Passo de pagamento: só com o pagamento pedido pela secretaria e ainda por confirmar. */
  const [pagamento, setPagamento] = useState<PagamentoPercurso | null>(null);
  const [correcao, setCorrecao] = useState(false);
  const [foco, setFoco] = useState<string | null>(null);
  const [ficheiro, setFicheiro] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [criterios, setCriterios] = useState<{ local: string; horario: string; inicio: string }>({ local: "", horario: "", inicio: "" });
  const [direccao, setDireccao] = useState<"frente" | "tras">("frente");
  const [aSair, setASair] = useState(false);
  const salto = useRef<number | null>(null);

  function aplicar(r: Awaited<ReturnType<typeof apiPublicDocumentos>>, manterPasso = false) {
    if (r.encerrada) {
      // Ligação encerrada: o servidor só devolve o primeiro nome, o curso e o motivo.
      setEncerrada(true);
      setNome(r.primeiroNome ?? "");
      setCurso(r.curso ?? "");
      setFecho({ motivo: r.motivo ?? "", mensagem: r.mensagem ?? "" });
      setEstado("ready");
      return;
    }
    setNome(r.nome);
    setCurso(r.curso);
    setTipos(r.tipos ?? []);
    setFicheiros(r.ficheiros ?? []);
    setEncerrada(false);
    const escolhe = r.escolheTurma !== false;
    setEscolheTurma(escolhe);
    // Fixo enquanto a pessoa está no percurso: escolher a turma no passo 2 não esconde o passo.
    const comTurma = manterPasso ? pedeCronograma : escolhe && (!r.turmaEscolhida || Boolean(r.turmaCheia));
    if (!manterPasso) setPedeCronograma(comTurma);
    setPagamento(r.precisaPagamento && r.pagamento ? r.pagamento : null);
    setCorrecao(Boolean(r.correcao));
    setTurmas(r.turmas ?? []);
    setRecomendadas(r.recomendadas ?? []);
    setBreves(r.breves ?? []);
    setTurmaEscolhida(r.turmaEscolhida ?? null);
    setCriterios(r.criterios ?? { local: "", horario: "", inicio: "" });
    setPercursoConcluido(Boolean(r.percursoConcluido));
    const falta = r.emFalta ?? [];
    setEmFalta(falta);
    setTurmaCheia(Boolean(r.turmaCheia));
    const seguinte: 1 | 2 = comTurma && r.turmaEscolhida ? 2 : 1;
    setPassoServidor(seguinte);
    if (!comTurma) setPasso(1);
    else if (!manterPasso) {
      const pedido = passoPedido();
      if (pedido) setPasso(pedido);
      else setPasso(r.percursoConcluido && falta.length > 0 && !r.encerrada ? 1 : seguinte);
    }
    setEstado("ready");
  }

  function recarregar(manterPasso = false) {
    return apiPublicDocumentos(token)
      .then(r => aplicar(r, manterPasso))
      .catch(err => {
        setEstado(err instanceof ApiError && err.status === 404 ? "missing" : "error");
      });
  }

  function irPara(n: 1 | 2) {
    if (n === passo || aSair) return;
    setDireccao(n > passo ? "frente" : "tras");
    setError("");
    setOk("");
    setFicheiro(null);
    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduzir) {
      setPasso(n);
      return;
    }
    setASair(true);
    if (salto.current) window.clearTimeout(salto.current);
    salto.current = window.setTimeout(() => {
      setPasso(n);
      setASair(false);
      salto.current = null;
    }, 240);
  }

  /** A ligação fechou entretanto (410): volta a ler para mostrar o motivo. */
  function erroDe(err: unknown, padrao: string) {
    if (err instanceof ApiError && err.status === 410) { void recarregar(); return ""; }
    return err instanceof ApiError ? err.message : padrao;
  }

  useEffect(() => () => { if (salto.current) window.clearTimeout(salto.current); }, []);

  useEffect(() => { void recarregar(); }, [token]);

  const porTipo = useMemo(() => {
    const map = new Map<string, Ficheiro>();
    for (const f of ficheiros) map.set(f.tipo, f);
    return map;
  }, [ficheiros]);

  function aceite(id: string) {
    const f = porTipo.get(id);
    return Boolean(f) && f?.estado !== "recusado";
  }
  const obrigatorios = tipos.filter(t => t.required);
  const opcionais = tipos.filter(t => !t.required);
  const feitosObrigatorios = obrigatorios.filter(t => aceite(t.id)).length;
  const feitosOpcionais = opcionais.filter(t => aceite(t.id)).length;
  const docsProntos = obrigatorios.length === 0 || obrigatorios.every(t => aceite(t.id));
  const percentagemDocs = tipos.length ? Math.round((tipos.filter(t => aceite(t.id)).length / tipos.length) * 100) : 0;
  const percentagemPasso = aSair ? (direccao === "frente" ? 100 : 50) : passo === 1 ? 50 : 100;
  const proximo = tipos.find(t => t.required && !aceite(t.id)) ?? tipos.find(t => !aceite(t.id));
  const activoId = foco && tipos.some(t => t.id === foco) ? foco : proximo?.id ?? null;

  async function enviar(tipo: string, etiqueta: string, e: FormEvent) {
    e.preventDefault();
    if (!ficheiro) { setError("Escolha o ficheiro."); return; }
    setBusy(true);
    setError("");
    setOk("");
    try {
      const r = await apiPublicDocumentoUpload(token, ficheiro, tipo);
      setOk(`${etiqueta} ficou na ficha (${r.nome}).`);
      setFicheiro(null);
      setFoco(null);
      await recarregar(true);
    } catch (err) {
      setError(erroDe(err, "Não foi possível enviar."));
    } finally {
      setBusy(false);
    }
  }

  async function consentir(tipo: string, etiqueta: string) {
    setBusy(true);
    setError("");
    setOk("");
    try {
      await apiPublicConsentir(token, tipo);
      setOk(`Consentimento de ${etiqueta} registado.`);
      setFoco(null);
      await recarregar(true);
    } catch (err) {
      setError(erroDe(err, "Não foi possível registar o consentimento."));
    } finally {
      setBusy(false);
    }
  }

  async function escolher(turmaId: number) {
    setBusy(true);
    setError("");
    try {
      await apiPublicEscolherTurma(token, turmaId);
      const r = await apiPublicDocumentos(token);
      aplicar(r);
      setPasso(2);
      setOk("Cronograma escolhido.");
    } catch (err) {
      setError(erroDe(err, "Não foi possível escolher a turma."));
    } finally {
      setBusy(false);
    }
  }

  async function concluir() {
    setBusy(true);
    setError("");
    try {
      await apiPublicConcluirPercurso(token);
      await recarregar();
    } catch (err) {
      setError(erroDe(err, "Não foi possível concluir."));
    } finally {
      setBusy(false);
    }
  }

  async function enviarComprovativo(f: File) {
    setBusy(true);
    setError("");
    setOk("");
    try {
      await apiPublicDocumentoUpload(token, f, "comprovativo");
      setOk("Comprovativo recebido.");
      await recarregar(true);
    } catch (err) {
      setError(erroDe(err, "Não foi possível enviar o comprovativo."));
    } finally {
      setBusy(false);
    }
  }

  const pagar = estado === "ready" && !encerrada && pagamento != null;
  const espera = estado === "ready" && percursoConcluido && !encerrada && emFalta.length === 0 && !pagar;

  return (
    <div className="min-h-screen bg-[#f4f1ea] text-[#1b2330]">
      <header className="bg-white border-b border-[#e7e1d6]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <img
            src="/imagens/ena-logo-nobg.png"
            alt="ENA, Escola de Negócios e Administração"
            className="h-9 w-auto"
            onError={e => { (e.currentTarget as HTMLImageElement).src = "/imagens/ena_logo.svg"; }}
          />
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a8172]">Pré-inscrição</p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-0 sm:py-12">
        {estado === "loading" && <p className="text-sm text-[#5c564c]">A abrir o percurso de pré-inscrição…</p>}
        {estado === "missing" && (
          <article className="rounded-2xl bg-white px-6 py-8 shadow-sm ring-1 ring-[#e7e1d6]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#c48400]">Ligação inválida</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">Este convite já não está disponível.</h1>
            <p className="mt-3 text-sm leading-relaxed text-[#5c564c]">Peça uma nova ligação à secretaria da ENA.</p>
          </article>
        )}
        {estado === "error" && <p className="text-sm text-[#5c564c]">Não foi possível abrir a página. Tente dentro de momentos.</p>}

        {estado === "ready" && encerrada && (
          <article className="rounded-2xl bg-white px-6 py-8 shadow-sm ring-1 ring-[#e7e1d6]">
            <p className={`text-[12px] font-semibold uppercase tracking-[0.16em] ${fecho.motivo === "validada" || fecho.motivo === "formando" ? "text-emerald-700" : "text-[#c48400]"}`}>
              {TITULO_FECHO[fecho.motivo] ?? "Ligação encerrada"}
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">{nome ? `Olá, ${nome}` : curso}</h1>
            {nome && curso && <p className="mt-2 text-sm text-[#5c564c]">{curso}</p>}
            <p className="mt-3 text-sm leading-relaxed text-[#5c564c]">{fecho.mensagem || "Esta ligação foi encerrada."}</p>
          </article>
        )}

        {pagar && pagamento && (
          <PassoPagamento nome={nome} curso={curso} pagamento={pagamento} busy={busy} error={error} ok={ok} onEnviar={enviarComprovativo} />
        )}

        {espera && (
          <article className="rounded-2xl bg-white px-6 py-8 shadow-sm ring-1 ring-[#e7e1d6]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#c48400]">Processo de pré-inscrição concluído</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">{nome}</h1>
            <p className="mt-3 text-sm leading-relaxed text-[#5c564c]">
              {escolheTurma
                ? <>Os documentos e o cronograma de {curso} já estão na ficha. A secretaria vai validar a pré-inscrição. Esta página fica aberta até essa validação.</>
                : <>Os documentos de {curso} já estão na ficha. A secretaria vai validá-los e colocá-lo(a) numa turma. Esta página fica aberta até essa validação.</>}
            </p>
            {turmaEscolhida && (
              <div className="mt-5 rounded-xl bg-[#fffaf2] px-4 py-3 text-sm ring-1 ring-[#efeae1]">
                <p className="font-semibold">{[turmaEscolhida.local, turmaEscolhida.horario].filter(Boolean).join(" · ")}</p>
                <p className="mt-1 text-[#5c564c]">Início {fmtData(turmaEscolhida.dataInicio)}</p>
              </div>
            )}
            <p className="mt-5 text-sm font-semibold text-amber-800">Aguarda a validação da secretaria.</p>
          </article>
        )}

        {estado === "ready" && !encerrada && !espera && !pagar && (
          <article className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#e7e1d6]">
            <div className="px-6 pt-7 pb-5 sm:px-8">
              <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#c48400]">Percurso de pré-inscrição</p>
              <h1 className="mt-2 text-[1.65rem] font-semibold tracking-tight leading-tight">{nome}</h1>
              <p className="mt-2 text-sm leading-relaxed text-[#5c564c]">{curso}</p>
              {pedeCronograma && <ol className="mt-5 grid grid-cols-2 gap-2">
                {PASSOS.map((label, i) => {
                  const n = (i + 1) as 1 | 2;
                  const aberto = passo === n;
                  const feito = (n === 1 && docsProntos && passo > 1) || (n === 2 && Boolean(turmaEscolhida));
                  const pode = n === 1 || n === 2;
                  return (
                    <li key={label}>
                      <button
                        type="button"
                        disabled={!pode || aberto || aSair}
                        onClick={() => irPara(n)}
                        className={`w-full rounded-xl px-2 py-2 text-left text-xs transition-colors duration-300 ${aberto ? "bg-[#1b2330] text-white" : feito ? "bg-emerald-50 text-emerald-900" : "bg-[#efeae1] text-[#8a8172]"} disabled:cursor-default`}
                      >
                        <span className="block font-bold">{n}</span>
                        {label}
                      </button>
                    </li>
                  );
                })}
              </ol>}
              {pedeCronograma && (
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-[#efeae1]" aria-hidden>
                  <div
                    className="h-full rounded-full bg-[#ffa900] transition-[width] duration-500 ease-out"
                    style={{ width: `${percentagemPasso}%` }}
                  />
                </div>
              )}
              {!escolheTurma && (
                <p className="mt-3 text-sm leading-relaxed text-[#5c564c]">Envie os documentos abaixo. Depois da validação, a secretaria coloca-o(a) na turma e avisa por email.</p>
              )}
              {escolheTurma && !pedeCronograma && turmaEscolhida && (
                <div className="mt-4 rounded-xl bg-[#fffaf2] px-4 py-3 text-sm ring-1 ring-[#efeae1]">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#8a8172]">Turma escolhida</p>
                  <p className="mt-1 font-semibold">{[turmaEscolhida.local, turmaEscolhida.horario].filter(Boolean).join(" · ")}</p>
                  <p className="mt-1 text-[#5c564c]">Início {fmtData(turmaEscolhida.dataInicio)}. Envie os documentos abaixo e submeta a inscrição.</p>
                </div>
              )}
              {correcao && <p className="mt-4 text-sm text-red-800">Há ficheiros por corrigir. Volte a enviar os que a secretaria indicou.</p>}
              {percursoConcluido && emFalta.length > 0 && (
                <p className="mt-4 text-sm leading-relaxed text-amber-900">
                  A pré-inscrição ficou pendente de validação. Ainda faltam: {emFalta.join(", ")}. Recebeu um email com esta lista. Esta ligação só fecha quando a secretaria validar todos os documentos.
                </p>
              )}
            </div>

            <div className={aSair ? (direccao === "frente" ? "percurso-sair-frente" : "percurso-sair-tras") : (direccao === "frente" ? "percurso-entrar-frente" : "percurso-entrar-tras")}>
            {passo === 1 && (
              <section className="border-t border-[#efeae1]">
                <div className="px-6 py-4 sm:px-8">
                  <div className="flex items-baseline justify-between gap-3 text-xs">
                    <span className="font-semibold">{feitosObrigatorios} de {obrigatorios.length} obrigatórios{opcionais.length > 0 ? ` · ${feitosOpcionais} de ${opcionais.length} opcionais` : ""}</span>
                    {pedeCronograma && <span className="text-[#8a8172]">Passo 1 de 2</span>}
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#efeae1]">
                    <div
                      className="h-full rounded-full bg-[#ffa900] transition-[width] duration-700 ease-out"
                      style={{ width: `${percentagemDocs}%` }}
                    />
                  </div>
                  {docsProntos && opcionais.some(t => !aceite(t.id)) && (
                    <p className="mt-2 text-xs leading-relaxed text-[#5c564c]">Os obrigatórios já estão na ficha. Os opcionais continuam aqui. Avance só quando quiser.</p>
                  )}
                  {!docsProntos && (
                    <p className="mt-2 text-xs leading-relaxed text-[#5c564c]">Pode submeter a inscrição sem todos os documentos. Se faltar algum, recebe um email com a lista e o botão para voltar a este passo. Se estiverem todos, esse email não sai.</p>
                  )}
                </div>
                <ol className="divide-y divide-[#efeae1] border-t border-[#efeae1]">
                  {tipos.map(t => {
                    const anexo = porTipo.get(t.id);
                    const recusado = anexo?.estado === "recusado";
                    const aberto = t.id === activoId;
                    return (
                      <li key={t.id} className={aberto ? "bg-[#fffaf2]" : "bg-white"}>
                        <div className="px-6 py-4 sm:px-8">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <p className="text-sm font-semibold">{t.label}</p>
                            <span className="text-[11px] uppercase tracking-wide text-[#8a8172]">{recusado ? "A corrigir" : t.required ? "Obrigatório" : "Opcional"}</span>
                          </div>
                          {anexo && !recusado && <p className="mt-1 truncate text-sm text-emerald-800">{anexo.nome}</p>}
                          {recusado && anexo?.observacao && <p className="mt-1 text-sm text-red-800">{anexo.observacao}</p>}
                          {anexo && !aberto && (
                            <button type="button" className="mt-2 text-xs font-semibold underline decoration-[#ffa900] underline-offset-2" onClick={() => { setFoco(t.id); setFicheiro(null); setError(""); }}>
                              Substituir
                            </button>
                          )}
                        </div>
                        {aberto && t.modelo && (
                          <LeituraConsentimento
                            token={token}
                            tipo={t.id}
                            label={t.label}
                            busy={busy}
                            onAceite={() => void consentir(t.id, t.label)}
                          />
                        )}
                        {aberto && !t.modelo && (
                          <form onSubmit={e => void enviar(t.id, t.label, e)} className="px-6 pb-5 sm:px-8">
                            <CampoFicheiro onFile={setFicheiro} />
                            {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
                            <button type="submit" disabled={busy || !ficheiro} className="mt-4 w-full rounded-lg bg-[#ffa900] px-4 py-3 text-sm font-semibold text-[#1b2330] disabled:opacity-40 sm:w-auto">
                              {busy ? "A anexar…" : anexo ? `Substituir ${t.label}` : `Anexar ${t.label}`}
                            </button>
                          </form>
                        )}
                      </li>
                    );
                  })}
                </ol>
                <div className="border-t border-[#efeae1] px-6 py-4 sm:px-8">
                  {ok && <p className="mb-3 text-sm text-emerald-800">{ok}</p>}
                  {pedeCronograma ? (
                    <button type="button" disabled={aSair} onClick={() => irPara(2)} className="w-full rounded-lg bg-[#1b2330] px-4 py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-40">
                      {aSair && direccao === "frente" ? "A avançar…" : "Continuar para o cronograma"}
                    </button>
                  ) : (
                    <>
                      {error && !activoId && <p className="mb-3 text-sm text-red-700">{error}</p>}
                      <button type="button" disabled={busy} onClick={() => void concluir()} className="w-full rounded-lg bg-[#1b2330] px-4 py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-40">
                        {busy ? "A submeter…" : "Submeter inscrição"}
                      </button>
                    </>
                  )}
                </div>
              </section>
            )}

            {passo === 2 && pedeCronograma && (
              <section className="border-t border-[#efeae1] px-6 py-5 sm:px-8">
                <p className="text-sm text-[#5c564c]">{textoTurmas(criterios)}</p>
                {turmaCheia && (
                  <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950">A turma anterior foi dada como cheia pela secretaria e já não pode ser escolhida. Seleccione outra.</p>
                )}
                {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
                {turmas.length === 0 && (
                  <p className="mt-4 rounded-xl bg-[#fffaf2] px-4 py-3 text-sm text-[#5c564c]">Não há turma com lugar livre para estes requisitos. Volte mais tarde ou fale com a secretaria.</p>
                )}
                <ul className="mt-4 space-y-4">
                  {turmas.map(t => (
                    <CartaoTurma key={t.id} turma={t} curso={curso} escolhida={turmaEscolhida?.id === t.id} busy={busy} onEscolher={() => void escolher(t.id)} />
                  ))}
                </ul>
                {recomendadas.length > 0 && (
                  <div className="mt-6">
                    <p className="text-sm font-semibold text-[#1b2330]">Noutro horário, no mesmo local</p>
                    <p className="mt-1 text-sm text-[#5c564c]">
                      {criterios.local ? `Também há turma de ${curso} em ${criterios.local}, com outro horário.` : "Também há turma deste curso no mesmo local, com outro horário."}
                    </p>
                    <ul className="mt-3 space-y-4">
                      {recomendadas.map(t => (
                        <CartaoTurma key={t.id} turma={t} curso={curso} escolhida={turmaEscolhida?.id === t.id} busy={busy} onEscolher={() => void escolher(t.id)} />
                      ))}
                    </ul>
                  </div>
                )}
                {breves.length > 0 && (
                  <div className="mt-6">
                    <p className="text-sm font-semibold text-[#1b2330]">Turma para breve</p>
                    <p className="mt-1 text-sm text-[#5c564c]">
                      O mesmo curso, o mesmo local e o mesmo horário, com uma data de início mais à frente.
                    </p>
                    <ul className="mt-3 space-y-4">
                      {breves.map(t => (
                        <CartaoTurma key={t.id} turma={t} curso={curso} escolhida={turmaEscolhida?.id === t.id} busy={busy} onEscolher={() => void escolher(t.id)} />
                      ))}
                    </ul>
                  </div>
                )}
                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  <button type="button" disabled={aSair} onClick={() => irPara(1)} className="rounded-lg border border-[#e7e1d6] px-4 py-3 text-sm font-semibold disabled:opacity-40">
                    {aSair && direccao === "tras" ? "A voltar…" : "Voltar"}
                  </button>
                  <button type="button" disabled={busy || !turmaEscolhida || aSair} onClick={() => void concluir()} className="rounded-lg bg-[#1b2330] px-4 py-3 text-sm font-semibold text-white disabled:opacity-40 sm:flex-1">
                    {busy ? "A submeter…" : "Submeter inscrição"}
                  </button>
                </div>
              </section>
            )}
            </div>
          </article>
        )}
      </main>
    </div>
  );
}
