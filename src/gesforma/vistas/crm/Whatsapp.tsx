// Caixa de conversas do WhatsApp: o que o assistente respondeu e as conversas em que a pessoa pediu alguém da equipa.
// A equipa responde daqui pelo número da ENA (texto livre só até 24 horas depois da última mensagem da pessoa).
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  apiWhatsappAssumir, apiWhatsappApagar, apiWhatsappConversa, apiWhatsappConversas, apiWhatsappDevolver, apiWhatsappFechar, apiWhatsappResponder,
  type ConversaWhatsapp,
} from "../../../partilhado/api/configuracoes";
import { usePode } from "../../../partilhado/AuthGate";
import { useRecurso } from "../../../partilhado/dados/useRecurso";
import { atualizarPendentesWhatsapp } from "../../WhatsappPendentes";
import { toastError, toastOk } from "../../../partilhado/toastBus";
import { AreaTexto, Aviso, Botao, Cartao, ConfirmarPerigo, Entrada, ErroCarregar, Esqueleto, Estado, PageHeader, Vazio, cx, useFiltrosUrl } from "../../../partilhado/ui";
import type { VistaProps } from "../../shell/tipos";

const ATUALIZAR_MS = 5_000;

export function telefoneBonito(t: string) {
  if (t.startsWith("351") && t.length === 12) return `+351 ${t.slice(3, 6)} ${t.slice(6, 9)} ${t.slice(9)}`;
  return `+${t}`;
}

/** "2026-11-03 14:05:00+00" → hora de Lisboa (hoje) ou dia e hora. */
function quando(iso: string) {
  const d = new Date(iso.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return "";
  const hoje = new Date().toLocaleDateString("pt-PT", { timeZone: "Europe/Lisbon" });
  const dia = d.toLocaleDateString("pt-PT", { timeZone: "Europe/Lisbon" });
  const hora = d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Lisbon" });
  return dia === hoje ? hora : `${dia.replace(/\//g, "-")} ${hora}`;
}

/** Recarrega de tempos a tempos enquanto a vista está aberta (as mensagens chegam pelo webhook). */
function useAtualizar(recarregar: () => void) {
  const ref = useRef(recarregar);
  ref.current = recarregar;
  useEffect(() => {
    const id = window.setInterval(() => { if (document.visibilityState === "visible") ref.current(); }, ATUALIZAR_MS);
    return () => window.clearInterval(id);
  }, []);
}

export default function Whatsapp({ navigate }: VistaProps) {
  const [f, setF] = useFiltrosUrl({ telefone: "", estado: "abertas" });
  const fechadas = f.estado === "fechadas";
  const [pesquisa, setPesquisa] = useState("");
  const lista = useRecurso("crm:whatsapp:conversas", signal => apiWhatsappConversas(signal), { validadeMs: 5_000 });
  useAtualizar(lista.recarregar);

  const todas = lista.dados?.conversas ?? [];
  const nFechadas = todas.filter(c => c.fechada).length;
  const conversas = todas.filter(c => c.fechada === fechadas).filter(c => {
    const q = pesquisa.trim().toLowerCase();
    return !q || c.nome.toLowerCase().includes(q) || c.telefone.includes(q.replace(/\D/g, "") || "§");
  });
  const pedemPessoa = (lista.dados?.conversas ?? []).filter(c => c.humano).length;

  return (
    <div className="space-y-4">
      <PageHeader
        titulo="WhatsApp"
        subtitulo={pedemPessoa ? `${pedemPessoa} ${pedemPessoa === 1 ? "conversa espera" : "conversas esperam"} por uma pessoa da equipa` : "Conversas com o assistente do número da ENA"}
      />
      {lista.dados && !lista.dados.ligado && (
        <Aviso tom="aviso">O WhatsApp não está ligado (Configurações › Integrações). As conversas antigas continuam visíveis, mas não é possível responder.</Aviso>
      )}
      {lista.erro ? <ErroCarregar erro={lista.erro} onTentar={lista.recarregar} /> : (
        <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
          <Cartao className={cx("p-0 overflow-hidden", f.telefone && "hidden lg:block")}>
            <div className="space-y-2 border-b border-linha p-3">
              <div className="flex gap-1 rounded-controlo bg-fundo p-1 text-sm" role="tablist" aria-label="Estado das conversas">
                {([["abertas", `Abertas (${todas.length - nFechadas})`], ["fechadas", `Fechadas (${nFechadas})`]] as const).map(([v, rotulo]) => (
                  <button key={v} type="button" role="tab" aria-selected={f.estado === v} onClick={() => setF({ estado: v, telefone: "" })}
                    className={cx("flex-1 rounded-controlo px-2 py-1.5 font-medium", f.estado === v ? "bg-superficie text-tinta shadow-sm" : "text-tinta-suave")}>
                    {rotulo}
                  </button>
                ))}
              </div>
              <Entrada value={pesquisa} onChange={e => setPesquisa(e.target.value)} placeholder="Pesquisar nome ou número" aria-label="Pesquisar conversas" />
            </div>
            {!lista.dados ? <div className="p-3"><Esqueleto linhas={6} /></div> : conversas.length === 0 ? (
              <Vazio compacto titulo={fechadas ? "Sem conversas fechadas" : "Sem conversas"} descricao={fechadas ? "As conversas fechadas ficam aqui com o histórico; reabrem quando a pessoa volta a escrever." : "Quando alguém escrever para o número da ENA, a conversa aparece aqui."} />
            ) : (
              <ul className="max-h-[70vh] divide-y divide-linha overflow-y-auto">
                {conversas.map(c => (
                  <LinhaConversa key={c.telefone} c={c} ativa={c.telefone === f.telefone} onAbrir={() => setF({ telefone: c.telefone })} />
                ))}
              </ul>
            )}
          </Cartao>
          {f.telefone ? (
            <Conversa
              key={f.telefone}
              telefone={f.telefone}
              resumo={lista.dados?.conversas.find(c => c.telefone === f.telefone)}
              onVoltar={() => setF({ telefone: "" })}
              onMudou={lista.recarregar}
              abrirLead={(id, regime) => navigate({ view: regime === "fin" ? "fin-preinscricoes" : "gold-preinscricoes", leadId: id })}
            />
          ) : (
            <Cartao className="hidden lg:grid place-items-center min-h-[320px]">
              <Vazio titulo="Escolha uma conversa" descricao="As conversas em que pedem uma pessoa da equipa aparecem primeiro." />
            </Cartao>
          )}
        </div>
      )}
    </div>
  );
}

function LinhaConversa({ c, ativa, onAbrir }: { c: ConversaWhatsapp; ativa: boolean; onAbrir: () => void }) {
  return (
    <li>
      <button type="button" onClick={onAbrir} className={cx("block w-full px-3 py-3 text-left hover:bg-fundo", ativa && "bg-fundo")}>
        <span className="flex items-center justify-between gap-2">
          <strong className="truncate text-sm text-tinta">{c.nome || telefoneBonito(c.telefone)}</strong>
          <span className="shrink-0 text-xs text-tinta-suave">{quando(c.ultimaEm)}</span>
        </span>
        {c.nome && <span className="block text-xs text-tinta-suave">{telefoneBonito(c.telefone)}</span>}
        <span className="mt-1 flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-xs text-tinta-suave">{c.ultimaDireccao === "out" ? "Enviada: " : ""}{c.ultima}</span>
          {c.porLer > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#25D366] px-1.5 text-[11px] font-bold text-white">{c.porLer}</span>}
        </span>
        {c.humano && <span className="mt-1.5 inline-block"><Estado tom="aviso" ponto>{c.humanoPor ? `Com ${c.humanoPor}` : "Pede uma pessoa"}</Estado></span>}
      </button>
    </li>
  );
}

function Conversa({ telefone, resumo, onVoltar, onMudou, abrirLead }: {
  telefone: string;
  resumo?: ConversaWhatsapp;
  onVoltar: () => void;
  onMudou: () => void;
  abrirLead: (id: number, regime: "gold" | "fin") => void;
}) {
  const conversa = useRecurso(`crm:whatsapp:conversa:${telefone}`, signal => apiWhatsappConversa(telefone, signal), { validadeMs: 5_000 });
  useAtualizar(conversa.recarregar);
  const [texto, setTexto] = useState("");
  const [aEnviar, setAEnviar] = useState(false);
  const [aMudar, setAMudar] = useState(false);
  const [confirmarFecho, setConfirmarFecho] = useState(false);
  const [confirmarApagar, setConfirmarApagar] = useState(false);
  const pode = usePode();
  const fim = useRef<HTMLDivElement>(null);
  const d = conversa.dados;
  const total = d?.mensagens.length ?? 0;

  useEffect(() => { fim.current?.scrollIntoView({ block: "end" }); }, [total]);
  // A lista viu uma mensagem nova nesta conversa: recarrega já (sem esperar pela volta seguinte).
  const ultimaNaLista = resumo?.ultimaEm;
  const recarregarConversa = conversa.recarregar;
  useEffect(() => { if (ultimaNaLista) recarregarConversa(); }, [ultimaNaLista, recarregarConversa]);
  // Abrir a conversa marca-a como lida: a lista acerta a contagem.
  const carregada = Boolean(d);
  useEffect(() => { if (carregada) onMudou(); }, [carregada]);

  async function responder(e?: FormEvent) {
    e?.preventDefault();
    const t = texto.trim();
    if (!t || aEnviar) return;
    setAEnviar(true);
    try {
      await apiWhatsappResponder(telefone, t);
      setTexto("");
      conversa.recarregar();
      onMudou();
      atualizarPendentesWhatsapp();
    } catch (err) {
      toastError(err, "A mensagem não foi enviada.");
    } finally {
      setAEnviar(false);
    }
  }

  async function mudar(acao: "assumir" | "devolver" | "fechar" | "apagar") {
    setAMudar(true);
    try {
      if (acao === "apagar") {
        await apiWhatsappApagar(telefone);
        toastOk("Conversa eliminada.");
        setConfirmarApagar(false);
        onMudou();
        atualizarPendentesWhatsapp();
        onVoltar();
        return;
      }
      if (acao === "fechar") {
        const r = await apiWhatsappFechar(telefone);
        toastOk(r.despedida ? "Conversa fechada. A mensagem de despedida foi enviada." : "Conversa fechada (sem despedida: a pessoa não escreve há mais de 24 horas).");
        setConfirmarFecho(false);
      } else {
        await (acao === "assumir" ? apiWhatsappAssumir(telefone) : apiWhatsappDevolver(telefone));
      }
      conversa.recarregar();
      onMudou();
      atualizarPendentesWhatsapp();
    } catch (err) {
      toastError(err, "Não foi possível mudar a conversa.");
    } finally {
      setAMudar(false);
    }
  }

  if (conversa.erro) return <ErroCarregar erro={conversa.erro} onTentar={conversa.recarregar} />;
  const nome = resumo?.nome || d?.leads?.[0]?.nome || "";
  const humano = Boolean(d?.humano);

  return (
    <Cartao className="flex min-h-[420px] flex-col p-0 overflow-hidden">
      <header className="flex flex-wrap items-center gap-3 border-b border-linha p-3">
        <Botao variante="fantasma" tamanho="sm" className="lg:hidden" onClick={onVoltar}>← Conversas</Botao>
        <div className="min-w-0 flex-1">
          <strong className="block truncate text-sm text-tinta">{nome || telefoneBonito(telefone)}</strong>
          <span className="block text-xs text-tinta-suave">
            {nome ? `${telefoneBonito(telefone)} · ` : ""}
            {d?.fechada ? `Fechada${d.fechadaPor ? ` por ${d.fechadaPor}` : ""}: reabre se a pessoa voltar a escrever` : humano ? "Bot em pausa: responde a equipa" : "Responde o assistente automático"}
          </span>
        </div>
        {d && !d.fechada && (humano
          ? <Botao tamanho="sm" aCarregar={aMudar} onClick={() => void mudar("devolver")} title="A pessoa volta a receber as respostas automáticas">Devolver ao assistente</Botao>
          : <Botao tamanho="sm" aCarregar={aMudar} onClick={() => void mudar("assumir")} title="O assistente deixa de responder nesta conversa">Ficar com a conversa</Botao>)}
        {d && !d.fechada && (
          <Botao tamanho="sm" variante="perigo" onClick={() => setConfirmarFecho(true)} title="Despedida à pessoa; a conversa passa a Fechadas e o histórico fica">Fechar conversa</Botao>
        )}
        {pode("whatsapp.eliminar") && (
          <Botao tamanho="sm" variante="fantasma" onClick={() => setConfirmarApagar(true)} title="Apaga o histórico desta conversa de vez">Eliminar</Botao>
        )}
        <ConfirmarPerigo
          aberto={confirmarApagar}
          titulo="Eliminar esta conversa de vez?"
          descricao="Todas as mensagens desta conversa são apagadas e não se podem recuperar. A pessoa não é avisada; se voltar a escrever, começa uma conversa nova. Para confirmar, escreva ELIMINAR."
          acao="Eliminar de vez"
          confirmarTexto="ELIMINAR"
          onConfirmar={() => mudar("apagar")}
          onFechar={() => setConfirmarApagar(false)}
        />
        <ConfirmarPerigo
          aberto={confirmarFecho}
          titulo="Fechar esta conversa?"
          descricao="A pessoa recebe a mensagem de despedida (se escreveu nas últimas 24 horas) e o assistente volta a responder. A conversa passa a «Fechadas» com o histórico todo; se a pessoa voltar a escrever, reabre."
          acao="Fechar conversa"
          onConfirmar={() => mudar("fechar")}
          onFechar={() => setConfirmarFecho(false)}
        />
      </header>
      {d?.leads && d.leads.length > 0 && (
        <div className="flex flex-wrap gap-2 border-b border-linha bg-fundo px-3 py-2 text-xs">
          <span className="text-tinta-suave">Pedidos com este número:</span>
          {d.leads.slice(0, 4).map(l => (
            <button key={l.id} type="button" onClick={() => abrirLead(l.id, l.regime)} className="font-semibold text-acao-texto underline">
              #{l.id} · {l.curso || "—"} · {l.estado}
            </button>
          ))}
        </div>
      )}
      <div className="flex-1 space-y-2 overflow-y-auto bg-[#F4F6F4] p-3 max-h-[60vh]">
        {!d ? <Esqueleto linhas={5} /> : d.mensagens.length === 0 ? <Vazio compacto titulo="Sem mensagens" /> : d.mensagens.map((m, i) => m.direccao === "evento" ? (
          <div key={i} className="flex items-center gap-2 py-1 text-[11px] text-tinta-suave" role="separator">
            <span className="h-px flex-1 bg-linha" />{m.corpo} · {quando(m.createdAt)}<span className="h-px flex-1 bg-linha" />
          </div>
        ) : (
          <div key={i} className={cx("max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm shadow-sm",
            m.direccao === "in" ? "rounded-tl-sm bg-white" : m.autor ? "ml-auto rounded-tr-sm bg-[#DCF8C6]" : "ml-auto rounded-tr-sm bg-[#EAF2FB]")}>
            {m.corpo}
            <span className="mt-1 block text-right text-[10px] text-tinta-suave">
              {m.direccao === "out" ? `${m.autor || "Assistente"} · ` : ""}{quando(m.createdAt)}
            </span>
          </div>
        ))}
        <div ref={fim} />
      </div>
      <form onSubmit={responder} className="space-y-2 border-t border-linha p-3">
        {d && !d.podeResponder ? (
          <Aviso tom="aviso">Passaram mais de 24 horas desde a última mensagem desta pessoa: o WhatsApp só deixa responder quando ela voltar a escrever. Entretanto, ligue-lhe ou envie um email.</Aviso>
        ) : (
          <>
            <AreaTexto
              value={texto}
              onChange={e => setTexto(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void responder(); } }}
              placeholder={humano ? "Escreva a resposta…" : "Escreva para responder (o assistente deixa de responder nesta conversa)…"}
              maxLength={4000}
              className="min-h-[64px]"
              aria-label="Resposta"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-tinta-suave">Enter envia · Shift+Enter muda de linha</span>
              <Botao type="submit" variante="primario" aCarregar={aEnviar} disabled={!texto.trim()}>Enviar</Botao>
            </div>
          </>
        )}
      </form>
    </Cartao>
  );
}
