// Painéis do cockpit Financiada: editar a turma, inscrever formandos, transferir e eliminar.
import { useEffect, useMemo, useState } from "react";
import { apiAlterarFormandoFin } from "../../../../partilhado/api/formandos";
import type { DadosTurma } from "../../../../partilhado/api/turmas";
import { useCursosRef, useOpcoesFormador } from "../../../../partilhado/dados/comuns";
import { useOpcoes } from "../../../../partilhado/dados/useOpcoes";
import { useLocaisOptsDoCurso } from "../../../../partilhado/cursoLocais";
import { SearchSelect } from "../../../../partilhado/FormKit";
import { toastError } from "../../../../partilhado/toastBus";
import type { FormandoFin } from "../../../../partilhado/tiposFormando";
import { lugaresLivres, type TurmaFin } from "../../../../partilhado/turmaModel";
import { Botao, Campo, ConfirmarPerigo, Entrada, Modal } from "../../../../partilhado/ui";
import { darAcessoManual } from "../../../InscricaoManual";
import { splitNome, TransferirTurmaModal } from "./base";
import { InscreverFormandoPanel } from "../../../TurmaInscricao";
import { TurmaInactivaBanner } from "../../../TurmaCronograma";
import { inscreverNaTurma, recarregarTurma, retirarDaTurma, useLeadsDoCurso, useOutrasTurmas } from "./dados";
import { rotuloCodigoCurso } from "../../../../partilhado/codigoCurso";

export function EditarTurmaFin({ aberto, onFechar, turma, onGravar }: {
  aberto: boolean; onFechar: () => void; turma: TurmaFin; onGravar: (p: Partial<DadosTurma>) => void;
}) {
  const [f, setF] = useState({ nome: "", curso: "", formador: "", local: "", inicio: "", vagas: 20, tolerancia: 0 });
  useEffect(() => {
    if (!aberto) return;
    setF({ nome: turma.nome, curso: turma.curso, formador: turma.formador, local: turma.local, inicio: turma.dataInicio, vagas: turma.alunosTotal, tolerancia: turma.toleranciaVagas ?? 0 });
  }, [aberto, turma]);
  const cursosRef = useCursosRef("fin");
  const cursos = useOpcoes("cursos", { regime: "fin" });
  const opCursos = useMemo(() => cursos.opcoes.map(o => ({ value: o.valor, sub: o.extra?.ufcdCod ? `${rotuloCodigoCurso(String(o.extra.ufcdCod))}` : undefined })), [cursos.opcoes]);
  const locais = useLocaisOptsDoCurso("fin", cursosRef, f.curso);
  const opFormadores = useOpcoesFormador(f.formador, "fin");

  function gravar() {
    onGravar({
      nome: f.nome.trim() || turma.nome, curso: f.curso, formador: f.formador, local: f.local, dataInicio: f.inicio,
      alunosTotal: f.vagas, toleranciaVagas: f.tolerancia,
    });
    onFechar();
  }

  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo={`Editar ${turma.nome}`} subtitulo="Dados da turma financiada" largura="lg"
      rodape={<div className="flex gap-2 justify-end"><Botao variante="secundario" onClick={onFechar}>Cancelar</Botao><Botao variante="primario" onClick={gravar}>Guardar</Botao></div>}>
      <div className="space-y-4">
        <Campo rotulo="Código da turma">{p => <Entrada {...p} value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })} />}</Campo>
        <div>
          <p className="m-0 mb-1.5 text-[13px] font-semibold text-tinta">Curso / UFCD</p>
          <SearchSelect value={f.curso} options={opCursos} placeholder="Pesquisar UFCD…"
            onChange={v => setF(prev => ({ ...prev, curso: v, local: locais.locaisFor(v).includes(prev.local) ? prev.local : "" }))} />
        </div>
        <div>
          <p className="m-0 mb-1.5 text-[13px] font-semibold text-tinta">Formador</p>
          <SearchSelect value={f.formador} onChange={v => setF({ ...f, formador: v })} options={opFormadores} placeholder="Pesquisar formador…" />
        </div>
        <div>
          <p className="m-0 mb-1.5 text-[13px] font-semibold text-tinta">Local</p>
          <SearchSelect value={f.local} onChange={v => setF({ ...f, local: v })} options={locais.options} disabled={locais.disabled}
            placeholder={locais.placeholder} empty={locais.empty} />
        </div>
        <Campo rotulo="Data de início">{p => <Entrada {...p} type="date" value={f.inicio} onChange={e => setF({ ...f, inicio: e.target.value })} />}</Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Vagas">{p => <Entrada {...p} type="number" min={1} value={f.vagas} onChange={e => setF({ ...f, vagas: Math.max(1, Number(e.target.value) || 0) })} />}</Campo>
          <Campo rotulo="Tolerância de vagas" ajuda="Lugares extra para overbooking.">
            {p => <Entrada {...p} type="number" min={0} value={f.tolerancia} onChange={e => setF({ ...f, tolerancia: Math.max(0, Number(e.target.value) || 0) })} />}
          </Campo>
        </div>
      </div>
    </Modal>
  );
}

export function InscreverFin({ aberto, onFechar, turma, activa, membros, onActivar }: {
  aberto: boolean; onFechar: () => void; turma: TurmaFin; activa: boolean; membros: FormandoFin[]; onActivar: () => void;
}) {
  const { leads } = useLeadsDoCurso("fin", turma.curso, aberto);
  const vagas = Math.max(0, lugaresLivres(turma));
  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Inscrever formando" subtitulo={`${turma.curso} · ${turma.local} · ${turma.horario}`} largura="lg">
      {activa ? (
        <InscreverFormandoPanel
          turma={turma}
          leads={leads}
          emailsInscritos={membros.map(f => f.email)}
          vagasLivres={vagas}
          accent="fin"
          onCancel={onFechar}
          onInscreverLead={async lead => {
            if (vagas <= 0) return;
            await inscreverNaTurma("fin", turma, { nome: lead.nome, apelido: lead.apelido || "-", email: lead.email, telf: lead.telf || "" });
          }}
          onInscreverManual={async dados => {
            if (vagas <= 0) return;
            const { nome, apelido } = splitNome(dados.nome);
            const id = await inscreverNaTurma("fin", turma, { nome, apelido: apelido || "-", email: dados.email, telf: dados.telf || "" });
            if (id && dados.opcoes.criarAcesso) await darAcessoManual("fin", id);
          }}
        />
      ) : (
        <TurmaInactivaBanner nome={turma.nome} onActivate={onActivar} />
      )}
    </Modal>
  );
}

export function TransferirEEliminarFin({ turma, transferir, eliminar, onFechar }: {
  turma: TurmaFin; transferir: FormandoFin | null; eliminar: FormandoFin | null; onFechar: () => void;
}) {
  const outras = useOutrasTurmas("fin", turma.id, Boolean(transferir));
  const destinos = outras.map(t => ({
    id: t.id, nome: t.nome, curso: t.curso, horario: t.horario, local: t.local,
    ocupadas: t.inscritos + t.reservas, vagas: t.capacidade, toleranciaVagas: t.tolerancia, activa: t.inscricoesAbertas,
  }));
  return (
    <>
      <TransferirTurmaModal
        open={!!transferir}
        onClose={onFechar}
        accent="fin"
        nome={transferir ? `${transferir.nome} ${transferir.apelido}` : ""}
        turmaAtual={turma.nome}
        destinos={destinos}
        onTransfer={async dest => {
          if (!transferir) return;
          try {
            await apiAlterarFormandoFin(transferir.id, { turmaId: dest.id, curso: dest.curso });
            recarregarTurma("fin", turma.id);
            recarregarTurma("fin", dest.id);
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
        onConfirmar={async () => { if (eliminar) await retirarDaTurma("fin", turma.id, eliminar.id); }}
      />
    </>
  );
}
