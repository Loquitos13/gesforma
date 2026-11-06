// Notas de 05-11: a equipa entrega documentos pela pessoa na ficha da pré-inscrição; frase em destaque na página do
// curso (Financiada); conta de formando escondida que «já existe» ao criar um utilizador da equipa.
import { describe, expect, it } from "vitest";
import { destaquePagina } from "../../src/partilhado/textosCurso.js";
import { arrancar, pedido, type Ctx } from "./helpers.js";

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

function entregar(ctx: Ctx, role: "comercial" | "contabilidade" | "financiada", id: number, tipo: string, bytes = PDF, nome = "doc.pdf") {
  const boundary = "----doc";
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${nome}"\r\nContent-Type: application/pdf\r\n\r\n`),
    bytes, Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return ctx.app.inject({
    method: "POST", url: `/v1/crm/leads/${id}/documentos/entregar/${tipo}`, payload: body,
    headers: { "content-type": `multipart/form-data; boundary=${boundary}`, cookie: ctx.cookie[role], "x-gesforma-client": "web" },
  });
}

describe("documentos entregues pela equipa na ficha da pré-inscrição", () => {
  it("a coordenação entrega um documento do curso: fica por validar; os validados e os de fora do curso não", async () => {
    const ctx = await arrancar();
    const id = 970000 + Math.floor(Math.random() * 9000);
    const c = (await ctx.db.query<{ nome_comercial: string; ufcd: string }>("SELECT nome_comercial, ufcd FROM cursos_fin ORDER BY id LIMIT 1")).rows[0]!;
    await ctx.db.query(
      `INSERT INTO preinscricoes (id, inscrito, nome, apelido, email, telf, curso, preco, estado, regime)
       VALUES ($1, '2031-01-01 10:00', 'Doc', 'Equipa', $2, '912000000', $3, 0, '1º Contacto', 'fin')`,
      [id, `doc.${id}@exemplo.pt`, c.nome_comercial || c.ufcd]);
    const antes = (await pedido(ctx, "financiada", "GET", `/v1/crm/leads/${id}`)).json() as { docsParaEntregar: { id: string }[] };
    expect(antes.docsParaEntregar.length).toBeGreaterThan(0);
    const tipo = antes.docsParaEntregar[0]!.id;

    expect((await entregar(ctx, "contabilidade", id, tipo)).statusCode).toBe(403);
    expect((await entregar(ctx, "financiada", id, "nao-existe")).statusCode).toBe(400);
    expect((await entregar(ctx, "financiada", id, tipo, Buffer.from("olá"), "x.pdf")).statusCode).toBe(400);
    const r = await entregar(ctx, "financiada", id, tipo);
    expect(r.statusCode, r.body).toBe(200);
    const doc = (r.json().documentos as { id: number; tipo: string; estado: string }[]).find(d => d.tipo === tipo)!;
    expect(doc.estado).toBe("pendente");

    // Validado: deixa de se poder entregar.
    expect((await pedido(ctx, "admin", "POST", `/v1/crm/leads/${id}/documentos/${doc.id}/validar`)).statusCode).toBe(200);
    expect((await entregar(ctx, "financiada", id, tipo)).statusCode).toBe(409);
    const depois = (await pedido(ctx, "financiada", "GET", `/v1/crm/leads/${id}`)).json() as { docsParaEntregar: { id: string }[] };
    expect(depois.docsParaEntregar.some(d => d.id === tipo)).toBe(false);
  });
});

describe("frase em destaque na página do curso", () => {
  it("só aparece com a caixa ligada e texto escrito", async () => {
    expect(destaquePagina({ destaquePaginaAtivo: true, destaquePagina: "  Inscrições até dia 30.  " })).toBe("Inscrições até dia 30.");
    expect(destaquePagina({ destaquePaginaAtivo: false, destaquePagina: "Inscrições até dia 30." })).toBe("");
    expect(destaquePagina({ destaquePaginaAtivo: true, destaquePagina: "" })).toBe("");
    const ctx = await arrancar();
    const curso = (await ctx.db.query<{ id: number }>("SELECT id FROM cursos_fin ORDER BY id LIMIT 1")).rows[0]!;
    const longo = await pedido(ctx, "admin", "PUT", `/v1/cursos/fin/${curso.id}/ficha`, { payload: { destaquePaginaAtivo: true, destaquePagina: "x".repeat(301) } });
    expect(longo.statusCode).toBe(400);
  });
});

describe("conta de formando com o email de alguém da equipa", () => {
  it("aparece na pesquisa e a mensagem de email repetido diz que conta é", async () => {
    const ctx = await arrancar();
    const email = `cat.${Date.now()}@ena.pt`;
    await ctx.db.query("INSERT INTO users (id, name, email, password_hash, role, active) VALUES (gen_random_uuid(), 'Cátia Teste', $1, 'x', 'formando', true)", [email]);
    const lista = (await pedido(ctx, "admin", "GET", "/v1/utilizadores")).json();
    const linhas = (lista.utilizadores ?? lista.users ?? lista.linhas) as { email: string }[];
    expect(linhas.some(u => u.email === email)).toBe(false);
    const pesquisa = (await pedido(ctx, "admin", "GET", `/v1/utilizadores?q=${encodeURIComponent(email)}`)).json();
    expect(((pesquisa.utilizadores ?? pesquisa.users ?? pesquisa.linhas) as { email: string; role: string }[]).find(u => u.email === email)?.role).toBe("formando");
    const r = await pedido(ctx, "admin", "POST", "/v1/utilizadores", { name: "Cátia", email, password: "Uma-Palavra-Passe-Forte-123", role: "secretaria" });
    expect(r.statusCode).toBe(409);
    expect(r.json().error).toMatch(/Cátia Teste · conta de formando/);
  });
});

describe("conta sem acesso ao CRM", () => {
  it("a coordenação sem CRM não entra nas pré-inscrições nem no WhatsApp, mas trata das turmas; e não recebe os avisos", async () => {
    const ctx = await arrancar();
    const { emailsDaEquipa } = await import("../src/equipaDestinatarios.js");
    const id = ctx.userId.financiada;
    const email = (await ctx.db.query<{ email: string }>("SELECT email FROM users WHERE id = $1", [id])).rows[0]!.email;
    // Só o administrador muda a opção.
    expect((await pedido(ctx, "financiada", "PATCH", `/v1/utilizadores/${id}`, { semCrm: true })).statusCode).toBe(403);
    expect((await pedido(ctx, "admin", "PATCH", `/v1/utilizadores/${id}`, { semCrm: true })).statusCode).toBe(200);
    try {
      expect((await pedido(ctx, "financiada", "GET", "/v1/crm/leads?regime=fin")).statusCode).toBe(403);
      expect((await pedido(ctx, "financiada", "GET", "/v1/crm/whatsapp/conversas")).statusCode).toBe(403);
      expect((await pedido(ctx, "financiada", "GET", "/v1/alertas/documentos")).statusCode).toBe(403);
      expect((await pedido(ctx, "financiada", "GET", "/v1/turmas?regime=fin")).statusCode).toBe(200);
      expect((await pedido(ctx, "financiada", "GET", "/v1/formandos?regime=fin")).statusCode).toBe(200);
      const me = (await pedido(ctx, "financiada", "GET", "/v1/me")).json() as { user: { semCrm: boolean }; pode: string[] };
      expect(me.user.semCrm).toBe(true);
      expect(me.pode.some(c => /^(crm|whatsapp)\./.test(c))).toBe(false);
      expect(me.pode).toContain("fin.ver");
      // Os avisos do CRM não lhe chegam; os outros sim.
      expect((await emailsDaEquipa(ctx.db, ["fin"], { crm: true })).some(p => p.email === email)).toBe(false);
      expect((await emailsDaEquipa(ctx.db, ["fin"])).some(p => p.email === email)).toBe(true);
    } finally {
      await pedido(ctx, "admin", "PATCH", `/v1/utilizadores/${id}`, { semCrm: false });
    }
    expect((await pedido(ctx, "financiada", "GET", "/v1/crm/leads?regime=fin")).statusCode).toBe(200);
  });
});

describe("filas das pré-inscrições: documentos e pagamento", () => {
  it("documentos por validar, pagamento por validar e aguarda pagamento", async () => {
    const ctx = await arrancar();
    const base = 960000 + Math.floor(Math.random() * 9000);
    const marca = `Fila${base}`;
    const ins = (id: number, extra = "", valores: unknown[] = []) => ctx.db.query(
      `INSERT INTO preinscricoes (id, inscrito, nome, apelido, email, telf, curso, preco, estado, regime${extra ? `, ${extra}` : ""})
       VALUES ($1, '2031-01-01 10:00', $2, 'T', $3, '912000000', 'Formação de Formadores - CCP', 125, 'Pré-inscrição', 'gold'${valores.map((_, i) => `, $${i + 4}`).join("")})`,
      [id, marca, `fila.${id}@exemplo.pt`, ...valores]);
    // 1: documento por validar; 2: comprovativo por validar; 3: pagamento pedido, sem comprovativo; 4: pagamento pedido e pago.
    await ins(base);
    await ctx.db.query("INSERT INTO preinscricao_docs (preinscricao_id, tipo, nome, estado) VALUES ($1, 'cc', 'cc.pdf', 'pendente')", [base]);
    await ins(base + 1, "pagamento_pedido_em", [new Date().toISOString()]);
    await ctx.db.query("INSERT INTO preinscricao_docs (preinscricao_id, tipo, nome, estado) VALUES ($1, 'comprovativo', 'c.pdf', 'pendente')", [base + 1]);
    await ins(base + 2, "pagamento_pedido_em", [new Date().toISOString()]);
    const pag = `PF-${base}`;
    await ctx.db.query("INSERT INTO pagamentos (id, nome, valor, metodo, curso, data, estado, email) VALUES ($1, 'X', 125, 'Transferência bancária', 'CCP', '2031-01-01', 'Pago', 'x@exemplo.pt')", [pag]);
    await ins(base + 3, "pagamento_pedido_em, pagamento_id", [new Date().toISOString(), pag]);
    const lista = async (fila: string) => {
      const r = (await pedido(ctx, "admin", "GET", `/v1/crm/leads?regime=gold&q=${marca}&fila=${fila}`)).json() as { items: { id: number }[] };
      return r.items.map(l => l.id).sort();
    };
    expect(await lista("docs_validar")).toEqual([base]);
    expect(await lista("pagamento_validar")).toEqual([base + 1]);
    expect(await lista("aguarda_pagamento")).toEqual([base + 2]);
    const c = (await pedido(ctx, "admin", "GET", "/v1/crm/leads?regime=gold")).json().counts as Record<string, number>;
    expect(c.docsValidar).toBeGreaterThanOrEqual(1);
    expect(c.pagamentoValidar).toBeGreaterThanOrEqual(1);
    expect(c.aguardaPagamento).toBeGreaterThanOrEqual(1);
  });
});

describe("listas paginadas no servidor", () => {
  it("utilizadores e pré-inscrições: página e número de linhas escolhidos pelo utilizador", async () => {
    const ctx = await arrancar();
    const p1 = (await pedido(ctx, "admin", "GET", "/v1/utilizadores?porPagina=2&pagina=1")).json() as { users: { id: string }[]; total: number; porPagina: number };
    expect(p1.users).toHaveLength(2);
    expect(p1.porPagina).toBe(2);
    expect(p1.total).toBeGreaterThan(2);
    const p2 = (await pedido(ctx, "admin", "GET", "/v1/utilizadores?porPagina=2&pagina=2")).json() as { users: { id: string }[] };
    expect(p2.users.some(u => p1.users.some(x => x.id === u.id))).toBe(false);
    expect((await pedido(ctx, "admin", "GET", "/v1/utilizadores?porPagina=500")).statusCode).toBe(400);
    const leads = await pedido(ctx, "admin", "GET", "/v1/crm/leads?regime=gold&perPage=200");
    expect(leads.statusCode, leads.body).toBe(200);
    expect(leads.json().perPage).toBe(200);
  });
});
