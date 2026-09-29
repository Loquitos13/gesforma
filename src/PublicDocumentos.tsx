import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ApiError, apiPublicDocumentoUpload, apiPublicDocumentos } from "./api";

const fieldCls = "w-full bg-transparent border-0 border-b border-slate-300 px-0 py-2 text-sm text-slate-800 focus:outline-none focus:border-[#1b2330] rounded-none";
const labelCls = "block text-[13px] text-slate-700 mb-1";

export function PublicDocumentos({ token }: { token: string }) {
  const fase = useMemo(() => {
    if (typeof window === "undefined") return "docs";
    return new URLSearchParams(window.location.search).get("fase") === "pagamento" ? "pagamento" : "docs";
  }, []);
  const [nome, setNome] = useState("");
  const [curso, setCurso] = useState("");
  const [tipos, setTipos] = useState<{ id: string; label: string; required?: boolean }[]>([]);
  const [ficheiros, setFicheiros] = useState<{ id: number; tipo: string; nome: string }[]>([]);
  const [estado, setEstado] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [tipo, setTipo] = useState("cc");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [completos, setCompletos] = useState(false);
  const [emFalta, setEmFalta] = useState<string[]>([]);
  const [precisaPagamento, setPrecisaPagamento] = useState(false);
  const [pagamento, setPagamento] = useState<{ entidade: string; referencia: string; valor: number; estado: string } | null>(null);

  function recarregar() {
    apiPublicDocumentos(token)
      .then(r => {
        setNome(r.nome);
        setCurso(r.curso);
        setTipos(r.tipos);
        setFicheiros(r.ficheiros);
        setCompletos(Boolean(r.docsCompletos));
        setEmFalta(r.emFalta ?? []);
        setPrecisaPagamento(Boolean(r.precisaPagamento));
        setPagamento(r.pagamento ?? null);
        setEstado("ready");
        const prefer = fase === "pagamento" ? "comprovativo" : (r.tipos.find(t => t.required && !r.ficheiros.some(f => f.tipo === t.id))?.id ?? r.tipos[0]?.id);
        if (prefer) setTipo(prefer);
      })
      .catch(err => {
        setEstado(err instanceof ApiError && err.status === 404 ? "missing" : "error");
      });
  }

  useEffect(() => { recarregar(); }, [token]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const input = (e.currentTarget as HTMLFormElement).querySelector<HTMLInputElement>('input[type="file"]');
    const file = input?.files?.[0];
    if (!file) { setError("Escolha um ficheiro."); return; }
    setBusy(true);
    setError("");
    setOk("");
    try {
      const r = await apiPublicDocumentoUpload(token, file, tipo);
      setOk(`${r.nome} recebido e gravado na sua ficha.`);
      if (input) input.value = "";
      recarregar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível enviar.");
    } finally {
      setBusy(false);
    }
  }

  const mostrarPagamento = (completos && precisaPagamento) || fase === "pagamento";

  return (
    <div className="min-h-screen bg-white px-4 py-10 sm:px-8">
      <div className="mx-auto w-full max-w-xl">
        <img
          src="/imagens/ena-logo-nobg.png"
          alt="ENA"
          className="h-10 w-auto mb-10"
          onError={e => { (e.currentTarget as HTMLImageElement).src = "/imagens/ena_logo.svg"; }}
        />
        {estado === "loading" && <p className="text-sm text-slate-500">A abrir a sua pasta de documentos…</p>}
        {estado === "missing" && (
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#ffa900]">Ligação inválida</p>
            <h1 className="mt-4 text-2xl font-semibold text-slate-900">Este convite já não está disponível.</h1>
            <p className="mt-3 text-sm text-slate-600">Peça uma nova ligação à secretaria da ENA (formacao@ena.pt).</p>
          </div>
        )}
        {estado === "error" && <p className="text-sm text-slate-600">Não foi possível abrir. Tente mais tarde.</p>}
        {estado === "ready" && (
          <form onSubmit={submit} className="space-y-8">
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#ffa900]">
                {mostrarPagamento ? "Pagamento" : "Documentos da pré-inscrição"}
              </p>
              <h1 className="mt-3 text-2xl font-semibold text-slate-900">{nome}</h1>
              <p className="mt-2 text-sm text-slate-600">
                {curso}. Cada ficheiro fica na sua ficha na secretaria da ENA.
              </p>
            </div>

            {emFalta.length > 0 && (
              <p className="text-sm text-slate-700">Ainda pedimos: {emFalta.join(", ")}.</p>
            )}

            {mostrarPagamento && pagamento && (
              <div className="rounded-xl border border-slate-200 p-4 space-y-2 font-mono text-sm">
                <p className="font-sans text-xs font-semibold uppercase tracking-wider text-slate-500">Multibanco</p>
                <div className="flex justify-between"><span className="text-slate-500">Entidade</span><span>{pagamento.entidade || "indicada no email"}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Referência</span><span className="font-bold">{pagamento.referencia}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Valor</span><span>€ {pagamento.valor.toFixed(2)}</span></div>
                <p className="font-sans text-xs text-slate-500 pt-1">Depois de pagar, anexe o comprovativo abaixo ({pagamento.estado}).</p>
              </div>
            )}

            <label>
              <span className={labelCls}>Tipo de documento</span>
              <select className={fieldCls} value={tipo} onChange={e => setTipo(e.target.value)}>
                {tipos.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.label}{t.required ? " (obrigatório)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={labelCls}>Ficheiro (PDF, JPG ou PNG)</span>
              <input className="block w-full text-sm text-slate-600" type="file" accept=".pdf,image/jpeg,image/png,application/pdf" />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {ok && <p className="text-sm text-emerald-700">{ok}</p>}
            <button type="submit" disabled={busy} className="px-5 py-2.5 bg-[#1b2330] text-white text-sm font-semibold rounded-lg disabled:opacity-50">
              {busy ? "A enviar…" : "Enviar para a ficha"}
            </button>
            {ficheiros.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400 mb-2">Já na ficha</p>
                <ul className="text-sm text-slate-700 space-y-1">
                  {ficheiros.map(f => <li key={f.id}>{f.tipo} · {f.nome}</li>)}
                </ul>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
