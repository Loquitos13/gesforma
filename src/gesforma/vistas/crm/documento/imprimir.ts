// "Descarregar PDF": a mesma página (mesmas letras, margens e quebras) aberta numa janela de impressão A4.
import css from "./documento.css?raw";
import { urlLogoEntidade } from "../../../../partilhado/logoEntidade";
import { htmlParaImpressao, type Definicoes, type Valores } from "./modelo";

function escapar(s: string) {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

/** 640 px de página → 210 mm: a impressão usa a mesma escala que o PDF do servidor. */
const ESCALA = 793.7 / 640;

export function imprimirDocumento(o: {
  titulo: string; htmlEditor: string; def: Definicoes; valores: Valores; entidade: string; metaLinhas: string[];
}) {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return false;
  const origem = window.location.origin;
  const fontes = css.replace(/url\("\/fontes\//g, `url("${origem}/fontes/`);
  const corpo = htmlParaImpressao(o.htmlEditor, o.valores);
  const nome = o.def.mostrarNome
    ? `<span class="gf-cab-nome">${escapar(o.entidade)}</span>${o.def.subtitulo ? `<span class="gf-cab-sub">${escapar(o.def.subtitulo)}</span>` : ""}`
    : "";
  w.document.write(`<!doctype html><html lang="pt-PT"><head><meta charset="utf-8"><title>${escapar(o.titulo)}</title>
<style>${fontes}
@page { size: A4; margin: 21mm 22.31mm 21mm; @bottom-right { content: "Página " counter(page) " de " counter(pages); font: 7pt "GF Sans", sans-serif; color: #8a93a2; } }
html, body { margin: 0; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.gf-pagina { width: 504px; min-height: 0; padding: 0; box-shadow: none; zoom: ${ESCALA}; }
.gf-texto [data-quebra] { break-after: page; border: 0; margin: 0; height: 0; }
.gf-texto [data-quebra]::before { content: none; }
.gf-texto [data-campo] { background: none !important; color: inherit !important; padding: 0; }
.gf-texto p, .gf-texto li { orphans: 2; widows: 2; }
.gf-texto h2, .gf-texto h3 { break-after: avoid; }
</style></head><body>
<div class="gf-pagina">
<div class="gf-cab" data-pos="${o.def.logoPos}"><div class="gf-cab-marca"><img src="${escapar(urlLogoEntidade())}" alt="" style="height:${o.def.logoAltura}px">${nome}</div>
<p class="gf-cab-meta">${o.metaLinhas.map(escapar).join("<br>")}</p></div>
<div class="gf-texto">${corpo}</div></div></body></html>`);
  w.document.close();
  w.focus();
  const imprimir = () => setTimeout(() => w.print(), 150);
  const img = w.document.querySelector("img");
  Promise.all([
    w.document.fonts?.ready ?? Promise.resolve(),
    img && !img.complete ? new Promise(r => { img.addEventListener("load", r, { once: true }); img.addEventListener("error", r, { once: true }); }) : Promise.resolve(),
  ]).then(imprimir, imprimir);
  return true;
}
