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
 * Depois de gravar, `invalidar("formandos:")` faz recarregar todos os ecrãs com chaves
 * começadas por esse prefixo. Com `chave = null` não pede nada (dependência ainda em falta).
 */

type Entrada = { dados?: unknown; erro?: unknown; quando: number; promessa?: Promise<unknown> };

const cache = new Map<string, Entrada>();
const ouvintes = new Map<string, Set<() => void>>();

/** Os dados em cache valem este tempo antes de se pedir de novo ao voltar ao ecrã. */
const VALIDADE_MS = 30_000;

function avisar(chave: string) {
  ouvintes.get(chave)?.forEach(f => f());
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

export function useRecurso<T>(
  chave: string | null,
  carregar: (signal: AbortSignal) => Promise<T>,
): { dados: T | undefined; erro: unknown; aCarregar: boolean; recarregar: () => void } {
  const carregarRef = useRef(carregar);
  carregarRef.current = carregar;
  const [, forcar] = useState(0);
  const [aCarregar, setACarregar] = useState(false);
  const montado = useRef(true);
  useEffect(() => () => { montado.current = false; }, []);

  const pedir = useCallback((k: string, forcado: boolean) => {
    const atual = cache.get(k);
    if (!forcado && atual && (atual.promessa || Date.now() - atual.quando < VALIDADE_MS)) return () => undefined;
    const ctrl = new AbortController();
    setACarregar(true);
    const promessa = carregarRef.current(ctrl.signal)
      .then(dados => {
        cache.set(k, { dados, quando: Date.now() });
      })
      .catch(erro => {
        if (ctrl.signal.aborted) {
          const e = cache.get(k);
          if (e) cache.set(k, { ...e, promessa: undefined });
          return;
        }
        const e = cache.get(k);
        cache.set(k, { dados: e?.dados, erro, quando: Date.now() });
      })
      .finally(() => {
        if (montado.current) setACarregar(false);
        avisar(k);
      });
    cache.set(k, { ...(atual ?? { quando: 0 }), promessa });
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    if (!chave) return;
    const ouvir = () => {
      forcar(n => n + 1);
      const e = cache.get(chave);
      if (e && e.quando === 0 && !e.promessa) pedir(chave, true);
    };
    if (!ouvintes.has(chave)) ouvintes.set(chave, new Set());
    ouvintes.get(chave)!.add(ouvir);
    const cancelar = pedir(chave, false);
    return () => {
      ouvintes.get(chave)?.delete(ouvir);
      if (!ouvintes.get(chave)?.size) ouvintes.delete(chave);
      cancelar();
    };
  }, [chave, pedir]);

  const recarregar = useCallback(() => { if (chave) pedir(chave, true); }, [chave, pedir]);
  const e = chave ? cache.get(chave) : undefined;
  return {
    dados: e?.dados as T | undefined,
    erro: e?.erro,
    aCarregar: aCarregar || Boolean(e?.promessa && e.dados === undefined),
    recarregar,
  };
}
