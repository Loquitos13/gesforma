// Clientes (empresas e instituições): lista com o resumo comercial e a ficha do cliente ao lado.
import { useState } from "react";
import { apiClientes, apiCriarCliente, ESTADOS_PROPOSTA, type ClienteResumo } from "../../../partilhado/api/crmDiretorio";
import { useAccao } from "../../../partilhado/dados/useAccao";
import { useRecurso } from "../../../partilhado/dados/useRecurso";
import {
  Botao, Cartao, ErroCarregar, Filtros, PageHeader, Paginacao, Tabela, Vazio, eur, num, useFiltrosUrl, type Coluna,
} from "../../../partilhado/ui";
import type { VistaProps } from "../../shell/tipos";
import { ClienteDetalhe, FormCliente } from "./ClienteDetalhe";
import { EstadoDoc, trilhoCrm } from "./comum";

const ESTADOS = [{ valor: "Sem propostas", rotulo: "Sem propostas" }, ...ESTADOS_PROPOSTA.map(e => ({ valor: e, rotulo: e === "Negociação" ? "Em negociação" : e }))];

export default function Clientes({ view, navigate }: VistaProps) {
  const [f, setF, limpar] = useFiltrosUrl({ q: "", estado: "", ordem: "", pagina: "1", cliente: "" });
  const pagina = Number(f.pagina) || 1;
  const chave = `crm:clientes:${f.q}:${f.estado}:${f.ordem}:${pagina}`;
  const { dados, erro, aCarregar, recarregar } = useRecurso(chave, signal =>
    apiClientes({ q: f.q, estado: f.estado, ordem: f.ordem, pagina }, { signal }));
  const [novo, setNovo] = useState(false);
  const selecionado = f.cliente ? Number(f.cliente) : dados?.linhas[0]?.id ?? null;
  const criar = useAccao(apiCriarCliente, { ok: "Cliente criado.", invalidar: ["crm:clientes"] });

  const colunas: Coluna<ClienteResumo>[] = [
    {
      id: "nome", titulo: "Cliente", ordenavel: true, principal: true,
      celula: c => (
        <span className="block min-w-0">
          <span className="block font-semibold text-tinta truncate">{c.nome}</span>
          <span className="block text-xs text-tinta-suave truncate">{c.email || c.telf || "Sem contacto"}</span>
        </span>
      ),
    },
    { id: "nif", titulo: "NIF", celula: c => c.nif || "—", esconderMovel: true },
    { id: "curso", titulo: "Última proposta", celula: c => c.ultimoCurso || "—" },
    { id: "estado", titulo: "Estado", celula: c => <EstadoDoc estado={c.ultimoEstado} /> },
    { id: "emAberto", titulo: "Em aberto", alinhar: "dir", ordenavel: true, celula: c => (c.emAberto ? eur(c.emAberto) : "—") },
    { id: "contratos", titulo: "Contratos", alinhar: "dir", ordenavel: true, celula: c => num(c.contratos) },
  ];
  const ativos = [f.q, f.estado].filter(Boolean).length;

  return (
    <div className="space-y-5">
      <PageHeader
        trilho={trilhoCrm(view, navigate, "Clientes")}
        titulo="Clientes"
        subtitulo={dados ? `${num(dados.resumo.clientes)} clientes · ${eur(dados.resumo.emAberto)} em propostas abertas · ${num(dados.resumo.comContrato)} com contrato` : "Empresas e instituições que compram formação."}
        acoes={<Botao variante="primario" onClick={() => setNovo(true)}>Novo cliente</Botao>}
      />
      <Filtros
        pesquisa={{ valor: f.q, onMudar: q => setF({ q }), placeholder: "Nome, email ou NIF…", rotulo: "Pesquisar clientes" }}
        selecoes={[{ chave: "estado", rotulo: "Estado", vazio: "Estado: todos", opcoes: ESTADOS, valor: f.estado, onMudar: estado => setF({ estado }) }]}
        ativos={ativos}
        onLimpar={limpar}
      />
      {erro ? <ErroCarregar erro={erro} onTentar={recarregar} /> : null}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px] items-start">
        <Cartao semPadding>
          <Tabela
            rotulo="Clientes"
            linhas={dados?.linhas ?? []}
            colunas={colunas}
            chave={c => c.id}
            ordem={f.ordem}
            onOrdenar={ordem => setF({ ordem })}
            onLinha={c => setF({ cliente: String(c.id), pagina: f.pagina })}
            linhaAtiva={selecionado}
            aCarregar={aCarregar}
            vazio={
              <Vazio
                titulo={ativos ? "Nenhum cliente com estes filtros." : "Ainda sem clientes."}
                descricao={ativos ? undefined : "Registe as empresas que compram formação ou pedem propostas."}
                acao={ativos ? <Botao onClick={limpar}>Limpar filtros</Botao> : <Botao variante="primario" onClick={() => setNovo(true)}>Novo cliente</Botao>}
              />
            }
          />
          {dados && <Paginacao pagina={dados.pagina} porPagina={dados.porPagina} total={dados.total} onMudar={p => setF({ pagina: String(p), cliente: f.cliente })} />}
        </Cartao>
        {selecionado != null ? (
          <ClienteDetalhe id={selecionado} onApagado={() => setF({ cliente: "", pagina: f.pagina })} onContratos={() => navigate(view.startsWith("fin-") ? "fin-crm-contratos" : "gold-crm-contratos")} />
        ) : null}
      </div>
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
    </div>
  );
}
