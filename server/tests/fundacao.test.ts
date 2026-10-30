import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { arrancar, pedido } from "./helpers.js";

describe("camada base", () => {
  it("/v1/me devolve as capacidades do perfil", async () => {
    const ctx = await arrancar();
    const admin = (await pedido(ctx, "admin", "GET", "/v1/me")).json() as { pode: string[] };
    expect(admin.pode).toContain("sistema.admin");
    expect(admin.pode).toContain("pagamentos.confirmar");
    const comercial = (await pedido(ctx, "comercial", "GET", "/v1/me")).json() as { pode: string[] };
    expect(comercial.pode).toContain("crm.escrever");
    expect(comercial.pode).not.toContain("pagamentos.confirmar");
    expect(comercial.pode).not.toContain("fin.ver");
  });

  it("opções vêm da base de dados e o tipo é validado", async () => {
    const ctx = await arrancar();
    const origens = await pedido(ctx, "secretaria", "GET", "/v1/opcoes/lista?lista=origens");
    expect(origens.statusCode).toBe(200);
    const nomes = (origens.json() as { opcoes: { valor: string }[] }).opcoes.map(o => o.valor);
    expect(nomes).toContain("Instagram");
    const cursos = await pedido(ctx, "secretaria", "GET", "/v1/opcoes/cursos?regime=gold");
    expect(cursos.statusCode).toBe(200);
    expect(Array.isArray((cursos.json() as { opcoes: unknown[] }).opcoes)).toBe(true);
    const mau = await pedido(ctx, "secretaria", "GET", "/v1/opcoes/qualquer-coisa");
    expect(mau.statusCode).toBe(400);
    expect((await pedido(ctx, null, "GET", "/v1/opcoes/cursos")).statusCode).toBe(401);
  });

  it("avisos de configuração só para o admin", async () => {
    const ctx = await arrancar();
    const r = await pedido(ctx, "admin", "GET", "/v1/sistema/avisos");
    expect(r.statusCode).toBe(200);
    expect(Array.isArray((r.json() as { avisos: unknown[] }).avisos)).toBe(true);
    expect((await pedido(ctx, "secretaria", "GET", "/v1/sistema/avisos")).statusCode).toBe(403);
  });

  it("chaveiro: lê dados cifrados com a chave antiga e recifra-os", async () => {
    const ctx = await arrancar();
    const { config } = await import("../src/config.js");
    const { decryptJson } = await import("../src/fieldCrypto.js");
    const antigo = "segredo-antigo-de-teste-com-mais-de-32-caracteres";
    const chave = createHash("sha256").update(antigo).digest();
    const iv = randomBytes(12);
    const c = createCipheriv("aes-256-gcm", chave, iv);
    const enc = Buffer.concat([c.update(JSON.stringify({ nif: "123456789" }), "utf8"), c.final()]);
    const valor = `v1:${iv.toString("base64url")}:${c.getAuthTag().toString("base64url")}:${enc.toString("base64url")}`;

    const id = 990001;
    await ctx.db.query(
      "INSERT INTO preinscricoes (id, inscrito, nome, email, pii_enc) VALUES ($1, '2026-10-13', 'Teste', 'chave@exemplo.pt', $2)",
      [id, valor],
    );
    const antes = config.legacySessionSecret;
    config.legacySessionSecret = antigo;
    try {
      expect(decryptJson<{ nif: string }>(valor)?.nif).toBe("123456789");
      const r = await pedido(ctx, "admin", "POST", "/v1/sistema/recifrar");
      expect(r.statusCode).toBe(200);
      expect((r.json() as { total: number }).total).toBeGreaterThanOrEqual(1);
      const linha = await ctx.db.query<{ pii_enc: string }>("SELECT pii_enc FROM preinscricoes WHERE id = $1", [id]);
      expect(linha.rows[0]!.pii_enc).not.toBe(valor);
    } finally {
      config.legacySessionSecret = antes;
    }
    // Já sem a chave antiga, o valor recifrado continua legível.
    const linha = await ctx.db.query<{ pii_enc: string }>("SELECT pii_enc FROM preinscricoes WHERE id = $1", [id]);
    expect(decryptJson<{ nif: string }>(linha.rows[0]!.pii_enc)?.nif).toBe("123456789");
    await ctx.db.query("DELETE FROM preinscricoes WHERE id = $1", [id]);
  });

  it("chaveiro: a chave de cifra da instalação anterior (DATA_ENCRYPTION_KEY_LEGACY) só lê; sem ela o erro diz o que falta", async () => {
    const { config } = await import("../src/config.js");
    const { decryptField } = await import("../src/fieldCrypto.js");
    const antiga = randomBytes(32);
    const iv = randomBytes(12);
    const c = createCipheriv("aes-256-gcm", antiga, iv);
    const enc = Buffer.concat([c.update("PT50000201231234567890154", "utf8"), c.final()]);
    const valor = `v1:${iv.toString("base64url")}:${c.getAuthTag().toString("base64url")}:${enc.toString("base64url")}`;
    expect(() => decryptField(valor)).toThrow(/DATA_ENCRYPTION_KEY_LEGACY/);
    const antes = config.legacyDataEncryptionKeys;
    config.legacyDataEncryptionKeys = [antiga.toString("base64")];
    try {
      expect(decryptField(valor)).toBe("PT50000201231234567890154");
    } finally {
      config.legacyDataEncryptionKeys = antes;
    }
  });

  it("uploads: o conteúdo tem de corresponder à extensão", async () => {
    const { conteudoPermitido } = await import("../src/ficheirosValidacao.js");
    expect(conteudoPermitido("a.pdf", Buffer.from("%PDF-1.7 ..."))).toBeNull();
    expect(conteudoPermitido("a.pdf", Buffer.from("<html><script>x</script></html>"))).toMatch(/não corresponde/);
    expect(conteudoPermitido("a.html", Buffer.from("<html></html>"))).toMatch(/recusado/);
    const { mimeDosBytes } = await import("../src/cursoImagens.js");
    expect(mimeDosBytes(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("image/png");
    expect(mimeDosBytes(Buffer.from("<svg onload=alert(1)>"))).toBeNull();
  });

  it("respostas JSON levam CSP fechada", async () => {
    const ctx = await arrancar();
    const r = await pedido(ctx, "admin", "GET", "/v1/me");
    expect(String(r.headers["content-security-policy"])).toContain("default-src 'none'");
  });
});
