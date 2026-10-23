// Dossiê TP (vista geral): matriz turma × secção do dossiê, o que falta em cada turma e exportação ZIP.
import { useMemo, useState } from "react";
import { data as fmtDataUi } from "../../../partilhado/ui/formatos";
import { apiExportarDtp, apiMatrizDtp, type Regime, type TurmaDtp } from "../../../partilhado/api/dtp";
import { useOpcoes } from "../../../partilhado/dados/useOpcoes";
import { useRecurso } from "../../../partilhado/dados/useRecurso";
import { toastError, toastOk } from "../../../partilhado/toastBus";
import {
  Botao, Cartao, ErroCarregar, Filtros, PageHeader, Separadores, Tabela, Vazio, num, useFiltrosUrl, type Coluna,
} from "../../../partilhado/ui";
import type { VistaProps } from "../../shell/tipos";
import { CelulaSeccao, LegendaDtp, PainelTurmaDtp, BarraPct } from "./partes";

type Vista = "abertas" | "bloqueantes" | "todas";

export default function Dossie({ view, navigate }: VistaProps) {
  const regime: Regime = view === "fin-dtp" ? "fin" : "gold";
  const [f, setF, limpar] = useFiltrosUrl({ vista: "abertas", q: "", curso: "", financiador: "" });
  const { dados, erro, aCarregar, recarregar } = useRecurso(`dtp:matriz:${regime}`, signal => apiMatrizDtp(regime, signal));
  const cursos = useOpcoes("cursos", { regime });
  const [aberta, setAberta] = useState<TurmaDtp | null>(null);
  const [selecionadas, setSelecionadas] = useState<Set<string | number>>(new Set());
  const [aExportar, setAExportar] = useState(false);

  const turmas = dados?.turmas ?? [];
  const contagem = {
    abertas: turmas.filter(t => !t.fechada).length,
    // Turmas abertas com bloqueantes: o mesmo âmbito da tarefa «Dossiês TP com bloqueantes» do painel.
    bloqueantes: turmas.filter(t => !t.fechada && t.bloqueantes > 0).length,
    todas: turmas.length,
  };
  const financiadores = useMemo(
    () => [...new Set(turmas.map(t => t.financiador).filter(Boolean))].sort().map(v => ({ valor: v, rotulo: v })),
    [turmas],
  );
  const q = f.q.trim().toLowerCase();
  const linhas = turmas.filter(t => {
    if (f.vista === "abertas" && t.fechada) return false;
    if (f.vista === "bloqueantes" && (t.fechada || t.bloqueantes === 0)) return false;
    if (f.curso && t.curso !== f.curso) return false;
    if (f.financiador && t.financiador !== f.financiador) return false;
    return !q || `${t.nome} ${t.curso}`.toLowerCase().includes(q);
  });
  const media = linhas.length ? Math.round(linhas.reduce((s, t) => s + t.pct, 0) / linhas.length) : 0;

  async function exportar(lista: TurmaDtp[]) {
    setAExportar(true);
    try {
      for (const t of lista) await apiExportarDtp(regime, t.id, t.nome);
      toastOk(lista.length === 1 ? "Dossiê exportado." : `${lista.length} dossiês exportados.`);
    } catch (e) {
      toastError(e, "Não foi possível exportar o dossiê.");
    } finally {
      setAExportar(false);
    }
  }

  const abrirTurma = (id: number) => navigate({ view: regime === "fin" ? "fin-cockpit-turma" : "gold-cockpit-turma", turmaId: id, tab: "dtp" });
  const seccoes = dados?.seccoes ?? [];
  const colunas: Coluna<TurmaDtp>[] = [
    {
      id: "turma", titulo: "Turma", principal: true,
      celula: t => (
        <span className="block min-w-0">
          <span className="block font-semibold text-tinta truncate">{t.nome}</span>
          <span className="block text-xs text-tinta-suave truncate">{[t.curso, t.inicio && `início ${fmtDataUi(t.inicio)}`, t.financiador].filter(Boolean).join(" · ")}</span>
        </span>
      ),
    },
    ...seccoes.map((s, i): Coluna<TurmaDtp> => ({
      id: `s-${s.id}`,
      titulo: <abbr title={s.label} className="no-underline">{regime === "fin" ? s.id : String(i + 1).padStart(2, "0")}</abbr>,
      alinhar: "centro",
      esconderMovel: true,
      celula: t => <CelulaSeccao celula={t.celulas.find(c => c.seccao === s.id)} rotulo={s.label} />,
    })),
    { id: "pct", titulo: "Completo", alinhar: "dir", celula: t => <BarraPct pct={t.pct} /> },
    {
      id: "bloq", titulo: "Bloqueantes", alinhar: "dir",
      celula: t => t.bloqueantes ? <span className="font-semibold text-perigo">{t.bloqueantes}</span> : <span className="text-tinta-suave">0</span>,
    },
  ];

  const escolhidas = turmas.filter(t => selecionadas.has(t.id));
  const ativos = [f.q, f.curso, f.financiador].filter(Boolean).length;

  return (
    <div className="space-y-5">
      <PageHeader
        trilho={[{ rotulo: regime === "fin" ? "Financiada" : "Gold" }, { rotulo: "Dossiê TP" }]}
        titulo="Dossiê técnico-pedagógico"
        subtitulo={dados
          ? `${num(linhas.length)} turmas · ${num(contagem.bloqueantes)} com bloqueantes · média ${media} % completo`
          : "Estado do dossiê de cada turma, por secção."}
        acoes={
          <Botao variante="secundario" disabled={!escolhidas.length} aCarregar={aExportar} onClick={() => void exportar(escolhidas)}>
            {escolhidas.length ? `Exportar ${escolhidas.length} em ZIP` : "Exportar em ZIP"}
          </Botao>
        }
      />
      <Separadores<Vista>
        rotulo="Turmas a mostrar"
        estilo="pilula"
        ativo={(f.vista as Vista) || "abertas"}
        onMudar={vista => setF({ vista })}
        itens={[
          { id: "abertas", rotulo: "Em curso e a abrir", contagem: contagem.abertas },
          { id: "bloqueantes", rotulo: "Com bloqueantes", contagem: contagem.bloqueantes },
          { id: "todas", rotulo: "Todas", contagem: contagem.todas },
        ]}
      />
      <Filtros
        pesquisa={{ valor: f.q, onMudar: v => setF({ q: v }), placeholder: "Turma ou curso…", rotulo: "Pesquisar turmas" }}
        selecoes={[
          { chave: "curso", rotulo: "Curso", vazio: "Curso: todos", opcoes: cursos.selecao, valor: f.curso, onMudar: curso => setF({ curso }) },
          ...(regime === "fin" ? [{ chave: "financiador", rotulo: "Financiador", vazio: "Financiador: todos", opcoes: financiadores, valor: f.financiador, onMudar: (financiador: string) => setF({ financiador }) }] : []),
        ]}
        ativos={ativos}
        onLimpar={limpar}
      />
      {erro ? <ErroCarregar erro={erro} onTentar={recarregar} /> : null}
      <Cartao semPadding>
        <Tabela
          rotulo="Dossiê por turma"
          linhas={linhas}
          colunas={colunas}
          chave={t => t.id}
          onLinha={t => setAberta(t)}
          linhaAtiva={aberta?.id ?? null}
          selecao={{ selecionados: selecionadas, onMudar: setSelecionadas }}
          aCarregar={aCarregar && !dados}
          vazio={
            <Vazio
              titulo={turmas.length ? "Nenhuma turma com estes filtros." : "Ainda não há turmas neste regime."}
              descricao={turmas.length ? undefined : "O dossiê de cada turma aparece aqui assim que a turma é criada."}
              acao={turmas.length && (ativos || f.vista !== "todas") ? <Botao onClick={() => { limpar(); setF({ vista: "todas" }); }}>Ver todas</Botao> : undefined}
            />
          }
        />
      </Cartao>
      {seccoes.length > 0 && <LegendaDtp seccoes={seccoes} regime={regime} />}
      <PainelTurmaDtp
        turma={aberta}
        seccoes={seccoes}
        aExportar={aExportar}
        onFechar={() => setAberta(null)}
        onAbrir={abrirTurma}
        onExportar={t => void exportar([t])}
      />
    </div>
  );
}
