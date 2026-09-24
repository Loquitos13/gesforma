import { useEffect, useState, type FormEvent } from "react";
import { ApiError, apiPublicInquerito, apiPublicInqueritoResposta, type InqueritoPublico } from "./api";

const fieldCls = "w-full bg-transparent border-0 border-b border-slate-300 px-0 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#1b2330] rounded-none";
const labelCls = "block text-[13px] text-slate-700 mb-1";

export function PublicInquerito({ token }: { token: string }) {
  const [inq, setInq] = useState<InqueritoPublico | null>(null);
  const [estado, setEstado] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [formando, setFormando] = useState("");
  const [turma, setTurma] = useState("");
  const [respostas, setRespostas] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;
    apiPublicInquerito(token)
      .then(r => {
        if (!alive) return;
        setInq(r);
        setEstado("ready");
      })
      .catch(err => {
        if (!alive) return;
        setEstado(err instanceof ApiError && err.status === 404 ? "missing" : "error");
      });
    return () => { alive = false; };
  }, [token]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!inq) return;
    setError("");
    const faltam = inq.perguntas.filter(p => {
      const v = respostas[String(p.id)];
      return v == null || v === "";
    });
    if (faltam.length) {
      setError("Responda a todas as perguntas antes de enviar.");
      return;
    }
    if (!formando.trim()) {
      setError("Indique o seu nome para a secretaria cruzar com a lista da turma.");
      return;
    }
    setBusy(true);
    try {
      await apiPublicInqueritoResposta(token, {
        formando: formando.trim(),
        turma: turma.trim(),
        respostas,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível enviar. Tente de novo dentro de um minuto.");
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
        {estado === "loading" && <p className="text-sm text-slate-500">A abrir o inquérito…</p>}
        {estado === "missing" && (
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#ffa900]">Ligação inválida</p>
            <h1 className="mt-4 text-2xl font-semibold text-slate-900">Este inquérito já não está disponível.</h1>
            <p className="mt-3 text-sm text-slate-600">Peça uma nova ligação à secretaria da ENA.</p>
          </div>
        )}
        {estado === "error" && (
          <p className="text-sm text-red-600">Não foi possível abrir o inquérito. Tente mais tarde.</p>
        )}
        {estado === "ready" && inq && (done ? (
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#ffa900]">Resposta recebida</p>
            <h1 className="mt-4 text-2xl font-semibold text-slate-900">Obrigado pelo tempo.</h1>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              A sua avaliação entra nas métricas da turma. Não precisa de fazer mais nada neste ecrã.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-8" noValidate>
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#ffa900]">Inquérito de satisfação</p>
              <h1 className="mt-3 text-2xl font-semibold text-slate-900">{inq.titulo}</h1>
              <p className="mt-2 text-sm text-slate-500">Respostas anónimas para a secretaria, salvo o nome que indicar em baixo.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-6">
              <label>
                <span className={labelCls}>O seu nome</span>
                <input className={fieldCls} value={formando} onChange={e => setFormando(e.target.value)} autoComplete="name" />
              </label>
              <label>
                <span className={labelCls}>Turma (se souber)</span>
                <input className={fieldCls} value={turma} onChange={e => setTurma(e.target.value)} />
              </label>
            </div>
            <div className="space-y-6">
              {inq.perguntas.map((p, idx) => (
                <fieldset key={p.id} className="space-y-2">
                  <legend className="text-sm font-semibold text-slate-800">
                    {idx + 1}. {p.texto || "Pergunta"}
                  </legend>
                  {p.tipo === "escala" && (
                    <div className="flex flex-wrap gap-2">
                      {[1, 2, 3, 4, 5].map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setRespostas(prev => ({ ...prev, [String(p.id)]: n }))}
                          className={`w-10 h-10 rounded-full border-2 text-sm font-bold ${
                            respostas[String(p.id)] === n
                              ? "border-[#1b2330] bg-[#1b2330] text-white"
                              : "border-slate-200 text-slate-700 hover:border-slate-400"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  )}
                  {p.tipo === "simnao" && (
                    <div className="flex gap-2">
                      {["Sim", "Não"].map(op => (
                        <button
                          key={op}
                          type="button"
                          onClick={() => setRespostas(prev => ({ ...prev, [String(p.id)]: op }))}
                          className={`px-4 py-2 rounded-lg border text-sm font-semibold ${
                            respostas[String(p.id)] === op
                              ? "border-[#1b2330] bg-[#1b2330] text-white"
                              : "border-slate-200 text-slate-700 hover:border-slate-400"
                          }`}
                        >
                          {op}
                        </button>
                      ))}
                    </div>
                  )}
                  {p.tipo === "multipla" && (
                    <div className="space-y-1.5">
                      {p.opcoes.map(op => (
                        <label key={op} className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="radio"
                            name={`p-${p.id}`}
                            checked={respostas[String(p.id)] === op}
                            onChange={() => setRespostas(prev => ({ ...prev, [String(p.id)]: op }))}
                          />
                          {op}
                        </label>
                      ))}
                    </div>
                  )}
                  {(p.tipo === "texto" || !["escala", "simnao", "multipla"].includes(p.tipo)) && (
                    <textarea
                      rows={3}
                      value={typeof respostas[String(p.id)] === "string" ? String(respostas[String(p.id)]) : ""}
                      onChange={e => setRespostas(prev => ({ ...prev, [String(p.id)]: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#1b2330]"
                    />
                  )}
                </fieldset>
              ))}
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-center pt-2">
              <button
                type="submit"
                disabled={busy}
                className="min-w-[220px] px-10 py-3 rounded-full bg-[#1b2330] text-white text-sm font-semibold tracking-wide disabled:opacity-40 hover:bg-black"
              >
                {busy ? "A enviar…" : "Enviar respostas"}
              </button>
            </div>
          </form>
        ))}
      </div>
    </div>
  );
}
