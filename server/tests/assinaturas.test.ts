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

let serie = 0;

/** Certificado (forge) com o nome dado, emitido por `emissor` ou auto-assinado. */
async function certificado(nome: string, ca: boolean, emissor?: { chave: import("node-forge").pki.rsa.PrivateKey; cert: import("node-forge").pki.Certificate }) {
  const forge = (await import("node-forge")).default;
  const { generateKeyPairSync } = await import("node:crypto");
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const chave = forge.pki.privateKeyFromPem(privateKey.export({ type: "pkcs1", format: "pem" }).toString()) as forge.pki.rsa.PrivateKey;
  const cert = forge.pki.createCertificate();
  cert.publicKey = forge.pki.setRsaPublicKey(chave.n, chave.e);
  cert.serialNumber = (0x0a1b2c + ++serie).toString(16).padStart(6, "0");
  cert.validity.notBefore = new Date(Date.now() - 86_400_000);
  cert.validity.notAfter = new Date(Date.now() + 86_400_000 * 365);
  cert.setSubject([{ shortName: "CN", value: nome }, { shortName: "C", value: "PT" }]);
  cert.setIssuer(emissor ? emissor.cert.subject.attributes : cert.subject.attributes);
  cert.setExtensions(ca
    ? [{ name: "basicConstraints", cA: true, critical: true }, { name: "keyUsage", keyCertSign: true, cRLSign: true, critical: true }]
    : [{ name: "basicConstraints", cA: false }, { name: "keyUsage", digitalSignature: true, nonRepudiation: true, critical: true }]);
  cert.sign(emissor?.chave ?? chave, forge.md.sha256.create());
  return { forge, chave, cert };
}

/** Uma PKI de teste: raiz → EC intermédia. A raiz só é âncora quando o teste a passa. */
let pkiTeste: Promise<{ raiz: import("node:crypto").X509Certificate; ec: Awaited<ReturnType<typeof certificado>> }> | null = null;
function pki() {
  pkiTeste ??= (async () => {
    const raiz = await certificado("Raiz de Teste", true);
    const ec = await certificado("EC de Assinatura de Teste", true, raiz);
    const { X509Certificate } = await import("node:crypto");
    return { raiz: new X509Certificate(raiz.forge.pki.certificateToPem(raiz.cert)), ec };
  })();
  return pkiTeste;
}

/**
 * Acrescenta ao original uma actualização incremental (objecto /Sig, tabela de referências e trailer com /Prev)
 * e um CMS destacado sobre o ByteRange (o que a app faz).
 */
async function assinarIncremental(original: Buffer, nome: string, autoAssinado = false) {
  const { ec } = await pki();
  const { forge, chave, cert } = await certificado(nome, false, autoAssinado ? undefined : ec);
  const n = (x: number) => String(x).padStart(10, "0");
  const ultimo = (re: RegExp) => [...original.toString("latin1").matchAll(re)].at(-1)![1]!;
  const num = Number(ultimo(/\/Size\s+(\d+)/g));
  const HEX = 16384;
  const cabeca = `\n${num} 0 obj\n<< /Type /Sig /Filter /Adobe.PPKLite /SubFilter /adbe.pkcs7.detached /ByteRange [`;
  const meio = "] /Contents ";
  const b = original.length + cabeca.length + `0 ${n(0)} ${n(0)} ${n(0)}`.length + meio.length;
  const c = b + HEX + 2;
  const fecho = " >>\nendobj\n";
  const cauda = `${fecho}xref\n0 1\n0000000000 65535 f \n${num} 1\n${n(original.length + 1)} 00000 n \n`
    + `trailer\n<< /Size ${num + 1} /Root ${ultimo(/\/Root\s+(\d+\s+\d+\s+R)/g)} /Prev ${ultimo(/startxref\s+(\d+)/g)} >>\n`
    + `startxref\n${c + fecho.length}\n%%EOF\n`;
  const intervalo = `0 ${n(b)} ${n(c)} ${n(cauda.length)}`;
  const antes = Buffer.concat([original, Buffer.from(cabeca + intervalo + meio, "latin1")]);
  const depois = Buffer.from(cauda, "latin1");
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(Buffer.concat([antes, depois]).toString("binary"));
  p7.addCertificate(cert);
  if (!autoAssinado) p7.addCertificate(ec.cert);
  p7.addSigner({
    key: chave, certificate: cert, digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [{ type: forge.pki.oids.contentType, value: forge.pki.oids.data }, { type: forge.pki.oids.messageDigest }],
  });
  p7.sign({ detached: true });
  const der = Buffer.from(forge.asn1.toDer(p7.toAsn1()).getBytes(), "binary").toString("hex");
  return Buffer.concat([antes, Buffer.from(`<${der.padEnd(HEX, "0")}>`, "latin1"), depois]);
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

  it("CC/CMD: só aceita assinatura criptográfica válida do signatário, sobre o original, com o código", async () => {
    const ctx = await arrancar();
    const contratoId = await novoContrato(ctx);
    const a = (await pedido(ctx, "secretaria", "POST", `/v1/crm/contratos/${contratoId}/assinatura`, {})).json().assinatura;
    const token = "c".repeat(40);
    await tokenConhecido(ctx, a.id, token);
    const original = (await pedido(ctx, null, "GET", `/v1/public/assinar/${token}/pdf`)).rawPayload;
    // Cada pedido com um IP próprio: o limite das rotas públicas é por IP.
    let ip = 0;
    const enviar = (bytes: Buffer, codigo?: string) => {
      const fronteira = "----gesforma";
      const campo = codigo === undefined ? "" : `--${fronteira}\r\nContent-Disposition: form-data; name="codigo"\r\n\r\n${codigo}\r\n`;
      const corpo = Buffer.concat([
        Buffer.from(`${campo}--${fronteira}\r\nContent-Disposition: form-data; name="file"; filename="a.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
        bytes,
        Buffer.from(`\r\n--${fronteira}--\r\n`),
      ]);
      return ctx.app.inject({
        method: "POST", url: `/v1/public/assinar/${token}/externo`, payload: corpo, remoteAddress: `10.9.0.${++ip}`,
        headers: { "content-type": `multipart/form-data; boundary=${fronteira}` },
      });
    };
    const assinado = await assinarIncremental(original, "Hotel Miradouro Douro");
    // A raiz de teste só é âncora nas chamadas directas; pela rota, as âncoras são as do Estado.
    const { raiz } = await pki();
    const publico = await import("../src/assinaturas/publico.js");
    const directo = (bytes: Buffer, codigo: string) => publico.receberAssinadoExterno(ctx.db, token, bytes, codigo, {}, [raiz]);

    // Sem o código de confirmação não se aceita, mesmo com assinatura válida.
    const semCodigo = await enviar(assinado);
    expect(semCodigo.statusCode).toBe(400);
    expect(semCodigo.json().error).toMatch(/código/);
    await expect(directo(assinado, "123456")).rejects.toThrow(/Peça um código/);

    expect((await ctx.app.inject({ method: "POST", url: `/v1/public/assinar/${token}/codigo`, remoteAddress: "10.9.1.1" })).statusCode).toBe(200);
    await codigoConhecido(ctx, a.id, "112233");

    expect((await enviar(original, "112233")).statusCode).toBe(400);
    const alterado = Buffer.from(original);
    alterado[200] = alterado[200] === 0x41 ? 0x42 : 0x41;
    const r = await enviar(Buffer.concat([alterado, Buffer.from("\n1 0 obj << /Type /Sig /ByteRange [0 1 2 3] >> endobj\n")]), "112233");
    expect(r.statusCode).toBe(400);
    expect(r.json().error).toMatch(/não é o documento enviado/);

    // Original intacto com um marcador /Sig /ByteRange falso: antes passava sem titular.
    const falso = await enviar(Buffer.concat([original, Buffer.from("\n1 0 obj << /Type /Sig /ByteRange [0 1 2 3] /Contents <00> >> endobj\n")]), "112233");
    expect(falso.statusCode).toBe(400);
    expect(falso.json().error).toMatch(/não é válida/);

    // Certificado auto-assinado com o nome certo, e a cadeia de teste sem ser âncora (a rota usa as do Estado).
    const auto = await enviar(await assinarIncremental(original, "Hotel Miradouro Douro", true), "112233");
    expect(auto.statusCode).toBe(400);
    expect(auto.json().error).toBe("O PDF não foi assinado com Cartão de Cidadão ou Chave Móvel Digital.");
    expect((await enviar(assinado, "112233")).json().error).toBe("O PDF não foi assinado com Cartão de Cidadão ou Chave Móvel Digital.");
    await expect(directo(await assinarIncremental(original, "Hotel Miradouro Douro", true), "112233")).rejects.toThrow(/Cartão de Cidadão ou Chave Móvel/);

    // Bytes mudados depois de assinar: o digest já não confere.
    const mexido = Buffer.from(assinado);
    mexido[mexido.length - 8] = 0x58;
    await expect(directo(mexido, "112233")).rejects.toThrow(/não é válida/);

    // Assinatura válida mas de outra pessoa.
    await expect(directo(await assinarIncremental(original, "Joaquim Antunes"), "112233")).rejects.toThrow(/não corresponde/);

    const ok = await directo(assinado, "112233");
    expect(ok.estado).toBe("assinado");
    const v = await pedido(ctx, null, "GET", `/v1/public/verificar/${ok.codigoVerificacao}`);
    expect(v.json().assinaturaExterna).toEqual({ titular: "Hotel Miradouro Douro" });
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
