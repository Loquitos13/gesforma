// Cronograma da turma › «Copiar de outra turma»: traz o cronograma de outra turma do mesmo curso para a nova data de
// início (mesmos intervalos entre dias e mesmas horas), com os planos de sessão e os sumários. Fica editável depois.
import { useEffect, useState } from "react";
import { apiCopiarCronograma, apiOrigensPlanos } from "../partilhado/api/pedagogia";
import { fmtDataCalendario } from "../partilhado/horaLisboa";
import { toastError, toastOk } from "../partilhado/toastBus";
import { Botao, Campo, Entrada, Modal, Selecao } from "../partilhado/ui";

export function CopiarCronograma({ regime, turmaId, inicio, temSessoes, onCopiado }: {
  regime: "gold" | "fin";
  turmaId: number;
  /** A data de início da turma (sugerida para a cópia). */
  inicio: string;
  temSessoes: boolean;
  /** O servidor já gravou: volta-se a ler a turma e as sessões (planos e sumários). */
  onCopiado: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [turmas, setTurmas] = useState<{ id: number; nome: string; dataInicio: string }[] | null>(null);
  const [origem, setOrigem] = useState("");
  const [data, setData] = useState(inicio);
  const [aCorrer, setACorrer] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setData(inicio);
    apiOrigensPlanos(regime, turmaId).then(r => setTurmas(r.turmas)).catch(() => setTurmas([]));
  }, [aberto, regime, turmaId, inicio]);

  async function copiar() {
    if (!origem || !data) return;
    setACorrer(true);
    try {
      const r = await apiCopiarCronograma(regime, turmaId, Number(origem), data);
      onCopiado();
      const sessoes = r.cronograma.length;
      toastOk(`Cronograma copiado: ${sessoes} ${sessoes === 1 ? "evento" : "eventos"} · ${r.importados} ${r.importados === 1 ? "plano" : "planos"}${r.sumarios ? ` · ${r.sumarios} ${r.sumarios === 1 ? "sumário" : "sumários"}` : ""}.`);
      setAberto(false);
    } catch (err) {
      toastError(err, "Não foi possível copiar o cronograma.");
    } finally {
      setACorrer(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} title="Traz o cronograma de outra turma do mesmo curso, com os planos de sessão e os sumários."
        className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
        Copiar de outra turma
      </button>
      <Modal aberto={aberto} onFechar={() => setAberto(false)} largura="sm" titulo="Copiar cronograma de outra turma"
        rodape={<><Botao onClick={() => setAberto(false)}>Cancelar</Botao>
          <Botao variante="primario" aCarregar={aCorrer} disabled={!origem || !data} onClick={() => void copiar()}>Copiar</Botao></>}>
        <div className="flex flex-col gap-3 text-[13px]">
          <Campo rotulo="Turma de onde copiar">
            {p => (
              <Selecao {...p} value={origem} onChange={e => setOrigem(e.target.value)} vazio={turmas === null ? "A carregar…" : turmas.length ? "Escolha a turma" : "Não há outras turmas deste curso"}
                opcoes={(turmas ?? []).map(t => ({ valor: String(t.id), rotulo: `${t.nome}${t.dataInicio ? ` · início ${fmtDataCalendario(t.dataInicio)}` : ""}` }))} />
            )}
          </Campo>
          <Campo rotulo="Primeira sessão desta turma">
            {p => <Entrada {...p} type="date" value={data} onChange={e => setData(e.target.value)} />}
          </Campo>
          <p className="m-0">As sessões mudam para esta data com os mesmos intervalos entre dias e as mesmas horas, módulos e formadores. Os planos de sessão e os sumários (conteúdos e atividades) vêm também. Depois pode acertar tudo na grelha.</p>
          {temSessoes && <p className="m-0 font-semibold text-perigo">O cronograma atual desta turma é substituído.</p>}
        </div>
      </Modal>
    </>
  );
}
