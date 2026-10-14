// Página pública de assinatura (/assinar/:token): aviso no topo, o contrato como folha, o espaço "Assinar aqui"
// no fim e, depois de assinado, a cópia para descarregar.
import { useEffect, useState } from "react";
import { ROTULO_ESTADO, apiPedidoPublico, apiRecusar, urlPdfPublico, type PedidoPublico } from "../partilhado/api/assinaturas";
import { ApiError } from "../partilhado/api/cliente";
import { urlLogoEntidade } from "../partilhado/logoEntidade";
import { AreaTexto, Aviso, Botao, BotaoLigacao, Campo, Modal, dataHora } from "../partilhado/ui";
import { AssinarPassos, type Concluido } from "./AssinarPassos";

const FUNDO = "#F4F1EA";

export function AssinarContrato({ token }: { token: string }) {
  const [pedido, setPedido] = useState<PedidoPublico | null>(null);
  const [estado, setEstado] = useState<"a-carregar" | "pronto" | "invalida" | "erro">("a-carregar");
  const [concluido, setConcluido] = useState<Concluido | null>(null);
  const [assinar, setAssinar] = useState(false);
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

  const aberto = pedido && (pedido.estado === "aberto" || pedido.estado === "enviado") && !concluido;
  const assinado = Boolean(concluido) || pedido?.estado === "assinado";
  const primeiro = pedido?.signatario.nome.split(/\s+/)[0] ?? "";

  return (
    <div className="min-h-screen text-tinta" style={{ background: FUNDO }}>
      <header className="bg-white border-b border-[#E6E0D3]">
        <div className="mx-auto max-w-[860px] px-4 sm:px-6 h-16 flex items-center gap-3">
          <img src={urlLogoEntidade()} alt={pedido?.entidade ?? "Entidade formadora"} className="h-9 w-auto" />
          <span className="ml-auto text-sm text-tinta-suave">{pedido?.titulo.split(" · ")[0] ?? "Contrato"}</span>
        </div>
      </header>

      <main className="mx-auto max-w-[860px] px-4 sm:px-6 py-7 space-y-5">
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
            {aberto && (
              <div className="rounded-xl bg-white border border-[#E6E0D3] p-5 flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[240px]">
                  <p className="m-0 text-xs font-semibold uppercase tracking-wider text-[#9A5B00]">Falta a sua assinatura</p>
                  <p className="m-0 mt-1 text-xl font-semibold">Olá, {primeiro}</p>
                  <p className="m-0 mt-1 text-sm text-tinta-suave leading-relaxed">
                    Leia o documento «{pedido.titulo}» e assine no espaço indicado, no fim.
                    {pedido.expiraEm ? ` A ligação é válida até ${dataHora(pedido.expiraEm)}.` : ""}
                  </p>
                </div>
                <a href="#assinar" className="h-11 px-5 rounded-lg bg-[#FFB020] text-tinta font-semibold inline-flex items-center no-underline">Ir para a assinatura</a>
              </div>
            )}
            {assinado && (
              <div role="status" className="rounded-xl bg-[#F3FAF6] border border-[#B9DCC8] p-5 flex flex-wrap items-center gap-4">
                <span aria-hidden="true" className="w-10 h-10 rounded-full bg-[#1F7A4D] text-white inline-flex items-center justify-center text-lg">✓</span>
                <div className="flex-1 min-w-[220px]">
                  <p className="m-0 text-lg font-semibold">Contrato assinado</p>
                  <p className="m-0 mt-0.5 text-sm text-tinta-suave">
                    Enviámos a confirmação para {pedido.signatario.email}.
                    {(concluido?.codigoVerificacao ?? pedido.codigoVerificacao) ? ` Código de verificação: ${concluido?.codigoVerificacao ?? pedido.codigoVerificacao}.` : ""}
                  </p>
                </div>
                <BotaoLigacao variante="primario" href={urlPdfPublico(token, "assinado")}>Descarregar PDF assinado</BotaoLigacao>
              </div>
            )}
            {!aberto && !assinado && (
              <Aviso tom={pedido.estado === "recusado" ? "aviso" : "info"} titulo={ROTULO_ESTADO[pedido.estado]}>
                {pedido.estado === "recusado" && "Recusou assinar este documento. Se mudou de ideias, peça à entidade um novo envio."}
                {pedido.estado === "expirado" && "A ligação expirou. Peça à entidade um novo envio."}
                {pedido.estado === "cancelado" && "A entidade cancelou este pedido. Se recebeu um email mais recente, use essa ligação."}
              </Aviso>
            )}

            {(aberto || assinado) && (
              <article aria-label="Contrato" className="bg-white rounded-sm shadow-[0_1px_3px_rgba(16,27,45,0.12)] overflow-hidden">
                <iframe title={pedido.titulo} src={`${urlPdfPublico(token, assinado ? "assinado" : "original", true)}#navpanes=0&view=FitH`} className="block w-full h-[78vh] min-h-[520px] border-0 bg-white" />
                <div className="flex items-center gap-3 flex-wrap px-4 py-3 border-t border-linha text-sm">
                  <span className="text-tinta-suave flex-1 min-w-0">Não consegue ver o documento?</span>
                  <a className="font-semibold text-ligacao" href={urlPdfPublico(token, assinado ? "assinado" : "original", true)} target="_blank" rel="noopener noreferrer">Abrir o PDF</a>
                </div>
              </article>
            )}

            {(aberto || assinado) && (
              <section id="assinar" aria-label="Assinaturas" className="rounded-xl bg-white border border-[#E6E0D3] p-5 grid gap-6 sm:grid-cols-2">
                <div>
                  <div className="h-24 flex items-end text-sm text-tinta-suave">Selo digital da entidade, aplicado ao PDF final</div>
                  <div className="border-t border-tinta pt-1.5 text-xs text-tinta-suave">Pela {pedido.entidade}</div>
                </div>
                <div>
                  <div className="h-24 flex items-end">
                    {aberto ? (
                      <button type="button" onClick={() => setAssinar(true)}
                        className="w-full h-20 rounded-lg border-2 border-dashed border-[#FFB020] bg-[#FFFBF2] text-[#7A4A00] font-semibold cursor-pointer hover:bg-[#FFF4DB]">
                        ✍ Assinar aqui
                      </button>
                    ) : concluido?.imagem ? (
                      <img src={concluido.imagem} alt="A sua assinatura" className="max-h-20 w-auto" />
                    ) : (
                      <span className="text-3xl italic" style={{ fontFamily: '"GF Serif", Georgia, serif' }}>{concluido?.nome || pedido.signatario.nome}</span>
                    )}
                  </div>
                  <div className="border-t border-tinta pt-1.5 text-xs text-tinta-suave">
                    {pedido.signatario.nome}
                    {assinado && (pedido.assinadoEm || concluido) ? <><br />Assinado eletronicamente{pedido.assinadoEm ? ` a ${dataHora(pedido.assinadoEm)}` : ""}</> : null}
                  </div>
                </div>
              </section>
            )}

            {aberto && (
              <div className="text-center">
                <button type="button" className="border-0 bg-transparent text-sm text-tinta-suave hover:text-perigo underline cursor-pointer" onClick={() => setRecusar(true)}>Não quero assinar este documento</button>
              </div>
            )}
            <p className="m-0 text-xs text-tinta-suave leading-relaxed">
              A assinatura fica registada com a data, a hora, o código confirmado e a impressão digital do documento. O PDF final leva o selo digital da entidade.
              Os seus dados são tratados apenas para a assinatura deste documento.
            </p>
            {pedido && aberto && <AssinarPassos token={token} pedido={pedido} aberto={assinar} onFechar={() => setAssinar(false)} onAssinado={r => { setAssinar(false); setConcluido(r); }} />}
          </>
        )}
      </main>
      <Recusar token={token} aberto={recusar} onFechar={() => setRecusar(false)} onFeito={() => { setRecusar(false); void carregar(); }} />
    </div>
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
