import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

const modalSizes = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-3xl",
  "2xl": "max-w-5xl",
  "3xl": "max-w-6xl",
} as const;

export function AppModal({
  open,
  onClose,
  title,
  sub,
  children,
  footer,
  size = "md",
  variant = "modal",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  sub?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof modalSizes;
  variant?: "modal" | "drawer";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      const body = panelRef.current?.querySelector<HTMLElement>("[data-app-modal-body]");
      const el = body?.querySelector<HTMLElement>("input:not([type=hidden]), select, textarea")
        ?? body?.querySelector<HTMLElement>("button")
        ?? panelRef.current?.querySelector<HTMLElement>("button, [href], input, select, textarea");
      el?.focus();
    }, 20);
    return () => window.clearTimeout(t);
  }, [open]);

  if (!open || typeof document === "undefined") return null;
  const drawer = variant === "drawer";
  return createPortal(
    <div className={`fixed inset-0 z-[120] flex ${drawer ? "justify-end items-stretch" : "items-end sm:items-center justify-center p-0 sm:p-6"}`} role="dialog" aria-modal="true" aria-labelledby="app-modal-title">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={panelRef}
        className={`relative bg-white shadow-2xl border-slate-200/80 flex flex-col overflow-hidden ${
          drawer
            ? "w-full max-w-none sm:max-w-xl lg:max-w-2xl h-full max-h-none rounded-none border-l"
            : `w-full ${modalSizes[size]} max-h-[92vh] rounded-t-2xl sm:rounded-2xl border`
        }`}
        style={{ animation: drawer ? "none" : "scaleIn 0.16s ease" }}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="min-w-0">
            <h2 id="app-modal-title" className="text-base font-bold text-slate-800 leading-snug">{title}</h2>
            {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg flex-shrink-0" aria-label="Fechar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div data-app-modal-body className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100 flex-shrink-0 bg-white">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function useFixedMenu(open: boolean, triggerRef: RefObject<HTMLElement | null>, bump = 0) {
  const [box, setBox] = useState({ top: 0, left: 0, width: 0 });
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const width = Math.max(r.width, 240);
      const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
      const below = r.bottom + 6;
      const maxH = 280;
      const top = below + maxH > window.innerHeight - 8 ? Math.max(8, r.top - maxH - 6) : below;
      setBox({ top, left, width });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, bump, triggerRef]);
  return box;
}

function MenuPortal({
  open, triggerRef, panelRef, children, bump = 0,
}: {
  open: boolean;
  triggerRef: RefObject<HTMLElement | null>;
  panelRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
  bump?: number;
}) {
  const box = useFixedMenu(open, triggerRef, bump);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={panelRef}
      style={{ position: "fixed", top: box.top, left: box.left, width: box.width, zIndex: 200 }}
      className="bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden"
    >
      {children}
    </div>,
    document.body,
  );
}

export type SelectOption = { value: string; label?: string; sub?: string; disabled?: boolean };

function rotuloOpcao(o: SelectOption) {
  return o.label || o.value;
}


export function formadoresToOpts(list: { nome: string; telf?: string; especialidade?: string; ccp?: string }[]): SelectOption[] {
  return list
    .filter(f => f.nome.trim())
    .map(f => ({
      value: f.nome,
      sub: [f.telf, f.especialidade || (f.ccp ? `CCP ${f.ccp}` : "")].filter(Boolean).join(" · ") || undefined,
    }));
}

export function formadoresOptsWithFrom(base: SelectOption[], current?: string | string[]): SelectOption[] {
  const extras = (Array.isArray(current) ? current : current ? [current] : [])
    .map(v => v.trim())
    .filter(Boolean)
    .filter(v => !base.some(o => o.value === v));
  if (!extras.length) return base;
  return [...extras.map(value => ({ value, sub: "Atribuído nesta turma" })), ...base];
}

export function optsFromCursos(
  cursos: { nome?: string; ufcd?: string; nomeComercial?: string; tipo?: string; horas?: number; regime?: string; estado?: string }[],
): SelectOption[] {
  const out: SelectOption[] = [];
  for (const c of cursos) {
    const value = (c.nome || c.nomeComercial || c.ufcd || "").trim();
    if (!value) continue;
    const sub = [c.tipo, c.horas ? `${c.horas}h` : "", c.regime, c.estado && c.estado !== "Ativo" ? c.estado : ""]
      .filter(Boolean)
      .join(" · ");
    out.push(sub ? { value, sub } : { value });
  }
  return out;
}

export function SearchSelect({
  value, onChange, options, placeholder = "Pesquisar…", empty = "Nenhum resultado.", allowEmpty,
  emptyLabel = "Selecionar…",
  onAdd, addLabel = "Adicionar opção", disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  empty?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  onAdd?: () => void;
  addLabel?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const extras: SelectOption[] = value && !options.some(o => o.value === value) ? [{ value }] : [];
  const all = [...options, ...extras];
  const filtered = all.filter(o => `${rotuloOpcao(o)} ${o.value} ${o.sub ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  const selected = all.find(o => o.value === value);
  return (
    <div ref={triggerRef} className="relative">
      <button type="button" disabled={disabled} onClick={() => { if (disabled) return; setOpen(v => !v); setQ(""); }}
        className={`w-full px-3 py-2 text-sm border border-slate-200 rounded-lg text-left flex items-center justify-between gap-2 focus:outline-none focus:ring-2 focus:ring-amber-400 ${disabled ? "bg-slate-50 cursor-not-allowed opacity-70" : "bg-white"}`}>
        <span className={`truncate ${selected || value ? "text-slate-800" : "text-slate-400"}`}>
          {selected ? rotuloOpcao(selected) : (value || emptyLabel)}
        </span>
        <span className="text-slate-400 flex-shrink-0">▾</span>
      </button>
      <MenuPortal open={open && !disabled} triggerRef={triggerRef} panelRef={panelRef}>
        <div className="p-2 border-b border-slate-100 flex items-center gap-1.5 bg-white">
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder={placeholder}
            className="min-w-0 flex-1 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400" />
          {onAdd && (
            <button
              type="button"
              title={addLabel}
              aria-label={addLabel}
              onClick={() => { setOpen(false); onAdd(); }}
              className="flex-shrink-0 w-8 h-8 rounded-lg border border-slate-200 text-slate-600 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-800 flex items-center justify-center"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
        <div className="max-h-52 overflow-y-auto bg-white">
          {allowEmpty && (
            <button type="button" onClick={() => { onChange(""); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-xs text-slate-400 hover:bg-slate-50">Limpar seleção</button>
          )}
          {filtered.length === 0 && <p className="px-3 py-4 text-xs text-slate-400 text-center">{empty}</p>}
          {filtered.map(o => (
            <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full text-left px-3 py-2 hover:bg-amber-50 ${o.value === value ? "bg-amber-50" : ""}`}>
              <p className="text-sm text-slate-800">{rotuloOpcao(o)}</p>
              {o.sub && <p className="text-xs text-slate-400">{o.sub}</p>}
            </button>
          ))}
        </div>
      </MenuPortal>
    </div>
  );
}

export function MultiSearchSelect({
  values, onChange, options, placeholder = "Pesquisar…", empty = "Nenhum resultado.",
  noneLabel = "Selecionar…", unitSingular = "item", unitPlural = "itens",
  onAdd, addLabel = "Adicionar opção",
}: {
  values: string[];
  onChange: (next: string[]) => void;
  options: SelectOption[];
  placeholder?: string;
  empty?: string;
  noneLabel?: string;
  unitSingular?: string;
  unitPlural?: string;
  onAdd?: () => void;
  addLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const selected = values.filter(Boolean);
  const extras: SelectOption[] = selected.filter(v => !options.some(o => o.value === v)).map(value => ({ value }));
  const all: SelectOption[] = [...options, ...extras];
  const filtered = all.filter(o => `${rotuloOpcao(o)} ${o.value} ${o.sub ?? ""}`.toLowerCase().includes(q.toLowerCase()));

  function toggle(v: string) {
    const opt = all.find(o => o.value === v);
    if (opt?.disabled && !selected.includes(v)) return;
    onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v]);
  }

  return (
    <div ref={triggerRef} className="relative">
      <button type="button" onClick={() => { setOpen(v => !v); setQ(""); }}
        className="w-full min-h-[38px] px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white text-left flex items-center justify-between gap-2 focus:outline-none focus:ring-2 focus:ring-amber-400">
        <span className="flex flex-wrap gap-1 min-w-0 flex-1">
          {selected.length === 0 && <span className="text-slate-400 py-0.5">{noneLabel}</span>}
          {selected.map(v => (
            <span key={v} className="inline-flex items-center gap-1 max-w-full px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
              <span className="truncate">{all.find(o => o.value === v) ? rotuloOpcao(all.find(o => o.value === v)!) : v}</span>
              <span
                role="button"
                tabIndex={0}
                aria-label={`Remover ${v}`}
                onClick={e => { e.stopPropagation(); toggle(v); }}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); toggle(v); } }}
                className="text-slate-400 hover:text-slate-700"
              >×</span>
            </span>
          ))}
        </span>
        <span className="text-slate-400 flex-shrink-0">▾</span>
      </button>
      <MenuPortal open={open} triggerRef={triggerRef} panelRef={panelRef} bump={selected.length}>
        <div className="p-2 border-b border-slate-100 bg-white flex items-center gap-1.5">
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder={placeholder}
            className="min-w-0 flex-1 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400" />
          {onAdd && (
            <button
              type="button"
              title={addLabel}
              aria-label={addLabel}
              onClick={() => { setOpen(false); onAdd(); }}
              className="flex-shrink-0 w-8 h-8 rounded-lg border border-slate-200 text-slate-600 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-800 flex items-center justify-center"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
        <div className="max-h-52 overflow-y-auto bg-white">
          {filtered.length === 0 && <p className="px-3 py-4 text-xs text-slate-400 text-center">{empty}</p>}
          {filtered.map(o => {
            const on = selected.includes(o.value);
            return (
              <button key={o.value} type="button" disabled={o.disabled && !on} onClick={() => toggle(o.value)}
                className={`w-full text-left px-3 py-2 flex items-start gap-2 hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed ${on ? "bg-amber-50" : ""}`}>
                <span className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${on ? "bg-amber-500 border-amber-500 text-white" : "border-slate-300 bg-white"}`}>
                  {on && (
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  )}
                </span>
                <span className="min-w-0">
                  <p className="text-sm text-slate-800">{rotuloOpcao(o)}</p>
                  {o.sub && <p className="text-xs text-slate-400">{o.sub}</p>}
                </span>
              </button>
            );
          })}
        </div>
        {selected.length > 0 && (
          <div className="px-3 py-2 border-t border-slate-100 text-[11px] text-slate-500 bg-white">
            {selected.length === 1 ? `1 ${unitSingular} selecionado` : `${selected.length} ${unitPlural} selecionados`} · clique de novo para retirar
          </div>
        )}
      </MenuPortal>
    </div>
  );
}

export function FilterChips({ options, value, onChange, accent = "gold" }: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  accent?: "gold" | "fin";
}) {
  const on = accent === "gold" ? "bg-amber-500 text-white border-amber-500" : "bg-blue-600 text-white border-blue-600";
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => (
        <button key={o} type="button" onClick={() => onChange(o)}
          className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${value === o ? on : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
          {o}
        </button>
      ))}
    </div>
  );
}

export function uniqueOpts(values: Array<string | undefined>): SelectOption[] {
  return [...new Set(values.filter((v): v is string => Boolean(v && v.trim() && v !== "-")))]
    .sort((a, b) => a.localeCompare(b, "pt"))
    .map(value => ({ value }));
}

export function matchesFilter(row: string | undefined, filtro: string) {
  if (!filtro) return true;
  const r = (row ?? "").toLowerCase();
  const f = filtro.toLowerCase();
  return r === f || r.includes(f) || f.includes(r);
}

export type ViewFilterField = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
};

export function ViewFilters({
  accent = "gold",
  fields = [],
  chips,
  onClear,
  action,
}: {
  accent?: "gold" | "fin";
  fields?: ViewFilterField[];
  chips?: { options: string[]; value: string; onChange: (v: string) => void };
  onClear?: () => void;
  action?: ReactNode;
}) {
  const chipsOn = Boolean(chips && chips.value && chips.value !== "Todos" && chips.value !== "Todas");
  const active = fields.some(f => f.value) || chipsOn;
  const cols = fields.length + (action ? 1 : 0);
  const grid = cols <= 1
    ? "grid-cols-1 sm:grid-cols-[1fr_auto]"
    : cols === 2
      ? "grid-cols-1 sm:grid-cols-2"
      : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      {(fields.length > 0 || action) && (
        <div className={`grid ${grid} gap-3 items-end`}>
          {fields.map(f => (
            <div key={f.label}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{f.label}</label>
              <SearchSelect
                value={f.value}
                onChange={f.onChange}
                options={f.options}
                placeholder={f.placeholder ?? `Pesquisar ${f.label.toLowerCase()}…`}
                allowEmpty
              />
            </div>
          ))}
          {action}
        </div>
      )}
      {(chips || active) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {chips
            ? <FilterChips options={chips.options} value={chips.value} onChange={chips.onChange} accent={accent} />
            : <span />}
          {active && onClear && (
            <button type="button" onClick={onClear} className="text-xs font-semibold text-slate-500 hover:text-slate-800 whitespace-nowrap">
              Limpar filtros
            </button>
          )}
        </div>
      )}
    </div>
  );
}
