import { useMemo, useState, type FormEvent } from "react";
import { ApiError, apiPublicPreinscricao } from "./api";

const CONCELHOS = [
  "Águeda", "Albergaria-a-Velha", "Alcobaça", "Almada", "Amadora", "Amarante", "Aveiro",
  "Barcelos", "Beja", "Braga", "Bragança", "Caldas da Rainha", "Cascais", "Castelo Branco",
  "Chaves", "Coimbra", "Covilhã", "Évora", "Fafe", "Faro", "Figueira da Foz", "Funchal",
  "Gondomar", "Guarda", "Guimarães", "Ílhavo", "Lamego", "Leiria", "Lisboa", "Loures",
  "Maia", "Marco de Canaveses", "Matosinhos", "Odivelas", "Oeiras", "Oliveira de Azeméis",
  "Ovar", "Paços de Ferreira", "Palmela", "Paredes", "Penafiel", "Ponta Delgada", "Portalegre",
  "Portimão", "Porto", "Póvoa de Varzim", "Santa Maria da Feira", "Santarém", "Santo Tirso",
  "Seixal", "Setúbal", "Sintra", "Tomar", "Torres Vedras", "Trofa", "Valongo", "Viana do Castelo",
  "Vila do Conde", "Vila Franca de Xira", "Vila Nova de Famalicão", "Vila Nova de Gaia",
  "Vila Real", "Viseu",
];

const ORIGENS = [
  "Website",
  "Facebook",
  "Instagram",
  "Google",
  "Referência",
  "IEFP",
  "LinkedIn",
  "Outro",
];

const fieldCls = "w-full bg-transparent border-0 border-b border-slate-300 px-0 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#1b2330] rounded-none";
const labelCls = "block text-[13px] text-slate-700 mb-1";

export function PublicPreinscricao() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const curso = params.get("curso")?.trim() || "Formação de Formadores - CCP";
  const [nome, setNome] = useState("");
  const [apelido, setApelido] = useState("");
  const [telf, setTelf] = useState("");
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [concelho, setConcelho] = useState("");
  const [origem, setOrigem] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!nome.trim() || !apelido.trim() || !telf.trim() || !email.trim() || !concelho || !origem) {
      setError("Preencha todos os campos para a secretaria o poder contactar.");
      return;
    }
    setBusy(true);
    try {
      await apiPublicPreinscricao({
        nome: nome.trim(),
        apelido: apelido.trim(),
        telf: telf.trim(),
        email: email.trim(),
        concelho,
        origem,
        curso,
        campanha: params.get("campanha") ?? "",
        local: params.get("local") ?? "",
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
      <div className="mx-auto w-full max-w-4xl">
        <img
          src="/imagens/ena-logo-nobg.png"
          alt="ENA"
          className="h-10 w-auto mb-10"
          onError={e => { (e.currentTarget as HTMLImageElement).src = "/imagens/ena_logo.svg"; }}
        />
        {done ? (
          <div className="max-w-xl">
            <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#ffa900]">Pré-inscrição recebida</p>
            <h1 className="mt-4 text-2xl font-semibold text-slate-900">Será contactado brevemente.</h1>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              A secretaria da ENA liga ou escreve para {email} / {telf} a propósito de {curso}.
              Não existe área de formando online - o próximo passo é este contacto.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-10" noValidate>
            <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#ffa900]">
              Preencha os seus dados para fazer a pré-inscrição. Será contactado brevemente
            </p>
            {params.get("curso") && (
              <p className="text-sm text-slate-500">Curso: <span className="font-medium text-slate-800">{curso}</span></p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-16 gap-y-8">
              <label>
                <span className={labelCls}>Primeiro Nome</span>
                <input className={fieldCls} value={nome} onChange={e => setNome(e.target.value)} autoComplete="given-name" />
              </label>
              <label>
                <span className={labelCls}>Último Nome</span>
                <input className={fieldCls} value={apelido} onChange={e => setApelido(e.target.value)} autoComplete="family-name" />
              </label>
              <label>
                <span className={labelCls}>Contacto Telefónico</span>
                <input className={fieldCls} value={telf} onChange={e => setTelf(e.target.value)} autoComplete="tel" inputMode="tel" />
              </label>
              <label>
                <span className={labelCls}>Email</span>
                <input className={fieldCls} type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
              </label>
              <label>
                <span className={labelCls}>Concelho de residência</span>
                <select className={`${fieldCls} ${concelho ? "text-slate-800" : "text-slate-400"}`} value={concelho} onChange={e => setConcelho(e.target.value)}>
                  <option value="">Selecione um concelho</option>
                  {CONCELHOS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label>
                <span className={labelCls}>Como tomou conhecimento?</span>
                <select className={`${fieldCls} ${origem ? "text-slate-800" : "text-slate-400"}`} value={origem} onChange={e => setOrigem(e.target.value)}>
                  <option value="">Selecione um opção</option>
                  {ORIGENS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-center pt-2">
              <button
                type="submit"
                disabled={busy}
                className="min-w-[220px] px-10 py-3 rounded-full bg-[#1b2330] text-white text-sm font-semibold tracking-wide disabled:opacity-40 hover:bg-black"
              >
                {busy ? "A enviar…" : "INSCREVER-ME"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
