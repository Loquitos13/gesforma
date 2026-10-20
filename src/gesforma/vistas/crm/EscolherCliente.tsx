// Escolher o cliente de uma proposta ou contrato: pesquisa no servidor (nome, email ou NIF) e lista os primeiros resultados.
import { useEffect, useState } from "react";
import { apiClientes, type ClienteResumo } from "../../../partilhado/api/crmDiretorio";
import { useRecurso } from "../../../partilhado/dados/useRecurso";
import { CONTROLO } from "./documento/EcraDocumento";

const POR_PAGINA = 30;

export function EscolherCliente({ valor, nomeAtual, onEscolher }: {
  valor: string;
  /** Nome do cliente já escolhido, para aparecer mesmo quando não está nos resultados da pesquisa. */
  nomeAtual: string;
  onEscolher: (c: ClienteResumo | null) => void;
}) {
  const [texto, setTexto] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQ(texto.trim()), 250);
    return () => clearTimeout(t);
  }, [texto]);
  const { dados, aCarregar } = useRecurso(`crm:clientes:escolher:${q}`, signal => apiClientes({ q, porPagina: POR_PAGINA, ordem: "nome" }, { signal }));
  const linhas = dados?.linhas ?? [];
  const mais = dados ? dados.total - linhas.length : 0;

  return (
    <div className="flex flex-col gap-1.5">
      <input
        type="search"
        className={CONTROLO}
        aria-label="Pesquisar cliente"
        placeholder="Pesquisar por nome, email ou NIF"
        value={texto}
        onChange={e => setTexto(e.target.value)}
      />
      <select
        className={CONTROLO}
        aria-label="Cliente"
        value={valor}
        onChange={e => onEscolher(linhas.find(c => String(c.id) === e.target.value) ?? null)}
      >
        <option value="">{aCarregar && !dados ? "A carregar…" : linhas.length ? "Escolher cliente" : "Nenhum cliente encontrado"}</option>
        {valor && !linhas.some(c => String(c.id) === valor) && <option value={valor}>{nomeAtual || `Cliente ${valor}`}</option>}
        {linhas.map(c => <option key={c.id} value={c.id}>{c.nome}{c.nif ? ` · NIF ${c.nif}` : ""}</option>)}
      </select>
      {mais > 0 && <span className="text-xs font-normal text-tinta-suave">Mais {mais} — escreva para afinar a pesquisa.</span>}
    </div>
  );
}
