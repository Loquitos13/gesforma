import { firePreinscricaoEmail, maybeEnviarPagamentoAposDocs } from "./docsLink.js";
import { precoParaOferta } from "./precoOferta.js";
import { findDuplicados, logLeadEvent } from "./crmDossier.js";
import type { Db } from "./db/pool.js";
import { newPublicId, nextOpsId } from "./ops.js";
import { opaqueRef } from "./fieldCrypto.js";
import { writePreinscricaoPii } from "./pii.js";
import { resolverTurmaOferta } from "./ofertaGold.js";
import { isEmail, normalizeEmail, sanitizeHeader, textoDePessoa } from "./security.js";

async function metodoPagamentoConhecido(db: Db, nome: string) {
  const row = await db.query(
    `SELECT 1 FROM catalog_items
      WHERE kind = 'lista_opcoes'
        AND payload->>'lista' = 'metodos_pagamento'
        AND payload->>'nome' = $1
      LIMIT 1`,
    [nome],
  );
  return Boolean(row.rows[0]);
}

function nowStamp() {
  return new Date().toISOString().slice(0, 16).replace("T", " ");
}

export type PreinscricaoPublicaInput = {
  nome: string;
  apelido?: string;
  email: string;
  telf?: string;
  concelho?: string;
  origem?: string;
  curso?: string;
  local?: string;
  inicioCurso?: string;
  horario?: string;
  turmaId?: number;
  campanha?: string;
  meioContacto?: string;
  pagamentoMetodo?: string;
  acessoImediato?: boolean;
  regime?: "gold" | "fin";
  /** Aceitação da política de privacidade no formulário (RGPD). */
  consentimento?: boolean;
};

/** Curso activo da oferta com este nome. Devolve o nome canónico e o preço base (Gold). */
async function cursoDaOferta(db: Db, regime: "gold" | "fin", nome: string) {
  if (!nome.trim()) return null;
  if (regime === "fin") {
    const r = await db.query<{ nome: string }>(
      `SELECT COALESCE(NULLIF(nome_comercial, ''), ufcd) AS nome FROM cursos_fin
        WHERE (lower(trim(nome_comercial)) = lower(trim($1)) OR lower(trim(ufcd)) = lower(trim($1)))
          AND lower(COALESCE(estado, 'Ativo')) LIKE 'ativ%'
        LIMIT 1`,
      [nome],
    );
    return r.rows[0] ? { nome: r.rows[0].nome, preco: 0 } : null;
  }
  const r = await db.query<{ nome: string; preco: unknown }>(
    `SELECT nome, preco FROM cursos_gold
      WHERE lower(trim(nome)) = lower(trim($1)) AND lower(COALESCE(estado, 'Ativo')) LIKE 'ativ%'
      LIMIT 1`,
    [nome],
  );
  return r.rows[0] ? { nome: r.rows[0].nome, preco: Number(r.rows[0].preco) || 0 } : null;
}

/** O consentimento passa a obrigatório quando o administrador o activa (Sistema → Site). */
async function regrasConsentimento(db: Db) {
  const r = await db.query<{ values: Record<string, unknown> }>("SELECT values FROM app_settings WHERE id = 'site'");
  const v = r.rows[0]?.values ?? {};
  return {
    exigir: ["1", "true", "sim"].includes(String(v.rgpdObrigatorio ?? "").trim().toLowerCase()),
    versao: String(v.rgpdVersao ?? "").trim().slice(0, 40) || "1",
  };
}

const MINUTOS_REENVIO = 10;

/**
 * Pré-inscrição vinda do site. A resposta nunca devolve dados da ficha: só a referência opaca e o aviso.
 * O preço vem sempre da oferta (nunca do pedido). Um curso fora da oferta fica como contacto, sem pedido de pagamento.
 */
export async function criarPreinscricaoPublica(
  db: Db,
  input: PreinscricaoPublicaInput,
  meta: { ip?: string } = {},
) {
  const email = normalizeEmail(input.email);
  if (!isEmail(email)) return { error: "email inválido" as const };
  const consent = await regrasConsentimento(db);
  if (consent.exigir && input.consentimento !== true) {
    return { error: "aceite a política de privacidade" as const };
  }
  const regime = input.regime === "fin" ? "fin" : "gold";
  const pedidoCurso = sanitizeHeader(input.curso || "");
  const oferta = await cursoDaOferta(db, regime, pedidoCurso);
  const curso = oferta?.nome ?? (pedidoCurso || "Contacto pelo site");
  const origem = sanitizeHeader(input.origem || "Website") || "Website";
  const meio = sanitizeHeader(input.meioContacto || origem);
  const telf = sanitizeHeader(input.telf || "");
  const turma = oferta
    ? await resolverTurmaOferta(db, {
      turmaId: input.turmaId,
      curso,
      local: input.local,
      horario: input.horario,
      dataInicio: input.inicioCurso,
      regime,
    })
    : null;
  if (input.turmaId && !turma) return { error: "a turma escolhida já não está libertada" as const };
  const acessoImediato = Boolean(input.acessoImediato) && !turma;
  const local = sanitizeHeader(turma?.local || input.local || (acessoImediato ? "Online" : ""));
  const horario = sanitizeHeader(turma?.horario || input.horario || "");
  const pedidoInicio = input.inicioCurso && input.inicioCurso !== "-" ? input.inicioCurso : "";
  const inicio = turma?.dataInicio || pedidoInicio || (acessoImediato ? "Acesso imediato" : "A confirmar");
  const turmaId = turma?.turmaId ?? null;
  const metodo = sanitizeHeader(input.pagamentoMetodo || "");
  if (metodo && !(await metodoPagamentoConhecido(db, metodo))) {
    return { error: "forma de pagamento desconhecida" as const };
  }

  // Duplicado só quando há um pedido ABERTO do mesmo email para o MESMO curso.
  const aberto = await db.query<{ id: number; nome: string; apelido: string; curso: string; public_id: string; ligacao_reenviada_em: unknown }>(
    `SELECT id, nome, apelido, curso, public_id, ligacao_reenviada_em FROM preinscricoes
      WHERE lower(email) = $1 AND lower(trim(curso)) = lower(trim($2))
        AND validada_em IS NULL AND estado NOT IN ('Desistiu', 'Formando')
      ORDER BY id DESC LIMIT 1`,
    [email, curso],
  );
  const existente = aberto.rows[0];
  if (existente) {
    const ultimo = existente.ligacao_reenviada_em ? new Date(String(existente.ligacao_reenviada_em)).getTime() : 0;
    if (Date.now() - ultimo > MINUTOS_REENVIO * 60_000) {
      await firePreinscricaoEmail(db, {
        id: existente.id, email, nome: existente.nome, apelido: existente.apelido, curso: existente.curso,
      }, "preinscricao.created", `preinscricao:${existente.id}:${email}:${Date.now()}`).catch(() => undefined);
      await db.query("UPDATE preinscricoes SET ligacao_reenviada_em = now() WHERE id = $1", [existente.id]);
      await logLeadEvent(db, existente.id, undefined, "contacto", "Novo pedido no site · ligação reenviada", origem);
    }
    return {
      duplicado: true as const,
      preinscricao: { id: existente.id, ref: opaqueRef("pre", existente.id, existente.public_id || null) },
      aviso: "Já temos o seu pedido para este curso. Reenviámos para o seu email a ligação pessoal para continuar.",
    };
  }

  const preco = oferta && regime === "gold"
    ? (await precoParaOferta(db, curso, local, horario)) ?? oferta.preco
    : 0;
  const id = await nextOpsId(db);
  const publicId = newPublicId();
  const piiPack = writePreinscricaoPii({ telf });
  await db.query(
    `INSERT INTO preinscricoes (id, inscrito, nome, apelido, email, telf, inicio_curso, concelho, local, curso, preco, estado, campanha, origem, entrada, meio_contacto, horario, turma_id, pagamento_metodo, regime, pii_enc, public_id,
                                consentimento_em, consentimento_ip, consentimento_versao)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'Não contactado',$12,$13,'preinscricao',$14,$15,$16,$17,$18,$19,$20,
             CASE WHEN $21 THEN now() ELSE NULL END, $22, $23)`,
    [
      id, nowStamp(), textoDePessoa(input.nome), textoDePessoa(input.apelido || ""), email,
      piiPack.telf || telf, inicio, textoDePessoa(input.concelho || ""),
      local, curso, preco,
      sanitizeHeader(input.campanha || ""), origem, meio, horario, turmaId, metodo, regime,
      piiPack.pii_enc ?? "", publicId,
      input.consentimento === true, input.consentimento === true ? (meta.ip ?? "").slice(0, 64) : "",
      input.consentimento === true ? consent.versao : "",
    ],
  );
  const detalhe = [origem, curso, local, horario, inicio !== "-" ? inicio : ""].filter(Boolean).join(" · ");
  await logLeadEvent(db, id, undefined, "criacao", "Pré-inscrição recebida", detalhe);
  if (!oferta) await logLeadEvent(db, id, undefined, "campo", "Curso fora da oferta", `Pedido: ${pedidoCurso || "sem curso"}. Sem pedido de pagamento.`);
  const outros = await findDuplicados(db, email, telf, id).catch(() => []);
  if (Array.isArray(outros) && outros.length) {
    await logLeadEvent(db, id, undefined, "campo", "Possível duplicado", `Outros pedidos com o mesmo contacto: ${outros.map(o => `#${(o as { id: number }).id}`).join(", ")}`);
  }
  await firePreinscricaoEmail(db, { id, email, nome: input.nome, apelido: input.apelido, curso, regime }, "preinscricao.created", `preinscricao:${id}:${email}`).catch(() => undefined);
  if (oferta) await maybeEnviarPagamentoAposDocs(db, id).catch(() => undefined);
  return {
    duplicado: false as const,
    preinscricao: { id, ref: opaqueRef("pre", id, publicId) },
    aviso: "Enviámos um email com a ligação para submeter os documentos do curso.",
  };
}
