/** Área do formando e contas de formando (areaFormando.ts, rotas/areaFormando.ts). */
import { many, one, type Consulta, type Regime } from "./sql.js";

export async function formandoParaAcesso(c: Consulta, regime: Regime, id: number) {
  return one<{ nome: string; apelido: string; email: string; curso: string; user_id: string | null }>(
    c,
    `SELECT nome, apelido, email, curso, user_id::text AS user_id FROM ${regime === "fin" ? "formandos_fin" : "formandos_gold"} WHERE id = $1`,
    [id],
  );
}

export async function contaPorEmail(c: Consulta, email: string) {
  return one<{ id: string; role: string; name: string; active: boolean }>(
    c, "SELECT id, role, name, active FROM users WHERE lower(email) = $1", [email],
  );
}

export async function criarContaFormando(c: Consulta, d: { id: string; nome: string; email: string; hash: string }) {
  await one(
    c,
    "INSERT INTO users (id, name, email, password_hash, role, active, must_change_password) VALUES ($1,$2,$3,$4,'formando',true,true)",
    [d.id, d.nome, d.email, d.hash],
  );
}

/** Nova palavra-passe temporária: obriga a mudar no próximo acesso e fecha as sessões abertas. */
export async function reporContaFormando(c: Consulta, d: { id: string; nome: string; hash: string }) {
  await one(
    c,
    "UPDATE users SET password_hash = $2, must_change_password = true, active = true, name = CASE WHEN name = '' THEN $3 ELSE name END WHERE id = $1",
    [d.id, d.hash, d.nome],
  );
  await one(c, "DELETE FROM sessions WHERE user_id = $1", [d.id]);
}

/** Liga ao utilizador todas as fichas (Gold e Financiada) com este email que ainda não têm conta. */
export async function ligarFichasPeloEmail(c: Consulta, userId: string, email: string) {
  await one(c, "UPDATE formandos_gold SET user_id = $1 WHERE lower(trim(email)) = $2 AND (user_id IS NULL OR user_id = $1)", [userId, email]);
  await one(c, "UPDATE formandos_fin SET user_id = $1 WHERE lower(trim(email)) = $2 AND (user_id IS NULL OR user_id = $1)", [userId, email]);
}

export async function respostasDeInqueritos(c: Consulta) {
  return many<{ payload: unknown; respostas: unknown }>(
    c,
    `SELECT ci.payload, r.respostas
       FROM inquerito_respostas r
       JOIN catalog_items ci ON ci.id = r.inquerito_id AND ci.kind = 'inqueritos'`,
  );
}

export async function inscricoesGoldDoUtilizador(c: Consulta, userId: string) {
  return many<Record<string, unknown>>(
    c,
    "SELECT id, nome, apelido, email, telf, pii_enc, curso, turma, turma_id, estado, pago, valor, metodo, inscrito FROM formandos_gold WHERE user_id = $1 ORDER BY id",
    [userId],
  );
}

export async function inscricoesFinDoUtilizador(c: Consulta, userId: string) {
  return many<Record<string, unknown>>(
    c,
    "SELECT id, nome, apelido, email, telf, pii_enc, curso, turma, turma_id, estado FROM formandos_fin WHERE user_id = $1 ORDER BY id",
    [userId],
  );
}

export async function prefsDoUtilizador(c: Consulta, userId: string) {
  return one<{ area_prefs: unknown; name: string; email: string }>(c, "SELECT area_prefs, name, email FROM users WHERE id = $1", [userId]);
}

export async function gravarPrefs(c: Consulta, userId: string, prefs: unknown, nome: string) {
  await one(
    c,
    "UPDATE users SET area_prefs = $2::jsonb, name = CASE WHEN $3 = '' THEN name ELSE $3 END WHERE id = $1",
    [userId, JSON.stringify(prefs), nome],
  );
}

export async function atualizarDadosDoUtilizador(c: Consulta, userId: string, d: { nome?: string; apelido?: string }) {
  for (const tabela of ["formandos_gold", "formandos_fin"] as const) {
    await one(
      c,
      `UPDATE ${tabela} SET nome = COALESCE($2, nome), apelido = COALESCE($3, apelido) WHERE user_id = $1`,
      [userId, d.nome ?? null, d.apelido ?? null],
    );
  }
}

/** Telefone de uma ficha do utilizador: o pacote cifrado (pii_enc) e a coluna em claro como `writeFormandoPiiPatch` a devolve. */
export async function gravarTelefoneDaFicha(
  c: Consulta, regime: Regime, userId: string, id: number, pii: { telf: string; pii_enc: string | null },
) {
  await one(
    c,
    `UPDATE ${regime === "fin" ? "formandos_fin" : "formandos_gold"} SET telf = $3, pii_enc = $4 WHERE id = $1 AND user_id = $2`,
    [id, userId, pii.telf, pii.pii_enc ?? ""],
  );
}

export async function cronogramaDaTurma(c: Consulta, regime: Regime, turmaId: number) {
  return one<{ nome: string; cronograma: unknown }>(
    c, `SELECT nome, cronograma FROM ${regime === "fin" ? "turmas_fin" : "turmas_gold"} WHERE id = $1`, [turmaId],
  );
}

export async function certificadosDe(c: Consulta, regime: Regime, turmaId: number, formandoId: number) {
  return many<{ emitido: boolean; nota: unknown; ficheiro_url: string; ficheiro_nome: string; emitido_em: string | Date | null }>(
    c,
    `SELECT emitido, nota, COALESCE(ficheiro_url, '') AS ficheiro_url, COALESCE(ficheiro_nome, '') AS ficheiro_nome, emitido_em
       FROM turma_certificados WHERE regime = $1 AND turma_id = $2 AND formando_id = $3`,
    [regime, turmaId, formandoId],
  );
}

/** Pagamentos da própria pessoa: ligados às suas fichas Gold ou com o email da conta. */
export async function pagamentosDoUtilizador(c: Consulta, formandoIds: number[], email: string) {
  return many<{ id: string; valor: unknown; metodo: string; curso: string; data: string; estado: string }>(
    c,
    `SELECT id, valor, metodo, curso, data, estado FROM pagamentos
      WHERE formando_id IN (SELECT (jsonb_array_elements_text($1::jsonb))::int) OR ($2 <> '' AND lower(email) = lower($2))
      ORDER BY id DESC`,
    [JSON.stringify(formandoIds), email],
  );
}

export async function docsGoldValidados(c: Consulta, formandoId: number) {
  return many<{ doc_id: string; file_name: string; drive_url: string; validated_at: unknown }>(
    c,
    `SELECT doc_id, file_name, COALESCE(drive_url, '') AS drive_url, validated_at
       FROM formando_docs WHERE regime = 'gold' AND formando_id = $1 AND estado = 'validado'
      ORDER BY doc_id`,
    [formandoId],
  );
}

// ─── Recuperação da palavra-passe ────────────────────────────────────────────

export async function guardarPedidoReposicao(c: Consulta, userId: string, tokenHash: string, expira: string) {
  await one(c, "DELETE FROM password_resets WHERE user_id = $1", [userId]);
  await one(c, "INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES ($1,$2,$3)", [tokenHash, userId, expira]);
}

export async function pedidoReposicaoValido(c: Consulta, tokenHash: string) {
  return one<{ user_id: string }>(
    c, "SELECT user_id::text AS user_id FROM password_resets WHERE token_hash = $1 AND expires_at > now()", [tokenHash],
  );
}

export async function definirPalavraPasseFormando(c: Consulta, userId: string, hash: string) {
  await one(c, "UPDATE users SET password_hash = $2, must_change_password = false WHERE id = $1 AND role = 'formando'", [userId, hash]);
  await one(c, "DELETE FROM password_resets WHERE user_id = $1", [userId]);
  await one(c, "DELETE FROM sessions WHERE user_id = $1", [userId]);
}
