type Listener = (pending: number) => void;

const listeners = new Set<Listener>();
let pending = 0;
let armed = false;

export function subscribeViewLoading(fn: Listener) {
  listeners.add(fn);
  fn(pending);
  return () => { listeners.delete(fn); };
}

/** Só depois da primeira view da sessão: o splash 0–100% já cobriu a entrada. */
export function armViewLoading() {
  armed = true;
}

export function beginViewLoad() {
  if (!armed) return;
  pending += 1;
  listeners.forEach(fn => fn(pending));
}

export function endViewLoad() {
  if (pending === 0) return;
  pending = Math.max(0, pending - 1);
  listeners.forEach(fn => fn(pending));
}

export function isSilentViewPath(path: string) {
  return (
    path === "/health"
    || path === "/v1/me"
    || path.startsWith("/v1/auth/")
    || path.startsWith("/v1/notificacoes")
    || path === "/v1/drive/status"
  );
}
