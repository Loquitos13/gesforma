// Separador Propostas: fases, lista e o detalhe da proposta seleccionada (no painel ao lado).
import { useEffect, useState } from "react";
import {
  apiAlterarProposta, apiModelos, apiProposta, apiPropostas, ESTADOS_PROPOSTA, type Proposta,
} from "../../../partilhado/api/crmDiretorio";
import { useAccao } from "../../../partilhado/dados/useAccao";
import { useOpcoes } from "../../../partilhado/dados/useOpcoes";
import { useRecurso } from "../../../partilhado/dados/useRecurso";
import { Botao, ErroCarregar, Esqueleto, Paginacao, data, useFiltrosUrl } from "../../../partilhado/ui";
import { corEstado, Dados, EstadoDoc, Fase, Passos } from "./comum";
import { useEntidade } from "./documento/comum";
import { imprimirDocumento } from "./documento/imprimir";
import { dataLonga, euros, eurosCurto, lerDocumento, numeroDoc } from "./documento/modelo";
import { TabelaLista, type ColunaLista } from "./TabelaLista";

const ROTULO_FASE: Record<string, string> = { Enviada: "Enviadas", "Negociação": "Em negociação", Aceite: "Aceites", Recusada: "Recusadas", Expirada: "Expiradas" };

export function TabPropostas({ selecionado, onSelecionar, onPrimeiro, onAbrir, onVerContrato }: {
  selecionado: number | null;
  onSelecionar: (id: number) => void;
  onPrimeiro: (id: number | null) => void;
  onAbrir: (id: number) => void;
  onVerContrato: (contratoId: number) => void;
}) {
  const [f, setF] = useFiltrosUrl({ pq: "", pestado: "", pcomercial: "", ppag: "1" });
  const pagina = Number(f.ppag) || 1;
  const { dados, erro, aCarregar, recarregar } = useRecurso(
    `crm:propostas:${f.pq}:${f.pestado}:${f.pcomercial}:${pagina}`,
    signal => apiPropostas({ q: f.pq, estado: f.pestado, comercial: f.pcomercial, pagina }, { signal }),
  );
  const comerciais = useOpcoes("comerciais");
  const primeiro = dados?.linhas[0]?.id ?? null;
  useEffect(() => { onPrimeiro(primeiro); }, [primeiro, onPrimeiro]);

  const colunas: ColunaLista<Proposta>[] = [
    { titulo: "Cliente", celula: p => <><div className="font-semibold">{p.clienteNome}</div><div className="num text-xs text-tinta-suave mt-0.5">Enviada {data(p.enviadaEm)}</div></> },
    { titulo: "Curso", celula: p => p.curso || "—" },
    { titulo: "Comercial", corrido: true, celula: p => p.comercial || "sem comercial" },
    { titulo: "Estado", corrido: true, celula: p => <EstadoDoc estado={p.estado} /> },
    { titulo: "Valor", dir: true, celula: p => <span className="num">{p.valor ? eurosCurto(p.valor) : "—"}</span> },
    {
      titulo: "Acção", escondido: true, dir: true, celula: p => (
        <button type="button" onClick={e => { e.stopPropagation(); if (p.contratoId) onVerContrato(p.contratoId); else onAbrir(p.id); }} className="border-0 bg-transparent p-0 text-ligacao font-semibold text-[13px] cursor-pointer hover:underline">
          {p.contratoId ? "Ver contrato" : "Abrir"}
        </button>
      ),
    },
  ];

  return (
    <>
      <div className="flex gap-2 flex-wrap items-center">
        {ESTADOS_PROPOSTA.map(e => (
          <Fase key={e} rotulo={ROTULO_FASE[e] ?? e} cor={corEstado(e)} n={dados?.fases.find(x => x.estado === e)?.n ?? 0}
            ativo={f.pestado === e} onClick={() => setF({ pestado: f.pestado === e ? "" : e, ppag: "1" })} />
        ))}
        <span className="ml-auto flex gap-2 flex-wrap">
          <input type="search" aria-label="Pesquisar propostas" placeholder="Cliente, email ou curso" value={f.pq} onChange={e => setF({ pq: e.target.value, ppag: "1" })}
            className="h-8 w-56 max-w-full rounded-lg border border-linha-forte bg-white px-3 text-[13px]" />
          <select aria-label="Comercial" value={f.pcomercial} onChange={e => setF({ pcomercial: e.target.value, ppag: "1" })}
            className="h-8 rounded-lg border border-linha-forte bg-white px-2 text-[13px]">
            <option value="">Comercial: todos</option>
            {comerciais.selecao.map(o => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
          </select>
        </span>
      </div>
      {erro ? <ErroCarregar erro={erro} onTentar={recarregar} /> : null}
      <TabelaLista
        minimo={680}
        rotulo="Propostas"
        colunas={colunas}
        linhas={dados?.linhas ?? []}
        chave={p => p.id}
        selecionado={selecionado}
        onLinha={p => onSelecionar(p.id)}
        aCarregar={aCarregar && !dados}
        vazio={f.pq || f.pestado || f.pcomercial ? "Nenhuma proposta com estes filtros." : "Ainda sem propostas. Crie a primeira com «Nova proposta»."}
        rodape={dados && dados.total > dados.porPagina ? <Paginacao pagina={dados.pagina} porPagina={dados.porPagina} total={dados.total} onMudar={p => setF({ ppag: String(p) })} /> : null}
      />
    </>
  );
}

const PASSOS = ["Enviada", "Negociação", "Aceite", "Contrato"];

export function DetalheProposta({ id, onEditar, onContrato, onVerContrato }: {
  id: number;
  onEditar: () => void;
  onContrato: (propostaId: number) => void;
  onVerContrato: (contratoId: number) => void;
}) {
  const { dados, erro, recarregar } = useRecurso(`crm:proposta:${id}`, signal => apiProposta(id, { signal }));
  const modelos = useRecurso("crm:modelos:proposta", signal => apiModelos("proposta", { signal }));
  const entidade = useEntidade();
  const [resposta, setResposta] = useState("");
  const [estado, setEstado] = useState("");
  const p = dados?.proposta;
  useEffect(() => { if (p) { setResposta(p.respostaCliente); setEstado(p.estado); } }, [p]);
  const guardar = useAccao(apiAlterarProposta, { ok: "Proposta actualizada.", invalidar: ["crm:propostas", "crm:proposta", "crm:clientes", "equipa:"] });

  if (erro) return <ErroCarregar erro={erro} onTentar={recarregar} />;
  if (!p) return <Esqueleto linhas={8} />;
  const doc = lerDocumento(p.corpo);
  const atual = p.contratoId ? 3 : p.estado === "Aceite" ? 2 : p.estado === "Negociação" ? 1 : 0;
  const modelo = modelos.dados?.modelos.find(m => m.id === p.templateId)?.nome;
  const mudou = resposta !== p.respostaCliente || estado !== p.estado;

  function pdf() {
    imprimirDocumento({
      titulo: `Proposta ${numeroDoc("proposta", p!.id)} · ${p!.clienteNome}`, htmlEditor: doc.html, def: doc.def, entidade,
      valores: { cliente: p!.clienteNome, email: p!.clienteEmail, curso: p!.curso, valor: euros(p!.valor), data: dataLonga(p!.enviadaEm), numero: numeroDoc("proposta", p!.id), comercial: p!.comercial, entidade },
      metaLinhas: [`Proposta ${numeroDoc("proposta", p!.id)}`, dataLonga(p!.enviadaEm)],
    });
  }

  return (
    <>
      <div>
        <p className="m-0 text-xs text-tinta-suave">Proposta {numeroDoc("proposta", p.id)}</p>
        <h2 className="m-0 mt-0.5 text-lg font-semibold text-tinta">{p.clienteNome}</h2>
        <div className="mt-2"><EstadoDoc estado={p.estado} /></div>
      </div>
      <Passos passos={PASSOS} atual={atual} />
      <Dados itens={[
        { rotulo: "Curso", valor: p.curso || "—" },
        { rotulo: "Formandos", valor: doc.def.dados.formandos || "—" },
        { rotulo: "Valor", valor: p.valor ? euros(p.valor) : "—", forte: true },
        { rotulo: "Comercial", valor: p.comercial || "sem comercial" },
        { rotulo: "Modelo", valor: modelo ?? (p.templateId ? `#${p.templateId}` : "Sem modelo") },
        { rotulo: "Email", valor: p.clienteEmail || "—" },
      ]} />
      <section className="flex flex-col gap-2">
        <h3 className="m-0 text-sm font-semibold text-tinta">Resposta do cliente</h3>
        <textarea value={resposta} onChange={e => setResposta(e.target.value)} rows={3} placeholder="Aceitou, pediu desconto, quer outra data…"
          className="text-[13px] leading-normal p-3 bg-fundo border border-transparent rounded-lg resize-y focus:border-linha-forte focus:bg-white outline-none" />
        <div className="flex items-center gap-2">
          <p className="num m-0 text-xs text-tinta-suave flex-1">{p.respostaEm ? `Registado a ${data(p.respostaEm)}` : "Ainda sem resposta registada."}</p>
          <select aria-label="Estado da proposta" value={estado} onChange={e => setEstado(e.target.value)} className="h-8 rounded-lg border border-linha-forte bg-white px-2 text-[13px]">
            {ESTADOS_PROPOSTA.map(e => <option key={e} value={e}>{e === "Negociação" ? "Em negociação" : e}</option>)}
          </select>
          <Botao tamanho="sm" disabled={!mudou} aCarregar={guardar.aCorrer} onClick={() => void guardar.correr(p.id, { estado, respostaCliente: resposta.trim() })}>Guardar</Botao>
        </div>
      </section>
      <div className="mt-auto flex flex-col gap-2 border-t border-[#EEF0F3] pt-4">
        {p.contratoId ? (
          <Botao variante="primario" onClick={() => onVerContrato(p.contratoId!)}>Ver o contrato</Botao>
        ) : p.estado === "Recusada" || p.estado === "Expirada" ? null : (
          <Botao variante="primario" aCarregar={guardar.aCorrer} onClick={async () => {
            if (p.estado !== "Aceite") { const r = await guardar.correr(p.id, { estado: "Aceite", respostaCliente: resposta.trim() }); if (!r) return; }
            onContrato(p.id);
          }}>
            {p.estado === "Aceite" ? "Criar contrato" : "Marcar como aceite e criar contrato"}
          </Botao>
        )}
        <div className="flex gap-2">
          <Botao className="flex-1" onClick={onEditar}>Editar proposta</Botao>
          <Botao className="flex-1" onClick={pdf}>Descarregar PDF</Botao>
        </div>
      </div>
    </>
  );
}
