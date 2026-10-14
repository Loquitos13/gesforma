// Dados partilhados pelos editores de documento.
import { apiPublicEntidade } from "../../../../partilhado/api/publico";
import { useRecurso } from "../../../../partilhado/dados/useRecurso";
import { euros } from "./modelo";

/** Nome da entidade (Configurações › Entidade), para o cabeçalho e o campo "Nome da entidade". */
export function useEntidade() {
  const { dados } = useRecurso("publico:entidade", signal => apiPublicEntidade(signal), { validadeMs: 600_000 });
  return dados?.entidade.nome || "Entidade formadora";
}

/** Tabela "Investimento" (formandos × preço, desconto e total), igual no editor, na impressão e no PDF. */
export function tabelaInvestimento(n: number, preco: number, descontoPct: number) {
  const bruto = n * preco;
  const desconto = Math.round(bruto * descontoPct) / 100;
  const total = bruto - desconto;
  const linhas = [
    `<tr><td>${n} ${n === 1 ? "formando" : "formandos"} × ${euros(preco)}</td><td style="text-align: right;">${euros(bruto)}</td></tr>`,
    descontoPct ? `<tr><td>Desconto de grupo (${descontoPct} %)</td><td style="text-align: right;">− ${euros(desconto)}</td></tr>` : "",
    `<tr><td><strong>Total</strong></td><td style="text-align: right;"><strong>${euros(total)}</strong></td></tr>`,
  ];
  return { html: `<table><tbody>${linhas.join("")}</tbody></table>`, bruto, desconto, total };
}

/** Preenche os blocos automáticos (ex.: a tabela do investimento) dentro da página. */
export function preencherBlocos(raiz: HTMLElement | null, blocos: Record<string, string>) {
  if (!raiz) return;
  raiz.querySelectorAll<HTMLElement>("[data-bloco]").forEach(el => {
    const html = blocos[el.getAttribute("data-bloco") ?? ""];
    if (html != null && el.innerHTML !== html) el.innerHTML = html;
  });
}
