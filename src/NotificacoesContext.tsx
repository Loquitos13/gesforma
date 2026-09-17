import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiMarcarLidas, apiNotificacoes, type Notificacao } from "./api";

type NotificacoesCtx = {
  items: Notificacao[];
  naoLidas: number;
  bloqueios: number;
  estado: "loading" | "ready" | "offline";
  marcarLida: (chave: string) => void;
  marcarTodas: () => void;
  recarregar: () => void;
};

const Ctx = createContext<NotificacoesCtx | null>(null);

/** Refresca a cada 2 minutos: as notificações são derivadas dos dados operacionais. */
const INTERVALO_MS = 120_000;

export function NotificacoesProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Notificacao[]>([]);
  const [estado, setEstado] = useState<NotificacoesCtx["estado"]>("loading");

  const recarregar = useCallback(() => {
    apiNotificacoes()
      .then(r => { setItems(r.notificacoes); setEstado("ready"); })
      .catch(() => setEstado(prev => (prev === "ready" ? "ready" : "offline")));
  }, []);

  useEffect(() => {
    recarregar();
    const timer = window.setInterval(recarregar, INTERVALO_MS);
    return () => window.clearInterval(timer);
  }, [recarregar]);

  const marcarLida = useCallback((chave: string) => {
    setItems(prev => prev.map(n => (n.chave === chave ? { ...n, lida: true } : n)));
    void apiMarcarLidas([chave]).catch(() => undefined);
  }, []);

  const marcarTodas = useCallback(() => {
    setItems(prev => {
      const chaves = prev.filter(n => !n.lida).map(n => n.chave);
      if (chaves.length) void apiMarcarLidas(chaves).catch(() => undefined);
      return prev.map(n => ({ ...n, lida: true }));
    });
  }, []);

  const value = useMemo<NotificacoesCtx>(() => ({
    items,
    naoLidas: items.filter(n => !n.lida).length,
    bloqueios: items.filter(n => !n.lida && n.tipo === "error").length,
    estado,
    marcarLida,
    marcarTodas,
    recarregar,
  }), [items, estado, marcarLida, marcarTodas, recarregar]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNotificacoes() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useNotificacoes precisa de NotificacoesProvider");
  return ctx;
}
