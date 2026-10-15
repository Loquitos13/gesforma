// Botão do separador Sessões: copia para a turma os planos de sessão da ficha do curso.
import { useState } from "react";
import { apiImportarPlanosCurso } from "../../../../partilhado/api/pedagogia";
import { toastError, toastOk } from "../../../../partilhado/toastBus";
import { Botao, Caixa, Modal } from "../../../../partilhado/ui";

export function ImportarPlanosCurso({ regime, turmaId, onImportados }: { regime: "gold" | "fin"; turmaId: number; onImportados: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [substituir, setSubstituir] = useState(false);
  const [aCorrer, setACorrer] = useState(false);

  async function importar() {
    setACorrer(true);
    try {
      const r = await apiImportarPlanosCurso(regime, turmaId, substituir);
      const partes = [
        `${r.importados} plano${r.importados === 1 ? "" : "s"} importado${r.importados === 1 ? "" : "s"}`,
        r.mantidos ? `${r.mantidos} mantido${r.mantidos === 1 ? "" : "s"}` : "",
        r.semModelo ? `${r.semModelo} sess${r.semModelo === 1 ? "ão" : "ões"} sem plano na ficha do curso` : "",
      ].filter(Boolean);
      toastOk(`${partes.join(" · ")}.`);
      setAberto(false);
      onImportados();
    } catch (err) {
      toastError(err, "Não foi possível importar os planos.");
    } finally {
      setACorrer(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setAberto(true)}
        className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
        Importar planos do curso
      </button>
      <Modal aberto={aberto} onFechar={() => setAberto(false)} largura="sm" titulo="Importar planos do curso"
        rodape={<><Botao onClick={() => setAberto(false)}>Cancelar</Botao><Botao variante="primario" aCarregar={aCorrer} onClick={() => void importar()}>Importar</Botao></>}>
        <div className="flex flex-col gap-3 text-[13px]">
          <p className="m-0">Cada sessão recebe o plano com o mesmo número na ficha do curso (separador Planos). Contam só as sessões presenciais e síncronas, pela ordem do cronograma.</p>
          <p className="m-0 text-tinta-suave">Os planos já assinados nunca são alterados. O sumário padrão do curso aparece no sumário da sessão enquanto este estiver vazio.</p>
          <Caixa rotulo="Substituir também os planos já preenchidos" ajuda="Por omissão só se preenchem as sessões ainda sem plano."
            checked={substituir} onChange={e => setSubstituir(e.target.checked)} />
        </div>
      </Modal>
    </>
  );
}
