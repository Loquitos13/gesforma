// Separador Contratos: lista por estado e o detalhe do contrato seleccionado (assinaturas, provas e Drive).
import { useEffect, useState } from "react";
import { apiAlterarContrato, apiApagarContrato, apiContrato, apiContratos, ESTADOS_CONTRATO, type Contrato } from "../../../partilhado/api/crmDiretorio";
import { useAccao } from "../../../partilhado/dados/useAccao";
import { invalidar, useRecurso } from "../../../partilhado/dados/useRecurso";
import { toastError, toastOk } from "../../../partilhado/toastBus";
import { Botao, ConfirmarPerigo, ErroCarregar, Esqueleto, Paginacao, data, useFiltrosUrl } from "../../../partilhado/ui";
import { PainelAssinatura } from "../assinaturas/PainelAssinatura";
import { corEstado, Dados, EstadoDoc, Fase, Passos, useGestao } from "./comum";
import { useEntidade } from "./documento/comum";
import { imprimirDocumento } from "./documento/imprimir";
import { dataLonga, euros, eurosCurto, lerDocumento, numeroDoc } from "./documento/modelo";
import { TabelaLista, type ColunaLista } from "./TabelaLista";

const ROTULO_FASE: Record<string, string> = { Rascunho: "Rascunhos", "Por assinar": "Por assinar", Assinado: "Assinados", Cancelado: "Cancelados" };

function origem(k: Contrato) {
  return k.propostaId ? `Proposta ${numeroDoc("proposta", k.propostaId)}` : k.modelo ? `Modelo · ${k.modelo}` : "Directo";
}

export function TabContratos({ selecionado, onSelecionar, onPrimeiro, onAbrir }: {
  selecionado: number | null;
  onSelecionar: (id: number) => void;
  onPrimeiro: (id: number | null) => void;
  onAbrir: (id: number) => void;
}) {
  const [f, setF] = useFiltrosUrl({ kq: "", kestado: "", kpag: "1" });
  const pagina = Number(f.kpag) || 1;
  const { dados, erro, aCarregar, recarregar } = useRecurso(
    `crm:contratos:${f.kq}:${f.kestado}:${pagina}`,
    signal => apiContratos({ q: f.kq, estado: f.kestado, pagina }, { signal }),
  );
  const primeiro = dados?.linhas[0]?.id ?? null;
  useEffect(() => { onPrimeiro(primeiro); }, [primeiro, onPrimeiro]);

  const colunas: ColunaLista<Contrato>[] = [
    { titulo: "Cliente", celula: k => <><div className="font-semibold">{k.clienteNome}</div><div className="text-xs text-tinta-suave mt-0.5">{k.comercial || "sem comercial"}</div></> },
    { titulo: "Curso", celula: k => k.curso || "—" },
    { titulo: "Origem", corrido: true, celula: k => <span className="num text-tinta-suave">{origem(k)}</span> },
    { titulo: "Estado", corrido: true, celula: k => <EstadoDoc estado={k.estado} /> },
    { titulo: "Valor", dir: true, celula: k => <span className="num">{k.valor ? eurosCurto(k.valor) : "—"}</span> },
    {
      titulo: "Acção", escondido: true, dir: true, celula: k => (
        <button type="button" onClick={e => { e.stopPropagation(); onAbrir(k.id); }} className="border-0 bg-transparent p-0 text-ligacao font-semibold text-[13px] cursor-pointer hover:underline">
          {k.estado === "Rascunho" ? "Editar" : "Abrir"}
        </button>
      ),
    },
  ];

  return (
    <>
      <div className="flex gap-2 flex-wrap items-center">
        {ESTADOS_CONTRATO.map(e => (
          <Fase key={e} rotulo={ROTULO_FASE[e] ?? e} cor={corEstado(e)} n={dados?.fases.find(x => x.estado === e)?.n ?? 0}
            ativo={f.kestado === e} onClick={() => setF({ kestado: f.kestado === e ? "" : e, kpag: "1" })} />
        ))}
        <input type="search" aria-label="Pesquisar contratos" placeholder="Cliente, email ou curso" value={f.kq} onChange={e => setF({ kq: e.target.value, kpag: "1" })}
          className="ml-auto h-8 w-56 max-w-full rounded-lg border border-linha-forte bg-white px-3 text-[13px]" />
      </div>
      {erro ? <ErroCarregar erro={erro} onTentar={recarregar} /> : null}
      <TabelaLista
        minimo={680}
        rotulo="Contratos"
        colunas={colunas}
        linhas={dados?.linhas ?? []}
        chave={k => k.id}
        selecionado={selecionado}
        onLinha={k => onSelecionar(k.id)}
        aCarregar={aCarregar && !dados}
        vazio={f.kq || f.kestado ? "Nenhum contrato com estes filtros." : "Ainda sem contratos. Crie um a partir de uma proposta aceite ou com «Novo contrato»."}
        rodape={dados && dados.total > dados.porPagina ? <Paginacao pagina={dados.pagina} porPagina={dados.porPagina} total={dados.total} onMudar={p => setF({ kpag: String(p) })} /> : null}
      />
    </>
  );
}

export function DetalheContrato({ id, onEditar }: { id: number; onEditar: () => void }) {
  const gestao = useGestao();
  const entidade = useEntidade();
  const { dados, erro, recarregar } = useRecurso(`crm:contrato:${id}`, signal => apiContrato(id, { signal }));
  const [apagar, setApagar] = useState(false);
  const [cancelar, setCancelar] = useState(false);
  const estado = useAccao(apiAlterarContrato, { ok: "Contrato actualizado.", invalidar: ["crm:contratos", "crm:contrato", "crm:clientes"] });
  if (erro) return <ErroCarregar erro={erro} onTentar={recarregar} />;
  const k = dados?.contrato;
  if (!k) return <Esqueleto linhas={8} />;
  const doc = lerDocumento(k.corpo);
  const atual = k.estado === "Assinado" ? 2 : k.estado === "Por assinar" ? 1 : 0;
  const papel = doc.def.assinatura === "papel";

  function pdf() {
    imprimirDocumento({
      titulo: `Contrato ${numeroDoc("contrato", k!.id)} · ${k!.clienteNome}`, htmlEditor: doc.html, def: doc.def, entidade,
      valores: { cliente: k!.clienteNome, email: k!.clienteEmail, curso: k!.curso, valor: k!.valor ? euros(k!.valor) : "", data: dataLonga(), numero: numeroDoc("contrato", k!.id), entidade },
      metaLinhas: [`Contrato ${numeroDoc("contrato", k!.id)}`, dataLonga()],
    });
  }

  return (
    <>
      <div>
        <p className="m-0 text-xs text-tinta-suave">Contrato {numeroDoc("contrato", k.id)}</p>
        <h2 className="m-0 mt-0.5 text-lg font-semibold text-tinta">{k.clienteNome}</h2>
        <div className="mt-2"><EstadoDoc estado={k.estado === "Por assinar" ? "Por assinar" : k.estado} /></div>
      </div>
      {k.estado !== "Cancelado" && <Passos passos={["Rascunho", "Para assinatura", "Assinado"]} atual={atual} />}
      <Dados itens={[
        { rotulo: "Curso", valor: k.curso || "—" },
        { rotulo: "Valor", valor: k.valor ? euros(k.valor) : "—", forte: true },
        { rotulo: "Origem", valor: origem(k) },
        { rotulo: "Comercial", valor: k.comercial || "sem comercial" },
        { rotulo: "Criado", valor: data(k.criadoEm) },
        ...(k.assinadoEm ? [{ rotulo: "Assinado", valor: data(k.assinadoEm) }] : []),
      ]} />
      {!papel && <PainelAssinatura contratoId={k.id} estadoContrato={k.estado} temTexto={Boolean(k.corpo.trim())} contrato={k} />}
      {papel && k.estado !== "Assinado" && (
        <p className="m-0 text-[13px] text-tinta-suave">Assinatura em papel: imprima o PDF, recolha as assinaturas e marque o contrato como assinado.</p>
      )}
      <div className="mt-auto flex flex-col gap-2 border-t border-[#EEF0F3] pt-4">
        <Botao variante="primario" onClick={onEditar}>{k.estado === "Rascunho" ? "Abrir no editor" : "Ver o contrato"}</Botao>
        <div className="flex gap-2 flex-wrap">
          <Botao className="flex-1" onClick={pdf}>Descarregar PDF</Botao>
          {papel && k.estado !== "Assinado" && k.estado !== "Cancelado" && (
            <Botao className="flex-1" aCarregar={estado.aCorrer} onClick={() => void estado.correr(k.id, { estado: "Assinado" })}>Marcar como assinado</Botao>
          )}
        </div>
        {gestao && k.estado !== "Assinado" && (
          <div className="flex gap-3 text-[13px]">
            {k.estado !== "Cancelado" && <button type="button" className="border-0 bg-transparent p-0 text-tinta-suave cursor-pointer hover:text-tinta" onClick={() => setCancelar(true)}>Cancelar contrato</button>}
            <button type="button" className="border-0 bg-transparent p-0 text-perigo cursor-pointer" onClick={() => setApagar(true)}>Apagar</button>
          </div>
        )}
      </div>
      <ConfirmarPerigo
        aberto={cancelar}
        onFechar={() => setCancelar(false)}
        titulo="Cancelar contrato"
        descricao={k.estado === "Por assinar" ? "O contrato é cancelado e a ligação de assinatura enviada ao cliente deixa de funcionar." : "O contrato é cancelado."}
        acao="Cancelar contrato"
        onConfirmar={async () => { await estado.correr(k.id, { estado: "Cancelado" }); }}
      />
      <ConfirmarPerigo
        aberto={apagar}
        onFechar={() => setApagar(false)}
        titulo="Apagar contrato"
        descricao="O contrato é apagado. Esta acção não se desfaz."
        onConfirmar={async () => {
          try {
            await apiApagarContrato(k.id);
            for (const x of ["crm:contratos", "crm:contrato", "crm:clientes"]) invalidar(x);
            toastOk("Contrato apagado.");
          } catch (e) {
            toastError(e, "Não foi possível apagar o contrato.");
          }
        }}
      />
    </>
  );
}
