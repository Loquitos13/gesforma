import * as XLSX from "xlsx";
import type { Db } from "./db/pool.js";
import { readPreinscricaoPii } from "./pii.js";
import type { FiltrosPagamentos } from "./repos/pagamentos.js";
import { linhasExportacao } from "./repos/recibos.js";

/** Exportação da lista de pagamentos para Excel, com os mesmos filtros do ecrã. */

/** Um texto que comece por =, +, -, @ ou tabulação passaria a fórmula ao ser aberto ou reaproveitado: prefixa-se com '. */
export function textoSeguro(v: unknown) {
  const s = String(v ?? "");
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

const dataCurta = (iso: string | null) => (iso ? iso.slice(0, 16).replace("T", " ") : "");

const ESTADOS: Record<string, string> = { Pago: "Pago", Pendente: "Por receber", Cancelado: "Cancelado", Reembolsado: "Reembolsado" };

export async function exportarPagamentos(db: Db, filtros: FiltrosPagamentos, opts: { comNif: boolean }) {
  const linhas = await linhasExportacao(db, filtros);
  const cab = [
    "Registado em", "Pago em", "Pessoa", "Email", ...(opts.comNif ? ["NIF"] : []), "Curso", "Turma", "Valor (€)",
    "Método", "Estado", "Comprovativo", "Confirmado por", "Motivo da recusa", "Recibo", "Referência",
  ];
  const dados = linhas.map(l => {
    const nif = opts.comNif ? [textoSeguro(readPreinscricaoPii({ pii_enc: l.lead_pii, nif: l.lead_nif }).nif ?? "")] : [];
    return [
      dataCurta(l.criado), dataCurta(l.pago_em), textoSeguro(l.nome), textoSeguro(l.email), ...nif, textoSeguro(l.curso),
      textoSeguro(l.turma ?? ""), Number(l.valor) || 0, textoSeguro(l.metodo), ESTADOS[l.estado] ?? textoSeguro(l.estado),
      l.comprovativo ? "Sim" : "Não", textoSeguro(l.confirmado_por ?? ""), textoSeguro(l.recusa_motivo), l.recibo ?? "", textoSeguro(l.id),
    ];
  });
  const folha = XLSX.utils.aoa_to_sheet([cab, ...dados]);
  folha["!cols"] = cab.map(c => ({ wch: Math.max(12, Math.min(40, c.length + 6)) }));
  folha["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(dados.length, 1), c: cab.length - 1 } }) };
  const livro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(livro, folha, "Pagamentos");
  const bytes = XLSX.write(livro, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return { bytes, total: linhas.length };
}
