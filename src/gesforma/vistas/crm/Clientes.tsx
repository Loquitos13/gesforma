// Clientes (empresas e instituições): lista com o resumo comercial e a ficha do cliente no painel ao lado.
import { useState } from "react";
import { apiClientes, apiCriarCliente, ESTADOS_PROPOSTA, type ClienteResumo } from "../../../partilhado/api/crmDiretorio";
import { useAccao } from "../../../partilhado/dados/useAccao";
import { useRecurso } from "../../../partilhado/dados/useRecurso";
import { Botao, ErroCarregar, Paginacao, num, useFiltrosUrl } from "../../../partilhado/ui";
import type { Vista } from "../../rotasGesforma";
import type { VistaProps } from "../../shell/tipos";
import { ClienteDetalhe, FormCliente } from "./ClienteDetalhe";
import { CabecalhoLista, EstadoDoc, ListaComDetalhe } from "./comum";
import { eurosCurto } from "./documento/modelo";
import { TabelaLista, type ColunaLista } from "./TabelaLista";

const ESTADOS = [{ valor: "Sem propostas", rotulo: "Sem propostas" }, ...ESTADOS_PROPOSTA.map(e => ({ valor: e, rotulo: e === "Negociação" ? "Em negociação" : e }))];
const ORDENS = [{ valor: "", rotulo: "Ordenar: nome" }, { valor: "-recente", rotulo: "Ordenar: mais recentes" }, { valor: "-emAberto", rotulo: "Ordenar: em aberto" }, { valor: "-contratos", rotulo: "Ordenar: contratos" }];
const FILTRO = "h-9 rounded-lg border border-linha-forte bg-white px-2.5 text-[13px] text-tinta";

export default function Clientes({ view, navigate }: VistaProps) {
  const [f, setF] = useFiltrosUrl({ q: "", estado: "", tipo: "", de: "", ate: "", ordem: "", pagina: "1", cliente: "" });
  const pagina = Number(f.pagina) || 1;
  const { dados, erro, aCarregar, recarregar } = useRecurso(`crm:clientes:${f.q}:${f.estado}:${f.tipo}:${f.ordem}:${pagina}`, signal =>
    apiClientes({ q: f.q, estado: f.estado, tipo: f.tipo || undefined, de: f.de || undefined, ate: f.ate || undefined, ordem: f.ordem, pagina }, { signal }));
  const [novo, setNovo] = useState(false);
  const selecionado = f.cliente ? Number(f.cliente) : dados?.linhas[0]?.id ?? null;
  const criar = useAccao(apiCriarCliente, { ok: "Cliente criado.", invalidar: ["crm:clientes"] });
  const contratos: Vista = view.startsWith("fin-") ? "fin-crm-contratos" : "gold-crm-contratos";
  const ir = (filtros: Record<string, string>) => navigate({ view: contratos, filtros });

  const colunas: ColunaLista<ClienteResumo>[] = [
    { titulo: "Cliente", celula: c => <><div className="font-semibold text-ligacao">{c.nome}</div><div className="num text-xs text-tinta-suave mt-0.5">{[c.tipo, c.nif ? `NIF ${c.nif}` : "Sem NIF"].join(" · ")}</div></> },
    { titulo: "Contacto", celula: c => <><div className="truncate max-w-[220px]">{c.email || "—"}</div><div className="num text-xs text-tinta-suave mt-0.5">{c.telf}</div></> },
    { titulo: "Última proposta", celula: c => <><div>{c.ultimoCurso || "—"}</div>{c.ultimoEstado && c.ultimoEstado !== "Sem propostas" && <div className="mt-0.5"><EstadoDoc estado={c.ultimoEstado} /></div>}</> },
    { titulo: "Em aberto", dir: true, celula: c => <span className="num">{c.emAberto ? eurosCurto(c.emAberto) : "—"}</span> },
    { titulo: "Contratos", dir: true, celula: c => <span className="num">{num(c.contratos)}</span> },
  ];

  return (
    <ListaComDetalhe
      rotulo="Detalhe do cliente"
      detalhe={selecionado != null ? (
        <ClienteDetalhe
          key={selecionado}
          id={selecionado}
          onApagado={() => setF({ cliente: "" })}
          acoes={{
            onNovaProposta: id => ir({ editar: `proposta:novo:c${id}` }),
            onAbrirProposta: id => ir({ tab: "propostas", sel: String(id) }),
            onCriarContrato: id => ir({ editar: `contrato:novo:p${id}` }),
            onAbrirContrato: id => ir({ tab: "contratos", sel: String(id) }),
          }}
        />
      ) : undefined}
    >
      <CabecalhoLista
        titulo="Clientes"
        resumo={dados ? `${num(dados.resumo.clientes)} clientes · ${eurosCurto(dados.resumo.emAberto)} em propostas abertas · ${num(dados.resumo.comContrato)} com contrato` : " "}
        acoes={(
          <Botao variante="primario" onClick={() => setNovo(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true" className="mr-2"><path d="M12 5v14M5 12h14" /></svg>
            Novo cliente
          </Botao>
        )}
      />
      <div className="flex gap-2 flex-wrap items-center">
        <label className="flex items-center gap-2 h-9 px-3 rounded-lg border border-linha-forte bg-white flex-[1_1_240px] max-w-[360px] text-tinta-suave">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <span className="sr-only">Filtrar clientes</span>
          <input type="search" value={f.q} onChange={e => setF({ q: e.target.value })} placeholder="Nome, NIF ou email" className="border-0 outline-none bg-transparent flex-1 min-w-0 text-sm text-tinta" />
        </label>
        <select aria-label="Tipo de cliente" value={f.tipo} onChange={e => setF({ tipo: e.target.value })} className={FILTRO}>
          <option value="">Tipo: todos</option>
          <option value="Empresa">Empresas</option>
          <option value="Particular">Particulares</option>
        </select>
        <select aria-label="Propostas" value={f.estado} onChange={e => setF({ estado: e.target.value })} className={FILTRO}>
          <option value="">Propostas: todas</option>
          {ESTADOS.map(o => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-[13px] text-tinta-suave">Desde
          <input type="date" value={f.de} max={f.ate || undefined} onChange={e => setF({ de: e.target.value })} className={FILTRO} />
        </label>
        <label className="flex items-center gap-1.5 text-[13px] text-tinta-suave">Até
          <input type="date" value={f.ate} min={f.de || undefined} onChange={e => setF({ ate: e.target.value })} className={FILTRO} />
        </label>
        <select aria-label="Ordenar" value={f.ordem} onChange={e => setF({ ordem: e.target.value })} className={FILTRO}>
          {ORDENS.map(o => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
        </select>
        {dados && <span className="num ml-auto text-[13px] text-tinta-suave">A mostrar {num(dados.linhas.length)} de {num(dados.total)}</span>}
      </div>
      {erro ? <ErroCarregar erro={erro} onTentar={recarregar} /> : null}
      <TabelaLista
        rotulo="Clientes"
        colunas={colunas}
        linhas={dados?.linhas ?? []}
        chave={c => c.id}
        selecionado={selecionado}
        onLinha={c => setF({ cliente: String(c.id), pagina: f.pagina })}
        aCarregar={aCarregar && !dados}
        vazio={f.q || f.estado || f.tipo ? "Nenhum cliente com estes filtros." : "Ainda sem clientes. Registe as empresas que compram formação ou pedem propostas."}
        rodape={dados && dados.total > dados.porPagina ? <Paginacao pagina={dados.pagina} porPagina={dados.porPagina} total={dados.total} onMudar={p => setF({ pagina: String(p), cliente: f.cliente })} /> : null}
      />
      <FormCliente
        aberto={novo}
        titulo="Novo cliente"
        aCarregar={criar.aCorrer}
        onFechar={() => setNovo(false)}
        onGravar={async d => {
          const r = await criar.correr(d);
          if (r) {
            setNovo(false);
            setF({ cliente: String(r.cliente.id), pagina: f.pagina });
          }
        }}
      />
    </ListaComDetalhe>
  );
}
