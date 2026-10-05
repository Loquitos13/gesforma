import { formatDiaMes, formatHoraRange, sessaoModulos, sessaoModalidade, type SessaoCronograma } from "./turmaModel";

function esc(value: string) {
  return value.replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch] ?? ch);
}

const MODALIDADE: Record<string, string> = {
  presencial: "Presencial",
  sincrona: "Síncrona",
  auto: "Auto-aprendizagem",
  avaliacao: "Avaliação",
  matricula: "Matrícula",
};

export function htmlCronograma(input: {
  curso?: string;
  local?: string;
  horario?: string;
  inicio?: string;
  formador?: string;
  nome?: string;
  sessoes: SessaoCronograma[];
}) {
  const titulo = input.nome || input.curso || "Cronograma";
  const meta = [input.curso, input.local, input.horario, input.inicio ? `início ${formatDiaMes(input.inicio)}` : "", input.formador]
    .filter(Boolean)
    .join(" · ");
  const linhas = [...input.sessoes]
    .sort((a, b) => a.data.localeCompare(b.data) || a.horaInicio.localeCompare(b.horaInicio))
    .map(s => {
      const mods = sessaoModulos(s).join(", ") || "—";
      const forms = (s.formadores ?? []).join(", ") || input.formador || "—";
      return `<tr>
        <td>${esc(s.data ? formatDiaMes(s.data) : "—")}</td>
        <td>${esc(formatHoraRange(s.horaInicio, s.horaFim))}</td>
        <td>${esc(MODALIDADE[sessaoModalidade(s)] ?? sessaoModalidade(s))}</td>
        <td>${esc(mods)}</td>
        <td>${esc(forms)}</td>
      </tr>`;
    })
    .join("");
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
  <footer>Cronograma para publicação no sítio e arquivo no dossiê técnico-pedagógico.</footer>
</body>
</html>`;
}

export function descarregarCronograma(input: Parameters<typeof htmlCronograma>[0]) {
  const blob = new Blob([htmlCronograma(input)], { type: "text/html;charset=utf-8" });
  const a = document.createElement("a");
  const nome = (input.nome || input.curso || "turma").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 60);
  a.href = URL.createObjectURL(blob);
  a.download = `cronograma-${nome || "turma"}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}
