import { randomBytes, randomUUID } from "node:crypto";
import { formadorForaDoSlot, slotsDoFormador } from "../../src/disponibilidade.js";
import type { Db } from "./db/pool.js";
import { hashPassword, isEmail, normalizeEmail } from "./security.js";

function uniqueViolation(err: unknown) {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "23505";
}

export async function garantirContaFormador(db: Db, nome: string, emailRaw: string) {
  const email = normalizeEmail(emailRaw);
  if (!email || !isEmail(email)) return null;
  const existing = await db.query<{ id: string }>("SELECT id FROM users WHERE lower(email) = $1", [email]);
  if (existing.rows[0]) return { userId: existing.rows[0].id, email, criado: false as const };
  const password = randomBytes(9).toString("base64url");
  const id = randomUUID();
  try {
    await db.query(
      "INSERT INTO users (id, name, email, password_hash, role, active) VALUES ($1,$2,$3,$4,'formador',true)",
      [id, nome.trim() || email, email, await hashPassword(password)],
    );
  } catch (err) {
    if (!uniqueViolation(err)) throw err;
    const again = await db.query<{ id: string }>("SELECT id FROM users WHERE lower(email) = $1", [email]);
    if (!again.rows[0]) throw err;
    return { userId: again.rows[0].id, email, criado: false as const };
  }
  return { userId: id, email, criado: true as const, password };
}

export async function formadorEstaAlocado(db: Db, nome: string) {
  const n = nome.trim().toLowerCase();
  if (!n) return false;
  const row = await db.query(
    `SELECT 1
       FROM (
         SELECT formador, formadores, cronograma FROM turmas_gold
         UNION ALL
         SELECT formador, formadores, cronograma FROM turmas_fin
       ) t
      WHERE lower(trim(COALESCE(formador, ''))) = $1
         OR EXISTS (
           SELECT 1 FROM jsonb_array_elements_text(COALESCE(formadores, '[]'::jsonb)) e
            WHERE lower(trim(e)) = $1
         )
         OR EXISTS (
           SELECT 1
             FROM jsonb_array_elements(CASE WHEN jsonb_typeof(cronograma) = 'array' THEN cronograma ELSE '[]'::jsonb END) s
            WHERE lower(trim(COALESCE(s->>'formador', ''))) = $1
               OR EXISTS (
                 SELECT 1
                   FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(s->'formadores') = 'array' THEN s->'formadores' ELSE '[]'::jsonb END) f
                  WHERE lower(trim(f)) = $1
               )
         )
      LIMIT 1`,
    [n],
  );
  return row.rows.length > 0;
}

export async function erroDisponibilidade(db: Db, nomes: string[], horario: string) {
  const limpos = [...new Set(nomes.map(n => n.trim()).filter(Boolean))];
  if (!limpos.length) return null;
  const rows = await db.query<{ nome: string; disponibilidade: unknown }>(
    `SELECT nome, disponibilidade FROM formadores
      WHERE lower(nome) IN (SELECT lower(jsonb_array_elements_text($1::jsonb)))`,
    [limpos.map(n => n.toLowerCase())],
  );
  const fora = rows.rows.filter(r => {
    const slots = Array.isArray(r.disponibilidade) ? r.disponibilidade.map(String) : slotsDoFormador(null);
    return formadorForaDoSlot(slots, horario);
  }).map(r => String(r.nome));
  if (!fora.length) return null;
  return `${fora.join(", ")} não tem o horário ${horario} na disponibilidade.`;
}
