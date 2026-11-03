import { describe, expect, it } from "vitest";
import { podeAceder } from "../src/permissoes.js";
import { sumarioComRegras } from "../src/sessaoRegras.js";
import { arrancar, pedido } from "./helpers.js";

describe("matriz de permissões", () => {
  it("integrações e utilizadores só para admin", () => {
    for (const [m, p] of [["PUT", "/v1/drive/config"], ["PUT", "/v1/crm/whatsapp/config"], ["POST", "/v1/utilizadores"], ["PUT", "/v1/settings/smtp"]] as const) {
      expect(podeAceder("admin", m, p)).toBe(true);
      for (const r of ["secretaria", "comercial", "financiada", "formador"]) expect(podeAceder(r, m, p)).toBe(false);
    }
  });

  it("pagamentos: só a administração e a contabilidade (as coordenações não abrem a vista)", () => {
    for (const r of ["admin", "contabilidade"]) expect(podeAceder(r, "GET", "/v1/pagamentos"), r).toBe(true);
    for (const r of ["secretaria", "financiada"]) expect(podeAceder(r, "GET", "/v1/pagamentos"), r).toBe(false);
    for (const r of ["admin", "contabilidade"]) {
      expect(podeAceder(r, "POST", "/v1/pagamentos/TRX-1/confirmar"), r).toBe(true);
      expect(podeAceder(r, "POST", "/v1/pagamentos/TRX-1/recusar"), r).toBe(true);
      expect(podeAceder(r, "PATCH", "/v1/pagamentos/TRX-1"), r).toBe(true);
    }
    expect(podeAceder("secretaria", "POST", "/v1/pagamentos/TRX-1/confirmar")).toBe(false);
    expect(podeAceder("secretaria", "PATCH", "/v1/pagamentos/TRX-1")).toBe(false);
    expect(podeAceder("secretaria", "POST", "/v1/pagamentos/TRX-1/recibo")).toBe(false);
    expect(podeAceder("contabilidade", "POST", "/v1/pagamentos/TRX-1/recibo")).toBe(true);
    expect(podeAceder("comercial", "POST", "/v1/pagamentos")).toBe(false);
    expect(podeAceder("financiada", "GET", "/v1/pagamentos")).toBe(false);
    expect(podeAceder("formador", "GET", "/v1/pagamentos")).toBe(false);
  });

  it("contabilidade: só pagamentos, os seus emails e notificações; nada da Gold, da Financiada ou do Sistema", () => {
    for (const [m, p] of [["GET", "/v1/crm/leads"], ["GET", "/v1/turmas-gold"], ["GET", "/v1/turmas-fin"], ["GET", "/v1/painel/gold"],
      ["GET", "/v1/utilizadores"], ["PUT", "/v1/settings/entidade"], ["GET", "/v1/formandos-gold"], ["GET", "/v1/auditoria"]] as const) {
      expect(podeAceder("contabilidade", m, p), `${m} ${p}`).toBe(false);
    }
    for (const [m, p] of [["GET", "/v1/notificacoes"], ["GET", "/v1/drive/files/abc/content"], ["GET", "/v1/pagamentos/exportar"]] as const) {
      expect(podeAceder("contabilidade", m, p), `${m} ${p}`).toBe(true);
    }
  });

  it("coordenações: cada uma só na sua linha, sem painéis; utilizadores e integrações só da administração", () => {
    expect(podeAceder("secretaria", "GET", "/v1/turmas-fin")).toBe(false);
    expect(podeAceder("secretaria", "GET", "/v1/turmas-gold")).toBe(true);
    expect(podeAceder("financiada", "GET", "/v1/turmas-gold")).toBe(false);
    expect(podeAceder("financiada", "GET", "/v1/turmas-fin")).toBe(true);
    for (const r of ["secretaria", "financiada"]) {
      expect(podeAceder(r, "GET", "/v1/painel/gold"), r).toBe(false);
      expect(podeAceder(r, "GET", "/v1/painel/fin"), r).toBe(false);
      expect(podeAceder(r, "GET", "/v1/utilizadores"), r).toBe(false);
      expect(podeAceder(r, "PUT", "/v1/settings/smtp"), r).toBe(false);
      expect(podeAceder(r, "PUT", "/v1/drive/config"), r).toBe(false);
      expect(podeAceder(r, "GET", "/v1/auditoria"), r).toBe(true);
      expect(podeAceder(r, "PUT", "/v1/settings/entidade"), r).toBe(true);
      expect(podeAceder(r, "GET", "/v1/testemunhos"), r).toBe(true);
    }
  });

  it("emails: modelos e regras para toda a equipa e a contabilidade (cada um na sua área); histórico das coordenações e da contabilidade", () => {
    for (const perfil of ["secretaria", "financiada", "comercial", "contabilidade"]) {
      expect(podeAceder(perfil, "GET", "/v1/email/opcoes")).toBe(true);
      expect(podeAceder(perfil, "PATCH", "/v1/email/templates/1")).toBe(true);
      expect(podeAceder(perfil, "POST", "/v1/email/previsualizar")).toBe(true);
      expect(podeAceder(perfil, "POST", "/v1/email/rules")).toBe(true);
      expect(podeAceder(perfil, "PATCH", "/v1/email/rules/3")).toBe(true);
      expect(podeAceder(perfil, "POST", "/v1/email/rules/3/teste")).toBe(true);
      expect(podeAceder(perfil, "DELETE", "/v1/email/rules/3")).toBe(true);
    }
    expect(podeAceder("comercial", "GET", "/v1/email/envios")).toBe(false);
    expect(podeAceder("comercial", "POST", "/v1/email/envios/1/reenviar")).toBe(false);
    expect(podeAceder("comercial", "GET", "/v1/email/jobs")).toBe(false);
    for (const perfil of ["secretaria", "financiada", "contabilidade"]) expect(podeAceder(perfil, "GET", "/v1/email/envios"), perfil).toBe(true);
    expect(podeAceder("formador", "PATCH", "/v1/email/templates/1")).toBe(false);
  });

  it("formador: só leitura, excepto sumários, presenças e planos das suas sessões", () => {
    expect(podeAceder("formador", "GET", "/v1/turmas")).toBe(true);
    expect(podeAceder("formador", "PUT", "/v1/turmas/gold/1/sessoes/2")).toBe(true);
    expect(podeAceder("formador", "PUT", "/v1/turmas/fin/1/avaliacao")).toBe(false);
    expect(podeAceder("formador", "PATCH", "/v1/turmas-gold/3")).toBe(false);
    expect(podeAceder("formador", "PATCH", "/v1/turmas-fin/3")).toBe(false);
    expect(podeAceder("formador", "PUT", "/v1/turmas/gold/1/certificados/9")).toBe(false);
    expect(podeAceder("formador", "POST", "/v1/catalog/locais")).toBe(false);
    expect(podeAceder("formador", "POST", "/v1/formandos-gold")).toBe(false);
    expect(podeAceder("formador", "GET", "/v1/painel/gold")).toBe(false);
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

  it("definições sem segredos fora do admin; formador e comercial só vêem o que lhes cabe", async () => {
    const ctx = await arrancar();
    await ctx.db.query(
      `INSERT INTO app_settings (id, values) VALUES ('gold', $1::jsonb)
       ON CONFLICT (id) DO UPDATE SET values = EXCLUDED.values`,
      [{ "Chave webhook pagamentos": "segredo-123", "Prazo de pagamento": "5" }],
    );
    const sec = (await pedido(ctx, "secretaria", "GET", "/v1/settings")).json();
    expect(JSON.stringify(sec.settings)).not.toContain("segredo-123");
    expect(sec.settings.gold["Prazo de pagamento"]).toBe("5");
    const adm = (await pedido(ctx, "admin", "GET", "/v1/settings")).json();
    expect(adm.settings.gold["Chave webhook pagamentos"]).toBe("segredo-123");
    expect((await pedido(ctx, "formador", "GET", "/v1/pagamentos")).statusCode).toBe(403);
    expect((await pedido(ctx, "formador", "GET", "/v1/crm/leads")).statusCode).toBe(403);
    const turmasForm = (await pedido(ctx, "formador", "GET", "/v1/turmas?regime=gold")).json();
    expect(turmasForm.linhas ?? []).toEqual([]);
    await ctx.db.query(
      `INSERT INTO formadores (id, nome, nif, custo_hora, regimes, estado) VALUES (9101, 'Formadora Teste', '123456789', 25, '["gold"]'::jsonb, 'Ativo')`,
    );
    // O comercial só vende: não vê formadores (nem a lista nem a ficha).
    expect((await pedido(ctx, "comercial", "GET", "/v1/formadores?regime=gold")).statusCode).toBe(403);
    expect((await pedido(ctx, "comercial", "GET", "/v1/formadores/9101")).statusCode).toBe(403);
    const fichaSec = (await pedido(ctx, "secretaria", "GET", "/v1/formadores/9101")).json();
    expect(fichaSec.formador.nif).toBe("123456789");
    expect(fichaSec.formador.custoHora).toBe(25);
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

  it("cron sem CRON_SECRET é recusado, mesmo com o cabeçalho do Vercel", async () => {
    const ctx = await arrancar();
    const res = await ctx.app.inject({ method: "GET", url: "/v1/cron/email", headers: { "x-vercel-cron": "1" } });
    expect(res.statusCode).toBe(503);
  });
});
