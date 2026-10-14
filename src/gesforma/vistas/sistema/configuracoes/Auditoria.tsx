// Registo de auditoria (só administração): quem fez o quê e quando, com filtros e detalhe.
import { useState } from "react";
import { apiAuditoria, apiOpcoesAuditoria, type LinhaAuditoria } from "../../../../partilhado/api/auditoria";
import { useRecurso } from "../../../../partilhado/dados/useRecurso";
import { Botao, Cartao, ErroCarregar, Filtros, Modal, Paginacao, Tabela, Vazio, dataHora, useFiltrosUrl, type Coluna } from "../../../../partilhado/ui";

export function SeccaoAuditoria() {
  const [f, setF, limpar] = useFiltrosUrl({ aEntidade: "", aUtilizador: "", aQ: "", aDe: "", aAte: "", aPagina: "1" });
  const pagina = Number(f.aPagina) || 1;
  const { dados, erro, aCarregar, recarregar } = useRecurso(
    `configuracoes:auditoria:${f.aEntidade}:${f.aUtilizador}:${f.aQ}:${f.aDe}:${f.aAte}:${pagina}`,
    signal => apiAuditoria({ entidade: f.aEntidade, utilizador: f.aUtilizador, q: f.aQ, de: f.aDe, ate: f.aAte, pagina, porPagina: 30 }, signal),
  );
  const { dados: opcoes } = useRecurso("configuracoes:auditoria:opcoes", apiOpcoesAuditoria);
  const [aberta, setAberta] = useState<LinhaAuditoria | null>(null);

  const colunas: Coluna<LinhaAuditoria>[] = [
    { id: "quando", titulo: "Quando", celula: l => dataHora(l.quando) },
    { id: "quem", titulo: "Quem", principal: true, celula: l => (l.actor_nome ? <span title={l.actor_email ?? ""}>{l.actor_nome}</span> : <span className="text-tinta-suave">Sistema / público</span>) },
    { id: "accao", titulo: "Acção", celula: l => <code className="text-[13px]">{l.accao}</code> },
    { id: "registo", titulo: "Registo", celula: l => `${l.entidade}${l.entidade_id ? ` · ${l.entidade_id}` : ""}` },
    { id: "ip", titulo: "IP", esconderMovel: true, celula: l => <span className="text-tinta-suave">{l.ip ?? "—"}</span> },
  ];
  const ativos = [f.aEntidade, f.aUtilizador, f.aQ, f.aDe, f.aAte].filter(Boolean).length;

  return (
    <div className="space-y-4">
      <Filtros
        pesquisa={{ valor: f.aQ, onMudar: aQ => setF({ aQ }), placeholder: "Acção, registo, nome ou email" }}
        selecoes={[
          { chave: "aEntidade", rotulo: "Registo", vazio: "Registo: todos", valor: f.aEntidade, onMudar: aEntidade => setF({ aEntidade }), opcoes: (opcoes?.entidades ?? []).map(e => ({ valor: e.entidade, rotulo: e.entidade })) },
          { chave: "aUtilizador", rotulo: "Quem", vazio: "Quem: todos", valor: f.aUtilizador, onMudar: aUtilizador => setF({ aUtilizador }), opcoes: (opcoes?.utilizadores ?? []).map(u => ({ valor: u.id, rotulo: u.nome })) },
        ]}
        periodo={{ de: f.aDe, ate: f.aAte, onMudar: (aDe, aAte) => setF({ aDe, aAte }) }}
        ativos={ativos}
        onLimpar={limpar}
      />
      {erro ? <ErroCarregar erro={erro} onTentar={recarregar} /> : null}
      <Cartao semPadding>
        <Tabela
          rotulo="Registo de auditoria"
          linhas={dados?.linhas ?? []}
          colunas={colunas}
          chave={l => l.id}
          onLinha={setAberta}
          aCarregar={aCarregar && !dados}
          vazio={<Vazio titulo="Sem registos com estes filtros" acao={ativos ? <Botao tamanho="sm" onClick={limpar}>Limpar filtros</Botao> : undefined} />}
        />
        {dados && <Paginacao pagina={dados.pagina} porPagina={dados.porPagina} total={dados.total} onMudar={p => setF({ aPagina: String(p) })} />}
      </Cartao>
      <Modal aberto={Boolean(aberta)} onFechar={() => setAberta(null)} titulo={aberta?.accao ?? ""} rodape={<Botao onClick={() => setAberta(null)}>Fechar</Botao>}>
        {aberta && (
          <div className="space-y-2 text-sm">
            <p className="m-0"><span className="text-tinta-suave">Quando:</span> {dataHora(aberta.quando)}</p>
            <p className="m-0"><span className="text-tinta-suave">Quem:</span> {aberta.actor_nome ? `${aberta.actor_nome} (${aberta.actor_email})` : "Sistema / público"}</p>
            <p className="m-0"><span className="text-tinta-suave">Registo:</span> {aberta.entidade} {aberta.entidade_id ?? ""}</p>
            <pre className="m-0 mt-2 p-3 rounded-controlo bg-fundo text-xs overflow-x-auto">{JSON.stringify(aberta.meta ?? {}, null, 2)}</pre>
          </div>
        )}
      </Modal>
    </div>
  );
}
