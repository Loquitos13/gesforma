/** Monta a ficha completa de um formando (Gold ou Financiada) a partir dos repositórios. */
import { docsDefinidosDoFormando } from "../../formandoDocsLista.js";
import type { Db } from "../../db/pool.js";
import { vistaDocumentosFormandoFin } from "../../formandoFinDocs.js";
import { readFormandoPii } from "../../pii.js";
import { lerEntidade } from "../../regrasConfig.js";
import { resultadosDaTurma } from "../../resultados.js";
import { docsDoFormando, notasDoFormando } from "../../repos/formandosDocs.js";
import {
  certificadoDoFormando, contaDoFormando, historicoDoFormando, linhaFormando, pagamentosDoFormando,
  preinscricaoDoFormando, turmaDoFormando,
} from "../../repos/formandos.js";
import type { Regime } from "../../repos/sql.js";
import * as leadsRepo from "../../repos/leads.js";
import { listarDocsLead } from "../../docsLink.js";
import { estadoPrestacoes } from "../../docsCurso.js";

function iso(v: unknown) {
  if (!v) return null;
  const s = v instanceof Date ? v.toISOString() : String(v);
  return s || null;
}

const ACCOES: Record<string, string> = {
  "formando.inscrever": "Ficha criada",
  "formando.alterar": "Ficha alterada",
  "formando.docs": "Documentos actualizados",
  "formando.doc_validado": "Documento validado",
  "formando.doc_recusado": "Documento recusado",
  "formando.nota": "Nota acrescentada",
  "formando.acesso": "Acesso à área do formando criado",
  "formando.acesso_reposto": "Palavra-passe temporária gerada",
  "formando.lembrete_docs": "Lembrete de documentos enviado",
  "formando.pagamento_pedido": "Pagamento pedido por email",
  "formando.pagamento_registado": "Pagamento registado",
  "formando.financiamento": "Dados para o financiamento alterados",
};

function situacaoPagamento(metodo: string, pago: boolean, valor: number) {
  if (/^oferta$/i.test(metodo.trim())) return "oferta" as const;
  if (pago) return "pago" as const;
  if (valor <= 0) return "isento" as const;
  return "por_pagar" as const;
}

export async function montarFicha(db: Db, regime: Regime, id: number) {
  const row = await linhaFormando(db, regime, id);
  if (!row) return null;
  const email = String(row.email ?? "");
  const curso = String(row.curso ?? "");
  const turmaId = row.turma_id == null ? null : Number(row.turma_id);
  const userId = row.user_id ? String(row.user_id) : null;

  const [turma, conta, notas, historico, origem] = await Promise.all([
    turmaId ? turmaDoFormando(db, regime, turmaId) : Promise.resolve(null),
    userId ? contaDoFormando(db, userId) : Promise.resolve(null),
    notasDoFormando(db, regime, id),
    historicoDoFormando(db, regime, id),
    preinscricaoDoFormando(db, regime, email, curso),
  ]);

  // Documentos: Financiada com a vista do dossiê de elegibilidade; Gold com a lista do contrato de formação.
  let documentos: Array<{ id: string; label: string; required: boolean; estado: string; observacao: string; fileName: string; driveUrl: string; validadoEm: string; validadoPor: string }>;
  let ligacaoDocumentos: string | null = null;
  if (regime === "fin") {
    const vista = await vistaDocumentosFormandoFin(db, id);
    documentos = vista?.documentos ?? [];
    ligacaoDocumentos = vista?.url ?? null;
  } else {
    const linhas = await docsDoFormando(db, "gold", id);
    const porId = new Map(linhas.map(l => [l.doc_id, l]));
    const defs = await docsDefinidosDoFormando(db, "gold", id, row as Record<string, unknown>);
    // Só a lista da ficha: os documentos fora dela com ficheiro já vêm na lista (opcionais); os outros não aparecem.
    const ids = defs.map(d => d.id);
    documentos = ids.map(docId => {
      const def = defs.find(d => d.id === docId);
      const l = porId.get(docId);
      const estado = l?.estado === "validado" || (l?.ok && l.estado !== "recusado") ? "validado" : l?.estado === "recusado" ? "recusado" : l?.file_name ? "pendente" : "em_falta";
      return {
        id: docId,
        label: def?.label ?? docId,
        required: Boolean(def?.required),
        estado,
        observacao: l?.observacao ?? "",
        fileName: l?.file_name ?? "",
        driveUrl: l?.drive_url ?? "",
        validadoEm: iso(l?.validated_at)?.slice(0, 10) ?? "",
        validadoPor: l?.validator_name ?? "",
      };
    });
  }
  const obrig = documentos.filter(d => d.required);

  // Resultados da turma (assiduidade, avaliação, elegibilidade para certificado).
  let resultado: null | {
    assiduidade: { pct: number | null; horasPrevistas: number; horasPresente: number; minimo: number };
    nota: number | null; aprovado: boolean | null; elegivel: boolean; motivos: string[];
  } = null;
  let certificado: null | { emitido: boolean; emitidoEm: string | null; nota: number | null; url: string; nome: string } = null;
  if (turmaId) {
    const res = await resultadosDaTurma(db, regime, turmaId).catch(() => null);
    const meu = res?.formandos.find(f => f.id === id);
    if (meu) {
      const a = meu.assiduidade as { pct: number | null; horasPrevistas: number; horasPresente: number };
      resultado = {
        assiduidade: { pct: a.pct, horasPrevistas: a.horasPrevistas, horasPresente: a.horasPresente, minimo: meu.assiduidadeMinima },
        nota: meu.nota, aprovado: meu.aprovado, elegivel: meu.elegivel, motivos: meu.motivos,
      };
    }
    const cert = await certificadoDoFormando(db, regime, turmaId, id);
    if (cert) {
      certificado = {
        emitido: Boolean(cert.emitido), emitidoEm: iso(cert.emitido_em),
        nota: cert.nota == null ? null : Number(cert.nota), url: cert.ficheiro_url, nome: cert.ficheiro_nome,
      };
    }
  }

  let pagamento = null;
  if (regime === "gold") {
    const valor = Number(row.valor ?? 0);
    const metodo = String(row.metodo ?? "-");
    const movimentos = await pagamentosDoFormando(db, id, email, curso);
    const entidade = await lerEntidade(db);
    pagamento = {
      valor, metodo, pago: Boolean(row.pago),
      situacao: situacaoPagamento(metodo, Boolean(row.pago), valor),
      pedidoEm: iso(origem?.pagamento_pedido_em),
      temIban: Boolean(entidade.iban),
      movimentos: movimentos.map(m => ({
        id: m.id, valor: Number(m.valor ?? 0), metodo: m.metodo, estado: m.estado, data: m.data, pagoEm: iso(m.pago_em),
      })),
      // Comprovativos da pré-inscrição de origem: o do 1.º pagamento e os das prestações seguintes (que continuam a
      // chegar depois de a pessoa estar na turma). Validar, anexar e o lembrete usam a pré-inscrição (`preinscricaoId`).
      ...(await comprovativosDaOrigem(db, origem?.id ?? null)),
    };
  }

  const estado = String(row.estado ?? "");
  const docsCompletos = obrig.every(d => d.estado === "validado");
  const passos = [
    { id: "inscricao", rotulo: "Inscrição", feito: true },
    { id: "documentos", rotulo: "Documentos", feito: docsCompletos },
    ...(regime === "gold" ? [{ id: "pagamento", rotulo: "Pagamento", feito: pagamento?.situacao !== "por_pagar" }] : []),
    { id: "acesso", rotulo: "Acesso à área", feito: Boolean(userId) },
    { id: "formacao", rotulo: "Em formação", feito: Boolean(turmaId) },
    { id: "conclusao", rotulo: "Certificado", feito: Boolean(certificado?.emitido) || /certific/i.test(estado) },
  ];

  return {
    regime,
    id,
    publicId: String(row.public_id ?? ""),
    nome: String(row.nome ?? ""),
    apelido: String(row.apelido ?? ""),
    email,
    telf: readFormandoPii(row).telf || String(row.telf ?? ""),
    estado,
    curso,
    local: regime === "gold" ? String(row.local ?? "") : String(turma?.local ?? ""),
    inscrito: regime === "gold" ? String(row.inscrito ?? "") : "",
    turma: turma ? {
      id: Number(turma.id), nome: turma.nome, curso: turma.curso, local: turma.local, horario: turma.horario,
      inicio: turma.data_inicio, estado: turma.estado, ufcd: turma.ufcd, fechada: Boolean(turma.fechada),
    } : null,
    acesso: {
      tem: Boolean(userId),
      ativa: conta ? Boolean(conta.ativa) : false,
      mudarPalavraPasse: conta ? Boolean(conta.mudar_palavra_passe) : false,
      ultimoAcesso: iso(conta?.ultimo_acesso),
      criadaEm: iso(conta?.criada_em),
    },
    documentos,
    docsResumo: { validados: obrig.filter(d => d.estado === "validado").length, total: obrig.length, recusados: documentos.filter(d => d.estado === "recusado").length },
    ligacaoDocumentos,
    /** Inscrição feita pela equipa: sem emails de documentos nem de pagamento. */
    semEmails: Boolean(row.sem_emails_docs_pagamento),
    pagamento,
    resultado,
    certificado,
    origem: origem ? { preinscricaoId: Number(origem.id), estado: origem.estado, comoConheceu: origem.origem } : null,
    passos,
    notas: notas.map(n => ({ id: Number(n.id), autor: n.autor, texto: n.texto, data: iso(n.created_at) })),
    historico: historico.map(h => ({
      id: Number(h.id), acao: ACCOES[h.action] ?? h.action, autor: h.autor, data: iso(h.created_at),
    })),
  };
}

export type FichaFormando = NonNullable<Awaited<ReturnType<typeof montarFicha>>>;

/** Comprovativos de pagamento da pré-inscrição de origem, um por prestação (ou o único, se pagou de uma vez). */
async function comprovativosDaOrigem(db: Db, leadId: number | null) {
  if (!leadId) return { preinscricaoId: null, comprovativos: [] };
  const lead = await leadsRepo.lead(db, leadId);
  if (!lead) return { preinscricaoId: null, comprovativos: [] };
  const docs = await listarDocsLead(db, leadId);
  const prest = estadoPrestacoes(lead as Record<string, unknown>, docs);
  const ultimo = (tipo: string) => [...docs].reverse().find(d => d.tipo === tipo) ?? null;
  const linhas = prest.length
    ? prest.map(p => ({ n: p.n, tipo: p.tipo, valor: p.valor, estado: p.estado, doc: ultimo(p.tipo) }))
    : ultimo("comprovativo") ? [{ n: 1, tipo: "comprovativo", valor: Number(lead.preco) || 0, estado: "", doc: ultimo("comprovativo") }] : [];
  return {
    preinscricaoId: leadId,
    comprovativos: linhas.map(l => ({
      n: l.n, tipo: l.tipo, valor: l.valor, total: Math.max(1, prest.length),
      estado: (l.doc ? (l.doc.estado === "validado" ? "validado" : l.doc.estado === "recusado" ? "recusado" : "pendente") : "em_falta") as "validado" | "pendente" | "recusado" | "em_falta",
      docId: l.doc?.id ?? null, nome: l.doc?.nome ?? "", url: l.doc?.drive_url ?? "",
      /** Motivo da recusa (o que a pessoa tem de corrigir). */
      observacao: l.doc?.estado === "recusado" ? String(l.doc.observacao ?? "") : "",
    })),
  };
}
