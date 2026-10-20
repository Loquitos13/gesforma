export type RouteKind = "public" | "authenticated" | "formando" | "staff";

const PUBLIC: Array<[string, string]> = [
  ["GET", "/health"],
  ["POST", "/v1/auth/login"],
  ["POST", "/v1/auth/recuperar"],
  ["POST", "/v1/auth/repor"],
  ["POST", "/v1/auth/logout"],
  ["GET", "/v1/auth/google"],
  ["GET", "/v1/auth/google/start"],
  ["GET", "/v1/auth/google/callback"],
  ["GET", "/v1/auth/microsoft"],
  ["GET", "/v1/auth/microsoft/start"],
  ["GET", "/v1/auth/microsoft/callback"],
  ["GET", "/v1/email/open"],
  ["GET", "/v1/cron/email"],
  ["GET", "/v1/cron/drive"],
];

const PUBLIC_PREFIXES = [
  "/v1/public/",
];

/** Rotas públicas de documentos do formando financiado (prefixo já coberto por /v1/public/). */

const AUTHENTICATED_PREFIXES = [
  "/v1/me",
  "/v1/auth/password",
];

const FORMANDO_PREFIXES = [
  "/v1/area-formando",
];

function matchPrefix(path: string, prefix: string) {
  return path === prefix || path.startsWith(`${prefix}/`);
}

function matchParam(path: string, pattern: string) {
  const pp = pattern.split("/").filter(Boolean);
  const ps = path.split("/").filter(Boolean);
  if (pp.length !== ps.length) return false;
  for (let i = 0; i < pp.length; i++) {
    const a = pp[i]!;
    const b = ps[i]!;
    if (a.startsWith(":")) continue;
    if (a !== b) return false;
  }
  return true;
}

export function classifyRoute(method: string, path: string): RouteKind {
  const m = method.toUpperCase();
  const p = path.split("?")[0] ?? path;

  for (const [pm, route] of PUBLIC) {
    if (m === pm && (p === route || matchPrefix(p, route))) return "public";
  }
  if (PUBLIC_PREFIXES.some(prefix => p.startsWith(prefix))) return "public";
  if (matchParam(p, "/v1/drive/oauth/callback")) return "public";
  if (matchParam(p, "/v1/email/open/:id")) return "public";

  if (FORMANDO_PREFIXES.some(prefix => p === prefix || p.startsWith(`${prefix}/`))) return "formando";
  if (AUTHENTICATED_PREFIXES.some(prefix => p === prefix || p.startsWith(`${prefix}/`))) return "authenticated";

  return "staff";
}
