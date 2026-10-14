/**
 * Certificado do selo da ENA: PKCS#12 carregado pela administração ou gerado aqui (auto-assinado).
 * Fica cifrado na base de dados (secretBox). Sem certificado, a assinatura funciona sem selo.
 */
import { createHash, generateKeyPairSync, randomBytes } from "node:crypto";
import forge from "node-forge";
import type { Db } from "../db/pool.js";
import * as repo from "../repos/assinaturas.js";
import { openSecret, sealSecret } from "../secretBox.js";

export class SeloErro extends Error {}

export type InfoCertificado = {
  titular: string; emissor: string; fingerprint: string; validoDe: Date; validoAte: Date; autoAssinado: boolean;
};

function nomeComum(attrs: forge.pki.CertificateField[]) {
  const cn = attrs.find(a => a.shortName === "CN")?.value;
  const o = attrs.find(a => a.shortName === "O")?.value;
  return String(cn ?? o ?? "").trim();
}

/** Lê o PKCS#12 e confirma que tem uma chave privada e o certificado que lhe corresponde. */
export function lerP12(p12: Buffer, senha: string): InfoCertificado & { certDer: Buffer; chave: forge.pki.rsa.PrivateKey; cert: forge.pki.Certificate; cadeia: forge.pki.Certificate[] } {
  let pkcs12: forge.pkcs12.Pkcs12Pfx;
  try {
    pkcs12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(forge.util.createBuffer(p12.toString("binary"))), false, senha);
  } catch {
    throw new SeloErro("Não foi possível abrir o ficheiro. Confirme que é um .p12/.pfx e que a palavra-passe está certa.");
  }
  const chaves = [
    ...(pkcs12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ?? []),
    ...(pkcs12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ?? []),
  ];
  const chave = chaves.find(b => b.key)?.key as forge.pki.rsa.PrivateKey | undefined;
  if (!chave) throw new SeloErro("O ficheiro não tem chave privada.");
  const certs = (pkcs12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? []).map(b => b.cert).filter(Boolean) as forge.pki.Certificate[];
  const cert = certs.find(c => {
    const pub = c.publicKey as forge.pki.rsa.PublicKey;
    return pub.n?.compareTo(chave.n) === 0 && pub.e?.compareTo(chave.e) === 0;
  });
  if (!cert) throw new SeloErro("O certificado não corresponde à chave privada.");
  const der = Buffer.from(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes(), "binary");
  const titular = nomeComum(cert.subject.attributes);
  const emissor = nomeComum(cert.issuer.attributes);
  return {
    titular, emissor, certDer: der, chave, cert, cadeia: certs,
    fingerprint: createHash("sha256").update(der).digest("hex").toUpperCase().match(/.{2}/g)!.join(":"),
    validoDe: cert.validity.notBefore, validoAte: cert.validity.notAfter,
    autoAssinado: cert.isIssuer(cert),
  };
}

/** Gera um certificado auto-assinado "Selo ENA" (3 anos). Não está na lista de confiança da Adobe. */
export function gerarAutoAssinado(entidade: string) {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const chave = forge.pki.privateKeyFromPem(privateKey.export({ type: "pkcs1", format: "pem" }).toString());
  const pub = forge.pki.publicKeyFromPem(publicKey.export({ type: "spki", format: "pem" }).toString());
  const cert = forge.pki.createCertificate();
  cert.publicKey = pub;
  cert.serialNumber = `01${randomBytes(12).toString("hex")}`;
  const agora = new Date();
  cert.validity.notBefore = new Date(agora.getTime() - 60_000);
  cert.validity.notAfter = new Date(agora.getTime() + 3 * 365 * 24 * 3600_000);
  const nome = (entidade || "ENA").slice(0, 60);
  const attrs = [
    { name: "commonName", value: `Selo ${nome}` },
    { name: "organizationName", value: nome },
    { name: "countryName", value: "PT" },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([
    { name: "basicConstraints", cA: false },
    { name: "keyUsage", digitalSignature: true, nonRepudiation: true },
    { name: "extKeyUsage", emailProtection: true },
  ]);
  cert.sign(chave, forge.md.sha256.create());
  const senha = randomBytes(18).toString("base64url");
  const asn = forge.pkcs12.toPkcs12Asn1(chave, [cert], senha, { algorithm: "aes256", friendlyName: `Selo ${nome}` });
  return { p12: Buffer.from(forge.asn1.toDer(asn).getBytes(), "binary"), senha };
}

export async function guardarSelo(db: Db, p12: Buffer, senha: string) {
  const info = lerP12(p12, senha);
  if (info.validoAte.getTime() < Date.now()) throw new SeloErro("O certificado já expirou.");
  await repo.gravarSelo(db, {
    p12Enc: sealSecret(p12.toString("base64")), senhaEnc: sealSecret(senha), titular: info.titular, emissor: info.emissor,
    fingerprint: info.fingerprint, validoDe: info.validoDe, validoAte: info.validoAte, autoAssinado: info.autoAssinado,
  });
  return infoSelo(db);
}

/** Estado do selo para o ecrã das configurações (sem segredos). */
export async function infoSelo(db: Db) {
  const s = await repo.lerSelo(db);
  if (!s) return null;
  const expirado = s.validoAte ? new Date(s.validoAte).getTime() < Date.now() : false;
  return {
    titular: s.titular, emissor: s.emissor, fingerprint: s.fingerprint, validoDe: s.validoDe, validoAte: s.validoAte,
    autoAssinado: s.autoAssinado, actualizadoEm: s.actualizadoEm, expirado,
  };
}

/** Certificado pronto a selar (ou null: sem certificado, expirado ou ilegível). */
export async function seloParaAssinar(db: Db) {
  const s = await repo.lerSelo(db);
  if (!s) return null;
  try {
    const p12 = Buffer.from(openSecret(s.p12Enc), "base64");
    const senha = openSecret(s.senhaEnc);
    const info = lerP12(p12, senha);
    if (info.validoAte.getTime() < Date.now()) return null;
    return { p12, senha, info };
  } catch (err) {
    console.error(JSON.stringify({ msg: "selo ilegível", erro: err instanceof Error ? err.message : String(err) }));
    return null;
  }
}
