type Toast = {
  id: number;
  kind: "error" | "ok" | "alert";
  text: string;
  key?: string;
  titulo?: string;
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

/** Um alerta dispensado só volta a aparecer passadas 4 horas (guardado no browser; sem acesso, nesta sessão). */
const REAPARECE_MS = 4 * 60 * 60 * 1000;
const CHAVE_DISPENSADOS = "gesforma:alertas-dispensados";
const dispensadosSessao = new Map<string, number>();

function lerDispensados(): Record<string, number> {
  try {
    const v = JSON.parse(window.localStorage.getItem(CHAVE_DISPENSADOS) ?? "{}") as Record<string, number>;
    return v && typeof v === "object" ? v : {};
  } catch {
    return Object.fromEntries(dispensadosSessao);
  }
}

function marcarDispensado(key: string) {
  const agora = Date.now();
  dispensadosSessao.set(key, agora);
  try {
    const v = lerDispensados();
    v[key] = agora;
    // Arruma as marcas que já passaram das 4 horas.
    for (const [k, t] of Object.entries(v)) if (agora - t > REAPARECE_MS) delete v[k];
    window.localStorage.setItem(CHAVE_DISPENSADOS, JSON.stringify(v));
  } catch { /* sem armazenamento: fica a marca desta sessão */ }
}

/** O alerta foi dispensado há menos de 4 horas? */
export function alertaDispensado(key: string) {
  const t = lerDispensados()[key] ?? dispensadosSessao.get(key);
  return t != null && Date.now() - t < REAPARECE_MS;
}

export function dismissToast(id: number) {
  const hit = toasts.find(t => t.id === id);
  if (hit?.kind === "alert" && hit.key) marcarDispensado(hit.key);
  toasts = toasts.filter(t => t.id !== id);
  notify();
  hit?.onDismiss?.();
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
  /** Título do alerta (por omissão, «Documentos para validar»). */
  titulo?: string;
  leadId?: number;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
}) {
  const existing = toasts.find(t => t.key === input.key);
  if (!existing && alertaDispensado(input.key)) return null;
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
