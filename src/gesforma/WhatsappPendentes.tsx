// WhatsApp no menu e no ecrã: o menu («WhatsApp») conta as conversas com mensagens por ler; há alerta no ecrã quando
// começa uma conversa nova e quando alguém pede para falar com a equipa (não para a administração; um alerta
// dispensado só volta passadas 4 horas). Só para a equipa da área (Gold: comerciais e
// coordenação Gold; Financiada: coordenação Financiada; a administração vê as duas). Um número sem pré-inscrição conta
// para as duas.
import { useRef, useSyncExternalStore } from "react";
import { apiWhatsappPendentes, type ConversaPorLerWhatsapp, type PedidoPendenteWhatsapp } from "../partilhado/api/configuracoes";
import { useSondagem } from "../partilhado/dados/sondagem";
import { pruneAlertKeys, pushAlertToast } from "../partilhado/toastBus";

const INTERVALO_MS = 15_000;
const PERFIS_EQUIPA = new Set(["admin", "secretaria", "comercial", "financiada"]);

type Contagem = { gold: number; fin: number };
let contagem: Contagem = { gold: 0, fin: 0 };
const ouvintes = new Set<() => void>();
let pedirAgora: (() => void) | null = null;

function publicar(c: Contagem) {
  if (c.gold === contagem.gold && c.fin === contagem.fin) return;
  contagem = c;
  ouvintes.forEach(fn => fn());
}

/** Contagem para o menu: { gold, fin }. */
export function useWhatsappPendentes() {
  return useSyncExternalStore(
    fn => { ouvintes.add(fn); return () => { ouvintes.delete(fn); }; },
    () => contagem,
  );
}

/** Depois de responder, fechar ou devolver uma conversa: actualiza já o contador e os alertas. */
export function atualizarPendentesWhatsapp() {
  pedirAgora?.();
}

function daEquipa(role: string, p: { regime: "gold" | "fin" | null }) {
  if (role === "admin") return true;
  if (role === "financiada") return p.regime !== "gold";
  return p.regime !== "fin"; // comercial e coordenação Gold
}

const chave = (p: PedidoPendenteWhatsapp) => `wa:${p.telefone}:${p.desde}`;
const chaveNova = (c: ConversaPorLerWhatsapp) => `wanova:${c.telefone}:${c.novaDesde}`;

export function WhatsappAlertas({ role, onOpen }: { role: string; onOpen: (telefone: string, regime: "gold" | "fin") => void }) {
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;
  const ativo = PERFIS_EQUIPA.has(role);

  async function verificar() {
    const { pendentes, porLer } = await apiWhatsappPendentes();
    const meus = pendentes.filter(p => daEquipa(role, p));
    const minhasPorLer = (porLer ?? []).filter(c => daEquipa(role, c));
    publicar({
      gold: minhasPorLer.filter(c => c.regime !== "fin").length,
      fin: minhasPorLer.filter(c => c.regime !== "gold").length,
    });
    // Conversa nova (ainda ninguém a abriu): alerta, a não ser que já tenha o de «pede uma pessoa».
    // Os administradores vêem o contador no menu, mas não os alertas no ecrã.
    if (role === "admin") return;
    const comPedido = new Set(meus.map(p => p.telefone));
    const novas = minhasPorLer.filter(c => c.novaDesde && !comPedido.has(c.telefone));
    const chavesNovas = new Set(novas.map(chaveNova));
    for (const c of novas) {
      const k = chaveNova(c);
      const regime = c.regime ?? (role === "financiada" ? "fin" : "gold");
      pushAlertToast({
        key: k,
        titulo: "Nova conversa no WhatsApp",
        text: `Nova conversa no WhatsApp: ${c.nome || formatar(c.telefone)}.`,
        actionLabel: "Abrir conversa",
        onAction: () => onOpenRef.current(c.telefone, regime),
      });
    }
    pruneAlertKeys("wanova:", chavesNovas);
    const chaves = new Set(meus.map(chave));
    for (const p of meus) {
      const k = chave(p);
      // A área da conversa: a da pré-inscrição; sem ela, a da equipa de quem vê (a Financiada abre na Financiada).
      const regime = p.regime ?? (role === "financiada" ? "fin" : "gold");
      pushAlertToast({
        key: k,
        titulo: "WhatsApp: pedido para falar com a equipa",
        text: `${p.nome || formatar(p.telefone)} pediu, no WhatsApp, para falar com uma pessoa da equipa.`,
        actionLabel: "Abrir conversa",
        onAction: () => onOpenRef.current(p.telefone, regime),
      });
    }
    pruneAlertKeys("wa:", chaves);
  }

  const verificarRef = useRef(verificar);
  verificarRef.current = verificar;
  pedirAgora = () => { void verificarRef.current().catch(() => undefined); };
  useSondagem(verificar, INTERVALO_MS, ativo);
  return null;
}

function formatar(t: string) {
  return t.startsWith("351") && t.length === 12 ? `+351 ${t.slice(3, 6)} ${t.slice(6, 9)} ${t.slice(9)}` : `+${t}`;
}
