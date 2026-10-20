// Turmas Gold e Financiada: lista com ocupação, sessões, documentos e Dossiê TP. O interior é o cockpit.
import { useState } from "react";
import { apiDtpResumo, apiEnviarInqueritosTurma } from "../../../partilhado/api";
import { apiApagarTurma, apiInscricoesTurma, apiTurmas, type LinhaTurma, type Regime } from "../../../partilhado/api/turmas";
import { useAuth } from "../../../partilhado/AuthGate";
import { useAccao } from "../../../partilhado/dados/useAccao";
import { useOpcoes } from "../../../partilhado/dados/useOpcoes";
import { invalidar, useRecurso } from "../../../partilhado/dados/useRecurso";
import { toastError, toastOk } from "../../../partilhado/toastBus";
import {
  Botao, Cartao, ConfirmarPerigo, ErroCarregar, Estado, Filtros, PageHeader, Paginacao, PainelLateral, Separadores, Tabela, TOM_CLASSES,
  cx, data, num, useFiltrosUrl, type Coluna,
} from "../../../partilhado/ui";
import { TurmaRegrasPanel } from "../../TurmaRegrasPanel";
import { ProcessarApoios } from "../formandos/apoios/ProcessarApoios";
import { RegrasApoios } from "../formandos/apoios/RegrasApoios";
import type { Separador as SeparadorCockpit } from "../../rotasGesforma";
import type { VistaProps } from "../../shell/tipos";
import { MenuLinha, type AcaoMenu } from "./MenuLinha";
import { TurmaFormulario } from "./TurmaFormulario";
import { BARRA, FASES, FASE_ESTADO, alertasDaTurma, tomOcupacao } from "./turmasUi";
import { rotuloCodigoCurso } from "../../../partilhado/codigoCurso";

const PADRAO = { fase: "", q: "", curso: "", local: "", horario: "", formador: "", financiador: "", de: "", ate: "", ordem: "", pagina: "1" };
const POR_PAGINA = 25;

export default function Turmas({ view, navigate }: VistaProps) {
  const regime: Regime = view === "fin-turmas" ? "fin" : "gold";
  const fin = regime === "fin";
  const { user, pode } = useAuth();
  const formador = user.role === "formador";
  const gerir = !formador && pode(fin ? "turmasFin.gerir" : "turmas.gerir");
  const [f, setF, limpar] = useFiltrosUrl(PADRAO);
  const [form, setForm] = useState<{ id: number | null } | null>(null);
  const [apagar, setApagar] = useState<LinhaTurma | null>(null);
  const [regras, setRegras] = useState(false);
  const [apoios, setApoios] = useState<LinhaTurma | null>(null);
  const [regrasApoios, setRegrasApoios] = useState(false);

  const pedido = { regime, ...f, pagina: Number(f.pagina) || 1, porPagina: POR_PAGINA };
  const lista = useRecurso(`turmas:${regime}:${JSON.stringify(pedido)}`, s => apiTurmas(pedido, s));
  const dtp = useRecurso(formador ? null : `dtp:pct:${regime}`, () => apiDtpResumo(regime));
  const cursos = useOpcoes("cursos", { regime });
  const locais = useOpcoes("locais", { regime });
  const horarios = useOpcoes("horarios", { regime });
  const formadores = useOpcoes("formadores", { regime });
  const financiadores = useOpcoes("financiadores");

  const depoisDeGravar = () => {
    invalidar("turmas:");
    invalidar("opcoes:turmas");
    invalidar("turma:");
  };
  const inscricoes = useAccao((t: LinhaTurma) => apiInscricoesTurma(regime, t.id, !t.inscricoesAbertas), {
    ok: "Inscrições actualizadas.",
  });
  const inqueritos = useAccao((t: LinhaTurma) => apiEnviarInqueritosTurma(regime, t.id), {
    ok: r => `Inquéritos enviados a ${r.enviados} formando(s)${r.semEmail ? ` · ${r.semEmail} sem email` : ""}.`,
  });

  const cockpit = (t: LinhaTurma, tab: SeparadorCockpit = "overview") =>
    navigate({ view: fin ? "fin-cockpit-turma" : "gold-cockpit-turma", turmaId: t.id, tab });

  function acoes(t: LinhaTurma): AcaoMenu[] {
    const out: AcaoMenu[] = [{ rotulo: "Abrir turma", onClick: () => cockpit(t) }];
    if (fin) out.push({ rotulo: "Presenças e sessões", onClick: () => cockpit(t, "sessoes") });
    else out.push({ rotulo: "Cronograma", onClick: () => cockpit(t, "cronograma") });
    if (formador) return out;
    out.push({ rotulo: "Dossiê TP", onClick: () => cockpit(t, "dtp") });
    out.push({ rotulo: "Enviar inquéritos", onClick: () => void inqueritos.correr(t) });
    if (gerir) {
      out.push({
        rotulo: t.inscricoesAbertas ? "Fechar inscrições" : "Abrir inscrições",
        desativado: t.fase === "fechada" || t.fase === "cancelada",
        onClick: () => void inscricoes.correr(t).then(r => r && depoisDeGravar()),
      });
      if (fin) out.push({ rotulo: "Processar apoios do mês", onClick: () => setApoios(t) });
      out.push({ rotulo: "Editar", onClick: () => setForm({ id: t.id }) });
      out.push({ rotulo: "Eliminar", perigo: true, onClick: () => setApagar(t) });
    }
    return out;
  }

  const resumo = lista.dados?.resumo;
  const linhas = lista.dados?.linhas ?? [];
  const pct = (t: LinhaTurma) => dtp.dados?.pct[String(t.id)];
  const filtrosAtivos = ["q", "curso", "local", "horario", "formador", "financiador", "de", "ate"].filter(k => f[k as keyof typeof f]).length;

  const colunas: Coluna<LinhaTurma>[] = [
    {
      id: "nome", titulo: "Turma", ordenavel: true, principal: true,
      celula: t => (
        <div className="min-w-0">
          <p className="m-0 font-semibold text-tinta truncate">{t.nome}</p>
          <p className="m-0 text-xs text-tinta-suave truncate">{fin && t.ufcd ? `${rotuloCodigoCurso(t.ufcd)} · ` : ""}{t.curso}</p>
        </div>
      ),
    },
    {
      id: "local", titulo: "Local e horário", esconderMovel: true,
      celula: t => <div className="text-[13px]"><p className="m-0">{t.local || "—"}</p><p className="m-0 text-xs text-tinta-suave">{t.horario || "Horário por definir"}</p></div>,
    },
    {
      id: "inicio", titulo: "Datas", ordenavel: true,
      celula: t => (
        <div className="num text-[13px] whitespace-nowrap">
          <p className="m-0">{data(t.dataInicio)}{t.dataFim && t.dataFim !== t.dataInicio ? ` – ${data(t.dataFim)}` : ""}</p>
          <p className="m-0 text-xs text-tinta-suave">{num(t.horas)} h · {t.realizadas}/{t.sessoes} sessões</p>
        </div>
      ),
    },
    {
      id: "formador", titulo: "Formador", esconderMovel: true,
      celula: t => <span className="text-[13px]">{t.formador || "—"}{t.formadores.length ? <span className="text-tinta-suave"> +{t.formadores.length}</span> : null}</span>,
    },
    {
      id: "ocupacao", titulo: fin ? "Inscritos / elegíveis" : "Ocupação", ordenavel: true,
      celula: t => {
        const ocupadas = t.inscritos + t.reservas;
        const tom = tomOcupacao(ocupadas, t.capacidade);
        const largura = t.capacidade > 0 ? Math.min(100, Math.round((ocupadas / t.capacidade) * 100)) : 0;
        return (
          <div className="num min-w-[130px]">
            <div className="flex items-center gap-2">
              <span className="relative flex-1 h-1.5 rounded-full bg-linha-suave overflow-hidden" aria-hidden="true">
                <span className={cx("absolute inset-y-0 left-0 rounded-full", BARRA[tom])} style={{ width: `${largura}%` }} />
              </span>
              <span className="text-[13px] font-semibold">{ocupadas}/{t.capacidade}</span>
            </div>
            <p className="m-0 mt-0.5 text-xs text-tinta-suave">
              {fin ? `${t.docsCompletos} com documentos completos` : t.livres > 0 ? `${t.livres} vagas livres${t.reservas ? ` · ${t.reservas} reservas` : ""}` : "Sem vagas"}
            </p>
          </div>
        );
      },
    },
    {
      id: "fase", titulo: "Estado",
      celula: t => (
        <div className="space-y-1">
          <Estado tom={FASE_ESTADO[t.fase].tom}>{FASE_ESTADO[t.fase].rotulo}</Estado>
          <p className="m-0 text-xs text-tinta-suave">{t.inscricoesAbertas ? "Inscrições abertas" : "Inscrições fechadas"}{fin && t.financiador ? ` · ${t.financiador}` : ""}</p>
        </div>
      ),
    },
    {
      id: "alertas", titulo: "Alertas", esconderMovel: true,
      celula: t => {
        const al = alertasDaTurma(t, regime, pct(t));
        if (!al.length) return <span className="text-xs text-sucesso">Sem pendentes</span>;
        return (
          <ul className="m-0 p-0 list-none space-y-0.5">
            {al.slice(0, 2).map(a => <li key={a.texto} className={cx("text-xs", TOM_CLASSES[a.tom].texto)}>{a.texto}</li>)}
            {al.length > 2 && <li className="text-xs text-tinta-suave">+{al.length - 2} alertas</li>}
          </ul>
        );
      },
    },
  ];

  const fases = FASES.filter(x => !x.so || x.so === regime).map(x => ({
    id: x.id || "todas",
    rotulo: x.rotulo,
    contagem: x.id ? resumo?.porFase[x.id] ?? 0 : resumo?.total,
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        trilho={[{ rotulo: fin ? "Financiada" : "Gold", onClick: () => navigate(fin ? "fin-painel" : "gold-painel") }, { rotulo: "Turmas" }]}
        titulo={fin ? "Turmas financiadas" : "Turmas Gold"}
        subtitulo={resumo
          ? `${num(resumo.total)} turmas · ${num(resumo.porFase.decorrer ?? 0)} a decorrer · ${num(resumo.inscricoesAbertas)} com inscrições abertas · ${num(resumo.vagasLivres)} vagas livres`
          : "A carregar…"}
        acoes={gerir && (
          <>
            <Botao variante="secundario" onClick={() => setRegras(v => !v)} aria-expanded={regras}>Abertura automática</Botao>
            {fin && <Botao variante="secundario" onClick={() => setRegrasApoios(true)}>Regras dos apoios</Botao>}
            <Botao variante="primario" onClick={() => setForm({ id: null })}>Nova turma</Botao>
          </>
        )}
      />

      {gerir && regras && (
        <TurmaRegrasPanel
          regime={regime}
          cursos={cursos.opcoes.map(o => o.valor)}
          locais={locais.opcoes.map(o => o.valor)}
          horarios={horarios.opcoes.map(o => o.valor)}
          onApplied={depoisDeGravar}
        />
      )}

      <Separadores
        estilo="pilula"
        rotulo="Estado das turmas"
        itens={fases}
        ativo={f.fase || "todas"}
        onMudar={id => setF({ fase: id === "todas" ? "" : id })}
      />

      <Filtros
        pesquisa={{ valor: f.q, onMudar: q => setF({ q }), placeholder: fin ? "Pesquisar por turma, UFCD, curso ou formador" : "Pesquisar por turma, curso ou formador" }}
        selecoes={[
          { chave: "curso", rotulo: fin ? "Curso / UFCD" : "Curso", opcoes: cursos.selecao, valor: f.curso, onMudar: curso => setF({ curso }) },
          ...(fin ? [{ chave: "financiador", rotulo: "Financiador", opcoes: financiadores.selecao, valor: f.financiador, onMudar: (financiador: string) => setF({ financiador }) }] : []),
          { chave: "local", rotulo: "Local", opcoes: locais.selecao, valor: f.local, onMudar: local => setF({ local }) },
          { chave: "horario", rotulo: "Horário", opcoes: horarios.selecao, valor: f.horario, onMudar: horario => setF({ horario }) },
          ...(formador ? [] : [{ chave: "formador", rotulo: "Formador", opcoes: formadores.selecao, valor: f.formador, onMudar: (v: string) => setF({ formador: v }) }]),
        ]}
        periodo={{ de: f.de, ate: f.ate, onMudar: (de, ate) => setF({ de, ate }) }}
        ativos={filtrosAtivos}
        onLimpar={limpar}
      />

      <Cartao semPadding>
        {lista.erro && !lista.dados ? (
          <ErroCarregar erro={lista.erro} onTentar={lista.recarregar} className="m-4" />
        ) : (
          <Tabela
            rotulo={fin ? "Turmas financiadas" : "Turmas Gold"}
            linhas={linhas}
            colunas={colunas}
            chave={t => t.id}
            ordem={f.ordem}
            onOrdenar={ordem => setF({ ordem })}
            onLinha={t => cockpit(t)}
            aCarregar={lista.aCarregar && !lista.dados}
            acoesLinha={t => <MenuLinha rotulo={`Mais ações para ${t.nome}`} acoes={acoes(t)} />}
            vazio={filtrosAtivos || f.fase
              ? <span>Nenhuma turma com estes filtros. <Botao variante="ligacao" onClick={limpar}>Limpar filtros</Botao></span>
              : <span>Ainda não há turmas{gerir ? ". Crie a primeira com «Nova turma»." : "."}</span>}
          />
        )}
        {lista.dados && lista.dados.total > POR_PAGINA && (
          <div className="border-t border-linha px-4 py-3">
            <Paginacao pagina={lista.dados.pagina} porPagina={lista.dados.porPagina} total={lista.dados.total} onMudar={p => setF({ pagina: String(p) })} />
          </div>
        )}
      </Cartao>
      <p className="text-xs text-tinta-suave">
        {fin
          ? "Documentos completos: formandos com todos os documentos obrigatórios validados. A ocupação conta formandos e reservas."
          : "A ocupação conta formandos e pré-inscrições validadas que reservam vaga."}
      </p>

      <TurmaFormulario
        regime={regime}
        turmaId={form?.id ?? null}
        aberto={Boolean(form)}
        onFechar={() => setForm(null)}
        onGuardado={() => { setForm(null); depoisDeGravar(); }}
      />
      {fin && <ProcessarApoios turma={apoios} aberto={Boolean(apoios)} onFechar={() => setApoios(null)} />}
      {fin && (
        <PainelLateral aberto={regrasApoios} onFechar={() => setRegrasApoios(false)} largura={760} titulo="Regras dos apoios" subtitulo="Financiada">
          <RegrasApoios podeEditar={gerir} />
        </PainelLateral>
      )}
      <ConfirmarPerigo
        aberto={Boolean(apagar)}
        onFechar={() => setApagar(null)}
        titulo={fin ? "Eliminar turma financiada" : "Eliminar turma Gold"}
        descricao={apagar ? `A turma ${apagar.nome} deixa de estar acessível, com o cronograma e o dossiê. Se a turma já tem formandos, feche as inscrições em vez de a eliminar.` : ""}
        confirmarTexto={apagar?.nome}
        onConfirmar={async () => {
          if (!apagar) return;
          try {
            await apiApagarTurma(regime, apagar.id);
            toastOk("Turma eliminada.");
            depoisDeGravar();
          } catch (e) {
            toastError(e, "Não foi possível eliminar a turma.");
          }
        }}
      />
    </div>
  );
}
