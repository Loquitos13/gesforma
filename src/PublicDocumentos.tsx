import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ApiError, apiPublicConcluirPercurso, apiPublicConsentir, apiPublicDocumentoUpload, apiPublicDocumentos, apiPublicEscolherTurma,
  type TurmaPercurso,
} from "./api";
import { CronogramaFolha } from "./CronogramaFolha";
import { LeituraConsentimento } from "./LeituraConsentimento";

type TipoDoc = { id: string; label: string; required?: boolean; modelo?: string };
type Ficheiro = { id: number; tipo: string; nome: string; estado?: string; observacao?: string };

function fmtData(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

const PASSOS = ["Documentos", "Cronograma", "Pagamento"] as const;

function textoVagas(n: number) {
  if (n <= 0) return "Sem vagas restantes";
  return n === 1 ? "1 vaga restante" : `${n} vagas restantes`;
}

export function PublicDocumentos({ token }: { token: string }) {
  const [nome, setNome] = useState("");
  const [curso, setCurso] = useState("");
  const [tipos, setTipos] = useState<TipoDoc[]>([]);
  const [ficheiros, setFicheiros] = useState<Ficheiro[]>([]);
  const [estado, setEstado] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [passoServidor, setPassoServidor] = useState<1 | 2 | 3>(1);
  const [passo, setPasso] = useState<1 | 2 | 3>(1);
  const [turmas, setTurmas] = useState<TurmaPercurso[]>([]);
  const [recomendadas, setRecomendadas] = useState<TurmaPercurso[]>([]);
  const [turmaEscolhida, setTurmaEscolhida] = useState<TurmaPercurso | null>(null);
  const [percursoConcluido, setPercursoConcluido] = useState(false);
  const [encerrada, setEncerrada] = useState(false);
  const [correcao, setCorrecao] = useState(false);
  const [precisaPagamento, setPrecisaPagamento] = useState(false);
  const [pagamento, setPagamento] = useState<{ entidade: string; referencia: string; valor: number; estado: string } | null>(null);
  const [foco, setFoco] = useState<string | null>(null);
  const [ficheiro, setFicheiro] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [criterios, setCriterios] = useState<{ local: string; horario: string; inicio: string }>({ local: "", horario: "", inicio: "" });

  function aplicar(r: Awaited<ReturnType<typeof apiPublicDocumentos>>) {
    setNome(r.nome);
    setCurso(r.curso);
    setTipos(r.tipos);
    setFicheiros(r.ficheiros);
    setPrecisaPagamento(Boolean(r.precisaPagamento));
    setPagamento(r.pagamento ?? null);
    setEncerrada(Boolean(r.encerrada));
    setCorrecao(Boolean(r.correcao));
    setTurmas(r.turmas ?? []);
    setRecomendadas(r.recomendadas ?? []);
    setTurmaEscolhida(r.turmaEscolhida ?? null);
    setCriterios(r.criterios ?? { local: "", horario: "", inicio: "" });
    setPercursoConcluido(Boolean(r.percursoConcluido));
    const seguinte = r.passo === 2 || r.passo === 3 ? r.passo : 1;
    setPassoServidor(seguinte);
    setPasso(seguinte);
    setEstado("ready");
  }

  function recarregar() {
    return apiPublicDocumentos(token)
      .then(aplicar)
      .catch(err => {
        setEstado(err instanceof ApiError && err.status === 404 ? "missing" : "error");
      });
  }

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
  const feitosObrigatorios = obrigatorios.filter(t => aceite(t.id)).length;
  const docsProntos = obrigatorios.length === 0 || obrigatorios.every(t => aceite(t.id));
  const comprovativo = porTipo.get("comprovativo");
  const pagamentoPronto = !precisaPagamento || (Boolean(comprovativo) && comprovativo?.estado !== "recusado");
  const proximo = tipos.find(t => t.required && !aceite(t.id)) ?? tipos.find(t => !aceite(t.id));
  const activoId = passo === 3
    ? "comprovativo"
    : (foco && tipos.some(t => t.id === foco) ? foco : proximo?.id ?? null);

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
      await recarregar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível enviar.");
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
      await recarregar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível registar o consentimento.");
    } finally {
      setBusy(false);
    }
  }

  async function escolher(turmaId: number) {
    setBusy(true);
    setError("");
    try {
      await apiPublicEscolherTurma(token, turmaId);
      setOk("Cronograma escolhido.");
      await recarregar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível escolher a turma.");
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
      setError(err instanceof ApiError ? err.message : "Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  }

  const espera = estado === "ready" && percursoConcluido && !encerrada;

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
            <p className="mt-3 text-sm leading-relaxed text-[#5c564c]">Peça uma nova ligação à secretaria, em formacao@ena.pt.</p>
          </article>
        )}
        {estado === "error" && <p className="text-sm text-[#5c564c]">Não foi possível abrir a página. Tente dentro de momentos.</p>}

        {estado === "ready" && encerrada && (
          <article className="rounded-2xl bg-white px-6 py-8 shadow-sm ring-1 ring-[#e7e1d6]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Pré-inscrição validada</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">{nome}</h1>
            <p className="mt-3 text-sm leading-relaxed text-[#5c564c]">A secretaria validou {curso}. Esta ligação foi encerrada.</p>
          </article>
        )}

        {espera && (
          <article className="rounded-2xl bg-white px-6 py-8 shadow-sm ring-1 ring-[#e7e1d6]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#c48400]">Processo de pré-inscrição concluído</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">{nome}</h1>
            <p className="mt-3 text-sm leading-relaxed text-[#5c564c]">
              Os documentos, o cronograma e o pagamento de {curso} já estão na ficha. A secretaria vai validar a pré-inscrição. Esta página fica aberta até essa validação.
            </p>
            {turmaEscolhida && (
              <div className="mt-5 rounded-xl bg-[#fffaf2] px-4 py-3 text-sm ring-1 ring-[#efeae1]">
                <p className="font-semibold">{turmaEscolhida.nome}</p>
                <p className="mt-1 text-[#5c564c]">{turmaEscolhida.local} · {turmaEscolhida.horario} · início {fmtData(turmaEscolhida.dataInicio)}</p>
              </div>
            )}
            <p className="mt-5 text-sm font-semibold text-amber-800">Aguarda a validação da secretaria.</p>
          </article>
        )}

        {estado === "ready" && !encerrada && !espera && (
          <article className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#e7e1d6]">
            <div className="px-6 pt-7 pb-5 sm:px-8">
              <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#c48400]">Percurso de pré-inscrição</p>
              <h1 className="mt-2 text-[1.65rem] font-semibold tracking-tight leading-tight">{nome}</h1>
              <p className="mt-2 text-sm leading-relaxed text-[#5c564c]">{curso}</p>
              <ol className="mt-5 grid grid-cols-3 gap-2">
                {PASSOS.map((label, i) => {
                  const n = (i + 1) as 1 | 2 | 3;
                  const aberto = passo === n;
                  const feito = passoServidor > n || (n === 1 && docsProntos && passo > 1) || (n === 2 && Boolean(turmaEscolhida) && passo > 2);
                  const pode = n <= passoServidor || (n === 1 && docsProntos) || (n === 2 && docsProntos);
                  return (
                    <li key={label}>
                      <button
                        type="button"
                        disabled={!pode || aberto}
                        onClick={() => { setPasso(n); setError(""); setOk(""); setFicheiro(null); }}
                        className={`w-full rounded-xl px-2 py-2 text-left text-xs ${aberto ? "bg-[#1b2330] text-white" : feito ? "bg-emerald-50 text-emerald-900" : "bg-[#efeae1] text-[#8a8172]"} disabled:cursor-default`}
                      >
                        <span className="block font-bold">{n}</span>
                        {label}
                      </button>
                    </li>
                  );
                })}
              </ol>
              {correcao && <p className="mt-4 text-sm text-red-800">Há ficheiros por corrigir. Volte a enviar os que a secretaria indicou.</p>}
            </div>

            {passo === 1 && (
              <section className="border-t border-[#efeae1]">
                <div className="px-6 py-4 sm:px-8">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-semibold">{feitosObrigatorios} de {obrigatorios.length} obrigatórios</span>
                    <span className="text-[#8a8172]">Passo 1 de 3</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#efeae1]">
                    <div className="h-full rounded-full bg-[#ffa900]" style={{ width: `${obrigatorios.length ? Math.round((feitosObrigatorios / obrigatorios.length) * 100) : 0}%` }} />
                  </div>
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
                  <button type="button" disabled={!docsProntos} onClick={() => { setPasso(2); setError(""); setOk(""); }} className="w-full rounded-lg bg-[#1b2330] px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">
                    Continuar para o cronograma
                  </button>
                </div>
              </section>
            )}

            {passo === 2 && (
              <section className="border-t border-[#efeae1] px-6 py-5 sm:px-8">
                <p className="text-sm text-[#5c564c]">{textoTurmas(criterios)}</p>
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
                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  <button type="button" onClick={() => setPasso(1)} className="rounded-lg border border-[#e7e1d6] px-4 py-3 text-sm font-semibold">Voltar</button>
                  <button type="button" disabled={!turmaEscolhida} onClick={() => setPasso(3)} className="rounded-lg bg-[#1b2330] px-4 py-3 text-sm font-semibold text-white disabled:opacity-40 sm:flex-1">
                    Continuar para o pagamento
                  </button>
                </div>
              </section>
            )}

            {passo === 3 && (
              <section className="border-t border-[#efeae1] px-6 py-5 sm:px-8">
                {precisaPagamento ? (
                  <>
                    <p className="text-sm text-[#5c564c]">Pague e anexe o comprovativo. Sem esse ficheiro o processo não fica concluído.</p>
                    {pagamento && (
                      <div className="mt-4 rounded-xl bg-[#1b2330] px-5 py-4 text-white">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ffa900]">Referência Multibanco</p>
                        <dl className="mt-3 space-y-1.5 font-mono text-sm">
                          <div className="flex justify-between gap-4"><dt className="font-sans text-white/60">Entidade</dt><dd>{pagamento.entidade || "no email"}</dd></div>
                          <div className="flex justify-between gap-4"><dt className="font-sans text-white/60">Referência</dt><dd className="font-bold tracking-wide">{pagamento.referencia}</dd></div>
                          <div className="flex justify-between gap-4"><dt className="font-sans text-white/60">Valor</dt><dd>€ {pagamento.valor.toFixed(2)}</dd></div>
                        </dl>
                      </div>
                    )}
                    {!pagamento && <p className="mt-4 text-sm text-[#5c564c]">A referência chega por email. Pode anexar o comprovativo na mesma.</p>}
                    {comprovativo && comprovativo.estado !== "recusado" && <p className="mt-3 text-sm text-emerald-800">{comprovativo.nome}</p>}
                    {comprovativo?.estado === "recusado" && comprovativo.observacao && <p className="mt-3 text-sm text-red-800">{comprovativo.observacao}</p>}
                    <form onSubmit={e => void enviar("comprovativo", "Comprovativo de pagamento", e)} className="mt-4">
                      <CampoFicheiro onFile={setFicheiro} />
                      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
                      <button type="submit" disabled={busy || !ficheiro} className="mt-4 w-full rounded-lg bg-[#ffa900] px-4 py-3 text-sm font-semibold text-[#1b2330] disabled:opacity-40 sm:w-auto">
                        {busy ? "A anexar…" : comprovativo ? "Substituir comprovativo" : "Anexar comprovativo"}
                      </button>
                    </form>
                  </>
                ) : (
                  <p className="text-sm text-[#5c564c]">Esta formação não tem pagamento. Confirme para enviar o processo à secretaria.</p>
                )}
                {ok && <p className="mt-3 text-sm text-emerald-800">{ok}</p>}
                {!precisaPagamento && error && <p className="mt-3 text-sm text-red-700">{error}</p>}
                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  <button type="button" onClick={() => setPasso(2)} className="rounded-lg border border-[#e7e1d6] px-4 py-3 text-sm font-semibold">Voltar</button>
                  <button type="button" disabled={busy || !pagamentoPronto || !turmaEscolhida} onClick={() => void concluir()} className="rounded-lg bg-[#1b2330] px-4 py-3 text-sm font-semibold text-white disabled:opacity-40 sm:flex-1">
                    {busy ? "A concluir…" : "Concluir pré-inscrição"}
                  </button>
                </div>
              </section>
            )}
          </article>
        )}
      </main>
    </div>
  );
}

function CartaoTurma({
  turma, curso, escolhida, busy, onEscolher,
}: {
  turma: TurmaPercurso;
  curso: string;
  escolhida: boolean;
  busy: boolean;
  onEscolher: () => void;
}) {
  return (
    <li className={`overflow-hidden rounded-xl ring-1 ${escolhida ? "bg-[#fffaf2] ring-[#ffa900]" : "bg-white ring-[#e7e1d6]"}`}>
      <button type="button" disabled={busy} onClick={onEscolher} className="w-full px-4 py-3 text-left">
        <span className="flex items-start justify-between gap-3">
          <span>
            <span className="block text-sm font-semibold">{turma.nome}</span>
            <span className="mt-1 block text-sm text-[#5c564c]">{turma.local} · {turma.horario}</span>
            <span className="mt-1 block text-xs text-[#8a8172]">Início {fmtData(turma.dataInicio)} · {textoVagas(turma.livres)}</span>
          </span>
          <span className={`text-xs font-semibold ${escolhida ? "text-emerald-700" : "text-[#c48400]"}`}>{escolhida ? "Escolhida" : "Escolher"}</span>
        </span>
      </button>
      <CronogramaFolha turma={turma} curso={curso} />
    </li>
  );
}

function textoTurmas(criterios: { local: string; horario: string; inicio: string }) {
  const partes = [criterios.local, criterios.horario, criterios.inicio ? fmtData(criterios.inicio) : ""].filter(Boolean);
  if (!partes.length) return "Escolha o cronograma. Só aparecem turmas deste curso que ainda tenham lugar, já com a tolerância de vagas.";
  return `Só aparecem turmas de ${partes.join(" · ")} que ainda tenham lugar, já com a tolerância de vagas.`;
}

function CampoFicheiro({ onFile }: { onFile: (f: File | null) => void }) {
  return (
    <label className="block rounded-xl border border-dashed border-[#d9c9a3] bg-white px-4 py-4">
      <span className="block text-xs font-semibold uppercase tracking-wide text-[#8a8172]">Ficheiro PDF, JPG ou PNG</span>
      <input
        className="mt-2 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[#1b2330] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
        type="file"
        accept=".pdf,image/jpeg,image/png,application/pdf"
        onChange={e => onFile(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}
