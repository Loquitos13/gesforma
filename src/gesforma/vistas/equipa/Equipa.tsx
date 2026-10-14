// Equipa comercial (Gold) ou da Financiada: indicadores do período comparados com o período anterior,
// carteira de cada pessoa e, ao lado, o funil, os objectivos e o que há para seguir.
import { useState } from "react";
import { apiEquipa, apiMembro, type Membro } from "../../../partilhado/api/equipa";
import { useRecurso } from "../../../partilhado/dados/useRecurso";
import {
  BarrasHorizontais, Botao, Cartao, ErroCarregar, Esqueleto, Estado, Evolucao, Filtros, Kpi, KpiFaixa, PageHeader, Tabela, Vazio,
  data, dataHora, eur, evolucao, num, useFiltrosUrl, type Coluna,
} from "../../../partilhado/ui";
import type { VistaProps } from "../../shell/tipos";
import { iniciais, regimeDaVista } from "../crm/comum";
import { FichaMembro } from "./FichaMembro";

export default function Equipa({ view, navigate }: VistaProps) {
  const regime = regimeDaVista(view);
  const [f, setF, limpar] = useFiltrosUrl({ q: "", de: "", ate: "", sel: "" });
  const { dados, erro, aCarregar, recarregar } = useRecurso(
    `equipa:${regime}:${f.de}:${f.ate}`,
    signal => apiEquipa(regime, { de: f.de || undefined, ate: f.ate || undefined }, { signal }),
  );
  const [ficha, setFicha] = useState<string | null>(null);
  const termo = f.q.trim().toLowerCase();
  const membros = (dados?.membros ?? []).filter(m => !termo || `${m.nome} ${m.email}`.toLowerCase().includes(termo));
  const sel = membros.find(m => m.id === f.sel) ?? membros[0] ?? null;
  const t = dados?.totais;
  const p = dados?.periodo;
  const comparacao = p ? `face a ${data(p.anterior.de)}–${data(p.anterior.ate)}` : "";
  const delta = (a: number, b: number) => {
    const e = evolucao(a, b);
    return { texto: e.delta == null ? "sem base no período anterior" : `${e.texto} ${comparacao}`, tom: e.tom };
  };

  const colunas: Coluna<Membro>[] = [
    {
      id: "nome", titulo: "Pessoa", principal: true,
      celula: m => (
        <span className="flex items-center gap-2.5 min-w-0">
          <span aria-hidden="true" className={`h-8 w-8 shrink-0 rounded-full text-xs font-bold inline-flex items-center justify-center ${m.ativo ? "bg-acao text-tinta" : "bg-linha-suave text-tinta-suave"}`}>{iniciais(m.nome)}</span>
          <span className="min-w-0">
            <span className="block font-semibold text-tinta truncate">{m.nome}</span>
            <span className="block text-xs text-tinta-suave truncate">{m.ativo ? m.email : "Conta inactiva"}</span>
          </span>
        </span>
      ),
    },
    { id: "carteira", titulo: "Carteira", alinhar: "dir", celula: m => num(m.carteira.leads) },
    { id: "contactar", titulo: "Por contactar", alinhar: "dir", celula: m => <span className={m.carteira.porContactar >= 8 ? "font-semibold text-perigo" : ""}>{num(m.carteira.porContactar)}</span> },
    { id: "propostas", titulo: "Propostas abertas", alinhar: "dir", esconderMovel: true, celula: m => num(m.carteira.propostasAbertas) },
    { id: "conversao", titulo: "Conversão", celula: m => <BarraMeta valor={m.carteira.conversao} meta={m.objetivo.conversao} /> },
    {
      id: "periodo", titulo: "Pré-inscrições no período", alinhar: "dir",
      celula: m => <span className="inline-flex items-center gap-2">{num(m.atual.leads)}<Evolucao {...evolucao(m.atual.leads, m.anterior.leads)} /></span>,
    },
    {
      id: "receita", titulo: "Receita no período", alinhar: "dir",
      celula: m => <span className="inline-flex items-center gap-2">{eur(m.atual.receita)}<Evolucao {...evolucao(m.atual.receita, m.anterior.receita)} /></span>,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        trilho={[{ rotulo: regime === "fin" ? "Financiada" : "Gold", onClick: () => navigate(regime === "fin" ? "fin-painel" : "gold-painel") }, { rotulo: "Equipa" }]}
        titulo="Equipa"
        subtitulo={regime === "fin"
          ? "Quem trata a formação financiada: carteira, propostas e diário de contactos."
          : "Comerciais da ENA: carteira de pré-inscrições, propostas e o que fecharam no período."}
      />
      <Filtros
        pesquisa={{ valor: f.q, onMudar: q => setF({ q }), placeholder: "Nome ou email…", rotulo: "Pesquisar na equipa" }}
        periodo={{ de: f.de || p?.de || "", ate: f.ate || p?.ate || "", onMudar: (de, ate) => setF({ de, ate }) }}
        ativos={[f.q, f.de, f.ate].filter(Boolean).length}
        onLimpar={limpar}
      />
      {erro ? <ErroCarregar erro={erro} onTentar={recarregar} /> : null}
      <KpiFaixa rotulo="Indicadores da equipa">
        <Kpi rotulo="Pessoas activas" valor={t?.ativos} delta={t ? `${num(t.membros)} na equipa` : undefined} />
        <Kpi rotulo="Carteira" valor={t?.carteira} delta={t ? { texto: `${num(t.porContactar)} por contactar`, tom: t.porContactar ? "aviso" : "neutro" } : undefined} />
        <Kpi rotulo="Pré-inscrições no período" valor={t?.atual.leads} delta={t ? delta(t.atual.leads, t.anterior.leads) : undefined} />
        <Kpi rotulo="Pagos no período" valor={t?.atual.pagos} delta={t ? delta(t.atual.pagos, t.anterior.pagos) : undefined} />
        <Kpi rotulo="Receita no período" valor={t?.atual.receita} formato="eur" delta={t ? delta(t.atual.receita, t.anterior.receita) : undefined} />
        <Kpi rotulo="Propostas em aberto" valor={t?.pipeline} formato="eur" delta={t ? `${num(t.atual.propostas)} enviadas no período` : undefined} />
      </KpiFaixa>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px] items-start">
        <Cartao semPadding>
          <Tabela
            rotulo="Equipa"
            linhas={membros}
            colunas={colunas}
            chave={m => m.id}
            onLinha={m => setF({ sel: m.id })}
            linhaAtiva={sel?.id ?? null}
            aCarregar={aCarregar}
            vazio={(
              <Vazio
                titulo={dados?.membros.length ? "Ninguém corresponde à pesquisa." : "Ainda não há contas nesta equipa."}
                descricao={dados?.membros.length ? undefined : `Crie contas com o perfil ${regime === "fin" ? "Financiada" : "Comercial"} em Sistema › Utilizadores.`}
              />
            )}
          />
        </Cartao>
        {sel && <Resumo membro={sel} regime={regime} de={f.de} ate={f.ate} onAbrir={() => setFicha(sel.id)} />}
      </div>
      {ficha && <FichaMembro id={ficha} regime={regime} de={f.de} ate={f.ate} onFechar={() => setFicha(null)} />}
    </div>
  );
}

function BarraMeta({ valor, meta }: { valor: number; meta: number | null }) {
  const escala = Math.max(50, (meta ?? 0) + 10, valor);
  const cumpre = meta != null && meta > 0 && valor >= meta;
  return (
    <span className="flex items-center gap-2 min-w-[120px]" title={meta ? `Objectivo: ${meta} %` : "Sem objectivo"}>
      <span className="relative h-2 flex-1 rounded bg-linha-suave" aria-hidden="true">
        <span className={`absolute inset-y-0 left-0 rounded ${cumpre ? "bg-sucesso" : "bg-aviso"}`} style={{ width: `${Math.min(100, (valor / escala) * 100)}%` }} />
        {meta ? <span className="absolute -top-1 -bottom-1 w-0.5 bg-tinta" style={{ left: `${Math.min(100, (meta / escala) * 100)}%` }} /> : null}
      </span>
      <span className="num text-[13px] w-10 text-right">{num(valor)} %</span>
    </span>
  );
}

function Resumo({ membro: m, regime, de, ate, onAbrir }: { membro: Membro; regime: "gold" | "fin"; de: string; ate: string; onAbrir: () => void }) {
  const ficha = useRecurso(`equipa:${regime}:membro:${m.id}:${de}:${ate}`, signal => apiMembro(m.id, regime, { de: de || undefined, ate: ate || undefined }, { signal }));
  const seguir = ficha.dados?.seguir ?? [];
  return (
    <Cartao
      titulo={m.nome}
      subtitulo={[m.telefone, m.ultimoAcesso ? `último acesso ${dataHora(m.ultimoAcesso)}` : "sem acessos"].filter(Boolean).join(" · ")}
      acoes={<Botao tamanho="sm" onClick={onAbrir}>Abrir ficha</Botao>}
      className="xl:sticky xl:top-4"
    >
      <div className="flex gap-2 flex-wrap mb-4">
        <Estado tom={m.ativo ? "sucesso" : "neutro"} ponto>{m.ativo ? "Activa" : "Inactiva"}</Estado>
        {m.carteira.maisAntigoPorContactar && <Estado tom="aviso">Por contactar desde {data(m.carteira.maisAntigoPorContactar)}</Estado>}
      </div>
      <h3 className="m-0 mb-2 text-sm font-semibold text-tinta">Funil da carteira</h3>
      <BarrasHorizontais
        rotulo="Funil da carteira"
        mostrarPct={false}
        itens={[
          { rotulo: "Por contactar", valor: m.carteira.porContactar },
          { rotulo: "Em conversa", valor: m.carteira.emConversa },
          { rotulo: "Pagamento pedido", valor: m.carteira.pagamentoPedido },
          { rotulo: regime === "fin" ? "Validados" : "Formandos", valor: m.carteira.formandos },
        ]}
        vazio="Sem pré-inscrições atribuídas."
      />
      <h3 className="mt-5 mb-2 text-sm font-semibold text-tinta">Objectivos do período</h3>
      <dl className="num m-0 grid grid-cols-3 gap-2 text-center">
        {[
          ["Conversão", `${num(m.atual.conversao)} %`, m.objetivo.conversao != null ? `obj. ${num(m.objetivo.conversao)} %` : "sem objectivo"],
          ["Pré-inscrições", num(m.atual.leads), m.objetivo.leads ? `obj. ${num(m.objetivo.leads)}` : "sem objectivo"],
          ["Propostas", num(m.atual.propostas), m.objetivo.propostas ? `obj. ${num(m.objetivo.propostas)}` : "sem objectivo"],
        ].map(([r, v, o]) => (
          <div key={r} className="rounded-controlo bg-fundo py-2">
            <dt className="text-[11px] text-tinta-suave">{r}</dt>
            <dd className="m-0 text-base font-semibold text-tinta">{v}</dd>
            <dd className="m-0 text-[11px] text-tinta-suave">{o}</dd>
          </div>
        ))}
      </dl>
      <h3 className="mt-5 mb-2 text-sm font-semibold text-tinta">A seguir</h3>
      {ficha.aCarregar && !ficha.dados ? <Esqueleto linhas={2} /> : seguir.length === 0 ? (
        <p className="m-0 text-[13px] text-tinta-suave">Nada pendente: sem propostas paradas nem pagamentos à espera.</p>
      ) : (
        <ul className="m-0 p-0 list-none divide-y divide-linha-suave">
          {seguir.map(s => (
            <li key={`${s.tipo}-${s.id}`} className="py-2">
              <p className="m-0 text-sm font-medium text-tinta">{s.titulo}</p>
              <p className="m-0 text-xs text-tinta-suave">{s.detalhe}</p>
            </li>
          ))}
        </ul>
      )}
    </Cartao>
  );
}
