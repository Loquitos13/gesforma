import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  apiChangeOwnPassword, apiGoogleLoginStatus, apiLogin, apiLogout, apiMe, apiMicrosoftLoginStatus,
  googleLoginStartUrl, microsoftLoginStartUrl, type SessionUser,
} from "./api";
import { mensagemPalavraPasse } from "./passwordPolicy";

type AuthCtx = {
  user: SessionUser;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth precisa de AuthGate");
  return ctx;
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden>
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.46a5.52 5.52 0 0 1-2.4 3.62v3.01h3.88c2.27-2.09 3.55-5.17 3.55-8.66Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.88-3.01c-1.08.72-2.45 1.15-4.05 1.15-3.11 0-5.75-2.1-6.69-4.92H1.3v3.09A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.31 14.31A7.21 7.21 0 0 1 4.93 12c0-.8.14-1.58.38-2.31V6.6H1.3A12 12 0 0 0 0 12c0 1.94.46 3.78 1.3 5.4l4.01-3.09Z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.14 15.24 0 12 0 7.31 0 3.26 2.69 1.3 6.6l4.01 3.09C6.25 6.87 8.89 4.75 12 4.75Z" />
    </svg>
  );
}

function MicrosoftMark() {
  return (
    <svg viewBox="0 0 23 23" className="w-[18px] h-[18px]" aria-hidden>
      <path fill="#F25022" d="M1 1h10v10H1z" />
      <path fill="#7FBA00" d="M12 1h10v10H12z" />
      <path fill="#00A4EF" d="M1 12h10v10H1z" />
      <path fill="#FFB900" d="M12 12h10v10H12z" />
    </svg>
  );
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [googleOn, setGoogleOn] = useState(false);
  const [microsoftReady, setMicrosoftReady] = useState(false);
  const [microsoftOn, setMicrosoftOn] = useState(false);
  const [novaPasse, setNovaPasse] = useState("");
  const [passeMsg, setPasseMsg] = useState("");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("login");
    if (!q) return;
    const msgs: Record<string, string> = {
      "sem-cliente": "O cliente Google ainda não está configurado. Entre com email e peça à administração para gravar o OAuth.",
      "sem-cliente-microsoft": "A aplicação Microsoft ainda não está configurada. Entre com email e peça à administração para a registar em Configurações.",
      "sem-conta": "Esta conta não tem acesso à secretaria. O email tem de existir como utilizador.",
      inactivo: "Esta conta está desactivada.",
      "oauth-falhou": "Não foi possível concluir a autenticação. Tente de novo.",
      "pedido-invalido": "O pedido expirou. Tente de novo.",
    };
    setError(msgs[q] ?? "Não foi possível entrar com a conta externa.");
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  useEffect(() => {
    apiGoogleLoginStatus()
      .then(r => setGoogleOn(r.configured))
      .catch(() => setGoogleOn(false))
      .finally(() => setGoogleReady(true));
    apiMicrosoftLoginStatus()
      .then(r => setMicrosoftOn(r.configured))
      .catch(() => setMicrosoftOn(false))
      .finally(() => setMicrosoftReady(true));
  }, []);

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
          </div>
          {offline && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              Sem ligação à API. No projecto: <code className="font-mono">npm run api</code> (porta 43148).
            </p>
          )}
          {error && !offline && <p className="text-xs font-medium text-red-600">{error}</p>}
          <div className="space-y-2.5">
            <a
              href={googleOn ? googleLoginStartUrl() : undefined}
              aria-disabled={!googleOn}
              onClick={e => {
                if (!googleOn) {
                  e.preventDefault();
                  setError("O cliente Google ainda não está configurado. Entre com email ou grave o OAuth nas Configurações.");
                }
              }}
              className={`flex items-center justify-center gap-3 w-full h-12 rounded-full text-white text-[15px] font-medium tracking-tight transition-opacity ${
                googleOn || !googleReady ? "bg-[#0b1220] hover:bg-[#111827]" : "bg-[#0b1220]/40 cursor-not-allowed"
              }`}
            >
              <GoogleMark />
              Continuar com Google
            </a>
            <a
              href={microsoftOn ? microsoftLoginStartUrl() : undefined}
              aria-disabled={!microsoftOn}
              onClick={e => {
                if (!microsoftOn) {
                  e.preventDefault();
                  setError("A aplicação Microsoft ainda não está configurada. Entre com email ou registe-a nas Configurações.");
                }
              }}
              className={`flex items-center justify-center gap-3 w-full h-12 rounded-full border text-[15px] font-medium tracking-tight transition-colors ${
                microsoftOn || !microsoftReady
                  ? "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  : "border-slate-200 bg-slate-50 text-slate-400 opacity-50 cursor-not-allowed"
              }`}
            >
              <MicrosoftMark />
              Continuar com Microsoft
            </a>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <span className="flex-1 h-px bg-slate-200" />
            ou
            <span className="flex-1 h-px bg-slate-200" />
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</span>
            <input className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" placeholder="Email da secretaria" />
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

  async function refresh() {
    const r = await apiMe();
    setUser(r.user);
  }

  return <Ctx.Provider value={{ user, logout, refresh }}>{children}</Ctx.Provider>;
}
