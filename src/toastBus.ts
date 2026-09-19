type Toast = { id: number; kind: "error" | "ok"; text: string };
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
  toasts = toasts.filter(t => t.id !== id);
  notify();
}

export function pushToast(kind: Toast["kind"], text: string) {
  const id = seq++;
  toasts = [...toasts.slice(-4), { id, kind, text }];
  notify();
  window.setTimeout(() => dismissToast(id), 5600);
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
