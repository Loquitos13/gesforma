import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cx } from "./formatos";

export type VarianteBotao = "primario" | "secundario" | "fantasma" | "perigo" | "ligacao";

const VARIANTES: Record<VarianteBotao, string> = {
  primario: "bg-acao text-tinta font-semibold hover:bg-acao-forte border border-transparent",
  secundario: "bg-superficie text-tinta border border-linha-forte hover:bg-fundo",
  fantasma: "bg-transparent text-tinta-suave border border-transparent hover:bg-linha-suave hover:text-tinta",
  perigo: "bg-perigo text-white font-semibold border border-transparent hover:brightness-95",
  ligacao: "bg-transparent text-ligacao font-semibold border border-transparent hover:text-ligacao-forte hover:underline px-0",
};

const TAMANHOS = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
};

export type BotaoProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: VarianteBotao;
  tamanho?: keyof typeof TAMANHOS;
  icone?: ReactNode;
  /** Mostra um indicador e bloqueia o clique enquanto a acção corre. */
  aCarregar?: boolean;
  /** Botão só com ícone: obrigatório dar `aria-label`. */
  soIcone?: boolean;
};

export const Botao = forwardRef<HTMLButtonElement, BotaoProps>(function Botao(
  { variante = "secundario", tamanho = "md", icone, aCarregar, soIcone, className, children, disabled, type = "button", ...resto },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || aCarregar}
      aria-busy={aCarregar || undefined}
      className={cx(
        "inline-flex items-center justify-center rounded-controlo whitespace-nowrap transition-colors",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        VARIANTES[variante],
        soIcone ? (tamanho === "sm" ? "h-8 w-8" : "h-10 w-10") : TAMANHOS[tamanho],
        className,
      )}
      {...resto}
    >
      {aCarregar ? <Rodinha /> : icone}
      {!soIcone && children}
    </button>
  );
});

export function Rodinha({ className }: { className?: string }) {
  return (
    <svg className={cx("h-4 w-4 animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Ligação com aspecto de botão (navegação, downloads). */
export function BotaoLigacao({
  href, variante = "secundario", tamanho = "md", icone, children, className, ...resto
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { variante?: VarianteBotao; tamanho?: keyof typeof TAMANHOS; icone?: ReactNode }) {
  return (
    <a
      href={href}
      className={cx("inline-flex items-center justify-center rounded-controlo whitespace-nowrap no-underline", VARIANTES[variante], TAMANHOS[tamanho], className)}
      {...resto}
    >
      {icone}
      {children}
    </a>
  );
}
