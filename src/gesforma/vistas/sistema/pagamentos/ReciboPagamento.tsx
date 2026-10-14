// Recibo interno de um pagamento confirmado: emitir, abrir, gerar de novo e enviar por email.
import { useState } from "react";
import { apiAbrirRecibo, apiEmitirRecibo, apiEnviarRecibo, apiEstadoRecibo } from "../../../../partilhado/api/pagamentos";
import { useAccao } from "../../../../partilhado/dados/useAccao";
import { useRecurso } from "../../../../partilhado/dados/useRecurso";
import { Aviso, Botao, Campo, Entrada, Esqueleto, Modal, dataHora } from "../../../../partilhado/ui";

export function ReciboPagamento({ pagamentoId, email, podeEmitir }: { pagamentoId: string; email?: string; podeEmitir: boolean }) {
  const chave = `pagamentos:recibo:${pagamentoId}`;
  const { dados, aCarregar } = useRecurso(chave, s => apiEstadoRecibo(pagamentoId, s));
  const [avisoDrive, setAvisoDrive] = useState<string | null>(null);
  const [envio, setEnvio] = useState<string | null>(null);
  const emitir = useAccao(() => apiEmitirRecibo(pagamentoId), {
    ok: r => (r.novo ? `Recibo ${r.recibo.numero} emitido.` : `Recibo ${r.recibo.numero} gerado de novo.`),
    invalidar: [chave],
  });
  const abrir = useAccao(() => apiAbrirRecibo(pagamentoId), { erro: "Não foi possível abrir o recibo." });
  const enviar = useAccao((para: string) => apiEnviarRecibo(pagamentoId, para), {
    ok: r => `Recibo enviado para ${r.recibo.enviadoPara}.`, invalidar: [chave],
  });
  const recibo = dados?.recibo ?? null;

  async function emitirEAbrir() {
    const r = await emitir.correr();
    if (!r) return;
    setAvisoDrive(r.avisoDrive);
    await abrir.correr();
  }

  return (
    <section aria-label="Recibo" className="rounded-cartao border border-linha p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="m-0 text-[13px] font-semibold text-tinta flex-1">Recibo</p>
        {recibo && <span className="text-xs text-tinta-suave num">N.º {recibo.numero}</span>}
      </div>
      {aCarregar && !dados ? <Esqueleto linhas={1} /> : recibo ? (
        <>
          <p className="m-0 text-[13px] text-tinta-suave">
            Emitido {dataHora(recibo.emitidoEm)}
            {recibo.noDrive ? " · guardado na Drive" : ""}
            {recibo.enviadoEm ? ` · enviado para ${recibo.enviadoPara} em ${dataHora(recibo.enviadoEm)}` : ""}
          </p>
          <div className="flex gap-2 flex-wrap">
            <Botao tamanho="sm" aCarregar={abrir.aCorrer} onClick={() => void abrir.correr()}>Abrir PDF</Botao>
            {podeEmitir && <Botao tamanho="sm" variante="secundario" onClick={() => setEnvio(email ?? "")}>Enviar por email</Botao>}
            {podeEmitir && (
              <Botao tamanho="sm" variante="fantasma" aCarregar={emitir.aCorrer} onClick={() => void emitir.correr().then(r => r && setAvisoDrive(r.avisoDrive))}
                title="Volta a gerar o PDF com os dados actuais; o número mantém-se">
                Gerar de novo
              </Botao>
            )}
          </div>
        </>
      ) : (
        <div className="flex items-center gap-3 flex-wrap">
          <p className="m-0 text-[13px] text-tinta-suave flex-1 min-w-[12rem]">Ainda sem recibo. O número é atribuído na emissão e não muda.</p>
          {podeEmitir && <Botao tamanho="sm" variante="primario" aCarregar={emitir.aCorrer || abrir.aCorrer} onClick={() => void emitirEAbrir()}>Emitir recibo</Botao>}
        </div>
      )}
      {avisoDrive && <Aviso tom="aviso">O recibo foi emitido, mas não ficou na Drive: {avisoDrive}</Aviso>}
      <p className="m-0 text-xs text-tinta-suave">Documento interno: não substitui a fatura.</p>

      <Modal
        aberto={envio !== null}
        onFechar={() => setEnvio(null)}
        titulo="Enviar recibo por email"
        rodape={(
          <>
            <Botao variante="fantasma" onClick={() => setEnvio(null)}>Cancelar</Botao>
            <Botao variante="primario" aCarregar={enviar.aCorrer} disabled={!envio?.includes("@")}
              onClick={() => void enviar.correr(envio ?? "").then(r => r && setEnvio(null))}>
              Enviar
            </Botao>
          </>
        )}
      >
        <Campo rotulo="Email" ajuda="O texto do email edita-se em Sistema › Emails › Modelos («Recibo de pagamento»).">
          {p => <Entrada {...p} type="email" value={envio ?? ""} onChange={e => setEnvio(e.target.value)} />}
        </Campo>
      </Modal>
    </section>
  );
}
