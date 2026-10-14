import { useEffect, useState } from "react";
import { Aviso, Botao, Campo, Entrada, Selecao, data, eur } from "../../../../partilhado/ui";
import {
  apiCompletar, apiInscreverGold, apiPedirPagamento, apiTurmaCheia, apiValidarPreinscricao, type DossieLead,
} from "../../../../partilhado/api/crm";
import { useAccao } from "../../../../partilhado/dados/useAccao";
import { eSecretaria } from "./util";

/**
 * Validação pela secretaria: completar NIF e morada, pedir o pagamento (Gold), escolher a turma,
 * validar, sugerir outra turma quando está cheia e inscrever na turma (Gold).
 */
export function FichaSecretaria({ d, role, onMudou }: { d: DossieLead; role: string; onMudou: () => void }) {
  const l = d.lead;
  const sec = eSecretaria(role, l.regime);
  const [fiscal, setFiscal] = useState({ nif: "", moradaFiscal: "", codigoPostal: "" });
  const [destino, setDestino] = useState("");
  useEffect(() => {
    setFiscal({ nif: l.nif, moradaFiscal: l.moradaFiscal, codigoPostal: l.codigoPostal });
    setDestino(d.turmaEscolhida ? String(d.turmaEscolhida.id) : "");
  }, [d, l]);

  const completar = useAccao(apiCompletar, { ok: "Pré-inscrição completa e entregue à secretaria.", erro: "Ainda faltam dados." });
  const pedir = useAccao(apiPedirPagamento, {
    ok: r => r.pedido.semIban
      ? "Pagamento pedido. Atenção: falta o IBAN em Configurações → Entidade; o email não o indica."
      : "Pagamento pedido. A pessoa recebeu o email com o IBAN e a ligação para o comprovativo.",
    invalidar: ["pagamentos:", "painel:"],
  });
  const validar = useAccao(apiValidarPreinscricao, { ok: "Pré-inscrição validada.", invalidar: ["formandos:", "turmas:", "painel:"] });
  const cheia = useAccao(apiTurmaCheia, { ok: r => r.enviadas ? `Email enviado com ${r.enviadas} turma${r.enviadas === 1 ? "" : "s"} no mesmo local.` : "Email enviado. Não há outra turma com vaga nesse local." });
  const inscrever = useAccao(apiInscreverGold, { ok: "Inscrito na turma. A ficha de formando foi criada.", invalidar: ["formandos:", "turmas:", "painel:"] });

  const destinoSel = d.turmasDestino.find(t => String(t.id) === destino) ?? null;
  const destinoCheio = destinoSel ? destinoSel.livres <= 0 : !d.turmaPelaSecretaria && (d.turmaEscolhida?.livres ?? 1) <= 0;
  const soCheia = d.faltaValidar === "A turma escolhida está cheia.";
  const podeValidar = (d.podeValidar || (soCheia && destinoSel && !destinoCheio)) && !destinoCheio && (!d.turmaPelaSecretaria || Boolean(destinoSel));
  const opcoesTurma = d.turmasDestino.map(t => ({ valor: String(t.id), rotulo: `${t.nome} · ${t.horario || t.local} · ${t.livres} vaga${t.livres === 1 ? "" : "s"}` }));

  const depois = <T,>(r: T | undefined) => { if (r) onMudou(); };

  return (
    <div className="flex flex-col gap-4">
      {!l.secretariaEm && l.estado === "Pré-inscrição" && (
        <section aria-label="Dados fiscais" className="flex flex-col gap-3 rounded-cartao border border-linha p-3">
          <p className="m-0 text-[13px] text-tinta-suave">Complete o NIF e a morada fiscal: a pré-inscrição passa sozinha para a secretaria.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo rotulo="NIF">{p => <Entrada {...p} inputMode="numeric" value={fiscal.nif} onChange={e => setFiscal(f => ({ ...f, nif: e.target.value }))} />}</Campo>
            <Campo rotulo="Morada fiscal" className="sm:col-span-2">{p => <Entrada {...p} value={fiscal.moradaFiscal} onChange={e => setFiscal(f => ({ ...f, moradaFiscal: e.target.value }))} />}</Campo>
            <Campo rotulo="Código postal">{p => <Entrada {...p} value={fiscal.codigoPostal} onChange={e => setFiscal(f => ({ ...f, codigoPostal: e.target.value }))} />}</Campo>
          </div>
          <Botao aCarregar={completar.aCorrer} onClick={() => void completar.correr(l.id, fiscal).then(depois)}>Completar e entregar à secretaria</Botao>
        </section>
      )}

      <section aria-label="Turma" className="text-[13px]">
        {d.turmaEscolhida ? (
          <p className="m-0">Turma escolhida: <strong>{d.turmaEscolhida.nome}</strong> · {d.turmaEscolhida.local} · {d.turmaEscolhida.horario}
            {d.turmaEscolhida.dataInicio ? ` · início ${data(d.turmaEscolhida.dataInicio)}` : ""} · {d.turmaEscolhida.livres > 0 ? `${d.turmaEscolhida.livres} vagas` : "sem vagas"}</p>
        ) : (
          <p className="m-0 text-tinta-suave">{d.turmaPelaSecretaria ? "Financiada: a pessoa só envia documentos; escolha a turma ao validar." : "A pessoa ainda não escolheu a turma na ligação pessoal."}</p>
        )}
        {d.percursoConcluido && !d.docsFechado && <p className="m-0 mt-1 font-semibold text-ligacao">Percurso concluído: aguarda a validação da secretaria.</p>}
      </section>

      {d.estadoPagamento !== "isento" && !d.docsFechado && (
        <section aria-label="Pagamento" className="flex flex-col gap-2 rounded-cartao border border-acao/40 bg-acao-suave p-3 text-[13px]">
          <p className="m-0 text-xs font-semibold uppercase tracking-wide text-acao-texto">Pagamento · {eur(d.pagamento?.valor ?? l.preco, true)} por transferência</p>
          {d.estadoPagamento === "por_pedir" && <p className="m-0">{d.podePedirPagamento ? "Documentos validados: peça o pagamento. A pessoa recebe o IBAN e o passo de pagamento abre na ligação pessoal." : d.faltaPedirPagamento}</p>}
          {d.estadoPagamento === "pedido" && <p className="m-0">Pedido{d.pagamentoPedidoEm ? ` em ${data(d.pagamentoPedidoEm)}` : ""}. Ao validar o comprovativo (separador Documentos) a inscrição conclui-se: ficha, conta e email de acesso.</p>}
          {d.estadoPagamento === "pago" && <p className="m-0 font-semibold text-sucesso">Pagamento confirmado.</p>}
          {sec && (d.estadoPagamento === "por_pedir" || d.estadoPagamento === "pedido") && (
            <Botao aCarregar={pedir.aCorrer} disabled={!d.podePedirPagamento} onClick={() => void pedir.correr(l.id).then(depois)}>
              {d.estadoPagamento === "pedido" ? "Reenviar pedido de pagamento" : "Pedir pagamento"}
            </Botao>
          )}
        </section>
      )}

      {sec && !d.docsFechado && (
        <section aria-label="Validar a pré-inscrição" className="flex flex-col gap-2 rounded-cartao border border-linha p-3">
          {d.turmasDestino.length === 0 ? (
            <Aviso tom="aviso">Não há turmas activas deste curso. Crie a turma antes de validar.</Aviso>
          ) : (
            <Campo rotulo="Turma de destino" ajuda={d.turmaPelaSecretaria
              ? "A validação cria a ficha do formando nesta turma, a conta e o email de acesso."
              : "Se a turma pedida estiver cheia, escolha outra do mesmo curso. A pasta na Drive muda de sítio."}>
              {p => <Selecao {...p} value={destino} onChange={e => setDestino(e.target.value)} opcoes={opcoesTurma} vazio="Escolha a turma" />}
            </Campo>
          )}
          {d.faltaValidar && <p className="m-0 text-xs text-tinta-suave">{d.faltaValidar}</p>}
          <Botao aCarregar={validar.aCorrer} disabled={!podeValidar}
            onClick={() => void validar.correr(l.id, destinoSel?.id).then(depois)}>Validar pré-inscrição</Botao>
          {!d.turmaPelaSecretaria && (destinoCheio || soCheia) && (
            <Botao variante="secundario" aCarregar={cheia.aCorrer} onClick={() => void cheia.correr(l.id).then(depois)}>Turma cheia: enviar outras datas</Botao>
          )}
        </section>
      )}

      {sec && l.regime === "gold" && d.validadaEm && l.estado !== "Formando" && (
        <section aria-label="Inscrever na turma" className="flex flex-wrap items-end gap-2 rounded-cartao border border-sucesso/30 bg-sucesso-suave p-3">
          <Campo rotulo="Inscrever na turma" className="min-w-[220px] flex-1">
            {p => <Selecao {...p} value={destino} onChange={e => setDestino(e.target.value)} opcoes={opcoesTurma} vazio="Escolha a turma" />}
          </Campo>
          <Botao disabled={!destinoSel || destinoSel.livres <= 0} aCarregar={inscrever.aCorrer}
            onClick={() => destinoSel && void inscrever.correr(l, destinoSel.id).then(depois)}>Inscrever</Botao>
        </section>
      )}

      {!sec && l.secretariaEm && l.estado !== "Formando" && (
        <Aviso tom="info">À espera da secretaria para validar e colocar na turma.</Aviso>
      )}
    </div>
  );
}
