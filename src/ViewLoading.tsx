import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { beginViewLoad, endViewLoad, subscribeViewLoading } from "./viewLoadingBus";

const EXIT_MS = 480;

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
 * Entrada: aparece (fade-in). Meio: opacidade 100%. Saída: desvanece (fade-out).
 * Não substitui o splash 0–100% da primeira entrada na sessão.
 */
export function ViewLoadingOverlay({ active }: { active: boolean }) {
  const [pending, setPending] = useState(0);
  const [holding, setHolding] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => subscribeViewLoading(setPending), []);
  const show = active || pending > 0;
  const visible = show || holding;

  useEffect(() => {
    if (show) {
      setHolding(true);
      setExiting(false);
      return;
    }
    if (!holding) return;
    setExiting(true);
    const t = window.setTimeout(() => {
      setHolding(false);
      setExiting(false);
    }, EXIT_MS);
    return () => window.clearTimeout(t);
  }, [show, holding]);

  if (!visible || typeof document === "undefined") return null;

  return createPortal(
    <div
      data-testid="view-loading"
      className={`fixed top-14 right-0 bottom-0 left-0 lg:left-60 z-20 flex items-center justify-center bg-white ${
        exiting ? "view-loading-exit" : "view-loading-enter"
      }`}
      role="status"
      aria-live="polite"
      aria-label="A carregar"
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
