/**
 * Assinatura qualificada do plano de sessão e da folha de presenças (Financiada): o PDF da sessão é emitido para
 * assinar, assina-se na app gratuita Autenticação.gov com o Cartão de Cidadão ou a Chave Móvel Digital, e o PDF
 * assinado volta ao GesForma, que confirma a assinatura (PAdES: integridade, chave do signatário e cadeia até às
 * ECs qualificadas do Estado — assinaturas/selar.ts) antes de o guardar. Formador e coordenação assinam por ordem,
 * cada um sobre o PDF que já traz as assinaturas anteriores.
 */
import { createHash } from "node:crypto";
import type { Db } from "./db/pool.js";
import { ancorasDoEstado, PdfExternoErro, validarAssinadoExterno } from "./assinaturas/selar.js";
import { nomeCorresponde } from "./assinaturas/publico.js";
import { bytesDe } from "./repos/assinaturas.js";
import { lerSessao } from "./repos/pedagogiaSessoes.js";
import { many, one } from "./repos/sql.js";
import { documentosSessoesDaTurma } from "./documentosFin.js";

export type DocumentoSessao = "plano" | "folha";
export type AssinaturaQualificada = { papel: "formador" | "coordenacao"; titular: string; emissor: string; serie: string; em: string };

export class AssinaturaQualificadaErro extends Error {
  constructor(message: string, readonly estado = 400) { super(message); }
}

const sha256 = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");
const asObj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {});

/** O que o documento diz (sem estados nem assinaturas): mudando, a assinatura qualificada deixa de valer. */
export function conteudoDaSessao(doc: DocumentoSessao, r: { plano?: unknown; presencas?: unknown; folha?: unknown } | null) {
  if (doc === "plano") {
    const p = asObj(r?.plano);
    return sha256(JSON.stringify({ g: p.objetivosGerais ?? "", e: p.objetivosEspecificos ?? "", m: p.momentos ?? {} }));
  }
  const f = asObj(r?.folha);
  return sha256(JSON.stringify({ p: Array.isArray(r?.presencas) ? r!.presencas : [], t: f.teoricas ?? null, pr: f.praticas ?? null }));
}

const serieMascarada = (serie: string) => serie.replace(/\d(?=\d{3})/g, "•");

type Linha = { conteudo_hash: string; original: unknown; pdf: unknown; assinaturas: unknown };

async function linha(db: Db, turmaId: number, sessaoId: string, doc: DocumentoSessao) {
  return one<Linha>(db, `SELECT conteudo_hash, original, pdf, assinaturas FROM sessao_pdfs_assinados
    WHERE regime = 'fin' AND turma_id = $1 AND sessao_id = $2 AND documento = $3`, [turmaId, sessaoId, doc]);
}

const lista = (v: unknown) => (Array.isArray(v) ? v as AssinaturaQualificada[] : []);

/** Estado da assinatura qualificada do documento (só vale se o conteúdo ainda for o que foi assinado). */
export async function estadoQualificada(db: Db, turmaId: number, sessaoId: string, doc: DocumentoSessao) {
  const [r, sessao] = await Promise.all([linha(db, turmaId, sessaoId, doc), lerSessao(db, "fin", turmaId, sessaoId)]);
  const valida = Boolean(r) && r!.conteudo_hash === conteudoDaSessao(doc, sessao);
  return { assinaturas: valida ? lista(r!.assinaturas) : [], desatualizada: Boolean(r) && !valida && lista(r!.assinaturas).length > 0 };
}

/**
 * PDF para assinar: o que já tem assinaturas (para a assinatura seguinte), ou um novo, emitido agora com o
 * conteúdo actual. Um documento alterado depois de assinado é emitido de novo (as assinaturas antigas deixam de contar).
 */
export async function pdfParaAssinar(db: Db, turmaId: number, sessaoId: string, n: number, doc: DocumentoSessao) {
  const [r, sessao] = await Promise.all([linha(db, turmaId, sessaoId, doc), lerSessao(db, "fin", turmaId, sessaoId)]);
  const conteudo = conteudoDaSessao(doc, sessao);
  if (r && r.conteudo_hash === conteudo) return bytesDe(r.pdf);
  const docs = await documentosSessoesDaTurma(db, turmaId, { n, so: doc === "plano" ? "planos" : "folhas", semAssinaturas: true });
  if (!docs) throw new AssinaturaQualificadaErro("Sessão não encontrada.", 404);
  const pdf = doc === "plano" ? docs.planos : docs.folhas;
  await one(db, `INSERT INTO sessao_pdfs_assinados (regime, turma_id, sessao_id, documento, conteudo_hash, original, pdf, assinaturas)
      VALUES ('fin', $1, $2, $3, $4, $5, $5, '[]'::jsonb)
      ON CONFLICT (regime, turma_id, sessao_id, documento) DO UPDATE SET
        conteudo_hash = EXCLUDED.conteudo_hash, original = EXCLUDED.original, pdf = EXCLUDED.pdf, assinaturas = '[]'::jsonb, atualizado_em = now()
      RETURNING sessao_id`, [turmaId, sessaoId, doc, conteudo, pdf]);
  return pdf;
}

/**
 * Recebe o PDF assinado na Autenticação.gov: tem de ser o emitido (com a assinatura acrescentada), com assinatura
 * qualificada válida de CC/CMD. O formador só assina como ele próprio (o nome do certificado tem de conter o da ficha).
 */
export async function receberAssinado(
  db: Db, turmaId: number, sessaoId: string, doc: DocumentoSessao, ficheiro: Buffer,
  quem: { papel: "formador" | "coordenacao"; nomes: string[] }, ancoras = ancorasDoEstado(),
) {
  const [r, sessao] = await Promise.all([linha(db, turmaId, sessaoId, doc), lerSessao(db, "fin", turmaId, sessaoId)]);
  if (!r) throw new AssinaturaQualificadaErro("Descarregue primeiro o PDF para assinar.", 409);
  if (r.conteudo_hash !== conteudoDaSessao(doc, sessao)) {
    throw new AssinaturaQualificadaErro("O documento foi alterado depois de ser emitido para assinar. Descarregue-o de novo e assine essa versão.", 409);
  }
  let cert;
  try {
    cert = await validarAssinadoExterno(bytesDe(r.pdf), ficheiro, ancoras);
  } catch (err) {
    if (err instanceof PdfExternoErro) throw new AssinaturaQualificadaErro(err.message, 400);
    throw err;
  }
  if (quem.papel === "formador" && !quem.nomes.some(n => nomeCorresponde(n, cert.titular))) {
    throw new AssinaturaQualificadaErro(`O PDF foi assinado por «${cert.titular}», que não corresponde ao formador ${quem.nomes[0] ?? ""}.`, 400);
  }
  const nova: AssinaturaQualificada = { papel: quem.papel, titular: cert.titular, emissor: cert.emissor, serie: serieMascarada(cert.serie), em: new Date().toISOString() };
  const assinaturas = [...lista(r.assinaturas), nova];
  await one(db, `UPDATE sessao_pdfs_assinados SET pdf = $4, assinaturas = $5::jsonb, atualizado_em = now()
      WHERE regime = 'fin' AND turma_id = $1 AND sessao_id = $2 AND documento = $3 RETURNING sessao_id`,
  [turmaId, sessaoId, doc, ficheiro, JSON.stringify(assinaturas)]);
  return { assinaturas, hash: sha256(ficheiro) };
}

/** O PDF com as assinaturas qualificadas (só se ainda corresponder ao conteúdo). */
export async function pdfAssinado(db: Db, turmaId: number, sessaoId: string, doc: DocumentoSessao) {
  const [r, sessao] = await Promise.all([linha(db, turmaId, sessaoId, doc), lerSessao(db, "fin", turmaId, sessaoId)]);
  if (!r || !lista(r.assinaturas).length || r.conteudo_hash !== conteudoDaSessao(doc, sessao)) return null;
  return bytesDe(r.pdf);
}

/** Assinaturas qualificadas válidas da turma, por sessão (para os PDF gerados e o dossiê). */
export async function qualificadasDaTurma(db: Db, turmaId: number) {
  const linhas = await many<{ sessao_id: string; documento: DocumentoSessao; conteudo_hash: string; assinaturas: unknown; plano: unknown; presencas: unknown; folha: unknown }>(db,
    `SELECT a.sessao_id, a.documento, a.conteudo_hash, a.assinaturas, s.plano, s.presencas, s.folha
       FROM sessao_pdfs_assinados a
       LEFT JOIN turma_sessoes s ON s.regime = a.regime AND s.turma_id = a.turma_id AND s.sessao_id = a.sessao_id
      WHERE a.regime = 'fin' AND a.turma_id = $1`, [turmaId]);
  const out = new Map<string, AssinaturaQualificada[]>();
  for (const l of linhas) {
    if (l.conteudo_hash !== conteudoDaSessao(l.documento, l)) continue;
    out.set(`${l.sessao_id}|${l.documento}`, lista(l.assinaturas));
  }
  return out;
}

/** Os PDF assinados (CC/CMD) que ainda valem, com a posição actual da sessão, para o ZIP do dossiê. */
export async function pdfsAssinadosDaTurma(db: Db, turmaId: number) {
  const linhas = await many<{ sessao_id: string; sessao_n: number | null; documento: DocumentoSessao; conteudo_hash: string; assinaturas: unknown; pdf: unknown; plano: unknown; presencas: unknown; folha: unknown }>(db,
    `SELECT a.sessao_id, s.sessao_n, a.documento, a.conteudo_hash, a.assinaturas, a.pdf, s.plano, s.presencas, s.folha
       FROM sessao_pdfs_assinados a
       JOIN turma_sessoes s ON s.regime = a.regime AND s.turma_id = a.turma_id AND s.sessao_id = a.sessao_id
      WHERE a.regime = 'fin' AND a.turma_id = $1 AND s.sessao_n IS NOT NULL ORDER BY s.sessao_n, a.documento`, [turmaId]);
  return linhas
    .filter(l => lista(l.assinaturas).length && l.conteudo_hash === conteudoDaSessao(l.documento, l))
    .map(l => ({ n: Number(l.sessao_n), documento: l.documento, pdf: bytesDe(l.pdf) }));
}
