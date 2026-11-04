/**
 * Aviso «formando inserido numa turma» (Sistema › Emails › Regras): cada formando que passa a estar numa turma —
 * inscrição paga concluída, «Inserir na turma», nova ficha, mudança de turma, Financiada — dá um evento, uma vez por
 * formando e turma. Corre a cada minuto dentro da API; as entradas que já existiam na migração contam como vistas.
 * O email sai do endereço do local da pessoa (mailer) e leva os anexos da regra (ex.: o guia do Netforce no CCP).
 */
import { readFile } from "node:fs/promises";
import { ingestEvent } from "./automations.js";
import type { Db } from "./db/pool.js";
import { contarAnexosRegra, juntarAnexoRegra } from "./repos/emails.js";
import { isEmail, normalizeEmail } from "./security.js";

type Entrada = {
  regime: "gold" | "fin"; formando_id: number; turma_id: number; email: string; nome: string; apelido: string;
  curso: string; turma: string; local: string; horario: string; data_inicio: string;
};

export async function avisarEntradasNaTurma(db: Db) {
  // Reserva primeiro (uma linha por formando e turma): duas voltas ao mesmo tempo não repetem o email.
  const novas = (await db.query<Entrada>(
    `WITH candidatas AS (
       SELECT 'gold' AS regime, f.id AS formando_id, f.turma_id, f.email, f.nome, f.apelido,
              COALESCE(NULLIF(t.curso, ''), f.curso) AS curso, t.nome AS turma, t.local, t.horario, t.data_inicio::text AS data_inicio
         FROM formandos_gold f JOIN turmas_gold t ON t.id = f.turma_id
        WHERE f.estado NOT ILIKE 'desist%'
       UNION ALL
       SELECT 'fin', f.id, f.turma_id, f.email, f.nome, f.apelido,
              COALESCE(NULLIF(t.curso, ''), f.curso), t.nome, t.local, '' AS horario, t.data_inicio::text
         FROM formandos_fin f JOIN turmas_fin t ON t.id = f.turma_id
        WHERE f.estado NOT ILIKE 'desist%'
     ), reservadas AS (
       INSERT INTO formando_turma_vistos (regime, formando_id, turma_id)
       SELECT regime, formando_id, turma_id FROM candidatas c
        WHERE NOT EXISTS (SELECT 1 FROM formando_turma_vistos v
                           WHERE v.regime = c.regime AND v.formando_id = c.formando_id AND v.turma_id = c.turma_id)
        LIMIT 200
       ON CONFLICT DO NOTHING
       RETURNING regime, formando_id, turma_id
     )
     SELECT c.* FROM candidatas c JOIN reservadas r USING (regime, formando_id, turma_id)`,
  )).rows;
  let enviadas = 0;
  for (const e of novas) {
    const email = normalizeEmail(e.email ?? "");
    if (!isEmail(email)) continue;
    const r = await ingestEvent(db, "formando.inserido_turma", {
      email, nome: `${e.nome ?? ""} ${e.apelido ?? ""}`.trim(), curso: e.curso, turma: e.turma, regime: e.regime,
      local: e.local, horario: e.horario,
    }, `inserido-turma:${e.regime}:${e.formando_id}:${e.turma_id}`).catch(err => {
      console.error("[emails] aviso de entrada na turma:", err);
      return null;
    });
    if (r?.queued) enviadas += r.queued;
  }
  return { novas: novas.length, enviadas };
}

/**
 * O guia do registo no Netforce junta-se à regra do CCP uma vez (no arranque). Se alguém o tirar da regra, não volta:
 * fica a marca em app_settings.
 */
export async function anexarGuiaNetforce(db: Db) {
  const feito = await db.query("SELECT 1 FROM app_settings WHERE id = 'anexo_netforce'");
  if (feito.rows[0]) return;
  const regra = (await db.query<{ id: number }>(
    "SELECT id FROM email_rules WHERE trigger_key = 'formando.inserido_turma' AND template_tipo = 'registo_netforce' ORDER BY id LIMIT 1")).rows[0];
  if (!regra) return;
  if (!(await contarAnexosRegra(db, regra.id))) {
    const bytes = await readFile(new URL("./db/anexos/Registo_Netforce.pdf", import.meta.url));
    await juntarAnexoRegra(db, regra.id, { nome: "Registo_Netforce.pdf", mime: "application/pdf", bytes });
  }
  await db.query(
    "INSERT INTO app_settings (id, values) VALUES ('anexo_netforce', '{\"feito\": \"1\"}'::jsonb) ON CONFLICT (id) DO NOTHING");
}
