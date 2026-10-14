import { useEffect, useRef } from "react";
import { ApiError } from "../api/cliente";

/**
 * Corre `tarefa` agora e depois de `intervaloMs` em `intervaloMs`, mas:
 * - só com o separador visível (volta a correr quando a pessoa regressa ao separador);
 * - nunca dois pedidos ao mesmo tempo;
 * - pára de vez se a API responder 401/403 (sessão terminada ou sem acesso);
 * - em caso de erro de rede, espera o dobro (até 10 minutos) antes de tentar de novo.
 */
export function useSondagem(tarefa: () => Promise<unknown>, intervaloMs: number, ativo = true) {
  const ref = useRef(tarefa);
  ref.current = tarefa;

  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    let parado = false;
    let emCurso = false;
    let espera = intervaloMs;
    let timer: number | undefined;

    function agendar() {
      if (!vivo || parado) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void correr(), espera);
    }

    async function correr() {
      if (!vivo || parado || emCurso) return;
      if (document.visibilityState === "hidden") return; // retoma no visibilitychange
      emCurso = true;
      try {
        await ref.current();
        espera = intervaloMs;
      } catch (e) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) parado = true;
        else espera = Math.min(espera * 2, 600_000);
      } finally {
        emCurso = false;
        agendar();
      }
    }

    function visibilidade() {
      if (document.visibilityState === "visible") void correr();
    }

    void correr();
    document.addEventListener("visibilitychange", visibilidade);
    return () => {
      vivo = false;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", visibilidade);
    };
  }, [intervaloMs, ativo]);
}
