import { useState, useMemo } from "react";
import { AppModal } from "./FormKit";
import {
  INITIAL_USERS,
  PERMISSION_GROUPS,
  ROLE_PERMISSION_PRESETS,
  ALL_PERMISSION_IDS,
  type SystemUser,
  type UserRole,
} from "./userModel";

const I = {
  plus: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
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
  shield: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944zM11 14a1 1 0 11-2 0 1 1 0 012 0zm0-7a1 1 0 10-2 0v3a1 1 0 102 0V7z" clipRule="evenodd" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  ),
  key: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd" />
    </svg>
  ),
  eye: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
    </svg>
  ),
};

export function UsersView() {
  const [users, setUsers] = useState<SystemUser[]>(INITIAL_USERS);
  const [search, setSearch] = useState("");
  const [filtroRole, setFiltroRole] = useState<string>("Todos");
  const [filtroEstado, setFiltroEstado] = useState<string>("Todos");

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);

  // Form State
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formTelefone, setFormTelefone] = useState("");
  const [formCargo, setFormCargo] = useState("");
  const [formRole, setFormRole] = useState<UserRole>("Secretaria");
  const [formPassword, setFormPassword] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [formPermissions, setFormPermissions] = useState<string[]>([]);
  const [formError, setFormError] = useState("");
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Stats
  const totalUsers = users.length;
  const activeUsers = users.filter(u => u.active).length;
  const adminUsers = users.filter(u => u.role === "Administrador").length;
  const crmUsers = users.filter(u => u.role === "Comercial CRM").length;

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchSearch =
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        u.cargo.toLowerCase().includes(search.toLowerCase());
      const matchRole = filtroRole === "Todos" || u.role === filtroRole;
      const matchEstado =
        filtroEstado === "Todos" ||
        (filtroEstado === "Ativos" && u.active) ||
        (filtroEstado === "Inativos" && !u.active);
      return matchSearch && matchRole && matchEstado;
    });
  }, [users, search, filtroRole, filtroEstado]);

  function showFeedback(msg: string) {
    setFeedbackMsg(msg);
    setTimeout(() => {
      setFeedbackMsg(null);
    }, 3500);
  }

  function handleOpenCreate() {
    setEditingUser(null);
    setFormName("");
    setFormEmail("");
    setFormTelefone("");
    setFormCargo("");
    setFormRole("Secretaria");
    setFormPassword("");
    setFormActive(true);
    setFormPermissions([...ROLE_PERMISSION_PRESETS["Secretaria"]]);
    setFormError("");
    setModalOpen(true);
  }

  function handleOpenEdit(user: SystemUser) {
    setEditingUser(user);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormTelefone(user.telefone);
    setFormCargo(user.cargo);
    setFormRole(user.role);
    setFormPassword("");
    setFormActive(user.active);
    setFormPermissions([...user.permissoes]);
    setFormError("");
    setModalOpen(true);
  }

  function handleApplyRolePreset(role: UserRole) {
    setFormRole(role);
    const preset = ROLE_PERMISSION_PRESETS[role] ?? [];
    setFormPermissions([...preset]);
  }

  function handleSelectAllPermissions() {
    setFormPermissions([...ALL_PERMISSION_IDS]);
  }

  function handleClearAllPermissions() {
    setFormPermissions([]);
  }

  function handleToggleGroupPermissions(groupId: string) {
    const group = PERMISSION_GROUPS.find(g => g.id === groupId);
    if (!group) return;
    const groupIds = group.permissoes.map(p => p.id);
    const allSelected = groupIds.every(id => formPermissions.includes(id));
    if (allSelected) {
      setFormPermissions(prev => prev.filter(id => !groupIds.includes(id)));
    } else {
      setFormPermissions(prev => Array.from(new Set([...prev, ...groupIds])));
    }
  }

  function handleTogglePermission(permId: string) {
    setFormPermissions(prev =>
      prev.includes(permId) ? prev.filter(id => id !== permId) : [...prev, permId],
    );
  }

  function handleSaveUser() {
    if (!formName.trim()) {
      setFormError("O nome completo e obrigatorio.");
      return;
    }
    if (!formEmail.trim() || !formEmail.includes("@")) {
      setFormError("Insira um endereço de email valido.");
      return;
    }
    if (!editingUser && !formPassword.trim()) {
      setFormError("Defina uma palavra-passe inicial para o novo utilizador.");
      return;
    }

    if (editingUser) {
      setUsers(prev =>
        prev.map(u =>
          u.id === editingUser.id
            ? {
                ...u,
                name: formName.trim(),
                email: formEmail.trim(),
                telefone: formTelefone.trim(),
                cargo: formCargo.trim(),
                role: formRole,
                active: formActive,
                permissoes: formPermissions,
              }
            : u,
        ),
      );
      showFeedback(`Utilizador ${formName.trim()} atualizado com sucesso.`);
    } else {
      const newUser: SystemUser = {
        id: `USR-00${users.length + 1}`,
        name: formName.trim(),
        email: formEmail.trim(),
        telefone: formTelefone.trim() || "910 000 000",
        cargo: formCargo.trim() || formRole,
        role: formRole,
        active: formActive,
        ultimoAcesso: "Nunca",
        criadoEm: new Date().toISOString().slice(0, 10),
        permissoes: formPermissions,
      };
      setUsers(prev => [newUser, ...prev]);
      showFeedback(`Novo utilizador ${formName.trim()} criado com sucesso.`);
    }
    setModalOpen(false);
  }

  function handleToggleActive(id: string) {
    setUsers(prev =>
      prev.map(u => {
        if (u.id === id) {
          const nextState = !u.active;
          showFeedback(`Utilizador ${u.name} marcado como ${nextState ? "ativo" : "inativo"}.`);
          return { ...u, active: nextState };
        }
        return u;
      }),
    );
  }

  function handleDeleteUser(id: string) {
    const target = users.find(u => u.id === id);
    if (!target) return;
    if (confirm(`Tem a certeza de que pretende remover o utilizador ${target.name}?`)) {
      setUsers(prev => prev.filter(u => u.id !== id));
      showFeedback(`Utilizador ${target.name} removido do sistema.`);
    }
  }

  const roleBadges: Record<UserRole, string> = {
    Administrador: "bg-red-50 text-red-700 border-red-200",
    Secretaria: "bg-blue-50 text-blue-700 border-blue-200",
    "Comercial CRM": "bg-amber-50 text-amber-700 border-amber-200",
    "Coordenador Pedagógico": "bg-purple-50 text-purple-700 border-purple-200",
    Operador: "bg-slate-100 text-slate-700 border-slate-200",
  };

  return (
    <div className="space-y-5">
      {/* Toast Feedback */}
      {feedbackMsg && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg border border-slate-700 flex items-center gap-2 text-sm">
          <span className="text-emerald-400">{I.check}</span>
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 leading-tight">Gestão de Utilizadores</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Administração de contas de acesso, perfis de utilizador e seleção granular de permissões do GesForma.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm whitespace-nowrap self-start"
        >
          {I.plus} Novo Utilizador
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Total Utilizadores</p>
          <p className="text-2xl font-bold text-slate-800">{totalUsers}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Utilizadores Ativos</p>
          <p className="text-2xl font-bold text-emerald-600">{activeUsers}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Administradores</p>
          <p className="text-2xl font-bold text-red-600">{adminUsers}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Comercial e CRM</p>
          <p className="text-2xl font-bold text-amber-600">{crmUsers}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{I.search}</span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar por nome, email ou cargo..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mr-1">Perfil:</span>
            {["Todos", "Administrador", "Secretaria", "Comercial CRM", "Coordenador Pedagógico"].map(r => (
              <button
                key={r}
                type="button"
                onClick={() => setFiltroRole(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  filtroRole === r ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mr-1">Estado:</span>
            {["Todos", "Ativos", "Inativos"].map(st => (
              <button
                key={st}
                type="button"
                onClick={() => setFiltroEstado(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  filtroEstado === st ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Users Table and Cards */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            Nenhum utilizador encontrado para os filtros selecionados.
          </div>
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredUsers.map(user => (
                <div key={user.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-500 text-white font-bold text-sm flex items-center justify-center flex-shrink-0">
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{user.name}</p>
                        <p className="text-xs text-slate-500">{user.cargo}</p>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${roleBadges[user.role]}`}
                    >
                      {user.role}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 space-y-1">
                    <p className="flex items-center gap-1.5">
                      <span className="text-slate-400">Email:</span> {user.email}
                    </p>
                    <p className="flex items-center gap-1.5">
                      <span className="text-slate-400">Telefone:</span> {user.telefone}
                    </p>
                    <p className="flex items-center gap-1.5">
                      <span className="text-slate-400">Permissões:</span>
                      <span className="font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        {user.permissoes.length} de {ALL_PERMISSION_IDS.length} ativas
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(user.id)}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-colors ${
                        user.active ? "text-emerald-700 bg-emerald-50 hover:bg-emerald-100" : "text-slate-500 bg-slate-100 hover:bg-slate-200"
                      }`}
                    >
                      {user.active ? "Conta Ativa" : "Conta Inativa"}
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenEdit(user)}
                        className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center gap-1"
                      >
                        {I.edit} Editar Permissões
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                        title="Eliminar utilizador"
                      >
                        {I.trash}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">Utilizador</th>
                    <th className="py-3.5 px-4">Contacto</th>
                    <th className="py-3.5 px-4">Perfil</th>
                    <th className="py-3.5 px-4">Permissões de Acesso</th>
                    <th className="py-3.5 px-4">Último Acesso</th>
                    <th className="py-3.5 px-4 text-center">Estado</th>
                    <th className="py-3.5 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map(user => (
                    <tr key={user.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-amber-500 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                            {user.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">{user.name}</p>
                            <p className="text-xs text-slate-500">{user.cargo}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-slate-800 text-xs font-medium">{user.email}</p>
                        <p className="text-xs text-slate-400">{user.telefone}</p>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${roleBadges[user.role]}`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800">
                              {user.permissoes.length} / {ALL_PERMISSION_IDS.length}
                            </span>
                            <span className="text-xs text-slate-500">
                              {user.permissoes.length === ALL_PERMISSION_IDS.length
                                ? "Acesso Total"
                                : user.permissoes.length === 0
                                ? "Sem Permissões"
                                : "Acesso Personalizado"}
                            </span>
                          </div>
                          <div className="flex gap-1 flex-wrap max-w-xs">
                            {PERMISSION_GROUPS.map(g => {
                              const countInGroup = g.permissoes.filter(p => user.permissoes.includes(p.id)).length;
                              if (countInGroup === 0) return null;
                              return (
                                <span
                                  key={g.id}
                                  title={`${g.categoria}: ${countInGroup} ativas`}
                                  className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium border border-slate-200"
                                >
                                  {g.categoria.split(" ")[0]} ({countInGroup})
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                        {user.ultimoAcesso}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(user.id)}
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                            user.active
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                              : "bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200"
                          }`}
                        >
                          {user.active ? "Ativo" : "Inativo"}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(user)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-amber-100 hover:text-amber-800 rounded-lg transition-colors"
                            title="Editar utilizador e permissões"
                          >
                            {I.edit} Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(user.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Remover utilizador"
                          >
                            {I.trash}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Modal Criar / Editar Utilizador com Seleção de Permissões */}
      <AppModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingUser ? `Editar Utilizador: ${editingUser.name}` : "Criar Novo Utilizador"}
        sub="Defina os dados da conta e selecione individualmente as permissões de acesso ao sistema GesForma."
        size="xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="text-xs text-slate-500 font-medium">
              <span className="font-bold text-amber-700">{formPermissions.length}</span> de{" "}
              {ALL_PERMISSION_IDS.length} permissões selecionadas
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveUser}
                className="px-5 py-2 text-sm font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition-colors shadow-sm"
              >
                {editingUser ? "Guardar Alterações" : "Criar Utilizador"}
              </button>
            </div>
          </div>
        }
      >
        <div className="p-6 space-y-6">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-700">
              {formError}
            </div>
          )}

          {/* Dados Gerais do Utilizador */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-3 flex items-center gap-2">
              <span className="text-amber-500">{I.key}</span> 1. Dados Pessoais e Credenciais
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Nome Completo *</span>
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="ex: Sofia Ferreira Silva"
                  className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Email Profissional *</span>
                <input
                  type="email"
                  value={formEmail}
                  onChange={e => setFormEmail(e.target.value)}
                  placeholder="ex: sofia.silva@ena.pt"
                  className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Telefone / Telemóvel</span>
                <input
                  type="text"
                  value={formTelefone}
                  onChange={e => setFormTelefone(e.target.value)}
                  placeholder="ex: 914 000 000"
                  className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Cargo / Função</span>
                <input
                  type="text"
                  value={formCargo}
                  onChange={e => setFormCargo(e.target.value)}
                  placeholder="ex: Coordenadora Comercial CRM"
                  className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Perfil Base</span>
                <select
                  value={formRole}
                  onChange={e => handleApplyRolePreset(e.target.value as UserRole)}
                  className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                >
                  <option value="Administrador">Administrador (Acesso total)</option>
                  <option value="Secretaria">Secretaria Geral (Gold, Financiada, Formadores)</option>
                  <option value="Comercial CRM">Comercial CRM (Leads, Notas, Parceiros)</option>
                  <option value="Coordenador Pedagógico">Coordenador Pedagógico (Cursos, Turmas, DTP)</option>
                  <option value="Operador">Operador (Atendimento e consultas)</option>
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-slate-600">
                  {editingUser ? "Nova Palavra-passe (deixe em branco para manter)" : "Palavra-passe Inicial *"}
                </span>
                <input
                  type="password"
                  value={formPassword}
                  onChange={e => setFormPassword(e.target.value)}
                  placeholder={editingUser ? "Manter palavra-passe atual" : "Mínimo 8 carateres"}
                  className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </label>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <input
                type="checkbox"
                id="user-active-toggle"
                checked={formActive}
                onChange={e => setFormActive(e.target.checked)}
                className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 border-slate-300"
              />
              <label htmlFor="user-active-toggle" className="text-xs font-semibold text-slate-700 cursor-pointer">
                Conta de utilizador ativa (pode autenticar-se na plataforma)
              </label>
            </div>
          </div>

          {/* Seleção de Permissões com Presets Rápidos */}
          <div className="pt-4 border-t border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                  <span className="text-amber-500">{I.shield}</span> 2. Permissões de Acesso aos Módulos
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Selecione as permissões específicas a que este utilizador tem direito. Pode usar as predefinições rápidas abaixo.
                </p>
              </div>

              {/* Presets Rápidos */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-slate-400 font-semibold mr-1">Predefinição:</span>
                {(["Administrador", "Secretaria", "Comercial CRM", "Coordenador Pedagógico", "Operador"] as UserRole[]).map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => handleApplyRolePreset(r)}
                    className="px-2.5 py-1 text-xs font-medium rounded bg-slate-100 hover:bg-amber-100 hover:text-amber-800 text-slate-700 transition-colors"
                  >
                    {r}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleSelectAllPermissions}
                  className="px-2.5 py-1 text-xs font-semibold rounded bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                >
                  Todas
                </button>
                <button
                  type="button"
                  onClick={handleClearAllPermissions}
                  className="px-2.5 py-1 text-xs font-semibold rounded bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors"
                >
                  Limpar
                </button>
              </div>
            </div>

            {/* Lista de Grupos de Permissões */}
            <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1">
              {PERMISSION_GROUPS.map(group => {
                const groupIds = group.permissoes.map(p => p.id);
                const countSelected = groupIds.filter(id => formPermissions.includes(id)).length;
                const isAllSelected = countSelected === groupIds.length;
                const isPartiallySelected = countSelected > 0 && countSelected < groupIds.length;

                return (
                  <div
                    key={group.id}
                    className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 transition-all hover:border-slate-300"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3 pb-2.5 border-b border-slate-200/80">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-slate-800">{group.categoria}</p>
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                              isAllSelected
                                ? "bg-emerald-100 text-emerald-800"
                                : countSelected > 0
                                ? "bg-amber-100 text-amber-800"
                                : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {countSelected} de {groupIds.length}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{group.descricao}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleGroupPermissions(group.id)}
                        className={`text-xs font-semibold px-2.5 py-1 rounded transition-colors whitespace-nowrap ${
                          isAllSelected
                            ? "bg-slate-200 text-slate-700 hover:bg-slate-300"
                            : "bg-amber-500 text-white hover:bg-amber-600"
                        }`}
                      >
                        {isAllSelected ? "Desmarcar grupo" : "Selecionar grupo"}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {group.permissoes.map(perm => {
                        const checked = formPermissions.includes(perm.id);
                        return (
                          <label
                            key={perm.id}
                            className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                              checked
                                ? "bg-amber-50/60 border-amber-300 ring-1 ring-amber-200"
                                : "bg-white border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleTogglePermission(perm.id)}
                              className="mt-0.5 w-4 h-4 rounded text-amber-500 focus:ring-amber-400 border-slate-300 flex-shrink-0"
                            />
                            <div className="min-w-0">
                              <p className={`text-xs font-bold leading-snug ${checked ? "text-slate-900" : "text-slate-700"}`}>
                                {perm.label}
                              </p>
                              <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                                {perm.descricao}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </AppModal>
    </div>
  );
}
