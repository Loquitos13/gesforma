type Toast = {
  id: number;
  kind: "error" | "ok" | "alert";
  text: string;
  key?: string;
  leadId?: number;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
};
type Listener = (xs: Toast[]) => void;

const listeners = new Set<Listener>();
let toasts: Toast[] = [];
let seq = 1;

function notify() {
  listeners.forEach(fn => fn(toasts));
}

export function subscribeToasts(fn: Listener) {
  listeners.add(fn);
  fn(toasts);
  return () => { listeners.delete(fn); };
}

export function dismissToast(id: number) {
  const hit = toasts.find(t => t.id === id);
  toasts = toasts.filter(t => t.id !== id);
  notify();
  hit?.onDismiss?.();
}

export function dismissToastKey(key: string) {
  const hit = toasts.filter(t => t.key === key);
  toasts = toasts.filter(t => t.key !== key);
  notify();
  hit.forEach(t => t.onDismiss?.());
}

export function dismissAlertsForLead(leadId: number) {
  toasts = toasts.filter(t => t.leadId !== leadId);
  notify();
}

export function pruneAlertKeys(prefix: string, keys: Set<string>) {
  const next = toasts.filter(t => !t.key?.startsWith(prefix) || keys.has(t.key));
  if (next.length === toasts.length) return;
  toasts = next;
  notify();
}

export function pushToast(kind: "error" | "ok", text: string) {
  const id = seq++;
  const alerts = toasts.filter(t => t.kind === "alert");
  const flashing = toasts.filter(t => t.kind !== "alert").slice(-3);
  toasts = [...alerts, ...flashing, { id, kind, text }];
  notify();
  window.setTimeout(() => dismissToast(id), 5600);
}

export function pushAlertToast(input: {
  key: string;
  leadId?: number;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
}) {
  const existing = toasts.find(t => t.key === input.key);
  if (existing) {
    toasts = toasts.map(t => (t.key === input.key ? { ...t, ...input, id: t.id, kind: "alert" } : t));
    notify();
    return existing.id;
  }
  const id = seq++;
  toasts = [...toasts, { id, kind: "alert", ...input }];
  notify();
  return id;
}

export function toastError(err: unknown, fallback = "Não foi possível gravar.") {
  const text = err instanceof Error && err.message ? err.message : fallback;
  pushToast("error", text);
}

export function toastOk(text: string) {
  pushToast("ok", text);
}

export function persist<T>(p: Promise<T>, revert?: () => void): Promise<T | undefined> {
  return p.catch(err => {
    toastError(err);
    revert?.();
    return undefined;
  });
}

export type { Toast };
