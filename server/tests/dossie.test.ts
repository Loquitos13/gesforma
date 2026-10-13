import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { removerAtalhos } from "../src/driveArvore.js";
import { arrancar, pedido, type Ctx } from "./helpers.js";

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
let seq = 0;
const unico = (p: string) => `${p}-${Date.now()}-${++seq}`;

async function curso(ctx: Ctx) {
  const nome = unico("Curso Dossie");
  const r = await pedido(ctx, "secretaria", "POST", "/v1/cursos-gold", { nome, categoria: "T", tipo: "Pré-inscrição", preco: 0, regime: "Presencial", horas: 4 });
  expect(r.statusCode).toBe(200);
  return nome;
}

async function turma(ctx: Ctx, cursoNome: string, nome = unico("TD")) {
  const r = await pedido(ctx, "secretaria", "POST", "/v1/turmas-gold", {
    dataInicio: "2030-05-06", nome, curso: cursoNome, local: "Porto", horario: "Laboral Manhã", vagas: 5, estado: "Ativa",
    cronograma: [{ id: unico("s"), data: "2030-05-06", horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", formadores: [] }],
  });
  return r;
}

function upload(ctx: Ctx, token: string, tipo: string) {
  const b = "----dossie";
  const body = Buffer.concat([
    Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="tipo"\r\n\r\n${tipo}\r\n`),
    Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="ficheiro"; filename="${tipo}.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
    PDF,
    Buffer.from(`\r\n--${b}--\r\n`),
  ]);
  return ctx.app.inject({ method: "POST", url: `/v1/public/documentos/${token}`, payload: body, headers: { "content-type": `multipart/form-data; boundary=${b}` } });
}

async function leadComDocsValidados(ctx: Ctx, cursoNome: string, turmaId: number, email: string) {
  const id = (await ctx.app.inject({ method: "POST", url: "/v1/public/preinscricoes", payload: { nome: "Bia", email, curso: cursoNome } })).json().preinscricao.id as number;
  const token = (await ctx.db.query<{ docs_token: string }>("SELECT docs_token FROM preinscricoes WHERE id = $1", [id])).rows[0]!.docs_token;
  for (const tipo of ["cc", "contrato", "regulamento"]) expect((await upload(ctx, token, tipo)).statusCode).toBe(200);
  const docs = await ctx.db.query<{ id: number }>("SELECT id FROM preinscricao_docs WHERE preinscricao_id = $1", [id]);
  for (const d of docs.rows) await pedido(ctx, "secretaria", "POST", `/v1/crm/leads/${id}/documentos/${d.id}/validar`);
  expect((await ctx.app.inject({ method: "POST", url: `/v1/public/documentos/${token}/turma`, payload: { turmaId } })).statusCode).toBe(200);
  expect((await ctx.app.inject({ method: "POST", url: `/v1/public/documentos/${token}/concluir` })).statusCode).toBe(200);
  return id;
}

async function docsDaFicha(ctx: Ctx, formandoId: number) {
  const r = await ctx.db.query<{ n: number }>("SELECT count(*)::int AS n FROM formando_docs WHERE regime = 'gold' AND formando_id = $1 AND estado = 'validado'", [formandoId]);
  return r.rows[0]!.n;
}

describe("documentos da ligação pessoal → área do formando", () => {
  it("só passam com pré-inscrição validada e formando numa turma desse curso; saem se mudar de curso", async () => {
    const ctx = await arrancar();
    const cursoA = await curso(ctx);
    const cursoB = await curso(ctx);
    const tA = (await turma(ctx, cursoA)).json().turma as { id: number };
    const tB = (await turma(ctx, cursoB)).json().turma as { id: number };
    const email = `${unico("bia")}@exemplo.pt`;
    const leadId = await leadComDocsValidados(ctx, cursoA, tA.id, email);

    // Ficha criada antes da validação: ainda nada passa.
    const f = (await pedido(ctx, "secretaria", "POST", "/v1/formandos-gold", { nome: "Bia", email, turmaId: tA.id })).json().formando as { id: number };
    expect(await docsDaFicha(ctx, f.id)).toBe(0);

    // Validada a pré-inscrição: os 3 documentos validados passam, marcados com a origem.
    expect((await pedido(ctx, "secretaria", "POST", `/v1/crm/leads/${leadId}/validar-preinscricao`, {})).statusCode).toBe(200);
    expect(await docsDaFicha(ctx, f.id)).toBe(3);
    const origem = await ctx.db.query<{ n: number }>("SELECT count(*)::int AS n FROM formando_docs WHERE formando_id = $1 AND origem_preinscricao_id = $2", [f.id, leadId]);
    expect(origem.rows[0]!.n).toBe(3);

    // Mudou para uma turma de outro curso: os documentos da ligação saem.
    expect((await pedido(ctx, "secretaria", "PATCH", `/v1/formandos-gold/${f.id}`, { turmaId: tB.id })).statusCode).toBe(200);
    expect(await docsDaFicha(ctx, f.id)).toBe(0);
    // Voltou para a turma do curso: entram de novo.
    expect((await pedido(ctx, "secretaria", "PATCH", `/v1/formandos-gold/${f.id}`, { turmaId: tA.id })).statusCode).toBe(200);
    expect(await docsDaFicha(ctx, f.id)).toBe(3);
  });

  it("formando de outro curso com o mesmo email não recebe os documentos", async () => {
    const ctx = await arrancar();
    const cursoA = await curso(ctx);
    const cursoB = await curso(ctx);
    const tA = (await turma(ctx, cursoA)).json().turma as { id: number };
    const tB = (await turma(ctx, cursoB)).json().turma as { id: number };
    const email = `${unico("rui")}@exemplo.pt`;
    const leadId = await leadComDocsValidados(ctx, cursoA, tA.id, email);
    const outro = (await pedido(ctx, "secretaria", "POST", "/v1/formandos-gold", { nome: "Rui", email, turmaId: tB.id })).json().formando as { id: number };
    expect((await pedido(ctx, "secretaria", "POST", `/v1/crm/leads/${leadId}/validar-preinscricao`, {})).statusCode).toBe(200);
    expect(await docsDaFicha(ctx, outro.id)).toBe(0);
  });
});

describe("dossiê por turma", () => {
  it("nome de turma não se repete no mesmo regime", async () => {
    const ctx = await arrancar();
    const c = await curso(ctx);
    const nome = unico("DUP");
    expect((await turma(ctx, c, nome)).statusCode).toBe(200);
    expect((await turma(ctx, c, nome)).statusCode).toBe(409);
  });

  it("atalhos de formadores fora da turma saem; turma apagada leva os atalhos", async () => {
    const ctx = await arrancar();
    const c = await curso(ctx);
    const t = (await turma(ctx, c)).json().turma as { id: number };
    const [a, b] = await Promise.all([1, 2].map(async i => {
      const r = await ctx.db.query<{ id: number }>(
        "INSERT INTO formadores (id, nome, email) VALUES ($1, $2, $3) RETURNING id",
        [800000 + Math.floor(Math.random() * 1_000_000) + i, unico(`Formador ${i}`), `${randomUUID()}@exemplo.pt`],
      );
      return Number(r.rows[0]!.id);
    }));
    for (const fid of [a, b]) {
      await ctx.db.query(
        "INSERT INTO formador_atalhos (formador_id, regime, turma_id, doc_id, drive_file_id, shortcut_id) VALUES ($1, 'gold', $2, 'cv', '', '')",
        [fid, t.id],
      );
    }
    await removerAtalhos(ctx.db, "", { regime: "gold", turmaId: t.id, manterFormadores: [a!] });
    const ficam = await ctx.db.query<{ formador_id: number }>("SELECT formador_id FROM formador_atalhos WHERE turma_id = $1", [t.id]);
    expect(ficam.rows.map(r => Number(r.formador_id))).toEqual([a]);
    expect((await pedido(ctx, "secretaria", "DELETE", `/v1/turmas-gold/${t.id}`)).statusCode).toBe(200);
    const fim = await ctx.db.query<{ n: number }>("SELECT count(*)::int AS n FROM formador_atalhos WHERE turma_id = $1", [t.id]);
    expect(fim.rows[0]!.n).toBe(0);
  });
});
