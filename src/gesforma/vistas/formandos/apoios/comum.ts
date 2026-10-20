import { apiLoteApoios, type EstadoApoio, type ModoApoio } from "../../../../partilhado/api/apoios";
import type { Tom } from "../../../../partilhado/ui";
import { mesLisboa } from "../../../../partilhado/horaLisboa";

export const ESTADO_APOIO: Record<EstadoApoio, { rotulo: string; tom: Tom }> = {
  calculado: { rotulo: "Calculado", tom: "info" },
  aprovado: { rotulo: "Aprovado", tom: "aviso" },
  pago: { rotulo: "Pago", tom: "sucesso" },
  anulado: { rotulo: "Anulado", tom: "neutro" },
};

export const MODO_APOIO: Record<ModoApoio, { rotulo: string; unidade: string }> = {
  hora: { rotulo: "Por hora presente", unidade: "€/h" },
  dia: { rotulo: "Por dia com presença", unidade: "€/dia" },
  mes: { rotulo: "Valor mensal", unidade: "€/mês" },
};

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "2026-03" → "março de 2026". */
export function nomeMes(periodo: string) {
  const [a, m] = periodo.split("-");
  const i = Number(m) - 1;
  return MESES[i] ? `${MESES[i]} de ${a}` : periodo;
}

export function mesAtual() {
  return mesLisboa();
}

/** Células que o Excel poderia correr como fórmula ficam como texto. */
function seguro(v: unknown) {
  if (typeof v === "number") return v;
  const s = String(v ?? "");
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

type XlsxEscrita = {
  utils: {
    aoa_to_sheet: (linhas: unknown[][]) => Record<string, unknown>;
    book_new: () => unknown;
    book_append_sheet: (livro: unknown, folha: unknown, nome: string) => void;
  };
  writeFile: (livro: unknown, nome: string) => void;
};

/** Lote de apoios de uma turma e mês (com IBAN e titular), para preparar as transferências. */
export async function exportarApoios(turmaId: number, periodo: string) {
  const [lote, XLSX] = await Promise.all([apiLoteApoios(turmaId, periodo), import("xlsx") as unknown as Promise<XlsxEscrita>]);
  const { registos, bancos } = lote;
  const turmaNome = lote.turma.nome;
  const cab = ["Formando", "N.º", "Apoio", "Dias", "Horas", "Valor calculado (€)", "Ajuste (€)", "Valor (€)", "Estado", "Pago em", "Referência", "IBAN", "Titular"];
  const linhas = registos.map(r => [
    r.formando ?? "", r.formandoId, r.rotulo, r.dias, r.horas, r.valorCalculado, r.ajuste, r.valor,
    ESTADO_APOIO[r.estado].rotulo, r.pagoEm ?? "", r.referencia, bancos[r.formandoId]?.iban ?? "", bancos[r.formandoId]?.titular ?? "",
  ]);
  const total = registos.filter(r => r.estado !== "anulado").reduce((s, r) => s + r.valor, 0);
  const folha = XLSX.utils.aoa_to_sheet([
    [`Apoios · ${turmaNome} · ${nomeMes(periodo)}`],
    [],
    cab,
    ...linhas,
    [],
    ["Total (sem anulados)", "", "", "", "", "", "", Math.round(total * 100) / 100],
  ].map(l => l.map(seguro)));
  const livro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(livro, folha, "Apoios");
  const nome = `apoios-${turmaNome}-${periodo}`.normalize("NFD").replace(/[^\w-]+/g, "-").replace(/-+/g, "-").toLowerCase();
  XLSX.writeFile(livro, `${nome}.xlsx`);
}
