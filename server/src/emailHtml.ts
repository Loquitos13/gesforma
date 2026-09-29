import { fillVars } from "./security.js";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function decode(text: string) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

function renderInner(raw: string, vars: Record<string, string>) {
  const filled = fillVars(raw, vars);
  const re = /<(strong|em)>([\s\S]*?)<\/\1>|<br\s*\/?>/gi;
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(filled))) {
    out += esc(decode(filled.slice(last, m.index)));
    if (/^<br/i.test(m[0])) out += "<br>";
    else {
      const tag = m[1].toLowerCase();
      out += `<${tag}>${esc(decode(m[2] ?? ""))}</${tag}>`;
    }
    last = m.index + m[0].length;
  }
  out += esc(decode(filled.slice(last)));
  return out;
}

function safeHref(href: string) {
  const h = href.trim();
  if (/^(https?:\/\/|mailto:)/i.test(h)) return h;
  return "";
}

export function renderAutomaticEmail(input: {
  nome: string;
  xml: string;
  linhas: string[];
  cta: string;
  href: string;
  vars: Record<string, string>;
  origin: string;
  pixelUrl?: string;
  note?: string;
}) {
  const first = esc(input.nome.split(" ")[0] || input.nome);
  const rawParas = [...(input.xml.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi) ?? [])].map(m => m[1]);
  const paras = (rawParas.length ? rawParas : input.linhas).filter(p => p.trim());
  const paraHtml = paras.map(p => `<p style="margin:0 0 14px;font-size:15px;line-height:1.5;color:#334155;">${renderInner(p, input.vars)}</p>`).join("");
  const cta = fillVars(input.cta, input.vars).trim();
  const href = safeHref(input.href);
  const button = cta && href
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 16px;"><tr><td bgcolor="#f59e0b" style="border-radius:8px;"><a href="${esc(href)}" style="display:inline-block;padding:12px 18px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">${esc(cta)}</a></td></tr></table><p style="margin:0 0 16px;font-size:12px;line-height:1.4;color:#94a3b8;word-break:break-all;">${esc(href)}</p>`
    : cta
      ? `<p style="margin:0 0 16px;font-size:15px;font-weight:700;color:#0f172a;">${esc(cta)}</p>`
      : "";
  const note = input.note
    ? `<p style="margin:16px 0 0;font-size:12px;line-height:1.4;color:#94a3b8;">${esc(input.note)}</p>`
    : "";
  const pixel = input.pixelUrl
    ? `<img src="${esc(input.pixelUrl)}" width="1" height="1" alt="" style="display:block;border:0;" />`
    : "";
  const logo = `${input.origin.replace(/\/$/, "")}/imagens/ena-logo-nobg.png`;
  const html = `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#f1f5f9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;">
<tr><td style="padding:28px 28px 8px;font-family:Arial,Helvetica,sans-serif;">
<img src="${esc(logo)}" alt="ENA" height="28" style="display:block;height:28px;width:auto;border:0;margin-bottom:18px;" />
<p style="margin:0 0 14px;font-size:15px;line-height:1.5;color:#0f172a;">Olá ${first},</p>
${paraHtml}
${button}
<p style="margin:8px 0 0;padding-top:14px;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.4;color:#94a3b8;">Equipa ENA · formacao@ena.pt</p>
${note}
</td></tr></table>
${pixel}
</td></tr></table></body></html>`;

  const plainParas = paras.map(p => decode(p.replace(/<br\s*\/?>/gi, "\n").replace(/<\/?(?:strong|em)>/gi, "").replace(/<[^>]+>/g, "")));
  const text = [
    `Olá ${input.nome.split(" ")[0] || input.nome},`,
    "",
    ...plainParas.flatMap(l => fillVars(l, input.vars).split("\n")),
    "",
    cta,
    href,
    "",
    "Equipa ENA · formacao@ena.pt",
    input.note ?? "",
  ].filter((l, i, arr) => l !== "" || arr[i - 1] !== "").join("\n");

  return { text, html };
}
