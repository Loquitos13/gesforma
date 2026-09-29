import { useEffect, useState } from "react";
import { dismissToast, subscribeToasts, type Toast } from "./toastBus";

export function ToastHost() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => subscribeToasts(setItems), []);
  if (!items.length) return null;
  const alerts = items.filter(t => t.kind === "alert");
  const flashing = items.filter(t => t.kind !== "alert");
  return (
    <div className="fixed bottom-4 right-4 z-[80] flex flex-col gap-2 w-[min(92vw,22rem)]" role="status" aria-live="polite">
      {alerts.map(t => (
        <div key={t.id} className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-3 shadow-lg text-sm text-amber-950">
          <p className="font-semibold">Documentos para validar</p>
          <p className="text-xs mt-1 leading-snug">{t.text}</p>
          <div className="mt-2 flex gap-2">
            {t.actionLabel && (
              <button type="button" onClick={() => t.onAction?.()} className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-500 text-white">
                {t.actionLabel}
              </button>
            )}
            <button type="button" onClick={() => dismissToast(t.id)} className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-amber-300 text-amber-900">
              Dispensar
            </button>
          </div>
        </div>
      ))}
      {flashing.map(t => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismissToast(t.id)}
          className={`text-left rounded-xl border px-3 py-2.5 shadow-lg text-sm ${
            t.kind === "error" ? "bg-red-50 border-red-200 text-red-800" : "bg-emerald-50 border-emerald-200 text-emerald-800"
          }`}
        >
          <p className="font-semibold">{t.kind === "error" ? "Não gravado" : "Feito"}</p>
          <p className="text-xs mt-0.5 leading-snug">{t.text}</p>
        </button>
      ))}
    </div>
  );
}
