// Estado da assinatura de um contrato: enviar, reenviar, cancelar, descarregar e ver o registo de provas.
import { useState, type ReactNode } from "react";
import {
  ROTULO_ESTADO, TOM_ESTADO, apiAssinatura, apiAssinaturasDoContrato, apiCancelarAssinatura, apiReenviarAssinatura,
  urlPdfAssinatura, type AssinaturaResumo,
} from "../../../partilhado/api/assinaturas";
import { useAccao } from "../../../partilhado/dados/useAccao";
import { useRecurso } from "../../../partilhado/dados/useRecurso";
import { Aviso, Botao, BotaoLigacao, ConfirmarPerigo, ErroCarregar, Esqueleto, Estado, dataHora } from "../../../partilhado/ui";
import { EnviarAssinatura } from "./EnviarAssinatura";

export const INVALIDAR_ASSINATURAS = ["assinaturas:", "crm:contratos", "crm:clientes"];

export function PainelAssinatura({ contratoId, estadoContrato, temTexto, podeEnviar = true }: {
  contratoId: number;
  estadoContrato: string;
  temTexto: boolean;
  podeEnviar?: boolean;
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
  const assinado = estadoContrato === "Assinado" || atual?.estado === "assinado";
  const podeNovo = podeEnviar && !assinado && !aberto && estadoContrato !== "Cancelado";

  return (
    <section aria-label="Assinatura" className="rounded-cartao border border-linha bg-superficie p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="m-0 text-sm font-semibold text-tinta">Assinatura</h3>
        {atual && <Estado tom={TOM_ESTADO[atual.estado]} ponto>{ROTULO_ESTADO[atual.estado]}</Estado>}
        <div className="ml-auto flex gap-2 flex-wrap">
          {podeNovo && (
            <Botao tamanho="sm" variante="primario" disabled={!temTexto} title={temTexto ? undefined : "O contrato precisa de texto"} onClick={() => setEnviar(true)}>
              {atual ? "Enviar de novo" : "Enviar para assinatura"}
            </Botao>
          )}
          {aberto && podeEnviar && (
            <>
              <Botao tamanho="sm" aCarregar={reenviar.aCorrer} onClick={() => void reenviar.correr(atual!.id)}>Reenviar ligação</Botao>
              <Botao tamanho="sm" variante="fantasma" className="text-perigo" onClick={() => setCancelar(true)}>Cancelar pedido</Botao>
            </>
          )}
        </div>
      </div>

      {!atual ? (
        <p className="m-0 text-sm text-tinta-suave">
          O signatário recebe por email uma ligação pessoal, lê o contrato e assina com o rato, o dedo ou o nome escrito,
          confirmando com um código enviado por email. Também pode assinar com o Cartão de Cidadão ou a Chave Móvel Digital.
        </p>
      ) : (
        <dl className="m-0 grid gap-x-6 gap-y-1.5 sm:grid-cols-2 text-sm">
          <Linha rotulo="Signatário">{atual.signatarioNome} · {atual.signatarioEmail}</Linha>
          <Linha rotulo="Enviado">{dataHora(atual.enviadoEm)}{atual.enviadoPorNome ? ` por ${atual.enviadoPorNome}` : ""}</Linha>
          {aberto && <Linha rotulo="Válido até">{dataHora(atual.expiraEm)}</Linha>}
          {atual.abertoEm && <Linha rotulo="Aberto">{dataHora(atual.abertoEm)}</Linha>}
          {atual.assinadoEm && <Linha rotulo="Assinado">{dataHora(atual.assinadoEm)} · {atual.metodoRotulo}</Linha>}
          {atual.motivo && (atual.estado === "recusado" || atual.estado === "cancelado") && <Linha rotulo="Motivo">{atual.motivo}</Linha>}
          {atual.estado === "assinado" && <Linha rotulo="Selo da entidade">{atual.selado ? atual.certificadoTitular : "Sem selo (sem certificado configurado)"}</Linha>}
          {atual.estado === "assinado" && <Linha rotulo="Drive">{atual.driveFileId ? "PDF assinado guardado" : "Ainda não guardado na Drive"}</Linha>}
        </dl>
      )}

      {atual && (
        <div className="flex gap-2 flex-wrap">
          <BotaoLigacao tamanho="sm" variante="fantasma" href={urlPdfAssinatura(atual.id, "original")}>PDF enviado</BotaoLigacao>
          {atual.temAssinado && <BotaoLigacao tamanho="sm" href={urlPdfAssinatura(atual.id, "assinado")}>PDF assinado</BotaoLigacao>}
          <Botao tamanho="sm" variante="fantasma" aria-expanded={provas} onClick={() => setProvas(p => !p)}>{provas ? "Esconder registo" : "Registo de provas"}</Botao>
        </div>
      )}
      {atual && provas && <Provas id={atual.id} />}
      {atual?.estado === "expirado" && podeEnviar && (
        <Aviso tom="aviso">A ligação expirou sem assinatura. Reenvie para dar mais tempo ou envie de novo se o texto mudou.</Aviso>
      )}

      <EnviarAssinatura contratoId={contratoId} aberto={enviar} onFechar={() => setEnviar(false)} />
      <ConfirmarPerigo
        aberto={cancelar}
        onFechar={() => setCancelar(false)}
        titulo="Cancelar o pedido de assinatura?"
        acao="Cancelar pedido"
        descricao="A ligação deixa de funcionar e o contrato volta a rascunho. O registo fica guardado."
        onConfirmar={async () => {
          if (atual) await anular.correr(atual.id, "Cancelado pela equipa.");
        }}
      />
    </section>
  );
}

function Linha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex gap-2 min-w-0">
      <dt className="text-tinta-suave shrink-0">{rotulo}</dt>
      <dd className="m-0 text-tinta min-w-0 break-words">{children}</dd>
    </div>
  );
}

function Provas({ id }: { id: number }) {
  const { dados, erro, recarregar } = useRecurso(`assinaturas:detalhe:${id}`, signal => apiAssinatura(id, { signal }));
  if (erro) return <ErroCarregar erro={erro} onTentar={recarregar} />;
  if (!dados) return <Esqueleto linhas={4} />;
  const a = dados.assinatura;
  return (
    <div className="rounded-controlo bg-fundo p-3 space-y-3 text-sm">
      <dl className="m-0 grid gap-1.5">
        <Linha rotulo="Código de verificação"><a className="text-ligacao" href={a.urlVerificacao} target="_blank" rel="noopener noreferrer">{a.codigoVerificacao}</a></Linha>
        <Linha rotulo="NIF">{a.nif}{a.nifOrigem === "equipa" ? " (indicado pela equipa no envio)" : " (da ficha)"}</Linha>
        <Linha rotulo="SHA-256 original"><code className="text-xs break-all">{a.hashOriginal}</code></Linha>
        {a.hashFinal && <Linha rotulo="SHA-256 assinado"><code className="text-xs break-all">{a.hashFinal}</code></Linha>}
        {a.certificadoFingerprint && <Linha rotulo="Certificado do selo"><code className="text-xs break-all">{a.certificadoFingerprint}</code></Linha>}
      </dl>
      <ol className="m-0 p-0 list-none space-y-1.5">
        {a.eventos.map(e => (
          <li key={e.id} className="flex gap-3">
            <span className="num text-xs text-tinta-suave w-[118px] shrink-0">{dataHora(e.em)}</span>
            <span className="text-tinta">
              {e.rotulo}
              {e.ip && <span className="text-tinta-suave"> · IP {e.ip}</span>}
              {e.userAgent && <span className="block text-xs text-tinta-suave truncate" title={e.userAgent}>{e.userAgent}</span>}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
