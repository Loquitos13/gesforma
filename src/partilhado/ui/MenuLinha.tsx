import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cx } from "./formatos";

export type AcaoMenu = { rotulo: string; onClick: () => void; perigo?: boolean; desativado?: boolean; titulo?: string };

/** Menu "⋯" de uma linha: abre com clique ou teclado, fecha com Esc ou clique fora. */
export function MenuLinha({ rotulo, acoes }: { rotulo: string; acoes: AcaoMenu[] }) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  /** Posição fixa junto ao botão: o menu sai da tabela (que o cortava) e nunca passa do ecrã. */
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (!caixa.current?.contains(alvo) && !menu.current?.contains(alvo)) setAberto(false);
    };
    const fechar = () => setAberto(false);
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setAberto(false); botao.current?.focus(); }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const itens = [...(menu.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]:not([disabled])") ?? [])];
      if (!itens.length) return;
      e.preventDefault();
      const i = itens.indexOf(document.activeElement as HTMLButtonElement);
      const prox = e.key === "ArrowDown" ? (i + 1) % itens.length : (i - 1 + itens.length) % itens.length;
      itens[prox]?.focus();
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    // Ao fazer scroll ou mudar o tamanho da janela, a posição deixa de valer: fecha.
    menu.current?.querySelector<HTMLButtonElement>("[role=menuitem]:not([disabled])")?.focus({ preventScroll: true });
    window.addEventListener("scroll", fechar, true);
    window.addEventListener("resize", fechar);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", tecla);
      window.removeEventListener("scroll", fechar, true);
      window.removeEventListener("resize", fechar);
    };
  }, [aberto]);

  if (!acoes.length) return null;
  return (
    <div ref={caixa} className="relative inline-block" onClick={e => e.stopPropagation()}>
      <button
        ref={botao}
        type="button"
        aria-label={rotulo}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={id}
        onClick={() => {
          const r = botao.current?.getBoundingClientRect();
          if (r) {
            const alto = acoes.length * 36 + 10;
            const top = r.bottom + 4 + alto > window.innerHeight ? Math.max(8, r.top - 4 - alto) : r.bottom + 4;
            setPos({ top, right: Math.max(8, window.innerWidth - r.right) });
          }
          setAberto(a => !a);
        }}
        className="w-8 h-8 inline-flex items-center justify-center rounded-controlo text-tinta-suave hover:bg-fundo hover:text-tinta focus-visible:outline-2 focus-visible:outline-acao"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
      </button>
      {aberto && pos && createPortal(
        <div ref={menu} id={id} role="menu" onClick={e => e.stopPropagation()} style={{ top: pos.top, right: pos.right }}
          className="fixed z-[70] flex flex-col min-w-[200px] max-w-[calc(100vw-16px)] py-1 bg-superficie border border-linha rounded-cartao shadow-flutuante">
          {acoes.map(a => (
            <button
              key={a.rotulo}
              type="button"
              role="menuitem"
              disabled={a.desativado}
              title={a.titulo}
              onClick={() => { setAberto(false); a.onClick(); }}
              className={cx(
                "block w-full whitespace-nowrap text-left px-3 py-2 text-sm hover:bg-fundo focus:bg-fundo outline-none disabled:opacity-50 disabled:cursor-not-allowed",
                a.perigo ? "text-perigo" : "text-tinta",
              )}
            >
              {a.rotulo}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
