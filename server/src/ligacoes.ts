import type { Db } from "./db/pool.js";

type CursoAlvo = { canonical: string; aliases: string[] };

function limpo(s: string) {
  return s.trim().toLowerCase();
}

function semPrefixoCurso(s: string) {
  return limpo(s).replace(/^curso de\s+/, "");
}

/** Nome canónico do curso quando a string guardada é um alias inequívoco. */
export function canonicoCurso(stored: string, alvos: CursoAlvo[]): string | null {
  const raw = stored.trim();
  if (!raw) return null;
  const low = limpo(raw);
  const unicos = (lista: CursoAlvo[]) => [...new Map(lista.map(a => [a.canonical, a])).values()];

  const exact = unicos(alvos.filter(a => [a.canonical, ...a.aliases].some(x => limpo(x) === low)));
  if (exact.length > 1) return null;
  if (exact.length === 1) return exact[0]!.canonical === raw ? null : exact[0]!.canonical;

  const porPrefixo = unicos(alvos.filter(a => semPrefixoCurso(a.canonical) === semPrefixoCurso(raw) || a.aliases.some(x => semPrefixoCurso(x) === semPrefixoCurso(raw))));
  if (porPrefixo.length === 1 && porPrefixo[0]!.canonical !== raw) return porPrefixo[0]!.canonical;

  if (raw.length >= 18) {
    const pref = unicos(alvos.filter(a => {
      const c = a.canonical;
      if (c.length <= raw.length || !limpo(c).startsWith(low)) return false;
      const next = c[raw.length] ?? "";
      return next === " " || next === ":" || next === "-" || next === "–";
    }));
    if (pref.length === 1) return pref[0]!.canonical;
  }
  return null;
}

/** Nome completo do formador quando a turma só guardou o primeiro nome, e esse nome é único. */
export function canonicoFormador(stored: string, nomes: string[]): string | null {
  const raw = stored.trim();
  if (!raw) return null;
  const low = limpo(raw);
  const cheio = nomes.find(n => limpo(n) === low);
  if (cheio) return cheio === raw ? null : cheio;
  const primeiro = nomes.filter(n => limpo(n.split(/\s+/)[0] ?? "") === low);
  if (primeiro.length === 1 && primeiro[0] !== raw) return primeiro[0]!;
  return null;
}

function fraseBloqueio(partes: { n: number; um: string; varios: string }[]) {
  const vivos = partes.filter(p => p.n > 0);
  if (!vivos.length) return null;
  const lista = vivos.map(p => `${p.n} ${p.n === 1 ? p.um : p.varios}`).join(", ");
  return `Não é possível eliminar. Este registo ainda tem ${lista}.`;
}

async function contar(db: Db, sql: string, params: unknown[]) {
  const row = await db.query<{ n: number }>(sql, params);
  return Number(row.rows[0]?.n ?? 0);
}

const CURSO_COLS = [
  ["turmas_gold", "curso"],
  ["turmas_fin", "curso"],
  ["formandos_gold", "curso"],
  ["formandos_fin", "curso"],
  ["preinscricoes", "curso"],
  ["pagamentos", "curso"],
  ["campanhas", "curso"],
  ["propostas_comerciais", "curso"],
  ["contratos_comerciais", "curso"],
  ["email_rules", "curso"],
] as const;

export async function propagarCurso(db: Db, from: string, to: string) {
  const antigo = from.trim();
  const novo = to.trim();
  if (!antigo || !novo || antigo === novo) return;
  for (const [table, col] of CURSO_COLS) {
    await db.query(
      `UPDATE ${table} SET ${col} = $2 WHERE lower(trim(${col})) = lower(trim($1)) AND ${col} IS DISTINCT FROM $2`,
      [antigo, novo],
    );
  }
  await db.query(
    `UPDATE catalog_items
        SET payload = jsonb_set(payload, '{curso}', to_jsonb($2::text), true)
      WHERE jsonb_typeof(payload) = 'object'
        AND lower(trim(coalesce(payload->>'curso', ''))) = lower(trim($1))
        AND payload->>'curso' IS DISTINCT FROM $2`,
    [antigo, novo],
  );
}

function renomearNoCronograma(raw: unknown, from: string, to: string) {
  if (!Array.isArray(raw)) return { next: raw, changed: false };
  const alvo = limpo(from);
  let changed = false;
  const next = raw.map(item => {
    if (!item || typeof item !== "object") return item;
    const s = { ...(item as Record<string, unknown>) };
    if (typeof s.formador === "string" && limpo(s.formador) === alvo && s.formador !== to) {
      s.formador = to;
      changed = true;
    }
    if (Array.isArray(s.formadores)) {
      s.formadores = s.formadores.map(n => {
        if (typeof n === "string" && limpo(n) === alvo && n !== to) {
          changed = true;
          return to;
        }
        return n;
      });
    }
    return s;
  });
  return { next, changed };
}

export async function propagarFormador(db: Db, from: string, to: string) {
  const antigo = from.trim();
  const novo = to.trim();
  if (!antigo || !novo || antigo === novo) return;
  await db.query(`UPDATE turmas_gold SET formador = $2 WHERE lower(trim(formador)) = lower(trim($1))`, [antigo, novo]);
  await db.query(`UPDATE turmas_fin SET formador = $2 WHERE lower(trim(formador)) = lower(trim($1))`, [antigo, novo]);
  for (const table of ["turmas_gold", "turmas_fin"] as const) {
    await db.query(
      `UPDATE ${table} SET formadores = (
         SELECT COALESCE(jsonb_agg(
           CASE WHEN lower(trim(e)) = lower(trim($1)) THEN $2::text ELSE e END
         ), '[]'::jsonb)
           FROM jsonb_array_elements_text(
             CASE WHEN jsonb_typeof(formadores) = 'array' THEN formadores ELSE '[]'::jsonb END
           ) e
       )
       WHERE EXISTS (
         SELECT 1 FROM jsonb_array_elements_text(
           CASE WHEN jsonb_typeof(formadores) = 'array' THEN formadores ELSE '[]'::jsonb END
         ) e
         WHERE lower(trim(e)) = lower(trim($1))
       )`,
      [antigo, novo],
    );
  }
  const rows = await db.query<{ regime: string; id: number; cronograma: unknown }>(
    `SELECT 'gold' AS regime, id, cronograma FROM turmas_gold
     UNION ALL
     SELECT 'fin', id, cronograma FROM turmas_fin`,
  );
  for (const row of rows.rows) {
    const { next, changed } = renomearNoCronograma(row.cronograma, antigo, novo);
    if (!changed) continue;
    const table = row.regime === "fin" ? "turmas_fin" : "turmas_gold";
    await db.query(`UPDATE ${table} SET cronograma = $2::jsonb WHERE id = $1`, [row.id, next]);
  }
  await db.query(
    `UPDATE users SET name = $2
      WHERE id IN (SELECT user_id FROM formadores WHERE lower(trim(nome)) = lower(trim($2)) AND user_id IS NOT NULL)
        AND lower(trim(name)) = lower(trim($1))`,
    [antigo, novo],
  );
}

export async function propagarNomeTurma(db: Db, regime: "gold" | "fin", id: number, from: string, to: string) {
  const antigo = from.trim();
  const novo = to.trim();
  if (!antigo || !novo || antigo === novo) return;
  if (regime === "gold") {
    await db.query(
      `UPDATE formandos_gold SET turma = $3 WHERE turma_id = $1 OR lower(trim(turma)) = lower(trim($2))`,
      [id, antigo, novo],
    );
  } else {
    await db.query(
      `UPDATE formandos_fin SET turma = $3, turma_id = $1
        WHERE turma_id = $1 OR lower(trim(turma)) = lower(trim($2))`,
      [id, antigo, novo],
    );
  }
  await db.query(
    `UPDATE catalog_items
        SET payload = jsonb_set(payload, '{turma}', to_jsonb($2::text), true)
      WHERE kind = 'inscricoes_fin'
        AND jsonb_typeof(payload) = 'object'
        AND lower(trim(coalesce(payload->>'turma', ''))) = lower(trim($1))`,
    [antigo, novo],
  );
}

export async function propagarCursoDaTurma(
  db: Db,
  regime: "gold" | "fin",
  turmaId: number,
  turmaNome: string,
  from: string,
  to: string,
) {
  const antigo = from.trim();
  const novo = to.trim();
  if (!antigo || !novo || antigo === novo) return;
  const table = regime === "gold" ? "formandos_gold" : "formandos_fin";
  await db.query(
    `UPDATE ${table} SET curso = $4
      WHERE (turma_id = $1 OR lower(trim(turma)) = lower(trim($2)))
        AND lower(trim(curso)) = lower(trim($3))`,
    [turmaId, turmaNome, antigo, novo],
  );
  if (regime === "gold") {
    await db.query(
      `UPDATE preinscricoes SET curso = $3
        WHERE turma_id = $1 AND lower(trim(curso)) = lower(trim($2))`,
      [turmaId, antigo, novo],
    );
  }
}

export async function bloqueioCursoGold(db: Db, id: number) {
  const row = await db.query<{ nome: string }>("SELECT nome FROM cursos_gold WHERE id = $1", [id]);
  const nome = String(row.rows[0]?.nome ?? "");
  if (!nome) return null;
  return fraseBloqueio([
    { n: await contar(db, "SELECT count(*)::int AS n FROM turmas_gold WHERE lower(trim(curso)) = lower(trim($1))", [nome]), um: "turma", varios: "turmas" },
    { n: await contar(db, "SELECT count(*)::int AS n FROM formandos_gold WHERE lower(trim(curso)) = lower(trim($1))", [nome]), um: "formando", varios: "formandos" },
    { n: await contar(db, "SELECT count(*)::int AS n FROM preinscricoes WHERE lower(trim(curso)) = lower(trim($1))", [nome]), um: "pré-inscrição", varios: "pré-inscrições" },
    { n: await contar(db, "SELECT count(*)::int AS n FROM pagamentos WHERE lower(trim(curso)) = lower(trim($1))", [nome]), um: "pagamento", varios: "pagamentos" },
  ]);
}

export async function bloqueioCursoFin(db: Db, id: number) {
  const row = await db.query<{ nome_comercial: string; ufcd: string }>(
    "SELECT nome_comercial, ufcd FROM cursos_fin WHERE id = $1",
    [id],
  );
  const nomes = [String(row.rows[0]?.nome_comercial ?? ""), String(row.rows[0]?.ufcd ?? "")].filter(Boolean);
  if (!nomes.length) return null;
  const turmas = await contar(
    db,
    `SELECT count(*)::int AS n FROM turmas_fin
      WHERE lower(trim(curso)) IN (SELECT lower(trim(x)) FROM jsonb_array_elements_text($1::jsonb) x)`,
    [nomes],
  );
  const formandos = await contar(
    db,
    `SELECT count(*)::int AS n FROM formandos_fin
      WHERE lower(trim(curso)) IN (SELECT lower(trim(x)) FROM jsonb_array_elements_text($1::jsonb) x)`,
    [nomes],
  );
  const pagamentos = await contar(
    db,
    `SELECT count(*)::int AS n FROM pagamentos
      WHERE lower(trim(curso)) IN (SELECT lower(trim(x)) FROM jsonb_array_elements_text($1::jsonb) x)`,
    [nomes],
  );
  return fraseBloqueio([
    { n: turmas, um: "turma", varios: "turmas" },
    { n: formandos, um: "formando", varios: "formandos" },
    { n: pagamentos, um: "pagamento", varios: "pagamentos" },
  ]);
}

export async function bloqueioFormador(db: Db, id: number) {
  const row = await db.query<{ nome: string }>("SELECT nome FROM formadores WHERE id = $1", [id]);
  const nome = String(row.rows[0]?.nome ?? "").trim();
  if (!nome) return null;
  const n = await contar(
    db,
    `SELECT count(*)::int AS n FROM (
       SELECT id FROM turmas_gold
        WHERE lower(trim(formador)) = lower(trim($1))
           OR EXISTS (
             SELECT 1 FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(formadores) = 'array' THEN formadores ELSE '[]'::jsonb END) e
              WHERE lower(trim(e)) = lower(trim($1))
           )
       UNION ALL
       SELECT id FROM turmas_fin
        WHERE lower(trim(formador)) = lower(trim($1))
           OR EXISTS (
             SELECT 1 FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(formadores) = 'array' THEN formadores ELSE '[]'::jsonb END) e
              WHERE lower(trim(e)) = lower(trim($1))
           )
     ) t`,
    [nome],
  );
  return fraseBloqueio([{ n, um: "turma", varios: "turmas" }]);
}

export async function bloqueioTurma(db: Db, regime: "gold" | "fin", id: number) {
  if (regime === "gold") {
    const row = await db.query<{ nome: string }>("SELECT nome FROM turmas_gold WHERE id = $1", [id]);
    const nome = String(row.rows[0]?.nome ?? "");
    if (!nome) return null;
    return fraseBloqueio([
      { n: await contar(db, "SELECT count(*)::int AS n FROM formandos_gold WHERE turma_id = $1 OR lower(trim(turma)) = lower(trim($2))", [id, nome]), um: "formando", varios: "formandos" },
      { n: await contar(db, "SELECT count(*)::int AS n FROM preinscricoes WHERE turma_id = $1", [id]), um: "pré-inscrição", varios: "pré-inscrições" },
    ]);
  }
  const row = await db.query<{ nome: string }>("SELECT nome FROM turmas_fin WHERE id = $1", [id]);
  const nome = String(row.rows[0]?.nome ?? "");
  if (!nome) return null;
  return fraseBloqueio([
    { n: await contar(db, "SELECT count(*)::int AS n FROM formandos_fin WHERE turma_id = $1 OR lower(trim(turma)) = lower(trim($2))", [id, nome]), um: "formando", varios: "formandos" },
  ]);
}

export async function bloqueioCliente(db: Db, id: number) {
  return fraseBloqueio([
    { n: await contar(db, "SELECT count(*)::int AS n FROM propostas_comerciais WHERE cliente_id = $1", [id]), um: "proposta", varios: "propostas" },
    { n: await contar(db, "SELECT count(*)::int AS n FROM contratos_comerciais WHERE cliente_id = $1", [id]), um: "contrato", varios: "contratos" },
  ]);
}

async function alvosCurso(db: Db): Promise<CursoAlvo[]> {
  const gold = await db.query<{ nome: string }>("SELECT nome FROM cursos_gold");
  const fin = await db.query<{ nome_comercial: string; ufcd: string; ufcd_cod: string }>(
    "SELECT nome_comercial, ufcd, ufcd_cod FROM cursos_fin",
  );
  const alvos: CursoAlvo[] = gold.rows.map(r => ({ canonical: String(r.nome), aliases: [String(r.nome)] }));
  for (const r of fin.rows) {
    const canonical = String(r.nome_comercial || r.ufcd || "").trim();
    if (!canonical) continue;
    const aliases = [r.nome_comercial, r.ufcd, r.ufcd_cod].map(x => String(x ?? "").trim()).filter(Boolean);
    alvos.push({ canonical, aliases });
  }
  return alvos;
}

async function distintos(db: Db, sql: string) {
  const rows = await db.query<{ v: string | null }>(sql);
  return [...new Set(rows.rows.map(r => String(r.v ?? "").trim()).filter(Boolean))];
}

export async function repararLigacoes(db: Db) {
  const alvos = await alvosCurso(db);
  const cursos = await distintos(
    db,
    `SELECT curso AS v FROM turmas_gold
     UNION SELECT curso FROM turmas_fin
     UNION SELECT curso FROM formandos_gold
     UNION SELECT curso FROM formandos_fin
     UNION SELECT curso FROM preinscricoes
     UNION SELECT curso FROM pagamentos
     UNION SELECT curso FROM campanhas
     UNION SELECT curso FROM propostas_comerciais
     UNION SELECT curso FROM contratos_comerciais
     UNION SELECT curso FROM email_rules WHERE curso IS NOT NULL
     UNION SELECT payload->>'curso' FROM catalog_items WHERE jsonb_typeof(payload) = 'object'`,
  );
  for (const nome of cursos) {
    const para = canonicoCurso(nome, alvos);
    if (para) await propagarCurso(db, nome, para);
  }

  const formadores = (await db.query<{ nome: string }>("SELECT nome FROM formadores")).rows.map(r => String(r.nome));
  const turmas = await db.query<{ regime: string; id: number; formador: string; formadores: unknown; cronograma: unknown }>(
    `SELECT 'gold' AS regime, id, formador, formadores, cronograma FROM turmas_gold
     UNION ALL
     SELECT 'fin', id, formador, formadores, cronograma FROM turmas_fin`,
  );
  const vistos = new Set<string>();
  const considerar = (nome: string) => {
    const para = canonicoFormador(nome, formadores);
    if (para) vistos.add(`${nome}\u0000${para}`);
  };
  for (const t of turmas.rows) {
    considerar(String(t.formador ?? ""));
    if (Array.isArray(t.formadores)) for (const n of t.formadores) considerar(String(n));
    if (Array.isArray(t.cronograma)) {
      for (const s of t.cronograma) {
        if (!s || typeof s !== "object") continue;
        const row = s as { formador?: string; formadores?: string[] };
        if (row.formador) considerar(row.formador);
        if (Array.isArray(row.formadores)) for (const n of row.formadores) considerar(String(n));
      }
    }
  }
  for (const par of vistos) {
    const [de, para] = par.split("\u0000");
    if (de && para) await propagarFormador(db, de, para);
  }

  const turmasFin = await db.query<{ id: number; nome: string; curso: string }>("SELECT id, nome, curso FROM turmas_fin");
  const forms = await db.query<{ id: number; turma: string; curso: string; turma_id: number | null }>(
    "SELECT id, turma, curso, turma_id FROM formandos_fin",
  );
  for (const f of forms.rows) {
    const nome = String(f.turma ?? "").trim();
    const curso = String(f.curso ?? "").trim();
    const tid = f.turma_id == null ? 0 : Number(f.turma_id);
    const porId = tid ? turmasFin.rows.find(t => Number(t.id) === tid) : undefined;
    const porNome = turmasFin.rows.filter(t => limpo(String(t.nome)) === limpo(nome));
    let alvo = porId ?? (porNome.length === 1 ? porNome[0] : undefined);
    if (!alvo && nome && nome !== "-") {
      const porCurso = turmasFin.rows.filter(t => limpo(String(t.curso)) === limpo(curso));
      if (porCurso.length === 1) alvo = porCurso[0];
    }
    if (!alvo) continue;
    const novoNome = String(alvo.nome);
    const novoCurso = String(alvo.curso || curso);
    if (nome === novoNome && tid === Number(alvo.id) && curso === novoCurso) continue;
    await db.query(
      "UPDATE formandos_fin SET turma = $2, turma_id = $3, curso = $4 WHERE id = $1",
      [f.id, novoNome, alvo.id, novoCurso],
    );
  }

  const inscricoes = await db.query<{ id: number; payload: unknown }>(
    "SELECT id, payload FROM catalog_items WHERE kind = 'inscricoes_fin' AND jsonb_typeof(payload) = 'object'",
  );
  for (const row of inscricoes.rows) {
    const payload = row.payload && typeof row.payload === "object" ? { ...(row.payload as Record<string, unknown>) } : null;
    if (!payload) continue;
    const turma = String(payload.turma ?? "").trim();
    const curso = String(payload.curso ?? "").trim();
    if (!turma || turma === "-") continue;
    const porNome = turmasFin.rows.filter(t => limpo(String(t.nome)) === limpo(turma));
    let alvo = porNome.length === 1 ? porNome[0] : undefined;
    if (!alvo) {
      const porCurso = turmasFin.rows.filter(t => limpo(String(t.curso)) === limpo(curso));
      if (porCurso.length === 1) alvo = porCurso[0];
    }
    if (!alvo || String(alvo.nome) === turma) continue;
    payload.turma = String(alvo.nome);
    await db.query("UPDATE catalog_items SET payload = $2::jsonb WHERE id = $1", [row.id, payload]);
  }
}
