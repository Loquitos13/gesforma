import { useRef, useState } from "react";
import { Aviso, Botao, ConfirmarPerigo, Entrada, Estado, Vazio, dataHora, eur } from "../../../../partilhado/ui";
import { apiEntregarDoc, apiEnviarLigacao, apiLembretePrestacao, apiNovaLigacao, apiPrestacoes, apiRecusarDoc, apiReenviarPedidoDocs, apiValidarDoc, type DossieLead } from "../../../../partilhado/api/crm";
import { useAccao } from "../../../../partilhado/dados/useAccao";
import { usePode } from "../../../../partilhado/AuthGate";
import { toastError, toastOk } from "../../../../partilhado/toastBus";
import { JanelaPrestacoes, resumoPrestacoes } from "./Prestacoes";

const ESTADO_DOC: Record<string, { texto: string; tom: "sucesso" | "perigo" | "aviso" }> = {
  validado: { texto: "Validado", tom: "sucesso" },
  recusado: { texto: "Recusado", tom: "perigo" },
  pendente: { texto: "Por validar", tom: "aviso" },
};

/** Documentos enviados pela ligação pessoal, consentimento RGPD e a própria ligação. */
export function FichaDocumentos({ d, onMudou }: { d: DossieLead; role: string; onMudou: () => void }) {
  const pode = usePode();
  const podeValidar = pode("crm.validarDocumentos");
  // O comprovativo de pagamento: valida-o a equipa (comercial e coordenações) e a contabilidade; confirma o pagamento (a turma é à parte).
  const podeComprovativo = pode("pagamentos.validarComprovativo");
  const id = d.lead.id;
  const [obs, setObs] = useState<Record<number, string>>({});
  const [confirmarLigacao, setConfirmarLigacao] = useState(false);
  const validar = useAccao(apiValidarDoc, { ok: "Documento validado.", invalidar: ["crm:", "painel:", "pagamentos:"] });
  const recusar = useAccao(apiRecusarDoc, {
    ok: r => r.avisoRecusa?.enviado
      ? "Documento recusado. A pessoa recebeu um email com o motivo e a ligação pessoal."
      : r.avisoRecusa?.adiado
        ? "Documento recusado. Segue no próximo email (acabou de sair outro); use «Reenviar pedido agora» para enviar já."
        : "Documento recusado. A ligação pessoal pede só este ficheiro.",
  });
  const reenviar = useAccao(apiReenviarPedidoDocs, { ok: r => `Pedido reenviado por email: ${r.documentos.join(", ")}.` });
  const novaLigacao = useAccao(apiNovaLigacao, { ok: "Nova ligação enviada por email. A anterior deixou de funcionar." });
  // A ligação atual (a mesma, com a turma escolhida agora) por email: pré-inscrição repetida ou email que não chegou.
  const enviarLigacao = useAccao(apiEnviarLigacao, { ok: "Ligação pessoal enviada por email." });
  // A equipa entrega um documento pela pessoa (não conseguiu ou não sabe): fica por validar, como se ela o enviasse.
  const escolha = useRef<HTMLInputElement>(null);
  const [alvo, setAlvo] = useState<string | null>(null);
  const entregar = useAccao((tipo: string, f: File) => apiEntregarDoc(id, tipo, f), { ok: "Documento entregue. Fica por validar.", invalidar: ["crm:", "painel:"] });
  // O servidor decide o que se pode entregar (validada, já só os comprovativos das prestações em falta).
  const paraEntregar = !pode("crm.escrever") ? [] : d.docsParaEntregar ?? [];
  const prestacoes = d.prestacoes ?? [];
  const estadoPrest = d.estadoPrestacoes ?? [];
  const proximaPrest = estadoPrest.find(p => p.estado === "em_falta" || p.estado === "recusado");
  const lembrete = useAccao(() => apiLembretePrestacao(id), { ok: "Lembrete enviado por email, com a ligação no passo do pagamento." });
  const eComprovativo = (t: string) => /^comprovativo(-\d+)?$/.test(t);
  // Comprovativo sem as prestações confirmadas: primeiro «em quantas vezes» (com o ficheiro); «Alterar» sem ficheiro.
  const [janela, setJanela] = useState<{ tipo: string | null; rotulo?: string } | null>(null);
  const [aGravarPrestacoes, setAGravarPrestacoes] = useState(false);
  async function confirmarPrestacoes(valores: number[], ficheiro: File | null) {
    setAGravarPrestacoes(true);
    try {
      await apiPrestacoes(id, valores);
      if (ficheiro && janela?.tipo) await entregar.correr(janela.tipo, ficheiro);
      else toastOk("Prestações gravadas.");
      setJanela(null);
      onMudou();
    } catch (e) {
      toastError(e, "Não foi possível gravar as prestações.");
    } finally {
      setAGravarPrestacoes(false);
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(d.docsUrl);
      toastOk("Ligação pessoal copiada.");
    } catch {
      toastError(new Error("Não foi possível copiar. Seleccione o texto da ligação."));
    }
  }

  const recusados = d.documentos.some(x => x.estado === "recusado");
  const pendente = recusados || d.docsEmFalta.length > 0;
  const lembretes = d.lembretes;

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
            <Botao tamanho="sm" variante="secundario" aCarregar={enviarLigacao.aCorrer} onClick={() => void enviarLigacao.correr(id).then(r => r && onMudou())}>Enviar ligação por email</Botao>
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
                {(eComprovativo(doc.tipo) ? podeComprovativo : podeValidar) && doc.estado !== "validado" && !d.docsFechado && (
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
                    <Botao variante="primario" tamanho="sm" aCarregar={validar.aCorrer} onClick={() => void validar.correr(id, doc.id).then(r => r && onMudou())}>Validar</Botao>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {paraEntregar.length > 0 && (
        <section aria-label="Entregar documentos pela pessoa" className="rounded-cartao border border-linha p-3">
          <p className="m-0 text-xs font-semibold uppercase tracking-wide text-tinta-suave">Entregar pela pessoa</p>
          <p className="m-0 mt-0.5 text-xs text-tinta-suave">Se a pessoa não conseguir enviar pela ligação pessoal: o ficheiro vai para a pasta dela na Drive e fica por validar.</p>
          <input ref={escolha} type="file" accept="application/pdf,image/*,.pdf,.jpg,.jpeg,.jfif,.png,.webp" className="sr-only" tabIndex={-1} aria-hidden="true"
            onChange={e => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f && alvo) void entregar.correr(alvo, f).then(r => r && onMudou());
            }} />
          <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0">
            {paraEntregar.map(p => (
              <li key={p.id} className="flex items-center gap-2 text-[13px]">
                <span className="min-w-0 flex-1 truncate">{p.label}</span>
                <Botao tamanho="sm" variante="secundario" aCarregar={entregar.aCorrer && alvo === p.id}
                  onClick={() => {
                    if (eComprovativo(p.id) && !prestacoes.length) { setJanela({ tipo: p.id, rotulo: p.label }); return; }
                    setAlvo(p.id); escolha.current?.click();
                  }}>
                  {d.documentos.some(x => x.tipo === p.id) ? "Substituir ficheiro" : "Carregar ficheiro"}
                </Botao>
              </li>
            ))}
          </ul>
          {prestacoes.length > 0 && (
            <p className="m-0 mt-2 flex flex-wrap items-center gap-2 text-xs text-tinta-suave">
              {resumoPrestacoes(prestacoes)}
              <Botao tamanho="sm" variante="fantasma" onClick={() => setJanela({ tipo: null })}>Alterar</Botao>
            </p>
          )}
        </section>
      )}
      {estadoPrest.length > 1 && (
        <section aria-label="Prestações" className="rounded-cartao border border-linha p-3 text-[13px]">
          <p className="m-0 text-xs font-semibold uppercase tracking-wide text-tinta-suave">Prestações</p>
          <ul className="m-0 mt-1 list-none space-y-0.5 p-0">
            {estadoPrest.map(p => (
              <li key={p.tipo} className="flex justify-between gap-2">
                <span>{p.n}.ª · {eur(p.valor, true)}</span>
                <span className={p.estado === "validado" ? "text-sucesso" : p.estado === "recusado" ? "text-perigo" : "text-tinta-suave"}>
                  {{ validado: "Paga", pendente: "Comprovativo por validar", recusado: "Comprovativo recusado", em_falta: "Por pagar" }[p.estado]}
                </span>
              </li>
            ))}
          </ul>
          {proximaPrest && pode("crm.escrever") && (
            <Botao className="mt-2" tamanho="sm" variante="secundario" aCarregar={lembrete.aCorrer} onClick={() => void lembrete.correr().then(r => r && onMudou())}>
              Enviar lembrete da {proximaPrest.n}.ª prestação
            </Botao>
          )}
        </section>
      )}
      <JanelaPrestacoes aberto={Boolean(janela)} preco={Number(d.lead.preco) || 0} atuais={prestacoes} comFicheiro={Boolean(janela?.tipo)}
        rotuloFicheiro={janela?.rotulo} aGravar={aGravarPrestacoes || entregar.aCorrer} onFechar={() => setJanela(null)}
        onConfirmar={(v, f) => void confirmarPrestacoes(v, f)} />

      {lembretes && !d.docsFechado && (
        <section aria-label="Lembretes automáticos" className="rounded-cartao border border-linha p-3 text-[13px]">
          <p className="m-0 text-xs font-semibold uppercase tracking-wide text-tinta-suave">Lembretes automáticos</p>
          <dl className="m-0 mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
            <dt className="text-tinta-suave">Lembretes enviados</dt>
            <dd className="m-0">{lembretes.enviados} de {lembretes.maximo}</dd>
            <dt className="text-tinta-suave">Último lembrete</dt>
            <dd className="m-0">{lembretes.ultimoEm ? dataHora(lembretes.ultimoEm) : "Nenhum"}</dd>
            <dt className="text-tinta-suave">Próximo lembrete</dt>
            <dd className="m-0">{lembretes.proximoEm ? dataHora(lembretes.proximoEm) : lembretes.semProximo || "—"}</dd>
          </dl>
          {(d.recusasPorAvisar ?? 0) > 0 && (
            <p className="m-0 mt-1 text-xs text-tinta-suave">
              {d.recusasPorAvisar === 1 ? "1 recusa ainda não seguiu" : `${d.recusasPorAvisar} recusas ainda não seguiram`} por email (saem no próximo envio).
            </p>
          )}
          {pendente && (
            <div className="mt-2">
              <Botao tamanho="sm" variante="secundario" aCarregar={reenviar.aCorrer}
                onClick={() => void reenviar.correr(id).then(r => r && onMudou())}>Reenviar pedido agora</Botao>
            </div>
          )}
        </section>
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
