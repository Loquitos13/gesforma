import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  apiCrmExport, apiCrmLeads, apiCrmLote,
  type CrmFila, type CrmLead, type CrmListQuery, type CrmListResult, type CrmSort,
} from "./api";
import { ClienteFicha } from "./ClienteFicha";
import { entradaChip, etiquetaChip, leadMarkStyle, meioChip } from "./crmUi";
import { AppModal, SearchSelect, ViewFilters, cursosGoldOpts, locaisOpts } from "./FormKit";
import { nextListId, useLists, type Preinscricao } from "./ListsContext";
import { ConfirmDangerModal, EmptyHint, MobileCard, RowActions } from "./SecretaryUX";
import { persist, toastError, toastOk } from "./toastBus";
import { TurmaInscricaoHint } from "./TurmaCronograma";
import { useTurmas } from "./TurmasContext";
import { hojeIso, turmaGoldOpts } from "./turmaModel";

const PREFS_KEY = "gesforma.crm.prefs";

const ESTADOS = ["Não contactado", "1º Contacto", "2º Contacto", "Pago", "Formando"] as const;

const COLS = [
  { id: "Não contactado", label: "Não contactado", color: "border-amber-400 bg-amber-50", dot: "bg-amber-400" },
  { id: "1º Contacto", label: "1.º Contacto", color: "border-blue-400 bg-blue-50", dot: "bg-blue-400" },
  { id: "2º Contacto", label: "2.º Contacto", color: "border-indigo-400 bg-indigo-50", dot: "bg-indigo-400" },
  { id: "Pago", label: "Pago", color: "border-teal-400 bg-teal-50", dot: "bg-teal-400" },
  { id: "Formando", label: "Formando", color: "border-emerald-400 bg-emerald-50", dot: "bg-emerald-400" },
];

const ic = {
  search: <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/></svg>,
  phone: <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/></svg>,
  wa: <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M10 2a8 8 0 00-6.32 12.89L2 18l3.24-1.61A8 8 0 1010 2zm3.9 11.15c-.16.46-.96.88-1.33.94-.34.05-.77.07-1.24-.08-.28-.09-.65-.21-1.12-.41-1.98-.86-3.27-2.86-3.37-3-.1-.13-.78-1.04-.78-1.99 0-.95.48-1.4.68-1.6.17-.16.37-.21.5-.21h.36c.11 0 .27-.04.42.32.16.39.55 1.35.6 1.45.05.1.08.21.02.33-.06.13-.1.21-.2.33l-.27.33c-.09.1-.18.2-.08.33.07.14.3.69.64 1.12.43.55.94.96 1.52 1.29.15.09.29.08.4-.04.12-.11.5-.58.63-.78.13-.2.27-.16.46-.1.18.06 1.16.55 1.36.65.2.1.33.15.38.23.05.09.05.51-.11 1z"/></svg>,
  eye: <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/></svg>,
  edit: <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>,
  trash: <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/></svg>,
  link: <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"/><path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"/></svg>,
  plus: <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd"/></svg>,
  list: <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/></svg>,
  kanban: <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M3 3h4v14H3V3zm5 0h4v9H8V3zm5 0h4v11h-4V3z"/></svg>,
  download: <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd"/></svg>,
};

function telDigits(telf: string) {
  const d = telf.replace(/\D/g, "");
  if (!d) return "";
  return d.startsWith("351") ? d : `351${d}`;
}

function nowStamp() {
  return new Date().toISOString().slice(0, 16).replace("T", " ");
}

function badge(estado: string) {
  const m: Record<string, string> = {
    "1º Contacto": "bg-blue-50 text-blue-700 border-blue-200",
    "2º Contacto": "bg-indigo-50 text-indigo-700 border-indigo-200",
    "Não contactado": "bg-amber-50 text-amber-700 border-amber-200",
    Pago: "bg-teal-50 text-teal-700 border-teal-200",
    Formando: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${m[estado] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>{estado}</span>;
}

function loadPrefs(): { view: "table" | "kanban"; perPage: number; sort: CrmSort } {
  try {
    const raw = sessionStorage.getItem(PREFS_KEY);
    if (!raw) return { view: "table", perPage: 50, sort: "inscrito" };
    const p = JSON.parse(raw) as { view?: string; perPage?: number; sort?: CrmSort };
    return {
      view: p.view === "kanban" ? "kanban" : "table",
      perPage: [25, 50, 100].includes(p.perPage ?? 0) ? p.perPage! : 50,
      sort: p.sort === "proximo" || p.sort === "valor" || p.sort === "nome" ? p.sort : "inscrito",
    };
  } catch {
    return { view: "table", perPage: 50, sort: "inscrito" };
  }
}

export function PreInscricoesGoldView({ openLeadId, onOpened }: { openLeadId?: number; onOpened?: () => void } = {}) {
  const prefs = useRef(loadPrefs()).current;
  const [viewMode, setViewMode] = useState<"table" | "kanban">(prefs.view);
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(prefs.perPage);
  const [sort, setSort] = useState<CrmSort>(prefs.sort);
  const [estado, setEstado] = useState("Todos");
  const [fila, setFila] = useState<CrmFila | "">("");
  const [curso, setCurso] = useState("");
  const [local, setLocal] = useState("");
  const [origem, setOrigem] = useState("");
  const [entrada, setEntrada] = useState<"" | "preinscricao" | "manual">("");
  const [data, setData] = useState<CrmListResult | null>(null);
  const [erro, setErro] = useState("");
  const [busy, setBusy] = useState(true);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const lastIdx = useRef<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [ficha, setFicha] = useState<CrmLead | null>(null);
  const [novo, setNovo] = useState(false);
  const [editLead, setEditLead] = useState<CrmLead | null>(null);
  const [apagar, setApagar] = useState<CrmLead | null>(null);
  const [loteEstado, setLoteEstado] = useState("2º Contacto");
  const [loteData, setLoteData] = useState("");
  const [form, setForm] = useState({ nome: "", apelido: "", email: "", telf: "", curso: "Formação de Formadores - CCP", turma: "", local: "V.N.Gaia", origem: "Telefone", nota: "" });

  const { gold, patchGold } = useTurmas();
  const {
    preinscricoes, addPreinscricao, patchPreinscricao, removePreinscricao, contactarPreinscricao,
    addFormandoTurma, formandosTurmas, cursosGold,
  } = useLists();

  const hoje = hojeIso();
  const query: CrmListQuery = useMemo(() => ({
    q, estado, curso, local, origem, entrada, fila, page, perPage, sort, kanban: viewMode === "kanban", hoje,
  }), [q, estado, curso, local, origem, entrada, fila, page, perPage, sort, viewMode, hoje]);

  useEffect(() => {
    const t = window.setTimeout(() => { setQ(qInput.trim()); setPage(1); }, 280);
    return () => window.clearTimeout(t);
  }, [qInput]);

  useEffect(() => {
    sessionStorage.setItem(PREFS_KEY, JSON.stringify({ view: viewMode, perPage, sort }));
  }, [viewMode, perPage, sort]);

  const carregar = useCallback(() => {
    setBusy(true);
    setErro("");
    apiCrmLeads(query)
      .then(r => { setData(r); setBusy(false); setSel(new Set()); })
      .catch(() => {
        setErro("A lista paginada não respondeu; a mostrar o que já está em memória.");
        setBusy(false);
      });
  }, [query]);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    if (!openLeadId) return;
    const fromList = preinscricoes.find(l => l.id === openLeadId);
    const fromPage = data?.items.find(l => l.id === openLeadId);
    if (fromPage) {
      setFicha(fromPage);
      onOpened?.();
      return;
    }
    if (fromList) {
      setFicha(fromList as CrmLead);
      onOpened?.();
      return;
    }
    apiCrmLeads({ q: String(openLeadId), perPage: 20, page: 1, sort: "inscrito" })
      .then(r => {
        const hit = r.items.find(x => x.id === openLeadId);
        if (hit) setFicha(hit);
      })
      .finally(() => onOpened?.());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openLeadId, data, preinscricoes]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        if (e.key === "Escape") (e.target as HTMLElement).blur();
        return;
      }
      if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

  const items = data?.items ?? [];
  const counts = data?.counts ?? {
    total: preinscricoes.length, abertos: 0, porContactar: 0, conversa: 0,
    pagos: 0, formando: 0, atrasados: 0, hoje: 0, converter: 0, valorAberto: 0, preinscricoes: 0, manuais: 0,
  };
  const facets = data?.facets ?? { cursos: [], locais: [], origens: [], campanhas: [] };
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  function openFicha(item: CrmLead) { setFicha(item); }
  function resetForm(lead?: CrmLead) {
    setForm({
      nome: lead?.nome ?? "",
      apelido: lead?.apelido ?? "",
      email: lead?.email ?? "",
      telf: lead?.telf ?? "",
      curso: lead?.curso ?? "Formação de Formadores - CCP",
      turma: turmaGoldOpts(gold, { curso: lead?.curso ?? "Formação de Formadores - CCP" })[0]?.value ?? "",
      local: lead?.local ?? "V.N.Gaia",
      origem: lead?.origem && lead.entrada === "manual" ? lead.origem : "Telefone",
      nota: "",
    });
  }

  function toggleSel(id: number, idx: number, shift: boolean) {
    setSel(prev => {
      const next = new Set(prev);
      if (shift && lastIdx.current != null) {
        const a = Math.min(lastIdx.current, idx);
        const b = Math.max(lastIdx.current, idx);
        for (let i = a; i <= b; i++) next.add(items[i].id);
      } else if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    lastIdx.current = idx;
  }

  function toggleAll() {
    if (sel.size === items.length) setSel(new Set());
    else setSel(new Set(items.map(x => x.id)));
  }

  async function lote(acao: "contactar" | "estado" | "seguimento", extra?: { estado?: string; proximoContacto?: string }) {
    const ids = [...sel];
    if (!ids.length) return;
    try {
      const r = await persist(apiCrmLote({ ids, acao, ...extra }));
      if (!r) return;
      toastOk(`${r.updated} leads actualizados.`);
      setSel(new Set());
      carregar();
    } catch (err) {
      toastError(err, "Não foi possível aplicar a acção em lote.");
    }
  }

  async function copiarFormulario() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/pre-inscricao`);
      toastOk("Ligação do formulário público copiada.");
    } catch {
      toastError("Não foi possível copiar. Abra /pre-inscricao.");
    }
  }

  const fichaIdx = ficha ? items.findIndex(x => x.id === ficha.id) : -1;

  return (
    <>
      <div className="space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-800 leading-tight">CRM</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Dois inputs: o formulário de pré-inscrição e o registo manual (telefone, WhatsApp, balcão). {counts.total.toLocaleString("pt-PT")} leads na base.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button type="button" onClick={() => void apiCrmExport(query).then(() => toastOk("CSV descarregado (máx. 2 000).")).catch(e => toastError(e, "Exportação falhou."))}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5">{ic.download} CSV</button>
            <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden">
              <button type="button" onClick={() => { setViewMode("table"); setPage(1); }} className={`px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5 ${viewMode === "table" ? "bg-amber-500 text-white" : "text-slate-500 hover:bg-slate-50"}`}>{ic.list} Lista</button>
              <button type="button" onClick={() => { setViewMode("kanban"); setPage(1); }} className={`px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5 ${viewMode === "kanban" ? "bg-amber-500 text-white" : "text-slate-500 hover:bg-slate-50"}`}>{ic.kanban} Pipeline</button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div className={`rounded-xl border px-4 py-3 ${entrada === "preinscricao" ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-white"}`}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Input 1 · principal</p>
            <p className="text-sm font-bold text-slate-800 mt-0.5">Pré-inscrição</p>
            <p className="text-xs text-slate-500 mt-1">O pedido do site entra sozinho na fila. {counts.preinscricoes.toLocaleString("pt-PT")} nesta base.</p>
            <div className="flex gap-2 mt-3">
              <button type="button" onClick={() => void copiarFormulario()} className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 inline-flex items-center gap-1.5">{ic.link} Copiar ligação</button>
              <a href="/pre-inscricao" target="_blank" rel="noreferrer" className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50">Abrir formulário</a>
              <button type="button" onClick={() => { setEntrada(entrada === "preinscricao" ? "" : "preinscricao"); setPage(1); }} className="ml-auto px-3 py-1.5 text-xs font-semibold text-amber-800">{entrada === "preinscricao" ? "Ver todas" : "Filtrar estas"}</button>
            </div>
          </div>
          <div className={`rounded-xl border px-4 py-3 ${entrada === "manual" ? "border-sky-400 bg-sky-50" : "border-slate-200 bg-white"}`}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Input 2</p>
            <p className="text-sm font-bold text-slate-800 mt-0.5">Lead manual</p>
            <p className="text-xs text-slate-500 mt-1">Quem ligou, escreveu ou passou no balcão. {counts.manuais.toLocaleString("pt-PT")} registadas à mão, com nota comercial.</p>
            <div className="flex gap-2 mt-3">
              <button type="button" onClick={() => { setEditLead(null); resetForm(); setNovo(true); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg">{ic.plus} Nova lead</button>
              <button type="button" onClick={() => { setEntrada(entrada === "manual" ? "" : "manual"); setPage(1); }} className="ml-auto px-3 py-1.5 text-xs font-semibold text-sky-800">{entrada === "manual" ? "Ver todas" : "Filtrar estas"}</button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
          {[
            { label: "Na base", value: counts.total.toLocaleString("pt-PT"), sub: `${counts.abertos.toLocaleString("pt-PT")} abertos`, tone: "text-slate-800", onClick: () => { setFila("abertos"); setEstado("Todos"); setPage(1); setViewMode("table"); } },
            { label: "Por contactar", value: String(counts.porContactar), sub: `${counts.atrasados} em atraso`, tone: counts.atrasados ? "text-red-600" : "text-amber-600", onClick: () => { setFila("contactar"); setEstado("Todos"); setPage(1); setViewMode("table"); } },
            { label: "Em conversa", value: String(counts.conversa), sub: `${counts.pagos} pagos`, tone: "text-blue-600", onClick: () => { setFila(""); setEstado("1º Contacto"); setPage(1); setViewMode("table"); } },
            { label: "Convertidos", value: String(counts.formando), sub: `€ ${Math.round(counts.valorAberto).toLocaleString("pt-PT")} aberto`, tone: "text-emerald-600", onClick: () => { setFila(""); setEstado("Formando"); setPage(1); setViewMode("table"); } },
          ].map(c => (
            <button key={c.label} type="button" onClick={c.onClick} className="text-left bg-white rounded-xl border border-slate-200 px-3.5 py-3 hover:border-amber-300">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{c.label}</p>
              <p className={`text-2xl font-bold mt-0.5 ${c.tone}`}>{c.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{c.sub}</p>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <FilaBtn active={fila === "contactar"} tone="amber" title={`${counts.porContactar} por contactar`} sub="Primeiro trabalho do dia" onClick={() => { setFila(fila === "contactar" ? "" : "contactar"); setEstado("Todos"); setPage(1); setViewMode("table"); }} />
          <FilaBtn active={fila === "atrasados"} tone={counts.atrasados ? "red" : "slate"} title={`${counts.atrasados} atrasados`} sub={counts.hoje ? `${counts.hoje} marcados para hoje` : "Follow-up em atraso"} onClick={() => { setFila(fila === "atrasados" ? "" : "atrasados"); setEstado("Todos"); setPage(1); setViewMode("table"); }} />
          <FilaBtn active={fila === "converter"} tone="teal" title={`${counts.converter} a converter`} sub="Pagos a inscrever na turma" onClick={() => { setFila(fila === "converter" ? "" : "converter"); setEstado("Todos"); setPage(1); setViewMode("table"); }} />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-3">
          <div className="flex flex-col md:flex-row gap-2 md:items-center">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{ic.search}</span>
              <input ref={searchRef} value={qInput} onChange={e => setQInput(e.target.value)}
                placeholder="Nome, email, telemóvel, curso ou nº do lead…  (atalho /)"
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <select value={sort} onChange={e => { setSort(e.target.value as CrmSort); setPage(1); }}
              className="text-xs border border-slate-200 rounded-lg px-2 py-2 bg-white">
              <option value="inscrito">Mais recentes</option>
              <option value="proximo">Próximo contacto</option>
              <option value="valor">Valor</option>
              <option value="nome">Nome A–Z</option>
            </select>
            {viewMode === "table" && (
              <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}
                className="text-xs border border-slate-200 rounded-lg px-2 py-2 bg-white">
                {[25, 50, 100].map(n => <option key={n} value={n}>{n} / pág.</option>)}
              </select>
            )}
          </div>
          <ViewFilters
            fields={[
              { label: "Curso", value: curso, onChange: v => { setCurso(v); setPage(1); }, options: facets.cursos.length ? facets.cursos.map(x => ({ value: x })) : cursosGoldOpts },
              { label: "Local", value: local, onChange: v => { setLocal(v); setPage(1); }, options: facets.locais.length ? facets.locais.map(x => ({ value: x })) : locaisOpts },
              { label: "Origem", value: origem, onChange: v => { setOrigem(v); setPage(1); }, options: facets.origens.map(x => ({ value: x })) },
            ]}
            chips={{ options: ["Todos", ...ESTADOS], value: estado, onChange: v => { setEstado(v); setFila(""); setPage(1); } }}
            onClear={() => { setCurso(""); setLocal(""); setOrigem(""); setEstado("Todos"); setFila(""); setEntrada(""); setQInput(""); setQ(""); setPage(1); }}
          />
        </div>

        {erro && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{erro}</p>}

        {sel.size > 0 && (
          <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 bg-amber-50 text-slate-800 rounded-xl px-3 py-2.5 border border-amber-200 shadow-sm" style={{ colorScheme: "light" }}>
            <p className="text-xs font-semibold mr-2">{sel.size} seleccionados</p>
            <button type="button" onClick={() => void lote("contactar")} className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-amber-200 hover:bg-amber-100">Marcar contactados</button>
            <span className="flex items-center gap-1">
              <select value={loteEstado} onChange={e => setLoteEstado(e.target.value)} className="text-xs rounded-lg bg-white text-slate-800 px-2 py-1 border border-slate-200">
                {ESTADOS.filter(e => e !== "Formando").map(e => <option key={e}>{e}</option>)}
              </select>
              <button type="button" onClick={() => void lote("estado", { estado: loteEstado })} className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-amber-200 hover:bg-amber-100">Passar etapa</button>
            </span>
            <span className="flex items-center gap-1">
              <input type="date" value={loteData} onChange={e => setLoteData(e.target.value)} className="text-xs rounded-lg bg-white text-slate-800 px-2 py-1 border border-slate-200" />
              <button type="button" disabled={!loteData} onClick={() => void lote("seguimento", { proximoContacto: loteData })} className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-amber-200 hover:bg-amber-100 disabled:opacity-40">Agendar</button>
            </span>
            <button type="button" onClick={() => setSel(new Set())} className="ml-auto text-xs text-slate-500 hover:text-slate-800">Limpar</button>
          </div>
        )}

        {viewMode === "kanban" ? (
          <Kanban
            columns={data?.columns ?? COLS.map(c => ({ estado: c.id, total: data?.porEstado[c.id] ?? 0, items: items.filter(i => i.estado === c.id).slice(0, 20) }))}
            busy={busy}
            onOpen={openFicha}
            onMove={(id, est) => { patchPreinscricao(id, { estado: est }); toastOk("Etapa actualizada."); setTimeout(carregar, 200); }}
          />
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {busy && items.length === 0 && <p className="text-sm text-slate-400 text-center py-10">A carregar a página…</p>}
            {!busy && items.length === 0 && (
              <EmptyHint
                text={counts.total === 0 ? "Ainda sem leads. Cole o formulário público no site ou registe um pedido de telefone." : "Nenhum lead neste filtro."}
                action={counts.total === 0 ? "Novo lead" : "Limpar filtros"}
                onAction={counts.total === 0 ? () => { setEditLead(null); resetForm(); setNovo(true); } : () => { setCurso(""); setLocal(""); setOrigem(""); setEstado("Todos"); setFila(""); setEntrada(""); setQInput(""); setQ(""); setPage(1); }}
              />
            )}
            <div className="md:hidden p-3 space-y-2">
              {items.map((r, idx) => (
                <div key={r.id} className="flex gap-2 items-start">
                  <input type="checkbox" className="mt-3" checked={sel.has(r.id)} onChange={e => toggleSel(r.id, idx, (e.nativeEvent as MouseEvent).shiftKey)} />
                  <div className="flex-1 min-w-0">
                    <MobileCard
                      title={`${r.nome} ${r.apelido}`}
                      sub={r.curso}
                      badge={badge(r.estado)}
                      meta={[r.entrada === "manual" ? "Manual" : "Pré-inscrição", r.meioContacto || "sem meio", r.etiquetaNome || "sem etiqueta", r.local, `€ ${r.preco}`]}
                      onOpen={() => openFicha(r)}
                      actions={[
                        ...(r.estado === "Não contactado" ? [{ label: "Contactar", icon: ic.phone, onClick: () => { contactarPreinscricao(r.id); openFicha({ ...r, estado: "1º Contacto" }); } }] : []),
                        { label: "Ficha", icon: ic.eye, onClick: () => openFicha(r) },
                        { label: "Editar", icon: ic.edit, onClick: () => { setEditLead(r); resetForm(r); setNovo(true); } },
                        { label: "Eliminar", icon: ic.trash, tone: "red" as const, onClick: () => setApagar(r) },
                      ]}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden md:block overflow-auto max-h-[min(72vh,720px)]">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 px-3 py-2 w-10">
                      <input type="checkbox" checked={items.length > 0 && sel.size === items.length} onChange={toggleAll} aria-label="Seleccionar página" />
                    </th>
                    {["Lead", "Origem", "Meio", "Etiqueta", "Inscrito", "Curso", "Local", "Valor", "Seguimento", "Estado", ""].map(h => (
                      <th key={h} className="sticky top-0 z-10 text-left px-3 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wide bg-slate-50 border-b border-slate-200 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((r, idx) => {
                    const late = Boolean(r.proximoContacto && r.proximoContacto < hoje && r.estado !== "Pago" && r.estado !== "Formando");
                    return (
                      <tr key={r.id} className={`hover:brightness-[0.98] ${sel.has(r.id) ? "ring-1 ring-amber-300" : ""}`}
                        style={leadMarkStyle(r.etiquetaCor)}>
                        <td className="px-3 py-1.5">
                          <input type="checkbox" checked={sel.has(r.id)} onChange={e => toggleSel(r.id, idx, (e.nativeEvent as MouseEvent).shiftKey)} aria-label={`Seleccionar ${r.nome}`} />
                        </td>
                        <td className="px-3 py-1.5">
                          <button type="button" onClick={() => openFicha(r)} className="text-left">
                            <p className="text-xs font-semibold text-blue-700 hover:text-blue-900">{r.nome} {r.apelido}</p>
                            <p className="text-[11px] text-slate-500 truncate max-w-[220px]">{r.email} · {r.telf}</p>
                          </button>
                        </td>
                        <td className="px-3 py-1.5">{entradaChip(r.entrada)}</td>
                        <td className="px-3 py-1.5">{meioChip(r.meioContacto)}</td>
                        <td className="px-3 py-1.5">{etiquetaChip(r.etiquetaNome, r.etiquetaCor) ?? <span className="text-[11px] text-slate-400">—</span>}</td>
                        <td className="px-3 py-1.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">{r.inscrito.slice(0, 16)}</td>
                        <td className="px-3 py-1.5 text-xs text-slate-600 max-w-[180px] truncate" title={r.curso}>{r.curso}</td>
                        <td className="px-3 py-1.5 text-xs text-slate-600 whitespace-nowrap">{r.local}</td>
                        <td className="px-3 py-1.5 text-xs font-bold text-amber-600 whitespace-nowrap">€ {r.preco}</td>
                        <td className={`px-3 py-1.5 text-[11px] whitespace-nowrap ${late ? "font-bold text-red-600" : "text-slate-500"}`}>
                          {r.proximoContacto || "-"}
                        </td>
                        <td className="px-3 py-1.5">{badge(r.estado)}</td>
                        <td className="px-3 py-1.5">
                          <RowActions primary={1} actions={[
                            ...(r.estado === "Não contactado" ? [{ label: "Contactar", icon: ic.phone, onClick: () => { contactarPreinscricao(r.id); setFicha({ ...r, estado: "1º Contacto" }); } }] : []),
                            { label: "Ficha", icon: ic.eye, onClick: () => openFicha(r) },
                            { label: "Editar", icon: ic.edit, onClick: () => { setEditLead(r); resetForm(r); setNovo(true); } },
                            { label: "Eliminar", icon: ic.trash, tone: "red" as const, onClick: () => setApagar(r) },
                          ]} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2.5 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                {busy ? "A actualizar…" : <>A mostrar <strong className="text-slate-700">{from}–{to}</strong> de <strong className="text-slate-700">{total.toLocaleString("pt-PT")}</strong> neste filtro</>}
              </p>
              <div className="flex items-center gap-1">
                <button type="button" disabled={page <= 1} onClick={() => setPage(1)} className="px-2 py-1 text-xs border rounded-lg disabled:opacity-40">«</button>
                <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-2 py-1 text-xs border rounded-lg disabled:opacity-40">‹</button>
                <span className="text-xs text-slate-600 px-2">{page} / {pages}</span>
                <button type="button" disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="px-2 py-1 text-xs border rounded-lg disabled:opacity-40">›</button>
                <button type="button" disabled={page >= pages} onClick={() => setPage(pages)} className="px-2 py-1 text-xs border rounded-lg disabled:opacity-40">»</button>
              </div>
            </div>
          </div>
        )}
        <p className="text-[11px] text-slate-400">Shift+clique selecciona um intervalo. / foca a pesquisa. O pipeline mostra no máximo 20 cartões por etapa - use a lista para o resto.</p>
      </div>

      <ClienteFicha
        item={ficha}
        onClose={() => setFicha(null)}
        hasPrev={fichaIdx > 0}
        hasNext={fichaIdx >= 0 && fichaIdx < items.length - 1}
        onPrev={() => { if (fichaIdx > 0) setFicha(items[fichaIdx - 1]); }}
        onNext={() => { if (fichaIdx >= 0 && fichaIdx < items.length - 1) setFicha(items[fichaIdx + 1]); }}
        onContactar={(nota, meio) => {
          if (!ficha) return;
          contactarPreinscricao(ficha.id, nota, meio);
          setFicha({ ...ficha, estado: ficha.estado === "Não contactado" ? "1º Contacto" : ficha.estado, notas: nota, meioContacto: meio || ficha.meioContacto });
          setTimeout(carregar, 250);
        }}
        onPatch={patch => {
          if (!ficha) return;
          patchPreinscricao(ficha.id, patch);
          setFicha({ ...ficha, ...patch });
          setTimeout(carregar, 250);
        }}
        onConvert={turmaNome => {
          if (!ficha) return;
          const t = gold.find(x => x.nome === turmaNome);
          if (!t || t.vagas - t.totalAlunos <= 0) return;
          addFormandoTurma({
            id: nextListId(formandosTurmas),
            nome: ficha.nome, apelido: ficha.apelido, telf: ficha.telf, email: ficha.email,
            inscrito: nowStamp(), local: t.local, curso: t.curso, turma: t.nome, turmaId: t.id,
            estado: "Formando", pago: ficha.estado === "Pago", valor: ficha.preco, metodo: "-",
          });
          patchGold(t.id, { totalAlunos: t.totalAlunos + 1 });
          patchPreinscricao(ficha.id, { estado: "Formando" });
          setFicha({ ...ficha, estado: "Formando" });
          setTimeout(carregar, 250);
        }}
      />

      <ConfirmDangerModal
        open={!!apagar}
        onClose={() => setApagar(null)}
        title="Eliminar lead"
        body={apagar ? `Remover ${apagar.nome} ${apagar.apelido} da fila comercial?` : ""}
        risk="Sai da lista de contacto. Prefira deixar o histórico se ainda puder converter."
        onConfirm={() => { if (apagar) { removePreinscricao(apagar.id); setTimeout(carregar, 200); } }}
      />

      <AppModal open={novo} onClose={() => { setNovo(false); setEditLead(null); }} title={editLead ? `Editar ${editLead.nome}` : "Lead manual"} sub={editLead ? "Actualiza os dados da ficha" : "Telefone, WhatsApp ou balcão — entra na fila com a primeira nota comercial"} size="lg">
        <div className="p-5 space-y-3">
          {!editLead && (
            <p className="text-xs text-slate-600 bg-sky-50 border border-sky-100 rounded-lg px-3 py-2">
              Os pedidos do site entram pelo formulário de pré-inscrição. Use este ecrã só para quem contactou a ENA fora do site.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex flex-col gap-1.5">Nome
              <input className={inp} value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
            </label>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex flex-col gap-1.5">Apelido
              <input className={inp} value={form.apelido} onChange={e => setForm(f => ({ ...f, apelido: e.target.value }))} />
            </label>
          </div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex flex-col gap-1.5">Email
            <input className={inp} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </label>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex flex-col gap-1.5">Telemóvel
            <input className={inp} value={form.telf} onChange={e => setForm(f => ({ ...f, telf: e.target.value }))} />
          </label>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex flex-col gap-1.5">Como entrou em contacto
            <select className={inp} value={form.origem} onChange={e => setForm(f => ({ ...f, origem: e.target.value }))}>
              {["Telefone", "WhatsApp", "Email", "Balcão", "Indicação"].map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex flex-col gap-1.5">Curso
            <SearchSelect value={form.curso} onChange={v => setForm(f => ({ ...f, curso: v, turma: "" }))} options={cursosGoldOpts} placeholder="Pesquisar curso…" />
          </label>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex flex-col gap-1.5">Turma
            <SearchSelect value={form.turma} onChange={v => setForm(f => ({ ...f, turma: v }))} options={turmaGoldOpts(gold, { curso: form.curso || undefined })} placeholder="Só turmas ativas…" empty="Não há turmas ativas para este curso." />
          </label>
          <TurmaInscricaoHint optsLen={turmaGoldOpts(gold, { curso: form.curso || undefined }).length} curso={form.curso || undefined} />
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex flex-col gap-1.5">Local
            <SearchSelect value={form.local} onChange={v => setForm(f => ({ ...f, local: v }))} options={locaisOpts} placeholder="Pesquisar local…" />
          </label>
          {!editLead && (
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex flex-col gap-1.5">Nota comercial
              <textarea className={`${inp} resize-none`} rows={3} value={form.nota} onChange={e => setForm(f => ({ ...f, nota: e.target.value }))}
                placeholder="O que pediu, horário, objecção, quem atendeu…" />
            </label>
          )}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => { setNovo(false); setEditLead(null); }} className="flex-1 py-2 border border-slate-200 text-sm text-slate-600 rounded-lg">Cancelar</button>
            <button type="button" disabled={!form.nome.trim()} onClick={() => {
              const cursoRow = cursosGold.find(c => c.nome === form.curso);
              const t = gold.find(x => x.nome === form.turma);
              const row: Preinscricao = {
                id: editLead?.id ?? nextListId(preinscricoes),
                inscrito: editLead?.inscrito ?? nowStamp(),
                nome: form.nome.trim(), apelido: form.apelido.trim(),
                email: form.email.trim() || `${form.nome.trim().toLowerCase().replace(/\s+/g, ".")}@mail.pt`,
                telf: form.telf.trim() || "-",
                inicioCurso: t?.dataInicio ?? editLead?.inicioCurso ?? "-",
                concelho: editLead?.concelho ?? "",
                local: form.local || t?.local || "V.N.Gaia",
                curso: form.curso || "Formação de Formadores - CCP",
                preco: cursoRow?.preco ?? editLead?.preco ?? 125,
                estado: editLead?.estado ?? "Não contactado",
                campanha: editLead?.campanha ?? "",
                origem: form.origem || "Telefone",
                entrada: editLead?.entrada ?? "manual",
              };
              if (editLead) patchPreinscricao(editLead.id, row);
              else addPreinscricao(row, { nota: form.nota.trim() });
              setNovo(false); setEditLead(null);
              setTimeout(carregar, 250);
            }} className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white text-sm font-semibold rounded-lg">{editLead ? "Guardar" : "Criar lead"}</button>
          </div>
        </div>
      </AppModal>
    </>
  );
}

const inp = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400";

function FilaBtn({ active, tone, title, sub, onClick }: { active: boolean; tone: "amber" | "red" | "teal" | "slate"; title: string; sub: string; onClick: () => void }) {
  const cls = {
    amber: active ? "border-amber-400 bg-amber-100" : "border-amber-200 bg-amber-50",
    red: active ? "border-red-400 bg-red-100" : "border-red-200 bg-red-50",
    teal: active ? "border-teal-400 bg-teal-100" : "border-teal-200 bg-teal-50",
    slate: "border-slate-200 bg-white",
  }[tone];
  const titleCls = { amber: "text-amber-800", red: "text-red-700", teal: "text-teal-800", slate: "text-slate-700" }[tone];
  return (
    <button type="button" onClick={onClick} className={`text-left rounded-xl border px-3.5 py-3 hover:shadow-sm ${cls}`}>
      <p className={`text-sm font-bold ${titleCls}`}>{title}</p>
      <p className="text-xs text-slate-600 mt-0.5">{sub}</p>
    </button>
  );
}

function Kanban({
  columns, busy, onOpen, onMove,
}: {
  columns: { estado: string; total: number; items: CrmLead[] }[];
  busy: boolean;
  onOpen: (item: CrmLead) => void;
  onMove: (id: number, estado: string) => void;
}) {
  const [dragId, setDragId] = useState<number | null>(null);
  const [over, setOver] = useState<string | null>(null);
  return (
    <div className="flex gap-3 overflow-x-auto pb-4 min-h-[420px]">
      {COLS.map(col => {
        const pack = columns.find(c => c.estado === col.id) ?? { estado: col.id, total: 0, items: [] };
        return (
          <div key={col.id}
            className={`flex-shrink-0 w-64 rounded-xl border-t-4 ${col.color} ${over === col.id ? "ring-2 ring-amber-400" : ""}`}
            onDragOver={e => { e.preventDefault(); setOver(col.id); }}
            onDragLeave={() => setOver(null)}
            onDrop={() => { if (dragId != null) onMove(dragId, col.id); setDragId(null); setOver(null); }}
          >
            <div className="px-3 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                <span className="text-xs font-bold text-slate-700">{col.label}</span>
              </div>
              <span className="text-xs font-bold text-slate-500 bg-white px-1.5 py-0.5 rounded-full">{pack.total.toLocaleString("pt-PT")}</span>
            </div>
            <div className="px-2 pb-2 space-y-2">
              {busy && pack.items.length === 0 && <p className="py-6 text-center text-xs text-slate-400">A carregar…</p>}
              {pack.items.map(item => {
                const wa = telDigits(item.telf);
                return (
                  <div key={item.id} draggable onDragStart={() => setDragId(item.id)}>
                    <button type="button" onClick={() => onOpen(item)}
                      className="w-full text-left rounded-xl border shadow-sm p-3 hover:brightness-[0.98]"
                      style={{
                        ...leadMarkStyle(item.etiquetaCor),
                        borderColor: item.etiquetaCor || undefined,
                      }}>
                      <div className="flex items-start justify-between gap-1">
                        <p className="text-xs font-bold text-slate-800 leading-snug">{item.nome} {item.apelido}</p>
                        <span className="text-xs font-bold text-amber-600">€ {item.preco}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {entradaChip(item.entrada)}
                        {etiquetaChip(item.etiquetaNome, item.etiquetaCor)}
                      </div>
                      {item.meioContacto ? <p className="text-[11px] text-slate-600 mt-1">Meio: {item.meioContacto}</p> : null}
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{item.curso}</p>
                      <div className="flex gap-2 mt-2">
                        <a href={`tel:${item.telf}`} onClick={e => e.stopPropagation()} className="flex-1 py-1 text-center bg-slate-100 text-slate-700 text-xs font-medium rounded-lg inline-flex items-center justify-center gap-1">{ic.phone} Ligar</a>
                        {wa && <a href={`https://wa.me/${wa}`} onClick={e => e.stopPropagation()} className="flex-1 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-lg inline-flex items-center justify-center gap-1">{ic.wa} WA</a>}
                      </div>
                    </button>
                  </div>
                );
              })}
              {!busy && pack.items.length === 0 && <div className="py-8 text-center text-xs text-slate-400">Nenhum nesta amostra.</div>}
              {pack.total > pack.items.length && (
                <p className="text-[11px] text-center text-slate-500 py-1">+ {(pack.total - pack.items.length).toLocaleString("pt-PT")} nesta etapa. Abra a lista.</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function crmLeadToSearchRow(l: CrmLead) {
  return { tipo: "CRM" as const, nome: `${l.nome} ${l.apelido}`, sub: `${l.curso || "sem curso"} · ${l.estado}` };
}
