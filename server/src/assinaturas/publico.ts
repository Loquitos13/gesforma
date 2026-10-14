/** Assinatura de contratos, lado do signatário (ligação pessoal) e a página pública de verificação. */
import { timingSafeEqual } from "node:crypto";
import { config } from "../config.js";
import type { Db } from "../db/pool.js";
import { decryptField } from "../fieldCrypto.js";
import * as repo from "../repos/assinaturas.js";
import {
  AssinaturaErro, CODIGO_INTERVALO_S, CODIGO_MINUTOS, CODIGO_TENTATIVAS, CODIGOS_POR_HORA, ROTULO_EVENTO, ROTULO_METODO,
  cabecalhoEntidade, dataHora, enviarModelo, guardarNaDrive, hashCodigo, hashToken, mascararEmail, mascararNif,
  novoCodigoOtp, urlAssinar, urlVerificar,
} from "./comum.js";
import { acrescentarCertificado, carimbarAssinatura, sha256 } from "./pdf.js";
import { PdfExternoErro, selarPdf, validarAssinadoExterno } from "./selar.js";
import { seloParaAssinar } from "./selo.js";
import type { Meta } from "./servico.js";

const PODE_ASSINAR = new Set(["enviado", "aberto"]);

async function pedido(db: Db, token: string) {
  if (!/^[A-Za-z0-9_-]{30,60}$/.test(token)) throw new AssinaturaErro("Ligação inválida.", 404);
  await repo.expirarVencidos(db);
  const a = await repo.obterPorToken(db, hashToken(token));
  if (!a) throw new AssinaturaErro("Ligação inválida.", 404);
  return a;
}

function exigirAberto(a: repo.Assinatura) {
  if (PODE_ASSINAR.has(a.estado)) return;
  const msg: Record<string, string> = {
    assinado: "Este documento já está assinado.",
    recusado: "Recusou assinar este documento. Se mudou de ideias, peça um novo envio.",
    expirado: "A ligação expirou. Peça à entidade um novo envio.",
    cancelado: "Este pedido foi cancelado pela entidade.",
  };
  throw new AssinaturaErro(msg[a.estado] ?? "Este pedido já não está disponível.", 410);
}

const nifDe = (a: repo.Assinatura) => {
  try {
    return decryptField(a.nifEnc);
  } catch {
    return "";
  }
};

/** O que a página de assinatura mostra. Nada de dados pessoais além do nome e do email mascarado. */
export async function verPedido(db: Db, token: string, meta: Meta) {
  const a = await pedido(db, token);
  if (a.estado === "enviado") {
    await repo.marcarAberto(db, a.id);
    await repo.registarEvento(db, a.id, "aberto", meta);
  }
  const { entidade } = await cabecalhoEntidade(db);
  return {
    estado: a.estado === "enviado" ? "aberto" : a.estado,
    titulo: a.titulo,
    entidade,
    signatario: { nome: a.signatarioNome, email: mascararEmail(a.signatarioEmail) },
    expiraEm: a.expiraEm,
    assinadoEm: a.assinadoEm,
    metodo: a.metodo ? ROTULO_METODO[a.metodo] ?? a.metodo : null,
    codigoVerificacao: a.estado === "assinado" ? a.codigoVerificacao : null,
    urlVerificacao: a.estado === "assinado" ? urlVerificar(a.codigoVerificacao) : null,
    codigoMinutos: CODIGO_MINUTOS,
  };
}

export async function pdfPublico(db: Db, token: string, versao: "original" | "assinado") {
  const a = await pedido(db, token);
  if (versao === "assinado") {
    const pdf = await repo.pdfAssinado(db, a.id);
    if (!pdf) throw new AssinaturaErro("Ainda não há documento assinado.", 404);
    return { pdf, nome: `${a.titulo} - assinado.pdf` };
  }
  if (!PODE_ASSINAR.has(a.estado) && a.estado !== "assinado") exigirAberto(a);
  const pdf = await repo.pdfOriginal(db, a.id);
  if (!pdf) throw new AssinaturaErro("PDF em falta.", 404);
  return { pdf, nome: `${a.titulo}.pdf` };
}

/** Envia o código de 6 dígitos por email (no máximo um por minuto e cinco por hora). */
export async function pedirCodigo(db: Db, token: string, meta: Meta) {
  const a = await pedido(db, token);
  exigirAberto(a);
  const recentes = await repo.codigosRecentes(db, a.id);
  if (recentes.segundos != null && recentes.segundos < CODIGO_INTERVALO_S) {
    throw new AssinaturaErro(`Já enviámos um código. Pode pedir outro daqui a ${CODIGO_INTERVALO_S - recentes.segundos} segundos.`, 429);
  }
  if (recentes.n >= CODIGOS_POR_HORA) throw new AssinaturaErro("Pediu demasiados códigos. Tente de novo daqui a uma hora.", 429);
  const codigo = novoCodigoOtp();
  await repo.criarCodigo(db, a.id, hashCodigo(a.id, codigo), CODIGO_MINUTOS);
  await repo.registarEvento(db, a.id, "codigo_enviado", meta);
  await enviarModelo(db, "assinatura_codigo", { email: a.signatarioEmail, nome: a.signatarioNome }, {
    nome: a.signatarioNome, documento: a.titulo, codigo, minutos: String(CODIGO_MINUTOS),
  });
  return { enviadoPara: mascararEmail(a.signatarioEmail), minutos: CODIGO_MINUTOS };
}

async function confirmarCodigo(db: Db, a: repo.Assinatura, codigo: string, meta: Meta) {
  const atual = await repo.codigoActivo(db, a.id);
  if (!atual) throw new AssinaturaErro("Peça um código de confirmação primeiro.", 400);
  if (atual.expirado) throw new AssinaturaErro("O código expirou. Peça um novo.", 400);
  const esperado = Buffer.from(atual.codigo_hash, "hex");
  const dado = Buffer.from(hashCodigo(a.id, codigo.trim()), "hex");
  if (esperado.length !== dado.length || !timingSafeEqual(esperado, dado)) {
    const tentativas = await repo.falharCodigo(db, atual.id, CODIGO_TENTATIVAS);
    await repo.registarEvento(db, a.id, "codigo_errado", { ...meta, detalhe: { tentativa: tentativas } });
    const restam = CODIGO_TENTATIVAS - tentativas;
    throw new AssinaturaErro(restam > 0 ? `Código errado. Restam ${restam} tentativa(s).` : "Código errado demasiadas vezes. Peça um novo código.", 400);
  }
  await repo.gastarCodigo(db, atual.id);
  await repo.registarEvento(db, a.id, "codigo_confirmado", meta);
}

/** PNG da assinatura desenhada: data URL, até 300 KB, com a assinatura de bytes de PNG. */
function pngDaImagem(dataUrl?: string) {
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl ?? "");
  if (!m) throw new AssinaturaErro("Desenhe a assinatura antes de confirmar.", 400);
  const b = Buffer.from(m[1]!, "base64");
  if (b.length > 300_000) throw new AssinaturaErro("A imagem da assinatura é demasiado grande.", 400);
  if (!b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) throw new AssinaturaErro("Imagem inválida.", 400);
  return b;
}

export type PedidoAssinar = { metodo: "desenhada" | "escrita"; imagem?: string; nomeEscrito?: string; codigo: string };

export async function assinar(db: Db, token: string, p: PedidoAssinar, meta: Meta) {
  const a = await pedido(db, token);
  exigirAberto(a);
  const imagem = p.metodo === "desenhada" ? pngDaImagem(p.imagem) : null;
  const nomeEscrito = (p.nomeEscrito ?? "").trim();
  if (p.metodo === "escrita" && nomeEscrito.length < 3) throw new AssinaturaErro("Escreva o seu nome completo para assinar.", 400);
  await confirmarCodigo(db, a, p.codigo, meta);

  const original = await repo.pdfOriginal(db, a.id);
  if (!original) throw new AssinaturaErro("PDF em falta.", 500);
  const nif = nifDe(a);
  const agora = new Date();
  const carimbado = await carimbarAssinatura(original, {
    nome: a.signatarioNome, nif, data: dataHora(agora), codigo: a.codigoVerificacao, metodo: p.metodo,
    imagemPng: imagem, textoEscrito: nomeEscrito,
  });
  const selo = await seloParaAssinar(db);
  const cab = await cabecalhoEntidade(db);
  const eventos = (await repo.eventos(db, a.id)).map(e => ({
    quando: dataHora(e.em), texto: `${ROTULO_EVENTO[e.tipo] ?? e.tipo}${e.ip ? ` · IP ${e.ip}` : ""}`,
  }));
  eventos.push({ quando: dataHora(agora), texto: `Documento assinado${meta.ip ? ` · IP ${meta.ip}` : ""}` });
  const comCertificado = await acrescentarCertificado(carimbado.pdf, {
    titulo: a.titulo, codigo: a.codigoVerificacao, urlVerificacao: urlVerificar(a.codigoVerificacao), entidade: cab.entidade,
    signatario: { nome: a.signatarioNome, nif, email: a.signatarioEmail }, metodo: ROTULO_METODO[p.metodo]!,
    hashOriginal: a.hashOriginal, hashAssinatura: carimbado.hash,
    selo: selo ? { titular: selo.info.titular, emissor: selo.info.emissor, fingerprint: selo.info.fingerprint, autoAssinado: selo.info.autoAssinado } : null,
    eventos,
  });
  const final = selo
    ? await selarPdf(comCertificado, { chave: selo.info.chave, cert: selo.info.cert, cadeia: selo.info.cadeia, titular: selo.info.titular }, cab.email)
    : comCertificado;
  return concluirAssinatura(db, token, a, {
    metodo: p.metodo, pdf: final, hashAssinatura: carimbado.hash, hashFinal: sha256(final),
    fingerprint: selo?.info.fingerprint ?? "", titular: selo?.info.titular ?? "", selado: Boolean(selo),
  }, meta, { metodo: p.metodo, nomeEscrito: p.metodo === "escrita" ? nomeEscrito : undefined });
}

async function concluirAssinatura(db: Db, token: string, a: repo.Assinatura, c: repo.Conclusao, meta: Meta, detalhe: Record<string, unknown>) {
  const ok = await db.tx(async q => {
    if (!(await repo.concluir(q, a.id, c))) return false;
    await repo.marcarContrato(q, a.contratoId, "Assinado");
    await repo.registarEvento(q, a.id, "assinado", { ...meta, detalhe: { ...detalhe, hashFinal: c.hashFinal, selado: c.selado } });
    return true;
  });
  if (!ok) throw new AssinaturaErro("Este documento já foi assinado ou o pedido mudou entretanto.", 409);
  try {
    const f = await guardarNaDrive(db, a, c.pdf);
    await repo.ligarDrive(db, a.id, f.id);
    await repo.registarEvento(db, a.id, "drive", { detalhe: { pasta: f.folderPath } });
  } catch (err) {
    await repo.registarEvento(db, a.id, "drive_erro", { detalhe: { erro: err instanceof Error ? err.message.slice(0, 200) : "erro" } });
  }
  const data = dataHora(new Date());
  await enviarModelo(db, "assinatura_concluida", { email: a.signatarioEmail, nome: a.signatarioNome }, {
    nome: a.signatarioNome, documento: a.titulo, data, verificacao: a.codigoVerificacao,
  }, urlAssinar(token)).catch(() => undefined);
  if (a.enviadoPor) {
    const u = await repo.emailUtilizador(db, a.enviadoPor);
    if (u?.email) {
      await enviarModelo(db, "assinatura_equipa", { email: u.email, nome: u.name }, {
        nome: u.name, signatario: a.signatarioNome, documento: a.titulo, data,
      }, `${config.appOrigin.replace(/\/$/, "")}/gesforma`).catch(() => undefined);
    }
  }
  return { estado: "assinado" as const, codigoVerificacao: a.codigoVerificacao, urlVerificacao: urlVerificar(a.codigoVerificacao), hashFinal: c.hashFinal };
}

export async function recusar(db: Db, token: string, motivo: string, meta: Meta) {
  const a = await pedido(db, token);
  exigirAberto(a);
  await repo.marcarRecusado(db, a.id, motivo);
  await repo.marcarContrato(db, a.contratoId, "Rascunho");
  await repo.registarEvento(db, a.id, "recusado", { ...meta, detalhe: { motivo } });
  return { estado: "recusado" as const };
}

const palavras = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/[^a-z]+/).filter(p => p.length > 1);

/** PDF assinado na app Autenticação.gov: tem de ser o original, com assinatura, do próprio signatário. */
export async function receberAssinadoExterno(db: Db, token: string, ficheiro: Buffer, meta: Meta) {
  const a = await pedido(db, token);
  exigirAberto(a);
  const original = await repo.pdfOriginal(db, a.id);
  if (!original) throw new AssinaturaErro("PDF em falta.", 500);
  let cert: { titular: string; emissor: string };
  try {
    cert = validarAssinadoExterno(original, ficheiro);
  } catch (err) {
    if (err instanceof PdfExternoErro) throw new AssinaturaErro(err.message, 400);
    throw err;
  }
  if (cert.titular) {
    const doCert = new Set(palavras(cert.titular));
    const nome = palavras(a.signatarioNome);
    const comuns = nome.filter(p => doCert.has(p));
    if (comuns.length < Math.min(2, nome.length)) {
      await repo.registarEvento(db, a.id, "externo", { ...meta, detalhe: { recusado: true, titular: cert.titular } });
      throw new AssinaturaErro(`O PDF foi assinado por "${cert.titular}", que não corresponde a ${a.signatarioNome}.`, 400);
    }
  }
  await repo.registarEvento(db, a.id, "externo", { ...meta, detalhe: { titular: cert.titular, emissor: cert.emissor } });
  const hash = sha256(ficheiro);
  return concluirAssinatura(db, token, a, {
    metodo: "cc_cmd", pdf: ficheiro, hashAssinatura: hash, hashFinal: hash, fingerprint: "", titular: cert.titular, selado: false,
  }, meta, { metodo: "cc_cmd", titular: cert.titular, emissor: cert.emissor });
}

/** Página pública de verificação: estado, signatário (NIF mascarado), datas e hashes. */
export async function verificar(db: Db, codigo: string) {
  const c = codigo.trim().toUpperCase();
  if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(c)) throw new AssinaturaErro("Código de verificação inválido.", 404);
  await repo.expirarVencidos(db);
  const a = await repo.obterPorCodigo(db, c);
  if (!a) throw new AssinaturaErro("Não encontrámos nenhum documento com este código.", 404);
  const { entidade } = await cabecalhoEntidade(db);
  const assinado = a.estado === "assinado";
  return {
    codigo: a.codigoVerificacao, estado: a.estado, titulo: a.titulo, entidade,
    signatario: { nome: a.signatarioNome, nif: mascararNif(nifDe(a)) },
    enviadoEm: a.enviadoEm, assinadoEm: a.assinadoEm,
    metodo: a.metodo ? ROTULO_METODO[a.metodo] ?? a.metodo : null,
    hashOriginal: a.hashOriginal, hashFinal: assinado ? a.hashFinal : null,
    selo: assinado && a.selado ? { titular: a.certificadoTitular, fingerprint: a.certificadoFingerprint } : null,
    assinaturaExterna: a.metodo === "cc_cmd" ? { titular: a.certificadoTitular } : null,
  };
}


