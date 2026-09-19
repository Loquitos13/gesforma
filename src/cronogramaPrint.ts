import {
  cellLabelPrint,
  cellTone,
  formatDataOficial,
  formatHoraFaixa,
  grupoLinha,
  monthSpans,
  weekdayCode,
  type GrelhaLinha,
} from "./cronogramaGrelha";
import type { LocalMapeado } from "./cronogramaLocal";
import { codigoModulo, type SessaoCronograma } from "./turmaModel";

export type CronogramaPrintInput = {
  horario: string;
  curso?: string;
  matricula?: string;
  inicio?: string;
  fim?: string;
  local: LocalMapeado;
  dates: string[];
  linhas: GrelhaLinha[];
  sessoes: SessaoCronograma[];
};

function esc(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function tituloCurso(curso?: string) {
  const raw = (curso || "").trim();
  if (!raw) return "CURSO POR DEFINIR";
  if (/ccp|formadores/i.test(raw)) {
    return "FORMAÇÃO PEDAGÓGICA INICIAL DE FORMADORES (versão Blended- Learning)";
  }
  return raw.toUpperCase();
}

function tituloCronograma(horario?: string) {
  const h = (horario || "").trim();
  return h ? `Cronograma ${h}` : "Cronograma";
}

function toneClass(tone: string, matriculaCol: boolean) {
  if (matriculaCol && (tone === "empty" || tone === "matricula")) return "mat";
  if (tone === "presencial") return "pres";
  if (tone === "sincrona") return "sinc";
  if (tone === "auto") return "auto";
  if (tone === "avaliacao") return "aval";
  if (tone === "matricula") return "mat";
  return "";
}

function legendModulos(sessoes: SessaoCronograma[]) {
  const codes = [...new Set(
    sessoes.flatMap(s => (s.modulos ?? []).map(codigoModulo)).filter(Boolean),
  )].sort((a, b) => a.localeCompare(b, "pt"));
  if (!codes.length) {
    return [
      ["M1", "Aula Presencial do Módulo 1"],
      ["M2", "Aula Presencial do Módulo 2"],
      ["M3/M4", "Aula Presencial dos Módulos 3 e 4"],
      ["M5/M6", "Aula Presencial dos Módulos 5 e 6"],
      ["M7/M8", "Aula Presencial dos Módulos 7 e 8"],
      ["M9", "Aula Presencial do Módulo 9"],
    ];
  }
  return codes.map(code => {
    const n = code.replace(/^M/i, "");
    return [code, /^\d+$/.test(n) ? `Aula Presencial do Módulo ${n}` : `Aula / sessão ${code}`];
  });
}

function groupRowsHtml(
  grupo: GrelhaLinha["modalidade"],
  rows: GrelhaLinha[],
  dates: string[],
  sessoes: SessaoCronograma[],
  matricula?: string,
) {
  if (!rows.length) return "";
  const hideTime = grupo === "auto" || grupo === "avaliacao";
  return rows.map((linha, i) => {
    const groupCell = i === 0
      ? (hideTime
        ? `<th class="group" colspan="2" rowspan="${rows.length}">${esc(grupoLinha(grupo))}</th>`
        : `<th class="group" rowspan="${rows.length}">${esc(grupoLinha(grupo))}</th>`)
      : "";
    const timeCell = hideTime
      ? ""
      : `<th class="time">${esc(formatHoraFaixa(linha.horaInicio, linha.horaFim) || linhaLabelSafe(linha))}</th>`;
    const cells = dates.map(d => {
      const matCol = d === matricula;
      const tone = matCol && grupo === "presencial" && i === 0 && !cellLabelPrint(sessoes, d, linha)
        ? "matricula"
        : cellTone(sessoes, d, linha);
      const label = cellLabelPrint(sessoes, d, linha);
      return `<td class="cell ${toneClass(tone, matCol)}">${esc(label)}</td>`;
    }).join("");
    return `<tr>${groupCell}${timeCell}${cells}</tr>`;
  }).join("");
}

function linhaLabelSafe(l: GrelhaLinha) {
  if (l.modalidade === "sincrona") return "Sessão síncrona";
  if (l.modalidade === "presencial") return "Aula presencial";
  return "";
}

const DIAS_POR_PAGINA = 32;

export function paginasCronograma(dates: string[]) {
  if (!dates.length) return [] as string[][];
  const byMonth: string[][] = [];
  for (const d of dates) {
    const key = d.slice(0, 7);
    const last = byMonth[byMonth.length - 1];
    if (last && last[0]?.slice(0, 7) === key) last.push(d);
    else byMonth.push([d]);
  }
  const pages: string[][] = [];
  for (const month of byMonth) {
    if (month.length <= DIAS_POR_PAGINA) pages.push(month);
    else {
      for (let i = 0; i < month.length; i += DIAS_POR_PAGINA) {
        pages.push(month.slice(i, i + DIAS_POR_PAGINA));
      }
    }
  }
  return pages;
}

function grelhaHtml(input: CronogramaPrintInput, dates: string[]) {
  const months = monthSpans(dates);
  const leftCols = 2;
  const monthRow = months.map(m => `<th class="month" colspan="${m.count}">${esc(m.label)}</th>`).join("");
  const dayRow = dates.map(d => `<th class="day${d === input.matricula ? " mat" : ""}">${esc(String(Number(d.slice(8))))}</th>`).join("");
  const weekRow = dates.map(d => `<th class="wd${d === input.matricula ? " mat" : ""}">${esc(weekdayCode(d))}</th>`).join("");
  const grupos = (["presencial", "sincrona", "auto", "avaliacao"] as const)
    .map(g => groupRowsHtml(g, input.linhas.filter(l => l.modalidade === g), dates, input.sessoes, input.matricula))
    .join("");
  return `<table class="grid">
      <thead>
        <tr>
          <th class="corner" colspan="${leftCols}"></th>
          ${monthRow}
        </tr>
        <tr>
          <th class="corner" colspan="${leftCols}"></th>
          ${dayRow}
        </tr>
        <tr>
          <th class="corner" colspan="${leftCols}"></th>
          ${weekRow}
        </tr>
      </thead>
      <tbody>
        ${grupos || `<tr><td colspan="${leftCols + dates.length}" style="text-align:left;padding:8px">Sem linhas de horário neste cronograma.</td></tr>`}
      </tbody>
    </table>`;
}

export function buildCronogramaPrintHtml(input: CronogramaPrintInput) {
  const pages = paginasCronograma(input.dates);
  const folhas = pages.length ? pages : [input.dates];
  const mods = legendModulos(input.sessoes);
  const mid = Math.ceil(mods.length / 2);
  const legendKeys = Array.from({ length: Math.max(mid, mods.length - mid) }, (_, i) => {
    const a = mods[i];
    const b = mods[i + mid];
    return `<tr>
      ${a ? `<td class="key">${esc(a[0]!)}</td><td>${esc(a[1]!)}</td>` : "<td></td><td></td>"}
      ${b ? `<td class="key">${esc(b[0]!)}</td><td>${esc(b[1]!)}</td>` : "<td></td><td></td>"}
    </tr>`;
  }).join("");

  const localLinha = input.local.localizacao;
  const moradaExtra = input.local.morada
    && !/sala virtual|e-learning|moodle|zoom/i.test(input.local.morada)
    && !input.local.localizacao.includes(input.local.morada)
    ? input.local.morada
    : "";

  const letterhead = `<div class="head">
      <svg class="logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 93.847 24.161" aria-label="ENA"><g transform="translate(-2081 -901)"><g transform="translate(-2)"><rect width="9" height="24" rx="4.5" transform="translate(2125 901)" fill="#a60000"/><rect width="6.179" height="23.603" rx="3.09" transform="translate(2125.853 907.433) rotate(-90)" fill="#a60000"/><rect width="7" height="24" rx="3.5" transform="translate(2142 901)" fill="#a60000"/></g><g transform="translate(2095.462 901.355)"><rect width="6.179" height="23.603" rx="3.09" transform="translate(0 6.179) rotate(-90)" fill="#a60000"/><rect width="6.179" height="23.603" rx="3.09" transform="translate(6.179 23.603) rotate(180)" fill="#a60000"/><rect width="6.179" height="23.603" rx="3.09" transform="translate(24.211 17.525) rotate(90)" fill="#a60000"/><rect width="6.179" height="23.603" rx="3.09" transform="translate(24.211 8.611) rotate(90)" fill="#a60000"/><rect width="6.179" height="14.79" rx="3.09" transform="translate(18.032 0)" fill="#a60000"/></g><rect width="10" height="24" rx="2" transform="translate(2081 901)" fill="#ffa900"/><g transform="translate(2150.635 901.456)"><rect width="6.179" height="23.603" rx="3.09" transform="translate(24.211 17.525) rotate(90)" fill="#a60000"/><rect width="6.179" height="23.603" rx="3.09" transform="translate(18.032 0.101)" fill="#a60000"/><rect width="6.179" height="23.603" rx="3.09" transform="translate(0 6.179) rotate(-90)" fill="#a60000"/><rect width="6.179" height="23.603" rx="3.09" transform="translate(0 15.094) rotate(-90)" fill="#a60000"/><rect width="6.179" height="14.79" rx="3.09" transform="translate(0 8.915)" fill="#a60000"/></g></g></svg>
      <div class="brand">
        <h1>VIVER APRENDER - Escola de Negócios e Administração, lda.</h1>
        <p>Rua Conselheiro Veloso da Cruz nº 524 - 4400-092 Vila Nova de Gaia :: Telf: 22 378 11 00 :: Fax: 22 378 11 09 :: E-mail: geral@ena.pt :: Site: www.ena.pt</p>
      </div>
    </div>`;

  const meta = `<h2 class="title">${esc(tituloCronograma(input.horario))}</h2>
    <p class="course">${esc(tituloCurso(input.curso))}</p>
    <table class="meta">
      <tr>
        <td>Data limite para realizar a matrícula : <b>${esc(input.matricula ? formatDataOficial(input.matricula) : "—")}</b></td>
        <td>Data de início: <b>${esc(input.inicio ? formatDataOficial(input.inicio) : "—")}</b></td>
      </tr>
      <tr>
        <td>Local de Realização: <b>${esc(localLinha)}</b>${moradaExtra ? `<br/><span>${esc(moradaExtra)}</span>` : ""}</td>
        <td>Data de fim: <b>${esc(input.fim ? formatDataOficial(input.fim) : "—")}</b></td>
      </tr>
    </table>`;

  const legend = `<div class="legend">
      <h3>Legenda:</h3>
      <div class="swatch"><span class="box mat"></span><span>Data limite para realizar a matrícula e Instruções para início do curso (informação enviada por e-mail)</span></div>
      <div class="swatch"><span class="box pres"></span><span>Aulas presenciais em sala referentes a cada módulo</span></div>
      <div class="swatch"><span class="box sinc"></span><span>Sessão síncrona em vídeo-conferência</span></div>
      <div class="swatch"><span class="box auto"></span><span>Sessões em e-learning/auto-aprendizagem (com apoio a vídeos infográficos e conteúdos multimédia)</span></div>
      <div class="swatch"><span class="box aval"></span><span>Data limite para realização da avaliação referente ao(s) módulo(s) em causa</span></div>
      <table class="keys">
        ${legendKeys}
        <tr><td class="key">Sessão Síncrona</td><td>Aula em vídeo-conferência</td><td></td><td></td></tr>
      </table>
    </div>`;

  const sheets = folhas.map((dates, i) => {
    const last = i === folhas.length - 1;
    const pagina = folhas.length > 1 ? `<p class="page-num">Página ${i + 1} de ${folhas.length}</p>` : "";
    return `<section class="sheet">
    ${letterhead}
    ${meta}
    ${grelhaHtml(input, dates)}
    ${last ? legend : ""}
    ${pagina}
  </section>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8" />
  <title>${esc(tituloCronograma(input.horario))}</title>
  <style>
    @page { size: A4 landscape; margin: 8mm 7mm 8mm 7mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #e5e7eb; color: #111; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; padding: 12px; }
    .sheet { width: 100%; max-width: 1100px; margin: 0 auto 16px; background: #fff; padding: 10px 12px 14px; }
    .head { display: flex; align-items: center; gap: 12px; border-bottom: 2px solid #a60000; padding-bottom: 6px; }
    .logo { height: 28px; width: auto; }
    .brand { flex: 1; text-align: center; }
    .brand h1 { margin: 0; font-size: 13px; letter-spacing: 0.01em; }
    .brand p { margin: 3px 0 0; font-size: 8px; color: #333; }
    h2.title { margin: 10px 0 2px; font-size: 18px; }
    .course { margin: 0 0 8px; font-size: 12px; font-weight: 700; }
    .meta { width: 100%; border-collapse: collapse; margin: 0 0 8px; font-size: 11px; }
    .meta td { border: none; padding: 2px 4px 2px 0; text-align: left; }
    .meta b { font-weight: 700; }
    table.grid { width: 100%; border-collapse: collapse; table-layout: fixed; }
    table.grid th, table.grid td { border: 1px solid #222; padding: 1px 1px; vertical-align: middle; }
    .corner { background: #fff; width: 168px; }
    .month { background: #f3f4f6; font-size: 9px; text-transform: none; font-weight: 700; }
    .day { font-size: 8px; font-weight: 700; height: 16px; min-width: 20px; }
    .wd { font-size: 7px; font-weight: 600; text-transform: lowercase; color: #222; min-width: 20px; }
    .group { text-align: left; font-size: 8px; font-weight: 700; width: 88px; padding: 3px 4px; line-height: 1.25; background: #fff; white-space: normal; }
    .time { text-align: left; font-size: 8px; font-weight: 600; width: 80px; padding: 2px 4px; white-space: nowrap; background: #fff; }
    .cell { font-size: 8px; font-weight: 700; height: 24px; line-height: 1.05; text-align: center; word-break: break-word; min-width: 20px; }
    .pres { background: #a60000; color: #fff; }
    .sinc { background: #1d4ed8; color: #fff; }
    .auto { background: #d4d4d4; color: #111; }
    .aval { background: #f5c518; color: #111; }
    .mat { background: #ffa900; color: #111; }
    .legend { margin-top: 10px; }
    .legend h3 { margin: 0 0 6px; font-size: 11px; }
    .swatch { display: flex; align-items: flex-start; gap: 8px; margin: 3px 0; font-size: 9px; }
    .box { width: 13px; height: 13px; border: 1px solid #333; flex-shrink: 0; margin-top: 1px; }
    .keys { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 9px; }
    .keys td { border: none; padding: 1px 8px 1px 0; }
    .keys .key { font-weight: 700; width: 64px; }
    .page-num { text-align: right; font-size: 8px; color: #555; margin: 6px 0 0; }
    .actions { position: sticky; bottom: 0; max-width: 1100px; margin: 0 auto; padding: 10px 0; display: flex; gap: 8px; }
    .actions button { font: 600 12px Arial, sans-serif; padding: 8px 14px; border-radius: 6px; border: 1px solid #111; background: #111; color: #fff; cursor: pointer; }
    .actions button.ghost { background: #fff; color: #111; }
    @media print {
      html, body { background: #fff; padding: 0; }
      .sheet { max-width: none; margin: 0; padding: 0; break-after: page; page-break-after: always; box-shadow: none; }
      .sheet:last-of-type { break-after: auto; page-break-after: auto; }
      .actions { display: none !important; }
    }
  </style>
</head>
<body>
  ${sheets}
  <div class="actions">
    <button type="button" onclick="window.print()">Imprimir / Guardar PDF</button>
    <button type="button" class="ghost" onclick="window.close()">Fechar</button>
  </div>
  <script>
    window.addEventListener("load", function () {
      setTimeout(function () { window.print(); }, 400);
    });
  </script>
</body>
</html>`;
}

export function imprimirCronogramaEna(input: CronogramaPrintInput) {
  const html = buildCronogramaPrintHtml(input);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank");
  if (w) {
    w.focus();
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
    return;
  }
  const iframe = document.createElement("iframe");
  iframe.title = "Cronograma ENA";
  iframe.src = url;
  iframe.style.cssText = "position:fixed;inset:12px;width:auto;height:auto;z-index:99999;background:#fff;border:1px solid #111;border-radius:8px;box-shadow:0 12px 40px rgba(0,0,0,.25)";
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Fechar pré-visualização";
  close.style.cssText = "position:fixed;top:20px;right:24px;z-index:100000;font:600 12px Arial,sans-serif;padding:8px 12px;border-radius:6px;border:1px solid #111;background:#111;color:#fff;cursor:pointer";
  const cleanup = () => {
    iframe.remove();
    close.remove();
    URL.revokeObjectURL(url);
  };
  close.onclick = cleanup;
  document.body.append(iframe, close);
}
