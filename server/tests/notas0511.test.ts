// Notas de 05-11: a equipa entrega documentos pela pessoa na ficha da pré-inscrição; frase em destaque na página do
// curso (Financiada); conta de formando escondida que «já existe» ao criar um utilizador da equipa.
import { describe, expect, it } from "vitest";
import { destaquePagina } from "../../src/partilhado/textosCurso.js";
import { arrancar, pedido, type Ctx } from "./helpers.js";

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

function entregar(ctx: Ctx, role: "comercial" | "contabilidade" | "financiada" | "secretaria", id: number, tipo: string, bytes = PDF, nome = "doc.pdf") {
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
  it("a coordenação entrega um documento do curso: fica validado; os validados e os de fora do curso não", async () => {
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
    // Entregue pela coordenação (quem valida): fica logo validado e deixa de se poder entregar.
    expect(doc.estado).toBe("validado");
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

describe("comprovativo entregue pela equipa quando aguarda pagamento", () => {
  it("o comercial e a coordenação Gold veem o comprovativo para entregar e entregam-no; fica «Pagamento por validar»", async () => {
    const ctx = await arrancar();
    for (const role of ["comercial", "secretaria"] as const) {
      const id = 950000 + Math.floor(Math.random() * 9000);
      const marca = `Comp${id}`;
      await ctx.db.query(
        `INSERT INTO preinscricoes (id, inscrito, nome, apelido, email, telf, curso, preco, estado, regime, pagamento_pedido_em, comercial_id)
         VALUES ($1, '2031-01-01 10:00', $2, 'T', $3, '912000000', 'Formação de Formadores - CCP', 125, 'Pré-inscrição', 'gold', now(), $4)`,
        [id, marca, `comp.${id}@exemplo.pt`, ctx.userId.comercial]);
      const fila = async (f: string) => ((await pedido(ctx, role, "GET", `/v1/crm/leads?regime=gold&q=${marca}&fila=${f}`)).json().items as { id: number }[]).map(l => l.id);
      expect(await fila("aguarda_pagamento")).toEqual([id]);
      const d = (await pedido(ctx, role, "GET", `/v1/crm/leads/${id}`)).json() as { docsFechado: boolean; docsParaEntregar: { id: string }[] };
      expect(d.docsFechado).toBe(false);
      expect(d.docsParaEntregar.map(x => x.id)).toContain("comprovativo");
      // Sem confirmar em quantas vezes, recusado.
      expect((await entregar(ctx, role, id, "comprovativo")).statusCode).toBe(409);
      expect((await pedido(ctx, role, "PUT", `/v1/crm/leads/${id}/prestacoes`, { valores: [125] })).statusCode).toBe(200);
      const r = await entregar(ctx, role, id, "comprovativo");
      expect(r.statusCode, r.body).toBe(200);
      expect((r.json().documentos as { tipo: string; estado: string }[]).find(x => x.tipo === "comprovativo")?.estado).toBe("pendente");
      expect(await fila("aguarda_pagamento")).toEqual([]);
      expect(await fila("pagamento_validar")).toEqual([id]);
    }
  });
});

describe("disponibilidade editada pelo próprio formador", () => {
  it("o formador grava a sua disponibilidade (blocos por dia, datas e horas), mas não a de outro nem outros campos", async () => {
    const ctx = await arrancar();
    const r = await pedido(ctx, "admin", "POST", "/v1/formadores", { nome: `Formador Disp ${Date.now()}`, email: "", regimes: ["gold"] });
    expect(r.statusCode, r.body).toBe(200);
    const id = r.json().formador.id as number;
    await ctx.db.query("UPDATE formadores SET user_id = $2 WHERE id = $1", [id, ctx.userId.formador]);
    const disp = ["laboral@1", "laboral@3", "sabado-manha", "fora:2026-12-10", "fora:2026-12-11@14:00-16:00", "livre:2026-12-12@09:00-13:00"];
    const g = await pedido(ctx, "formador", "PATCH", `/v1/formadores/${id}`, { disponibilidade: disp });
    expect(g.statusCode, g.body).toBe(200);
    const ficha = (await pedido(ctx, "formador", "GET", `/v1/formadores/${id}`)).json();
    expect([...(ficha.formador.disponibilidade as string[])].sort()).toEqual([...disp].sort());
    // Outro formador: recusado.
    const outro = (await pedido(ctx, "admin", "POST", "/v1/formadores", { nome: `Outro ${Date.now()}`, email: "", regimes: ["gold"] })).json().formador.id as number;
    expect((await pedido(ctx, "formador", "PATCH", `/v1/formadores/${outro}`, { disponibilidade: disp })).statusCode).toBe(403);
    // Só a disponibilidade: o nome não muda.
    await pedido(ctx, "formador", "PATCH", `/v1/formadores/${id}`, { disponibilidade: disp, nome: "Mudado" });
    expect((await pedido(ctx, "formador", "GET", `/v1/formadores/${id}`)).json().formador.nome).not.toBe("Mudado");
  });
});

describe("documentos todos validados: aguarda pagamento sem o pedir", () => {
  it("a coordenação entrega e valida; o comprovativo fica disponível sem pedir o pagamento; o comercial entrega-o", async () => {
    const ctx = await arrancar();
    const cid = 980000 + Math.floor(Math.random() * 9000);
    const curso = `Curso Docs ${cid}`;
    await ctx.db.query("INSERT INTO cursos_gold (id, nome, categoria, tipo, preco, regime, horas, estado) VALUES ($1, $2, 'CCP', 'Pré-inscrição', 130, 'b-learning', 10, 'Ativo')", [cid, curso]);
    const base = (await pedido(ctx, "admin", "GET", `/v1/formandos/gold/docs-do-curso?curso=${encodeURIComponent(curso)}`)).json().documentos as { id: string }[];
    expect((await pedido(ctx, "admin", "PUT", `/v1/cursos/gold/${cid}/docs-preinscricao`, {
      ocultos: base.map(d => d.id), extra: [{ label: "Cartão de Cidadão", required: true }], condicoes: {},
    })).statusCode).toBe(200);
    const id = cid;
    const marca = `Val${id}`;
    await ctx.db.query(
      `INSERT INTO preinscricoes (id, inscrito, nome, apelido, email, telf, curso, preco, estado, regime)
       VALUES ($1, '2031-01-01 10:00', $2, 'T', $3, '912000000', $4, 130, '1º Contacto', 'gold')`, [id, marca, `val.${id}@exemplo.pt`, curso]);
    let d = (await pedido(ctx, "secretaria", "GET", `/v1/crm/leads/${id}`)).json() as { docsParaEntregar: { id: string }[] };
    expect(d.docsParaEntregar.map(x => x.id)).not.toContain("comprovativo");
    const doc = d.docsParaEntregar[0]!.id;
    // A coordenação entrega o documento: fica validado.
    const r = await entregar(ctx, "secretaria", id, doc);
    expect(r.statusCode, r.body).toBe(200);
    expect((r.json().documentos as { tipo: string; estado: string }[]).find(x => x.tipo === doc)?.estado).toBe("validado");
    const lista = async (fila = "") => (await pedido(ctx, "comercial", "GET", `/v1/crm/leads?regime=gold&q=${marca}${fila ? `&fila=${fila}` : ""}`)).json().items as { id: number; docsTodosValidados: boolean }[];
    expect((await lista())[0]!.docsTodosValidados).toBe(true);
    expect((await lista("aguarda_pagamento")).map(l => l.id)).toEqual([id]);
    // Sem pedir o pagamento, o comprovativo já se pode entregar.
    d = (await pedido(ctx, "comercial", "GET", `/v1/crm/leads/${id}`)).json();
    expect(d.docsParaEntregar.map(x => x.id)).toContain("comprovativo");
    expect((await pedido(ctx, "comercial", "PUT", `/v1/crm/leads/${id}/prestacoes`, { valores: [130] })).statusCode).toBe(200);
    const c = await entregar(ctx, "comercial", id, "comprovativo");
    expect(c.statusCode, c.body).toBe(200);
    const row = (await ctx.db.query<{ pagamento_id: string | null; pagamento_pedido_em: string | null }>("SELECT pagamento_id, pagamento_pedido_em FROM preinscricoes WHERE id = $1", [id])).rows[0]!;
    expect(row.pagamento_id).toBeTruthy();
    expect(row.pagamento_pedido_em).toBeTruthy();
    expect((await lista("pagamento_validar")).map(l => l.id)).toEqual([id]);
  });
});

describe("pagamento em prestações", () => {
  it("a equipa confirma 2 prestações; o 1.º comprovativo validado confirma o pagamento; o 2.º anexa-se depois, mesmo validada", async () => {
    const ctx = await arrancar();
    const id = 940000 + Math.floor(Math.random() * 9000);
    await ctx.db.query(
      `INSERT INTO preinscricoes (id, inscrito, nome, apelido, email, telf, curso, preco, estado, regime, pagamento_pedido_em)
       VALUES ($1, '2031-01-01 10:00', 'Prest', 'T', $2, '912000000', 'Formação de Formadores - CCP', 130, 'Pré-inscrição', 'gold', now())`,
      [id, `prest.${id}@exemplo.pt`]);
    expect((await pedido(ctx, "comercial", "PUT", `/v1/crm/leads/${id}/prestacoes`, { valores: [] })).statusCode).toBe(400);
    let d = (await pedido(ctx, "comercial", "PUT", `/v1/crm/leads/${id}/prestacoes`, { valores: [65, 65] })).json() as { prestacoes: number[]; docsParaEntregar: { id: string; label: string }[] };
    expect(d.prestacoes).toEqual([65, 65]);
    expect(d.docsParaEntregar.find(x => x.id === "comprovativo")?.label).toMatch(/1\.ª de 2/);
    expect(d.docsParaEntregar.some(x => x.id === "comprovativo-2")).toBe(true);
    const r1 = await entregar(ctx, "comercial", id, "comprovativo");
    expect(r1.statusCode, r1.body).toBe(200);
    const doc1 = (r1.json().documentos as { id: number; tipo: string }[]).find(x => x.tipo === "comprovativo")!;
    // O 1.º validado confirma o pagamento (pode ir para a turma).
    expect((await pedido(ctx, "comercial", "POST", `/v1/crm/leads/${id}/documentos/${doc1.id}/validar`)).statusCode).toBe(200);
    const pag = (await ctx.db.query<{ estado: string }>("SELECT pg.estado FROM preinscricoes p JOIN pagamentos pg ON pg.id = p.pagamento_id WHERE p.id = $1", [id])).rows[0];
    expect(pag?.estado).toBe("Pago");
    // Validada (ligação fechada): a 2.ª prestação continua por entregar.
    await ctx.db.query("UPDATE preinscricoes SET validada_em = now() WHERE id = $1", [id]);
    d = (await pedido(ctx, "secretaria", "GET", `/v1/crm/leads/${id}`)).json();
    expect(d.docsParaEntregar.map(x => x.id)).toEqual(["comprovativo-2"]);
    // Menos prestações do que as que já têm comprovativo: recusado (a 1.ª tem). Não se pode ficar com 0.
    const r2 = await entregar(ctx, "secretaria", id, "comprovativo-2");
    expect(r2.statusCode, r2.body).toBe(200);
    expect((await pedido(ctx, "comercial", "PUT", `/v1/crm/leads/${id}/prestacoes`, { valores: [130] })).statusCode).toBe(409);
    const doc2 = (r2.json().documentos as { id: number; tipo: string; estado: string; label: string }[]).find(x => x.tipo === "comprovativo-2")!;
    expect(doc2.estado).toBe("pendente");
    expect(doc2.label).toMatch(/2\.ª de 2/);
    expect((await pedido(ctx, "secretaria", "POST", `/v1/crm/leads/${id}/documentos/${doc2.id}/validar`)).statusCode).toBe(200);
    d = (await pedido(ctx, "secretaria", "GET", `/v1/crm/leads/${id}`)).json();
    expect(d.docsParaEntregar).toEqual([]);
    const ev = (await ctx.db.query<{ titulo: string }>("SELECT titulo FROM preinscricao_eventos WHERE preinscricao_id = $1", [id]).catch(() => ({ rows: [] as { titulo: string }[] }))).rows.map(r => r.titulo);
    if (ev.length) expect(ev).toEqual(expect.arrayContaining(["Pagamento em 2 prestações", "Prestação 2 paga"]));
  });
});

describe("prestações na ligação pessoal", () => {
  it("validada com prestações por pagar: a ligação fica aberta só com o pagamento; a pessoa envia o 2.º; fecha quando todas pagas", async () => {
    const ctx = await arrancar();
    const id = 930000 + Math.floor(Math.random() * 9000);
    await ctx.db.query(
      `INSERT INTO preinscricoes (id, inscrito, nome, apelido, email, telf, curso, preco, estado, regime, pagamento_pedido_em)
       VALUES ($1, '2031-01-01 10:00', 'Lig', 'T', $2, '912000000', 'Formação de Formadores - CCP', 130, 'Pré-inscrição', 'gold', now())`,
      [id, `lig.${id}@exemplo.pt`]);
    await pedido(ctx, "secretaria", "PUT", `/v1/crm/leads/${id}/prestacoes`, { valores: [65, 65] });
    const r1 = await entregar(ctx, "secretaria", id, "comprovativo");
    const doc1 = (r1.json().documentos as { id: number; tipo: string }[]).find(x => x.tipo === "comprovativo")!;
    expect((await pedido(ctx, "secretaria", "POST", `/v1/crm/leads/${id}/documentos/${doc1.id}/validar`)).statusCode).toBe(200);
    await ctx.db.query("UPDATE preinscricoes SET validada_em = now(), estado = 'Formando' WHERE id = $1", [id]);
    const token = (await pedido(ctx, "secretaria", "GET", `/v1/crm/leads/${id}`)).json().docsUrl.split("/").pop().split("?")[0] as string;

    // Lembrete à mão, da 2.ª prestação.
    const lem = await pedido(ctx, "comercial", "POST", `/v1/crm/leads/${id}/lembrete-prestacao`);
    expect(lem.statusCode, lem.body).toBe(200);

    let vista = (await ctx.app.inject({ method: "GET", url: `/v1/public/documentos/${token}` })).json();
    expect(vista.encerrada).toBe(false);
    expect(vista.soPagamento).toBe(true);
    expect(vista.precisaPagamento).toBe(true);
    expect(vista.pagamento.prestacoes.map((p: { estado: string }) => p.estado)).toEqual(["validado", "em_falta"]);

    const up = (tipo: string) => {
      const b = "----g";
      const body = Buffer.concat([
        Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="tipo"\r\n\r\n${tipo}\r\n`),
        Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="ficheiro"; filename="c.pdf"\r\nContent-Type: application/pdf\r\n\r\n`), PDF, Buffer.from(`\r\n--${b}--\r\n`),
      ]);
      return ctx.app.inject({ method: "POST", url: `/v1/public/documentos/${token}`, payload: body, headers: { "content-type": `multipart/form-data; boundary=${b}` } });
    };
    expect((await up("cc")).statusCode).not.toBe(200);
    const r2 = await up("comprovativo-2");
    expect(r2.statusCode, r2.body).toBe(200);
    vista = (await ctx.app.inject({ method: "GET", url: `/v1/public/documentos/${token}` })).json();
    expect(vista.pagamento.prestacoes[1].estado).toBe("pendente");

    // A equipa valida a 2.ª: tudo pago, a ligação fecha.
    const doc2 = (await ctx.db.query<{ id: number }>("SELECT id FROM preinscricao_docs WHERE preinscricao_id = $1 AND tipo = 'comprovativo-2'", [id])).rows[0]!;
    expect((await pedido(ctx, "secretaria", "POST", `/v1/crm/leads/${id}/documentos/${doc2.id}/validar`)).statusCode).toBe(200);
    vista = (await ctx.app.inject({ method: "GET", url: `/v1/public/documentos/${token}` })).json();
    expect(vista.encerrada).toBe(true);
    expect((await pedido(ctx, "comercial", "POST", `/v1/crm/leads/${id}/lembrete-prestacao`)).statusCode).toBe(409);
  });
});
