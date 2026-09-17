import { useEffect, useRef, useState } from "react";
import { beginViewLoad, endViewLoad, subscribeViewLoading } from "./viewLoadingBus";

const FADE_MS = 450;
const MIN_VISIBLE_MS = 420;

function EnaLogoPng() {
  return (
    <img
      src="/imagens/ena-logo-nobg.png"
      alt=""
      aria-hidden
      className="w-[min(72%,20rem)] h-auto view-loading-logo"
      onError={e => { (e.currentTarget as HTMLImageElement).src = "/imagens/ena_logo.svg"; }}
    />
  );
}

/** Overlay da view (não substitui o splash 0–100% da sessão). */
export function ViewLoadingOverlay() {
  const [pending, setPending] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const shownAt = useRef(0);

  useEffect(() => subscribeViewLoading(setPending), []);

  useEffect(() => {
    const timers: number[] = [];
    if (pending > 0) {
      setMounted(true);
      timers.push(window.setTimeout(() => {
        setVisible(true);
        if (!shownAt.current) shownAt.current = performance.now();
      }, 16));
      return () => timers.forEach(id => window.clearTimeout(id));
    }
    if (!mounted) return;
    const remain = shownAt.current
      ? Math.max(0, MIN_VISIBLE_MS - (performance.now() - shownAt.current))
      : 0;
    timers.push(window.setTimeout(() => {
      setVisible(false);
      shownAt.current = 0;
      timers.push(window.setTimeout(() => setMounted(false), FADE_MS));
    }, remain + 40));
    return () => timers.forEach(id => window.clearTimeout(id));
  }, [pending, mounted]);

  if (!mounted) return null;

  return (
    <div
      className={`absolute inset-0 z-20 flex items-center justify-center bg-white transition-opacity ease-in-out ${visible ? "opacity-100" : "opacity-0"}`}
      style={{ transitionDuration: `${FADE_MS}ms` }}
      role="status"
      aria-live="polite"
      aria-label="A carregar"
    >
      <EnaLogoPng />
    </div>
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
