import { useEffect, useState } from "react";
import { apiPublicOpcoes } from "./api";

export type OpcoesEstado = "a-carregar" | "pronto" | "erro";

/** Opções públicas de uma lista editada no backoffice (Listas de opções). */
export function useOpcoesPublicas(lista: string, activo = true) {
  const [nomes, setNomes] = useState<string[]>([]);
  const [estado, setEstado] = useState<OpcoesEstado>("a-carregar");

  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    setEstado("a-carregar");
    void apiPublicOpcoes(lista)
      .then(r => {
        if (!vivo) return;
        setNomes((r.opcoes ?? []).map(nome => nome.trim()).filter(Boolean));
        setEstado("pronto");
      })
      .catch(() => {
        if (!vivo) return;
        setNomes([]);
        setEstado("erro");
      });
    return () => { vivo = false; };
  }, [lista, activo]);

  return { nomes, estado };
}

export function textoListaVazia(estado: OpcoesEstado, vazio: string) {
  if (estado === "a-carregar") return "A carregar…";
  if (estado === "erro") return "Não foi possível carregar a lista.";
  return vazio;
}
