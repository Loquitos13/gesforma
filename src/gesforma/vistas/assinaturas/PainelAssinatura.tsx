// Assinatura de um contrato: enviar, reenviar, cancelar, os PDFs, e — depois de assinado — as assinaturas,
// o registo de provas, a integridade do documento e a pasta da Drive.
import { useState, type ReactNode } from "react";
import {
  ROTULO_ESTADO, TOM_ESTADO, apiAssinatura, apiAssinaturasDoContrato, apiCancelarAssinatura, apiReenviarAssinatura,
  urlPdfAssinatura, type AssinaturaResumo,
} from "../../../partilhado/api/assinaturas";
import { useAccao } from "../../../partilhado/dados/useAccao";
import { useRecurso } from "../../../partilhado/dados/useRecurso";
import { Aviso, Botao, BotaoLigacao, ConfirmarPerigo, ErroCarregar, Esqueleto, dataHora } from "../../../partilhado/ui";
import { EnviarAssinatura } from "./EnviarAssinatura";

export const INVALIDAR_ASSINATURAS = ["assinaturas:", "crm:contratos", "crm:contrato", "crm:clientes"];

const COR: Record<string, string> = { sucesso: "#1F7A4D", aviso: "#9A5B00", perigo: "#B42318", info: "#1D4E89", neutro: "#5A6474" };

function Seccao({ titulo, acao, children }: { titulo: string; acao?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2"><h3 className="m-0 text-sm font-semibold text-tinta">{titulo}</h3>{acao && <span className="ml-auto">{acao}</span>}</div>
      {children}
    </section>
  );
}

export function PainelAssinatura({ contratoId, estadoContrato, temTexto, podeEnviar = true, contrato }: {
  contratoId: number;
  estadoContrato: string;
  temTexto: boolean;
  podeEnviar?: boolean;
  contrato?: { clienteNome: string; clienteEmail: string; curso: string };
}) {
  const { dados, erro, aCarregar, recarregar } = useRecurso(`assinaturas:contrato:${contratoId}`, signal => apiAssinaturasDoContrato(contratoId, { signal }));
  const [enviar, setEnviar] = useState(false);
  const [cancelar, setCancelar] = useState(false);
  const [provas, setProvas] = useState(false);
  const reenviar = useAccao(apiReenviarAssinatura, { ok: "Nova ligação enviada por email.", invalidar: INVALIDAR_ASSINATURAS });
  const anular = useAccao(apiCancelarAssinatura, { ok: "Pedido cancelado.", invalidar: INVALIDAR_ASSINATURAS });

  if (erro) return <ErroCarregar erro={erro} onTentar={recarregar} />;
  if (aCarregar && !dados) return <Esqueleto linhas={3} />;
  const atual: AssinaturaResumo | undefined = dados?.assinaturas[0];
  const aberto = atual && (atual.estado === "enviado" || atual.estado === "aberto");
  const assinado = atual?.estado === "assinado";
  const podeNovo = podeEnviar && estadoContrato !== "Assinado" && !assinado && !aberto && estadoContrato !== "Cancelado";
  const cor = atual ? COR[TOM_ESTADO[atual.estado]] : COR.neutro;

  return (
    <div className="flex flex-col gap-[18px]">
      <Seccao
        titulo="Assinatura"
        acao={atual ? <span className="inline-flex items-center gap-1.5 text-[13px]" style={{ color: cor }}><span aria-hidden="true" className="w-[7px] h-[7px] rounded-full" style={{ background: cor }} />{ROTULO_ESTADO[atual.estado]}</span> : undefined}
      >
        {!atual ? (
          <p className="m-0 text-[13px] text-tinta-suave leading-normal">
            Ainda não foi enviado. A pessoa recebe por email uma ligação pessoal, lê o contrato e assina (desenhando, escrevendo o nome,
            ou com Cartão de Cidadão / Chave Móvel Digital), confirmando com um código enviado por email.
          </p>
        ) : assinado ? (
          <div className="grid gap-2.5">
            <div className="rounded-lg border border-linha p-3">
              <p className="m-0 text-xs text-tinta-suave">Pela entidade</p>
              <p className="m-0 text-sm font-semibold text-tinta">{atual.selado ? atual.certificadoTitular : "Sem selo digital"}</p>
              <p className="num m-0 text-xs text-tinta-suave">{atual.selado ? "Selo digital aplicado ao PDF final" : "Configure o certificado em Configurações › Assinatura e selo"}</p>
            </div>
            <div className="rounded-lg border border-[#B9DCC8] bg-[#F3FAF6] p-3">
              <p className="m-0 text-xs text-tinta-suave">Signatário</p>
              <p className="m-0 text-sm font-semibold text-tinta">{atual.signatarioNome}</p>
              <p className="num m-0 text-xs text-tinta-suave">{dataHora(atual.assinadoEm)} · {atual.metodoRotulo}</p>
            </div>
          </div>
        ) : (
          <dl className="num m-0 grid grid-cols-[96px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[13px]">
            <dt className="text-tinta-suave">Para</dt><dd className="m-0 text-tinta break-words">{atual.signatarioNome} · {atual.signatarioEmail}</dd>
            <dt className="text-tinta-suave">Enviado</dt><dd className="m-0 text-tinta">{dataHora(atual.enviadoEm)}{atual.enviadoPorNome ? ` por ${atual.enviadoPorNome}` : ""}</dd>
            {aberto && <><dt className="text-tinta-suave">Válido até</dt><dd className="m-0 text-tinta">{dataHora(atual.expiraEm)}</dd></>}
            {atual.abertoEm && <><dt className="text-tinta-suave">Aberto</dt><dd className="m-0 text-tinta">{dataHora(atual.abertoEm)}</dd></>}
            {atual.motivo && (atual.estado === "recusado" || atual.estado === "cancelado") && <><dt className="text-tinta-suave">Motivo</dt><dd className="m-0 text-tinta">{atual.motivo}</dd></>}
          </dl>
        )}
        <div className="flex gap-2 flex-wrap">
          {podeNovo && (
            <Botao tamanho="sm" variante="primario" disabled={!temTexto} title={temTexto ? undefined : "O contrato precisa de texto"} onClick={() => setEnviar(true)}>
              {atual ? "Enviar de novo" : "Enviar para assinatura"}
            </Botao>
          )}
          {aberto && podeEnviar && (
            <>
              <Botao tamanho="sm" aCarregar={reenviar.aCorrer} onClick={() => void reenviar.correr(atual!.id)}>Reenviar ligação</Botao>
              <Botao tamanho="sm" variante="fantasma" className="text-perigo" onClick={() => setCancelar(true)}>Cancelar envio</Botao>
            </>
          )}
          {atual && <BotaoLigacao tamanho="sm" variante="fantasma" href={urlPdfAssinatura(atual.id, "original")}>PDF enviado</BotaoLigacao>}
          {atual?.temAssinado && <BotaoLigacao tamanho="sm" href={urlPdfAssinatura(atual.id, "assinado")}>Ver PDF assinado</BotaoLigacao>}
        </div>
        {atual?.estado === "expirado" && podeEnviar && (
          <Aviso tom="aviso">A ligação expirou sem assinatura. Reenvie para dar mais tempo ou envie de novo se o texto mudou.</Aviso>
        )}
      </Seccao>

      {atual && (assinado || provas) && <Provas id={atual.id} assinado={assinado} />}
      {atual && !assinado && (
        <button type="button" aria-expanded={provas} onClick={() => setProvas(p => !p)} className="self-start border-0 bg-transparent p-0 text-ligacao text-[13px] font-semibold cursor-pointer">
          {provas ? "Esconder o registo de provas" : "Ver o registo de provas"}
        </button>
      )}

      <EnviarAssinatura contratoId={contratoId} aberto={enviar} onFechar={() => setEnviar(false)} contrato={contrato} />
      <ConfirmarPerigo
        aberto={cancelar}
        onFechar={() => setCancelar(false)}
        titulo="Cancelar o envio para assinatura?"
        acao="Cancelar envio"
        descricao="A ligação deixa de funcionar e o contrato volta a rascunho. O registo fica guardado."
        onConfirmar={async () => {
          if (atual) await anular.correr(atual.id, "Cancelado pela equipa.");
        }}
      />
    </div>
  );
}

function Provas({ id, assinado }: { id: number; assinado: boolean }) {
  const { dados, erro, recarregar } = useRecurso(`assinaturas:detalhe:${id}`, signal => apiAssinatura(id, { signal }));
  if (erro) return <ErroCarregar erro={erro} onTentar={recarregar} />;
  if (!dados) return <Esqueleto linhas={4} />;
  const a = dados.assinatura;
  return (
    <>
      <Seccao titulo="Registo de provas">
        <ol className="m-0 p-0 list-none flex flex-col">
          {a.eventos.map((e, i) => (
            <li key={e.id} className="num grid grid-cols-[86px_14px_minmax(0,1fr)] gap-2 text-[13px]">
              <span className="text-xs text-tinta-suave pt-0.5">{dataHora(e.em)}</span>
              <span aria-hidden="true" className="flex flex-col items-center">
                <span className="w-2 h-2 rounded-full mt-1.5" style={{ background: i === a.eventos.length - 1 ? "#1F7A4D" : "#1D4E89" }} />
                {i < a.eventos.length - 1 && <span className="flex-1 w-px bg-linha" />}
              </span>
              <span className="pb-3 min-w-0">
                <strong className="font-semibold text-tinta">{e.rotulo}</strong>
                {(e.ip || e.userAgent) && <span className="block text-xs text-tinta-suave truncate" title={e.userAgent}>{[e.ip && `IP ${e.ip}`, e.userAgent].filter(Boolean).join(" · ")}</span>}
              </span>
            </li>
          ))}
        </ol>
      </Seccao>
      <Seccao titulo="Integridade do documento">
        <dl className="m-0 grid gap-2 text-[13px]">
          <div><dt className="text-xs text-tinta-suave">Código de verificação</dt><dd className="m-0"><a className="text-ligacao" href={a.urlVerificacao} target="_blank" rel="noopener noreferrer">{a.codigoVerificacao}</a></dd></div>
          <div><dt className="text-xs text-tinta-suave">NIF do signatário</dt><dd className="m-0 text-tinta">{a.nif}{a.nifOrigem === "equipa" ? " (indicado pela equipa no envio)" : " (da ficha)"}</dd></div>
          <div><dt className="text-xs text-tinta-suave">SHA-256 do documento enviado</dt><dd className="m-0 font-mono text-[11px] break-all text-tinta">{a.hashOriginal}</dd></div>
          {a.hashFinal && <div><dt className="text-xs text-tinta-suave">Impressão digital do PDF final (SHA-256)</dt><dd className="m-0 font-mono text-[11px] break-all text-tinta">{a.hashFinal}</dd></div>}
          {a.certificadoFingerprint && <div><dt className="text-xs text-tinta-suave">Certificado do selo (SHA-256)</dt><dd className="m-0 font-mono text-[11px] break-all text-tinta">{a.certificadoFingerprint}</dd></div>}
          {assinado && <div><dt className="text-xs text-tinta-suave">Verificação</dt><dd className="m-0 text-tinta-suave">Qualquer alteração ao PDF depois da assinatura invalida o selo e é assinalada pelo leitor de PDF.</dd></div>}
        </dl>
      </Seccao>
      {assinado && (
        <Seccao titulo="Na Drive">
          <p className="m-0 text-[13px] text-tinta">{a.driveFileId ? "PDF assinado guardado na pasta do formando ou do cliente." : "Ainda não guardado na Drive (a ligação à Drive pode não estar configurada)."}</p>
          <p className="m-0 text-xs text-tinta-suave leading-normal">Na Drive fica só o PDF final, com as assinaturas, o selo e o certificado de assinatura na última página. O registo de provas e a versão enviada ficam no GesForma.</p>
        </Seccao>
      )}
    </>
  );
}
