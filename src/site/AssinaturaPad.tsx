// Área para desenhar a assinatura com o rato, o dedo ou a caneta. Devolve um PNG (data URL) ou null se estiver vazia.
import { useEffect, useRef, useState, type PointerEvent as EventoPonteiro } from "react";

export function AssinaturaPad({ onMudar }: { onMudar: (png: string | null) => void }) {
  const tela = useRef<HTMLCanvasElement>(null);
  const aDesenhar = useRef(false);
  const ultimo = useRef<{ x: number; y: number } | null>(null);
  const [vazia, setVazia] = useState(true);

  useEffect(() => {
    const c = tela.current;
    if (!c) return;
    const ajustar = () => {
      const r = c.getBoundingClientRect();
      const escala = window.devicePixelRatio || 1;
      c.width = Math.round(r.width * escala);
      c.height = Math.round(r.height * escala);
      const ctx = c.getContext("2d");
      if (ctx) {
        ctx.scale(escala, escala);
        ctx.lineWidth = 2.2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#18202C";
      }
      setVazia(true);
      onMudar(null);
    };
    ajustar();
    window.addEventListener("resize", ajustar);
    return () => window.removeEventListener("resize", ajustar);
  }, [onMudar]);

  function ponto(e: EventoPonteiro<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function comecar(e: EventoPonteiro<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    aDesenhar.current = true;
    ultimo.current = ponto(e);
  }

  function mover(e: EventoPonteiro<HTMLCanvasElement>) {
    if (!aDesenhar.current) return;
    const ctx = e.currentTarget.getContext("2d");
    const p = ponto(e);
    if (ctx && ultimo.current) {
      ctx.beginPath();
      ctx.moveTo(ultimo.current.x, ultimo.current.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    ultimo.current = p;
    if (vazia) setVazia(false);
  }

  function acabar() {
    if (!aDesenhar.current) return;
    aDesenhar.current = false;
    ultimo.current = null;
    if (!vazia && tela.current) onMudar(recortar(tela.current));
  }

  function limpar() {
    const c = tela.current;
    const ctx = c?.getContext("2d");
    if (c && ctx) ctx.clearRect(0, 0, c.width, c.height);
    setVazia(true);
    onMudar(null);
  }

  return (
    <div>
      <div className="relative rounded-cartao border-2 border-dashed border-linha bg-white">
        <canvas
          ref={tela}
          aria-label="Área para desenhar a assinatura"
          className="block w-full h-44 touch-none cursor-crosshair"
          onPointerDown={comecar}
          onPointerMove={mover}
          onPointerUp={acabar}
          onPointerCancel={acabar}
          onPointerLeave={acabar}
        />
        {vazia && <p className="pointer-events-none absolute inset-0 m-0 flex items-center justify-center text-sm text-tinta-suave">Assine aqui</p>}
        <span aria-hidden="true" className="pointer-events-none absolute left-6 right-6 bottom-10 border-b border-linha" />
      </div>
      <div className="mt-2 flex justify-end">
        <button type="button" onClick={limpar} className="text-sm font-semibold text-ligacao hover:underline">Limpar</button>
      </div>
    </div>
  );
}

/** Corta as margens vazias e reduz a imagem para um PNG leve. */
function recortar(c: HTMLCanvasElement): string | null {
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const { width: w, height: h } = c;
  const d = ctx.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      if (d[(y * w + x) * 4 + 3]! > 0) {
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  const m = 8;
  x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(w, x1 + m); y1 = Math.min(h, y1 + m);
  const escala = Math.min(1, 600 / (x1 - x0));
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round((x1 - x0) * escala));
  out.height = Math.max(1, Math.round((y1 - y0) * escala));
  out.getContext("2d")?.drawImage(c, x0, y0, x1 - x0, y1 - y0, 0, 0, out.width, out.height);
  return out.toDataURL("image/png");
}
