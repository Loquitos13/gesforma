import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiLogin, apiLogout, apiMe, type SessionUser } from "./api";

type AuthCtx = {
  user: SessionUser;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

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
  const [ready, setReady] = useState(false);
  const [pct, setPct] = useState(8);
  const [email, setEmail] = useState("tania@ena.pt");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);

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
        if (alive) setUser(r.user);
      })
      .catch(err => {
        if (alive) setOffline(err instanceof TypeError);
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

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await apiLogin(email, password);
      setUser(r.user);
      setOffline(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar.");
      setOffline(err instanceof TypeError);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await apiLogout().catch(() => undefined);
    setUser(null);
    setPassword("");
    setShowPassword(false);
  }

  if (!ready) {
    return <SessionSplash pct={pct} />;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <form onSubmit={login} className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
          <div>
            <EnaLogo className="h-9 w-auto" />
            <h1 className="text-xl font-bold text-slate-800 mt-4">Entrar na secretaria</h1>
            <p className="text-sm text-slate-500 mt-1">Sessão com cookie httpOnly. A API recusa origens que não sejam a app.</p>
          </div>
          {offline && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              Sem ligação à API. No projecto: <code className="font-mono">npm run api</code> (porta 43148).
            </p>
          )}
          {error && !offline && <p className="text-xs font-medium text-red-600">{error}</p>}
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</span>
            <input className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Palavra-passe</span>
            <div className="relative">
              <input
                className="w-full px-3 py-2 pr-11 text-sm border border-slate-200 rounded-lg"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                aria-label={showPassword ? "Ocultar palavra-passe" : "Mostrar palavra-passe"}
                aria-pressed={showPassword}
                title={showPassword ? "Ocultar palavra-passe" : "Mostrar palavra-passe"}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-5 0-9.27-3.11-11-8 1.02-2.89 2.87-5.17 5.17-6.61M9.9 4.24A10.94 10.94 0 0 1 12 4c5 0 9.27 3.11 11 8a11.6 11.6 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </label>
          <button type="submit" disabled={busy} className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white text-sm font-semibold rounded-lg">
            {busy ? "A entrar…" : "Entrar"}
          </button>
        </form>
      </div>
    );
  }

  return <Ctx.Provider value={{ user, logout }}>{children}</Ctx.Provider>;
}
