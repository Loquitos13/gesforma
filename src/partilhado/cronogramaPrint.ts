import {
  cellLabelPrint,
  cellTone,
  charsDaCelula,
  formatDataOficial,
  formatHoraFaixa,
  grupoLinha,
  larguraDiasEmChars,
  monthSpans,
  weekdayCode,
  type GrelhaLinha,
} from "./cronogramaGrelha";
import type { LocalMapeado } from "./cronogramaLocal";
import { codigoModulo, type SessaoCronograma } from "./turmaModel";

export type CronogramaPrintInput = {
  horario: string;
  curso?: string;
  nome?: string;
  codigo?: string;
  matricula?: string;
  inicio?: string;
  fim?: string;
  local: LocalMapeado;
  dates: string[];
  linhas: GrelhaLinha[];
  sessoes: SessaoCronograma[];
  /** Folha para mostrar dentro de outra página, sem abrir a impressão. */
  embutido?: boolean;
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

function linhaLabelSafe(l: GrelhaLinha) {
  if (l.modalidade === "sincrona") return "Sessão síncrona";
  if (l.modalidade === "presencial") return "Aula presencial";
  return "";
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

const GRUPO_MM = 26;
const HORA_MM = 22;
const MARGEM_MM = 7;
const A4_LARGURA_MM = 297;

/** Milímetros da coluna: o texto mais comprido (M7/M8, Aval., nome do mês) define a largura toda. */
export function largurasColunaMm(dates: string[], linhas: GrelhaLinha[], sessoes: SessaoCronograma[]) {
  const rotulos = dates.map(d => linhas.map(l => cellLabelPrint(sessoes, d, l)).filter(Boolean));
  const chars = larguraDiasEmChars(dates, rotulos);
  return chars.map((n, i) => {
    const cheio = rotulos[i]?.reduce((m, t) => Math.max(m, charsDaCelula(t)), 0) ?? 0;
    const mm = Math.max(7, n * 1.8 + (cheio > 4 ? 2.2 : 1.4));
    return Math.round(mm * 10) / 10;
  });
}

/**
 * O cronograma oficial é uma tabela única: o mesmo horário fica sempre na mesma
 * linha, com os meses lado a lado. Cada dia tem a largura do seu conteúdo.
 * Quando o período não cabe em A4 apaisado, é a folha que cresce.
 */
export function printPageSize(largurasDia: number[], linhas: number) {
  const soma = largurasDia.reduce((a, b) => a + b, 0);
  const fixo = GRUPO_MM + HORA_MM + MARGEM_MM * 2;
  const tabela = GRUPO_MM + HORA_MM + soma;
  const largura = Math.max(A4_LARGURA_MM, Math.ceil(fixo + soma));
  const altura = Math.max(210, Math.ceil(148 + linhas * 10));
  return { largura, altura, tabelaMm: Math.round(tabela * 100) / 100 };
}

function gridHtml(
  dates: string[],
  linhas: GrelhaLinha[],
  sessoes: SessaoCronograma[],
  larguras: number[],
  matricula?: string,
) {
  const months = monthSpans(dates);
  const leftCols = 2;
  const monthRow = months.map(m => `<th class="month" colspan="${m.count}">${esc(m.label)}</th>`).join("");
  const dayRow = dates.map(d => `<th class="day${d === matricula ? " mat" : ""}">${esc(String(Number(d.slice(8))))}</th>`).join("");
  const weekRow = dates.map(d => `<th class="wd${d === matricula ? " mat" : ""}">${esc(weekdayCode(d))}</th>`).join("");
  const cols = `<col class="c-group" /><col class="c-time" />${larguras.map(w => `<col style="width:${w}mm" />`).join("")}`;
  const grupos = (["presencial", "sincrona", "auto", "avaliacao"] as const)
    .map(g => groupRowsHtml(g, linhas.filter(l => l.modalidade === g), dates, sessoes, matricula))
    .join("");
  return `<table class="grid">
      <colgroup>${cols}</colgroup>
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
  const larguras = largurasColunaMm(input.dates, input.linhas, input.sessoes);
  const page = printPageSize(larguras, input.linhas.length);
  const grid = gridHtml(input.dates, input.linhas, input.sessoes, larguras, input.matricula);

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

  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8" />
  <title>${esc(tituloCronograma(input.horario))}</title>
  <style>
    @page { size: ${page.largura}mm ${page.altura}mm; margin: 8mm ${MARGEM_MM}mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #111; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; padding: 8px 10px 14px; }
    .sheet { width: ${page.tabelaMm}mm; min-width: 100%; background: #fff; }
    .head { display: flex; align-items: center; gap: 12px; border-bottom: 2px solid #a60000; padding-bottom: 6px; }
    .logo { height: 28px; width: auto; }
    .brand { flex: 1; text-align: center; }
    .brand h1 { margin: 0; font-size: 13px; letter-spacing: 0.01em; }
    .brand p { margin: 3px 0 0; font-size: 8px; color: #333; }
    h2.title { margin: 10px 0 2px; font-size: 18px; }
    .course { margin: 0 0 8px; font-size: 12px; font-weight: 700; }
    .meta { width: 100%; border-collapse: collapse; margin: 0 0 8px; font-size: 11px; }
    .meta td { border: none; padding: 2px 4px 2px 0; text-align: left; vertical-align: top; }
    .meta b { font-weight: 700; }
    table.grid { width: ${page.tabelaMm}mm; border-collapse: collapse; table-layout: fixed; }
    table.grid th, table.grid td { border: 1px solid #222; padding: 1px; vertical-align: middle; }
    col.c-group { width: ${GRUPO_MM}mm; }
    col.c-time { width: ${HORA_MM}mm; }
    .corner { background: #fff; }
    .month { background: #eee; font-size: 9px; font-weight: 700; white-space: nowrap; }
    .day { font-size: 9px; font-weight: 700; height: 18px; }
    .wd { font-size: 8px; font-weight: 600; text-transform: lowercase; color: #222; white-space: nowrap; }
    .group { text-align: left; font-size: 8px; font-weight: 700; padding: 3px 4px; line-height: 1.25; background: #fff; white-space: normal; }
    .time { text-align: left; font-size: 8px; font-weight: 600; padding: 2px 4px; white-space: nowrap; background: #fff; }
    .cell { font-size: 8px; font-weight: 700; min-height: 22px; height: auto; line-height: 1.15; text-align: center; white-space: normal; word-break: keep-all; overflow-wrap: normal; padding: 2px 1px; }
    .pres { background: #a60000; color: #fff; }
    .sinc { background: #1d4ed8; color: #fff; }
    .auto { background: #d4d4d4; color: #111; }
    .aval { background: #f5c518; color: #111; }
    .mat { background: #15803d; color: #fff; }
    .legend { margin-top: 12px; max-width: 260mm; }
    .legend h3 { margin: 0 0 6px; font-size: 11px; }
    .swatch { display: flex; align-items: flex-start; gap: 8px; margin: 3px 0; font-size: 9px; }
    .box { width: 13px; height: 13px; border: 1px solid #333; flex-shrink: 0; margin-top: 1px; }
    .keys { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 9px; }
    .keys td { border: none; padding: 1px 8px 1px 0; }
    .keys .key { font-weight: 700; width: 64px; }
    .actions { margin: 12px 0 0; display: flex; gap: 8px; }
    .actions button { font: 600 12px Arial, sans-serif; padding: 8px 14px; border-radius: 6px; border: 1px solid #111; background: #111; color: #fff; cursor: pointer; }
    .actions button.ghost { background: #fff; color: #111; }
    @media print {
      .actions { display: none !important; }
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="head">
      <svg class="logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 93.847 24.161" aria-label="ENA"><g transform="translate(-2081 -901)"><g transform="translate(-2)"><rect width="9" height="24" rx="4.5" transform="translate(2125 901)" fill="#a60000"/><rect width="6.179" height="23.603" rx="3.09" transform="translate(2125.853 907.433) rotate(-90)" fill="#a60000"/><rect width="7" height="24" rx="3.5" transform="translate(2142 901)" fill="#a60000"/></g><g transform="translate(2095.462 901.355)"><rect width="6.179" height="23.603" rx="3.09" transform="translate(0 6.179) rotate(-90)" fill="#a60000"/><rect width="6.179" height="23.603" rx="3.09" transform="translate(6.179 23.603) rotate(180)" fill="#a60000"/><rect width="6.179" height="23.603" rx="3.09" transform="translate(24.211 17.525) rotate(90)" fill="#a60000"/><rect width="6.179" height="23.603" rx="3.09" transform="translate(24.211 8.611) rotate(90)" fill="#a60000"/><rect width="6.179" height="14.79" rx="3.09" transform="translate(18.032 0)" fill="#a60000"/></g><rect width="10" height="24" rx="2" transform="translate(2081 901)" fill="#ffa900"/><g transform="translate(2150.635 901.456)"><rect width="6.179" height="23.603" rx="3.09" transform="translate(24.211 17.525) rotate(90)" fill="#a60000"/><rect width="6.179" height="23.603" rx="3.09" transform="translate(18.032 0.101)" fill="#a60000"/><rect width="6.179" height="23.603" rx="3.09" transform="translate(0 6.179) rotate(-90)" fill="#a60000"/><rect width="6.179" height="23.603" rx="3.09" transform="translate(0 15.094) rotate(-90)" fill="#a60000"/><rect width="6.179" height="14.79" rx="3.09" transform="translate(0 8.915)" fill="#a60000"/></g></g></svg>
      <div class="brand">
        <h1>VIVER APRENDER - Escola de Negócios e Administração, lda.</h1>
        <p>Rua Conselheiro Veloso da Cruz nº 524 - 4400-092 Vila Nova de Gaia :: Telf: 22 378 11 00 :: Fax: 22 378 11 09 :: E-mail: geral@ena.pt :: Site: www.ena.pt</p>
      </div>
    </div>
    <h2 class="title">${esc(tituloCronograma(input.horario))}</h2>
    <p class="course">${esc(tituloCurso(input.curso))}</p>
    <table class="meta">
      <tr>
        <td>Horário: <b>${esc(input.horario || "-")}</b></td>
        <td>Turma: <b>${esc(input.nome || "-")}</b></td>
      </tr>
      <tr>
        <td colspan="2">Código interno: <b>${esc(input.codigo || "-")}</b></td>
      </tr>
      <tr>
        <td>Data limite para realizar a matrícula : <b>${esc(input.matricula ? formatDataOficial(input.matricula) : "-")}</b></td>
        <td>Data de início: <b>${esc(input.inicio ? formatDataOficial(input.inicio) : "-")}</b></td>
      </tr>
      <tr>
        <td>Local de Realização: <b>${esc(localLinha)}</b>${moradaExtra ? ` &nbsp; ${esc(moradaExtra)}` : ""}</td>
        <td>Data de fim: <b>${esc(input.fim ? formatDataOficial(input.fim) : "-")}</b></td>
      </tr>
    </table>
    ${grid}
    <div class="legend">
      <h3>Legenda:</h3>
      <div class="swatch"><span class="box mat"></span><span>Data limite para realizar a matrícula e Instruções para início do curso (informação enviada por e-mail)</span></div>
      <div class="swatch"><span class="box pres"></span><span>Aulas presenciais em sala referentes a cada módulo</span></div>
      <div class="swatch"><span class="box sinc"></span><span>Sessão síncrona em vídeo-conferência</span></div>
      <div class="swatch"><span class="box auto"></span><span>Sessões em e-learning/auto-aprendizagem (com apoio a vídeos infográficos e conteúdos multimédia)</span></div>
      <div class="swatch"><span class="box aval"></span><span>Data limite para realização da avaliação referente ao(s) módulo(s) em causa</span></div>
      <table class="keys">
        ${legendKeys}
      </table>
    </div>
    ${input.embutido ? "" : `<div class="actions">
      <button type="button" onclick="window.print()">Imprimir / Guardar PDF</button>
      <button type="button" class="ghost" onclick="window.close()">Fechar</button>
    </div>`}
  </div>
  ${input.embutido ? "" : `<script>
    window.addEventListener("load", function () {
      setTimeout(function () { window.print(); }, 400);
    });
  </script>`}
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
