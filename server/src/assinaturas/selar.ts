/**
 * Selo da entidade no PDF (assinatura digital PDF, PKCS#7 destacada com SHA-256) e a verificação
 * de PDF assinados fora do GesForma (Cartão de Cidadão ou Chave Móvel Digital, na app Autenticação.gov).
 */
import { X509Certificate, createHash, verify as cryptoVerify } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { pdflibAddPlaceholder } from "@signpdf/placeholder-pdf-lib";
import { SignPdf } from "@signpdf/signpdf";
import { Signer } from "@signpdf/utils";
import forge from "node-forge";
import { PDFDocument } from "pdf-lib";
import { RevisaoInvalida, verificarRevisaoAssinatura } from "./revisao.js";

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

const SEM_ASSINATURA = "O PDF não tem assinatura digital. Assine-o na app Autenticação.gov com o Cartão de Cidadão ou a Chave Móvel Digital.";
const INVALIDA = "A assinatura digital do PDF não é válida, ou o documento foi alterado depois de assinado. Assine de novo o PDF original.";
const DIGESTS: Record<string, string> = {
  "1.3.14.3.2.26": "sha1", "2.16.840.1.101.3.4.2.1": "sha256", "2.16.840.1.101.3.4.2.2": "sha384", "2.16.840.1.101.3.4.2.3": "sha512",
};
const OID_SIGNED_DATA = "1.2.840.113549.1.7.2";
const OID_MESSAGE_DIGEST = "1.2.840.113549.1.9.4";

type No = forge.asn1.Asn1;
const filhos = (n: No | undefined) => (Array.isArray(n?.value) ? n.value as No[] : []);
const oid = (n: No | undefined) => (typeof n?.value === "string" ? forge.asn1.derToOid(n.value) : "");
const bytes = (n: No | undefined) => Buffer.from(typeof n?.value === "string" ? n.value : "", "binary");
const daDer = (n: No) => Buffer.from(forge.asn1.toDer(n).getBytes(), "binary");
const semZeros = (hex: string) => hex.toUpperCase().replace(/^0+/, "");
const cn = (nome: string) => /^CN=(.*)$/m.exec(nome)?.[1]?.trim() ?? "";
// serialNumber do titular (OID 2.5.4.5): no CC/CMD é o número de identificação civil ("BI…"/"IDCPT-…"), não o NIF.
const serialDoTitular = (nome: string) => /^serialNumber=(.*)$/m.exec(nome)?.[1]?.trim() ?? "";
// Os bytes têm de se manter tal e qual: sem decompor BIT STRINGs (os tipos do forge não têm estas opções).
const lerDer = forge.asn1.fromDer as unknown as (b: forge.util.ByteStringBuffer, o: { parseAllBytes: boolean; decodeBitStrings: boolean }) => No;

const NAO_CC = "O PDF não foi assinado com Cartão de Cidadão ou Chave Móvel Digital.";
const OID_KEY_USAGE = "2.5.29.15";

/**
 * ECs qualificadas do Cartão de Cidadão e da CMD em vigor, tal como estão na Lista de Confiança portuguesa
 * (origem e impressões digitais em confianca/README.md). Lidas uma vez, no primeiro PDF externo.
 */
let ancorasEstado: X509Certificate[] | null = null;
export function ancorasDoEstado() {
  if (!ancorasEstado) {
    const pasta = fileURLToPath(new URL("./confianca/", import.meta.url));
    ancorasEstado = readdirSync(pasta).filter(f => f.endsWith(".pem")).map(f => new X509Certificate(readFileSync(pasta + f)));
  }
  return ancorasEstado;
}

/** Bits do keyUsage (1.º byte: 0x80 digitalSignature, 0x40 nonRepudiation); null se o certificado não o tiver. */
function usoDaChave(cert: No) {
  const extensoes = filhos(filhos(filhos(cert)[0]).find(n => n.tagClass === forge.asn1.Class.CONTEXT_SPECIFIC && n.type === 3));
  const ext = filhos(extensoes[0]).find(e => oid(filhos(e)[0]) === OID_KEY_USAGE);
  if (!ext) return null;
  const bits = bytes(lerDer(forge.util.createBuffer(bytes(filhos(ext).at(-1)).toString("binary")), { parseAllBytes: true, decodeBitStrings: false }));
  return bits[1] ?? 0;
}

const emVigor = (x: X509Certificate, agora: Date) => new Date(x.validFrom) <= agora && agora <= new Date(x.validTo);

/**
 * Sobe do certificado do signatário até uma âncora, usando os intermédios do próprio CMS: cada um emitido e
 * assinado pelo seguinte, todos em vigor agora (o signingTime do CMS é declarado por quem assina), emissores com
 * basicConstraints CA e o do signatário com keyUsage de assinatura.
 * shortcut: sem OCSP/CRL, um certificado revogado mas ainda no prazo passa; subir quando for preciso validar a revogação.
 */
function cadeiaConfiavel(signatario: X509Certificate, usoSignatario: number | null, outros: X509Certificate[], ancoras: X509Certificate[]) {
  const agora = new Date();
  if (usoSignatario === null || !(usoSignatario & 0xc0)) return false;
  let atual = signatario;
  for (let nivel = 0; nivel < 6; nivel++) {
    if (!emVigor(atual, agora)) return false;
    const emitido = (por: X509Certificate) => por.ca && emVigor(por, agora) && atual.checkIssued(por) && atual.verify(por.publicKey);
    if (ancoras.some(emitido)) return true;
    const proximo = outros.find(c => c !== atual && emitido(c));
    if (!proximo) return false;
    atual = proximo;
  }
  return false;
}

/**
 * Verifica a última assinatura acrescentada ao original (PAdES, CMS destacado): o ByteRange cobre o ficheiro
 * todo menos o /Contents, o messageDigest dos atributos assinados é o dos bytes cobertos, a assinatura sobre
 * esses atributos confere com a chave do certificado do signatário e esse certificado vem de uma EC do Estado.
 * Recusa PDF com dados acrescentados depois da assinatura (PAdES-LTV).
 */
function verificarAssinatura(original: Buffer, pdf: Buffer, ancoras: X509Certificate[]) {
  const acrescento = pdf.subarray(original.length).toString("latin1");
  const m = [...acrescento.matchAll(/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g)].at(-1);
  if (!m || !/\/(Type\s*\/Sig|FT\s*\/Sig)\b/.test(acrescento)) throw new PdfExternoErro(SEM_ASSINATURA);
  const [a, b, c, d] = m.slice(1).map(Number) as [number, number, number, number];
  if (a !== 0 || b < original.length || c <= b + 2 || c + d !== pdf.length || pdf[b] !== 0x3c || pdf[c - 1] !== 0x3e) throw new PdfExternoErro(INVALIDA);
  const hex = pdf.subarray(b + 1, c - 1).toString("latin1");
  if (hex.length % 2 || !/^[0-9a-fA-F]*$/.test(hex)) throw new PdfExternoErro(INVALIDA);

  // O /Contents vem com zeros a seguir ao CMS.
  const cms = lerDer(forge.util.createBuffer(Buffer.from(hex, "hex").toString("binary")), { parseAllBytes: false, decodeBitStrings: false });
  if (oid(filhos(cms)[0]) !== OID_SIGNED_DATA) throw new PdfExternoErro(INVALIDA);
  const sd = filhos(filhos(filhos(cms)[1])[0]);
  const certs = filhos(sd.find(n => n.tagClass === forge.asn1.Class.CONTEXT_SPECIFIC && n.type === 0));
  const si = filhos(filhos(sd.at(-1))[0]);
  const atributos = si[3]?.tagClass === forge.asn1.Class.CONTEXT_SPECIFIC && si[3].type === 0 ? si[3] : null;
  const algoritmo = DIGESTS[oid(filhos(si[2])[0])];
  if (!atributos || !algoritmo) throw new PdfExternoErro(INVALIDA);

  const coberto = Buffer.concat([pdf.subarray(0, b), pdf.subarray(c, c + d)]);
  const md = filhos(atributos).find(at => oid(filhos(at)[0]) === OID_MESSAGE_DIGEST);
  if (!md || !bytes(filhos(filhos(md)[1])[0]).equals(createHash(algoritmo).update(coberto).digest())) throw new PdfExternoErro(INVALIDA);

  // O certificado do signatário (emissor e número de série) e a assinatura sobre os atributos, codificados como SET.
  const serie = semZeros(bytes(filhos(si[1])[1]).toString("hex"));
  const lidos = certs.map(no => ({ no, x: new X509Certificate(daDer(no)) }));
  const meu = lidos.find(c => semZeros(c.x.serialNumber) === serie);
  if (!meu) throw new PdfExternoErro(INVALIDA);
  const cert = meu.x;
  const assinados = daDer(forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SET, true, filhos(atributos)));
  if (!cryptoVerify(algoritmo, assinados, cert.publicKey, bytes(si[5]))) throw new PdfExternoErro(INVALIDA);
  if (!cadeiaConfiavel(cert, usoDaChave(meu.no), lidos.map(c => c.x), ancoras)) throw new PdfExternoErro(NAO_CC);
  return { titular: cn(cert.subject), emissor: cn(cert.issuer), serie: serialDoTitular(cert.subject) };
}

const ALTERADO = "O PDF foi alterado antes de ser assinado: só se aceita o documento enviado com a assinatura acrescentada. Descarregue o original de novo e assine-o sem o editar.";

export type AssinaturaExterna = { titular: string; emissor: string; serie: string };

/**
 * Confirma que o PDF devolvido foi assinado fora (CC/CMD) sobre o documento enviado: tem de começar
 * exactamente pelos bytes do original (assinatura incremental), a assinatura tem de ser válida e ter titular, e a
 * revisão acrescentada só pode trazer a assinatura (revisao.ts: nada de texto ou páginas mudados antes de assinar).
 * `ancoras` só muda nos testes (uma EC de teste); em produção são as do Estado.
 */
export async function validarAssinadoExterno(original: Buffer, recebido: Buffer, ancoras = ancorasDoEstado()): Promise<AssinaturaExterna> {
  if (recebido.subarray(0, 5).toString("latin1") !== "%PDF-") throw new PdfExternoErro("O ficheiro não é um PDF.");
  if (recebido.length <= original.length || !recebido.subarray(0, original.length).equals(original)) {
    throw new PdfExternoErro("Este PDF não é o documento enviado, ou foi alterado antes de assinar. Descarregue o original de novo e assine-o sem o editar.");
  }
  let cert: AssinaturaExterna;
  try {
    cert = verificarAssinatura(original, recebido, ancoras);
  } catch (err) {
    if (err instanceof PdfExternoErro) throw err;
    throw new PdfExternoErro(INVALIDA);
  }
  try {
    await verificarRevisaoAssinatura(original, recebido);
  } catch (err) {
    throw new PdfExternoErro(ALTERADO, { cause: err instanceof RevisaoInvalida ? err.message : "PDF ilegível" });
  }
  if (!cert.titular) throw new PdfExternoErro("Não foi possível ler o nome do titular no certificado da assinatura.");
  return cert;
}
