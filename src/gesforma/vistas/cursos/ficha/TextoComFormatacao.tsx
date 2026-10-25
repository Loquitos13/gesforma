// Caixa de texto dos textos do curso com formatação leve (partilhado/textoFormatado.ts): botões de negrito, itálico e
// ligação sobre o texto selecionado, colagem do Word / Google Docs / páginas web com o negrito e as ligações, e a
// pré-visualização como o site a mostra.
import { useRef, useState, type ClipboardEvent } from "react";
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

export function TextoComFormatacao({ rotulo, valor, onMudar, linhas = 7, placeholder }: {
  rotulo: string; valor: string; onMudar: (v: string) => void; linhas?: number; placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [previa, setPrevia] = useState(false);

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
        <Botao variante="secundario" tamanho="sm" className={`${botao} font-extrabold`} title="Negrito (selecione o texto)" aria-label="Negrito"
          onMouseDown={e => e.preventDefault()} onClick={() => envolver("**", "**", "texto a negrito")}>N</Botao>
        <Botao variante="secundario" tamanho="sm" className={`${botao} italic`} title="Itálico (selecione o texto)" aria-label="Itálico"
          onMouseDown={e => e.preventDefault()} onClick={() => envolver("*", "*", "texto em itálico")}>I</Botao>
        <Botao variante="secundario" tamanho="sm" className={botao} title="Ligação (vídeo, página…)" aria-label="Ligação"
          onMouseDown={e => e.preventDefault()} onClick={ligacao}>Ligação</Botao>
        <Botao variante="fantasma" tamanho="sm" className="ml-auto" aria-pressed={previa} onClick={() => setPrevia(v => !v)}>
          {previa ? "Esconder pré-visualização" : "Pré-visualizar"}
        </Botao>
      </div>
      <AreaTexto ref={ref} aria-label={rotulo} rows={linhas} value={valor} onChange={e => onMudar(e.target.value)} onPaste={colar}
        placeholder={placeholder} />
      <p className="m-0 text-xs text-tinta-suave">
        Selecione o texto e carregue em <strong>N</strong> para negrito. Ao colar do Word, Google Docs ou de uma página, o negrito e as ligações ficam.
        «- » no início da linha faz uma lista.
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
