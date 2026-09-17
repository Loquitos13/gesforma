type Listener = (pending: number) => void;

const listeners = new Set<Listener>();
let pending = 0;

export function subscribeViewLoading(fn: Listener) {
  listeners.add(fn);
  fn(pending);
  return () => { listeners.delete(fn); };
}

export function beginViewLoad() {
  pending += 1;
  listeners.forEach(fn => fn(pending));
}

export function endViewLoad() {
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
