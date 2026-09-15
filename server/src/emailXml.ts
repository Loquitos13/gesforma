import { type CtaAmbito, isCtaAmbito } from "./emailCta.js";

function decode(text: string) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function parseEmailXml(xml: string): { linhas: string[]; cta: string; href: string; ambito?: CtaAmbito } {
  const src = xml?.trim() || "";
  const tag = src.match(/<cta\b([^>]*)>([\s\S]*?)<\/cta>/i);
  const attrs = tag?.[1] ?? "";
  const cta = decode((tag?.[2] ?? "").trim());
  const href = decode((attrs.match(/\bhref\s*=\s*"([^"]*)"/i)?.[1] ?? "").trim());
  const ambitoRaw = (attrs.match(/\bambito\s*=\s*"([^"]*)"/i)?.[1] ?? "").trim();
  const ambito = isCtaAmbito(ambitoRaw) ? ambitoRaw : undefined;
  const linhas = [...src.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(m =>
    decode(
      m[1]
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/?(?:strong|em)>/gi, "")
        .replace(/<[^>]+>/g, ""),
    ).trim(),
  ).filter(Boolean);
  return { linhas, cta, href, ambito };
}

export function linesToXml(linhas: string[], cta: string, href = "", ambito?: CtaAmbito): string {
  const ps = linhas.filter(Boolean).map(l => `  <p>${esc(l)}</p>`).join("\n");
  const attrs = [ambito ? ` ambito="${ambito}"` : "", href ? ` href="${esc(href)}"` : ""].join("");
  return `<email>\n${ps}\n  <cta${attrs}>${esc(cta)}</cta>\n</email>\n`;
}
