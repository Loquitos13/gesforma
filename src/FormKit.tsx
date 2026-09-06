import { useEffect, useRef, useState } from "react";

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

export const formadoresOpts: SelectOption[] = [
  { value: "Isac Silva", sub: "914 547 554 · CCP" },
  { value: "Vânia Fernandes", sub: "UFCD 3564 · Primeiros Socorros" },
  { value: "António", sub: "Comunicar em contexto profissional" },
  { value: "Cátia", sub: "Estética Facial" },
  { value: "Rosana", sub: "Técnicas de massagem" },
];

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

export const modulosOpts: SelectOption[] = [
  { value: "M1 · Aprendizagem e pedagogia", sub: "CCP · 20h" },
  { value: "M2 · Comunicação e dinâmica de grupos", sub: "CCP · 20h" },
  { value: "M3 · Avaliação da formação", sub: "CCP · 15h" },
  { value: "M4 · Simulação pedagógica", sub: "CCP · 25h" },
  { value: "M5 · Plataformas digitais e e-learning", sub: "CCP · 10h" },
  { value: "EX1 · Tabelas dinâmicas e dashboards", sub: "Excel · 4h" },
];

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
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const filtered = options.filter(o => `${o.value} ${o.sub ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  const selected = options.find(o => o.value === value);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => { setOpen(v => !v); setQ(""); }}
        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-left flex items-center justify-between gap-2 focus:outline-none focus:ring-2 focus:ring-amber-400">
        <span className={`truncate ${selected || value ? "text-slate-800" : "text-slate-400"}`}>
          {selected?.value ?? (value || "Selecionar…")}
        </span>
        <span className="text-slate-400 flex-shrink-0">▾</span>
      </button>
      {open && (
        <div className="absolute z-[60] mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder={placeholder}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div className="max-h-52 overflow-y-auto">
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
        </div>
      )}
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
