import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  apiChangeOwnPassword, apiLogout, apiMe,
  type SessionUser,
} from "./api";
import { destinoDoPerfil, destinoPosLogin, urlAreaFormandoLogin } from "./destinoPerfil";
import { mensagemPalavraPasse } from "./passwordPolicy";

type AuthCtx = {
  user: SessionUser;
  /** Capacidades do perfil (só para a interface; o servidor decide sempre). */
  pode: (capacidade: string) => boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

/** Atalho: `const pode = usePode(); pode("pagamentos.confirmar")`. */
export function usePode() {
  return useAuth().pode;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth precisa de AuthGate");
  return ctx;
}

function EnaLogo({ className }: { className?: string }) {
  return (
    <img
      src="/imagens/ena-logo-nobg.png"
      alt="ENA"
      className={className}
      onError={e => { (e.currentTarget as HTMLImageElement).src = "/imagens/ena_logo.svg"; }}
    />
  );
}

function SessionSplash({ pct }: { pct: number }) {
  const shown = Math.min(100, Math.max(0, Math.round(pct)));
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-6">
      <EnaLogo className="w-[min(88vw,28rem)] h-auto" />
      <div className="mt-12 w-[min(88vw,28rem)]">
        <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={shown} aria-label="A verificar sessão">
          <div
            className="h-full rounded-full bg-[#ffa900] transition-all duration-150 ease-out"
            style={{ width: `${shown}%` }}
          />
        </div>
        <p className="mt-5 text-center text-3xl sm:text-4xl font-bold text-slate-800 tabular-nums" aria-live="polite">
          {shown}%
        </p>
        <p className="mt-2 text-center text-base font-semibold text-slate-600">A verificar sessão</p>
        <p className="mt-1 text-center text-sm text-slate-400">ENA · Escola de Negócios e Administração</p>
      </div>
    </div>
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [capacidades, setCapacidades] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [pct, setPct] = useState(8);
  const [busy, setBusy] = useState(false);
  const [novaPasse, setNovaPasse] = useState("");
  const [passeMsg, setPasseMsg] = useState("");
  const redirigiuLogin = useRef(false);

  useEffect(() => {
    let alive = true;
    let apiDone = false;
    const started = Date.now();
    const minMs = 1800;
    const tick = window.setInterval(() => {
      setPct(p => (p >= 90 ? 90 : p + (p < 40 ? 4 : p < 70 ? 2 : 1)));
    }, 80);
    function finish() {
      if (!alive || !apiDone) return;
      const wait = Math.max(0, minMs - (Date.now() - started));
      window.setTimeout(() => {
        if (!alive) return;
        window.clearInterval(tick);
        setPct(100);
        window.setTimeout(() => {
          if (alive) setReady(true);
        }, 400);
      }, wait);
    }
    apiMe()
      .then(r => {
        if (alive) {
          setUser(r.user);
          setCapacidades(r.pode ?? []);
        }
      })
      .catch(() => {
        if (alive) setUser(null);
      })
      .finally(() => {
        apiDone = true;
        finish();
      });
    return () => {
      alive = false;
      window.clearInterval(tick);
    };
  }, []);

  useEffect(() => {
    if (!ready || user || redirigiuLogin.current) return;
    redirigiuLogin.current = true;
    const path = window.location.pathname.replace(/\/+$/, "") || "/";
    const search = window.location.search;
    const destino = path.startsWith("/gesforma") ? `${path}${search}` : undefined;
    const extra: Record<string, string | undefined> = {};
    const q = new URLSearchParams(search);
    for (const key of ["login", "drive", "recuperar"]) {
      const v = q.get(key);
      if (v) extra[key] = v;
    }
    if (destino) extra.destino = destino;
    window.location.replace(urlAreaFormandoLogin(extra));
  }, [ready, user]);

  async function logout() {
    await apiLogout().catch(() => undefined);
    setUser(null);
  }

  if (!ready || !user) {
    return <SessionSplash pct={pct} />;
  }

  async function trocarPasse(e: React.FormEvent) {
    e.preventDefault();
    const aviso = mensagemPalavraPasse(novaPasse);
    if (aviso) { setPasseMsg(aviso); return; }
    setBusy(true);
    setPasseMsg("");
    try {
      const r = await apiChangeOwnPassword(novaPasse);
      setUser(r.user);
      setNovaPasse("");
    } catch (err) {
      setPasseMsg(err instanceof Error ? err.message : "Não foi possível alterar a palavra-passe.");
    } finally {
      setBusy(false);
    }
  }

  if (user.mustChangePassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <form onSubmit={e => void trocarPasse(e)} className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
          <h1 className="text-xl font-bold text-slate-800">Defina a sua palavra-passe</h1>
          <p className="text-sm text-slate-500">No primeiro acesso tem de escolher uma palavra-passe nova. Precisa de 10 caracteres, com maiúscula, minúscula, algarismo e símbolo.</p>
          {passeMsg && <p className="text-xs font-medium text-red-600">{passeMsg}</p>}
          <input type="password" value={novaPasse} onChange={e => setNovaPasse(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" autoComplete="new-password" />
          <button type="submit" disabled={busy} className="w-full py-2.5 bg-amber-500 text-white text-sm font-semibold rounded-lg disabled:opacity-40">{busy ? "A gravar…" : "Guardar e entrar"}</button>
          <button type="button" onClick={() => void logout()} className="w-full text-xs text-slate-500">Sair</button>
        </form>
      </div>
    );
  }

  if (user.role === "formando") {
    window.location.replace(destinoDoPerfil(user.role));
    return <SessionSplash pct={100} />;
  }

  async function refresh() {
    const r = await apiMe();
    setUser(r.user);
    setCapacidades(r.pode ?? []);
  }

  return <Ctx.Provider value={{ user, logout, refresh, pode: (c: string) => capacidades.includes(c) }}>{children}</Ctx.Provider>;
}
