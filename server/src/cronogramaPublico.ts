export type SessaoPublica = {
  data: string;
  horaInicio: string;
  horaFim: string;
  modalidade: string;
  modulos: string[];
  formadores: string[];
};

const MODALIDADE: Record<string, string> = {
  presencial: "Presencial",
  sincrona: "Síncrona",
  auto: "Auto-aprendizagem",
  avaliacao: "Avaliação",
  matricula: "Matrícula",
};

function esc(value: string) {
  return value.replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch] ?? ch);
}

function asText(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function codigoModulo(nome: string) {
  const tagged = nome.trim().match(/^(M\d+|C\d+|UFCD\s*\d+|EX\d+|AV\d+)/i);
  return (tagged ? tagged[1] : nome.split("·")[0] ?? nome).replace(/\s+/g, " ").trim();
}

function ordemCodigo(nome: string) {
  return Number(codigoModulo(nome).match(/(\d+)/)?.[1] ?? 9999);
}

export function modulosPorOrdem(modulos: string[]) {
  return [...modulos].sort((a, b) => ordemCodigo(a) - ordemCodigo(b) || codigoModulo(a).localeCompare(codigoModulo(b), "pt"));
}

export function sessoesPublicas(raw: unknown): SessaoPublica[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: SessaoPublica[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const s = item as Record<string, unknown>;
    const modulos = modulosPorOrdem(Array.isArray(s.modulos)
      ? s.modulos.map(asText).filter(Boolean)
      : [asText(s.modulo)].filter(Boolean));
    const formadores = Array.isArray(s.formadores)
      ? s.formadores.map(asText).filter(Boolean)
      : [asText(s.formador)].filter(Boolean);
    out.push({
      data: asText(s.data).slice(0, 10),
      horaInicio: asText(s.horaInicio || s.hora_inicio),
      horaFim: asText(s.horaFim || s.hora_fim),
      modalidade: asText(s.modalidade),
      modulos,
      formadores,
    });
  }
  return out.sort((a, b) => a.data.localeCompare(b.data) || a.horaInicio.localeCompare(b.horaInicio));
}

function hora(inicio: string, fim: string) {
  if (inicio && fim) return `${inicio}–${fim}`;
  return inicio || fim || "—";
}

function dataPt(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso || "—");
}

export function htmlCronograma(input: {
  curso?: string;
  local?: string;
  horario?: string;
  inicio?: string;
  formador?: string;
  nome?: string;
  sessoes: SessaoPublica[];
}) {
  const titulo = input.nome || input.curso || "Cronograma";
  const meta = [input.curso, input.local, input.horario, input.inicio ? `início ${dataPt(input.inicio)}` : "", input.formador]
    .filter(Boolean)
    .join(" · ");
  const linhas = input.sessoes.map(s => `<tr>
        <td>${esc(s.data ? dataPt(s.data) : "—")}</td>
        <td>${esc(hora(s.horaInicio, s.horaFim))}</td>
        <td>${esc(MODALIDADE[s.modalidade] ?? (s.modalidade || "—"))}</td>
        <td>${esc(s.modulos.join(", ") || "—")}</td>
        <td>${esc(s.formadores.join(", ") || input.formador || "—")}</td>
      </tr>`).join("");
  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8" />
  <title>${esc(titulo)}</title>
  <style>
    body { font-family: Georgia, "Times New Roman", serif; color: #1c1917; margin: 32px; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    p { margin: 0 0 16px; color: #57534e; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border: 1px solid #d6d3d1; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #faf7f2; font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; }
    footer { margin-top: 18px; font-size: 12px; color: #78716c; }
  </style>
</head>
<body>
  <h1>${esc(titulo)}</h1>
  <p>${esc(meta || "Cronograma da turma")}</p>
  <table>
    <thead><tr><th>Data</th><th>Horas</th><th>Modalidade</th><th>Módulo</th><th>Formador</th></tr></thead>
    <tbody>${linhas || `<tr><td colspan="5">Ainda sem sessões neste cronograma.</td></tr>`}</tbody>
  </table>
  <footer>Cronograma publicado no sítio e arquivado no dossiê técnico-pedagógico.</footer>
</body>
</html>`;
}
