import type { Db } from "./db/pool.js";
import { enterActor } from "./db/pool.js";
import { newPublicId } from "./ops.js";
import { readFormandoDocs, readPreinscricaoPii, writeFormandoDocs, writeFormandoPiiPatch, writePreinscricaoPii } from "./pii.js";

/** Cifra PII legada uma vez (idempotente). */
export async function backfillPiiEncryption(db: Db) {
  enterActor({ id: "", role: "system" });

  const pre = await db.query<{ id: number; nif: string; morada_fiscal: string; codigo_postal: string; telf: string; pii_enc: string }>(
    `SELECT id, nif, morada_fiscal, codigo_postal, telf, COALESCE(pii_enc, '') AS pii_enc
       FROM preinscricoes
      WHERE COALESCE(pii_enc, '') = '' AND (nif <> '' OR morada_fiscal <> '' OR codigo_postal <> '' OR telf <> '')`,
  );
  const preIds = await db.query<{ id: number }>("SELECT id FROM preinscricoes WHERE COALESCE(public_id, '') = ''");
  for (const row of preIds.rows) {
    await db.query("UPDATE preinscricoes SET public_id = $2 WHERE id = $1", [row.id, newPublicId()]);
  }

  for (const table of ["formandos_gold", "formandos_fin"] as const) {
    const ids = await db.query<{ id: number }>(`SELECT id FROM ${table} WHERE COALESCE(public_id, '') = ''`);
    for (const row of ids.rows) {
      await db.query(`UPDATE ${table} SET public_id = $2 WHERE id = $1`, [row.id, newPublicId()]);
    }
  }

  for (const row of pre.rows) {
    const pack = writePreinscricaoPii({
      nif: row.nif,
      moradaFiscal: row.morada_fiscal,
      codigoPostal: row.codigo_postal,
      telf: row.telf,
    });
    if (!pack.pii_enc) continue;
    await db.query(
      "UPDATE preinscricoes SET nif = $2, morada_fiscal = $3, codigo_postal = $4, telf = $5, pii_enc = $6 WHERE id = $1",
      [row.id, pack.nif, pack.morada_fiscal, pack.codigo_postal, pack.telf, pack.pii_enc],
    );
  }

  const finDocRows = await db.query<{ id: number; telf: string; docs: unknown; pii_enc: string; docs_enc: string }>(
    `SELECT id, telf, docs, COALESCE(pii_enc, '') AS pii_enc, COALESCE(docs_enc, '') AS docs_enc FROM formandos_fin
      WHERE COALESCE(docs_enc, '') = '' AND docs IS NOT NULL AND docs::text NOT IN ('{}', 'null')`,
  );
  for (const row of finDocRows.rows) {
    const docs = readFormandoDocs(row);
    const docPack = writeFormandoDocs(docs);
    if (docPack.docs_enc) {
      await db.query("UPDATE formandos_fin SET docs = $2::jsonb, docs_enc = $3 WHERE id = $1", [row.id, "{}", docPack.docs_enc]);
    }
  }

  for (const table of ["formandos_gold", "formandos_fin"] as const) {
    const telfRows = await db.query<{ id: number; telf: string; pii_enc: string }>(
      `SELECT id, telf, COALESCE(pii_enc, '') AS pii_enc FROM ${table}
        WHERE COALESCE(pii_enc, '') = '' AND telf <> ''`,
    );
    for (const row of telfRows.rows) {
      const pack = writeFormandoPiiPatch({ telf: row.telf });
      if (pack.pii_enc) {
        await db.query(`UPDATE ${table} SET telf = $2, pii_enc = $3 WHERE id = $1`, [row.id, pack.telf, pack.pii_enc]);
      }
    }
  }
}
