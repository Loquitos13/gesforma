// Separador Propostas: fases, lista e detalhe (resposta do cliente, estado, contrato).
import { useEffect, useRef, useState } from "react";
import {
  apiAlterarProposta, apiClientes, apiCriarContrato, apiPropostaCliente, apiPropostas, ESTADOS_PROPOSTA, type Proposta,
} from "../../../partilhado/api/crmDiretorio";
import { useAccao } from "../../../partilhado/dados/useAccao";
import { useOpcoes } from "../../../partilhado/dados/useOpcoes";
import { useRecurso } from "../../../partilhado/dados/useRecurso";
import {
  AreaTexto, Botao, Campo, Cartao, Chip, Detalhes, Entrada, ErroCarregar, Filtros, Modal, PainelLateral, Paginacao, Selecao,
  Tabela, Vazio, data, eur, num, useFiltrosUrl, type Coluna,
} from "../../../partilhado/ui";
import { EstadoDoc, numeroDe } from "./comum";
import { EditorDocumento } from "./EditorDocumento";
import { FormProposta } from "./FormProposta";

export function TabPropostas({ novo, onVerContratos }: { novo: number; onVerContratos: () => void }) {
  const [f, setF, limpar] = useFiltrosUrl({ pq: "", pestado: "", pcomercial: "", ppag: "1" });
  const pagina = Number(f.ppag) || 1;
  const { dados, erro, aCarregar, recarregar } = useRecurso(
    `crm:propostas:${f.pq}:${f.pestado}:${f.pcomercial}:${pagina}`,
    signal => apiPropostas({ q: f.pq, estado: f.pestado, comercial: f.pcomercial, pagina }, { signal }),
  );
  const comerciais = useOpcoes("comerciais");
  const [aberta, setAberta] = useState<Proposta | null>(null);
  const [escolherCliente, setEscolherCliente] = useState(false);
  const inicial = useRef(novo);
  useEffect(() => { if (novo !== inicial.current) setEscolherCliente(true); }, [novo]);

  const fases = ESTADOS_PROPOSTA.map(e => ({ estado: e, n: dados?.fases.find(x => x.estado === e)?.n ?? 0 }));
  const colunas: Coluna<Proposta>[] = [
    { id: "cliente", titulo: "Cliente", principal: true, celula: p => <span className="font-semibold text-tinta">{p.clienteNome}</span> },
    { id: "data", titulo: "Enviada", celula: p => data(p.enviadaEm) },
    { id: "curso", titulo: "Curso", celula: p => p.curso || "—" },
    { id: "comercial", titulo: "Comercial", celula: p => p.comercial || "—", esconderMovel: true },
    { id: "estado", titulo: "Estado", celula: p => <EstadoDoc estado={p.estado} /> },
    { id: "valor", titulo: "Valor", alinhar: "dir", celula: p => (p.valor ? eur(p.valor) : "—") },
  ];
  const ativos = [f.pq, f.pestado, f.pcomercial].filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por fase">
        {fases.map(x => (
          <Chip key={x.estado} ativo={f.pestado === x.estado} contagem={x.n} onClick={() => setF({ pestado: f.pestado === x.estado ? "" : x.estado, ppag: "1" })}>
            {x.estado === "Negociação" ? "Em negociação" : x.estado}
          </Chip>
        ))}
      </div>
      <Filtros
        pesquisa={{ valor: f.pq, onMudar: pq => setF({ pq, ppag: "1" }), placeholder: "Cliente, email ou curso…", rotulo: "Pesquisar propostas" }}
        selecoes={[{ chave: "pcomercial", rotulo: "Comercial", vazio: "Comercial: todos", opcoes: comerciais.selecao, valor: f.pcomercial, onMudar: pcomercial => setF({ pcomercial, ppag: "1" }) }]}
        ativos={ativos}
        onLimpar={limpar}
      />
      {erro ? <ErroCarregar erro={erro} onTentar={recarregar} /> : null}
      <Cartao semPadding>
        <Tabela
          rotulo="Propostas"
          linhas={dados?.linhas ?? []}
          colunas={colunas}
          chave={p => p.id}
          onLinha={setAberta}
          linhaAtiva={aberta?.id ?? null}
          aCarregar={aCarregar}
          vazio={<Vazio titulo={ativos ? "Nenhuma proposta com estes filtros." : "Ainda sem propostas."} descricao={ativos ? undefined : "As propostas criadas nos clientes e na Equipa aparecem aqui."} />}
        />
        {dados && <Paginacao pagina={dados.pagina} porPagina={dados.porPagina} total={dados.total} onMudar={p => setF({ ppag: String(p) })} />}
      </Cartao>
      <DetalheProposta proposta={aberta} onFechar={() => setAberta(null)} onVerContratos={onVerContratos} />
      <NovaPropostaComCliente aberto={escolherCliente} onFechar={() => setEscolherCliente(false)} />
    </div>
  );
}

function DetalheProposta({ proposta, onFechar, onVerContratos }: { proposta: Proposta | null; onFechar: () => void; onVerContratos: () => void }) {
  const [estado, setEstado] = useState("");
  const [resposta, setResposta] = useState("");
  const [valor, setValor] = useState("");
  useEffect(() => {
    if (!proposta) return;
    setEstado(proposta.estado);
    setResposta(proposta.respostaCliente);
    setValor(proposta.valor ? String(proposta.valor) : "");
  }, [proposta]);
  const guardar = useAccao(apiAlterarProposta, { ok: "Proposta guardada.", invalidar: ["crm:propostas", "crm:clientes", "equipa:"] });
  const contrato = useAccao(apiCriarContrato, { ok: "Contrato criado em rascunho.", invalidar: ["crm:contratos", "crm:propostas", "crm:clientes"] });
  if (!proposta) return null;
  const p = proposta;
  return (
    <PainelLateral
      aberto
      onFechar={onFechar}
      titulo={p.clienteNome}
      subtitulo={`${p.curso || "Proposta"} · enviada a ${data(p.enviadaEm)}`}
      largura={640}
      rodape={(
        <>
          <Botao onClick={onFechar}>Fechar</Botao>
          <Botao
            variante="primario"
            aCarregar={guardar.aCorrer}
            onClick={async () => {
              const r = await guardar.correr(p.id, { estado, respostaCliente: resposta.trim(), valor: numeroDe(valor) });
              if (r) onFechar();
            }}
          >
            Guardar
          </Botao>
        </>
      )}
    >
      <div className="space-y-5">
        <Detalhes itens={[
          { rotulo: "Cliente", valor: p.clienteEmail ? `${p.clienteNome} · ${p.clienteEmail}` : p.clienteNome },
          { rotulo: "Comercial", valor: p.comercial || "—" },
          { rotulo: "Resposta registada", valor: p.respostaEm ? data(p.respostaEm) : "—" },
          { rotulo: "Contrato", valor: p.contratoId ? `#${p.contratoId}` : "Sem contrato" },
        ]} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Estado">
            {pp => <Selecao {...pp} value={estado} onChange={e => setEstado(e.target.value)} opcoes={ESTADOS_PROPOSTA.map(e => ({ valor: e, rotulo: e === "Negociação" ? "Em negociação" : e }))} />}
          </Campo>
          <Campo rotulo="Valor (€)">{pp => <Entrada {...pp} inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} />}</Campo>
          <Campo rotulo="O que o cliente respondeu" className="sm:col-span-2">
            {pp => <AreaTexto {...pp} value={resposta} onChange={e => setResposta(e.target.value)} placeholder="Aceitou, pediu desconto, quer outra data…" />}
          </Campo>
        </div>
        {p.estado === "Aceite" && (
          p.contratoId
            ? <Botao variante="secundario" onClick={() => { onFechar(); onVerContratos(); }}>Ver o contrato</Botao>
            : (
              <Botao
                variante="secundario"
                aCarregar={contrato.aCorrer}
                onClick={async () => {
                  const r = await contrato.correr({ clienteNome: p.clienteNome, clienteEmail: p.clienteEmail, clienteId: p.clienteId, propostaId: p.id });
                  if (r) { onFechar(); onVerContratos(); }
                }}
              >
                Criar contrato a partir desta proposta
              </Botao>
            )
        )}
        <EditorDocumento
          titulo={`Proposta · ${p.curso || "formação"}`}
          valor={p.corpo}
          onMudar={() => undefined}
          soLeitura
          valores={{ cliente: p.clienteNome, email: p.clienteEmail, curso: p.curso, valor: p.valor, data: p.enviadaEm?.slice(0, 10) }}
        />
      </div>
    </PainelLateral>
  );
}

/** "Nova proposta" a partir deste ecrã: primeiro escolhe-se o cliente. */
function NovaPropostaComCliente({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const clientes = useRecurso(aberto ? "crm:clientes:todos" : null, signal => apiClientes({ porPagina: 200, ordem: "nome" }, { signal }));
  const [clienteId, setClienteId] = useState("");
  const [passo, setPasso] = useState<"cliente" | "proposta">("cliente");
  useEffect(() => { if (aberto) { setClienteId(""); setPasso("cliente"); } }, [aberto]);
  const cliente = clientes.dados?.linhas.find(c => String(c.id) === clienteId);
  const criar = useAccao(
    (d: Parameters<typeof apiPropostaCliente>[1]) => apiPropostaCliente(Number(clienteId), d),
    { ok: "Proposta registada.", invalidar: ["crm:propostas", "crm:clientes"] },
  );
  if (passo === "proposta" && cliente) {
    return (
      <FormProposta
        aberto={aberto}
        cliente={cliente}
        aCarregar={criar.aCorrer}
        onFechar={onFechar}
        onGravar={async d => { if (await criar.correr(d)) onFechar(); }}
      />
    );
  }
  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo="Nova proposta"
      largura="sm"
      rodape={<><Botao onClick={onFechar}>Cancelar</Botao><Botao variante="primario" disabled={!cliente} onClick={() => setPasso("proposta")}>Continuar</Botao></>}
    >
      {clientes.dados && clientes.dados.linhas.length === 0 ? (
        <p className="m-0 text-sm text-tinta-suave">Ainda não há clientes. Crie primeiro o cliente em CRM › Clientes.</p>
      ) : (
        <Campo rotulo="Cliente" ajuda={clientes.dados ? `${num(clientes.dados.total)} clientes` : "A carregar…"}>
          {p => <Selecao {...p} value={clienteId} onChange={e => setClienteId(e.target.value)} vazio="Escolher cliente" opcoes={(clientes.dados?.linhas ?? []).map(c => ({ valor: String(c.id), rotulo: c.nome }))} />}
        </Campo>
      )}
    </Modal>
  );
}
