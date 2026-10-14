/** Peças comuns da assinatura: ligações, signatário, texto do contrato, emails e Drive. */
import { createHash, randomBytes, randomInt } from "node:crypto";
import { config } from "../config.js";
import type { Db } from "../db/pool.js";
import { nomePastaPessoa } from "../driveArvore.js";
import { storeDriveFile } from "../driveFicheiros.js";
import { renderAutomaticEmail } from "../emailHtml.js";
import { parseEmailXml } from "../emailXml.js";
import { obterLogoEntidade } from "../entidadeLogo.js";
import { driveCreds, ensureFolderPath, usableToken } from "../googleDrive.js";
import { sendMail } from "../mailer.js";
import { readPreinscricaoPii } from "../pii.js";
import { lerEntidade } from "../regrasConfig.js";
import * as repo from "../repos/assinaturas.js";
import { fillVars, isEmail, normalizeEmail } from "../security.js";
import type { Cabecalho } from "./pdf.js";

export class AssinaturaErro extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export const PRAZO_DIAS = 14;
export const CODIGO_MINUTOS = 10;
export const CODIGO_TENTATIVAS = 5;
export const CODIGOS_POR_HORA = 5;
export const CODIGO_INTERVALO_S = 60;

export const hashToken = (t: string) => createHash("sha256").update(`assinatura:${t}`).digest("hex");
export const hashCodigo = (id: number, codigo: string) => createHash("sha256").update(`assinatura-codigo:${id}:${codigo}`).digest("hex");

export function novoToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function novoCodigoVerificacao() {
  let s = "";
  for (let i = 0; i < 12; i++) s += ALFABETO[randomInt(ALFABETO.length)];
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
}

export const novoCodigoOtp = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

const origem = () => config.appOrigin.replace(/\/$/, "");
export const urlAssinar = (token: string) => `${origem()}/assinar/${token}`;
export const urlVerificar = (codigo: string) => `${origem()}/verificar/${codigo}`;

const FMT = new Intl.DateTimeFormat("pt-PT", { timeZone: "Europe/Lisbon", dateStyle: "short", timeStyle: "short" });
const FMT_DIA = new Intl.DateTimeFormat("pt-PT", { timeZone: "Europe/Lisbon", dateStyle: "long" });
export const dataHora = (d: Date | string | null) => (d ? FMT.format(new Date(d)) : "");
export const dataLonga = (d: Date | string) => FMT_DIA.format(new Date(d));

export const NIF_RE = /^\d{9}$/;
export function mascararNif(nif: string) {
  return nif ? `${"•".repeat(Math.max(0, nif.length - 3))}${nif.slice(-3)}` : "";
}
export function mascararEmail(email: string) {
  const [u, d] = email.split("@");
  if (!u || !d) return "";
  return `${u.slice(0, 2)}${"•".repeat(Math.max(1, u.length - 2))}@${d}`;
}

export type Signatario = {
  nome: string; email: string; nif: string; nifOrigem: "ficha" | "equipa";
  formando: { regime: "gold" | "fin"; id: number; turmaId: number | null; turma: string } | null;
  clienteId: number | null;
};

type Contrato = NonNullable<Awaited<ReturnType<typeof repo.contratoParaAssinar>>>;

/** Nome, email e NIF vêm sempre da ficha (formando ou cliente) no momento do envio. */
export async function resolverSignatario(db: Db, k: Contrato, nifIndicado?: string): Promise<Signatario> {
  let nome = k.cliente_nome;
  let email = k.cliente_email;
  let nif = "";
  let formando: Signatario["formando"] = null;
  if (k.formando_regime && k.formando_id) {
    const regime = k.formando_regime as "gold" | "fin";
    const f = await repo.formandoSignatario(db, regime, k.formando_id);
    if (!f) throw new AssinaturaErro("O formando deste contrato já não existe.", 409);
    nome = `${f.nome} ${f.apelido}`.trim();
    email = f.email;
    const pre = f.email ? await repo.preinscricaoComNif(db, regime, f.email, f.curso) : null;
    nif = pre ? String(readPreinscricaoPii(pre).nif ?? "") : "";
    formando = { regime, id: f.id, turmaId: f.turma_id ?? null, turma: f.turma };
  } else if (k.cliente_id) {
    const c = await repo.clienteSignatario(db, k.cliente_id);
    if (c) {
      nome = c.nome || nome;
      email = c.email || email;
      nif = c.nif;
    }
  }
  nif = nif.replace(/\s/g, "");
  let nifOrigem: Signatario["nifOrigem"] = "ficha";
  if (!NIF_RE.test(nif)) {
    const manual = (nifIndicado ?? "").replace(/\s/g, "");
    if (!NIF_RE.test(manual)) {
      throw new AssinaturaErro("Falta o NIF na ficha. Registe-o na ficha ou indique-o no envio (9 dígitos).", 409);
    }
    nif = manual;
    nifOrigem = "equipa";
  }
  email = normalizeEmail(email);
  if (!isEmail(email)) throw new AssinaturaErro("A ficha não tem um email válido para enviar o código.", 409);
  if (!nome.trim()) throw new AssinaturaErro("A ficha não tem nome.", 409);
  return { nome: nome.trim(), email, nif, nifOrigem, formando, clienteId: k.cliente_id };
}

/** Texto final do contrato: troca os campos automáticos pelos dados do signatário. */
export function textoDoContrato(k: Contrato, s: Signatario) {
  const valor = Number(k.valor) || 0;
  const campos: Record<string, string> = {
    cliente: s.nome, nome: s.nome, email: s.email, nif: s.nif, curso: k.curso, turma: s.formando?.turma ?? "",
    valor: valor ? `€ ${valor.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "",
    data: dataLonga(new Date()),
  };
  return k.corpo.replace(/\{\{\s*([a-z]+)\s*\}\}/g, (m, chave: string) => (chave in campos ? campos[chave] || `[${chave}]` : m));
}

export async function cabecalhoEntidade(db: Db): Promise<Cabecalho & { email: string }> {
  const e = await lerEntidade(db);
  const linha = [e.nif ? `NIF ${e.nif}` : "", [e.morada, e.codigoPostal, e.localidade].filter(Boolean).join(", "), e.email]
    .filter(Boolean).join(" · ");
  return { entidade: e.nome || "Entidade formadora", linhaEntidade: linha, logo: await obterLogoEntidade(db), email: e.email };
}

function linhasModelo(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Envia um dos modelos "assinatura_*" (editáveis em Emails automáticos › Modelos). */
export async function enviarModelo(
  db: Db,
  tipo: "assinatura_convite" | "assinatura_codigo" | "assinatura_concluida" | "assinatura_equipa",
  para: { email: string; nome: string },
  vars: Record<string, string>,
  href = "",
) {
  const m = await repo.modeloEmail(db, tipo);
  if (!m) throw new AssinaturaErro("Falta o modelo de email da assinatura. Reponha-o em Emails automáticos.", 500);
  const xml = parseEmailXml(m.body_xml ?? "");
  const linhas = xml.linhas.length ? xml.linhas : linhasModelo(m.body_lines);
  const mail = renderAutomaticEmail({
    nome: para.nome, xml: m.body_xml ?? "", linhas, cta: xml.cta || m.cta, href, vars, origin: config.appOrigin,
  });
  await sendMail(db, { to: para.email, name: para.nome, subject: fillVars(m.assunto, vars), text: mail.text, html: mail.html });
}

/**
 * Guarda o PDF assinado na Drive. Formando com turma: pasta do formando no Dossiê da turma.
 * Formando sem turma: GesForma › Gold|Financiada › Formandos › <nome> › Contratos.
 * Cliente: GesForma › Comercial › Clientes › <cliente> › Contratos.
 */
export async function guardarNaDrive(db: Db, a: repo.Assinatura, pdf: Buffer, actorId?: string) {
  const nomeFicheiro = `Contrato ${a.contratoId} - ${a.signatarioNome} - assinado.pdf`;
  const ficheiro = { name: nomeFicheiro, mime: "application/pdf", bytes: pdf };
  if (a.formandoRegime && a.formandoId) {
    const f = await repo.formandoSignatario(db, a.formandoRegime, a.formandoId);
    const turma = f?.turma_id ? await repo.nomeTurma(db, a.formandoRegime, f.turma_id) : null;
    const pessoa = nomePastaPessoa(a.formandoId, a.signatarioNome);
    if (turma) {
      return storeDriveFile(db, actorId, ficheiro, {
        kind: "formando-doc", regime: a.formandoRegime, turma, formando: pessoa, label: "Contratos",
      }, { gerado: true });
    }
    const regime = a.formandoRegime === "fin" ? "Financiada" : "Gold";
    return guardarEmCaminho(db, actorId, ficheiro, [regime, "Formandos", pessoa, "Contratos"], a.formandoRegime);
  }
  const cliente = a.clienteId ? (await repo.clienteSignatario(db, a.clienteId))?.nome ?? a.signatarioNome : a.signatarioNome;
  return guardarEmCaminho(db, actorId, ficheiro, ["Comercial", "Clientes", cliente.replace(/[\\/:*?"<>|]/g, "-").slice(0, 120), "Contratos"]);
}

async function guardarEmCaminho(
  db: Db, actorId: string | undefined, ficheiro: { name: string; mime: string; bytes: Buffer }, caminho: string[], regime?: string,
) {
  const creds = await driveCreds(db);
  const segmentos = [creds.folderName, ...caminho];
  const { token } = await usableToken(db);
  const parentDriveId = token ? await ensureFolderPath(db, token, segmentos, creds.folderId) : undefined;
  return storeDriveFile(db, actorId, ficheiro, {
    kind: "contrato", regime, label: "Contratos", parentDriveId, folderPath: segmentos.join(" / "),
  }, { gerado: true });
}

export const ROTULO_METODO: Record<string, string> = {
  desenhada: "Assinatura desenhada + código por email",
  escrita: "Nome escrito + código por email",
  cc_cmd: "Cartão de Cidadão / Chave Móvel Digital (Autenticação.gov)",
};

export const ROTULO_EVENTO: Record<string, string> = {
  enviado: "Pedido enviado por email",
  reenviado: "Nova ligação enviada",
  aberto: "Documento aberto",
  codigo_enviado: "Código de confirmação enviado por email",
  codigo_errado: "Código errado",
  codigo_confirmado: "Código confirmado",
  assinado: "Documento assinado",
  recusado: "Assinatura recusada",
  cancelado: "Pedido cancelado",
  drive: "PDF assinado guardado na Drive",
  drive_erro: "Não foi possível guardar na Drive",
  externo: "PDF assinado com CC/CMD recebido",
};
