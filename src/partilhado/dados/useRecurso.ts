import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Leitura de dados da API com cache por chave. Sem dados de exemplo: enquanto não
 * há resposta `dados` é undefined e o ecrã mostra esqueletos.
 *
 *   const { dados, erro, aCarregar, recarregar } = useRecurso(
 *     `formandos:${regime}:${JSON.stringify(filtros)}`,
 *     signal => apiFormandos(regime, filtros, signal),
 *   );
 *
 * Stale-while-revalidate: ao voltar a um ecrã mostra logo os dados em cache e pede
 * de novo em segundo plano (`aAtualizar`); `aCarregar` só é verdadeiro quando ainda
 * não há nada para mostrar. Pedidos iguais em curso são partilhados.
 *
 * Depois de gravar, `invalidar("formandos:")` faz recarregar todos os ecrãs com chaves
 * começadas por esse prefixo. Com `chave = null` não pede nada (dependência ainda em falta).
 */

type Entrada = { dados?: unknown; erro?: unknown; quando: number; promessa?: Promise<unknown> };

const cache = new Map<string, Entrada>();
const ouvintes = new Map<string, Set<() => void>>();

/** Os dados em cache valem este tempo antes de se pedir de novo ao voltar ao ecrã. */
const VALIDADE_MS = 60_000;
/** Limite de chaves guardadas (as mais antigas saem primeiro). */
const MAX_CHAVES = 300;

function avisar(chave: string) {
  ouvintes.get(chave)?.forEach(f => f());
}

function aparar() {
  if (cache.size <= MAX_CHAVES) return;
  const antigas = [...cache.entries()]
    .filter(([k, e]) => !e.promessa && !ouvintes.has(k))
    .sort((a, b) => a[1].quando - b[1].quando);
  for (const [k] of antigas.slice(0, cache.size - MAX_CHAVES)) cache.delete(k);
}

/** Marca como desactualizadas todas as chaves com este prefixo e recarrega os ecrãs abertos. */
export function invalidar(prefixo: string) {
  for (const k of [...cache.keys()]) {
    if (k.startsWith(prefixo)) {
      const e = cache.get(k)!;
      cache.set(k, { ...e, quando: 0, promessa: undefined });
    }
  }
  for (const k of [...ouvintes.keys()]) if (k.startsWith(prefixo)) avisar(k);
}

/** Lê a cache sem pedir (ex.: para pré-preencher um formulário). */
export function lerCache<T>(chave: string): T | undefined {
  return cache.get(chave)?.dados as T | undefined;
}

/**
 * Pede uma chave sem ecrã a ouvir (ex.: ao passar o rato num item do menu), para o
 * ecrã abrir já com dados. Não pede se já houver dados recentes ou um pedido em curso.
 */
export function preCarregar<T>(chave: string, carregar: (signal: AbortSignal) => Promise<T>, validadeMs = VALIDADE_MS) {
  const atual = cache.get(chave);
  if (atual && (atual.promessa || Date.now() - atual.quando < validadeMs)) return;
  const ctrl = new AbortController();
  const promessa = carregar(ctrl.signal)
    .then(dados => { cache.set(chave, { dados, quando: Date.now() }); })
    .catch(() => { const e = cache.get(chave); if (e) cache.set(chave, { ...e, promessa: undefined }); })
    .finally(() => avisar(chave));
  cache.set(chave, { ...(atual ?? { quando: 0 }), promessa });
  aparar();
}

export function useRecurso<T>(
  chave: string | null,
  carregar: (signal: AbortSignal) => Promise<T>,
  opcoes: { validadeMs?: number } = {},
): { dados: T | undefined; erro: unknown; aCarregar: boolean; aAtualizar: boolean; recarregar: () => void } {
  const carregarRef = useRef(carregar);
  carregarRef.current = carregar;
  const validade = opcoes.validadeMs ?? VALIDADE_MS;
  const [, forcar] = useState(0);

  const pedir = useCallback((k: string, forcado: boolean) => {
    const atual = cache.get(k);
    if (atual?.promessa) return; // pedido igual já em curso: partilha-se
    if (!forcado && atual && Date.now() - atual.quando < validade) return;
    // O pedido não é cancelado quando o ecrã desmonta: a resposta fica em cache
    // para a próxima visita (e outro ecrã com a mesma chave aproveita-a).
    const promessa = carregarRef.current(new AbortController().signal)
      .then(dados => {
        cache.set(k, { dados, quando: Date.now() });
      })
      .catch(erro => {
        const e = cache.get(k);
        cache.set(k, { dados: e?.dados, erro, quando: Date.now() });
      })
      .finally(() => avisar(k));
    cache.set(k, { ...(atual ?? { quando: 0 }), promessa });
    aparar();
  }, [validade]);

  useEffect(() => {
    if (!chave) return;
    const ouvir = () => {
      forcar(n => n + 1);
      const e = cache.get(chave);
      if (e && e.quando === 0 && !e.promessa) pedir(chave, true);
    };
    if (!ouvintes.has(chave)) ouvintes.set(chave, new Set());
    ouvintes.get(chave)!.add(ouvir);
    pedir(chave, false);
    forcar(n => n + 1);
    return () => {
      ouvintes.get(chave)?.delete(ouvir);
      if (!ouvintes.get(chave)?.size) ouvintes.delete(chave);
    };
  }, [chave, pedir]);

  const recarregar = useCallback(() => { if (chave) pedir(chave, true); }, [chave, pedir]);
  const e = chave ? cache.get(chave) : undefined;
  const emCurso = Boolean(e?.promessa);
  return {
    dados: e?.dados as T | undefined,
    erro: e?.dados === undefined ? e?.erro : undefined,
    aCarregar: Boolean(chave) && e?.dados === undefined && (emCurso || !e),
    aAtualizar: emCurso && e?.dados !== undefined,
    recarregar,
  };
}
