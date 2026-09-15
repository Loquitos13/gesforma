import { useEffect, useRef, useState, type ReactNode } from "react";
import { AppModal } from "./FormKit";

export type Regime = "gold" | "fin" | "sistema";
export type ActionTone = "blue" | "red" | "gray" | "teal" | "purple" | "orange";

const toneCls: Record<ActionTone, string> = {
  blue: "bg-blue-100 text-blue-700 hover:bg-blue-200",
  red: "bg-red-100 text-red-600 hover:bg-red-200",
  gray: "bg-slate-100 text-slate-600 hover:bg-slate-200",
  teal: "bg-teal-100 text-teal-700 hover:bg-teal-200",
  purple: "bg-violet-100 text-violet-700 hover:bg-violet-200",
  orange: "bg-amber-100 text-amber-700 hover:bg-amber-200",
};

export type Crumb = { label: string; onClick?: () => void };

export function RegimeBadge({ regime }: { regime: Regime }) {
  if (regime === "gold") return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500 text-white">Gold</span>;
  if (regime === "fin") return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-600 text-white">Financiada</span>;
  return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-600 text-white">Sistema</span>;
}

export function PageTrail({ crumbs }: { crumbs: Crumb[] }) {
  if (crumbs.length === 0) return null;
  return (
    <nav aria-label="Percurso" className="flex items-center gap-1.5 min-w-0 text-xs text-slate-500">
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        return (
          <span key={`${c.label}-${i}`} className="flex items-center gap-1.5 min-w-0">
            {i > 0 && <span className="text-slate-300 flex-shrink-0">›</span>}
            {c.onClick && !last ? (
              <button type="button" onClick={c.onClick} className="hover:text-slate-800 truncate">{c.label}</button>
            ) : (
              <span className={last ? "font-semibold text-slate-800 truncate" : "truncate"}>{c.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

export type NextAction = {
  title: string;
  detail: string;
  tone: "error" | "warn" | "info";
  onClick: () => void;
};

export function NextActions({ actions, accent = "gold" }: { actions: NextAction[]; accent?: "gold" | "fin" }) {
  if (actions.length === 0) {
    return (
      <div className={`rounded-xl border px-4 py-3 text-sm ${accent === "gold" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
        Nada pendente nesta turma para a secretaria.
      </div>
    );
  }
  const ring = {
    error: "border-red-200 bg-red-50",
    warn: "border-amber-200 bg-amber-50",
    info: "border-slate-200 bg-white",
  };
  const mark = {
    error: "text-red-700",
    warn: "text-amber-800",
    info: "text-slate-700",
  };
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">A fazer agora</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {actions.map(a => (
          <button key={a.title} type="button" onClick={a.onClick}
            className={`text-left rounded-xl border px-3.5 py-3 hover:shadow-sm transition-shadow ${ring[a.tone]}`}>
            <p className={`text-sm font-bold ${mark[a.tone]}`}>{a.title}</p>
            <p className="text-xs text-slate-600 mt-0.5">{a.detail}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

export type RowAction = {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  tone?: ActionTone;
};

function MoreIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

export function RowActions({ actions, primary = 2 }: { actions: RowAction[]; primary?: number }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const head = actions.slice(0, primary);
  const rest = actions.slice(primary);
  return (
    <>
      <div className="hidden sm:flex flex-wrap items-center gap-1">
        {head.map(a => (
          <button key={a.label} type="button" onClick={a.onClick}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-colors ${toneCls[a.tone ?? "blue"]}`}>
            {a.icon}<span>{a.label}</span>
          </button>
        ))}
        {rest.map(a => (
          <button key={a.label} type="button" title={a.label} aria-label={a.label} onClick={a.onClick}
            className={`w-7 h-7 inline-flex items-center justify-center rounded-lg transition-colors ${toneCls[a.tone ?? "gray"]}`}>
            {a.icon}
          </button>
        ))}
      </div>
      <div ref={box} className="sm:hidden relative">
        <button type="button" aria-label="Mais acções" aria-expanded={open} onClick={() => setOpen(v => !v)}
          className="w-8 h-8 inline-flex items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200">
          <MoreIcon />
        </button>
        {open && (
          <div className="absolute right-0 top-full mt-1 z-20 w-44 bg-white border border-slate-200 rounded-xl shadow-lg py-1">
            {actions.map(a => (
              <button key={a.label} type="button" onClick={() => { setOpen(false); a.onClick(); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50">
                <span className={a.tone === "red" ? "text-red-600" : "text-slate-500"}>{a.icon}</span>
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export function MobileCard({
  title, sub, badge, meta, onOpen, actions,
}: {
  title: string;
  sub?: string;
  badge?: ReactNode;
  meta?: string[];
  onOpen?: () => void;
  actions: RowAction[];
}) {
  return (
    <article className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
      <button type="button" onClick={onOpen} className="w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-slate-800 leading-snug">{title}</p>
          {badge}
        </div>
        {sub && <p className="text-xs text-slate-500 mt-0.5 truncate">{sub}</p>}
        {meta && meta.length > 0 && <p className="text-xs text-slate-400 mt-1">{meta.join(" · ")}</p>}
      </button>
      <div className="mt-2 pt-2 border-t border-slate-100 flex justify-end">
        <RowActions actions={actions} />
      </div>
    </article>
  );
}

export function EmptyHint({
  text, action, onAction, accent = "gold",
}: {
  text: string;
  action?: string;
  onAction?: () => void;
  accent?: "gold" | "fin";
}) {
  return (
    <div className="px-4 py-10 text-center">
      <p className="text-sm text-slate-500">{text}</p>
      {action && onAction && (
        <button type="button" onClick={onAction}
          className={`mt-3 text-sm font-semibold ${accent === "gold" ? "text-amber-600 hover:text-amber-700" : "text-blue-600 hover:text-blue-700"}`}>
          {action}
        </button>
      )}
    </div>
  );
}

export function ConfirmDangerModal({
  open, onClose, title, body, risk, confirmLabel = "Eliminar", onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  body: string;
  risk?: string;
  confirmLabel?: string;
  onConfirm: () => void;
}) {
  return (
    <AppModal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">Cancelar</button>
          <button type="button" onClick={() => { onConfirm(); onClose(); }} className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white">{confirmLabel}</button>
        </>
      }
    >
      <div className="p-5 space-y-2">
        <p className="text-sm text-slate-700">{body}</p>
        {risk && <p className="text-xs text-slate-500">{risk}</p>}
      </div>
    </AppModal>
  );
}

export function NotifKind({ tipo }: { tipo: string }) {
  if (tipo === "error") return <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-red-100 text-red-700">Bloqueio</span>;
  if (tipo === "warn") return <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">Aviso</span>;
  return <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">Info</span>;
}

export function sortNotifs<T extends { tipo: string; lida: boolean }>(items: T[]) {
  const rank = (t: string) => (t === "error" ? 0 : t === "warn" ? 1 : 2);
  return [...items].sort((a, b) => {
    if (a.lida !== b.lida) return a.lida ? 1 : -1;
    return rank(a.tipo) - rank(b.tipo);
  });
}

export function regimeOfView(view: string): Regime {
  if (view.startsWith("gold") || view === "formadores") return "gold";
  if (view.startsWith("fin")) return "fin";
  return "sistema";
}

export const cockpitTabLabel: Record<string, string> = {
  overview: "Visão geral",
  cronograma: "Cronograma",
  sessoes: "Sessões",
  documentos: "Documentos",
  dtp: "Dossiê TP",
  certificados: "Certificados",
};
