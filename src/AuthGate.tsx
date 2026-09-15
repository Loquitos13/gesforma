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

function EnaMark({ size = 72 }: { size?: number }) {
  return (
    <div
      className="rounded-full bg-amber-500 text-white font-extrabold tracking-[0.18em] flex items-center justify-center shadow-[0_8px_24px_rgba(245,158,11,0.35)]"
      style={{ width: size, height: size, fontSize: size * 0.22 }}
      aria-hidden
    >
      ENA
    </div>
  );
}

function SessionSplash({ pct }: { pct: number }) {
  const shown = Math.min(100, Math.max(0, Math.round(pct)));
  const r = 42;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - shown / 100);
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 px-6">
      <div className="relative" style={{ width: 120, height: 120 }}>
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 120 120" aria-hidden>
          <circle cx="60" cy="60" r={r} fill="none" stroke="#e2e8f0" strokeWidth="6" />
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-150 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <EnaMark size={72} />
        </div>
      </div>
      <p className="mt-5 text-sm font-semibold text-slate-700 tabular-nums" aria-live="polite">
        A verificar sessão · {shown}%
      </p>
      <p className="mt-1 text-xs text-slate-400">ENA · Escola de Negócios e Administração</p>
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
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <form onSubmit={login} className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
          <div>
            <p className="bg-amber-500 text-white font-extrabold text-sm px-3 py-1.5 rounded-lg tracking-widest inline-block">GESFORMA</p>
            <h1 className="text-xl font-bold text-slate-800 mt-3">Entrar na secretaria</h1>
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
