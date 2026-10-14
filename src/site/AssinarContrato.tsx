// Página pública de assinatura (/assinar/:token): ler o documento, assinar e descarregar a cópia assinada.
import { useEffect, useState } from "react";
import { ROTULO_ESTADO, apiPedidoPublico, apiRecusar, urlPdfPublico, type PedidoPublico } from "../partilhado/api/assinaturas";
import { ApiError } from "../partilhado/api/cliente";
import { AreaTexto, Aviso, Botao, BotaoLigacao, Campo, Modal, dataHora } from "../partilhado/ui";
import { AssinarPassos, type Concluido } from "./AssinarPassos";

export function AssinarContrato({ token }: { token: string }) {
  const [pedido, setPedido] = useState<PedidoPublico | null>(null);
  const [estado, setEstado] = useState<"a-carregar" | "pronto" | "invalida" | "erro">("a-carregar");
  const [concluido, setConcluido] = useState<Concluido | null>(null);
  const [recusar, setRecusar] = useState(false);

  async function carregar() {
    try {
      setPedido(await apiPedidoPublico(token));
      setEstado("pronto");
    } catch (e) {
      setEstado(e instanceof ApiError && e.status === 404 ? "invalida" : "erro");
    }
  }
  useEffect(() => { void carregar(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-fundo px-4 py-8 sm:px-8 text-tinta">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <header className="flex items-center gap-3">
          <img src="/api/v1/public/entidade/logo" alt="" className="h-9 w-auto" onError={e => { (e.currentTarget as HTMLImageElement).src = "/imagens/ena-logo-nobg.png"; }} />
          {pedido && <span className="text-sm text-tinta-suave">{pedido.entidade}</span>}
        </header>

        {estado === "a-carregar" && <p className="text-sm text-tinta-suave">A abrir o documento…</p>}
        {estado === "invalida" && (
          <Aviso tom="perigo" titulo="Ligação inválida">Esta ligação não existe ou foi substituída por uma mais recente. Use a ligação do último email recebido.</Aviso>
        )}
        {estado === "erro" && (
          <Aviso tom="perigo" titulo="Não foi possível abrir" acao={<Botao tamanho="sm" onClick={() => void carregar()}>Tentar de novo</Botao>}>
            Verifique a ligação à internet e tente de novo.
          </Aviso>
        )}

        {pedido && estado === "pronto" && (
          <>
            <div>
              <p className="m-0 text-xs font-semibold uppercase tracking-wider text-aviso">Documento para assinar</p>
              <h1 className="m-0 mt-1 text-2xl font-semibold">{pedido.titulo}</h1>
              <p className="m-0 mt-1 text-sm text-tinta-suave">
                Para {pedido.signatario.nome} · {pedido.signatario.email}
                {pedido.expiraEm && (pedido.estado === "aberto" || pedido.estado === "enviado") ? ` · válido até ${dataHora(pedido.expiraEm)}` : ""}
              </p>
            </div>

            {concluido || pedido.estado === "assinado" ? (
              <Assinado token={token} codigo={concluido?.codigoVerificacao ?? pedido.codigoVerificacao} url={concluido?.urlVerificacao ?? pedido.urlVerificacao} />
            ) : pedido.estado === "aberto" || pedido.estado === "enviado" ? (
              <>
                <section aria-label="Documento" className="rounded-cartao border border-linha bg-superficie overflow-hidden">
                  <iframe title={pedido.titulo} src={urlPdfPublico(token, "original", true)} className="hidden sm:block w-full h-[70vh] border-0 bg-white" />
                  <div className="flex items-center gap-3 flex-wrap p-3 border-t border-linha">
                    <span className="text-sm text-tinta-suave flex-1 min-w-0">Leia o documento até ao fim antes de assinar.</span>
                    <BotaoLigacao tamanho="sm" href={urlPdfPublico(token, "original", true)} target="_blank" rel="noopener noreferrer">Abrir PDF</BotaoLigacao>
                  </div>
                </section>
                <div className="rounded-cartao border border-linha bg-superficie p-5">
                  <AssinarPassos token={token} pedido={pedido} onAssinado={setConcluido} />
                </div>
                <div className="text-center">
                  <button type="button" className="text-sm text-tinta-suave hover:text-perigo underline" onClick={() => setRecusar(true)}>Não quero assinar este documento</button>
                </div>
              </>
            ) : (
              <Aviso tom={pedido.estado === "recusado" ? "aviso" : "info"} titulo={ROTULO_ESTADO[pedido.estado]}>
                {pedido.estado === "recusado" && "Recusou assinar este documento. Se mudou de ideias, peça à entidade um novo envio."}
                {pedido.estado === "expirado" && "A ligação expirou. Peça à entidade um novo envio."}
                {pedido.estado === "cancelado" && "A entidade cancelou este pedido. Se recebeu um email mais recente, use essa ligação."}
              </Aviso>
            )}
          </>
        )}

        <p className="m-0 pt-4 text-xs text-tinta-suave">
          Os seus dados são tratados pela entidade formadora apenas para a assinatura deste documento. Cada passo fica registado (data, IP e navegador) como prova da assinatura.
        </p>
      </div>
      <Recusar token={token} aberto={recusar} onFechar={() => setRecusar(false)} onFeito={() => { setRecusar(false); void carregar(); }} />
    </div>
  );
}

function Assinado({ token, codigo, url }: { token: string; codigo: string | null; url: string | null }) {
  return (
    <Aviso tom="sucesso" titulo="Documento assinado">
      <div className="space-y-3">
        <p className="m-0">Obrigado. Enviámos-lhe a confirmação por email. Guarde a cópia assinada.</p>
        <div className="flex gap-2 flex-wrap">
          <BotaoLigacao variante="primario" href={urlPdfPublico(token, "assinado")}>Descarregar cópia assinada</BotaoLigacao>
          {url && <BotaoLigacao variante="fantasma" href={url}>Verificar</BotaoLigacao>}
        </div>
        {codigo && <p className="m-0 text-sm">Código de verificação: <strong className="tracking-wider">{codigo}</strong></p>}
      </div>
    </Aviso>
  );
}

function Recusar({ token, aberto, onFechar, onFeito }: { token: string; aberto: boolean; onFechar: () => void; onFeito: () => void }) {
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aCorrer, setACorrer] = useState(false);
  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo="Recusar a assinatura"
      rodape={(
        <>
          <Botao onClick={onFechar}>Voltar</Botao>
          <Botao variante="perigo" aCarregar={aCorrer} onClick={async () => {
            setACorrer(true);
            try {
              await apiRecusar(token, motivo.trim());
              onFeito();
            } catch (e) {
              setErro(e instanceof ApiError ? e.message : "Não foi possível registar.");
            } finally {
              setACorrer(false);
            }
          }}>Recusar</Botao>
        </>
      )}
    >
      <div className="space-y-3 text-sm">
        <p className="m-0">A entidade é avisada de que não assinou. Pode dizer porquê (opcional).</p>
        <Campo rotulo="Motivo">{p => <AreaTexto {...p} maxLength={500} value={motivo} onChange={e => setMotivo(e.target.value)} />}</Campo>
        {erro && <Aviso tom="perigo">{erro}</Aviso>}
      </div>
    </Modal>
  );
}
