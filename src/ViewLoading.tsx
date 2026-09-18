import { useEffect, useRef, useState } from "react";
import { beginViewLoad, endViewLoad, subscribeViewLoading } from "./viewLoadingBus";

const ENTER_MS = 480;
const HOLD_MS = 420;
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
  const [phase, setPhase] = useState<"off" | "in" | "out">("off");
  const phaseRef = useRef(phase);
  const shownAt = useRef(0);
  const timers = useRef<number[]>([]);

  phaseRef.current = phase;

  useEffect(() => subscribeViewLoading(setPending), []);
  const show = active || pending > 0;

  useEffect(() => {
    timers.current.forEach(id => window.clearTimeout(id));
    timers.current = [];

    if (show) {
      if (phaseRef.current === "off" || phaseRef.current === "out") {
        shownAt.current = performance.now();
      }
      setPhase("in");
      return;
    }

    if (phaseRef.current === "off") return;

    const wait = Math.max(0, ENTER_MS + HOLD_MS - (performance.now() - shownAt.current));
    const startExit = window.setTimeout(() => {
      setPhase("out");
      const hide = window.setTimeout(() => setPhase("off"), EXIT_MS);
      timers.current.push(hide);
    }, wait);
    timers.current.push(startExit);
    return () => {
      timers.current.forEach(id => window.clearTimeout(id));
      timers.current = [];
    };
  }, [show]);

  if (phase === "off") return null;

  return (
    <div
      className={`absolute inset-0 z-40 flex items-center justify-center bg-white ${
        phase === "in" ? "view-loading-enter" : "view-loading-exit"
      }`}
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
