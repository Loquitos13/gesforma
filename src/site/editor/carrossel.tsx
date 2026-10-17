// Carrossel de um item de cada vez (testemunhos), segundo o padrão «Carousel» das WAI-ARIA Authoring Practices e as WCAG 2.2:
// controlos em botões verdadeiros, pausa da passagem automática (2.2.2), anúncio só quando não roda sozinho,
// teclado (setas), toque (deslizar), alvos ≥ 24 px (2.5.8), foco visível e sem animação com «reduzir movimento».
import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { Icon } from "../SiteLanding";

export type Transicao = "deslizar" | "desvanecer" | "nenhuma";

type Props = {
  itens: ReactNode[];
  /** Nome do carrossel para leitores de ecrã (ex.: o título do bloco). */
  rotulo: string;
  /** Nome de cada item («testemunho»): «2 de 5». */
  nomeItem: string;
  segundos: number;
  setas: boolean;
  transicao: Transicao;
  largura: number | null;
};

const reduzirMovimento = () => typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

export function Carrossel1a1({ itens, rotulo, nomeItem, segundos, setas, transicao, largura }: Props) {
  const total = itens.length;
  const [atual, setAtual] = useState(0);
  // O que sai (para a animação de saída) e o sentido: 1 = seguinte, -1 = anterior.
  const [saida, setSaida] = useState<{ indice: number; sentido: 1 | -1; chave: number } | null>(null);
  const [sentido, setSentido] = useState<1 | -1>(1);
  const [pausaUtilizador, setPausaUtilizador] = useState(false);
  const [pausaFoco, setPausaFoco] = useState(false);
  const [pausaRato, setPausaRato] = useState(false);
  const toque = useRef<number | null>(null);
  const indiceSeguro = total ? atual % total : 0;
  const automatico = segundos > 0 && total > 1;
  const aRodar = automatico && !pausaUtilizador && !pausaFoco && !pausaRato && !reduzirMovimento();
  const animar = transicao !== "nenhuma" && !reduzirMovimento();

  const ir = useCallback((novo: number, s: 1 | -1) => {
    if (total < 2) return;
    const destino = ((novo % total) + total) % total;
    if (destino === indiceSeguro) return;
    if (animar) setSaida({ indice: indiceSeguro, sentido: s, chave: Date.now() });
    setAtual(destino);
    setSentido(s);
  }, [total, animar, indiceSeguro]);

  useEffect(() => {
    if (!aRodar) return;
    const t = window.setInterval(() => ir(indiceSeguro + 1, 1), Math.max(3, segundos) * 1000);
    return () => window.clearInterval(t);
  }, [aRodar, segundos, indiceSeguro, ir]);

  // A cópia que sai só fica o tempo da animação.
  useEffect(() => {
    if (!saida) return;
    const t = window.setTimeout(() => setSaida(null), 450);
    return () => window.clearTimeout(t);
  }, [saida]);

  if (!total) return null;
  if (total === 1) return <div className="mx-auto w-full" style={{ maxWidth: largura ? `${largura}px` : undefined }}>{itens[0]}</div>;

  const teclas = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") { e.preventDefault(); ir(indiceSeguro + 1, 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); ir(indiceSeguro - 1, -1); }
  };
  const classeEntrada = !animar ? "" : transicao === "desvanecer" ? "ena-c1-entra-fade" : sentido === 1 ? "ena-c1-entra-dir" : "ena-c1-entra-esq";
  const classeSaida = !saida ? "" : transicao === "desvanecer" ? "ena-c1-sai-fade" : saida.sentido === 1 ? "ena-c1-sai-esq" : "ena-c1-sai-dir";
  const botao = "grid h-11 w-11 place-items-center rounded-full bg-white text-[var(--c-primaria,#1C3350)] shadow-[0_6px_18px_rgba(20,38,61,.16)] hover:brightness-95 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--c-destaque,#A60000)]";

  return (
    <section aria-roledescription="carrossel" aria-label={rotulo} className="mx-auto mt-6 w-full" style={{ maxWidth: largura ? `${largura}px` : undefined }}
      onKeyDown={teclas}
      onFocus={() => setPausaFoco(true)}
      onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPausaFoco(false); }}
      onMouseEnter={() => setPausaRato(true)} onMouseLeave={() => setPausaRato(false)}>
      {/* Anuncia o item novo só quando o carrossel não está a rodar sozinho (senão seria ruído contínuo). */}
      <div className="grid overflow-hidden" aria-live={aRodar ? "off" : "polite"}
        onTouchStart={e => { toque.current = e.touches[0]?.clientX ?? null; }}
        onTouchEnd={e => {
          const inicio = toque.current;
          const fim = e.changedTouches[0]?.clientX;
          toque.current = null;
          if (inicio == null || fim == null || Math.abs(fim - inicio) < 40) return;
          if (fim < inicio) ir(indiceSeguro + 1, 1); else ir(indiceSeguro - 1, -1);
        }}>
        {saida && saida.indice !== indiceSeguro && (
          <div key={`sai-${saida.chave}`} className={`ena-c1-item ${classeSaida}`} aria-hidden="true" inert>{itens[saida.indice]}</div>
        )}
        <div key={`entra-${indiceSeguro}-${saida?.chave ?? 0}`} className={`ena-c1-item ${classeEntrada}`}
          role="group" aria-roledescription={nomeItem} aria-label={`${indiceSeguro + 1} de ${total}`}>
          {itens[indiceSeguro]}
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        {setas && <button type="button" className={botao} onClick={() => ir(indiceSeguro - 1, -1)} aria-label={`${nomeItem[0]!.toUpperCase()}${nomeItem.slice(1)} anterior`}><span className="rotate-180"><Icon name="arrow" /></span></button>}
        <div className="flex items-center" role="group" aria-label={`Escolher ${nomeItem}`}>
          {Array.from({ length: total }, (_, i) => (
            <button key={i} type="button" onClick={() => ir(i, i > indiceSeguro ? 1 : -1)} aria-label={`Mostrar ${nomeItem} ${i + 1} de ${total}`}
              aria-current={i === indiceSeguro ? "true" : undefined}
              className="grid h-6 w-6 place-items-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--c-destaque,#A60000)]">
              <span className={`block h-2.5 rounded-full transition-all ${i === indiceSeguro ? "w-6 bg-[var(--c-primaria,#1C3350)]" : "w-2.5 bg-[var(--c-primaria,#1C3350)]/60"}`} />
            </button>
          ))}
        </div>
        {setas && <button type="button" className={botao} onClick={() => ir(indiceSeguro + 1, 1)} aria-label={`${nomeItem[0]!.toUpperCase()}${nomeItem.slice(1)} seguinte`}><Icon name="arrow" /></button>}
        {automatico && (
          <button type="button" className={botao} onClick={() => setPausaUtilizador(p => !p)}
            aria-label={pausaUtilizador ? "Retomar a passagem automática" : "Parar a passagem automática"}>
            {pausaUtilizador
              ? <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              : <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z" /></svg>}
          </button>
        )}
      </div>
    </section>
  );
}

/**
 * Grelha ou carrossel. O carrossel desliza na horizontal (também com o dedo) e mostra «colunas» cartões de cada vez;
 * avança sozinho de `segundos` em `segundos`, pára com o rato por cima e não se mexe com «reduzir movimento».
 */
export function Cartoes({ carrossel, segundos, setas, style, children }: { carrossel: boolean; segundos: number; setas: boolean; style: CSSProperties; children: ReactNode }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [parado, setParado] = useState(false);
  const mover = (sentido: 1 | -1) => {
    const el = caixa.current;
    if (!el) return;
    const fim = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
    if (sentido === 1 && fim) el.scrollTo({ left: 0, behavior: "smooth" });
    else el.scrollBy({ left: sentido * el.clientWidth, behavior: "smooth" });
  };
  useEffect(() => {
    if (!carrossel || !segundos || segundos <= 0 || parado) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(() => mover(1), Math.max(2, segundos) * 1000);
    return () => window.clearInterval(t);
  }, [carrossel, segundos, parado]);
  if (!carrossel) return <div className="ena-grelha mt-6 w-full" style={style}>{children}</div>;
  const seta = (sentido: 1 | -1) => (
    <button type="button" onClick={() => mover(sentido)} aria-label={sentido === 1 ? "Testemunhos seguintes" : "Testemunhos anteriores"}
      className="grid h-10 w-10 place-items-center rounded-full bg-white text-[var(--c-primaria)] shadow-[0_6px_18px_rgba(20,38,61,.16)] hover:brightness-95">
      <span className={sentido === -1 ? "rotate-180" : undefined}><Icon name="arrow" /></span>
    </button>
  );
  return (
    <div className="mt-6 w-full" onMouseEnter={() => setParado(true)} onMouseLeave={() => setParado(false)}
      onFocus={() => setParado(true)} onBlur={() => setParado(false)}>
      <div ref={caixa} className="ena-carrossel" style={style} role="region" aria-label="Testemunhos" tabIndex={0}>{children}</div>
      {setas && <div className="mt-4 flex justify-center gap-3">{seta(-1)}{seta(1)}</div>}
    </div>
  );
}
