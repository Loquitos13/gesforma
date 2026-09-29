import { useEffect, useRef } from "react";
import { apiDocAlertaDispensar, apiDocAlertas } from "./api";
import { pruneAlertKeys, pushAlertToast } from "./toastBus";

export function DocAlertas({ onOpen }: { onOpen: (id: number, regime: "gold" | "fin") => void }) {
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const r = await apiDocAlertas();
        if (!alive) return;
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
            onDismiss: () => { void apiDocAlertaDispensar(a.id).catch(() => undefined); },
          });
        }
        pruneAlertKeys("doc:", keys);
      } catch {
        /* sem sessão ou API ainda a arrancar */
      }
    }
    void tick();
    const timer = window.setInterval(() => void tick(), 20000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  return null;
}
