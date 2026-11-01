/**
 * Apaga TODAS as turmas (Gold e Financiada) e as pastas delas na Drive — só para limpar dados de TESTE.
 *
 * Sem «--confirmar» só mostra o que ia apagar. Com «--confirmar» apaga:
 *  - na Drive: a pasta de cada turma vai para o lixo (recupera-se no lixo da Drive durante 30 dias) e os atalhos
 *    dos formadores para a turma saem;
 *  - na base de dados: sessões, planos, sumários, presenças, dossiê, avaliações, certificados, apoios… de cada turma,
 *    a ligação de cada formando à turma, e as turmas. Os formandos, as pré-inscrições, os pagamentos e as despesas
 *    ficam, só deixam de ter turma. A Drive só se mexe depois de a base de dados ficar limpa.
 *
 * Corre dentro do contentor da API:
 *   docker compose exec api npx tsx scripts/apagar-turmas-teste.ts             (ver o que ia apagar)
 *   docker compose exec api npx tsx scripts/apagar-turmas-teste.ts --confirmar (apagar mesmo)
 */
import "../src/env.js";
import { createDb } from "../src/db/pool.js";
import { limparAtalhosDaTurma } from "../src/driveArvore.js";
import { DRIVE_FILES_URL, tokenDrive } from "../src/googleDrive.js";

// Tabelas em que a linha é de outra coisa (pessoa, pedido, dinheiro): ficam, sem turma.
const SO_DESLIGAR = /^(formandos_|preinscric|pagamentos|despesas|recibos|lead|inquerito_respostas)/;

const db = await createDb();
const confirmar = process.argv.includes("--confirmar");

const turmas = [
  ...(await db.query<{ id: number; nome: string; drive_pasta_id: string }>("SELECT id, nome, drive_pasta_id FROM turmas_gold ORDER BY id")).rows.map(t => ({ ...t, regime: "gold" as const })),
  ...(await db.query<{ id: number; nome: string; drive_pasta_id: string }>("SELECT id, nome, drive_pasta_id FROM turmas_fin ORDER BY id")).rows.map(t => ({ ...t, regime: "fin" as const })),
];
// Os ids da Gold e da Financiada podem repetir-se: cada tabela filtra pelo regime quando o sabe.
const arr = (lista: number[]) => `{${lista.join(",")}}`;
const ids = { gold: turmas.filter(t => t.regime === "gold").map(t => Number(t.id)), fin: turmas.filter(t => t.regime === "fin").map(t => Number(t.id)) };
console.log(`${turmas.length} turmas: ${turmas.map(t => `${t.nome} (${t.regime} #${t.id})`).join(", ") || "nenhuma"}.`);

// Colunas que apontam para uma turma, em qualquer tabela (menos as próprias turmas).
const colunas = (await db.query<Coluna>(
  `SELECT c.table_name AS tabela, c.column_name AS coluna, c.is_nullable = 'YES' AS nula,
          EXISTS (SELECT 1 FROM information_schema.columns r WHERE r.table_schema = c.table_schema AND r.table_name = c.table_name AND r.column_name = 'regime') AS com_regime
     FROM information_schema.columns c
    WHERE c.table_schema = current_schema() AND c.table_name NOT IN ('turmas_gold', 'turmas_fin')
      AND (c.column_name = 'turma_id' OR c.column_name LIKE '%turma%_id')
    ORDER BY c.table_name, c.column_name`)).rows;
// Colunas presas às turmas por chave estrangeira: as linhas têm de sair (ou ficar sem turma) para a turma se apagar.
const comChave = new Set((await db.query<{ tabela: string; coluna: string }>(
  `SELECT cl.relname AS tabela, a.attname AS coluna
     FROM pg_constraint co
     JOIN pg_class cl ON cl.oid = co.conrelid
     JOIN pg_attribute a ON a.attrelid = co.conrelid AND a.attnum = ANY(co.conkey)
    WHERE co.contype = 'f' AND co.confrelid IN ('turmas_gold'::regclass, 'turmas_fin'::regclass)`)).rows.map(r => `${r.tabela}.${r.coluna}`));
type Coluna = { tabela: string; coluna: string; com_regime: boolean; nula: boolean };
/**
 * O que acontece às linhas de uma coluna: as de pessoas, inscrições e dinheiro ficam (sem turma, se a coluna aceita
 * vazio; senão tal como estão, a não ser que uma chave estrangeira obrigue a apagá-las); as outras saem.
 */
function destino(c: Coluna): "desligar" | "manter" | "apagar" {
  if (!SO_DESLIGAR.test(c.tabela)) return "apagar";
  if (c.nula) return "desligar";
  return comChave.has(`${c.tabela}.${c.coluna}`) ? "apagar" : "manter";
}
const ROTULO = { desligar: "ficam, sem turma", manter: "ficam como estão (a coluna não aceita vazio)", apagar: "apagadas" };
/** Condição e parâmetros das linhas de uma coluna que apontam para as turmas a apagar. */
function alvo(c: { tabela: string; coluna: string; com_regime: boolean }) {
  if (c.com_regime) return { onde: `(regime = 'gold' AND "${c.coluna}" = ANY($1::int[])) OR (regime = 'fin' AND "${c.coluna}" = ANY($2::int[]))`, params: [arr(ids.gold), arr(ids.fin)] };
  if (c.tabela.endsWith("_gold")) return { onde: `"${c.coluna}" = ANY($1::int[])`, params: [arr(ids.gold)] };
  if (c.tabela.endsWith("_fin")) return { onde: `"${c.coluna}" = ANY($1::int[])`, params: [arr(ids.fin)] };
  return { onde: `"${c.coluna}" = ANY($1::int[])`, params: [arr([...ids.gold, ...ids.fin])] };
}
for (const c of colunas) {
  const a = alvo(c);
  const n = (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM "${c.tabela}" WHERE ${a.onde}`, a.params)).rows[0]!.n;
  if (n) console.log(`  ${c.tabela}.${c.coluna}: ${n} linha(s) — ${ROTULO[destino(c)]}`);
}

if (!confirmar) {
  console.log("\nNada foi apagado. Para apagar mesmo: acrescente --confirmar.");
  await db.close();
  process.exit(0);
}

// 1. Atalhos dos formadores para as turmas (lêem a turma, por isso antes de a apagar).
for (const t of turmas) await limparAtalhosDaTurma(db, t.regime, t.id).catch(err => console.log(`  atalhos de ${t.nome}: ${String(err)}`));

// 2. Base de dados, tudo numa transacção (ou tudo, ou nada).
await db.tx(async q => {
  for (const c of colunas) {
    const a = alvo(c);
    const d = destino(c);
    if (d === "manter") continue;
    const sql = d === "desligar"
      ? `UPDATE "${c.tabela}" SET "${c.coluna}" = NULL WHERE ${a.onde}`
      : `DELETE FROM "${c.tabela}" WHERE ${a.onde}`;
    await q(sql, a.params);
  }
  // Ficheiros da Drive registados com o nome de cada turma (os da pasta que foi para o lixo).
  for (const t of turmas) await q("DELETE FROM drive_files WHERE regime = $1 AND turma = $2", [t.regime, t.nome]);
  await q("DELETE FROM turmas_gold WHERE id = ANY($1::int[])", [arr(ids.gold)]);
  await q("DELETE FROM turmas_fin WHERE id = ANY($1::int[])", [arr(ids.fin)]);
});
// 3. Só depois de a base de dados ficar limpa: as pastas das turmas na Drive vão para o lixo.
const token = await tokenDrive(db).catch(() => null);
if (!token) console.log("Drive não ligada: as pastas na Drive ficam (apague-as à mão se quiser).");
for (const t of turmas) {
  const pasta = String(t.drive_pasta_id ?? "").trim();
  if (!token || !pasta) continue;
  const r = await fetch(`${DRIVE_FILES_URL}/${encodeURIComponent(pasta)}?supportsAllDrives=true`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ trashed: true }),
  });
  console.log(`  Drive: pasta de ${t.nome} ${r.ok || r.status === 404 ? "no lixo" : `não apagada (${r.status})`}`);
}

console.log(`\n${turmas.length} turmas apagadas.`);
await db.close();
process.exit(0);
