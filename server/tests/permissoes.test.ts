import { describe, expect, it } from "vitest";
import { podeAceder } from "../src/permissoes.js";
import { sumarioComRegras } from "../src/sessaoRegras.js";
import { arrancar, pedido } from "./helpers.js";

describe("matriz de permissões", () => {
  it("integrações e utilizadores só para admin", () => {
    for (const [m, p] of [["PUT", "/v1/drive/config"], ["PUT", "/v1/crm/whatsapp/config"], ["POST", "/v1/users"], ["PUT", "/v1/settings/smtp"]] as const) {
      expect(podeAceder("admin", m, p)).toBe(true);
      for (const r of ["secretaria", "comercial", "financiada", "formador"]) expect(podeAceder(r, m, p)).toBe(false);
    }
  });

  it("pagamentos e emails: admin e secretaria", () => {
    expect(podeAceder("secretaria", "PATCH", "/v1/pagamentos/TRX-1")).toBe(true);
    expect(podeAceder("comercial", "POST", "/v1/pagamentos")).toBe(false);
    expect(podeAceder("formador", "GET", "/v1/pagamentos")).toBe(false);
    expect(podeAceder("comercial", "PATCH", "/v1/email/templates/1")).toBe(false);
  });

  it("formador: só leitura, excepto o que é seu", () => {
    expect(podeAceder("formador", "GET", "/v1/ops")).toBe(true);
    expect(podeAceder("formador", "PUT", "/v1/turmas/gold/1/sessoes/2")).toBe(true);
    expect(podeAceder("formador", "PUT", "/v1/turmas/fin/1/avaliacao")).toBe(true);
    expect(podeAceder("formador", "PATCH", "/v1/turmas-gold/3")).toBe(true);
    expect(podeAceder("formador", "PUT", "/v1/turmas/gold/1/certificados/9")).toBe(false);
    expect(podeAceder("formador", "POST", "/v1/catalog/locais")).toBe(false);
    expect(podeAceder("formador", "POST", "/v1/formandos-gold")).toBe(false);
    expect(podeAceder("formador", "GET", "/v1/dashboard")).toBe(false);
    expect(podeAceder("formador", "GET", "/v1/crm/leads")).toBe(false);
    expect(podeAceder("formador", "GET", "/v1/turmas/fin/1/relatorio-final")).toBe(false);
  });

  it("comercial fica fora da Financiada e do fecho", () => {
    expect(podeAceder("comercial", "POST", "/v1/formandos-fin")).toBe(false);
    expect(podeAceder("comercial", "POST", "/v1/turmas/fin/1/fecho")).toBe(false);
    expect(podeAceder("comercial", "POST", "/v1/crm/leads/1/notas")).toBe(true);
    expect(podeAceder("financiada", "POST", "/v1/turmas/fin/1/fecho")).toBe(true);
  });
});

describe("assinatura do sumário", () => {
  const base = { conteudos: "x", atividades: "", observacoes: "", assinado: true };
  const agora = new Date("2026-10-13T10:00:00Z");
  it("o servidor marca a hora e ignora a validação do formador", () => {
    const r = sumarioComRegras("formador", null, { ...base, assinadoEm: "1999-01-01", presencasValidadas: true }, "2026-10-12", agora);
    expect(r.ok && r.sumario.assinadoEm).toBe(agora.toISOString());
    expect(r.ok && r.sumario.presencasValidadas).toBe(false);
  });
  it("o formador não assina sessões futuras", () => {
    expect(sumarioComRegras("formador", null, base, "2026-10-20", agora).ok).toBe(false);
    expect(sumarioComRegras("secretaria", null, { ...base, presencasValidadas: true }, "2026-10-20", agora)).toMatchObject({ ok: true, sumario: { presencasValidadas: true } });
  });
});

describe("API por perfil", () => {
  it("formador não altera definições nem pagamentos", async () => {
    const ctx = await arrancar();
    expect((await pedido(ctx, "formador", "PUT", "/v1/settings/gold", { values: { a: "b" } })).statusCode).toBe(403);
    expect((await pedido(ctx, "formador", "POST", "/v1/pagamentos", {})).statusCode).toBe(403);
    expect((await pedido(ctx, "comercial", "PUT", "/v1/drive/config", {})).statusCode).toBe(403);
  });

  it("/v1/ops não devolve segredos nem dados do formador a terceiros", async () => {
    const ctx = await arrancar();
    await ctx.db.query(
      `INSERT INTO app_settings (id, values) VALUES ('gold', $1::jsonb)
       ON CONFLICT (id) DO UPDATE SET values = EXCLUDED.values`,
      [{ "Chave webhook pagamentos": "segredo-123", "Entidade MB": "12345" }],
    );
    const sec = (await pedido(ctx, "secretaria", "GET", "/v1/ops")).json();
    expect(JSON.stringify(sec.settings)).not.toContain("segredo-123");
    expect(sec.settings.gold["Entidade MB"]).toBe("12345");
    const adm = (await pedido(ctx, "admin", "GET", "/v1/ops")).json();
    expect(adm.settings.gold["Chave webhook pagamentos"]).toBe("segredo-123");
    const form = (await pedido(ctx, "formador", "GET", "/v1/ops")).json();
    expect(form.pagamentos).toEqual([]);
    expect(form.preinscricoes).toEqual([]);
    expect(form.turmasGold).toEqual([]);
    const com = (await pedido(ctx, "comercial", "GET", "/v1/ops")).json();
    expect(com.formadores.every((f: { custoHora: number; nif: string }) => f.custoHora === 0 && f.nif === "")).toBe(true);
  });

  it("secretaria grava a configuração Gold sem apagar a chave do webhook", async () => {
    const ctx = await arrancar();
    await ctx.db.query(
      `INSERT INTO app_settings (id, values) VALUES ('gold', $1::jsonb)
       ON CONFLICT (id) DO UPDATE SET values = EXCLUDED.values`,
      [{ "Chave webhook pagamentos": "segredo-123", "Entidade MB": "12345" }],
    );
    const res = await pedido(ctx, "secretaria", "PUT", "/v1/settings/gold", { values: { "Entidade MB": "999", "Chave webhook pagamentos": "trocada" } });
    expect(res.statusCode).toBe(200);
    const row = await ctx.db.query<{ values: Record<string, string> }>("SELECT values FROM app_settings WHERE id = 'gold'");
    expect(row.rows[0]!.values["Chave webhook pagamentos"]).toBe("segredo-123");
    expect(row.rows[0]!.values["Entidade MB"]).toBe("999");
  });

  it("evento manual só para destinatários conhecidos", async () => {
    const ctx = await arrancar();
    const res = await pedido(ctx, "secretaria", "POST", "/v1/events", {
      type: "payment.confirmed", payload: { email: "desconhecido@exemplo.org", nome: "X" }, idempotencyKey: "teste-evento-1",
    });
    expect(res.statusCode).toBe(403);
    const f = await pedido(ctx, "formador", "POST", "/v1/events", {
      type: "payment.confirmed", payload: { email: "teste.formador@exemplo.pt", nome: "X" }, idempotencyKey: "teste-evento-2",
    });
    expect(f.statusCode).toBe(403);
  });

  it("cron sem segredo é recusado fora do Vercel", async () => {
    const ctx = await arrancar();
    const res = await ctx.app.inject({ method: "GET", url: "/v1/cron/email", headers: { "x-vercel-cron": "1" } });
    expect(res.statusCode).toBe(401);
  });
});
