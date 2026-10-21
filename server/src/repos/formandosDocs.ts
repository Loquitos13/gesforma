/** Documentos e notas das fichas de formando (Gold e Financiada). */
import { many, one, type Consulta, type Regime } from "./sql.js";

export type LinhaDoc = {
  doc_id: string;
  ok: boolean;
  file_name: string;
  data: string;
  drive_file_id: string;
  drive_url: string;
  estado: string;
  observacao: string;
  validated_at: string | Date | null;
  validator_name: string;
};

export async function docsDoFormando(c: Consulta, regime: Regime, id: number) {
  return many<LinhaDoc>(
    c,
    `SELECT d.doc_id, d.ok, d.file_name, d.data, COALESCE(d.drive_file_id, '') AS drive_file_id, COALESCE(d.drive_url, '') AS drive_url,
            COALESCE(d.estado, 'pendente') AS estado, COALESCE(d.observacao, '') AS observacao,
            d.validated_at, COALESCE(u.name, '') AS validator_name
       FROM formando_docs d
       LEFT JOIN users u ON u.id = d.validated_by
      WHERE d.regime = $1 AND d.formando_id = $2`,
    [regime, id],
  );
}

export async function docDoFormando(c: Consulta, regime: Regime, id: number, docId: string) {
  return one<{ doc_id: string; estado: string }>(
    c, "SELECT doc_id, COALESCE(estado, 'pendente') AS estado FROM formando_docs WHERE regime = $1 AND formando_id = $2 AND doc_id = $3",
    [regime, id, docId],
  );
}

export async function notasDoFormando(c: Consulta, regime: Regime, id: number, limite = 60) {
  return many<{ id: number; autor: string; texto: string; created_at: string | Date }>(
    c,
    "SELECT id, autor, texto, created_at FROM formando_notas WHERE regime = $1 AND formando_id = $2 ORDER BY created_at DESC LIMIT $3",
    [regime, id, limite],
  );
}

export async function inserirNota(c: Consulta, regime: Regime, id: number, autor: string, actorId: string | null, texto: string) {
  return one<{ id: number; created_at: string | Date }>(
    c,
    "INSERT INTO formando_notas (regime, formando_id, autor, actor_id, texto) VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at",
    [regime, id, autor, actorId, texto],
  );
}

/** Marca um documento dado como certo (ou retirado) na ficha; mantém quem validou se nada mudou. */
export async function gravarDocFicha(
  c: Consulta,
  regime: Regime,
  id: number,
  doc: { id: string; ok: boolean; fileName: string; data: string; driveFileId?: string; driveUrl?: string },
  actorId: string,
) {
  await one(
    c,
    `INSERT INTO formando_docs (regime, formando_id, doc_id, ok, file_name, data, drive_file_id, drive_url, estado, observacao, validated_by, validated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
             CASE WHEN $4 THEN 'validado' ELSE 'pendente' END,
             CASE WHEN $4 AND $5 = '' AND $7 = '' THEN 'Validado manualmente (sem ficheiro no GesForma).' ELSE '' END,
             CASE WHEN $4 THEN $9::uuid ELSE NULL END,
             CASE WHEN $4 THEN now() ELSE NULL END)
     ON CONFLICT (regime, formando_id, doc_id) DO UPDATE SET
       ok = EXCLUDED.ok, file_name = EXCLUDED.file_name, data = EXCLUDED.data,
       drive_file_id = EXCLUDED.drive_file_id, drive_url = EXCLUDED.drive_url,
       estado = CASE WHEN formando_docs.ok = EXCLUDED.ok THEN formando_docs.estado ELSE EXCLUDED.estado END,
       observacao = CASE WHEN formando_docs.ok = EXCLUDED.ok THEN formando_docs.observacao ELSE EXCLUDED.observacao END,
       validated_by = CASE WHEN formando_docs.ok = EXCLUDED.ok THEN formando_docs.validated_by ELSE EXCLUDED.validated_by END,
       validated_at = CASE WHEN formando_docs.ok = EXCLUDED.ok THEN formando_docs.validated_at ELSE EXCLUDED.validated_at END,
       updated_at = now()`,
    [regime, id, doc.id, doc.ok, doc.fileName, doc.data, doc.driveFileId ?? "", doc.driveUrl ?? "", actorId],
  );
}

/** Valida ou recusa um documento enviado (Gold e Financiada usam a mesma tabela). */
export async function decidirDoc(
  c: Consulta,
  regime: Regime,
  id: number,
  docId: string,
  decisao: { validado: true; data: string } | { validado: false; observacao: string },
  actorId: string,
) {
  if (decisao.validado) {
    await one(
      c,
      `UPDATE formando_docs SET ok = true, estado = 'validado', observacao = '', data = $4,
         validated_by = $5, validated_at = now(), updated_at = now()
       WHERE regime = $1 AND formando_id = $2 AND doc_id = $3`,
      [regime, id, docId, decisao.data, actorId],
    );
  } else {
    await one(
      c,
      `UPDATE formando_docs SET ok = false, estado = 'recusado', observacao = $4, validated_by = $5, validated_at = now(), updated_at = now(),
         recusa_avisada_em = NULL
       WHERE regime = $1 AND formando_id = $2 AND doc_id = $3`,
      [regime, id, docId, decisao.observacao, actorId],
    );
  }
}

/** Ficheiro enviado (portal ou secretaria): fica pendente de validação. */
export async function docEnviado(
  c: Consulta,
  regime: Regime,
  id: number,
  docId: string,
  f: { nome: string; data: string; driveFileId: string; driveUrl: string },
) {
  await one(
    c,
    `INSERT INTO formando_docs (regime, formando_id, doc_id, ok, file_name, data, drive_file_id, drive_url, estado, observacao, validated_by, validated_at)
     VALUES ($1, $2, $3, false, $4, $5, $6, $7, 'pendente', '', NULL, NULL)
     ON CONFLICT (regime, formando_id, doc_id) DO UPDATE SET
       ok = false, file_name = EXCLUDED.file_name, data = EXCLUDED.data,
       drive_file_id = EXCLUDED.drive_file_id, drive_url = EXCLUDED.drive_url,
       estado = 'pendente', observacao = '', validated_by = NULL, validated_at = NULL, updated_at = now()`,
    [regime, id, docId, f.nome, f.data, f.driveFileId, f.driveUrl],
  );
}

/** Marcação manual (ex.: entregue em papel), com quem marcou e quando. */
export async function docManual(c: Consulta, regime: Regime, id: number, docId: string, ok: boolean, data: string, actorId: string) {
  await one(
    c,
    `INSERT INTO formando_docs (regime, formando_id, doc_id, ok, file_name, data, estado, observacao, validated_by, validated_at)
     VALUES ($1, $2, $3, $4, '', $5, $6, $7, $8, now())
     ON CONFLICT (regime, formando_id, doc_id) DO UPDATE SET
       ok = EXCLUDED.ok, data = EXCLUDED.data, estado = EXCLUDED.estado,
       observacao = CASE WHEN formando_docs.file_name = '' THEN EXCLUDED.observacao ELSE formando_docs.observacao END,
       validated_by = EXCLUDED.validated_by, validated_at = now(), updated_at = now()`,
    [regime, id, docId, ok, ok ? data : "", ok ? "validado" : "pendente", ok ? "Validado manualmente (sem ficheiro no GesForma)." : "", actorId],
  );
}

// ─── Financiada: ligação de documentos e JSON antigo ─────────────────────────

export async function pessoaFin(c: Consulta, id: number) {
  return one<{ id: number; nome: string; apelido: string; email: string; curso: string; turma: string; docs: unknown; docs_enc: string; docs_token: string }>(
    c,
    `SELECT id, nome, apelido, email, curso, turma, docs, COALESCE(docs_enc, '') AS docs_enc, COALESCE(docs_token, '') AS docs_token
       FROM formandos_fin WHERE id = $1`,
    [id],
  );
}

export async function definirTokenFin(c: Consulta, id: number, token: string) {
  await one(c, "UPDATE formandos_fin SET docs_token = $2 WHERE id = $1 AND COALESCE(docs_token, '') = ''", [id, token]);
  return one<{ docs_token: string }>(c, "SELECT COALESCE(docs_token, '') AS docs_token FROM formandos_fin WHERE id = $1", [id]);
}

export async function formandoFinPorTokenId(c: Consulta, token: string) {
  return one<{ id: number }>(c, "SELECT id FROM formandos_fin WHERE docs_token = $1", [token]);
}

export async function gravarDocsJsonFin(c: Consulta, id: number, docs: Record<string, unknown>) {
  await one(c, "UPDATE formandos_fin SET docs = $2::jsonb WHERE id = $1", [id, JSON.stringify(docs)]);
}

export async function fichaFinDoUtilizador(c: Consulta, userId: string, formandoId: number) {
  return one<{ id: number }>(c, "SELECT id FROM formandos_fin WHERE id = $1 AND user_id = $2", [formandoId, userId]);
}

/** Fichas da Financiada com documentos antigos ainda só no JSON cifrado. */
export async function finPorSincronizar(c: Consulta, limite = 200) {
  return many<{ id: number; docs: unknown; docs_enc: string }>(
    c,
    "SELECT id, docs, COALESCE(docs_enc, '') AS docs_enc FROM formandos_fin WHERE NOT docs_sincronizados ORDER BY id LIMIT $1",
    [limite],
  );
}

/** Copia para formando_docs os documentos dados como certos no JSON (sem apagar o que já lá está). */
export async function sincronizarDocsFin(c: Consulta, id: number, oks: { docId: string; data: string }[]) {
  for (const d of oks) {
    await one(
      c,
      `INSERT INTO formando_docs (regime, formando_id, doc_id, ok, file_name, data, estado, observacao)
       VALUES ('fin', $1, $2, true, '', $3, 'validado', 'Validado antes do registo por documento.')
       ON CONFLICT (regime, formando_id, doc_id) DO NOTHING`,
      [id, d.docId, d.data],
    );
  }
  await one(c, "UPDATE formandos_fin SET docs_sincronizados = true WHERE id = $1", [id]);
}
