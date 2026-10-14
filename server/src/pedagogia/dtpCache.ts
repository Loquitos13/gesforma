/**
 * Cache da vista geral do Dossiê TP (matriz turma × secção e % por turma).
 * Calcular o dossiê de todas as turmas custa várias consultas por turma; a matriz fica em memória
 * até à próxima escrita bem-sucedida na API (qualquer POST/PUT/PATCH/DELETE) ou até expirar,
 * o que cobre também escritas feitas noutra instância ou por tarefas agendadas.
 */
import type { Db } from "../db/pool.js";
import { dtpMatriz } from "./dtp.js";
import type { Regime } from "./util.js";

type Matriz = Awaited<ReturnType<typeof dtpMatriz>>;

const VALIDADE_MS = 60_000;

let versao = 0;
const cache = new Map<Regime, { versao: number; em: number; valor: Promise<Matriz> }>();

/** Esquece as matrizes calculadas. Chamado depois de cada escrita na API. */
export function invalidarDtp() {
  versao += 1;
  cache.clear();
}

export function matrizDtp(db: Db, regime: Regime): Promise<Matriz> {
  const atual = cache.get(regime);
  if (atual && atual.versao === versao && Date.now() - atual.em < VALIDADE_MS) return atual.valor;
  const v = versao;
  const valor = dtpMatriz(db, regime);
  cache.set(regime, { versao: v, em: Date.now(), valor });
  // Um cálculo falhado não fica guardado.
  valor.catch(() => { if (cache.get(regime)?.valor === valor) cache.delete(regime); });
  return valor;
}

/** % do dossiê de cada turma do regime (lida da mesma matriz). */
export async function resumoDtp(db: Db, regime: Regime): Promise<Record<number, number>> {
  const m = await matrizDtp(db, regime);
  return Object.fromEntries(m.turmas.map(t => [t.id, t.pct]));
}
