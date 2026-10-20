// Peças partilhadas pelos ecrãs do diretório comercial (clientes, parceiros, contratos) e da equipa.
import type { ReactNode } from "react";
import { useAuth } from "../../../partilhado/AuthGate";
import { type Migalha, type Tom } from "../../../partilhado/ui";
import { numeroPt } from "../../../partilhado/ui/formatos";
import type { Vista } from "../../rotasGesforma";
import type { Navegar } from "../../shell/tipos";

export type Regime = "gold" | "fin";

export function regimeDaVista(view: Vista): Regime {
  return view.startsWith("fin-") ? "fin" : "gold";
}

/** Migalhas "Gold / CRM / Clientes" (ou Financiada). */
export function trilhoCrm(view: Vista, navigate: Navegar, pagina: string, secao = "CRM"): Migalha[] {
  const fin = regimeDaVista(view) === "fin";
  return [
    { rotulo: fin ? "Financiada" : "Gold", onClick: () => navigate(fin ? "fin-painel" : "gold-painel") },
    { rotulo: secao },
    { rotulo: pagina },
  ];
}

const TOM_ESTADO: Record<string, Tom> = {
  Enviada: "info",
  "Negociação": "aviso",
  Aceite: "sucesso",
  Recusada: "perigo",
  Expirada: "neutro",
  "Sem propostas": "neutro",
  Rascunho: "neutro",
  "Por assinar": "aviso",
  Assinado: "sucesso",
  Cancelado: "perigo",
  "Não contactado": "aviso",
  "1º Contacto": "info",
  "2º Contacto": "info",
  Pago: "sucesso",
  Formando: "sucesso",
  Desistiu: "perigo",
};

export function tomEstado(estado: string): Tom {
  return TOM_ESTADO[estado] ?? "neutro";
}

/** Cor de cada estado, como nos protótipos (ponto + texto). */
const COR_TOM: Record<Tom, string> = { sucesso: "#1F7A4D", aviso: "#9A5B00", perigo: "#B42318", info: "#1D4E89", neutro: "#5A6474" } as Record<Tom, string>;

export function corEstado(estado: string) {
  return COR_TOM[tomEstado(estado)] ?? "#5A6474";
}

export function EstadoDoc({ estado }: { estado: string }) {
  const cor = corEstado(estado);
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] whitespace-nowrap" style={{ color: cor }}>
      <span aria-hidden="true" className="w-[7px] h-[7px] rounded-full" style={{ background: cor }} />
      {estado === "Negociação" ? "Em negociação" : estado}
    </span>
  );
}

/** Lista à esquerda e detalhe fixo à direita (ocupa a área toda, como nos protótipos). */
export function ListaComDetalhe({ children, detalhe, rotulo }: { children: ReactNode; detalhe?: ReactNode; rotulo: string }) {
  return (
    <div className="-mx-4 -my-5 sm:-mx-8 sm:-my-6 flex flex-wrap min-h-[calc(100vh-56px)]">
      <div className="flex-[999_1_560px] min-w-0 px-4 py-5 sm:px-8 sm:py-7 box-border flex flex-col gap-5">{children}</div>
      {detalhe ? (
        <aside aria-label={rotulo} className="flex-[1_1_400px] max-w-full xl:max-w-[440px] bg-white border-t xl:border-t-0 xl:border-l border-linha p-6 box-border flex flex-col gap-[18px]">
          {detalhe}
        </aside>
      ) : null}
    </div>
  );
}

/** Título da página, resumo e acção principal. */
export function CabecalhoLista({ titulo, resumo, acoes }: { titulo: string; resumo?: ReactNode; acoes?: ReactNode }) {
  return (
    <div className="flex items-end gap-4 flex-wrap">
      <div className="min-w-0">
        <h1 className="m-0 text-[22px] font-semibold tracking-[-0.01em] text-tinta">{titulo}</h1>
        {resumo ? <p className="num m-0 mt-1 text-tinta-suave">{resumo}</p> : null}
      </div>
      {acoes ? <div className="ml-auto flex gap-2 flex-wrap">{acoes}</div> : null}
    </div>
  );
}

/** Separadores com sublinhado âmbar e contagem. */
export function Abas<T extends string>({ itens, ativo, onMudar, rotulo }: { itens: { id: T; rotulo: string; n?: number }[]; ativo: T; onMudar: (t: T) => void; rotulo: string }) {
  return (
    <div role="tablist" aria-label={rotulo} className="flex gap-6 border-b border-linha overflow-x-auto">
      {itens.map(t => {
        const a = t.id === ativo;
        return (
          <button key={t.id} type="button" role="tab" aria-selected={a} onClick={() => onMudar(t.id)}
            className="border-0 bg-transparent py-2.5 -mb-px cursor-pointer font-semibold whitespace-nowrap"
            style={{ color: a ? "#18202C" : "#5A6474", borderBottom: `2px solid ${a ? "#FFB020" : "transparent"}` }}>
            {t.rotulo} {t.n != null && <span className="num font-medium text-tinta-suave">{t.n}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Pílula de fase (ponto, nome, contagem) que filtra a lista. */
export function Fase({ rotulo, n, cor, ativo, onClick }: { rotulo: string; n: number; cor: string; ativo?: boolean; onClick?: () => void }) {
  return (
    <button type="button" aria-pressed={ativo} onClick={onClick}
      className={`num inline-flex items-center gap-2 h-8 px-3 rounded-full border text-[13px] cursor-pointer ${ativo ? "border-tinta bg-tinta text-white" : "border-linha-forte bg-white text-tinta hover:border-tinta-suave"}`}>
      <span aria-hidden="true" className="w-[7px] h-[7px] rounded-full" style={{ background: ativo ? "#fff" : cor }} />
      {rotulo} <strong className="font-semibold">{n}</strong>
    </button>
  );
}

/** Passos (barras finas) de uma proposta ou contrato. */
export function Passos({ passos, atual }: { passos: string[]; atual: number }) {
  return (
    <ol className="list-none m-0 p-0 grid gap-1.5 text-xs" style={{ gridTemplateColumns: `repeat(${passos.length}, minmax(0, 1fr))` }}>
      {passos.map((p, i) => (
        <li key={p} className="flex flex-col gap-1.5" style={{ color: i <= atual ? "#18202C" : "#5A6474", fontWeight: i === atual ? 600 : 400 }} aria-current={i === atual ? "step" : undefined}>
          <span aria-hidden="true" className="h-1 rounded-sm" style={{ background: i <= atual ? "#1D4E89" : "#E2E5EA" }} />
          {p}
        </li>
      ))}
    </ol>
  );
}

/** Lista de pares rótulo/valor do painel de detalhe. */
export function Dados({ itens }: { itens: { rotulo: string; valor: ReactNode; forte?: boolean }[] }) {
  return (
    <dl className="num m-0 grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-2 text-[13px]">
      {itens.map(i => (
        <div key={i.rotulo} className="contents">
          <dt className="text-tinta-suave">{i.rotulo}</dt>
          <dd className={`m-0 min-w-0 break-words text-tinta ${i.forte ? "font-semibold" : ""}`}>{i.valor}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Administração e secretaria: apagam registos e editam modelos (o servidor confirma). */
export function useGestao() {
  const { user } = useAuth();
  return user.role === "admin" || user.role === "secretaria";
}

export function useEu() {
  return useAuth().user;
}

/** Converte "1.250,50", "1 250,50" ou "1250.5" em número; vazio ou inválido dá 0. */
export function numeroDe(texto: string) {
  const n = numeroPt(texto);
  return Number.isFinite(n) ? n : 0;
}

/** Iniciais para o avatar. */
export function iniciais(nome: string) {
  const p = nome.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1]![0] : "")).toUpperCase() || "?";
}
