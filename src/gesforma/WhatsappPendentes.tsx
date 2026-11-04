// Pedidos para falar com a equipa no WhatsApp à espera de resposta: contador no menu («WhatsApp») e alerta no ecrã,
// só para a equipa da área (Gold: comerciais e coordenação Gold; Financiada: coordenação Financiada; a administração
// vê os dois). Um número sem pré-inscrição conta para as duas.
import { useRef, useSyncExternalStore } from "react";
import { apiWhatsappPendentes, type PedidoPendenteWhatsapp } from "../partilhado/api/configuracoes";
import { useSondagem } from "../partilhado/dados/sondagem";
import { pruneAlertKeys, pushAlertToast } from "../partilhado/toastBus";

const INTERVALO_MS = 15_000;
const PERFIS_EQUIPA = new Set(["admin", "secretaria", "comercial", "financiada"]);

type Contagem = { gold: number; fin: number };
let contagem: Contagem = { gold: 0, fin: 0 };
const ouvintes = new Set<() => void>();
let pedirAgora: (() => void) | null = null;
/** Alertas fechados nesta sessão (não voltam a aparecer para o mesmo pedido). */
const dispensados = new Set<string>();

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

function daEquipa(role: string, p: PedidoPendenteWhatsapp) {
  if (role === "admin") return true;
  if (role === "financiada") return p.regime !== "gold";
  return p.regime !== "fin"; // comercial e coordenação Gold
}

const chave = (p: PedidoPendenteWhatsapp) => `wa:${p.telefone}:${p.desde}`;

export function WhatsappAlertas({ role, onOpen }: { role: string; onOpen: (telefone: string, regime: "gold" | "fin") => void }) {
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;
  const ativo = PERFIS_EQUIPA.has(role);

  async function verificar() {
    const { pendentes } = await apiWhatsappPendentes();
    const meus = pendentes.filter(p => daEquipa(role, p));
    publicar({
      gold: meus.filter(p => p.regime !== "fin").length,
      fin: meus.filter(p => p.regime !== "gold").length,
    });
    const chaves = new Set(meus.map(chave));
    for (const p of meus) {
      const k = chave(p);
      if (dispensados.has(k)) continue;
      // A área da conversa: a da pré-inscrição; sem ela, a da equipa de quem vê (a Financiada abre na Financiada).
      const regime = p.regime ?? (role === "financiada" ? "fin" : "gold");
      pushAlertToast({
        key: k,
        text: `${p.nome || formatar(p.telefone)} pediu, no WhatsApp, para falar com uma pessoa da equipa.`,
        actionLabel: "Abrir conversa",
        onAction: () => onOpenRef.current(p.telefone, regime),
        onDismiss: () => { dispensados.add(k); },
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
