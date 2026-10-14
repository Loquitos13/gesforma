// Resultados de um inquérito: taxa de resposta por turma e resumo de cada pergunta, com filtros por turma e curso.
import {
  apiResultadosInquerito, type InqueritoDefinicao, type InqueritoResumo, type Regime, type ResultadosInquerito, type ResumoPergunta,
} from "../../../partilhado/api/inqueritos";
import { useOpcoes } from "../../../partilhado/dados/useOpcoes";
import { useRecurso } from "../../../partilhado/dados/useRecurso";
import {
  BarrasHorizontais, Botao, Cartao, ErroCarregar, Esqueleto, Filtros, Kpi, KpiFaixa, Tabela, Vazio, data, num, useFiltrosUrl, type Coluna,
} from "../../../partilhado/ui";
import { descarregarCsv, rotuloTipo } from "./comum";

type LinhaTurma = ResultadosInquerito["turmas"][number];

export function Resultados({ regime, inquerito, definicao }: { regime: Regime; inquerito: InqueritoResumo; definicao: InqueritoDefinicao | null }) {
  const [f, setF, limpar] = useFiltrosUrl({ turma: "", curso: "" });
  const turmas = useOpcoes("turmas", { regime, todos: true });
  const cursos = useOpcoes("cursos", { regime, todos: true });
  const { dados, erro, aCarregar, recarregar } = useRecurso(
    `inqueritos:resultados:${inquerito.id}:${f.turma}:${f.curso}`,
    signal => apiResultadosInquerito(inquerito.id, { turma: f.turma || undefined, curso: f.curso || undefined }, signal),
  );

  const colunas: Coluna<LinhaTurma>[] = [
    {
      id: "turma", titulo: "Turma", principal: true,
      celula: t => (
        <span className="block min-w-0">
          <span className="block font-semibold text-tinta truncate">{t.turma || "Sem turma indicada"}</span>
          <span className="block text-xs text-tinta-suave truncate">{t.curso || (t.turmaId == null ? "Respostas lançadas sem envio" : "")}</span>
        </span>
      ),
    },
    { id: "enviado", titulo: "Enviado", celula: t => (t.enviadoEm ? data(t.enviadoEm) : "—"), esconderMovel: true },
    { id: "enviados", titulo: "Destinatários", alinhar: "dir", celula: t => num(t.enviados) },
    { id: "respostas", titulo: "Respostas", alinhar: "dir", celula: t => num(t.respostas) },
    { id: "taxa", titulo: "Taxa", alinhar: "dir", celula: t => (t.taxa == null ? "—" : <span className="font-semibold">{t.taxa} %</span>) },
  ];

  function exportar() {
    if (!dados) return;
    const linhas: (string | number)[][] = [
      [dados.inquerito.titulo],
      [],
      ["Turma", "Curso", "Destinatários", "Respostas", "Taxa (%)"],
      ...dados.turmas.map(t => [t.turma, t.curso, t.enviados, t.respostas, t.taxa ?? ""]),
      [],
      ["Pergunta", "Tipo", "Respostas", "Média", "% Sim", "Opções"],
      ...dados.perguntas.map(p => [
        p.texto, rotuloTipo(p.tipo), p.n, p.media ?? "", p.pctSim ?? "",
        Object.entries(p.contagens).map(([k, v]) => `${k}: ${v}`).join(" | "),
      ]),
    ];
    descarregarCsv(`resultados-${dados.inquerito.titulo}`, linhas);
  }

  const ativos = [f.turma, f.curso].filter(Boolean).length;
  return (
    <div className="space-y-4">
      <Filtros
        selecoes={[
          { chave: "turma", rotulo: "Turma", vazio: "Turma: todas", opcoes: turmas.selecao, valor: f.turma, onMudar: turma => setF({ turma }) },
          { chave: "curso", rotulo: "Curso", vazio: "Curso: todos", opcoes: cursos.selecao, valor: f.curso, onMudar: curso => setF({ curso }) },
        ]}
        ativos={ativos}
        onLimpar={limpar}
        extra={<Botao variante="secundario" disabled={!dados} onClick={exportar}>Exportar Excel</Botao>}
      />
      {erro ? <ErroCarregar erro={erro} onTentar={recarregar} /> : null}
      {!dados && aCarregar && <Esqueleto linhas={6} altura="h-10" />}
      {dados && (
        <>
          <KpiFaixa rotulo="Resumo do inquérito">
            <Kpi rotulo="Turmas" valor={dados.resumo.turmas} />
            <Kpi rotulo="Destinatários" valor={dados.resumo.destinatarios} />
            <Kpi rotulo="Respostas" valor={dados.resumo.respostas} />
            <Kpi rotulo="Taxa de resposta" valor={dados.resumo.taxa == null ? "—" : `${dados.resumo.taxa} %`} />
          </KpiFaixa>
          <Cartao titulo="Por turma" semPadding>
            <Tabela
              rotulo="Respostas por turma"
              linhas={dados.turmas}
              colunas={colunas}
              chave={t => `${t.turmaId ?? "x"}:${t.turma}`}
              vazio={
                <Vazio
                  compacto
                  titulo={ativos ? "Sem envios com estes filtros." : "Ainda não foi enviado a nenhuma turma."}
                  descricao={ativos ? undefined : "Envie a partir da turma (separador Avaliação) ou partilhe a ligação pública."}
                />
              }
            />
          </Cartao>
          <section aria-label="Resumo por pergunta" className="grid gap-4 xl:grid-cols-2">
            {dados.perguntas.length === 0 && (
              <Vazio compacto titulo={definicao && definicao.perguntas?.length ? "Ainda sem respostas." : "Este inquérito não tem perguntas."} />
            )}
            {dados.perguntas.map((p, i) => <ResumoPerguntaCartao key={p.id} n={i + 1} p={p} />)}
          </section>
        </>
      )}
    </div>
  );
}

function ResumoPerguntaCartao({ n, p }: { n: number; p: ResumoPergunta }) {
  const cabecalho = `${n}. ${p.texto || "Pergunta"}`;
  const sub = `${rotuloTipo(p.tipo)} · ${num(p.n)} ${p.n === 1 ? "resposta" : "respostas"}`;
  if (p.tipo === "escala") {
    return (
      <Cartao titulo={cabecalho} subtitulo={sub} acoes={<span className="text-2xl font-semibold tabular-nums text-tinta">{p.media ?? "—"}</span>}>
        <BarrasHorizontais
          rotulo={`Distribuição: ${p.texto}`}
          larguraRotulo={56}
          itens={[1, 2, 3, 4, 5].map(v => ({ rotulo: String(v), valor: p.distribuicao[String(v)] ?? 0 }))}
          vazio="Sem respostas."
        />
      </Cartao>
    );
  }
  if (p.tipo === "simnao" || p.tipo === "multipla") {
    return (
      <Cartao titulo={cabecalho} subtitulo={sub} acoes={p.pctSim != null ? <span className="text-2xl font-semibold tabular-nums text-tinta">{p.pctSim} % sim</span> : undefined}>
        <BarrasHorizontais
          rotulo={`Respostas: ${p.texto}`}
          itens={Object.entries(p.contagens).map(([rotulo, valor]) => ({ rotulo, valor })).sort((a, b) => b.valor - a.valor)}
          cor={p.tipo === "simnao" ? "#1F7A4D" : "#9A5B00"}
          vazio="Sem respostas."
        />
      </Cartao>
    );
  }
  return (
    <Cartao titulo={cabecalho} subtitulo={sub}>
      {p.textos.length === 0 ? <p className="text-sm text-tinta-suave">Sem comentários.</p> : (
        <ul className="space-y-2">
          {p.textos.map((t, i) => <li key={i} className="rounded-controlo bg-fundo px-3 py-2 text-sm text-tinta">«{t}»</li>)}
        </ul>
      )}
    </Cartao>
  );
}
