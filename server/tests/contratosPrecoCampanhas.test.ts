import { describe, expect, it } from "vitest";
import { arrancar, pedido, type Ctx } from "./helpers.js";

let seq = 0;
const unico = (p: string) => `${p} ${Date.now()}-${++seq}`;

async function contratoEnviado(ctx: Ctx) {
  const cli = await pedido(ctx, "secretaria", "POST", "/v1/crm/clientes", { nome: "Quinta do Vale Verde", email: "geral@valeverde.example", nif: "509876543" });
  expect(cli.statusCode, cli.body).toBe(200);
  const clienteId = cli.json().cliente?.id ?? cli.json().id;
  const k = await pedido(ctx, "secretaria", "POST", "/v1/crm/contratos", {
    clienteNome: "Quinta do Vale Verde", clienteEmail: "geral@valeverde.example", curso: "HACCP", valor: 380, clienteId,
    corpo: "Contrato com {{cliente}} para {{curso}} por {{valor}}.",
  });
  expect(k.statusCode, k.body).toBe(200);
  const contratoId = k.json().contrato.id as number;
  const env = await pedido(ctx, "secretaria", "POST", `/v1/crm/contratos/${contratoId}/assinatura`, {});
  expect(env.statusCode, env.body).toBe(200);
  return { contratoId, assinaturaId: env.json().assinatura.id as number };
}

describe("contratos enviados para assinatura ficam fechados", () => {
  it("Por assinar: não muda texto/valor/estado; cancelar fecha a ligação e já não se conclui", async () => {
    const ctx = await arrancar();
    const { contratoId, assinaturaId } = await contratoEnviado(ctx);
    const url = `/v1/crm/contratos/${contratoId}`;
    expect((await pedido(ctx, "secretaria", "PATCH", url, { valor: 1 })).statusCode).toBe(409);
    expect((await pedido(ctx, "secretaria", "PATCH", url, { curso: "Outro" })).statusCode).toBe(409);
    expect((await pedido(ctx, "secretaria", "PATCH", url, { estado: "Rascunho" })).statusCode).toBe(409);
    expect((await pedido(ctx, "secretaria", "PATCH", url, { notas: "ligar amanhã", valor: 380 })).statusCode).toBe(200);

    const can = await pedido(ctx, "secretaria", "PATCH", url, { estado: "Cancelado" });
    expect(can.statusCode, can.body).toBe(200);
    expect(can.json().contrato.estado).toBe("Cancelado");
    const a = await ctx.db.query<{ estado: string }>("SELECT estado FROM contrato_assinaturas WHERE id = $1", [assinaturaId]);
    expect(a.rows[0]!.estado).toBe("cancelado");

    // Mesmo que o pedido volte a estar aberto, um contrato cancelado não passa a assinado.
    await ctx.db.query("UPDATE contrato_assinaturas SET estado = 'aberto' WHERE id = $1", [assinaturaId]);
    const repo = await import("../src/repos/assinaturas.js");
    const ok = await repo.concluir(ctx.db, assinaturaId, {
      metodo: "escrita", pdf: Buffer.from("%PDF-"), hashAssinatura: "x", hashFinal: "x", fingerprint: "", titular: "", selado: false,
    });
    expect(ok).toBe(false);
  });

  it("assinado: só se cancela, e nem cancelado volta a rascunho nem se apaga", async () => {
    const ctx = await arrancar();
    const { contratoId, assinaturaId } = await contratoEnviado(ctx);
    await ctx.db.query("UPDATE contrato_assinaturas SET estado = 'assinado', assinado_em = now() WHERE id = $1", [assinaturaId]);
    await ctx.db.query("UPDATE contratos_comerciais SET estado = 'Assinado', assinado_em = now() WHERE id = $1", [contratoId]);
    const url = `/v1/crm/contratos/${contratoId}`;
    expect((await pedido(ctx, "secretaria", "PATCH", url, { estado: "Rascunho" })).statusCode).toBe(409);
    expect((await pedido(ctx, "secretaria", "DELETE", url)).statusCode).toBe(409);
    expect((await pedido(ctx, "secretaria", "PATCH", url, { estado: "Cancelado" })).statusCode).toBe(200);
    expect((await pedido(ctx, "secretaria", "PATCH", url, { estado: "Rascunho" })).statusCode).toBe(409);
    expect((await pedido(ctx, "secretaria", "PATCH", url, { corpo: "Outro texto" })).statusCode).toBe(409);
    expect((await pedido(ctx, "secretaria", "DELETE", url)).statusCode).toBe(409);
    const pdf = await ctx.db.query("SELECT 1 FROM contrato_assinaturas WHERE id = $1 AND estado = 'assinado'", [assinaturaId]);
    expect(pdf.rows).toHaveLength(1);
  });
});

describe("preço Gold: uma só fonte", () => {
  it("/v1/equipa/preco segue as regras por local da ficha, como o pedido de pagamento", async () => {
    const ctx = await arrancar();
    const nome = unico("Curso Preço Equipa");
    const c = await pedido(ctx, "secretaria", "POST", "/v1/cursos-gold", { nome, categoria: "Teste", tipo: "Pré-inscrição", preco: 100, regime: "Presencial", horas: 8 });
    expect(c.statusCode, c.body).toBe(200);
    const ficha = await pedido(ctx, "admin", "PUT", `/v1/cursos/gold/${c.json().curso.id}/ficha`, {
      payload: { precosOferta: [{ local: "Lisboa", horario: "", preco: 150 }] }, criterios: [],
    });
    expect(ficha.statusCode, ficha.body).toBe(200);
    const { precoParaOferta } = await import("../src/precoOferta.js");
    const preco = async (local: string) =>
      (await pedido(ctx, "comercial", "GET", `/v1/equipa/preco?curso=${encodeURIComponent(nome)}&local=${local}&horario=Laboral`)).json().preco;
    expect(await preco("Lisboa")).toBe(150);
    expect(await preco("Lisboa")).toBe(await precoParaOferta(ctx.db, nome, "Lisboa", "Laboral"));
    expect(await preco("Porto")).toBe(100);
  });
});

describe("campanha por email aos pré-inscritos parados", () => {
  it("deixa de fora quem pagou, quem foi validado e a Financiada", async () => {
    const ctx = await arrancar();
    const curso = unico("Curso Campanha");
    const lead = async (estado: string, regime = "gold", validada = false) => {
      const r = await ctx.db.query<{ id: number }>(
        `INSERT INTO preinscricoes (id, inscrito, nome, email, curso, preco, estado, regime, created_at, validada_em)
         VALUES (nextval('ops_id_seq')::int, to_char(now(), 'YYYY-MM-DD'), 'Parado', $1, $2, 100, $3, $4, now() - interval '40 days', $5)
         RETURNING id`,
        [`${Math.random().toString(36).slice(2)}@exemplo.pt`, curso, estado, regime, validada ? new Date().toISOString() : null],
      );
      const id = r.rows[0]!.id;
      for (let i = 0; i < 2; i++) await ctx.db.query("INSERT INTO preinscricao_contactos (preinscricao_id, nota) VALUES ($1, 'lembrete')", [id]);
      return id;
    };
    const certo = await lead("2º Contacto");
    await lead("Pago");
    await lead("2º Contacto", "gold", true);
    await lead("2º Contacto", "fin");
    const r = await pedido(ctx, "admin", "GET", `/v1/campanhas/email/candidatos?dias=30&contactos=2&curso=${encodeURIComponent(curso)}`);
    expect(r.statusCode, r.body).toBe(200);
    expect((r.json().candidatos as { id: number }[]).map(c => c.id)).toEqual([certo]);
  });
});

describe("pré-inscrição pública", () => {
  it("duplo clique não cria dois pedidos", async () => {
    const ctx = await arrancar();
    const curso = unico("Curso Duplo");
    expect((await pedido(ctx, "secretaria", "POST", "/v1/cursos-gold", { nome: curso, categoria: "Teste", tipo: "Pré-inscrição", preco: 100, regime: "Presencial", horas: 8 })).statusCode).toBe(200);
    const email = `duplo.${Date.now()}@exemplo.pt`;
    const enviar = (i: number) => ctx.app.inject({
      method: "POST", url: "/v1/public/preinscricoes", payload: { nome: "Ana", email, telf: "912345678", curso }, remoteAddress: `10.7.0.${i}`,
    });
    const rs = await Promise.all([enviar(1), enviar(2), enviar(3)]);
    for (const r of rs) expect(r.statusCode, r.body).toBe(200);
    expect(rs.filter(r => r.json().duplicado === false)).toHaveLength(1);
    const n = await ctx.db.query<{ n: number }>("SELECT count(*)::int AS n FROM preinscricoes WHERE lower(email) = $1 AND curso = $2", [email, curso]);
    expect(n.rows[0]!.n).toBe(1);
  });
});
