import { describe, expect, it } from "vitest";
import { arrancar, pedido } from "./helpers.js";

let seq = 0;
const unico = (p: string) => `${p} ${Date.now()}-${++seq}`;
const DOCS = ["cc", "ch", "cu", "ci", "ce", "morada", "rgpd"];
const comDocs = (falta: string[] = []) => Object.fromEntries(DOCS.map(k => [k, { ok: !falta.includes(k), data: "" }]));

describe("Financiada: não se associa à acção sem os documentos obrigatórios", () => {
  it("inscrever na turma, colocar depois e a candidatura «Colocado na turma» recusam sem documentos", async () => {
    const ctx = await arrancar();
    const t = await pedido(ctx, "secretaria", "POST", "/v1/turmas-fin", { dataInicio: "2099-02-02", nome: unico("DT"), curso: "UFCD Docs", capacidade: 10 });
    expect(t.statusCode, t.body).toBe(200);
    const turmaId = t.json().turma.id as number;
    const email = () => `dt.${Date.now()}.${++seq}@exemplo.pt`;

    const sem = await pedido(ctx, "financiada", "POST", "/v1/formandos-fin", { ...comDocs(["rgpd"]), nome: "Rita", apelido: "Sá", email: email(), turmaId });
    expect(sem.statusCode).toBe(409);
    expect(sem.json().error).toContain("Declaração RGPD");
    // O contrato não conta: assina-se ao entrar na acção.
    expect((await pedido(ctx, "financiada", "POST", "/v1/formandos-fin", { ...comDocs(), nome: "Rui", apelido: "Sá", email: email(), turmaId })).statusCode).toBe(200);

    // Ficha sem turma, colocada depois: só com os documentos.
    const ficha = await pedido(ctx, "financiada", "POST", "/v1/formandos-fin", { nome: "Ana", apelido: "Sá", email: email() });
    expect(ficha.statusCode, ficha.body).toBe(200);
    const id = ficha.json().formando.id as number;
    expect((await pedido(ctx, "financiada", "PATCH", `/v1/formandos-fin/${id}`, { turmaId })).statusCode).toBe(409);
    expect((await pedido(ctx, "financiada", "PATCH", `/v1/formandos-fin/${id}`, { ...comDocs(), turmaId })).statusCode).toBe(200);

    const turma = (await pedido(ctx, "secretaria", "GET", `/v1/turmas/fin/${turmaId}`)).json().turma.nome as string;
    const cand = { nome: "Eva", email: email(), curso: "UFCD Docs", turma, estado: "Colocado na turma", docs: { cc: true, ch: true, cu: true, ci: true } };
    expect((await pedido(ctx, "financiada", "POST", "/v1/inscricoes-fin", cand)).statusCode).toBe(409);
    expect((await pedido(ctx, "financiada", "POST", "/v1/inscricoes-fin", { ...cand, docs: { ...cand.docs, ce: true } })).statusCode).toBe(200);
  });
});
