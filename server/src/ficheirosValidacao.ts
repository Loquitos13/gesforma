import { config } from "./config.js";

/** Assinaturas (primeiros bytes) por extensão aceite nos uploads da equipa. */
const ASSINATURAS: Record<string, (b: Buffer) => boolean> = {
  pdf: b => b.subarray(0, 5).toString("latin1") === "%PDF-",
  jpg: b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  jpeg: b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  png: b => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  webp: b => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP",
  heic: b => b.subarray(4, 8).toString("latin1") === "ftyp" && /^(heic|heix|mif1|msf1|heim|heis)$/.test(b.subarray(8, 12).toString("latin1")),
  doc: b => b.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])),
  docx: zip,
  xlsx: zip,
  pptx: zip,
  odt: zip,
  mp4: b => b.subarray(4, 8).toString("latin1") === "ftyp",
  webm: b => b.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])),
};

function zip(b: Buffer) {
  return b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
}

/**
 * Valida um ficheiro enviado pela equipa: a extensão tem de estar na lista e os
 * primeiros bytes têm de corresponder a ela (o MIME do browser não conta).
 */
export function conteudoPermitido(name: string, bytes: Buffer): string | null {
  if (!bytes.length) return "ficheiro vazio";
  if (bytes.length > config.driveMaxBytes) return "ficheiro acima de 10 MB";
  const ext = (/\.([a-z0-9]+)$/i.exec(name)?.[1] ?? "").toLowerCase();
  const confere = ASSINATURAS[ext];
  if (!confere) return "Tipo de ficheiro recusado. Use PDF, Word, Excel, PowerPoint, ODT, imagem (JPG, PNG, WebP, HEIC) ou vídeo (MP4, WebM).";
  if (!confere(bytes)) return "O conteúdo do ficheiro não corresponde à extensão.";
  return null;
}

export function sanitizeFileName(name: string) {
  const base = name.replace(/[/\\]/g, "").replace(/[^\w.\- ()áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]+/g, "_").trim();
  return (base || "ficheiro").slice(0, 180);
}

/**
 * Nome que identifica o documento: «Cartão de Cidadão - Ana Silva.pdf» (o documento e a pessoa), com a extensão do
 * ficheiro enviado. Sem documento, fica o nome original.
 */
export function nomeIdentificado(original: string, documento: string, pessoa: string) {
  const doc = documento.trim();
  if (!doc) return original;
  const ext = (/\.([a-z0-9]{1,8})$/i.exec(original)?.[1] ?? "").toLowerCase();
  const base = [doc, pessoa.trim()].filter(Boolean).join(" - ").replace(/[/\\:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  return sanitizeFileName(`${base.slice(0, 160)}${ext ? `.${ext}` : ""}`);
}

/**
 * Ficheiros enviados por pessoas de fora (ligação pessoal, portal e área do formando):
 * só PDF, JPEG ou PNG, e o conteúdo tem de corresponder à extensão — o MIME do browser não chega.
 */
export function erroFicheiroPublico(name: string, bytes: Buffer): string | null {
  const ext = (/\.([a-z0-9]+)$/i.exec(name)?.[1] ?? "").toLowerCase();
  const b = bytes;
  const pdf = b.length > 4 && b.subarray(0, 5).toString("latin1") === "%PDF-";
  const jpg = b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const png = b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (!b.length) return "ficheiro vazio";
  if (b.length > config.driveMaxBytes) return "ficheiro acima de 10 MB";
  if (ext === "pdf" && pdf) return null;
  if ((ext === "jpg" || ext === "jpeg") && jpg) return null;
  if (ext === "png" && png) return null;
  return "Envie um PDF, JPG ou PNG. O ficheiro não corresponde ao formato indicado.";
}

/**
 * Documento carregado pela equipa na ficha: vale o conteúdo, não a extensão (fotos do telemóvel gravadas como «.jpg»
 * que são PNG ou WebP, «.jfif», sem extensão…). Devolve o nome com a extensão certa, ou o erro.
 */
export function ficheiroDeDocumentoDaEquipa(name: string, bytes: Buffer): { nome: string; mime: string } | { erro: string } {
  if (!bytes.length) return { erro: "ficheiro vazio" };
  if (bytes.length > config.driveMaxBytes) return { erro: "O ficheiro tem mais de 10 MB. Reduza-o (ou tire outra fotografia) e tente outra vez." };
  const ext = (["pdf", "jpg", "png", "webp"] as const).find(e => ASSINATURAS[e]!(bytes));
  if (!ext) {
    const heic = ASSINATURAS.heic!(bytes);
    return { erro: heic ? "Fotografia em HEIC (iPhone): exporte-a como JPG ou PDF e tente outra vez." : "Envie um PDF ou uma imagem (JPG, PNG ou WebP)." };
  }
  const base = name.replace(/\.[a-z0-9]{1,8}$/i, "") || "documento";
  const mime = { pdf: "application/pdf", jpg: "image/jpeg", png: "image/png", webp: "image/webp" }[ext];
  return { nome: `${base}.${ext}`, mime };
}

/**
 * Uploads: extensão aceite e conteúdo verificado. Ficheiros gerados pelo próprio
 * GesForma (`gerado`, ex.: o cronograma em HTML) só verificam o tamanho.
 */
export function assertUpload(name: string, bytes: Buffer, gerado = false) {
  if (gerado) {
    if (!bytes.length) throw new Error("ficheiro vazio");
    if (bytes.length > config.driveMaxBytes) throw new Error("ficheiro acima de 10 MB");
    return;
  }
  const erro = conteudoPermitido(name, bytes);
  if (erro) throw new Error(erro);
}

