// PKI de teste para assinaturas PDF externas (CC/CMD): raiz → EC intermédia → certificado do signatário.
let serie = 0;

/** Certificado (forge) com o nome dado, emitido por `emissor` ou auto-assinado. */
export async function certificado(nome: string, ca: boolean, emissor?: { chave: import("node-forge").pki.rsa.PrivateKey; cert: import("node-forge").pki.Certificate }) {
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
export function pki() {
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
export async function assinarIncremental(original: Buffer, nome: string, autoAssinado = false) {
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

