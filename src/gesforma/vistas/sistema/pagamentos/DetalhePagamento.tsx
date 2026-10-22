// Modal de um pagamento: dados, comprovativo e as acções que dependem da situação.
import { useState } from "react";
import { useAuth } from "../../../../partilhado/AuthGate";
import {
  apiApagarPagamento, apiConfirmarPagamento, apiMudarEstadoPagamento, apiPagamento, apiRecusarPagamento, apiReenviarPedidoPagamento,
  urlFicheiro, type SituacaoPagamento,
} from "../../../../partilhado/api/pagamentos";
import { useAccao } from "../../../../partilhado/dados/useAccao";
import { useRecurso } from "../../../../partilhado/dados/useRecurso";
import {
  AreaTexto, Aviso, Botao, BotaoLigacao, Campo, ConfirmarPerigo, Detalhes, ErroCarregar, Esqueleto, Estado, Modal, data, dataHora, eur, type Tom,
} from "../../../../partilhado/ui";
import type { Navegar } from "../../../shell/tipos";
import { ReciboPagamento } from "./ReciboPagamento";

const SITUACAO: Record<SituacaoPagamento, { rotulo: string; tom: Tom }> = {
  a_confirmar: { rotulo: "A confirmar", tom: "aviso" },
  pedido: { rotulo: "Pedido", tom: "info" },
  recusado: { rotulo: "Comprovativo recusado", tom: "perigo" },
  pago: { rotulo: "Pago", tom: "sucesso" },
  cancelado: { rotulo: "Cancelado", tom: "neutro" },
  reembolsado: { rotulo: "Reembolsado", tom: "neutro" },
};

export function EstadoPagamento({ situacao }: { situacao: SituacaoPagamento }) {
  const s = SITUACAO[situacao] ?? SITUACAO.pedido;
  return <Estado tom={s.tom}>{s.rotulo}</Estado>;
}

const INVALIDAR = ["pagamentos:", "painel:", "notificacoes:", "crm:", "formandos:"];

export function DetalhePagamento({ id, onFechar, podeConfirmar, navigate }: {
  id: string | null; onFechar: () => void; podeConfirmar: boolean; navigate: Navegar;
}) {
  const { user } = useAuth();
  const { dados, erro, recarregar } = useRecurso(id ? `pagamentos:detalhe:${id}` : null, signal => apiPagamento(id!, signal));
  const p = dados?.pagamento;
  const [recusar, setRecusar] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [perigo, setPerigo] = useState<"reembolsar" | "cancelar" | "apagar" | null>(null);

  const confirmar = useAccao(apiConfirmarPagamento, { ok: "Pagamento confirmado.", invalidar: INVALIDAR });
  const recusa = useAccao(apiRecusarPagamento, { ok: r => (r.avisado ? "Comprovativo recusado. A pessoa foi avisada por email." : "Comprovativo recusado."), invalidar: INVALIDAR });
  const reenviar = useAccao(apiReenviarPedidoPagamento, { ok: "Pedido de pagamento reenviado por email.", invalidar: INVALIDAR });
  const estado = useAccao(apiMudarEstadoPagamento, { ok: "Estado do pagamento alterado.", invalidar: INVALIDAR });
  const apagar = useAccao(apiApagarPagamento, { ok: "Pagamento apagado.", invalidar: INVALIDAR });

  const pendente = p && ["a_confirmar", "pedido", "recusado"].includes(p.situacao);
  const percurso = Boolean(p?.lead_id && p.pedido_em);

  return (
    <Modal
      aberto={Boolean(id)}
      onFechar={onFechar}
      titulo={p ? p.nome : "Pagamento"}
      subtitulo={p ? `${p.id} · ${p.curso || "sem curso"}` : undefined}
      rodape={p && podeConfirmar ? (
        <>
          {pendente && p.lead_id && (
            <Botao variante="secundario" aCarregar={reenviar.aCorrer} onClick={() => void reenviar.correr(p.lead_id!)}>Reenviar pedido</Botao>
          )}
          {p.situacao === "a_confirmar" && <Botao variante="secundario" onClick={() => { setMotivo(""); setRecusar(true); }}>Recusar comprovativo</Botao>}
          {pendente && (
            <Botao variante="primario" aCarregar={confirmar.aCorrer} onClick={() => void confirmar.correr(p.id).then(() => recarregar())}>
              Confirmar pagamento
            </Botao>
          )}
          {p.situacao === "pago" && <Botao variante="secundario" onClick={() => setPerigo("reembolsar")}>Marcar como reembolsado</Botao>}
          {p.situacao === "cancelado" && <Botao variante="secundario" aCarregar={estado.aCorrer} onClick={() => void estado.correr(p.id, "Pendente")}>Reabrir</Botao>}
        </>
      ) : undefined}
    >
      {erro ? <ErroCarregar erro={erro} onTentar={recarregar} /> : !p ? <Esqueleto linhas={8} /> : (
        <div className="space-y-5">
          <div className="flex items-center gap-3 flex-wrap">
            <p className="m-0 text-2xl font-semibold num">{eur(p.valor, true)}</p>
            <EstadoPagamento situacao={p.situacao} />
          </div>

          {p.situacao === "recusado" && (
            <Aviso tom="perigo" titulo="Comprovativo recusado">
              {p.recusa_motivo || "Sem motivo registado."} · {dataHora(p.recusado_em)}. A pessoa pode anexar outro na ligação pessoal.
            </Aviso>
          )}
          {pendente && podeConfirmar && (
            <Aviso tom="info">
              {percurso
                ? "Ao confirmar: a pré-inscrição fica validada, é criada a ficha de formando na turma escolhida e a conta da área do formando, e a pessoa recebe o acesso por email."
                : "Ao confirmar: o pagamento fica Pago, a ficha Gold ligada passa a paga e sai o email de pagamento confirmado."}
            </Aviso>
          )}

          <Detalhes itens={[
            { rotulo: "Email", valor: p.email || "—" },
            { rotulo: "Curso", valor: p.curso || "—" },
            { rotulo: "Método", valor: p.metodo || "—" },
            { rotulo: "Criado", valor: dataHora(p.criado) },
            { rotulo: "Pedido em", valor: p.pedido_em ? dataHora(p.pedido_em) : "—" },
            { rotulo: "Pago em", valor: p.pago_em ? data(p.pago_em) : "—" },
          ]} />

          <section aria-label="Comprovativo" className="rounded-cartao border border-linha p-4">
            <p className="m-0 text-[13px] font-semibold text-tinta">Comprovativo</p>
            {p.comprovativo_ficheiro ? (
              <div className="mt-2 flex items-center gap-3 flex-wrap">
                <span className="text-sm text-tinta truncate flex-1 min-w-0">{p.comprovativo_nome || "comprovativo"}</span>
                <span className="text-xs text-tinta-suave">{dataHora(p.comprovativo_em)}</span>
                <BotaoLigacao tamanho="sm" href={urlFicheiro(p.comprovativo_ficheiro)} target="_blank" rel="noreferrer">Abrir</BotaoLigacao>
              </div>
            ) : (
              <p className="m-0 mt-1 text-[13px] text-tinta-suave">
                {p.lead_id ? "A pessoa ainda não anexou o comprovativo." : "Pagamento registado à mão: não há comprovativo anexado."}
              </p>
            )}
          </section>

          {p.situacao === "pago" && <ReciboPagamento pagamentoId={p.id} email={p.email} podeEmitir={podeConfirmar} />}

          {(p.lead_id || p.formando_id) && (
            <div className="flex gap-2 flex-wrap">
              {p.lead_id && (
                <Botao tamanho="sm" variante="ligacao" onClick={() => navigate({ view: p.lead_regime === "fin" ? "fin-preinscricoes" : "gold-preinscricoes", leadId: p.lead_id! })}>
                  Abrir a pré-inscrição
                </Botao>
              )}
              {p.formando_id && (
                <Botao tamanho="sm" variante="ligacao" onClick={() => navigate({ view: "gold-formando-ficha", formandoId: p.formando_id! })}>
                  Abrir a ficha do formando
                </Botao>
              )}
            </div>
          )}

          {podeConfirmar && (
            <div className="pt-3 border-t border-linha flex gap-2 flex-wrap">
              {pendente && <Botao tamanho="sm" variante="fantasma" onClick={() => setPerigo("cancelar")}>Cancelar pagamento</Botao>}
              {(p.situacao !== "pago" || user.role === "admin") && (
                <Botao tamanho="sm" variante="fantasma" className="text-perigo" onClick={() => setPerigo("apagar")}>Apagar</Botao>
              )}
            </div>
          )}
        </div>
      )}

      <Modal
        aberto={recusar}
        onFechar={() => setRecusar(false)}
        titulo="Recusar o comprovativo"
        largura="sm"
        rodape={(
          <>
            <Botao onClick={() => setRecusar(false)}>Cancelar</Botao>
            <Botao variante="perigo" disabled={motivo.trim().length < 3} aCarregar={recusa.aCorrer}
              onClick={() => p && void recusa.correr(p.id, motivo.trim()).then(r => { if (r) { setRecusar(false); recarregar(); } })}>
              Recusar e avisar
            </Botao>
          </>
        )}
      >
        <p className="m-0 mb-3 text-sm text-tinta-suave">O pagamento continua por receber. A pessoa recebe um email com o motivo e a ligação para anexar outro comprovativo.</p>
        <Campo rotulo="Motivo" obrigatorio ajuda="Ex.: o valor não corresponde, o ficheiro não se lê, falta o IBAN de destino.">
          {a => <AreaTexto {...a} value={motivo} maxLength={400} onChange={e => setMotivo(e.target.value)} data-autofocus />}
        </Campo>
      </Modal>

      <ConfirmarPerigo
        aberto={perigo !== null}
        onFechar={() => setPerigo(null)}
        titulo={perigo === "apagar" ? "Apagar o pagamento?" : perigo === "cancelar" ? "Cancelar o pagamento?" : "Marcar como reembolsado?"}
        descricao={perigo === "apagar"
          ? "O registo sai da lista e dos totais. Fica a entrada na auditoria."
          : perigo === "cancelar"
            ? "Deixa de contar como por receber. Pode reabri-lo depois."
            : "O valor sai da receita confirmada. Use só depois de devolver o dinheiro."}
        acao={perigo === "apagar" ? "Apagar" : perigo === "cancelar" ? "Cancelar pagamento" : "Marcar reembolsado"}
        onConfirmar={async () => {
          if (!p) return;
          if (perigo === "apagar") { const r = await apagar.correr(p.id); if (r) onFechar(); return; }
          await estado.correr(p.id, perigo === "cancelar" ? "Cancelado" : "Reembolsado");
          recarregar();
        }}
      />
    </Modal>
  );
}
