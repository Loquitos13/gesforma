import { useEffect, useRef, useState } from "react";
import { AppModal } from "./FormKit";

/** Largura:altura da fotografia na coluna do cartão de /formacao. */
export const RECORTE_RAZAO = 2 / 3;
export const RECORTE_LARGURA = 220;
export const RECORTE_ALTURA = Math.round(RECORTE_LARGURA / RECORTE_RAZAO);

const ZOOM_MIN = 1;
const ZOOM_MAX = 4;
const PREVIA_ALTURA = 112;
const PREVIA_LARGURA = Math.round(PREVIA_ALTURA * (RECORTE_LARGURA / RECORTE_ALTURA));
const PREVIA_ESCALA = PREVIA_LARGURA / RECORTE_LARGURA;

export function medidaRecorte(largura: number, altura: number, zoom: number) {
  const base = Math.max(RECORTE_LARGURA / largura, RECORTE_ALTURA / altura);
  const escala = base * Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
  const dw = largura * escala;
  const dh = altura * escala;
  return { escala, dw, dh, minX: RECORTE_LARGURA - dw, minY: RECORTE_ALTURA - dh };
}

function limitar(valor: number, min: number, max: number) {
  return Math.min(max, Math.max(min, valor));
}

export function RecorteMiniatura({
  origem,
  nome,
  aGravar,
  onCancelar,
  onConfirmar,
}: {
  origem: string;
  nome: string;
  aGravar: boolean;
  onCancelar: () => void;
  onConfirmar: (file: File) => void;
}) {
  const [imagem, setImagem] = useState<HTMLImageElement | null>(null);
  const [erro, setErro] = useState("");
  const [zoom, setZoom] = useState(1);
  const [ox, setOx] = useState(0);
  const [oy, setOy] = useState(0);
  const vista = useRef({ ox: 0, oy: 0, zoom: 1 });
  const moldura = useRef<HTMLDivElement>(null);
  const arrasto = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  vista.current = { ox, oy, zoom };

  useEffect(() => {
    let viva = true;
    const img = new Image();
    img.onload = () => {
      if (!viva) return;
      if (!img.naturalWidth || !img.naturalHeight) {
        setErro("Não foi possível ler esta imagem.");
        return;
      }
      const medida = medidaRecorte(img.naturalWidth, img.naturalHeight, 1);
      setImagem(img);
      setErro("");
      setZoom(1);
      setOx(medida.minX / 2);
      setOy(medida.minY / 2);
    };
    img.onerror = () => { if (viva) setErro("Não foi possível ler esta imagem."); };
    img.src = origem;
    return () => { viva = false; };
  }, [origem]);

  useEffect(() => {
    const el = moldura.current;
    if (!el) return;
    const aoRoda = (event: WheelEvent) => {
      event.preventDefault();
      if (!imagem) return;
      const actual = vista.current;
      const seguinte = limitar(actual.zoom * (event.deltaY > 0 ? 0.92 : 1.08), ZOOM_MIN, ZOOM_MAX);
      aplicarZoom(imagem, actual, seguinte, setZoom, setOx, setOy);
    };
    el.addEventListener("wheel", aoRoda, { passive: false });
    return () => el.removeEventListener("wheel", aoRoda);
  }, [imagem]);

  const medida = imagem ? medidaRecorte(imagem.naturalWidth, imagem.naturalHeight, zoom) : null;

  function mover(dx: number, dy: number, origemX: number, origemY: number) {
    if (!imagem) return;
    const caixa = medidaRecorte(imagem.naturalWidth, imagem.naturalHeight, zoom);
    setOx(limitar(origemX + dx, caixa.minX, 0));
    setOy(limitar(origemY + dy, caixa.minY, 0));
  }

  function repor() {
    if (!imagem) return;
    const caixa = medidaRecorte(imagem.naturalWidth, imagem.naturalHeight, 1);
    setZoom(1);
    setOx(caixa.minX / 2);
    setOy(caixa.minY / 2);
  }

  function guardar() {
    if (!imagem || !medida || aGravar) return;
    const saidaL = 800;
    const saidaA = Math.round(saidaL / RECORTE_RAZAO);
    const tela = document.createElement("canvas");
    tela.width = saidaL;
    tela.height = saidaA;
    const ctx = tela.getContext("2d");
    if (!ctx) {
      setErro("O browser não conseguiu preparar o recorte.");
      return;
    }
    let sx = -ox / medida.escala;
    let sy = -oy / medida.escala;
    let sw = RECORTE_LARGURA / medida.escala;
    let sh = RECORTE_ALTURA / medida.escala;
    sx = Math.max(0, sx);
    sy = Math.max(0, sy);
    sw = Math.min(sw, imagem.naturalWidth - sx);
    sh = Math.min(sh, imagem.naturalHeight - sy);
    ctx.drawImage(imagem, sx, sy, sw, sh, 0, 0, saidaL, saidaA);
    try {
      tela.toBlob(blob => {
        if (!blob) {
          setErro("Não foi possível gerar o recorte.");
          return;
        }
        const base = nome.replace(/\.[^.]+$/, "") || "miniatura";
        onConfirmar(new File([blob], `${base}.jpg`, { type: "image/jpeg" }));
      }, "image/jpeg", 0.92);
    } catch {
      setErro("Não foi possível recortar esta imagem. Carregue o ficheiro outra vez.");
    }
  }

  return (
    <AppModal
      open
      size="xl"
      title="Recortar a miniatura"
      sub="A moldura é a fotografia do cartão em /formacao. Arraste e aproxime até ficar o enquadramento certo."
      onClose={() => { if (!aGravar) onCancelar(); }}
      footer={
        <>
          <button type="button" disabled={aGravar} onClick={onCancelar} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50">Cancelar</button>
          <button type="button" disabled={aGravar || !imagem} onClick={guardar} className="px-4 py-2 text-sm font-semibold text-white bg-[#1C3350] hover:bg-[#14263D] rounded-lg disabled:opacity-50">
            {aGravar ? "A gravar…" : "Guardar recorte"}
          </button>
        </>
      }
    >
      <div className="p-5 space-y-4">
        {erro && <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{erro}</p>}
        <div className="flex flex-col items-start gap-5 lg:flex-row">
          <div
            ref={moldura}
            role="application"
            aria-label="Área de recorte. Arraste a fotografia para a posicionar."
            className="relative shrink-0 overflow-hidden bg-[#E7EBF0] touch-none cursor-grab active:cursor-grabbing select-none"
            style={{ width: RECORTE_LARGURA, height: RECORTE_ALTURA }}
            onPointerDown={event => {
              if (!imagem) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              arrasto.current = { x: event.clientX, y: event.clientY, ox, oy };
            }}
            onPointerMove={event => {
              const inicio = arrasto.current;
              if (!inicio) return;
              mover(event.clientX - inicio.x, event.clientY - inicio.y, inicio.ox, inicio.oy);
            }}
            onPointerUp={() => { arrasto.current = null; }}
            onPointerCancel={() => { arrasto.current = null; }}
          >
            {medida && (
              <img
                src={origem}
                alt=""
                draggable={false}
                className="pointer-events-none absolute max-w-none"
                style={{ width: medida.dw, height: medida.dh, left: ox, top: oy }}
              />
            )}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-y-0 left-1/3 w-px bg-white/50" />
              <div className="absolute inset-y-0 left-2/3 w-px bg-white/50" />
              <div className="absolute inset-x-0 top-1/3 h-px bg-white/50" />
              <div className="absolute inset-x-0 top-2/3 h-px bg-white/50" />
              <div className="absolute inset-0 ring-2 ring-[#FFA900] ring-inset" />
            </div>
          </div>
          <div className="min-w-0 flex-1 space-y-4">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex" style={{ height: PREVIA_ALTURA }}>
                <div className="w-2 shrink-0 bg-[#FFA900]" />
                <div className="relative shrink-0 overflow-hidden bg-[#E7EBF0]" style={{ width: PREVIA_LARGURA }}>
                  {medida && (
                    <img
                      src={origem}
                      alt=""
                      draggable={false}
                      className="absolute max-w-none"
                      style={{
                        width: medida.dw * PREVIA_ESCALA,
                        height: medida.dh * PREVIA_ESCALA,
                        left: ox * PREVIA_ESCALA,
                        top: oy * PREVIA_ESCALA,
                      }}
                    />
                  )}
                </div>
                <div className="flex flex-col justify-center px-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#1C3350]">ENA Gold</span>
                  <p className="mt-1 text-sm font-semibold text-slate-800">Pré-visualização do cartão</p>
                  <p className="mt-1 text-xs text-slate-500">A imagem ocupa a altura toda.</p>
                </div>
              </div>
            </div>
            <label className="block text-xs font-semibold text-slate-600">
              Aproximar
              <input
                type="range"
                min={ZOOM_MIN}
                max={ZOOM_MAX}
                step={0.01}
                value={zoom}
                aria-valuetext={`${Math.round(zoom * 100)}%`}
                disabled={!imagem || aGravar}
                onChange={event => {
                  if (!imagem) return;
                  aplicarZoom(imagem, { ox, oy, zoom }, Number(event.target.value), setZoom, setOx, setOy);
                }}
                className="mt-2 w-full accent-[#A60000]"
              />
            </label>
            <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
              <span>Roda do rato para aproximar. Arraste para enquadrar.</span>
              <button type="button" onClick={repor} disabled={!imagem || aGravar} className="font-semibold text-[#1C3350] hover:text-[#A60000] disabled:opacity-50">Repor</button>
            </div>
          </div>
        </div>
      </div>
    </AppModal>
  );
}

function aplicarZoom(
  imagem: HTMLImageElement,
  actual: { ox: number; oy: number; zoom: number },
  seguinte: number,
  setZoom: (valor: number) => void,
  setOx: (valor: number) => void,
  setOy: (valor: number) => void,
) {
  const zoom = limitar(seguinte, ZOOM_MIN, ZOOM_MAX);
  const antes = medidaRecorte(imagem.naturalWidth, imagem.naturalHeight, actual.zoom);
  const depois = medidaRecorte(imagem.naturalWidth, imagem.naturalHeight, zoom);
  const cx = (RECORTE_LARGURA / 2 - actual.ox) / antes.escala;
  const cy = (RECORTE_ALTURA / 2 - actual.oy) / antes.escala;
  const ox = limitar(RECORTE_LARGURA / 2 - cx * depois.escala, depois.minX, 0);
  const oy = limitar(RECORTE_ALTURA / 2 - cy * depois.escala, depois.minY, 0);
  actual.ox = ox;
  actual.oy = oy;
  actual.zoom = zoom;
  setZoom(zoom);
  setOx(ox);
  setOy(oy);
}
