/**
 * Criar e actualizar pré-inscrições (formulário público e CRM).
 * Os dados pessoais sensíveis chegam já cifrados (`pii_enc`) de `pii.ts`.
 */
import { many, one, type Consulta, type Regime } from "./sql.js";

/** Curso activo da oferta com este nome. Fin aceita nome comercial ou UFCD. */
export async function cursoActivoDaOferta(c: Consulta, regime: Regime, nome: string) {
  if (regime === "fin") {
    const r = await one<{ nome: string }>(c,
      `SELECT COALESCE(NULLIF(nome_comercial, ''), ufcd) AS nome FROM cursos_fin
        WHERE (lower(trim(nome_comercial)) = lower(trim($1)) OR lower(trim(ufcd)) = lower(trim($1)))
          AND lower(COALESCE(estado, 'Ativo')) LIKE 'ativ%'
        LIMIT 1`,
      [nome]);
    return r ? { nome: r.nome, preco: 0 } : null;
  }
  const r = await one<{ nome: string; preco: unknown }>(c,
    `SELECT nome, preco FROM cursos_gold
      WHERE lower(trim(nome)) = lower(trim($1)) AND lower(COALESCE(estado, 'Ativo')) LIKE 'ativ%'
      LIMIT 1`,
    [nome]);
  return r ? { nome: r.nome, preco: Number(r.preco) || 0 } : null;
}

export async function valoresSettings(c: Consulta, id: string) {
  const r = await one<{ values: unknown }>(c, "SELECT values FROM app_settings WHERE id = $1", [id]);
  return r?.values && typeof r.values === "object" ? r.values as Record<string, unknown> : {};
}

/** Serializa, até ao fim da transacção, os pedidos do mesmo email para o mesmo curso (duplo clique no site). */
export async function bloquearPedido(c: Consulta, email: string, curso: string) {
  await one(c, "SELECT 1 AS ok FROM pg_advisory_xact_lock(hashtext(lower($1) || '|' || lower(trim($2))))", [email, curso]);
}

/** Pedido aberto (não validado, nem desistência, nem formando) do mesmo email para o mesmo curso. */
/**
 * Pedido repetido no site (mesmo email e curso, ainda aberto): passa a contar como recente (data do pedido) e fica
 * com o local, o horário e o início escolhidos agora, quando vêm preenchidos. Devolve a data anterior.
 */
export async function renovarPedido(c: Consulta, id: number, p: { inscrito: string; local: string; horario: string; inicioCurso: string }) {
  const antes = await one<{ inscrito: string }>(c, "SELECT inscrito FROM preinscricoes WHERE id = $1", [id]);
  await one(c,
    `UPDATE preinscricoes SET inscrito = $2, ultima_actividade_em = now(),
            local = CASE WHEN $3 <> '' THEN $3 ELSE local END,
            horario = CASE WHEN $4 <> '' THEN $4 ELSE horario END,
            inicio_curso = CASE WHEN $5 NOT IN ('', 'A confirmar') THEN $5 ELSE inicio_curso END
      WHERE id = $1`,
    [id, p.inscrito, p.local, p.horario, p.inicioCurso]);
  return antes?.inscrito ?? "";
}

export async function pedidoAberto(c: Consulta, email: string, curso: string) {
  return one<{
    id: number; nome: string; apelido: string; curso: string; public_id: string; regime: string; ligacao_reenviada_em: unknown;
    estado: string; validada_em: unknown; docs_token_usado_em: unknown; docs_token_criado_em: unknown; created_at: unknown;
  }>(c,
    `SELECT id, nome, apelido, curso, public_id, regime, ligacao_reenviada_em,
            estado, validada_em, docs_token_usado_em, docs_token_criado_em, created_at FROM preinscricoes
      WHERE lower(email) = $1 AND lower(trim(curso)) = lower(trim($2))
        AND validada_em IS NULL AND estado NOT IN ('Desistiu', 'Formando')
      ORDER BY id DESC LIMIT 1`,
    [email, curso]);
}

export async function marcarLigacaoReenviada(c: Consulta, id: number) {
  await many(c, "UPDATE preinscricoes SET ligacao_reenviada_em = now() WHERE id = $1", [id]);
}

export type NovoLead = {
  id: number;
  inscrito: string;
  nome: string;
  apelido: string;
  email: string;
  telf: string;
  inicioCurso: string;
  concelho: string;
  local: string;
  curso: string;
  preco: number;
  estado: string;
  campanha: string;
  campanhaId: number | null;
  origem: string;
  entrada: "preinscricao" | "manual";
  meioContacto: string;
  horario: string;
  turmaId: number | null;
  pagamentoMetodo: string;
  regime: Regime;
  piiEnc: string;
  publicId: string;
  comercialId?: string | null;
  etiquetaId?: number | null;
  nif?: string;
  moradaFiscal?: string;
  codigoPostal?: string;
  consentimento?: { ip: string; versao: string } | null;
  /** Notas para a equipa (ex.: o texto livre de um pedido fora da oferta). */
  notas?: string;
};

/** PII do pedido (cifra e colunas legadas), para juntar os dados pessoais da financiada a um pedido repetido. */
export function piiDoPedido(c: Consulta, id: number) {
  return one<{ pii_enc: string; nif: string; morada_fiscal: string; codigo_postal: string; telf: string }>(c,
    `SELECT COALESCE(pii_enc, '') AS pii_enc, COALESCE(nif, '') AS nif, COALESCE(morada_fiscal, '') AS morada_fiscal,
            COALESCE(codigo_postal, '') AS codigo_postal, COALESCE(telf, '') AS telf
       FROM preinscricoes WHERE id = $1`, [id]);
}

export async function gravarPiiDoPedido(c: Consulta, id: number, pack: { nif: string; morada_fiscal: string; codigo_postal: string; telf: string; pii_enc: string | null }) {
  await many(c,
    "UPDATE preinscricoes SET nif = $2, morada_fiscal = $3, codigo_postal = $4, telf = $5, pii_enc = COALESCE($6, pii_enc) WHERE id = $1",
    [id, pack.nif, pack.morada_fiscal, pack.codigo_postal, pack.telf, pack.pii_enc]);
}

/** Financiada (ligação pessoal): o concelho da morada fica na coluna de sempre; o resto vai no pacote cifrado. */
export async function gravarConcelho(c: Consulta, id: number, concelho: string) {
  await many(c, "UPDATE preinscricoes SET concelho = $2 WHERE id = $1", [id, concelho]);
}

/** Financiada: aceitação dos termos e do uso dos dados (quando, de onde e que versão). */
export async function gravarTermosFin(c: Consulta, id: number, ip: string, versao: string) {
  await many(c, "UPDATE preinscricoes SET termos_fin_em = now(), termos_fin_ip = $2, termos_fin_versao = $3 WHERE id = $1", [id, ip, versao]);
}

export async function inserirLead(c: Consulta, l: NovoLead) {
  await many(c,
    `INSERT INTO preinscricoes (id, inscrito, nome, apelido, email, telf, inicio_curso, concelho, local, curso, preco, estado,
                                campanha, campanha_id, origem, entrada, meio_contacto, horario, turma_id, pagamento_metodo, regime,
                                pii_enc, public_id, comercial_id, etiqueta_id, nif, morada_fiscal, codigo_postal,
                                consentimento_em, consentimento_ip, consentimento_versao, notas)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,
             CASE WHEN $29 THEN now() ELSE NULL END, $30, $31, $32)`,
    [
      l.id, l.inscrito, l.nome, l.apelido, l.email, l.telf, l.inicioCurso, l.concelho, l.local, l.curso, l.preco, l.estado,
      l.campanha, l.campanhaId, l.origem, l.entrada, l.meioContacto, l.horario, l.turmaId, l.pagamentoMetodo, l.regime,
      l.piiEnc, l.publicId, l.comercialId ?? null, l.etiquetaId ?? null, l.nif ?? "", l.moradaFiscal ?? "", l.codigoPostal ?? "",
      Boolean(l.consentimento), l.consentimento?.ip ?? "", l.consentimento?.versao ?? "", l.notas ?? "",
    ]);
}

/** Campos da ficha que o CRM pode mudar. `undefined` mantém o valor. */
export type AlteracaoLead = Partial<{
  nome: string; apelido: string; email: string; telf: string; concelho: string; origem: string; curso: string;
  local: string; inicioCurso: string; preco: number; campanha: string; campanhaId: number | null; estado: string;
  proximoContacto: string; notas: string; comercialId: string; meioContacto: string; horario: string; turmaId: number;
  nif: string; moradaFiscal: string; codigoPostal: string; motivoDesistencia: string; pagamentoMetodo: string; piiEnc: string;
}> & { etiquetaId?: number | null; publicId: string };

export async function actualizarLead(c: Consulta, id: number, d: AlteracaoLead) {
  const v = <T>(x: T | undefined) => (x === undefined ? null : x);
  await many(c,
    `UPDATE preinscricoes SET
       nome = COALESCE($2, nome), apelido = COALESCE($3, apelido), email = COALESCE($4, email),
       telf = COALESCE($5, telf), concelho = COALESCE($6, concelho), origem = COALESCE($7, origem),
       curso = COALESCE($8, curso), local = COALESCE($9, local), inicio_curso = COALESCE($10, inicio_curso),
       preco = COALESCE($11, preco), campanha = COALESCE($12, campanha), estado = COALESCE($13, estado),
       proximo_contacto = COALESCE($14, proximo_contacto), notas = COALESCE($15, notas),
       comercial_id = COALESCE($16, comercial_id),
       meio_contacto = COALESCE($17, meio_contacto),
       etiqueta_id = CASE WHEN $18::int = -1 THEN etiqueta_id WHEN $18 = 0 THEN NULL ELSE $18 END,
       horario = COALESCE($19, horario),
       turma_id = COALESCE($20, turma_id),
       nif = COALESCE($21, nif),
       morada_fiscal = COALESCE($22, morada_fiscal),
       codigo_postal = COALESCE($23, codigo_postal),
       motivo_desistencia = COALESCE($24, motivo_desistencia),
       pagamento_metodo = COALESCE($25, pagamento_metodo),
       pii_enc = COALESCE($26, pii_enc),
       public_id = CASE WHEN COALESCE(public_id, '') = '' THEN $27 ELSE public_id END,
       campanha_id = CASE WHEN $28::int = -1 THEN campanha_id WHEN $28 = 0 THEN NULL ELSE $28 END
     WHERE id = $1`,
    [
      id, v(d.nome), v(d.apelido), v(d.email), v(d.telf), v(d.concelho), v(d.origem), v(d.curso), v(d.local),
      v(d.inicioCurso), v(d.preco), v(d.campanha), v(d.estado), v(d.proximoContacto), v(d.notas), v(d.comercialId),
      v(d.meioContacto), d.etiquetaId === undefined ? -1 : (d.etiquetaId ?? 0), v(d.horario), v(d.turmaId),
      v(d.nif), v(d.moradaFiscal), v(d.codigoPostal), v(d.motivoDesistencia), v(d.pagamentoMetodo), v(d.piiEnc),
      d.publicId, d.campanhaId === undefined ? -1 : (d.campanhaId ?? 0),
    ]);
}

/**
 * Completar a pré-inscrição (NIF e morada) e, se pedido, passá-la à etapa «Pré-inscrição».
 * A PII chega já junta e cifrada (`writePreinscricaoPii`): as colunas em claro ficam como vierem.
 */
export async function completarLead(c: Consulta, id: number, d: {
  nome: string; apelido: string; email: string; concelho: string; curso: string; local: string;
  horario: string; inicioCurso: string; telf: string; nif: string; moradaFiscal: string; codigoPostal: string;
  piiEnc: string | null; preInscricao: boolean;
}) {
  await many(c,
    `UPDATE preinscricoes SET
       nome = COALESCE(NULLIF($2,''), nome), apelido = COALESCE(NULLIF($3,''), apelido),
       email = COALESCE(NULLIF($4,''), email), telf = $5,
       concelho = COALESCE(NULLIF($6,''), concelho), curso = COALESCE(NULLIF($7,''), curso),
       local = COALESCE(NULLIF($8,''), local), horario = COALESCE(NULLIF($9,''), horario),
       inicio_curso = COALESCE(NULLIF($10,''), inicio_curso),
       nif = $11, morada_fiscal = $12, codigo_postal = $13, pii_enc = COALESCE($14, pii_enc),
       estado = CASE WHEN $15::boolean THEN 'Pré-inscrição' ELSE estado END
     WHERE id = $1`,
    [id, d.nome, d.apelido, d.email, d.telf, d.concelho, d.curso, d.local, d.horario, d.inicioCurso, d.nif, d.moradaFiscal, d.codigoPostal,
      d.piiEnc, d.preInscricao]);
}
