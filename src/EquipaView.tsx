import { useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthGate";
import {
  ApiError,
  apiEquipa, apiEquipaFicha, apiEquipaNota, apiEquipaObjetivo, apiEquipaProposta, apiPatchProposta, apiPropostaTemplates,
  type EquipaComercial, type EquipaNota, type EquipaProposta, type PropostaTemplate,
} from "./api";
import { AppModal } from "./FormKit";
import { EmptyHint, MobileCard } from "./SecretaryUX";

const ESTADOS = ["Enviada", "Negociação", "Aceite", "Recusada", "Expirada"] as const;

function euro(n: number) {
  return n.toLocaleString("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

function when(iso: string | null | undefined) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
  return d.toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" });
}

function iniciais(nome: string) {
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function badgeEstado(estado: string) {
  const m: Record<string, string> = {
    Enviada: "bg-sky-50 text-sky-800 border-sky-200",
    Negociação: "bg-amber-50 text-amber-800 border-amber-200",
    Aceite: "bg-emerald-50 text-emerald-800 border-emerald-200",
    Recusada: "bg-rose-50 text-rose-800 border-rose-200",
    Expirada: "bg-slate-100 text-slate-600 border-slate-200",
    "Não contactado": "bg-amber-50 text-amber-800 border-amber-200",
    "1º Contacto": "bg-blue-50 text-blue-800 border-blue-200",
    "2º Contacto": "bg-indigo-50 text-indigo-800 border-indigo-200",
    Pago: "bg-teal-50 text-teal-800 border-teal-200",
    Formando: "bg-emerald-50 text-emerald-800 border-emerald-200",
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${m[estado] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>{estado}</span>;
}

function Kpi({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-1 text-[1.45rem] font-semibold tabular-nums tracking-tight text-slate-900">{value}</p>
      {sub ? <p className="text-xs text-slate-500 mt-0.5">{sub}</p> : null}
    </div>
  );
}

export function EquipaView({ regime = "gold" }: { regime?: "gold" | "fin" }) {
  const { user } = useAuth();
  const [lista, setLista] = useState<EquipaComercial[]>([]);
  const [totais, setTotais] = useState({ comerciais: 0, activos: 0, leads: 0, propostas: 0, pipeline: 0, receita: 0 });
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fichaId, setFichaId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    apiEquipa(regime)
      .then(r => { setLista(r.comerciais); setTotais(r.totais); })
      .catch(err => setError(err instanceof ApiError && err.status === 403
        ? "Sem acesso a esta equipa."
        : err instanceof Error ? err.message : "Não foi possível ler a equipa."))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [regime]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return lista;
    return lista.filter(c => `${c.name} ${c.email}`.toLowerCase().includes(t));
  }, [lista, q]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{regime === "fin" ? "Financiada" : "Comercial Gold"}</p>
          <h1 className="text-[1.65rem] font-semibold tracking-tight text-slate-900 mt-1">Equipa</h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
            {regime === "fin"
              ? "Quem trata a formação financiada: pré-inscrições deste regime, propostas e o diário de contactos."
              : "Comerciais da ENA: volume de pré-inscrições Gold, propostas enviadas e a resposta do cliente. Abra a ficha para notas e pipeline."}
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={regime === "fin" ? "Pesquisar na equipa…" : "Pesquisar comercial…"}
            className="w-full pl-3 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
        <Kpi label="Comerciais" value={totais.activos} sub={`${totais.comerciais} na lista`} />
        <Kpi label="Pré-inscrições na carteira" value={totais.leads.toLocaleString("pt-PT")} />
        <Kpi label="Propostas" value={totais.propostas} sub={`${euro(totais.pipeline)} em aberto`} />
        <Kpi label="Receita fechada" value={euro(totais.receita)} />
      </div>

      {error && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-4 py-3">{error}</p>}
      {loading && <p className="text-sm text-slate-400 px-1 py-8 text-center">A carregar a equipa…</p>}
      {!loading && filtered.length === 0 && (
        <EmptyHint
          text={lista.length === 0 ? "Ainda não há contas com perfil Comercial. Crie-as em Utilizadores." : "Nenhum comercial corresponde à pesquisa."}
          action={lista.length === 0 ? undefined : "Limpar pesquisa"}
          onAction={lista.length === 0 ? undefined : () => setQ("")}
        />
      )}

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map(c => (
          <button
            key={c.id}
            type="button"
            onClick={() => setFichaId(c.id)}
            className="text-left bg-white rounded-2xl border border-slate-200/80 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-amber-300 hover:shadow-md transition-all"
          >
            <div className="flex items-start gap-3">
              <div className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold ${c.active ? "bg-amber-500 text-white" : "bg-slate-200 text-slate-500"}`}>
                {iniciais(c.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-900 truncate">{c.name}</p>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${c.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    {c.active ? "Activo" : "Inactivo"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate">{c.email}</p>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-slate-50 py-2">
                <dt className="text-[10px] uppercase tracking-wide text-slate-400">Pré-inscrições</dt>
                <dd className="text-sm font-semibold text-slate-800">{c.stats.leads}</dd>
              </div>
              <div className="rounded-xl bg-slate-50 py-2">
                <dt className="text-[10px] uppercase tracking-wide text-slate-400">Propostas</dt>
                <dd className="text-sm font-semibold text-slate-800">{c.stats.propostas}</dd>
              </div>
              <div className="rounded-xl bg-slate-50 py-2">
                <dt className="text-[10px] uppercase tracking-wide text-slate-400">Conv.</dt>
                <dd className="text-sm font-semibold text-amber-700">{c.stats.conversao}%</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-slate-500">
              {c.stats.propostasAceites} aceites · sucesso {c.stats.sucessoPropostas ?? 0}%
              {c.stats.metaPct != null ? ` · objectivo ${c.stats.metaPct}%` : ""} · {euro(c.stats.receita)} fechados
            </p>
            {user.role === "admin" && (
              <label className="mt-2 block text-[11px] text-slate-500" onClick={e => e.stopPropagation()}>
                Objectivo de sucesso das propostas enviadas (%)
                <input
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={c.stats.metaPct ?? ""}
                  className="mt-1 w-full px-2 py-1 text-sm border border-slate-200 rounded-lg"
                  onBlur={e => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n)) void apiEquipaObjetivo(c.id, Math.min(100, Math.max(0, n))).then(() => load());
                  }}
                />
              </label>
            )}
          </button>
        ))}
      </div>

      {fichaId && (
        <FichaComercial
          id={fichaId}
          regime={regime}
          onClose={() => { setFichaId(null); load(); }}
        />
      )}
    </div>
  );
}

function FichaComercial({ id, regime, onClose }: { id: string; regime: "gold" | "fin"; onClose: () => void }) {
  const [tab, setTab] = useState<"propostas" | "leads" | "notas">("propostas");
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [comercial, setComercial] = useState<EquipaComercial | null>(null);
  const [propostas, setPropostas] = useState<EquipaProposta[]>([]);
  const [leads, setLeads] = useState<Array<{
    id: number; nome: string; apelido: string; email: string; curso: string; estado: string; notas: string; telf: string; preco: number;
  }>>([]);
  const [notas, setNotas] = useState<EquipaNota[]>([]);
  const [nova, setNova] = useState(false);
  const [draft, setDraft] = useState({ clienteNome: "", clienteEmail: "", curso: "", valor: "125", estado: "Enviada" as (typeof ESTADOS)[number], respostaCliente: "", notas: "", preinscricaoId: "" });
  const [notaLead, setNotaLead] = useState<number | "">("");
  const [notaTxt, setNotaTxt] = useState("");
  const [busy, setBusy] = useState(false);
  const [resposta, setResposta] = useState<EquipaProposta | null>(null);
  const [respostaTxt, setRespostaTxt] = useState("");
  const [respostaEstado, setRespostaEstado] = useState<(typeof ESTADOS)[number]>("Aceite");
  const [templates, setTemplates] = useState<PropostaTemplate[]>([]);
  const [templateId, setTemplateId] = useState<number | "">("");

  function load() {
    setLoading(true);
    apiEquipaFicha(id, regime)
      .then(r => {
        setComercial(r.comercial);
        setPropostas(r.propostas);
        setLeads(r.leads);
        setNotas(r.notas);
        setErro("");
      })
      .catch(e => setErro(e instanceof Error ? e.message : "Ficha indisponível."))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [id, regime]);
  useEffect(() => { apiPropostaTemplates().then(r => setTemplates(r.templates)).catch(() => undefined); }, []);

  async function criarProposta() {
    if (!draft.clienteNome.trim()) return;
    setBusy(true);
    try {
      await apiEquipaProposta(id, {
        clienteNome: draft.clienteNome.trim(),
        clienteEmail: draft.clienteEmail.trim(),
        curso: draft.curso.trim(),
        valor: Number(draft.valor) || 0,
        estado: draft.estado,
        respostaCliente: draft.respostaCliente.trim(),
        notas: draft.notas.trim(),
        preinscricaoId: draft.preinscricaoId ? Number(draft.preinscricaoId) : null,
        regime,
        templateId: templateId === "" ? null : templateId,
        corpo: templates.find(t => t.id === templateId)?.corpo ?? "",
      });
      setNova(false);
      setDraft({ clienteNome: "", clienteEmail: "", curso: "", valor: "125", estado: "Enviada", respostaCliente: "", notas: "", preinscricaoId: "" });
      load();
    } finally {
      setBusy(false);
    }
  }

  async function guardarResposta() {
    if (!resposta) return;
    setBusy(true);
    try {
      await apiPatchProposta(resposta.id, { estado: respostaEstado, respostaCliente: respostaTxt.trim() });
      setResposta(null);
      load();
    } finally {
      setBusy(false);
    }
  }

  async function criarNota() {
    if (!notaLead || !notaTxt.trim()) return;
    setBusy(true);
    try {
      await apiEquipaNota(id, { preinscricaoId: Number(notaLead), nota: notaTxt.trim() });
      setNotaTxt("");
      load();
    } finally {
      setBusy(false);
    }
  }

  const s = comercial?.stats;

  return (
    <AppModal open onClose={onClose} title={comercial?.name ?? "Comercial"} sub={comercial?.email} size="2xl">
      <div className="p-5 space-y-4">
        {loading && <p className="text-sm text-slate-400">A carregar ficha…</p>}
        {erro && <p className="text-sm text-rose-600">{erro}</p>}
        {s && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Kpi label="Pré-inscrições" value={s.leads} sub={`${s.porContactar} por contactar`} />
            <Kpi label="Propostas" value={s.propostas} sub={`${s.propostasAceites} aceites`} />
            <Kpi label="Pipeline" value={euro(s.pipeline)} />
            <Kpi label="Conversão" value={`${s.conversao}%`} sub={`${s.pagos} pagos`} />
          </div>
        )}

        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          {([
            ["propostas", "Propostas"],
            ["leads", "Pré-inscrições e notas"],
            ["notas", "Diário comercial"],
          ] as const).map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg ${tab === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
            >{l}</button>
          ))}
        </div>

        {tab === "propostas" && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button type="button" onClick={() => setNova(true)} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600">Nova proposta</button>
            </div>
            <div className="md:hidden space-y-2">
              {propostas.map(p => (
                <MobileCard
                  key={p.id}
                  title={p.clienteNome}
                  sub={p.curso || p.clienteEmail}
                  badge={badgeEstado(p.estado)}
                  meta={[euro(p.valor), p.respostaCliente ? p.respostaCliente.slice(0, 80) : "Sem resposta"]}
                  onOpen={() => { setResposta(p); setRespostaTxt(p.respostaCliente); setRespostaEstado((ESTADOS as readonly string[]).includes(p.estado) ? p.estado as (typeof ESTADOS)[number] : "Aceite"); }}
                  actions={[{ label: "Resposta", icon: <span className="text-[10px] font-bold">R</span>, onClick: () => { setResposta(p); setRespostaTxt(p.respostaCliente); setRespostaEstado((ESTADOS as readonly string[]).includes(p.estado) ? p.estado as (typeof ESTADOS)[number] : "Aceite"); } }]}
                />
              ))}
            </div>
            <div className="hidden md:block overflow-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="text-left px-3 py-2.5 font-semibold">Cliente</th>
                    <th className="text-left px-3 py-2.5 font-semibold">Curso</th>
                    <th className="text-left px-3 py-2.5 font-semibold">Valor</th>
                    <th className="text-left px-3 py-2.5 font-semibold">Estado</th>
                    <th className="text-left px-3 py-2.5 font-semibold">Resposta do cliente</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {propostas.length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400 text-sm">Ainda sem propostas neste comercial.</td></tr>
                  )}
                  {propostas.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => { setResposta(p); setRespostaTxt(p.respostaCliente); setRespostaEstado((ESTADOS as readonly string[]).includes(p.estado) ? p.estado as (typeof ESTADOS)[number] : "Aceite"); }}>
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-slate-800">{p.clienteNome}</p>
                        <p className="text-xs text-slate-400">{p.clienteEmail}</p>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-600 max-w-[180px]">{p.curso || "-"}</td>
                      <td className="px-3 py-2.5 text-xs font-semibold text-slate-800 whitespace-nowrap">{euro(p.valor)}</td>
                      <td className="px-3 py-2.5">{badgeEstado(p.estado)}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600 max-w-[280px]">
                        {p.respostaCliente
                          ? <><p className="line-clamp-2">{p.respostaCliente}</p><p className="text-[10px] text-slate-400 mt-0.5">{when(p.respostaEm)}</p></>
                          : <span className="text-slate-400">À espera de resposta</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "leads" && (
          <div className="space-y-2">
            {leads.length === 0 && <p className="text-sm text-slate-400 py-6 text-center">Sem pré-inscrições atribuídas.</p>}
            {leads.map(l => (
              <div key={l.id} className="rounded-xl border border-slate-200 bg-white px-3.5 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{l.nome} {l.apelido}</p>
                    <p className="text-xs text-slate-500 truncate">{l.curso} · {l.email} · {l.telf}</p>
                  </div>
                  {badgeEstado(l.estado)}
                </div>
                {l.notas
                  ? <p className="mt-2 text-xs text-slate-600 whitespace-pre-wrap bg-slate-50 rounded-lg px-2.5 py-2 border border-slate-100">{l.notas}</p>
                  : <p className="mt-2 text-xs text-slate-400">Sem notas comerciais nesta pré-inscrição.</p>}
              </div>
            ))}
          </div>
        )}

        {tab === "notas" && (
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
              <p className="text-xs font-semibold text-slate-600">Nova nota comercial</p>
              <select className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white" value={notaLead} onChange={e => setNotaLead(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Escolher pré-inscrição…</option>
                {leads.map(l => <option key={l.id} value={l.id}>{l.nome} {l.apelido} · {l.curso}</option>)}
              </select>
              <textarea className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white min-h-[80px]" value={notaTxt} onChange={e => setNotaTxt(e.target.value)} placeholder="O que ficou combinado, objecções, próximo passo…" />
              <div className="flex justify-end">
                <button type="button" disabled={busy || !notaLead || !notaTxt.trim()} onClick={() => void criarNota()} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 text-white disabled:opacity-40">Registar nota</button>
              </div>
            </div>
            <div className="space-y-2">
              {notas.length === 0 && <p className="text-sm text-slate-400 py-4 text-center">Ainda sem diário neste comercial.</p>}
              {notas.map(n => (
                <div key={n.id} className="rounded-xl border border-slate-200 px-3.5 py-3">
                  <div className="flex justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800">{n.leadNome}</p>
                    <p className="text-[11px] text-slate-400 whitespace-nowrap">{when(n.createdAt)}</p>
                  </div>
                  <p className="text-xs text-slate-500">{n.leadCurso}</p>
                  <p className="mt-1.5 text-sm text-slate-700">{n.nota}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <AppModal open={nova} onClose={() => setNova(false)} title="Nova proposta" sub={comercial?.name} size="md">
        <div className="p-5 space-y-3">
          <Field label="Template">
            <select className={iCls} value={templateId} onChange={e => {
              const idTpl = e.target.value ? Number(e.target.value) : "";
              setTemplateId(idTpl);
              const t = templates.find(x => x.id === idTpl);
              if (t) setDraft(d => ({ ...d, curso: d.curso || t.curso, valor: d.valor || String(t.valor || "") }));
            }}>
              <option value="">Sem template</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </Field>
          <Field label="Cliente"><input className={iCls} value={draft.clienteNome} onChange={e => setDraft({ ...draft, clienteNome: e.target.value })} /></Field>
          <Field label="Email"><input className={iCls} value={draft.clienteEmail} onChange={e => setDraft({ ...draft, clienteEmail: e.target.value })} /></Field>
          <Field label="Curso"><input className={iCls} value={draft.curso} onChange={e => setDraft({ ...draft, curso: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor (€)"><input type="number" className={iCls} value={draft.valor} onChange={e => setDraft({ ...draft, valor: e.target.value })} /></Field>
            <Field label="Estado">
              <select className={iCls} value={draft.estado} onChange={e => setDraft({ ...draft, estado: e.target.value as (typeof ESTADOS)[number] })}>
                {ESTADOS.map(e => <option key={e}>{e}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Pré-inscrição (opcional)">
            <select className={iCls} value={draft.preinscricaoId} onChange={e => {
              const lead = leads.find(l => String(l.id) === e.target.value);
              setDraft({
                ...draft,
                preinscricaoId: e.target.value,
                clienteNome: lead ? `${lead.nome} ${lead.apelido}`.trim() : draft.clienteNome,
                clienteEmail: lead?.email ?? draft.clienteEmail,
                curso: lead?.curso ?? draft.curso,
                valor: lead ? String(lead.preco || 125) : draft.valor,
              });
            }}>
              <option value="">Sem ligação a pré-inscrição</option>
              {leads.map(l => <option key={l.id} value={l.id}>{l.nome} {l.apelido}</option>)}
            </select>
          </Field>
          <Field label="Resposta do cliente"><textarea className={iCls + " min-h-[72px]"} value={draft.respostaCliente} onChange={e => setDraft({ ...draft, respostaCliente: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setNova(false)} className="px-4 py-2 text-sm rounded-lg border border-slate-200">Cancelar</button>
            <button type="button" disabled={busy || !draft.clienteNome.trim()} onClick={() => void criarProposta()} className="px-4 py-2 text-sm rounded-lg bg-amber-500 text-white font-semibold disabled:opacity-40">Guardar proposta</button>
          </div>
        </div>
      </AppModal>

      <AppModal open={!!resposta} onClose={() => setResposta(null)} title="Resposta do cliente" sub={resposta?.clienteNome} size="md">
        <div className="p-5 space-y-3">
          <Field label="Estado da proposta">
            <select className={iCls} value={respostaEstado} onChange={e => setRespostaEstado(e.target.value as (typeof ESTADOS)[number])}>
              {ESTADOS.map(e => <option key={e}>{e}</option>)}
            </select>
          </Field>
          <Field label="O que o cliente respondeu">
            <textarea className={iCls + " min-h-[100px]"} value={respostaTxt} onChange={e => setRespostaTxt(e.target.value)} placeholder="Aceitou, recusou, pediu desconto…" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setResposta(null)} className="px-4 py-2 text-sm rounded-lg border border-slate-200">Fechar</button>
            <button type="button" disabled={busy} onClick={() => void guardarResposta()} className="px-4 py-2 text-sm rounded-lg bg-amber-500 text-white font-semibold">Guardar</button>
          </div>
        </div>
      </AppModal>
    </AppModal>
  );
}

const iCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1.5"><label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</label>{children}</div>;
}
