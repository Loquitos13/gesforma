import { useEffect, useRef, useState } from "react";
import { AppModal } from "../partilhado/FormKit";

/** Largura:altura da fotografia na coluna do cartão de /formacao. */
export const RECORTE_RAZAO = 2 / 3;

const PREVIA_ALTURA = 112;
const PREVIA_LARGURA = Math.round(PREVIA_ALTURA * RECORTE_RAZAO);
const CAIXA_LARGURA = 460;
const CAIXA_ALTURA = 340;

type Canto = "nw" | "ne" | "sw" | "se";
type Janela = { x: number; y: number; w: number };
type Arrasto =
  | { tipo: "mover"; x: number; y: number; janela: Janela }
  | { tipo: "canto"; canto: Canto; janela: Janela };

const CANTOS: { id: Canto; className: string }[] = [
  { id: "nw", className: "left-1.5 top-1.5 cursor-nwse-resize" },
  { id: "ne", className: "right-1.5 top-1.5 cursor-nesw-resize" },
  { id: "sw", className: "bottom-1.5 left-1.5 cursor-nesw-resize" },
  { id: "se", className: "bottom-1.5 right-1.5 cursor-nwse-resize" },
];

function limitar(valor: number, min: number, max: number) {
  return Math.min(max, Math.max(min, valor));
}

function larguraMaxima(nw: number, nh: number) {
  return Math.min(nw, nh * RECORTE_RAZAO);
}

function larguraMinima(nw: number, nh: number) {
  const max = larguraMaxima(nw, nh);
  return Math.min(max, Math.max(max * 0.22, Math.min(max, 1)));
}

export function encaixarJanela(janela: Janela, nw: number, nh: number): Janela {
  const max = larguraMaxima(nw, nh);
  const min = larguraMinima(nw, nh);
  const w = limitar(janela.w, min, max);
  const h = w / RECORTE_RAZAO;
  return {
    w,
    x: limitar(janela.x, 0, Math.max(0, nw - w)),
    y: limitar(janela.y, 0, Math.max(0, nh - h)),
  };
}

export function janelaInicial(nw: number, nh: number): Janela {
  const w = larguraMaxima(nw, nh);
  const h = w / RECORTE_RAZAO;
  return { x: (nw - w) / 2, y: (nh - h) / 2, w };
}

function peloCanto(canto: Canto, px: number, py: number, inicio: Janela, nw: number, nh: number): Janela {
  const h0 = inicio.w / RECORTE_RAZAO;
  const direita = canto === "se" || canto === "ne";
  const baixo = canto === "se" || canto === "sw";
  const ax = direita ? inicio.x : inicio.x + inicio.w;
  const ay = baixo ? inicio.y : inicio.y + h0;
  const limite = Math.min(direita ? nw - ax : ax, (baixo ? nh - ay : ay) * RECORTE_RAZAO);
  const min = Math.min(limite, larguraMinima(nw, nh));
  const rawW = Math.max(0, direita ? px - ax : ax - px);
  const rawH = Math.max(0, baixo ? py - ay : ay - py);
  const proposta = rawH === 0 ? rawW : (rawW / rawH > RECORTE_RAZAO ? rawH * RECORTE_RAZAO : rawW);
  const w = limitar(proposta, min, Math.max(min, limite));
  const h = w / RECORTE_RAZAO;
  return encaixarJanela({
    w,
    x: direita ? ax : ax - w,
    y: baixo ? ay : ay - h,
  }, nw, nh);
}

function medidaDaCaixa(nw: number, nh: number) {
  const proporcao = nw / nh;
  let largura = CAIXA_LARGURA;
  let altura = largura / proporcao;
  if (altura > CAIXA_ALTURA) {
    altura = CAIXA_ALTURA;
    largura = altura * proporcao;
  }
  return { largura, altura, escala: largura / nw };
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
  const [janela, setJanela] = useState<Janela>({ x: 0, y: 0, w: 1 });
  const palco = useRef<HTMLDivElement>(null);
  const arrasto = useRef<Arrasto | null>(null);
  const vista = useRef({ janela, imagem });
  vista.current = { janela, imagem };

  function definir(seguinte: Janela) {
    const foto = vista.current.imagem;
    if (!foto) return;
    const encaixada = encaixarJanela(seguinte, foto.naturalWidth, foto.naturalHeight);
    vista.current.janela = encaixada;
    setJanela(encaixada);
  }

  useEffect(() => {
    let viva = true;
    const img = new Image();
    img.onload = () => {
      if (!viva) return;
      if (!img.naturalWidth || !img.naturalHeight) {
        setErro("Não foi possível ler esta imagem.");
        return;
      }
      const inicial = janelaInicial(img.naturalWidth, img.naturalHeight);
      setImagem(img);
      setErro("");
      setJanela(inicial);
    };
    img.onerror = () => { if (viva) setErro("Não foi possível ler esta imagem."); };
    img.src = origem;
    return () => { viva = false; };
  }, [origem]);

  const caixa = imagem ? medidaDaCaixa(imagem.naturalWidth, imagem.naturalHeight) : null;
  const altura = janela.w / RECORTE_RAZAO;

  function pontoNaFoto(clientX: number, clientY: number) {
    const foto = vista.current.imagem;
    const el = palco.current;
    if (!foto || !el) return null;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: ((clientX - rect.left) / rect.width) * foto.naturalWidth,
      y: ((clientY - rect.top) / rect.height) * foto.naturalHeight,
    };
  }

  function repor() {
    if (!imagem) return;
    definir(janelaInicial(imagem.naturalWidth, imagem.naturalHeight));
  }

  function guardar() {
    if (!imagem || aGravar) return;
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
    const actual = vista.current.janela;
    const sw = actual.w;
    const sh = sw / RECORTE_RAZAO;
    ctx.drawImage(imagem, actual.x, actual.y, sw, sh, 0, 0, saidaL, saidaA);
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

  const previaEscala = imagem ? PREVIA_LARGURA / janela.w : 1;

  return (
    <AppModal
      open
      size="2xl"
      title="Recortar a miniatura"
      sub="Arraste a janela sobre a capa. Puxe um canto para a aumentar ou reduzir, sempre na proporção do catálogo."
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
          <div className="mx-auto flex w-full shrink-0 flex-col gap-3 lg:mx-0" style={{ width: caixa?.largura ?? CAIXA_LARGURA }}>
            <div
              ref={palco}
              className="relative overflow-hidden bg-[#E7EBF0] select-none"
              style={caixa ? { width: caixa.largura, height: caixa.altura } : { width: CAIXA_LARGURA, height: 180 }}
            >
              {imagem && caixa && (
                <img src={origem} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full" />
              )}
              {imagem && (
                <div
                  role="application"
                  tabIndex={0}
                  aria-label="Janela de recorte. Arraste para a mover sobre a capa. Puxe um canto para mudar o tamanho."
                  className="absolute touch-none cursor-grab outline-none ring-2 ring-[#FFA900] ring-inset active:cursor-grabbing focus-visible:ring-[#A60000]"
                  style={{
                    left: `${(janela.x / imagem.naturalWidth) * 100}%`,
                    top: `${(janela.y / imagem.naturalHeight) * 100}%`,
                    width: `${(janela.w / imagem.naturalWidth) * 100}%`,
                    height: `${(altura / imagem.naturalHeight) * 100}%`,
                    boxShadow: "0 0 0 9999px rgba(20, 38, 61, 0.55)",
                  }}
                  onPointerDown={event => {
                    if (aGravar) return;
                    const canto = (event.target as HTMLElement).closest("[data-canto]")?.getAttribute("data-canto") as Canto | null;
                    event.currentTarget.setPointerCapture(event.pointerId);
                    arrasto.current = canto
                      ? { tipo: "canto", canto, janela: vista.current.janela }
                      : { tipo: "mover", x: event.clientX, y: event.clientY, janela: vista.current.janela };
                  }}
                  onPointerMove={event => {
                    const inicio = arrasto.current;
                    const foto = vista.current.imagem;
                    const el = palco.current;
                    if (!inicio || !foto || !el) return;
                    const rect = el.getBoundingClientRect();
                    if (inicio.tipo === "mover") {
                      const dx = ((event.clientX - inicio.x) / rect.width) * foto.naturalWidth;
                      const dy = ((event.clientY - inicio.y) / rect.height) * foto.naturalHeight;
                      definir({ x: inicio.janela.x + dx, y: inicio.janela.y + dy, w: inicio.janela.w });
                      return;
                    }
                    const ponto = pontoNaFoto(event.clientX, event.clientY);
                    if (!ponto) return;
                    definir(peloCanto(inicio.canto, ponto.x, ponto.y, inicio.janela, foto.naturalWidth, foto.naturalHeight));
                  }}
                  onPointerUp={() => { arrasto.current = null; }}
                  onPointerCancel={() => { arrasto.current = null; }}
                  onKeyDown={event => {
                    if (!imagem || aGravar) return;
                    const passo = event.shiftKey ? 24 : 8;
                    const delta = { ArrowLeft: [-passo, 0], ArrowRight: [passo, 0], ArrowUp: [0, -passo], ArrowDown: [0, passo] }[event.key];
                    if (!delta) return;
                    event.preventDefault();
                    definir({ x: janela.x + delta[0], y: janela.y + delta[1], w: janela.w });
                  }}
                >
                  <div className="pointer-events-none absolute inset-y-0 left-1/3 w-px bg-white/70" />
                  <div className="pointer-events-none absolute inset-y-0 left-2/3 w-px bg-white/70" />
                  <div className="pointer-events-none absolute inset-x-0 top-1/3 h-px bg-white/70" />
                  <div className="pointer-events-none absolute inset-x-0 top-2/3 h-px bg-white/70" />
                  {CANTOS.map(canto => (
                    <span
                      key={canto.id}
                      data-canto={canto.id}
                      className={`absolute z-10 h-3.5 w-3.5 rounded-sm border-2 border-white bg-[#1C3350] shadow ${canto.className}`}
                    />
                  ))}
                </div>
              )}
              {!imagem && !erro && (
                <div className="absolute inset-0 grid place-items-center text-xs text-slate-500">A ler a capa…</div>
              )}
            </div>
            <button
              type="button"
              onClick={repor}
              disabled={!imagem || aGravar}
              className="w-full rounded-lg border-2 border-[#1C3350] bg-white px-4 py-3 text-base font-semibold text-[#1C3350] hover:bg-[#1C3350] hover:text-white disabled:opacity-50"
            >
              Repor
            </button>
          </div>
          <div className="min-w-[240px] flex-1 space-y-4">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex" style={{ height: PREVIA_ALTURA }}>
                <div className="w-2 shrink-0 bg-[#FFA900]" />
                <div className="relative shrink-0 overflow-hidden bg-[#E7EBF0]" style={{ width: PREVIA_LARGURA }}>
                  {imagem && (
                    <img
                      src={origem}
                      alt=""
                      draggable={false}
                      className="absolute max-w-none"
                      style={{
                        width: imagem.naturalWidth * previaEscala,
                        height: imagem.naturalHeight * previaEscala,
                        left: -janela.x * previaEscala,
                        top: -janela.y * previaEscala,
                      }}
                    />
                  )}
                </div>
                <div className="flex flex-col justify-center px-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#1C3350]">ENA Gold</span>
                  <p className="mt-1 text-sm font-semibold text-slate-800">Pré-visualização do catálogo</p>
                  <p className="mt-1 text-xs text-slate-500">É o que a janela recorta.</p>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-500">A janela fica sempre na proporção 2:3 do catálogo.</p>
          </div>
        </div>
      </div>
    </AppModal>
  );
}
