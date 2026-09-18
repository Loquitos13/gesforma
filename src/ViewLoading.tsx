import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { beginViewLoad, endViewLoad, isViewLoading, subscribeViewLoading } from "./viewLoadingBus";

function EnaLogoPng() {
  return (
    <img
      src="/imagens/ena-logo-nobg.png"
      alt=""
      aria-hidden
      className="w-[min(70vw,20rem)] h-auto view-loading-logo"
    />
  );
}

/**
 * Fundo branco a 100% da view, com o logo PNG.
 * Entrada: aparece. Meio: opacidade 100%. Saída: desvanece.
 * Não substitui o splash 0–100% da primeira entrada na sessão.
 */
export function ViewLoadingOverlay() {
  const [busy, setBusy] = useState(isViewLoading);
  const [present, setPresent] = useState(isViewLoading);
  const [exiting, setExiting] = useState(false);

  useEffect(() => subscribeViewLoading(on => setBusy(on)), []);

  useEffect(() => {
    if (busy) {
      setPresent(true);
      setExiting(false);
      return;
    }
    if (present) setExiting(true);
  }, [busy, present]);

  if (!present || typeof document === "undefined") return null;

  return createPortal(
    <div
      data-testid="view-loading"
      className={`fixed top-14 right-0 bottom-0 left-0 lg:left-60 z-20 flex items-center justify-center bg-white ${
        exiting ? "view-loading-exit" : "view-loading-cycle"
      }`}
      role="status"
      aria-live="polite"
      aria-label="A carregar"
      onAnimationEnd={event => {
        if (event.target !== event.currentTarget) return;
        if (!exiting && !busy) {
          setExiting(true);
          return;
        }
        if (exiting && !busy) {
          setPresent(false);
          setExiting(false);
        }
      }}
    >
      <EnaLogoPng />
    </div>,
    document.body,
  );
}

/** Marca a view como ocupada por um fenómeno que não passa pelo GET da API. */
export function useViewLoading(active: boolean) {
  useEffect(() => {
    if (!active) return;
    beginViewLoad();
    return () => endViewLoad();
  }, [active]);
}
