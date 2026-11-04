import { useRef } from "react";
import { apiDocAlertas } from "../partilhado/api";
import { useSondagem } from "../partilhado/dados/sondagem";
import { pruneAlertKeys, pushAlertToast } from "../partilhado/toastBus";

/**
 * Verifica documentos novos a cada minuto, só com o separador visível e com sessão. «Dispensar» esconde o alerta a quem
 * o dispensou durante 4 horas; o alerta fecha de vez quando os documentos são tratados.
 */
const INTERVALO_MS = 60_000;

export function DocAlertas({ onOpen }: { onOpen: (id: number, regime: "gold" | "fin") => void }) {
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  useSondagem(async () => {
    const r = await apiDocAlertas();
    const keys = new Set(r.alertas.map(a => `doc:${a.id}`));
    for (const a of r.alertas) {
      const nome = `${a.nome} ${a.apelido}`.trim() || "Pré-inscrição";
      const regime = a.regime === "fin" ? "fin" : "gold";
      pushAlertToast({
        key: `doc:${a.id}`,
        leadId: a.preinscricaoId,
        text: `${nome} enviou documentos de ${a.curso || "uma formação"}. Valide-os na ficha.`,
        actionLabel: "Abrir ficha",
        onAction: () => onOpenRef.current(a.preinscricaoId, regime),
      });
    }
    pruneAlertKeys("doc:", keys);
  }, INTERVALO_MS);

  return null;
}
