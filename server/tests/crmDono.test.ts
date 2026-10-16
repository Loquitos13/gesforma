import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { arrancar, pedido, type Ctx } from "./helpers.js";

// Em PGlite o RLS não actua: estes testes provam que a regra está no código.
process.env.DRIVE_DIR = mkdtempSync(join(tmpdir(), "gesforma-drive-"));

let seq = 0;
const unico = (p: string) => `${p}-${Date.now()}-${++seq}`;

/** Segundo comercial (B), com sessão própria. */
async function comercialB(ctx: Ctx) {
  const id = randomUUID();
  await ctx.db.query("INSERT INTO users (id, name, email, password_hash, role, active) VALUES ($1, 'Comercial B', $2, 'x', 'comercial', true)",
    [id, `comercial.b.${id.slice(0, 8)}@exemplo.pt`]);
  const token = randomBytes(24).toString("hex");
  await ctx.db.query("INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, now() + interval '1 day')",
    [randomUUID(), id, createHash("sha256").update(token).digest("hex")]);
  const { config } = await import("../src/config.js");
  return { id, cookie: `${config.cookieName}=${token}` };
}

function comoB(ctx: Ctx, cookie: string, method: "GET" | "POST" | "PATCH" | "DELETE", url: string, payload?: unknown) {
  return ctx.app.inject({ method, url, headers: { "x-gesforma-client": "web", cookie }, payload: payload as never });
}

describe("CRM: cada comercial só vê e mexe no que é seu (sem depender do RLS)", () => {
  it("pré-inscrições, propostas e contratos de outro comercial e sem dono", async () => {
    const ctx = await arrancar();
    const b = await comercialB(ctx);
    const nomeA = unico("LeadA");
    const ra = await pedido(ctx, "comercial", "POST", "/v1/preinscricoes", { nome: nomeA, telf: "916000001" });
    expect(ra.statusCode, ra.body).toBe(200);
    const leadA = ra.json().preinscricao.id as number;
    const rb = await comoB(ctx, b.cookie, "POST", "/v1/preinscricoes", { nome: unico("LeadB"), telf: "916000002" });
    const leadB = rb.json().preinscricao.id as number;
    const nomeOrfa = unico("LeadOrfa");
    const ro = await pedido(ctx, "secretaria", "POST", "/v1/preinscricoes", { nome: nomeOrfa, telf: "916000003" });
    const leadOrfao = ro.json().preinscricao.id as number;
    await ctx.db.query("UPDATE preinscricoes SET comercial_id = NULL WHERE id = $1", [leadOrfao]);

    // B não vê nem altera a de A, nem a sem dono.
    expect((await comoB(ctx, b.cookie, "GET", `/v1/crm/leads/${leadA}`)).statusCode).toBe(404);
    expect((await comoB(ctx, b.cookie, "GET", `/v1/crm/leads/${leadOrfao}`)).statusCode).toBe(404);
    expect((await comoB(ctx, b.cookie, "PATCH", `/v1/preinscricoes/${leadA}`, { notas: "x" })).statusCode).toBe(404);
    expect((await comoB(ctx, b.cookie, "POST", `/v1/crm/leads/${leadA}/notas`, { nota: "x" })).statusCode).toBe(404);
    expect((await comoB(ctx, b.cookie, "GET", `/v1/crm/leads/${leadB}`)).statusCode).toBe(200);
    const listaB = (await comoB(ctx, b.cookie, "GET", "/v1/crm/leads?perPage=100")).json<{ items: { id: number }[]; total: number }>();
    expect(listaB.items.map(i => i.id)).toEqual([leadB]);
    expect((await comoB(ctx, b.cookie, "GET", `/v1/crm/search?q=${nomeA}`)).json().leads).toEqual([]);
    expect((await comoB(ctx, b.cookie, "GET", `/v1/crm/search?q=${nomeOrfa}`)).json().leads).toEqual([]);
    expect((await comoB(ctx, b.cookie, "GET", "/v1/crm/duplicados?telf=916000001")).json().duplicados).toEqual([]);
    // Em lote também não: nem mexe, nem atribui a outra pessoa.
    expect((await comoB(ctx, b.cookie, "POST", "/v1/crm/lote", { ids: [leadA], acao: "etiqueta", etiquetaId: null })).json().updated).toBe(0);
    expect((await comoB(ctx, b.cookie, "POST", "/v1/crm/lote", { ids: [leadB], acao: "atribuir", comercialId: ctx.userId.comercial })).statusCode).toBe(403);

    // Propostas e contratos (A, B e sem dono).
    const n = 800_000 + Math.floor(Math.random() * 99_000);
    for (const [k, dono] of [[0, ctx.userId.comercial], [1, b.id], [2, null]] as const) {
      await ctx.db.query("INSERT INTO propostas_comerciais (id, comercial_id, cliente_nome, cliente_email) VALUES ($1, $2, 'Cliente', '')", [n + k, dono]);
      await ctx.db.query("INSERT INTO contratos_comerciais (id, comercial_id, cliente_nome) VALUES ($1, $2, 'Cliente')", [n + k, dono]);
    }
    expect((await comoB(ctx, b.cookie, "GET", `/v1/crm/propostas/${n}`)).statusCode).toBe(404);
    expect((await comoB(ctx, b.cookie, "GET", `/v1/crm/propostas/${n + 2}`)).statusCode).toBe(404);
    expect((await comoB(ctx, b.cookie, "GET", `/v1/crm/propostas/${n + 1}`)).statusCode).toBe(200);
    expect((await comoB(ctx, b.cookie, "PATCH", `/v1/equipa/propostas/${n}`, { notas: "x" })).statusCode).toBe(404);
    expect((await comoB(ctx, b.cookie, "GET", `/v1/crm/contratos/${n}`)).statusCode).toBe(404);
    expect((await comoB(ctx, b.cookie, "PATCH", `/v1/crm/contratos/${n}`, { notas: "x" })).statusCode).toBe(404);
    expect((await comoB(ctx, b.cookie, "PATCH", `/v1/crm/contratos/${n + 2}`, { notas: "x" })).statusCode).toBe(404);
    expect((await comoB(ctx, b.cookie, "PATCH", `/v1/crm/contratos/${n + 1}`, { notas: "x" })).statusCode).toBe(200);
    const rp = await comoB(ctx, b.cookie, "GET", "/v1/crm/propostas?porPagina=100"); expect(rp.statusCode, rp.body).toBe(200);
    const propsB = (rp).json<{ linhas: { id: number }[] }>().linhas.map(l => l.id);
    expect(propsB).toEqual([n + 1]);
    const contsB = (await comoB(ctx, b.cookie, "GET", "/v1/crm/contratos?porPagina=100")).json<{ linhas: { id: number }[] }>().linhas.map(l => l.id);
    expect(contsB).toEqual([n + 1]);
    // B não cria contratos em nome de A.
    const novo = await comoB(ctx, b.cookie, "POST", "/v1/crm/contratos", { clienteNome: "X", comercialId: ctx.userId.comercial });
    expect(novo.statusCode, novo.body).toBe(200);
    expect((await ctx.db.query("SELECT comercial_id FROM contratos_comerciais WHERE id = $1", [novo.json().contrato.id])).rows[0]).toEqual({ comercial_id: b.id });

    // Secretaria e admin vêem tudo, órfãos incluídos.
    for (const perfil of ["secretaria", "admin"] as const) {
      expect((await pedido(ctx, perfil, "GET", `/v1/crm/leads/${leadOrfao}`)).statusCode).toBe(200);
      expect((await pedido(ctx, perfil, "GET", `/v1/crm/contratos/${n + 2}`)).statusCode).toBe(200);
      const props = (await pedido(ctx, perfil, "GET", "/v1/crm/propostas?porPagina=100")).json<{ linhas: { id: number }[] }>().linhas.map(l => l.id);
      expect(props).toEqual(expect.arrayContaining([n, n + 1, n + 2]));
      const leads = (await pedido(ctx, perfil, "GET", "/v1/crm/leads?perPage=100")).json<{ items: { id: number }[] }>().items.map(i => i.id);
      expect(leads).toEqual(expect.arrayContaining([leadA, leadB, leadOrfao]));
    }
  });
});

describe("Drive: o formador lê os materiais das suas turmas", () => {
  it("lista e descarrega documentos e conteúdos da sua turma; nunca de outras nem dados pessoais", async () => {
    const ctx = await arrancar();
    const conta = await ctx.db.query<{ email: string }>("SELECT email FROM users WHERE id = $1", [ctx.userId.formador]);
    const eu = unico("Formador Drive");
    expect((await pedido(ctx, "secretaria", "POST", "/v1/formadores", { nome: eu, email: conta.rows[0]!.email, regimes: ["gold"] })).statusCode).toBe(200);
    const turma = async (formadores: string[]) => {
      const nome = unico("TD");
      const r = await pedido(ctx, "secretaria", "POST", "/v1/turmas-gold", {
        dataInicio: "2099-06-01", nome, curso: "Curso Sem Ficha", vagas: 10,
        cronograma: [{ id: "s1", data: "2099-06-01", horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", formadores }],
      });
      expect(r.statusCode, r.body).toBe(200);
      return nome;
    };
    const minha = await turma([eu]);
    const alheia = await turma([unico("Outro")]);
    const pdf = Buffer.from("%PDF-1.4\n%teste\n");
    const enviar = async (kind: string, nomeTurma: string) => {
      const fr = "----drive";
      const campos = { kind, regime: "gold", turma: nomeTurma };
      const body = Buffer.concat([
        ...Object.entries(campos).map(([k, v]) => Buffer.from(`--${fr}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`)),
        Buffer.from(`--${fr}\r\nContent-Disposition: form-data; name="file"; filename="${kind}.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
        pdf, Buffer.from(`\r\n--${fr}--\r\n`),
      ]);
      const r = await ctx.app.inject({
        method: "POST", url: "/v1/drive/files", payload: body,
        headers: { "x-gesforma-client": "web", cookie: ctx.cookie.secretaria, "content-type": `multipart/form-data; boundary=${fr}` },
      });
      expect(r.statusCode, r.body).toBe(200);
      return r.json<{ file: { id: string } }>().file.id;
    };
    const material = await enviar("documento", minha);
    const conteudo = await enviar("conteudo", minha);
    const pessoal = await enviar("formando-doc", minha);
    const dossie = await enviar("dtp", minha);
    const deOutra = await enviar("documento", alheia);

    for (const id of [material, conteudo]) {
      expect((await pedido(ctx, "formador", "GET", `/v1/drive/files/${id}`)).statusCode).toBe(200);
      expect((await pedido(ctx, "formador", "GET", `/v1/drive/files/${id}/content`)).statusCode).toBe(200);
    }
    for (const id of [pessoal, dossie, deOutra]) {
      expect((await pedido(ctx, "formador", "GET", `/v1/drive/files/${id}`)).statusCode).toBe(404);
      expect((await pedido(ctx, "formador", "GET", `/v1/drive/files/${id}/content`)).statusCode).toBe(404);
    }
    const lista = (await pedido(ctx, "formador", "GET", `/v1/drive/files?regime=gold&turma=${encodeURIComponent(minha)}`)).json<{ files: { id: string }[] }>();
    expect(lista.files.map(f => f.id).sort()).toEqual([material, conteudo].sort());
    expect((await pedido(ctx, "formador", "GET", `/v1/drive/files?regime=gold&turma=${encodeURIComponent(alheia)}`)).json()).toEqual({ files: [] });
    expect((await pedido(ctx, "formador", "GET", `/v1/drive/files?regime=fin&turma=${encodeURIComponent(minha)}`)).json()).toEqual({ files: [] });
    // Ler não é apagar.
    expect((await pedido(ctx, "formador", "DELETE", `/v1/drive/files/${material}`)).statusCode).toBe(403);
  });
});
