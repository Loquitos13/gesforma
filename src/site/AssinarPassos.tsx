// Janela "Assinar": desenhar ou escrever o nome, aceitar, e confirmar com o código enviado por email.
// Em alternativa, assinar com Cartão de Cidadão / Chave Móvel Digital e enviar o PDF assinado.
import { useState } from "react";
import { apiAssinar, apiEnviarAssinadoExterno, apiPedirCodigo, urlPdfPublico, type PedidoPublico } from "../partilhado/api/assinaturas";
import { ApiError } from "../partilhado/api/cliente";
import { Aviso, Botao, BotaoLigacao, Modal } from "../partilhado/ui";
import { AssinaturaPad } from "./AssinaturaPad";

type Metodo = "desenhada" | "escrita" | "cc_cmd";
export type Concluido = { codigoVerificacao: string; urlVerificacao: string; metodo: "desenhada" | "escrita" | "cc_cmd"; imagem?: string | null; nome?: string };

const msg = (e: unknown, alt: string) => (e instanceof ApiError ? e.message : alt);
const CONTROLO = "h-11 border border-linha-forte rounded-lg px-3 text-base text-tinta bg-white w-full";

export function AssinarPassos({ token, pedido, aberto, onFechar, onAssinado }: {
  token: string;
  pedido: PedidoPublico;
  aberto: boolean;
  onFechar: () => void;
  onAssinado: (r: Concluido) => void;
}) {
  const [metodo, setMetodo] = useState<Metodo>("desenhada");
  const [passo, setPasso] = useState<"assinar" | "codigo">("assinar");
  const [imagem, setImagem] = useState<string | null>(null);
  const [nome, setNome] = useState(pedido.signatario.nome);
  const [aceito, setAceito] = useState(false);
  const [enviadoPara, setEnviadoPara] = useState("");
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aCorrer, setACorrer] = useState(false);
  const [ficheiro, setFicheiro] = useState<File | null>(null);
  const primeiro = pedido.signatario.nome.split(/\s+/)[0] ?? "";
  const pronto = aceito && (metodo === "desenhada" ? Boolean(imagem) : nome.trim().length >= 3);

  async function pedirCodigo() {
    setErro(null);
    setACorrer(true);
    try {
      const r = await apiPedirCodigo(token);
      setEnviadoPara(r.enviadoPara);
      setPasso("codigo");
    } catch (e) {
      setErro(msg(e, "Não foi possível enviar o código. Tente de novo dentro de um minuto."));
    } finally {
      setACorrer(false);
    }
  }

  async function assinar() {
    if (metodo === "cc_cmd") return;
    if (!/^\d{6}$/.test(codigo.trim())) return setErro("O código tem 6 algarismos.");
    setErro(null);
    setACorrer(true);
    try {
      const r = await apiAssinar(token, {
        metodo, codigo: codigo.trim(), aceito: true,
        ...(metodo === "desenhada" ? { imagem: imagem ?? "" } : { nomeEscrito: nome.trim() }),
      });
      onAssinado({ ...r, metodo, imagem, nome: nome.trim() });
    } catch (e) {
      setErro(msg(e, "Não foi possível assinar. Tente de novo."));
    } finally {
      setACorrer(false);
    }
  }

  async function enviarExterno() {
    if (!ficheiro) return;
    setErro(null);
    setACorrer(true);
    try {
      const r = await apiEnviarAssinadoExterno(token, ficheiro);
      onAssinado({ ...r, metodo: "cc_cmd" });
    } catch (e) {
      setErro(msg(e, "Não foi possível receber o PDF assinado."));
    } finally {
      setACorrer(false);
    }
  }

  const titulo = metodo === "cc_cmd" ? "Assinar com Cartão de Cidadão ou CMD" : passo === "codigo" ? "Confirmar com o código" : "Assinar o contrato";

  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo={titulo}>
      {metodo !== "cc_cmd" && passo === "assinar" && (
        <div className="space-y-4">
          <div role="tablist" aria-label="Forma de assinar" className="inline-flex border border-linha-forte rounded-lg overflow-hidden">
            {(["desenhada", "escrita"] as const).map((m, i) => (
              <button key={m} type="button" role="tab" aria-selected={metodo === m} onClick={() => { setMetodo(m); setErro(null); }}
                className={`h-10 px-4 border-0 text-sm font-semibold cursor-pointer ${i ? "border-l border-linha-forte" : ""} ${metodo === m ? "bg-tinta text-white" : "bg-white text-tinta"}`}>
                {m === "desenhada" ? "Desenhar" : "Escrever o nome"}
              </button>
            ))}
          </div>
          {metodo === "desenhada" ? <AssinaturaPad onMudar={setImagem} /> : (
            <div className="space-y-3">
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-tinta">
                Nome completo
                <input className={CONTROLO} value={nome} onChange={e => setNome(e.target.value)} autoComplete="name" />
              </label>
              <p aria-hidden="true" className="m-0 rounded-lg border border-linha bg-white px-5 py-4 text-3xl italic text-tinta" style={{ fontFamily: '"GF Serif", Georgia, serif' }}>{nome || " "}</p>
            </div>
          )}
          <label className="flex items-start gap-2.5 text-sm text-tinta">
            <input type="checkbox" className="mt-0.5 h-4 w-4" checked={aceito} onChange={e => setAceito(e.target.checked)} />
            <span>Li o contrato e aceito assiná-lo eletronicamente. Esta assinatura tem o mesmo propósito da minha assinatura em papel.</span>
          </label>
          {erro && <Aviso tom="perigo">{erro}</Aviso>}
          <Botao variante="primario" className="w-full" disabled={!pronto} aCarregar={aCorrer} onClick={() => void pedirCodigo()}>Continuar</Botao>
          <button type="button" onClick={() => { setMetodo("cc_cmd"); setErro(null); }} className="block mx-auto border-0 bg-transparent p-0 text-sm font-semibold text-ligacao cursor-pointer hover:underline">
            Prefere assinar com Cartão de Cidadão ou Chave Móvel Digital?
          </button>
        </div>
      )}

      {metodo !== "cc_cmd" && passo === "codigo" && (
        <div className="space-y-4">
          <p className="m-0 text-sm text-tinta leading-relaxed">
            Enviámos um código de 6 algarismos para o seu email, <strong>{enviadoPara}</strong>. Introduza-o para confirmar que é {primeiro || "o signatário"} quem assina.
            É válido durante {pedido.codigoMinutos} minutos. Se não o vir, procure no lixo electrónico.
          </p>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-tinta">
            Código
            <input className={`${CONTROLO} num max-w-[200px] tracking-[0.35em] text-xl`} inputMode="numeric" autoComplete="one-time-code" maxLength={6}
              value={codigo} onChange={e => setCodigo(e.target.value.replace(/\D/g, ""))} autoFocus />
          </label>
          <div className="flex gap-4 text-sm">
            <button type="button" disabled={aCorrer} onClick={() => void pedirCodigo()} className="border-0 bg-transparent p-0 font-semibold text-ligacao cursor-pointer hover:underline">Reenviar código</button>
            <button type="button" onClick={() => { setPasso("assinar"); setCodigo(""); setErro(null); }} className="border-0 bg-transparent p-0 text-tinta-suave cursor-pointer hover:text-tinta">Voltar</button>
          </div>
          {erro && <Aviso tom="perigo">{erro}</Aviso>}
          <Botao variante="primario" className="w-full" disabled={codigo.length !== 6} aCarregar={aCorrer} onClick={() => void assinar()}>Confirmar e assinar</Botao>
        </div>
      )}

      {metodo === "cc_cmd" && (
        <div className="space-y-4 text-sm text-tinta">
          <ol className="m-0 pl-5 space-y-1.5">
            <li>Descarregue o PDF e não o altere.</li>
            <li>Abra a aplicação gratuita Autenticação.gov e escolha «Assinatura digital».</li>
            <li>Assine com o Cartão de Cidadão (leitor de cartões) ou com a Chave Móvel Digital.</li>
            <li>Envie aqui o PDF assinado.</li>
          </ol>
          <div className="flex gap-2 flex-wrap">
            <BotaoLigacao href={urlPdfPublico(token, "original")}>Descarregar PDF</BotaoLigacao>
            <BotaoLigacao variante="fantasma" href="https://www.autenticacao.gov.pt/web/guest/cc-aplicacao" target="_blank" rel="noopener noreferrer">Obter a aplicação</BotaoLigacao>
          </div>
          <label className="flex flex-col gap-1.5 font-semibold">
            PDF assinado
            <input type="file" accept="application/pdf,.pdf" className="text-sm font-normal" onChange={e => setFicheiro(e.target.files?.[0] ?? null)} />
          </label>
          <p className="m-0 text-xs text-tinta-suave">A assinatura com o Cartão de Cidadão ou a Chave Móvel Digital é qualificada: tem o mesmo valor da assinatura manuscrita.</p>
          {erro && <Aviso tom="perigo">{erro}</Aviso>}
          <Botao variante="primario" className="w-full" disabled={!ficheiro} aCarregar={aCorrer} onClick={() => void enviarExterno()}>Enviar PDF assinado</Botao>
          <button type="button" onClick={() => { setMetodo("desenhada"); setPasso("assinar"); setErro(null); }} className="block mx-auto border-0 bg-transparent p-0 text-sm font-semibold text-ligacao cursor-pointer hover:underline">
            Assinar aqui, desenhando ou escrevendo o nome
          </button>
        </div>
      )}
    </Modal>
  );
}
