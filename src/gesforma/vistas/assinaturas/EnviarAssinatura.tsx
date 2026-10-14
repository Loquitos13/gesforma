// Enviar o contrato para assinatura: o nome, o email e o NIF vêm da ficha; o código vai sempre por email.
import { useEffect, useState } from "react";
import { apiEnviarAssinatura } from "../../../partilhado/api/assinaturas";
import { ApiError } from "../../../partilhado/api/cliente";
import { invalidar } from "../../../partilhado/dados/useRecurso";
import { toastError, toastOk } from "../../../partilhado/toastBus";
import { Aviso, Botao, Campo, Entrada, Modal, Selecao } from "../../../partilhado/ui";
import { INVALIDAR_ASSINATURAS } from "./PainelAssinatura";

const PRAZOS = [
  { valor: "7", rotulo: "7 dias" },
  { valor: "14", rotulo: "14 dias" },
  { valor: "30", rotulo: "30 dias" },
];

export function EnviarAssinatura({ contratoId, aberto, onFechar }: { contratoId: number; aberto: boolean; onFechar: () => void }) {
  const [prazo, setPrazo] = useState("14");
  const [nif, setNif] = useState("");
  const [pedeNif, setPedeNif] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aEnviar, setAEnviar] = useState(false);
  useEffect(() => {
    if (aberto) { setPrazo("14"); setNif(""); setPedeNif(false); setErro(null); }
  }, [aberto]);

  async function confirmar() {
    const limpo = nif.replace(/\s/g, "");
    if (pedeNif && !/^\d{9}$/.test(limpo)) return setErro("O NIF tem 9 dígitos.");
    setAEnviar(true);
    setErro(null);
    try {
      const r = await apiEnviarAssinatura(contratoId, { prazoDias: Number(prazo), nif: pedeNif ? limpo : undefined });
      for (const p of INVALIDAR_ASSINATURAS) invalidar(p);
      toastOk(`Enviado para ${r.assinatura.signatarioEmail}.`);
      onFechar();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && /NIF/.test(e.message)) {
        setPedeNif(true);
        setErro(e.message);
      } else if (e instanceof ApiError && e.status === 409) {
        setErro(e.message);
      } else {
        toastError(e, "Não foi possível enviar o contrato.");
      }
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo="Enviar para assinatura"
      rodape={<><Botao onClick={onFechar}>Cancelar</Botao><Botao variante="primario" aCarregar={aEnviar} onClick={() => void confirmar()}>Enviar por email</Botao></>}
    >
      <div className="space-y-4 text-sm">
        <p className="m-0 text-tinta-suave">
          O nome, o email e o NIF do signatário vêm da ficha do formando ou do cliente, no momento do envio. O documento enviado
          fica fechado: se o texto mudar, envie de novo.
        </p>
        <ol className="m-0 pl-5 space-y-1 text-tinta">
          <li>O signatário recebe por email uma ligação pessoal.</li>
          <li>Lê o contrato e assina (desenho, nome escrito, ou Cartão de Cidadão / Chave Móvel Digital).</li>
          <li>Confirma com um código de 6 dígitos enviado por email.</li>
          <li>O PDF assinado, com o certificado de assinatura e o selo da entidade, vai para a Drive.</li>
        </ol>
        <Campo rotulo="A ligação é válida durante">{p => <Selecao {...p} value={prazo} onChange={e => setPrazo(e.target.value)} opcoes={PRAZOS} />}</Campo>
        {pedeNif && (
          <Campo rotulo="NIF do signatário" obrigatorio ajuda="A ficha não tem NIF. O NIF indicado aqui fica registado como dado pela equipa." erro={erro}>
            {p => <Entrada {...p} inputMode="numeric" maxLength={11} value={nif} onChange={e => setNif(e.target.value)} autoFocus />}
          </Campo>
        )}
        {erro && !pedeNif && <Aviso tom="perigo">{erro}</Aviso>}
      </div>
    </Modal>
  );
}
