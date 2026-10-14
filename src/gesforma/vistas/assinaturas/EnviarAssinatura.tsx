// Enviar o contrato para assinatura: quem assina (vem sempre da ficha), como assina, prazo, código por email
// e, ao lado, o email que a pessoa vai receber.
import { useEffect, useMemo, useState } from "react";
import { apiEnviarAssinatura } from "../../../partilhado/api/assinaturas";
import { ApiError } from "../../../partilhado/api/cliente";
import { apiPrevisualizarEmail } from "../../../partilhado/api/emails";
import { invalidar, useRecurso } from "../../../partilhado/dados/useRecurso";
import { toastError, toastOk } from "../../../partilhado/toastBus";
import { Aviso, Botao, Modal } from "../../../partilhado/ui";
import { INVALIDAR_ASSINATURAS } from "./PainelAssinatura";

const CONTROLO = "h-[38px] border border-linha-forte rounded-lg px-2.5 text-sm text-tinta bg-white w-full min-w-0";

function diasAte(iso: string) {
  const alvo = new Date(`${iso}T23:59:00`);
  return Math.ceil((alvo.getTime() - Date.now()) / 864e5);
}

export function EnviarAssinatura({ contratoId, aberto, onFechar, contrato }: {
  contratoId: number;
  aberto: boolean;
  onFechar: () => void;
  /** Dados já conhecidos do contrato (para mostrar a quem vai e o resumo). */
  contrato?: { clienteNome: string; clienteEmail: string; curso: string };
}) {
  const padrao = useMemo(() => new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10), []);
  const [ate, setAte] = useState(padrao);
  const [nif, setNif] = useState("");
  const [pedeNif, setPedeNif] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aEnviar, setAEnviar] = useState(false);
  useEffect(() => {
    if (aberto) { setAte(padrao); setNif(""); setPedeNif(false); setErro(null); }
  }, [aberto, padrao]);
  const email = useRecurso(aberto ? "emails:previsualizar:assinatura_convite" : null, signal => apiPrevisualizarEmail({ tipo: "assinatura_convite" }, signal));
  const dias = diasAte(ate);

  async function confirmar() {
    const limpo = nif.replace(/\s/g, "");
    if (pedeNif && !/^\d{9}$/.test(limpo)) return setErro("O NIF tem 9 dígitos.");
    if (dias < 1 || dias > 60) return setErro("O prazo tem de ficar entre amanhã e 60 dias.");
    setAEnviar(true);
    setErro(null);
    try {
      const r = await apiEnviarAssinatura(contratoId, { prazoDias: dias, nif: pedeNif ? limpo : undefined });
      for (const p of INVALIDAR_ASSINATURAS) invalidar(p);
      invalidar("crm:contrato");
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
      titulo="Enviar contrato para assinatura"
      largura="xl"
      rodape={(
        <>
          <span className="mr-auto text-xs text-tinta-suave max-w-[420px]">Depois de enviado, o texto fica bloqueado. Para mudar, cancela-se o envio e cria-se uma nova versão.</span>
          <Botao onClick={onFechar}>Cancelar</Botao>
          <Botao variante="primario" aCarregar={aEnviar} onClick={() => void confirmar()}>Enviar por email</Botao>
        </>
      )}
    >
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-5 text-sm">
          {contrato && (
            <p className="m-0 text-tinta-suave">Contrato de formação{contrato.curso ? ` · ${contrato.curso}` : ""}</p>
          )}
          <div className="space-y-1.5">
            <span className="text-[13px] font-semibold text-tinta">Quem assina</span>
            <div className="rounded-lg border border-linha bg-fundo px-3 py-2.5">
              <span className="block font-semibold text-tinta">{contrato?.clienteNome || "Signatário do contrato"}</span>
              <span className="block text-xs text-tinta-suave">{contrato?.clienteEmail || "Email da ficha"} · NIF da ficha</span>
            </div>
            <span className="block text-xs text-tinta-suave">
              O contrato guarda a ligação à ficha (formando ou cliente). Nome, email e NIF vêm sempre da ficha no momento do envio.
            </span>
          </div>

          <fieldset className="m-0 p-0 border-0 space-y-2">
            <legend className="text-[13px] font-semibold text-tinta mb-1.5">Como assina (a pessoa escolhe na ligação)</legend>
            <div className="rounded-lg border border-[#FFB020] bg-[#FFFBF2] px-3 py-2.5">
              <span className="font-semibold text-tinta">No GesForma, com código de confirmação</span> <span className="text-xs text-tinta-suave">· gratuito</span>
              <span className="block text-xs text-tinta-suave mt-1">Abre a ligação, lê, assina no espaço indicado (desenhando ou escrevendo o nome) e confirma com um código enviado para o email da ficha. O PDF final leva o selo digital da entidade e o registo de provas.</span>
            </div>
            <div className="rounded-lg border border-linha px-3 py-2.5">
              <span className="font-semibold text-tinta">Cartão de Cidadão ou Chave Móvel Digital</span> <span className="text-xs text-tinta-suave">· gratuito · qualificada</span>
              <span className="block text-xs text-tinta-suave mt-1">A pessoa descarrega o PDF, assina na aplicação Autenticação.gov e carrega o ficheiro assinado na mesma ligação. O GesForma verifica a assinatura.</span>
            </div>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-tinta">
              Assinar até
              <input className={CONTROLO} type="date" value={ate} min={new Date(Date.now() + 864e5).toISOString().slice(0, 10)} onChange={e => setAte(e.target.value)} />
            </label>
            <div className="flex flex-col gap-1.5 text-[13px] font-semibold text-tinta">
              Código de confirmação
              <span className="h-[38px] inline-flex items-center px-2.5 rounded-lg bg-fundo text-sm font-normal text-tinta-suave">Por email{contrato?.clienteEmail ? `, para ${contrato.clienteEmail}` : ""}</span>
            </div>
          </div>

          {pedeNif && (
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-tinta">
              NIF do signatário
              <input className={CONTROLO} inputMode="numeric" maxLength={11} value={nif} onChange={e => setNif(e.target.value)} autoFocus />
              <span className="text-xs font-normal text-tinta-suave">A ficha não tem NIF. O NIF indicado aqui fica registado como dado pela equipa.</span>
            </label>
          )}
          {erro && <Aviso tom="perigo">{erro}</Aviso>}

          <div className="rounded-lg bg-[#EEF4FB] px-3 py-2.5 text-xs text-tinta leading-normal">
            Fica na Drive só depois de assinado: um único PDF, com o certificado de assinatura na última página — na pasta do formando
            (Turmas › turma › Formandos › nome › Contratos) ou do cliente (Comercial › Clientes › cliente › Contratos).
          </div>
        </div>

        <section aria-label="Email que a pessoa recebe" className="space-y-2">
          <p className="m-0 text-xs font-semibold uppercase tracking-wide text-tinta-suave">O email que a pessoa recebe</p>
          {email.dados ? (
            <div className="rounded-[10px] border border-linha overflow-hidden bg-white">
              <div className="px-3 py-2 border-b border-linha bg-fundo text-xs text-tinta-suave space-y-0.5">
                <div><strong className="text-tinta">De:</strong> {email.dados.de}</div>
                <div><strong className="text-tinta">Assunto:</strong> {email.dados.assunto}</div>
              </div>
              <iframe title="Pré-visualização do email" sandbox="" srcDoc={email.dados.html} className="w-full h-[380px] border-0 bg-white" />
            </div>
          ) : (
            <p className="m-0 text-xs text-tinta-suave">
              {email.erro ? "Sem acesso à pré-visualização. O texto é o modelo «Convite para assinar» em Sistema › Emails automáticos." : "A carregar…"}
            </p>
          )}
        </section>
      </div>
    </Modal>
  );
}
