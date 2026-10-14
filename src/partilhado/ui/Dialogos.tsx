import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Botao } from "./Botao";
import { Campo, Entrada } from "./Campo";
import { cx } from "./formatos";

const FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Foco preso no diálogo, Esc fecha, devolve o foco ao fechar e bloqueia o scroll da página. */
function useDialogo(aberto: boolean, onFechar: () => void) {
  const caixa = useRef<HTMLDivElement>(null);
  const fechar = useRef(onFechar);
  fechar.current = onFechar;
  useEffect(() => {
    if (!aberto) return;
    const antes = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const primeiro = caixa.current?.querySelector<HTMLElement>("[data-autofocus]") ?? caixa.current?.querySelector<HTMLElement>(FOCAVEIS);
    (primeiro ?? caixa.current)?.focus();
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") { e.stopPropagation(); fechar.current(); return; }
      if (e.key !== "Tab" || !caixa.current) return;
      const els = [...caixa.current.querySelectorAll<HTMLElement>(FOCAVEIS)].filter(el => el.offsetParent !== null);
      if (!els.length) return;
      const a = els[0]!, b = els[els.length - 1]!;
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); b.focus(); }
      else if (!e.shiftKey && document.activeElement === b) { e.preventDefault(); a.focus(); }
    }
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("keydown", tecla);
      document.body.style.overflow = overflow;
      antes?.focus?.();
    };
  }, [aberto]);
  return caixa;
}

/** Diálogo centrado. */
export function Modal({ aberto, onFechar, titulo, children, rodape, largura = "md" }: {
  aberto: boolean;
  onFechar: () => void;
  titulo: ReactNode;
  children: ReactNode;
  rodape?: ReactNode;
  largura?: "sm" | "md" | "lg" | "xl";
}) {
  const caixa = useDialogo(aberto, onFechar);
  const id = useId();
  if (!aberto) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-nav/40 p-0 sm:p-6" onMouseDown={e => { if (e.target === e.currentTarget) onFechar(); }}>
      <div
        ref={caixa}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
        className={cx("w-full bg-superficie rounded-t-painel sm:rounded-painel shadow-flutuante max-h-[92vh] flex flex-col outline-none",
          largura === "sm" ? "sm:max-w-md" : largura === "lg" ? "sm:max-w-3xl" : largura === "xl" ? "sm:max-w-5xl" : "sm:max-w-xl")}
      >
        <div className="flex items-start gap-3 px-5 pt-5 pb-3">
          <h2 id={id} className="flex-1 m-0 text-base font-semibold text-tinta">{titulo}</h2>
          <Botao variante="fantasma" tamanho="sm" soIcone aria-label="Fechar" onClick={onFechar} icone={<span aria-hidden="true" className="text-lg leading-none">×</span>} />
        </div>
        <div className="px-5 pb-5 overflow-y-auto">{children}</div>
        {rodape && <div className="flex flex-wrap justify-end gap-2 px-5 py-4 border-t border-linha">{rodape}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Painel que entra pela direita (detalhe, edição rápida). No telemóvel ocupa o ecrã. */
export function PainelLateral({ aberto, onFechar, titulo, subtitulo, children, rodape, largura = 480 }: {
  aberto: boolean;
  onFechar: () => void;
  titulo: ReactNode;
  subtitulo?: ReactNode;
  children: ReactNode;
  rodape?: ReactNode;
  largura?: number;
}) {
  const caixa = useDialogo(aberto, onFechar);
  const id = useId();
  if (!aberto) return null;
  return createPortal(
    <div className="fixed inset-0 z-[55] bg-nav/30" onMouseDown={e => { if (e.target === e.currentTarget) onFechar(); }}>
      <aside
        ref={caixa}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
        style={{ maxWidth: largura }}
        className="absolute right-0 top-0 h-full w-full bg-superficie shadow-flutuante flex flex-col outline-none"
      >
        <div className="flex items-start gap-3 px-5 py-4 border-b border-linha">
          <div className="flex-1 min-w-0">
            <h2 id={id} className="m-0 text-base font-semibold text-tinta">{titulo}</h2>
            {subtitulo && <p className="m-0 mt-0.5 text-[13px] text-tinta-suave">{subtitulo}</p>}
          </div>
          <Botao variante="fantasma" tamanho="sm" soIcone aria-label="Fechar" onClick={onFechar} icone={<span aria-hidden="true" className="text-lg leading-none">×</span>} />
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {rodape && <div className="flex flex-wrap justify-end gap-2 px-5 py-4 border-t border-linha">{rodape}</div>}
      </aside>
    </div>,
    document.body,
  );
}

/**
 * Confirmação de uma acção destrutiva. Com `confirmarTexto`, a pessoa tem de escrever
 * esse texto (ex.: o nome) antes de poder confirmar.
 */
export function ConfirmarPerigo({ aberto, onFechar, onConfirmar, titulo, descricao, acao = "Eliminar", confirmarTexto }: {
  aberto: boolean;
  onFechar: () => void;
  onConfirmar: () => Promise<unknown> | void;
  titulo: ReactNode;
  descricao: ReactNode;
  acao?: string;
  confirmarTexto?: string;
}) {
  const [texto, setTexto] = useState("");
  const [aCorrer, setACorrer] = useState(false);
  useEffect(() => { if (aberto) setTexto(""); }, [aberto]);
  const bloqueado = Boolean(confirmarTexto) && texto.trim() !== confirmarTexto;
  async function confirmar() {
    setACorrer(true);
    try {
      await onConfirmar();
      onFechar();
    } finally {
      setACorrer(false);
    }
  }
  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo={titulo}
      largura="sm"
      rodape={(
        <>
          <Botao variante="secundario" onClick={onFechar} data-autofocus>Cancelar</Botao>
          <Botao variante="perigo" disabled={bloqueado} aCarregar={aCorrer} onClick={confirmar}>{acao}</Botao>
        </>
      )}
    >
      <div className="text-sm text-tinta-suave space-y-3">
        <div>{descricao}</div>
        {confirmarTexto && (
          <Campo rotulo={<>Escreva <strong className="text-tinta">{confirmarTexto}</strong> para confirmar</>}>
            {p => <Entrada {...p} value={texto} onChange={e => setTexto(e.target.value)} autoComplete="off" />}
          </Campo>
        )}
      </div>
    </Modal>
  );
}
