import { randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { arrancar, pedido, type Ctx } from "./helpers.js";

// Os emails ficam aqui em vez de sair (o worker da API também envia por este módulo: conta tudo).
const caixa = vi.hoisted(() => ({ emails: [] as { to: string; subject: string; text: string; html?: string }[] }));
vi.mock("../src/mailer.js", () => ({
  sendMail: vi.fn(async (_db: unknown, m: { to: string; subject: string; text: string; html?: string }) => {
    caixa.emails.push(m);
    return "teste";
  }),
}));

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

let ctx: Ctx;
let seq = 0;
function unico(prefixo: string) {
  seq += 1;
  return `${prefixo}-${Date.now()}-${seq}`;
}
const para = (email: string) => caixa.emails.filter(m => m.to === email);

async function cursoGold() {
  const nome = unico("Curso Lembretes");
  const r = await pedido(ctx, "secretaria", "POST", "/v1/cursos-gold", {
    nome, categoria: "Teste", tipo: "Pré-inscrição", preco: 0, regime: "Presencial", horas: 8,
  });
  expect(r.statusCode, r.body).toBe(200);
  return nome;
}

/** Pré-inscrição aberta com a ligação pessoal já enviada (o lembrete só vence com `soVencidas`). */
async function lead(curso: string, regime: "gold" | "fin" = "gold", extra: { diasLigacao?: number } = {}) {
  const email = `${unico("lemb")}@exemplo.pt`.toLowerCase();
  const token = randomBytes(18).toString("base64url");
  const dias = extra.diasLigacao ?? 1;
  const r = await ctx.db.query<{ id: number }>(
    `INSERT INTO preinscricoes (id, inscrito, nome, apelido, email, curso, estado, regime, docs_token,
                                docs_token_criado_em, created_at, lembrete_pre_em)
     VALUES (nextval('ops_id_seq')::int, to_char(now(), 'YYYY-MM-DD'), 'Ana', 'Teste', $1, $2, 'Pré-inscrição', $3, $4,
             now() - $5::int * interval '1 day', now() - $5::int * interval '1 day', now())
     RETURNING id`,
    [email, curso, regime, token, dias]);
  return { id: r.rows[0]!.id, email, token };
}

/** Só estas pré-inscrições ficam com o lembrete vencido (as dos outros testes esperam). */
async function soVencidas(ids: number[]) {
  await ctx.db.query("UPDATE preinscricoes SET lembrete_pre_em = now() WHERE NOT (id = ANY($1::int[]))", [`{${ids.join(",")}}`]);
  await ctx.db.query("UPDATE preinscricoes SET lembrete_pre_em = now() - interval '2 days' WHERE id = ANY($1::int[])", [`{${ids.join(",")}}`]);
}

async function docsObrigatorios(curso: string, regime: "gold" | "fin") {
  const { docsDoCurso } = await import("../src/docsCurso.js");
  return (await docsDoCurso(ctx.db, curso, regime)).filter(d => d.required).map(d => d.id);
}

async function gravarDoc(leadId: number, tipo: string, estado: "pendente" | "validado") {
  await ctx.db.query("DELETE FROM preinscricao_docs WHERE preinscricao_id = $1 AND tipo = $2", [leadId, tipo]);
  const r = await ctx.db.query<{ id: number }>(
    "INSERT INTO preinscricao_docs (preinscricao_id, tipo, nome, estado) VALUES ($1, $2, $3, $4) RETURNING id",
    [leadId, tipo, `${tipo}.pdf`, estado]);
  return r.rows[0]!.id;
}

function upload(token: string, tipo: string) {
  const boundary = "----gesforma";
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="tipo"\r\n\r\n${tipo}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="ficheiro"; filename="${tipo}.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
    PDF,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return ctx.app.inject({
    method: "POST", url: `/v1/public/documentos/${token}`, payload: body,
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
  });
}

async function docId(leadId: number, tipo: string) {
  return (await ctx.db.query<{ id: number }>("SELECT id FROM preinscricao_docs WHERE preinscricao_id = $1 AND tipo = $2", [leadId, tipo])).rows[0]!.id;
}

async function contactos(leadId: number) {
  return (await ctx.db.query<{ nota: string }>("SELECT nota FROM preinscricao_contactos WHERE preinscricao_id = $1 ORDER BY id", [leadId])).rows.map(r => r.nota);
}

beforeAll(async () => {
  ctx = await arrancar();
  // Um lembrete por dia, até 10.
  const r = await pedido(ctx, "admin", "PUT", "/v1/settings/lembrete_pre", { values: { activo: "1", quantidade: "1", unidade: "dias", maximo: "10" } });
  expect(r.statusCode, r.body).toBe(200);
});

describe("lembretes dos documentos em falta", () => {
  it("Gold e Financiada recebem lembretes até a documentação ficar regularizada", async () => {
    const { enviarLembretesPreinscricao } = await import("../src/lembretePre.js");
    const cursoG = await cursoGold();
    const cursoF = unico("Curso Fin Lembretes");
    const gold = await lead(cursoG, "gold");
    const fin = await lead(cursoF, "fin");
    // Gold: a turma já está escolhida, só faltam documentos.
    await ctx.db.query("UPDATE preinscricoes SET turma_escolhida_id = 1 WHERE id = $1", [gold.id]);

    await soVencidas([gold.id, fin.id]);
    await enviarLembretesPreinscricao(ctx.db);
    expect(para(gold.email)).toHaveLength(1);
    expect(para(fin.email)).toHaveLength(1);
    for (const l of [gold, fin]) {
      const m = para(l.email)[0]!;
      expect(`${m.text}${m.html}`).toContain(`/documentos/${l.token}`);
    }

    // A Gold regulariza (tudo validado); a Financiada continua sem documentos.
    for (const tipo of await docsObrigatorios(cursoG, "gold")) await gravarDoc(gold.id, tipo, "validado");
    await soVencidas([gold.id, fin.id]);
    await enviarLembretesPreinscricao(ctx.db);
    expect(para(gold.email)).toHaveLength(1);
    expect(para(fin.email)).toHaveLength(2);

    // A ficha mostra os lembretes: enviados, último e próximo.
    const dossie = (await pedido(ctx, "secretaria", "GET", `/v1/crm/leads/${fin.id}`)).json();
    expect(dossie.lembretes).toMatchObject({ enviados: 2, maximo: 10 });
    expect(dossie.lembretes.ultimoEm).toBeTruthy();
    expect(dossie.lembretes.proximoEm).toBeTruthy();
    const dossieGold = (await pedido(ctx, "secretaria", "GET", `/v1/crm/leads/${gold.id}`)).json();
    expect(dossieGold.lembretes).toMatchObject({ enviados: 1, proximoEm: null, semProximo: "Nada pendente." });
  });

  it("em lotes: mais de 20 numa volta dentro do prazo, sem duplicados ao repetir", async () => {
    const { enviarLembretesPreinscricao } = await import("../src/lembretePre.js");
    const curso = await cursoGold();
    const leads = [];
    for (let i = 0; i < 32; i++) leads.push(await lead(curso, "fin"));
    await soVencidas(leads.map(l => l.id));
    await enviarLembretesPreinscricao(ctx.db, Date.now() + 15_000);
    for (const l of leads) expect(para(l.email), l.email).toHaveLength(1);
    // Repetir a volta (retry do cron) não envia outra vez.
    await enviarLembretesPreinscricao(ctx.db, Date.now() + 15_000);
    for (const l of leads) expect(para(l.email)).toHaveLength(1);
    const r = await ctx.db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM preinscricoes WHERE id = ANY($1::int[]) AND lembretes_enviados = 1 AND lembrete_enviado_em IS NOT NULL",
      [`{${leads.map(l => l.id).join(",")}}`]);
    expect(r.rows[0]!.n).toBe(32);
  });
});

describe("documento recusado", () => {
  it("envia logo um email com o motivo e a ligação; recusas seguidas agrupam-se; regista o contacto", async () => {
    const curso = await cursoGold();
    const l = await lead(curso, "gold");
    for (const tipo of ["cc", "contrato"]) expect((await upload(l.token, tipo)).statusCode).toBe(200);

    const r1 = await pedido(ctx, "secretaria", "POST", `/v1/crm/leads/${l.id}/documentos/${await docId(l.id, "cc")}/recusar`, { observacao: "Cartão ilegível" });
    expect(r1.statusCode, r1.body).toBe(200);
    expect(r1.json().avisoRecusa).toMatchObject({ enviado: true });
    expect(para(l.email)).toHaveLength(1);
    const m = para(l.email)[0]!;
    expect(m.subject).toContain("Documentos a corrigir");
    expect(`${m.text}${m.html}`).toContain("Cartão ilegível");
    expect(`${m.text}${m.html}`).toContain(`/documentos/${l.token}`);
    expect((await contactos(l.id)).at(-1)).toMatch(/^Pedido de reenvio automático · documentos recusados: .*Cartão ilegível/);

    // Segunda recusa logo a seguir: não sai outro email (fica para o próximo envio).
    const r2 = await pedido(ctx, "secretaria", "POST", `/v1/crm/leads/${l.id}/documentos/${await docId(l.id, "contrato")}/recusar`, { observacao: "Falta a assinatura" });
    expect(r2.json().avisoRecusa).toMatchObject({ enviado: false, adiado: true });
    expect(r2.json().recusasPorAvisar).toBe(1);
    expect(para(l.email)).toHaveLength(1);

    // Passada a janela, a volta automática envia a recusa que ficou (uma só vez).
    const { enviarRecusasPendentes } = await import("../src/avisosDocumentos.js");
    await ctx.db.query("UPDATE preinscricoes SET recusa_email_em = now() - interval '1 hour' WHERE id = $1", [l.id]);
    await enviarRecusasPendentes(ctx.db);
    await enviarRecusasPendentes(ctx.db);
    expect(para(l.email)).toHaveLength(2);
    expect(`${para(l.email)[1]!.text}`).toContain("Falta a assinatura");

    // «Reenviar pedido agora» envia sempre, com os recusados.
    const r3 = await pedido(ctx, "secretaria", "POST", `/v1/crm/leads/${l.id}/documentos/reenviar-pedido`);
    expect(r3.statusCode, r3.body).toBe(200);
    expect(para(l.email)).toHaveLength(3);
    expect(para(l.email)[2]!.text).toContain("Cartão ilegível");
    expect(para(l.email)[2]!.text).toContain("Falta a assinatura");
  });

  it("o reenvio sem recusados pede os documentos em falta; sem nada pendente recusa", async () => {
    const curso = await cursoGold();
    const l = await lead(curso, "gold");
    const r = await pedido(ctx, "secretaria", "POST", `/v1/crm/leads/${l.id}/documentos/reenviar-pedido`);
    expect(r.statusCode, r.body).toBe(200);
    expect(para(l.email)).toHaveLength(1);
    expect((await contactos(l.id)).at(-1)).toMatch(/^Pedido reenviado · documentação em falta/);
    for (const tipo of await docsObrigatorios(curso, "gold")) await gravarDoc(l.id, tipo, "validado");
    expect((await pedido(ctx, "secretaria", "POST", `/v1/crm/leads/${l.id}/documentos/reenviar-pedido`)).statusCode).toBe(400);
  });

  it("formando da Financiada: a recusa avisa logo e entra nos lembretes automáticos", async () => {
    const { enviarLembretesFormandosFin } = await import("../src/avisosDocumentos.js");
    const id = 990000 + Math.floor(Math.random() * 9000);
    const email = `${unico("fin")}@exemplo.pt`.toLowerCase();
    const token = randomBytes(18).toString("base64url");
    await ctx.db.query(
      "INSERT INTO formandos_fin (id, nome, apelido, turma, curso, estado, email, docs_token) VALUES ($1, 'Rui', 'Fin', '', 'Curso Fin', 'Elegível', $2, $3)",
      [id, email, token]);
    await ctx.db.query(
      "INSERT INTO formando_docs (regime, formando_id, doc_id, file_name, estado) VALUES ('fin', $1, 'cc', 'cc.pdf', 'pendente')", [id]);
    const r = await pedido(ctx, "secretaria", "POST", `/v1/formandos/fin/${id}/documentos/cc/recusar`, { observacao: "Documento caducado" });
    expect(r.statusCode, r.body).toBe(200);
    expect(para(email)).toHaveLength(1);
    expect(`${para(email)[0]!.text}`).toContain("Documento caducado");
    expect(`${para(email)[0]!.text}${para(email)[0]!.html}`).toContain(`/documentos-formando/${token}`);

    // Lembrete automático depois do intervalo (e só um por volta).
    await ctx.db.query("UPDATE formandos_fin SET lembrete_docs_em = now() - interval '2 days' WHERE id = $1", [id]);
    await enviarLembretesFormandosFin(ctx.db);
    await enviarLembretesFormandosFin(ctx.db);
    expect(para(email)).toHaveLength(2);
    // Desistiu: a ligação fecha (410) e os lembretes param.
    await ctx.db.query("UPDATE formandos_fin SET estado = 'Desistiu', lembrete_docs_em = now() - interval '2 days' WHERE id = $1", [id]);
    await enviarLembretesFormandosFin(ctx.db);
    expect(para(email)).toHaveLength(2);
    expect((await ctx.app.inject({ method: "GET", url: `/v1/public/formando-documentos/${token}` })).statusCode).toBe(410);
  });
});

describe("ligação pessoal até à regularização", () => {
  it("passados 90 dias continua aberta enquanto faltarem documentos; regularizada, expira", async () => {
    const { enviarLembretesPreinscricao } = await import("../src/lembretePre.js");
    const curso = await cursoGold();
    const l = await lead(curso, "gold", { diasLigacao: 120 });
    await ctx.db.query("UPDATE preinscricoes SET turma_escolhida_id = 1 WHERE id = $1", [l.id]);
    const aberta = (await ctx.app.inject({ method: "GET", url: `/v1/public/documentos/${l.token}` })).json();
    expect(aberta.encerrada).toBeFalsy();

    // O lembrete sai com a mesma ligação (que abre).
    await ctx.db.query("UPDATE preinscricoes SET docs_token_usado_em = now() - interval '120 days' WHERE id = $1", [l.id]);
    await soVencidas([l.id]);
    await enviarLembretesPreinscricao(ctx.db);
    expect(para(l.email)).toHaveLength(1);
    expect(`${para(l.email)[0]!.text}${para(l.email)[0]!.html}`).toContain(`/documentos/${l.token}`);

    // Tudo validado e 90 dias sem uso: expira.
    for (const tipo of await docsObrigatorios(curso, "gold")) await gravarDoc(l.id, tipo, "validado");
    const fechada = (await ctx.app.inject({ method: "GET", url: `/v1/public/documentos/${l.token}` })).json();
    expect(fechada).toMatchObject({ encerrada: true, motivo: "expirada" });

    // Um documento recusado volta a abrir a ligação (a pessoa tem de o corrigir).
    const cc = await docId(l.id, "cc");
    expect((await pedido(ctx, "secretaria", "POST", `/v1/crm/leads/${l.id}/documentos/${cc}/recusar`, { observacao: "Ilegível" })).statusCode).toBe(200);
    const reaberta = (await ctx.app.inject({ method: "GET", url: `/v1/public/documentos/${l.token}` })).json();
    expect(reaberta.encerrada).toBeFalsy();
    expect(para(l.email).at(-1)!.text).toContain("Ilegível");
  });

  it("desistência fecha a ligação mesmo com documentos em falta", async () => {
    const curso = await cursoGold();
    const l = await lead(curso, "gold", { diasLigacao: 120 });
    await ctx.db.query("UPDATE preinscricoes SET estado = 'Desistiu' WHERE id = $1", [l.id]);
    const v = (await ctx.app.inject({ method: "GET", url: `/v1/public/documentos/${l.token}` })).json();
    expect(v).toMatchObject({ encerrada: true, motivo: "desistiu" });
  });
});
