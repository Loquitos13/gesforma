import { describe, expect, it } from "vitest";
import { arrancar, pedido, preinscricaoDoEmail, type Ctx } from "./helpers.js";

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

let seq = 0;
function unico(prefixo: string) {
  seq += 1;
  return `${prefixo}-${Date.now()}-${seq}`;
}

async function cursoGold(ctx: Ctx, preco = 100) {
  const nome = unico("Curso Teste");
  const r = await pedido(ctx, "secretaria", "POST", "/v1/cursos-gold", {
    nome, categoria: "Teste", tipo: "Pré-inscrição", preco, regime: "Presencial", horas: 8,
  });
  expect(r.statusCode).toBe(200);
  return nome;
}

async function turmaGold(ctx: Ctx, curso: string, dataInicio: string, vagas = 5) {
  const r = await pedido(ctx, "secretaria", "POST", "/v1/turmas-gold", {
    dataInicio, nome: unico("T"), curso, local: "Porto", horario: "Laboral Manhã", vagas, toleranciaVagas: 0, estado: "Ativa",
    cronograma: [{ id: unico("s"), data: dataInicio, horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", formadores: [] }],
  });
  expect(r.statusCode).toBe(200);
  return r.json().turma as { id: number; nome: string };
}

function publico(ctx: Ctx, body: Record<string, unknown>) {
  return ctx.app.inject({ method: "POST", url: "/v1/public/preinscricoes", payload: body, remoteAddress: `10.0.${seq % 250}.${(seq * 7) % 250}` });
}

/** Envia o formulário público e devolve o id gravado (lido na base: a resposta não o leva). */
async function idPublico(ctx: Ctx, body: Record<string, unknown>) {
  const r = await publico(ctx, body);
  expect(r.statusCode, r.body).toBe(200);
  return preinscricaoDoEmail(ctx, String(body.email));
}

async function tokenDe(ctx: Ctx, id: number) {
  const r = await ctx.db.query<{ docs_token: string }>("SELECT docs_token FROM preinscricoes WHERE id = $1", [id]);
  return r.rows[0]!.docs_token;
}

function upload(ctx: Ctx, token: string, tipo: string, nome: string, bytes: Buffer) {
  const boundary = "----gesforma";
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="tipo"\r\n\r\n${tipo}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="ficheiro"; filename="${nome}"\r\nContent-Type: application/pdf\r\n\r\n`),
    bytes,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return ctx.app.inject({
    method: "POST", url: `/v1/public/documentos/${token}`, payload: body,
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
  });
}

async function validarDoc(ctx: Ctx, leadId: number, tipo: string) {
  const d = await ctx.db.query<{ id: number }>("SELECT id FROM preinscricao_docs WHERE preinscricao_id = $1 AND tipo = $2", [leadId, tipo]);
  const r = await pedido(ctx, "secretaria", "POST", `/v1/crm/leads/${leadId}/documentos/${d.rows[0]!.id}/validar`);
  expect(r.statusCode).toBe(200);
}

async function recusarDoc(ctx: Ctx, leadId: number, tipo: string) {
  const d = await ctx.db.query<{ id: number }>("SELECT id FROM preinscricao_docs WHERE preinscricao_id = $1 AND tipo = $2", [leadId, tipo]);
  const r = await pedido(ctx, "secretaria", "POST", `/v1/crm/leads/${leadId}/documentos/${d.rows[0]!.id}/recusar`, { observacao: "Ilegível" });
  expect(r.statusCode, r.body).toBe(200);
}

const doc = async (ctx: Ctx, leadId: number, tipo: string) =>
  (await ctx.db.query<{ estado: string; drive_file_id: string }>(
    "SELECT COALESCE(estado, 'pendente') AS estado, drive_file_id FROM preinscricao_docs WHERE preinscricao_id = $1 AND tipo = $2", [leadId, tipo])).rows;

describe("documentos pessoais: validado fica, só o errado se substitui", () => {
  it("um documento validado noutra pré-inscrição da mesma pessoa fica logo guardado e não se volta a pedir", async () => {
    const ctx = await arrancar();
    const email = `${unico("pessoa")}@exemplo.pt`;
    const curso1 = await cursoGold(ctx);
    const a = await idPublico(ctx, { nome: "Rita", email, telf: "912345678", curso: curso1 });
    expect((await upload(ctx, await tokenDe(ctx, a), "cc", "cc.pdf", PDF)).statusCode).toBe(200);
    await validarDoc(ctx, a, "cc");
    const ficheiroA = (await doc(ctx, a, "cc"))[0]!.drive_file_id;

    const curso2 = await cursoGold(ctx);
    const b = await idPublico(ctx, { nome: "Rita", email, telf: "912345678", curso: curso2 });
    expect(await doc(ctx, b, "cc")).toEqual([{ estado: "validado", drive_file_id: ficheiroA }]);
    const tokenB = await tokenDe(ctx, b);
    const vista = (await ctx.app.inject({ method: "GET", url: `/v1/public/documentos/${tokenB}` })).json();
    expect(JSON.stringify(vista)).toContain("validado");
    expect((await upload(ctx, tokenB, "cc", "outro.pdf", PDF)).statusCode).toBe(409);

    // Apagar a pré-inscrição B não apaga o ficheiro, que continua a ser o da A.
    expect((await pedido(ctx, "admin", "DELETE", `/v1/preinscricoes/${b}`)).statusCode).toBe(200);
    expect((await ctx.db.query("SELECT 1 FROM drive_files WHERE id = $1", [ficheiroA])).rows).toHaveLength(1);
  });

  it("o recusado é substituído pelo novo; o validado não; ao validar, os recusados por corrigir não seguem para a turma", async () => {
    const ctx = await arrancar();
    const curso = await cursoGold(ctx);
    const email = `${unico("rec")}@exemplo.pt`;
    const id = await idPublico(ctx, { nome: "Rui", email, telf: "912345678", curso });
    const token = await tokenDe(ctx, id);
    expect((await upload(ctx, token, "cc", "cc.pdf", PDF)).statusCode).toBe(200);
    const errado = (await doc(ctx, id, "cc"))[0]!.drive_file_id;
    await recusarDoc(ctx, id, "cc");
    expect((await upload(ctx, token, "cc", "cc-novo.pdf", PDF)).statusCode).toBe(200);
    const novo = await doc(ctx, id, "cc");
    expect(novo).toHaveLength(1);
    expect(novo[0]!.estado).toBe("pendente");
    expect(novo[0]!.drive_file_id).not.toBe(errado);
    expect((await ctx.db.query("SELECT 1 FROM drive_files WHERE id = $1", [errado])).rows).toHaveLength(0);
    await validarDoc(ctx, id, "cc");
    expect((await upload(ctx, token, "cc", "outra-vez.pdf", PDF)).statusCode).toBe(409);

    // Um recusado que ficou por corrigir sai na validação (não vai para a turma nem para o DTP).
    const { apagarRecusados } = await import("../src/repos/leadDocs.js");
    await ctx.db.query(
      "INSERT INTO preinscricao_docs (preinscricao_id, tipo, nome, drive_file_id, drive_url, estado) VALUES ($1, 'extra-x', 'x.pdf', '', '', 'recusado')", [id]);
    expect(await apagarRecusados(ctx.db, id)).toHaveLength(1);
    expect(await doc(ctx, id, "extra-x")).toHaveLength(0);
    expect(await doc(ctx, id, "cc")).toHaveLength(1);
  });
});
