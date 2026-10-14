// Moldura dos editores de documento: cabeçalho com voltar e acções, coluna de dados à esquerda e a página A4.
import type { ReactNode } from "react";

export function EcraDocumento({ trilho, titulo, detalhe, passos, acoes, onVoltar, lateral, barra, pagina, rodape, rotuloLateral }: {
  trilho: string;
  titulo: string;
  detalhe?: ReactNode;
  passos?: { rotulo: string; estado: "feito" | "atual" | "futuro" }[];
  acoes: ReactNode;
  onVoltar: () => void;
  lateral: ReactNode;
  rotuloLateral: string;
  barra: ReactNode;
  pagina: ReactNode;
  rodape?: ReactNode;
}) {
  return (
    <div className="-mx-4 -mt-5 sm:-mx-8 sm:-mt-6">
      <header className="sticky top-[-20px] sm:top-[-24px] z-20 min-h-16 bg-white border-b border-linha flex items-center gap-3 px-4 sm:px-6 py-2.5 flex-wrap">
        <button
          type="button"
          onClick={onVoltar}
          aria-label="Voltar"
          className="w-[34px] h-[34px] border border-linha rounded-lg inline-flex items-center justify-center text-tinta-suave bg-white cursor-pointer hover:border-linha-forte hover:text-tinta"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <div className="min-w-0">
          <p className="m-0 text-xs text-tinta-suave">{trilho}</p>
          <h1 className="m-0 text-lg font-semibold text-tinta truncate">
            {titulo} {detalhe && <span className="font-normal text-tinta-suave">· {detalhe}</span>}
          </h1>
        </div>
        {passos && (
          <ol aria-label="Estado" className="hidden lg:flex items-center gap-1.5 m-0 ml-4 p-0 list-none text-[13px]">
            {passos.map((p, i) => (
              <li key={p.rotulo} className="flex items-center gap-1.5">
                {i > 0 && <span aria-hidden="true" className="text-[#A3ABB8]">›</span>}
                <span
                  aria-current={p.estado === "atual" ? "step" : undefined}
                  className={p.estado === "atual" ? "px-2 py-0.5 rounded-full bg-[#FFF4DB] text-[#7A4A00] font-semibold" : p.estado === "feito" ? "text-tinta" : "text-tinta-suave"}
                >
                  {p.rotulo}
                </span>
              </li>
            ))}
          </ol>
        )}
        <div className="ml-auto flex gap-2 flex-wrap">{acoes}</div>
      </header>

      <div className="flex flex-wrap gap-5 px-4 sm:px-6 py-5 items-start">
        <aside aria-label={rotuloLateral} className="flex-[1_1_300px] max-w-full lg:max-w-[340px] flex flex-col gap-3.5">
          {lateral}
        </aside>
        <section aria-label="Documento" className="flex-[999_1_620px] min-w-0 bg-white border border-linha rounded-[10px] flex flex-col">
          {barra}
          <div className="bg-[#EEF0F3] px-2 sm:px-4 py-7 flex flex-col items-center gap-3 rounded-b-[10px] overflow-x-auto">
            {pagina}
            {rodape}
          </div>
        </section>
      </div>
    </div>
  );
}

/** Cartão da coluna lateral ("Para quem", "Formação e valor"…). */
export function CartaoLateral({ titulo, acao, children }: { titulo: ReactNode; acao?: ReactNode; children: ReactNode }) {
  return (
    <section className="bg-white border border-linha rounded-[10px] p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="m-0 text-sm font-semibold text-tinta">{titulo}</h2>
        {acao && <span className="ml-auto">{acao}</span>}
      </div>
      {children}
    </section>
  );
}

/** Rótulo pequeno em cima do controlo, como nos protótipos. */
export function CampoLateral({ rotulo, children, className = "" }: { rotulo: string; children: ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1.5 text-xs font-semibold text-tinta-suave ${className}`}>
      {rotulo}
      {children}
    </label>
  );
}

export const CONTROLO = "h-[38px] border border-linha-forte rounded-lg px-2.5 text-sm font-normal text-tinta bg-white w-full min-w-0 focus-visible:outline-2 focus-visible:outline-[#1D4E89] focus-visible:outline-offset-1";

/** Linha por baixo da página: contagem de páginas e realce dos campos. */
export function RodapePagina({ paginas, realce, onRealce, nota }: { paginas: number; realce: boolean; onRealce: (v: boolean) => void; nota: ReactNode }) {
  return (
    <>
      <div className="w-full max-w-[640px] flex items-center gap-3 text-xs text-tinta-suave">
        <span className="num">{paginas === 1 ? "Página 1 de 1" : `${paginas} páginas`} · A4</span>
        <label className="ml-auto inline-flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={realce} onChange={e => onRealce(e.target.checked)} />
          Realçar campos automáticos
        </label>
      </div>
      <p className="m-0 w-full max-w-[640px] text-xs text-tinta-suave">{nota}</p>
    </>
  );
}
