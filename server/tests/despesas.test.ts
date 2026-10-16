import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { arrancar, pedido } from "./helpers.js";

const base = {
  categoriaCusto: "2.7.0 - Alimentação", docDespesa: "Fatura", descricao: "Almoços da turma",
  dataDocDespesa: "2026-10-01", nDocDespesa: "FT 2026/12", nifFornecedorEstrangeiro: "Não", nifFornecedor: "509 999 999",
  nomeFornecedor: "Restaurante X", paisFornecedor: "Portugal", totalDocDespesa: "123,456", mapaInvestimentos: "3",
  rubrica: "62 - Fornecimentos e serviços externos", docPagamento: "Transferência Bancária",
};

describe("despesas da Financiada", () => {
  it("valida as opções do template, numera a ordem e exporta com as colunas do template", async () => {
    const ctx = await arrancar();
    expect((await pedido(ctx, "comercial", "GET", "/v1/despesas")).statusCode).toBe(403);
    expect((await pedido(ctx, "financiada", "POST", "/v1/despesas", { dados: { ...base, categoriaCusto: "Inventada" } })).statusCode).toBe(400);
    expect((await pedido(ctx, "financiada", "POST", "/v1/despesas", { dados: { ...base, dataDocDespesa: "01/10/2026" } })).statusCode).toBe(400);
    expect((await pedido(ctx, "financiada", "POST", "/v1/despesas", { dados: { ...base, nifFornecedor: "12" } })).statusCode).toBe(400);
    expect((await pedido(ctx, "financiada", "POST", "/v1/despesas", { dados: {} })).statusCode).toBe(400);

    const a = await pedido(ctx, "financiada", "POST", "/v1/despesas", { dados: { ...base, extra: "ignorado" } });
    expect(a.statusCode, a.body).toBe(200);
    const d = a.json().despesa;
    expect(d.dados).toMatchObject({ totalDocDespesa: 123.46, nifFornecedor: "509 999 999", quantidade: null });
    expect(d.dados.extra).toBeUndefined();
    const b = (await pedido(ctx, "financiada", "POST", "/v1/despesas", { dados: { descricao: "Segunda", nifFornecedorEstrangeiro: "Sim", nifFornecedor: "ES-B123" } })).json().despesa;
    expect(b.ordem).toBe(d.ordem + 1);

    const alt = await pedido(ctx, "financiada", "PATCH", `/v1/despesas/${b.id}`, { dados: { descricao: "Segunda (corrigida)" } });
    expect(alt.json().despesa.dados.descricao).toBe("Segunda (corrigida)");

    const exp = await pedido(ctx, "financiada", "GET", "/v1/despesas/exportar");
    expect(exp.statusCode).toBe(200);
    const folha = XLSX.read(exp.rawPayload, { type: "buffer" }).Sheets.Despesas!;
    const linhas = XLSX.utils.sheet_to_json<unknown[]>(folha, { header: 1 });
    expect(linhas[0]!.slice(0, 4)).toEqual(["Ordem", "Parceiros", "Categoria Custo", "Nº Contrato"]);
    expect(linhas[0]).toHaveLength(29);
    expect(linhas.some(l => l[5] === "Almoços da turma")).toBe(true);

    expect((await pedido(ctx, "financiada", "DELETE", `/v1/despesas/${b.id}`)).statusCode).toBe(200);
    const lista = (await pedido(ctx, "financiada", "GET", "/v1/despesas")).json().despesas as { id: number }[];
    expect(lista.map(x => x.id)).not.toContain(b.id);
  });
});
