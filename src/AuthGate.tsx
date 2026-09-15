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

export function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("tania@ena.pt");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    apiMe()
      .then(r => setUser(r.user))
      .catch(err => {
        setOffline(err instanceof TypeError);
      })
      .finally(() => setReady(true));
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
  }

  if (!ready) {
    return (
      <div className="min-h-full flex items-center justify-center bg-slate-100">
        <p className="text-sm text-slate-500">A verificar a sessão…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-full flex items-center justify-center bg-slate-100 p-4">
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
            <input className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
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
