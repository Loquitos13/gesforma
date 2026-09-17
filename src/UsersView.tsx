import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "./AuthGate";
import {
  ApiError,
  apiCreateUser,
  apiDeleteUser,
  apiPatchUser,
  apiSetUserPassword,
  apiUsers,
  type StaffRole,
  type StaffUser,
} from "./api";
import { AppModal } from "./FormKit";
import { ConfirmDangerModal, EmptyHint, MobileCard, RowActions, type RowAction } from "./SecretaryUX";

export const STAFF_ROLES: { value: StaffRole; label: string; hint: string }[] = [
  { value: "admin", label: "Administração", hint: "Gere utilizadores, OAuth e tudo o resto." },
  { value: "secretaria", label: "Secretaria", hint: "Acesso geral à secretaria Gold e Financiada." },
  { value: "comercial", label: "Comercial Gold", hint: "Pré-inscrições, campanhas e turmas Gold." },
  { value: "financiada", label: "Secretaria Financiada", hint: "Inscrições, elegibilidade e UFCD." },
];

export function roleLabel(role: string) {
  return STAFF_ROLES.find(r => r.value === role)?.label ?? role;
}

const iCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent";

const I = {
  plus: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
    </svg>
  ),
  key: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L4.5 19.5 2 17l5.757-5.757A6 6 0 1118 8zm-6-2a2 2 0 100 4 2 2 0 000-4z" clipRule="evenodd" />
    </svg>
  ),
  edit: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
    </svg>
  ),
  trash: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  ),
  off: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path fillRule="evenodd" d="M10 2a1 1 0 00-1 1v6a1 1 0 102 0V3a1 1 0 00-1-1zM5.05 5.05a7 7 0 000 9.9C6.41 16.32 8.2 17 10 17s3.59-.68 4.95-2.05a7 7 0 000-9.9 1 1 0 00-1.414 1.414 5 5 0 010 7.07A4.98 4.98 0 0110 15a4.98 4.98 0 01-3.536-1.465 5 5 0 010-7.07A1 1 0 005.05 5.05z" clipRule="evenodd" />
    </svg>
  ),
};

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function formatWhen(iso: string | null) {
  if (!iso) return "Nunca entrou";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Nunca entrou";
  return d.toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" });
}

function generatePassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const pick = (n: number) => Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  return `Ena.${pick(4)}-${pick(4)}`;
}

function roleBadge(role: string) {
  const variant: Record<string, string> = {
    admin: "bg-amber-100 text-amber-800",
    secretaria: "bg-slate-100 text-slate-700",
    comercial: "bg-violet-100 text-violet-800",
    financiada: "bg-blue-100 text-blue-800",
  };
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${variant[role] ?? "bg-slate-100 text-slate-600"}`}>{roleLabel(role)}</span>;
}

function estadoBadge(active: boolean) {
  return active
    ? <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">Activo</span>
    : <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Inactivo</span>;
}

type Draft = { name: string; email: string; role: StaffRole; password: string; active: boolean };

const emptyDraft = (): Draft => ({ name: "", email: "", role: "secretaria", password: "", active: true });

export function UsersView() {
  const { user: me, refresh } = useAuth();
  const isAdmin = me.role === "admin";
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<"todos" | StaffRole>("todos");
  const [estadoFilter, setEstadoFilter] = useState<"todos" | "activo" | "inactivo">("todos");
  const [editor, setEditor] = useState<"new" | StaffUser | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [pwdUser, setPwdUser] = useState<StaffUser | null>(null);
  const [pwd, setPwd] = useState("");
  const [pwdShow, setPwdShow] = useState(false);
  const [revoke, setRevoke] = useState(true);
  const [toDelete, setToDelete] = useState<StaffUser | null>(null);
  const [toToggle, setToToggle] = useState<StaffUser | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await apiUsers();
      setUsers(r.users);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 403
        ? "Só a administração pode gerir utilizadores."
        : err instanceof Error ? err.message : "Não foi possível ler os utilizadores.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return users.filter(u => {
      if (roleFilter !== "todos" && u.role !== roleFilter) return false;
      if (estadoFilter === "activo" && !u.active) return false;
      if (estadoFilter === "inactivo" && u.active) return false;
      if (!term) return true;
      return `${u.name} ${u.email} ${roleLabel(u.role)}`.toLowerCase().includes(term);
    });
  }, [users, q, roleFilter, estadoFilter]);

  const stats = useMemo(() => ({
    total: users.length,
    activos: users.filter(u => u.active).length,
    admins: users.filter(u => u.role === "admin" && u.active).length,
  }), [users]);

  function openNew() {
    setDraft(emptyDraft());
    setShowPass(false);
    setFormError("");
    setEditor("new");
  }

  function openEdit(u: StaffUser) {
    setDraft({ name: u.name, email: u.email, role: u.role, password: "", active: u.active });
    setShowPass(false);
    setFormError("");
    setEditor(u);
  }

  async function saveUser() {
    setBusy(true);
    setFormError("");
    try {
      if (editor === "new") {
        if (draft.password.length < 8) {
          setFormError("A palavra-passe precisa de pelo menos 8 caracteres.");
          return;
        }
        await apiCreateUser({
          name: draft.name.trim(),
          email: draft.email.trim(),
          password: draft.password,
          role: draft.role,
          active: draft.active,
        });
        setFlash("Utilizador criado. Pode entrar com email ou com a mesma conta Google.");
      } else if (editor) {
        const saved = await apiPatchUser(editor.id, {
          name: draft.name.trim(),
          email: draft.email.trim(),
          role: draft.role,
          active: draft.active,
        });
        if (saved.user.id === me.id) await refresh().catch(() => undefined);
        setFlash("Dados do utilizador actualizados.");
      }
      setEditor(null);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Não foi possível gravar.");
    } finally {
      setBusy(false);
    }
  }

  async function savePassword() {
    if (!pwdUser || pwd.length < 8) {
      setFormError("A palavra-passe precisa de pelo menos 8 caracteres.");
      return;
    }
    setBusy(true);
    setFormError("");
    try {
      await apiSetUserPassword(pwdUser.id, pwd, revoke);
      setPwdUser(null);
      setPwd("");
      setFlash(revoke ? "Palavra-passe alterada. As sessões abertas foram encerradas." : "Palavra-passe alterada.");
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Não foi possível alterar a palavra-passe.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmToggle() {
    if (!toToggle) return;
    try {
      await apiPatchUser(toToggle.id, { active: !toToggle.active });
      setFlash(toToggle.active ? `${toToggle.name} ficou inactivo e saiu das sessões abertas.` : `${toToggle.name} voltou a ficar activo.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível alterar o estado.");
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await apiDeleteUser(toDelete.id);
      setFlash(`${toDelete.name} foi removido.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível eliminar.");
    }
  }

  function actionsFor(u: StaffUser) {
    const self = u.id === me.id;
    const acts: RowAction[] = [
      { label: "Editar", icon: I.edit, tone: "blue", onClick: () => openEdit(u) },
      { label: "Palavra-passe", icon: I.key, tone: "gray", onClick: () => { setPwdUser(u); setPwd(""); setPwdShow(false); setRevoke(true); setFormError(""); } },
    ];
    if (!self) {
      acts.push({
        label: u.active ? "Desactivar" : "Activar",
        icon: I.off,
        tone: u.active ? "gray" : "teal",
        onClick: () => setToToggle(u),
      });
      acts.push({ label: "Eliminar", icon: I.trash, tone: "red", onClick: () => setToDelete(u) });
    }
    return acts;
  }

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Utilizadores</h1>
          <p className="text-sm text-slate-500 mt-0.5">Quem entra na secretaria do GesForma.</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <p className="text-sm font-semibold text-slate-800">Só a administração gere contas</p>
          <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
            Peça a um administrador para criar a conta ou alterar o perfil. O login com Google só funciona se o email já existir nesta lista.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Utilizadores</h1>
          <p className="text-sm text-slate-500 mt-0.5">Contas da secretaria. Quem não estiver aqui não entra - nem com Google.</p>
        </div>
        <button type="button" onClick={openNew} className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg shadow-sm whitespace-nowrap">
          {I.plus}Novo utilizador
        </button>
      </div>

      {flash && (
        <div className="flex items-start justify-between gap-3 bg-emerald-50 border border-emerald-100 text-emerald-800 text-sm font-medium rounded-xl px-4 py-3">
          <p>{flash}</p>
          <button type="button" onClick={() => setFlash(null)} className="text-emerald-700 hover:text-emerald-900 text-xs font-semibold">Fechar</button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label="Contas" value={stats.total} sub="na secretaria" />
        <Stat label="Activos" value={stats.activos} sub="podem entrar" />
        <Stat label="Administração" value={stats.admins} sub="gerem utilizadores" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 px-4 py-3 border-b border-slate-100">
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Pesquisar nome ou email…"
            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value as typeof roleFilter)} className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white">
            <option value="todos">Todos os perfis</option>
            {STAFF_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <select value={estadoFilter} onChange={e => setEstadoFilter(e.target.value as typeof estadoFilter)} className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white">
            <option value="todos">Todos os estados</option>
            <option value="activo">Activos</option>
            <option value="inactivo">Inactivos</option>
          </select>
        </div>

        {loading && <p className="px-4 py-10 text-center text-sm text-slate-400">A carregar utilizadores…</p>}
        {!loading && error && (
          <div className="px-4 py-10 text-center">
            <p className="text-sm text-red-600 font-medium">{error}</p>
            <button type="button" onClick={() => void load()} className="mt-3 text-sm font-semibold text-amber-600 hover:text-amber-700">Tentar outra vez</button>
          </div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <EmptyHint
            text={users.length === 0 ? "Ainda não há contas para mostrar." : "Nenhum utilizador corresponde à pesquisa."}
            action={users.length === 0 ? "Criar o primeiro utilizador" : "Limpar filtros"}
            onAction={users.length === 0 ? openNew : () => { setQ(""); setRoleFilter("todos"); setEstadoFilter("todos"); }}
          />
        )}

        {!loading && !error && filtered.length > 0 && (
          <>
            <div className="md:hidden p-3 space-y-2">
              {filtered.map(u => (
                <MobileCard
                  key={u.id}
                  title={u.name}
                  sub={u.email}
                  badge={estadoBadge(u.active)}
                  meta={[roleLabel(u.role), formatWhen(u.last_login_at), u.id === me.id ? "A sua conta" : `${u.sessions_open} sessão(ões)`]}
                  onOpen={() => openEdit(u)}
                  actions={actionsFor(u)}
                />
              ))}
            </div>
            <div className="hidden md:block overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <Th>Nome</Th>
                    <Th>Email</Th>
                    <Th>Perfil</Th>
                    <Th>Estado</Th>
                    <Th>Último acesso</Th>
                    <Th>Sessões</Th>
                    <Th>Acções</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5">
                        <p className="text-sm font-semibold text-slate-800">{u.name}</p>
                        {u.id === me.id && <p className="text-[11px] text-amber-600 font-semibold">A sua conta</p>}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{u.email}</td>
                      <td className="px-3 py-2.5">{roleBadge(u.role)}</td>
                      <td className="px-3 py-2.5">{estadoBadge(u.active)}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">{formatWhen(u.last_login_at)}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-500">{u.sessions_open}</td>
                      <td className="px-3 py-2.5"><RowActions actions={actionsFor(u)} primary={2} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <AppModal
        open={editor !== null}
        onClose={() => setEditor(null)}
        title={editor === "new" ? "Novo utilizador" : "Editar utilizador"}
        sub={editor === "new" ? "A conta passa a poder entrar com email ou com Google, se o email for o mesmo." : "O email tem de coincidir com a conta Google para o botão do login funcionar."}
        footer={
          <>
            <button type="button" onClick={() => setEditor(null)} className="px-4 py-2.5 text-sm font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">Cancelar</button>
            <button type="button" disabled={busy || !draft.name.trim() || !draft.email.trim()} onClick={() => void saveUser()} className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white">
              {busy ? "A gravar…" : "Guardar"}
            </button>
          </>
        }
      >
        <div className="p-5 space-y-3">
          {formError && editor && <p className="text-xs font-medium text-red-600">{formError}</p>}
          <Field label="Nome"><input className={iCls} value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="Nome na secretaria" /></Field>
          <Field label="Email" hint="É o identificador do login e do Continuar com Google.">
            <input className={iCls} type="email" value={draft.email} onChange={e => setDraft(d => ({ ...d, email: e.target.value }))} placeholder="nome@ena.pt" />
          </Field>
          <Field label="Perfil">
            <select className={iCls} value={draft.role} onChange={e => setDraft(d => ({ ...d, role: e.target.value as StaffRole }))}>
              {STAFF_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <p className="text-xs text-slate-400">{STAFF_ROLES.find(r => r.value === draft.role)?.hint}</p>
          </Field>
          {editor === "new" && (
            <Field label="Palavra-passe inicial" hint="Mínimo 8 caracteres. A pessoa pode depois entrar também com Google.">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input className={`${iCls} pr-11`} type={showPass ? "text" : "password"} value={draft.password} onChange={e => setDraft(d => ({ ...d, password: e.target.value }))} autoComplete="new-password" />
                  <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2 py-1 text-[11px] font-semibold text-slate-500">
                    {showPass ? "Ocultar" : "Ver"}
                  </button>
                </div>
                <button type="button" onClick={() => { setDraft(d => ({ ...d, password: generatePassword() })); setShowPass(true); }} className="px-3 py-2 text-xs font-semibold border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 whitespace-nowrap">
                  Gerar
                </button>
              </div>
            </Field>
          )}
          {editor !== "new" && (
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={draft.active} onChange={e => setDraft(d => ({ ...d, active: e.target.checked }))} disabled={typeof editor === "object" && editor !== null && editor.id === me.id} />
              Conta activa
            </label>
          )}
        </div>
      </AppModal>

      <AppModal
        open={!!pwdUser}
        onClose={() => setPwdUser(null)}
        title="Nova palavra-passe"
        sub={pwdUser ? `Definir uma palavra-passe para ${pwdUser.name}.` : undefined}
        footer={
          <>
            <button type="button" onClick={() => setPwdUser(null)} className="px-4 py-2.5 text-sm font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">Cancelar</button>
            <button type="button" disabled={busy || pwd.length < 8} onClick={() => void savePassword()} className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white">
              {busy ? "A gravar…" : "Guardar palavra-passe"}
            </button>
          </>
        }
      >
        <div className="p-5 space-y-3">
          {formError && pwdUser && <p className="text-xs font-medium text-red-600">{formError}</p>}
          <Field label="Palavra-passe" hint="Mínimo 8 caracteres.">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input className={`${iCls} pr-11`} type={pwdShow ? "text" : "password"} value={pwd} onChange={e => setPwd(e.target.value)} autoComplete="new-password" />
                <button type="button" onClick={() => setPwdShow(v => !v)} className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2 py-1 text-[11px] font-semibold text-slate-500">
                  {pwdShow ? "Ocultar" : "Ver"}
                </button>
              </div>
              <button type="button" onClick={() => { setPwd(generatePassword()); setPwdShow(true); }} className="px-3 py-2 text-xs font-semibold border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 whitespace-nowrap">
                Gerar
              </button>
            </div>
          </Field>
          <label className="flex items-start gap-2 text-sm text-slate-600">
            <input type="checkbox" className="mt-0.5" checked={revoke} onChange={e => setRevoke(e.target.checked)} />
            Encerrar as sessões abertas desta conta
          </label>
        </div>
      </AppModal>

      <ConfirmDangerModal
        open={!!toToggle}
        onClose={() => setToToggle(null)}
        title={toToggle?.active ? "Desactivar utilizador" : "Activar utilizador"}
        body={toToggle?.active
          ? `${toToggle.name} deixa de conseguir entrar. As sessões abertas são encerradas.`
          : `${toToggle?.name} volta a poder entrar com email ou Google.`}
        risk={toToggle?.active ? "Pode voltar a activar a conta mais tarde." : undefined}
        confirmLabel={toToggle?.active ? "Desactivar" : "Activar"}
        onConfirm={() => void confirmToggle()}
      />

      <ConfirmDangerModal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Eliminar utilizador"
        body={`${toDelete?.name} (${toDelete?.email}) deixa de existir. Esta acção não se desfaz.`}
        risk="Prefira desactivar se quiser manter o histórico e voltar a dar acesso."
        confirmLabel="Eliminar"
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-800 mt-1 tabular-nums">{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap bg-slate-50 border-b border-slate-200">{children}</th>;
}
