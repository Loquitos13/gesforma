import { createHash, randomBytes, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { arrancar, pedido } from "./helpers.js";

type Pagina<T> = { total: number; linhas: T[] };
type LinhaPag = { id: string; situacao: string; estado: string; lead_id: number | null; comprovativo_id: number | null };

async function novoPagamentoComComprovativo(email: string) {
  const ctx = await arrancar();
  const r = await pedido(ctx, "secretaria", "POST", "/v1/pagamentos", {
    nome: "Rita Teste", valor: 125, metodo: "Transferência bancária", curso: "Curso Sistema", email, estado: "Pendente",
  });
  expect(r.statusCode).toBe(200);
  const pagId = r.json().pagamento.id as string;
  const leadId = 900000 + Math.floor(Math.random() * 90000);
  await ctx.db.query(
    `INSERT INTO preinscricoes (id, inscrito, nome, email, curso, estado, regime, pagamento_id)
     VALUES ($1, '2026-10-01', 'Rita', $2, 'Curso Sistema', '2º Contacto', 'gold', $3)`,
    [leadId, email, pagId],
  );
  await ctx.db.query(
    "INSERT INTO preinscricao_docs (preinscricao_id, tipo, nome, estado) VALUES ($1, 'comprovativo', 'comprovativo.pdf', 'pendente')",
    [leadId],
  );
  return { pagId, leadId };
}

describe("Pagamentos", () => {
  it("lista com situação, recusa e confirmação do comprovativo", async () => {
    const ctx = await arrancar();
    const { pagId, leadId } = await novoPagamentoComComprovativo(`rita.${randomUUID().slice(0, 6)}@exemplo.pt`);

    let lista = await pedido(ctx, "secretaria", "GET", `/v1/pagamentos?q=${pagId}`);
    expect(lista.statusCode).toBe(200);
    let linha = (lista.json() as Pagina<LinhaPag>).linhas[0]!;
    expect(linha.situacao).toBe("a_confirmar");
    expect(linha.lead_id).toBe(leadId);
    expect(lista.json().indicadores).toHaveProperty("porReceber");

    const semMotivo = await pedido(ctx, "secretaria", "POST", `/v1/pagamentos/${pagId}/recusar`, {});
    expect(semMotivo.statusCode).toBe(400);
    const recusa = await pedido(ctx, "secretaria", "POST", `/v1/pagamentos/${pagId}/recusar`, { motivo: "Valor não corresponde" });
    expect(recusa.statusCode).toBe(200);
    expect(recusa.json().detalhe.situacao).toBe("recusado");
    const doc = await ctx.db.query<{ estado: string }>("SELECT estado FROM preinscricao_docs WHERE preinscricao_id = $1", [leadId]);
    expect(doc.rows[0]!.estado).toBe("recusado");

    const conf = await pedido(ctx, "secretaria", "POST", `/v1/pagamentos/${pagId}/confirmar`);
    expect(conf.statusCode).toBe(200);
    expect(conf.json().pagamento.estado).toBe("Pago");
    const row = await ctx.db.query<{ pago_em: string | null; recusado_em: string | null }>("SELECT pago_em, recusado_em FROM pagamentos WHERE id = $1", [pagId]);
    expect(row.rows[0]!.pago_em).not.toBeNull();
    expect(row.rows[0]!.recusado_em).toBeNull();
    const lead = await ctx.db.query<{ estado: string }>("SELECT estado FROM preinscricoes WHERE id = $1", [leadId]);
    expect(lead.rows[0]!.estado).toBe("Pago");

    const outra = await pedido(ctx, "secretaria", "POST", `/v1/pagamentos/${pagId}/confirmar`);
    expect(outra.statusCode).toBe(409);
    lista = await pedido(ctx, "secretaria", "GET", "/v1/pagamentos?situacao=pago");
    linha = (lista.json() as Pagina<LinhaPag>).linhas.find(l => l.id === pagId)!;
    expect(linha.situacao).toBe("pago");
  });

  it("só a secretaria e a administração vêem os pagamentos", async () => {
    const ctx = await arrancar();
    expect((await pedido(ctx, "comercial", "GET", "/v1/pagamentos")).statusCode).toBe(403);
    expect((await pedido(ctx, "formador", "GET", "/v1/pagamentos")).statusCode).toBe(403);
    expect((await pedido(ctx, "admin", "GET", "/v1/pagamentos")).statusCode).toBe(200);
  });
});

describe("Auditoria", () => {
  it("só a administração lê o registo, com filtros", async () => {
    const ctx = await arrancar();
    await novoPagamentoComComprovativo(`aud.${randomUUID().slice(0, 6)}@exemplo.pt`);
    expect((await pedido(ctx, "secretaria", "GET", "/v1/auditoria")).statusCode).toBe(403);
    const r = await pedido(ctx, "admin", "GET", "/v1/auditoria?entidade=pagamento");
    expect(r.statusCode).toBe(200);
    const corpo = r.json() as Pagina<{ entidade: string; accao: string }>;
    expect(corpo.total).toBeGreaterThan(0);
    expect(corpo.linhas.every(l => l.entidade === "pagamento")).toBe(true);
    expect((await pedido(ctx, "admin", "GET", "/v1/auditoria?utilizador=nao-e-uuid")).statusCode).toBe(400);
  });
});

describe("Utilizadores e sessões", () => {
  it("o admin termina as sessões de um utilizador e a sessão deixa de valer", async () => {
    const ctx = await arrancar();
    const email = `sessao.${randomUUID().slice(0, 6)}@exemplo.pt`;
    const criado = await pedido(ctx, "admin", "POST", "/v1/utilizadores", {
      name: "Pessoa Sessões", email, password: "Uma-Palavra-Passe-Forte-2026!", role: "secretaria",
    });
    expect(criado.statusCode).toBe(200);
    const id = criado.json().user.id as string;
    expect(criado.json().user.mustChangePassword).toBe(true);

    const token = randomBytes(24).toString("hex");
    await ctx.db.query(
      "INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, now() + interval '1 day')",
      [randomUUID(), id, createHash("sha256").update(token).digest("hex")],
    );
    const { config } = await import("../src/config.js");
    const comoEle = () => ctx.app.inject({ method: "GET", url: "/v1/me", headers: { cookie: `${config.cookieName}=${token}` } });
    expect((await comoEle()).statusCode).toBe(200);

    const lista = await pedido(ctx, "admin", "GET", `/v1/utilizadores?q=${encodeURIComponent(email)}`);
    expect(lista.json().users[0].sessions_open).toBe(1);

    expect((await pedido(ctx, "secretaria", "POST", `/v1/utilizadores/${id}/terminar-sessoes`)).statusCode).toBe(403);
    const fim = await pedido(ctx, "admin", "POST", `/v1/utilizadores/${id}/terminar-sessoes`);
    expect(fim.statusCode).toBe(200);
    expect(fim.json().terminadas).toBe(1);
    expect((await comoEle()).statusCode).toBe(401);
  });
});

describe("Emails automáticos", () => {
  it("regras com último envio, opções sem dados fixos e histórico paginado", async () => {
    const ctx = await arrancar();
    const regras = await pedido(ctx, "secretaria", "GET", "/v1/email/regras");
    expect(regras.statusCode).toBe(200);
    const lista = regras.json().rules as { id: number; ultimoEnvio: string | null }[];
    expect(lista.length).toBeGreaterThan(0);
    expect(lista[0]).toHaveProperty("ultimoEnvio");

    const opcoes = await pedido(ctx, "secretaria", "GET", "/v1/email/opcoes");
    expect(opcoes.json().gatilhos.length).toBeGreaterThan(0);
    expect(JSON.stringify(opcoes.json())).not.toMatch(/Multibanco/i);

    const teste = await pedido(ctx, "secretaria", "POST", `/v1/email/rules/${lista[0]!.id}/teste`);
    expect(teste.statusCode).toBe(200);
    const envios = await pedido(ctx, "secretaria", "GET", `/v1/email/envios?regra=${lista[0]!.id}&porPagina=5`);
    expect(envios.statusCode).toBe(200);
    expect(envios.json().total).toBeGreaterThan(0);
    expect(envios.json().linhas[0].teste).toBe(true);

    const modelos = await pedido(ctx, "secretaria", "GET", "/v1/email/templates");
    const tipo = modelos.json().templates[0].tipo as string;
    const prev = await pedido(ctx, "secretaria", "POST", "/v1/email/previsualizar", { tipo, assunto: "Olá {{nome}}" });
    expect(prev.statusCode).toBe(200);
    expect(prev.json().assunto).toBe("Olá Teste secretaria");
    expect(prev.json().html).toContain("<html");
    expect(prev.json().html).not.toMatch(/123 456 789|VNG-SM/);

    expect((await pedido(ctx, "comercial", "GET", "/v1/email/regras")).statusCode).toBe(403);
  });
});
