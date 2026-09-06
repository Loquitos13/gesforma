import { useEffect, useState } from "react";
import {
  FilterChips, SearchSelect,
  cursosFinOpts, cursosGoldOpts, horariosOpts, locaisOpts, modulosOpts,
} from "./FormKit";
import { TurmaInscricaoHint } from "./TurmaCronograma";
import { useTurmas } from "./TurmasContext";
import { turmaFinOpts } from "./turmaModel";

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
  eye: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
    </svg>
  ),
  link: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
      <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
    </svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
};

const iCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent";

function Badge({ label, variant }: { label: string; variant: "green" | "gray" | "blue" | "amber" | "teal" | "red" | "violet" | "orange" }) {
  const cls = {
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    gray: "bg-slate-100 text-slate-600 border-slate-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    teal: "bg-teal-50 text-teal-700 border-teal-200",
    red: "bg-red-50 text-red-600 border-red-200",
    violet: "bg-violet-50 text-violet-700 border-violet-200",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
  }[variant];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${cls}`}>{label}</span>;
}

function estadoBadge(estado: string) {
  const m: Record<string, "green" | "gray" | "blue" | "amber" | "teal" | "red" | "violet" | "orange"> = {
    Ativo: "green", Inactivo: "gray", Pago: "teal", Pendente: "orange", Formando: "green",
    "Em análise": "amber", Elegível: "teal", Indeferido: "red", "Colocado na turma": "green", Recebida: "blue",
    PDF: "red", Vídeo: "violet", Link: "blue",
  };
  return <Badge label={estado} variant={m[estado] ?? "gray"} />;
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
function NewBtn({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm whitespace-nowrap">
      {I.plus}{label}
    </button>
  );
}
function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap bg-slate-50 border-b border-slate-200 ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 ${className}`}>{children}</td>;
}
function ActBtn({ icon, label, color = "blue", onClick }: { icon: React.ReactNode; label: string; color?: string; onClick?: () => void }) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-100 text-blue-700 hover:bg-blue-200",
    red: "bg-red-100 text-red-600 hover:bg-red-200",
    gray: "bg-slate-100 text-slate-500 hover:bg-slate-200",
    teal: "bg-teal-100 text-teal-700 hover:bg-teal-200",
  };
  return (
    <button title={label} aria-label={label} onClick={onClick} className={`w-7 h-7 inline-flex items-center justify-center rounded-lg transition-colors ${colorMap[color] ?? colorMap.blue}`}>
      {icon}
    </button>
  );
}
function TableToolbar({ search, onSearch }: { search: string; onSearch: (v: string) => void }) {
  return (
    <div className="flex items-center justify-end px-4 py-3 border-b border-slate-100">
      <div className="relative w-full sm:w-52">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{I.search}</span>
        <input value={search} onChange={e => onSearch(e.target.value)} placeholder="Pesquisar…" className="pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 w-full" />
      </div>
    </div>
  );
}
function TableFooter({ page, total, perPage, onChange }: { page: number; total: number; perPage: number; onChange: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-slate-100">
      <p className="text-xs text-slate-500">A mostrar <strong className="text-slate-700">{from}–{to}</strong> de <strong className="text-slate-700">{total}</strong></p>
      <div className="flex gap-1">
        <button onClick={() => onChange(page - 1)} disabled={page === 1} className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white disabled:opacity-40">‹</button>
        <button onClick={() => onChange(page + 1)} disabled={page === pages} className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white disabled:opacity-40">›</button>
      </div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1.5"><label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</label>{children}</div>;
}
function SlideOver({ open, onClose, title, sub, children }: { open: boolean; onClose: () => void; title: string; sub?: string; children: React.ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-xl bg-white shadow-2xl flex flex-col h-full overflow-hidden" style={{ animation: "slideInRight 0.22s ease" }}>
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-800">{title}</h2>
            {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100">{I.x}</button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
function EmptyState({ text }: { text: string }) {
  return <tr><td colSpan={12} className="px-4 py-12 text-center text-sm text-slate-400">{text}</td></tr>;
}
function FormActions({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex gap-2 pt-2">
      <button className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg">Guardar</button>
      <button onClick={onClose} className="px-4 py-2.5 bg-white border border-slate-200 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-50">Cancelar</button>
    </div>
  );
}

const formandosGoldData = [
  { id: 4301, nome: "Rui", apelido: "Moreira", email: "rui.moreira@gmail.com", telf: "912334887", curso: "Excel do Básico ao Avançado", local: "E-learning", inscrito: "2026-08-12", pago: true, valor: 45, metodo: "MB Way", estado: "Ativo" },
  { id: 4302, nome: "Carla", apelido: "Nogueira", email: "carla.nogueira@sapo.pt", telf: "934112009", curso: "A Arte de Comunicar: E-learning", local: "Sala Virtual", inscrito: "2026-08-28", pago: true, valor: 35, metodo: "Cartão", estado: "Ativo" },
  { id: 4303, nome: "Pedro", apelido: "Almeida", email: "palmeida@outlook.pt", telf: "918776221", curso: "Curso de Cura Prânica", local: "E-learning", inscrito: "2026-09-01", pago: false, valor: 200, metodo: "-", estado: "Pendente" },
  { id: 4304, nome: "Sofia", apelido: "Ramos", email: "sofia.ramos@ena.pt", telf: "926441078", curso: "Auxiliar de Medicina Dentária", local: "E-learning", inscrito: "2026-07-19", pago: true, valor: 300, metodo: "Transferência", estado: "Ativo" },
  { id: 4305, nome: "Nuno", apelido: "Teixeira", email: "nuno.teixeira88@gmail.com", telf: "961203445", curso: "Auxiliar de Medicina Veterinária", local: "E-learning", inscrito: "2026-09-02", pago: false, valor: 400, metodo: "-", estado: "Pendente" },
];

const datasGoldData = [
  { id: 41, inicio: "2026-09-07", fim: "2026-11-29", horario: "Sábado manhã", preco: 125, local: "V.N.Gaia", curso: "Formação de Formadores - CCP", status: "Ativo", link: "ena.pt/ccp/vng-sm-07-09" },
  { id: 42, inicio: "2026-09-04", fim: "2026-11-26", horario: "Pós Laboral", preco: 125, local: "V.N.Gaia", curso: "Formação de Formadores - CCP", status: "Ativo", link: "ena.pt/ccp/vng-pl-04-09" },
  { id: 43, inicio: "2026-09-15", fim: "2026-12-07", horario: "Pós Laboral", preco: 120, local: "Braga", curso: "Formação de Formadores - CCP", status: "Ativo", link: "ena.pt/ccp/brg-pl-15-09" },
  { id: 44, inicio: "2026-09-21", fim: "2026-12-13", horario: "Sábado manhã", preco: 120, local: "Braga", curso: "Formação de Formadores - CCP", status: "Ativo", link: "ena.pt/ccp/brg-sm-21-09" },
  { id: 45, inicio: "2026-07-06", fim: "2026-09-28", horario: "Laboral Manhã", preco: 145, local: "Lisboa", curso: "Formação de Formadores - CCP", status: "Ativo", link: "ena.pt/ccp/irn-lsb-01-09" },
  { id: 46, inicio: "2026-09-02", fim: "2026-11-24", horario: "Sábado manhã", preco: 125, local: "Penafiel", curso: "Formação de Formadores - CCP", status: "Ativo", link: "ena.pt/ccp/pen-sm-02-09" },
  { id: 31, inicio: "2025-06-13", fim: "2025-07-30", horario: "Pós Laboral", preco: 120, local: "Braga", curso: "Formação de Formadores - CCP", status: "Inactivo", link: "ena.pt/ccp/braga-2025" },
  { id: 27, inicio: "2025-08-22", fim: "2025-10-08", horario: "Pós Laboral", preco: 125, local: "Aveiro", curso: "Formação de Formadores - CCP", status: "Inactivo", link: "ena.pt/ccp/aveiro-2025" },
];

const locaisData = [
  { id: 15, nome: "V.N.Gaia", morada: "Rua da Formação 12, 4400-000 V.N. Gaia", salas: 3, turmas: 6, status: "Ativo" },
  { id: 16, nome: "Aveiro", morada: "Av. Dr. Lourenço Peixinho 88, 3800 Aveiro", salas: 1, turmas: 0, status: "Ativo" },
  { id: 17, nome: "Penafiel", morada: "Rua Direita 4, 4560 Penafiel", salas: 1, turmas: 1, status: "Ativo" },
  { id: 18, nome: "Braga", morada: "Av. da Liberdade 210, 4710 Braga", salas: 2, turmas: 2, status: "Ativo" },
  { id: 19, nome: "Lisboa", morada: "Av. da República 50, 1050 Lisboa", salas: 2, turmas: 1, status: "Ativo" },
  { id: 25, nome: "Sala Virtual", morada: "Moodle + Zoom ENA", salas: 0, turmas: 4, status: "Ativo" },
];

const areasTematicasData = [
  { id: 21, nome: "CCP e Gestão da Formação", cursos: 4, estado: "Ativo" },
  { id: 22, nome: "Saúde e bem estar", cursos: 3, estado: "Ativo" },
  { id: 23, nome: "Desenvolvimento Pessoal", cursos: 3, estado: "Ativo" },
  { id: 17, nome: "Boas práticas para a vida", cursos: 1, estado: "Ativo" },
  { id: 18, nome: "Boas práticas profissionais", cursos: 2, estado: "Ativo" },
  { id: 19, nome: "Boas práticas pedagógicas", cursos: 2, estado: "Ativo" },
];

const modulosData = [
  { id: 1, codigo: "M1", nome: "Aprendizagem e pedagogia", horas: 20, curso: "Formação de Formadores - CCP", tipo: "Teórico-prático", estado: "Ativo" },
  { id: 2, codigo: "M2", nome: "Comunicação e dinâmica de grupos", horas: 20, curso: "Formação de Formadores - CCP", tipo: "Teórico-prático", estado: "Ativo" },
  { id: 3, codigo: "M3", nome: "Avaliação da formação", horas: 15, curso: "Formação de Formadores - CCP", tipo: "Teórico", estado: "Ativo" },
  { id: 4, codigo: "M4", nome: "Simulação pedagógica", horas: 25, curso: "Formação de Formadores - CCP", tipo: "Prático", estado: "Ativo" },
  { id: 5, codigo: "M5", nome: "Plataformas digitais e e-learning", horas: 10, curso: "Formação de Formadores - CCP", tipo: "B-learning", estado: "Ativo" },
  { id: 6, codigo: "EX1", nome: "Tabelas dinâmicas e dashboards", horas: 4, curso: "Excel do Básico ao Avançado", tipo: "Prático", estado: "Ativo" },
  { id: 7, codigo: "AV1", nome: "Voz e respiração", horas: 6, curso: "A Arte de Comunicar e Falar em Público: B-learning", tipo: "Prático", estado: "Ativo" },
  { id: 8, codigo: "AV2", nome: "Estrutura do discurso", horas: 5, curso: "A Arte de Comunicar e Falar em Público: B-learning", tipo: "Teórico-prático", estado: "Ativo" },
  { id: 9, codigo: "AV3", nome: "Ensaio e feedback", horas: 5, curso: "A Arte de Comunicar e Falar em Público: B-learning", tipo: "Prático", estado: "Ativo" },
];

const conteudosData = [
  { id: 11, titulo: "Manual CCP - Módulo 1 (Aprendizagem)", tipo: "PDF", curso: "CCP", modulo: "M1", tamanho: "2,4 MB", estado: "Ativo" },
  { id: 12, titulo: "Vídeo: comunicação em sala", tipo: "Vídeo", curso: "CCP", modulo: "M2", tamanho: "18 min", estado: "Ativo" },
  { id: 13, titulo: "Grelha de observação da simulação", tipo: "PDF", curso: "CCP", modulo: "M4", tamanho: "180 KB", estado: "Ativo" },
  { id: 14, titulo: "Plataforma Moodle CCP", tipo: "Link", curso: "CCP", modulo: "M5", tamanho: "-", estado: "Ativo" },
  { id: 15, titulo: "Ficha de avaliação final", tipo: "PDF", curso: "CCP", modulo: "M3", tamanho: "92 KB", estado: "Ativo" },
  { id: 16, titulo: "Exercícios Excel avançado", tipo: "PDF", curso: "Excel", modulo: "EX1", tamanho: "1,1 MB", estado: "Inactivo" },
];

type DocDots = { cc: boolean; ch: boolean; cu: boolean; ci: boolean; ce: boolean };
const finInscricoesData: Array<{
  id: number; inscrito: string; nome: string; apelido: string; email: string; telf: string;
  ufcd: string; curso: string; turma: string; estado: string; docs: DocDots;
}> = [
  { id: 501, inscrito: "2026-09-01", nome: "Mariana", apelido: "Sousa Pereira", email: "mariana98pereira@gmail.com", telf: "932874093", ufcd: "3564", curso: "Primeiros Socorros", turma: "UFCD 3564 · T1", estado: "Em análise", docs: { cc: false, ch: false, cu: false, ci: false, ce: false } },
  { id: 502, inscrito: "2026-08-28", nome: "Diogo Alexandre", apelido: "Soares Oliveira", email: "diogo_nik@hotmail.com", telf: "914388980", ufcd: "10785", curso: "Publicidade nas Redes Sociais", turma: "SM-T01", estado: "Elegível", docs: { cc: true, ch: false, cu: false, ci: true, ce: false } },
  { id: 503, inscrito: "2026-08-27", nome: "Vanesa Magali", apelido: "Correa Bender", email: "valescabender@gmail.com", telf: "963130925", ufcd: "10785", curso: "Publicidade nas Redes Sociais", turma: "SM-T01", estado: "Colocado na turma", docs: { cc: true, ch: true, cu: true, ci: true, ce: true } },
  { id: 504, inscrito: "2026-08-26", nome: "Laércio Daniel", apelido: "Ferreira da Costa", email: "71aercio7@gmail.com", telf: "933168749", ufcd: "10785", curso: "Publicidade nas Redes Sociais", turma: "SM-T01", estado: "Elegível", docs: { cc: true, ch: false, cu: false, ci: false, ce: false } },
  { id: 505, inscrito: "2026-08-20", nome: "Tânia", apelido: "Veloso", email: "taniapatriciaveloso@gmail.com", telf: "914011998", ufcd: "10785", curso: "Publicidade nas Redes Sociais", turma: "SM-T01", estado: "Recebida", docs: { cc: true, ch: false, cu: false, ci: false, ce: false } },
  { id: 506, inscrito: "2026-08-18", nome: "Helena", apelido: "Costa", email: "helena.costa@gmail.com", telf: "917220331", ufcd: "3564", curso: "Primeiros Socorros", turma: "-", estado: "Indeferido", docs: { cc: true, ch: false, cu: false, ci: false, ce: false } },
  { id: 507, inscrito: "2026-09-03", nome: "Bruno", apelido: "Machado", email: "bruno.machado@ua.pt", telf: "925667109", ufcd: "10394", curso: "Métodos e Técnicas Pedagógicas", turma: "-", estado: "Em análise", docs: { cc: true, ch: true, cu: false, ci: true, ce: false } },
];

const blogTematicasData = [
  { id: 1, nome: "Formação de Formadores", slug: "ccp", posts: 4, estado: "Ativo" },
  { id: 2, nome: "Formação Financiada", slug: "financiada", posts: 3, estado: "Ativo" },
  { id: 3, nome: "Dicas de e-learning", slug: "e-learning", posts: 2, estado: "Ativo" },
  { id: 4, nome: "Carreiras na saúde", slug: "saude", posts: 1, estado: "Ativo" },
  { id: 5, nome: "Notícias ENA", slug: "noticias", posts: 0, estado: "Inactivo" },
];

function DocPips({ docs }: { docs: DocDots }) {
  const keys: Array<{ k: keyof DocDots; l: string }> = [
    { k: "cc", l: "CC" }, { k: "ch", l: "CH" }, { k: "cu", l: "CU" }, { k: "ci", l: "CI" }, { k: "ce", l: "CE" },
  ];
  return (
    <div className="flex items-center gap-1" title="CC cartão · CH habilitações · CU CV · CI IBAN · CE emprego">
      {keys.map(({ k, l }) => (
        <span key={k} className={`w-6 h-6 rounded-full text-[9px] font-bold inline-flex items-center justify-center ${docs[k] ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"}`}>{l}</span>
      ))}
    </div>
  );
}

export function FormandosGoldView() {
  const [s, setS] = useState(""); const [p, setP] = useState(1);
  const [filtro, setFiltro] = useState("Todos");
  const [open, setOpen] = useState<"new" | typeof formandosGoldData[number] | null>(null);
  const [curso, setCurso] = useState("");
  const f = formandosGoldData.filter(x => {
    const q = `${x.nome} ${x.apelido} ${x.curso} ${x.email}`.toLowerCase().includes(s.toLowerCase());
    return q && (filtro === "Todos" || x.estado === filtro);
  });
  const rows = f.slice((p - 1) * 10, p * 10);
  const editing = open && open !== "new" ? open : null;
  useEffect(() => { if (open) setCurso(editing?.curso ?? ""); }, [open, editing]);
  return (
    <>
      <div className="space-y-4">
        <PageHeader title="Formandos Gold" sub="Formandos individuais - sem turma atribuída. Cursos e-learning e vendas avulso." action={<NewBtn label="+ Novo formando" onClick={() => setOpen("new")} />} />
        <FilterChips options={["Todos", "Ativo", "Pendente"]} value={filtro} onChange={v => { setFiltro(v); setP(1); }} />
        <Card>
          <TableToolbar search={s} onSearch={v => { setS(v); setP(1); }} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr><Th>Id</Th><Th>Nome</Th><Th>Curso</Th><Th>Local</Th><Th>Inscrito</Th><Th>Valor</Th><Th>Estado</Th><Th>Ações</Th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length === 0 && <EmptyState text="Nenhum formando Gold individual corresponde à pesquisa." />}
                {rows.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <Td><span className="text-slate-400 font-mono text-xs">{r.id}</span></Td>
                    <Td>
                      <p className="text-xs font-medium text-blue-600">{r.nome} {r.apelido}</p>
                      <p className="text-xs text-slate-400 truncate max-w-[160px]">{r.email}</p>
                    </Td>
                    <Td className="text-xs text-slate-600 max-w-[180px]">{r.curso}</Td>
                    <Td className="text-xs text-slate-600 whitespace-nowrap">{r.local}</Td>
                    <Td className="font-mono text-xs text-slate-500">{r.inscrito}</Td>
                    <Td className="text-xs font-bold text-amber-600">€ {r.valor}</Td>
                    <Td>{estadoBadge(r.estado)}</Td>
                    <Td><div className="flex gap-1"><ActBtn icon={I.eye} label="Ficha" onClick={() => setOpen(r)} /><ActBtn icon={I.edit} label="Editar" onClick={() => setOpen(r)} /><ActBtn icon={I.trash} label="Eliminar" color="red" /></div></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TableFooter page={p} total={f.length} perPage={10} onChange={setP} />
        </Card>
      </div>
      <SlideOver open={!!open} onClose={() => setOpen(null)} title={editing ? `${editing.nome} ${editing.apelido}` : "Novo formando Gold"} sub={editing ? `#${editing.id} · sem turma` : "Venda individual, fora de turma"}>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome"><input className={iCls} defaultValue={editing?.nome ?? ""} /></Field>
            <Field label="Apelido"><input className={iCls} defaultValue={editing?.apelido ?? ""} /></Field>
          </div>
          <Field label="Email"><input className={iCls} defaultValue={editing?.email ?? ""} /></Field>
          <Field label="Telemóvel"><input className={iCls} defaultValue={editing?.telf ?? ""} /></Field>
          <Field label="Curso"><SearchSelect value={curso} onChange={setCurso} options={cursosGoldOpts} placeholder="Pesquisar curso…" /></Field>
          <Field label="Valor (€)"><input className={iCls} type="number" defaultValue={editing?.valor ?? 0} /></Field>
          <FormActions onClose={() => setOpen(null)} />
        </div>
      </SlideOver>
    </>
  );
}

export function DatasGoldView() {
  const [s, setS] = useState(""); const [p, setP] = useState(1);
  const [filtro, setFiltro] = useState("Todos");
  const [open, setOpen] = useState<"new" | typeof datasGoldData[number] | null>(null);
  const [curso, setCurso] = useState("");
  const [local, setLocal] = useState("");
  const [horario, setHorario] = useState("");
  const f = datasGoldData.filter(x => {
    const q = `${x.curso} ${x.local} ${x.horario}`.toLowerCase().includes(s.toLowerCase());
    return q && (filtro === "Todos" || x.status === filtro || x.local === filtro);
  });
  const rows = f.slice((p - 1) * 10, p * 10);
  const editing = open && open !== "new" ? open : null;
  useEffect(() => {
    if (open) {
      setCurso(editing?.curso ?? "Formação de Formadores - CCP");
      setLocal(editing?.local ?? "");
      setHorario(editing?.horario ?? "");
    }
  }, [open, editing]);
  return (
    <>
      <div className="space-y-4">
        <PageHeader title="Datas / Edições Gold" sub="Calendário comercial: início, fim, horário, preço e local. Cada edição alimenta as turmas." action={<NewBtn label="+ Nova data" onClick={() => setOpen("new")} />} />
        <FilterChips options={["Todos", "Ativo", "Inactivo", "V.N.Gaia", "Braga", "Lisboa"]} value={filtro} onChange={v => { setFiltro(v); setP(1); }} />
        <Card>
          <TableToolbar search={s} onSearch={v => { setS(v); setP(1); }} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr><Th>Id</Th><Th>Início</Th><Th>Fim</Th><Th>Horário</Th><Th>Local</Th><Th>Curso</Th><Th>Preço</Th><Th>Inscrição</Th><Th>Estado</Th><Th>Ações</Th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length === 0 && <EmptyState text="Nenhuma edição corresponde à pesquisa." />}
                {rows.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <Td><span className="text-slate-400 font-mono text-xs">{r.id}</span></Td>
                    <Td className="font-mono text-xs text-slate-500 whitespace-nowrap">{r.inicio}</Td>
                    <Td className="font-mono text-xs text-slate-500 whitespace-nowrap">{r.fim}</Td>
                    <Td className="text-xs text-slate-600 whitespace-nowrap">{r.horario}</Td>
                    <Td className="text-xs text-slate-600 whitespace-nowrap">{r.local}</Td>
                    <Td className="text-xs text-slate-600 max-w-[160px]">{r.curso}</Td>
                    <Td className="text-xs font-bold text-amber-600">€ {r.preco}</Td>
                    <Td>
                      <a href={`https://${r.link}`} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline" onClick={e => e.preventDefault()}>{I.link} Link</a>
                    </Td>
                    <Td>{estadoBadge(r.status)}</Td>
                    <Td><div className="flex gap-1"><ActBtn icon={I.edit} label="Editar" onClick={() => setOpen(r)} /><ActBtn icon={I.trash} label="Eliminar" color="red" /></div></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TableFooter page={p} total={f.length} perPage={10} onChange={setP} />
        </Card>
      </div>
      <SlideOver open={!!open} onClose={() => setOpen(null)} title={editing ? `Edição #${editing.id}` : "Nova data / edição"} sub="Define o calendário comercial da turma">
        <div className="p-5 space-y-3">
          <Field label="Curso"><SearchSelect value={curso} onChange={setCurso} options={cursosGoldOpts} placeholder="Pesquisar curso…" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Início"><input type="date" className={iCls} defaultValue={editing?.inicio ?? ""} /></Field>
            <Field label="Fim"><input type="date" className={iCls} defaultValue={editing?.fim ?? ""} /></Field>
          </div>
          <Field label="Horário"><SearchSelect value={horario} onChange={setHorario} options={horariosOpts} /></Field>
          <Field label="Local"><SearchSelect value={local} onChange={setLocal} options={locaisOpts} placeholder="Pesquisar local…" /></Field>
          <Field label="Preço (€)"><input type="number" className={iCls} defaultValue={editing?.preco ?? 125} /></Field>
          <Field label="Link de inscrição"><input className={iCls} defaultValue={editing?.link ?? ""} /></Field>
          <FormActions onClose={() => setOpen(null)} />
        </div>
      </SlideOver>
    </>
  );
}

export function LocaisView() {
  const [s, setS] = useState("");
  const [filtro, setFiltro] = useState("Todos");
  const [open, setOpen] = useState<"new" | typeof locaisData[number] | null>(null);
  const f = locaisData.filter(x => {
    const q = `${x.nome} ${x.morada}`.toLowerCase().includes(s.toLowerCase());
    return q && (filtro === "Todos" || x.status === filtro);
  });
  const editing = open && open !== "new" ? open : null;
  return (
    <>
      <div className="space-y-4">
        <PageHeader title="Locais" sub="Polos da ENA onde as turmas Gold decorrem." action={<NewBtn label="+ Novo local" onClick={() => setOpen("new")} />} />
        <FilterChips options={["Todos", "Ativo", "Inactivo"]} value={filtro} onChange={setFiltro} />
        <Card>
          <TableToolbar search={s} onSearch={setS} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr><Th>Id</Th><Th>Local</Th><Th>Morada / plataforma</Th><Th className="text-center">Salas</Th><Th className="text-center">Turmas</Th><Th>Estado</Th><Th>Ações</Th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {f.length === 0 && <EmptyState text="Nenhum local encontrado." />}
                {f.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <Td><span className="text-slate-400 font-mono text-xs">{r.id}</span></Td>
                    <Td className="text-sm font-semibold text-slate-800">{r.nome}</Td>
                    <Td className="text-xs text-slate-500 max-w-[240px]">{r.morada}</Td>
                    <Td className="text-center text-xs text-slate-600">{r.salas || "-"}</Td>
                    <Td className="text-center text-xs font-semibold text-slate-700">{r.turmas}</Td>
                    <Td>{estadoBadge(r.status)}</Td>
                    <Td><div className="flex gap-1"><ActBtn icon={I.edit} label="Editar" onClick={() => setOpen(r)} /><ActBtn icon={I.trash} label="Eliminar" color="red" /></div></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      <SlideOver open={!!open} onClose={() => setOpen(null)} title={editing ? editing.nome : "Novo local"}>
        <div className="p-5 space-y-3">
          <Field label="Nome"><input className={iCls} defaultValue={editing?.nome ?? ""} /></Field>
          <Field label="Morada"><input className={iCls} defaultValue={editing?.morada ?? ""} /></Field>
          <Field label="Salas"><input type="number" className={iCls} defaultValue={editing?.salas ?? 1} /></Field>
          <FormActions onClose={() => setOpen(null)} />
        </div>
      </SlideOver>
    </>
  );
}

export function AreasTematicasView() {
  const [s, setS] = useState("");
  const [filtro, setFiltro] = useState("Todos");
  const [open, setOpen] = useState<"new" | typeof areasTematicasData[number] | null>(null);
  const f = areasTematicasData.filter(x => x.nome.toLowerCase().includes(s.toLowerCase()) && (filtro === "Todos" || x.estado === filtro));
  const editing = open && open !== "new" ? open : null;
  return (
    <>
      <div className="space-y-4">
        <PageHeader title="Áreas Temáticas" sub="Agrupam os cursos Gold no site e no backoffice." action={<NewBtn label="+ Nova área" onClick={() => setOpen("new")} />} />
        <FilterChips options={["Todos", "Ativo", "Inactivo"]} value={filtro} onChange={setFiltro} />
        <Card>
          <TableToolbar search={s} onSearch={setS} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr><Th>Id</Th><Th>Área</Th><Th className="text-center">Cursos</Th><Th>Estado</Th><Th>Ações</Th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {f.length === 0 && <EmptyState text="Nenhuma área temática encontrada." />}
                {f.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <Td><span className="text-slate-400 font-mono text-xs">{r.id}</span></Td>
                    <Td className="text-sm font-medium text-slate-800">{r.nome}</Td>
                    <Td className="text-center text-xs font-semibold text-slate-700">{r.cursos}</Td>
                    <Td>{estadoBadge(r.estado)}</Td>
                    <Td><div className="flex gap-1"><ActBtn icon={I.edit} label="Editar" onClick={() => setOpen(r)} /><ActBtn icon={I.trash} label="Eliminar" color="red" /></div></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      <SlideOver open={!!open} onClose={() => setOpen(null)} title={editing ? editing.nome : "Nova área temática"}>
        <div className="p-5 space-y-3">
          <Field label="Nome"><input className={iCls} defaultValue={editing?.nome ?? ""} /></Field>
          <FormActions onClose={() => setOpen(null)} />
        </div>
      </SlideOver>
    </>
  );
}

type ModuloRow = typeof modulosData[number];

export function ModulosView({ cursoInicial }: { cursoInicial?: string }) {
  const [s, setS] = useState("");
  const [estado, setEstado] = useState("Todos");
  const [cursoFiltro, setCursoFiltro] = useState(cursoInicial ?? "");
  const [lista, setLista] = useState<ModuloRow[]>(modulosData);
  const [open, setOpen] = useState<"new" | ModuloRow | null>(null);
  const [curso, setCurso] = useState("");
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [horas, setHoras] = useState("10");
  const [tipo, setTipo] = useState("Teórico-prático");
  const editing = open && open !== "new" ? open : null;

  useEffect(() => { setCursoFiltro(cursoInicial ?? ""); }, [cursoInicial]);

  useEffect(() => {
    if (!open) return;
    setCurso(editing?.curso || cursoFiltro || "");
    setCodigo(editing?.codigo ?? "");
    setNome(editing?.nome ?? "");
    setHoras(String(editing?.horas ?? 10));
    setTipo(editing?.tipo ?? "Teórico-prático");
  }, [open, editing, cursoFiltro]);

  const f = lista.filter(x => {
    const q = `${x.nome} ${x.codigo} ${x.curso}`.toLowerCase().includes(s.toLowerCase());
    const byCurso = !cursoFiltro || x.curso === cursoFiltro;
    const byEstado = estado === "Todos" || x.estado === estado;
    return q && byCurso && byEstado;
  });
  const horasCurso = f.reduce((acc, x) => acc + x.horas, 0);

  function abrirNovo() {
    setOpen("new");
  }

  function guardarModulo() {
    if (!nome.trim() || !curso) return;
    if (open === "new") {
      const id = Math.max(0, ...lista.map(x => x.id)) + 1;
      setLista(prev => [...prev, {
        id, codigo: codigo.trim() || `M${id}`, nome: nome.trim(), horas: Number(horas) || 0,
        curso, tipo: tipo.trim() || "Teórico-prático", estado: "Ativo",
      }]);
      if (!cursoFiltro) setCursoFiltro(curso);
    } else if (editing) {
      setLista(prev => prev.map(x => x.id === editing.id
        ? { ...x, codigo: codigo.trim() || x.codigo, nome: nome.trim(), horas: Number(horas) || 0, curso, tipo: tipo.trim() || x.tipo }
        : x));
    }
    setOpen(null);
  }

  return (
    <>
      <div className="space-y-4">
        <PageHeader
          title="Módulos"
          sub={cursoFiltro ? `${f.length} módulo${f.length === 1 ? "" : "s"} · ${horasCurso}h neste curso` : "Escolha um curso para ver e criar os seus módulos."}
          action={<NewBtn label="+ Novo módulo" onClick={abrirNovo} />}
        />
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
            <Field label="Curso">
              <SearchSelect
                value={cursoFiltro}
                onChange={setCursoFiltro}
                options={cursosGoldOpts}
                placeholder="Pesquisar curso…"
                allowEmpty
              />
            </Field>
            <button type="button" onClick={abrirNovo}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg whitespace-nowrap">
              {I.plus} Novo módulo{cursoFiltro ? " neste curso" : ""}
            </button>
          </div>
          <FilterChips options={["Todos", "Ativo", "Inactivo"]} value={estado} onChange={setEstado} />
        </div>
        <Card>
          <TableToolbar search={s} onSearch={setS} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr><Th>Id</Th><Th>Código</Th><Th>Módulo</Th><Th>Curso</Th><Th>Tipo</Th><Th className="text-center">Horas</Th><Th>Estado</Th><Th>Ações</Th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {f.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center">
                      <p className="text-sm text-slate-500">
                        {!cursoFiltro
                          ? "Selecione um curso acima para listar os módulos."
                          : "Este curso ainda não tem módulos."}
                      </p>
                      <button type="button" onClick={abrirNovo} className="mt-3 text-sm font-semibold text-amber-600 hover:text-amber-700">
                        + Criar o primeiro módulo
                      </button>
                    </td>
                  </tr>
                )}
                {f.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <Td><span className="text-slate-400 font-mono text-xs">{r.id}</span></Td>
                    <Td><span className="text-xs font-bold font-mono text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">{r.codigo}</span></Td>
                    <Td className="text-sm font-medium text-slate-800">{r.nome}</Td>
                    <Td className="text-xs text-slate-500 max-w-[180px]">{r.curso}</Td>
                    <Td className="text-xs text-slate-600">{r.tipo}</Td>
                    <Td className="text-center text-xs font-semibold">{r.horas}h</Td>
                    <Td>{estadoBadge(r.estado)}</Td>
                    <Td><div className="flex gap-1"><ActBtn icon={I.edit} label="Editar" onClick={() => setOpen(r)} /><ActBtn icon={I.trash} label="Eliminar" color="red" onClick={() => setLista(prev => prev.filter(x => x.id !== r.id))} /></div></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      <SlideOver open={!!open} onClose={() => setOpen(null)} title={editing ? `${editing.codigo} · ${editing.nome}` : "Novo módulo"} sub={curso || cursoFiltro || "Associar a um curso Gold"}>
        <div className="p-5 space-y-3">
          <Field label="Curso"><SearchSelect value={curso} onChange={setCurso} options={cursosGoldOpts} placeholder="Pesquisar curso…" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Código"><input className={iCls} value={codigo} onChange={e => setCodigo(e.target.value)} placeholder="M6" /></Field>
            <Field label="Horas"><input type="number" className={iCls} value={horas} onChange={e => setHoras(e.target.value)} /></Field>
          </div>
          <Field label="Nome"><input className={iCls} value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do módulo" /></Field>
          <Field label="Tipo"><input className={iCls} value={tipo} onChange={e => setTipo(e.target.value)} /></Field>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => setOpen(null)} className="flex-1 py-2 border border-slate-200 text-sm text-slate-600 rounded-lg hover:bg-slate-50">Cancelar</button>
            <button type="button" onClick={guardarModulo} disabled={!nome.trim() || !curso}
              className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white text-sm font-semibold rounded-lg">Guardar</button>
          </div>
        </div>
      </SlideOver>
    </>
  );
}

export function ConteudosView() {
  const [s, setS] = useState("");
  const [filtro, setFiltro] = useState("Todos");
  const [open, setOpen] = useState<"new" | typeof conteudosData[number] | null>(null);
  const [curso, setCurso] = useState("");
  const [modulo, setModulo] = useState("");
  const f = conteudosData.filter(x => {
    const q = `${x.titulo} ${x.curso} ${x.modulo}`.toLowerCase().includes(s.toLowerCase());
    return q && (filtro === "Todos" || x.tipo === filtro || x.estado === filtro);
  });
  const editing = open && open !== "new" ? open : null;
  useEffect(() => {
    if (open) {
      setCurso(editing?.curso === "Excel" ? "Excel do Básico ao Avançado" : editing?.curso === "CCP" ? "Formação de Formadores - CCP" : editing?.curso ?? "");
      setModulo(editing ? (modulosOpts.find(m => m.value.startsWith(editing.modulo))?.value ?? "") : "");
    }
  }, [open, editing]);
  return (
    <>
      <div className="space-y-4">
        <PageHeader title="Conteúdos" sub="Materiais da turma e do curso: PDF, vídeo ou ligação externa." action={<NewBtn label="+ Novo conteúdo" onClick={() => setOpen("new")} />} />
        <FilterChips options={["Todos", "PDF", "Vídeo", "Link", "Ativo", "Inactivo"]} value={filtro} onChange={setFiltro} />
        <Card>
          <TableToolbar search={s} onSearch={setS} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr><Th>Id</Th><Th>Título</Th><Th>Tipo</Th><Th>Curso</Th><Th>Módulo</Th><Th>Tamanho</Th><Th>Estado</Th><Th>Ações</Th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {f.length === 0 && <EmptyState text="Nenhum conteúdo encontrado." />}
                {f.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <Td><span className="text-slate-400 font-mono text-xs">{r.id}</span></Td>
                    <Td className="text-sm font-medium text-slate-800 max-w-[220px]">{r.titulo}</Td>
                    <Td>{estadoBadge(r.tipo)}</Td>
                    <Td className="text-xs text-slate-600">{r.curso}</Td>
                    <Td><span className="text-xs font-mono font-bold text-slate-600">{r.modulo}</span></Td>
                    <Td className="text-xs text-slate-500">{r.tamanho}</Td>
                    <Td>{estadoBadge(r.estado)}</Td>
                    <Td><div className="flex gap-1"><ActBtn icon={I.eye} label="Abrir" /><ActBtn icon={I.edit} label="Editar" onClick={() => setOpen(r)} /><ActBtn icon={I.trash} label="Eliminar" color="red" /></div></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      <SlideOver open={!!open} onClose={() => setOpen(null)} title={editing ? editing.titulo : "Novo conteúdo"}>
        <div className="p-5 space-y-3">
          <Field label="Título"><input className={iCls} defaultValue={editing?.titulo ?? ""} /></Field>
          <Field label="Tipo">
            <select className={iCls} defaultValue={editing?.tipo ?? "PDF"}>
              <option>PDF</option><option>Vídeo</option><option>Link</option>
            </select>
          </Field>
          <Field label="Curso"><SearchSelect value={curso} onChange={setCurso} options={cursosGoldOpts} placeholder="Pesquisar curso…" /></Field>
          <Field label="Módulo"><SearchSelect value={modulo} onChange={setModulo} options={modulosOpts} placeholder="Pesquisar módulo…" /></Field>
          <FormActions onClose={() => setOpen(null)} />
        </div>
      </SlideOver>
    </>
  );
}

export function FinInscricoesView() {
  const { fin } = useTurmas();
  const [s, setS] = useState(""); const [p, setP] = useState(1);
  const [filtro, setFiltro] = useState("Todas");
  const [open, setOpen] = useState<"new" | typeof finInscricoesData[number] | null>(null);
  const [curso, setCurso] = useState("");
  const [turma, setTurma] = useState("");
  const estados = ["Todas", "Recebida", "Em análise", "Elegível", "Colocado na turma", "Indeferido"];
  const editing = open && open !== "new" ? open : null;
  const turmaOpts = turmaFinOpts(fin, { curso: curso || undefined, includeNome: editing && editing.turma !== "-" ? editing.turma : undefined });
  useEffect(() => {
    if (open) {
      setCurso(editing?.curso ?? "");
      setTurma(editing && editing.turma !== "-" ? editing.turma : "");
    }
  }, [open, editing]);
  const f = finInscricoesData.filter(x => {
    const q = `${x.nome} ${x.apelido} ${x.ufcd} ${x.curso} ${x.turma}`.toLowerCase().includes(s.toLowerCase());
    return q && (filtro === "Todas" || x.estado === filtro);
  });
  const rows = f.slice((p - 1) * 10, p * 10);
  return (
    <>
      <div className="space-y-4">
        <PageHeader title="Inscrições Financiadas" sub="Pipeline de elegibilidade por turma e UFCD - não é o funil comercial Gold." action={<NewBtn label="+ Nova inscrição" onClick={() => setOpen("new")} />} />
        <div className="flex flex-wrap gap-2">
          {estados.map(e => (
            <button key={e} onClick={() => { setFiltro(e); setP(1); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${filtro === e ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
              {e}
              {e !== "Todas" && <span className="ml-1 opacity-70">{finInscricoesData.filter(x => x.estado === e).length}</span>}
            </button>
          ))}
        </div>
        <Card>
          <TableToolbar search={s} onSearch={v => { setS(v); setP(1); }} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr><Th>Id</Th><Th>Data</Th><Th>Candidato</Th><Th>UFCD</Th><Th>Turma</Th><Th>Dossier</Th><Th>Estado</Th><Th>Ações</Th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length === 0 && <EmptyState text="Nenhuma inscrição neste filtro." />}
                {rows.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <Td><span className="text-slate-400 font-mono text-xs">{r.id}</span></Td>
                    <Td className="font-mono text-xs text-slate-500 whitespace-nowrap">{r.inscrito}</Td>
                    <Td>
                      <button onClick={() => setOpen(r)} className="text-left">
                        <p className="text-xs font-medium text-blue-600">{r.nome} {r.apelido}</p>
                        <p className="text-xs text-slate-400">{r.email}</p>
                      </button>
                    </Td>
                    <Td>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-600 text-white">{r.ufcd}</span>
                      <p className="text-xs text-slate-400 mt-0.5 max-w-[140px] truncate">{r.curso}</p>
                    </Td>
                    <Td className="text-xs font-semibold text-slate-700 whitespace-nowrap">{r.turma}</Td>
                    <Td><DocPips docs={r.docs} /></Td>
                    <Td>{estadoBadge(r.estado)}</Td>
                    <Td><div className="flex gap-1"><ActBtn icon={I.eye} label="Abrir" onClick={() => setOpen(r)} /><ActBtn icon={I.edit} label="Editar" onClick={() => setOpen(r)} /></div></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TableFooter page={p} total={f.length} perPage={10} onChange={setP} />
        </Card>
        <p className="text-xs text-slate-400">Pontinhos do dossier: CC cartão de cidadão · CH certificado de habilitações · CU curriculum · CI IBAN · CE comprovativo de emprego. Sem dossier completo a turma não arranca.</p>
      </div>
      <SlideOver open={!!open} onClose={() => setOpen(null)}
        title={editing ? `${editing.nome} ${editing.apelido}` : "Nova inscrição financiada"}
        sub={editing ? `UFCD ${editing.ufcd} · ${editing.turma}` : "Candidatura a UFCD - não é o funil Gold"}>
        <div className="p-5 space-y-4">
          {!editing && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome"><input className={iCls} /></Field>
              <Field label="Apelido"><input className={iCls} /></Field>
              <Field label="Email"><input className={iCls} /></Field>
              <Field label="Telemóvel"><input className={iCls} /></Field>
            </div>
          )}
          <Field label="Curso / UFCD"><SearchSelect value={curso} onChange={v => { setCurso(v); setTurma(""); }} options={cursosFinOpts} placeholder="Pesquisar UFCD…" /></Field>
          <Field label="Turma"><SearchSelect value={turma} onChange={setTurma} options={turmaOpts} placeholder="Só turmas ativas…" empty="Não há turmas ativas para esta UFCD." allowEmpty /></Field>
          <TurmaInscricaoHint optsLen={turmaOpts.length} curso={curso || undefined} />
          <Field label="Estado">
            <select className={iCls} defaultValue={editing?.estado ?? "Recebida"}>
              {estados.filter(e => e !== "Todas").map(e => <option key={e}>{e}</option>)}
            </select>
          </Field>
          {editing && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Dossier de elegibilidade</p>
              <DocPips docs={editing.docs} />
            </div>
          )}
          <FormActions onClose={() => setOpen(null)} />
        </div>
      </SlideOver>
    </>
  );
}

export function BlogTematicasView() {
  const [s, setS] = useState("");
  const [filtro, setFiltro] = useState("Todos");
  const [open, setOpen] = useState<"new" | typeof blogTematicasData[number] | null>(null);
  const f = blogTematicasData.filter(x => `${x.nome} ${x.slug}`.toLowerCase().includes(s.toLowerCase()) && (filtro === "Todos" || x.estado === filtro));
  const editing = open && open !== "new" ? open : null;
  return (
    <>
      <div className="space-y-4">
        <PageHeader title="Temáticas do Blog" sub="Categorias dos artigos no site da ENA." action={<NewBtn label="+ Nova temática" onClick={() => setOpen("new")} />} />
        <FilterChips options={["Todos", "Ativo", "Inactivo"]} value={filtro} onChange={setFiltro} />
        <Card>
          <TableToolbar search={s} onSearch={setS} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr><Th>Id</Th><Th>Temática</Th><Th>Slug</Th><Th className="text-center">Posts</Th><Th>Estado</Th><Th>Ações</Th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {f.length === 0 && <EmptyState text="Nenhuma temática encontrada." />}
                {f.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <Td><span className="text-slate-400 font-mono text-xs">{r.id}</span></Td>
                    <Td className="text-sm font-medium text-slate-800">{r.nome}</Td>
                    <Td className="text-xs font-mono text-slate-500">/{r.slug}</Td>
                    <Td className="text-center text-xs font-semibold">{r.posts}</Td>
                    <Td>{estadoBadge(r.estado)}</Td>
                    <Td><div className="flex gap-1"><ActBtn icon={I.edit} label="Editar" onClick={() => setOpen(r)} /><ActBtn icon={I.trash} label="Eliminar" color="red" /></div></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      <SlideOver open={!!open} onClose={() => setOpen(null)} title={editing ? editing.nome : "Nova temática"}>
        <div className="p-5 space-y-3">
          <Field label="Nome"><input className={iCls} defaultValue={editing?.nome ?? ""} /></Field>
          <Field label="Slug"><input className={iCls} defaultValue={editing?.slug ?? ""} /></Field>
          <FormActions onClose={() => setOpen(null)} />
        </div>
      </SlideOver>
    </>
  );
}

const configCards = [
  { id: "entidade", titulo: "Entidade formadora", texto: "ENA - Escola de Negócios e Administração. NIF, certificação DGERT e dados de contacto.", campos: ["Designação: ENA", "NIF: 510 000 000", "Certificação DGERT: válida"] },
  { id: "formacao", titulo: "Formação", texto: "Prazos de arquivo, emissão de certificados e língua dos documentos.", campos: ["Arquivo DTP: 10 anos (IEFP)", "Certificados: NetForce / SIGO", "Unidade de gestão: turma"] },
  { id: "gold", titulo: "Gold / Autofinanciada", texto: "Preços, métodos de pagamento e regras do CCP.", campos: ["MB Way, Multibanco, cartão, transferência, PayPal", "Curso-bandeira: CCP", "DTP com extras IEFP (PIP, simulações)"] },
  { id: "fin", titulo: "Financiada", texto: "Elegibilidade, UFCD e documentos do financiador.", campos: ["Dossier: CC, CH, CV, IBAN, emprego", "Assiduidade em horas da UFCD", "Turma bloqueada sem dossier"] },
  { id: "emails", titulo: "Emails automáticos", texto: "Remetente, assinatura e regras ativas.", campos: ["Remetente: formacao@ena.pt", "Assinatura: Equipa ENA", "Regras ativas: 4"] },
  { id: "users", titulo: "Utilizadores", texto: "Acessos ao GesForma.", campos: ["Tania - Administradora", "Aguilar - Comercial Gold", "Secretariado - Financiada"] },
];

export function ConfiguracoesView() {
  const [open, setOpen] = useState<typeof configCards[number] | null>(null);
  return (
    <>
      <div className="space-y-4">
        <PageHeader title="Configurações" sub="Parâmetros da entidade - a ENA gere por turmas, não por ação de formação." />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {configCards.map(c => (
            <button key={c.id} onClick={() => setOpen(c)} className="text-left bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:border-amber-300 hover:shadow-md transition-all">
              <p className="text-sm font-bold text-slate-800">{c.titulo}</p>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">{c.texto}</p>
              <p className="text-xs font-semibold text-amber-600 mt-3">Abrir →</p>
            </button>
          ))}
        </div>
      </div>
      <SlideOver open={!!open} onClose={() => setOpen(null)} title={open?.titulo ?? ""} sub="Pré-visualização - valores de demonstração">
        {open && (
          <div className="p-5 space-y-3">
            <p className="text-sm text-slate-600">{open.texto}</p>
            <ul className="space-y-2">
              {open.campos.map(f => (
                <li key={f} className="text-sm bg-slate-50 rounded-lg px-3 py-2 text-slate-700">{f}</li>
              ))}
            </ul>
            <FormActions onClose={() => setOpen(null)} />
          </div>
        )}
      </SlideOver>
    </>
  );
}
