// Passos da assinatura na ligação pessoal: escolher como assinar, confirmar com o código do email, ou enviar o PDF assinado com CC/CMD.
import { useState } from "react";
import { apiAssinar, apiEnviarAssinadoExterno, apiPedirCodigo, urlPdfPublico, type PedidoPublico } from "../partilhado/api/assinaturas";
import { ApiError } from "../partilhado/api/cliente";
import { Aviso, Botao, BotaoLigacao, Campo, Entrada, Separadores } from "../partilhado/ui";
import { AssinaturaPad } from "./AssinaturaPad";

type Metodo = "desenhada" | "escrita" | "cc_cmd";
export type Concluido = { codigoVerificacao: string; urlVerificacao: string };

const msg = (e: unknown, alt: string) => (e instanceof ApiError ? e.message : alt);

export function AssinarPassos({ token, pedido, onAssinado }: { token: string; pedido: PedidoPublico; onAssinado: (r: Concluido) => void }) {
  const [metodo, setMetodo] = useState<Metodo>("desenhada");
  const [imagem, setImagem] = useState<string | null>(null);
  const [nome, setNome] = useState(pedido.signatario.nome);
  const [aceito, setAceito] = useState(false);
  const [codigoEnviado, setCodigoEnviado] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aCorrer, setACorrer] = useState(false);
  const [ficheiro, setFicheiro] = useState<File | null>(null);

  const pronto = aceito && (metodo === "desenhada" ? Boolean(imagem) : nome.trim().length >= 3);

  async function pedirCodigo() {
    setErro(null);
    setACorrer(true);
    try {
      const r = await apiPedirCodigo(token);
      setCodigoEnviado(r.enviadoPara);
    } catch (e) {
      setErro(msg(e, "Não foi possível enviar o código. Tente de novo dentro de um minuto."));
    } finally {
      setACorrer(false);
    }
  }

  async function assinar() {
    if (metodo === "cc_cmd") return;
    if (!/^\d{6}$/.test(codigo.trim())) return setErro("O código tem 6 dígitos.");
    setErro(null);
    setACorrer(true);
    try {
      const r = await apiAssinar(token, {
        metodo, codigo: codigo.trim(), aceito: true,
        ...(metodo === "desenhada" ? { imagem: imagem ?? "" } : { nomeEscrito: nome.trim() }),
      });
      onAssinado(r);
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
      onAssinado(await apiEnviarAssinadoExterno(token, ficheiro));
    } catch (e) {
      setErro(msg(e, "Não foi possível receber o PDF assinado."));
    } finally {
      setACorrer(false);
    }
  }

  return (
    <section aria-labelledby="como-assinar" className="space-y-5">
      <h2 id="como-assinar" className="m-0 text-lg font-semibold text-tinta">Como quer assinar?</h2>
      <Separadores
        estilo="pilula"
        rotulo="Forma de assinar"
        ativo={metodo}
        onMudar={m => { setMetodo(m); setErro(null); }}
        itens={[
          { id: "desenhada", rotulo: "Desenhar" },
          { id: "escrita", rotulo: "Escrever o nome" },
          { id: "cc_cmd", rotulo: "Cartão de Cidadão / CMD" },
        ]}
      />

      {metodo === "desenhada" && <AssinaturaPad onMudar={setImagem} />}
      {metodo === "escrita" && (
        <div className="space-y-3">
          <Campo rotulo="Nome completo">{p => <Entrada {...p} value={nome} onChange={e => setNome(e.target.value)} autoComplete="name" />}</Campo>
          <p aria-hidden="true" className="m-0 rounded-cartao border border-linha bg-white px-5 py-4 text-3xl italic text-tinta" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
            {nome || " "}
          </p>
        </div>
      )}
      {metodo === "cc_cmd" && (
        <div className="space-y-3 text-sm text-tinta">
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
          <Campo rotulo="PDF assinado">
            {p => <input {...p} type="file" accept="application/pdf,.pdf" className="text-sm" onChange={e => setFicheiro(e.target.files?.[0] ?? null)} />}
          </Campo>
          <p className="m-0 text-xs text-tinta-suave">A assinatura com o Cartão de Cidadão ou a Chave Móvel Digital é qualificada: tem o mesmo valor da assinatura manuscrita.</p>
          {erro && <Aviso tom="perigo">{erro}</Aviso>}
          <Botao variante="primario" disabled={!ficheiro} aCarregar={aCorrer} onClick={() => void enviarExterno()}>Enviar PDF assinado</Botao>
        </div>
      )}

      {metodo !== "cc_cmd" && (
        <div className="space-y-4">
          <label className="flex items-start gap-2.5 text-sm text-tinta">
            <input type="checkbox" className="mt-0.5 h-4 w-4" checked={aceito} onChange={e => setAceito(e.target.checked)} />
            <span>Li o documento «{pedido.titulo}» e aceito assiná-lo eletronicamente.</span>
          </label>
          {!codigoEnviado ? (
            <Botao variante="primario" disabled={!pronto} aCarregar={aCorrer} onClick={() => void pedirCodigo()}>Receber código por email</Botao>
          ) : (
            <div className="space-y-3">
              <p className="m-0 text-sm text-tinta">Enviámos um código de 6 dígitos para <strong>{codigoEnviado}</strong>. É válido durante {pedido.codigoMinutos} minutos.</p>
              <Campo rotulo="Código">
                {p => <Entrada {...p} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={codigo} onChange={e => setCodigo(e.target.value.replace(/\D/g, ""))} className="max-w-[160px] tracking-[0.3em] text-lg" />}
              </Campo>
              <div className="flex gap-2 flex-wrap items-center">
                <Botao variante="primario" disabled={!pronto || codigo.length !== 6} aCarregar={aCorrer} onClick={() => void assinar()}>Assinar documento</Botao>
                <button type="button" className="text-sm font-semibold text-ligacao hover:underline" disabled={aCorrer} onClick={() => void pedirCodigo()}>Enviar outro código</button>
              </div>
            </div>
          )}
          {erro && <Aviso tom="perigo">{erro}</Aviso>}
        </div>
      )}
    </section>
  );
}
