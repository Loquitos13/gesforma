/**
 * Passa os ficheiros do GesForma de uma conta Google (Drive) para outra, ficando cada um ligado à mesma ficha.
 * A aplicação só vê os ficheiros que ela própria criou na conta ligada, por isso faz-se em dois passos:
 *
 *  1. Com a conta ANTIGA ligada (Configurações › Google Drive):
 *       docker compose exec api npx tsx scripts/drive-migrar-ficheiros.ts descarregar
 *     Descarrega para o servidor todos os ficheiros que estão na Drive (nada muda na Drive nem nas fichas).
 *
 *  2. Ligue a conta NOVA (Configurações › Google Drive) e corra:
 *       docker compose exec api npx tsx scripts/drive-migrar-ficheiros.ts carregar
 *     Carrega cada ficheiro na conta nova, na pasta certa (pré-inscrição, turma, dossiê, formador…), e atualiza a
 *     ficha para abrir o ficheiro novo. Pode correr-se outra vez: os que já passaram não se repetem.
 *
 * Os ficheiros descarregados ficam em <DRIVE_DIR>/migracao-drive (apague a pasta depois de confirmar).
 */
import "../src/env.js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "../src/config.js";
import { createDb } from "../src/db/pool.js";
import { garantirBolsaFormador, garantirPastaPendente } from "../src/driveArvore.js";
import { pastaDeDestino, uploadToGoogle } from "../src/driveFicheiros.js";
import { DRIVE_FILES_URL, isNotFound, tokenDrive } from "../src/googleDrive.js";
import { contaGoogle, esquecerPastaDaTurma, type DriveFileRow } from "../src/repos/drive.js";

type Entrada = { id: string; ficheiro: string; carregado?: boolean; erro?: string };
type Manifesto = { conta: string; entradas: Record<string, Entrada> };

const passo = process.argv[2];
if (passo !== "descarregar" && passo !== "carregar") {
  console.log("Use: … drive-migrar-ficheiros.ts descarregar   (com a conta antiga ligada)\n     … drive-migrar-ficheiros.ts carregar      (depois, com a conta nova ligada)");
  process.exit(1);
}

const db = await createDb();
const dir = join(config.driveDir, "migracao-drive");
mkdirSync(dir, { recursive: true });
const caminhoManifesto = join(dir, "manifesto.json");
const manifesto: Manifesto = existsSync(caminhoManifesto)
  ? JSON.parse(readFileSync(caminhoManifesto, "utf8"))
  : { conta: "", entradas: {} };
const gravarManifesto = () => writeFileSync(caminhoManifesto, JSON.stringify(manifesto, null, 1));

const token = await tokenDrive(db);
const conta = (await contaGoogle(db))?.email ?? "";
if (!token) {
  console.log("A Drive não está ligada (ou a ligação expirou). Ligue a conta em Configurações › Google Drive e corra de novo.");
  await db.close();
  process.exit(1);
}
const ficheiros = (await db.query<DriveFileRow>(
  "SELECT * FROM drive_files WHERE stored_in = 'google' AND COALESCE(drive_id, '') <> '' ORDER BY created_at")).rows;

if (passo === "descarregar") {
  if (manifesto.conta && manifesto.conta !== conta) {
    console.log(`Já há ficheiros descarregados da conta ${manifesto.conta}. Ligada agora: ${conta}. Para recomeçar, apague ${dir}.`);
    await db.close();
    process.exit(1);
  }
  manifesto.conta = conta;
  let novos = 0, falhas = 0;
  for (const f of ficheiros) {
    if (manifesto.entradas[f.id]) continue;
    const res = await fetch(`${DRIVE_FILES_URL}/${encodeURIComponent(f.drive_id!)}?alt=media&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) { falhas++; console.log(`  não descarregado (${res.status}): ${f.name}`); continue; }
    writeFileSync(join(dir, f.id), Buffer.from(await res.arrayBuffer()));
    manifesto.entradas[f.id] = { id: f.id, ficheiro: f.id };
    novos++;
    if (novos % 20 === 0) { gravarManifesto(); console.log(`  ${novos} descarregados…`); }
  }
  gravarManifesto();
  console.log(`\nConta ${conta}: ${novos} ficheiros descarregados${falhas ? `, ${falhas} não (já não existem ou sem acesso)` : ""}; ${Object.keys(manifesto.entradas).length} no total.`);
  console.log("Agora ligue a conta NOVA em Configurações › Google Drive e corra o passo «carregar».");
  await db.close();
  process.exit(0);
}

// carregar
if (!manifesto.conta) {
  console.log("Ainda não há nada descarregado: corra primeiro o passo «descarregar» com a conta antiga ligada.");
  await db.close();
  process.exit(1);
}
if (manifesto.conta === conta) {
  console.log(`A conta ligada (${conta}) é a mesma de onde os ficheiros vieram. Ligue a conta nova e corra de novo.`);
  await db.close();
  process.exit(1);
}

// Colunas que guardam o endereço do ficheiro (drive_url) junto do id (drive_file_id): atualizam-se para o novo.
const comEndereco = (await db.query<{ tabela: string }>(
  `SELECT c.table_name AS tabela FROM information_schema.columns c
    WHERE c.table_schema = current_schema() AND c.column_name = 'drive_url'
      AND EXISTS (SELECT 1 FROM information_schema.columns d WHERE d.table_schema = c.table_schema AND d.table_name = c.table_name AND d.column_name = 'drive_file_id')`)).rows.map(r => r.tabela);

const porId = new Map(ficheiros.map(f => [f.id, f]));
let feitos = 0, falhas = 0;
for (const e of Object.values(manifesto.entradas)) {
  if (e.carregado) continue;
  const f = porId.get(e.id);
  if (!f) { e.erro = "registo já não existe"; continue; }
  try {
    // Pasta: a da pré-inscrição, a do formador ou a regra normal (turma, dossiê, tipo de ficheiro).
    const lead = (await db.query<{ id: number; nome: string; apelido: string }>(
      `SELECT p.id, COALESCE(p.nome, '') AS nome, COALESCE(p.apelido, '') AS apelido
         FROM preinscricao_docs d JOIN preinscricoes p ON p.id = d.preinscricao_id WHERE d.drive_file_id = $1 LIMIT 1`, [f.id])).rows[0];
    const item = (await db.query<{ item_id: string }>("SELECT item_id FROM dtp_anexos WHERE drive_file_id = $1 LIMIT 1", [f.id])).rows[0];
    const zona = lead ? await garantirPastaPendente(db, lead)
      : f.kind === "formador-doc" && f.formando ? await garantirBolsaFormador(db, f.formando)
      : null;
    const ctx = {
      kind: f.kind, regime: f.regime ?? undefined, turma: f.turma ?? undefined, formando: f.formando ?? undefined,
      label: f.label ?? undefined, itemId: item?.item_id,
    };
    const bytes = readFileSync(join(dir, e.ficheiro));
    const mime = f.mime_type ?? "application/octet-stream";
    let novo: Awaited<ReturnType<typeof uploadToGoogle>>;
    try {
      novo = await uploadToGoogle(token, zona?.pastaId || await pastaDeDestino(db, token, ctx), f.name, mime, bytes);
    } catch (err) {
      // A pasta guardada da turma ainda era da conta antiga: esquece-se e cria-se na conta nova.
      if (zona || !isNotFound(err) || !f.turma || (f.regime !== "gold" && f.regime !== "fin")) throw err;
      await esquecerPastaDaTurma(db, f.regime, f.turma);
      novo = await uploadToGoogle(token, await pastaDeDestino(db, token, ctx), f.name, mime, bytes);
    }
    await db.query("UPDATE drive_files SET drive_id = $2, web_view_link = $3, web_content_link = $4 WHERE id = $1",
      [f.id, novo.id, novo.webViewLink ?? null, novo.webContentLink ?? null]);
    for (const t of comEndereco) {
      await db.query(`UPDATE "${t}" SET drive_url = $2 WHERE drive_file_id = $1`, [f.id, novo.webViewLink ?? ""]);
    }
    e.carregado = true;
    delete e.erro;
    feitos++;
    if (feitos % 20 === 0) { gravarManifesto(); console.log(`  ${feitos} carregados…`); }
  } catch (err) {
    falhas++;
    e.erro = err instanceof Error ? err.message : String(err);
    console.log(`  falhou: ${f.name}: ${e.erro}`);
  }
}
gravarManifesto();
const faltam = Object.values(manifesto.entradas).filter(e => !e.carregado).length;
console.log(`\nConta ${conta}: ${feitos} ficheiros carregados${falhas ? `, ${falhas} falharam` : ""}; ${faltam ? `faltam ${faltam} (corra outra vez)` : "todos passaram"}.`);
if (!faltam) console.log(`Confirme no GesForma e na Drive; depois pode apagar ${dir}.`);
await db.close();
process.exit(0);
