// Botão do separador Sessões: copia para a turma os planos de sessão da ficha do curso, ou planos e sumários de outra turma (turma padrão).
import { useEffect, useState } from "react";
import { apiImportarPlanosCurso, apiOrigensPlanos } from "../../../../partilhado/api/pedagogia";
import { fmtDataCalendario } from "../../../../partilhado/horaLisboa";
import { toastError, toastOk } from "../../../../partilhado/toastBus";
import { Botao, Caixa, Campo, Modal, Selecao } from "../../../../partilhado/ui";

export function ImportarPlanosCurso({ regime, turmaId, onImportados }: { regime: "gold" | "fin"; turmaId: number; onImportados: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [substituir, setSubstituir] = useState(false);
  const [origem, setOrigem] = useState("");
  const [turmas, setTurmas] = useState<{ id: number; nome: string; dataInicio: string }[]>([]);
  const [aCorrer, setACorrer] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    apiOrigensPlanos(regime, turmaId).then(r => setTurmas(r.turmas)).catch(() => setTurmas([]));
  }, [aberto, regime, turmaId]);

  async function importar() {
    setACorrer(true);
    try {
      const r = await apiImportarPlanosCurso(regime, turmaId, substituir, origem ? Number(origem) : undefined);
      const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
      const partes = [
        plural(r.importados, "plano importado", "planos importados"),
        origem ? plural(r.sumarios ?? 0, "sumário copiado", "sumários copiados") : "",
        r.mantidos ? plural(r.mantidos, "sessão mantida", "sessões mantidas") : "",
        r.semModelo ? `${plural(r.semModelo, "sessão", "sessões")} sem correspondência` : "",
      ].filter(Boolean);
      toastOk(`${partes.join(" · ")}.`);
      setAberto(false);
      onImportados();
    } catch (err) {
      toastError(err, "Não foi possível importar.");
    } finally {
      setACorrer(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setAberto(true)}
        className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
        Importar planos
      </button>
      <Modal aberto={aberto} onFechar={() => setAberto(false)} largura="sm" titulo="Importar planos de sessão"
        rodape={<><Botao onClick={() => setAberto(false)}>Cancelar</Botao><Botao variante="primario" aCarregar={aCorrer} onClick={() => void importar()}>Importar</Botao></>}>
        <div className="flex flex-col gap-3 text-[13px]">
          <Campo rotulo="De onde">
            {p => (
              <Selecao {...p} value={origem} onChange={e => setOrigem(e.target.value)} vazio="Ficha do curso (só planos)"
                opcoes={turmas.map(t => ({ valor: String(t.id), rotulo: `${/^turma\b/i.test(t.nome) ? "" : "Turma "}${t.nome}${t.dataInicio ? ` · ${fmtDataCalendario(t.dataInicio)}` : ""} (planos e sumários)` }))} />
            )}
          </Campo>
          {origem
            ? <p className="m-0">Cada sessão recebe o plano e o sumário (conteúdos e atividades) da sessão com o mesmo número na turma escolhida. As observações e as assinaturas não se copiam.</p>
            : <p className="m-0">Cada sessão recebe o plano com o mesmo número na ficha do curso (separador Planos). O sumário padrão do curso aparece no sumário da sessão enquanto este estiver vazio.</p>}
          <p className="m-0 text-tinta-suave">Contam só as sessões presenciais e síncronas, pela ordem do cronograma. O que já está assinado nunca é alterado.</p>
          <Caixa rotulo="Substituir também o que já está preenchido" ajuda="Por omissão só se preenchem as sessões ainda vazias."
            checked={substituir} onChange={e => setSubstituir(e.target.checked)} />
        </div>
      </Modal>
    </>
  );
}
