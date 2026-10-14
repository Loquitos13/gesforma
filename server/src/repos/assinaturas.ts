/**
 * Assinatura de contratos: pedidos, códigos de confirmação, registo de provas e o certificado do selo.
 */
import { many, one, valor, type Consulta } from "./sql.js";

const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0));
const txt = (v: unknown) => String(v ?? "");
const iso = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString() : String(v));

export type EstadoAssinatura = "enviado" | "aberto" | "assinado" | "recusado" | "expirado" | "cancelado";
export type MetodoAssinatura = "desenhada" | "escrita" | "cc_cmd";

export function bytesDe(v: unknown): Buffer {
  if (Buffer.isBuffer(v)) return v;
  if (v instanceof Uint8Array) return Buffer.from(v);
  if (typeof v === "string" && v.startsWith("\\x")) return Buffer.from(v.slice(2), "hex");
  return Buffer.alloc(0);
}

const COLUNAS = `a.id, a.contrato_id, a.estado, a.titulo, a.signatario_nome, a.signatario_email, a.signatario_nif_enc, a.nif_origem,
  a.formando_regime, a.formando_id, a.cliente_id, a.enviado_por, a.enviado_em, a.expira_em, a.aberto_em, a.assinado_em,
  a.recusado_em, a.cancelado_em, a.motivo, a.metodo, a.hash_original, a.hash_assinatura, a.hash_final,
  a.certificado_fingerprint, a.certificado_titular, a.selado, a.drive_file_id, a.reenvios, a.codigo_verificacao,
  (a.pdf_assinado IS NOT NULL) AS tem_assinado, u.name AS enviado_por_nome`;

export function mapAssinatura(r: Record<string, unknown>) {
  return {
    id: num(r.id), contratoId: num(r.contrato_id), estado: txt(r.estado) as EstadoAssinatura, titulo: txt(r.titulo),
    signatarioNome: txt(r.signatario_nome), signatarioEmail: txt(r.signatario_email), nifEnc: txt(r.signatario_nif_enc),
    nifOrigem: txt(r.nif_origem), formandoRegime: r.formando_regime ? (txt(r.formando_regime) as "gold" | "fin") : null,
    formandoId: r.formando_id == null ? null : num(r.formando_id), clienteId: r.cliente_id == null ? null : num(r.cliente_id),
    enviadoPor: txt(r.enviado_por), enviadoPorNome: txt(r.enviado_por_nome), enviadoEm: iso(r.enviado_em), expiraEm: iso(r.expira_em),
    abertoEm: iso(r.aberto_em), assinadoEm: iso(r.assinado_em), recusadoEm: iso(r.recusado_em), canceladoEm: iso(r.cancelado_em),
    motivo: txt(r.motivo), metodo: r.metodo ? (txt(r.metodo) as MetodoAssinatura) : null, hashOriginal: txt(r.hash_original),
    hashAssinatura: txt(r.hash_assinatura), hashFinal: txt(r.hash_final), certificadoFingerprint: txt(r.certificado_fingerprint),
    certificadoTitular: txt(r.certificado_titular), selado: Boolean(r.selado), driveFileId: r.drive_file_id ? txt(r.drive_file_id) : null,
    reenvios: num(r.reenvios), codigoVerificacao: txt(r.codigo_verificacao), temAssinado: Boolean(r.tem_assinado),
  };
}

export type Assinatura = ReturnType<typeof mapAssinatura>;

/** Pedidos ainda à espera de assinatura cujo prazo passou ficam "expirado". */
export async function expirarVencidos(c: Consulta) {
  await many(
    c,
    `UPDATE contrato_assinaturas SET estado = 'expirado'
      WHERE estado IN ('enviado', 'aberto') AND expira_em < now() RETURNING id`,
  );
}

export type NovaAssinatura = {
  contratoId: number; tokenHash: string; codigo: string; titulo: string; nome: string; email: string; nifEnc: string;
  nifOrigem: string; formandoRegime: "gold" | "fin" | null; formandoId: number | null; clienteId: number | null;
  enviadoPor: string | null; expiraEm: Date; pdf: Buffer; hash: string;
};

export async function criarAssinatura(c: Consulta, d: NovaAssinatura) {
  return num(await valor(
    c,
    `INSERT INTO contrato_assinaturas
       (contrato_id, token_hash, codigo_verificacao, titulo, signatario_nome, signatario_email, signatario_nif_enc, nif_origem,
        formando_regime, formando_id, cliente_id, enviado_por, expira_em, pdf_original, hash_original)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
    [d.contratoId, d.tokenHash, d.codigo, d.titulo, d.nome, d.email, d.nifEnc, d.nifOrigem, d.formandoRegime, d.formandoId,
      d.clienteId, d.enviadoPor, d.expiraEm.toISOString(), d.pdf, d.hash],
  ));
}

/** Cancela os pedidos ainda abertos de um contrato (ao enviar um novo ou ao cancelar). */
export async function cancelarAbertas(c: Consulta, contratoId: number, motivo: string) {
  return many<{ id: number }>(
    c,
    `UPDATE contrato_assinaturas SET estado = 'cancelado', cancelado_em = now(), motivo = $2
      WHERE contrato_id = $1 AND estado IN ('enviado', 'aberto') RETURNING id`,
    [contratoId, motivo],
  );
}

export async function obterAssinatura(c: Consulta, id: number) {
  const r = await one(c, `SELECT ${COLUNAS} FROM contrato_assinaturas a LEFT JOIN users u ON u.id = a.enviado_por WHERE a.id = $1`, [id]);
  return r ? mapAssinatura(r) : null;
}

export async function obterPorToken(c: Consulta, tokenHash: string) {
  const r = await one(c, `SELECT ${COLUNAS} FROM contrato_assinaturas a LEFT JOIN users u ON u.id = a.enviado_por WHERE a.token_hash = $1`, [tokenHash]);
  return r ? mapAssinatura(r) : null;
}

export async function obterPorCodigo(c: Consulta, codigo: string) {
  const r = await one(c, `SELECT ${COLUNAS} FROM contrato_assinaturas a LEFT JOIN users u ON u.id = a.enviado_por WHERE a.codigo_verificacao = $1`, [codigo]);
  return r ? mapAssinatura(r) : null;
}

export async function listarDoContrato(c: Consulta, contratoId: number) {
  const linhas = await many(
    c,
    `SELECT ${COLUNAS} FROM contrato_assinaturas a LEFT JOIN users u ON u.id = a.enviado_por WHERE a.contrato_id = $1 ORDER BY a.id DESC LIMIT 20`,
    [contratoId],
  );
  return linhas.map(mapAssinatura);
}

export async function pdfOriginal(c: Consulta, id: number) {
  const r = await one<{ pdf_original: unknown }>(c, "SELECT pdf_original FROM contrato_assinaturas WHERE id = $1", [id]);
  return r ? bytesDe(r.pdf_original) : null;
}

export async function pdfAssinado(c: Consulta, id: number) {
  const r = await one<{ pdf_assinado: unknown }>(c, "SELECT pdf_assinado FROM contrato_assinaturas WHERE id = $1", [id]);
  const b = r ? bytesDe(r.pdf_assinado) : Buffer.alloc(0);
  return b.length ? b : null;
}

export async function marcarAberto(c: Consulta, id: number) {
  await many(
    c,
    "UPDATE contrato_assinaturas SET estado = 'aberto', aberto_em = COALESCE(aberto_em, now()) WHERE id = $1 AND estado = 'enviado' RETURNING id",
    [id],
  );
}

export async function novoToken(c: Consulta, id: number, tokenHash: string, expiraEm: Date) {
  await many(
    c,
    `UPDATE contrato_assinaturas SET token_hash = $2, expira_em = $3, reenvios = reenvios + 1,
            estado = CASE WHEN estado = 'expirado' THEN 'enviado' ELSE estado END
      WHERE id = $1 RETURNING id`,
    [id, tokenHash, expiraEm.toISOString()],
  );
}

export async function marcarRecusado(c: Consulta, id: number, motivo: string) {
  await many(
    c,
    "UPDATE contrato_assinaturas SET estado = 'recusado', recusado_em = now(), motivo = $2 WHERE id = $1 AND estado IN ('enviado', 'aberto') RETURNING id",
    [id, motivo],
  );
}

export async function cancelar(c: Consulta, id: number, motivo: string) {
  const r = await many(
    c,
    `UPDATE contrato_assinaturas SET estado = 'cancelado', cancelado_em = now(), motivo = $2
      WHERE id = $1 AND estado IN ('enviado', 'aberto', 'expirado') RETURNING id`,
    [id, motivo],
  );
  return r.length > 0;
}

export type Conclusao = {
  metodo: MetodoAssinatura; pdf: Buffer; hashAssinatura: string; hashFinal: string; fingerprint: string; titular: string; selado: boolean;
};

/** Só conclui se o pedido ainda estiver por assinar (evita duas assinaturas em simultâneo). */
export async function concluir(c: Consulta, id: number, d: Conclusao) {
  const r = await many(
    c,
    `UPDATE contrato_assinaturas SET estado = 'assinado', assinado_em = now(), metodo = $2, pdf_assinado = $3,
            hash_assinatura = $4, hash_final = $5, certificado_fingerprint = $6, certificado_titular = $7, selado = $8
      WHERE id = $1 AND estado IN ('enviado', 'aberto') RETURNING id`,
    [id, d.metodo, d.pdf, d.hashAssinatura, d.hashFinal, d.fingerprint, d.titular, d.selado],
  );
  return r.length > 0;
}

export async function ligarDrive(c: Consulta, id: number, driveFileId: string) {
  await many(c, "UPDATE contrato_assinaturas SET drive_file_id = $2 WHERE id = $1 RETURNING id", [id, driveFileId]);
}

// ─── Códigos de confirmação ────────────────────────────────────────────────────

/** Quantos códigos se pediram na última hora, e há quantos segundos foi o último. */
export async function codigosRecentes(c: Consulta, assinaturaId: number) {
  const r = await one<{ n: number; segundos: number | null }>(
    c,
    `SELECT count(*)::int AS n, EXTRACT(EPOCH FROM (now() - max(criado_em)))::int AS segundos
       FROM assinatura_codigos WHERE assinatura_id = $1 AND criado_em > now() - interval '1 hour'`,
    [assinaturaId],
  );
  return { n: num(r?.n), segundos: r?.segundos == null ? null : num(r.segundos) };
}

export async function criarCodigo(c: Consulta, assinaturaId: number, codigoHash: string, minutos: number) {
  await many(
    c,
    `UPDATE assinatura_codigos SET usado_em = COALESCE(usado_em, now()) WHERE assinatura_id = $1 AND usado_em IS NULL RETURNING id`,
    [assinaturaId],
  );
  await one(
    c,
    `INSERT INTO assinatura_codigos (assinatura_id, codigo_hash, expira_em)
     VALUES ($1, $2, now() + ($3::int * interval '1 minute')) RETURNING id`,
    [assinaturaId, codigoHash, minutos],
  );
}

export async function codigoActivo(c: Consulta, assinaturaId: number) {
  return one<{ id: number; codigo_hash: string; tentativas: number; expirado: boolean }>(
    c,
    `SELECT id, codigo_hash, tentativas, (expira_em < now()) AS expirado FROM assinatura_codigos
      WHERE assinatura_id = $1 AND usado_em IS NULL ORDER BY id DESC LIMIT 1`,
    [assinaturaId],
  );
}

export async function falharCodigo(c: Consulta, id: number, maximo: number) {
  const r = await one<{ tentativas: number }>(
    c,
    `UPDATE assinatura_codigos SET tentativas = tentativas + 1,
            usado_em = CASE WHEN tentativas + 1 >= $2 THEN now() ELSE usado_em END
      WHERE id = $1 RETURNING tentativas`,
    [id, maximo],
  );
  return num(r?.tentativas);
}

export async function gastarCodigo(c: Consulta, id: number) {
  await many(c, "UPDATE assinatura_codigos SET usado_em = now() WHERE id = $1 RETURNING id", [id]);
}

// ─── Registo de provas ─────────────────────────────────────────────────────────

export async function registarEvento(
  c: Consulta,
  assinaturaId: number,
  tipo: string,
  meta: { ip?: string; userAgent?: string; detalhe?: Record<string, unknown> } = {},
) {
  await one(
    c,
    `INSERT INTO assinatura_eventos (assinatura_id, tipo, ip, user_agent, detalhe) VALUES ($1,$2,$3,$4,$5::jsonb) RETURNING id`,
    [assinaturaId, tipo, (meta.ip ?? "").slice(0, 64), (meta.userAgent ?? "").slice(0, 300), JSON.stringify(meta.detalhe ?? {})],
  );
}

export async function eventos(c: Consulta, assinaturaId: number) {
  const linhas = await many(
    c,
    "SELECT id, tipo, em, ip, user_agent, detalhe FROM assinatura_eventos WHERE assinatura_id = $1 ORDER BY id",
    [assinaturaId],
  );
  return linhas.map(r => ({
    id: num(r.id), tipo: txt(r.tipo), em: iso(r.em), ip: txt(r.ip), userAgent: txt(r.user_agent),
    detalhe: (r.detalhe ?? {}) as Record<string, unknown>,
  }));
}

// ─── Contratos e signatários ───────────────────────────────────────────────────

export async function contratoParaAssinar(c: Consulta, id: number) {
  return one<{
    id: number; cliente_id: number | null; cliente_nome: string; cliente_email: string; curso: string; valor: unknown;
    estado: string; corpo: string; formando_regime: string | null; formando_id: number | null; created_at: unknown; comercial_id: string;
  }>(
    c,
    `SELECT id, cliente_id, cliente_nome, cliente_email, curso, valor, estado, corpo, formando_regime, formando_id, created_at, comercial_id
       FROM contratos_comerciais WHERE id = $1`,
    [id],
  );
}

export async function marcarContrato(c: Consulta, id: number, estado: "Rascunho" | "Por assinar" | "Assinado") {
  await many(
    c,
    `UPDATE contratos_comerciais SET estado = $2, updated_at = now(),
            assinado_em = CASE WHEN $2 = 'Assinado' THEN now() ELSE NULL END
      WHERE id = $1 RETURNING id`,
    [id, estado],
  );
}

export async function clienteSignatario(c: Consulta, id: number) {
  return one<{ nome: string; email: string; nif: string }>(c, "SELECT nome, email, nif FROM crm_clientes WHERE id = $1", [id]);
}

export async function formandoSignatario(c: Consulta, regime: "gold" | "fin", id: number) {
  const tabela = regime === "gold" ? "formandos_gold" : "formandos_fin";
  return one<{ id: number; nome: string; apelido: string; email: string; curso: string; turma: string; turma_id: number | null }>(
    c,
    `SELECT f.id, f.nome, f.apelido, f.email, f.curso, f.turma, f.turma_id FROM ${tabela} f WHERE f.id = $1`,
    [id],
  );
}

/** NIF do formando: vem da pré-inscrição (mesmo email; de preferência o mesmo curso), onde está cifrado. */
export async function preinscricaoComNif(c: Consulta, regime: "gold" | "fin", email: string, curso: string) {
  return one<Record<string, unknown>>(
    c,
    `SELECT id, nif, pii_enc FROM preinscricoes
      WHERE lower(email) = lower($1) AND COALESCE(regime, 'gold') = $2
      ORDER BY (lower(trim(curso)) = lower(trim($3))) DESC, id DESC LIMIT 1`,
    [email, regime, curso],
  );
}

export async function nomeTurma(c: Consulta, regime: "gold" | "fin", turmaId: number) {
  const tabela = regime === "gold" ? "turmas_gold" : "turmas_fin";
  return valor<string>(c, `SELECT nome FROM ${tabela} WHERE id = $1`, [turmaId]);
}

export async function emailUtilizador(c: Consulta, id: string) {
  return one<{ name: string; email: string }>(c, "SELECT name, email FROM users WHERE id = $1::uuid AND active = true", [id]);
}

// ─── Contratos de formação do formando ─────────────────────────────────────────

export async function contratosDoFormando(c: Consulta, regime: "gold" | "fin", formandoId: number) {
  const linhas = await many(
    c,
    `SELECT k.id, k.curso, k.valor, k.estado, k.assinado_em, k.created_at, t.nome AS modelo,
            (SELECT a.id FROM contrato_assinaturas a WHERE a.contrato_id = k.id ORDER BY a.id DESC LIMIT 1) AS assinatura_id,
            (SELECT a.estado FROM contrato_assinaturas a WHERE a.contrato_id = k.id ORDER BY a.id DESC LIMIT 1) AS assinatura_estado
       FROM contratos_comerciais k LEFT JOIN contrato_templates t ON t.id = k.template_id
      WHERE k.formando_regime = $1 AND k.formando_id = $2 ORDER BY k.created_at DESC, k.id DESC`,
    [regime, formandoId],
  );
  return linhas.map(r => ({
    id: num(r.id), curso: txt(r.curso), valor: num(r.valor), estado: txt(r.estado), modelo: txt(r.modelo),
    assinadoEm: iso(r.assinado_em), criadoEm: iso(r.created_at),
    assinaturaId: r.assinatura_id == null ? null : num(r.assinatura_id), assinaturaEstado: r.assinatura_estado ? txt(r.assinatura_estado) : null,
  }));
}

export async function criarContratoFormando(c: Consulta, d: {
  comercialId: string; regime: "gold" | "fin"; formandoId: number; nome: string; email: string; curso: string; valor: number;
  corpo: string; templateId: number | null;
}) {
  const id = num(await valor(c, "SELECT nextval('ops_id_seq')::int AS id"));
  await one(
    c,
    `INSERT INTO contratos_comerciais
       (id, comercial_id, cliente_nome, cliente_email, curso, valor, estado, notas, corpo, template_id, formando_regime, formando_id)
     VALUES ($1,$2,$3,$4,$5,$6,'Rascunho','',$7,$8,$9,$10) RETURNING id`,
    [id, d.comercialId, d.nome, d.email, d.curso, d.valor, d.corpo, d.templateId, d.regime, d.formandoId],
  );
  return id;
}

// ─── Certificado do selo ───────────────────────────────────────────────────────

export type SeloGuardado = {
  p12Enc: string; senhaEnc: string; titular: string; emissor: string; fingerprint: string;
  validoDe: Date | null; validoAte: Date | null; autoAssinado: boolean;
};

export async function lerSelo(c: Consulta) {
  const r = await one(c, "SELECT * FROM assinatura_selo WHERE id = 1");
  if (!r) return null;
  return {
    p12Enc: txt(r.p12_enc), senhaEnc: txt(r.senha_enc), titular: txt(r.titular), emissor: txt(r.emissor),
    fingerprint: txt(r.fingerprint), validoDe: iso(r.valido_de), validoAte: iso(r.valido_ate),
    autoAssinado: Boolean(r.auto_assinado), actualizadoEm: iso(r.actualizado_em),
  };
}

export async function gravarSelo(c: Consulta, s: SeloGuardado) {
  await one(
    c,
    `INSERT INTO assinatura_selo (id, p12_enc, senha_enc, titular, emissor, fingerprint, valido_de, valido_ate, auto_assinado, actualizado_em)
     VALUES (1,$1,$2,$3,$4,$5,$6,$7,$8, now())
     ON CONFLICT (id) DO UPDATE SET p12_enc = EXCLUDED.p12_enc, senha_enc = EXCLUDED.senha_enc, titular = EXCLUDED.titular,
       emissor = EXCLUDED.emissor, fingerprint = EXCLUDED.fingerprint, valido_de = EXCLUDED.valido_de,
       valido_ate = EXCLUDED.valido_ate, auto_assinado = EXCLUDED.auto_assinado, actualizado_em = now()
     RETURNING id`,
    [s.p12Enc, s.senhaEnc, s.titular, s.emissor, s.fingerprint, s.validoDe?.toISOString() ?? null, s.validoAte?.toISOString() ?? null, s.autoAssinado],
  );
}

export async function apagarSelo(c: Consulta) {
  await many(c, "DELETE FROM assinatura_selo WHERE id = 1 RETURNING id");
}

// ─── Modelos de email ──────────────────────────────────────────────────────────

export async function modeloEmail(c: Consulta, tipo: string) {
  return one<{ assunto: string; body_lines: unknown; body_xml: string; cta: string }>(
    c,
    "SELECT assunto, body_lines, body_xml, cta FROM email_templates WHERE tipo = $1",
    [tipo],
  );
}
