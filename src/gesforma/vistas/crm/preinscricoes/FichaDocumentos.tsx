import { useState } from "react";
import { Aviso, Botao, ConfirmarPerigo, Entrada, Estado, Vazio, dataHora, eur } from "../../../../partilhado/ui";
import { apiAlertarDocs, apiNovaLigacao, apiRecusarDoc, apiValidarDoc, type DossieLead } from "../../../../partilhado/api/crm";
import { useAccao } from "../../../../partilhado/dados/useAccao";
import { usePode } from "../../../../partilhado/AuthGate";
import { toastError, toastOk } from "../../../../partilhado/toastBus";

const ESTADO_DOC: Record<string, { texto: string; tom: "sucesso" | "perigo" | "aviso" }> = {
  validado: { texto: "Validado", tom: "sucesso" },
  recusado: { texto: "Recusado", tom: "perigo" },
  pendente: { texto: "Por validar", tom: "aviso" },
};

/** Documentos enviados pela ligação pessoal, consentimento RGPD e a própria ligação. */
export function FichaDocumentos({ d, onMudou }: { d: DossieLead; role: string; onMudou: () => void }) {
  const pode = usePode();
  const podeValidar = pode("crm.validarDocumentos");
  const id = d.lead.id;
  const [obs, setObs] = useState<Record<number, string>>({});
  const [confirmarLigacao, setConfirmarLigacao] = useState(false);
  const validar = useAccao(apiValidarDoc, { ok: "Documento validado.", invalidar: ["crm:", "painel:", "pagamentos:"] });
  const recusar = useAccao(apiRecusarDoc, { ok: "Documento recusado. A ligação pessoal pede só este ficheiro." });
  const alertar = useAccao(apiAlertarDocs, { ok: "Email enviado com o que está incorrecto." });
  const novaLigacao = useAccao(apiNovaLigacao, { ok: "Nova ligação enviada por email. A anterior deixou de funcionar." });

  async function copiar() {
    try {
      await navigator.clipboard.writeText(d.docsUrl);
      toastOk("Ligação pessoal copiada.");
    } catch {
      toastError(new Error("Não foi possível copiar. Seleccione o texto da ligação."));
    }
  }

  const recusados = d.documentos.some(x => x.estado === "recusado");

  return (
    <div className="flex flex-col gap-4">
      {d.docsFechado ? (
        <Aviso tom="sucesso" titulo="Ligação pessoal encerrada">A secretaria validou a pré-inscrição.</Aviso>
      ) : d.docsUrl ? (
        <section aria-label="Ligação pessoal" className="rounded-cartao border border-linha p-3">
          <p className="m-0 text-xs font-semibold uppercase tracking-wide text-tinta-suave">Ligação pessoal</p>
          <Entrada readOnly value={d.docsUrl} className="mt-1 text-xs" aria-label="Ligação pessoal" onFocus={e => e.currentTarget.select()} />
          <div className="mt-2 flex flex-wrap gap-2">
            <Botao tamanho="sm" variante="secundario" onClick={() => void copiar()}>Copiar</Botao>
            <Botao tamanho="sm" variante="secundario" aCarregar={novaLigacao.aCorrer} onClick={() => setConfirmarLigacao(true)}>Gerar nova ligação</Botao>
          </div>
        </section>
      ) : null}

      <section aria-label="Consentimento RGPD" className="text-[13px]">
        {d.consentimento.em ? (
          <p className="m-0 text-tinta-suave">
            Política de privacidade aceite em {dataHora(d.consentimento.em)}
            {d.consentimento.versao ? ` · versão ${d.consentimento.versao}` : ""}{d.consentimento.ip ? ` · IP ${d.consentimento.ip}` : ""}.
          </p>
        ) : (
          <p className="m-0 text-tinta-suave">{d.lead.entrada === "manual" ? "Registada pela equipa: sem consentimento do formulário do site." : "Sem registo de consentimento no formulário."}</p>
        )}
      </section>

      {d.pagamento && (
        <p className="m-0 text-[13px]">
          Pagamento: <strong>{eur(d.pagamento.valor, true)}</strong> · {d.pagamento.estado}{d.pagamento.metodo ? ` · ${d.pagamento.metodo}` : ""}
        </p>
      )}

      {d.docsEmFalta.length > 0 && !d.docsFechado && (
        <Aviso tom="aviso" titulo="Ainda faltam documentos">{d.docsEmFalta.join(", ")}</Aviso>
      )}

      {d.documentos.length === 0 ? (
        <Vazio compacto titulo="Sem ficheiros nesta ficha." descricao="A pessoa envia-os pela ligação pessoal." />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {d.documentos.map(doc => {
            const est = ESTADO_DOC[doc.estado] ?? ESTADO_DOC.pendente!;
            return (
              <li key={doc.id} className="rounded-cartao border border-linha p-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="m-0 text-[13px] font-semibold">{doc.label}</p>
                    <p className="m-0 truncate text-xs text-tinta-suave" title={doc.nome}>{doc.nome}</p>
                  </div>
                  <Estado tom={est.tom}>{est.texto}</Estado>
                  {doc.url && <a className="text-[13px] font-semibold text-ligacao" href={doc.url} target="_blank" rel="noreferrer">Abrir</a>}
                </div>
                {doc.observacao && <p className="m-0 mt-1 text-xs text-perigo">{doc.observacao}</p>}
                {podeValidar && doc.estado !== "validado" && !d.docsFechado && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Entrada
                      aria-label={`O que está incorrecto em ${doc.label}`}
                      placeholder="O que está incorrecto (para recusar)"
                      className="h-8 flex-1 min-w-[180px] text-xs"
                      value={obs[doc.id] ?? ""}
                      onChange={e => setObs(o => ({ ...o, [doc.id]: e.target.value }))}
                    />
                    <Botao tamanho="sm" variante="secundario" aCarregar={recusar.aCorrer} disabled={!(obs[doc.id] ?? "").trim()}
                      onClick={() => void recusar.correr(id, doc.id, (obs[doc.id] ?? "").trim()).then(r => r && onMudou())}>Recusar</Botao>
                    <Botao tamanho="sm" aCarregar={validar.aCorrer} onClick={() => void validar.correr(id, doc.id).then(r => r && onMudou())}>Validar</Botao>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {podeValidar && recusados && !d.docsFechado && (
        <Botao variante="secundario" aCarregar={alertar.aCorrer} onClick={() => void alertar.correr(id)}>Enviar email com os documentos a corrigir</Botao>
      )}

      <ConfirmarPerigo
        aberto={confirmarLigacao}
        onFechar={() => setConfirmarLigacao(false)}
        titulo="Gerar nova ligação pessoal"
        descricao="A ligação actual deixa de funcionar e a pessoa recebe a nova por email. Os ficheiros já enviados ficam na ficha."
        acao="Gerar e enviar"
        onConfirmar={async () => { const r = await novaLigacao.correr(id); if (r) onMudou(); }}
      />
    </div>
  );
}
