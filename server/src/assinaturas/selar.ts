/**
 * Selo da entidade no PDF (assinatura digital PDF, PKCS#7 destacada com SHA-256) e a verificação
 * de PDF assinados fora do GesForma (Cartão de Cidadão ou Chave Móvel Digital, na app Autenticação.gov).
 */
import { pdflibAddPlaceholder } from "@signpdf/placeholder-pdf-lib";
import { SignPdf } from "@signpdf/signpdf";
import { Signer, extractSignature } from "@signpdf/utils";
import forge from "node-forge";
import { PDFDocument } from "pdf-lib";

class SeloSigner extends Signer {
  constructor(private chave: forge.pki.rsa.PrivateKey, private cert: forge.pki.Certificate, private cadeia: forge.pki.Certificate[]) {
    super();
  }

  async sign(pdfBuffer: Buffer, signingTime?: Date): Promise<Buffer> {
    const p7 = forge.pkcs7.createSignedData();
    p7.content = forge.util.createBuffer(pdfBuffer.toString("binary"));
    for (const c of this.cadeia) p7.addCertificate(c);
    p7.addSigner({
      key: this.chave,
      certificate: this.cert,
      digestAlgorithm: forge.pki.oids.sha256,
      authenticatedAttributes: [
        { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
        { type: forge.pki.oids.signingTime, value: (signingTime ?? new Date()) as unknown as string },
        { type: forge.pki.oids.messageDigest },
      ],
    });
    p7.sign({ detached: true });
    return Buffer.from(forge.asn1.toDer(p7.toAsn1()).getBytes(), "binary");
  }
}

export type CertificadoSelo = { chave: forge.pki.rsa.PrivateKey; cert: forge.pki.Certificate; cadeia: forge.pki.Certificate[]; titular: string };

/** Aplica o selo: acrescenta o campo de assinatura e assina o PDF com o certificado da entidade. */
export async function selarPdf(pdf: Buffer, selo: CertificadoSelo, contacto: string) {
  const doc = await PDFDocument.load(pdf);
  pdflibAddPlaceholder({
    pdfDoc: doc,
    reason: "Selo da entidade: documento assinado no GesForma",
    contactInfo: contacto || "",
    name: selo.titular,
    location: "Portugal",
    signatureLength: 16384,
    appName: "GesForma",
  });
  const comCampo = Buffer.from(await doc.save({ useObjectStreams: false }));
  return new SignPdf().sign(comCampo, new SeloSigner(selo.chave, selo.cert, selo.cadeia));
}

export class PdfExternoErro extends Error {}

/**
 * Confirma que o PDF devolvido foi assinado fora (CC/CMD) sobre o documento enviado:
 * tem de começar exactamente pelos bytes do original (assinatura incremental) e conter uma assinatura.
 */
export function validarAssinadoExterno(original: Buffer, recebido: Buffer) {
  if (recebido.subarray(0, 5).toString("latin1") !== "%PDF-") throw new PdfExternoErro("O ficheiro não é um PDF.");
  if (recebido.length <= original.length || !recebido.subarray(0, original.length).equals(original)) {
    throw new PdfExternoErro("Este PDF não é o documento enviado, ou foi alterado antes de assinar. Descarregue o original de novo e assine-o sem o editar.");
  }
  const acrescento = recebido.subarray(original.length).toString("latin1");
  if (!/\/ByteRange\s*\[/.test(acrescento) || !/\/(Type\s*\/Sig|FT\s*\/Sig)\b/.test(acrescento)) {
    throw new PdfExternoErro("O PDF não tem assinatura digital. Assine-o na app Autenticação.gov com o Cartão de Cidadão ou a Chave Móvel Digital.");
  }
  let titular = "";
  let emissor = "";
  try {
    const { signature } = extractSignature(recebido);
    const p7 = forge.pkcs7.messageFromAsn1(forge.asn1.fromDer(forge.util.createBuffer(signature))) as forge.pkcs7.PkcsSignedData;
    const cert = p7.certificates?.[0];
    if (cert) {
      const cn = (attrs: forge.pki.CertificateField[]) => String(attrs.find(a => a.shortName === "CN")?.value ?? "");
      titular = cn(cert.subject.attributes);
      emissor = cn(cert.issuer.attributes);
    }
  } catch {
    // assinatura presente mas não legível aqui: fica registado sem titular
  }
  return { titular, emissor };
}
