import { useEffect, useState, type FormEvent } from "react";
import { ApiError, apiPublicFaturacao, apiPublicFaturacaoGravar, type DadosFaturacao } from "../partilhado/api";

const fieldCls = "w-full bg-transparent border-0 border-b border-slate-300 px-0 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#1b2330] rounded-none";
const labelCls = "block text-[13px] text-slate-700 mb-1";

const VAZIO: DadosFaturacao = { nome: "", nif: "", moradaFiscal: "", codigoPostal: "", email: "" };

/** Ligação pessoal para a pessoa indicar os dados da fatura depois de concluir a inscrição. */
export function PublicFaturacao({ token }: { token: string }) {
  const [estado, setEstado] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [curso, setCurso] = useState("");
  const [dados, setDados] = useState<DadosFaturacao>(VAZIO);
  const [jaPreenchido, setJaPreenchido] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;
    apiPublicFaturacao(token)
      .then(r => {
        if (!alive) return;
        setCurso(r.curso);
        setDados(r.dados);
        setJaPreenchido(r.preenchido);
        setEstado("ready");
      })
      .catch(err => {
        if (!alive) return;
        setEstado(err instanceof ApiError && err.status === 404 ? "missing" : "error");
      });
    return () => { alive = false; };
  }, [token]);

  const campo = (k: keyof DadosFaturacao) => ({
    value: dados[k],
    onChange: (e: { target: { value: string } }) => setDados(d => ({ ...d, [k]: e.target.value })),
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!dados.nome.trim() || !dados.nif.trim() || !dados.moradaFiscal.trim() || !dados.codigoPostal.trim() || !dados.email.trim()) {
      setError("Preencha todos os campos.");
      return;
    }
    setBusy(true);
    try {
      await apiPublicFaturacaoGravar(token, dados);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível gravar. Tente de novo dentro de um minuto.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-white px-4 py-10 sm:px-8">
      <div className="mx-auto w-full max-w-2xl">
        <img
          src="/imagens/ena-logo-nobg.png"
          alt="ENA"
          className="h-10 w-auto mb-10"
          onError={e => { (e.currentTarget as HTMLImageElement).src = "/imagens/ena_logo.svg"; }}
        />
        {estado === "loading" && <p className="text-sm text-slate-500">A abrir…</p>}
        {estado === "missing" && (
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#ffa900]">Ligação inválida</p>
            <h1 className="mt-4 text-2xl font-semibold text-slate-900">Esta ligação já não está disponível.</h1>
            <p className="mt-3 text-sm text-slate-600">Peça uma nova ligação à secretaria da ENA.</p>
          </div>
        )}
        {estado === "error" && <p className="text-sm text-red-600">Não foi possível abrir a página. Tente mais tarde.</p>}
        {estado === "ready" && (done ? (
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#ffa900]">Dados recebidos</p>
            <h1 className="mt-4 text-2xl font-semibold text-slate-900">Obrigado.</h1>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              A fatura vai ser emitida com estes dados e enviada para {dados.email}. Se precisar de corrigir alguma coisa, volte a abrir esta ligação.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-8" noValidate>
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#ffa900]">Dados de faturação</p>
              <h1 className="mt-3 text-2xl font-semibold text-slate-900">{curso || "Inscrição na ENA"}</h1>
              <p className="mt-2 text-sm text-slate-500">
                {jaPreenchido ? "Já recebemos os seus dados. Pode corrigi-los aqui." : "Indique os dados com que a fatura deve ser emitida."}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-6">
              <label className="sm:col-span-2">
                <span className={labelCls}>Nome ou empresa</span>
                <input className={fieldCls} {...campo("nome")} autoComplete="organization" maxLength={200} />
              </label>
              <label>
                <span className={labelCls}>NIF</span>
                <input className={fieldCls} {...campo("nif")} inputMode="numeric" maxLength={11} />
              </label>
              <label>
                <span className={labelCls}>Email para a fatura</span>
                <input className={fieldCls} {...campo("email")} type="email" autoComplete="email" maxLength={200} />
              </label>
              <label className="sm:col-span-2">
                <span className={labelCls}>Morada fiscal</span>
                <input className={fieldCls} {...campo("moradaFiscal")} autoComplete="street-address" maxLength={300} />
              </label>
              <label>
                <span className={labelCls}>Código postal</span>
                <input className={fieldCls} {...campo("codigoPostal")} autoComplete="postal-code" placeholder="0000-000" maxLength={20} />
              </label>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-center pt-2">
              <button
                type="submit"
                disabled={busy}
                className="min-w-[220px] px-10 py-3 rounded-full bg-[#1b2330] text-white text-sm font-semibold tracking-wide disabled:opacity-40 hover:bg-black"
              >
                {busy ? "A gravar…" : "Gravar dados de faturação"}
              </button>
            </div>
          </form>
        ))}
      </div>
    </div>
  );
}
