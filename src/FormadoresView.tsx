import { useEffect, useState } from "react";
import { AppModal, ViewFilters, matchesFilter, uniqueOpts } from "./FormKit";
import { useFormadores } from "./FormadoresContext";
import { emptyFormador, formadoresDoRegime, type Formador, type FormadorRegime } from "./formadorModel";
import { FormadorProfileSlideOver } from "./TurmaExtras";
import { useTurmas } from "./TurmasContext";
import { sessaoFormadores } from "./turmaModel";

const I = {
  plus: <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>,
  search: <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>,
  edit: <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>,
  trash: <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>,
  eye: <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>,
  person: <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>,
  x: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>,
};

const iCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent";

function Badge({ label, variant }: { label: string; variant: "green" | "gray" | "amber" | "blue" | "violet" }) {
  const cls = {
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    gray: "bg-slate-100 text-slate-600 border-slate-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    violet: "bg-violet-50 text-violet-700 border-violet-200",
  }[variant];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${cls}`}>{label}</span>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>{children}</div>;
}

function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800 leading-tight">{title}</h1>
        {sub && <p className="text-sm text-slate-500 mt-0.5">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

function NewBtn({ label, onClick, accent }: { label: string; onClick?: () => void; accent: "gold" | "fin" }) {
  const text = label.replace(/^\+\s*/, "");
  const cls = accent === "gold" ? "bg-amber-500 hover:bg-amber-600" : "bg-blue-600 hover:bg-blue-700";
  return (
    <button type="button" onClick={onClick} className={`inline-flex items-center gap-1.5 px-4 py-2 ${cls} text-white text-sm font-semibold rounded-lg transition-colors shadow-sm whitespace-nowrap`}>
      {I.plus}{text}
    </button>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap bg-slate-50 border-b border-slate-200 ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 ${className}`}>{children}</td>;
}
function IdCell({ id }: { id: number | string }) {
  return <span className="text-slate-400 font-mono text-xs">{id}</span>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1.5"><label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</label>{children}</div>;
}
function ActBtn({ icon, label, color = "blue", onClick }: { icon: React.ReactNode; label: string; color?: string; onClick?: () => void }) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-100 text-blue-700 hover:bg-blue-200", red: "bg-red-100 text-red-600 hover:bg-red-200",
    orange: "bg-amber-100 text-amber-700 hover:bg-amber-200", gray: "bg-slate-100 text-slate-500 hover:bg-slate-200",
    purple: "bg-violet-100 text-violet-700 hover:bg-violet-200",
  };
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick}
      className={`w-7 h-7 inline-flex items-center justify-center rounded-lg transition-colors ${colorMap[color] ?? colorMap.blue}`}>
      {icon}
    </button>
  );
}

function TableToolbar({ search, onSearch, perPage, onPerPage }: { search: string; onSearch: (v: string) => void; perPage: number; onPerPage: (v: number) => void }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-b border-slate-100">
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">Mostrar</span>
        <select value={perPage} onChange={e => onPerPage(Number(e.target.value))} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
          {[10, 25, 50, 100].map(n => <option key={n}>{n}</option>)}
        </select>
        <span className="text-xs text-slate-500">por página</span>
      </div>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{I.search}</span>
        <input type="text" value={search} onChange={e => onSearch(e.target.value)} placeholder="Pesquisar nome, email ou CCP…" className="pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 w-full sm:w-64" />
      </div>
    </div>
  );
}

function TableFooter({ page, perPage, total, onChange }: { page: number; perPage: number; total: number; onChange: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const from = total === 0 ? 0 : Math.min((page - 1) * perPage + 1, total);
  const to = Math.min(page * perPage, total);
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-slate-100">
      <p className="text-xs text-slate-500">A mostrar <strong className="text-slate-700">{from}-{to}</strong> de <strong className="text-slate-700">{total.toLocaleString("pt-PT")}</strong></p>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => onChange(page - 1)} disabled={page === 1} className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40">‹</button>
        <span className="text-xs text-slate-500 px-2">{page}/{pages}</span>
        <button type="button" onClick={() => onChange(page + 1)} disabled={page === pages} className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40">›</button>
      </div>
    </div>
  );
}

function SlideOver({ open, onClose, title, sub, children, size = "md" }: { open: boolean; onClose: () => void; title: string; sub?: string; children: React.ReactNode; size?: "sm" | "md" | "lg" | "xl" }) {
  return <AppModal open={open} onClose={onClose} title={title} sub={sub} size={size}>{children}</AppModal>;
}

function toggleRegime(list: FormadorRegime[], regime: FormadorRegime) {
  return list.includes(regime) ? list.filter(r => r !== regime) : [...list, regime];
}

function turmaTemFormador(nome: string, formadorTurma?: string, cronograma?: any) {
  if (!nome) return false;
  if (formadorTurma === nome) return true;
  let parsed: any[] = [];
  if (Array.isArray(cronograma)) {
    parsed = cronograma;
  } else if (typeof cronograma === "string") {
    try {
      const p = JSON.parse(cronograma);
      if (Array.isArray(p)) parsed = p;
    } catch {
      parsed = [];
    }
  }
  return parsed.some(s => s && sessaoFormadores(s).includes(nome));
}

export function FormadoresView({ regime }: { regime: FormadorRegime }) {
  const gold = regime === "gold";
  const { formadores, addFormador, patchFormador, removeFormador } = useFormadores();
  const turmas = useTurmas();
  const [s, setS] = useState("");
  const [p, setP] = useState(1);
  const [pp, setPp] = useState(10);
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [filtroEsp, setFiltroEsp] = useState("");
  const [draft, setDraft] = useState<Formador | null>(null);
  const [erro, setErro] = useState("");
  const [perfil, setPerfil] = useState<Formador | null>(null);
  const [apagar, setApagar] = useState<Formador | null>(null);

  const safeFormadores = Array.isArray(formadores) ? formadores : [];
  const noRegime = formadoresDoRegime(safeFormadores, regime);
  const especialidades = uniqueOpts(noRegime.map(f => f?.especialidade ?? ""));

  const filtrados = noRegime.filter(f => {
    if (!f) return false;
    const q = `${f.nome ?? ""} ${f.email ?? ""} ${f.telf ?? ""} ${f.ccp ?? ""} ${f.especialidade ?? ""}`.toLowerCase().includes(s.toLowerCase());
    return q && matchesFilter(f.especialidade, filtroEsp) && (filtroEstado === "Todos" || f.estado === filtroEstado);
  });
  const rows = filtrados.slice((p - 1) * pp, p * pp);

  const ativos = noRegime.filter(f => f?.estado === "Ativo").length;
  const both = noRegime.filter(f => Array.isArray(f?.regimes) && f.regimes.includes("gold") && f.regimes.includes("fin")).length;

  function turmasDoFormador(nome: string) {
    if (!nome) return [];
    const listGold = Array.isArray(turmas?.gold) ? turmas.gold : [];
    const listFin = Array.isArray(turmas?.fin) ? turmas.fin : [];
    const list = gold
      ? listGold.filter(t => t && turmaTemFormador(nome, t.formador, t.cronograma))
      : listFin.filter(t => t && turmaTemFormador(nome, t.formador, t.cronograma));
    return list.map(t => t?.nome ?? "").filter(Boolean);
  }

  function abrirNovo() {
    setErro("");
    setDraft(emptyFormador(regime));
  }

  function abrirEditar(f: Formador) {
    setErro("");
    setDraft({ ...f, regimes: [...f.regimes] });
  }

  function guardar() {
    if (!draft) return;
    const nome = draft.nome.trim();
    if (!nome) {
      setErro("Indique o nome do formador.");
      return;
    }
    if (!draft.regimes.length) {
      setErro("Escolha pelo menos um regime: Gold ou Financiada.");
      return;
    }
    const payload = {
      ...draft,
      nome,
      email: draft.email.trim(),
      telf: draft.telf.trim(),
      especialidade: draft.especialidade.trim(),
      ccp: draft.ccp.trim(),
      nif: draft.nif.trim(),
    };
    if (draft.id) patchFormador(draft.id, payload);
    else addFormador(payload);
    setDraft(null);
    setErro("");
  }

  const saveCls = gold ? "bg-amber-500 hover:bg-amber-600" : "bg-blue-600 hover:bg-blue-700";
  const editing = Boolean(draft?.id);

  return (
    <div className="space-y-4">
      <PageHeader
        title={gold ? "Formadores Gold" : "Formadores Financiada"}
        sub={`${ativos} ativos · ${noRegime.length} neste regime${both ? ` · ${both} também no outro regime` : ""}`}
        action={<NewBtn accent={regime} label="+ Novo Formador" onClick={abrirNovo} />}
      />

      <ViewFilters
        accent={regime}
        fields={[{ label: "Especialidade", value: filtroEsp, onChange: v => { setFiltroEsp(v); setP(1); }, options: especialidades }]}
        chips={{ options: ["Todos", "Ativo", "Inactivo"], value: filtroEstado, onChange: v => { setFiltroEstado(v); setP(1); } }}
        onClear={() => { setFiltroEsp(""); setFiltroEstado("Todos"); setP(1); }}
      />

      <Card>
        <TableToolbar search={s} onSearch={v => { setS(v); setP(1); }} perPage={pp} onPerPage={n => { setPp(n); setP(1); }} />
        {filtrados.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <div className={`mx-auto mb-3 w-11 h-11 rounded-2xl flex items-center justify-center ${gold ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600"}`}>
              {I.person}
            </div>
            <p className="text-sm font-semibold text-slate-800">
              {noRegime.length === 0 ? "Ainda não há formadores neste regime" : "Nenhum formador corresponde aos filtros"}
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              {noRegime.length === 0
                ? `Crie a ficha aqui. O nome passa a aparecer nos dropdowns do cronograma e das turmas ${gold ? "Gold" : "financiadas"}.`
                : "Limpe a pesquisa ou os filtros para voltar a ver a lista."}
            </p>
            {noRegime.length === 0 && (
              <div className="mt-4">
                <NewBtn accent={regime} label="+ Novo Formador" onClick={abrirNovo} />
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <Th>Id</Th>
                    <Th>Nome</Th>
                    <Th>Contacto</Th>
                    <Th>Especialidade</Th>
                    <Th>CCP</Th>
                    <Th>Regimes</Th>
                    <Th>Turmas</Th>
                    <Th>Estado</Th>
                    <Th>Ações</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map(f => {
                    const turmasNomes = turmasDoFormador(f.nome);
                    return (
                      <tr key={f.id} className="hover:bg-slate-50">
                        <Td><IdCell id={f.id} /></Td>
                        <Td>
                          <button type="button" onClick={() => setPerfil(f)} className="text-left">
                            <p className="text-xs font-semibold text-blue-600 hover:text-blue-800">{f.nome}</p>
                            <p className="text-xs text-slate-400 truncate max-w-[180px]">{f.email || "Sem email"}</p>
                          </button>
                        </Td>
                        <Td className="font-mono text-xs text-slate-500 whitespace-nowrap">{f.telf || "-"}</Td>
                        <Td className="text-xs text-slate-600 max-w-[140px]"><span className="line-clamp-2">{f.especialidade || "-"}</span></Td>
                        <Td className="font-mono text-xs text-slate-600 whitespace-nowrap">{f.ccp || "-"}</Td>
                        <Td>
                          <div className="flex flex-wrap gap-1">
                            {Array.isArray(f.regimes) && f.regimes.includes("gold") && <Badge label="Gold" variant="amber" />}
                            {Array.isArray(f.regimes) && f.regimes.includes("fin") && <Badge label="Financiada" variant="blue" />}
                          </div>
                        </Td>
                        <Td className="text-xs text-slate-600 whitespace-nowrap">
                          {turmasNomes.length === 0 ? "-" : turmasNomes.length === 1 ? turmasNomes[0] : `${turmasNomes.length} turmas`}
                        </Td>
                        <Td>
                          <button type="button" onClick={() => patchFormador(f.id, { estado: f.estado === "Ativo" ? "Inactivo" : "Ativo" })}>
                            <Badge label={f.estado} variant={f.estado === "Ativo" ? "green" : "gray"} />
                          </button>
                        </Td>
                        <Td>
                          <div className="flex gap-1">
                            <ActBtn icon={I.eye} label="Perfil" color="purple" onClick={() => setPerfil(f)} />
                            <ActBtn icon={I.edit} label="Editar" onClick={() => abrirEditar(f)} />
                            <ActBtn icon={I.trash} label="Eliminar" color="red" onClick={() => setApagar(f)} />
                          </div>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <TableFooter page={p} perPage={pp} total={filtrados.length} onChange={setP} />
          </>
        )}
      </Card>

      <SlideOver
        open={!!draft}
        onClose={() => { setDraft(null); setErro(""); }}
        title={editing ? `Editar ${draft?.nome}` : "Novo formador"}
        sub={gold ? "Ficha pedagógica Gold - CCP, contacto e documentos" : "Ficha pedagógica Financiada - CCP, contacto e UFCD"}
      >
        {draft && (
          <div className="p-5 space-y-3">
            <Field label="Nome">
              <input className={iCls} value={draft.nome} onChange={e => setDraft({ ...draft, nome: e.target.value })} placeholder="Nome completo" />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Email">
                <input className={iCls} type="email" value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })} placeholder="email@ena.pt" />
              </Field>
              <Field label="Telemóvel">
                <input className={iCls} value={draft.telf} onChange={e => setDraft({ ...draft, telf: e.target.value })} placeholder="9xx xxx xxx" />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="CCP">
                <input className={iCls} value={draft.ccp} onChange={e => setDraft({ ...draft, ccp: e.target.value })} placeholder="F-44821" />
              </Field>
              <Field label="NIF">
                <input className={iCls} value={draft.nif} onChange={e => setDraft({ ...draft, nif: e.target.value })} placeholder="000 000 000" />
              </Field>
            </div>
            <Field label="Especialidade">
              <input className={iCls} value={draft.especialidade} onChange={e => setDraft({ ...draft, especialidade: e.target.value })} placeholder="CCP, primeiros socorros, estética…" />
            </Field>
            <Field label="Regimes em que lecciona">
              <div className="flex flex-wrap gap-2">
                {([
                  { id: "gold" as const, label: "Gold" },
                  { id: "fin" as const, label: "Financiada" },
                ]).map(opt => {
                  const on = draft.regimes.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setDraft({ ...draft, regimes: toggleRegime(draft.regimes, opt.id) })}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
                        on
                          ? opt.id === "gold" ? "bg-amber-500 text-white border-amber-500" : "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-400">Quem marca os dois regimes aparece nas duas listas e nos dropdowns de ambas.</p>
            </Field>
            <Field label="Estado">
              <button
                type="button"
                onClick={() => setDraft({ ...draft, estado: draft.estado === "Ativo" ? "Inactivo" : "Ativo" })}
                className="self-start"
              >
                <Badge label={draft.estado} variant={draft.estado === "Ativo" ? "green" : "gray"} />
              </button>
            </Field>
            {erro && <p className="text-xs font-medium text-red-600">{erro}</p>}
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => { setDraft(null); setErro(""); }} className="flex-1 py-2 border border-slate-200 text-sm text-slate-600 rounded-lg hover:bg-slate-50">Cancelar</button>
              <button type="button" onClick={guardar} className={`flex-1 py-2 ${saveCls} text-white text-sm font-semibold rounded-lg`}>{editing ? "Guardar alterações" : "Criar formador"}</button>
            </div>
          </div>
        )}
      </SlideOver>

      <SlideOver open={!!apagar} onClose={() => setApagar(null)} title="Eliminar formador" sub={apagar?.nome}>
        {apagar && (
          <div className="p-5 space-y-3">
            <p className="text-sm text-slate-600">
              Remover <span className="font-semibold text-slate-800">{apagar.nome}</span> do catálogo? As sessões que já o têm atribuído mantêm o nome, mas deixa de aparecer nos dropdowns.
            </p>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setApagar(null)} className="flex-1 py-2 border border-slate-200 text-sm text-slate-600 rounded-lg hover:bg-slate-50">Cancelar</button>
              <button type="button" onClick={() => { removeFormador(apagar.id); setApagar(null); }} className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg">Eliminar</button>
            </div>
          </div>
        )}
      </SlideOver>

      <FormadorProfileSlideOver open={!!perfil} onClose={() => setPerfil(null)} nome={perfil?.nome ?? ""} telf={perfil?.telf} />
    </div>
  );
}
