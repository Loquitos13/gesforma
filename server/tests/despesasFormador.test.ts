// Despesas automáticas dos formadores (Financiada): horas no cronograma × valor por hora da visão geral da turma
// (vazio, o da ficha), uma linha por formador nas despesas da turma, em dia com a turma e com a ficha.
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { AVISO_SAIU } from "../src/despesasFormador.js";
import { arrancar, pedido, type Ctx } from "./helpers.js";

let seq = 0;
const unico = () => `${Date.now().toString(36)}${++seq}`;

const sessao = (id: string, data: string, formadores: string[], horaInicio = "09:00", horaFim = "13:00") => ({
  id, data, horaInicio, horaFim, modalidade: "presencial", formadores,
});

async function turmaFin(ctx: Ctx, cronograma: unknown[], extra: { valores?: Record<string, number>; formador?: string } = {}) {
  const id = Number((await ctx.db.query<{ id: number }>("SELECT nextval('ops_id_seq')::int AS id")).rows[0]!.id);
  await ctx.db.query(
    `INSERT INTO turmas_fin (id, data_inicio, nome, curso, ufcd_cod, financiador, formador, cronograma, valores_hora_formador)
     VALUES ($1, '2099-09-01', $2, 'Comunicação assertiva', '8995', 'IEFP', $3, $4::jsonb, $5::jsonb)`,
    [id, `TDF-${unico()}`, extra.formador ?? "", JSON.stringify(cronograma), JSON.stringify(extra.valores ?? {})],
  );
  return id;
}

async function ficha(ctx: Ctx, nome: string, nif: string, custo: number) {
  const r = await ctx.db.query<{ id: number }>(
    `INSERT INTO formadores (id, nome, nif, custo_hora, regimes, estado) VALUES (nextval('ops_id_seq')::int, $1, $2, $3, '["fin"]'::jsonb, 'Ativo') RETURNING id`,
    [nome, nif, custo],
  );
  return Number(r.rows[0]!.id);
}

type Linha = { id: number; ordem: number; dados: Record<string, unknown>; origem: string; formador: string | null; aviso: string };

/** As linhas automáticas como estão na base (sem passar pela lista, que também sincroniza). */
async function automaticasNaBase(ctx: Ctx, turmaId: number) {
  return (await ctx.db.query<Linha>(
    "SELECT id, ordem, dados, origem, formador, aviso FROM despesas_fin WHERE turma_id = $1 AND origem = 'formador' ORDER BY ordem",
    [turmaId],
  )).rows;
}

async function lista(ctx: Ctx, turmaId: number) {
  const r = await pedido(ctx, "financiada", "GET", `/v1/despesas?turma=${turmaId}`);
  expect(r.statusCode, r.body).toBe(200);
  return r.json().despesas as Linha[];
}

describe("despesas automáticas dos formadores (Financiada)", () => {
  it("o valor por hora gravado na turma cria a despesa do formador, na mesma gravação", async () => {
    const ctx = await arrancar();
    const ana = `Ana Auto ${unico()}`;
    const rui = `Rui Sem Valor ${unico()}`;
    const turmaId = await turmaFin(ctx, [sessao("s1", "2099-09-01", [ana]), sessao("s2", "2099-09-02", [ana]), sessao("s3", "2099-09-03", [rui])]);
    expect(await automaticasNaBase(ctx, turmaId)).toEqual([]);

    const r = await pedido(ctx, "financiada", "PATCH", `/v1/turmas-fin/${turmaId}`, { valoresHoraFormador: { [ana]: 20.5 } });
    expect(r.statusCode, r.body).toBe(200);
    const linhas = await automaticasNaBase(ctx, turmaId);
    expect(linhas).toHaveLength(1); // o Rui não tem valor (nem na turma, nem ficha): sem linha
    expect(linhas[0]!.formador).toBe(ana);
    expect(linhas[0]!.dados).toMatchObject({
      nomeFornecedor: ana, nifFornecedor: "", nifFornecedorEstrangeiro: "Não", paisFornecedor: "Portugal",
      quantidade: 8, custoUnitario: 20.5, totalDocDespesa: 164, categoriaCusto: "", docDespesa: "",
    });
    expect(linhas[0]!.dados.descricao).toMatch(/^Formação — UFCD 8995 Comunicação assertiva — turma TDF-.+ — 8 h × 20,50 €\/h$/);

    // A lista mostra-a como automática, numerada como as outras.
    const manual = await pedido(ctx, "financiada", "POST", "/v1/despesas", { turmaId, dados: { descricao: "Almoços" } });
    expect(manual.statusCode, manual.body).toBe(200);
    const vistas = await lista(ctx, turmaId);
    expect(vistas.map(d => [d.ordem, d.origem])).toEqual([[1, "formador"], [2, "manual"]]);
    expect(vistas[0]).toMatchObject({ formador: ana, aviso: "" });
  });

  it("sem valor na turma vale o custo por hora e o NIF da ficha; a ficha alterada actualiza a despesa", async () => {
    const ctx = await arrancar();
    const nome = `Rui Ficha ${unico()}`;
    const fichaId = await ficha(ctx, nome, "PT 123 456 789", 15);
    const turmaId = await turmaFin(ctx, [sessao("s1", "2099-10-01", [nome], "09:00", "12:30")], { formador: nome });

    // A lista da turma põe-na em dia (rede de segurança) mesmo sem nenhuma gravação da turma.
    const [linha] = (await lista(ctx, turmaId)).filter(d => d.origem === "formador");
    expect(linha!.dados).toMatchObject({ nomeFornecedor: nome, nifFornecedor: "123456789", quantidade: 3.5, custoUnitario: 15, totalDocDespesa: 52.5 });

    const p = await pedido(ctx, "financiada", "PATCH", `/v1/formadores/${fichaId}`, { custoHora: 18, nif: "987654321" });
    expect(p.statusCode, p.body).toBe(200);
    const [depois] = await automaticasNaBase(ctx, turmaId);
    expect(depois!.dados).toMatchObject({ nifFornecedor: "987654321", custoUnitario: 18, totalDocDespesa: 63 });
    expect(depois!.id).toBe(linha!.id);

    // O valor próprio da turma passa à frente da ficha.
    await pedido(ctx, "financiada", "PATCH", `/v1/turmas-fin/${turmaId}`, { valoresHoraFormador: { [nome]: 30 } });
    expect((await automaticasNaBase(ctx, turmaId))[0]!.dados).toMatchObject({ custoUnitario: 30, totalDocDespesa: 105 });

    // O nome muda na ficha: a despesa e o valor por hora da turma seguem-no.
    const novo = `${nome} Silva`;
    expect((await pedido(ctx, "financiada", "PATCH", `/v1/formadores/${fichaId}`, { nome: novo })).statusCode).toBe(200);
    const renomeada = await automaticasNaBase(ctx, turmaId);
    expect(renomeada).toHaveLength(1);
    expect(renomeada[0]).toMatchObject({ id: linha!.id, formador: novo, aviso: "" });
    expect(renomeada[0]!.dados).toMatchObject({ nomeFornecedor: novo, custoUnitario: 30 });
    const t = await ctx.db.query<{ v: Record<string, number> }>("SELECT valores_hora_formador AS v FROM turmas_fin WHERE id = $1", [turmaId]);
    expect(t.rows[0]!.v).toEqual({ [novo]: 30 });
  });

  it("valor e horas novos actualizam a despesa sem tocar nos campos da equipa; a automática não se apaga nem se reescreve à mão", async () => {
    const ctx = await arrancar();
    const nome = `Eva Equipa ${unico()}`;
    const turmaId = await turmaFin(ctx, [sessao("s1", "2099-11-02", [nome])], { valores: { [nome]: 20 } });
    const [linha] = (await lista(ctx, turmaId)).filter(d => d.origem === "formador");
    expect(linha!.dados).toMatchObject({ quantidade: 4, totalDocDespesa: 80 });

    // A equipa preenche os seus campos; os que vêm da turma ficam como estão, mesmo que o pedido os traga mudados.
    const alt = await pedido(ctx, "financiada", "PATCH", `/v1/despesas/${linha!.id}`, {
      dados: {
        ...linha!.dados, categoriaCusto: "1.4.1 - Formadores externos Nível 1 a 3", docDespesa: "Fatura Recibo",
        nDocDespesa: "FR 2099/7", dataDocDespesa: "2099-11-30", totalDocDespesa: 999, nomeFornecedor: "Outro", elegivelDocDespesa: "80",
      },
    });
    expect(alt.statusCode, alt.body).toBe(200);
    expect(alt.json().despesa.dados).toMatchObject({ categoriaCusto: "1.4.1 - Formadores externos Nível 1 a 3", nDocDespesa: "FR 2099/7", totalDocDespesa: 80, nomeFornecedor: nome, elegivelDocDespesa: 80 });

    const apagar = await pedido(ctx, "financiada", "DELETE", `/v1/despesas/${linha!.id}`);
    expect(apagar.statusCode).toBe(409);
    expect(apagar.json().error).toMatch(/valor por hora/);

    // Mais uma sessão de 2 h e valor 25 €/h: 6 h × 25 = 150; os campos da equipa ficam.
    const r = await pedido(ctx, "financiada", "PATCH", `/v1/turmas-fin/${turmaId}`, {
      cronograma: [sessao("s1", "2099-11-02", [nome]), sessao("s2", "2099-11-03", [nome], "14:00", "16:00")],
      valoresHoraFormador: { [nome]: 25 },
    });
    expect(r.statusCode, r.body).toBe(200);
    const [depois] = await automaticasNaBase(ctx, turmaId);
    expect(depois!.id).toBe(linha!.id);
    expect(depois!.ordem).toBe(linha!.ordem);
    expect(depois!.dados).toMatchObject({
      quantidade: 6, custoUnitario: 25, totalDocDespesa: 150,
      categoriaCusto: "1.4.1 - Formadores externos Nível 1 a 3", docDespesa: "Fatura Recibo", nDocDespesa: "FR 2099/7",
      dataDocDespesa: "2099-11-30", elegivelDocDespesa: 80,
    });
    expect(String(depois!.dados.descricao)).toContain("6 h × 25,00 €/h");
  });

  it("formador que sai da turma: sem nada da equipa a linha apaga-se; com campos da equipa fica, com aviso, e só então se apaga à mão", async () => {
    const ctx = await arrancar();
    const [a, b, c] = [`Ana Fica ${unico()}`, `Bia Sai ${unico()}`, `Caio Preenchido ${unico()}`];
    const turmaId = await turmaFin(ctx, [
      sessao("s1", "2099-12-01", [a]), sessao("s2", "2099-12-02", [b]), sessao("s3", "2099-12-03", [c]),
    ], { valores: { [a]: 10, [b]: 10, [c]: 10 } });
    const linhas = (await lista(ctx, turmaId)).filter(d => d.origem === "formador");
    expect(linhas.map(l => l.formador).sort()).toEqual([a, b, c].sort());
    const deC = linhas.find(l => l.formador === c)!;
    await pedido(ctx, "financiada", "PATCH", `/v1/despesas/${deC.id}`, { dados: { ...deC.dados, nDocDespesa: "FR 1" } });

    // B e C saem do cronograma; o valor de A passa a 0 € (sem valor): também deixa de acompanhar.
    const r = await pedido(ctx, "financiada", "PATCH", `/v1/turmas-fin/${turmaId}`, {
      cronograma: [sessao("s1", "2099-12-01", [a])], valoresHoraFormador: { [a]: 0, [c]: 10 },
    });
    expect(r.statusCode, r.body).toBe(200);
    const ficaram = await automaticasNaBase(ctx, turmaId);
    expect(ficaram).toHaveLength(1);
    expect(ficaram[0]).toMatchObject({ id: deC.id, formador: c, aviso: AVISO_SAIU });
    expect(ficaram[0]!.dados).toMatchObject({ nDocDespesa: "FR 1", totalDocDespesa: 40 });

    // C volta à turma: a linha volta a acompanhá-la (sem aviso), com os campos da equipa.
    await pedido(ctx, "financiada", "PATCH", `/v1/turmas-fin/${turmaId}`, {
      cronograma: [sessao("s1", "2099-12-01", [a]), sessao("s3", "2099-12-03", [c], "09:00", "11:00")],
    });
    const voltou = await automaticasNaBase(ctx, turmaId);
    expect(voltou).toHaveLength(1);
    expect(voltou[0]).toMatchObject({ id: deC.id, aviso: "" });
    expect(voltou[0]!.dados).toMatchObject({ nDocDespesa: "FR 1", quantidade: 2, totalDocDespesa: 20 });

    // Sai outra vez; com aviso, a equipa pode apagá-la.
    await pedido(ctx, "financiada", "PATCH", `/v1/turmas-fin/${turmaId}`, { cronograma: [sessao("s1", "2099-12-01", [a])] });
    expect((await pedido(ctx, "financiada", "DELETE", `/v1/despesas/${deC.id}`)).statusCode).toBe(200);
    expect(await automaticasNaBase(ctx, turmaId)).toEqual([]);
  });

  it("o editor do cronograma também actualiza as horas; apagar a turma leva as automáticas sem dados da equipa", async () => {
    const ctx = await arrancar();
    const nome = `Hugo Cronograma ${unico()}`;
    const turmaId = await turmaFin(ctx, [sessao("s1", "2099-05-04", [nome])], { valores: { [nome]: 10 } });
    await lista(ctx, turmaId);
    const pub = await pedido(ctx, "financiada", "POST", `/v1/turmas/fin/${turmaId}/cronograma/publicar`, {
      sessoes: [sessao("s1", "2099-05-04", [nome]), sessao("s2", "2099-05-05", [nome], "09:00", "10:30")],
    });
    expect(pub.statusCode, pub.body).toBe(200);
    const [linha] = await automaticasNaBase(ctx, turmaId);
    expect(linha!.dados).toMatchObject({ quantidade: 5.5, totalDocDespesa: 55 });

    expect((await pedido(ctx, "financiada", "DELETE", `/v1/turmas-fin/${turmaId}`)).statusCode).toBe(200);
    const resto = await ctx.db.query<{ n: number }>("SELECT count(*)::int AS n FROM despesas_fin WHERE id = $1", [linha!.id]);
    expect(resto.rows[0]!.n).toBe(0);
  });

  it("turma fechada: a ficha alterada já não mexe nas despesas dela", async () => {
    const ctx = await arrancar();
    const nome = `Fábio Fechada ${unico()}`;
    const fichaId = await ficha(ctx, nome, "", 12);
    const turmaId = await turmaFin(ctx, [sessao("s1", "2099-08-03", [nome])]);
    await lista(ctx, turmaId);
    await ctx.db.query("UPDATE turmas_fin SET fechada_em = now() WHERE id = $1", [turmaId]);
    await pedido(ctx, "financiada", "PATCH", `/v1/formadores/${fichaId}`, { custoHora: 40 });
    await lista(ctx, turmaId);
    expect((await automaticasNaBase(ctx, turmaId))[0]!.dados).toMatchObject({ custoUnitario: 12, totalDocDespesa: 48 });
  });

  it("o ficheiro de despesas da turma inclui as automáticas e a cópia da turma acompanha-as", async () => {
    const ctx = await arrancar();
    const nome = `Gil Ficheiro ${unico()}`;
    const turmaId = await turmaFin(ctx, [sessao("s1", "2099-07-01", [nome])], { valores: { [nome]: 22.25 } });
    const exp = await pedido(ctx, "financiada", "GET", `/v1/despesas/exportar?turma=${turmaId}`);
    expect(exp.statusCode).toBe(200);
    const folha = XLSX.read(exp.rawPayload, { type: "buffer" }).Sheets.Despesas!;
    const linhas = XLSX.utils.sheet_to_json<unknown[]>(folha, { header: 1 });
    const cab = linhas[0] as string[];
    const linha = linhas.find(l => l[cab.indexOf("Nome Fornecedor")] === nome)!;
    expect(linha).toBeDefined();
    expect(linha[cab.indexOf("Quantidade")]).toBe(4);
    expect(linha[cab.indexOf("Custo Unitário")]).toBe(22.25);
    expect(linha[cab.indexOf("Total Doc Despesa")]).toBe(89);
    expect(String(linha[cab.indexOf("Descrição")])).toContain("4 h × 22,25 €/h");

    // A exportação guardou a cópia da turma; o valor novo muda a impressão e a gravação da turma substitui a cópia.
    const { dadosDespesasTurma } = await import("../src/reembolso.js");
    const copia = async () => {
      const e = await pedido(ctx, "financiada", "GET", `/v1/turmas-fin/${turmaId}/reembolso`);
      expect(e.statusCode, e.body).toBe(200);
      return e.json().ficheiros.find((f: { tipo: string }) => f.tipo === "despesas") as { desatualizado: boolean; drive: { id: string } | null };
    };
    const c1 = await copia();
    expect(c1).toMatchObject({ desatualizado: false });
    const antes = (await dadosDespesasTurma(ctx.db, turmaId)).impressao;
    await pedido(ctx, "financiada", "PATCH", `/v1/turmas-fin/${turmaId}`, { valoresHoraFormador: { [nome]: 23 } });
    expect((await dadosDespesasTurma(ctx.db, turmaId)).impressao).not.toBe(antes);
    const c2 = await copia();
    expect(c2.desatualizado).toBe(false);
    expect(c2.drive?.id).toBeTruthy();
    expect(c2.drive?.id).not.toBe(c1.drive?.id);
  });

  it("Gold: o valor por hora não cria despesas; comercial e formador não chegam às despesas", async () => {
    const ctx = await arrancar();
    const nome = `Gold Sem Despesa ${unico()}`;
    const goldId = Number((await ctx.db.query<{ id: number }>("SELECT nextval('ops_id_seq')::int AS id")).rows[0]!.id);
    await ctx.db.query(
      `INSERT INTO turmas_gold (id, data_inicio, nome, curso, formador, cronograma) VALUES ($1, '2099-06-01', $2, 'Curso', $3, $4::jsonb)`,
      [goldId, `TG-${unico()}`, nome, JSON.stringify([sessao("g1", "2099-06-01", [nome])])],
    );
    const g = await pedido(ctx, "secretaria", "PATCH", `/v1/turmas-gold/${goldId}`, { valoresHoraFormador: { [nome]: 50 } });
    expect(g.statusCode, g.body).toBe(200);
    const n = await ctx.db.query<{ n: number }>("SELECT count(*)::int AS n FROM despesas_fin WHERE lower(formador) = lower($1)", [nome]);
    expect(n.rows[0]!.n).toBe(0);

    const turmaId = await turmaFin(ctx, [sessao("s1", "2099-06-02", [`Fin ${nome}`])], { valores: { [`Fin ${nome}`]: 10 } });
    expect((await pedido(ctx, "comercial", "GET", `/v1/despesas?turma=${turmaId}`)).statusCode).toBe(403);
    expect((await pedido(ctx, "formador", "GET", `/v1/despesas?turma=${turmaId}`)).statusCode).toBe(403);
    expect((await pedido(ctx, "comercial", "PATCH", `/v1/turmas-fin/${turmaId}`, { valoresHoraFormador: { [`Fin ${nome}`]: 99 } })).statusCode).toBe(403);
    expect(await automaticasNaBase(ctx, turmaId)).toEqual([]);
  });
});
