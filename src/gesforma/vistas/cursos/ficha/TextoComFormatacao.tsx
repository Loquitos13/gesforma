// Caixa de texto dos textos do curso com formatação leve (partilhado/textoFormatado.ts): estilo do parágrafo (título,
// subtítulo, destaque, nota), negrito, itálico, sublinhado, ligação e listas sobre o texto selecionado; colagem do Word /
// Google Docs / páginas web com a formatação; e a pré-visualização como o site a mostra. Sem HTML: o site desenha as marcas.
import { useEffect, useRef, useState, type ClipboardEvent } from "react";
import { htmlParaTexto, normalizarColagem } from "../../../../partilhado/textoFormatado";
import { TextoFormatado } from "../../../../partilhado/TextoFormatadoVista";
import { AreaTexto, Botao } from "../../../../partilhado/ui";

/** Põe `texto` no lugar da seleção, pelo histórico do campo (Ctrl+Z desfaz); sem isso, muda o valor à mão. */
function inserir(el: HTMLTextAreaElement, texto: string, valor: string, onMudar: (v: string) => void, selecionar?: [number, number]) {
  const [a, b] = [el.selectionStart, el.selectionEnd];
  el.focus();
  let feito = false;
  try { feito = document.execCommand("insertText", false, texto); } catch { feito = false; }
  if (!feito) onMudar(valor.slice(0, a) + texto + valor.slice(b));
  requestAnimationFrame(() => {
    el.selectionStart = a + (selecionar?.[0] ?? texto.length);
    el.selectionEnd = a + (selecionar?.[1] ?? texto.length);
  });
}

/** Estilos de parágrafo: a marca no início da linha. */
const ESTILOS = [
  { valor: "", rotulo: "Parágrafo" },
  { valor: "# ", rotulo: "Título" },
  { valor: "## ", rotulo: "Subtítulo" },
  { valor: "### ", rotulo: "Título pequeno" },
  { valor: "> ", rotulo: "Destaque (texto maior)" },
  { valor: "-# ", rotulo: "Nota (texto pequeno)" },
] as const;

/** Marca de bloco no início da linha (estilo ou lista), para a trocar por outra. */
const MARCA_LINHA = /^[ \t]*(?:#{1,3}[ \t]+|-#[ \t]+|>[ \t]?|[-*•][ \t]+|\d{1,3}[.)][ \t]+)/;

export function TextoComFormatacao({ rotulo, valor, onMudar, linhas = 7, placeholder }: {
  rotulo: string; valor: string; onMudar: (v: string) => void; linhas?: number; placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [previa, setPrevia] = useState(false);
  // Estilo da linha onde está o cursor (ou da primeira linha selecionada): aparece escolhido no menu «Estilo».
  const [estiloAtual, setEstiloAtual] = useState("p");
  const lerEstilo = () => {
    const el = ref.current;
    if (!el) return;
    const ini = el.value.lastIndexOf("\n", el.selectionStart - 1) + 1;
    const fim = el.value.indexOf("\n", ini);
    const linha = el.value.slice(ini, fim < 0 ? el.value.length : fim);
    const e = ESTILOS.find(x => x.valor && linha.trimStart().startsWith(x.valor));
    setEstiloAtual(e ? e.valor : "p");
  };
  useEffect(() => { lerEstilo(); }, [valor]);

  function envolver(antes: string, depois: string, vazio: string) {
    const el = ref.current;
    if (!el) return;
    const sel = valor.slice(el.selectionStart, el.selectionEnd);
    // Espaços nas pontas da seleção ficam de fora das marcas («** texto**» não fica a negrito).
    const [, ini = "", meio = "", fim = ""] = /^(\s*)([\s\S]*?)(\s*)$/.exec(sel) ?? [];
    const conteudo = meio || vazio;
    inserir(el, `${ini}${antes}${conteudo}${depois}${fim}`, valor, onMudar,
      [ini.length + antes.length, ini.length + antes.length + conteudo.length]);
  }

  /** Aplica `marca(i)` ao início de cada linha tocada pela seleção (sem marca de bloco anterior). */
  function marcarLinhas(marca: (i: number, linha: string) => string) {
    const el = ref.current;
    if (!el) return;
    const ini = valor.lastIndexOf("\n", el.selectionStart - 1) + 1;
    const fimSel = Math.max(el.selectionStart, el.selectionEnd - (el.selectionEnd > el.selectionStart && valor[el.selectionEnd - 1] === "\n" ? 1 : 0));
    const quebra = valor.indexOf("\n", fimSel);
    const fim = quebra < 0 ? valor.length : quebra;
    let n = 0;
    const novo = valor.slice(ini, fim).split("\n").map(l => {
      if (!l.trim()) return l;
      const limpa = l.replace(MARCA_LINHA, "");
      return marca(n++, limpa) + limpa;
    }).join("\n");
    el.setSelectionRange(ini, fim);
    inserir(el, novo, valor, onMudar, [0, novo.length]);
  }

  /** Lista: se todas as linhas já são deste tipo de lista, tira-a; senão, põe-a. */
  function lista(numerada: boolean) {
    const el = ref.current;
    if (!el) return;
    const ini = valor.lastIndexOf("\n", el.selectionStart - 1) + 1;
    const quebra = valor.indexOf("\n", el.selectionEnd);
    const tocadas = valor.slice(ini, quebra < 0 ? valor.length : quebra).split("\n").filter(l => l.trim());
    const ja = tocadas.length > 0 && tocadas.every(l => (numerada ? /^[ \t]*\d{1,3}[.)][ \t]+/ : /^[ \t]*[-*•][ \t]+/).test(l));
    marcarLinhas(i => (ja ? "" : numerada ? `${i + 1}. ` : "- "));
  }

  /** Tira as marcas (negrito, itálico, sublinhado, ligações e estilos) do texto selecionado. */
  function limpar() {
    const el = ref.current;
    if (!el || el.selectionStart === el.selectionEnd) return;
    const sel = valor.slice(el.selectionStart, el.selectionEnd);
    const sem = sel
      .split("\n").map(l => l.replace(MARCA_LINHA, "")).join("\n")
      .replace(/\[([^\]\n]+)\]\([^)\s]+\)/g, "$1")
      .replace(/\*\*|__/g, "")
      .replace(/(^|[^*\w])\*(?=\S)([^*\n]+?)\*(?!\w)/g, "$1$2");
    inserir(el, sem, valor, onMudar, [0, sem.length]);
  }

  function ligacao() {
    const el = ref.current;
    if (!el) return;
    const url = window.prompt("Endereço da ligação (ex.: https://www.youtube.com/watch?v=…)", "https://")?.trim();
    if (!url || url === "https://") return;
    const href = /^https?:\/\//i.test(url) ? url.replace(/^http:/i, "https:") : `https://${url}`;
    const sel = valor.slice(el.selectionStart, el.selectionEnd).trim();
    inserir(el, `[${sel || "texto da ligação"}](${href})`, valor, onMudar, sel ? undefined : [1, 1 + "texto da ligação".length]);
  }

  function colar(ev: ClipboardEvent<HTMLTextAreaElement>) {
    const cd = ev.clipboardData;
    let texto = "";
    const html = cd.getData("text/html");
    if (html && typeof DOMParser !== "undefined") {
      try { texto = htmlParaTexto(new DOMParser().parseFromString(html, "text/html").body); } catch { texto = ""; }
    }
    texto = normalizarColagem(texto.trim() ? texto : cd.getData("text/plain"));
    if (!texto) return;
    ev.preventDefault();
    inserir(ev.currentTarget, texto, valor, onMudar);
  }

  const botao = "min-w-8 px-2 font-semibold";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label={`Formatação: ${rotulo}`}>
        <select aria-label="Estilo do parágrafo" title="Estilo das linhas selecionadas" value={estiloAtual}
          className="h-8 w-40 rounded-controlo border border-linha bg-superficie px-2 text-sm text-tinta"
          onChange={e => { const v = e.target.value; setEstiloAtual(v); marcarLinhas(() => (v === "p" ? "" : v)); }}>
          {ESTILOS.map(o => <option key={o.rotulo} value={o.valor || "p"}>{o.rotulo}</option>)}
        </select>
        <span className="mx-1 h-5 w-px bg-linha" aria-hidden="true" />
        <Botao variante="secundario" tamanho="sm" className={`${botao} font-extrabold`} title="Negrito (selecione o texto)" aria-label="Negrito"
          onMouseDown={e => e.preventDefault()} onClick={() => envolver("**", "**", "texto a negrito")}>N</Botao>
        <Botao variante="secundario" tamanho="sm" className={`${botao} italic`} title="Itálico (selecione o texto)" aria-label="Itálico"
          onMouseDown={e => e.preventDefault()} onClick={() => envolver("*", "*", "texto em itálico")}>I</Botao>
        <Botao variante="secundario" tamanho="sm" className={`${botao} underline`} title="Sublinhado (selecione o texto)" aria-label="Sublinhado"
          onMouseDown={e => e.preventDefault()} onClick={() => envolver("__", "__", "texto sublinhado")}>S</Botao>
        <Botao variante="secundario" tamanho="sm" className={botao} title="Ligação (vídeo, página…)" aria-label="Ligação"
          onMouseDown={e => e.preventDefault()} onClick={ligacao}>Ligação</Botao>
        <span className="mx-1 h-5 w-px bg-linha" aria-hidden="true" />
        <Botao variante="secundario" tamanho="sm" className={botao} title="Lista com marcas" aria-label="Lista com marcas"
          onMouseDown={e => e.preventDefault()} onClick={() => lista(false)}>• Lista</Botao>
        <Botao variante="secundario" tamanho="sm" className={botao} title="Lista numerada" aria-label="Lista numerada"
          onMouseDown={e => e.preventDefault()} onClick={() => lista(true)}>1. Lista</Botao>
        <Botao variante="fantasma" tamanho="sm" className={botao} title="Tirar a formatação do texto selecionado" aria-label="Limpar formatação"
          onMouseDown={e => e.preventDefault()} onClick={limpar}>Limpar</Botao>
        <Botao variante="fantasma" tamanho="sm" className="ml-auto" aria-pressed={previa} onClick={() => setPrevia(v => !v)}>
          {previa ? "Esconder pré-visualização" : "Pré-visualizar"}
        </Botao>
      </div>
      <AreaTexto ref={ref} aria-label={rotulo} rows={linhas} value={valor} onChange={e => onMudar(e.target.value)} onPaste={colar}
        onSelect={lerEstilo} onKeyUp={lerEstilo} onClick={lerEstilo}
        placeholder={placeholder} />
      <p className="m-0 text-xs text-tinta-suave">
        Selecione o texto e escolha o estilo ou carregue em <strong>N</strong>, <em>I</em> ou <u>S</u>. Uma linha em branco separa parágrafos.
        Ao colar do Word, Google Docs ou de uma página, a formatação (negrito, itálico, sublinhado, títulos, listas e ligações) fica.
      </p>
      {previa && valor.trim() && (
        <div className="rounded-md border border-linha bg-black/[0.02] px-3 py-2">
          <p className="m-0 mb-1 text-xs font-semibold text-tinta-suave">Como fica no site</p>
          <TextoFormatado texto={valor} className="text-sm leading-6 text-tinta" nivel={4} />
        </div>
      )}
    </div>
  );
}
