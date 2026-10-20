import type { Db } from "./db/pool.js";
import { renomearFormadorNasDespesas } from "./repos/despesas.js";
import * as repo from "./repos/ligacoes.js";
import type { Consulta, Regime } from "./repos/sql.js";

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

/** Reparação (arranque): o alias é inequívoco entre todos os cursos, por isso corre em todas as tabelas. */
export async function propagarCurso(db: Db, from: string, to: string) {
  const antigo = from.trim();
  const novo = to.trim();
  if (!antigo || !novo || antigo === novo) return;
  await repo.renomearCursoEmTodo(db, antigo, novo);
}

/** Curso renomeado na ficha: só no regime do curso, e dentro da transacção de quem o grava. */
export async function propagarCursoNoRegime(q: Consulta, regime: Regime, from: string, to: string) {
  const antigo = from.trim();
  const novo = to.trim();
  if (!antigo || !novo || antigo === novo) return;
  await repo.renomearCursoNoRegime(q, regime, antigo, novo);
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
  await repo.renomearFormadorNasTurmas(db, antigo, novo);
  await renomearFormadorNasDespesas(db, antigo, novo);
  for (const row of await repo.cronogramasDeTodasAsTurmas(db)) {
    const { next, changed } = renomearNoCronograma(row.cronograma, antigo, novo);
    if (changed) await repo.gravarCronograma(db, row.regime === "fin" ? "fin" : "gold", row.id, next);
  }
  await repo.renomearUtilizadorDoFormador(db, antigo, novo);
}

export async function propagarNomeTurma(db: Db, regime: "gold" | "fin", id: number, from: string, to: string) {
  const antigo = from.trim();
  const novo = to.trim();
  if (!antigo || !novo || antigo === novo) return;
  await repo.renomearTurmaNosFormandos(db, regime, id, antigo, novo);
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
  await repo.renomearCursoDaTurma(db, regime, turmaId, turmaNome, antigo, novo);
}

export async function bloqueioCursoGold(db: Db, id: number) {
  const uso = await repo.usoCursoGold(db, id);
  if (!uso) return null;
  return fraseBloqueio([
    { n: uso.turmas, um: "turma", varios: "turmas" },
    { n: uso.formandos, um: "formando", varios: "formandos" },
    { n: uso.preinscricoes, um: "pré-inscrição", varios: "pré-inscrições" },
    { n: uso.pagamentos, um: "pagamento", varios: "pagamentos" },
  ]);
}

export async function bloqueioCursoFin(db: Db, id: number) {
  const uso = await repo.usoCursoFin(db, id);
  if (!uso) return null;
  return fraseBloqueio([
    { n: uso.turmas, um: "turma", varios: "turmas" },
    { n: uso.formandos, um: "formando", varios: "formandos" },
    { n: uso.pagamentos, um: "pagamento", varios: "pagamentos" },
  ]);
}

export async function bloqueioFormador(db: Db, id: number) {
  const n = await repo.turmasDoFormadorPorNome(db, id);
  if (n == null) return null;
  return fraseBloqueio([{ n, um: "turma", varios: "turmas" }]);
}

export async function bloqueioTurma(db: Db, regime: "gold" | "fin", id: number) {
  const uso = await repo.usoTurma(db, regime, id);
  if (!uso) return null;
  return fraseBloqueio([
    { n: uso.formandos, um: "formando", varios: "formandos" },
    { n: uso.preinscricoes, um: "pré-inscrição", varios: "pré-inscrições" },
  ]);
}

async function alvosCurso(db: Db): Promise<CursoAlvo[]> {
  const { gold, fin } = await repo.nomesDosCursos(db);
  const alvos: CursoAlvo[] = gold.map(r => ({ canonical: String(r.nome), aliases: [String(r.nome)] }));
  for (const r of fin) {
    const canonical = String(r.nome_comercial || r.ufcd || "").trim();
    if (!canonical) continue;
    const aliases = [r.nome_comercial, r.ufcd, r.ufcd_cod].map(x => String(x ?? "").trim()).filter(Boolean);
    alvos.push({ canonical, aliases });
  }
  return alvos;
}

export async function repararLigacoes(db: Db) {
  const alvos = await alvosCurso(db);
  for (const nome of await repo.cursosEscritosEmTodo(db)) {
    const para = canonicoCurso(nome, alvos);
    if (para) await propagarCurso(db, nome, para);
  }

  const formadores = await repo.nomesDosFormadores(db);
  const vistos = new Set<string>();
  const considerar = (nome: string) => {
    const para = canonicoFormador(nome, formadores);
    if (para) vistos.add(`${nome}\u0000${para}`);
  };
  for (const t of await repo.formadoresDasTurmas(db)) {
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

  const turmasFin = await repo.turmasFinNomes(db);
  for (const f of await repo.formandosFinTurma(db)) {
    const nome = String(f.turma ?? "").trim();
    const curso = String(f.curso ?? "").trim();
    const tid = f.turma_id == null ? 0 : Number(f.turma_id);
    const porId = tid ? turmasFin.find(t => Number(t.id) === tid) : undefined;
    const porNome = turmasFin.filter(t => limpo(String(t.nome)) === limpo(nome));
    let alvo = porId ?? (porNome.length === 1 ? porNome[0] : undefined);
    if (!alvo && nome && nome !== "-") {
      const porCurso = turmasFin.filter(t => limpo(String(t.curso)) === limpo(curso));
      if (porCurso.length === 1) alvo = porCurso[0];
    }
    if (!alvo) continue;
    const novoNome = String(alvo.nome);
    const novoCurso = String(alvo.curso || curso);
    if (nome === novoNome && tid === Number(alvo.id) && curso === novoCurso) continue;
    await repo.ligarFormandoFinATurma(db, f.id, novoNome, alvo.id, novoCurso);
  }

  for (const row of await repo.inscricoesFinGuardadas(db)) {
    const payload = row.payload && typeof row.payload === "object" ? { ...(row.payload as Record<string, unknown>) } : null;
    if (!payload) continue;
    const turma = String(payload.turma ?? "").trim();
    const curso = String(payload.curso ?? "").trim();
    if (!turma || turma === "-") continue;
    const porNome = turmasFin.filter(t => limpo(String(t.nome)) === limpo(turma));
    let alvo = porNome.length === 1 ? porNome[0] : undefined;
    if (!alvo) {
      const porCurso = turmasFin.filter(t => limpo(String(t.curso)) === limpo(curso));
      if (porCurso.length === 1) alvo = porCurso[0];
    }
    if (!alvo || String(alvo.nome) === turma) continue;
    payload.turma = String(alvo.nome);
    await repo.gravarPayloadCatalogo(db, row.id, payload);
  }
}
