// Assinatura qualificada do plano de sessão / folha de presenças (Financiada): descarregar o PDF, assinar na app
// gratuita Autenticação.gov com o Cartão de Cidadão ou a Chave Móvel Digital, e carregar o PDF assinado, que o
// servidor confirma (assinatura válida, certificado das ECs qualificadas do Estado, documento sem alterações).
import { useEffect, useRef, useState } from "react";
import {
  apiEnviarAssinadoQualificado, apiEstadoAssinaturaQualificada, apiPdfAssinadoQualificado, apiPdfParaAssinar,
  type AssinaturaQualificada as Assinatura, type DocSessao,
} from "./api/pedagogia";

/** «dd-mm-aaaa hh:mm» (hora local). */
function dataHora(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (x: number) => String(x).padStart(2, "0");
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function AssinaturaQualificada({ turmaId, n, sessaoId, doc }: { turmaId: number; n: number; sessaoId?: string; doc: DocSessao }) {
  const [assinaturas, setAssinaturas] = useState<Assinatura[]>([]);
  const [desatualizada, setDesatualizada] = useState(false);
  const [estado, setEstado] = useState<{ tom: "ok" | "erro" | "info"; texto: string } | null>(null);
  const [aEnviar, setAEnviar] = useState(false);
  const ficheiro = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let vivo = true;
    apiEstadoAssinaturaQualificada(turmaId, n, doc, sessaoId)
      .then(r => { if (vivo) { setAssinaturas(r.assinaturas); setDesatualizada(r.desatualizada); } })
      .catch(() => undefined);
    return () => { vivo = false; };
  }, [turmaId, n, doc, sessaoId]);

  async function enviar(f: File) {
    setAEnviar(true);
    setEstado({ tom: "info", texto: "A confirmar a assinatura…" });
    try {
      const r = await apiEnviarAssinadoQualificado(turmaId, n, doc, f, sessaoId);
      setAssinaturas(r.assinaturas);
      setDesatualizada(false);
      const ultima = r.assinaturas[r.assinaturas.length - 1];
      setEstado({ tom: "ok", texto: `Assinatura qualificada confirmada${ultima ? `: ${ultima.titular}` : ""}.` });
    } catch (err) {
      setEstado({ tom: "erro", texto: err instanceof Error ? err.message : "Não foi possível confirmar a assinatura." });
    } finally {
      setAEnviar(false);
      if (ficheiro.current) ficheiro.current.value = "";
    }
  }

  const papel = (p: Assinatura["papel"]) => (p === "formador" ? "Formador" : "Coordenação");
  return (
    <section aria-label="Assinatura qualificada" className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 text-xs text-slate-700 space-y-2">
      <p className="m-0 font-bold text-indigo-900">Assinatura qualificada · Cartão de Cidadão ou Chave Móvel Digital</p>
      <p className="m-0 text-slate-600">
        Gratuita e com o mesmo valor de uma assinatura à mão: 1) descarregue o PDF; 2) assine-o na app{" "}
        <a href="https://www.autenticacao.gov.pt/web/guest/cc-aplicacao" target="_blank" rel="noreferrer" className="underline">Autenticação.gov</a>{" "}
        (com o cartão e um leitor, ou com a Chave Móvel Digital); 3) carregue aqui o PDF assinado, sem o alterar.
      </p>
      {assinaturas.length > 0 && (
        <ul className="m-0 list-none space-y-0.5 p-0">
          {assinaturas.map((a, i) => (
            <li key={i} className="text-emerald-800">
              ✔ {papel(a.papel)}: <strong>{a.titular}</strong> · {a.emissor} · {dataHora(a.em)}
            </li>
          ))}
        </ul>
      )}
      {desatualizada && <p className="m-0 text-amber-800">O documento mudou depois de assinado: as assinaturas anteriores deixaram de valer. Descarregue e assine de novo.</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => { apiPdfParaAssinar(turmaId, n, doc, sessaoId).catch(err => setEstado({ tom: "erro", texto: err instanceof Error ? err.message : "Não foi possível descarregar." })); }}
          className="px-2.5 py-1.5 rounded-lg border border-indigo-200 bg-white font-semibold text-indigo-800 hover:bg-indigo-100">
          1. Descarregar PDF para assinar
        </button>
        <button type="button" disabled={aEnviar} onClick={() => ficheiro.current?.click()}
          className="px-2.5 py-1.5 rounded-lg bg-indigo-700 font-semibold text-white hover:bg-indigo-800 disabled:opacity-50">
          2. Carregar PDF assinado
        </button>
        {assinaturas.length > 0 && (
          <button type="button" onClick={() => { apiPdfAssinadoQualificado(turmaId, n, doc, sessaoId).catch(() => undefined); }}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50">
            Ver PDF assinado
          </button>
        )}
        <input ref={ficheiro} type="file" accept="application/pdf,.pdf" className="hidden" aria-label="PDF assinado"
          onChange={e => { const f = e.target.files?.[0]; if (f) void enviar(f); }} />
      </div>
      {estado && (
        <p role="status" className={`m-0 ${estado.tom === "erro" ? "text-red-700" : estado.tom === "ok" ? "text-emerald-700" : "text-slate-600"}`}>{estado.texto}</p>
      )}
    </section>
  );
}
