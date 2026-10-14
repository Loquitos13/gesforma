import type { Db } from "../db/pool.js";
import { recifrarCampo } from "../fieldCrypto.js";
import { resselarSegredo } from "../secretBox.js";
import { many } from "./sql.js";

type Coluna = { tabela: string; chave: string; coluna: string; tipo: "campo" | "segredo" };

/** Todas as colunas cifradas do GesForma. `campo` = fieldCrypto (v1:…); `segredo` = secretBox. */
const COLUNAS: Coluna[] = [
  { tabela: "preinscricoes", chave: "id", coluna: "pii_enc", tipo: "campo" },
  { tabela: "formandos_gold", chave: "id", coluna: "pii_enc", tipo: "campo" },
  { tabela: "formandos_gold", chave: "id", coluna: "docs_enc", tipo: "campo" },
  { tabela: "formandos_fin", chave: "id", coluna: "pii_enc", tipo: "campo" },
  { tabela: "formandos_fin", chave: "id", coluna: "docs_enc", tipo: "campo" },
  { tabela: "formando_apoio_dados", chave: "formando_id", coluna: "iban_enc", tipo: "campo" },
  { tabela: "drive_config", chave: "id", coluna: "client_secret", tipo: "segredo" },
  { tabela: "oauth_accounts", chave: "provider", coluna: "access_token", tipo: "segredo" },
  { tabela: "oauth_accounts", chave: "provider", coluna: "refresh_token", tipo: "segredo" },
  { tabela: "microsoft_config", chave: "id", coluna: "client_secret", tipo: "segredo" },
  { tabela: "smtp_config", chave: "id", coluna: "password_sealed", tipo: "segredo" },
  { tabela: "whatsapp_config", chave: "id", coluna: "token_sealed", tipo: "segredo" },
];

export type ResultadoRecifrar = { tabela: string; coluna: string; recifrados: number; ilegiveis: number }[];

/**
 * Recifra com a chave atual tudo o que ainda está numa chave antiga, numa só transacção.
 * Valores que nenhuma chave abre ficam como estão e contam como ilegíveis.
 */
export async function recifrarTudo(db: Db): Promise<ResultadoRecifrar> {
  return db.tx(async q => {
    const out: ResultadoRecifrar = [];
    for (const col of COLUNAS) {
      // Nomes de tabela e coluna vêm só da lista fixa acima.
      const linhas = await many<{ k: string; v: string }>(
        q,
        `SELECT ${col.chave}::text AS k, ${col.coluna} AS v FROM ${col.tabela} WHERE coalesce(${col.coluna}, '') <> ''`,
      );
      let recifrados = 0;
      let ilegiveis = 0;
      for (const l of linhas) {
        let novo: string | null = null;
        try {
          novo = col.tipo === "campo" ? recifrarCampo(l.v) : resselarSegredo(l.v);
        } catch {
          ilegiveis++;
          continue;
        }
        if (novo == null) continue;
        await q(`UPDATE ${col.tabela} SET ${col.coluna} = $1 WHERE ${col.chave}::text = $2`, [novo, l.k]);
        recifrados++;
      }
      out.push({ tabela: col.tabela, coluna: col.coluna, recifrados, ilegiveis });
    }
    return out;
  });
}

/** Ida e volta à base, em ms (para o /health: confirma se função e base estão na mesma região). */
export async function pingBase(db: Db): Promise<number | null> {
  const t0 = performance.now();
  try {
    await db.query("SELECT 1");
    return Math.round(performance.now() - t0);
  } catch {
    return null;
  }
}
