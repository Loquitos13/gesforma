import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { arrancar, pedido, type Ctx } from "./helpers.js";

let ctx: Ctx;

beforeAll(async () => {
  ctx = await arrancar();
});

afterAll(async () => {
  await ctx.app.close();
});

async function novoLead(campanhaId: number | null, estado: string, preco: number, extra: { comercial?: string; criado?: string; origem?: string } = {}) {
  const r = await ctx.db.query<{ id: number }>(
    `INSERT INTO preinscricoes (id, inscrito, nome, email, curso, preco, estado, campanha_id, origem, comercial_id, regime, created_at)
     VALUES (nextval('ops_id_seq')::int, to_char(now(), 'YYYY-MM-DD'), 'Teste', $1, 'Curso Campanha', $2, $3, $4, $5, $6, 'gold', COALESCE($7::timestamptz, now()))
     RETURNING id`,
    [`lead.${Math.random().toString(36).slice(2)}@exemplo.pt`, preco, estado, campanhaId, extra.origem ?? "Instagram", extra.comercial ?? null, extra.criado ?? null],
  );
  return r.rows[0]!.id;
}

describe("Campanhas: números pela ligação campanha_id", () => {
  it("conta pré-inscrições, pagos, receita, ROI e origens só das ligadas à campanha", async () => {
    const criar = await pedido(ctx, "comercial", "POST", "/v1/campanhas", {
      nome: "Teste campanha", data: "2026-01-01", custo: 100, canal: "Instagram", curso: "Curso Campanha",
    });
    expect(criar.statusCode).toBe(200);
    const id = criar.json().campanha.id as number;
    await novoLead(id, "Não contactado", 125);
    await novoLead(id, "Pago", 125);
    await novoLead(id, "Desistiu", 125, { origem: "Google" });
    // Mesmo curso, sem ligação: não conta (antes casava pelo nome do curso).
    await novoLead(null, "Pago", 999);

    const r = await pedido(ctx, "comercial", "GET", `/v1/campanhas/${id}`);
    expect(r.statusCode).toBe(200);
    const c = r.json().campanha;
    expect(c.preinscricoes).toBe(3);
    expect(c.pagos).toBe(1);
    expect(c.receita).toBe(125);
    expect(c.porContactar).toBe(1);
    expect(c.desistiram).toBe(1);
    expect(c.conversao).toBe(33);
    expect(c.roi).toBe(25);
    expect(c.origens).toEqual([{ origem: "Instagram", n: 2 }, { origem: "Google", n: 1 }]);

    const lista = await pedido(ctx, "comercial", "GET", "/v1/campanhas?estado=ativas");
    expect(lista.json().campanhas.some((x: { id: number }) => x.id === id)).toBe(true);
    expect(lista.json().resumo.ativas).toBeGreaterThanOrEqual(1);
  });

  it("valida datas e apaga sem perder as pré-inscrições", async () => {
    const mau = await pedido(ctx, "comercial", "POST", "/v1/campanhas", { nome: "X", data: "2026-05-01", fim: "2026-04-01" });
    expect(mau.statusCode).toBe(400);
    const criar = await pedido(ctx, "secretaria", "POST", "/v1/campanhas", { nome: "Apagar", data: "2026-05-01" });
    const id = criar.json().campanha.id as number;
    const lead = await novoLead(id, "Não contactado", 0);
    expect((await pedido(ctx, "secretaria", "DELETE", `/v1/campanhas/${id}`)).statusCode).toBe(200);
    const r = await ctx.db.query<{ campanha_id: number | null }>("SELECT campanha_id FROM preinscricoes WHERE id = $1", [lead]);
    expect(r.rows[0]!.campanha_id).toBeNull();
  });

  it("a Financiada e o formador não gerem campanhas", async () => {
    expect((await pedido(ctx, "financiada", "GET", "/v1/campanhas")).statusCode).toBe(403);
    expect((await pedido(ctx, "formador", "GET", "/v1/campanhas")).statusCode).toBe(403);
  });
});

describe("Clientes, propostas e contratos", () => {
  it("cliente com proposta: resumo, ficha, bloqueio de apagar e contrato a partir da proposta", async () => {
    const c = await pedido(ctx, "comercial", "POST", "/v1/crm/clientes", { nome: "Empresa Teste, Lda.", email: "geral@empresa-teste.pt", nif: "509000000" });
    expect(c.statusCode).toBe(200);
    const id = c.json().cliente.id as number;
    expect((await pedido(ctx, "comercial", "POST", "/v1/crm/clientes", { nome: "X", email: "nao-e-email" })).statusCode).toBe(400);

    const p = await pedido(ctx, "comercial", "POST", `/v1/crm/clientes/${id}/propostas`, { curso: "Excel", valor: 1200 });
    expect(p.statusCode).toBe(200);
    const propostaId = p.json().proposta.id as number;

    const lista = await pedido(ctx, "comercial", "GET", "/v1/crm/clientes?q=Empresa%20Teste");
    const linha = lista.json().linhas.find((x: { id: number }) => x.id === id);
    expect(linha).toMatchObject({ propostas: 1, emAberto: 1200, contratos: 0, ultimoEstado: "Enviada" });

    expect((await pedido(ctx, "comercial", "DELETE", `/v1/crm/clientes/${id}`)).statusCode).toBe(403);
    expect((await pedido(ctx, "secretaria", "DELETE", `/v1/crm/clientes/${id}`)).statusCode).toBe(409);

    const k = await pedido(ctx, "comercial", "POST", "/v1/crm/contratos", { clienteNome: "Empresa Teste, Lda.", propostaId });
    expect(k.statusCode).toBe(200);
    const contrato = k.json().contrato;
    expect(contrato).toMatchObject({ clienteId: id, curso: "Excel", valor: 1200, estado: "Rascunho" });

    // Assinatura em papel: só a gestão a marca (a digital fica assinada quando o cliente assina).
    expect((await pedido(ctx, "comercial", "PATCH", `/v1/crm/contratos/${contrato.id}`, { estado: "Assinado" })).statusCode).toBe(403);
    expect((await pedido(ctx, "secretaria", "PATCH", `/v1/crm/contratos/${contrato.id}`, { estado: "Assinado" })).statusCode).toBe(409);
    await pedido(ctx, "comercial", "PATCH", `/v1/crm/contratos/${contrato.id}`, { corpo: '<div data-gf="doc" data-assinatura="papel" hidden></div><p>Contrato</p>' });
    const ass = await pedido(ctx, "secretaria", "PATCH", `/v1/crm/contratos/${contrato.id}`, { estado: "Assinado" });
    expect(ass.json().contrato.assinadoEm).toBeTruthy();
    expect((await pedido(ctx, "comercial", "PATCH", `/v1/crm/contratos/${contrato.id}`, { valor: 1 })).statusCode).toBe(409);
    expect((await pedido(ctx, "secretaria", "DELETE", `/v1/crm/contratos/${contrato.id}`)).statusCode).toBe(409);

    const ficha = await pedido(ctx, "comercial", "GET", `/v1/crm/clientes/${id}`);
    expect(ficha.json().cliente.propostas[0].contratoId).toBe(contrato.id);
    expect(ficha.json().cliente.contratos).toHaveLength(1);
    expect(ficha.json().cliente.tipo).toBe("Empresa");
    expect(ficha.json().cliente.historico).toEqual([
      expect.objectContaining({ origem: "Contrato", descricao: "Excel", valor: 1200, estado: "Assinado" }),
    ]);
  });

  it("cliente particular: histórico com os cursos inscritos no mesmo email", async () => {
    const mail = `particular-${Date.now()}@exemplo.pt`;
    const c = await pedido(ctx, "comercial", "POST", "/v1/crm/clientes", { nome: "Ana Particular", tipo: "Particular", email: mail });
    expect(c.statusCode, c.body).toBe(200);
    const id = c.json().cliente.id as number;
    expect((await pedido(ctx, "comercial", "POST", "/v1/crm/clientes", { nome: "Z", tipo: "Outro" })).statusCode).toBe(400);
    const fid = Number((await ctx.db.query<{ n: number }>("SELECT COALESCE(max(id), 0) + 1 AS n FROM formandos_gold")).rows[0]!.n);
    await ctx.db.query(
      "INSERT INTO formandos_gold (id, nome, email, inscrito, curso, turma, pago, valor) VALUES ($1, 'Ana', $2, '2026-03-04 10:00:00', 'CCP', 'T1', true, 450), ($3, 'Ana', $2, '04/03/2020', 'Excel', '', false, 90)",
      [fid, mail.toUpperCase(), fid + 1],
    );
    const ficha = (await pedido(ctx, "comercial", "GET", `/v1/crm/clientes/${id}`)).json().cliente;
    expect(ficha.tipo).toBe("Particular");
    expect(ficha.historico).toEqual([
      expect.objectContaining({ origem: "Curso Gold", descricao: "CCP · T1", valor: 450, estado: "Pago" }),
      expect.objectContaining({ origem: "Curso Gold", descricao: "Excel", valor: 90, data: null }),
    ]);
    const lista = (await pedido(ctx, "comercial", "GET", "/v1/crm/clientes?tipo=Particular")).json().linhas as { id: number; tipo: string }[];
    expect(lista.every(l => l.tipo === "Particular")).toBe(true);
    expect(lista.map(l => l.id)).toContain(id);
    expect((await pedido(ctx, "comercial", "PATCH", `/v1/crm/clientes/${id}`, { tipo: "Empresa" })).statusCode).toBe(200);
  });

  it("modelos: só a secretaria edita, e conta os usos", async () => {
    expect((await pedido(ctx, "comercial", "POST", "/v1/crm/modelos/contrato", { nome: "Modelo X" })).statusCode).toBe(403);
    const m = await pedido(ctx, "secretaria", "POST", "/v1/crm/modelos/contrato", { nome: "Modelo X", corpo: "Contrato com {{cliente}}" });
    const mid = m.json().modelo.id as number;
    await pedido(ctx, "comercial", "POST", "/v1/crm/contratos", { clienteNome: "Cliente Y", templateId: mid });
    const lista = await pedido(ctx, "comercial", "GET", "/v1/crm/modelos/contrato");
    expect(lista.json().modelos.find((x: { id: number }) => x.id === mid).usos).toBe(1);
    expect((await pedido(ctx, "secretaria", "PATCH", `/v1/crm/modelos/contrato/${mid}`, { nome: "Modelo Y" })).json().modelo.nome).toBe("Modelo Y");
  });

  it("parceiros: criar, alterar e apagar só pela secretaria", async () => {
    const p = await pedido(ctx, "comercial", "POST", "/v1/crm/parceiros", { nome: "Associação Teste", tipo: "Associação" });
    const id = p.json().parceiro.id as number;
    expect((await pedido(ctx, "comercial", "PATCH", `/v1/crm/parceiros/${id}`, { retribuicao: "10 % por inscrito" })).statusCode).toBe(200);
    const lista = await pedido(ctx, "comercial", "GET", "/v1/crm/parceiros?q=Associa");
    expect(lista.json().parceiros.find((x: { id: number }) => x.id === id).retribuicao).toBe("10 % por inscrito");
    expect((await pedido(ctx, "comercial", "DELETE", `/v1/crm/parceiros/${id}`)).statusCode).toBe(403);
    expect((await pedido(ctx, "secretaria", "DELETE", `/v1/crm/parceiros/${id}`)).statusCode).toBe(200);
  });

  it("o formador não lê o diretório comercial", async () => {
    expect((await pedido(ctx, "formador", "GET", "/v1/crm/clientes")).statusCode).toBe(403);
  });
});

describe("Equipa: período e período anterior", () => {
  it("separa as pré-inscrições do período das do período anterior", async () => {
    const comercial = ctx.userId.comercial;
    await novoLead(null, "Pago", 200, { comercial, criado: "2026-03-10T10:00:00Z" });
    await novoLead(null, "Não contactado", 200, { comercial, criado: "2026-03-12T10:00:00Z" });
    await novoLead(null, "Pago", 300, { comercial, criado: "2026-02-10T10:00:00Z" });
    const r = await pedido(ctx, "secretaria", "GET", "/v1/equipa?regime=gold&de=2026-03-01&ate=2026-03-31");
    expect(r.statusCode).toBe(200);
    const m = r.json().membros.find((x: { id: string }) => x.id === comercial);
    expect(m.atual).toMatchObject({ leads: 2, pagos: 1, receita: 200, conversao: 50 });
    expect(r.json().periodo.anterior).toEqual({ de: "2026-01-29", ate: "2026-02-28" });
    expect(m.anterior).toMatchObject({ leads: 1, pagos: 1, receita: 300 });

    const ficha = await pedido(ctx, "comercial", "GET", `/v1/equipa/${comercial}?regime=gold`);
    expect(ficha.statusCode).toBe(200);
    expect(ficha.json().membro.carteira.leads).toBeGreaterThanOrEqual(3);
  });

  it("cada equipa só vê a sua", async () => {
    expect((await pedido(ctx, "comercial", "GET", "/v1/equipa?regime=fin")).statusCode).toBe(403);
    expect((await pedido(ctx, "financiada", "GET", "/v1/equipa?regime=gold")).statusCode).toBe(403);
    expect((await pedido(ctx, "comercial", "PUT", `/v1/equipa/${ctx.userId.comercial}/objetivo`, { metaPct: 30 })).statusCode).toBe(403);
  });
});

describe("Campanhas por email aos pré-inscritos parados", () => {
  it("escolhe quem tem mais de um mês e 2 contactos, põe na fila com o cronograma e regista o contacto", async () => {
    const curso = `Curso Mail ${Date.now()}`;
    const t = await pedido(ctx, "secretaria", "POST", "/v1/turmas-gold", {
      dataInicio: "2099-06-01", nome: `CM ${Date.now()}`, curso, local: "Porto", horario: "Laboral", vagas: 10,
    });
    expect(t.statusCode, t.body).toBe(200);
    const turmaId = t.json().turma.id as number;
    await ctx.db.query("UPDATE turmas_gold SET cronograma_publicado_em = now() WHERE id = $1", [turmaId]);

    // Do comercial que envia: o comercial só vê (e escreve a) as suas pré-inscrições, não as sem dono.
    const lead = async (dias: number, contactos: number, estado = "2º Contacto") => {
      const r = await ctx.db.query<{ id: number }>(
        `INSERT INTO preinscricoes (id, inscrito, nome, email, curso, preco, estado, regime, comercial_id, created_at)
         VALUES (nextval('ops_id_seq')::int, to_char(now(), 'YYYY-MM-DD'), 'Parado', $1, $2, 100, $3, 'gold', $5, now() - make_interval(days => $4::int))
         RETURNING id`,
        [`parado.${Math.random().toString(36).slice(2)}@exemplo.pt`, curso, estado, dias, ctx.userId.comercial],
      );
      const id = r.rows[0]!.id;
      for (let i = 0; i < contactos; i++) await ctx.db.query("INSERT INTO preinscricao_contactos (preinscricao_id, nota) VALUES ($1, 'lembrete')", [id]);
      return id;
    };
    const certo = await lead(40, 2);
    const recente = await lead(10, 3);
    const poucos = await lead(40, 1);
    const formando = await lead(40, 2, "Formando");

    const q = `dias=30&contactos=2&curso=${encodeURIComponent(curso)}`;
    expect((await pedido(ctx, "financiada", "GET", `/v1/campanhas/email/candidatos?${q}`)).statusCode).toBe(403);
    const cand = await pedido(ctx, "comercial", "GET", `/v1/campanhas/email/candidatos?${q}`);
    expect(cand.statusCode, cand.body).toBe(200);
    const ids = (cand.json().candidatos as { id: number; motivo: string }[]).map(c => c.id);
    expect(ids).toEqual([certo]);

    const env = await pedido(ctx, "comercial", "POST", "/v1/campanhas/email/enviar", {
      criterios: { dias: 30, contactos: 2, curso }, ids: [certo, recente, poucos, formando],
    });
    expect(env.statusCode, env.body).toBe(200);
    expect(env.json()).toMatchObject({ total: 1, postos: 1 });

    const job = await ctx.db.query<{ body_html: string; subject: string }>(
      `SELECT j.body_html, j.subject FROM email_jobs j JOIN automation_events e ON e.id = j.event_id
        WHERE e.idempotency_key = $1`, [`campanha:${env.json().envioId}:${certo}`]);
    expect(job.rows).toHaveLength(1);
    expect(job.rows[0]!.subject).toContain(curso);
    expect(job.rows[0]!.body_html).toContain(`/cronograma/gold/${turmaId}`);
    expect(job.rows[0]!.body_html).toContain("Porto · Laboral · início 01/06/2099");

    const contactos = await ctx.db.query<{ n: number }>("SELECT count(*)::int AS n FROM preinscricao_contactos WHERE preinscricao_id = $1", [certo]);
    expect(contactos.rows[0]!.n).toBe(3);
    const envios = (await pedido(ctx, "comercial", "GET", "/v1/campanhas/email/envios")).json().envios as { id: number; total: number; enviados: number }[];
    expect(envios.find(e => e.id === env.json().envioId)).toMatchObject({ total: 1, enviados: 1 });
    const destinos = (await pedido(ctx, "comercial", "GET", `/v1/campanhas/email/envios/${env.json().envioId}`)).json().destinos;
    expect(destinos).toEqual([expect.objectContaining({ preinscricaoId: certo, enviado: true })]);
  });
});

describe("Cronograma da turma no site", () => {
  it("aparece assim que a turma tem sessões, mesmo sem «Publicar»", async () => {
    const t = await pedido(ctx, "secretaria", "POST", "/v1/turmas-gold", {
      dataInicio: "2099-07-01", nome: `CR ${Date.now()}`, curso: `Curso Cron ${Date.now()}`, local: "Porto", horario: "Laboral", vagas: 10,
    });
    const turmaId = t.json().turma.id as number;
    const visivel = async () => ((await ctx.app.inject({ method: "GET", url: "/v1/public/oferta" })).json().turmas as { turmaId: number; cronogramaPublicado: boolean }[])
      .find(x => x.turmaId === turmaId)?.cronogramaPublicado;
    const publico = () => ctx.app.inject({ method: "GET", url: `/v1/public/cronograma/gold/${turmaId}` });
    await ctx.db.query("UPDATE turmas_gold SET cronograma = '[{\"id\":\"fim-cronograma\"}]'::jsonb WHERE id = $1", [turmaId]);
    expect(await visivel()).toBe(false);
    expect((await publico()).statusCode).toBe(404);
    await ctx.db.query("UPDATE turmas_gold SET cronograma = '[{\"id\":\"s1\",\"data\":\"2099-07-01\",\"modulo\":\"M1\"}]'::jsonb WHERE id = $1", [turmaId]);
    expect(await visivel()).toBe(true);
    expect((await publico()).json().sessoes).toHaveLength(1);
  });
});
