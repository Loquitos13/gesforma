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
 * O diálogo de ficheiro, no Chrome, desloca a área de scroll e corta a ficha.
 * Enquanto o seletor está aberto, a posição da página fica onde o utilizador a deixou.
 */
export function FileDialogPaint() {
  useEffect(() => {
    let topo = 0;
    let aTravar = false;
    const main = () => document.querySelector("main");
    const repor = () => {
      const el = main();
      if (!el || !aTravar) return;
      if (el.scrollTop !== topo) el.scrollTop = topo;
      let node = el.parentElement;
      while (node && node !== document.body) {
        if (node.scrollTop) node.scrollTop = 0;
        node = node.parentElement;
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      const alvo = event.target;
      if (!(alvo instanceof HTMLInputElement) || alvo.type !== "file") return;
      const el = main();
      if (!el) return;
      topo = el.scrollTop;
      aTravar = true;
    };
    const onFocusIn = (event: FocusEvent) => {
      const alvo = event.target;
      if (!(alvo instanceof HTMLInputElement) || alvo.type !== "file") return;
      if (!aTravar) {
        const el = main();
        topo = el?.scrollTop ?? 0;
        aTravar = true;
      }
      repor();
      requestAnimationFrame(repor);
    };
    const libertar = (event: Event) => {
      const alvo = event.target;
      if (!(alvo instanceof HTMLInputElement) || alvo.type !== "file") return;
      aTravar = false;
      alvo.blur();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("cancel", libertar);
    document.addEventListener("change", libertar);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("cancel", libertar);
      document.removeEventListener("change", libertar);
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
