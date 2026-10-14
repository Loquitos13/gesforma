import { beginViewLoad, endViewLoad, isSilentViewPath } from "../viewLoadingBus";

/** Base da API. Em produção é `/api` no mesmo domínio (a CSP só deixa ligar a 'self'). */
export const BASE = (import.meta.env.VITE_API_URL as string | undefined) || "/api";

export class ApiError extends Error {
  status: number;
  /** Erros por campo devolvidos pela validação do servidor (`validar` em server/src/validacao.ts). */
  campos?: { campo: string; erro: string }[];
  constructor(status: number, message: string, campos?: { campo: string; erro: string }[]) {
    super(message);
    this.status = status;
    this.campos = campos;
  }
}

type Opcoes = RequestInit & {
  /** Não abre a cortina de carregamento (pedidos em segundo plano). */
  silencioso?: boolean;
  /** Sinal para cancelar (o useRecurso passa o seu). */
  signal?: AbortSignal;
};

/**
 * Pedido JSON à API do GesForma. Envia o cookie de sessão e o cabeçalho
 * `X-Gesforma-Client`, que o servidor exige em todas as escritas.
 */
export async function api<T>(path: string, init: Opcoes = {}): Promise<T> {
  const { silencioso, ...resto } = init;
  const headers = new Headers(resto.headers);
  headers.set("Accept", "application/json");
  headers.set("X-Gesforma-Client", "web");
  if (resto.body && !(resto.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const method = (resto.method ?? "GET").toUpperCase();
  // A cortina é o ecrã de abrir a página. Gravar, como o auto-save da grelha, não a abre.
  const track = method === "GET" && !silencioso && !isSilentViewPath(path);
  if (track) beginViewLoad();
  try {
    const res = await fetch(`${BASE}${path}`, { ...resto, credentials: "include", headers });
    if (res.status === 204) return undefined as T;
    const data = await res.json().catch(() => ({}));
    if (res.status === 429) {
      throw new ApiError(429, typeof data.error === "string" ? data.error : "Demasiadas tentativas. Aguarde um minuto e tente de novo.");
    }
    if (!res.ok) {
      throw new ApiError(res.status, typeof data.error === "string" ? data.error : "pedido recusado", Array.isArray(data.campos) ? data.campos : undefined);
    }
    return data as T;
  } finally {
    if (track) endViewLoad();
  }
}

/** Atalhos para escrita JSON. */
export const enviar = {
  post: <T>(path: string, corpo?: unknown) => api<T>(path, { method: "POST", body: corpo === undefined ? undefined : JSON.stringify(corpo) }),
  put: <T>(path: string, corpo?: unknown) => api<T>(path, { method: "PUT", body: corpo === undefined ? undefined : JSON.stringify(corpo) }),
  patch: <T>(path: string, corpo?: unknown) => api<T>(path, { method: "PATCH", body: corpo === undefined ? undefined : JSON.stringify(corpo) }),
  delete: <T>(path: string) => api<T>(path, { method: "DELETE" }),
};

/** Upload multipart (um ficheiro + campos). */
export function enviarFicheiro<T>(path: string, ficheiro: File | Blob, campos: Record<string, string> = {}, nome = "ficheiro") {
  const form = new FormData();
  for (const [k, v] of Object.entries(campos)) form.append(k, v);
  form.append("file", ficheiro, ficheiro instanceof File ? ficheiro.name : nome);
  return api<T>(path, { method: "POST", body: form });
}

/** Constrói a query string, ignorando valores vazios. */
export function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "" || v === false) continue;
    u.set(k, v === true ? "1" : String(v));
  }
  const s = u.toString();
  return s ? `?${s}` : "";
}

/** Resposta paginada das listas novas (server/src/repos/sql.ts → `paginar`). */
export type Pagina<T> = { total: number; linhas: T[]; pagina: number; porPagina: number };
