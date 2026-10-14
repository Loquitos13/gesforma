import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cx } from "./formatos";

const CONTROLO = "w-full rounded-controlo border border-linha-forte bg-superficie text-sm text-tinta placeholder:text-tinta-fraca disabled:bg-fundo disabled:text-tinta-suave";

/**
 * Campo de formulário: rótulo, ajuda e erro ligados ao controlo por aria.
 * Uso: <Campo rotulo="Email" erro={e}>{p => <Entrada {...p} type="email" />}</Campo>
 */
export function Campo({
  rotulo, ajuda, erro, obrigatorio, children, className,
}: {
  rotulo: ReactNode;
  ajuda?: ReactNode;
  erro?: string | null;
  obrigatorio?: boolean;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean; required?: boolean }) => ReactNode;
  className?: string;
}) {
  const id = useId();
  const descricao = [ajuda ? `${id}-ajuda` : "", erro ? `${id}-erro` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cx("flex flex-col gap-1 min-w-0", className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-tinta">
        {rotulo}
        {obrigatorio && <span className="text-perigo" aria-hidden="true"> *</span>}
      </label>
      {children({ id, "aria-describedby": descricao, "aria-invalid": erro ? true : undefined, required: obrigatorio || undefined })}
      {ajuda && !erro && <p id={`${id}-ajuda`} className="m-0 text-xs text-tinta-suave">{ajuda}</p>}
      {erro && <p id={`${id}-erro`} role="alert" className="m-0 text-xs text-perigo">{erro}</p>}
    </div>
  );
}

export const Entrada = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Entrada({ className, ...resto }, ref) {
  return <input ref={ref} className={cx(CONTROLO, "h-10 px-3", className)} {...resto} />;
});

export const AreaTexto = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function AreaTexto({ className, ...resto }, ref) {
  return <textarea ref={ref} className={cx(CONTROLO, "px-3 py-2 min-h-[88px]", className)} {...resto} />;
});

export type OpcaoSelecao = { valor: string; rotulo: string };

/** Select nativo. `vazio` acrescenta a primeira opção (ex.: "Todos os cursos"). */
export const Selecao = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { opcoes: OpcaoSelecao[]; vazio?: string }>(
  function Selecao({ opcoes, vazio, className, ...resto }, ref) {
    return (
      <select ref={ref} className={cx(CONTROLO, "h-10 px-2.5", className)} {...resto}>
        {vazio != null && <option value="">{vazio}</option>}
        {opcoes.map(o => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
      </select>
    );
  },
);

/** Caixa de verificação com rótulo clicável. */
export function Caixa({ rotulo, ajuda, className, ...resto }: InputHTMLAttributes<HTMLInputElement> & { rotulo: ReactNode; ajuda?: ReactNode }) {
  return (
    <label className={cx("inline-flex items-start gap-2 text-sm text-tinta cursor-pointer", className)}>
      <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#1D4E89]" {...resto} />
      <span>
        {rotulo}
        {ajuda && <span className="block text-xs text-tinta-suave">{ajuda}</span>}
      </span>
    </label>
  );
}

/** Interruptor ligado/desligado (role="switch"). */
export function Interruptor({ ligado, onMudar, rotulo, desativado }: { ligado: boolean; onMudar: (v: boolean) => void; rotulo: string; desativado?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo}
      disabled={desativado}
      onClick={() => onMudar(!ligado)}
      className={cx("relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50", ligado ? "bg-sucesso" : "bg-linha-forte")}
    >
      <span className={cx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", ligado ? "translate-x-[22px]" : "translate-x-0.5")} />
    </button>
  );
}
