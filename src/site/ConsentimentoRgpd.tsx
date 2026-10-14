import { useEffect, useState } from "react";
import { moradaSegura, textoSite } from "../partilhado/siteConteudo";

/** Endereço da política de privacidade e texto do consentimento, lidos do conteúdo do site (Sistema → Site). */
function usePoliticaPrivacidade() {
  const [valores, setValores] = useState<Record<string, string>>({});
  useEffect(() => {
    let vivo = true;
    fetch("/api/v1/public/site", { cache: "no-store" })
      .then(res => (res.ok ? res.json() as Promise<{ valores?: Record<string, string> }> : { valores: {} }))
      .then(d => { if (vivo) setValores(d.valores ?? {}); })
      .catch(() => undefined);
    return () => { vivo = false; };
  }, []);
  return {
    url: moradaSegura(textoSite(valores, "rodapePrivacidadeUrl")),
    texto: (valores.rgpdTexto ?? "").trim(),
  };
}

/**
 * Aceitação da política de privacidade no formulário de pré-inscrição (RGPD).
 * O servidor guarda a data, o IP e a versão do texto aceite.
 */
export function ConsentimentoRgpd({ aceite, onMudar, className }: { aceite: boolean; onMudar: (v: boolean) => void; className?: string }) {
  const { url, texto } = usePoliticaPrivacidade();
  return (
    <label className={`flex items-start gap-2.5 text-[13px] leading-5 text-slate-700 cursor-pointer ${className ?? ""}`}>
      <input
        type="checkbox"
        required
        checked={aceite}
        onChange={e => onMudar(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[#1b2330]"
      />
      <span>
        {texto || "Aceito que a ENA trate os meus dados para gerir esta pré-inscrição e me contactar sobre a formação."}
        {url && <> Ler a <a href={url} target="_blank" rel="noreferrer" className="underline font-semibold">política de privacidade</a>.</>}
      </span>
    </label>
  );
}
