import { useRef, useState } from "react";
import { Botao, Separadores, cx } from "../partilhado/ui";
import { linesToXml, parseEmailXml } from "./emailXml";

const CONTROLO = "w-full min-h-[240px] px-3 py-2.5 rounded-controlo border border-linha-forte bg-superficie text-sm leading-relaxed text-tinta";

/**
 * Corpo de um email automático: modo texto (parágrafos) ou XML (<p>, <strong>, <em>, <cta>).
 * `variaveis` vem do servidor (`/v1/email/opcoes`).
 */
export function EmailXmlEditor({ xml, onChange, variaveis }: { xml: string; onChange: (xml: string) => void; variaveis: string[] }) {
  const [modo, setModo] = useState<"texto" | "xml">("texto");
  const textRef = useRef<HTMLTextAreaElement>(null);
  const xmlRef = useRef<HTMLTextAreaElement>(null);
  const doc = parseEmailXml(xml);
  const texto = doc.paragraphs.join("\n\n");

  function aplicarTexto(next: string) {
    onChange(linesToXml(next.split(/\n\n+/), doc.cta, doc.href, doc.ambito));
  }

  function inserir(el: HTMLTextAreaElement | null, trecho: string, envolver?: { antes: string; depois: string }) {
    if (!el) return;
    const s = el.selectionStart;
    const e = el.selectionEnd;
    const valor = el.value;
    const pedaco = envolver ? `${envolver.antes}${valor.slice(s, e) || "texto"}${envolver.depois}` : trecho;
    const next = valor.slice(0, s) + pedaco + valor.slice(e);
    if (modo === "xml") onChange(next);
    else aplicarTexto(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = s + pedaco.length;
      el.setSelectionRange(pos, pos);
    });
  }

  const alvo = () => (modo === "xml" ? xmlRef.current : textRef.current);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Separadores rotulo="Modo do editor" estilo="pilula" ativo={modo} onMudar={setModo} itens={[{ id: "texto", rotulo: "Texto" }, { id: "xml", rotulo: "XML" }]} />
        <div className="flex flex-wrap gap-1 ml-auto" role="toolbar" aria-label="Inserir">
          {modo === "xml" && (
            <>
              <Botao tamanho="sm" variante="secundario" title="Parágrafo" onClick={() => inserir(xmlRef.current, "", { antes: "<p>", depois: "</p>" })}>P</Botao>
              <Botao tamanho="sm" variante="secundario" title="Negrito" className="font-bold" onClick={() => inserir(xmlRef.current, "", { antes: "<strong>", depois: "</strong>" })}>N</Botao>
              <Botao tamanho="sm" variante="secundario" title="Itálico" className="italic" onClick={() => inserir(xmlRef.current, "", { antes: "<em>", depois: "</em>" })}>I</Botao>
            </>
          )}
          {variaveis.map(v => (
            <Botao key={v} tamanho="sm" variante="secundario" title={`Inserir {{${v}}}`} onClick={() => inserir(alvo(), `{{${v}}}`)}>{`{{${v}}}`}</Botao>
          ))}
        </div>
      </div>
      {modo === "texto" ? (
        <textarea
          ref={textRef}
          aria-label="Corpo do email"
          className={CONTROLO}
          value={texto}
          onChange={e => aplicarTexto(e.target.value)}
          placeholder="Escreva o corpo do email. Uma linha em branco começa um parágrafo novo."
        />
      ) : (
        <textarea
          ref={xmlRef}
          aria-label="Corpo do email em XML"
          spellCheck={false}
          className={cx(CONTROLO, "font-mono text-[13px] bg-fundo")}
          value={xml}
          onChange={e => onChange(e.target.value)}
        />
      )}
      <p className="m-0 text-xs text-tinta-suave">
        {modo === "xml"
          ? "Tags: <email>, <p>, <strong>, <em>, <cta ambito>. No modo texto perde-se o negrito e o itálico."
          : "O botão do email edita-se em baixo. A pré-visualização mostra o email tal como sai."}
      </p>
    </div>
  );
}
