import { describe, expect, it } from "vitest";
import { arrancar, pedido, type Ctx } from "./helpers.js";


type Lista = {
  total: number;
  linhas: Array<{ id: number; nome: string; turma: { id: number } | null; pagamento: { situacao: string }; acesso: boolean; docs: { validados: number } }>;
  contagens: Record<string, number>;
  docsObrigatorios: number;
};

async function criarGold(ctx: Ctx, corpo: Record<string, unknown>) {
  const r = await pedido(ctx, "secretaria", "POST", "/v1/formandos-gold", corpo);
  expect(r.statusCode, r.body).toBe(200);
  return (r.json() as { formando: { id: number } }).formando.id;
}

async function lista(ctx: Ctx, query: string, perfil: "secretaria" | "financiada" = "secretaria") {
  const r = await pedido(ctx, perfil, "GET", `/v1/formandos?${query}`);
  expect(r.statusCode, r.body).toBe(200);
  return r.json() as Lista;
}

describe("lista de formandos", () => {
  it("separa em turmas, avulsos e pendências, com pesquisa, filtros e paginação no servidor", async () => {
    const ctx = await arrancar();
    const oferta = await criarGold(ctx, { nome: "Olga", apelido: "Oferta", email: "olga.oferta@exemplo.pt", curso: "Curso de teste", metodo: "Oferta" });
    const porPagar = await criarGold(ctx, { nome: "Paulo", apelido: "Porpagar", email: "paulo.pp@exemplo.pt", curso: "Curso de teste", valor: 120 });

    const avulsos = await lista(ctx, "regime=gold&separador=avulsos&q=exemplo.pt");
    const ids = avulsos.linhas.map(l => l.id);
    expect(ids).toEqual(expect.arrayContaining([oferta, porPagar]));
    expect(avulsos.linhas.find(l => l.id === oferta)!.pagamento.situacao).toBe("oferta");
    expect(avulsos.linhas.every(l => l.turma === null)).toBe(true);
    expect(avulsos.contagens.avulsos).toBeGreaterThanOrEqual(2);
    expect(avulsos.docsObrigatorios).toBe(3);

    const pp = await lista(ctx, "regime=gold&pagamento=por_pagar&q=Porpagar");
    expect(pp.linhas.map(l => l.id)).toEqual([porPagar]);

    const pend = await lista(ctx, "regime=gold&separador=pendencias&q=exemplo.pt");
    expect(pend.linhas.map(l => l.id)).toContain(porPagar);

    const pag = await lista(ctx, "regime=gold&porPagina=1&q=exemplo.pt");
    expect(pag.linhas).toHaveLength(1);
    expect(pag.total).toBeGreaterThanOrEqual(2);
  });

  it("cada equipa só vê o seu regime e o formador não vê formandos", async () => {
    const ctx = await arrancar();
    expect((await pedido(ctx, "financiada", "GET", "/v1/formandos?regime=gold")).statusCode).toBe(403);
    expect((await pedido(ctx, "comercial", "GET", "/v1/formandos?regime=fin")).statusCode).toBe(403);
    expect((await pedido(ctx, "formador", "GET", "/v1/formandos?regime=gold")).statusCode).toBe(403);
    expect((await pedido(ctx, null, "GET", "/v1/formandos?regime=gold")).statusCode).toBe(401);
    expect((await pedido(ctx, "secretaria", "GET", "/v1/formandos?regime=xx")).statusCode).toBe(400);
  });
});

describe("ficha do formando", () => {
  it("mostra percurso, documentos, acesso e pagamento; registar pagamento fecha a pendência", async () => {
    const ctx = await arrancar();
    const id = await criarGold(ctx, { nome: "Rita", apelido: "Ficha", email: "rita.ficha@exemplo.pt", curso: "Curso de teste", valor: 90 });
    const r = await pedido(ctx, "secretaria", "GET", `/v1/formandos/gold/${id}`);
    expect(r.statusCode, r.body).toBe(200);
    const { ficha } = r.json() as { ficha: { documentos: unknown[]; acesso: { tem: boolean }; pagamento: { situacao: string }; passos: { id: string; feito: boolean }[] } };
    expect(ficha.documentos.length).toBeGreaterThanOrEqual(5);
    expect(ficha.acesso.tem).toBe(false);
    expect(ficha.pagamento.situacao).toBe("por_pagar");
    expect(ficha.passos.find(p => p.id === "pagamento")!.feito).toBe(false);

    // Sem IBAN da entidade não se pede o pagamento por email.
    const pedir = await pedido(ctx, "secretaria", "POST", `/v1/formandos/gold/${id}/pedir-pagamento`);
    expect([200, 409]).toContain(pedir.statusCode);

    expect((await pedido(ctx, "comercial", "POST", `/v1/formandos/gold/${id}/registar-pagamento`, { metodo: "Numerário" })).statusCode).toBe(403);
    const reg = await pedido(ctx, "secretaria", "POST", `/v1/formandos/gold/${id}/registar-pagamento`, { metodo: "Transferência bancária" });
    expect(reg.statusCode, reg.body).toBe(200);

    const acesso = await pedido(ctx, "secretaria", "POST", `/v1/formandos/gold/${id}/acesso`, { enviarEmail: false });
    expect(acesso.statusCode, acesso.body).toBe(200);
    expect((acesso.json() as { acesso: { password?: string } }).acesso.password).toBeTruthy();

    const depois = (await pedido(ctx, "secretaria", "GET", `/v1/formandos/gold/${id}`)).json() as {
      ficha: { pagamento: { situacao: string; movimentos: { estado: string }[] }; acesso: { tem: boolean }; historico: unknown[] };
    };
    expect(depois.ficha.pagamento.situacao).toBe("pago");
    expect(depois.ficha.pagamento.movimentos[0]!.estado).toBe("Pago");
    expect(depois.ficha.acesso.tem).toBe(true);
    expect(depois.ficha.historico.length).toBeGreaterThan(0);

    expect((await pedido(ctx, "formador", "GET", `/v1/formandos/gold/${id}`)).statusCode).toBe(403);
    expect((await pedido(ctx, "secretaria", "GET", "/v1/formandos/gold/999999999")).statusCode).toBe(404);
  });

  it("pagamento da ficha: uma vez, com a data escolhida; «Já pago» cria o movimento; reembolso e webhook", async () => {
    const ctx = await arrancar();
    const movs = (formandoId: number) => ctx.db.query<{ id: string; estado: string; dia: string }>(
      "SELECT id, estado, pago_em::date::text AS dia FROM pagamentos WHERE formando_id = $1", [formandoId]);
    const id = await criarGold(ctx, { nome: "Paula", apelido: "Paga", email: "paula.paga@exemplo.pt", curso: "Curso de teste", valor: 90 });
    const url = `/v1/formandos/gold/${id}/registar-pagamento`;
    expect((await pedido(ctx, "secretaria", "POST", url, { metodo: "Numerário", valor: 90, data: "2026-01-15" })).statusCode).toBe(200);
    expect((await pedido(ctx, "secretaria", "POST", url, { metodo: "Numerário", valor: 90 })).statusCode).toBe(409);
    expect((await pedido(ctx, "secretaria", "POST", url, { metodo: "Oferta" })).statusCode).toBe(409);
    expect((await movs(id)).rows).toEqual([expect.objectContaining({ estado: "Pago", dia: "2026-01-15" })]);

    // «Já pago» na criação: a ficha fica paga e há movimento; o comercial não o pode fazer.
    expect((await pedido(ctx, "comercial", "POST", "/v1/formandos-gold", { nome: "Jorge", email: "jorge.jp@exemplo.pt", pago: true, valor: 50 })).statusCode).toBe(403);
    const jaPago = await criarGold(ctx, { nome: "Joana", apelido: "Japago", email: "joana.jp@exemplo.pt", pago: true, valor: 50, metodo: "Numerário" });
    const mov = (await movs(jaPago)).rows;
    expect(mov).toEqual([expect.objectContaining({ estado: "Pago" })]);
    expect((await ctx.db.query<{ pago: boolean }>("SELECT pago FROM formandos_gold WHERE id = $1", [jaPago])).rows[0]!.pago).toBe(true);

    // O comercial não marca uma ficha como paga pelo PATCH (nem chega às fichas dos formandos).
    const porPagar = await criarGold(ctx, { nome: "Carla", apelido: "Porpagar", email: "carla.pp@exemplo.pt", valor: 70 });
    expect((await pedido(ctx, "comercial", "PATCH", `/v1/formandos-gold/${porPagar}`, { pago: true, valor: 0 })).statusCode).toBe(403);
    const pp = (await ctx.db.query<{ pago: boolean; valor: string }>("SELECT pago, valor FROM formandos_gold WHERE id = $1", [porPagar])).rows[0]!;
    expect(pp.pago).toBe(false);
    expect(Number(pp.valor)).toBe(70);
    // A secretaria marca paga pelo PATCH: fica o movimento; desmarcar com pagamento recebido é recusado.
    expect((await pedido(ctx, "secretaria", "PATCH", `/v1/formandos-gold/${porPagar}`, { pago: true, metodo: "Numerário" })).statusCode).toBe(200);
    expect((await movs(porPagar)).rows).toEqual([expect.objectContaining({ estado: "Pago" })]);
    expect((await pedido(ctx, "secretaria", "PATCH", `/v1/formandos-gold/${porPagar}`, { pago: false })).statusCode).toBe(409);

    // Reembolso: a ficha volta a ficar por pagar e o webhook não repõe o Pago.
    expect((await pedido(ctx, "secretaria", "PATCH", `/v1/pagamentos/${mov[0]!.id}`, { estado: "Reembolsado" })).statusCode).toBe(200);
    expect((await ctx.db.query<{ pago: boolean }>("SELECT pago FROM formandos_gold WHERE id = $1", [jaPago])).rows[0]!.pago).toBe(false);
    await ctx.db.query(
      `INSERT INTO app_settings (id, values) VALUES ('gold', $1::jsonb)
       ON CONFLICT (id) DO UPDATE SET values = app_settings.values || EXCLUDED.values`,
      [{ "Chave webhook pagamentos": "segredo-webhook" }],
    );
    // Reentrega de um pagamento já pago: 200 sem repetir efeitos.
    const pagoPP = (await movs(porPagar)).rows[0]!.id;
    expect((await ctx.app.inject({ method: "POST", url: "/v1/public/pagamentos/webhook", payload: { chave: "segredo-webhook", id: pagoPP } })).statusCode).toBe(200);
    const wh = await ctx.app.inject({ method: "POST", url: "/v1/public/pagamentos/webhook", payload: { chave: "segredo-webhook", id: mov[0]!.id } });
    expect(wh.statusCode).toBe(409);
    expect((await movs(jaPago)).rows[0]!.estado).toBe("Reembolsado");

    // Confirmação atómica: só a primeira passa a Pago (e dispara os efeitos).
    const { marcarPago } = await import("../src/repos/pagamentos.js");
    await ctx.db.query("UPDATE pagamentos SET estado = 'Pendente' WHERE id = $1", [mov[0]!.id]);
    const [a, b] = await Promise.all([marcarPago(ctx.db, mov[0]!.id, "x"), marcarPago(ctx.db, mov[0]!.id, "x")]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
  });

  it("documentos Gold validam-se e recusam-se na ficha", async () => {
    const ctx = await arrancar();
    const id = await criarGold(ctx, { nome: "Duarte", apelido: "Docs", email: "duarte.docs@exemplo.pt", curso: "Curso de teste" });
    const put = await pedido(ctx, "secretaria", "PUT", `/v1/formandos/gold/${id}/docs`, { docs: [{ id: "cc", ok: false, fileName: "cc.pdf", data: "2026-10-01" }] });
    expect(put.statusCode, put.body).toBe(200);
    expect((await pedido(ctx, "secretaria", "POST", `/v1/formandos/gold/${id}/documentos/cc/recusar`, { observacao: "Ilegível" })).statusCode).toBe(200);
    let ficha = (await pedido(ctx, "secretaria", "GET", `/v1/formandos/gold/${id}`)).json() as { ficha: { documentos: { id: string; estado: string }[] } };
    expect(ficha.ficha.documentos.find(d => d.id === "cc")!.estado).toBe("recusado");
    expect((await pedido(ctx, "secretaria", "POST", `/v1/formandos/gold/${id}/documentos/cc/validar`)).statusCode).toBe(200);
    ficha = (await pedido(ctx, "secretaria", "GET", `/v1/formandos/gold/${id}`)).json() as typeof ficha;
    expect(ficha.ficha.documentos.find(d => d.id === "cc")!.estado).toBe("validado");
    expect((await pedido(ctx, "secretaria", "POST", `/v1/formandos/gold/${id}/documentos/nada/validar`)).statusCode).toBe(404);
  });
});

describe("Financiada", () => {
  it("documentos marcados contam na lista e no separador de documentos em falta", async () => {
    const ctx = await arrancar();
    const r = await pedido(ctx, "financiada", "POST", "/v1/formandos-fin", {
      nome: "Fátima", apelido: "Fin", email: "fatima.fin@exemplo.pt", curso: "UFCD teste", estado: "Em análise", cc: { ok: true, data: "2026-10-01" },
    });
    expect(r.statusCode, r.body).toBe(200);
    const id = (r.json() as { formando: { id: number } }).formando.id;
    const l = await lista(ctx, "regime=fin&q=fatima.fin", "financiada");
    expect(l.linhas[0]!.id).toBe(id);
    expect(l.linhas[0]!.docs.validados).toBe(1);
    const falta = await lista(ctx, "regime=fin&separador=docs_em_falta&q=fatima.fin", "financiada");
    expect(falta.linhas.map(x => x.id)).toEqual([id]);
    const ficha = await pedido(ctx, "financiada", "GET", `/v1/formandos/fin/${id}`);
    expect(ficha.statusCode, ficha.body).toBe(200);
    expect((ficha.json() as { ficha: { ligacaoDocumentos: string } }).ficha.ligacaoDocumentos).toContain("/documentos-formando/");
  });

  it("inscrições: lista com contagens por estado, alterar e apagar", async () => {
    const ctx = await arrancar();
    const c = await pedido(ctx, "financiada", "POST", "/v1/inscricoes-fin", {
      nome: "Inês", apelido: "Inscrita", email: "ines.insc@exemplo.pt", curso: "UFCD teste", docs: { cc: true, ch: true },
    });
    expect(c.statusCode, c.body).toBe(200);
    const id = (c.json() as { id: number }).id;
    const l = await pedido(ctx, "financiada", "GET", "/v1/inscricoes-fin?q=ines.insc");
    const corpo = l.json() as { linhas: { id: number; estado: string; docsValidados: number }[]; contagens: Record<string, number> };
    expect(corpo.linhas[0]).toMatchObject({ id, estado: "Recebida", docsValidados: 2 });
    expect(corpo.contagens.Recebida).toBeGreaterThanOrEqual(1);
    expect((await pedido(ctx, "financiada", "PATCH", `/v1/inscricoes-fin/${id}`, { estado: "Em análise" })).statusCode).toBe(200);
    expect((await pedido(ctx, "financiada", "PATCH", `/v1/inscricoes-fin/${id}`, { estado: "Inventado" })).statusCode).toBe(400);
    expect((await pedido(ctx, "comercial", "GET", "/v1/inscricoes-fin")).statusCode).toBe(403);
    expect((await pedido(ctx, "financiada", "DELETE", `/v1/inscricoes-fin/${id}`)).statusCode).toBe(200);
    expect((await pedido(ctx, "financiada", "DELETE", `/v1/inscricoes-fin/${id}`)).statusCode).toBe(404);
  });
});
