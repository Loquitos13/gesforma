import { describe, expect, it } from "vitest";
import { arrancar, pedido, type Ctx } from "./helpers.js";

// PNG 1×1 transparente: chega para a assinatura desenhada.
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

async function hashes() {
  const { hashToken, hashCodigo } = await import("../src/assinaturas/comum.js");
  return { hashToken, hashCodigo };
}

async function novoContrato(ctx: Ctx, perfil: "secretaria" | "comercial" = "secretaria") {
  const cli = await pedido(ctx, perfil, "POST", "/v1/crm/clientes", { nome: "Hotel Miradouro Douro", email: "geral@miradouro.example", nif: "509876543" });
  expect(cli.statusCode).toBe(200);
  const clienteId = cli.json().cliente?.id ?? cli.json().id;
  const k = await pedido(ctx, perfil, "POST", "/v1/crm/contratos", {
    clienteNome: "Hotel Miradouro Douro", clienteEmail: "geral@miradouro.example", curso: "HACCP", valor: 380, clienteId,
    corpo: "Entre a entidade e {{cliente}}, NIF {{nif}}.\n\nCurso: {{curso}} por {{valor}}.",
  });
  expect(k.statusCode).toBe(200);
  return k.json().contrato.id as number;
}

/** Troca o token do pedido por um conhecido (o real só existe no email). */
async function tokenConhecido(ctx: Ctx, assinaturaId: number, token: string) {
  const { hashToken } = await hashes();
  await ctx.db.query("UPDATE contrato_assinaturas SET token_hash = $2 WHERE id = $1", [assinaturaId, hashToken(token)]);
}

async function codigoConhecido(ctx: Ctx, assinaturaId: number, codigo: string) {
  const { hashCodigo } = await hashes();
  await ctx.db.query(
    "UPDATE assinatura_codigos SET codigo_hash = $2 WHERE id = (SELECT max(id) FROM assinatura_codigos WHERE assinatura_id = $1)",
    [assinaturaId, hashCodigo(assinaturaId, codigo)],
  );
}

describe("assinatura de contratos", () => {
  it("envia, abre, confirma o código, assina e verifica (com selo)", async () => {
    const ctx = await arrancar();
    expect((await pedido(ctx, "secretaria", "POST", "/v1/assinaturas/selo/gerar")).statusCode).toBe(403);
    const gerar = await pedido(ctx, "admin", "POST", "/v1/assinaturas/selo/gerar");
    expect(gerar.statusCode).toBe(200);
    expect(gerar.json().selo.autoAssinado).toBe(true);

    const contratoId = await novoContrato(ctx);
    const env = await pedido(ctx, "secretaria", "POST", `/v1/crm/contratos/${contratoId}/assinatura`, {});
    expect(env.statusCode).toBe(200);
    const a = env.json().assinatura;
    expect(a.estado).toBe("enviado");
    expect(a.nif).toBe("••••••543");
    expect(a.hashOriginal).toMatch(/^[0-9a-f]{64}$/);
    const k = await pedido(ctx, "secretaria", "GET", `/v1/crm/contratos/${contratoId}`);
    expect(k.json().contrato.estado).toBe("Por assinar");

    const token = "t".repeat(40);
    await tokenConhecido(ctx, a.id, token);
    const ver = await pedido(ctx, null, "GET", `/v1/public/assinar/${token}`);
    expect(ver.statusCode).toBe(200);
    expect(ver.json().estado).toBe("aberto");
    expect(ver.json().signatario.email).not.toContain("geral@");
    expect(JSON.stringify(ver.json())).not.toContain("509876543");

    const orig = await pedido(ctx, null, "GET", `/v1/public/assinar/${token}/pdf`);
    expect(orig.statusCode).toBe(200);
    expect(orig.rawPayload.subarray(0, 5).toString()).toBe("%PDF-");

    expect((await pedido(ctx, null, "POST", `/v1/public/assinar/${token}/codigo`)).statusCode).toBe(200);
    expect((await pedido(ctx, null, "POST", `/v1/public/assinar/${token}/codigo`)).statusCode).toBe(429);
    await codigoConhecido(ctx, a.id, "246810");

    // Cinco tentativas erradas gastam o código.
    for (let i = 1; i <= 5; i++) {
      const r = await pedido(ctx, null, "POST", `/v1/public/assinar/${token}/assinar`, { metodo: "escrita", nomeEscrito: "Hotel Miradouro", codigo: "000000", aceito: true });
      expect(r.statusCode).toBe(400);
    }
    const bloqueado = await pedido(ctx, null, "POST", `/v1/public/assinar/${token}/assinar`, { metodo: "escrita", nomeEscrito: "Hotel Miradouro", codigo: "246810", aceito: true });
    expect(bloqueado.statusCode).toBe(400);

    await ctx.db.query("UPDATE assinatura_codigos SET criado_em = now() - interval '2 minutes' WHERE assinatura_id = $1", [a.id]);
    expect((await pedido(ctx, null, "POST", `/v1/public/assinar/${token}/codigo`)).statusCode).toBe(200);
    await codigoConhecido(ctx, a.id, "135790");
    const ok = await pedido(ctx, null, "POST", `/v1/public/assinar/${token}/assinar`, { metodo: "desenhada", imagem: PNG, codigo: "135790", aceito: true });
    expect(ok.statusCode).toBe(200);
    const fim = ok.json();
    expect(fim.estado).toBe("assinado");
    expect(fim.hashFinal).not.toBe(a.hashOriginal);

    // Não se assina duas vezes.
    expect((await pedido(ctx, null, "POST", `/v1/public/assinar/${token}/codigo`)).statusCode).toBe(410);

    const pdf = await pedido(ctx, "secretaria", "GET", `/v1/assinaturas/${a.id}/pdf?versao=assinado`);
    expect(pdf.statusCode).toBe(200);
    const corpo = pdf.rawPayload.toString("latin1");
    expect(corpo).toContain("/ByteRange");
    const { PDFDocument } = await import("pdf-lib");
    const paginas = async (b: Buffer) => (await PDFDocument.load(b)).getPageCount();
    // O assinado tem mais uma página: o certificado de assinatura.
    expect(await paginas(pdf.rawPayload)).toBe((await paginas(orig.rawPayload)) + 1);
    const { createHash } = await import("node:crypto");
    expect(createHash("sha256").update(pdf.rawPayload).digest("hex")).toBe(fim.hashFinal);

    const v = await pedido(ctx, null, "GET", `/v1/public/verificar/${fim.codigoVerificacao}`);
    expect(v.statusCode).toBe(200);
    expect(v.json().estado).toBe("assinado");
    expect(v.json().hashFinal).toBe(fim.hashFinal);
    expect(v.json().signatario.nif).toBe("••••••543");
    expect(v.json().selo?.fingerprint).toBeTruthy();

    const det = await pedido(ctx, "secretaria", "GET", `/v1/assinaturas/${a.id}`);
    const tipos = det.json().assinatura.eventos.map((e: { tipo: string }) => e.tipo);
    expect(tipos).toEqual(expect.arrayContaining(["enviado", "aberto", "codigo_enviado", "codigo_errado", "codigo_confirmado", "assinado"]));
    expect((await pedido(ctx, "secretaria", "GET", `/v1/crm/contratos/${contratoId}`)).json().contrato.estado).toBe("Assinado");
  });

  it("CC/CMD: recusa PDF sem assinatura ou alterado", async () => {
    const ctx = await arrancar();
    const contratoId = await novoContrato(ctx);
    const a = (await pedido(ctx, "secretaria", "POST", `/v1/crm/contratos/${contratoId}/assinatura`, {})).json().assinatura;
    const token = "c".repeat(40);
    await tokenConhecido(ctx, a.id, token);
    const original = (await pedido(ctx, null, "GET", `/v1/public/assinar/${token}/pdf`)).rawPayload;
    const enviar = (bytes: Buffer) => {
      const fronteira = "----gesforma";
      const corpo = Buffer.concat([
        Buffer.from(`--${fronteira}\r\nContent-Disposition: form-data; name="file"; filename="a.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
        bytes,
        Buffer.from(`\r\n--${fronteira}--\r\n`),
      ]);
      return ctx.app.inject({
        method: "POST", url: `/v1/public/assinar/${token}/externo`, payload: corpo,
        headers: { "content-type": `multipart/form-data; boundary=${fronteira}` },
      });
    };
    const semAssinatura = await enviar(original);
    expect(semAssinatura.statusCode).toBe(400);
    const alterado = Buffer.from(original);
    alterado[200] = alterado[200] === 0x41 ? 0x42 : 0x41;
    const r = await enviar(Buffer.concat([alterado, Buffer.from("\n1 0 obj << /Type /Sig /ByteRange [0 1 2 3] >> endobj\n")]));
    expect(r.statusCode).toBe(400);
    expect(r.json().error).toMatch(/não é o documento enviado/);
  });

  it("expira, cancela e respeita perfis", async () => {
    const ctx = await arrancar();
    const contratoId = await novoContrato(ctx);
    const a = (await pedido(ctx, "secretaria", "POST", `/v1/crm/contratos/${contratoId}/assinatura`, {})).json().assinatura;
    const token = "e".repeat(40);
    await tokenConhecido(ctx, a.id, token);

    expect((await pedido(ctx, "formador", "GET", `/v1/assinaturas/${a.id}`)).statusCode).toBe(403);
    // O comercial não vê contratos da secretaria (RLS dos contratos).
    expect((await pedido(ctx, "comercial", "GET", `/v1/assinaturas/${a.id}`)).statusCode).toBe(404);
    expect((await pedido(ctx, "comercial", "POST", `/v1/crm/contratos/${contratoId}/assinatura`, {})).statusCode).toBe(404);
    expect((await pedido(ctx, "comercial", "GET", "/v1/assinaturas/selo")).statusCode).toBe(403);

    await ctx.db.query("UPDATE contrato_assinaturas SET expira_em = now() - interval '1 minute' WHERE id = $1", [a.id]);
    expect((await pedido(ctx, null, "GET", `/v1/public/assinar/${token}`)).json().estado).toBe("expirado");
    expect((await pedido(ctx, null, "POST", `/v1/public/assinar/${token}/codigo`)).statusCode).toBe(410);

    const re = await pedido(ctx, "secretaria", "POST", `/v1/assinaturas/${a.id}/reenviar`, {});
    expect(re.statusCode).toBe(200);
    expect(re.json().assinatura.estado).toBe("enviado");
    // O token antigo deixa de servir.
    expect((await pedido(ctx, null, "GET", `/v1/public/assinar/${token}`)).statusCode).toBe(404);

    const can = await pedido(ctx, "secretaria", "POST", `/v1/assinaturas/${a.id}/cancelar`, { motivo: "Valor errado" });
    expect(can.statusCode).toBe(200);
    expect(can.json().assinatura.estado).toBe("cancelado");
    expect((await pedido(ctx, "secretaria", "GET", `/v1/crm/contratos/${contratoId}`)).json().contrato.estado).toBe("Rascunho");
    expect((await pedido(ctx, "secretaria", "POST", `/v1/assinaturas/${a.id}/reenviar`, {})).statusCode).toBe(409);
  });

  it("contrato de formação a partir da ficha do formando, com NIF indicado no envio", async () => {
    const ctx = await arrancar();
    const id = (await ctx.db.query<{ id: number }>("SELECT nextval('ops_id_seq')::int AS id")).rows[0]!.id;
    await ctx.db.query(
      "INSERT INTO formandos_gold (id, nome, apelido, email, curso) VALUES ($1, 'Rita', 'Sousa', 'rita.sousa@exemplo.pt', 'Formação de Formadores - CCP')",
      [id],
    );
    const modelo = await pedido(ctx, "secretaria", "POST", "/v1/crm/modelos/contrato", { nome: "Contrato CCP", corpo: "Contrato de {{nome}} ({{nif}}) para {{curso}}." });
    expect(modelo.statusCode).toBe(200);
    const novo = await pedido(ctx, "secretaria", "POST", `/v1/formandos/gold/${id}/contratos`, { templateId: modelo.json().modelo.id });
    expect(novo.statusCode).toBe(200);
    const contratoId = novo.json().contratoId as number;
    expect(novo.json().contratos[0].estado).toBe("Rascunho");

    const semNif = await pedido(ctx, "secretaria", "POST", `/v1/crm/contratos/${contratoId}/assinatura`, {});
    expect(semNif.statusCode).toBe(409);
    expect(semNif.json().error).toMatch(/NIF/);
    const comNif = await pedido(ctx, "secretaria", "POST", `/v1/crm/contratos/${contratoId}/assinatura`, { nif: "123456789" });
    expect(comNif.statusCode).toBe(200);
    expect(comNif.json().assinatura.nifOrigem).toBe("equipa");
    expect(comNif.json().assinatura.signatarioEmail).toBe("rita.sousa@exemplo.pt");

    const lista = await pedido(ctx, "secretaria", "GET", `/v1/formandos/gold/${id}/contratos`);
    expect(lista.json().contratos[0].assinaturaEstado).toBe("enviado");
    expect((await pedido(ctx, "financiada", "GET", `/v1/formandos/gold/${id}/contratos`)).statusCode).toBe(403);
  });
});
