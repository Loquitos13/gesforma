import { useEffect, useState } from "react";
import { dismissToast, subscribeToasts } from "./toastBus";

export function ToastHost() {
  const [items, setItems] = useState<{ id: number; kind: "error" | "ok"; text: string }[]>([]);
  useEffect(() => subscribeToasts(setItems), []);
  if (!items.length) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[80] flex flex-col gap-2 w-[min(92vw,22rem)]" role="status" aria-live="polite">
      {items.map(t => (
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
