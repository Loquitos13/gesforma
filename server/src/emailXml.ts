export function parseEmailXml(xml: string): { linhas: string[]; cta: string } {
  const src = xml?.trim() || "";
  const cta = decode((src.match(/<cta\b[^>]*>([\s\S]*?)<\/cta>/i)?.[1] ?? "").trim());
  const linhas = [...src.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(m =>
    decode(
      m[1]
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/?(?:strong|em)>/gi, "")
        .replace(/<[^>]+>/g, ""),
    ).trim(),
  ).filter(Boolean);
  return { linhas, cta };
}

function decode(text: string) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

export function linesToXml(linhas: string[], cta: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const ps = linhas.filter(Boolean).map(l => `  <p>${esc(l)}</p>`).join("\n");
  return `<email>\n${ps}\n  <cta>${esc(cta)}</cta>\n</email>\n`;
}
