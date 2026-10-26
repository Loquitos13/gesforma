// Datas dos documentos em dd-mm-aaaa, gravações concorrentes dos dados para o financiamento e o formador sem o DTP.
// Dados fictícios.
import { describe, expect, it } from "vitest";
import { fmtDataDDMMAAAA } from "../../src/partilhado/horaLisboa.js";
import { linhasRelatorioFinal } from "../src/relatorioFinal.js";
import { pdfsDoDossie } from "../src/dtpPdfs.js";
import { readFormandoPii, writeFormandoPiiPatch } from "../src/pii.js";
import { gravarPiiFormandoFin, piiFormandoFinParaGravar } from "../src/repos/formandoFinanciamento.js";
import { arrancar, pedido, type Ctx } from "./helpers.js";

/** A Financiada só associa à acção com os documentos obrigatórios (menos o contrato, que se assina ao entrar). */
const DOCS_TURMA_OK = Object.fromEntries(["cc", "ch", "cu", "ci", "ce", "morada", "rgpd"].map(k => [k, { ok: true, data: "" }]));

let seq = 0;
const unico = (p: string) => `${p} ${Date.now()}-${++seq}`;

describe("datas dos documentos: dd-mm-aaaa", () => {
  it("data de calendário, instante (dia de Lisboa) e vazio", () => {
    expect(fmtDataDDMMAAAA("2030-06-03")).toBe("03-06-2030");
    expect(fmtDataDDMMAAAA(" 2030-06-03 ")).toBe("03-06-2030");
    expect(fmtDataDDMMAAAA("03/06/2030")).toBe("03-06-2030");
    // 23:30 UTC de 31/07 já é 01/08 em Lisboa (verão); no inverno Lisboa = UTC.
    expect(fmtDataDDMMAAAA("2026-07-31T23:30:00Z")).toBe("01-08-2026");
    expect(fmtDataDDMMAAAA("2026-07-31 23:30:00.123+00")).toBe("01-08-2026");
    expect(fmtDataDDMMAAAA("2026-07-31 23:30")).toBe("01-08-2026");
    expect(fmtDataDDMMAAAA(new Date("2026-01-31T23:30:00Z"))).toBe("31-01-2026");
    expect(fmtDataDDMMAAAA("")).toBe("");
    expect(fmtDataDDMMAAAA(null)).toBe("");
    expect(fmtDataDDMMAAAA(undefined)).toBe("");
    expect(fmtDataDDMMAAAA("por definir")).toBe("por definir");
  });

  it("relatório final e PDF da Gold", () => {
    const linhas = linhasRelatorioFinal({
      curso: "C", acao: "A", area: "", local: "", duracaoHoras: 25, inicio: "2030-06-03", fim: "2030-07-01", formador: "", horario: "",
      objetivos: [], programa: [], inscritos: 0, desistentes: [], formandos: [], certificados: 0, inqueritos: [], ocorrencias: [],
    });
    expect(linhas.join("\n")).toContain("Data de início: 03-06-2030    Data de fim: 01-07-2030");
    const sessao = { id: "a", data: "2030-06-03", horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", formadores: ["F"] };
    const pdf = pdfsDoDossie({ turma: "T", curso: "C", cronograma: [sessao], formandos: [], sessoes: [] });
    for (const doc of [pdf.cronograma, pdf.folhas, pdf.planos]) {
      const texto = doc.toString("latin1");
      expect(texto).toContain("03-06-2030");
      expect(texto).not.toContain("03/06/2030");
      expect(texto).not.toContain("2030-06-03");
    }
  });

  it("despesas exportadas com as datas em dd-mm-aaaa", async () => {
    const ctx = await arrancar();
    const t = await pedido(ctx, "secretaria", "POST", "/v1/turmas-fin", { dataInicio: "2099-02-02", nome: unico("TF Datas"), curso: "UFCD Datas", capacidade: 5 });
    expect(t.statusCode, t.body).toBe(200);
    const turmaId = t.json().turma.id as number;
    const d = await pedido(ctx, "financiada", "POST", "/v1/despesas", { turmaId, dados: { descricao: "Almoços", dataDocDespesa: "2026-10-01", dataDocPagamento: "2026-10-15" } });
    expect(d.statusCode, d.body).toBe(200);
    const exp = await pedido(ctx, "financiada", "GET", `/v1/despesas/exportar?turma=${turmaId}`);
    expect(exp.statusCode).toBe(200);
    const XLSX = await import("xlsx");
    const linhas = XLSX.utils.sheet_to_json<unknown[]>(XLSX.read(exp.rawPayload, { type: "buffer" }).Sheets.Despesas!, { header: 1, raw: true });
    const cab = linhas[0] as string[];
    expect(linhas[1]![cab.indexOf("Data Doc Despesa")]).toBe("01-10-2026");
    expect(linhas[1]![cab.indexOf("Data Doc Pagamento")]).toBe("15-10-2026");
  });
});

async function formandoFin(ctx: Ctx) {
  const t = await pedido(ctx, "secretaria", "POST", "/v1/turmas-fin", { dataInicio: "2099-02-02", nome: unico("TF Conc"), curso: "UFCD Conc", capacidade: 5 });
  expect(t.statusCode, t.body).toBe(200);
  const f = await pedido(ctx, "financiada", "POST", "/v1/formandos-fin", { ...DOCS_TURMA_OK,
    nome: "Ana", apelido: "Silva", email: `conc.${Date.now()}.${++seq}@exemplo.pt`, telf: "912 345 678", turmaId: t.json().turma.id,
  });
  expect(f.statusCode, f.body).toBe(200);
  return f.json().formando.id as number;
}

describe("dados para o financiamento: gravações ao mesmo tempo", () => {
  it("duas gravações de campos cifrados diferentes ficam ambas (a ficha relê-se bloqueada na transacção)", async () => {
    const ctx = await arrancar();
    const id = await formandoFin(ctx);
    const url = `/v1/formandos-fin/${id}/financiamento`;
    const [a, b, c] = await Promise.all([
      pedido(ctx, "financiada", "PATCH", url, { niss: "11122233344" }),
      pedido(ctx, "secretaria", "PATCH", url, { passaporte: "AB9988776" }),
      pedido(ctx, "financiada", "PATCH", url, { dataNascimento: "1990-04-15", genero: "2 - Mulheres" }),
    ]);
    for (const r of [a, b, c]) expect(r.statusCode, r.body).toBe(200);
    const dados = (await pedido(ctx, "financiada", "GET", url)).json().dados;
    expect(dados).toMatchObject({ niss: "11122233344", passaporte: "AB9988776", dataNascimento: "1990-04-15", genero: "2 - Mulheres" });
    // O telefone do pacote cifrado também fica.
    const ficha = (await pedido(ctx, "financiada", "GET", `/v1/formandos/fin/${id}`)).json();
    expect(JSON.stringify(ficha)).toContain("912");
    expect((await pedido(ctx, "financiada", "PATCH", "/v1/formandos-fin/999999999/financiamento", { niss: "11122233344" })).statusCode).toBe(404);
  });

  it("outra gravação que chega entre o pedido e a transacção não se perde", async () => {
    const ctx = await arrancar();
    const id = await formandoFin(ctx);
    const url = `/v1/formandos-fin/${id}/financiamento`;
    // Simula outra pessoa a gravar o passaporte mesmo antes de a transacção deste pedido começar.
    const tx = ctx.db.tx.bind(ctx.db);
    let outra = true;
    ctx.db.tx = (async (fn: Parameters<typeof tx>[0]) => {
      if (outra) {
        outra = false;
        await tx(async q => {
          const linha = await piiFormandoFinParaGravar(q, id);
          const prev = readFormandoPii({ pii_enc: linha!.pii_enc, telf: linha!.telf });
          await gravarPiiFormandoFin(q, id, writeFormandoPiiPatch({ ident: { ...prev.ident, passaporte: "ZZ1234567" } }, prev));
        });
      }
      return tx(fn);
    }) as typeof ctx.db.tx;
    try {
      const r = await pedido(ctx, "financiada", "PATCH", url, { niss: "11122233344" });
      expect(r.statusCode, r.body).toBe(200);
    } finally {
      ctx.db.tx = tx;
    }
    expect((await pedido(ctx, "financiada", "GET", url)).json().dados).toMatchObject({ niss: "11122233344", passaporte: "ZZ1234567" });
  });
});

describe("pedagogia da turma: o formador fica fora do dossiê", () => {
  it("o GET /pedagogia não leva o DTP (nem as ligações dos anexos) ao formador; a equipa continua a recebê-lo", async () => {
    const ctx = await arrancar();
    const conta = await ctx.db.query<{ email: string }>("SELECT email FROM users WHERE id = $1", [ctx.userId.formador]);
    await ctx.db.query("UPDATE formadores SET user_id = NULL, email = '' WHERE user_id = $1", [ctx.userId.formador]);
    const eu = unico("Formador Eu");
    expect((await pedido(ctx, "secretaria", "POST", "/v1/formadores", { nome: eu, email: conta.rows[0]!.email, regimes: ["gold", "fin"] })).statusCode).toBe(200);
    const cronograma = [{ id: "s1", data: "2099-06-01", horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", formadores: [eu] }];
    const t = await pedido(ctx, "secretaria", "POST", "/v1/turmas-fin", { dataInicio: "2099-06-01", nome: unico("TF Formador"), curso: "UFCD F", capacidade: 5, cronograma });
    expect(t.statusCode, t.body).toBe(200);
    const url = `/v1/turmas/fin/${t.json().turma.id}/pedagogia`;
    const doFormador = await pedido(ctx, "formador", "GET", url);
    expect(doFormador.statusCode, doFormador.body).toBe(200);
    expect(doFormador.json()).not.toHaveProperty("dtp");
    expect(doFormador.json().sessoes).toBeDefined();
    const daEquipa = (await pedido(ctx, "secretaria", "GET", url)).json();
    expect(daEquipa.dtp.items.length).toBeGreaterThan(0);
  });
});
