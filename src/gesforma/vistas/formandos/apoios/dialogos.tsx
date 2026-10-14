import { useEffect, useState } from "react";
import { ApiError } from "../../../../partilhado/api/cliente";
import { apiAlterarApoio, apiIbanFormando, type Apoio } from "../../../../partilhado/api/apoios";
import { useAccao } from "../../../../partilhado/dados/useAccao";
import { invalidar } from "../../../../partilhado/dados/useRecurso";
import { toastError, toastOk } from "../../../../partilhado/toastBus";
import { AreaTexto, Botao, Campo, Entrada, Modal, eur } from "../../../../partilhado/ui";

export const INVALIDAR_APOIOS = ["apoios:", "formandos:"];

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

/** IBAN do formando para receber os apoios. Vazio remove. */
export function EditarIban({ aberto, onFechar, formandoId, titularAtual }: {
  aberto: boolean;
  onFechar: () => void;
  formandoId: number;
  titularAtual: string;
}) {
  const [iban, setIban] = useState("");
  const [titular, setTitular] = useState(titularAtual);
  const [erro, setErro] = useState("");
  useEffect(() => { if (aberto) { setIban(""); setTitular(titularAtual); setErro(""); } }, [aberto, titularAtual]);
  const [aCorrer, setACorrer] = useState(false);

  async function submeter() {
    setErro("");
    setACorrer(true);
    try {
      await apiIbanFormando(formandoId, iban, titular);
      for (const p of INVALIDAR_APOIOS) invalidar(p);
      toastOk(iban ? "IBAN guardado." : "IBAN removido.");
      onFechar();
    } catch (e) {
      // Erros de validação ficam junto ao campo; os outros vão para o aviso geral.
      if (e instanceof ApiError && e.status === 400) setErro(e.message);
      else toastError(e, "Não foi possível guardar o IBAN.");
    } finally {
      setACorrer(false);
    }
  }

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo="IBAN para os apoios"
      rodape={(
        <>
          <Botao variante="fantasma" onClick={onFechar}>Cancelar</Botao>
          <Botao variante="primario" aCarregar={aCorrer} onClick={() => void submeter()}>{iban ? "Guardar IBAN" : "Remover IBAN"}</Botao>
        </>
      )}
    >
      <div className="flex flex-col gap-3">
        <Campo rotulo="IBAN" erro={erro} ajuda="Fica cifrado. Deixe vazio para remover o IBAN atual.">
          {p => <Entrada {...p} value={iban} onChange={e => setIban(e.target.value.toUpperCase())} placeholder="PT50 0000 0000 0000 0000 0000 0" autoComplete="off" spellCheck={false} data-autofocus />}
        </Campo>
        <Campo rotulo="Titular da conta">
          {p => <Entrada {...p} value={titular} onChange={e => setTitular(e.target.value)} maxLength={160} />}
        </Campo>
        <p className="m-0 text-xs text-tinta-suave">O comprovativo do IBAN continua a ser pedido como documento no separador Documentos.</p>
      </div>
    </Modal>
  );
}

/** Data e referência de uma transferência. Usado num apoio ou num lote. */
export function MarcarPago({ aberto, onFechar, titulo, descricao, onConfirmar }: {
  aberto: boolean;
  onFechar: () => void;
  titulo: string;
  descricao?: string;
  onConfirmar: (pagoEm: string, referencia: string) => Promise<unknown>;
}) {
  const [pagoEm, setPagoEm] = useState(hoje());
  const [referencia, setReferencia] = useState("");
  const [aCorrer, setACorrer] = useState(false);
  useEffect(() => { if (aberto) { setPagoEm(hoje()); setReferencia(""); } }, [aberto]);
  async function confirmar() {
    setACorrer(true);
    try {
      const r = await onConfirmar(pagoEm, referencia.trim());
      if (r !== undefined) onFechar();
    } finally {
      setACorrer(false);
    }
  }
  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo={titulo}
      largura="sm"
      rodape={(
        <>
          <Botao variante="fantasma" onClick={onFechar}>Cancelar</Botao>
          <Botao variante="primario" disabled={!pagoEm} aCarregar={aCorrer} onClick={() => void confirmar()}>Marcar como pago</Botao>
        </>
      )}
    >
      <div className="flex flex-col gap-3">
        {descricao && <p className="m-0 text-sm text-tinta-suave">{descricao}</p>}
        <Campo rotulo="Data da transferência">{p => <Entrada {...p} type="date" value={pagoEm} max={hoje()} onChange={e => setPagoEm(e.target.value)} />}</Campo>
        <Campo rotulo="Referência" ajuda="Opcional. Ex.: n.º do lote ou da ordem de transferência.">
          {p => <Entrada {...p} value={referencia} maxLength={120} onChange={e => setReferencia(e.target.value)} />}
        </Campo>
      </div>
    </Modal>
  );
}

/** Ajuste ao valor calculado, sempre com motivo (fica no histórico e na auditoria). */
export function AjustarApoio({ apoio, onFechar }: { apoio: Apoio | null; onFechar: () => void }) {
  const [ajuste, setAjuste] = useState("0");
  const [motivo, setMotivo] = useState("");
  useEffect(() => { if (apoio) { setAjuste(String(apoio.ajuste)); setMotivo(apoio.motivoAjuste); } }, [apoio]);
  const valor = Number(ajuste.replace(",", "."));
  const final = apoio ? Math.round((apoio.valorCalculado + (Number.isFinite(valor) ? valor : 0)) * 100) / 100 : 0;
  const gravar = useAccao(
    () => apiAlterarApoio(apoio!.id, { ajuste: valor, motivoAjuste: motivo.trim() }),
    { invalidar: INVALIDAR_APOIOS, ok: "Ajuste guardado." },
  );
  const invalido = !Number.isFinite(valor) || final < 0 || !motivo.trim();
  return (
    <Modal
      aberto={Boolean(apoio)}
      onFechar={onFechar}
      titulo={apoio ? `Ajustar · ${apoio.rotulo}` : "Ajustar"}
      largura="sm"
      rodape={(
        <>
          <Botao variante="fantasma" onClick={onFechar}>Cancelar</Botao>
          <Botao variante="primario" disabled={invalido} aCarregar={gravar.aCorrer} onClick={async () => { if (await gravar.correr()) onFechar(); }}>Guardar ajuste</Botao>
        </>
      )}
    >
      {apoio && (
        <div className="flex flex-col gap-3">
          <p className="m-0 text-sm text-tinta-suave">Calculado: <strong className="text-tinta">{eur(apoio.valorCalculado, true)}</strong> · valor final: <strong className="text-tinta">{eur(final, true)}</strong></p>
          <Campo rotulo="Ajuste (€)" ajuda="Positivo acrescenta, negativo desconta.">
            {p => <Entrada {...p} inputMode="decimal" value={ajuste} onChange={e => setAjuste(e.target.value)} />}
          </Campo>
          <Campo rotulo="Motivo" erro={!motivo.trim() ? "Obrigatório" : undefined}>
            {p => <AreaTexto {...p} value={motivo} maxLength={500} onChange={e => setMotivo(e.target.value)} placeholder="Ex.: dia de exame contado para o subsídio de alimentação." />}
          </Campo>
        </div>
      )}
    </Modal>
  );
}
