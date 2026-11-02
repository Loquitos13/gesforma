/**
 * Remetente dos emails automáticos: o email do local da pessoa (Edição de cursos › Locais), para as respostas
 * chegarem à caixa de quem trata dela. O local vem da pré-inscrição mais recente com esse email ou, sem ela,
 * da ficha de formando (Gold) ou da turma (Financiada). Sem local com email, fica o remetente geral.
 */
import type { Db } from "./db/pool.js";
import { isEmail, normalizeEmail } from "./security.js";

// «V.N.Gaia» e «V. N. Gaia» são o mesmo local.
const chave = (v: unknown) => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

async function localDoDestinatario(db: Db, email: string): Promise<{ local: string; regime: string } | null> {
  const r = await db.query<{ local: string; regime: string }>(
    `SELECT local, regime FROM (
       SELECT local, COALESCE(regime, 'gold') AS regime, 1 AS ordem, id FROM preinscricoes
        WHERE lower(email) = $1 AND COALESCE(local, '') <> ''
       UNION ALL
       SELECT local, 'gold', 2, id FROM formandos_gold WHERE lower(email) = $1 AND COALESCE(local, '') <> ''
       UNION ALL
       SELECT t.local, 'fin', 3, f.id FROM formandos_fin f JOIN turmas_fin t ON t.id = f.turma_id
        WHERE lower(f.email) = $1 AND COALESCE(t.local, '') <> ''
     ) x ORDER BY ordem, id DESC LIMIT 1`, [email]);
  return r.rows[0] ?? null;
}

/** O remetente do local da pessoa com este email, ou null (fica o geral). */
export async function remetenteDoDestinatario(db: Db, destinatario: string): Promise<{ nome: string; email: string } | null> {
  const email = normalizeEmail(destinatario);
  if (!isEmail(email)) return null;
  const alvo = await localDoDestinatario(db, email);
  if (!alvo) return null;
  const r = await db.query<{ regime: string; payload: Record<string, unknown> }>(
    "SELECT regime, payload FROM catalog_items WHERE kind = 'locais' ORDER BY id");
  let achado: { nome: string; email: string; regime: string } | null = null;
  for (const { regime, payload: l } of r.rows) {
    const estado = String(l.status ?? "Ativo");
    if (estado === "Inactivo" || estado === "Inativo") continue;
    const nome = String(l.nome ?? "").trim();
    const mail = normalizeEmail(String(l.email ?? ""));
    if (chave(nome) !== chave(alvo.local) || !isEmail(mail)) continue;
    // O mesmo local nos dois regimes: fica o do regime da pessoa.
    if (!achado || regime === alvo.regime) achado = { nome, email: mail, regime };
  }
  // O próprio local não recebe emails «dele próprio».
  if (!achado || achado.email === email) return null;
  return { nome: `ENA · ${achado.nome}`, email: achado.email };
}
