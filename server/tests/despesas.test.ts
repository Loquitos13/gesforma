import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { validarDespesa } from "../../src/partilhado/despesas.js";
import { numeroPt } from "../../src/partilhado/ui/formatos.js";
import { arrancar, pedido, type Ctx } from "./helpers.js";

async function turmaFin(ctx: Ctx) {
  const r = await pedido(ctx, "secretaria", "POST", "/v1/turmas-fin", { dataInicio: "2099-02-02", nome: `TF Despesas ${Date.now()}-${Math.random()}`, curso: "UFCD Despesas", capacidade: 5 });
  expect(r.statusCode, r.body).toBe(200);
  return r.json().turma.id as number;
}

const base = {
  categoriaCusto: "2.7.0 - Alimentação", docDespesa: "Fatura", descricao: "Almoços da turma",
  dataDocDespesa: "2026-10-01", nDocDespesa: "FT 2026/12", nifFornecedorEstrangeiro: "Não", nifFornecedor: "509 999 999",
  nomeFornecedor: "Restaurante X", paisFornecedor: "Portugal", totalDocDespesa: "123,456", mapaInvestimentos: "3",
  rubrica: "62 - Fornecimentos e serviços externos", docPagamento: "Transferência Bancária",
};

describe("despesas da Financiada", () => {
  it("lê números à portuguesa (milhares com ponto, decimais com vírgula)", () => {
    expect(numeroPt("1.500")).toBe(1500);
    expect(numeroPt("1.500,25")).toBe(1500.25);
    expect(numeroPt("1 234 567,8")).toBe(1234567.8);
    expect(numeroPt("12.345.678")).toBe(12345678);
    expect(numeroPt("1.5")).toBe(1.5);
    expect(numeroPt("0.500")).toBe(0.5);
    expect(numeroPt("123,456")).toBe(123.456);
    const r = validarDespesa({ descricao: "x", totalDocDespesa: "1.500" });
    expect(r.ok && r.dados.totalDocDespesa).toBe(1500);
  });

  it("valida as opções do template, numera a ordem e exporta com as colunas do template", async () => {
    const ctx = await arrancar();
    const turmaId = await turmaFin(ctx);
    expect((await pedido(ctx, "comercial", "GET", `/v1/despesas?turma=${turmaId}`)).statusCode).toBe(403);
    expect((await pedido(ctx, "financiada", "POST", "/v1/despesas", { dados: base })).statusCode).toBe(400);
    expect((await pedido(ctx, "financiada", "POST", "/v1/despesas", { turmaId, dados: { ...base, categoriaCusto: "Inventada" } })).statusCode).toBe(400);
    expect((await pedido(ctx, "financiada", "POST", "/v1/despesas", { turmaId, dados: { ...base, dataDocDespesa: "01/10/2026" } })).statusCode).toBe(400);
    expect((await pedido(ctx, "financiada", "POST", "/v1/despesas", { turmaId, dados: { ...base, nifFornecedor: "12" } })).statusCode).toBe(400);
    expect((await pedido(ctx, "financiada", "POST", "/v1/despesas", { turmaId, dados: {} })).statusCode).toBe(400);

    const a = await pedido(ctx, "financiada", "POST", "/v1/despesas", { turmaId, dados: { ...base, extra: "ignorado" } });
    expect(a.statusCode, a.body).toBe(200);
    const d = a.json().despesa;
    expect(d.dados).toMatchObject({ totalDocDespesa: 123.46, nifFornecedor: "509 999 999", quantidade: null });
    expect(d.dados.extra).toBeUndefined();
    const b = (await pedido(ctx, "financiada", "POST", "/v1/despesas", { turmaId, dados: { descricao: "Segunda", nifFornecedorEstrangeiro: "Sim", nifFornecedor: "ES-B123" } })).json().despesa;
    expect(b.ordem).toBe(d.ordem + 1);

    const alt = await pedido(ctx, "financiada", "PATCH", `/v1/despesas/${b.id}`, { dados: { descricao: "Segunda (corrigida)" } });
    expect(alt.json().despesa.dados.descricao).toBe("Segunda (corrigida)");

    const exp = await pedido(ctx, "financiada", "GET", `/v1/despesas/exportar?turma=${turmaId}`);
    expect(exp.statusCode).toBe(200);
    const folha = XLSX.read(exp.rawPayload, { type: "buffer" }).Sheets.Despesas!;
    const linhas = XLSX.utils.sheet_to_json<unknown[]>(folha, { header: 1 });
    expect(linhas[0]!.slice(0, 4)).toEqual(["Ordem", "Parceiros", "Categoria Custo", "Nº Contrato"]);
    expect(linhas[0]).toHaveLength(29);
    expect(linhas.some(l => l[5] === "Almoços da turma")).toBe(true);

    expect((await pedido(ctx, "financiada", "DELETE", `/v1/despesas/${b.id}`)).statusCode).toBe(200);
    const lista = (await pedido(ctx, "financiada", "GET", `/v1/despesas?turma=${turmaId}`)).json().despesas as { id: number }[];
    expect(lista.map(x => x.id)).not.toContain(b.id);
  });

  it("cada turma tem as suas despesas e a sua numeração; as antigas, sem turma, associam-se a uma turma", async () => {
    const ctx = await arrancar();
    const [t1, t2] = [await turmaFin(ctx), await turmaFin(ctx)];
    const criar = async (turmaId: number, descricao: string) => (await pedido(ctx, "financiada", "POST", "/v1/despesas", { turmaId, dados: { descricao } })).json().despesa as { id: number; ordem: number };
    expect((await criar(t1, "A")).ordem).toBe(1);
    expect((await criar(t2, "B")).ordem).toBe(1);
    expect((await criar(t1, "C")).ordem).toBe(2);
    const ver = async (q: string) => ((await pedido(ctx, "financiada", "GET", `/v1/despesas?turma=${q}`)).json().despesas as { id: number; dados: { descricao: string } }[]);
    expect((await ver(String(t1))).map(d => d.dados.descricao)).toEqual(["A", "C"]);
    expect((await pedido(ctx, "financiada", "GET", "/v1/despesas")).statusCode).toBe(400);

    const antiga = (await ctx.db.query<{ id: number }>("INSERT INTO despesas_fin (ordem, dados) VALUES (7, '{\"descricao\":\"Antiga\"}') RETURNING id")).rows[0]!.id;
    expect((await ver("sem")).map(d => d.id)).toContain(antiga);
    const a = await pedido(ctx, "financiada", "PATCH", `/v1/despesas/${antiga}`, { turmaId: t2 });
    expect(a.statusCode, a.body).toBe(200);
    expect(a.json().despesa).toMatchObject({ turmaId: t2, ordem: 2 });
    expect((await ver("sem")).map(d => d.id)).not.toContain(antiga);
    // Já tem turma: não muda de turma por este caminho.
    expect((await pedido(ctx, "financiada", "PATCH", `/v1/despesas/${antiga}`, { turmaId: t1 })).statusCode).toBe(404);
  });
});
