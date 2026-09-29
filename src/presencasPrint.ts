export type FolhaPresencasSessao = {
  n: number;
  data: string;
  hora: string;
  modulo?: string;
  formador?: string;
};

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c));
}

export function htmlFolhaPresencas(opts: {
  turma: string;
  curso: string;
  sessoes: FolhaPresencasSessao[];
  formandos: { nome: string }[];
}) {
  const formandos = opts.formandos.length
    ? opts.formandos
    : [{ nome: "" }];
  const blocos = (opts.sessoes.length ? opts.sessoes : [{ n: 0, data: "____/____/________", hora: "____:____", modulo: "", formador: "" }]).map(sx => `
    <section class="folha">
      <p class="marca">ENA · Escola de Negócios e Administração</p>
      <h1>Folha de presenças${sx.n ? ` · Sessão ${sx.n}` : ""}</h1>
      <p class="sub">${escapeHtml(opts.turma)} · ${escapeHtml(opts.curso)}</p>
      <table class="meta">
        <tr><th>Data</th><td>${escapeHtml(sx.data || "-")}</td><th>Hora</th><td>${escapeHtml(sx.hora || "-")}</td></tr>
        <tr><th>${sx.modulo && /C\d+/.test(sx.modulo) ? "Capítulo" : "Módulo"}</th><td colspan="3">${escapeHtml(sx.modulo || "-")}</td></tr>
      </table>
      <table class="lista">
        <thead>
          <tr><th class="n">N.º</th><th>Formando inscrito</th><th class="ass">Assinatura</th></tr>
        </thead>
        <tbody>
          ${formandos.map((f, i) => `
            <tr>
              <td class="n">${i + 1}</td>
              <td>${escapeHtml(f.nome || "")}</td>
              <td class="ass"></td>
            </tr>`).join("")}
        </tbody>
      </table>
      <div class="rodape">
        <p>Formador: ${escapeHtml(sx.formador || "") || "________________________________"}</p>
        <p>Assinatura do formador: ________________________________</p>
      </div>
    </section>
  `).join("");

  return `<!doctype html><html lang="pt"><head><meta charset="utf-8"><title>Folha de presenças · ${escapeHtml(opts.turma)}</title>
    <style>
      @page { size: A4; margin: 14mm; }
      body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 0; }
      .folha { page-break-after: always; }
      .folha:last-child { page-break-after: auto; }
      .marca { font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: #a60000; font-weight: 700; margin: 0 0 6px; }
      h1 { font-size: 18px; margin: 0 0 4px; }
      p.sub { color: #475569; font-size: 12px; margin: 0 0 14px; }
      table.meta { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 14px; }
      table.meta th { text-align: left; width: 18%; color: #64748b; font-size: 10px; text-transform: uppercase; padding: 4px 6px 4px 0; }
      table.meta td { padding: 4px 8px 4px 0; }
      table.lista { border-collapse: collapse; width: 100%; font-size: 12px; }
      table.lista th, table.lista td { border: 1px solid #94a3b8; padding: 8px 8px; text-align: left; }
      table.lista th { background: #f8fafc; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: #475569; }
      table.lista td.n, table.lista th.n { width: 42px; text-align: center; }
      table.lista td.ass, table.lista th.ass { width: 46%; height: 28px; }
      .rodape { margin-top: 22px; font-size: 12px; display: grid; gap: 12px; }
    </style></head><body>${blocos}</body></html>`;
}

export function imprimirFolhasPresencas(opts: {
  turma: string;
  curso: string;
  sessoes: FolhaPresencasSessao[];
  formandos: { nome: string }[];
}) {
  const w = window.open("", "_blank", "width=820,height=900");
  if (!w) return;
  w.document.write(htmlFolhaPresencas(opts));
  w.document.close();
  w.focus();
  w.print();
}
