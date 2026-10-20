import { describe, expect, it } from "vitest";
import forge from "node-forge";
import { X509Certificate, generateKeyPairSync } from "node:crypto";
import { PDFArray, PDFCrossRefStream, PDFDocument, PDFName, PDFRef, StandardFonts, type PDFObject } from "pdf-lib";
import { pdflibAddPlaceholder } from "@signpdf/placeholder-pdf-lib";
import { SignPdf } from "@signpdf/signpdf";
import { Signer } from "@signpdf/utils";
import { arrancar, pedido, type Ctx } from "./helpers.js";

// ─── PKI de teste: raiz (âncora só nas chamadas directas) → EC → titular ─────────────────────────

type Par = { chave: forge.pki.rsa.PrivateKey; cert: forge.pki.Certificate };
let serie = 0;
function certificado(nome: string, ca: boolean, emissor?: Par, serialNumber?: string): Par {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const chave = forge.pki.privateKeyFromPem(privateKey.export({ type: "pkcs1", format: "pem" }).toString()) as forge.pki.rsa.PrivateKey;
  const cert = forge.pki.createCertificate();
  cert.publicKey = forge.pki.setRsaPublicKey(chave.n, chave.e);
  cert.serialNumber = (0x3c4d5e + ++serie).toString(16).padStart(6, "0");
  cert.validity.notBefore = new Date(Date.now() - 86_400_000);
  cert.validity.notAfter = new Date(Date.now() + 86_400_000 * 365);
  cert.setSubject([
    { shortName: "CN", value: nome }, { shortName: "C", value: "PT" },
    ...(serialNumber ? [{ name: "serialNumber", value: serialNumber }] : []),
  ]);
  cert.setIssuer(emissor ? emissor.cert.subject.attributes : cert.subject.attributes);
  cert.setExtensions(ca
    ? [{ name: "basicConstraints", cA: true, critical: true }, { name: "keyUsage", keyCertSign: true, cRLSign: true, critical: true }]
    : [{ name: "basicConstraints", cA: false }, { name: "keyUsage", digitalSignature: true, nonRepudiation: true, critical: true }]);
  cert.sign(emissor?.chave ?? chave, forge.md.sha256.create());
  return { chave, cert };
}

let pkiTeste: { raiz: X509Certificate; ec: Par } | null = null;
function pki() {
  if (!pkiTeste) {
    const raiz = certificado("Raiz de Teste", true);
    pkiTeste = { raiz: new X509Certificate(forge.pki.certificateToPem(raiz.cert)), ec: certificado("EC de Assinatura de Teste", true, raiz) };
  }
  return pkiTeste;
}

class TitularSigner extends Signer {
  constructor(private titular: Par, private ec: Par) {
    super();
  }

  async sign(pdf: Buffer): Promise<Buffer> {
    const p7 = forge.pkcs7.createSignedData();
    p7.content = forge.util.createBuffer(pdf.toString("binary"));
    p7.addCertificate(this.titular.cert);
    p7.addCertificate(this.ec.cert);
    p7.addSigner({
      key: this.titular.chave, certificate: this.titular.cert, digestAlgorithm: forge.pki.oids.sha256,
      authenticatedAttributes: [{ type: forge.pki.oids.contentType, value: forge.pki.oids.data }, { type: forge.pki.oids.messageDigest }],
    });
    p7.sign({ detached: true });
    return Buffer.from(forge.asn1.toDer(p7.toAsn1()).getBytes(), "binary");
  }
}

// ─── Actualização incremental como a da app Autenticação.gov ──────────────────────────────────────

const bytesDe = (o: PDFObject) => {
  const b = new Uint8Array(o.sizeInBytes());
  o.copyBytesInto(b, 0);
  return Buffer.from(b);
};
const ultimo = (pdf: Buffer, re: RegExp) => [...pdf.toString("latin1").matchAll(re)].at(-1)![1]!;

/** Escreve, a seguir a `base`, os objectos de `doc` novos ou diferentes de `base`, com tabela de referências e trailer. */
async function revisaoIncremental(base: Buffer, doc: PDFDocument, extra = "", comoStream = false) {
  const antes = (await PDFDocument.load(base, { updateMetadata: false })).context;
  const mudados = doc.context.enumerateIndirectObjects()
    .filter(([r, o]) => { const v = antes.lookup(r); return !v || !bytesDe(v).equals(bytesDe(o)); })
    .sort(([a], [b]) => a.objectNumber - b.objectNumber);
  const partes: Buffer[] = [];
  let pos = base.length;
  const linhas: string[] = [];
  const posicoes: [PDFRef, number][] = [];
  for (const [r, o] of mudados) {
    posicoes.push([r, pos + 1]);
    const cab = Buffer.from(`\n${r.objectNumber} ${r.generationNumber} obj\n`, "latin1");
    linhas.push(`${r.objectNumber} 1\n${String(pos + 1).padStart(10, "0")} ${String(r.generationNumber).padStart(5, "0")} n \n`);
    const corpo = Buffer.concat([cab, bytesDe(o), Buffer.from("\nendobj", "latin1")]);
    partes.push(corpo);
    pos += corpo.length;
  }
  const raiz = doc.context.trailerInfo.Root as PDFRef;
  const info = doc.context.trailerInfo.Info as PDFRef | undefined;
  const tamanho = doc.context.largestObjectNumber + 1;
  if (comoStream) {
    // Tabela de referências num stream (/Type /XRef), como fazem alguns programas.
    const prev = Number(ultimo(base, /startxref\s+(\d+)/g));
    const xs = PDFCrossRefStream.create(doc.context.obj({ Type: "XRef", Size: tamanho + 1, Root: raiz, Prev: prev, ...(info ? { Info: info } : {}) }));
    for (const [r, p] of posicoes) xs.addUncompressedEntry(r, p);
    xs.addUncompressedEntry(PDFRef.of(tamanho), pos + 1);
    const fimStream = Buffer.concat([
      Buffer.from(`\n${tamanho} 0 obj\n`, "latin1"), bytesDe(xs), Buffer.from(`\nendobj\nstartxref\n${pos + 1}\n%%EOF\n`, "latin1"),
    ]);
    return Buffer.concat([base, ...partes, fimStream]);
  }
  const fim = `\nxref\n0 1\n0000000000 65535 f \n${linhas.join("")}trailer\n<< /Size ${tamanho} /Root ${raiz.toString()}${info ? ` /Info ${info.toString()}` : ""}`
    + ` /Prev ${ultimo(base, /startxref\s+(\d+)/g)}${extra} >>\nstartxref\n${pos + 1}\n%%EOF\n`;
  return Buffer.concat([base, ...partes, Buffer.from(fim, "latin1")]);
}

/**
 * Assina como a app: carrega o original, acrescenta o campo de assinatura (widget visível, /Sig, /AcroForm e
 * /Annots da página, com @signpdf/placeholder-pdf-lib), escreve só o que mudou numa revisão e assina o ByteRange.
 * `mexer` corre antes do campo de assinatura, na mesma revisão (o ataque).
 */
async function revisaoComCampo(original: Buffer, nome: string, mexer?: (doc: PDFDocument) => void | Promise<void>, comoStream = false) {
  const doc = await PDFDocument.load(original);
  await mexer?.(doc);
  pdflibAddPlaceholder({
    pdfDoc: doc, reason: "Assinatura com Cartão de Cidadão", contactInfo: "", name: nome, location: "Portugal",
    signatureLength: 8192, widgetRect: [60, 60, 260, 120],
  });
  return revisaoIncremental(original, doc, "", comoStream);
}

async function assinarComoApp(original: Buffer, nome: string, mexer?: (doc: PDFDocument) => void | Promise<void>, serialNumber?: string) {
  const { ec } = pki();
  const comCampo = await revisaoComCampo(original, nome, mexer);
  return new SignPdf().sign(comCampo, new TitularSigner(certificado(nome, false, ec, serialNumber), ec));
}

/** O (primeiro) stream de conteúdo da 1.ª página: /Contents é uma referência ou um array delas. */
function primeiroConteudo(doc: PDFDocument) {
  const c = doc.getPages()[0]!.node.get(PDFName.of("Contents"));
  return c instanceof PDFArray ? (c.get(0) as PDFRef) : (c as PDFRef);
}

async function originalDeTeste() {
  const { gerarPdfContrato } = await import("../src/assinaturas/pdf.js");
  return gerarPdfContrato({
    titulo: "Contrato de formação · HACCP", texto: "Entre a entidade e Maria da Silva.\n\nCurso: HACCP por € 380,00.",
    cabecalho: { entidade: "Entidade de Teste", linhaEntidade: "NIF 500000000" }, referencia: "Contrato n.º 1 · TESTE",
  });
}

async function validar(original: Buffer, assinado: Buffer) {
  const { validarAssinadoExterno } = await import("../src/assinaturas/selar.js");
  return validarAssinadoExterno(original, assinado, [pki().raiz]);
}

const ALTERADO = /alterado antes de ser assinado/;

describe("assinatura CC/CMD: o PDF não pode mudar antes de assinar", () => {
  it("aceita a revisão da assinatura (widget visível, /AcroForm, /Annots, /Info) e lê o serialNumber", async () => {
    const original = await originalDeTeste();
    const assinado = await assinarComoApp(original, "Maria Antónia da Silva", undefined, "IDCPT-12345678");
    const r = await validar(original, assinado);
    expect(r.titular).toBe("Maria Antónia da Silva");
    expect(r.serie).toBe("IDCPT-12345678");
  });

  it("aceita /DSS no catálogo (validação longa) na mesma revisão", async () => {
    const original = await originalDeTeste();
    const assinado = await assinarComoApp(original, "Maria da Silva", doc => {
      doc.catalog.set(PDFName.of("DSS"), doc.context.register(doc.context.obj({ Certs: [], OCSPs: [], CRLs: [] })));
    });
    await expect(validar(original, assinado)).resolves.toMatchObject({ titular: "Maria da Silva" });
  });

  it("recusa texto acrescentado à página antes de assinar", async () => {
    const original = await originalDeTeste();
    const assinado = await assinarComoApp(original, "Maria da Silva", async doc => {
      const fonte = await doc.embedFont(StandardFonts.Helvetica);
      doc.getPages()[0]!.drawText("Valor: 1,00 EUR", { x: 72, y: 600, size: 12, font: fonte });
    });
    await expect(validar(original, assinado)).rejects.toThrow(ALTERADO);
  });

  it("recusa o stream de conteúdo do original substituído (mesmo número de objecto)", async () => {
    const original = await originalDeTeste();
    const assinado = await assinarComoApp(original, "Maria da Silva", doc => {
      doc.context.assign(primeiroConteudo(doc), doc.context.flateStream("BT /F1 12 Tf 72 700 Td (Curso: HACCP por 1 EUR) Tj ET"));
    });
    await expect(validar(original, assinado)).rejects.toThrow(ALTERADO);
  });

  it("recusa uma página nova, uma anotação que não é assinatura e uma acção ao abrir", async () => {
    const original = await originalDeTeste();
    const novaPagina = await assinarComoApp(original, "Maria da Silva", doc => { doc.addPage(); });
    await expect(validar(original, novaPagina)).rejects.toThrow(ALTERADO);

    const anotacao = await assinarComoApp(original, "Maria da Silva", doc => {
      const pagina = doc.getPages()[0]!;
      const nota = doc.context.register(doc.context.obj({
        Type: "Annot", Subtype: "FreeText", Rect: [60, 400, 400, 430], Contents: "Valor: 1 EUR", DA: "/Helv 12 Tf 0 g",
      }));
      pagina.node.set(PDFName.of("Annots"), doc.context.obj([nota]));
    });
    await expect(validar(original, anotacao)).rejects.toThrow(ALTERADO);

    const accao = await assinarComoApp(original, "Maria da Silva", doc => {
      doc.catalog.set(PDFName.of("OpenAction"), doc.context.obj({ S: "JavaScript", JS: "app.alert(1)" }));
    });
    await expect(validar(original, accao)).rejects.toThrow(ALTERADO);
  });

  it("recusa duas revisões (alteração numa, assinatura na seguinte)", async () => {
    const original = await originalDeTeste();
    const doc = await PDFDocument.load(original);
    const fonte = await doc.embedFont(StandardFonts.Helvetica);
    doc.getPages()[0]!.drawText("Valor: 1,00 EUR", { x: 72, y: 600, size: 12, font: fonte });
    const alterado = await revisaoIncremental(original, doc);
    const assinado = await assinarComoApp(alterado, "Maria da Silva");
    await expect(validar(original, assinado)).rejects.toThrow(ALTERADO);
  });

  it("lê a revisão pela tabela de referências: remoções e posições falsas são recusadas", async () => {
    const { verificarRevisaoAssinatura } = await import("../src/assinaturas/revisao.js");
    const original = await originalDeTeste();
    const comCampo = await revisaoComCampo(original, "Maria da Silva");
    await expect(verificarRevisaoAssinatura(original, comCampo)).resolves.toBeUndefined();

    // O stream de conteúdo da página marcado como livre (removido) na tabela da revisão.
    const doc = await PDFDocument.load(original);
    const conteudo = primeiroConteudo(doc);
    const texto = comCampo.toString("latin1");
    const cabeca = "xref\n0 1\n0000000000 65535 f \n";
    const livre = texto.replace(cabeca, `${cabeca}${conteudo.objectNumber} 1\n0000000000 00001 f \n`);
    expect(livre).not.toBe(texto);
    await expect(verificarRevisaoAssinatura(original, Buffer.from(livre, "latin1"))).rejects.toThrow(/removido/);

    // A mesma revisão com a tabela num stream /XRef; e, aí, o conteúdo da página trocado.
    await expect(verificarRevisaoAssinatura(original, await revisaoComCampo(original, "Maria da Silva", undefined, true))).resolves.toBeUndefined();
    const trocado = await revisaoComCampo(original, "Maria da Silva", d => {
      d.context.assign(primeiroConteudo(d), d.context.flateStream("BT /F1 12 Tf 72 700 Td (1 EUR) Tj ET"));
    }, true);
    await expect(verificarRevisaoAssinatura(original, trocado)).rejects.toThrow(/alterado/);

    // Uma entrada da tabela a apontar para o original (fora da revisão).
    const fora = texto.replace(/(xref\n0 1\n0000000000 65535 f \n\d+ 1\n)\d{10}/, "$10000000009");
    await expect(verificarRevisaoAssinatura(original, Buffer.from(fora, "latin1"))).rejects.toThrow(/fora da revisão/);
  });
});

// ─── Nome do titular ──────────────────────────────────────────────────────────────────────────────

describe("nome do titular do CC/CMD", () => {
  it("ignora partículas e exige o primeiro nome e os restantes nomes da ficha, pela ordem", async () => {
    const { nomeCorresponde } = await import("../src/assinaturas/publico.js");
    expect(nomeCorresponde("Maria da Silva", "João da Silva")).toBe(false);
    expect(nomeCorresponde("Maria da Silva", "MARIA ANTÓNIA PEREIRA DA SILVA")).toBe(true);
    expect(nomeCorresponde("Maria Silva", "Maria Santos")).toBe(false);
    expect(nomeCorresponde("Maria Silva Santos", "Maria Santos Silva")).toBe(false);
    expect(nomeCorresponde("José Gonçalves", "Jose Goncalves")).toBe(true);
    expect(nomeCorresponde("Ana", "Ana Sousa")).toBe(false);
    expect(nomeCorresponde("da Silva", "Maria da Silva")).toBe(false);
  });

  async function pedidoDe(ctx: Ctx, nome: string, nif: string) {
    const cli = await pedido(ctx, "secretaria", "POST", "/v1/crm/clientes", { nome, email: "maria.silva@exemplo.pt", nif });
    expect(cli.statusCode).toBe(200);
    const clienteId = cli.json().cliente?.id ?? cli.json().id;
    const k = await pedido(ctx, "secretaria", "POST", "/v1/crm/contratos", {
      clienteNome: nome, clienteEmail: "maria.silva@exemplo.pt", curso: "HACCP", valor: 380, clienteId, corpo: "Contrato de {{nome}}.",
    });
    const a = (await pedido(ctx, "secretaria", "POST", `/v1/crm/contratos/${k.json().contrato.id}/assinatura`, {})).json().assinatura;
    const token = `m${String(a.id).padStart(39, "x")}`;
    const { hashToken, hashCodigo } = await import("../src/assinaturas/comum.js");
    await ctx.db.query("UPDATE contrato_assinaturas SET token_hash = $2 WHERE id = $1", [a.id, hashToken(token)]);
    const original = (await pedido(ctx, null, "GET", `/v1/public/assinar/${token}/pdf`)).rawPayload;
    await ctx.app.inject({ method: "POST", url: `/v1/public/assinar/${token}/codigo`, remoteAddress: `10.8.${a.id % 250}.1` });
    await ctx.db.query(
      "UPDATE assinatura_codigos SET codigo_hash = $2 WHERE id = (SELECT max(id) FROM assinatura_codigos WHERE assinatura_id = $1)",
      [a.id, hashCodigo(a.id, "424242")],
    );
    const publico = await import("../src/assinaturas/publico.js");
    const enviar = (pdf: Buffer) => publico.receberAssinadoExterno(ctx.db, token, pdf, "424242", {}, [pki().raiz]);
    return { a, original, enviar };
  }

  it("«João da Silva» não assina por «Maria da Silva»; o titular com mais apelidos assina e o n.º fica mascarado", async () => {
    const ctx = await arrancar();
    const { a, original, enviar } = await pedidoDe(ctx, "Maria da Silva", "245678901");
    await expect(enviar(await assinarComoApp(original, "João da Silva"))).rejects.toThrow(/não corresponde/);
    // PDF alterado antes de assinar: recusado e o motivo fica no registo.
    const mexido = await assinarComoApp(original, "Maria da Silva", doc => { doc.addPage(); });
    await expect(enviar(mexido)).rejects.toThrow(ALTERADO);
    const ok = await enviar(await assinarComoApp(original, "Maria Antónia Pereira da Silva", undefined, "IDCPT-12345678"));
    expect(ok.estado).toBe("assinado");
    const eventos = (await pedido(ctx, "secretaria", "GET", `/v1/assinaturas/${a.id}`)).json().assinatura.eventos as { tipo: string; detalhe: Record<string, unknown> }[];
    const externos = eventos.filter(e => e.tipo === "externo");
    expect(externos.some(e => typeof e.detalhe.motivo === "string" && /página alterada|objecto/.test(e.detalhe.motivo))).toBe(true);
    expect(externos.at(-1)!.detalhe.serie).toBe("IDCPT-•••••678");
  });

  it("um NIF no certificado (TINPT-) decide: o nome deixa de chegar", async () => {
    const ctx = await arrancar();
    const { original, enviar } = await pedidoDe(ctx, "Maria da Silva", "245678902");
    await expect(enviar(await assinarComoApp(original, "Maria da Silva", undefined, "TINPT-299999999"))).rejects.toThrow(/não corresponde/);
    const ok = await enviar(await assinarComoApp(original, "M. Silva", undefined, "TINPT-245678902"));
    expect(ok.estado).toBe("assinado");
  });
});

// ─── Email/NIF do signatário diferentes entre envios ─────────────────────────────────────────────

describe("dados do signatário", () => {
  it("regista quando o email ou o NIF mudam entre pedidos do mesmo contrato", async () => {
    const ctx = await arrancar();
    const id = (await ctx.db.query<{ id: number }>("SELECT nextval('ops_id_seq')::int AS id")).rows[0]!.id;
    await ctx.db.query(
      "INSERT INTO formandos_gold (id, nome, apelido, email, curso) VALUES ($1, 'Rui', 'Matos', 'rui.matos@exemplo.pt', 'HACCP')",
      [id],
    );
    const modelo = await pedido(ctx, "secretaria", "POST", "/v1/crm/modelos/contrato", { nome: "Contrato HACCP", corpo: "Contrato de {{nome}} ({{nif}})." });
    const contratoId = (await pedido(ctx, "secretaria", "POST", `/v1/formandos/gold/${id}/contratos`, { templateId: modelo.json().modelo.id })).json().contratoId as number;

    const primeiro = await pedido(ctx, "secretaria", "POST", `/v1/crm/contratos/${contratoId}/assinatura`, { nif: "123456789" });
    expect(primeiro.statusCode).toBe(200);
    expect(primeiro.json().assinatura.eventos.map((e: { tipo: string }) => e.tipo)).not.toContain("signatario_alterado");

    // Mesmo signatário: nada a registar.
    const igual = await pedido(ctx, "secretaria", "POST", `/v1/crm/contratos/${contratoId}/assinatura`, { nif: "123456789" });
    expect(igual.json().assinatura.eventos.map((e: { tipo: string }) => e.tipo)).not.toContain("signatario_alterado");

    await ctx.db.query("UPDATE formandos_gold SET email = 'outro.email@exemplo.pt' WHERE id = $1", [id]);
    const novo = await pedido(ctx, "secretaria", "POST", `/v1/crm/contratos/${contratoId}/assinatura`, { nif: "987654321" });
    expect(novo.statusCode).toBe(200);
    const ev = (novo.json().assinatura.eventos as { tipo: string; rotulo: string; detalhe: Record<string, unknown> }[]).find(e => e.tipo === "signatario_alterado");
    expect(ev?.rotulo).toMatch(/Email ou NIF do signatário/);
    expect(ev?.detalhe).toMatchObject({
      assinaturaAnterior: igual.json().assinatura.id, emailAnterior: "rui.matos@exemplo.pt", email: "outro.email@exemplo.pt",
      nifAnterior: "••••••789", nif: "••••••321", nifOrigem: "equipa",
    });
    expect(JSON.stringify(ev)).not.toContain("123456789");
  });
});
