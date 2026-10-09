import { useEffect, useState } from "react";
import { useCatalogs } from "./CatalogsContext";
import { SITE_GRUPOS, SITE_OMISSAO, type SiteChave } from "./siteConteudo";
import { toastOk } from "./toastBus";

const campoCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent";

export function SiteConteudoView() {
  const { settings, saveSettings } = useCatalogs();
  const [draft, setDraft] = useState<Record<SiteChave, string>>({ ...SITE_OMISSAO });
  const [guardado, setGuardado] = useState(false);
  const ano = new Date().getFullYear();

  useEffect(() => {
    const gravado = settings.site ?? {};
    setDraft(prev => {
      const next: Record<SiteChave, string> = { ...SITE_OMISSAO };
      (Object.keys(SITE_OMISSAO) as SiteChave[]).forEach(chave => {
        next[chave] = gravado[chave] ?? prev[chave] ?? SITE_OMISSAO[chave];
      });
      return next;
    });
  }, [settings.site]);

  function guardar() {
    const values = Object.fromEntries((Object.keys(SITE_OMISSAO) as SiteChave[]).map(chave => [chave, draft[chave] ?? ""]));
    saveSettings("site", values);
    setGuardado(true);
    toastOk("Textos do site guardados.");
  }

  return (
    <div className="space-y-4 pb-24">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Site</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {guardado ? "Alterações guardadas na base. Abra o site para as ver." : "Textos da página inicial e do rodapé. Os cursos, preços e turmas continuam a sair da oferta."}
          </p>
        </div>
        <a href="/" target="_blank" rel="noreferrer" className="inline-flex px-4 py-2 text-sm font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">Ver o site</a>
      </div>
      {SITE_GRUPOS.map(grupo => (
        <section key={grupo.titulo} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-800">{grupo.titulo}</h2>
            {grupo.nota && <p className="mt-1 text-xs text-slate-500">{grupo.nota}{grupo.titulo === "Rodapé" ? ` Este ano aparece © ${ano}.` : ""}</p>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {grupo.campos.map(campo => (
              <label key={campo.chave} className={`flex flex-col gap-1.5 ${campo.tipo === "texto" ? "md:col-span-2" : ""}`}>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{campo.etiqueta}</span>
                {campo.tipo === "texto" ? (
                  <textarea
                    className={`${campoCls} min-h-20 resize-y`}
                    value={draft[campo.chave]}
                    onChange={e => setDraft(atual => ({ ...atual, [campo.chave]: e.target.value }))}
                  />
                ) : (
                  <input
                    className={campoCls}
                    value={draft[campo.chave]}
                    onChange={e => setDraft(atual => ({ ...atual, [campo.chave]: e.target.value }))}
                  />
                )}
              </label>
            ))}
          </div>
        </section>
      ))}
      <div className="sticky bottom-3 flex justify-end">
        <button type="button" onClick={guardar} className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 text-white shadow-sm">
          Guardar textos do site
        </button>
      </div>
    </div>
  );
}
