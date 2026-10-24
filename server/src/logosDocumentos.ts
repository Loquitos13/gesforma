import { createHash } from "node:crypto";
import type { Consulta } from "./repos/sql.js";
import * as repo from "./repos/logosDocumentos.js";
import { bytesDe, LOGO_MAX_BYTES, LogoErro, mimeLogo } from "./entidadeLogo.js";

/**
 * Logótipos do rodapé dos documentos da Financiada: o da DGERT (Configurações › Entidade) e o de cada programa
 * (Edição de cursos › Programas). As mesmas regras do logótipo da entidade: PNG ou JPG até 1 MB.
 */

export const CHAVE_DGERT = "dgert";
export const chavePrograma = (id: number) => `programa:${id}`;

export async function obterLogoDocumento(db: Consulta, chave: string): Promise<{ bytes: Buffer; mime: string } | null> {
  const r = await repo.lerLogo(db, chave);
  if (!r) return null;
  const bytes = bytesDe(r.bytes);
  return bytes.length ? { bytes, mime: r.mime } : null;
}

export async function infoLogoDocumento(db: Consulta, chave: string) {
  const r = await repo.infoLogo(db, chave);
  return r ? { nome: r.nome, mime: r.mime, versao: r.hash.slice(0, 12), actualizado: r.updated_at, tamanho: r.tamanho } : null;
}

export async function guardarLogoDocumento(db: Consulta, chave: string, file: { nome: string; bytes: Buffer }) {
  if (!file.bytes.length) throw new LogoErro("O ficheiro está vazio.");
  if (file.bytes.length > LOGO_MAX_BYTES) throw new LogoErro("O logótipo passa de 1 MB.");
  const mime = mimeLogo(file.bytes);
  if (!mime) throw new LogoErro("Use uma imagem PNG ou JPG.");
  const ext = mime === "image/png" ? "png" : "jpg";
  const base = file.nome.replace(/\.[^.]+$/, "").replace(/[^\w\- ()]/g, "").trim().slice(0, 120) || "logotipo";
  const hash = createHash("sha256").update(file.bytes).digest("hex");
  await repo.gravarLogo(db, chave, { nome: `${base}.${ext}`, mime, bytes: file.bytes, hash });
  return infoLogoDocumento(db, chave);
}

export async function apagarLogoDocumento(db: Consulta, chave: string) {
  await repo.apagarLogo(db, chave);
}
