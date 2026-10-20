/** Assinatura de contratos, lado da equipa: enviar, reenviar, cancelar e consultar o registo. */
import type { Db } from "../db/pool.js";
import { decryptField, encryptField } from "../fieldCrypto.js";
import * as repo from "../repos/assinaturas.js";
import type { Consulta } from "../repos/sql.js";
import { obterModelo } from "../repos/crmDiretorioDocs.js";
import {
  AssinaturaErro, PRAZO_DIAS, ROTULO_EVENTO, ROTULO_METODO, cabecalhoEntidade, dataHora, enviarModelo, mascararNif,
  novoCodigoVerificacao, novoToken, resolverSignatario, textoDoContrato, urlAssinar, urlVerificar, type Signatario,
} from "./comum.js";
import { gerarPdfContrato, sha256 } from "./pdf.js";

export type Meta = { ip?: string; userAgent?: string };

export type Quem = { id: string; role: string };

/** Quem pode tratar do contrato: administração e secretaria; o comercial só os seus; a Financiada os dos formandos financiados. */
function podeVer(quem: Quem, k: { comercial_id: string; formando_regime: string | null }) {
  if (quem.role === "admin" || quem.role === "secretaria") return true;
  if (quem.role === "comercial") return String(k.comercial_id) === quem.id;
  if (quem.role === "financiada") return k.formando_regime === "fin";
  return false;
}

async function contratoVisivel(db: Db, quem: Quem, contratoId: number) {
  const k = await repo.contratoParaAssinar(db, contratoId);
  if (!k || !podeVer(quem, k)) throw new AssinaturaErro("Contrato não encontrado.", 404);
  return k;
}

/** Pedido + contrato, só se o contrato for visível a quem pede (RLS dos contratos). */
export async function assinaturaVisivel(db: Db, quem: Quem, id: number) {
  await repo.expirarVencidos(db);
  const a = await repo.obterAssinatura(db, id);
  if (!a) throw new AssinaturaErro("Pedido de assinatura não encontrado.", 404);
  await contratoVisivel(db, quem, a.contratoId);
  return a;
}

async function convidar(db: Db, a: { titulo: string; signatarioEmail: string; signatarioNome: string }, token: string, expira: Date) {
  const { entidade } = await cabecalhoEntidade(db);
  await enviarModelo(db, "assinatura_convite", { email: a.signatarioEmail, nome: a.signatarioNome }, {
    nome: a.signatarioNome, documento: a.titulo, entidade, validade: dataHora(expira),
  }, urlAssinar(token));
}

/** Gera o PDF original, abre o pedido e envia o convite. Um pedido aberto anterior é cancelado. */
export async function enviarParaAssinatura(db: Db, quem: Quem, contratoId: number, opts: { nif?: string; prazoDias?: number }, meta: Meta) {
  await repo.expirarVencidos(db);
  const k = await contratoVisivel(db, quem, contratoId);
  if (k.estado === "Assinado") throw new AssinaturaErro("O contrato já está assinado.", 409);
  if (k.estado === "Cancelado") throw new AssinaturaErro("O contrato está cancelado.", 409);
  if (!k.corpo.trim()) throw new AssinaturaErro("O contrato não tem texto. Escreva-o ou escolha um modelo antes de enviar.", 409);
  const s = await resolverSignatario(db, k, opts.nif);
  const cab = await cabecalhoEntidade(db);
  const titulo = `Contrato de formação · ${k.curso || s.nome}`.slice(0, 160);
  const codigo = novoCodigoVerificacao();
  const pdf = await gerarPdfContrato({ titulo, texto: textoDoContrato(k, s), cabecalho: cab, referencia: `Contrato n.º ${k.id} · ${codigo}` });
  const { token, hash } = novoToken();
  const dias = Math.min(Math.max(Math.trunc(opts.prazoDias ?? PRAZO_DIAS), 1), 60);
  const expira = new Date(Date.now() + dias * 24 * 3600_000);
  const id = await db.tx(async q => {
    const anterior = (await repo.listarDoContrato(q, k.id))[0];
    await repo.cancelarAbertas(q, k.id, "Substituído por um novo envio.");
    const novo = await repo.criarAssinatura(q, {
      contratoId: k.id, tokenHash: hash, codigo, titulo, nome: s.nome, email: s.email, nifEnc: encryptField(s.nif),
      nifOrigem: s.nifOrigem, formandoRegime: s.formando?.regime ?? null, formandoId: s.formando?.id ?? null,
      clienteId: s.clienteId, enviadoPor: quem.id, expiraEm: expira, pdf, hash: sha256(pdf),
    });
    await repo.marcarContrato(q, k.id, "Por assinar");
    await repo.registarEvento(q, novo, "enviado", { ...meta, detalhe: { email: s.email, nifOrigem: s.nifOrigem, prazoDias: dias } });
    if (anterior) await registarMudancaSignatario(q, novo, anterior, s, meta);
    return novo;
  });
  await convidar(db, { titulo, signatarioEmail: s.email, signatarioNome: s.nome }, token, expira);
  return detalhe(db, id);
}

/**
 * Email ou NIF do signatário diferentes do pedido anterior do mesmo contrato (a ficha mudou, ou a equipa indicou
 * outro NIF no envio): fica no registo de provas, com o email antigo e o NIF mascarado.
 */
async function registarMudancaSignatario(q: Consulta, novo: number, anterior: repo.Assinatura, s: Signatario, meta: Meta) {
  let nifAnterior = "";
  try {
    nifAnterior = decryptField(anterior.nifEnc);
  } catch {
    nifAnterior = "";
  }
  const emailMudou = anterior.signatarioEmail !== s.email;
  const nifMudou = nifAnterior !== s.nif;
  if (!emailMudou && !nifMudou) return;
  await repo.registarEvento(q, novo, "signatario_alterado", {
    ...meta,
    detalhe: {
      assinaturaAnterior: anterior.id,
      ...(emailMudou ? { emailAnterior: anterior.signatarioEmail, email: s.email } : {}),
      ...(nifMudou ? { nifAnterior: mascararNif(nifAnterior), nif: mascararNif(s.nif), nifOrigem: s.nifOrigem } : {}),
    },
  });
}

export async function reenviar(db: Db, quem: Quem, id: number, prazoDias: number | undefined, meta: Meta) {
  const a = await assinaturaVisivel(db, quem, id);
  if (!["enviado", "aberto", "expirado"].includes(a.estado)) throw new AssinaturaErro("Este pedido já não pode ser reenviado.", 409);
  const { token, hash } = novoToken();
  const dias = Math.min(Math.max(Math.trunc(prazoDias ?? PRAZO_DIAS), 1), 60);
  const expira = new Date(Date.now() + dias * 24 * 3600_000);
  await repo.novoToken(db, id, hash, expira);
  await repo.registarEvento(db, id, "reenviado", { ...meta, detalhe: { prazoDias: dias } });
  await convidar(db, a, token, expira);
  return detalhe(db, id);
}

export async function cancelar(db: Db, quem: Quem, id: number, motivo: string, meta: Meta) {
  const a = await assinaturaVisivel(db, quem, id);
  if (!(await repo.cancelar(db, id, motivo))) throw new AssinaturaErro("Este pedido já não pode ser cancelado.", 409);
  await repo.marcarContrato(db, a.contratoId, "Rascunho");
  await repo.registarEvento(db, id, "cancelado", { ...meta, detalhe: { motivo } });
  return detalhe(db, id);
}

/** O que a equipa vê: estado, signatário, provas e hashes. */
export async function detalhe(db: Db, id: number) {
  const a = await repo.obterAssinatura(db, id);
  if (!a) throw new AssinaturaErro("Pedido de assinatura não encontrado.", 404);
  const eventos = await repo.eventos(db, id);
  let nif = "";
  try {
    nif = decryptField(a.nifEnc);
  } catch {
    nif = "";
  }
  const { nifEnc: _n, ...resto } = a;
  return {
    ...resto,
    nif: mascararNif(nif),
    nifOrigem: a.nifOrigem,
    metodoRotulo: a.metodo ? ROTULO_METODO[a.metodo] ?? a.metodo : null,
    urlVerificacao: urlVerificar(a.codigoVerificacao),
    eventos: eventos.map(e => ({ ...e, rotulo: ROTULO_EVENTO[e.tipo] ?? e.tipo })),
  };
}

export async function listarDoContrato(db: Db, quem: Quem, contratoId: number) {
  await repo.expirarVencidos(db);
  await contratoVisivel(db, quem, contratoId);
  const lista = await repo.listarDoContrato(db, contratoId);
  return lista.map(({ nifEnc: _n, ...a }) => ({ ...a, metodoRotulo: a.metodo ? ROTULO_METODO[a.metodo] ?? a.metodo : null }));
}

export async function pdfDaAssinatura(db: Db, quem: Quem, id: number, versao: "original" | "assinado") {
  const a = await assinaturaVisivel(db, quem, id);
  const pdf = versao === "assinado" ? await repo.pdfAssinado(db, id) : await repo.pdfOriginal(db, id);
  if (!pdf) throw new AssinaturaErro(versao === "assinado" ? "Ainda não há documento assinado." : "PDF em falta.", 404);
  return { pdf, nome: `Contrato ${a.contratoId}${versao === "assinado" ? " - assinado" : ""}.pdf` };
}

// ─── Contratos de formação a partir da ficha do formando ───────────────────────

export async function contratosDoFormando(db: Db, regime: "gold" | "fin", formandoId: number) {
  await repo.expirarVencidos(db);
  if (!(await repo.formandoSignatario(db, regime, formandoId))) throw new AssinaturaErro("Formando não encontrado.", 404);
  return repo.contratosDoFormando(db, regime, formandoId);
}

/** Cria o contrato de formação do formando a partir de um modelo de contrato (fica em rascunho). */
export async function novoContratoFormando(db: Db, regime: "gold" | "fin", formandoId: number, actorId: string, templateId: number) {
  const f = await repo.formandoSignatario(db, regime, formandoId);
  if (!f) throw new AssinaturaErro("Formando não encontrado.", 404);
  const modelo = await obterModelo(db, "contrato", templateId);
  if (!modelo) throw new AssinaturaErro("Modelo de contrato inexistente.", 400);
  if (!modelo.corpo.trim()) throw new AssinaturaErro("O modelo não tem texto.", 409);
  return repo.criarContratoFormando(db, {
    comercialId: actorId, regime, formandoId, nome: `${f.nome} ${f.apelido}`.trim(), email: f.email,
    curso: f.curso || modelo.curso, valor: regime === "fin" ? 0 : modelo.valor, corpo: modelo.corpo, templateId,
  });
}
