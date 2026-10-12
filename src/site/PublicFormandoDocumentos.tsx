import { useEffect, useState, type FormEvent } from "react";
import { ApiError, apiPublicFormandoDocumentos, apiPublicFormandoDocumentoUpload } from "../partilhado/api";

export function PublicFormandoDocumentos({ token }: { token: string }) {
  const [vista, setVista] = useState<Awaited<ReturnType<typeof apiPublicFormandoDocumentos>> | null>(null);
  const [estado, setEstado] = useState<"loading" | "ready" | "error">("loading");
  const [tipo, setTipo] = useState("");
  const [ficheiro, setFicheiro] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  function reload() {
    return apiPublicFormandoDocumentos(token).then(r => {
      setVista(r);
      setEstado("ready");
    });
  }

  useEffect(() => {
    reload().catch(() => setEstado("error"));
  }, [token]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!ficheiro || !tipo) return;
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      await apiPublicFormandoDocumentoUpload(token, tipo, ficheiro);
      setMsg("Documento enviado. A secretaria irá validar.");
      setFicheiro(null);
      await reload();
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "Não foi possível enviar.");
    } finally {
      setBusy(false);
    }
  }

  if (estado === "loading") {
    return <main className="mx-auto max-w-lg px-5 py-16 text-center text-sm text-slate-500">A carregar…</main>;
  }
  if (estado === "error" || !vista) {
    return <main className="mx-auto max-w-lg px-5 py-16 text-center"><h1 className="font-serif text-2xl font-bold">Ligação inválida</h1><p className="mt-2 text-sm text-slate-500">Peça um novo lembrete à ENA.</p></main>;
  }

  const permitidos = vista.recusados.length
    ? vista.documentos.filter(d => vista.recusados.includes(d.id))
    : vista.documentos.filter(d => d.estado !== "validado");

  return (
    <main className="site-ena min-h-screen bg-[#F9F9F9] text-[#1C3350]">
      <header className="border-b border-[#1C3350]/10 bg-white px-5 py-6">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-wider text-[#A60000]">Formação financiada</p>
          <h1 className="mt-2 font-serif text-3xl font-bold">Documentos de elegibilidade</h1>
          <p className="mt-2 text-sm text-[#1C3350]/60">{vista.nome} · {vista.curso}</p>
        </div>
      </header>
      <div className="mx-auto max-w-2xl space-y-6 px-5 py-10">
        {msg && <p className="bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-semibold text-emerald-800">{msg}</p>}
        {err && <p className="bg-red-50 border border-red-200 px-4 py-3 text-sm font-semibold text-red-800">{err}</p>}
        <ul className="space-y-2">
          {vista.documentos.map(doc => (
            <li key={doc.id} className={`rounded-lg border px-4 py-3 text-sm ${doc.estado === "validado" ? "border-emerald-200 bg-emerald-50" : doc.estado === "recusado" ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"}`}>
              <div className="flex justify-between gap-3">
                <strong>{doc.label}</strong>
                <span className="text-xs font-bold uppercase">{doc.estado === "validado" ? "Validado" : doc.estado === "recusado" ? "Recusado" : doc.estado === "pendente" ? "Por validar" : "Em falta"}</span>
              </div>
              {doc.observacao && <p className="mt-1 text-xs text-red-700">{doc.observacao}</p>}
              {doc.validadoPor && <p className="mt-1 text-xs text-slate-500">Validado por {doc.validadoPor}{doc.validadoEm ? ` · ${doc.validadoEm}` : ""}</p>}
            </li>
          ))}
        </ul>
        {permitidos.length > 0 && (
          <form onSubmit={enviar} className="rounded-xl border border-[#1C3350]/10 bg-white p-5 space-y-4">
            <h2 className="font-bold">Enviar ficheiro</h2>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
              Documento
              <select required value={tipo} onChange={e => setTipo(e.target.value)} className="mt-2 w-full border border-slate-200 px-3 py-3 text-base font-normal normal-case">
                <option value="">Escolher…</option>
                {permitidos.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </label>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
              Ficheiro
              <input required type="file" onChange={e => setFicheiro(e.target.files?.[0] ?? null)} className="mt-2 w-full text-sm" />
            </label>
            <button disabled={busy} type="submit" className="w-full bg-[#A60000] py-3 font-bold text-white disabled:opacity-50">{busy ? "A enviar…" : "Submeter"}</button>
          </form>
        )}
        {vista.completo && <p className="text-center text-sm font-semibold text-emerald-700">Todos os documentos obrigatórios estão validados.</p>}
      </div>
    </main>
  );
}
