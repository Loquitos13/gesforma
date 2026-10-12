/** Para onde a sessão vai depois de entrar (sem pedido explícito). */
export function destinoDoPerfil(role: string) {
  if (role === "formando") return "/area-formando";
  if (role === "formador") return "/gesforma/formador/turmas";
  if (role === "financiada") return "/gesforma/financiada";
  return "/gesforma/gold";
}

/** Caminho relativo seguro pedido em ?destino= (só GesForma). */
export function destinoPosLogin(role: string, pedido?: string | null) {
  if (role === "formando") return "/area-formando";
  const raw = (pedido ?? "").trim();
  if (raw.startsWith("/gesforma") && !raw.startsWith("//")) {
    try {
      const u = new URL(raw, "http://local");
      if (u.pathname.startsWith("/gesforma")) return `${u.pathname}${u.search}`;
    } catch {
      /* ignorar */
    }
  }
  return destinoDoPerfil(role);
}

export function urlAreaFormandoLogin(extra?: Record<string, string | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(extra ?? {})) {
    if (v != null && v !== "") p.set(k, v);
  }
  const q = p.toString();
  return q ? `/area-formando?${q}` : "/area-formando";
}
