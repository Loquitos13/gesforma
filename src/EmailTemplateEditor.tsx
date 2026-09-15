import { useRef, useState } from "react";
import { linesToXml, parseEmailXml } from "./emailXml";

const VARS = [
  { k: "{{nome}}", l: "Nome" },
  { k: "{{email}}", l: "Email" },
  { k: "{{curso}}", l: "Curso" },
  { k: "{{turma}}", l: "Turma" },
];

export function EmailXmlEditor({
  xml,
  onChange,
}: {
  xml: string;
  onChange: (xml: string) => void;
}) {
  const [mode, setMode] = useState<"texto" | "xml">("texto");
  const textRef = useRef<HTMLTextAreaElement>(null);
  const xmlRef = useRef<HTMLTextAreaElement>(null);
  const doc = parseEmailXml(xml);
  const texto = doc.paragraphs.join("\n\n");

  function applyTexto(next: string) {
    onChange(linesToXml(next.split(/\n\n+/), doc.cta, doc.href, doc.ambito));
  }

  function insertAt(el: HTMLTextAreaElement | null, snippet: string, wrap?: { before: string; after: string }) {
    if (!el) return;
    const s = el.selectionStart;
    const e = el.selectionEnd;
    const value = el.value;
    const selected = value.slice(s, e);
    const piece = wrap ? `${wrap.before}${selected || "texto"}${wrap.after}` : snippet;
    const next = value.slice(0, s) + piece + value.slice(e);
    if (mode === "xml") onChange(next);
    else applyTexto(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = s + piece.length;
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
          {(["texto", "xml"] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md ${mode === m ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}
            >
              {m === "texto" ? "Texto" : "XML"}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {mode === "xml" && (
            <>
              <ToolBtn label="P" title="Parágrafo" onClick={() => insertAt(xmlRef.current, "", { before: "<p>", after: "</p>" })} />
              <ToolBtn label="N" title="Negrito" onClick={() => insertAt(xmlRef.current, "", { before: "<strong>", after: "</strong>" })} />
              <ToolBtn label="I" title="Itálico" onClick={() => insertAt(xmlRef.current, "", { before: "<em>", after: "</em>" })} />
            </>
          )}
          {VARS.map(v => (
            <ToolBtn key={v.k} label={v.l} title={v.k} onClick={() => insertAt(mode === "xml" ? xmlRef.current : textRef.current, v.k)} />
          ))}
        </div>
      </div>
      {mode === "texto" ? (
        <textarea
          ref={textRef}
          className="w-full min-h-[240px] px-3 py-2.5 text-sm leading-relaxed border border-slate-200 rounded-lg bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
          value={texto}
          onChange={e => applyTexto(e.target.value)}
          placeholder="Escreva o corpo do email. Parágrafos separados por uma linha em branco. Use {{nome}}, {{email}}, {{curso}} e {{turma}}."
        />
      ) : (
        <textarea
          ref={xmlRef}
          spellCheck={false}
          className="w-full min-h-[240px] px-3 py-2.5 text-[13px] leading-relaxed font-mono border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
          value={xml}
          onChange={e => onChange(e.target.value)}
        />
      )}
      <p className="text-[11px] text-slate-400">
        {mode === "xml"
          ? "Tags: <email>, <p>, <strong>, <em>, <cta href ambito>. Variáveis: {{nome}}, {{email}}, {{curso}}, {{turma}}."
          : "Uma linha em branco começa um parágrafo novo. O botão CTA tem destino próprio (pré-inscrição ou plataforma)."}
      </p>
    </div>
  );
}

function ToolBtn({ label, title, onClick }: { label: string; title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="px-2 py-1 text-[11px] font-semibold rounded-md border border-slate-200 text-slate-600 hover:bg-amber-50 hover:border-amber-200"
    >
      {label}
    </button>
  );
}
