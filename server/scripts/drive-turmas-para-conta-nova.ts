/**
 * Depois de ligar a Drive a outra conta Google: cria na conta nova as pastas das turmas que já existem (pasta da
 * turma, as do dossiê, Formandos e Formadores), volta a partilhá-las com os formadores e a secretaria, e esquece as
 * pastas das pré-inscrições que eram da conta anterior (criam-se de novo no próximo documento).
 *
 * Os ficheiros que já estavam na Drive antiga ficam lá (a conta nova não os vê): o script só os conta.
 *
 * Corre dentro do contentor da API:
 *   docker compose exec api npx tsx scripts/drive-turmas-para-conta-nova.ts             (ver o que vai fazer)
 *   docker compose exec api npx tsx scripts/drive-turmas-para-conta-nova.ts --confirmar (fazer)
 */
import "../src/env.js";
import { createDb } from "../src/db/pool.js";
import { prepararTurmaDrive } from "../src/driveArvore.js";
import { pastaExiste, tokenDrive } from "../src/googleDrive.js";

const db = await createDb();
const confirmar = process.argv.includes("--confirmar");
const token = await tokenDrive(db);
if (!token) {
  console.log("A Drive não está ligada (ou a ligação expirou). Ligue a conta nova em Configurações › Google Drive e corra de novo.");
  await db.close();
  process.exit(1);
}

type Turma = { regime: "gold" | "fin"; id: number; nome: string; formador: string; formadores: unknown; cronograma: unknown; drive_pasta_id: string };
const turmas: Turma[] = [];
for (const regime of ["gold", "fin"] as const) {
  const r = await db.query<Omit<Turma, "regime">>(
    `SELECT id, nome, COALESCE(formador, '') AS formador, formadores, cronograma, COALESCE(drive_pasta_id, '') AS drive_pasta_id
       FROM turmas_${regime} ORDER BY id`);
  turmas.push(...r.rows.map(t => ({ ...t, regime })));
}

let criar = 0, ok = 0, falhas = 0;
for (const t of turmas) {
  const naConta = t.drive_pasta_id ? await pastaExiste(token, t.drive_pasta_id) : false;
  if (naConta) { ok++; continue; }
  criar++;
  console.log(`  ${t.nome} (${t.regime} #${t.id}): ${t.drive_pasta_id ? "pasta da conta anterior" : "sem pasta"} → criar na conta nova`);
  if (!confirmar) continue;
  const r = await prepararTurmaDrive(db, {
    regime: t.regime, turmaId: t.id, nome: t.nome, formador: t.formador,
    formadores: Array.isArray(t.formadores) ? t.formadores.map(String) : [], cronograma: t.cronograma,
  }).catch(err => ({ ok: false as const, erro: String(err) }));
  if (!r.ok) { falhas++; console.log(`    não foi possível: ${"erro" in r ? r.erro : "sem acesso à Drive"}`); }
}

// Pastas das pré-inscrições da conta anterior: esquecem-se (o próximo documento cria a pasta na conta nova).
const leads = (await db.query<{ id: number; drive_pasta_id: string }>("SELECT id, drive_pasta_id FROM preinscricoes WHERE drive_pasta_id <> ''")).rows;
const leadsVelhos: number[] = [];
for (const l of leads) if (!(await pastaExiste(token, l.drive_pasta_id))) leadsVelhos.push(l.id);
if (confirmar && leadsVelhos.length) {
  await db.query("UPDATE preinscricoes SET drive_pasta_id = '', drive_pasta_parent_id = '' WHERE id = ANY($1::int[])", [`{${leadsVelhos.join(",")}}`]);
}

const antigos = (await db.query<{ n: number }>("SELECT count(*)::int AS n FROM drive_files WHERE stored_in = 'google'")).rows[0]?.n ?? 0;
console.log(`\n${turmas.length} turmas: ${ok} já na conta nova, ${criar} ${confirmar ? `criadas na conta nova${falhas ? ` (${falhas} falharam)` : ""}` : "por criar"}.`);
console.log(`${leadsVelhos.length} pré-inscrições com pasta da conta anterior ${confirmar ? "esquecidas" : "por esquecer"} (a pasta nova cria-se no próximo documento).`);
console.log(`Ficheiros registados na Drive: ${antigos} (os que foram para a conta anterior ficam lá; a conta nova não os vê).`);
if (!confirmar) console.log("\nNada foi alterado. Para fazer: acrescente --confirmar.");
await db.close();
process.exit(0);
