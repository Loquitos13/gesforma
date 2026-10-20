import { useEffect, useMemo, useRef, useState } from "react";
import { apiAlterarTurma, apiCriarTurma, apiTurmaGravada, type DadosTurma, type Regime } from "../../../partilhado/api/turmas";
import { useCursoFichaLocais } from "../../../partilhado/cursoLocais";
import { useOpcoes } from "../../../partilhado/dados/useOpcoes";
import { useRecurso } from "../../../partilhado/dados/useRecurso";
import { codigoInternoTurma, proximoNomeTurma } from "../../../partilhado/turmaCodigo";
import type { SessaoCronograma } from "../../../partilhado/turmaModel";
import { toastError } from "../../../partilhado/toastBus";
import { Aviso, Botao, Campo, Chip, Entrada, ErroCarregar, Esqueleto, Interruptor, PainelLateral, Selecao } from "../../../partilhado/ui";
import { CronogramaEditor } from "../../CronogramaEditor";
import { ValoresHoraFormador } from "../../ValoresHoraFormador";
import { useAuth } from "../../../partilhado/AuthGate";

type Rascunho = {
  nome: string; curso: string; local: string; horario: string; formador: string; formadores: string[];
  dataInicio: string; vagas: number; tolerancia: number; vagasAnunciadas: number | null; custoHoraSala: number; abertas: boolean; financiador: string;
  numeroAcao: number; valoresHoraFormador: Record<string, number>; cronograma: SessaoCronograma[]; horas: number;
};

const VAZIO = (regime: Regime): Rascunho => ({
  nome: "", curso: "", local: "", horario: "", formador: "", formadores: [], dataInicio: "", vagas: regime === "fin" ? 20 : 16,
  tolerancia: 0, vagasAnunciadas: null, custoHoraSala: 0, abertas: true, financiador: "", numeroAcao: 1, valoresHoraFormador: {}, cronograma: [], horas: 0,
});

/** Painel para criar ou editar uma turma (o interior da turma continua no cockpit). */
export function TurmaFormulario({ regime, turmaId, aberto, onFechar, onGuardado }: {
  regime: Regime;
  /** null = nova turma. */
  turmaId: number | null;
  aberto: boolean;
  onFechar: () => void;
  onGuardado: (id: number) => void;
}) {
  const fin = regime === "fin";
  const editar = turmaId != null;
  const gravada = useRecurso(aberto && editar ? `turma:${regime}:${turmaId}` : null, s => apiTurmaGravada(regime, turmaId!, s));
  const cursos = useOpcoes("cursos", { regime });
  const horarios = useOpcoes("horarios", { regime });
  const locais = useOpcoes("locais", { regime });
  const formadores = useOpcoes("formadores", { regime });
  const financiadores = useOpcoes("financiadores");
  const nomesUsados = useOpcoes("turmas", { regime, todos: true });
  const { byCursoId, loaded: locaisProntos } = useCursoFichaLocais(regime);
  const [r, setR] = useState<Rascunho>(() => VAZIO(regime));
  const verCustos = useAuth().user.role !== "comercial";
  const [erro, setErro] = useState("");
  const [aGravar, setAGravar] = useState(false);
  const nomeManual = useRef(false);

  useEffect(() => {
    if (!aberto) return;
    setErro("");
    if (!editar) {
      nomeManual.current = false;
      setR(VAZIO(regime));
      return;
    }
    const t = gravada.dados?.turma;
    if (!t) return;
    nomeManual.current = true;
    setR({
      nome: t.nome, curso: t.curso, local: t.local, horario: t.horario, formador: t.formador, formadores: t.formadores ?? [],
      dataInicio: t.dataInicio, vagas: (fin ? t.alunosTotal : t.vagas) ?? 0, tolerancia: t.toleranciaVagas ?? 0, vagasAnunciadas: t.vagasAnunciadas ?? null,
      custoHoraSala: t.custoHoraSala ?? 0, abertas: fin ? Boolean(t.activa) : t.estado === "Ativa",
      financiador: t.financiador ?? "", numeroAcao: t.numeroAcao ?? 1, valoresHoraFormador: t.valoresHoraFormador ?? {}, cronograma: t.cronograma ?? [], horas: t.horas,
    });
  }, [aberto, editar, gravada.dados, regime, fin]);

  const cursoId = cursos.opcoes.find(o => o.valor === r.curso)?.id;
  const locaisCurso = cursoId != null ? byCursoId[cursoId] ?? [] : [];
  const opcoesLocal = (locaisCurso.length ? locaisCurso.map(n => ({ valor: n, rotulo: n })) : locais.selecao);
  const codigo = codigoInternoTurma(r.curso, r.local, r.horario, r.dataInicio);

  useEffect(() => {
    if (editar || nomeManual.current || !codigo) return;
    setR(x => ({ ...x, nome: proximoNomeTurma(codigo, nomesUsados.opcoes.map(o => o.valor)) }));
  }, [codigo, editar, nomesUsados.opcoes]);

  const outros = useMemo(() => formadores.selecao.filter(o => o.valor !== r.formador && !r.formadores.includes(o.valor)), [formadores.selecao, r.formador, r.formadores]);
  const mudar = (patch: Partial<Rascunho>) => setR(x => ({ ...x, ...patch }));

  async function guardar() {
    if (!r.curso.trim()) { setErro("Escolha o curso."); return; }
    if (!r.dataInicio) { setErro("Indique a data de início."); return; }
    setErro("");
    const nome = r.nome.trim() || codigo;
    if (!nome) { setErro("Indique o código da turma."); return; }
    const comum: DadosTurma = {
      nome, curso: r.curso, local: r.local, horario: r.horario, dataInicio: r.dataInicio, formador: r.formador,
      formadores: r.formadores, toleranciaVagas: r.tolerancia, vagasAnunciadas: r.vagasAnunciadas, valoresHoraFormador: r.valoresHoraFormador,
      ...(editar ? { cronograma: r.cronograma } : {}),
    };
    const dados: DadosTurma = fin
      ? { ...comum, alunosTotal: r.vagas, activa: r.abertas, financiador: r.financiador.trim(), numeroAcao: Math.max(1, Math.round(r.numeroAcao) || 1) }
      : { ...comum, vagas: r.vagas, custoHoraSala: r.custoHoraSala, estado: r.abertas ? "Ativa" : "Inativa" };
    setAGravar(true);
    try {
      const res = editar ? await apiAlterarTurma(regime, turmaId!, dados) : await apiCriarTurma(regime, dados);
      onGuardado(res.turma.id);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível gravar a turma.");
      toastError(e, "Não foi possível gravar a turma.");
    } finally {
      setAGravar(false);
    }
  }

  const titulo = editar ? `Editar ${gravada.dados?.turma.nome ?? "turma"}` : fin ? "Nova turma financiada" : "Nova turma Gold";
  const aCarregar = editar && !gravada.dados && !gravada.erro;
  return (
    <PainelLateral
      aberto={aberto}
      onFechar={onFechar}
      titulo={titulo}
      subtitulo={fin ? "Curso ou UFCD, local, horário e data de início. Sessões de 3 horas." : "Curso, local, horário e data de início. Só com inscrições abertas aparece no site e no WhatsApp."}
      largura={editar ? 720 : 520}
      rodape={(
        <>
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao variante="primario" onClick={() => void guardar()} aCarregar={aGravar} disabled={aCarregar}>{editar ? "Guardar alterações" : "Criar turma"}</Botao>
        </>
      )}
    >
      {gravada.erro ? <ErroCarregar erro={gravada.erro} onTentar={gravada.recarregar} /> : aCarregar ? <Esqueleto linhas={8} altura="h-9" /> : (
        <div className="space-y-4">
          {erro && <Aviso tom="perigo">{erro}</Aviso>}
          <Interruptor ligado={r.abertas} onMudar={v => mudar({ abertas: v })} rotulo="Inscrições abertas" />
          <Campo rotulo={fin ? "Curso / UFCD" : "Curso"} obrigatorio>
            {p => (
              <Selecao {...p} opcoes={cursos.selecao} vazio="Escolha o curso…" value={r.curso}
                onChange={e => mudar({ curso: e.target.value, local: "" })} />
            )}
          </Campo>
          <Campo rotulo="Código da turma" ajuda={codigo ? `Código interno sugerido: ${codigo}` : "Preencha curso, local, horário e data para sugerir o código."}>
            {p => <Entrada {...p} value={r.nome} onChange={e => { nomeManual.current = true; mudar({ nome: e.target.value }); }} />}
          </Campo>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Campo rotulo="Local" ajuda={r.curso && locaisProntos && !locaisCurso.length ? "Este curso ainda não tem locais na ficha: mostram-se todos." : undefined}>
              {p => <Selecao {...p} opcoes={opcoesLocal} vazio={r.curso ? "Escolha o local…" : "Escolha primeiro o curso"} disabled={!r.curso} value={r.local} onChange={e => mudar({ local: e.target.value })} />}
            </Campo>
            <Campo rotulo={fin ? "Horário (sessões de 3 h)" : "Horário"}>
              {p => <Selecao {...p} opcoes={horarios.selecao} vazio="Escolha o horário…" value={r.horario} onChange={e => mudar({ horario: e.target.value })} />}
            </Campo>
          </div>
          <Campo rotulo="Formador responsável">
            {p => <Selecao {...p} opcoes={formadores.selecao} vazio="A definir" value={r.formador} onChange={e => mudar({ formador: e.target.value })} />}
          </Campo>
          <Campo rotulo="Outros formadores" ajuda="Opcional. Aparecem no cronograma e na distribuição de sessões.">
            {p => (
              <div className="space-y-2">
                {r.formadores.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {r.formadores.map(n => <Chip key={n} onRemover={() => mudar({ formadores: r.formadores.filter(x => x !== n) })}>{n}</Chip>)}
                  </div>
                )}
                <Selecao {...p} opcoes={outros} vazio="Acrescentar formador…" value="" onChange={e => e.target.value && mudar({ formadores: [...r.formadores, e.target.value] })} />
              </div>
            )}
          </Campo>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Campo rotulo="Data de início" obrigatorio>
              {p => <Entrada {...p} type="date" value={r.dataInicio} onChange={e => mudar({ dataInicio: e.target.value })} />}
            </Campo>
            <Campo rotulo="Vagas">
              {p => <Entrada {...p} type="number" min={1} value={r.vagas} onChange={e => mudar({ vagas: Math.max(0, Number(e.target.value) || 0) })} />}
            </Campo>
            <Campo rotulo="Tolerância" ajuda="Lugares extra.">
              {p => <Entrada {...p} type="number" min={0} value={r.tolerancia} onChange={e => mudar({ tolerancia: Math.max(0, Number(e.target.value) || 0) })} />}
            </Campo>
          </div>
          <Campo rotulo="Vagas a anunciar no site" ajuda="O número que o site mostra («X vagas restantes»). Vazio = as vagas reais. Nunca passa das vagas livres.">
            {p => <Entrada {...p} type="number" min={0} className="max-w-[12rem]" value={r.vagasAnunciadas ?? ""} placeholder="as reais"
              onChange={e => mudar({ vagasAnunciadas: e.target.value === "" ? null : Math.max(0, Number(e.target.value) || 0) })} />}
          </Campo>
          {fin && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Campo rotulo="Entidade financiadora" className="sm:col-span-2">
                {p => (
                  <>
                    <Entrada {...p} list="financiadores-turma" value={r.financiador} onChange={e => mudar({ financiador: e.target.value })} />
                    <datalist id="financiadores-turma">{financiadores.opcoes.map(o => <option key={o.valor} value={o.valor} />)}</datalist>
                  </>
                )}
              </Campo>
              <Campo rotulo="Número da ação" ajuda="«… / Ação n» na execução física.">
                {p => <Entrada {...p} type="number" min={1} step={1} value={r.numeroAcao} onChange={e => mudar({ numeroAcao: Math.max(1, Math.round(Number(e.target.value)) || 1) })} />}
              </Campo>
            </div>
          )}
          {verCustos && (
            <Campo rotulo="Valor por hora do formador">
              {() => <ValoresHoraFormador formadores={[r.formador, ...r.formadores]} value={r.valoresHoraFormador} onChange={v => mudar({ valoresHoraFormador: v })} />}
            </Campo>
          )}
          {!fin && (
            <Campo rotulo="Custo hora da sala (€)">
              {p => <Entrada {...p} type="number" min={0} step="0.5" value={r.custoHoraSala} onChange={e => mudar({ custoHoraSala: Math.max(0, Number(e.target.value) || 0) })} />}
            </Campo>
          )}
          {editar ? (
            <CronogramaEditor
              accent={regime}
              sessoes={r.cronograma}
              onChange={c => mudar({ cronograma: c })}
              inicio={r.dataInicio}
              horario={r.horario}
              horas={r.horas}
              formador={r.formador}
              formadoresTurma={r.formadores}
              curso={r.curso}
              nome={r.nome}
              local={r.local}
              identidade={`${regime}-form-${turmaId}`}
            />
          ) : (
            <p className="text-xs text-tinta-suave">O cronograma é gerado a partir das horas do curso e do horário. Ajusta-se depois em Editar ou no cockpit da turma.</p>
          )}
        </div>
      )}
    </PainelLateral>
  );
}
