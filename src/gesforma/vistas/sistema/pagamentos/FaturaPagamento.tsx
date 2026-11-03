// Dados de faturação e fatura de um pagamento: a contabilidade anexa o PDF da fatura e envia-o, em anexo, para o email
// da faturação e para o da pessoa. A fatura pode ser anexada logo ao confirmar o pagamento ou mais tarde.
import { useEffect, useState } from "react";
import {
  apiAnexarFatura, apiEnviarFatura, urlFicheiro, type FaturaPagamento as Fatura, type FaturacaoPagamento,
} from "../../../../partilhado/api/pagamentos";
import { useAccao } from "../../../../partilhado/dados/useAccao";
import { Aviso, Botao, BotaoLigacao, Caixa, Campo, Detalhes, Entrada, Estado, Modal, dataHora } from "../../../../partilhado/ui";

const INVALIDAR = ["pagamentos:"];
const lista = (emails: string[]) => (emails.length > 1 ? `${emails.slice(0, -1).join(", ")} e ${emails[emails.length - 1]}` : emails[0] ?? "");

/** Os dados para a fatura: confirmados pela pessoa (ligação pessoal) ou, por confirmar, os da ficha. */
export function DadosFaturacaoPagamento({ faturacao }: { faturacao: FaturacaoPagamento | null }) {
  if (!faturacao) return null;
  const d = faturacao.dados;
  return (
    <section aria-label="Dados de faturação" className="rounded-cartao border border-linha p-4">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="m-0 text-[13px] font-semibold text-tinta flex-1">Dados de faturação</p>
        {faturacao.confirmado
          ? <Estado tom="sucesso">Confirmados pela pessoa</Estado>
          : <Estado tom="aviso">Por confirmar</Estado>}
      </div>
      {!faturacao.confirmado && (
        <p className="m-0 mt-1 text-xs text-tinta-suave">A pessoa ainda não os confirmou na ligação pessoal: são os da ficha da pré-inscrição.</p>
      )}
      <div className="mt-2">
        <Detalhes itens={[
          { rotulo: "Nome ou empresa", valor: d.nome || "—" },
          { rotulo: "NIF", valor: d.nif || "—" },
          { rotulo: "Morada fiscal", valor: [d.moradaFiscal, d.codigoPostal].filter(Boolean).join(", ") || "—" },
          { rotulo: "Email da fatura", valor: d.email || "—" },
        ]} />
      </div>
    </section>
  );
}

/** A fatura do pagamento: abrir, enviar de novo ou substituir; sem ela, anexar. */
export function FaturaPagamento({ pagamentoId, fatura, destinos, podeFaturar, onAnexar }: {
  pagamentoId: string;
  fatura: Fatura | null;
  destinos: string[];
  podeFaturar: boolean;
  onAnexar: () => void;
}) {
  const reenviar = useAccao(() => apiEnviarFatura(pagamentoId), {
    ok: r => `Fatura enviada para ${lista(r.enviadaPara)}.`, invalidar: INVALIDAR,
  });
  return (
    <section aria-label="Fatura" className="rounded-cartao border border-linha p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="m-0 text-[13px] font-semibold text-tinta flex-1">Fatura</p>
        {fatura?.numero && <span className="text-xs text-tinta-suave num">N.º {fatura.numero}</span>}
      </div>
      {fatura ? (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-tinta truncate flex-1 min-w-0">{fatura.nome}</span>
            <BotaoLigacao tamanho="sm" href={urlFicheiro(fatura.driveFileId)} target="_blank" rel="noreferrer">Abrir</BotaoLigacao>
          </div>
          <p className="m-0 text-[13px] text-tinta-suave">
            Anexada {dataHora(fatura.anexadaEm)}
            {fatura.enviadaEm ? ` · enviada para ${fatura.enviadaPara} em ${dataHora(fatura.enviadaEm)}` : " · ainda não enviada"}
          </p>
          {podeFaturar && (
            <div className="flex gap-2 flex-wrap">
              <Botao tamanho="sm" variante="secundario" aCarregar={reenviar.aCorrer} disabled={!destinos.length}
                title={destinos.length ? `Para ${lista(destinos)}` : "Sem email para onde enviar"}
                onClick={() => void reenviar.correr()}>
                {fatura.enviadaEm ? "Enviar de novo" : "Enviar por email"}
              </Botao>
              <Botao tamanho="sm" variante="fantasma" onClick={onAnexar}>Substituir</Botao>
            </div>
          )}
        </>
      ) : (
        <div className="flex items-center gap-3 flex-wrap">
          <p className="m-0 text-[13px] text-tinta-suave flex-1 min-w-[12rem]">Ainda sem fatura.</p>
          {podeFaturar && <Botao tamanho="sm" variante="primario" onClick={onAnexar}>Anexar fatura</Botao>}
        </div>
      )}
    </section>
  );
}

/**
 * Janela para anexar a fatura (PDF). Abre-se sozinha ao confirmar o pagamento (`aposConfirmar`): a fatura pode ser
 * anexada logo ou mais tarde. Com «Enviar já», segue por email para o email da faturação e o da pessoa.
 */
export function AnexarFatura({ aberto, onFechar, pagamentoId, destinos, substituir, aposConfirmar }: {
  aberto: boolean;
  onFechar: () => void;
  pagamentoId: string;
  destinos: string[];
  substituir: boolean;
  aposConfirmar: boolean;
}) {
  const [ficheiro, setFicheiro] = useState<File | null>(null);
  const [numero, setNumero] = useState("");
  const [enviarJa, setEnviarJa] = useState(true);
  const anexar = useAccao((f: File) => apiAnexarFatura(pagamentoId, f, { numero: numero.trim(), enviar: enviarJa && destinos.length > 0 }), {
    ok: r => (r.enviadaPara.length ? `Fatura anexada e enviada para ${lista(r.enviadaPara)}.` : "Fatura anexada."),
    invalidar: INVALIDAR,
  });
  useEffect(() => {
    if (aberto) { setFicheiro(null); setNumero(""); setEnviarJa(true); }
  }, [aberto]);
  const pdf = !ficheiro || /\.pdf$/i.test(ficheiro.name) || ficheiro.type === "application/pdf";

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo={substituir ? "Substituir a fatura" : "Anexar a fatura"}
      largura="sm"
      rodape={(
        <>
          <Botao onClick={onFechar}>{aposConfirmar ? "Anexar mais tarde" : "Cancelar"}</Botao>
          <Botao variante="primario" disabled={!ficheiro || !pdf} aCarregar={anexar.aCorrer}
            onClick={() => ficheiro && void anexar.correr(ficheiro).then(r => { if (r) onFechar(); })}>
            {enviarJa && destinos.length ? "Anexar e enviar" : "Anexar"}
          </Botao>
        </>
      )}
    >
      <div className="space-y-3">
        {aposConfirmar && (
          <Aviso tom="sucesso" titulo="Pagamento confirmado">A inscrição ficou concluída. Pode anexar a fatura agora ou mais tarde, aqui em Pagamentos.</Aviso>
        )}
        <Campo rotulo="Fatura (PDF)" obrigatorio erro={pdf ? undefined : "Escolha um ficheiro PDF."}>
          {a => <input {...a} type="file" accept="application/pdf,.pdf" className="text-sm" onChange={e => setFicheiro(e.target.files?.[0] ?? null)} />}
        </Campo>
        <Campo rotulo="N.º da fatura" ajuda="Opcional: aparece no assunto do email.">
          {a => <Entrada {...a} value={numero} maxLength={40} placeholder="Ex.: FT 2026/123" onChange={e => setNumero(e.target.value)} />}
        </Campo>
        {destinos.length > 0 ? (
          <Caixa rotulo={`Enviar já por email para ${lista(destinos)}`} ajuda="Com a fatura em anexo. O texto edita-se em Sistema › Emails › Modelos («Fatura»)."
            checked={enviarJa} onChange={e => setEnviarJa(e.target.checked)} />
        ) : (
          <p className="m-0 text-[13px] text-tinta-suave">Sem email da pessoa nem da faturação: a fatura fica anexada, sem envio.</p>
        )}
        {substituir && <p className="m-0 text-xs text-tinta-suave">A fatura anterior deixa de aparecer aqui; o ficheiro continua na Drive.</p>}
      </div>
    </Modal>
  );
}
