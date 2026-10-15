import { useState } from "react";
import { Aviso, Botao, ErroCarregar, Esqueleto, Modal, dataHora } from "../../../../partilhado/ui";
import { apiFaturacaoLead, apiPedirFaturacao } from "../../../../partilhado/api/crm";
import { useAccao } from "../../../../partilhado/dados/useAccao";
import { useRecurso } from "../../../../partilhado/dados/useRecurso";

/** Botão «Contabilidade»: dados de faturação que a pessoa indicou na ligação pessoal. */
export function FichaContabilidade({ leadId }: { leadId: number }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button type="button" className="inline-flex h-9 items-center rounded-controlo border border-linha-forte px-3 font-semibold text-tinta" onClick={() => setAberto(true)}>
        Contabilidade
      </button>
      {aberto && <ModalContabilidade leadId={leadId} onFechar={() => setAberto(false)} />}
    </>
  );
}

function ModalContabilidade({ leadId, onFechar }: { leadId: number; onFechar: () => void }) {
  const { dados: f, erro, recarregar } = useRecurso(`crm:faturacao:${leadId}`, signal => apiFaturacaoLead(leadId, signal));
  const pedir = useAccao(apiPedirFaturacao, { ok: "Email enviado com a ligação para os dados de faturação." });
  const linhas = f?.pedido && f.dados ? [
    ["Nome ou empresa", f.dados.nome],
    ["NIF", f.dados.nif],
    ["Morada fiscal", f.dados.moradaFiscal],
    ["Código postal", f.dados.codigoPostal],
    ["Email da fatura", f.dados.email],
  ] : [];
  return (
    <Modal aberto onFechar={onFechar} titulo="Contabilidade · dados de faturação" rodape={
      <div className="flex flex-wrap justify-end gap-2">
        <Botao variante="secundario" aCarregar={pedir.aCorrer} onClick={() => void pedir.correr(leadId).then(r => { if (r) recarregar(); })}>
          {f?.pedido ? "Reenviar pedido por email" : "Pedir dados por email"}
        </Botao>
        <Botao variante="primario" onClick={onFechar}>Fechar</Botao>
      </div>
    }>
      {erro && !f ? <ErroCarregar erro={erro} onTentar={recarregar} /> : !f ? <Esqueleto linhas={4} /> : !f.pedido ? (
        <p className="m-0 text-[13px] text-tinta-suave">Ainda não foram pedidos os dados de faturação. O pedido sai sozinho quando a inscrição Gold fica concluída; pode também pedi-lo já.</p>
      ) : (
        <div className="flex flex-col gap-3 text-[13px]">
          <p className="m-0 text-tinta-suave">
            Pedido em {dataHora(f.pedidoEm)}{f.preenchidoEm ? ` · preenchido em ${dataHora(f.preenchidoEm)}` : " · ainda não preenchido"}.
          </p>
          {linhas.length > 0 ? (
            <dl className="m-0 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2">
              {linhas.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-tinta-suave">{k}</dt>
                  <dd className="m-0 font-semibold break-words">{v}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <Aviso tom="info">A pessoa ainda não preencheu os dados. Ligação pessoal: <span className="break-all">{f.url}</span></Aviso>
          )}
        </div>
      )}
    </Modal>
  );
}
