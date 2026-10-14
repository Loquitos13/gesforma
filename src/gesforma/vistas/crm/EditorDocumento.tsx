// Editor do texto de propostas, contratos e modelos: campos automáticos e pré-visualização em A4.
import { useRef, useState } from "react";
import { AreaTexto, Botao, Separadores, data, eur } from "../../../partilhado/ui";

/** Campos que o texto pode usar. Na pré-visualização são trocados pelos dados do documento. */
export const CAMPOS = [
  { chave: "cliente", rotulo: "Cliente" },
  { chave: "email", rotulo: "Email" },
  { chave: "curso", rotulo: "Curso" },
  { chave: "valor", rotulo: "Valor" },
  { chave: "data", rotulo: "Data" },
] as const;

export type ValoresDoc = Partial<{ cliente: string; email: string; curso: string; valor: number; data: string }>;

/** Texto final: troca {{campo}} pelos valores; campos sem valor ficam visíveis entre parênteses rectos. */
export function preencher(texto: string, v: ValoresDoc) {
  const valores: Record<string, string> = {
    cliente: v.cliente ?? "",
    email: v.email ?? "",
    curso: v.curso ?? "",
    valor: v.valor ? eur(v.valor, true) : "",
    data: data(v.data ?? new Date().toISOString().slice(0, 10)),
  };
  return texto.replace(/\{\{\s*([a-z]+)\s*\}\}/g, (m, k: string) => (k in valores ? valores[k] || `[${k}]` : m));
}

function escapar(s: string) {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

/** Abre o texto numa janela própria e chama a impressão (daí guarda-se em PDF). */
export function imprimir(titulo: string, texto: string) {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return false;
  w.document.write(`<!doctype html><html lang="pt-PT"><head><meta charset="utf-8"><title>${escapar(titulo)}</title>
<style>@page{size:A4;margin:22mm 20mm}body{font-family:"Public Sans",Arial,sans-serif;color:#18202C;font-size:11pt;line-height:1.55}
h1{font-size:15pt;margin:0 0 14pt}p{margin:0 0 9pt;white-space:pre-wrap}</style></head><body>
<h1>${escapar(titulo)}</h1>${texto.split(/\n{2,}/).map(p => `<p>${escapar(p)}</p>`).join("")}</body></html>`);
  w.document.close();
  w.focus();
  w.print();
  return true;
}

export function EditorDocumento({ valor, onMudar, valores, titulo, soLeitura, rotulo = "Texto" }: {
  valor: string;
  onMudar: (v: string) => void;
  valores: ValoresDoc;
  titulo: string;
  soLeitura?: boolean;
  rotulo?: string;
}) {
  const [modo, setModo] = useState<"editar" | "ver">(soLeitura ? "ver" : "editar");
  const area = useRef<HTMLTextAreaElement>(null);

  function inserir(chave: string) {
    const el = area.current;
    const marca = `{{${chave}}}`;
    if (!el) return onMudar(valor + marca);
    const a = el.selectionStart ?? valor.length;
    const b = el.selectionEnd ?? valor.length;
    onMudar(valor.slice(0, a) + marca + valor.slice(b));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + marca.length, a + marca.length);
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[13px] font-medium text-tinta">{rotulo}</span>
        <Separadores
          className="ml-auto"
          estilo="pilula"
          rotulo="Modo do editor"
          ativo={modo}
          onMudar={setModo}
          itens={[{ id: "editar", rotulo: "Editar", desativado: soLeitura }, { id: "ver", rotulo: "Pré-visualizar" }]}
        />
      </div>
      {modo === "editar" ? (
        <>
          <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Inserir campo automático">
            <span className="text-xs text-tinta-suave">Inserir campo:</span>
            {CAMPOS.map(c => (
              <button
                key={c.chave}
                type="button"
                onClick={() => inserir(c.chave)}
                className="h-7 px-2.5 rounded-full border border-ligacao/30 bg-ligacao-suave text-xs font-semibold text-ligacao hover:border-ligacao"
              >
                {c.rotulo}
              </button>
            ))}
          </div>
          <AreaTexto
            ref={area}
            aria-label={rotulo}
            value={valor}
            onChange={e => onMudar(e.target.value)}
            className="min-h-[260px] font-[inherit] leading-relaxed"
            placeholder="Escreva o texto. Os campos automáticos (ex.: {{cliente}}) são preenchidos com os dados do documento."
          />
        </>
      ) : (
        <div className="rounded-cartao border border-linha bg-fundo p-3 sm:p-5 overflow-x-auto">
          <article className="mx-auto bg-white shadow-sm border border-linha-suave px-6 sm:px-12 py-10 max-w-[680px] min-h-[420px] text-[14px] leading-relaxed text-tinta">
            <h3 className="m-0 mb-4 text-base font-semibold">{titulo}</h3>
            {valor.trim()
              ? preencher(valor, valores).split(/\n{2,}/).map((p, i) => <p key={i} className="m-0 mb-3 whitespace-pre-wrap">{p}</p>)
              : <p className="m-0 text-tinta-suave">Sem texto.</p>}
          </article>
        </div>
      )}
      <div className="flex justify-end">
        <Botao tamanho="sm" variante="fantasma" onClick={() => imprimir(titulo, preencher(valor, valores))} disabled={!valor.trim()}>
          Imprimir / guardar PDF
        </Botao>
      </div>
    </div>
  );
}
