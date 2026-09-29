import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ApiError, apiPublicDocumentoUpload, apiPublicDocumentos } from "./api";

type TipoDoc = { id: string; label: string; required?: boolean };
type Ficheiro = { id: number; tipo: string; nome: string; estado?: string; observacao?: string };

export function PublicDocumentos({ token }: { token: string }) {
  const fase = useMemo(() => {
    if (typeof window === "undefined") return "docs";
    return new URLSearchParams(window.location.search).get("fase") === "pagamento" ? "pagamento" : "docs";
  }, []);
  const [nome, setNome] = useState("");
  const [curso, setCurso] = useState("");
  const [tipos, setTipos] = useState<TipoDoc[]>([]);
  const [ficheiros, setFicheiros] = useState<Ficheiro[]>([]);
  const [estado, setEstado] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [foco, setFoco] = useState<string | null>(null);
  const [ficheiro, setFicheiro] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [completos, setCompletos] = useState(false);
  const [precisaPagamento, setPrecisaPagamento] = useState(false);
  const [pagamento, setPagamento] = useState<{ entidade: string; referencia: string; valor: number; estado: string } | null>(null);
  const [encerrada, setEncerrada] = useState(false);
  const [correcao, setCorrecao] = useState(false);

  function recarregar() {
    apiPublicDocumentos(token)
      .then(r => {
        setNome(r.nome);
        setCurso(r.curso);
        setTipos(r.tipos);
        setFicheiros(r.ficheiros);
        setCompletos(Boolean(r.docsCompletos));
        setPrecisaPagamento(Boolean(r.precisaPagamento));
        setPagamento(r.pagamento ?? null);
        setEncerrada(Boolean(r.encerrada));
        setCorrecao(Boolean(r.correcao));
        setEstado("ready");
      })
      .catch(err => {
        setEstado(err instanceof ApiError && err.status === 404 ? "missing" : "error");
      });
  }

  useEffect(() => { recarregar(); }, [token]);

  const porTipo = useMemo(() => {
    const map = new Map<string, Ficheiro>();
    for (const f of ficheiros) map.set(f.tipo, f);
    return map;
  }, [ficheiros]);

  const mostrarPagamento = (completos && precisaPagamento) || fase === "pagamento";
  function aceite(id: string) {
    const f = porTipo.get(id);
    return Boolean(f) && f?.estado !== "recusado";
  }
  const obrigatorios = tipos.filter(t => t.required || correcao);
  const feitosObrigatorios = obrigatorios.filter(t => aceite(t.id)).length;
  const proximo = tipos.find(t => (t.required || correcao) && !aceite(t.id)) ?? tipos.find(t => !aceite(t.id));
  const activoId = foco && tipos.some(t => t.id === foco) ? foco : proximo?.id ?? null;
  const activo = tipos.find(t => t.id === activoId) ?? null;
  const tudoFeito = tipos.length > 0 && tipos.every(t => aceite(t.id));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!activo) return;
    if (!ficheiro) { setError("Escolha o ficheiro deste documento."); return; }
    setBusy(true);
    setError("");
    setOk("");
    try {
      const r = await apiPublicDocumentoUpload(token, ficheiro, activo.id);
      setOk(`${activo.label} ficou na sua ficha (${r.nome}).`);
      setFicheiro(null);
      setFoco(null);
      recarregar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível enviar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f1ea] text-[#1b2330]">
      <header className="bg-white border-b border-[#e7e1d6]">
        <div className="mx-auto flex max-w-xl items-center justify-between px-5 py-4">
          <img
            src="/imagens/ena-logo-nobg.png"
            alt="ENA, Escola de Negócios e Administração"
            className="h-9 w-auto"
            onError={e => { (e.currentTarget as HTMLImageElement).src = "/imagens/ena_logo.svg"; }}
          />
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a8172]">Formação</p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl px-4 py-8 sm:px-0 sm:py-12">
        {estado === "loading" && (
          <p className="text-sm text-[#5c564c]">A abrir a sua pasta de documentos…</p>
        )}
        {estado === "missing" && (
          <article className="rounded-2xl bg-white px-6 py-8 shadow-sm ring-1 ring-[#e7e1d6]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#c48400]">Ligação inválida</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">Este convite já não está disponível.</h1>
            <p className="mt-3 text-sm leading-relaxed text-[#5c564c]">Peça uma nova ligação à secretaria, em formacao@ena.pt.</p>
          </article>
        )}
        {estado === "error" && (
          <p className="text-sm text-[#5c564c]">Não foi possível abrir a pasta. Tente dentro de momentos.</p>
        )}

        {estado === "ready" && encerrada && (
          <article className="rounded-2xl bg-white px-6 py-8 shadow-sm ring-1 ring-[#e7e1d6]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Documentos validados</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">{nome}</h1>
            <p className="mt-3 text-sm leading-relaxed text-[#5c564c]">A ligação de {curso} foi encerrada. A secretaria já validou os documentos.</p>
          </article>
        )}

        {estado === "ready" && !encerrada && (
          <article className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#e7e1d6]">
            <div className="px-6 pt-7 pb-5 sm:px-8">
              <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#c48400]">
                {correcao ? "Documentos a corrigir" : mostrarPagamento && activo?.id === "comprovativo" ? "Pagamento" : "Documentos da pré-inscrição"}
              </p>
              <h1 className="mt-2 text-[1.65rem] font-semibold tracking-tight leading-tight">{nome}</h1>
              <p className="mt-2 text-sm leading-relaxed text-[#5c564c]">
                {correcao
                  ? `${curso}. Há ficheiros que não ficaram correctos. Envie apenas os que estão indicados, com a observação da secretaria.`
                  : `${curso}. Anexa um documento de cada vez. Cada ficheiro fica registado no tipo correspondente, na sua ficha.`}
              </p>
              {obrigatorios.length > 0 && (
                <div className="mt-5">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-semibold text-[#1b2330]">{feitosObrigatorios} de {obrigatorios.length} obrigatórios</span>
                    <span className="text-[#8a8172]">{tudoFeito ? "Pasta completa" : "Um de cada vez"}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#efeae1]">
                    <div
                      className="h-full rounded-full bg-[#ffa900] transition-all"
                      style={{ width: `${Math.round((feitosObrigatorios / obrigatorios.length) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {mostrarPagamento && pagamento && (
              <div className="mx-6 mb-2 rounded-xl bg-[#1b2330] px-5 py-4 text-white sm:mx-8">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ffa900]">Referência Multibanco</p>
                <dl className="mt-3 space-y-1.5 font-mono text-sm">
                  <div className="flex justify-between gap-4"><dt className="font-sans text-white/60">Entidade</dt><dd>{pagamento.entidade || "no email"}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="font-sans text-white/60">Referência</dt><dd className="font-bold tracking-wide">{pagamento.referencia}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="font-sans text-white/60">Valor</dt><dd>€ {pagamento.valor.toFixed(2)}</dd></div>
                </dl>
                <p className="mt-3 font-sans text-xs text-white/70">Estado: {pagamento.estado}. O comprovativo anexa-se no passo correspondente.</p>
              </div>
            )}

            <ol className="divide-y divide-[#efeae1] border-t border-[#efeae1]">
              {tipos.map((t, i) => {
                const anexo = porTipo.get(t.id);
                const recusado = anexo?.estado === "recusado";
                const aberto = t.id === activoId;
                const feito = Boolean(anexo) && !recusado && !aberto;
                return (
                  <li key={t.id} className={aberto ? "bg-[#fffaf2]" : "bg-white"}>
                    <div className="flex gap-3 px-6 py-4 sm:px-8">
                      <span className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        anexo && !recusado ? "bg-emerald-600 text-white" : recusado ? "bg-red-600 text-white" : aberto ? "bg-[#1b2330] text-white" : "bg-[#efeae1] text-[#8a8172]"
                      }`} aria-hidden>
                        {anexo && !recusado ? (
                          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.2 7.2a1 1 0 01-1.4 0L3.3 9.1a1 1 0 011.4-1.4l4.1 4.1 6.5-6.5a1 1 0 011.4 0z" clipRule="evenodd" /></svg>
                        ) : i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="text-sm font-semibold">{t.label}</p>
                          <span className="text-[11px] uppercase tracking-wide text-[#8a8172]">{recusado ? "A corrigir" : t.required ? "Obrigatório" : "Opcional"}</span>
                        </div>
                        {anexo && !recusado && (
                          <p className="mt-1 truncate text-sm text-emerald-800">{anexo.nome}</p>
                        )}
                        {recusado && anexo?.observacao && (
                          <p className="mt-1 text-sm text-red-800">{anexo.observacao}</p>
                        )}
                        {feito && (
                          <button
                            type="button"
                            className="mt-2 text-xs font-semibold text-[#1b2330] underline decoration-[#ffa900] underline-offset-2"
                            onClick={() => { setFoco(t.id); setFicheiro(null); setError(""); setOk(""); }}
                          >
                            Substituir
                          </button>
                        )}
                        {!anexo && !aberto && (
                          <p className="mt-1 text-xs text-[#8a8172]">Fica para quando chegar a vez deste documento.</p>
                        )}
                      </div>
                    </div>
                    {aberto && (
                      <form onSubmit={submit} className="px-6 pb-5 sm:px-8 sm:pl-[4.25rem]">
                        <label className="block rounded-xl border border-dashed border-[#d9c9a3] bg-white px-4 py-4">
                          <span className="block text-xs font-semibold uppercase tracking-wide text-[#8a8172]">Ficheiro PDF, JPG ou PNG</span>
                          <input
                            className="mt-2 block w-full text-sm text-[#1b2330] file:mr-3 file:rounded-lg file:border-0 file:bg-[#1b2330] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
                            type="file"
                            accept=".pdf,image/jpeg,image/png,application/pdf"
                            onChange={e => setFicheiro(e.target.files?.[0] ?? null)}
                          />
                        </label>
                        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
                        <button
                          type="submit"
                          disabled={busy || !ficheiro}
                          className="mt-4 w-full rounded-lg bg-[#ffa900] px-4 py-3 text-sm font-semibold text-[#1b2330] disabled:opacity-40 sm:w-auto"
                        >
                          {busy ? "A anexar…" : anexo ? `Substituir ${t.label}` : `Anexar ${t.label}`}
                        </button>
                      </form>
                    )}
                  </li>
                );
              })}
            </ol>

            {(ok || tudoFeito) && (
              <p className="border-t border-[#efeae1] px-6 py-4 text-sm text-emerald-800 sm:px-8">
                {tudoFeito
                  ? "Todos os documentos desta lista estão na ficha. A secretaria já os vê."
                  : ok}
              </p>
            )}
          </article>
        )}
      </main>
    </div>
  );
}
