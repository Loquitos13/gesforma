/**
 * Cursos Gold e financiados: catálogo, ficha (site e pedagogia) e ficheiros do curso.
 * Todo o SQL do domínio "cursos" vive aqui.
 */
import { Filtros, many, one, ordenarPor, padraoPesquisa, valor, type Consulta, type Regime } from "./sql.js";

const num = (v: unknown) => (v == null || v === "" ? 0 : Number(v));

/** Literal de array de texto do Postgres (`{"a","b"}`), aceite como parâmetro `$n` em Postgres e PGlite. */
export function textoArray(valores: string[]) {
  return `{${valores.map(v => `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",")}}`;
}

export type CursoGold = { id: number; nome: string; categoria: string; tipo: string; preco: number; regime: string; horas: number; estado: string; entidadeResponsavelId: number | null };
export type CursoFin = { id: number; ufcdCod: string; ufcd: string; nomeComercial: string; regime: string; horas: number; estado: string; areaCnaef: string };

export function mapCursoGold(r: Record<string, unknown>): CursoGold {
  return {
    id: num(r.id), nome: String(r.nome ?? ""), categoria: String(r.categoria ?? ""), tipo: String(r.tipo ?? "Gold"),
    preco: num(r.preco), regime: String(r.regime ?? ""), horas: num(r.horas), estado: String(r.estado ?? "Ativo"),
    entidadeResponsavelId: r.entidade_responsavel_id == null ? null : num(r.entidade_responsavel_id),
  };
}

export function mapCursoFin(r: Record<string, unknown>): CursoFin {
  return {
    id: num(r.id), ufcdCod: String(r.ufcd_cod ?? ""), ufcd: String(r.ufcd ?? ""), nomeComercial: String(r.nome_comercial ?? ""),
    regime: String(r.regime ?? ""), horas: num(r.horas), estado: String(r.estado ?? "Ativo"), areaCnaef: String(r.area_cnaef ?? ""),
  };
}

export async function proximoId(c: Consulta) {
  return Number(await valor<number>(c, "SELECT nextval('ops_id_seq')::int AS id"));
}

/** Uso de cada curso: turmas abertas, formandos e pré-inscrições, contados em SQL. */
const USO_GOLD = `
  (SELECT count(*)::int FROM turmas_gold t WHERE (t.curso_id = c.id OR (t.curso_id IS NULL AND t.curso = c.nome)) AND t.fechada_em IS NULL) AS turmas_abertas,
  (SELECT count(*)::int FROM turmas_gold t WHERE t.curso_id = c.id OR (t.curso_id IS NULL AND t.curso = c.nome)) AS turmas_total,
  (SELECT count(*)::int FROM formandos_gold f WHERE f.curso = c.nome) AS formandos,
  (SELECT count(*)::int FROM preinscricoes p WHERE p.curso = c.nome AND p.validada_em IS NULL AND p.estado NOT IN ('Desistiu', 'Formando')) AS preinscricoes,
  EXISTS (SELECT 1 FROM curso_fichas cf WHERE cf.regime = 'gold' AND cf.curso_id = c.id) AS tem_ficha`;

const USO_FIN = `
  (SELECT count(*)::int FROM turmas_fin t WHERE (t.curso_id = c.id OR (t.curso_id IS NULL AND t.curso IN (c.ufcd, c.nome_comercial))) AND t.fechada_em IS NULL) AS turmas_abertas,
  (SELECT count(*)::int FROM turmas_fin t WHERE t.curso_id = c.id OR (t.curso_id IS NULL AND t.curso IN (c.ufcd, c.nome_comercial))) AS turmas_total,
  (SELECT count(*)::int FROM formandos_fin f WHERE f.curso IN (c.ufcd, c.nome_comercial)) AS formandos,
  (SELECT count(*)::int FROM preinscricoes p WHERE p.curso IN (c.ufcd, c.nome_comercial) AND p.validada_em IS NULL AND p.estado NOT IN ('Desistiu', 'Formando')) AS preinscricoes,
  EXISTS (SELECT 1 FROM curso_fichas cf WHERE cf.regime = 'fin' AND cf.curso_id = c.id) AS tem_ficha`;

export type FiltroCursos = { q?: string; estado?: string; categoria?: string; tipo?: string; modalidade?: string; ordem?: string };

export type UsoCurso = { turmasAbertas: number; turmasTotal: number; formandos: number; preinscricoes: number; temFicha: boolean };

function uso(r: Record<string, unknown>): UsoCurso {
  return {
    turmasAbertas: num(r.turmas_abertas), turmasTotal: num(r.turmas_total), formandos: num(r.formandos),
    preinscricoes: num(r.preinscricoes), temFicha: Boolean(r.tem_ficha),
  };
}

export async function listarCursosGold(c: Consulta, f: FiltroCursos = {}) {
  const w = new Filtros();
  const q = padraoPesquisa(f.q);
  w.add("(c.nome ILIKE ? OR c.categoria ILIKE ?)", q, q);
  w.add("c.estado = ?", f.estado);
  w.add("c.categoria = ?", f.categoria);
  w.add("c.tipo = ?", f.tipo);
  w.add("c.regime = ?", f.modalidade);
  const ordem = ordenarPor({ nome: "c.nome", preco: "c.preco", horas: "c.horas", estado: "c.estado", turmas: "turmas_abertas" }, f.ordem, "c.nome");
  const linhas = await many(c, `SELECT c.*, ${USO_GOLD} FROM cursos_gold c ${w.where} ${ordem}`, w.params);
  return linhas.map(r => ({ ...mapCursoGold(r), uso: uso(r) }));
}

export async function listarCursosFin(c: Consulta, f: FiltroCursos = {}) {
  const w = new Filtros();
  const q = padraoPesquisa(f.q);
  w.add("(c.ufcd ILIKE ? OR c.nome_comercial ILIKE ? OR c.ufcd_cod ILIKE ?)", q, q, q);
  w.add("c.estado = ?", f.estado);
  w.add("c.regime = ?", f.modalidade);
  const ordem = ordenarPor({ nome: "c.nome_comercial", ufcd: "c.ufcd_cod", horas: "c.horas", estado: "c.estado", turmas: "turmas_abertas" }, f.ordem, "c.nome_comercial");
  const linhas = await many(c, `SELECT c.*, ${USO_FIN} FROM cursos_fin c ${w.where} ${ordem}`, w.params);
  return linhas.map(r => ({ ...mapCursoFin(r), uso: uso(r) }));
}

/** Totais do catálogo para o cabeçalho (activos, inactivos, com turmas abertas). */
export async function resumoCursos(c: Consulta, regime: Regime) {
  const tabela = regime === "gold" ? "cursos_gold" : "cursos_fin";
  const uso = regime === "gold" ? USO_GOLD : USO_FIN;
  const r = await one(c, `
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE estado = 'Ativo')::int AS ativos,
           count(*) FILTER (WHERE turmas_abertas > 0)::int AS com_turmas
      FROM (SELECT c.estado, ${uso} FROM ${tabela} c) s`);
  return { total: num(r?.total), ativos: num(r?.ativos), comTurmas: num(r?.com_turmas) };
}

export async function obterCursoGold(c: Consulta, id: number) {
  const r = await one(c, `SELECT c.*, ${USO_GOLD} FROM cursos_gold c WHERE c.id = $1`, [id]);
  return r ? { ...mapCursoGold(r), uso: uso(r) } : null;
}

export async function obterCursoFin(c: Consulta, id: number) {
  const r = await one(c, `SELECT c.*, ${USO_FIN} FROM cursos_fin c WHERE c.id = $1`, [id]);
  return r ? { ...mapCursoFin(r), uso: uso(r) } : null;
}

export async function obterCurso(c: Consulta, regime: Regime, id: number) {
  return regime === "gold" ? obterCursoGold(c, id) : obterCursoFin(c, id);
}

export async function criarCursoGold(c: Consulta, id: number, d: Omit<CursoGold, "id" | "entidadeResponsavelId"> & { entidadeResponsavelId?: number | null }) {
  await exec(c, `INSERT INTO cursos_gold (id, nome, categoria, tipo, preco, regime, horas, estado, entidade_responsavel_id)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
  [id, d.nome, d.categoria, d.tipo, d.preco, d.regime, d.horas, d.estado, d.entidadeResponsavelId ?? null]);
}

/** Muda (ou retira, com null) a entidade responsável do curso Gold. */
export async function definirEntidadeCurso(c: Consulta, id: number, entidadeId: number | null) {
  await exec(c, "UPDATE cursos_gold SET entidade_responsavel_id = $2 WHERE id = $1", [id, entidadeId]);
}

export async function entidadeExiste(c: Consulta, id: number) {
  return Number(await valor<number>(c, "SELECT count(*)::int FROM dtp_entidades WHERE id = $1", [id])) > 0;
}

export async function actualizarCursoGold(c: Consulta, id: number, d: Partial<Omit<CursoGold, "id">>) {
  await exec(c, `UPDATE cursos_gold SET nome = COALESCE($2, nome), categoria = COALESCE($3, categoria), tipo = COALESCE($4, tipo),
      preco = COALESCE($5, preco), regime = COALESCE($6, regime), horas = COALESCE($7, horas), estado = COALESCE($8, estado) WHERE id = $1`,
  [id, d.nome ?? null, d.categoria ?? null, d.tipo ?? null, d.preco ?? null, d.regime ?? null, d.horas ?? null, d.estado ?? null]);
}

export async function criarCursoFin(c: Consulta, id: number, d: Omit<CursoFin, "id">) {
  await exec(c, "INSERT INTO cursos_fin (id, ufcd_cod, ufcd, nome_comercial, regime, horas, estado, area_cnaef) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
    [id, d.ufcdCod, d.ufcd, d.nomeComercial, d.regime, d.horas, d.estado, d.areaCnaef]);
}

export async function actualizarCursoFin(c: Consulta, id: number, d: Partial<Omit<CursoFin, "id">>) {
  await exec(c, `UPDATE cursos_fin SET ufcd_cod = COALESCE($2, ufcd_cod), ufcd = COALESCE($3, ufcd), nome_comercial = COALESCE($4, nome_comercial),
      regime = COALESCE($5, regime), horas = COALESCE($6, horas), estado = COALESCE($7, estado), area_cnaef = COALESCE($8, area_cnaef) WHERE id = $1`,
  [id, d.ufcdCod ?? null, d.ufcd ?? null, d.nomeComercial ?? null, d.regime ?? null, d.horas ?? null, d.estado ?? null, d.areaCnaef ?? null]);
}

/**
 * Já há outro curso do regime com este nome (Gold: nome; Fin: nome comercial)? Sem índice único
 * na base porque dados antigos podem ter repetidos; quem cria ou renomeia tranca primeiro (`trancarNomesCursos`).
 */
export async function nomeCursoOcupado(c: Consulta, regime: Regime, nome: string, excluirId: number | null = null) {
  const sql = regime === "gold"
    ? "SELECT count(*)::int FROM cursos_gold WHERE lower(trim(nome)) = lower(trim($1)) AND ($2::int IS NULL OR id <> $2)"
    : "SELECT count(*)::int FROM cursos_fin WHERE lower(trim(nome_comercial)) = lower(trim($1)) AND ($2::int IS NULL OR id <> $2)";
  return Number(await valor<number>(c, sql, [nome, excluirId])) > 0;
}

/** Serializa criar/renomear cursos do regime até ao fim da transacção (dois pedidos iguais ao mesmo tempo). */
export async function trancarNomesCursos(c: Consulta, regime: Regime) {
  await many(c, "SELECT pg_advisory_xact_lock(7241101, $1::int)", [regime === "gold" ? 1 : 2]);
}

export async function apagarCurso(c: Consulta, regime: Regime, id: number) {
  await exec(c, regime === "gold" ? "DELETE FROM cursos_gold WHERE id = $1" : "DELETE FROM cursos_fin WHERE id = $1", [id]);
}

async function exec(c: Consulta, sql: string, params: unknown[]) {
  await many(c, sql, params);
}

/** Nomes pelos quais o curso aparece em turmas e formandos (na Fin: UFCD e nome comercial). */
export async function nomesDoCurso(c: Consulta, regime: Regime, id: number): Promise<string[]> {
  if (regime === "gold") {
    const nome = (await valor<string>(c, "SELECT nome FROM cursos_gold WHERE id = $1", [id]))?.trim() ?? "";
    return nome ? [nome] : [];
  }
  const r = await one<{ ufcd: string; nome_comercial: string }>(c, "SELECT ufcd, nome_comercial FROM cursos_fin WHERE id = $1", [id]);
  if (!r) return [];
  return [...new Set([r.ufcd, r.nome_comercial].map(s => (s ?? "").trim()).filter(Boolean))];
}

export async function tipoDoCurso(c: Consulta, regime: Regime, id: number) {
  if (regime === "fin") return "Financiada";
  return String((await valor<string>(c, "SELECT tipo FROM cursos_gold WHERE id = $1", [id])) ?? "");
}

/** Formandos e formadores ligados ao curso (pelas turmas e pelo nome do curso). */
export async function pessoasDoCurso(c: Consulta, regime: Regime, id: number) {
  const nomes = await nomesDoCurso(c, regime, id);
  if (!nomes.length) return { formandos: [] as { id: number; nome: string }[], formadores: [] as { id: number | null; nome: string }[] };
  const sqlFormandos = regime === "gold"
    ? `SELECT DISTINCT f.id, f.nome, f.apelido FROM formandos_gold f
        WHERE f.curso = ANY($1::text[]) OR f.turma IN (SELECT nome FROM turmas_gold WHERE curso = ANY($1::text[]))
        ORDER BY f.nome, f.apelido`
    : `SELECT DISTINCT f.id, f.nome, f.apelido FROM formandos_fin f
        WHERE f.curso = ANY($1::text[]) OR f.turma IN (SELECT nome FROM turmas_fin WHERE curso = ANY($1::text[]))
        ORDER BY f.nome, f.apelido`;
  const sqlFormadores = regime === "gold"
    ? `SELECT DISTINCT ON (lower(trim(t.formador))) fo.id, coalesce(fo.nome, trim(t.formador)) AS nome
         FROM turmas_gold t LEFT JOIN formadores fo ON lower(trim(fo.nome)) = lower(trim(t.formador))
        WHERE t.curso = ANY($1::text[]) AND trim(t.formador) <> '' ORDER BY lower(trim(t.formador))`
    : `SELECT DISTINCT ON (lower(trim(t.formador))) fo.id, coalesce(fo.nome, trim(t.formador)) AS nome
         FROM turmas_fin t LEFT JOIN formadores fo ON lower(trim(fo.nome)) = lower(trim(t.formador))
        WHERE t.curso = ANY($1::text[]) AND trim(t.formador) <> '' ORDER BY lower(trim(t.formador))`;
  const formandos = await many<{ id: number; nome: string; apelido: string }>(c, sqlFormandos, [textoArray(nomes)]);
  const formadores = await many<{ id: number | null; nome: string }>(c, sqlFormadores, [textoArray(nomes)]);
  return {
    formandos: formandos.map(f => ({ id: num(f.id), nome: `${f.nome} ${f.apelido}`.trim() })),
    formadores: formadores.map(f => ({ id: f.id == null ? null : num(f.id), nome: f.nome })),
  };
}

/** Turmas do curso (para a ficha). */
export async function turmasDoCurso(c: Consulta, regime: Regime, id: number) {
  const nomes = await nomesDoCurso(c, regime, id);
  const sql = regime === "gold"
    ? `SELECT id, nome, data_inicio, local, horario, formador, total_alunos AS inscritos, vagas, fechada_em IS NOT NULL AS fechada
         FROM turmas_gold WHERE curso_id = $1 OR (curso_id IS NULL AND curso = ANY($2::text[])) ORDER BY data_inicio DESC`
    : `SELECT id, nome, data_inicio, local, horario, formador, alunos AS inscritos, alunos_total AS vagas, fechada_em IS NOT NULL AS fechada
         FROM turmas_fin WHERE curso_id = $1 OR (curso_id IS NULL AND curso = ANY($2::text[])) ORDER BY data_inicio DESC`;
  const linhas = await many(c, sql, [id, textoArray(nomes)]);
  return linhas.map(r => ({
    id: num(r.id), nome: String(r.nome ?? ""), inicio: String(r.data_inicio ?? ""), local: String(r.local ?? ""),
    horario: String(r.horario ?? ""), formador: String(r.formador ?? ""), inscritos: num(r.inscritos), vagas: num(r.vagas), fechada: Boolean(r.fechada),
  }));
}

// ── Ficheiros do curso (dossiê do curso e modelos de consentimento) ─────────

export type FicheiroCurso = {
  id: string; ambito: string; requisitoId: string; pessoaId: number | null; pessoaNome: string; nome: string; url: string; createdAt: string;
};

export async function listarFicheiros(c: Consulta, regime: Regime, cursoId: number): Promise<FicheiroCurso[]> {
  const linhas = await many<Record<string, unknown>>(c,
    `SELECT id, ambito, requisito_id, pessoa_id, pessoa_nome, nome, drive_file_id, drive_url, created_at
       FROM curso_ficheiros WHERE regime = $1 AND curso_id = $2 ORDER BY created_at DESC`, [regime, cursoId]);
  return linhas.map(f => ({
    id: String(f.id), ambito: String(f.ambito), requisitoId: String(f.requisito_id), pessoaId: f.pessoa_id == null ? null : num(f.pessoa_id),
    pessoaNome: String(f.pessoa_nome ?? ""), nome: String(f.nome ?? ""),
    url: String(f.drive_url || (f.drive_file_id ? `/api/v1/drive/files/${f.drive_file_id}/content` : "")),
    createdAt: String(f.created_at ?? ""),
  }));
}

/** Substitui o ficheiro do mesmo requisito (e pessoa) e grava o novo. */
export async function substituirFicheiro(
  c: Consulta,
  f: { id: string; regime: Regime; cursoId: number; ambito: string; requisitoId: string; pessoaId: number | null; pessoaNome: string; nome: string; driveFileId: string; driveUrl: string },
) {
  if (f.ambito === "formando") {
    await exec(c, "DELETE FROM curso_ficheiros WHERE regime = $1 AND curso_id = $2 AND ambito = 'formando' AND requisito_id = $3 AND pessoa_id = $4",
      [f.regime, f.cursoId, f.requisitoId, f.pessoaId]);
  } else if (f.ambito === "formador") {
    await exec(c, "DELETE FROM curso_ficheiros WHERE regime = $1 AND curso_id = $2 AND ambito = 'formador' AND requisito_id = $3 AND lower(pessoa_nome) = lower($4)",
      [f.regime, f.cursoId, f.requisitoId, f.pessoaNome]);
  } else {
    await exec(c, "DELETE FROM curso_ficheiros WHERE regime = $1 AND curso_id = $2 AND ambito = $3 AND requisito_id = $4",
      [f.regime, f.cursoId, f.ambito, f.requisitoId]);
  }
  await exec(c,
    `INSERT INTO curso_ficheiros (id, regime, curso_id, ambito, requisito_id, pessoa_id, pessoa_nome, nome, drive_file_id, drive_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [f.id, f.regime, f.cursoId, f.ambito, f.requisitoId, f.pessoaId, f.pessoaNome, f.nome, f.driveFileId, f.driveUrl]);
}

export async function apagarFicheiro(c: Consulta, regime: Regime, cursoId: number, ficheiroId: string) {
  await exec(c, "DELETE FROM curso_ficheiros WHERE id = $1 AND regime = $2 AND curso_id = $3", [ficheiroId, regime, cursoId]);
}

export async function apagarModeloConsentimento(c: Consulta, regime: Regime, cursoId: number, docId: string) {
  await exec(c, "DELETE FROM curso_ficheiros WHERE regime = $1 AND curso_id = $2 AND ambito = 'consentimento' AND requisito_id = $3",
    [regime, cursoId, docId]);
}

// ── Ficha do curso (site, programa, critérios) ──────────────────────────────

export async function lerFicha(c: Consulta, regime: Regime, cursoId: number) {
  return one<{ payload: unknown; criterios: unknown }>(c,
    "SELECT payload, criterios FROM curso_fichas WHERE regime = $1 AND curso_id = $2", [regime, cursoId]);
}

export async function listarFichas(c: Consulta, regime: Regime) {
  return many<{ curso_id: number; payload: unknown; criterios: unknown }>(c,
    "SELECT curso_id, payload, criterios FROM curso_fichas WHERE regime = $1", [regime]);
}

export async function gravarFicha(c: Consulta, regime: Regime, cursoId: number, payload: Record<string, unknown> | null, criterios: unknown[] | null) {
  await exec(c,
    `INSERT INTO curso_fichas (regime, curso_id, payload, criterios)
     VALUES ($1, $2, COALESCE($3::jsonb, '{}'::jsonb), COALESCE($4::jsonb, '[]'::jsonb))
     ON CONFLICT (regime, curso_id) DO UPDATE SET
       payload = COALESCE($3::jsonb, curso_fichas.payload),
       criterios = COALESCE($4::jsonb, curso_fichas.criterios),
       updated_at = now()`,
    [regime, cursoId, payload, criterios]);
}

// ── Catálogo público (site) ─────────────────────────────────────────────────

/** Tudo o que o site precisa para montar o catálogo: cursos com ficha, vendas e turmas. */
export async function dadosCatalogoPublico(c: Consulta) {
  const gold = await many<{ id: number; nome: string; categoria: string; tipo: string; preco: number; regime: string; horas: number; estado: string; payload: unknown }>(c,
    `SELECT c.id, c.nome, c.categoria, c.tipo, c.preco, c.regime, c.horas, c.estado, f.payload
       FROM cursos_gold c LEFT JOIN curso_fichas f ON f.regime = 'gold' AND f.curso_id = c.id`);
  const fin = await many<{ id: number; ufcd: string; nome_comercial: string; regime: string; horas: number; estado: string; payload: unknown }>(c,
    `SELECT c.id, c.ufcd, c.nome_comercial, c.regime, c.horas, c.estado, f.payload
       FROM cursos_fin c LEFT JOIN curso_fichas f ON f.regime = 'fin' AND f.curso_id = c.id`);
  const vendas = await many<{ curso: string; n: number }>(c,
    `SELECT curso, sum(n)::int AS n FROM (
       SELECT curso, count(*) AS n FROM formandos_gold GROUP BY curso
       UNION ALL SELECT curso, count(*) FROM pagamentos WHERE lower(trim(estado)) = 'pago' GROUP BY curso
       UNION ALL SELECT curso, count(*) FROM formandos_fin GROUP BY curso
     ) v GROUP BY curso`);
  const turmas = await many<{ curso: string; local: string; horario: string; data_inicio: string; estado: string }>(c,
    `SELECT curso, local, horario, data_inicio, estado FROM turmas_gold
     UNION ALL SELECT curso, local, horario, data_inicio, estado FROM turmas_fin`);
  // Morada de cada local (Edição de cursos › Locais): aparece na escolha do local da página do curso.
  const locais = await many<{ regime: string; nome: string; morada: string; telemovel: string; telefone: string; email: string; whatsapp: string }>(c,
    `SELECT regime, COALESCE(payload->>'nome', '') AS nome, COALESCE(payload->>'morada', '') AS morada,
            COALESCE(payload->>'telemovel', '') AS telemovel, COALESCE(payload->>'telefone', '') AS telefone,
            COALESCE(payload->>'email', '') AS email, COALESCE(payload->>'whatsapp', '') AS whatsapp
       FROM catalog_items WHERE kind = 'locais'`);
  return { gold, fin, vendas, turmas, locais };
}
