import { useEffect } from "react";

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
