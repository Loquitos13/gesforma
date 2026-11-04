import { useEffect, useState } from "react";
import { Aviso, Botao, BotaoLigacao, Campo, Entrada, Estado, SelecaoPesquisa, data, dataHora, eur } from "../../../../partilhado/ui";
import {
  apiCompletar, apiConcluirInscricao, apiInscreverGold, apiPedirPagamento, apiRecusarDoc, apiTurmaCheia, apiValidarDoc, apiValidarPreinscricao,
  type DossieLead,
} from "../../../../partilhado/api/crm";
import { usePode } from "../../../../partilhado/AuthGate";
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
  const concluir = useAccao(apiConcluirInscricao, { ok: "Inserido na turma: ficha de formando, conta e email de acesso.", invalidar: ["formandos:", "turmas:", "painel:", "crm:"] });
  // Inserir na turma depois do pagamento confirmado (on demand): o comercial e a coordenação.
  const podeInserir = usePode()("crm.inserirNaTurma");
  const inscrever = useAccao(apiInscreverGold, { ok: "Inscrito na turma. A ficha de formando foi criada.", invalidar: ["formandos:", "turmas:", "painel:"] });
  // Comprovativo de pagamento: o comercial, as coordenações e a contabilidade validam-no aqui (confirma o pagamento;
  // a inserção na turma faz-se depois, à parte).
  const podeComprovativo = usePode()("pagamentos.validarComprovativo");
  const comprovativo = d.documentos.find(x => x.tipo === "comprovativo") ?? null;
  const [motivo, setMotivo] = useState("");
  const validarComp = useAccao(apiValidarDoc, {
    ok: "Comprovativo validado: pagamento confirmado. Insira a pessoa na turma quando quiser.", invalidar: ["crm:", "pagamentos:", "formandos:", "turmas:", "painel:"],
  });
  const recusarComp = useAccao(apiRecusarDoc, { ok: "Comprovativo recusado. A pessoa recebeu o motivo e a ligação para enviar outro.", invalidar: ["crm:", "pagamentos:"] });

  const destinoSel = d.turmasDestino.find(t => String(t.id) === destino) ?? null;
  const destinoCheio = destinoSel ? destinoSel.livres <= 0 : !d.turmaPelaSecretaria && (d.turmaEscolhida?.livres ?? 1) <= 0;
  const soCheia = d.faltaValidar === "A turma escolhida está cheia.";
  const podeValidar = (d.podeValidar || (soCheia && destinoSel && !destinoCheio)) && !destinoCheio && (!d.turmaPelaSecretaria || Boolean(destinoSel));
  const opcoesTurma = d.turmasDestino.map(t => ({ valor: String(t.id), rotulo: `${t.nome} · ${t.horario || t.local} · ${t.livres} vaga${t.livres === 1 ? "" : "s"}` }));

  const depois = <T,>(r: T | undefined) => { if (r) onMudou(); };

  // Turma escolhida sem vagas (já com a tolerância): alerta e sugestão de outra turma por email (comercial e coordenação).
  const podeSugerir = usePode()("crm.sugerirTurma");
  const turmaSemVagas = l.regime === "gold" && l.estado !== "Formando" && !d.validadaEm && Boolean(d.turmaEscolhida) && (d.turmaEscolhida?.livres ?? 1) <= 0;

  return (
    <div className="flex flex-col gap-4">
      {d.aguardaTurma && l.estado !== "Formando" && (
        <Aviso tom="info" titulo="Prefere aguardar pela próxima turma">
          A pessoa escolheu, na ligação pessoal, aguardar pela próxima turma{d.aguardaTurma.horario ? ` no horário ${d.aguardaTurma.horario}` : " no mesmo horário"} (desde {data(d.aguardaTurma.em)}).
          Quando abrir uma turma, avise-a: pode escolhê-la na mesma ligação pessoal.
        </Aviso>
      )}
      {turmaSemVagas && (
        <Aviso tom="perigo" titulo="Turma sem vagas"
          acao={podeSugerir ? <Botao variante="primario" aCarregar={cheia.aCorrer} onClick={() => void cheia.correr(l.id).then(depois)}>Sugerir outra turma</Botao> : undefined}>
          A turma <strong>{d.turmaEscolhida!.nome}</strong> ({d.turmaEscolhida!.horario}, {d.turmaEscolhida!.local}) já tem todas as vagas preenchidas, incluindo a tolerância.
          «Sugerir outra turma» envia à pessoa um email com as turmas do mesmo curso noutros horários (ou com outra data) e a opção de aguardar pela próxima turma no mesmo horário.
        </Aviso>
      )}
      {!l.secretariaEm && l.estado === "Pré-inscrição" && (
        <section aria-label="Dados fiscais" className="flex flex-col gap-3 rounded-cartao border border-linha p-3">
          <p className="m-0 text-[13px] text-tinta-suave">Complete o NIF e a morada fiscal: a pré-inscrição passa sozinha para a secretaria.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo rotulo="NIF">{p => <Entrada {...p} inputMode="numeric" value={fiscal.nif} onChange={e => setFiscal(f => ({ ...f, nif: e.target.value }))} />}</Campo>
            <Campo rotulo="Morada fiscal" className="sm:col-span-2">{p => <Entrada {...p} value={fiscal.moradaFiscal} onChange={e => setFiscal(f => ({ ...f, moradaFiscal: e.target.value }))} />}</Campo>
            <Campo rotulo="Código postal">{p => <Entrada {...p} value={fiscal.codigoPostal} onChange={e => setFiscal(f => ({ ...f, codigoPostal: e.target.value }))} />}</Campo>
          </div>
          <Botao variante="primario" aCarregar={completar.aCorrer} onClick={() => void completar.correr(l.id, fiscal).then(depois)}>Completar e entregar à secretaria</Botao>
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
          {d.estadoPagamento === "pedido" && <p className="m-0">Pedido{d.pagamentoPedidoEm ? ` em ${data(d.pagamentoPedidoEm)}` : ""}. Depois de validar o comprovativo, insira a pessoa na turma (ficha, conta e email de acesso).</p>}
          {d.estadoPagamento === "pedido" && (comprovativo ? (
            <div className="flex flex-col gap-2 rounded-cartao border border-linha bg-superficie p-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold">Comprovativo</span>
                <span className="min-w-0 flex-1 truncate text-tinta-suave" title={comprovativo.nome}>{comprovativo.nome}</span>
                <span className="text-xs text-tinta-suave">{dataHora(comprovativo.createdAt)}</span>
                <Estado tom={comprovativo.estado === "validado" ? "sucesso" : comprovativo.estado === "recusado" ? "perigo" : "aviso"}>
                  {comprovativo.estado === "validado" ? "Validado" : comprovativo.estado === "recusado" ? "Recusado" : "Por validar"}
                </Estado>
                {comprovativo.url && <BotaoLigacao tamanho="sm" href={comprovativo.url} target="_blank" rel="noreferrer">Abrir</BotaoLigacao>}
              </div>
              {comprovativo.estado === "recusado" && comprovativo.observacao && <p className="m-0 text-xs text-perigo">{comprovativo.observacao}</p>}
              {podeComprovativo && comprovativo.estado === "pendente" && (
                <div className="flex flex-wrap items-center gap-2">
                  <Entrada aria-label="Motivo para recusar o comprovativo" placeholder="Motivo (para recusar)" className="h-8 min-w-[180px] flex-1 text-xs"
                    value={motivo} onChange={e => setMotivo(e.target.value)} />
                  <Botao tamanho="sm" variante="secundario" disabled={motivo.trim().length < 3} aCarregar={recusarComp.aCorrer}
                    onClick={() => void recusarComp.correr(l.id, comprovativo.id, motivo.trim()).then(r => { if (r) { setMotivo(""); onMudou(); } })}>Recusar</Botao>
                  <Botao tamanho="sm" variante="primario" aCarregar={validarComp.aCorrer}
                    onClick={() => void validarComp.correr(l.id, comprovativo.id).then(depois)}>Validar comprovativo</Botao>
                </div>
              )}
            </div>
          ) : <p className="m-0 text-tinta-suave">A pessoa ainda não anexou o comprovativo.</p>)}
          {d.estadoPagamento === "pago" && <p className="m-0 font-semibold text-sucesso">Pagamento confirmado.</p>}
          {sec && (d.estadoPagamento === "por_pedir" || d.estadoPagamento === "pedido") && (
            <Botao variante="primario" aCarregar={pedir.aCorrer} disabled={!d.podePedirPagamento} onClick={() => void pedir.correr(l.id).then(depois)}>
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
              {p => <SelecaoPesquisa {...p} value={destino} onChange={setDestino} opcoes={opcoesTurma} vazio="Escolha a turma" placeholder="Pesquisar turma (nome, horário, local)…" />}
            </Campo>
          )}
          {d.faltaValidar && <p className="m-0 text-xs text-tinta-suave">{d.faltaValidar}</p>}
          <Botao variante="primario" aCarregar={validar.aCorrer} disabled={!podeValidar}
            onClick={() => void validar.correr(l.id, destinoSel?.id).then(depois)}>Validar pré-inscrição</Botao>
        </section>
      )}

      {podeInserir && l.regime === "gold" && d.estadoPagamento === "pago" && l.estado !== "Formando" && (
        <section aria-label="Inserir na turma" className="flex flex-col gap-2 rounded-cartao border border-sucesso/30 bg-sucesso-suave p-3 text-[13px]">
          <p className="m-0">
            Pagamento confirmado. Insira a pessoa na turma{d.turmaEscolhida ? <> <strong>{d.turmaEscolhida.nome}</strong></> : ""} quando quiser:
            cria a ficha de formando, a conta e envia o email de acesso. Se não der (turma cheia, turma mudada…), o motivo fica na cronologia.
          </p>
          <Botao variante="primario" aCarregar={concluir.aCorrer} onClick={() => void concluir.correr(l.id).then(depois)}>Inserir na turma</Botao>
        </section>
      )}

      {sec && l.regime === "gold" && d.validadaEm && l.estado !== "Formando" && (
        <section aria-label="Inscrever na turma" className="flex flex-wrap items-end gap-2 rounded-cartao border border-sucesso/30 bg-sucesso-suave p-3">
          <Campo rotulo="Inscrever na turma" className="min-w-[220px] flex-1">
            {p => <SelecaoPesquisa {...p} value={destino} onChange={setDestino} opcoes={opcoesTurma} vazio="Escolha a turma" placeholder="Pesquisar turma (nome, horário, local)…" />}
          </Campo>
          <Botao variante="primario" disabled={!destinoSel || destinoSel.livres <= 0} aCarregar={inscrever.aCorrer}
            onClick={() => destinoSel && void inscrever.correr(l, destinoSel.id).then(depois)}>Inscrever</Botao>
        </section>
      )}

      {!sec && l.secretariaEm && l.estado !== "Formando" && (
        <Aviso tom="info">À espera da secretaria para validar e colocar na turma.</Aviso>
      )}
    </div>
  );
}
