// Desenha os textos com a formatação leve (ver textoFormatado.ts): o mesmo componente no site (página de cada serviço,
// cartões da página Empresas) e na pré-visualização do backoffice, para o que se vê ao escrever ser o que o site mostra.
// Só elementos React: nada do texto passa a HTML.
import type { CSSProperties, ReactNode } from "react";
import { analisarTexto, emPedacos, type Pedaco } from "./textoFormatado";

function pedacos(f: Pedaco[]): ReactNode[] {
  return f.map((p, i) => {
    switch (p.t) {
      case "texto": return p.v;
      case "quebra": return <br key={i} />;
      case "negrito": return <strong key={i} className="font-bold">{pedacos(p.f)}</strong>;
      case "italico": return <em key={i} className="italic">{pedacos(p.f)}</em>;
      case "ligacao": {
        const fora = p.href.startsWith("https://");
        return <a key={i} href={p.href} className="underline underline-offset-2 hover:no-underline" {...(fora ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{pedacos(p.f)}</a>;
      }
    }
  });
}

/**
 * Texto com parágrafos, listas, subtítulos, negrito, itálico e ligações.
 * `className`/`style` são os do bloco (tipografia); `nivel` é o do subtítulo (h3 por omissão; h4 dentro de cartões).
 */
export function TextoFormatado({ texto, className, style, nivel = 3 }: { texto: string | null | undefined; className?: string; style?: CSSProperties; nivel?: 3 | 4 }) {
  const blocos = analisarTexto(texto);
  if (blocos.length === 0) return null;
  const Sub = nivel === 4 ? "h4" : "h3";
  return (
    // pre-wrap: os espaços seguidos ficam como se escreveram; as mudanças de linha são <br>.
    <div className={["whitespace-pre-wrap break-words [tab-size:4] [&>*+*]:mt-[0.8em]", className].filter(Boolean).join(" ")} style={style}>
      {blocos.map((b, i) => {
        if (b.t === "paragrafo") return <p key={i}>{pedacos(b.f)}</p>;
        if (b.t === "subtitulo") return <Sub key={i} className="font-bold text-[1.1em] leading-snug">{pedacos(b.f)}</Sub>;
        const itens = b.itens.map((it, k) => <li key={k} className="pl-1">{pedacos(it)}</li>);
        return b.ordenada
          ? <ol key={i} start={b.inicio !== 1 ? b.inicio : undefined} className="list-decimal space-y-[0.3em] pl-[1.4em]">{itens}</ol>
          : <ul key={i} className="list-disc space-y-[0.3em] pl-[1.4em]">{itens}</ul>;
      })}
    </div>
  );
}

/** Uma linha só (ex.: cada ponto da lista com visto): negrito, itálico e ligações. */
export function TextoEmLinha({ texto }: { texto: string }) {
  return <>{pedacos(emPedacos(texto))}</>;
}
