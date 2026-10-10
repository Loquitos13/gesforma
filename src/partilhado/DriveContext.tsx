import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiDriveDisconnect, apiDriveStatus, type DriveStatus } from "./api";

const fallback: DriveStatus = {
  configured: false,
  connected: false,
  email: null,
  folderName: "GesForma",
  folderId: null,
  mode: "local",
  hint: "A carregar o estado do Drive…",
};

type DriveCtx = {
  status: DriveStatus;
  ready: boolean;
  refresh: () => Promise<void>;
  disconnect: () => Promise<void>;
};

const Ctx = createContext<DriveCtx | null>(null);

export function DriveProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<DriveStatus>(fallback);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setStatus(await apiDriveStatus());
    } catch {
      setStatus({
        ...fallback,
        hint: "Não foi possível ler o estado do Drive.",
      });
    } finally {
      setReady(true);
    }
  }, []);

  const disconnect = useCallback(async () => {
    await apiDriveDisconnect();
    await refresh();
  }, [refresh]);

  useEffect(() => { void refresh(); }, [refresh]);

  const value = useMemo(() => ({ status, ready, refresh, disconnect }), [status, ready, refresh, disconnect]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDrive() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDrive precisa de DriveProvider");
  return ctx;
}
