// Barra de formatação da página A4 (negrito, listas, alinhamento, campos, quebras e cláusulas).
import { useState, type ReactNode, type RefObject } from "react";
import { CAMPOS, type Campo } from "./modelo";
import type { PaginaRef } from "./PaginaA4";

const ICONES: Record<string, string> = {
  lista: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01",
  numerada: "M10 6h10M10 12h10M10 18h10M4 5h1v4M4 9h2M4 15h2l-2 3h2",
  esquerda: "M4 6h16M4 10h10M4 14h16M4 18h10",
  centro: "M4 6h16M7 10h10M4 14h16M7 18h10",
  justificar: "M4 6h16M4 10h16M4 14h16M4 18h16",
  desfazer: "M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3",
  refazer: "m15 14 5-5-5-5M20 9H9a5 5 0 0 0 0 10h3",
};

function Icone({ d }: { d: string }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d={d} /></svg>;
}

function B({ rotulo, onClick, children, className = "" }: { rotulo?: string; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      title={rotulo}
      onMouseDown={e => e.preventDefault()}
      onClick={onClick}
      className={`h-8 min-w-8 px-1.5 rounded-md border-0 bg-transparent text-tinta cursor-pointer inline-flex items-center justify-center hover:bg-fundo focus-visible:outline-2 focus-visible:outline-[#1D4E89] ${className}`}
    >
      {children}
    </button>
  );
}

const Sep = () => <span aria-hidden="true" className="w-px h-[22px] bg-linha mx-1" />;

export const CLAUSULA = '<h3 class="gf-clausula">Título da cláusula</h3><p>Texto da cláusula.</p>';
export function clausulaOpcional(id = `op${Date.now().toString(36)}`) {
  return `<section data-opcional="${id}" data-ligada="1"><h3 class="gf-clausula">Cláusula opcional</h3><p>Texto que só entra quando a cláusula está ligada.</p></section><p><br></p>`;
}

export function BarraFormatacao({ pagina, estilos, antes, extra, campos = CAMPOS, mostrarCampos = true }: {
  pagina: RefObject<PaginaRef | null>;
  /** Rótulo do h3 no seletor de estilo: "Subtítulo" nas propostas, "Cláusula" nos contratos. */
  estilos: { h3: string };
  antes?: ReactNode;
  extra?: ReactNode;
  campos?: Campo[];
  mostrarCampos?: boolean;
}) {
  const [abertos, setAbertos] = useState(false);
  const cmd = (c: string, v?: string) => () => pagina.current?.comando(c, v);
  return (
    <>
      <div role="toolbar" aria-label="Formatação" className="flex items-center gap-1 flex-wrap px-2.5 py-2 border-b border-linha">
        {antes}
        <select
          aria-label="Estilo do parágrafo"
          defaultValue=""
          onChange={e => { const v = e.target.value; e.target.value = ""; if (v) pagina.current?.comando("formatBlock", v); }}
          className="h-8 border border-linha-forte rounded-md px-1.5 text-[13px] text-tinta bg-white"
        >
          <option value="" disabled>Estilo</option>
          <option value="p">Texto</option>
          <option value="h2">Título</option>
          <option value="h3">{estilos.h3}</option>
        </select>
        <Sep />
        <B rotulo="Negrito" onClick={cmd("bold")}><span className="font-bold">B</span></B>
        <B rotulo="Itálico" onClick={cmd("italic")}><span className="italic font-serif">I</span></B>
        <B rotulo="Sublinhado" onClick={cmd("underline")}><span className="underline">U</span></B>
        <B rotulo="Riscado" onClick={cmd("strikeThrough")}><span className="line-through">S</span></B>
        <Sep />
        <B rotulo="Lista com marcas" onClick={cmd("insertUnorderedList")}><Icone d={ICONES.lista!} /></B>
        <B rotulo="Lista numerada" onClick={cmd("insertOrderedList")}><Icone d={ICONES.numerada!} /></B>
        <Sep />
        <B rotulo="Alinhar à esquerda" onClick={cmd("justifyLeft")}><Icone d={ICONES.esquerda!} /></B>
        <B rotulo="Centrar" onClick={cmd("justifyCenter")}><Icone d={ICONES.centro!} /></B>
        <B rotulo="Justificar" onClick={cmd("justifyFull")}><Icone d={ICONES.justificar!} /></B>
        <Sep />
        {extra}
        {mostrarCampos && (
          <button
            type="button"
            aria-expanded={abertos}
            onClick={() => setAbertos(a => !a)}
            className="h-8 px-2.5 rounded-md border border-linha-forte bg-white text-[13px] text-tinta cursor-pointer hover:bg-fundo"
          >
            Inserir campo ▾
          </button>
        )}
        <span className="ml-auto inline-flex gap-0.5">
          <B rotulo="Desfazer" onClick={cmd("undo")}><Icone d={ICONES.desfazer!} /></B>
          <B rotulo="Refazer" onClick={cmd("redo")}><Icone d={ICONES.refazer!} /></B>
        </span>
      </div>
      {mostrarCampos && abertos && (
        <div className="flex gap-1.5 flex-wrap items-center px-3 py-2 border-b border-linha bg-[#FAFBFC] text-xs">
          <span className="text-tinta-suave">Clique para inserir no cursor:</span>
          {campos.map(c => <ChipCampo key={c.chave} campo={c} onInserir={() => pagina.current?.inserirCampo(c.chave)} />)}
        </div>
      )}
    </>
  );
}

export function ChipCampo({ campo, onInserir }: { campo: Campo; onInserir: () => void }) {
  return (
    <button
      type="button"
      onMouseDown={e => e.preventDefault()}
      onClick={onInserir}
      className="h-7 px-2 rounded-md border border-[#F2D9A6] bg-[#FFF7E6] text-[#7A4A00] text-xs cursor-pointer hover:border-[#E0B868]"
    >
      {campo.rotulo}
    </button>
  );
}

export function BotaoTexto({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return <B onClick={onClick} className="px-2 text-[13px]">{children}</B>;
}
