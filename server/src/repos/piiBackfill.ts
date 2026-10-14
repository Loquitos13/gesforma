/** Leituras e escritas do backfill de cifra de dados pessoais (piiBackfill.ts). */
import { many, tabelaRegime, type Consulta, type Regime } from "./sql.js";

export function preinscricoesPorCifrar(c: Consulta) {
  return many<{ id: number; nif: string; morada_fiscal: string; codigo_postal: string; telf: string; pii_enc: string }>(c,
    `SELECT id, nif, morada_fiscal, codigo_postal, telf, COALESCE(pii_enc, '') AS pii_enc
       FROM preinscricoes
      WHERE COALESCE(pii_enc, '') = '' AND (nif <> '' OR morada_fiscal <> '' OR codigo_postal <> '' OR telf <> '')`);
}

export async function idsSemPublicId(c: Consulta, alvo: "preinscricoes" | Regime) {
  const tabela = alvo === "preinscricoes" ? "preinscricoes" : tabelaRegime("formandos", alvo);
  const r = await many<{ id: number }>(c, `SELECT id FROM ${tabela} WHERE COALESCE(public_id, '') = ''`);
  return r.map(x => Number(x.id));
}

export async function gravarPublicId(c: Consulta, alvo: "preinscricoes" | Regime, id: number, publicId: string) {
  const tabela = alvo === "preinscricoes" ? "preinscricoes" : tabelaRegime("formandos", alvo);
  await many(c, `UPDATE ${tabela} SET public_id = $2 WHERE id = $1`, [id, publicId]);
}

export async function gravarPiiPreinscricao(c: Consulta, id: number, p: { nif: string; morada_fiscal: string; codigo_postal: string; telf: string; pii_enc: string | null }) {
  await many(c,
    "UPDATE preinscricoes SET nif = $2, morada_fiscal = $3, codigo_postal = $4, telf = $5, pii_enc = $6 WHERE id = $1",
    [id, p.nif, p.morada_fiscal, p.codigo_postal, p.telf, p.pii_enc]);
}

export function docsFinPorCifrar(c: Consulta) {
  return many<{ id: number; telf: string; docs: unknown; pii_enc: string; docs_enc: string }>(c,
    `SELECT id, telf, docs, COALESCE(pii_enc, '') AS pii_enc, COALESCE(docs_enc, '') AS docs_enc FROM formandos_fin
      WHERE COALESCE(docs_enc, '') = '' AND docs IS NOT NULL AND docs::text NOT IN ('{}', 'null')`);
}

export async function gravarDocsFinCifrados(c: Consulta, id: number, docsEnc: string) {
  await many(c, "UPDATE formandos_fin SET docs = $2::jsonb, docs_enc = $3 WHERE id = $1", [id, "{}", docsEnc]);
}

export function telefonesPorCifrar(c: Consulta, regime: Regime) {
  return many<{ id: number; telf: string; pii_enc: string }>(c,
    `SELECT id, telf, COALESCE(pii_enc, '') AS pii_enc FROM ${tabelaRegime("formandos", regime)}
      WHERE COALESCE(pii_enc, '') = '' AND telf <> ''`);
}

export async function gravarTelefoneCifrado(c: Consulta, regime: Regime, id: number, telf: string, piiEnc: string) {
  await many(c, `UPDATE ${tabelaRegime("formandos", regime)} SET telf = $2, pii_enc = $3 WHERE id = $1`, [id, telf, piiEnc]);
}
