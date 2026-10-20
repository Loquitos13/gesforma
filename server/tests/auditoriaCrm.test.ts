import { createHash, randomBytes, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { arrancar, pedido, type Ctx } from "./helpers.js";

// Correcções da auditoria ao CRM. Em PGlite o RLS não actua: as regras têm de estar no código.

let seq = 0;
const unico = (p: string) => `${p}-${Date.now()}-${++seq}`;
const PAPEL = '<div data-gf="doc" data-assinatura="papel" hidden></div><p>Contrato em papel</p>';

/** Segundo comercial (B), com sessão própria. */
async function comercialB(ctx: Ctx) {
  const id = randomUUID();
  await ctx.db.query("INSERT INTO users (id, name, email, password_hash, role, active) VALUES ($1, 'Comercial B', $2, 'x', 'comercial', true)",
    [id, `comercial.b.${id.slice(0, 8)}@exemplo.pt`]);
  const token = randomBytes(24).toString("hex");
  await ctx.db.query("INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, now() + interval '1 day')",
    [randomUUID(), id, createHash("sha256").update(token).digest("hex")]);
  const { config } = await import("../src/config.js");
  const cookie = `${config.cookieName}=${token}`;
  return {
    id,
    pedir: (method: "GET" | "POST" | "PATCH" | "DELETE", url: string, payload?: unknown) =>
      ctx.app.inject({ method, url, headers: { "x-gesforma-client": "web", cookie }, payload: payload as never }),
  };
}

async function novoCliente(ctx: Ctx, extra: Record<string, unknown> = {}) {
  const r = await pedido(ctx, "secretaria", "POST", "/v1/crm/clientes", { nome: unico("Cliente"), ...extra });
  expect(r.statusCode, r.body).toBe(200);
  return r.json().cliente.id as number;
}

describe("Contrato assinado em papel é irreversível", () => {
  it("cancelado não volta a rascunho, não muda valor nem texto e não se apaga", async () => {
    const ctx = await arrancar();
    const k = (await pedido(ctx, "comercial", "POST", "/v1/crm/contratos", { clienteNome: unico("Papel"), valor: 500, corpo: PAPEL })).json().contrato;
    // O comercial não marca como assinado nem cancela: é a gestão.
    expect((await pedido(ctx, "comercial", "PATCH", `/v1/crm/contratos/${k.id}`, { estado: "Assinado" })).statusCode).toBe(403);
    const ass = await pedido(ctx, "secretaria", "PATCH", `/v1/crm/contratos/${k.id}`, { estado: "Assinado" });
    expect(ass.statusCode, ass.body).toBe(200);
    const assinadoEm = ass.json().contrato.assinadoEm as string;
    expect(assinadoEm).toBeTruthy();
    expect((await pedido(ctx, "comercial", "PATCH", `/v1/crm/contratos/${k.id}`, { estado: "Cancelado" })).statusCode).toBe(403);
    const canc = await pedido(ctx, "secretaria", "PATCH", `/v1/crm/contratos/${k.id}`, { estado: "Cancelado" });
    expect(canc.statusCode, canc.body).toBe(200);
    expect(canc.json().contrato.assinadoEm).toBe(assinadoEm);

    // A sequência antiga: Cancelado → Rascunho (apagava assinado_em) → mudar valor/texto → apagar.
    for (const quem of ["comercial", "secretaria"] as const) {
      expect((await pedido(ctx, quem, "PATCH", `/v1/crm/contratos/${k.id}`, { estado: "Rascunho" })).statusCode).toBe(409);
      expect((await pedido(ctx, quem, "PATCH", `/v1/crm/contratos/${k.id}`, { estado: "Por assinar" })).statusCode).toBe(409);
      expect((await pedido(ctx, quem, "PATCH", `/v1/crm/contratos/${k.id}`, { valor: 1 })).statusCode).toBe(409);
      expect((await pedido(ctx, quem, "PATCH", `/v1/crm/contratos/${k.id}`, { corpo: "<p>outro</p>" })).statusCode).toBe(409);
    }
    expect((await pedido(ctx, "secretaria", "PATCH", `/v1/crm/contratos/${k.id}`, { estado: "Assinado" })).statusCode).toBe(409);
    expect((await pedido(ctx, "secretaria", "DELETE", `/v1/crm/contratos/${k.id}`)).statusCode).toBe(409);
    const fim = (await pedido(ctx, "secretaria", "GET", `/v1/crm/contratos/${k.id}`)).json().contrato;
    expect(fim).toMatchObject({ estado: "Cancelado", valor: 500, assinadoEm });
  });

  it("contrato de assinatura digital não se marca à mão como assinado; um cancelado nunca assinado ainda volta a rascunho", async () => {
    const ctx = await arrancar();
    const k = (await pedido(ctx, "comercial", "POST", "/v1/crm/contratos", { clienteNome: unico("Digital"), corpo: "<p>Contrato</p>" })).json().contrato;
    expect((await pedido(ctx, "secretaria", "PATCH", `/v1/crm/contratos/${k.id}`, { estado: "Assinado" })).statusCode).toBe(409);
    expect((await pedido(ctx, "secretaria", "PATCH", `/v1/crm/contratos/${k.id}`, { estado: "Cancelado" })).statusCode).toBe(200);
    const volta = await pedido(ctx, "comercial", "PATCH", `/v1/crm/contratos/${k.id}`, { estado: "Rascunho", valor: 10 });
    expect(volta.statusCode, volta.body).toBe(200);
    expect(volta.json().contrato).toMatchObject({ estado: "Rascunho", valor: 10, assinadoEm: null });
    expect((await pedido(ctx, "secretaria", "DELETE", `/v1/crm/contratos/${k.id}`)).statusCode).toBe(200);
  });
});

describe("Campanhas por email: só as pré-inscrições que o ator vê", () => {
  it("o comercial não vê nem envia para as de outro comercial nem para as sem dono", async () => {
    const ctx = await arrancar();
    const b = await comercialB(ctx);
    const curso = unico("Curso Campanha Dono");
    const lead = async (dono: string | null) => {
      const r = await ctx.db.query<{ id: number }>(
        `INSERT INTO preinscricoes (id, inscrito, nome, email, curso, preco, estado, regime, comercial_id, created_at)
         VALUES (nextval('ops_id_seq')::int, to_char(now(), 'YYYY-MM-DD'), 'Parado', $1, $2, 100, '2º Contacto', 'gold', $3, now() - interval '40 days')
         RETURNING id`,
        [`${unico("parado")}@exemplo.pt`, curso, dono],
      );
      const id = r.rows[0]!.id;
      for (let i = 0; i < 2; i++) await ctx.db.query("INSERT INTO preinscricao_contactos (preinscricao_id, nota) VALUES ($1, 'x')", [id]);
      return id;
    };
    const minha = await lead(ctx.userId.comercial);
    const deB = await lead(b.id);
    const semDono = await lead(null);
    const q = `dias=30&contactos=2&curso=${encodeURIComponent(curso)}`;
    const ids = async (r: Promise<{ json: () => { candidatos: { id: number }[] } }>) => (await r).json().candidatos.map(c => c.id).sort();

    expect(await ids(pedido(ctx, "comercial", "GET", `/v1/campanhas/email/candidatos?${q}`))).toEqual([minha]);
    expect(await ids(b.pedir("GET", `/v1/campanhas/email/candidatos?${q}`))).toEqual([deB]);
    expect(await ids(pedido(ctx, "secretaria", "GET", `/v1/campanhas/email/candidatos?${q}`))).toEqual([minha, deB, semDono].sort());

    // Enviar só para a de outro (ou sem dono): nenhuma cumpre para este ator.
    const criterios = { dias: 30, contactos: 2, curso };
    expect((await pedido(ctx, "comercial", "POST", "/v1/campanhas/email/enviar", { criterios, ids: [deB, semDono] })).statusCode).toBe(409);
    const env = await pedido(ctx, "secretaria", "POST", "/v1/campanhas/email/enviar", { criterios, ids: [minha, deB, semDono] });
    expect(env.statusCode, env.body).toBe(200);
    const envioId = env.json().envioId as number;
    const destinos = async (r: Promise<{ json: () => { destinos: { preinscricaoId: number }[] } }>) => (await r).json().destinos.map(d => d.preinscricaoId).sort();
    expect(await destinos(pedido(ctx, "comercial", "GET", `/v1/campanhas/email/envios/${envioId}`))).toEqual([minha]);
    expect(await destinos(pedido(ctx, "secretaria", "GET", `/v1/campanhas/email/envios/${envioId}`))).toEqual([minha, deB, semDono].sort());
  });

  it("só a gestão apaga campanhas", async () => {
    const ctx = await arrancar();
    const id = (await pedido(ctx, "comercial", "POST", "/v1/campanhas", { nome: unico("Camp"), data: "2026-05-01" })).json().campanha.id as number;
    expect((await pedido(ctx, "comercial", "DELETE", `/v1/campanhas/${id}`)).statusCode).toBe(403);
    expect((await pedido(ctx, "comercial", "PATCH", `/v1/campanhas/${id}`, { notas: "ok" })).statusCode).toBe(200);
    expect((await pedido(ctx, "secretaria", "DELETE", `/v1/campanhas/${id}`)).statusCode).toBe(200);
  });
});

describe("CRM da Financiada", () => {
  it("cria e volta a abrir uma proposta e um contrato (ficam no regime Fin)", async () => {
    const ctx = await arrancar();
    const cliente = await novoCliente(ctx);
    const p = await pedido(ctx, "financiada", "POST", `/v1/crm/clientes/${cliente}/propostas`, { curso: "Curso Fin", valor: 300 });
    expect(p.statusCode, p.body).toBe(200);
    const propostaId = p.json().proposta.id as number;
    const aberta = await pedido(ctx, "financiada", "GET", `/v1/crm/propostas/${propostaId}`);
    expect(aberta.statusCode, aberta.body).toBe(200);
    expect(aberta.json().proposta.regime).toBe("fin");
    expect((await pedido(ctx, "financiada", "GET", "/v1/crm/propostas?regime=fin&porPagina=200")).json().linhas.map((x: { id: number }) => x.id)).toContain(propostaId);
    // O comercial (Gold) não a vê.
    expect((await pedido(ctx, "comercial", "GET", `/v1/crm/propostas/${propostaId}`)).statusCode).toBe(404);

    const k = await pedido(ctx, "financiada", "POST", "/v1/crm/contratos", { clienteNome: "Cliente Fin", propostaId });
    expect(k.statusCode, k.body).toBe(200);
    const contratoId = k.json().contrato.id as number;
    expect((await pedido(ctx, "financiada", "GET", `/v1/crm/contratos/${contratoId}`)).statusCode).toBe(200);
    expect((await pedido(ctx, "financiada", "PATCH", `/v1/crm/contratos/${contratoId}`, { notas: "revisto" })).statusCode).toBe(200);
    const direto = await pedido(ctx, "financiada", "POST", "/v1/crm/contratos", { clienteNome: "Directo Fin" });
    expect((await pedido(ctx, "financiada", "GET", `/v1/crm/contratos/${direto.json().contrato.id}`)).statusCode).toBe(200);
    const r = await ctx.db.query<{ formando_regime: string }>("SELECT formando_regime FROM contratos_comerciais WHERE id IN ($1, $2) ORDER BY id",
      [contratoId, direto.json().contrato.id]);
    expect(r.rows.map(x => x.formando_regime)).toEqual(["fin", "fin"]);

    // A gestão escolhe o regime do ecrã; o comercial fica sempre na Gold.
    const adm = await pedido(ctx, "secretaria", "POST", `/v1/crm/clientes/${cliente}/propostas`, { curso: "X", regime: "fin" });
    expect((await pedido(ctx, "financiada", "GET", `/v1/crm/propostas/${adm.json().proposta.id}`)).statusCode).toBe(200);
    const com = await pedido(ctx, "comercial", "POST", `/v1/crm/clientes/${cliente}/propostas`, { curso: "Y", regime: "fin" });
    expect((await pedido(ctx, "comercial", "GET", `/v1/crm/propostas/${com.json().proposta.id}`)).json().proposta.regime).toBe("gold");
  });
});

describe("Clientes: totais e histórico com a visibilidade de quem pede", () => {
  it("o comercial não conta o que é de outro e cada regime só vê os seus cursos", async () => {
    const ctx = await arrancar();
    const b = await comercialB(ctx);
    const email = `${unico("hist")}@exemplo.pt`;
    const nome = unico("Hist");
    const cliente = await novoCliente(ctx, { nome, email, tipo: "Particular" });
    expect((await b.pedir("POST", `/v1/crm/clientes/${cliente}/propostas`, { curso: "De B", valor: 900 })).statusCode).toBe(200);
    const pB = (await ctx.db.query<{ id: number }>("SELECT id FROM propostas_comerciais WHERE cliente_id = $1", [cliente])).rows[0]!.id;
    await ctx.db.query("UPDATE propostas_comerciais SET estado = 'Aceite' WHERE id = $1", [pB]);
    const fid = Number((await ctx.db.query<{ n: number }>("SELECT COALESCE(max(id), 0) + 1 AS n FROM formandos_gold")).rows[0]!.n);
    await ctx.db.query("INSERT INTO formandos_gold (id, nome, email, inscrito, curso, turma, pago, valor) VALUES ($1, 'H', $2, '2026-03-04', 'Gold A', '', true, 100)", [fid, email]);
    const fidFin = Number((await ctx.db.query<{ n: number }>("SELECT COALESCE(max(id), 0) + 1 AS n FROM formandos_fin")).rows[0]!.n);
    await ctx.db.query("INSERT INTO formandos_fin (id, nome, email, curso, turma) VALUES ($1, 'H', $2, 'Fin A', '')", [fidFin, email]);

    const linha = async (quem: "comercial" | "secretaria") =>
      (await pedido(ctx, quem, "GET", `/v1/crm/clientes?q=${encodeURIComponent(nome)}`)).json().linhas.find((x: { id: number }) => x.id === cliente);
    expect(await linha("comercial")).toMatchObject({ propostas: 0, emAberto: 0, ultimoEstado: "Sem propostas", ultimoCurso: "" });
    expect(await linha("secretaria")).toMatchObject({ propostas: 1, ultimoEstado: "Aceite", ultimoCurso: "De B" });
    const resumoB = (await b.pedir("GET", "/v1/crm/clientes")).json().resumo;
    const resumoA = (await pedido(ctx, "comercial", "GET", "/v1/crm/clientes")).json().resumo;
    expect(resumoA.clientes).toBe(resumoB.clientes);

    const origens = async (r: Promise<{ json: () => { cliente: { historico: { origem: string }[] } } }>) => (await r).json().cliente.historico.map(h => h.origem).sort();
    expect(await origens(pedido(ctx, "comercial", "GET", `/v1/crm/clientes/${cliente}`))).toEqual(["Curso Gold"]);
    expect(await origens(b.pedir("GET", `/v1/crm/clientes/${cliente}`))).toEqual(["Curso Gold", "Proposta aceite"]);
    expect(await origens(pedido(ctx, "financiada", "GET", `/v1/crm/clientes/${cliente}`))).toEqual(["Curso Financiado"]);
    expect(await origens(pedido(ctx, "secretaria", "GET", `/v1/crm/clientes/${cliente}`))).toEqual(["Curso Financiado", "Curso Gold", "Proposta aceite"]);
  });

  it("apagar cliente: verifica e apaga na mesma transacção", async () => {
    const ctx = await arrancar();
    const comProposta = await novoCliente(ctx);
    await pedido(ctx, "secretaria", "POST", `/v1/crm/clientes/${comProposta}/propostas`, { curso: "Z" });
    expect((await pedido(ctx, "secretaria", "DELETE", `/v1/crm/clientes/${comProposta}`)).statusCode).toBe(409);
    const livre = await novoCliente(ctx);
    expect((await pedido(ctx, "secretaria", "DELETE", `/v1/crm/clientes/${livre}`)).statusCode).toBe(200);
    expect((await pedido(ctx, "secretaria", "DELETE", `/v1/crm/clientes/${livre}`)).statusCode).toBe(404);
  });
});

describe("Pedido de proposta do site", () => {
  it("mensagens longas e repetidas ficam no pedido; o cliente continua a poder gravar-se", async () => {
    const ctx = await arrancar();
    const email = `${unico("longo")}@empresa.pt`;
    const mensagem = "m".repeat(3000);
    for (let i = 0; i < 3; i++) {
      const r = await ctx.app.inject({ method: "POST", url: "/v1/public/pedidos-proposta", payload: { nome: "Rui", empresa: "Longa", email, servico: "s".repeat(160), mensagem } });
      expect(r.statusCode, r.body).toBe(200);
    }
    const c = (await ctx.db.query<{ id: number; notas: string }>("SELECT id, notas FROM crm_clientes WHERE email = $1", [email])).rows;
    expect(c).toHaveLength(1);
    expect(c[0]!.notas.length).toBeLessThanOrEqual(2000);
    const ficha = (await pedido(ctx, "secretaria", "GET", `/v1/crm/clientes/${c[0]!.id}`)).json().cliente;
    expect((await pedido(ctx, "secretaria", "PATCH", `/v1/crm/clientes/${c[0]!.id}`, { notas: ficha.notas, telf: "910000000" })).statusCode).toBe(200);
    const pedidos = (await ctx.db.query<{ mensagem: string; cliente_id: number }>("SELECT mensagem, cliente_id FROM pedidos_proposta WHERE email = $1", [email])).rows;
    expect(pedidos).toHaveLength(3);
    expect(pedidos.every(p => p.mensagem === mensagem && p.cliente_id === c[0]!.id)).toBe(true);
  });

  it("dois pedidos ao mesmo tempo com o mesmo email criam um só cliente", async () => {
    const ctx = await arrancar();
    const email = `${unico("par")}@empresa.pt`;
    const enviar = () => ctx.app.inject({ method: "POST", url: "/v1/public/pedidos-proposta", payload: { nome: "Par", email } });
    const rs = await Promise.all([enviar(), enviar()]);
    expect(rs.map(r => r.statusCode)).toEqual([200, 200]);
    expect((await ctx.db.query("SELECT 1 FROM crm_clientes WHERE email = $1", [email])).rows).toHaveLength(1);
  });
});

describe("Código morto", () => {
  it("os caminhos antigos dos modelos já não existem", async () => {
    const ctx = await arrancar();
    expect((await pedido(ctx, "secretaria", "GET", "/v1/crm/proposta-templates")).statusCode).toBe(404);
    expect((await pedido(ctx, "secretaria", "POST", "/v1/crm/contrato-templates", { nome: "X" })).statusCode).toBe(404);
  });
});
