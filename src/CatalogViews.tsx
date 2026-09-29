import { useCallback, useEffect, useState } from "react";
import {
  AppModal, SearchSelect, ViewFilters, matchesFilter, uniqueOpts,
  cursosFinOpts, cursosGoldOpts, horariosOpts, locaisOpts,
} from "./FormKit";
import { TurmaInscricaoHint } from "./TurmaCronograma";
import { useTurmas } from "./TurmasContext";
import { turmaFinOpts } from "./turmaModel";
import { FichaFormando } from "./FormandoFicha";
import { ConteudoAbrirModal, type ConteudoPreview } from "./ActionSurfaces";
import { ConfirmDangerModal, EmptyHint, MobileCard, RowActions } from "./SecretaryUX";
import {
  apiMicrosoftDisconnect, apiMicrosoftLoginStatus, apiPutDriveConfig, apiPutMicrosoftConfig, apiPutWhatsappConfig,
  apiUploadDrive, apiWhatsappDesligar, apiWhatsappStatus, driveOAuthStartUrl,
  type MicrosoftStatus, type WhatsappStatus,
} from "./api";
import { useCatalogList, useCatalogs } from "./CatalogsContext";
import { OptionSelect } from "./OptionSelect";
import { useDrive } from "./DriveContext";
import type { FormandoTurma } from "./ListsContext";

type Accent = "gold" | "fin";
function accentBtn(a: Accent) {
  return a === "gold" ? "bg-amber-500 hover:bg-amber-600" : "bg-blue-600 hover:bg-blue-700";
}
function accentBox(a: Accent) {
  return a === "gold" ? "border-amber-200 bg-amber-50" : "border-blue-200 bg-blue-50";
}
function accentTitle(a: Accent) {
  return a === "gold" ? "text-amber-800" : "text-blue-800";
}
function accentText(a: Accent) {
  return a === "gold" ? "text-amber-700" : "text-blue-700";
}

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
  return <div className={`bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.05)] overflow-hidden ${className}`}>{children}</div>;
}
function PageHeader({ title, sub, action, kicker }: { title: string; sub?: string; action?: React.ReactNode; kicker?: string }) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
      <div className="min-w-0">
        {kicker && <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{kicker}</p>}
        <h1 className="text-[1.65rem] font-semibold tracking-tight text-slate-900 mt-0.5 leading-tight">{title}</h1>
        {sub && <p className="text-sm text-slate-500 mt-1.5 max-w-2xl leading-relaxed">{sub}</p>}
      </div>
      {action}
    </div>
  );
}
function CatalogKpis({ items }: { items: Array<{ label: string; value: string | number; sub?: string }> }) {
  if (!items.length) return null;
  return (
    <div className={`grid gap-2 ${items.length >= 4 ? "grid-cols-2 xl:grid-cols-4" : "grid-cols-2 sm:grid-cols-3"}`}>
      {items.map(k => (
        <div key={k.label} className="bg-white rounded-2xl border border-slate-200/80 px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{k.label}</p>
          <p className="mt-1 text-[1.35rem] font-semibold tabular-nums tracking-tight text-slate-900">{k.value}</p>
          {k.sub ? <p className="text-xs text-slate-500 mt-0.5">{k.sub}</p> : null}
        </div>
      ))}
    </div>
  );
}
function NewBtn({ label, onClick, accent = "gold" }: { label: string; onClick?: () => void; accent?: Accent }) {
  const text = label.replace(/^\+\s*/, "");
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1.5 px-4 py-2.5 ${accentBtn(accent)} text-white text-sm font-semibold rounded-xl transition-colors shadow-sm whitespace-nowrap`}>
      {I.plus}{text}
    </button>
  );
}
function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`text-left px-4 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-[0.08em] whitespace-nowrap bg-slate-50/90 backdrop-blur border-b border-slate-200 sticky top-0 z-10 ${className}`}>{children}</th>;
}
function Td({ children, className = "", onClick }: { children: React.ReactNode; className?: string; onClick?: (e: React.MouseEvent) => void }) {
  return <td className={`px-4 py-3 ${className}`} onClick={onClick}>{children}</td>;
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
function TableToolbar({ search, onSearch, count, noun = "registos" }: { search: string; onSearch: (v: string) => void; count?: number; noun?: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5 border-b border-slate-100 bg-gradient-to-b from-slate-50/80 to-white">
      <p className="text-xs text-slate-500">
        {count == null ? "Catálogo" : <><strong className="text-slate-800 tabular-nums">{count}</strong> {noun}</>}
      </p>
      <div className="relative w-full sm:w-72">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{I.search}</span>
        <input value={search} onChange={e => onSearch(e.target.value)} placeholder="Filtrar por nome, curso, local…" className="pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 w-full" />
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
      <p className="text-xs text-slate-500">A mostrar <strong className="text-slate-700">{from} a {to}</strong> de <strong className="text-slate-700">{total}</strong></p>
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
function SlideOver({ open, onClose, title, sub, children, size = "md" }: { open: boolean; onClose: () => void; title: string; sub?: string; children: React.ReactNode; size?: "sm" | "md" | "lg" | "xl" }) {
  return <AppModal open={open} onClose={onClose} title={title} sub={sub} size={size}>{children}</AppModal>;
}
function ApagarCatalogoModal({ nome, tipo, open, onClose, onConfirm }: {
  nome: string;
  tipo: string;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ConfirmDangerModal
      open={open}
      onClose={onClose}
      title={`Eliminar ${tipo}`}
      body={`${nome} sai do catálogo da ENA.`}
      risk="As turmas e fichas que já referem este registo mantêm o texto, mas deixa de estar disponível para escolher."
      onConfirm={onConfirm}
    />
  );
}

function EmptyState({ text }: { text: string }) {
  return <tr><td colSpan={12} className="px-4 py-12 text-center text-sm text-slate-400">{text}</td></tr>;
}
function nextId<T extends { id: number }>(_xs: T[]) {
  return -Date.now();
}

function FormActions({ onClose, onSave, disabled, label = "Guardar", accent = "gold" }: { onClose: () => void; onSave?: () => void; disabled?: boolean; label?: string; accent?: Accent }) {
  return (
    <div className="flex justify-end gap-2 pt-4 mt-1 border-t border-slate-100">
      <button type="button" onClick={onClose} className="px-4 py-2.5 bg-white border border-slate-200 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-50">Cancelar</button>
      <button type="button" onClick={onSave} disabled={disabled} className={`px-5 py-2.5 ${accentBtn(accent)} disabled:opacity-40 text-white text-sm font-semibold rounded-lg`}>{label}</button>
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

const horariosGoldData = [
  { id: 71, nome: "Laboral manhã", descricao: "Dias úteis de manhã", status: "Ativo" },
  { id: 72, nome: "Laboral tarde", descricao: "Dias úteis de tarde", status: "Ativo" },
  { id: 73, nome: "Pós-Laboral", descricao: "Dias úteis ao fim do dia", status: "Ativo" },
  { id: 74, nome: "Sábado manhã", descricao: "Sábados de manhã", status: "Ativo" },
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

type ConteudoRow = {
  id: number; titulo: string; tipo: string; curso: string; modulo: string;
  tamanho: string; estado: string; origem?: string; driveFileId?: string; driveUrl?: string;
};

const conteudosData: ConteudoRow[] = [
  { id: 11, titulo: "Manual CCP - Módulo 1 (Aprendizagem)", tipo: "PDF", curso: "Formação de Formadores - CCP", modulo: "M1", tamanho: "2,4 MB", estado: "Ativo" },
  { id: 12, titulo: "Vídeo: comunicação em sala", tipo: "Vídeo", curso: "Formação de Formadores - CCP", modulo: "M2", tamanho: "18 min", estado: "Ativo" },
  { id: 13, titulo: "Grelha de observação da simulação", tipo: "PDF", curso: "Formação de Formadores - CCP", modulo: "M4", tamanho: "180 KB", estado: "Ativo" },
  { id: 14, titulo: "Plataforma Moodle CCP", tipo: "Link", curso: "Formação de Formadores - CCP", modulo: "M5", tamanho: "-", estado: "Ativo" },
  { id: 15, titulo: "Ficha de avaliação final", tipo: "PDF", curso: "Formação de Formadores - CCP", modulo: "M3", tamanho: "92 KB", estado: "Ativo" },
  { id: 16, titulo: "Exercícios Excel avançado", tipo: "PDF", curso: "Excel do Básico ao Avançado", modulo: "EX1", tamanho: "1,1 MB", estado: "Inactivo" },
];

const modulosFinData = [
  { id: 101, codigo: "U1", nome: "Avaliação primária da vítima", horas: 8, curso: "Primeiros Socorros", tipo: "Teórico-prático", estado: "Ativo" },
  { id: 102, codigo: "U2", nome: "Suporte básico de vida", horas: 10, curso: "Primeiros Socorros", tipo: "Prático", estado: "Ativo" },
  { id: 103, codigo: "U3", nome: "Emergências mais frequentes", horas: 7, curso: "Primeiros Socorros", tipo: "Teórico-prático", estado: "Ativo" },
  { id: 104, codigo: "R1", nome: "Plataformas e formatos", horas: 8, curso: "Publicidade nas Redes Sociais", tipo: "Teórico", estado: "Ativo" },
  { id: 105, codigo: "R2", nome: "Campanhas pagas", horas: 10, curso: "Publicidade nas Redes Sociais", tipo: "Prático", estado: "Ativo" },
  { id: 106, codigo: "R3", nome: "Métricas e relatórios", horas: 7, curso: "Publicidade nas Redes Sociais", tipo: "Teórico-prático", estado: "Ativo" },
  { id: 107, codigo: "C1", nome: "Ameaça e risco", horas: 8, curso: "Fundamentos de cibersegurança", tipo: "Teórico", estado: "Ativo" },
  { id: 108, codigo: "C2", nome: "Boas práticas do utilizador", horas: 9, curso: "Fundamentos de cibersegurança", tipo: "Prático", estado: "Ativo" },
  { id: 109, codigo: "C3", nome: "Resposta a incidentes", horas: 8, curso: "Fundamentos de cibersegurança", tipo: "Teórico-prático", estado: "Ativo" },
  { id: 110, codigo: "P1", nome: "Métodos ativos", horas: 12, curso: "Métodos e Técnicas Pedagógicas Ativos", tipo: "Teórico-prático", estado: "Ativo" },
  { id: 111, codigo: "P2", nome: "Dinâmicas de grupo", horas: 13, curso: "Métodos e Técnicas Pedagógicas Ativos", tipo: "Prático", estado: "Ativo" },
];

const conteudosFinData: ConteudoRow[] = [
  { id: 201, titulo: "Manual UFCD 3564 - Primeiros Socorros", tipo: "PDF", curso: "Primeiros Socorros", modulo: "U1", tamanho: "1,8 MB", estado: "Ativo" },
  { id: 202, titulo: "Vídeo: SBV no adulto", tipo: "Vídeo", curso: "Primeiros Socorros", modulo: "U2", tamanho: "14 min", estado: "Ativo" },
  { id: 203, titulo: "Grelha de observação prática", tipo: "PDF", curso: "Primeiros Socorros", modulo: "U2", tamanho: "210 KB", estado: "Ativo" },
  { id: 204, titulo: "Moodle UFCD 10785", tipo: "Link", curso: "Publicidade nas Redes Sociais", modulo: "R1", tamanho: "-", estado: "Ativo" },
  { id: 205, titulo: "Guia de campanhas Meta", tipo: "PDF", curso: "Publicidade nas Redes Sociais", modulo: "R2", tamanho: "890 KB", estado: "Ativo" },
  { id: 206, titulo: "Checklist de higiene digital", tipo: "PDF", curso: "Fundamentos de cibersegurança", modulo: "C2", tamanho: "140 KB", estado: "Ativo" },
];

const datasFinData = [
  { id: 301, inicio: "2026-08-27", fim: "2026-09-24", horario: "Pós Laboral", preco: 0, local: "Sala Virtual", curso: "Primeiros Socorros", status: "Ativo", link: "ena.pt/ufcd/3564-t1" },
  { id: 302, inicio: "2026-09-08", fim: "2026-10-06", horario: "Sábado manhã", preco: 0, local: "Sala Virtual", curso: "Publicidade nas Redes Sociais", status: "Ativo", link: "ena.pt/ufcd/10785-sm" },
  { id: 303, inicio: "2026-09-15", fim: "2026-10-13", horario: "Pós Laboral", preco: 0, local: "Sala Virtual", curso: "Fundamentos de cibersegurança", status: "Ativo", link: "ena.pt/ufcd/9188-pl" },
  { id: 304, inicio: "2026-10-01", fim: "2026-10-29", horario: "Laboral Manhã", preco: 0, local: "V.N.Gaia", curso: "Métodos e Técnicas Pedagógicas Ativos", status: "Ativo", link: "ena.pt/ufcd/10394-vng" },
  { id: 305, inicio: "2026-07-02", fim: "2026-07-30", horario: "Pós Laboral", preco: 0, local: "Sala Virtual", curso: "Primeiros Socorros", status: "Inactivo", link: "ena.pt/ufcd/3564-jul" },
];

const locaisFinData = [
  { id: 41, nome: "Sala Virtual", morada: "Moodle + Zoom ENA · turmas financiadas", salas: 0, turmas: 6, status: "Ativo" },
  { id: 42, nome: "V.N.Gaia", morada: "Rua da Formação 12, 4400-000 V.N. Gaia", salas: 2, turmas: 1, status: "Ativo" },
  { id: 43, nome: "Centro de emprego Gaia", morada: "Polo IEFP · encaminhamento de candidatos", salas: 1, turmas: 0, status: "Ativo" },
  { id: 44, nome: "Braga", morada: "Av. da Liberdade 210, 4710 Braga", salas: 1, turmas: 0, status: "Ativo" },
];

const areasFinData = [
  { id: 61, nome: "Saúde e segurança", cursos: 2, estado: "Ativo" },
  { id: 62, nome: "Marketing digital", cursos: 1, estado: "Ativo" },
  { id: 63, nome: "Cibersegurança", cursos: 1, estado: "Ativo" },
  { id: 64, nome: "Pedagogia e formação", cursos: 1, estado: "Ativo" },
];

function nextCodigoModulo(lista: Array<{ codigo: string; curso: string }>, curso: string, accent: Accent = "gold") {
  const mesmos = lista.filter(m => m.curso === curso);
  const prefix = accent === "fin"
    ? (curso.includes("Publicidade") ? "R" : curso.includes("ciber") ? "C" : curso.includes("Métodos") ? "P" : "U")
    : (curso.includes("Excel") ? "EX" : curso.includes("Comunicar") ? "AV" : "M");
  const nums = mesmos.map(m => Number((m.codigo.match(/\d+/) || ["0"])[0])).filter(n => !Number.isNaN(n));
  return `${prefix}${(nums.length ? Math.max(...nums) : 0) + 1}`;
}

function labelModulo(codigo: string, curso?: string, catalog: typeof modulosData = modulosData) {
  const m = catalog.find(x => x.codigo === codigo && (!curso || x.curso === curso));
  return m ? `${m.codigo} · ${m.nome}` : codigo;
}

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

function asFichaAvulso(r: typeof formandosGoldData[number]): FormandoTurma {
  return { ...r, turma: "Sem turma", turmaId: 0 };
}

export function FormandosGoldView({ openId, onOpened }: { openId?: number; onOpened?: () => void } = {}) {
  const [lista, setLista] = useCatalogList("formandos_avulso", "gold", formandosGoldData);
  const [s, setS] = useState(""); const [p, setP] = useState(1);
  const [filtro, setFiltro] = useState("Todos");
  const [filtroCurso, setFiltroCurso] = useState("");
  const [filtroLocal, setFiltroLocal] = useState("");
  const [open, setOpen] = useState<"new" | typeof formandosGoldData[number] | null>(null);
  const [ficha, setFicha] = useState<typeof formandosGoldData[number] | null>(null);
  const [apagar, setApagar] = useState<typeof formandosGoldData[number] | null>(null);
  const [curso, setCurso] = useState("");
  const [nome, setNome] = useState("");
  const [apelido, setApelido] = useState("");
  const [email, setEmail] = useState("");
  const [telf, setTelf] = useState("");
  const [valor, setValor] = useState("0");
  useEffect(() => {
    if (!openId) return;
    const row = lista.find(x => x.id === openId);
    if (!row) return;
    setFicha(row);
    onOpened?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, lista]);
  const f = lista.filter(x => {
    const q = `${x.nome} ${x.apelido} ${x.curso} ${x.email}`.toLowerCase().includes(s.toLowerCase());
    return q && matchesFilter(x.curso, filtroCurso) && matchesFilter(x.local, filtroLocal) && (filtro === "Todos" || x.estado === filtro);
  });
  const rows = f.slice((p - 1) * 10, p * 10);
  const editing = open && open !== "new" ? open : null;
  useEffect(() => {
    if (!open) return;
    setCurso(editing?.curso ?? "");
    setNome(editing?.nome ?? "");
    setApelido(editing?.apelido ?? "");
    setEmail(editing?.email ?? "");
    setTelf(editing?.telf ?? "");
    setValor(String(editing?.valor ?? 0));
  }, [open, editing]);
  function guardar() {
    if (!nome.trim() || !curso) return;
    const row = {
      id: editing?.id ?? nextId(lista),
      nome: nome.trim(), apelido: apelido.trim(), email: email.trim(), telf: telf.trim(),
      curso, local: "E-learning", inscrito: editing?.inscrito ?? new Date().toISOString().slice(0, 10),
      pago: Number(valor) > 0, valor: Number(valor) || 0, metodo: editing?.metodo ?? "MB Way", estado: "Ativo",
    };
    if (editing) setLista(xs => xs.map(x => x.id === editing.id ? row : x));
    else setLista(xs => [row, ...xs]);
    setOpen(null);
  }
  return (
    <>
      <div className="space-y-4">
        <PageHeader title="Formandos Gold" kicker="Catálogo Gold" sub="Formandos individuais - sem turma atribuída. Cursos e-learning e vendas avulso." action={<NewBtn label="+ Novo formando" onClick={() => setOpen("new")} />} />
        <ViewFilters
          fields={[
            { label: "Curso", value: filtroCurso, onChange: v => { setFiltroCurso(v); setP(1); }, options: uniqueOpts(lista.map(x => x.curso)) },
            { label: "Local", value: filtroLocal, onChange: v => { setFiltroLocal(v); setP(1); }, options: uniqueOpts(lista.map(x => x.local)) },
          ]}
          chips={{ options: ["Todos", "Ativo", "Pendente"], value: filtro, onChange: v => { setFiltro(v); setP(1); } }}
          onClear={() => { setFiltroCurso(""); setFiltroLocal(""); setFiltro("Todos"); setP(1); }}
        />
        <Card>
          <TableToolbar search={s} onSearch={v => { setS(v); setP(1); }} count={f.length} noun="formandos" />
          {rows.length === 0 && (
            <EmptyHint
              text={lista.length === 0 ? "Ainda sem formandos avulso. Use para e-learning e vendas sem turma." : "Nenhum formando Gold individual corresponde à pesquisa."}
              action={lista.length === 0 ? "Novo formando" : "Limpar filtros"}
              onAction={lista.length === 0 ? () => setOpen("new") : () => { setFiltroCurso(""); setFiltroLocal(""); setFiltro("Todos"); setS(""); setP(1); }}
            />
          )}
          <div className="md:hidden p-3 space-y-2">
            {rows.map(r => (
              <MobileCard
                key={r.id}
                title={`${r.nome} ${r.apelido}`}
                sub={r.curso}
                badge={estadoBadge(r.estado)}
                meta={[r.local, `€ ${r.valor}`, r.inscrito]}
                onOpen={() => setFicha(r)}
                actions={[
                  { label: "Ficha", icon: I.eye, onClick: () => setFicha(r) },
                  { label: "Editar", icon: I.edit, onClick: () => setOpen(r) },
                  { label: "Eliminar", icon: I.trash, tone: "red", onClick: () => setApagar(r) },
                ]}
              />
            ))}
          </div>
          <div className="hidden md:block overflow-auto max-h-[min(70vh,640px)]">
            <table className="w-full text-sm">
              <thead><tr><Th>Nome</Th><Th>Curso</Th><Th>Local</Th><Th>Inscrito</Th><Th>Valor</Th><Th>Estado</Th><Th>Ações</Th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/80 cursor-pointer" onClick={() => setFicha(r)}>
                    <Td>
                      <button type="button" onClick={() => setFicha(r)} className="text-left">
                        <p className="text-xs font-medium text-blue-600 hover:text-blue-800">{r.nome} {r.apelido}</p>
                        <p className="text-xs text-slate-400 truncate max-w-[160px]">{r.email}</p>
                      </button>
                    </Td>
                    <Td className="text-xs text-slate-600 max-w-[180px]">{r.curso}</Td>
                    <Td className="text-xs text-slate-600 whitespace-nowrap">{r.local}</Td>
                    <Td className="font-mono text-xs text-slate-500">{r.inscrito}</Td>
                    <Td className="text-xs font-bold text-amber-600">€ {r.valor}</Td>
                    <Td>{estadoBadge(r.estado)}</Td>
                    <Td>
                      <RowActions actions={[
                        { label: "Ficha", icon: I.eye, onClick: () => setFicha(r) },
                        { label: "Editar", icon: I.edit, onClick: () => setOpen(r) },
                        { label: "Eliminar", icon: I.trash, tone: "red", onClick: () => setApagar(r) },
                      ]} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TableFooter page={p} total={f.length} perPage={10} onChange={setP} />
        </Card>
      </div>
      <ConfirmDangerModal
        open={!!apagar}
        onClose={() => setApagar(null)}
        title="Eliminar formando Gold"
        body={apagar ? `Remover ${apagar.nome} ${apagar.apelido} da lista avulso?` : ""}
        risk="A venda individual sai da lista. Esta acção não se desfaz."
        onConfirm={() => { if (apagar) setLista(xs => xs.filter(x => x.id !== apagar.id)); }}
      />
      <SlideOver open={!!ficha} onClose={() => setFicha(null)} title="Ficha do Formando" sub={ficha ? `#${ficha.id} · venda avulso` : ""} size="lg">
        {ficha && <FichaFormando formando={asFichaAvulso(ficha)} onClose={() => setFicha(null)} avulso />}
      </SlideOver>
      <SlideOver open={!!open} onClose={() => setOpen(null)} title={editing ? `${editing.nome} ${editing.apelido}` : "Novo formando Gold"} sub={editing ? `#${editing.id} · sem turma` : "Venda individual, fora de turma"}>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome"><input className={iCls} value={nome} onChange={e => setNome(e.target.value)} /></Field>
            <Field label="Apelido"><input className={iCls} value={apelido} onChange={e => setApelido(e.target.value)} /></Field>
          </div>
          <Field label="Email"><input className={iCls} value={email} onChange={e => setEmail(e.target.value)} /></Field>
          <Field label="Telemóvel"><input className={iCls} value={telf} onChange={e => setTelf(e.target.value)} /></Field>
          <Field label="Curso"><SearchSelect value={curso} onChange={setCurso} options={cursosGoldOpts} placeholder="Pesquisar curso…" /></Field>
          <Field label="Valor (€)"><input className={iCls} type="number" value={valor} onChange={e => setValor(e.target.value)} /></Field>
          <FormActions onClose={() => setOpen(null)} onSave={guardar} disabled={!nome.trim() || !curso} label={editing ? "Guardar" : "Criar formando"} />
        </div>
      </SlideOver>
    </>
  );
}

export function DatasGoldView() {
  return <DatasCatalogView accent="gold" />;
}
export function DatasFinView() {
  return <DatasCatalogView accent="fin" />;
}

function DatasCatalogView({ accent }: { accent: Accent }) {
  const seed = accent === "gold" ? datasGoldData : datasFinData;
  const cursosOpts = accent === "gold" ? cursosGoldOpts : cursosFinOpts;
  const [lista, setLista] = useCatalogList("datas", accent, seed);
  const [apagar, setApagar] = useState<typeof lista[number] | null>(null);
  const [s, setS] = useState(""); const [p, setP] = useState(1);
  const [filtro, setFiltro] = useState("Todos");
  const [filtroCurso, setFiltroCurso] = useState("");
  const [filtroLocal, setFiltroLocal] = useState("");
  const [open, setOpen] = useState<"new" | typeof datasGoldData[number] | null>(null);
  const [curso, setCurso] = useState("");
  const [local, setLocal] = useState("");
  const [horario, setHorario] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [preco, setPreco] = useState("125");
  const [link, setLink] = useState("");
  const f = lista.filter(x => {
    const q = `${x.curso} ${x.local} ${x.horario}`.toLowerCase().includes(s.toLowerCase());
    return q && matchesFilter(x.curso, filtroCurso) && matchesFilter(x.local, filtroLocal) && (filtro === "Todos" || x.status === filtro);
  });
  const rows = f.slice((p - 1) * 10, p * 10);
  const editing = open && open !== "new" ? open : null;
  useEffect(() => {
    if (!open) return;
    setCurso(editing?.curso ?? (accent === "gold" ? "Formação de Formadores - CCP" : "Primeiros Socorros"));
    setLocal(editing?.local ?? "");
    setHorario(editing?.horario ?? "");
    setInicio(editing?.inicio ?? "");
    setFim(editing?.fim ?? "");
    setPreco(String(editing?.preco ?? 125));
    setLink(editing?.link ?? "");
  }, [open, editing]);
  function guardar() {
    if (!curso || !inicio) return;
    const row = {
      id: editing?.id ?? nextId(lista),
      inicio, fim, horario, preco: Number(preco) || 0, local, curso, status: "Ativo",
      link: link.trim() || `ena.pt/${curso.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24)}`,
    };
    if (editing) setLista(xs => xs.map(x => x.id === editing.id ? row : x));
    else setLista(xs => [row, ...xs]);
    setOpen(null);
  }
  return (
    <>
      <div className="space-y-4">
        <PageHeader
          kicker={accent === "gold" ? "Catálogo Gold" : "Catálogo Financiada"}
          title={accent === "gold" ? "Datas / Edições" : "Datas / Edições"}
          sub={accent === "gold" ? "Calendário comercial de referência. A pré-inscrição e o WhatsApp não leem estas datas: só uma turma Gold libertada (curso + local + horário + data) fica visível." : "Calendário das UFCD: início, fim, horário e local. Sem preço - a edição é financiada."}
          action={<NewBtn accent={accent} label="+ Nova data" onClick={() => setOpen("new")} />}
        />
        <CatalogKpis items={[
          { label: "Edições", value: lista.length },
          { label: "Activas", value: lista.filter(x => x.status === "Ativo").length },
          { label: "Locais", value: uniqueOpts(lista.map(x => x.local)).length },
          { label: accent === "gold" ? "Preço médio" : "UFCD", value: accent === "gold" ? `€ ${Math.round(lista.reduce((a, x) => a + x.preco, 0) / Math.max(1, lista.length))}` : uniqueOpts(lista.map(x => x.curso)).length },
        ]} />
        <ViewFilters
          accent={accent}
          fields={[
            { label: accent === "gold" ? "Curso" : "Curso / UFCD", value: filtroCurso, onChange: v => { setFiltroCurso(v); setP(1); }, options: uniqueOpts(lista.map(x => x.curso)) },
            { label: "Local", value: filtroLocal, onChange: v => { setFiltroLocal(v); setP(1); }, options: uniqueOpts(lista.map(x => x.local)) },
          ]}
          chips={{ options: ["Todos", "Ativo", "Inactivo"], value: filtro, onChange: v => { setFiltro(v); setP(1); } }}
          onClear={() => { setFiltroCurso(""); setFiltroLocal(""); setFiltro("Todos"); setP(1); }}
        />
        <Card>
          <TableToolbar search={s} onSearch={v => { setS(v); setP(1); }} count={f.length} noun="edições" />
          <div className="md:hidden p-3 space-y-2">
            {rows.map(r => (
              <MobileCard
                key={r.id}
                title={r.curso}
                sub={`${r.local} · ${r.horario}`}
                badge={estadoBadge(r.status)}
                meta={[r.inicio, r.fim, accent === "gold" ? `€ ${r.preco}` : "Financiado"]}
                onOpen={() => setOpen(r)}
                actions={[
                  { label: "Editar", icon: I.edit, onClick: () => setOpen(r) },
                  { label: "Eliminar", icon: I.trash, tone: "red", onClick: () => setApagar(r) },
                ]}
              />
            ))}
          </div>
          <div className="hidden md:block overflow-x-auto max-h-[min(70vh,640px)]">
            <table className="w-full text-sm">
              <thead><tr><Th>Início</Th><Th>Fim</Th><Th>Horário</Th><Th>Local</Th><Th>Curso</Th><Th>{accent === "gold" ? "Preço" : "Regime"}</Th><Th>Inscrição</Th><Th>Estado</Th><Th>Ações</Th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length === 0 && <EmptyState text="Nenhuma edição corresponde à pesquisa." />}
                {rows.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/80 cursor-pointer" onClick={() => setOpen(r)}>
                    <Td className="font-mono text-xs text-slate-500 whitespace-nowrap">{r.inicio}</Td>
                    <Td className="font-mono text-xs text-slate-500 whitespace-nowrap">{r.fim}</Td>
                    <Td className="text-xs text-slate-600 whitespace-nowrap">{r.horario}</Td>
                    <Td className="text-xs text-slate-600 whitespace-nowrap">{r.local}</Td>
                    <Td className="text-sm font-medium text-slate-800 max-w-[200px]">{r.curso}</Td>
                    <Td className={`text-xs font-semibold ${accent === "gold" ? "text-amber-700" : "text-blue-700"}`}>{accent === "gold" ? `€ ${r.preco}` : "Financiado"}</Td>
                    <Td>
                      <a href={`https://${r.link}`} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline" onClick={e => e.preventDefault()}>{I.link} Link</a>
                    </Td>
                    <Td>{estadoBadge(r.status)}</Td>
                    <Td onClick={e => e.stopPropagation()}><div className="flex gap-1"><ActBtn icon={I.edit} label="Editar" onClick={() => setOpen(r)} /><ActBtn icon={I.trash} label="Eliminar" color="red" onClick={() => setApagar(r)} /></div></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TableFooter page={p} total={f.length} perPage={10} onChange={setP} />
        </Card>
      </div>
      <SlideOver open={!!open} onClose={() => setOpen(null)} title={editing ? `Edição #${editing.id}` : "Nova data / edição"} sub={accent === "gold" ? "Define o calendário comercial da turma" : "Define o calendário da UFCD"}>
        <div className="p-5 space-y-3">
          <Field label={accent === "gold" ? "Curso" : "Curso / UFCD"}><SearchSelect value={curso} onChange={setCurso} options={cursosOpts} placeholder={accent === "gold" ? "Pesquisar curso…" : "Pesquisar UFCD…"} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Início"><input type="date" className={iCls} value={inicio} onChange={e => setInicio(e.target.value)} /></Field>
            <Field label="Fim"><input type="date" className={iCls} value={fim} onChange={e => setFim(e.target.value)} /></Field>
          </div>
          <Field label="Horário"><SearchSelect value={horario} onChange={setHorario} options={horariosOpts} /></Field>
          <Field label="Local"><SearchSelect value={local} onChange={setLocal} options={locaisOpts} placeholder="Pesquisar local…" /></Field>
          {accent === "gold" && <Field label="Preço (€)"><input type="number" className={iCls} value={preco} onChange={e => setPreco(e.target.value)} /></Field>}
          <Field label="Link de inscrição"><input className={iCls} value={link} onChange={e => setLink(e.target.value)} /></Field>
          <FormActions accent={accent} onClose={() => setOpen(null)} onSave={guardar} disabled={!curso || !inicio} label={editing ? "Guardar" : "Criar edição"} />
        </div>
      </SlideOver>
      <ApagarCatalogoModal
        tipo="edição"
        nome={apagar?.curso ?? ""}
        open={!!apagar}
        onClose={() => setApagar(null)}
        onConfirm={() => { if (apagar) setLista(xs => xs.filter(x => x.id !== apagar.id)); }}
      />
    </>
  );
}

export function LocaisView() {
  return <LocaisCatalogView accent="gold" />;
}
export function LocaisFinView() {
  return <LocaisCatalogView accent="fin" />;
}

export function HorariosGoldView() {
  const [lista, setLista] = useCatalogList("horarios", "gold", horariosGoldData);
  const [apagar, setApagar] = useState<typeof lista[number] | null>(null);
  const [s, setS] = useState("");
  const [open, setOpen] = useState<"new" | typeof horariosGoldData[number] | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const f = lista.filter(x => `${x.nome} ${x.descricao}`.toLowerCase().includes(s.toLowerCase()));
  const editing = open && open !== "new" ? open : null;
  useEffect(() => {
    if (!open) return;
    setNome(editing?.nome ?? "");
    setDescricao(editing?.descricao ?? "");
  }, [open, editing]);
  function guardar() {
    if (!nome.trim()) return;
    const row = { id: editing?.id ?? nextId(lista), nome: nome.trim(), descricao: descricao.trim(), status: "Ativo" };
    if (editing) setLista(xs => xs.map(x => x.id === editing.id ? row : x));
    else setLista(xs => [row, ...xs]);
    setOpen(null);
  }
  return (
    <>
      <div className="space-y-4">
        <PageHeader
          kicker="Catálogo Gold"
          title="Horários"
          sub="Tipos de horário da plataforma (laboral manhã/tarde, pós-laboral, sábado…). A pré-inscrição só mostra os que estão numa turma Gold activa daquele curso e local."
          action={<NewBtn label="+ Novo horário" onClick={() => setOpen("new")} />}
        />
        <CatalogKpis items={[
          { label: "Horários", value: lista.length },
          { label: "Activos", value: lista.filter(x => x.status === "Ativo").length },
        ]} />
        <Card>
          <TableToolbar search={s} onSearch={setS} count={f.length} noun="horários" />
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <Th>Nome</Th><Th>Descrição</Th><Th>Estado</Th><Th>Ações</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {f.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-sm text-slate-500 text-center">Ainda sem horários. Crie os tipos (laboral, pós-laboral, sábado…) - a pré-inscrição só mostra os que estão numa turma Gold libertada.</td></tr>
                )}
                {f.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/80 cursor-pointer" onClick={() => setOpen(r)}>
                    <Td className="text-sm font-semibold text-slate-900">{r.nome}</Td>
                    <Td className="text-xs text-slate-500">{r.descricao}</Td>
                    <Td>{estadoBadge(r.status)}</Td>
                    <Td onClick={e => e.stopPropagation()}><div className="flex gap-1"><ActBtn icon={I.edit} label="Editar" onClick={() => setOpen(r)} /><ActBtn icon={I.trash} label="Eliminar" color="red" onClick={() => setApagar(r)} /></div></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      <SlideOver open={!!open} onClose={() => setOpen(null)} title={editing ? editing.nome : "Novo horário"}>
        <div className="p-5 space-y-3">
          <Field label="Nome"><input className={iCls} value={nome} onChange={e => setNome(e.target.value)} placeholder="Laboral tarde" /></Field>
          <Field label="Descrição"><input className={iCls} value={descricao} onChange={e => setDescricao(e.target.value)} /></Field>
          <FormActions onClose={() => setOpen(null)} onSave={guardar} disabled={!nome.trim()} label={editing ? "Guardar" : "Criar horário"} />
        </div>
      </SlideOver>
      <ApagarCatalogoModal
        tipo="horário"
        nome={apagar?.nome ?? ""}
        open={!!apagar}
        onClose={() => setApagar(null)}
        onConfirm={() => { if (apagar) setLista(xs => xs.filter(x => x.id !== apagar.id)); }}
      />
    </>
  );
}

function LocaisCatalogView({ accent }: { accent: Accent }) {
  const [lista, setLista] = useCatalogList("locais", accent, accent === "gold" ? locaisData : locaisFinData);
  const [apagar, setApagar] = useState<typeof lista[number] | null>(null);
  const [s, setS] = useState("");
  const [filtro, setFiltro] = useState("Todos");
  const [open, setOpen] = useState<"new" | typeof locaisData[number] | null>(null);
  const [nome, setNome] = useState("");
  const [morada, setMorada] = useState("");
  const [salas, setSalas] = useState("1");
  const f = lista.filter(x => {
    const q = `${x.nome} ${x.morada}`.toLowerCase().includes(s.toLowerCase());
    return q && (filtro === "Todos" || x.status === filtro);
  });
  const editing = open && open !== "new" ? open : null;
  useEffect(() => {
    if (!open) return;
    setNome(editing?.nome ?? "");
    setMorada(editing?.morada ?? "");
    setSalas(String(editing?.salas ?? 1));
  }, [open, editing]);
  function guardar() {
    if (!nome.trim()) return;
    const row = { id: editing?.id ?? nextId(lista), nome: nome.trim(), morada: morada.trim(), salas: Number(salas) || 0, turmas: editing?.turmas ?? 0, status: "Ativo" };
    if (editing) setLista(xs => xs.map(x => x.id === editing.id ? row : x));
    else setLista(xs => [row, ...xs]);
    setOpen(null);
  }
  return (
    <>
      <div className="space-y-4">
        <PageHeader kicker={accent === "gold" ? "Catálogo Gold" : "Catálogo Financiada"} title="Locais" sub={accent === "gold" ? "Polos pré-configurados. Na pré-inscrição o local só aparece se existir uma turma Gold libertada daquele curso nesse polo (com horário e data)." : "Salas e polos das turmas financiadas - quase tudo em sala virtual."} action={<NewBtn accent={accent} label="+ Novo local" onClick={() => setOpen("new")} />} />
        <CatalogKpis items={[
          { label: "Polos", value: lista.length },
          { label: "Activos", value: lista.filter(x => x.status === "Ativo").length },
          { label: "Salas", value: lista.reduce((a, x) => a + x.salas, 0) },
          { label: "Turmas", value: lista.reduce((a, x) => a + x.turmas, 0) },
        ]} />
        <ViewFilters accent={accent} chips={{ options: ["Todos", "Ativo", "Inactivo"], value: filtro, onChange: setFiltro }} onClear={() => setFiltro("Todos")} />
        <Card>
          <TableToolbar search={s} onSearch={setS} count={f.length} noun="locais" />
          <div className="md:hidden p-3 space-y-2">
            {f.map(r => (
              <MobileCard
                key={r.id}
                title={r.nome}
                sub={r.morada}
                badge={estadoBadge(r.status)}
                meta={[`${r.salas || 0} salas`, `${r.turmas} turmas`]}
                onOpen={() => setOpen(r)}
                actions={[
                  { label: "Editar", icon: I.edit, onClick: () => setOpen(r) },
                  { label: "Eliminar", icon: I.trash, tone: "red", onClick: () => setApagar(r) },
                ]}
              />
            ))}
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr><Th>Local</Th><Th>Morada / plataforma</Th><Th className="text-center">Salas</Th><Th className="text-center">Turmas</Th><Th>Estado</Th><Th>Ações</Th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {f.length === 0 && <EmptyState text="Nenhum local encontrado." />}
                {f.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/80 cursor-pointer" onClick={() => setOpen(r)}>
                    <Td className="text-sm font-semibold text-slate-900">{r.nome}</Td>
                    <Td className="text-xs text-slate-500 max-w-[280px] leading-relaxed">{r.morada}</Td>
                    <Td className="text-center text-xs text-slate-600">{r.salas || "-"}</Td>
                    <Td className="text-center text-sm font-semibold text-slate-800 tabular-nums">{r.turmas}</Td>
                    <Td>{estadoBadge(r.status)}</Td>
                    <Td onClick={e => e.stopPropagation()}><div className="flex gap-1"><ActBtn icon={I.edit} label="Editar" onClick={() => setOpen(r)} /><ActBtn icon={I.trash} label="Eliminar" color="red" onClick={() => setApagar(r)} /></div></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      <SlideOver open={!!open} onClose={() => setOpen(null)} title={editing ? editing.nome : "Novo local"}>
        <div className="p-5 space-y-3">
          <Field label="Nome"><input className={iCls} value={nome} onChange={e => setNome(e.target.value)} /></Field>
          <Field label="Morada"><input className={iCls} value={morada} onChange={e => setMorada(e.target.value)} /></Field>
          <Field label="Salas"><input type="number" className={iCls} value={salas} onChange={e => setSalas(e.target.value)} /></Field>
          <FormActions accent={accent} onClose={() => setOpen(null)} onSave={guardar} disabled={!nome.trim()} label={editing ? "Guardar" : "Criar local"} />
        </div>
      </SlideOver>
      <ApagarCatalogoModal
        tipo="local"
        nome={apagar?.nome ?? ""}
        open={!!apagar}
        onClose={() => setApagar(null)}
        onConfirm={() => { if (apagar) setLista(xs => xs.filter(x => x.id !== apagar.id)); }}
      />
    </>
  );
}

export function AreasTematicasView() {
  return <AreasCatalogView accent="gold" />;
}
export function AreasTematicasFinView() {
  return <AreasCatalogView accent="fin" />;
}

function AreasCatalogView({ accent }: { accent: Accent }) {
  const [lista, setLista] = useCatalogList("areas", accent, accent === "gold" ? areasTematicasData : areasFinData);
  const [apagar, setApagar] = useState<typeof lista[number] | null>(null);
  const [s, setS] = useState("");
  const [filtro, setFiltro] = useState("Todos");
  const [open, setOpen] = useState<"new" | typeof areasTematicasData[number] | null>(null);
  const [nome, setNome] = useState("");
  const f = lista.filter(x => x.nome.toLowerCase().includes(s.toLowerCase()) && (filtro === "Todos" || x.estado === filtro));
  const editing = open && open !== "new" ? open : null;
  useEffect(() => { if (open) setNome(editing?.nome ?? ""); }, [open, editing]);
  function guardar() {
    if (!nome.trim()) return;
    const row = { id: editing?.id ?? nextId(lista), nome: nome.trim(), cursos: editing?.cursos ?? 0, estado: "Ativo" };
    if (editing) setLista(xs => xs.map(x => x.id === editing.id ? row : x));
    else setLista(xs => [row, ...xs]);
    setOpen(null);
  }
  return (
    <>
      <div className="space-y-4">
        <PageHeader kicker={accent === "gold" ? "Catálogo Gold" : "Catálogo Financiada"} title="Áreas temáticas" sub={accent === "gold" ? "Agrupam os cursos Gold no site e no backoffice." : "Agrupam as UFCD no backoffice e nos relatórios ao financiador."} action={<NewBtn accent={accent} label="+ Nova área" onClick={() => setOpen("new")} />} />
        <CatalogKpis items={[
          { label: "Áreas", value: lista.length },
          { label: "Activas", value: lista.filter(x => x.estado === "Ativo").length },
          { label: "Cursos", value: lista.reduce((a, x) => a + x.cursos, 0) },
        ]} />
        <ViewFilters accent={accent} chips={{ options: ["Todos", "Ativo", "Inactivo"], value: filtro, onChange: setFiltro }} onClear={() => setFiltro("Todos")} />
        <Card>
          <TableToolbar search={s} onSearch={setS} count={f.length} noun="áreas" />
          <div className="md:hidden p-3 space-y-2">
            {f.map(r => (
              <MobileCard key={r.id} title={r.nome} sub={`${r.cursos} cursos`} badge={estadoBadge(r.estado)} onOpen={() => setOpen(r)}
                actions={[{ label: "Editar", icon: I.edit, onClick: () => setOpen(r) }, { label: "Eliminar", icon: I.trash, tone: "red", onClick: () => setApagar(r) }]} />
            ))}
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr><Th>Área</Th><Th className="text-center">Cursos</Th><Th>Estado</Th><Th>Ações</Th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {f.length === 0 && <EmptyState text="Nenhuma área temática encontrada." />}
                {f.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/80 cursor-pointer" onClick={() => setOpen(r)}>
                    <Td className="text-sm font-medium text-slate-900">{r.nome}</Td>
                    <Td className="text-center text-sm font-semibold tabular-nums text-slate-800">{r.cursos}</Td>
                    <Td>{estadoBadge(r.estado)}</Td>
                    <Td onClick={e => e.stopPropagation()}><div className="flex gap-1"><ActBtn icon={I.edit} label="Editar" onClick={() => setOpen(r)} /><ActBtn icon={I.trash} label="Eliminar" color="red" onClick={() => setApagar(r)} /></div></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      <SlideOver open={!!open} onClose={() => setOpen(null)} title={editing ? editing.nome : "Nova área temática"}>
        <div className="p-5 space-y-3">
          <Field label="Nome"><input className={iCls} value={nome} onChange={e => setNome(e.target.value)} /></Field>
          <FormActions accent={accent} onClose={() => setOpen(null)} onSave={guardar} disabled={!nome.trim()} label={editing ? "Guardar" : "Criar área"} />
        </div>
      </SlideOver>
      <ApagarCatalogoModal
        tipo="área temática"
        nome={apagar?.nome ?? ""}
        open={!!apagar}
        onClose={() => setApagar(null)}
        onConfirm={() => { if (apagar) setLista(xs => xs.filter(x => x.id !== apagar.id)); }}
      />
    </>
  );
}

type ModuloRow = typeof modulosData[number];

export function ModulosFinView({ cursoInicial }: { cursoInicial?: string }) {
  return <ModulosView cursoInicial={cursoInicial} accent="fin" />;
}

export function ModulosView({ cursoInicial, accent = "gold" }: { cursoInicial?: string; accent?: Accent }) {
  const cursosOpts = accent === "gold" ? cursosGoldOpts : cursosFinOpts;
  const [s, setS] = useState("");
  const [estado, setEstado] = useState("Todos");
  const [cursoFiltro, setCursoFiltro] = useState(cursoInicial ?? "");
  const [lista, setLista] = useCatalogList<ModuloRow>("modulos", accent, accent === "gold" ? modulosData : modulosFinData);
  const [apagar, setApagar] = useState<ModuloRow | null>(null);
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
    setCodigo(editing?.codigo ?? (cursoFiltro ? nextCodigoModulo(lista, cursoFiltro, accent) : ""));
    setNome(editing?.nome ?? "");
    setHoras(String(editing?.horas ?? 10));
    setTipo(editing?.tipo ?? "Teórico-prático");
  }, [open, editing, cursoFiltro, lista]);

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
      const id = -Date.now();
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
          kicker={accent === "gold" ? "Catálogo Gold" : "Catálogo Financiada"}
          title={accent === "gold" ? "Módulos" : "Módulos"}
          sub={cursoFiltro ? `${f.length} módulo${f.length === 1 ? "" : "s"} · ${horasCurso}h neste curso` : (accent === "gold" ? "Escolha um curso para ver e criar os seus módulos." : "Escolha a UFCD para ver e criar os seus módulos.")}
          action={<NewBtn accent={accent} label="+ Novo módulo" onClick={abrirNovo} />}
        />
        <CatalogKpis items={[
          { label: "Módulos", value: f.length },
          { label: "Horas", value: `${horasCurso}h` },
          { label: "Cursos", value: uniqueOpts(lista.map(x => x.curso)).length },
        ]} />
        <ViewFilters
          accent={accent}
          fields={[{ label: accent === "gold" ? "Curso" : "Curso / UFCD", value: cursoFiltro, onChange: setCursoFiltro, options: cursosOpts, placeholder: accent === "gold" ? "Pesquisar curso…" : "Pesquisar UFCD…" }]}
          chips={{ options: ["Todos", "Ativo", "Inactivo"], value: estado, onChange: setEstado }}
          onClear={() => { setCursoFiltro(""); setEstado("Todos"); }}
        />
        <Card>
          <TableToolbar search={s} onSearch={setS} count={f.length} noun="módulos" />
          <div className="md:hidden p-3 space-y-2">
            {f.map(r => (
              <MobileCard key={r.id} title={`${r.codigo} · ${r.nome}`} sub={r.curso} badge={estadoBadge(r.estado)} meta={[r.tipo, `${r.horas}h`]} onOpen={() => setOpen(r)}
                actions={[{ label: "Editar", icon: I.edit, onClick: () => setOpen(r) }, { label: "Eliminar", icon: I.trash, tone: "red", onClick: () => setApagar(r) }]} />
            ))}
          </div>
          <div className="hidden md:block overflow-x-auto max-h-[min(70vh,640px)]">
            <table className="w-full text-sm">
              <thead><tr><Th>Código</Th><Th>Módulo</Th><Th>Curso</Th><Th>Tipo</Th><Th className="text-center">Horas</Th><Th>Estado</Th><Th>Ações</Th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {f.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center">
                      <p className="text-sm text-slate-500">
                        {!cursoFiltro
                          ? "Selecione um curso acima para listar os módulos."
                          : "Este curso ainda não tem módulos."}
                      </p>
                      <button type="button" onClick={abrirNovo} className={`mt-3 text-sm font-semibold ${accent === "gold" ? "text-amber-600 hover:text-amber-700" : "text-blue-600 hover:text-blue-700"}`}>
                        Criar o primeiro módulo
                      </button>
                    </td>
                  </tr>
                )}
                {f.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/80 cursor-pointer" onClick={() => setOpen(r)}>
                    <Td><span className={`text-xs font-bold font-mono px-1.5 py-0.5 rounded ${accent === "gold" ? "text-amber-700 bg-amber-50" : "text-blue-700 bg-blue-50"}`}>{r.codigo}</span></Td>
                    <Td className="text-sm font-medium text-slate-900">{r.nome}</Td>
                    <Td className="text-xs text-slate-500 max-w-[180px]">{r.curso}</Td>
                    <Td className="text-xs text-slate-600">{r.tipo}</Td>
                    <Td className="text-center text-sm font-semibold tabular-nums">{r.horas}h</Td>
                    <Td>{estadoBadge(r.estado)}</Td>
                    <Td onClick={e => e.stopPropagation()}><div className="flex gap-1"><ActBtn icon={I.edit} label="Editar" onClick={() => setOpen(r)} /><ActBtn icon={I.trash} label="Eliminar" color="red" onClick={() => setApagar(r)} /></div></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      <SlideOver
        open={!!open}
        onClose={() => setOpen(null)}
        title={editing ? `${editing.codigo} · ${editing.nome}` : "Novo módulo"}
        sub={curso ? `Pertence a ${curso}` : "Um módulo existe sempre dentro de um curso"}
      >
        <div className="p-5 space-y-4">
          <div className={`rounded-xl border px-3 py-2.5 ${accentBox(accent)}`}>
            <p className={`text-xs font-semibold ${accentTitle(accent)}`}>Módulo ⊂ {accent === "gold" ? "curso" : "UFCD"}</p>
            <p className={`text-xs mt-0.5 ${accentText(accent)}`}>Não há módulos soltos. Escolha {accent === "gold" ? "o curso" : "a UFCD"} e o módulo fica associado a ele - nas turmas, nos conteúdos e no DTP.</p>
          </div>
          <Field label={accent === "gold" ? "Curso *" : "Curso / UFCD *"}>
            <SearchSelect value={curso} onChange={v => { setCurso(v); if (!editing) setCodigo(nextCodigoModulo(lista, v, accent)); }} options={cursosOpts} placeholder={accent === "gold" ? "Obrigatório - pesquisar curso…" : "Obrigatório - pesquisar UFCD…"} />
          </Field>
          {curso && (
            <p className="text-xs text-slate-500 -mt-2">
              {lista.filter(m => m.curso === curso).length} módulos neste curso · {lista.filter(m => m.curso === curso).reduce((a, m) => a + m.horas, 0)}h já definidas
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Código"><input className={iCls} value={codigo} onChange={e => setCodigo(e.target.value)} placeholder={curso ? nextCodigoModulo(lista, curso, accent) : (accent === "gold" ? "M1" : "U1")} /></Field>
            <Field label="Horas"><input type="number" min={1} className={iCls} value={horas} onChange={e => setHoras(e.target.value)} /></Field>
          </div>
          <Field label="Nome do módulo *"><input className={iCls} value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Avaliação da formação" /></Field>
          <Field label="Tipo"><OptionSelect lista="tipos_modulo" value={tipo} onChange={setTipo} /></Field>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setOpen(null)} className="flex-1 py-2 border border-slate-200 text-sm text-slate-600 rounded-lg hover:bg-slate-50">Cancelar</button>
            <button type="button" onClick={guardarModulo} disabled={!nome.trim() || !curso}
              className={`flex-1 py-2 ${accentBtn(accent)} disabled:opacity-40 text-white text-sm font-semibold rounded-lg`}>
              {editing ? "Guardar" : "Criar módulo"}
            </button>
          </div>
        </div>
      </SlideOver>
      <ApagarCatalogoModal
        tipo="módulo"
        nome={apagar?.nome ?? ""}
        open={!!apagar}
        onClose={() => setApagar(null)}
        onConfirm={() => { if (apagar) setLista(xs => xs.filter(x => x.id !== apagar.id)); }}
      />
    </>
  );
}

export function ConteudosFinView() {
  return <ConteudosView accent="fin" />;
}

export function ConteudosView({ accent = "gold" }: { accent?: Accent }) {
  const cursosOpts = accent === "gold" ? cursosGoldOpts : cursosFinOpts;
  const [catalogoModulos] = useCatalogList<ModuloRow>("modulos", accent, accent === "gold" ? modulosData : modulosFinData);
  const [s, setS] = useState("");
  const [filtro, setFiltro] = useState("Todos");
  const [filtroCurso, setFiltroCurso] = useState("");
  const [filtroModulo, setFiltroModulo] = useState("");
  const [lista, setLista] = useCatalogList<ConteudoRow>("conteudos", accent, accent === "gold" ? conteudosData : conteudosFinData);
  const [apagar, setApagar] = useState<ConteudoRow | null>(null);
  const [open, setOpen] = useState<"new" | typeof conteudosData[number] | null>(null);
  const [abrir, setAbrir] = useState<ConteudoPreview | null>(null);
  const [curso, setCurso] = useState("");
  const [modulo, setModulo] = useState("");
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState("PDF");
  const [origem, setOrigem] = useState("");
  const [ficheiro, setFicheiro] = useState<File | null>(null);
  const [driveMeta, setDriveMeta] = useState<{ id?: string; url?: string; tamanho?: string }>({});
  const [aEnviar, setAEnviar] = useState(false);
  const [erroFicheiro, setErroFicheiro] = useState<string | null>(null);
  const { status: driveStatus } = useDrive();
  const editing = open && open !== "new" ? open : null;
  const modulosDoCurso = curso ? catalogoModulos.filter(m => m.curso === curso) : [];
  const moduloOpts = modulosDoCurso.map(m => ({ value: m.codigo, sub: `${m.nome} · ${m.horas}h` }));
  const filtroModuloOpts = catalogoModulos
    .filter(m => !filtroCurso || m.curso === filtroCurso)
    .map(m => ({ value: m.codigo, sub: `${m.nome}` }));

  const f = lista.filter(x => {
    const q = `${x.titulo} ${x.curso} ${x.modulo}`.toLowerCase().includes(s.toLowerCase());
    return q && matchesFilter(x.curso, filtroCurso) && matchesFilter(x.modulo, filtroModulo) && (filtro === "Todos" || x.tipo === filtro || x.estado === filtro);
  });

  useEffect(() => {
    if (!open) return;
    const c = editing?.curso || filtroCurso || "";
    setCurso(c);
    setModulo(editing?.modulo ?? "");
    setTitulo(editing?.titulo ?? "");
    setTipo(editing?.tipo ?? "PDF");
    setOrigem(typeof editing?.origem === "string" ? editing.origem : "");
    setFicheiro(null);
    setDriveMeta({
      id: typeof editing?.driveFileId === "string" ? editing.driveFileId : undefined,
      url: typeof editing?.driveUrl === "string" ? editing.driveUrl : undefined,
      tamanho: editing?.tamanho,
    });
    setErroFicheiro(null);
  }, [open, editing, filtroCurso]);

  function escolherCurso(v: string) {
    setCurso(v);
    const aindaServe = catalogoModulos.some(m => m.curso === v && m.codigo === modulo);
    if (!aindaServe) setModulo("");
  }

  async function guardarConteudo() {
    if (!titulo.trim() || !curso || !modulo) return;
    let meta = driveMeta;
    if (tipo !== "Link" && ficheiro) {
      setAEnviar(true);
      setErroFicheiro(null);
      try {
        const uploaded = await apiUploadDrive(ficheiro, {
          kind: "conteudo",
          regime: accent,
          turma: curso,
          label: titulo.trim(),
        });
        meta = {
          id: uploaded.id,
          url: uploaded.openUrl,
          tamanho: uploaded.sizeBytes > 1024 * 1024
            ? `${(uploaded.sizeBytes / (1024 * 1024)).toFixed(1)} MB`
            : `${Math.max(1, Math.round(uploaded.sizeBytes / 1024))} KB`,
        };
      } catch (err) {
        setErroFicheiro(err instanceof Error ? err.message : "Falha no envio do ficheiro.");
        setAEnviar(false);
        return;
      }
      setAEnviar(false);
    }
    const row = {
      titulo: titulo.trim(),
      tipo,
      curso,
      modulo,
      tamanho: tipo === "Link" ? "-" : (meta.tamanho ?? (tipo === "Vídeo" ? "-" : "0 KB")),
      estado: "Ativo" as const,
      origem: tipo === "Link" ? origem.trim() : undefined,
      driveFileId: meta.id,
      driveUrl: tipo === "Link" ? origem.trim() : meta.url,
    };
    if (open === "new") {
      const id = -Date.now();
      setLista(prev => [...prev, { id, ...row }]);
      if (!filtroCurso) setFiltroCurso(curso);
      if (!filtroModulo) setFiltroModulo(modulo);
    } else if (editing) {
      setLista(prev => prev.map(x => x.id === editing.id ? { ...x, ...row } : x));
    }
    setOpen(null);
  }

  return (
    <>
      <div className="space-y-4">
        <PageHeader kicker={accent === "gold" ? "Catálogo Gold" : "Catálogo Financiada"} title="Conteúdos" sub="Materiais do módulo: PDF, vídeo ou ligação. Sem módulo o ficheiro não entra no DTP." action={<NewBtn accent={accent} label="Novo conteúdo" onClick={() => setOpen("new")} />} />
        <CatalogKpis items={[
          { label: "Materiais", value: lista.length },
          { label: "PDF", value: lista.filter(x => x.tipo === "PDF").length },
          { label: "Vídeo", value: lista.filter(x => x.tipo === "Vídeo").length },
          { label: "Ligações", value: lista.filter(x => x.tipo === "Link").length },
        ]} />
        <ViewFilters
          accent={accent}
          fields={[
            { label: accent === "gold" ? "Curso" : "Curso / UFCD", value: filtroCurso, onChange: v => { setFiltroCurso(v); setFiltroModulo(""); }, options: uniqueOpts(lista.map(x => x.curso)) },
            { label: "Módulo", value: filtroModulo, onChange: setFiltroModulo, options: filtroModuloOpts, placeholder: filtroCurso ? "Módulos deste curso…" : "Todos os módulos…" },
          ]}
          chips={{ options: ["Todos", "PDF", "Vídeo", "Link", "Ativo", "Inactivo"], value: filtro, onChange: setFiltro }}
          onClear={() => { setFiltroCurso(""); setFiltroModulo(""); setFiltro("Todos"); }}
        />
        <Card>
          <TableToolbar search={s} onSearch={setS} count={f.length} noun="conteúdos" />
          <div className="md:hidden p-3 space-y-2">
            {f.map(r => (
              <MobileCard key={r.id} title={r.titulo} sub={`${r.curso} · ${labelModulo(r.modulo, r.curso, catalogoModulos)}`} badge={estadoBadge(r.tipo)} meta={[r.tamanho, r.estado]} onOpen={() => setAbrir(r)}
                actions={[{ label: "Abrir", icon: I.eye, onClick: () => setAbrir(r) }, { label: "Editar", icon: I.edit, onClick: () => setOpen(r) }, { label: "Eliminar", icon: I.trash, tone: "red", onClick: () => setApagar(r) }]} />
            ))}
          </div>
          <div className="hidden md:block overflow-x-auto max-h-[min(70vh,640px)]">
            <table className="w-full text-sm">
              <thead><tr><Th>Título</Th><Th>Tipo</Th><Th>Curso</Th><Th>Módulo</Th><Th>Tamanho</Th><Th>Estado</Th><Th>Ações</Th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {f.length === 0 && <EmptyState text="Nenhum conteúdo neste curso ou módulo." />}
                {f.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/80 cursor-pointer" onClick={() => setAbrir(r)}>
                    <Td className="text-sm font-medium text-slate-900 max-w-[240px]">{r.titulo}</Td>
                    <Td>{estadoBadge(r.tipo)}</Td>
                    <Td className="text-xs text-slate-600 max-w-[160px]">{r.curso}</Td>
                    <Td className="text-xs text-slate-600 whitespace-nowrap">{labelModulo(r.modulo, r.curso, catalogoModulos)}</Td>
                    <Td className="text-xs text-slate-500">{r.tamanho}</Td>
                    <Td>{estadoBadge(r.estado)}</Td>
                    <Td onClick={e => e.stopPropagation()}><div className="flex gap-1"><ActBtn icon={I.eye} label="Abrir" onClick={() => setAbrir(r)} /><ActBtn icon={I.edit} label="Editar" onClick={() => setOpen(r)} /><ActBtn icon={I.trash} label="Eliminar" color="red" onClick={() => setApagar(r)} /></div></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      <SlideOver
        open={!!open}
        onClose={() => setOpen(null)}
        title={editing ? editing.titulo : "Novo conteúdo"}
        sub={modulo && curso ? `${labelModulo(modulo, curso, catalogoModulos)} · ${curso}` : "O material fica no módulo, e o módulo no curso"}
      >
        <div className="p-5 space-y-4">
          <div className={`rounded-xl border px-3 py-2.5 ${accentBox(accent)}`}>
            <p className={`text-xs font-semibold ${accentTitle(accent)}`}>Conteúdo ⊂ módulo ⊂ {accent === "gold" ? "curso" : "UFCD"}</p>
            <p className={`text-xs mt-0.5 ${accentText(accent)}`}>Escolha {accent === "gold" ? "o curso" : "a UFCD"}, depois o módulo. O PDF, o vídeo ou o link ficam nesse bloco - é assim que o formador e o DTP os encontram.</p>
          </div>
          <Field label={accent === "gold" ? "Curso *" : "Curso / UFCD *"}>
            <SearchSelect value={curso} onChange={escolherCurso} options={cursosOpts} placeholder={accent === "gold" ? "Primeiro o curso…" : "Primeiro a UFCD…"} />
          </Field>
          <Field label="Módulo *">
            <SearchSelect
              value={modulo}
              onChange={setModulo}
              options={moduloOpts}
              placeholder={curso ? "Módulos deste curso…" : "Escolha o curso primeiro"}
              empty={curso ? "Este curso ainda não tem módulos." : "Escolha o curso para ver os módulos."}
            />
          </Field>
          {curso && moduloOpts.length === 0 && (
            <p className={`text-xs rounded-lg px-3 py-2 border ${accentBox(accent)} ${accentText(accent)}`}>
              Não há módulos em «{curso}». Crie primeiro o módulo na vista Módulos - o conteúdo não pode ficar órfão.
            </p>
          )}
          <Field label="Título *"><input className={iCls} value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: Manual do módulo 1" /></Field>
          <Field label="Tipo">
            <OptionSelect lista="tipos_conteudo" value={tipo} onChange={setTipo} />
          </Field>
          <Field label={tipo === "Link" ? "URL" : "Ficheiro (Drive da entidade)"}>
            {tipo === "Link" ? (
              <input className={iCls} value={origem} onChange={e => setOrigem(e.target.value)} placeholder="https://…" />
            ) : (
              <div className="space-y-1.5">
                <input type="file" className={iCls} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.mp4,.webm"
                  onChange={e => setFicheiro(e.target.files?.[0] ?? null)} />
                <p className="text-xs text-slate-500">
                  {driveStatus.connected
                    ? <>Vai para o Drive da entidade{driveStatus.folderName ? <> · <span className="font-semibold">{driveStatus.folderName}</span></> : null}.</>
                    : <>Ainda sem Drive ligado. O ficheiro fica no servidor até ligar a conta Google em Configurações.</>}
                </p>
                {(ficheiro || driveMeta.id) && (
                  <p className="text-xs text-slate-500">{ficheiro ? ficheiro.name : "Já existe um ficheiro no arquivo."}</p>
                )}
                {erroFicheiro && <p className="text-xs font-semibold text-red-600">{erroFicheiro}</p>}
              </div>
            )}
          </Field>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setOpen(null)} className="flex-1 py-2 border border-slate-200 text-sm text-slate-600 rounded-lg hover:bg-slate-50">Cancelar</button>
            <button type="button" onClick={() => void guardarConteudo()} disabled={!titulo.trim() || !curso || !modulo || aEnviar}
              className={`flex-1 py-2 ${accentBtn(accent)} disabled:opacity-40 text-white text-sm font-semibold rounded-lg`}>
              {aEnviar ? "A enviar…" : editing ? "Guardar" : "Criar conteúdo"}
            </button>
          </div>
        </div>
      </SlideOver>
      <ApagarCatalogoModal
        tipo="conteúdo"
        nome={apagar?.titulo ?? ""}
        open={!!apagar}
        onClose={() => setApagar(null)}
        onConfirm={() => { if (apagar) setLista(xs => xs.filter(x => x.id !== apagar.id)); }}
      />
      <ConteudoAbrirModal open={!!abrir} onClose={() => setAbrir(null)} item={abrir} accent={accent} />
    </>
  );
}

export function FinInscricoesView() {
  const { fin } = useTurmas();
  const [lista, setLista] = useCatalogList("inscricoes_fin", "fin", finInscricoesData);
  const [s, setS] = useState(""); const [p, setP] = useState(1);
  const [filtro, setFiltro] = useState("Todas");
  const [open, setOpen] = useState<"new" | typeof finInscricoesData[number] | null>(null);
  const [apagar, setApagar] = useState<typeof finInscricoesData[number] | null>(null);
  const [curso, setCurso] = useState("");
  const [turma, setTurma] = useState("");
  const [filtroCurso, setFiltroCurso] = useState("");
  const [nome, setNome] = useState("");
  const [apelido, setApelido] = useState("");
  const [email, setEmail] = useState("");
  const [telf, setTelf] = useState("");
  const [estadoInsc, setEstadoInsc] = useState("Recebida");
  const estados = ["Todas", "Recebida", "Em análise", "Elegível", "Colocado na turma", "Indeferido"];
  const editing = open && open !== "new" ? open : null;
  const turmaOpts = turmaFinOpts(fin, { curso: curso || undefined, includeNome: editing && editing.turma !== "-" ? editing.turma : undefined });
  useEffect(() => {
    if (!open) return;
    setCurso(editing?.curso ?? "");
    setTurma(editing && editing.turma !== "-" ? editing.turma : "");
    setNome(editing?.nome ?? "");
    setApelido(editing?.apelido ?? "");
    setEmail(editing?.email ?? "");
    setTelf(editing?.telf ?? "");
    setEstadoInsc(editing?.estado ?? "Recebida");
  }, [open, editing]);
  const f = lista.filter(x => {
    const q = `${x.nome} ${x.apelido} ${x.ufcd} ${x.curso} ${x.turma}`.toLowerCase().includes(s.toLowerCase());
    return q && matchesFilter(x.curso, filtroCurso) && (filtro === "Todas" || x.estado === filtro);
  });
  const rows = f.slice((p - 1) * 10, p * 10);
  return (
    <>
      <div className="space-y-4">
        <PageHeader title="Inscrições Financiadas" sub="Pipeline de elegibilidade por turma e UFCD - não é o funil comercial Gold." action={<NewBtn label="+ Nova inscrição" onClick={() => setOpen("new")} />} />
        <ViewFilters
          accent="fin"
          fields={[{ label: "Curso / UFCD", value: filtroCurso, onChange: v => { setFiltroCurso(v); setP(1); }, options: uniqueOpts(lista.map(x => x.curso)) }]}
          chips={{ options: estados, value: filtro, onChange: v => { setFiltro(v); setP(1); } }}
          onClear={() => { setFiltroCurso(""); setFiltro("Todas"); setP(1); }}
        />
        <Card>
          <TableToolbar search={s} onSearch={v => { setS(v); setP(1); }} />
          {rows.length === 0 && (
            <EmptyHint
              accent="fin"
              text={lista.length === 0 ? "Ainda sem candidaturas. O pipeline de elegibilidade começa aqui." : "Nenhuma inscrição neste filtro."}
              action={lista.length === 0 ? "Nova inscrição" : "Limpar filtros"}
              onAction={lista.length === 0 ? () => setOpen("new") : () => { setFiltroCurso(""); setFiltro("Todas"); setS(""); setP(1); }}
            />
          )}
          <div className="md:hidden p-3 space-y-2">
            {rows.map(r => (
              <MobileCard
                key={r.id}
                title={`${r.nome} ${r.apelido}`}
                sub={r.curso}
                badge={estadoBadge(r.estado)}
                meta={[`UFCD ${r.ufcd}`, r.turma, r.inscrito]}
                onOpen={() => setOpen(r)}
                actions={[
                  { label: "Abrir", icon: I.eye, onClick: () => setOpen(r) },
                  { label: "Editar", icon: I.edit, onClick: () => setOpen(r) },
                  { label: "Eliminar", icon: I.trash, tone: "red", onClick: () => setApagar(r) },
                ]}
              />
            ))}
          </div>
          <div className="hidden md:block overflow-auto max-h-[min(70vh,640px)]">
            <table className="w-full text-sm">
              <thead><tr><Th>Id</Th><Th>Data</Th><Th>Candidato</Th><Th>UFCD</Th><Th>Turma</Th><Th>Documentos</Th><Th>Estado</Th><Th>Ações</Th></tr></thead>
              <tbody className="divide-y divide-slate-100">
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
                    <Td>
                      <RowActions actions={[
                        { label: "Abrir", icon: I.eye, onClick: () => setOpen(r) },
                        { label: "Editar", icon: I.edit, onClick: () => setOpen(r) },
                        { label: "Eliminar", icon: I.trash, tone: "red", onClick: () => setApagar(r) },
                      ]} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TableFooter page={p} total={f.length} perPage={10} onChange={setP} />
        </Card>
        <p className="text-xs text-slate-400">Pontinhos dos documentos: CC cartão de cidadão · CH certificado de habilitações · CU curriculum · CI IBAN · CE comprovativo de emprego. Sem documentos completos a turma não arranca.</p>
      </div>
      <ConfirmDangerModal
        open={!!apagar}
        onClose={() => setApagar(null)}
        title="Eliminar inscrição financiada"
        body={apagar ? `Remover a candidatura de ${apagar.nome} ${apagar.apelido}?` : ""}
        risk="Sai do pipeline de elegibilidade. Esta acção não se desfaz."
        onConfirm={() => { if (apagar) setLista(xs => xs.filter(x => x.id !== apagar.id)); }}
      />
      <SlideOver open={!!open} onClose={() => setOpen(null)}
        title={editing ? `${editing.nome} ${editing.apelido}` : "Nova inscrição financiada"}
        sub={editing ? `UFCD ${editing.ufcd} · ${editing.turma}` : "Candidatura a UFCD - não é o funil Gold"}>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome"><input className={iCls} value={nome} onChange={e => setNome(e.target.value)} /></Field>
            <Field label="Apelido"><input className={iCls} value={apelido} onChange={e => setApelido(e.target.value)} /></Field>
            <Field label="Email"><input className={iCls} value={email} onChange={e => setEmail(e.target.value)} /></Field>
            <Field label="Telemóvel"><input className={iCls} value={telf} onChange={e => setTelf(e.target.value)} /></Field>
          </div>
          <Field label="Curso / UFCD"><SearchSelect value={curso} onChange={v => { setCurso(v); setTurma(""); }} options={cursosFinOpts} placeholder="Pesquisar UFCD…" /></Field>
          <Field label="Turma"><SearchSelect value={turma} onChange={setTurma} options={turmaOpts} placeholder="Só turmas ativas…" empty="Não há turmas ativas para esta UFCD." allowEmpty /></Field>
          <TurmaInscricaoHint optsLen={turmaOpts.length} curso={curso || undefined} />
          <Field label="Estado">
            <select className={iCls} value={estadoInsc} onChange={e => setEstadoInsc(e.target.value)}>
              {estados.filter(e => e !== "Todas").map(e => <option key={e}>{e}</option>)}
            </select>
          </Field>
          {editing && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Documentos</p>
              <DocPips docs={editing.docs} />
            </div>
          )}
          <FormActions onClose={() => setOpen(null)} onSave={() => {
            if (!nome.trim() || !curso) return;
            const opt = cursosFinOpts.find(o => o.value === curso);
            const ufcd = opt?.sub?.match(/\d+/)?.[0] ?? editing?.ufcd ?? "-";
            const row = {
              id: editing?.id ?? nextId(lista),
              inscrito: editing?.inscrito ?? new Date().toISOString().slice(0, 10),
              nome: nome.trim(), apelido: apelido.trim(), email: email.trim(), telf: telf.trim(),
              ufcd, curso, turma: turma || "-", estado: estadoInsc,
              docs: editing?.docs ?? { cc: false, ch: false, cu: false, ci: false, ce: false },
            };
            if (editing) setLista(xs => xs.map(x => x.id === editing.id ? row : x));
            else setLista(xs => [row, ...xs]);
            setOpen(null);
          }} disabled={!nome.trim() || !curso} label={editing ? "Guardar" : "Criar inscrição"} />
        </div>
      </SlideOver>
    </>
  );
}

export function BlogTematicasView() {
  const [lista, setLista] = useCatalogList("blog_tematicas", "gold", blogTematicasData);
  const [apagar, setApagar] = useState<typeof lista[number] | null>(null);
  const [s, setS] = useState("");
  const [filtro, setFiltro] = useState("Todos");
  const [open, setOpen] = useState<"new" | typeof blogTematicasData[number] | null>(null);
  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");
  const f = lista.filter(x => `${x.nome} ${x.slug}`.toLowerCase().includes(s.toLowerCase()) && (filtro === "Todos" || x.estado === filtro));
  const editing = open && open !== "new" ? open : null;
  useEffect(() => {
    if (!open) return;
    setNome(editing?.nome ?? "");
    setSlug(editing?.slug ?? "");
  }, [open, editing]);
  return (
    <>
      <div className="space-y-4">
        <PageHeader title="Temáticas do Blog" sub="Categorias dos artigos no site da ENA." action={<NewBtn label="+ Nova temática" onClick={() => setOpen("new")} />} />
        <ViewFilters chips={{ options: ["Todos", "Ativo", "Inactivo"], value: filtro, onChange: setFiltro }} onClear={() => setFiltro("Todos")} />
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
                    <Td><div className="flex gap-1"><ActBtn icon={I.edit} label="Editar" onClick={() => setOpen(r)} /><ActBtn icon={I.trash} label="Eliminar" color="red" onClick={() => setApagar(r)} /></div></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      <SlideOver open={!!open} onClose={() => setOpen(null)} title={editing ? editing.nome : "Nova temática"}>
        <div className="p-5 space-y-3">
          <Field label="Nome"><input className={iCls} value={nome} onChange={e => setNome(e.target.value)} /></Field>
          <Field label="Slug"><input className={iCls} value={slug} onChange={e => setSlug(e.target.value)} placeholder="formacao-formadores" /></Field>
          <FormActions onClose={() => setOpen(null)} onSave={() => {
            if (!nome.trim()) return;
            const row = {
              id: editing?.id ?? nextId(lista),
              nome: nome.trim(),
              slug: (slug.trim() || nome.trim()).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
              posts: editing?.posts ?? 0,
              estado: "Ativo",
            };
            if (editing) setLista(xs => xs.map(x => x.id === editing.id ? row : x));
            else setLista(xs => [row, ...xs]);
            setOpen(null);
          }} disabled={!nome.trim()} label={editing ? "Guardar" : "Criar temática"} />
        </div>
      </SlideOver>
      <ApagarCatalogoModal
        tipo="temática"
        nome={apagar?.nome ?? ""}
        open={!!apagar}
        onClose={() => setApagar(null)}
        onConfirm={() => { if (apagar) setLista(xs => xs.filter(x => x.id !== apagar.id)); }}
      />
    </>
  );
}

const configCards = [
  {
    id: "entidade",
    titulo: "Entidade formadora",
    texto: "ENA - Escola de Negócios e Administração. NIF, certificação DGERT e dados de contacto.",
    fields: [
      { label: "Designação", value: "ENA - Escola de Negócios e Administração" },
      { label: "NIF", value: "510 000 000" },
      { label: "Certificação DGERT", value: "Válida" },
      { label: "Email", value: "formacao@ena.pt" },
      { label: "Telefone", value: "22 374 40 50" },
    ],
  },
  {
    id: "formacao",
    titulo: "Formação",
    texto: "Prazos de arquivo, emissão de certificados e língua dos documentos.",
    fields: [
      { label: "Arquivo DTP", value: "10 anos (IEFP)" },
      { label: "Certificados", value: "NetForce / SIGO" },
      { label: "Unidade de gestão", value: "Turma" },
      { label: "Língua dos documentos", value: "Português" },
    ],
  },
  {
    id: "gold",
    titulo: "Gold / Autofinanciada",
    texto: "Preços, métodos de pagamento e regras do CCP.",
    fields: [
      { label: "Métodos de pagamento", value: "MB Way, Multibanco, cartão, transferência, PayPal" },
      { label: "Entidade Multibanco", value: "" },
      { label: "Chave webhook pagamentos", value: "" },
      { label: "Curso-bandeira", value: "Formação de Formadores - CCP" },
      { label: "Preço CCP", value: "125 €" },
      { label: "DTP", value: "Núcleo DGERT + PIP e simulações" },
    ],
  },
  {
    id: "fin",
    titulo: "Financiada",
    texto: "Elegibilidade, UFCD e documentos do financiador.",
    fields: [
      { label: "Documentos", value: "CC, CH, CV, IBAN, comprovativo de emprego" },
      { label: "Assiduidade", value: "Em horas da UFCD" },
      { label: "Turma sem documentos", value: "Bloqueada para novas inscrições" },
      { label: "Financiador", value: "IEFP / PO" },
    ],
  },
  {
    id: "emails",
    titulo: "Emails automáticos",
    texto: "Remetente, assinatura e regras ativas.",
    fields: [
      { label: "Remetente", value: "formacao@ena.pt" },
      { label: "Nome visível", value: "ENA Formação" },
      { label: "Assinatura", value: "Equipa ENA" },
      { label: "Regras ativas", value: "4" },
    ],
  },
];

function seedConfigDrafts() {
  const out: Record<string, Record<string, string>> = {};
  for (const c of configCards) {
    out[c.id] = Object.fromEntries(c.fields.map(f => [f.label, f.value]));
  }
  return out;
}

function DriveSettingsCard() {
  const { status, ready, disconnect, refresh } = useDrive();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [folderId, setFolderId] = useState("");
  const redirectUri = status.redirectUri || `${window.location.origin}/api/v1/drive/oauth/callback`;

  useEffect(() => {
    if (status.clientId) setClientId(status.clientId);
    if (status.folderId) setFolderId(status.folderId);
  }, [status.clientId, status.folderId]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const drive = q.get("drive");
    if (!drive) return;
    q.delete("drive");
    const next = `${window.location.pathname}${q.toString() ? `?${q}` : ""}`;
    window.history.replaceState({}, "", next);
    void refresh();
    if (drive === "ligado") setMsg("Conta Google da entidade ligada. Os próximos uploads vão para o Drive.");
    else if (drive === "sem-cliente") setMsg("Grave primeiro o Client ID e o secret do cliente OAuth.");
    else if (drive === "oauth-falhou" || drive === "estado-expirado" || drive === "pedido-invalido") {
      setMsg("Não foi possível concluir o OAuth. Confirme o URI de redireccionamento no Google Cloud e tente outra vez.");
    }
  }, [refresh]);

  async function guardarCliente() {
    setBusy(true);
    setMsg(null);
    try {
      await apiPutDriveConfig({
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim() || undefined,
        folderId: folderId.trim() || undefined,
        folderName: status.folderName,
      });
      setClientSecret("");
      await refresh();
      setMsg("Cliente OAuth gravado. Pode ligar a conta Google da ENA.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Não foi possível gravar o cliente OAuth.");
    } finally {
      setBusy(false);
    }
  }

  async function desligar() {
    setBusy(true);
    try {
      await disconnect();
      setMsg("Conta Google desligada. Novos ficheiros ficam no servidor até voltar a ligar.");
    } catch {
      setMsg("Não foi possível desligar a conta.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 md:col-span-2 xl:col-span-3 space-y-4">
      <div className="flex flex-col md:flex-row md:items-start gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800">Google Drive da entidade</p>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            OAuth 2.0 da Google + Drive API. PIP, certificados, conteúdos e documentos do formador ficam na pasta <span className="font-semibold text-slate-700">{status.folderName}</span> da conta da ENA.
          </p>
          <p className="text-xs text-slate-500 mt-2">{ready ? status.hint : "A ler o estado…"}</p>
          {status.email && (
            <p className="text-xs font-semibold text-emerald-700 mt-1">Ligado como {status.email}</p>
          )}
          {msg && <p className="text-xs font-semibold text-amber-700 mt-2">{msg}</p>}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {status.connected
            ? <button type="button" disabled={busy} onClick={() => void desligar()} className="px-4 py-2.5 text-sm font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40">Desligar</button>
            : <button type="button" disabled={!status.configured || busy} onClick={() => { window.location.href = driveOAuthStartUrl(); }} className="px-4 py-2.5 text-sm font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white">Ligar conta Google</button>}
        </div>
      </div>

      <ol className="text-xs text-slate-600 space-y-1 list-decimal pl-4">
        <li>Google Cloud Console → projecto da ENA → active a <span className="font-semibold">Google Drive API</span>.</li>
        <li>Ecrã de consentimento OAuth (interno, se for Google Workspace).</li>
        <li>Clientes OAuth → «Aplicação Web». Adicione os dois URI de redireccionamento das caixas abaixo (Drive e login).</li>
        <li>Cole o Client ID e o secret, grave, e ligue com a conta da secretaria (não uma conta pessoal).</li>
      </ol>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="URI de redireccionamento do Drive">
          <input className={iCls} readOnly value={redirectUri} onFocus={e => e.currentTarget.select()} />
        </Field>
        <Field label="URI de redireccionamento do login Google">
          <input className={iCls} readOnly value={status.loginRedirectUri ?? `${window.location.origin}/api/v1/auth/google/callback`} onFocus={e => e.currentTarget.select()} />
        </Field>
        <Field label="Pasta no Drive (ID opcional de uma pasta já existente)">
          <input className={iCls} value={folderId} onChange={e => setFolderId(e.target.value)} placeholder="vazio = cria a pasta GesForma" disabled={status.fromEnv} />
        </Field>
        <Field label="Client ID">
          <input className={iCls} value={clientId} onChange={e => setClientId(e.target.value)} placeholder="xxxx.apps.googleusercontent.com" autoComplete="off" disabled={status.fromEnv} />
        </Field>
        <Field label="Client secret">
          <input className={iCls} type="password" value={clientSecret} onChange={e => setClientSecret(e.target.value)} placeholder={status.hasSecret ? "•••• já gravado - deixe vazio para manter" : "Cole o secret do cliente Web"} autoComplete="new-password" disabled={status.fromEnv} />
        </Field>
      </div>
      <div className="flex justify-end">
        <button type="button" disabled={busy || status.fromEnv || !clientId.trim()} onClick={() => void guardarCliente()}
          className="px-4 py-2.5 text-sm font-semibold rounded-lg bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white">
          {busy ? "A gravar…" : status.fromEnv ? "Cliente definido no servidor" : "Gravar cliente OAuth"}
        </button>
      </div>
    </div>
  );
}

function copyText(value: string) {
  void navigator.clipboard.writeText(value).catch(() => undefined);
}

function WhatsappSettingsCard() {
  const [status, setStatus] = useState<WhatsappStatus | null>(null);
  const [estado, setEstado] = useState<"loading" | "ready" | "erro">("loading");
  const [token, setToken] = useState("");
  const [phoneId, setPhoneId] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const carregar = useCallback(() => {
    apiWhatsappStatus()
      .then(r => {
        setStatus(r);
        setPhoneId(r.phoneId || "");
        setEstado("ready");
      })
      .catch(() => setEstado("erro"));
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  async function guardar() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await apiPutWhatsappConfig({
        token: token.trim() || undefined,
        phoneId: phoneId.trim() || undefined,
      });
      setStatus(r);
      setToken("");
      setPhoneId(r.phoneId || "");
      setMsg(r.ligado
        ? "Token gravado. O bot já pode responder no número de teste."
        : "Token gravado. Se o Meta não preencheu o Phone number ID, cole-o na caixa extra e grave outra vez.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Não foi possível gravar o token.");
    } finally {
      setBusy(false);
    }
  }

  async function desligar() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await apiWhatsappDesligar();
      setStatus(r);
      setToken("");
      setPhoneId("");
      setMsg("WhatsApp desligado. O simulador no CRM continua a gravar leads.");
    } catch {
      setMsg("Não foi possível desligar o WhatsApp.");
    } finally {
      setBusy(false);
    }
  }

  const precisaPhone = Boolean(status?.hasToken && !status.phoneId);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 md:col-span-2 xl:col-span-3 space-y-4">
      <div className="flex flex-col md:flex-row md:items-start gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800">WhatsApp · bot de pré-inscrição</p>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Para testar: no Meta Developers abra a app → WhatsApp → API Setup, copie o <span className="font-semibold text-slate-700">token temporário</span> e grave aqui. O número de teste e o verify token saem sozinhos.
          </p>
          <p className="text-xs text-slate-500 mt-2">
            {estado === "loading" ? "A ler o estado…" : estado === "erro" ? "Não foi possível ler o estado." : status?.hint}
          </p>
          {status?.displayPhone && (
            <p className="text-xs font-semibold text-emerald-700 mt-1">Número de teste {status.displayPhone}</p>
          )}
          {msg && <p className="text-xs font-semibold text-amber-700 mt-2">{msg}</p>}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <span className={`px-3 py-2.5 text-sm font-semibold rounded-lg ${status?.ligado ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-500"}`}>
            {status?.ligado ? "Activo" : "Inactivo"}
          </span>
          {status?.hasToken && !status.fromEnv && (
            <button type="button" disabled={busy} onClick={() => void desligar()} className="px-4 py-2.5 text-sm font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40">
              Desligar
            </button>
          )}
        </div>
      </div>

      <Field label="Token da Cloud API">
        <input
          className={iCls}
          type="password"
          value={token}
          onChange={e => setToken(e.target.value)}
          placeholder={status?.hasToken ? "•••• já gravado - cole um token novo para substituir" : "Cole o token temporário (API Setup)"}
          autoComplete="new-password"
          disabled={status?.fromEnv}
        />
      </Field>
      {precisaPhone && (
        <Field label="Phone number ID (só se o Meta não preencher sozinho)">
          <input
            className={iCls}
            value={phoneId}
            onChange={e => setPhoneId(e.target.value)}
            placeholder="O ID numérico ao lado do token na API Setup"
            autoComplete="off"
            disabled={status?.fromEnv}
          />
        </Field>
      )}
      <div className="flex justify-end">
        <button
          type="button"
          disabled={busy || status?.fromEnv || (token.trim().length < 20 && !(status?.hasToken && phoneId.trim()))}
          onClick={() => void guardar()}
          className="px-4 py-2.5 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white"
        >
          {busy ? "A gravar…" : status?.fromEnv ? "Definido no servidor" : "Gravar token"}
        </button>
      </div>

      {status?.hasToken && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          <Field label="Callback URL (copiar para o Meta)">
            <div className="flex gap-2">
              <input className={iCls} readOnly value={status.webhook} onFocus={e => e.currentTarget.select()} />
              <button type="button" onClick={() => copyText(status.webhook)} className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 shrink-0">Copiar</button>
            </div>
          </Field>
          <Field label="Verify token (copiar para o Meta)">
            <div className="flex gap-2">
              <input className={iCls} readOnly value={status.verifyToken} onFocus={e => e.currentTarget.select()} />
              <button type="button" onClick={() => copyText(status.verifyToken)} className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 shrink-0">Copiar</button>
            </div>
          </Field>
        </div>
      )}
    </div>
  );
}

function MicrosoftSettingsCard() {
  const [status, setStatus] = useState<MicrosoftStatus | null>(null);
  const [estado, setEstado] = useState<"loading" | "ready" | "erro">("loading");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const carregar = useCallback(() => {
    apiMicrosoftLoginStatus()
      .then(r => {
        setStatus(r);
        setClientId(r.clientId ?? "");
        setTenantId(r.tenantId ?? "");
        setEstado("ready");
      })
      .catch(() => setEstado("erro"));
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const redirectUri = status?.redirectUri || `${window.location.origin}/api/v1/auth/microsoft/callback`;

  async function guardar() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await apiPutMicrosoftConfig({
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim() || undefined,
        tenantId: tenantId.trim() || undefined,
      });
      setStatus(r);
      setClientSecret("");
      setMsg("Aplicação Microsoft gravada. O botão «Continuar com Microsoft» já está activo no login.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Não foi possível gravar a aplicação Microsoft.");
    } finally {
      setBusy(false);
    }
  }

  async function desligar() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await apiMicrosoftDisconnect();
      setStatus(r);
      setClientId("");
      setClientSecret("");
      setTenantId(r.tenantId ?? "");
      setMsg("Login Microsoft desligado. Fica só o email e o Google.");
    } catch {
      setMsg("Não foi possível desligar o login Microsoft.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 md:col-span-2 xl:col-span-3 space-y-4">
      <div className="flex flex-col md:flex-row md:items-start gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800">Entrar com Microsoft</p>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Microsoft Entra ID (Azure AD). Quem tem conta da organização entra sem palavra-passe - mas só se o email já existir em
            <span className="font-semibold text-slate-700"> Sistema → Gestão → Utilizadores</span>.
          </p>
          <p className="text-xs text-slate-500 mt-2">
            {estado === "loading" ? "A ler o estado…" : estado === "erro" ? "Não foi possível ler o estado." : status?.hint}
          </p>
          {status?.fromEnv && (
            <p className="text-xs font-semibold text-slate-600 mt-1">Definido por variáveis de ambiente no servidor.</p>
          )}
          {msg && <p className="text-xs font-semibold text-amber-700 mt-2">{msg}</p>}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <span className={`px-3 py-2.5 text-sm font-semibold rounded-lg ${status?.configured ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-500"}`}>
            {status?.configured ? "Activo" : "Inactivo"}
          </span>
          {status?.configured && !status.fromEnv && (
            <button type="button" disabled={busy} onClick={() => void desligar()} className="px-4 py-2.5 text-sm font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40">
              Desligar
            </button>
          )}
        </div>
      </div>

      <ol className="text-xs text-slate-600 space-y-1 list-decimal pl-4">
        <li>Portal Azure → <span className="font-semibold">Microsoft Entra ID</span> → Registos de aplicações → Novo registo.</li>
        <li>Tipo de conta: «Apenas contas neste diretório» para deixar entrar só a organização da ENA.</li>
        <li>Adicione o URI de redireccionamento abaixo como plataforma <span className="font-semibold">Web</span>.</li>
        <li>Certificados e segredos → Novo segredo do cliente. Copie o valor (só aparece uma vez).</li>
        <li>Cole aqui o Application (client) ID, o segredo e o Directory (tenant) ID, e grave.</li>
      </ol>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="URI de redireccionamento">
          <input className={iCls} readOnly value={redirectUri} onFocus={e => e.currentTarget.select()} />
        </Field>
        <Field label="Directory (tenant) ID">
          <input
            className={iCls}
            value={tenantId}
            onChange={e => setTenantId(e.target.value)}
            placeholder="common = qualquer organização"
            autoComplete="off"
            disabled={status?.fromEnv}
          />
        </Field>
        <Field label="Application (client) ID">
          <input
            className={iCls}
            value={clientId}
            onChange={e => setClientId(e.target.value)}
            placeholder="00000000-0000-0000-0000-000000000000"
            autoComplete="off"
            disabled={status?.fromEnv}
          />
        </Field>
        <Field label="Client secret">
          <input
            className={iCls}
            type="password"
            value={clientSecret}
            onChange={e => setClientSecret(e.target.value)}
            placeholder={status?.hasSecret ? "•••• já gravado - deixe vazio para manter" : "Cole o valor do segredo do cliente"}
            autoComplete="new-password"
            disabled={status?.fromEnv}
          />
        </Field>
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          disabled={busy || status?.fromEnv || clientId.trim().length < 12 || (!status?.hasSecret && clientSecret.trim().length < 12)}
          onClick={() => void guardar()}
          className="px-4 py-2.5 text-sm font-semibold rounded-lg bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white"
        >
          {busy ? "A gravar…" : status?.fromEnv ? "Definido no servidor" : "Gravar aplicação Microsoft"}
        </button>
      </div>
    </div>
  );
}

export function ConfiguracoesView() {
  const { settings, saveSettings } = useCatalogs();
  const [openId, setOpenId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState(seedConfigDrafts);
  const [saved, setSaved] = useState(false);
  const current = configCards.find(c => c.id === openId) ?? null;
  useEffect(() => {
    setDrafts(prev => {
      const next = { ...prev };
      for (const [id, values] of Object.entries(settings)) {
        if (values) next[id] = { ...next[id], ...values };
      }
      return next;
    });
  }, [settings]);

  function setField(id: string, label: string, value: string) {
    setDrafts(prev => ({ ...prev, [id]: { ...prev[id], [label]: value } }));
  }

  return (
    <>
      <div className="space-y-4">
        <PageHeader title="Configurações" sub={saved ? "Alterações guardadas na base." : "Parâmetros da entidade - a ENA gere por turmas, não por ação de formação."} />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <DriveSettingsCard />
          <MicrosoftSettingsCard />
          <WhatsappSettingsCard />
          {configCards.map(c => (
            <button key={c.id} type="button" onClick={() => setOpenId(c.id)}
              className={`text-left bg-white rounded-xl border shadow-sm p-5 hover:border-amber-300 hover:shadow-md transition-all ${openId === c.id ? "border-amber-400 ring-1 ring-amber-200" : "border-slate-200"}`}>
              <p className="text-sm font-bold text-slate-800">{c.titulo}</p>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">{c.texto}</p>
              <p className="text-xs font-semibold text-amber-600 mt-3">Abrir →</p>
            </button>
          ))}
        </div>
      </div>

      <AppModal
        open={!!current}
        onClose={() => setOpenId(null)}
        title={current?.titulo ?? "Configurações"}
        sub={current?.texto}
        size="md"
        footer={
          <>
            <button type="button" onClick={() => setOpenId(null)} className="px-4 py-2.5 text-sm font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">Cancelar</button>
            <button type="button" onClick={() => {
              if (current) saveSettings(current.id, drafts[current.id] ?? {});
              setSaved(true);
              setOpenId(null);
            }} className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 text-white">Guardar</button>
          </>
        }
      >
        {current && (
          <div className="p-5 space-y-3">
            {current.fields.map(f => (
              <Field key={f.label} label={f.label}>
                <input
                  className={iCls}
                  value={drafts[current.id]?.[f.label] ?? f.value}
                  onChange={e => setField(current.id, f.label, e.target.value)}
                />
              </Field>
            ))}
          </div>
        )}
      </AppModal>
    </>
  );
}
