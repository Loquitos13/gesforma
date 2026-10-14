// Sistema › Pagamentos: transferência com comprovativo. Lista por situação, indicadores,
// confirmar/recusar o comprovativo no painel lateral e registo manual.
import { useState } from "react";
import { usePode } from "../../../partilhado/AuthGate";
import { apiExportarPagamentos, apiPagamentos, type LinhaPagamento, type SituacaoPagamento } from "../../../partilhado/api/pagamentos";
import { useAccao } from "../../../partilhado/dados/useAccao";
import { useOpcoes } from "../../../partilhado/dados/useOpcoes";
import { useRecurso } from "../../../partilhado/dados/useRecurso";
import {
  Aviso, BarrasHorizontais, Botao, Cartao, ErroCarregar, Esqueleto, Filtros, Kpi, KpiFaixa, PageHeader, Paginacao, Separadores, Tabela,
  Vazio, data, eur, evolucao, num, useFiltrosUrl, type Coluna,
} from "../../../partilhado/ui";
import type { VistaProps } from "../../shell/tipos";
import { DetalhePagamento, EstadoPagamento } from "./pagamentos/DetalhePagamento";
import { RegistarPagamento } from "./pagamentos/RegistarPagamento";

const SEPARADORES: { id: "" | SituacaoPagamento; rotulo: string }[] = [
  { id: "", rotulo: "Todos" },
  { id: "a_confirmar", rotulo: "A confirmar" },
  { id: "pedido", rotulo: "Pedidos" },
  { id: "recusado", rotulo: "Recusados" },
  { id: "pago", rotulo: "Pagos" },
  { id: "cancelado", rotulo: "Cancelados" },
  { id: "reembolsado", rotulo: "Reembolsados" },
];

export default function Pagamentos({ navigate }: VistaProps) {
  const pode = usePode();
  const confirmar = pode("pagamentos.confirmar");
  const [f, setF, limpar] = useFiltrosUrl({ situacao: "", curso: "", metodo: "", de: "", ate: "", q: "", ordem: "", pagina: "1", sel: "" });
  const pagina = Number(f.pagina) || 1;
  const chave = `pagamentos:${f.situacao}:${f.curso}:${f.metodo}:${f.de}:${f.ate}:${f.q}:${f.ordem}:${pagina}`;
  const { dados, erro, aCarregar, recarregar } = useRecurso(chave, signal =>
    apiPagamentos({ situacao: f.situacao, curso: f.curso, metodo: f.metodo, de: f.de, ate: f.ate, q: f.q, ordem: f.ordem, pagina, porPagina: 25 }, signal));
  const cursos = useOpcoes("cursos", { regime: "gold" });
  const [registar, setRegistar] = useState(false);
  const exportar = useAccao(() => apiExportarPagamentos({ situacao: f.situacao, curso: f.curso, metodo: f.metodo, de: f.de, ate: f.ate, q: f.q }), { erro: "A exportação falhou." });

  const ind = dados?.indicadores;
  const contagem = (s: string) => (s ? dados?.contagens.find(c => c.situacao === s)?.total ?? 0 : dados?.contagens.reduce((t, c) => t + c.total, 0));
  const metodos = (ind?.metodos ?? []).map(m => ({ valor: m.metodo, rotulo: m.metodo }));
  const aConfirmar = contagem("a_confirmar") ?? 0;
  const evoMes = ind ? evolucao(ind.esteMes, ind.mesAnteriorAteHoje) : null;

  const colunas: Coluna<LinhaPagamento>[] = [
    {
      id: "nome", titulo: "Pessoa", ordenavel: true, principal: true,
      celula: p => (
        <span className="block min-w-0">
          <span className="block font-semibold text-tinta truncate">{p.nome}</span>
          <span className="block text-xs text-tinta-suave truncate">{p.email || "sem email"}</span>
        </span>
      ),
    },
    { id: "curso", titulo: "Curso", ordenavel: true, esconderMovel: true, celula: p => <span className="block max-w-[220px] truncate" title={p.curso}>{p.curso || "—"}</span> },
    { id: "valor", titulo: "Valor", ordenavel: true, alinhar: "dir", celula: p => <strong className="font-semibold">{eur(p.valor, true)}</strong> },
    { id: "metodo", titulo: "Método", esconderMovel: true, celula: p => p.metodo || "—" },
    { id: "data", titulo: "Data", ordenavel: true, celula: p => data(p.pago_em ?? p.criado) },
    { id: "situacao", titulo: "Estado", celula: p => <EstadoPagamento situacao={p.situacao} /> },
  ];
  const ativos = [f.curso, f.metodo, f.de, f.ate, f.q].filter(Boolean).length;
  const linhas = dados?.linhas ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        trilho={[{ rotulo: "Sistema", onClick: () => navigate("configuracoes") }, { rotulo: "Pagamentos" }]}
        titulo="Pagamentos"
        subtitulo="Transferência bancária com comprovativo. Pagamento automático (gateway): por escolher."
        acoes={(
          <div className="flex gap-2 flex-wrap">
            <Botao onClick={() => void exportar.correr()} aCarregar={exportar.aCorrer} disabled={!dados?.total} title="Exporta para Excel os pagamentos com os filtros actuais">
              Exportar Excel
            </Botao>
            {confirmar && <Botao variante="primario" onClick={() => setRegistar(true)}>Registar pagamento</Botao>}
          </div>
        )}
      />

      <KpiFaixa rotulo="Indicadores de pagamentos" className="xl:grid-cols-5">
        <Kpi rotulo={f.de || f.ate ? "Receita no período" : "Receita confirmada"} valor={ind?.receita} formato="eur"
          delta={ind ? `${num(ind.pagamentos)} pagamentos` : undefined} />
        <Kpi rotulo="Este mês" valor={ind?.esteMes} formato="eur"
          delta={evoMes && evoMes.delta != null ? { texto: `${evoMes.texto} que o mês passado até hoje`, tom: evoMes.tom } : "sem base no mês passado"} />
        <Kpi rotulo="Por receber" valor={ind?.porReceber} formato="eur" delta={ind ? `${num(ind.porReceberN)} pagamentos pendentes` : undefined}
          onClick={() => setF({ situacao: "pedido" })} />
        <Kpi rotulo="A confirmar" valor={dados ? aConfirmar : undefined}
          delta={{ texto: aConfirmar ? "comprovativos à espera" : "nada à espera", tom: aConfirmar ? "aviso" : "neutro" }}
          onClick={() => setF({ situacao: "a_confirmar" })} />
        <Kpi rotulo="Ticket médio" valor={ind?.ticketMedio} formato="eur2" delta="pagamentos confirmados" />
      </KpiFaixa>

      {aConfirmar > 0 && f.situacao !== "a_confirmar" && (
        <Aviso tom="aviso" titulo={`${num(aConfirmar)} comprovativo${aConfirmar === 1 ? "" : "s"} por confirmar`}
          acao={<Botao tamanho="sm" onClick={() => setF({ situacao: "a_confirmar" })}>Ver</Botao>}>
          Confirmar o pagamento conclui a inscrição: cria a ficha, a conta e envia o acesso por email.
        </Aviso>
      )}

      <Separadores
        rotulo="Situação dos pagamentos"
        estilo="pilula"
        ativo={f.situacao as "" | SituacaoPagamento}
        onMudar={id => setF({ situacao: id, sel: "" })}
        itens={SEPARADORES.map(s => ({ id: s.id, rotulo: s.rotulo, contagem: dados ? contagem(s.id) : undefined }))}
      />

      <Filtros
        pesquisa={{ valor: f.q, onMudar: q => setF({ q }), placeholder: "Nome, email, curso ou n.º do pagamento" }}
        selecoes={[
          { chave: "curso", rotulo: "Curso", opcoes: cursos.selecao, valor: f.curso, onMudar: curso => setF({ curso }), vazio: "Curso: todos" },
          { chave: "metodo", rotulo: "Método", opcoes: metodos, valor: f.metodo, onMudar: metodo => setF({ metodo }), vazio: "Método: todos" },
        ]}
        periodo={{ de: f.de, ate: f.ate, onMudar: (de, ate) => setF({ de, ate }) }}
        ativos={ativos}
        onLimpar={limpar}
      />

      {erro ? <ErroCarregar erro={erro} onTentar={recarregar} /> : null}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
        <Cartao semPadding className="xl:col-span-2">
          <Tabela
            rotulo="Pagamentos"
            linhas={linhas}
            colunas={colunas}
            chave={p => p.id}
            ordem={f.ordem}
            onOrdenar={ordem => setF({ ordem })}
            onLinha={p => setF({ sel: p.id, pagina: f.pagina })}
            linhaAtiva={f.sel || null}
            aCarregar={aCarregar && !dados}
            vazio={(
              <Vazio
                titulo={ativos || f.situacao ? "Nenhum pagamento com estes filtros" : "Ainda não há pagamentos"}
                descricao={ativos || f.situacao ? "Mude a situação ou limpe os filtros." : "Os pagamentos aparecem quando a secretaria pede o pagamento de uma pré-inscrição ou regista um à mão."}
                acao={ativos ? <Botao tamanho="sm" onClick={limpar}>Limpar filtros</Botao> : undefined}
              />
            )}
          />
          {dados && <Paginacao pagina={dados.pagina} porPagina={dados.porPagina} total={dados.total} onMudar={p => setF({ pagina: String(p) })} />}
        </Cartao>

        <Cartao titulo="Métodos de pagamento" subtitulo={f.de || f.ate ? "Pagamentos confirmados no período" : "Todos os pagamentos confirmados"}>
          {!ind ? <Esqueleto linhas={4} /> : (
            <BarrasHorizontais
              rotulo="Valor confirmado por método"
              formato="eur"
              cor="#1F7A4D"
              itens={ind.metodos.map(m => ({ rotulo: m.metodo, valor: m.valor, detalhe: `${m.metodo}: ${num(m.n)} pagamentos`, onClick: () => setF({ metodo: m.metodo }) }))}
              vazio="Ainda não há pagamentos confirmados."
            />
          )}
          {ind && <p className="m-0 mt-3 text-xs text-tinta-suave">Por receber: {eur(ind.porReceber)}. A receita por mês está no Painel.</p>}
        </Cartao>
      </div>

      <DetalhePagamento id={f.sel || null} onFechar={() => setF({ sel: "", pagina: f.pagina })} podeConfirmar={confirmar} navigate={navigate} />
      <RegistarPagamento aberto={registar} onFechar={() => setRegistar(false)} />
    </div>
  );
}
