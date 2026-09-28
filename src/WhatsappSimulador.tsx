import { useEffect, useRef, useState, type FormEvent } from "react";
import { apiWhatsappConversa, apiWhatsappSimular, apiWhatsappStatus } from "./api";
import { AppModal } from "./FormKit";
import { toastError } from "./toastBus";

type Msg = { direccao: "in" | "out"; corpo: string };

export function WhatsappSimulador({
  open,
  onClose,
  onLeadCreated,
}: {
  open: boolean;
  onClose: () => void;
  onLeadCreated?: () => void;
}) {
  const [telefone, setTelefone] = useState("351912345678");
  const [texto, setTexto] = useState("");
  const [ligado, setLigado] = useState(false);
  const [webhook, setWebhook] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    void apiWhatsappStatus().then(s => {
      setLigado(s.ligado);
      setWebhook(s.webhook);
    }).catch(() => undefined);
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  async function enviar(e?: FormEvent) {
    e?.preventDefault();
    const t = texto.trim();
    if (!t || busy) return;
    setBusy(true);
    setTexto("");
    try {
      const out = await apiWhatsappSimular(telefone, t);
      const novas: Msg[] = [{ direccao: "in", corpo: t }, ...out.replies.map(corpo => ({ direccao: "out" as const, corpo }))];
      setMsgs(m => [...m, ...novas]);
      if (out.leadId) onLeadCreated?.();
    } catch (err) {
      toastError(err, "O simulador não respondeu.");
      setTexto(t);
    } finally {
      setBusy(false);
    }
  }

  async function carregar() {
    try {
      const c = await apiWhatsappConversa(telefone);
      setMsgs(c.mensagens.map(m => ({ direccao: m.direccao, corpo: m.corpo })));
    } catch (err) {
      toastError(err, "Não foi possível ler o histórico.");
    }
  }

  return (
    <AppModal
      open={open}
      onClose={onClose}
      title="Bot WhatsApp"
      sub={ligado ? "Cloud API ligada - as respostas também saem no telemóvel." : "Modo simulador: sem token Meta. O CRM grava na mesma."}
      size="lg"
    >
      <div className="space-y-3">
        <p className="text-xs text-slate-500">
          A pré-inscrição pede nome, apelido, telemóvel, email e concelho; depois dados do curso: curso → local → horário → data (só turmas Gold libertadas).
          O pagamento não se confirma neste chat - só pelo webhook MB / MB Way.
        </p>
        {webhook ? (
          <p className="text-[11px] font-mono text-slate-400 break-all">Webhook Meta: {webhook}</p>
        ) : null}
        <div className="flex gap-2">
          <input
            value={telefone}
            onChange={e => setTelefone(e.target.value)}
            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg"
            placeholder="3519…"
          />
          <button type="button" onClick={() => void carregar()} className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50">Histórico</button>
        </div>
        <div className="h-72 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
          {msgs.length === 0 ? (
            <p className="text-sm text-slate-400 text-center mt-16">Escreva «olá» ou «1» para pré-inscrição.</p>
          ) : msgs.map((m, i) => (
            <div key={i} className={`flex ${m.direccao === "in" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${m.direccao === "in" ? "bg-emerald-600 text-white" : "bg-white border border-slate-200 text-slate-800"}`}>
                {m.corpo}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <form onSubmit={e => void enviar(e)} className="flex gap-2">
          <input
            value={texto}
            onChange={e => setTexto(e.target.value)}
            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg"
            placeholder="Mensagem do interessado…"
          />
          <button type="submit" disabled={busy} className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white disabled:opacity-50">Enviar</button>
        </form>
      </div>
    </AppModal>
  );
}
