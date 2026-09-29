type Listener = (busy: boolean) => void;

const listeners = new Set<Listener>();
let pending = 0;
let armed = false;
let curtain = false;
let delayTimer: number | undefined;

/** Só mostra a cortina se o fetch ainda estiver pendente após este atraso. */
const SHOW_AFTER_MS = 2500;

function notify() {
  const on = curtain;
  listeners.forEach(fn => fn(on));
}

function scheduleCurtain() {
  if (delayTimer !== undefined || curtain) return;
  delayTimer = window.setTimeout(() => {
    delayTimer = undefined;
    if (pending > 0 && !curtain) {
      curtain = true;
      notify();
    }
  }, SHOW_AFTER_MS);
}

function hideCurtain() {
  if (delayTimer !== undefined) {
    window.clearTimeout(delayTimer);
    delayTimer = undefined;
  }
  if (curtain) {
    curtain = false;
    notify();
  }
}

export function isViewLoading() {
  return curtain;
}

export function subscribeViewLoading(fn: Listener) {
  listeners.add(fn);
  fn(curtain);
  return () => { listeners.delete(fn); };
}

/** Só depois da primeira view da sessão: o splash 0 a 100% já cobriu a entrada. */
export function armViewLoading() {
  armed = true;
}

export function beginViewLoad() {
  if (!armed) return;
  pending += 1;
  if (pending === 1) scheduleCurtain();
}

export function endViewLoad() {
  if (pending === 0) return;
  pending = Math.max(0, pending - 1);
  if (pending === 0) hideCurtain();
}

export function isSilentViewPath(path: string) {
  return (
    path === "/health"
    || path === "/v1/me"
    || path.startsWith("/v1/auth/")
    || path.startsWith("/v1/notificacoes")
    || path.startsWith("/v1/crm/")
    || path === "/v1/search"
    || path.startsWith("/v1/public/")
    || path === "/v1/drive/status"
  );
}
