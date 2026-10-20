import { type CtaAmbito, isCtaAmbito } from "./emailCta";

export type EmailDoc = {
  paragraphs: string[];
  cta: string;
  href: string;
  ambito?: CtaAmbito;
};

export function escapeXml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function unescapeXml(text: string) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

export function ctaTag(cta: string, href = "", ambito?: CtaAmbito) {
  const attrs = [
    ambito ? ` ambito="${ambito}"` : "",
    href ? ` href="${escapeXml(href)}"` : "",
  ].join("");
  return `<cta${attrs}>${escapeXml(cta)}</cta>`;
}

export function linesToXml(linhas: string[], cta: string, href = "", ambito?: CtaAmbito): string {
  const ps = linhas
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => `  <p>${escapeXml(l)}</p>`)
    .join("\n");
  return `<email>\n${ps}\n  ${ctaTag(cta, href, ambito)}\n</email>\n`;
}

export function parseEmailXml(xml: string): EmailDoc {
  const src = xml?.trim() || "";
  const tag = src.match(/<cta\b([^>]*)>([\s\S]*?)<\/cta>/i);
  const attrs = tag?.[1] ?? "";
  const cta = unescapeXml((tag?.[2] ?? "").trim());
  const href = unescapeXml((attrs.match(/\bhref\s*=\s*"([^"]*)"/i)?.[1] ?? "").trim());
  const ambitoRaw = (attrs.match(/\bambito\s*=\s*"([^"]*)"/i)?.[1] ?? "").trim();
  const ambito = isCtaAmbito(ambitoRaw) ? ambitoRaw : undefined;
  const paragraphs = [...src.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(m => innerToPlain(m[1]));
  if (paragraphs.length) return { paragraphs, cta, href, ambito };
  if (!src) return { paragraphs: [], cta, href, ambito };
  return {
    paragraphs: [src.replace(/<\/?email>|<\/?cta\b[^>]*>[\s\S]*$/gi, "").trim()].filter(Boolean),
    cta,
    href,
    ambito,
  };
}

export function replaceCta(xml: string, cta: string, href: string, ambito?: CtaAmbito) {
  const next = ctaTag(cta, href, ambito);
  if (/<cta\b/i.test(xml)) return xml.replace(/<cta\b[^>]*>[\s\S]*?<\/cta>/i, next);
  return linesToXml(parseEmailXml(xml).paragraphs, cta, href, ambito);
}

function innerToPlain(raw: string) {
  return unescapeXml(
    raw
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(?:strong|em)>/gi, "")
      .replace(/<(?:strong|em)>/gi, "")
      .replace(/<[^>]+>/g, ""),
  ).trim();
}
