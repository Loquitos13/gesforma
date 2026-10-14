// Página A4 editável: cabeçalho da entidade, texto com campos automáticos e guias de página.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { urlLogoEntidade } from "../../../../partilhado/logoEntidade";
import { preencherBlocos } from "./comum";
import { chipHtml, preencherCampos, type Definicoes, type Valores } from "./modelo";
import "./documento.css";

/** Altura útil de cada página (905 − 2 × 64). */
const UTIL = 777;

export type PaginaRef = {
  /** HTML actual do texto (sem o cabeçalho). */
  html: () => string;
  /** Repõe o texto (ex.: trocar de modelo). */
  repor: (html: string) => void;
  /** Corre um comando de edição na selecção guardada. */
  comando: (cmd: string, valor?: string) => void;
  inserirCampo: (chave: string) => void;
  inserirHtml: (html: string) => void;
  focar: () => void;
};

export const PaginaA4 = forwardRef<PaginaRef, {
  /** Muda quando se abre outro documento: o texto é reposto. */
  chave: string;
  htmlInicial: string;
  def: Definicoes;
  valores: Valores;
  /** Blocos automáticos (data-bloco), já em HTML. */
  blocos?: Record<string, string>;
  entidade: string;
  /** Linhas à direita do cabeçalho (número, data). */
  meta: ReactNode;
  editavel?: boolean;
  /** Muda depois de carregar outro logótipo (evita a imagem antiga em cache). */
  logoVersao?: string;
  realce?: boolean;
  modoCampos?: boolean;
  modelo?: boolean;
  rotulo: string;
  onMudar?: () => void;
  onPaginas?: (n: number) => void;
  onLogo?: () => void;
}>(function PaginaA4(p, ref) {
  const texto = useRef<HTMLDivElement>(null);
  const pagina = useRef<HTMLDivElement>(null);
  const selecao = useRef<Range | null>(null);
  const [guias, setGuias] = useState<number[]>([]);

  useLayoutEffect(() => {
    if (texto.current) texto.current.innerHTML = p.htmlInicial;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.chave]);

  const blocosJson = JSON.stringify(p.blocos ?? {});
  useEffect(() => {
    if (!texto.current) return;
    preencherCampos(texto.current, p.valores, p.modoCampos ? "campos" : "valores");
    preencherBlocos(texto.current, JSON.parse(blocosJson) as Record<string, string>);
  }, [p.valores, p.modoCampos, p.chave, blocosJson]);

  const medir = useCallback(() => {
    const el = pagina.current;
    if (!el) return;
    const total = Math.max(1, Math.ceil((el.scrollHeight - 128) / UTIL));
    setGuias(Array.from({ length: total - 1 }, (_, i) => 64 + UTIL * (i + 1)));
    p.onPaginas?.(total);
  }, [p]);

  useEffect(() => {
    const el = pagina.current;
    if (!el) return;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [medir]);

  function guardarSelecao() {
    const s = window.getSelection();
    if (s && s.rangeCount && texto.current?.contains(s.anchorNode)) selecao.current = s.getRangeAt(0).cloneRange();
  }

  function reporSelecao() {
    const el = texto.current;
    if (!el) return;
    el.focus();
    const s = window.getSelection();
    if (!s) return;
    if (selecao.current && el.contains(selecao.current.startContainer)) {
      s.removeAllRanges();
      s.addRange(selecao.current);
    } else if (!el.contains(s.anchorNode)) {
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      s.removeAllRanges();
      s.addRange(r);
    }
  }

  useImperativeHandle(ref, () => ({
    html: () => texto.current?.innerHTML ?? "",
    repor: html => {
      if (texto.current) {
        texto.current.innerHTML = html;
        preencherCampos(texto.current, p.valores, p.modoCampos ? "campos" : "valores");
        preencherBlocos(texto.current, p.blocos ?? {});
      }
      p.onMudar?.();
    },
    comando: (cmd, valor) => {
      reporSelecao();
      document.execCommand(cmd, false, valor);
      guardarSelecao();
      p.onMudar?.();
    },
    inserirCampo: chave => {
      reporSelecao();
      document.execCommand("insertHTML", false, `${chipHtml(chave)}&nbsp;`);
      if (texto.current) preencherCampos(texto.current, p.valores, p.modoCampos ? "campos" : "valores");
      guardarSelecao();
      p.onMudar?.();
    },
    inserirHtml: html => {
      reporSelecao();
      document.execCommand("insertHTML", false, html);
      guardarSelecao();
      p.onMudar?.();
    },
    focar: reporSelecao,
  }), [p]);

  const cabecalho = (
    <div className="gf-cab" data-pos={p.def.logoPos} contentEditable={false}>
      <div className="gf-cab-marca">
        {p.onLogo ? (
          <button type="button" onClick={p.onLogo} title="Trocar o logotipo" className="p-0 border-0 bg-transparent cursor-pointer rounded hover:outline hover:outline-2 hover:outline-offset-4 hover:outline-[#FFB020]">
            <img src={urlLogoEntidade(p.logoVersao)} alt="Logotipo da entidade" style={{ height: p.def.logoAltura }} />
          </button>
        ) : (
          <img src={urlLogoEntidade(p.logoVersao)} alt={p.entidade} style={{ height: p.def.logoAltura }} />
        )}
        {p.def.mostrarNome && <span className="gf-cab-nome">{p.entidade}</span>}
        {p.def.mostrarNome && p.def.subtitulo && <span className="gf-cab-sub">{p.def.subtitulo}</span>}
      </div>
      <p className="gf-cab-meta num">{p.meta}</p>
    </div>
  );

  return (
    <div ref={pagina} className={`gf-pagina ${p.realce ? "gf-realce" : ""} ${p.modelo ? "gf-modelo" : ""}`}>
      {cabecalho}
      <div
        ref={texto}
        className="gf-texto"
        role="textbox"
        aria-multiline="true"
        aria-label={p.rotulo}
        lang="pt-PT"
        spellCheck
        contentEditable={p.editavel ?? true}
        suppressContentEditableWarning
        onInput={() => { guardarSelecao(); p.onMudar?.(); }}
        onKeyUp={guardarSelecao}
        onMouseUp={guardarSelecao}
        onBlur={guardarSelecao}
        onPaste={e => {
          // Só texto: o que vem do Word ou da web traz estilos que o PDF não desenha.
          e.preventDefault();
          const t = e.clipboardData.getData("text/plain");
          document.execCommand("insertText", false, t);
        }}
      />
      {guias.map((y, i) => (
        <div key={y} className="gf-guia" style={{ top: y }} aria-hidden="true"><span>Página {i + 2}</span></div>
      ))}
    </div>
  );
});
