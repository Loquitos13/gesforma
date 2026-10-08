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
 * Fundo branco com o logo PNG, só quando um fetch passa do atraso (2,5 s).
 * Entrada e saída por opacidade. Não substitui o splash 0 a 100% da sessão.
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

/**
 * O Chrome descarta a camada da área de scroll ao abrir o diálogo de ficheiro.
 * Um reflow ao focar e ao fechar volta a desenhar a ficha.
 */
export function FileDialogPaint() {
  useEffect(() => {
    let dialogo = false;
    const repaint = () => {
      const main = document.querySelector("main");
      if (!main) return;
      const anterior = main.style.overflow;
      main.style.overflow = "hidden";
      void main.offsetHeight;
      main.style.overflow = anterior;
    };
    const onFocusIn = (event: FocusEvent) => {
      const alvo = event.target;
      if (!(alvo instanceof HTMLInputElement) || alvo.type !== "file") return;
      dialogo = true;
      requestAnimationFrame(repaint);
    };
    const libertar = (event: Event) => {
      const alvo = event.target;
      if (!(alvo instanceof HTMLInputElement) || alvo.type !== "file") return;
      dialogo = false;
      alvo.blur();
      requestAnimationFrame(repaint);
    };
    const onWindowFocus = () => {
      if (!dialogo) return;
      dialogo = false;
      const ativo = document.activeElement;
      if (ativo instanceof HTMLInputElement && ativo.type === "file") ativo.blur();
      requestAnimationFrame(repaint);
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("cancel", libertar);
    document.addEventListener("change", libertar);
    window.addEventListener("focus", onWindowFocus);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("cancel", libertar);
      document.removeEventListener("change", libertar);
      window.removeEventListener("focus", onWindowFocus);
    };
  }, []);
  return null;
}

/** Marca a view como ocupada por um fenómeno que não passa pelo GET da API. */
export function useViewLoading(active: boolean) {
  useEffect(() => {
    if (!active) return;
    beginViewLoad();
    return () => endViewLoad();
  }, [active]);
}
