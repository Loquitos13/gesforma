// Painéis do cockpit Gold: editar a turma, inscrever formandos, transferir e eliminar.
import { useEffect, useMemo, useState } from "react";
import { apiAlterarFormandoGold } from "../../../../partilhado/api/formandos";
import { useCursosRef, useOpcoesFormador } from "../../../../partilhado/dados/comuns";
import { useOpcoes } from "../../../../partilhado/dados/useOpcoes";
import { useLocaisOptsDoCurso } from "../../../../partilhado/cursoLocais";
import { SearchSelect } from "../../../../partilhado/FormKit";
import { toastError } from "../../../../partilhado/toastBus";
import type { FormandoTurma } from "../../../../partilhado/tiposFormando";
import { lugaresLivres, type TurmaGold } from "../../../../partilhado/turmaModel";
import { Botao, Campo, ConfirmarPerigo, Entrada, PainelLateral } from "../../../../partilhado/ui";
import type { DadosTurma } from "../../../../partilhado/api/turmas";
import { darAcessoManual, pagamentoDaFicha } from "../../../InscricaoManual";
import { splitNome, TransferirTurmaModal } from "./base";
import { usePlanosCurso } from "../../../planosCurso";
import { InscreverFormandoPanel } from "../../../TurmaInscricao";
import { TurmaInactivaBanner } from "../../../TurmaCronograma";
import { ValoresHoraFormador } from "../../../ValoresHoraFormador";
import { inscreverNaTurma, recarregarTurma, retirarDaTurma, useLeadsDoCurso, useOutrasTurmas } from "./dados";

export function EditarTurmaGold({ aberto, onFechar, turma, onGravar }: {
  aberto: boolean; onFechar: () => void; turma: TurmaGold; onGravar: (p: Partial<DadosTurma>) => void;
}) {
  const [f, setF] = useState({ nome: "", local: "", horario: "", formador: "", inicio: "", vagas: 16, tolerancia: 0, valores: {} as Record<string, number> });
  useEffect(() => {
    if (!aberto) return;
    setF({
      nome: turma.nome, local: turma.local, horario: turma.horario, formador: turma.formador, inicio: turma.dataInicio,
      vagas: turma.vagas, tolerancia: turma.toleranciaVagas ?? 0, valores: turma.valoresHoraFormador ?? {},
    });
  }, [aberto, turma]);
  const cursos = useCursosRef("gold");
  const locais = useLocaisOptsDoCurso("gold", cursos, turma.curso);
  const horarios = useOpcoes("horarios", { regime: "gold" });
  const opHorarios = useMemo(() => horarios.opcoes.map(o => ({ value: o.valor })), [horarios.opcoes]);
  const opFormadores = useOpcoesFormador(f.formador, "gold");
  const modelos = usePlanosCurso("gold", turma.curso);

  function gravar() {
    onGravar({
      nome: f.nome.trim() || turma.nome, local: f.local, horario: f.horario, formador: f.formador, dataInicio: f.inicio,
      vagas: f.vagas, toleranciaVagas: f.tolerancia, valoresHoraFormador: f.valores,
    });
    onFechar();
  }

  return (
    <PainelLateral aberto={aberto} onFechar={onFechar} titulo={`Editar ${turma.nome}`} subtitulo="Dados da turma Gold" largura={560}
      rodape={<div className="flex gap-2 justify-end"><Botao variante="secundario" onClick={onFechar}>Cancelar</Botao><Botao variante="primario" onClick={gravar}>Guardar</Botao></div>}>
      <div className="space-y-4">
        <Campo rotulo="Código interno">{p => <Entrada {...p} value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })} />}</Campo>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="m-0 mb-1.5 text-[13px] font-semibold text-tinta">Local</p>
            <SearchSelect value={f.local} onChange={v => setF({ ...f, local: v })} options={locais.options} disabled={locais.disabled}
              placeholder={locais.placeholder} empty={locais.empty} />
          </div>
          <div>
            <p className="m-0 mb-1.5 text-[13px] font-semibold text-tinta">Horário</p>
            <SearchSelect value={f.horario} onChange={v => setF({ ...f, horario: v })} options={opHorarios}
              empty={horarios.aCarregar ? "A carregar horários…" : "Sem horários em Edição de Cursos › Horários."} />
          </div>
        </div>
        <div>
          <p className="m-0 mb-1.5 text-[13px] font-semibold text-tinta">Formador</p>
          <SearchSelect value={f.formador} onChange={v => setF({ ...f, formador: v })} options={opFormadores} placeholder="Pesquisar formador…" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_7.5rem_1fr] gap-3">
          <Campo rotulo="Data de início">{p => <Entrada {...p} type="date" value={f.inicio} onChange={e => setF({ ...f, inicio: e.target.value })} />}</Campo>
          <Campo rotulo="Vagas">{p => <Entrada {...p} type="number" min={1} value={f.vagas} onChange={e => setF({ ...f, vagas: Number(e.target.value) || 0 })} />}</Campo>
          <Campo rotulo="Tolerância de vagas" ajuda="Lugares extra para overbooking.">
            {p => <Entrada {...p} type="number" min={0} value={f.tolerancia} onChange={e => setF({ ...f, tolerancia: Math.max(0, Number(e.target.value) || 0) })} />}
          </Campo>
        </div>
        <div>
          <p className="m-0 mb-1.5 text-[13px] font-semibold text-tinta">Valor por hora do formador</p>
          <ValoresHoraFormador formadores={[f.formador, ...(turma.formadores ?? [])]} value={f.valores} onChange={v => setF({ ...f, valores: v })} base={modelos.valores} />
        </div>
      </div>
    </PainelLateral>
  );
}

export function InscreverGold({ aberto, onFechar, turma, activa, membros, onActivar }: {
  aberto: boolean; onFechar: () => void; turma: TurmaGold; activa: boolean; membros: FormandoTurma[]; onActivar: () => void;
}) {
  const { leads } = useLeadsDoCurso("gold", turma.curso, aberto);
  const vagas = lugaresLivres(turma);
  return (
    <PainelLateral aberto={aberto} onFechar={onFechar} titulo="Inscrever formando" subtitulo={`${turma.curso} · ${turma.local} · ${turma.horario}`} largura={560}>
      {activa ? (
        <InscreverFormandoPanel
          turma={turma}
          leads={leads}
          emailsInscritos={membros.map(f => f.email)}
          vagasLivres={vagas}
          accent="gold"
          onCancel={onFechar}
          onInscreverLead={async lead => {
            if (vagas <= 0) return;
            await inscreverNaTurma("gold", turma, {
              nome: lead.nome, apelido: lead.apelido || "-", email: lead.email, telf: lead.telf || "",
              pagamento: { pago: lead.estado === "Pago", valor: lead.preco, metodo: lead.pagamentoMetodo || "-" },
            });
          }}
          onInscreverManual={async dados => {
            if (vagas <= 0) return;
            const { nome, apelido } = splitNome(dados.nome);
            const id = await inscreverNaTurma("gold", turma, {
              nome, apelido: apelido || "-", email: dados.email, telf: dados.telf || "", pagamento: pagamentoDaFicha(dados.opcoes),
            });
            if (id && dados.opcoes.criarAcesso) await darAcessoManual("gold", id);
          }}
        />
      ) : (
        <TurmaInactivaBanner nome={turma.nome} onActivate={onActivar} />
      )}
    </PainelLateral>
  );
}

export function TransferirEEliminarGold({ turma, transferir, eliminar, onFechar }: {
  turma: TurmaGold; transferir: FormandoTurma | null; eliminar: FormandoTurma | null; onFechar: () => void;
}) {
  const outras = useOutrasTurmas("gold", turma.id, Boolean(transferir));
  const destinos = outras.map(t => ({
    id: t.id, nome: t.nome, curso: t.curso, horario: t.horario, local: t.local,
    ocupadas: t.inscritos + t.reservas, vagas: t.capacidade, toleranciaVagas: t.tolerancia, activa: t.inscricoesAbertas,
  }));
  return (
    <>
      <TransferirTurmaModal
        open={!!transferir}
        onClose={onFechar}
        nome={transferir ? `${transferir.nome} ${transferir.apelido}` : ""}
        turmaAtual={turma.nome}
        destinos={destinos}
        onTransfer={async dest => {
          if (!transferir) return;
          try {
            await apiAlterarFormandoGold(transferir.id, { turmaId: dest.id });
            recarregarTurma("gold", turma.id);
            recarregarTurma("gold", dest.id);
          } catch (err) {
            toastError(err, "Não foi possível transferir o formando.");
          }
        }}
      />
      <ConfirmarPerigo
        aberto={!!eliminar}
        onFechar={onFechar}
        titulo="Eliminar formando"
        descricao={eliminar ? <>Remover <strong>{eliminar.nome} {eliminar.apelido}</strong> da turma {turma.nome}? Deixa de contar para vagas, presenças e certificados.</> : ""}
        onConfirmar={async () => { if (eliminar) await retirarDaTurma("gold", turma.id, eliminar.id); }}
      />
    </>
  );
}
