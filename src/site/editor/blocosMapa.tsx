// Bloco «Mapa (onde estamos)»: o Google Maps embebido com a morada escolhida e, ao lado, os contactos.
import type { ComponentConfig } from "@puckeditor/core";
import { campoNumero } from "./campos";
import { campoAparencia } from "./camposGrupos";
import { estiloBloco, estiloVazio, juntar, ligacaoSegura, type Estilo } from "./estilos";

export type MapaProps = {
  titulo: string; texto: string;
  /** O que se procura no Google Maps (nome e morada). */
  morada: string;
  /** Linhas ao lado do mapa («Texto | ligação» cria uma ligação; tel: e mailto: também). */
  contactos: string;
  altura: number | null;
  aparencia: Estilo;
};

function Linha({ linha }: { linha: string }) {
  const [texto, url] = linha.split("|").map(s => s.trim());
  const href = url ? ligacaoSegura(url) : "";
  return href ? <a href={href} className="underline decoration-current/30 underline-offset-4 hover:opacity-80">{texto}</a> : <span>{texto}</span>;
}

export const Mapa: ComponentConfig<MapaProps> = {
  label: "Mapa (onde estamos)",
  fields: {
    titulo: { type: "text", label: "Título" },
    texto: { type: "textarea", label: "Texto (opcional)" },
    morada: { type: "text", label: "Morada ou nome a mostrar no mapa" },
    contactos: { type: "textarea", label: "Contactos ao lado do mapa (\"Texto | ligação\" cria uma ligação)" },
    altura: campoNumero("Altura do mapa"),
    aparencia: campoAparencia(),
  },
  defaultProps: {
    titulo: "Onde estamos",
    texto: "",
    morada: "Escola de Negócios e Administração, R. do Conselheiro Veloso da Cruz 524, 4400-705 Vila Nova de Gaia",
    contactos: [
      "R. do Conselheiro Veloso da Cruz 524, 4400-705 Vila Nova de Gaia",
      "Telefone: 223 781 100 | tel:+351223781100",
      "Telemóvel: 912 744 205 | tel:+351912744205",
      "geral@ena.pt | mailto:geral@ena.pt",
      "Secretaria: 2ª a 6ª, 9h00–13h00 e 14h00–18h00",
    ].join("\n"),
    altura: 380,
    aparencia: estiloVazio(),
  },
  render: ({ puck, titulo, texto, morada, contactos, altura, aparencia }) => {
    const c = estiloBloco(aparencia);
    const src = `https://www.google.com/maps?q=${encodeURIComponent(morada || "Escola de Negócios e Administração")}&z=15&output=embed`;
    const linhas = (contactos ?? "").split("\n").filter(l => l.trim());
    return (
      <div ref={puck?.dragRef ?? undefined} className={juntar(c.className)} style={c.style}>
        {titulo && <h2 className="font-serif text-3xl font-bold text-[var(--c-primaria)]">{titulo}</h2>}
        {texto && <p className="mt-3 max-w-2xl text-sm leading-6 opacity-70">{texto}</p>}
        <div className={juntar("mt-6 grid gap-6", linhas.length ? "lg:grid-cols-[1fr_320px]" : "")}>
          {/* No editor, o mapa não recebe cliques (para se poder escolher o bloco). */}
          <iframe title={`Mapa: ${morada}`} src={src} loading="lazy" referrerPolicy="no-referrer-when-downgrade"
            className={juntar("w-full border-0", puck?.isEditing ? "pointer-events-none" : "")} style={{ height: `${altura ?? 380}px` }} />
          {linhas.length > 0 && (
            <address className="flex flex-col gap-2 text-sm not-italic leading-6">
              {linhas.map((l, i) => <Linha key={i} linha={l} />)}
            </address>
          )}
        </div>
      </div>
    );
  },
};
