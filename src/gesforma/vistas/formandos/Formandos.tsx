import { useMemo, useState } from "react";
import { usePode } from "../../../partilhado/AuthGate";
import { apiListarFormandos, type LinhaFormando, type Regime, type SeparadorFormandos } from "../../../partilhado/api/formandos";
import { useOpcoes } from "../../../partilhado/dados/useOpcoes";
import { useRecurso } from "../../../partilhado/dados/useRecurso";
import {
  Botao, Cartao, ErroCarregar, Estado, Filtros, PageHeader, Paginacao, Separadores, Tabela, Vazio, data, eur, num,
  useFiltrosUrl, type Coluna, type FiltroSelecao,
} from "../../../partilhado/ui";
import type { VistaProps } from "../../shell/tipos";
import { NovaFicha } from "./NovaFicha";
import { BarraDocs, PAGAMENTO } from "./partes";
import { rotuloCodigoCurso } from "../../../partilhado/codigoCurso";

const SEPARADORES: Record<Regime, { id: SeparadorFormandos; rotulo: string }[]> = {
  gold: [
    { id: "turmas", rotulo: "Em turmas" },
    { id: "avulsos", rotulo: "Avulsos" },
    { id: "pendencias", rotulo: "Com pendências" },
  ],
  fin: [
    { id: "todos", rotulo: "Todos" },
    { id: "elegiveis", rotulo: "Elegíveis" },
    { id: "docs_em_falta", rotulo: "Documentos em falta" },
  ],
};

export default function Formandos({ view, navigate }: VistaProps) {
  const regime: Regime = view === "fin-formandos" ? "fin" : "gold";
  const gold = regime === "gold";
  const pode = usePode();
  const podeCriar = pode(gold ? "turmas.gerir" : "formandosFin.gerir");
  const [f, setF, limpar] = useFiltrosUrl({
    separador: gold ? (view === "gold-formandos-gold" ? "avulsos" : "turmas") : "todos",
    q: "", curso: "", turma: "", local: "", pagamento: "", docs: "", acesso: "", pagina: "1", ordem: "",
  });
  const [novaAberta, setNovaAberta] = useState(false);

  const filtros = { regime, ...f, separador: f.separador as SeparadorFormandos, pagina: Number(f.pagina) || 1, porPagina: 25 };
  const { dados, erro, aCarregar, recarregar } = useRecurso(`formandos:${JSON.stringify(filtros)}`, s => apiListarFormandos(filtros, s));

  const cursos = useOpcoes("cursos", { regime });
  const turmas = useOpcoes("turmas", { regime, todos: true });
  const locais = useOpcoes("locais", { regime });
  const turmasSel = useMemo(() => turmas.opcoes.map(t => ({ valor: String(t.id), rotulo: t.rotulo })), [turmas.opcoes]);

  const abrir = (l: LinhaFormando) => navigate({ view: gold ? "gold-formando-ficha" : "fin-formando-ficha", formandoId: l.id });
  const totalDocs = dados?.docsObrigatorios ?? 0;

  const selecoes: FiltroSelecao[] = [
    { chave: "curso", rotulo: gold ? "Curso" : "Curso / UFCD", opcoes: cursos.selecao, valor: f.curso, onMudar: v => setF({ curso: v }) },
    { chave: "turma", rotulo: "Turma", opcoes: turmasSel, valor: f.turma, onMudar: v => setF({ turma: v }) },
    ...(gold ? [
      { chave: "local", rotulo: "Local", opcoes: locais.selecao, valor: f.local, onMudar: (v: string) => setF({ local: v }) },
      {
        chave: "pagamento", rotulo: "Pagamento", valor: f.pagamento, onMudar: (v: string) => setF({ pagamento: v }),
        opcoes: [{ valor: "pago", rotulo: "Pago" }, { valor: "por_pagar", rotulo: "Por pagar" }, { valor: "oferta", rotulo: "Oferta" }, { valor: "isento", rotulo: "Sem valor" }],
      },
      { chave: "docs", rotulo: "Documentos", valor: f.docs, onMudar: (v: string) => setF({ docs: v }), opcoes: [{ valor: "completos", rotulo: "Completos" }, { valor: "em_falta", rotulo: "Em falta" }] },
    ] : []),
    { chave: "acesso", rotulo: "Acesso", valor: f.acesso, onMudar: v => setF({ acesso: v }), opcoes: [{ valor: "com", rotulo: "Com acesso" }, { valor: "sem", rotulo: "Sem acesso" }] },
  ];
  const ativos = ["q", "curso", "turma", "local", "pagamento", "docs", "acesso"].filter(k => (f as Record<string, string>)[k]).length;

  const colunas: Coluna<LinhaFormando>[] = [
    { id: "id", titulo: "ID", ordenavel: true, largura: "80px", esconderMovel: true, celula: l => <span className="text-tinta-suave">#{l.id}</span> },
    {
      id: "nome", titulo: "Formando", ordenavel: true, principal: true,
      celula: l => (
        <div className="min-w-0">
          <p className="m-0 font-semibold text-tinta">{`${l.nome} ${l.apelido}`.trim()}</p>
          <p className="m-0 text-xs text-tinta-suave truncate max-w-[280px]">{l.email || "Sem email"}{l.inscrito ? ` · inscrito ${data(l.inscrito)}` : ""}</p>
        </div>
      ),
    },
    {
      id: "turma", titulo: gold ? "Turma / curso" : "Turma / UFCD", ordenavel: true,
      celula: l => (
        <div className="min-w-0">
          <p className="m-0 font-semibold text-tinta">{l.turma?.nome ?? (gold ? "Sem turma" : "Por colocar")}</p>
          <p className="m-0 text-xs text-tinta-suave truncate max-w-[260px]">{[l.ufcd && `${rotuloCodigoCurso(l.ufcd)}`, l.curso, gold ? l.local : ""].filter(Boolean).join(" · ")}</p>
        </div>
      ),
    },
    { id: "docs", titulo: "Documentos", ordenavel: true, celula: l => <BarraDocs validados={l.docs.validados} total={totalDocs} recusados={l.docs.recusados} /> },
    gold
      ? {
        id: "valor", titulo: "Pagamento", ordenavel: true,
        celula: l => {
          const p = PAGAMENTO[l.pagamento.situacao];
          return (
            <div>
              <Estado tom={p.tom} ponto>{p.rotulo}</Estado>
              {l.pagamento.valor > 0 && <p className="m-0 mt-0.5 text-xs text-tinta-suave whitespace-nowrap">{eur(l.pagamento.valor)}{l.pagamento.pago && l.pagamento.metodo !== "-" ? ` · ${l.pagamento.metodo}` : ""}</p>}
            </div>
          );
        },
      }
      : { id: "estado", titulo: "Estado", ordenavel: true, celula: l => <Estado tom={/desist|indefer/i.test(l.estado) ? "perigo" : /eleg|coloc|frequent|conclu|certif/i.test(l.estado) ? "sucesso" : "neutro"} ponto>{l.estado}</Estado> },
    {
      id: "acesso", titulo: "Área do formando",
      celula: l => <span className={`text-[13px] whitespace-nowrap ${l.acesso ? "text-sucesso" : "text-aviso"}`}>{l.acesso ? "Com acesso" : "Sem acesso"}</span>,
    },
  ];

  const total = dados?.total ?? 0;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        trilho={[{ rotulo: gold ? "Gold" : "Financiada", onClick: () => navigate(gold ? "gold-painel" : "fin-painel") }, { rotulo: "Formandos" }]}
        titulo="Formandos"
        subtitulo={dados ? `${num(total)} ${total === 1 ? "formando" : "formandos"} nesta lista` : "A carregar…"}
        acoes={podeCriar && <Botao variante="primario" onClick={() => setNovaAberta(true)} icone={<span aria-hidden="true">＋</span>}>Nova ficha</Botao>}
      />

      <Separadores<SeparadorFormandos>
        rotulo="Listas de formandos"
        estilo="pilula"
        ativo={f.separador as SeparadorFormandos}
        onMudar={id => setF({ separador: id })}
        itens={SEPARADORES[regime].map(s => ({ ...s, contagem: dados?.contagens[s.id] }))}
      />

      <Filtros
        pesquisa={{ valor: f.q, onMudar: v => setF({ q: v }), placeholder: "Nome, email, curso, turma ou ID", rotulo: "Pesquisar formandos" }}
        selecoes={selecoes}
        ativos={ativos}
        onLimpar={limpar}
      />

      {erro != null && !dados && <ErroCarregar erro={erro} onTentar={recarregar} />}

      <Cartao semPadding>
        <Tabela
          rotulo="Formandos"
          linhas={dados?.linhas ?? []}
          colunas={colunas}
          chave={l => l.id}
          ordem={f.ordem || undefined}
          onOrdenar={o => setF({ ordem: o })}
          onLinha={abrir}
          aCarregar={aCarregar}
          acoesLinha={l => <Botao variante="ligacao" tamanho="sm" onClick={() => abrir(l)}>Abrir ficha</Botao>}
          vazio={(
            <Vazio
              titulo={ativos ? "Nenhum formando com estes filtros." : "Ainda não há formandos nesta lista."}
              descricao={ativos ? "Experimente limpar os filtros ou mudar de lista." : gold ? "As fichas nascem da pré-inscrição paga ou são criadas aqui pela secretaria." : "As fichas nascem das inscrições elegíveis ou são criadas aqui."}
              acao={ativos ? <Botao onClick={limpar}>Limpar filtros</Botao> : podeCriar ? <Botao variante="primario" onClick={() => setNovaAberta(true)}>Nova ficha</Botao> : undefined}
            />
          )}
        />
        {dados && <Paginacao pagina={dados.pagina} porPagina={dados.porPagina} total={dados.total} onMudar={p => setF({ pagina: String(p) })} />}
      </Cartao>

      <NovaFicha
        aberto={novaAberta}
        onFechar={() => setNovaAberta(false)}
        regime={regime}
        onCriada={id => { setNovaAberta(false); navigate({ view: gold ? "gold-formando-ficha" : "fin-formando-ficha", formandoId: id }); }}
      />
    </div>
  );
}
