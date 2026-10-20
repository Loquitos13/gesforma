import { decryptField, decryptJson, encryptField, encryptJson } from "./fieldCrypto.js";

export type PreinscricaoPii = {
  nif?: string;
  moradaFiscal?: string;
  codigoPostal?: string;
  telf?: string;
};

/** Identificadores pessoais do formando da Financiada para o financiamento (ver src/partilhado/execucaoFisica.ts). */
export type IdentificacaoFin = {
  nif?: string;
  niss?: string;
  dataNascimento?: string;
  codigoPostal?: string;
  protecaoInternacional?: string;
  autorizacaoResidencia?: string;
  tipoAutorizacaoResidencia?: string;
  passaporte?: string;
};

export type FormandoPii = {
  telf?: string;
  docs?: Record<string, unknown>;
  /** Só a Financiada: NIF, NISS, data de nascimento, código postal e documentos de estrangeiro. */
  ident?: IdentificacaoFin;
};

function rowStr(v: unknown) {
  return String(v ?? "").trim();
}

/** Lê PII de pré-inscrição (cifra ou colunas legadas). */
export function readPreinscricaoPii(row: Record<string, unknown>): PreinscricaoPii {
  const enc = rowStr(row.pii_enc);
  if (enc) {
    const j = decryptJson<PreinscricaoPii>(enc);
    if (j) return j;
  }
  return {
    nif: rowStr(row.nif),
    moradaFiscal: rowStr(row.morada_fiscal),
    codigoPostal: rowStr(row.codigo_postal),
    telf: rowStr(row.telf),
  };
}

/** Grava PII cifrada; devolve colunas SQL (texto legado vazio quando há cifra). */
export function writePreinscricaoPii(input: PreinscricaoPii) {
  const nif = rowStr(input.nif).replace(/\s/g, "");
  const morada = rowStr(input.moradaFiscal);
  const cp = rowStr(input.codigoPostal);
  const telf = rowStr(input.telf);
  const has = nif || morada || cp || telf;
  if (!has) {
    return { nif: "", morada_fiscal: "", codigo_postal: "", telf: "", pii_enc: null as string | null };
  }
  return {
    nif: "",
    morada_fiscal: "",
    codigo_postal: "",
    telf: "",
    pii_enc: encryptJson({ nif, moradaFiscal: morada, codigoPostal: cp, telf }),
  };
}

export function readFormandoPii(row: Record<string, unknown>): FormandoPii {
  const enc = rowStr(row.pii_enc);
  if (enc) {
    const j = decryptJson<FormandoPii>(enc);
    if (j) return j;
  }
  return { telf: rowStr(row.telf), docs: undefined };
}

export function writeFormandoPiiPatch(input: Partial<FormandoPii>, prev?: FormandoPii) {
  const ident = input.ident !== undefined ? input.ident : prev?.ident;
  const identLimpo = ident ? Object.fromEntries(Object.entries(ident).map(([k, v]) => [k, rowStr(v)]).filter(([, v]) => v)) as IdentificacaoFin : undefined;
  const merged: FormandoPii = {
    telf: input.telf !== undefined ? rowStr(input.telf) : rowStr(prev?.telf),
    docs: input.docs !== undefined ? input.docs : prev?.docs,
    ...(identLimpo && Object.keys(identLimpo).length ? { ident: identLimpo } : {}),
  };
  const has = merged.telf || merged.docs || merged.ident;
  if (!has) return { telf: "", pii_enc: null as string | null };
  return { telf: "", pii_enc: encryptJson(merged) };
}

export function readFormandoDocs(row: Record<string, unknown>) {
  const docsEnc = rowStr(row.docs_enc);
  if (docsEnc) {
    const j = decryptJson<Record<string, unknown>>(docsEnc);
    if (j) return j;
  }
  const raw = row.docs;
  if (raw && typeof raw === "object") return raw as Record<string, unknown>;
  if (typeof raw === "string") {
    try { return JSON.parse(raw) as Record<string, unknown>; } catch { return {}; }
  }
  return {};
}

export function writeFormandoDocs(docs: Record<string, unknown>) {
  if (!Object.keys(docs).length) return { docs: {} as Record<string, unknown>, docs_enc: null as string | null };
  return { docs: {} as Record<string, unknown>, docs_enc: encryptJson(docs) };
}

export function readDriveSecret(stored: string) {
  if (!stored) return "";
  if (stored.startsWith("v1:")) return decryptField(stored);
  return stored;
}

export function writeDriveSecret(plain: string) {
  if (!plain.trim()) return "";
  return encryptField(plain);
}
