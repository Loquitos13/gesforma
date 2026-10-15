import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { textoSite, type InscricaoPublica, type SiteChave } from "../partilhado/siteConteudo";

export type Course = {
  id: string;
  title: string;
  area: string;
  format: string;
  duration: string;
  start: string;
  price: string;
  description: string;
  funding: "Financiada" | "Gold";
  enrollment: InscricaoPublica;
  miniatura: string | null;
  capa: string | null;
  banner: string | null;
  precoDesde: number | null;
  vendas: number;
  regime: "gold" | "fin";
  objetivos: string[];
  organizacao: "modular" | "livre";
  programa: { titulo: string; horas: string }[];
  sessoes: { data: string; local: string; horario: string; preco?: number | null }[];
  nomeOferta: string;
};

type CatalogoApi = {
  cursos: Array<{
    id: string;
    regime: "gold" | "fin";
    titulo: string;
    area: string;
    modalidade: string;
    horasLabel: string;
    inicio: string;
    precoLabel: string;
    precoDesde: number | null;
    descricao: string;
    financiamento: "Gold" | "Financiada";
    inscricao: InscricaoPublica;
    miniatura: string | null;
    capa?: string | null;
    banner?: string | null;
    vendas: number;
    objetivos?: string[];
    organizacao?: "modular" | "livre";
    programa?: { titulo: string; horas: string }[];
    sessoes?: { data: string; local: string; horario: string; preco?: number | null }[];
    nomeOferta?: string;
  }>;
  destaques: CatalogoApi["cursos"];
  ccp: CatalogoApi["cursos"][number] | null;
};

function mapCurso(curso: CatalogoApi["cursos"][number]): Course {
  return {
    id: curso.id,
    title: curso.titulo,
    area: curso.area,
    format: curso.modalidade,
    duration: curso.horasLabel,
    start: curso.inicio,
    price: curso.precoLabel,
    description: curso.descricao,
    funding: curso.financiamento,
    enrollment: curso.inscricao,
    miniatura: curso.miniatura,
    capa: curso.capa || curso.miniatura,
    banner: curso.banner ?? curso.capa ?? curso.miniatura,
    precoDesde: curso.precoDesde,
    vendas: curso.vendas,
    regime: curso.regime,
    objetivos: curso.objetivos ?? [],
    organizacao: curso.organizacao === "livre" ? "livre" : "modular",
    programa: curso.programa ?? [],
    sessoes: curso.sessoes ?? [],
    nomeOferta: curso.nomeOferta || curso.titulo,
  };
}

type OfertaEstado = {
  cursos: Course[];
  destaques: Course[];
  ccp: Course | null;
  estado: "a-carregar" | "pronto" | "erro";
  recarregar: () => void;
};

type TextoSite = {
  ler: (chave: SiteChave) => string;
  nota: string | null;
};

export const OfertaCtx = createContext<OfertaEstado | null>(null);
export const SiteTextoCtx = createContext<TextoSite>({
  ler: chave => textoSite(undefined, chave),
  nota: null,
});

export function useSiteTexto() {
  return useContext(SiteTextoCtx).ler;
}

export function useNotaInqueritos() {
  return useContext(SiteTextoCtx).nota;
}

export function useSiteTextoState(): TextoSite {
  const [gravado, setGravado] = useState<Record<string, string>>({});
  const [nota, setNota] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    fetch("/api/v1/public/site", { cache: "no-store" })
      .then(async res => (res.ok ? res.json() as Promise<{ valores?: Record<string, string>; satisfacao?: { nota?: string } | null }> : { valores: {}, satisfacao: null }))
      .then(data => {
        if (!vivo) return;
        setGravado(data.valores ?? {});
        const media = data.satisfacao?.nota?.trim();
        setNota(media || null);
      })
      .catch(() => undefined);
    return () => { vivo = false; };
  }, []);
  const ler = useCallback((chave: SiteChave) => textoSite(gravado, chave), [gravado]);
  return { ler, nota };
}

export function useOferta() {
  const ctx = useContext(OfertaCtx);
  if (!ctx) throw new Error("useOferta precisa do site");
  return ctx;
}

export function useOfertaState(): OfertaEstado {
  const [cursos, setCursos] = useState<Course[]>([]);
  const [destaques, setDestaques] = useState<Course[]>([]);
  const [ccp, setCcp] = useState<Course | null>(null);
  const [estado, setEstado] = useState<OfertaEstado["estado"]>("a-carregar");
  const [tick, setTick] = useState(0);
  const recarregar = useCallback(() => setTick(n => n + 1), []);

  useEffect(() => {
    let vivo = true;
    setEstado("a-carregar");
    fetch("/api/v1/public/catalogo", { cache: "no-store" })
      .then(async res => {
        if (!res.ok) throw new Error("oferta indisponível");
        return res.json() as Promise<CatalogoApi>;
      })
      .then(data => {
        if (!vivo) return;
        setCursos((data.cursos ?? []).map(mapCurso));
        setDestaques((data.destaques ?? []).map(mapCurso));
        setCcp(data.ccp ? mapCurso(data.ccp) : null);
        setEstado("pronto");
      })
      .catch(() => {
        if (!vivo) return;
        setEstado("erro");
      });
    return () => {
      vivo = false;
    };
  }, [tick]);

  return { cursos, destaques, ccp, estado, recarregar };
}

export function Icon({
  name,
  className = "h-5 w-5",
}: {
  name: "arrow" | "search" | "clock" | "pin" | "screen" | "check" | "close" | "menu" | "whatsapp";
  className?: string;
}) {
  const paths: Record<string, ReactNode> = {
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2" /></>,
    screen: <><rect x="3" y="4" width="18" height="13" rx="1" /><path d="M8 21h8m-4-4v4" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="M6 6l12 12M18 6 6 18" />,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    whatsapp: <><path d="M20.5 11.6a8.5 8.5 0 0 1-12.6 7.5L3.5 20.5l1.4-4.2a8.5 8.5 0 1 1 15.6-4.7Z" /><path d="M8.2 7.8c.2-.4.4-.4.7-.4h.5c.2 0 .4 0 .5.4l.8 1.9c.1.3.1.5-.1.7l-.7.8c-.2.2-.1.4 0 .6.7 1.2 1.7 2.2 2.9 2.8.2.1.4.1.6-.1l.8-1c.2-.2.4-.3.7-.2l2 .9c.3.1.4.3.4.5 0 .3-.2 1.5-1 2.1-.6.6-1.5.8-2.5.5-1-.3-4.3-1.6-6.3-5.2-.6-1.1-.8-2.2-.7-2.9.1-.7.8-1.4 1.4-1.4Z" /></>,
  };
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}
