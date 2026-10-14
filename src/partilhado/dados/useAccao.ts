import { useCallback, useState } from "react";
import { toastError, toastOk } from "../toastBus";
import { invalidar } from "./useRecurso";

/**
 * Corre uma escrita (gravar, apagar, confirmar) com estado de carregamento, toast de
 * sucesso/erro e invalidação das listas afectadas.
 *
 *   const confirmar = useAccao(apiConfirmarPagamento, { ok: "Pagamento confirmado.", invalidar: ["pagamentos:", "painel:"] });
 *   <Botao aCarregar={confirmar.aCorrer} onClick={() => confirmar.correr(id)}>Confirmar</Botao>
 */
export function useAccao<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  opts: { ok?: string | ((r: R) => string); invalidar?: string[]; erro?: string } = {},
) {
  const [aCorrer, setACorrer] = useState(false);
  const correr = useCallback(async (...args: A): Promise<R | undefined> => {
    setACorrer(true);
    try {
      const r = await fn(...args);
      for (const p of opts.invalidar ?? []) invalidar(p);
      const msg = typeof opts.ok === "function" ? opts.ok(r) : opts.ok;
      if (msg) toastOk(msg);
      return r;
    } catch (e) {
      toastError(e, opts.erro ?? "Não foi possível concluir.");
      return undefined;
    } finally {
      setACorrer(false);
    }
  }, [fn, opts.ok, opts.erro, opts.invalidar]);
  return { correr, aCorrer };
}
