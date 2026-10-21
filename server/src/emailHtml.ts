import { SECRETARIA_MAIL } from "./emailCta.js";
import { urlLogoPublico } from "./entidadeLogo.js";
import { fillVars, partesContactos, sanitizeHeader } from "./security.js";
import { escapeHtml } from "./xss.js";

const ASSINATURA = SECRETARIA_MAIL ? `Equipa ENA · ${SECRETARIA_MAIL}` : "Equipa ENA";

function esc(s: string) {
  return escapeHtml(s);
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

/** Contactos dos locais em 2 colunas (tabela, que os clientes de email respeitam); um local por célula. */
function quadroContactos(intro: string[], itens: string[]) {
  const celula = (item: string) => {
    const c = partesContactos(item);
    const corpo = c
      ? `<strong style="color:#0f172a;">${esc(c.nome)}</strong><br>${c.linhas.map(esc).join("<br>")}`
      : `• ${esc(item)}`;
    return `<td valign="top" width="50%" style="padding:0 12px 14px 0;font-size:13px;line-height:1.5;color:#334155;">${corpo}</td>`;
  };
  const linhas: string[] = [];
  for (let i = 0; i < itens.length; i += 2) {
    linhas.push(`<tr>${celula(itens[i]!)}${itens[i + 1] ? celula(itens[i + 1]!) : '<td width="50%"></td>'}</tr>`);
  }
  const titulo = intro.filter(Boolean).map(t => `<p style="margin:0 0 10px;font-size:14px;line-height:1.5;color:#334155;">${t}</p>`).join("");
  return `<div style="margin:8px 0 6px;padding-top:14px;border-top:1px solid #e2e8f0;">${titulo}<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${linhas.join("")}</table></div>`;
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
  // Um parágrafo com listas ({{…_itens}}) que ficaram todas vazias não sai (ex.: sem documentos em falta).
  const comLista = (p: string) => [...p.matchAll(/\{\{(\w+_itens)\}\}/g)].map(m => m[1]!);
  const listasVazias = (p: string) => { const ks = comLista(p); return ks.length > 0 && ks.every(k => !(input.vars[k] ?? "").trim()); };
  const paras = (rawParas.length ? rawParas : input.linhas).filter(p => p.trim() && !listasVazias(p));
  // Os contactos dos locais ({{telefones_itens}}) vão para o fim do email, num quadro de 2 colunas.
  const temContactos = (p: string) => p.includes("{{telefones_itens}}");
  const corpo = paras.filter(p => !temContactos(p));
  const introContactos = paras.filter(temContactos).map(p => p.replace("{{telefones_itens}}", "").replace(/(\s|<br\s*\/?>)+$/i, ""));
  const contactos = String(input.vars.telefones_itens ?? "").split("\n").map(sanitizeHeader).filter(Boolean);
  const paraHtml = corpo.map(p => `<p style="margin:0 0 14px;font-size:15px;line-height:1.5;color:#334155;">${renderInner(p, input.vars)}</p>`).join("");
  const contactosHtml = contactos.length ? quadroContactos(introContactos.map(p => renderInner(p, input.vars)), contactos) : "";
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
  // Logótipo carregado em Configurações › Entidade (sem ele, o endereço redirige para o logótipo ENA do site).
  const logo = urlLogoPublico(input.origin);
  const html = `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#f1f5f9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;">
<tr><td style="padding:28px 28px 8px;font-family:Arial,Helvetica,sans-serif;">
<img src="${esc(logo)}" alt="ENA" height="28" style="display:block;height:28px;width:auto;border:0;margin-bottom:18px;" />
<p style="margin:0 0 14px;font-size:15px;line-height:1.5;color:#0f172a;">Olá ${first},</p>
${paraHtml}
${button}
${contactosHtml}
<p style="margin:8px 0 0;padding-top:14px;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.4;color:#94a3b8;">${esc(ASSINATURA)}</p>
${note}
</td></tr></table>
${pixel}
</td></tr></table></body></html>`;

  const simples = (p: string) => decode(p.replace(/<br\s*\/?>/gi, "\n").replace(/<\/?(?:strong|em)>/gi, "").replace(/<[^>]+>/g, ""));
  const plainParas = corpo.map(simples);
  const contactosTexto = contactos.length
    ? [...introContactos.map(p => fillVars(simples(p), input.vars)), ...contactos.flatMap(c => {
      const partes = partesContactos(c);
      return partes ? ["", partes.nome, ...partes.linhas] : [`• ${c}`];
    })]
    : [];
  const text = [
    `Olá ${input.nome.split(" ")[0] || input.nome},`,
    "",
    ...plainParas.flatMap(l => fillVars(l, input.vars).replace(/<br\s*\/?>/gi, "\n").replace(/<\/?(?:strong|em)>/gi, "").split("\n")),
    "",
    cta,
    href,
    "",
    ...contactosTexto,
    "",
    ASSINATURA,
    input.note ?? "",
  ].filter((l, i, arr) => l !== "" || arr[i - 1] !== "").join("\n");

  return { text, html };
}
