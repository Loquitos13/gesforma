import type { Db } from "./db/pool.js";
import {
  apagarItemGoogle,
  criarAtalhoDrive,
  garantirPastaFilha,
  moverPastaDrive,
  nomesNoCronograma,
  partilharPasta,
  raizDoProjecto,
  sanitizeFileName,
  tokenDrive,
} from "./googleDrive.js";

export const ZONA_PENDENTES = "01_INSCRIÇÕES_PENDENTES";
export const ZONA_TURMAS = "02_TURMAS_ATIVAS";
export const ZONA_BOLSA = "00_BOLSA_FORMADORES";

export const PASTAS_DTP = [
  "1. Enquadramento da ação",
  "2. Recursos pedagógicos e materiais didáticos",
  "3. Formadores",
  "4. Equipa Técnica",
  "5. Formandos",
  "6. Registos de assiduidade e de desenvolvimento das sessões",
  "7. Ferramentas e critérios de avaliação da aprendizagem",
  "8. Mecanismos de avaliação à ação formativa",
  "9. Processos e ferramentas de supervisão e apoio pedagógico",
  "10. Plano de informação e divulgação da oferta formativa",
  "11. Certificados",
  "12. Princípios de equidade e inclusão",
  "13. Articulação com Academia Digital",
  "14. Inquéritos da turma",
] as const;

export const PASTA_FORMADORES = PASTAS_DTP[2];
export const PASTA_FORMANDOS = PASTAS_DTP[4];

export type EstruturaTurma = {
  turmaPastaId: string;
  formandosId: string;
  formadoresId: string;
  pastas: Record<string, string>;
};

export function nomePastaPessoa(id: number, nome: string) {
  const pessoa = sanitizeFileName(nome.trim() || "Pessoa");
  return `${id} - ${pessoa}`.slice(0, 180);
}

function tabelaTurma(regime: "gold" | "fin") {
  return regime === "gold" ? "turmas_gold" : "turmas_fin";
}

export async function criarEstruturaDtp(
  db: Db,
  input: { regime: "gold" | "fin"; turmaId: number; nome: string },
  token = "",
): Promise<EstruturaTurma | null> {
  const acesso = token || await tokenDrive(db);
  if (!acesso) return null;
  const root = await raizDoProjecto(db, acesso);
  const zona = await garantirPastaFilha(acesso, root, ZONA_TURMAS);
  const turmaNome = nomePastaPessoa(input.turmaId, input.nome.trim() || `Turma ${input.turmaId}`);
  const turmaPastaId = await garantirPastaFilha(acesso, zona, turmaNome);
  const criadas = await Promise.all(PASTAS_DTP.map(async nome => {
    const id = await garantirPastaFilha(acesso, turmaPastaId, nome);
    return [nome, id] as const;
  }));
  const pastas = Object.fromEntries(criadas);
  const formandosId = pastas[PASTA_FORMANDOS] ?? "";
  const formadoresId = pastas[PASTA_FORMADORES] ?? "";
  await db.query(
    `UPDATE ${tabelaTurma(input.regime)}
        SET drive_pasta_id = $2,
            drive_dossie_id = $2,
            drive_formandos_id = $3,
            drive_formadores_id = $4
      WHERE id = $1`,
    [input.turmaId, turmaPastaId, formandosId, formadoresId],
  );
  return { turmaPastaId, formandosId, formadoresId, pastas };
}

async function emailsDaTurma(db: Db, input: {
  regime: "gold" | "fin";
  turmaId: number;
  nome: string;
  formador?: string;
  formadores?: string[];
  cronograma?: unknown;
}) {
  const admins = await db.query<{ email: string }>(
    "SELECT email FROM users WHERE role = 'admin' AND active = true AND email <> ''",
  );
  const secretaria = await db.query<{ email: string }>(
    "SELECT email FROM users WHERE role IN ('admin', 'secretaria') AND active = true AND email <> ''",
  );
  const formandos = input.regime === "gold"
    ? await db.query<{ email: string }>("SELECT email FROM formandos_gold WHERE turma_id = $1 AND email <> ''", [input.turmaId])
    : await db.query<{ email: string }>(
      `SELECT email FROM formandos_fin
        WHERE email <> '' AND (turma_id = $1 OR lower(trim(turma)) = lower(trim($2)))`,
      [input.turmaId, input.nome],
    );
  const nomes = nomesNoCronograma(input.cronograma, [input.formador ?? "", ...(input.formadores ?? [])]);
  const formadores = nomes.length
    ? await db.query<{ email: string }>(
      `SELECT email FROM formadores
        WHERE email <> ''
          AND lower(trim(nome)) IN (SELECT lower(trim(jsonb_array_elements_text($1::jsonb))))`,
      [nomes],
    )
    : { rows: [] as { email: string }[] };
  const turma = new Set<string>();
  for (const row of [...admins.rows, ...formandos.rows, ...formadores.rows]) {
    const email = row.email.trim().toLowerCase();
    if (email.includes("@")) turma.add(email);
  }
  const dossie = new Set<string>();
  for (const row of secretaria.rows) {
    const email = row.email.trim().toLowerCase();
    if (email.includes("@")) dossie.add(email);
  }
  return { turma: [...turma], dossie: [...dossie], nomes };
}

export async function prepararTurmaDrive(db: Db, input: {
  regime: "gold" | "fin";
  turmaId: number;
  nome: string;
  formador?: string;
  formadores?: string[];
  cronograma?: unknown;
}) {
  const token = await tokenDrive(db);
  if (!token) return { ok: false as const, reason: "drive" as const };
  const estrutura = await criarEstruturaDtp(db, input, token);
  if (!estrutura) return { ok: false as const, reason: "drive" as const };
  const pessoas = await emailsDaTurma(db, input);
  for (const email of pessoas.turma) {
    await partilharPasta(token, estrutura.turmaPastaId, email).catch(() => undefined);
  }
  for (const email of pessoas.dossie) {
    await partilharPasta(token, estrutura.turmaPastaId, email).catch(() => undefined);
  }
  await atalhosDosNomes(db, token, input.regime, input.turmaId, estrutura.formadoresId, pessoas.nomes);
  return { ok: true as const, ...estrutura };
}

export async function garantirPastaPendente(db: Db, lead: { id: number; nome: string; apelido: string }) {
  const token = await tokenDrive(db);
  if (!token) return null;
  const actual = await db.query<{ drive_pasta_id: string; drive_pasta_parent_id: string }>(
    "SELECT drive_pasta_id, drive_pasta_parent_id FROM preinscricoes WHERE id = $1",
    [lead.id],
  );
  const nome = nomePastaPessoa(lead.id, `${lead.nome} ${lead.apelido}`);
  const path = `${ZONA_PENDENTES} / ${nome}`;
  const gravada = actual.rows[0];
  if (gravada?.drive_pasta_id) {
    return { pastaId: gravada.drive_pasta_id, parentId: gravada.drive_pasta_parent_id, path };
  }
  const root = await raizDoProjecto(db, token);
  const pendentes = await garantirPastaFilha(token, root, ZONA_PENDENTES);
  const pastaId = await garantirPastaFilha(token, pendentes, nome);
  await db.query(
    `UPDATE preinscricoes
        SET drive_pasta_id = $2, drive_pasta_parent_id = $3
      WHERE id = $1 AND drive_pasta_id = ''`,
    [lead.id, pastaId, pendentes],
  );
  return { pastaId, parentId: pendentes, path: `${ZONA_PENDENTES} / ${nome}` };
}

async function caminhosDaInscricao(db: Db, leadId: number, path: string, turmaNome: string) {
  await db.query(
    `UPDATE drive_files
        SET folder_path = $2, turma = $3
      WHERE id IN (SELECT drive_file_id FROM preinscricao_docs WHERE preinscricao_id = $1 AND drive_file_id <> '')`,
    [leadId, path, turmaNome],
  );
}

export async function moverPastaFormando(
  db: Db,
  leadId: number,
  regime: "gold" | "fin",
  turmaId: number,
) {
  const token = await tokenDrive(db);
  const lead = await db.query<{
    id: number; nome: string; apelido: string; drive_pasta_id: string; drive_pasta_parent_id: string;
  }>(
    "SELECT id, nome, apelido, drive_pasta_id, drive_pasta_parent_id FROM preinscricoes WHERE id = $1",
    [leadId],
  );
  const row = lead.rows[0];
  if (!row) return { moved: false as const };
  const turma = await db.query<{ nome: string }>(
    `SELECT nome FROM ${tabelaTurma(regime)} WHERE id = $1`,
    [turmaId],
  );
  const turmaNome = String(turma.rows[0]?.nome ?? `Turma ${turmaId}`);
  if (!token) return { moved: false as const, turma: turmaNome };
  const estrutura = await criarEstruturaDtp(db, { regime, turmaId, nome: turmaNome }, token);
  if (!estrutura?.formandosId) return { moved: false as const, turma: turmaNome };
  const pessoa = nomePastaPessoa(row.id, `${row.nome} ${row.apelido}`);
  const path = `${ZONA_TURMAS} / ${nomePastaPessoa(turmaId, turmaNome)} / ${PASTA_FORMANDOS} / ${pessoa}`;
  let pastaId = row.drive_pasta_id.trim();
  if (!pastaId) {
    pastaId = await garantirPastaFilha(token, estrutura.formandosId, pessoa);
  } else if (row.drive_pasta_parent_id !== estrutura.formandosId) {
    await moverPastaDrive(token, pastaId, estrutura.formandosId, row.drive_pasta_parent_id);
  }
  await db.query(
    "UPDATE preinscricoes SET drive_pasta_id = $2, drive_pasta_parent_id = $3, turma_id = $4 WHERE id = $1",
    [leadId, pastaId, estrutura.formandosId, turmaId],
  );
  await caminhosDaInscricao(db, leadId, path, turmaNome);
  return { moved: true as const, turma: turmaNome, pastaId };
}

export async function garantirBolsaFormador(db: Db, nome: string) {
  const token = await tokenDrive(db);
  if (!token || !nome.trim()) return null;
  const found = await db.query<{ id: number; nome: string; drive_pasta_id: string }>(
    "SELECT id, nome, drive_pasta_id FROM formadores WHERE lower(trim(nome)) = lower(trim($1)) ORDER BY id LIMIT 1",
    [nome.trim()],
  );
  const formador = found.rows[0];
  if (formador?.drive_pasta_id) {
    return {
      pastaId: formador.drive_pasta_id,
      path: `${ZONA_BOLSA} / ${nomePastaPessoa(formador.id, formador.nome)}`,
      formadorId: formador.id,
    };
  }
  const root = await raizDoProjecto(db, token);
  const bolsa = await garantirPastaFilha(token, root, ZONA_BOLSA);
  const etiqueta = formador ? nomePastaPessoa(formador.id, formador.nome) : sanitizeFileName(nome.trim());
  const pastaId = await garantirPastaFilha(token, bolsa, etiqueta);
  if (formador) {
    await db.query("UPDATE formadores SET drive_pasta_id = $2 WHERE id = $1", [formador.id, pastaId]);
  }
  return { pastaId, path: `${ZONA_BOLSA} / ${etiqueta}`, formadorId: formador?.id ?? 0 };
}

async function atalhosDeUmFormador(
  db: Db,
  token: string,
  formadorId: number,
  nome: string,
  regime: "gold" | "fin",
  turmaId: number,
  pastaFormadoresId: string,
) {
  const docs = await db.query<{ doc_id: string; file_name: string; drive_id: string; local_id: string }>(
    `SELECT d.doc_id, d.file_name, f.drive_id, f.id AS local_id
       FROM formador_docs d
       JOIN drive_files f ON f.id = d.drive_file_id
      WHERE d.formador_id = $1 AND d.drive_file_id <> '' AND COALESCE(f.drive_id, '') <> ''`,
    [formadorId],
  );
  for (const doc of docs.rows) {
    const ja = await db.query<{ id: number; drive_file_id: string; shortcut_id: string }>(
      `SELECT id, drive_file_id, shortcut_id FROM formador_atalhos
        WHERE formador_id = $1 AND regime = $2 AND turma_id = $3 AND doc_id = $4`,
      [formadorId, regime, turmaId, doc.doc_id],
    );
    const existente = ja.rows[0];
    if (existente?.shortcut_id && existente.drive_file_id === doc.local_id) continue;
    if (existente?.shortcut_id) {
      await apagarItemGoogle(token, existente.shortcut_id).catch(() => undefined);
    }
    const atalho = await criarAtalhoDrive(token, {
      name: `${nome} - ${doc.file_name || doc.doc_id}`,
      targetId: doc.drive_id,
      parentId: pastaFormadoresId,
    });
    await db.query(
      `INSERT INTO formador_atalhos (formador_id, regime, turma_id, doc_id, drive_file_id, shortcut_id)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (formador_id, regime, turma_id, doc_id) DO UPDATE SET
         drive_file_id = EXCLUDED.drive_file_id,
         shortcut_id = EXCLUDED.shortcut_id`,
      [formadorId, regime, turmaId, doc.doc_id, doc.local_id, atalho.id],
    );
  }
}

async function atalhosDosNomes(
  db: Db,
  token: string,
  regime: "gold" | "fin",
  turmaId: number,
  pastaFormadoresId: string,
  nomes: string[],
) {
  const unicos = [...new Set(nomes.map(n => n.trim()).filter(Boolean))];
  if (!unicos.length || !pastaFormadoresId) return;
  const rows = await db.query<{ id: number; nome: string }>(
    `SELECT id, nome FROM formadores
      WHERE lower(trim(nome)) IN (SELECT lower(trim(jsonb_array_elements_text($1::jsonb))))`,
    [unicos],
  );
  for (const formador of rows.rows) {
    await atalhosDeUmFormador(db, token, formador.id, formador.nome, regime, turmaId, pastaFormadoresId);
  }
}

export async function sincronizarAtalhosDoFormador(db: Db, formadorId: number) {
  const token = await tokenDrive(db);
  if (!token) return { ok: false as const };
  const formador = await db.query<{ nome: string }>("SELECT nome FROM formadores WHERE id = $1", [formadorId]);
  const nome = formador.rows[0]?.nome?.trim();
  if (!nome) return { ok: false as const };
  const turmas = await db.query<{ regime: "gold" | "fin"; id: number; nome: string; formadores_id: string }>(
    `SELECT 'gold' AS regime, id, nome, drive_formadores_id AS formadores_id FROM turmas_gold
      WHERE lower(trim(formador)) = lower(trim($1))
         OR formadores @> jsonb_build_array($1::text)
     UNION ALL
     SELECT 'fin', id, nome, drive_formadores_id FROM turmas_fin
      WHERE lower(trim(formador)) = lower(trim($1))
         OR formadores @> jsonb_build_array($1::text)`,
    [nome],
  );
  for (const turma of turmas.rows) {
    const estrutura = await criarEstruturaDtp(db, { regime: turma.regime, turmaId: turma.id, nome: turma.nome }, token);
    if (!estrutura?.formadoresId) continue;
    await atalhosDeUmFormador(db, token, formadorId, nome, turma.regime, turma.id, estrutura.formadoresId);
  }
  return { ok: true as const, turmas: turmas.rows.length };
}
