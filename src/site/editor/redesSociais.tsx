// Redes sociais do site: ícones, ligações para as páginas da ENA (rodapé) e botões de partilha (notícias).
import { useState } from "react";
import { ligacaoSegura } from "./estilos";

export const REDES = {
  facebook: { nome: "Facebook", desenho: <path d="M15 3h-2.5A3.5 3.5 0 0 0 9 6.5V21M6 11h8" /> },
  instagram: { nome: "Instagram", desenho: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><path d="M17.5 6.5h.01" /></> },
  linkedin: { nome: "LinkedIn", desenho: <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M8 11v6M8 7.5v.01M12 17v-6M12 13.5a2.5 2.5 0 0 1 5 0V17" /></> },
  youtube: { nome: "YouTube", desenho: <><rect x="2" y="5" width="20" height="14" rx="4" /><path d="M10 9l5 3-5 3z" /></> },
  tiktok: { nome: "TikTok", desenho: <path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5M14 3c.4 2.8 2.3 4.6 5 5" /> },
  x: { nome: "X (Twitter)", desenho: <path d="M4 4l16 16M20 4L4 20" /> },
  whatsapp: { nome: "WhatsApp", desenho: <><path d="M3.5 20.5l1.4-4.2A8.5 8.5 0 1 1 8 19.2z" /><path d="M9 9.5c.3 2 2.2 4.2 4.8 5l1-1.3-1.8-1-.8.6c-.9-.4-1.6-1.1-2-2l.6-.8-1-1.8z" /></> },
} as const;

export type Rede = keyof typeof REDES;
export type LigacaoRede = { rede: Rede; ligacao: string };

export function IconeRede({ rede, className = "h-5 w-5" }: { rede: Rede; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {REDES[rede]?.desenho}
    </svg>
  );
}

const OPCOES = Object.entries(REDES).map(([value, r]) => ({ label: r.nome, value }));

/** Campo do editor: a lista de redes da ENA (rede + endereço da página). */
export const campoRedes = {
  type: "array" as const,
  label: "Redes sociais (ícones com ligação)",
  arrayFields: {
    rede: { type: "select" as const, label: "Rede", options: OPCOES },
    ligacao: { type: "text" as const, label: "Endereço da página (https://…)" },
  },
  defaultItemProps: { rede: "facebook" as Rede, ligacao: "" },
  getItemSummary: (item: LigacaoRede) => REDES[item.rede]?.nome ?? "Rede",
};

/** Ícones com ligação às páginas da ENA (só os que têm endereço). */
export function LigacoesRedes({ redes, className = "" }: { redes?: LigacaoRede[]; className?: string }) {
  const lista = (redes ?? []).map(r => ({ ...r, href: ligacaoSegura(r.ligacao) })).filter(r => REDES[r.rede] && r.href && /^https:/.test(r.href));
  if (!lista.length) return null;
  return (
    <ul className={`flex flex-wrap items-center gap-2 ${className}`}>
      {lista.map((r, i) => (
        <li key={i}>
          <a href={r.href} target="_blank" rel="noreferrer" aria-label={`${REDES[r.rede].nome} da ENA (abre noutra janela)`}
            className="grid h-11 w-11 place-items-center rounded-full border border-current/30 hover:bg-white/10">
            <IconeRede rede={r.rede} />
          </a>
        </li>
      ))}
    </ul>
  );
}

const PARTILHA: Partial<Record<Rede, (url: string, titulo: string) => string>> = {
  linkedin: url => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  facebook: url => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  whatsapp: (url, titulo) => `https://wa.me/?text=${encodeURIComponent(`${titulo} ${url}`)}`,
  x: (url, titulo) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(titulo)}`,
};
export const REDES_PARTILHA = Object.keys(PARTILHA) as Rede[];

/** Botões para partilhar a página atual (e copiar a ligação). */
export function Partilhar({ redes, titulo }: { redes: Rede[]; titulo: string }) {
  const [copiado, setCopiado] = useState(false);
  const url = typeof window !== "undefined" ? window.location.href : "";
  async function copiar() {
    try { await navigator.clipboard.writeText(url); setCopiado(true); setTimeout(() => setCopiado(false), 2500); } catch { /* sem acesso à área de transferência */ }
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-bold opacity-70">Partilhar:</span>
      {redes.filter(r => PARTILHA[r]).map(r => (
        <a key={r} href={PARTILHA[r]!(url, titulo)} target="_blank" rel="noreferrer" aria-label={`Partilhar no ${REDES[r].nome} (abre noutra janela)`}
          className="grid h-10 w-10 place-items-center rounded-full border border-current/25 text-[var(--c-primaria)] hover:border-[var(--c-destaque)] hover:text-[var(--c-destaque)]">
          <IconeRede rede={r} className="h-4 w-4" />
        </a>
      ))}
      <button type="button" onClick={() => void copiar()} className="h-10 rounded-full border border-current/25 px-4 font-bold text-[var(--c-primaria)] hover:border-[var(--c-destaque)]">
        {copiado ? "Ligação copiada" : "Copiar ligação"}
      </button>
      <span role="status" className="sr-only">{copiado ? "Ligação copiada" : ""}</span>
    </div>
  );
}

/** As páginas da ENA (as mesmas do ena.pt): o valor por omissão do rodapé e do bloco «Siga-nos». */
export const REDES_ENA: LigacaoRede[] = [
  { rede: "instagram", ligacao: "https://www.instagram.com/ena_escolaformacao/" },
  { rede: "facebook", ligacao: "https://www.facebook.com/ENA.escola.negocios.administracao" },
  { rede: "linkedin", ligacao: "https://www.linkedin.com/company/10536784" },
];
