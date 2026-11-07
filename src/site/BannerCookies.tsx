// Banner de cookies do site público. Guarda a escolha 12 meses (armazenamento local) e atualiza o Consent Mode v2
// do Google Tag Manager (public/consentimento.js carrega o GTM com tudo recusado). A ligação «Definições de cookies»
// do rodapé reabre-o com o evento «ena:definicoes-cookies».
import { useEffect, useState } from "react";

const CHAVE = "ena_consentimento";
const DOZE_MESES = 365 * 24 * 60 * 60 * 1000;
const EVENTO = "ena:definicoes-cookies";

type Escolha = { analise: boolean; marketing: boolean; validade: number };

function lerEscolha(): Escolha | null {
  try {
    const c = JSON.parse(localStorage.getItem(CHAVE) ?? "null") as Escolha | null;
    return c && c.validade > Date.now() ? c : null;
  } catch { return null; }
}

function gravar(analise: boolean, marketing: boolean) {
  const c: Escolha = { analise, marketing, validade: Date.now() + DOZE_MESES };
  try { localStorage.setItem(CHAVE, JSON.stringify(c)); } catch { /* sem armazenamento: vale só nesta página */ }
  const w = window as unknown as { gtag?: (...a: unknown[]) => void; dataLayer?: unknown[] };
  const m = marketing ? "granted" : "denied";
  w.gtag?.("consent", "update", { analytics_storage: analise ? "granted" : "denied", ad_storage: m, ad_user_data: m, ad_personalization: m });
  w.dataLayer?.push({ event: "consentimento_atualizado", consentimento_analise: analise, consentimento_marketing: marketing });
}


const CATEGORIAS = [
  { id: "necessarios", titulo: "Necessários (sempre ativos)", texto: "Garantem o funcionamento do site, como a navegação, a segurança e o processo de inscrição." },
  { id: "analise", titulo: "Análise", texto: "Ajudam-nos a perceber como o site é usado, para o podermos melhorar. Os dados são agregados." },
  { id: "marketing", titulo: "Marketing", texto: "Permitem mostrar anúncios relevantes noutras plataformas e medir a eficácia das nossas campanhas." },
] as const;

const BOTAO = "min-h-11 flex-1 rounded-md border-2 border-[var(--c-primaria,#1C3350)] bg-[var(--c-primaria,#1C3350)] px-4 py-2 text-sm font-bold text-white hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

export default function BannerCookies() {
  const [aberto, setAberto] = useState(() => !lerEscolha());
  const [personalizar, setPersonalizar] = useState(false);
  const [analise, setAnalise] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const abrir = () => {
      const c = lerEscolha();
      setAnalise(c?.analise ?? false);
      setMarketing(c?.marketing ?? false);
      setPersonalizar(true);
      setAberto(true);
    };
    window.addEventListener(EVENTO, abrir);
    return () => window.removeEventListener(EVENTO, abrir);
  }, []);

  if (!aberto) return null;
  const fechar = (a: boolean, m: boolean) => { gravar(a, m); setAberto(false); setPersonalizar(false); };

  return (
    <div role="dialog" aria-modal="false" aria-labelledby="cookies-titulo"
      className="fixed inset-x-0 bottom-0 z-[100] p-3 sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-md sm:p-0">
      <div className="max-h-[85vh] overflow-y-auto rounded-lg border border-black/10 bg-white p-5 text-[var(--c-primaria,#1C3350)] shadow-2xl">
        <h2 id="cookies-titulo" className="m-0 text-lg font-extrabold">Utilizamos cookies</h2>
        <p className="mt-2 text-sm leading-6">
          Usamos cookies essenciais para o funcionamento do site e, com o seu consentimento, cookies de análise e marketing para medir a
          utilização e personalizar conteúdos e anúncios. Pode aceitar, rejeitar ou escolher as categorias que prefere. Pode alterar a sua
          escolha a qualquer momento. Saiba mais na nossa <a href="/politica-de-cookies" className="font-bold underline">Política de Cookies</a>.
        </p>
        {personalizar && (
          <ul className="mt-4 list-none space-y-3 p-0">
            {CATEGORIAS.map(c => {
              const fixo = c.id === "necessarios";
              const marcado = fixo || (c.id === "analise" ? analise : marketing);
              return (
                <li key={c.id} className="rounded-md border border-black/10 p-3">
                  <label className="flex items-start gap-3">
                    <input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={marcado} disabled={fixo}
                      onChange={e => (c.id === "analise" ? setAnalise : setMarketing)(e.target.checked)} />
                    <span>
                      <strong className="block text-sm">{c.titulo}</strong>
                      <span className="block text-xs leading-5 opacity-80">{c.texto}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={BOTAO} onClick={() => fechar(true, true)}>Aceitar todos</button>
          <button type="button" className={BOTAO} onClick={() => fechar(false, false)}>Rejeitar todos</button>
          {personalizar
            ? <button type="button" className={BOTAO} onClick={() => fechar(analise, marketing)}>Guardar preferências</button>
            : <button type="button" className={BOTAO} onClick={() => setPersonalizar(true)}>Personalizar</button>}
        </div>
      </div>
    </div>
  );
}
