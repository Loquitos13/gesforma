import { useEffect, useRef, useState, type FormEvent } from "react";
import { apiWhatsapp, apiWhatsappConversa, apiWhatsappSimular } from "../partilhado/api/configuracoes";
import { useRecurso } from "../partilhado/dados/useRecurso";
import { toastError } from "../partilhado/toastBus";
import { Botao, Campo, Entrada, Modal, cx } from "../partilhado/ui";

type Msg = { direccao: "in" | "out"; corpo: string };

/** Simulador do assistente de WhatsApp: a mesma conversa do bot, gravada no CRM. */
export function WhatsappSimulador({ open, onClose, onLeadCreated }: { open: boolean; onClose: () => void; onLeadCreated?: () => void }) {
  const { dados: estado } = useRecurso(open ? "configuracoes:whatsapp" : null, apiWhatsapp);
  const [telefone, setTelefone] = useState("");
  const [texto, setTexto] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const fim = useRef<HTMLDivElement>(null);
  const telefoneValido = telefone.replace(/\D/g, "").length >= 9;

  useEffect(() => { fim.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  async function enviar(e?: FormEvent) {
    e?.preventDefault();
    const t = texto.trim();
    if (!t || busy || !telefoneValido) return;
    setBusy(true);
    setTexto("");
    try {
      const out = await apiWhatsappSimular(telefone, t);
      setMsgs(m => [...m, { direccao: "in", corpo: t }, ...out.replies.map(corpo => ({ direccao: "out" as const, corpo }))]);
      if (out.leadId) onLeadCreated?.();
    } catch (err) {
      toastError(err, "O simulador não respondeu.");
      setTexto(t);
    } finally {
      setBusy(false);
    }
  }

  async function historico() {
    try {
      const c = await apiWhatsappConversa(telefone);
      setMsgs(c.mensagens.map(m => ({ direccao: m.direccao, corpo: m.corpo })));
    } catch (err) {
      toastError(err, "Não foi possível ler o histórico.");
    }
  }

  return (
    <Modal aberto={open} onFechar={onClose} titulo="Assistente de WhatsApp" largura="lg">
      <div className="space-y-3">
        <p className="m-0 text-[13px] text-tinta-suave">
          {estado?.ligado ? "Cloud API ligada: as respostas também saem no telemóvel." : "Modo simulador (sem token Meta). O CRM grava na mesma."}
          {" "}A pré-inscrição pede os dados pessoais e depois curso, local, horário e data. O pagamento não se trata no chat.
        </p>
        <div className="flex gap-2 items-end">
          <Campo rotulo="Telemóvel do interessado" className="flex-1">
            {a => <Entrada {...a} inputMode="tel" value={telefone} placeholder="9 dígitos ou com 351" onChange={e => setTelefone(e.target.value)} />}
          </Campo>
          <Botao disabled={!telefoneValido} onClick={() => void historico()}>Histórico</Botao>
        </div>
        <div className="h-72 overflow-y-auto rounded-cartao border border-linha bg-fundo p-3 space-y-2" aria-live="polite">
          {msgs.length === 0 ? (
            <p className="m-0 text-sm text-tinta-suave text-center mt-16">Escreva «olá» ou «1» para começar uma pré-inscrição.</p>
          ) : msgs.map((m, i) => (
            <div key={i} className={cx("flex", m.direccao === "in" ? "justify-end" : "justify-start")}>
              <div className={cx("max-w-[80%] rounded-cartao px-3 py-2 text-sm whitespace-pre-wrap", m.direccao === "in" ? "bg-sucesso text-white" : "bg-superficie border border-linha text-tinta")}>
                {m.corpo}
              </div>
            </div>
          ))}
          <div ref={fim} />
        </div>
        <form onSubmit={e => void enviar(e)} className="flex gap-2">
          <label className="sr-only" htmlFor="wa-msg">Mensagem</label>
          <Entrada id="wa-msg" value={texto} onChange={e => setTexto(e.target.value)} placeholder={telefoneValido ? "Mensagem do interessado…" : "Indique primeiro o telemóvel"} disabled={!telefoneValido} />
          <Botao type="submit" variante="primario" aCarregar={busy} disabled={!telefoneValido || !texto.trim()}>Enviar</Botao>
        </form>
      </div>
    </Modal>
  );
}
