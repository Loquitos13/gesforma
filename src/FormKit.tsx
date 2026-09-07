import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

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
      style={{ position: "fixed", top: box.top, left: box.left, width: box.width, zIndex: 80 }}
      className="bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden"
    >
      {children}
    </div>,
    document.body,
  );
}

export type SelectOption = { value: string; sub?: string };

export const cursosGoldOpts: SelectOption[] = [
  { value: "Formação de Formadores - CCP", sub: "Gold · 90h · b-learning" },
  { value: "CCP - Formação de Formadores para Empresas", sub: "Pré-inscrição · 90h" },
  { value: "Excel do Básico ao Avançado", sub: "Gold · 12h · e-learning" },
  { value: "A Arte de Comunicar e Falar em Público: B-learning", sub: "16h" },
  { value: "A Arte de Comunicar e Falar em Público: E-learning", sub: "8h" },
  { value: "Curso de Auxiliar de Medicina Dentária", sub: "99h · e-learning" },
  { value: "Curso de Auxiliar de Medicina Veterinária", sub: "120h · e-learning" },
  { value: "Curso de Cura Prânica", sub: "20h" },
];

export const cursosFinOpts: SelectOption[] = [
  { value: "Primeiros Socorros", sub: "UFCD 3564 · 25h" },
  { value: "Publicidade nas Redes Sociais", sub: "UFCD 10785 · 25h" },
  { value: "Fundamentos de cibersegurança", sub: "UFCD 9188 · 25h" },
  { value: "Métodos e Técnicas Pedagógicas Ativos", sub: "UFCD 10394 · 25h" },
];

export const turmasGoldOpts: SelectOption[] = [
  { value: "VNG-SM-07/09", sub: "V.N.Gaia · Sábado manhã · CCP" },
  { value: "VNG-PL-04/09", sub: "V.N.Gaia · Pós Laboral · CCP" },
  { value: "PEN-SM-02/09", sub: "Penafiel · Sábado manhã · CCP" },
  { value: "BRG-PL-15/09", sub: "Braga · Pós Laboral · CCP" },
  { value: "BRG-SM-21/09", sub: "Braga · Sábado manhã · CCP" },
  { value: "IRN LSB 01/09", sub: "Lisboa · Laboral Manhã · CCP" },
  { value: "2176/2026", sub: "V.N.Gaia · Laboral Manhã · CCP" },
];

export const turmasFinOpts: SelectOption[] = [
  { value: "UFCD 3564 · T1", sub: "Primeiros Socorros · 4 formandos" },
  { value: "SM-T01", sub: "Publicidade nas Redes Sociais · 17 formandos" },
  { value: "UFCD 9109 - Cuidados Básicos", sub: "Estética Facial" },
  { value: "UC02282 - Criar campanhas", sub: "UFCD 10785" },
];

export const locaisOpts: SelectOption[] = [
  { value: "V.N.Gaia", sub: "3 salas" },
  { value: "Braga", sub: "2 salas" },
  { value: "Lisboa", sub: "2 salas" },
  { value: "Penafiel", sub: "1 sala" },
  { value: "Aveiro", sub: "1 sala" },
  { value: "Sala Virtual", sub: "Moodle + Zoom" },
  { value: "E-learning", sub: "Assíncrono" },
];

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

export const formadoresOpts: SelectOption[] = [
  { value: "Isac Silva", sub: "914 547 554 · CCP e pedagogia" },
  { value: "Ivan Esteves", sub: "912 370 557 · Comunicação" },
  { value: "António Cardeal", sub: "915 258 691 · Comunicar em contexto profissional" },
  { value: "Cátia Pinheiro", sub: "912 919 291 · Estética facial" },
  { value: "Vânia Fernandes", sub: "967 432 879 · Primeiros socorros" },
  { value: "Rosana Suarez", sub: "938 039 001 · Massagem" },
];

export function formadoresOptsWith(current?: string | string[]): SelectOption[] {
  return formadoresOptsWithFrom(formadoresOpts, current);
}

export const horariosOpts: SelectOption[] = [
  { value: "Sábado manhã" },
  { value: "Pós Laboral" },
  { value: "Laboral Manhã" },
  { value: "Online" },
];

export const categoriasGoldOpts: SelectOption[] = [
  { value: "CCP e Gestão da Formação" },
  { value: "Saúde e bem estar" },
  { value: "Desenvolvimento Pessoal" },
];

export type ModuloCatalog = SelectOption & { curso?: string };

export const catalogoModulos: ModuloCatalog[] = [
  { value: "M1 · Aprendizagem e pedagogia", sub: "CCP · 20h", curso: "Formação de Formadores - CCP" },
  { value: "M2 · Comunicação e dinâmica de grupos", sub: "CCP · 20h", curso: "Formação de Formadores - CCP" },
  { value: "M3 · Avaliação da formação", sub: "CCP · 15h", curso: "Formação de Formadores - CCP" },
  { value: "M4 · Simulação pedagógica", sub: "CCP · 25h", curso: "Formação de Formadores - CCP" },
  { value: "M5 · Plataformas digitais e e-learning", sub: "CCP · 10h", curso: "Formação de Formadores - CCP" },
  { value: "EX1 · Tabelas dinâmicas e dashboards", sub: "Excel · 4h", curso: "Excel do Básico ao Avançado" },
  { value: "AV1 · Voz e respiração", sub: "6h", curso: "A Arte de Comunicar e Falar em Público: B-learning" },
  { value: "AV2 · Estrutura do discurso", sub: "5h", curso: "A Arte de Comunicar e Falar em Público: B-learning" },
  { value: "AV3 · Ensaio e feedback", sub: "5h", curso: "A Arte de Comunicar e Falar em Público: B-learning" },
  { value: "UFCD 3564 · Avaliação primária e SVB", sub: "Primeiros Socorros · 5h", curso: "Primeiros Socorros" },
  { value: "UFCD 3564 · Trauma e hemorragias", sub: "Primeiros Socorros · 5h", curso: "Primeiros Socorros" },
  { value: "UFCD 3564 · Queimaduras e intoxicações", sub: "Primeiros Socorros · 5h", curso: "Primeiros Socorros" },
  { value: "UFCD 3564 · Emergências médicas", sub: "Primeiros Socorros · 5h", curso: "Primeiros Socorros" },
  { value: "UFCD 3564 · Simulação e avaliação", sub: "Primeiros Socorros · 5h", curso: "Primeiros Socorros" },
  { value: "UFCD 10785 · Criar campanhas", sub: "Publicidade nas Redes Sociais", curso: "Publicidade nas Redes Sociais" },
  { value: "UFCD 10785 · Segmentação e métricas", sub: "Publicidade nas Redes Sociais", curso: "Publicidade nas Redes Sociais" },
  { value: "UFCD 9109 · Cuidados básicos", sub: "Estética Facial", curso: "Masterclass em Estética Facial" },
];

export const modulosOpts: SelectOption[] = catalogoModulos.map(({ value, sub }) => ({ value, sub }));

export function modulosOptsForCurso(curso?: string): SelectOption[] {
  if (!curso) return modulosOpts;
  const exact = catalogoModulos.filter(m => m.curso === curso);
  if (exact.length) return exact.map(({ value, sub }) => ({ value, sub }));
  if (/ccp/i.test(curso)) return catalogoModulos.filter(m => m.curso?.includes("CCP")).map(({ value, sub }) => ({ value, sub }));
  if (/3564|primeiros socorros/i.test(curso)) return catalogoModulos.filter(m => m.curso === "Primeiros Socorros").map(({ value, sub }) => ({ value, sub }));
  return modulosOpts;
}

export const areasOpts: SelectOption[] = [
  { value: "CCP e Gestão da Formação" },
  { value: "Saúde e bem estar" },
  { value: "Desenvolvimento Pessoal" },
  { value: "Boas práticas pedagógicas" },
];

export const blogTematicasOpts: SelectOption[] = [
  { value: "Formação de Formadores", sub: "ccp" },
  { value: "Formação Financiada", sub: "financiada" },
  { value: "Dicas de e-learning", sub: "e-learning" },
  { value: "Carreiras na saúde", sub: "saude" },
  { value: "Notícias ENA", sub: "noticias" },
];

export function SearchSelect({
  value, onChange, options, placeholder = "Pesquisar…", empty = "Nenhum resultado.", allowEmpty,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  empty?: string;
  allowEmpty?: boolean;
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
  const filtered = options.filter(o => `${o.value} ${o.sub ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  const selected = options.find(o => o.value === value);
  return (
    <div ref={triggerRef} className="relative">
      <button type="button" onClick={() => { setOpen(v => !v); setQ(""); }}
        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-left flex items-center justify-between gap-2 focus:outline-none focus:ring-2 focus:ring-amber-400">
        <span className={`truncate ${selected || value ? "text-slate-800" : "text-slate-400"}`}>
          {selected?.value ?? (value || "Selecionar…")}
        </span>
        <span className="text-slate-400 flex-shrink-0">▾</span>
      </button>
      <MenuPortal open={open} triggerRef={triggerRef} panelRef={panelRef}>
        <div className="p-2 border-b border-slate-100">
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder={placeholder}
            className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400" />
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
              <p className="text-sm text-slate-800">{o.value}</p>
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
}: {
  values: string[];
  onChange: (next: string[]) => void;
  options: SelectOption[];
  placeholder?: string;
  empty?: string;
  noneLabel?: string;
  unitSingular?: string;
  unitPlural?: string;
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
  const filtered = all.filter(o => `${o.value} ${o.sub ?? ""}`.toLowerCase().includes(q.toLowerCase()));

  function toggle(v: string) {
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
              <span className="truncate">{v}</span>
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
        <div className="p-2 border-b border-slate-100 bg-white">
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder={placeholder}
            className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <div className="max-h-52 overflow-y-auto bg-white">
          {filtered.length === 0 && <p className="px-3 py-4 text-xs text-slate-400 text-center">{empty}</p>}
          {filtered.map(o => {
            const on = selected.includes(o.value);
            return (
              <button key={o.value} type="button" onClick={() => toggle(o.value)}
                className={`w-full text-left px-3 py-2 flex items-start gap-2 hover:bg-amber-50 ${on ? "bg-amber-50" : ""}`}>
                <span className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${on ? "bg-amber-500 border-amber-500 text-white" : "border-slate-300 bg-white"}`}>
                  {on && (
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  )}
                </span>
                <span className="min-w-0">
                  <p className="text-sm text-slate-800">{o.value}</p>
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
