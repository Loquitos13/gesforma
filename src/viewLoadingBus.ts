type Listener = (busy: boolean) => void;

const listeners = new Set<Listener>();
let pending = 0;
let armed = false;
let curtain = false;
let curtainUntil = 0;
let curtainTimer: number | undefined;

function busy() {
  return curtain || pending > 0;
}

function notify() {
  const on = busy();
  listeners.forEach(fn => fn(on));
}

export function isViewLoading() {
  return busy();
}

export function subscribeViewLoading(fn: Listener) {
  listeners.add(fn);
  fn(busy());
  return () => { listeners.delete(fn); };
}

/** Só depois da primeira view da sessão: o splash 0–100% já cobriu a entrada. */
export function armViewLoading() {
  armed = true;
}

/** Cortina mínima na mudança de view. Não é cancelada pelo StrictMode/unmount. */
export function showViewCurtain(ms = 1800) {
  armed = true;
  curtain = true;
  curtainUntil = Math.max(curtainUntil, performance.now() + ms);
  if (curtainTimer) window.clearTimeout(curtainTimer);
  curtainTimer = window.setTimeout(() => {
    curtain = false;
    curtainTimer = undefined;
    notify();
  }, Math.max(0, curtainUntil - performance.now()));
  notify();
}

export function beginViewLoad() {
  if (!armed) return;
  pending += 1;
  notify();
}

export function endViewLoad() {
  if (pending === 0) return;
  pending = Math.max(0, pending - 1);
  notify();
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
