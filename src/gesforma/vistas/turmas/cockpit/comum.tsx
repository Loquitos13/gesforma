// Peças partilhadas pelo cockpit Gold e Financiada: estados de carregamento e o painel "Nova sessão".
import { useMemo, useState, type ReactNode } from "react";
import { useProgramaDoCurso } from "../../../cursoPrograma";
import { useFormadoresTodos, useOpcoesFormador, useSessoesNoutrasTurmas } from "../../../../partilhado/dados/comuns";
import { sessaoCabeNoSlot } from "../../../../partilhado/disponibilidade";
import { MultiSearchSelect } from "../../../../partilhado/FormKit";
import { formadorIndisponivel, horaMais } from "../../../../partilhado/sessaoAcesso";
import type { SessaoCronograma } from "../../../../partilhado/turmaModel";
import { Botao, Campo, Entrada, ErroCarregar, Esqueleto, PainelLateral, Vazio } from "../../../../partilhado/ui";

/** Esqueleto, erro ou "turma inexistente" antes de o cockpit ter dados. */
export function EstadoCockpit({ aCarregar, erro, existe, onVoltar, children }: {
  aCarregar: boolean; erro: unknown; existe: boolean; onVoltar: () => void; children: () => ReactNode;
}) {
  if (existe) return <>{children()}</>;
  if (aCarregar) {
    return (
      <div className="space-y-4">
        <div className="rounded-painel bg-nav p-6"><Esqueleto linhas={3} /></div>
        <Esqueleto linhas={6} />
      </div>
    );
  }
  if (erro) return <ErroCarregar erro={erro} onTentar={() => window.location.reload()} />;
  return (
    <Vazio
      titulo="Esta turma não existe ou já foi apagada."
      acao={<Botao variante="secundario" onClick={onVoltar}>Voltar às turmas</Botao>}
    />
  );
}

/** Painel para acrescentar uma sessão ao cronograma da turma. */
export function NovaSessaoPainel({ aberto, onFechar, regime, turma, horaPadrao, duracao, onCriar }: {
  aberto: boolean;
  onFechar: () => void;
  regime: "gold" | "fin";
  turma: { id: number; nome: string; curso: string; formador: string; formadores?: string[]; cronograma: SessaoCronograma[] };
  horaPadrao: string;
  duracao: number;
  onCriar: (sessao: SessaoCronograma) => void;
}) {
  const [formadores, setFormadores] = useState<string[]>(turma.formador ? [turma.formador] : []);
  const [modulos, setModulos] = useState<string[]>([]);
  const [data, setData] = useState("");
  const [hora, setHora] = useState(horaPadrao);
  const programa = useProgramaDoCurso(regime, turma.curso);
  const opcoesBase = useOpcoesFormador(formadores, regime);
  const fichas = useFormadoresTodos();
  const daTurma = useMemo(() => [turma.formador, ...(turma.formadores ?? [])].map(n => n.trim()).filter(Boolean), [turma.formador, turma.formadores]);
  const outras = useSessoesNoutrasTurmas(daTurma.length ? daTurma : opcoesBase.map(o => o.value), { regime, id: turma.id });
  const inicio = hora || horaPadrao;
  const fim = horaMais(inicio, duracao);
  const opcoes = (daTurma.length ? opcoesBase.filter(o => daTurma.includes(o.value)) : opcoesBase).map(o => {
    const ocupado = formadorIndisponivel(o.value, data, inicio, fim, [{ cronograma: turma.cronograma }, ...outras]);
    const ficha = fichas.find(f => f.nome.toLowerCase() === o.value.toLowerCase());
    const fora = regime === "gold" && Boolean(ficha) && !sessaoCabeNoSlot(data, inicio, fim, ficha?.disponibilidade);
    if (!ocupado && !fora) return o;
    return { ...o, disabled: true, sub: fora && !ocupado ? "Fora da disponibilidade CCP" : "Indisponível neste horário" };
  });
  const unidade = programa.unidade;

  function criar() {
    if (!data) return;
    onCriar({ id: `s-manual-${Date.now()}`, data, horaInicio: inicio, horaFim: fim, modulos, formadores });
    setData("");
    setModulos([]);
  }

  return (
    <PainelLateral
      aberto={aberto}
      onFechar={onFechar}
      titulo="Nova sessão"
      subtitulo={turma.nome}
      rodape={(
        <div className="flex gap-2 justify-end">
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao variante="primario" disabled={!data} onClick={criar}>Criar sessão</Botao>
        </div>
      )}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Data">{p => <Entrada {...p} type="date" value={data} onChange={e => setData(e.target.value)} />}</Campo>
          <Campo rotulo="Hora de início">{p => <Entrada {...p} type="time" value={hora} onChange={e => setHora(e.target.value)} />}</Campo>
        </div>
        <div>
          <p className="m-0 mb-1.5 text-[13px] font-semibold text-tinta">Formadores</p>
          <MultiSearchSelect values={formadores} onChange={setFormadores} options={opcoes} placeholder="Pesquisar formador…"
            noneLabel="Selecionar formadores…" unitSingular="formador" unitPlural="formadores" />
        </div>
        <div>
          <p className="m-0 mb-1.5 text-[13px] font-semibold text-tinta">{unidade.plural.charAt(0).toUpperCase() + unidade.plural.slice(1)}</p>
          <MultiSearchSelect values={modulos} onChange={setModulos} options={programa.options}
            placeholder={`Pesquisar ${unidade.singular} do curso…`} noneLabel={`Selecionar ${unidade.plural}…`}
            unitSingular={unidade.singular} unitPlural={unidade.plural} />
        </div>
        <p className="m-0 text-xs text-tinta-suave">A sessão dura {duracao} h. Quem já tem sessão nesse horário noutra turma aparece indisponível.</p>
      </div>
    </PainelLateral>
  );
}
