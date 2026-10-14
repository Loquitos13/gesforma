import type { Db } from "./db/pool.js";
import { enterActor } from "./db/pool.js";
import { newPublicId } from "./ops.js";
import { readFormandoDocs, writeFormandoDocs, writeFormandoPiiPatch, writePreinscricaoPii } from "./pii.js";
import {
  docsFinPorCifrar, gravarDocsFinCifrados, gravarPiiPreinscricao, gravarPublicId, gravarTelefoneCifrado,
  idsSemPublicId, preinscricoesPorCifrar, telefonesPorCifrar,
} from "./repos/piiBackfill.js";

/** Cifra PII legada uma vez (idempotente). */
export async function backfillPiiEncryption(db: Db) {
  enterActor({ id: "", role: "system" });

  const pre = await preinscricoesPorCifrar(db);
  for (const alvo of ["preinscricoes", "gold", "fin"] as const) {
    for (const id of await idsSemPublicId(db, alvo)) await gravarPublicId(db, alvo, id, newPublicId());
  }

  for (const row of pre) {
    const pack = writePreinscricaoPii({
      nif: row.nif,
      moradaFiscal: row.morada_fiscal,
      codigoPostal: row.codigo_postal,
      telf: row.telf,
    });
    if (!pack.pii_enc) continue;
    await gravarPiiPreinscricao(db, row.id, pack);
  }

  for (const row of await docsFinPorCifrar(db)) {
    const docPack = writeFormandoDocs(readFormandoDocs(row));
    if (docPack.docs_enc) await gravarDocsFinCifrados(db, row.id, docPack.docs_enc);
  }

  for (const regime of ["gold", "fin"] as const) {
    for (const row of await telefonesPorCifrar(db, regime)) {
      const pack = writeFormandoPiiPatch({ telf: row.telf });
      if (pack.pii_enc) await gravarTelefoneCifrado(db, regime, row.id, pack.telf, pack.pii_enc);
    }
  }
}
