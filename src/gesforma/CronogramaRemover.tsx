// Remover várias sessões do cronograma de uma vez (marcar e remover) ou limpá-lo todo, em vez de uma a uma na grelha.
import { useMemo, useState } from "react";
import { eMarcoFim } from "../partilhado/cronogramaGrelha";
import { formatDiaMes, formatHoraRange, modulosLabel, sessaoModalidade, sessaoModulos, type SessaoCronograma, type SessaoModalidade } from "../partilhado/turmaModel";
import { Botao, ConfirmarPerigo, Modal } from "../partilhado/ui";

const ROTULO: Record<SessaoModalidade, string> = {
  presencial: "Presencial",
  sincrona: "Vídeo-conferência",
  auto: "Auto-aprendizagem",
  avaliacao: "Avaliação",
  matricula: "Matrícula",
};

export function CronogramaRemover({ aberto, sessoes, onFechar, onChange }: {
  aberto: boolean;
  sessoes: SessaoCronograma[];
  onFechar: () => void;
  onChange: (next: SessaoCronograma[]) => void;
}) {
  const lista = useMemo(
    () => sessoes.filter(s => !eMarcoFim(s)).sort((a, b) => `${a.data} ${a.horaInicio}`.localeCompare(`${b.data} ${b.horaInicio}`)),
    [sessoes],
  );
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [limpar, setLimpar] = useState(false);
  const tipos = [...new Set(lista.map(s => sessaoModalidade(s)))];

  const fechar = () => { setMarcadas(new Set()); onFechar(); };
  const alternar = (ids: string[], marcar: boolean) => setMarcadas(m => {
    const n = new Set(m);
    for (const id of ids) if (marcar) n.add(id); else n.delete(id);
    return n;
  });
  function remover(ids: Set<string>) {
    onChange(sessoes.filter(s => !ids.has(s.id)));
    fechar();
  }

  const todas = lista.length > 0 && marcadas.size === lista.length;
  return (
    <>
      <Modal aberto={aberto} onFechar={fechar} largura="lg" titulo="Remover sessões do cronograma"
        subtitulo="Marque as sessões a remover. Sessões com sumário, presenças ou plano assinado são recusadas ao gravar."
        rodape={<>
          <Botao variante="secundario" disabled={!lista.length} onClick={() => setLimpar(true)}>Limpar tudo</Botao>
          <span className="flex-1" />
          <Botao variante="secundario" onClick={fechar}>Cancelar</Botao>
          <Botao variante="perigo" disabled={!marcadas.size} onClick={() => remover(marcadas)}>
            Remover {marcadas.size || ""} {marcadas.size === 1 ? "sessão" : "sessões"}
          </Botao>
        </>}>
        {lista.length === 0 ? <p className="m-0 text-sm text-tinta-suave">O cronograma está vazio.</p> : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <label className="inline-flex items-center gap-1.5 font-semibold text-tinta">
                <input type="checkbox" checked={todas} onChange={e => alternar(lista.map(s => s.id), e.target.checked)} /> Todas ({lista.length})
              </label>
              {tipos.length > 1 && tipos.map(t => {
                const ids = lista.filter(s => sessaoModalidade(s) === t).map(s => s.id);
                return (
                  <button key={t} type="button" onClick={() => alternar(ids, !ids.every(id => marcadas.has(id)))}
                    className="rounded-full border border-linha px-2.5 py-1 text-tinta hover:bg-fundo">
                    {ROTULO[t]} ({ids.length})
                  </button>
                );
              })}
            </div>
            <ul className="m-0 max-h-[55vh] list-none divide-y divide-linha-suave overflow-y-auto rounded-controlo border border-linha p-0">
              {lista.map(s => (
                <li key={s.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-fundo">
                    <input type="checkbox" checked={marcadas.has(s.id)} onChange={e => alternar([s.id], e.target.checked)} />
                    <span className="w-16 num text-tinta">{s.data ? formatDiaMes(s.data) : "Sem data"}</span>
                    <span className="w-28 num text-tinta-suave">{s.horaInicio && s.horaFim ? formatHoraRange(s.horaInicio, s.horaFim) : "—"}</span>
                    <span className="w-36 text-tinta-suave">{ROTULO[sessaoModalidade(s)]}</span>
                    <span className="min-w-0 flex-1 truncate text-tinta">{modulosLabel(sessaoModulos(s))}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Modal>
      <ConfirmarPerigo aberto={limpar} onFechar={() => setLimpar(false)} titulo="Limpar o cronograma?" acao="Limpar tudo"
        descricao={`As ${lista.length} sessões saem do cronograma. Sessões com sumário, presenças ou plano assinado são recusadas ao gravar.`}
        onConfirmar={() => { setLimpar(false); remover(new Set(lista.map(s => s.id))); }} />
    </>
  );
}
