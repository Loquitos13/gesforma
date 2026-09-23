import { useState, useMemo } from "react";
import { AppModal } from "./FormKit";
import {
  INITIAL_LEADS,
  INITIAL_NOTAS,
  INITIAL_PARCEIROS,
  CRM_LEAD_STAGES,
  type Lead,
  type LeadStage,
  type NotaComercial,
  type NotaTipo,
  type Parceiro,
  type TipoParceria,
} from "./crmModel";

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
  phone: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
    </svg>
  ),
  mail: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
      <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
    </svg>
  ),
  whatsapp: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.529 5.855L0 24l6.335-1.502A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.651-.51-5.168-1.399l-.371-.22-3.766.893.936-3.652-.242-.381A9.945 9.945 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
    </svg>
  ),
  note: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
      <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
    </svg>
  ),
  building: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4zm3 1h2v2H7V5zm4 0h2v2h-2V5zm-4 4h2v2H7V9zm4 0h2v2h-2V9zm-4 4h2v2H7v-2zm4 0h2v2h-2v-2z" clipRule="evenodd" />
    </svg>
  ),
  kanban: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M2 4a1 1 0 011-1h3a1 1 0 011 1v12a1 1 0 01-1 1H3a1 1 0 01-1-1V4zm6 0a1 1 0 011-1h3a1 1 0 011 1v7a1 1 0 01-1 1H9a1 1 0 01-1-1V4zm7-1a1 1 0 00-1 1v4a1 1 0 001 1h2a1 1 0 001-1V4a1 1 0 00-1-1h-2z" />
    </svg>
  ),
  list: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
    </svg>
  ),
  arrowRight: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  ),
  tag: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
  ),
};

export type CrmTab = "leads" | "notas" | "parceiros";

export function CrmMainView({
  initialTab = "leads",
  onNavigateTab,
}: {
  initialTab?: CrmTab;
  onNavigateTab?: (tab: CrmTab) => void;
}) {
  const [activeTab, setActiveTab] = useState<CrmTab>(initialTab);

  // Synchronize initialTab if parent changes
  useMemo(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  function switchTab(t: CrmTab) {
    setActiveTab(t);
    onNavigateTab?.(t);
  }

  // Shared CRM States
  const [leads, setLeads] = useState<Lead[]>(INITIAL_LEADS);
  const [notas, setNotas] = useState<NotaComercial[]>(INITIAL_NOTAS);
  const [parceiros, setParceiros] = useState<Parceiro[]>(INITIAL_PARCEIROS);

  // Global Toast Feedback
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  function notify(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  }

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg border border-slate-700 flex items-center gap-2 text-sm">
          <span className="text-emerald-400">{I.check}</span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Main CRM Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-1 bg-white p-1.5 rounded-xl shadow-sm border">
        <button
          onClick={() => switchTab("leads")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
            activeTab === "leads"
              ? "bg-amber-500 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          {I.users} Leads e Pipeline ({leads.length})
        </button>
        <button
          onClick={() => switchTab("notas")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
            activeTab === "notas"
              ? "bg-amber-500 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          {I.note} Notas Comerciais ({notas.length})
        </button>
        <button
          onClick={() => switchTab("parceiros")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
            activeTab === "parceiros"
              ? "bg-amber-500 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          {I.building} Parceiros e Protocolos ({parceiros.length})
        </button>
      </div>

      {/* Sub Views */}
      {activeTab === "leads" && (
        <CrmLeadsSection
          leads={leads}
          setLeads={setLeads}
          notas={notas}
          setNotas={setNotas}
          parceiros={parceiros}
          notify={notify}
        />
      )}

      {activeTab === "notas" && (
        <CrmNotasSection
          notas={notas}
          setNotas={setNotas}
          leads={leads}
          parceiros={parceiros}
          notify={notify}
        />
      )}

      {activeTab === "parceiros" && (
        <CrmParceirosSection
          parceiros={parceiros}
          setParceiros={setParceiros}
          notas={notas}
          setNotas={setNotas}
          notify={notify}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. LEADS & PIPELINE SECTION
// ─────────────────────────────────────────────────────────────────────────────

function CrmLeadsSection({
  leads,
  setLeads,
  notas,
  setNotas,
  parceiros,
  notify,
}: {
  leads: Lead[];
  setLeads: React.Dispatch<React.SetStateAction<Lead[]>>;
  notas: NotaComercial[];
  setNotas: React.Dispatch<React.SetStateAction<NotaComercial[]>>;
  parceiros: Parceiro[];
  notify: (msg: string) => void;
}) {
  const [viewMode, setViewMode] = useState<"kanban" | "tabela">("kanban");
  const [search, setSearch] = useState("");
  const [filtroEtapa, setFiltroEtapa] = useState<string>("Todas");
  const [filtroRegime, setFiltroRegime] = useState<string>("Todos");

  // Lead Modals
  const [modalLeadOpen, setModalLeadOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);

  // Quick Note Modal from Lead
  const [quickNoteLead, setQuickNoteLead] = useState<Lead | null>(null);
  const [noteTipo, setNoteTipo] = useState<NotaTipo>("Chamada");
  const [noteTitulo, setNoteTitulo] = useState("");
  const [noteConteudo, setNoteConteudo] = useState("");
  const [noteFollowUp, setNoteFollowUp] = useState(true);
  const [noteDataFollowUp, setNoteDataFollowUp] = useState("2026-09-25 10:00");
  const [notePrioridade, setNotePrioridade] = useState<"Alta" | "Média" | "Baixa">("Média");

  // Lead Form State
  const [formNome, setFormNome] = useState("");
  const [formApelido, setFormApelido] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formTelefone, setFormTelefone] = useState("");
  const [formCurso, setFormCurso] = useState("Formação de Formadores - CCP");
  const [formRegime, setFormRegime] = useState<"Gold" | "Financiada">("Gold");
  const [formValor, setFormValor] = useState("125");
  const [formEtapa, setFormEtapa] = useState<LeadStage>("Nova");
  const [formOrigem, setFormOrigem] = useState<Lead["origem"]>("Website");
  const [formResponsavel, setFormResponsavel] = useState("Carlos Aguilar");
  const [formParceiroId, setFormParceiroId] = useState("");
  const [formObs, setFormObs] = useState("");
  const [formError, setFormError] = useState("");

  // KPIs
  const totalPipelineVal = useMemo(() => {
    return leads
      .filter(l => l.etapa !== "Perdido")
      .reduce((acc, l) => acc + (l.valorPrevisto || 0), 0);
  }, [leads]);

  const activeLeadsCount = useMemo(() => {
    return leads.filter(l => l.etapa !== "Ganho" && l.etapa !== "Perdido").length;
  }, [leads]);

  const convertedCount = useMemo(() => {
    return leads.filter(l => l.etapa === "Ganho").length;
  }, [leads]);

  const conversionRate = useMemo(() => {
    if (leads.length === 0) return 0;
    return Math.round((convertedCount / leads.length) * 100);
  }, [leads, convertedCount]);

  // Filtering
  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      const matchSearch =
        `${l.nome} ${l.apelido} ${l.email} ${l.telefone} ${l.cursoInteresse} ${l.responsavel}`
          .toLowerCase()
          .includes(search.toLowerCase());
      const matchEtapa = filtroEtapa === "Todas" || l.etapa === filtroEtapa;
      const matchRegime = filtroRegime === "Todos" || l.regime === filtroRegime;
      return matchSearch && matchEtapa && matchRegime;
    });
  }, [leads, search, filtroEtapa, filtroRegime]);

  function handleOpenCreateLead() {
    setEditingLead(null);
    setFormNome("");
    setFormApelido("");
    setFormEmail("");
    setFormTelefone("");
    setFormCurso("Formação de Formadores - CCP");
    setFormRegime("Gold");
    setFormValor("125");
    setFormEtapa("Nova");
    setFormOrigem("Website");
    setFormResponsavel("Carlos Aguilar");
    setFormParceiroId("");
    setFormObs("");
    setFormError("");
    setModalLeadOpen(true);
  }

  function handleOpenEditLead(lead: Lead) {
    setEditingLead(lead);
    setFormNome(lead.nome);
    setFormApelido(lead.apelido);
    setFormEmail(lead.email);
    setFormTelefone(lead.telefone);
    setFormCurso(lead.cursoInteresse);
    setFormRegime(lead.regime);
    setFormValor(String(lead.valorPrevisto));
    setFormEtapa(lead.etapa);
    setFormOrigem(lead.origem);
    setFormResponsavel(lead.responsavel);
    setFormParceiroId(lead.parceiroId || "");
    setFormObs(lead.observacoes || "");
    setFormError("");
    setModalLeadOpen(true);
  }

  function handleSaveLead() {
    if (!formNome.trim()) {
      setFormError("O primeiro nome e obrigatorio.");
      return;
    }
    if (!formEmail.trim() || !formEmail.includes("@")) {
      setFormError("Introduza um email de contacto valido.");
      return;
    }
    const parceiroSel = parceiros.find(p => p.id === formParceiroId);

    if (editingLead) {
      setLeads(prev =>
        prev.map(l =>
          l.id === editingLead.id
            ? {
                ...l,
                nome: formNome.trim(),
                apelido: formApelido.trim(),
                email: formEmail.trim(),
                telefone: formTelefone.trim(),
                cursoInteresse: formCurso,
                regime: formRegime,
                valorPrevisto: Number(formValor) || 0,
                etapa: formEtapa,
                origem: formOrigem,
                responsavel: formResponsavel,
                parceiroId: formParceiroId || undefined,
                parceiroNome: parceiroSel ? parceiroSel.nomeEntidade : undefined,
                observacoes: formObs.trim(),
              }
            : l,
        ),
      );
      notify(`Lead ${formNome} atualizada com sucesso.`);
    } else {
      const novaLead: Lead = {
        id: `LEAD-${leads.length + 101}`,
        nome: formNome.trim(),
        apelido: formApelido.trim(),
        email: formEmail.trim(),
        telefone: formTelefone.trim() || "910 000 000",
        cursoInteresse: formCurso,
        regime: formRegime,
        valorPrevisto: Number(formValor) || 0,
        etapa: formEtapa,
        probabilidade: formEtapa === "Ganho" ? 100 : formEtapa === "Perdido" ? 0 : 35,
        origem: formOrigem,
        responsavel: formResponsavel,
        parceiroId: formParceiroId || undefined,
        parceiroNome: parceiroSel ? parceiroSel.nomeEntidade : undefined,
        dataCriacao: new Date().toISOString().slice(0, 16).replace("T", " "),
        ultimoContacto: new Date().toISOString().slice(0, 16).replace("T", " "),
        proximoContacto: "A agendar",
        notasCount: 0,
        observacoes: formObs.trim(),
      };
      setLeads(prev => [novaLead, ...prev]);
      notify(`Nova lead ${formNome} criada com sucesso.`);
    }
    setModalLeadOpen(false);
  }

  function handleAdvanceStage(leadId: string) {
    setLeads(prev =>
      prev.map(l => {
        if (l.id !== leadId) return l;
        const curIdx = CRM_LEAD_STAGES.indexOf(l.etapa);
        if (curIdx < CRM_LEAD_STAGES.length - 2) {
          const nextStage = CRM_LEAD_STAGES[curIdx + 1];
          notify(`Lead ${l.nome} avançou para "${nextStage}".`);
          return { ...l, etapa: nextStage, ultimoContacto: "Hoje" };
        }
        return l;
      }),
    );
  }

  function handleConvertLead(lead: Lead) {
    setLeads(prev =>
      prev.map(l => (l.id === lead.id ? { ...l, etapa: "Ganho", probabilidade: 100 } : l)),
    );
    notify(`Parabens! Lead ${lead.nome} ${lead.apelido} convertida em formando.`);
  }

  function handleDeleteLead(id: string) {
    const l = leads.find(x => x.id === id);
    if (!l) return;
    if (confirm(`Pretende eliminar a lead de ${l.nome} ${l.apelido}?`)) {
      setLeads(prev => prev.filter(x => x.id !== id));
      notify(`Lead removida.`);
    }
  }

  // Quick Note creation from Lead
  function handleOpenQuickNote(lead: Lead) {
    setQuickNoteLead(lead);
    setNoteTipo("Chamada");
    setNoteTitulo(`Contacto comercial com ${lead.nome}`);
    setNoteConteudo("");
    setNoteFollowUp(true);
    setNoteDataFollowUp("2026-09-26 10:30");
    setNotePrioridade("Média");
  }

  function handleSaveQuickNote() {
    if (!quickNoteLead || !noteConteudo.trim()) return;
    const novaNota: NotaComercial = {
      id: `NOT-${notas.length + 201}`,
      tipo: noteTipo,
      titulo: noteTitulo.trim() || `${noteTipo} com ${quickNoteLead.nome}`,
      conteudo: noteConteudo.trim(),
      leadId: quickNoteLead.id,
      leadNome: `${quickNoteLead.nome} ${quickNoteLead.apelido}`,
      autor: quickNoteLead.responsavel,
      dataRegisto: new Date().toISOString().slice(0, 16).replace("T", " "),
      temFollowUp: noteFollowUp,
      dataFollowUp: noteFollowUp ? noteDataFollowUp : undefined,
      followUpConcluido: false,
      prioridade: notePrioridade,
    };
    setNotas(prev => [novaNota, ...prev]);
    setLeads(prev =>
      prev.map(l =>
        l.id === quickNoteLead.id
          ? {
              ...l,
              notasCount: l.notasCount + 1,
              ultimoContacto: "Hoje",
              proximoContacto: noteFollowUp ? noteDataFollowUp : l.proximoContacto,
            }
          : l,
      ),
    );
    notify(`Nota comercial registada para ${quickNoteLead.nome}.`);
    setQuickNoteLead(null);
  }

  const stageColors: Record<LeadStage, { bg: string; text: string; border: string }> = {
    Nova: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
    "Contacto Inicial": { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
    "Reunião / Diagnóstico": { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
    "Proposta Enviada": { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200" },
    Ganho: { bg: "bg-emerald-50", text: "text-emerald-800", border: "border-emerald-200" },
    Perdido: { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-300" },
  };

  return (
    <div className="space-y-4">
      {/* Title & Top Action */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Leads Comerciais e Pipeline</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Gestão do funil de vendas, acompanhamento de contactos e conversão de formandos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode("kanban")}
              className={`p-1.5 rounded text-xs font-semibold flex items-center gap-1 transition-colors ${
                viewMode === "kanban" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
              title="Vista em Funil / Kanban"
            >
              {I.kanban} Funil
            </button>
            <button
              type="button"
              onClick={() => setViewMode("tabela")}
              className={`p-1.5 rounded text-xs font-semibold flex items-center gap-1 transition-colors ${
                viewMode === "tabela" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
              title="Vista em Tabela"
            >
              {I.list} Tabela
            </button>
          </div>

          <button
            onClick={handleOpenCreateLead}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm whitespace-nowrap"
          >
            {I.plus} Nova Lead
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Valor em Pipeline</p>
          <p className="text-2xl font-bold text-slate-800">EUR {totalPipelineVal.toLocaleString("pt-PT")}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Leads Ativas</p>
          <p className="text-2xl font-bold text-amber-600">{activeLeadsCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Leads Convertidas</p>
          <p className="text-2xl font-bold text-emerald-600">{convertedCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Taxa de Conversão</p>
          <p className="text-2xl font-bold text-indigo-600">{conversionRate}%</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{I.search}</span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar por nome, email, curso ou responsável..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mr-1">Etapa:</span>
            {["Todas", ...CRM_LEAD_STAGES].map(et => (
              <button
                key={et}
                type="button"
                onClick={() => setFiltroEtapa(et)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  filtroEtapa === et ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {et}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mr-1">Regime:</span>
            {["Todos", "Gold", "Financiada"].map(reg => (
              <button
                key={reg}
                type="button"
                onClick={() => setFiltroRegime(reg)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  filtroRegime === reg ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {reg}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main View: Kanban vs Table */}
      {viewMode === "kanban" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5 items-start">
          {CRM_LEAD_STAGES.map(stage => {
            const stageLeads = filteredLeads.filter(l => l.etapa === stage);
            const stageTotal = stageLeads.reduce((acc, l) => acc + (l.valorPrevisto || 0), 0);
            const style = stageColors[stage];

            return (
              <div
                key={stage}
                className="bg-slate-100/80 rounded-xl p-3 border border-slate-200 flex flex-col max-h-[780px]"
              >
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-800">{stage}</span>
                    <span className="text-[11px] font-bold bg-white text-slate-600 px-1.5 py-0.5 rounded-full border border-slate-200">
                      {stageLeads.length}
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500">
                    EUR {stageTotal}
                  </span>
                </div>

                <div className="space-y-2.5 overflow-y-auto flex-1 pr-0.5">
                  {stageLeads.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400 italic">
                      Sem leads nesta fase
                    </div>
                  ) : (
                    stageLeads.map(lead => (
                      <div
                        key={lead.id}
                        className="bg-white rounded-lg p-3 border border-slate-200 shadow-xs hover:border-amber-300 hover:shadow-sm transition-all space-y-2"
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <div>
                            <p className="text-xs font-bold text-slate-800 leading-tight">
                              {lead.nome} {lead.apelido}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate max-w-[130px]" title={lead.email}>
                              {lead.email}
                            </p>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                              lead.regime === "Gold"
                                ? "bg-amber-50 text-amber-800 border-amber-200"
                                : "bg-blue-50 text-blue-700 border-blue-200"
                            }`}
                          >
                            {lead.regime}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 space-y-1">
                          <p className="font-medium text-slate-700 truncate" title={lead.cursoInteresse}>
                            {lead.cursoInteresse}
                          </p>
                          <div className="flex justify-between items-center text-[10px] text-slate-500">
                            <span>Valor: <strong className="text-slate-800">EUR {lead.valorPrevisto}</strong></span>
                            <span>{lead.origem}</span>
                          </div>
                        </div>

                        {lead.parceiroNome && (
                          <p className="text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded truncate">
                            Parceiro: {lead.parceiroNome}
                          </p>
                        )}

                        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                          <span title="Responsável Comercial">{lead.responsavel.split(" ")[0]}</span>
                          <span className="flex items-center gap-1 text-amber-700 font-medium">
                            {I.note} {lead.notasCount}
                          </span>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center justify-between gap-1 pt-1">
                          <button
                            type="button"
                            onClick={() => setDetailLead(lead)}
                            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
                            title="Ver ficha completa"
                          >
                            {I.eye}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenQuickNote(lead)}
                            className="p-1 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded"
                            title="Adicionar nota comercial"
                          >
                            {I.note}
                          </button>
                          {stage !== "Ganho" && stage !== "Perdido" && (
                            <button
                              type="button"
                              onClick={() => handleAdvanceStage(lead.id)}
                              className="px-2 py-1 bg-slate-100 hover:bg-amber-500 hover:text-white text-slate-600 text-[10px] font-bold rounded flex items-center gap-1 transition-colors"
                              title="Avançar para a próxima etapa"
                            >
                              Avançar {I.arrowRight}
                            </button>
                          )}
                          {stage === "Proposta Enviada" && (
                            <button
                              type="button"
                              onClick={() => handleConvertLead(lead)}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded transition-colors"
                              title="Converter em formando ganho"
                            >
                              Ganho
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Lead</th>
                  <th className="py-3.5 px-4">Contacto</th>
                  <th className="py-3.5 px-4">Curso de Interesse</th>
                  <th className="py-3.5 px-4">Etapa</th>
                  <th className="py-3.5 px-4">Valor</th>
                  <th className="py-3.5 px-4">Responsável</th>
                  <th className="py-3.5 px-4">Origem</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLeads.map(lead => (
                  <tr key={lead.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">
                          {lead.nome} {lead.apelido}
                        </p>
                        <p className="text-xs text-slate-400">Criada a {lead.dataCriacao.slice(0, 10)}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-xs text-slate-800 font-medium">{lead.email}</p>
                      <p className="text-xs text-slate-500">{lead.telefone}</p>
                    </td>
                    <td className="py-3 px-4">
                      <div className="max-w-xs">
                        <p className="text-xs font-semibold text-slate-800 truncate">{lead.cursoInteresse}</p>
                        <span
                          className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded border mt-0.5 ${
                            lead.regime === "Gold"
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          }`}
                        >
                          {lead.regime}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${stageColors[lead.etapa].bg} ${stageColors[lead.etapa].text} ${stageColors[lead.etapa].border}`}
                      >
                        {lead.etapa}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs font-bold text-slate-800 whitespace-nowrap">
                      EUR {lead.valorPrevisto}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      {lead.responsavel}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500">
                      {lead.origem}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setDetailLead(lead)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
                          title="Ver detalhes"
                        >
                          {I.eye}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenQuickNote(lead)}
                          className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg"
                          title="Registar nota comercial"
                        >
                          {I.note}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEditLead(lead)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
                          title="Editar lead"
                        >
                          {I.edit}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteLead(lead.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          title="Eliminar lead"
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
        </div>
      )}

      {/* Modal Criar / Editar Lead */}
      <AppModal
        open={modalLeadOpen}
        onClose={() => setModalLeadOpen(false)}
        title={editingLead ? `Editar Lead: ${editingLead.nome} ${editingLead.apelido}` : "Nova Lead Comercial"}
        sub="Registe os dados do contacto, curso pretendido e etapa no funil de vendas."
        size="lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => setModalLeadOpen(false)}
              className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveLead}
              className="px-5 py-2 text-sm font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
            >
              {editingLead ? "Guardar Lead" : "Criar Lead"}
            </button>
          </>
        }
      >
        <div className="p-6 space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-700">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Primeiro Nome *</span>
              <input
                type="text"
                value={formNome}
                onChange={e => setFormNome(e.target.value)}
                placeholder="ex: João"
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Apelido(s)</span>
              <input
                type="text"
                value={formApelido}
                onChange={e => setFormApelido(e.target.value)}
                placeholder="ex: Silva Santos"
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Email *</span>
              <input
                type="email"
                value={formEmail}
                onChange={e => setFormEmail(e.target.value)}
                placeholder="ex: joao.santos@email.com"
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Telefone</span>
              <input
                type="text"
                value={formTelefone}
                onChange={e => setFormTelefone(e.target.value)}
                placeholder="ex: 912 345 678"
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="text-xs font-semibold text-slate-600">Curso de Interesse</span>
              <input
                type="text"
                value={formCurso}
                onChange={e => setFormCurso(e.target.value)}
                placeholder="Nome do curso pretendido"
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Regime Formativo</span>
              <select
                value={formRegime}
                onChange={e => setFormRegime(e.target.value as "Gold" | "Financiada")}
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
              >
                <option value="Gold">Gold (Particular)</option>
                <option value="Financiada">Financiada (Sem custo)</option>
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Valor Previsto (EUR)</span>
              <input
                type="number"
                value={formValor}
                onChange={e => setFormValor(e.target.value)}
                placeholder="125"
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Etapa do Pipeline</span>
              <select
                value={formEtapa}
                onChange={e => setFormEtapa(e.target.value as LeadStage)}
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
              >
                {CRM_LEAD_STAGES.map(st => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Canal de Origem</span>
              <select
                value={formOrigem}
                onChange={e => setFormOrigem(e.target.value as Lead["origem"])}
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
              >
                <option value="Website">Website</option>
                <option value="Campanha Meta">Campanha Meta (Facebook/Instagram)</option>
                <option value="Google Ads">Google Ads</option>
                <option value="Referência">Referência / Recomendação</option>
                <option value="Parceiro">Parceiro Institucional</option>
                <option value="LinkedIn">LinkedIn</option>
                <option value="Telefone">Contacto Telefónico Direto</option>
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Responsável Comercial</span>
              <select
                value={formResponsavel}
                onChange={e => setFormResponsavel(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
              >
                <option value="Carlos Aguilar">Carlos Aguilar</option>
                <option value="Mariana Costa">Mariana Costa</option>
                <option value="Tânia Santos">Tânia Santos</option>
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Parceiro Vinculado (Opcional)</span>
              <select
                value={formParceiroId}
                onChange={e => setFormParceiroId(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
              >
                <option value="">Nenhum parceiro associado</option>
                {parceiros.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.nomeEntidade}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Observações Comerciais</span>
            <textarea
              rows={3}
              value={formObs}
              onChange={e => setFormObs(e.target.value)}
              placeholder="Notas sobre preferências de horário, motivação ou condições acordadas..."
              className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </label>
        </div>
      </AppModal>

      {/* Modal Ficha Completa de Lead com Histórico de Notas */}
      {detailLead && (
        <AppModal
          open={!!detailLead}
          onClose={() => setDetailLead(null)}
          title={`Ficha de Lead: ${detailLead.nome} ${detailLead.apelido}`}
          sub={`Identificador: ${detailLead.id} | Registada a ${detailLead.dataCriacao}`}
          size="lg"
          footer={
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleConvertLead(detailLead);
                    setDetailLead(null);
                  }}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg"
                >
                  Converter em Formando
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const l = detailLead;
                    setDetailLead(null);
                    handleOpenQuickNote(l);
                  }}
                  className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold rounded-lg border border-amber-200 flex items-center gap-1"
                >
                  {I.note} Registar Nova Nota
                </button>
              </div>
              <button
                type="button"
                onClick={() => setDetailLead(null)}
                className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>
          }
        >
          <div className="p-6 space-y-6">
            {/* Quick Contact Bar */}
            <div className="flex items-center justify-between gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <p className="text-sm font-bold text-slate-800">{detailLead.nome} {detailLead.apelido}</p>
                <p className="text-xs text-slate-500">{detailLead.cursoInteresse}</p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`tel:${detailLead.telefone.replace(/\s+/g, "")}`}
                  className="p-2 text-slate-600 hover:text-white hover:bg-blue-600 rounded-lg border border-slate-200 transition-colors"
                  title="Telefonar"
                >
                  {I.phone}
                </a>
                <a
                  href={`mailto:${detailLead.email}`}
                  className="p-2 text-slate-600 hover:text-white hover:bg-amber-500 rounded-lg border border-slate-200 transition-colors"
                  title="Enviar Email"
                >
                  {I.mail}
                </a>
                <a
                  href={`https://wa.me/351${detailLead.telefone.replace(/\s+/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 text-slate-600 hover:text-white hover:bg-emerald-600 rounded-lg border border-slate-200 transition-colors"
                  title="Enviar WhatsApp"
                >
                  {I.whatsapp}
                </a>
              </div>
            </div>

            {/* Information Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="text-slate-400 block mb-0.5">Etapa do Pipeline</span>
                <span className="font-bold text-slate-800">{detailLead.etapa}</span>
              </div>
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="text-slate-400 block mb-0.5">Valor Estimado</span>
                <span className="font-bold text-slate-800">EUR {detailLead.valorPrevisto}</span>
              </div>
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="text-slate-400 block mb-0.5">Regime</span>
                <span className="font-bold text-slate-800">{detailLead.regime}</span>
              </div>
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="text-slate-400 block mb-0.5">Canal de Origem</span>
                <span className="font-bold text-slate-800">{detailLead.origem}</span>
              </div>
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="text-slate-400 block mb-0.5">Responsável Comercial</span>
                <span className="font-bold text-slate-800">{detailLead.responsavel}</span>
              </div>
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="text-slate-400 block mb-0.5">Parceiro Vinculado</span>
                <span className="font-bold text-slate-800">{detailLead.parceiroNome || "Nenhum"}</span>
              </div>
            </div>

            {detailLead.observacoes && (
              <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-lg text-xs text-amber-950">
                <strong className="block text-amber-900 mb-1">Observações da Lead:</strong>
                {detailLead.observacoes}
              </div>
            )}

            {/* Histórico de Notas Comerciais associadas */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                  {I.note} Histórico de Notas Comerciais ({notas.filter(n => n.leadId === detailLead.id).length})
                </h4>
              </div>

              {notas.filter(n => n.leadId === detailLead.id).length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-lg border border-slate-200">
                  Ainda não existem notas comerciais registadas para esta lead.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {notas
                    .filter(n => n.leadId === detailLead.id)
                    .map(nota => (
                      <div key={nota.id} className="p-3 bg-white border border-slate-200 rounded-lg space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-800 flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">
                              {nota.tipo}
                            </span>
                            {nota.titulo}
                          </span>
                          <span className="text-[11px] text-slate-400">{nota.dataRegisto}</span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">{nota.conteudo}</p>
                        {nota.temFollowUp && (
                          <div className="text-[11px] text-amber-800 bg-amber-50 px-2 py-1 rounded flex items-center justify-between border border-amber-200">
                            <span>Próximo contacto: {nota.dataFollowUp}</span>
                            <span>{nota.followUpConcluido ? "Concluído" : "Pendente"}</span>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </AppModal>
      )}

      {/* Modal Adicionar Nota Rápida a partir de Lead */}
      {quickNoteLead && (
        <AppModal
          open={!!quickNoteLead}
          onClose={() => setQuickNoteLead(null)}
          title={`Registar Nota Comercial: ${quickNoteLead.nome} ${quickNoteLead.apelido}`}
          sub="Adicione anotações de contacto, decisões tomadas e agende o próximo follow-up."
          size="md"
          footer={
            <>
              <button
                type="button"
                onClick={() => setQuickNoteLead(null)}
                className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveQuickNote}
                className="px-5 py-2 text-sm font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
              >
                Guardar Nota
              </button>
            </>
          }
        >
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Tipo de Atividade</span>
                <select
                  value={noteTipo}
                  onChange={e => setNoteTipo(e.target.value as NotaTipo)}
                  className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                >
                  <option value="Chamada">Chamada Telefónica</option>
                  <option value="Reunião">Reunião Presencial / Online</option>
                  <option value="Email">Email de Contacto</option>
                  <option value="Proposta">Envio de Proposta</option>
                  <option value="Negociação">Negociação</option>
                  <option value="WhatsApp">Mensagem WhatsApp</option>
                  <option value="Visita">Visita Comercial</option>
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Prioridade</span>
                <select
                  value={notePrioridade}
                  onChange={e => setNotePrioridade(e.target.value as "Alta" | "Média" | "Baixa")}
                  className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                >
                  <option value="Alta">Alta</option>
                  <option value="Média">Média</option>
                  <option value="Baixa">Baixa</option>
                </select>
              </label>
            </div>

            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Título / Assunto *</span>
              <input
                type="text"
                value={noteTitulo}
                onChange={e => setNoteTitulo(e.target.value)}
                placeholder="ex: Reunião de apresentação do programa"
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Conteúdo Detalhado da Nota *</span>
              <textarea
                rows={4}
                value={noteConteudo}
                onChange={e => setNoteConteudo(e.target.value)}
                placeholder="Registe o feedback do cliente, objeções apresentadas ou próximos passos acordados..."
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </label>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={noteFollowUp}
                  onChange={e => setNoteFollowUp(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 border-slate-300"
                />
                <span className="text-xs font-bold text-slate-700">Agendar próximo follow-up</span>
              </label>

              {noteFollowUp && (
                <label className="block pt-1">
                  <span className="text-[11px] font-semibold text-slate-500">Data e Hora do Follow-up</span>
                  <input
                    type="text"
                    value={noteDataFollowUp}
                    onChange={e => setNoteDataFollowUp(e.target.value)}
                    placeholder="AAAA-MM-DD HH:MM"
                    className="mt-1 w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </label>
              )}
            </div>
          </div>
        </AppModal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. COMMERCIAL NOTES SECTION
// ─────────────────────────────────────────────────────────────────────────────

function CrmNotasSection({
  notas,
  setNotas,
  leads,
  parceiros,
  notify,
}: {
  notas: NotaComercial[];
  setNotas: React.Dispatch<React.SetStateAction<NotaComercial[]>>;
  leads: Lead[];
  parceiros: Parceiro[];
  notify: (msg: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("Todos");
  const [filtroFollowUp, setFiltroFollowUp] = useState<string>("Todos");
  const [modalNotaOpen, setModalNotaOpen] = useState(false);
  const [editingNota, setEditingNota] = useState<NotaComercial | null>(null);

  // Form State
  const [formTipo, setFormTipo] = useState<NotaTipo>("Chamada");
  const [formTitulo, setFormTitulo] = useState("");
  const [formConteudo, setFormConteudo] = useState("");
  const [formLeadId, setFormLeadId] = useState("");
  const [formParceiroId, setFormParceiroId] = useState("");
  const [formAutor, setFormAutor] = useState("Carlos Aguilar");
  const [formTemFollowUp, setFormTemFollowUp] = useState(true);
  const [formDataFollowUp, setFormDataFollowUp] = useState("2026-09-26 14:00");
  const [formPrioridade, setFormPrioridade] = useState<"Alta" | "Média" | "Baixa">("Média");
  const [formError, setFormError] = useState("");

  // KPIs
  const totalNotas = notas.length;
  const pendingFollowUps = notas.filter(n => n.temFollowUp && !n.followUpConcluido).length;
  const chamadasCount = notas.filter(n => n.tipo === "Chamada").length;
  const reunioesCount = notas.filter(n => n.tipo === "Reunião").length;

  const filteredNotas = useMemo(() => {
    return notas.filter(n => {
      const matchSearch =
        `${n.titulo} ${n.conteudo} ${n.leadNome || ""} ${n.parceiroNome || ""} ${n.autor}`
          .toLowerCase()
          .includes(search.toLowerCase());
      const matchTipo = filtroTipo === "Todos" || n.tipo === filtroTipo;
      const matchFollowUp =
        filtroFollowUp === "Todos" ||
        (filtroFollowUp === "Pendentes" && n.temFollowUp && !n.followUpConcluido) ||
        (filtroFollowUp === "Concluídos" && n.followUpConcluido) ||
        (filtroFollowUp === "Sem Follow-up" && !n.temFollowUp);
      return matchSearch && matchTipo && matchFollowUp;
    });
  }, [notas, search, filtroTipo, filtroFollowUp]);

  function handleOpenCreateNota() {
    setEditingNota(null);
    setFormTipo("Chamada");
    setFormTitulo("");
    setFormConteudo("");
    setFormLeadId("");
    setFormParceiroId("");
    setFormAutor("Carlos Aguilar");
    setFormTemFollowUp(true);
    setFormDataFollowUp("2026-09-26 14:00");
    setFormPrioridade("Média");
    setFormError("");
    setModalNotaOpen(true);
  }

  function handleOpenEditNota(nota: NotaComercial) {
    setEditingNota(nota);
    setFormTipo(nota.tipo);
    setFormTitulo(nota.titulo);
    setFormConteudo(nota.conteudo);
    setFormLeadId(nota.leadId || "");
    setFormParceiroId(nota.parceiroId || "");
    setFormAutor(nota.autor);
    setFormTemFollowUp(nota.temFollowUp);
    setFormDataFollowUp(nota.dataFollowUp || "");
    setFormPrioridade(nota.prioridade);
    setFormError("");
    setModalNotaOpen(true);
  }

  function handleSaveNota() {
    if (!formTitulo.trim()) {
      setFormError("O título ou resumo da nota e obrigatorio.");
      return;
    }
    if (!formConteudo.trim()) {
      setFormError("Descreva os detalhes da nota comercial.");
      return;
    }

    const leadSel = leads.find(l => l.id === formLeadId);
    const parceiroSel = parceiros.find(p => p.id === formParceiroId);

    if (editingNota) {
      setNotas(prev =>
        prev.map(n =>
          n.id === editingNota.id
            ? {
                ...n,
                tipo: formTipo,
                titulo: formTitulo.trim(),
                conteudo: formConteudo.trim(),
                leadId: formLeadId || undefined,
                leadNome: leadSel ? `${leadSel.nome} ${leadSel.apelido}` : undefined,
                parceiroId: formParceiroId || undefined,
                parceiroNome: parceiroSel ? parceiroSel.nomeEntidade : undefined,
                autor: formAutor,
                temFollowUp: formTemFollowUp,
                dataFollowUp: formTemFollowUp ? formDataFollowUp : undefined,
                prioridade: formPrioridade,
              }
            : n,
        ),
      );
      notify("Nota comercial atualizada.");
    } else {
      const novaNota: NotaComercial = {
        id: `NOT-${notas.length + 201}`,
        tipo: formTipo,
        titulo: formTitulo.trim(),
        conteudo: formConteudo.trim(),
        leadId: formLeadId || undefined,
        leadNome: leadSel ? `${leadSel.nome} ${leadSel.apelido}` : undefined,
        parceiroId: formParceiroId || undefined,
        parceiroNome: parceiroSel ? parceiroSel.nomeEntidade : undefined,
        autor: formAutor,
        dataRegisto: new Date().toISOString().slice(0, 16).replace("T", " "),
        temFollowUp: formTemFollowUp,
        dataFollowUp: formTemFollowUp ? formDataFollowUp : undefined,
        followUpConcluido: false,
        prioridade: formPrioridade,
      };
      setNotas(prev => [novaNota, ...prev]);
      notify("Nota comercial registada com sucesso.");
    }
    setModalNotaOpen(false);
  }

  function handleToggleFollowUp(id: string) {
    setNotas(prev =>
      prev.map(n => {
        if (n.id === id) {
          const next = !n.followUpConcluido;
          notify(`Follow-up marcado como ${next ? "concluído" : "pendente"}.`);
          return { ...n, followUpConcluido: next };
        }
        return n;
      }),
    );
  }

  function handleDeleteNota(id: string) {
    if (confirm("Deseja eliminar esta nota comercial?")) {
      setNotas(prev => prev.filter(n => n.id !== id));
      notify("Nota comercial removida.");
    }
  }

  const priorityColors: Record<"Alta" | "Média" | "Baixa", string> = {
    Alta: "bg-red-50 text-red-700 border-red-200",
    Média: "bg-amber-50 text-amber-800 border-amber-200",
    Baixa: "bg-slate-100 text-slate-600 border-slate-200",
  };

  const tipoIcons: Record<NotaTipo, React.ReactNode> = {
    Chamada: I.phone,
    Reunião: I.users,
    Email: I.mail,
    Proposta: I.note,
    Negociação: I.tag,
    WhatsApp: I.whatsapp,
    Visita: I.building,
  };

  return (
    <div className="space-y-4">
      {/* Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Notas Comerciais e Follow-ups</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Histórico cronológico de contactos, chamadas telefónicas, reuniões e lembretes de tarefas comerciais.
          </p>
        </div>
        <button
          onClick={handleOpenCreateNota}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm whitespace-nowrap self-start"
        >
          {I.plus} Nova Nota Comercial
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Total de Notas</p>
          <p className="text-2xl font-bold text-slate-800">{totalNotas}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Follow-ups Pendentes</p>
          <p className="text-2xl font-bold text-amber-600">{pendingFollowUps}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Chamadas Registadas</p>
          <p className="text-2xl font-bold text-blue-600">{chamadasCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Reuniões Comerciais</p>
          <p className="text-2xl font-bold text-purple-600">{reunioesCount}</p>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{I.search}</span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar por assunto, texto, cliente ou autor..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mr-1">Tipo:</span>
            {["Todos", "Chamada", "Reunião", "Email", "Proposta", "Negociação", "WhatsApp"].map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setFiltroTipo(t)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  filtroTipo === t ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mr-1">Tarefas:</span>
            {["Todos", "Pendentes", "Concluídos"].map(st => (
              <button
                key={st}
                type="button"
                onClick={() => setFiltroFollowUp(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  filtroFollowUp === st ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Notas Timeline / List */}
      <div className="space-y-3">
        {filteredNotas.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">
            Nenhuma nota comercial encontrada para os filtros selecionados.
          </div>
        ) : (
          filteredNotas.map(nota => (
            <div
              key={nota.id}
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-amber-300 transition-all space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center flex-shrink-0 border border-amber-200 mt-0.5">
                    {tipoIcons[nota.tipo] || I.note}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-slate-800">{nota.titulo}</h3>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        {nota.tipo}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${priorityColors[nota.prioridade]}`}
                      >
                        Prioridade {nota.prioridade}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                      <span>Registada por <strong className="text-slate-700">{nota.autor}</strong></span>
                      <span>Data: {nota.dataRegisto}</span>
                      {nota.leadNome && (
                        <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded font-medium border border-amber-200">
                          Lead: {nota.leadNome}
                        </span>
                      )}
                      {nota.parceiroNome && (
                        <span className="text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded font-medium border border-indigo-200">
                          Parceiro: {nota.parceiroNome}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => handleOpenEditNota(nota)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                    title="Editar nota"
                  >
                    {I.edit}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteNota(nota.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    title="Eliminar nota"
                  >
                    {I.trash}
                  </button>
                </div>
              </div>

              {/* Note Content */}
              <div className="text-sm text-slate-700 bg-slate-50/70 p-3.5 rounded-lg border border-slate-100 leading-relaxed">
                {nota.conteudo}
              </div>

              {/* Follow-up Section */}
              {nota.temFollowUp && (
                <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-amber-50/60 border border-amber-200 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-700">{I.calendar}</span>
                    <span className="font-semibold text-slate-800">
                      Próximo Follow-up: <strong className="text-amber-900">{nota.dataFollowUp}</strong>
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleFollowUp(nota.id)}
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-md font-bold transition-colors ${
                      nota.followUpConcluido
                        ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                        : "bg-amber-500 hover:bg-amber-600 text-white"
                    }`}
                  >
                    {nota.followUpConcluido ? (
                      <>
                        {I.check} Concluído
                      </>
                    ) : (
                      "Marcar Concluído"
                    )}
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal Criar / Editar Nota */}
      <AppModal
        open={modalNotaOpen}
        onClose={() => setModalNotaOpen(false)}
        title={editingNota ? "Editar Nota Comercial" : "Nova Nota Comercial"}
        sub="Registe detalhes de interações comerciais, reuniões e tarefas de acompanhamento."
        size="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setModalNotaOpen(false)}
              className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveNota}
              className="px-5 py-2 text-sm font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
            >
              {editingNota ? "Guardar Nota" : "Criar Nota"}
            </button>
          </>
        }
      >
        <div className="p-6 space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-700">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Tipo de Atividade *</span>
              <select
                value={formTipo}
                onChange={e => setFormTipo(e.target.value as NotaTipo)}
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
              >
                <option value="Chamada">Chamada Telefónica</option>
                <option value="Reunião">Reunião Presencial / Online</option>
                <option value="Email">Email de Contacto</option>
                <option value="Proposta">Envio de Proposta</option>
                <option value="Negociação">Negociação</option>
                <option value="WhatsApp">Mensagem WhatsApp</option>
                <option value="Visita">Visita Comercial</option>
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Prioridade</span>
              <select
                value={formPrioridade}
                onChange={e => setFormPrioridade(e.target.value as "Alta" | "Média" | "Baixa")}
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
              >
                <option value="Alta">Alta</option>
                <option value="Média">Média</option>
                <option value="Baixa">Baixa</option>
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Título / Resumo *</span>
            <input
              type="text"
              value={formTitulo}
              onChange={e => setFormTitulo(e.target.value)}
              placeholder="ex: Reunião para apresentação do programa curricular"
              className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Vincular a Lead (Opcional)</span>
              <select
                value={formLeadId}
                onChange={e => setFormLeadId(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
              >
                <option value="">Nenhuma lead associada</option>
                {leads.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.nome} {l.apelido}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Vincular a Parceiro (Opcional)</span>
              <select
                value={formParceiroId}
                onChange={e => setFormParceiroId(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
              >
                <option value="">Nenhum parceiro associado</option>
                {parceiros.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.nomeEntidade}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Conteúdo Detalhado da Interação *</span>
            <textarea
              rows={4}
              value={formConteudo}
              onChange={e => setFormConteudo(e.target.value)}
              placeholder="Descreva pontos discutidos, valores acordados, objeções do cliente e tarefas pendentes..."
              className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Responsável / Autor</span>
            <select
              value={formAutor}
              onChange={e => setFormAutor(e.target.value)}
              className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
            >
              <option value="Carlos Aguilar">Carlos Aguilar</option>
              <option value="Mariana Costa">Mariana Costa</option>
              <option value="Tânia Santos">Tânia Santos</option>
            </select>
          </label>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formTemFollowUp}
                onChange={e => setFormTemFollowUp(e.target.checked)}
                className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 border-slate-300"
              />
              <span className="text-xs font-bold text-slate-700">Agendar próximo follow-up</span>
            </label>

            {formTemFollowUp && (
              <label className="block pt-1">
                <span className="text-[11px] font-semibold text-slate-500">Data e Hora do Lembrete</span>
                <input
                  type="text"
                  value={formDataFollowUp}
                  onChange={e => setFormDataFollowUp(e.target.value)}
                  placeholder="AAAA-MM-DD HH:MM"
                  className="mt-1 w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </label>
            )}
          </div>
        </div>
      </AppModal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. PARTNERS (PARCEIROS) SECTION
// ─────────────────────────────────────────────────────────────────────────────

function CrmParceirosSection({
  parceiros,
  setParceiros,
  notas,
  setNotas,
  notify,
}: {
  parceiros: Parceiro[];
  setParceiros: React.Dispatch<React.SetStateAction<Parceiro[]>>;
  notas: NotaComercial[];
  setNotas: React.Dispatch<React.SetStateAction<NotaComercial[]>>;
  notify: (msg: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("Todos");
  const [filtroEstado, setFiltroEstado] = useState<string>("Todos");

  // Modals
  const [modalParceiroOpen, setModalParceiroOpen] = useState(false);
  const [editingParceiro, setEditingParceiro] = useState<Parceiro | null>(null);
  const [detailParceiro, setDetailParceiro] = useState<Parceiro | null>(null);

  // Form State
  const [formEntidade, setFormEntidade] = useState("");
  const [formNif, setFormNif] = useState("");
  const [formTipo, setFormTipo] = useState<TipoParceria>("Protocolo de Estágio");
  const [formContactoNome, setFormContactoNome] = useState("");
  const [formContactoCargo, setFormContactoCargo] = useState("");
  const [formContactoEmail, setFormContactoEmail] = useState("");
  const [formContactoTelefone, setFormContactoTelefone] = useState("");
  const [formCidade, setFormCidade] = useState("");
  const [formMorada, setFormMorada] = useState("");
  const [formWebsite, setFormWebsite] = useState("");
  const [formDataInicio, setFormDataInicio] = useState("2026-01-01");
  const [formDataValidade, setFormDataValidade] = useState("2027-12-31");
  const [formCondicoes, setFormCondicoes] = useState("");
  const [formEstado, setFormEstado] = useState<"Ativo" | "Em Negociação" | "Inativo">("Ativo");
  const [formError, setFormError] = useState("");

  // KPIs
  const totalParceiros = parceiros.length;
  const activeParceiros = parceiros.filter(p => p.estado === "Ativo").length;
  const totalAlunos = parceiros.reduce((acc, p) => acc + (p.totalAlunosEncaminhados || 0), 0);
  const emNegociacao = parceiros.filter(p => p.estado === "Em Negociação").length;

  const filteredParceiros = useMemo(() => {
    return parceiros.filter(p => {
      const matchSearch =
        `${p.nomeEntidade} ${p.nif} ${p.contactoNome} ${p.cidade}`
          .toLowerCase()
          .includes(search.toLowerCase());
      const matchTipo = filtroTipo === "Todos" || p.tipo === filtroTipo;
      const matchEstado = filtroEstado === "Todos" || p.estado === filtroEstado;
      return matchSearch && matchTipo && matchEstado;
    });
  }, [parceiros, search, filtroTipo, filtroEstado]);

  function handleOpenCreate() {
    setEditingParceiro(null);
    setFormEntidade("");
    setFormNif("");
    setFormTipo("Protocolo de Estágio");
    setFormContactoNome("");
    setFormContactoCargo("");
    setFormContactoEmail("");
    setFormContactoTelefone("");
    setFormCidade("");
    setFormMorada("");
    setFormWebsite("");
    setFormDataInicio("2026-01-01");
    setFormDataValidade("2027-12-31");
    setFormCondicoes("Acolhimento de formandos em estágio e divulgação mútua");
    setFormEstado("Ativo");
    setFormError("");
    setModalParceiroOpen(true);
  }

  function handleOpenEdit(p: Parceiro) {
    setEditingParceiro(p);
    setFormEntidade(p.nomeEntidade);
    setFormNif(p.nif);
    setFormTipo(p.tipo);
    setFormContactoNome(p.contactoNome);
    setFormContactoCargo(p.contactoCargo);
    setFormContactoEmail(p.contactoEmail);
    setFormContactoTelefone(p.contactoTelefone);
    setFormCidade(p.cidade);
    setFormMorada(p.morada || "");
    setFormWebsite(p.website || "");
    setFormDataInicio(p.protocoloDataInicio);
    setFormDataValidade(p.protocoloValidade);
    setFormCondicoes(p.condicoesComerciais);
    setFormEstado(p.estado);
    setFormError("");
    setModalParceiroOpen(true);
  }

  function handleSaveParceiro() {
    if (!formEntidade.trim()) {
      setFormError("O nome da entidade parceira e obrigatorio.");
      return;
    }
    if (!formNif.trim()) {
      setFormError("Introduza o NIF da entidade parceira.");
      return;
    }

    if (editingParceiro) {
      setParceiros(prev =>
        prev.map(p =>
          p.id === editingParceiro.id
            ? {
                ...p,
                nomeEntidade: formEntidade.trim(),
                nif: formNif.trim(),
                tipo: formTipo,
                contactoNome: formContactoNome.trim(),
                contactoCargo: formContactoCargo.trim(),
                contactoEmail: formContactoEmail.trim(),
                contactoTelefone: formContactoTelefone.trim(),
                cidade: formCidade.trim(),
                morada: formMorada.trim() || undefined,
                website: formWebsite.trim() || undefined,
                protocoloDataInicio: formDataInicio,
                protocoloValidade: formDataValidade,
                condicoesComerciais: formCondicoes.trim(),
                estado: formEstado,
              }
            : p,
        ),
      );
      notify(`Parceiro ${formEntidade} atualizado com sucesso.`);
    } else {
      const novoParceiro: Parceiro = {
        id: `PARC-0${parceiros.length + 1}`,
        nomeEntidade: formEntidade.trim(),
        nif: formNif.trim(),
        tipo: formTipo,
        contactoNome: formContactoNome.trim() || "Responsável Geral",
        contactoCargo: formContactoCargo.trim() || "Direção",
        contactoEmail: formContactoEmail.trim() || "contacto@parceiro.pt",
        contactoTelefone: formContactoTelefone.trim() || "220 000 000",
        cidade: formCidade.trim() || "Porto",
        morada: formMorada.trim() || undefined,
        website: formWebsite.trim() || undefined,
        protocoloDataInicio: formDataInicio,
        protocoloValidade: formDataValidade,
        condicoesComerciais: formCondicoes.trim() || "Protocolo de colaboração institucional",
        estado: formEstado,
        totalAlunosEncaminhados: 0,
        totalTurmasEnvolvidas: 0,
        notasCount: 0,
      };
      setParceiros(prev => [novoParceiro, ...prev]);
      notify(`Novo parceiro ${formEntidade} criado com sucesso.`);
    }
    setModalParceiroOpen(false);
  }

  function handleDeleteParceiro(id: string) {
    const p = parceiros.find(x => x.id === id);
    if (!p) return;
    if (confirm(`Pretende remover o parceiro ${p.nomeEntidade}?`)) {
      setParceiros(prev => prev.filter(x => x.id !== id));
      notify(`Parceiro removido.`);
    }
  }

  const estadoBadges: Record<"Ativo" | "Em Negociação" | "Inativo", string> = {
    Ativo: "bg-emerald-50 text-emerald-800 border-emerald-200",
    "Em Negociação": "bg-amber-50 text-amber-800 border-amber-200",
    Inativo: "bg-slate-100 text-slate-600 border-slate-200",
  };

  const tipoBadges: Record<TipoParceria, string> = {
    "Protocolo de Estágio": "bg-blue-50 text-blue-800 border-blue-200",
    "Empresa Cliente": "bg-purple-50 text-purple-800 border-purple-200",
    "Entidade Formadora": "bg-teal-50 text-teal-800 border-teal-200",
    "Agente Comercial": "bg-orange-50 text-orange-800 border-orange-200",
    "Instituição de Ensino": "bg-sky-50 text-sky-800 border-sky-200",
    "Associação Setorial": "bg-indigo-50 text-indigo-800 border-indigo-200",
  };

  return (
    <div className="space-y-4">
      {/* Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Parceiros e Protocolos Institucionais</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Gestão de empresas acolhedoras de estágio, clientes corporativos e acordos de colaboração.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm whitespace-nowrap self-start"
        >
          {I.plus} Novo Parceiro
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Parceiros Ativos</p>
          <p className="text-2xl font-bold text-emerald-600">{activeParceiros}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Total de Entidades</p>
          <p className="text-2xl font-bold text-slate-800">{totalParceiros}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Alunos Encaminhados</p>
          <p className="text-2xl font-bold text-amber-600">{totalAlunos}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Em Negociação</p>
          <p className="text-2xl font-bold text-indigo-600">{emNegociacao}</p>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{I.search}</span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar por entidade, NIF, contacto ou cidade..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mr-1">Tipo:</span>
            {["Todos", "Protocolo de Estágio", "Empresa Cliente", "Associação Setorial", "Instituição de Ensino"].map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setFiltroTipo(t)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  filtroTipo === t ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mr-1">Estado:</span>
            {["Todos", "Ativo", "Em Negociação", "Inativo"].map(st => (
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

      {/* Partners Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Entidade Parceira</th>
                <th className="py-3.5 px-4">Tipo de Parceria</th>
                <th className="py-3.5 px-4">Pessoa de Contacto</th>
                <th className="py-3.5 px-4">Protocolo e Validade</th>
                <th className="py-3.5 px-4">Alunos</th>
                <th className="py-3.5 px-4 text-center">Estado</th>
                <th className="py-3.5 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredParceiros.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-amber-500 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                        {p.nomeEntidade.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">{p.nomeEntidade}</p>
                        <p className="text-xs text-slate-400">
                          NIF: {p.nif} | {p.cidade}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${tipoBadges[p.tipo]}`}
                    >
                      {p.tipo}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <p className="text-xs font-semibold text-slate-800">{p.contactoNome}</p>
                    <p className="text-[11px] text-slate-500">{p.contactoEmail}</p>
                    <p className="text-[11px] text-slate-400">{p.contactoTelefone}</p>
                  </td>
                  <td className="py-3 px-4 text-xs">
                    <p className="text-slate-800 font-medium">Válido até: {p.protocoloValidade}</p>
                    <p className="text-[11px] text-slate-400">Início: {p.protocoloDataInicio}</p>
                  </td>
                  <td className="py-3 px-4 text-xs font-bold text-slate-800 whitespace-nowrap">
                    {p.totalAlunosEncaminhados} formandos
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${estadoBadges[p.estado]}`}
                    >
                      {p.estado}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setDetailParceiro(p)}
                        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
                        title="Ver ficha do parceiro"
                      >
                        {I.eye}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(p)}
                        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
                        title="Editar parceiro"
                      >
                        {I.edit}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteParceiro(p.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        title="Remover parceiro"
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
      </div>

      {/* Modal Ficha Completa de Parceiro */}
      {detailParceiro && (
        <AppModal
          open={!!detailParceiro}
          onClose={() => setDetailParceiro(null)}
          title={`Ficha de Parceiro: ${detailParceiro.nomeEntidade}`}
          sub={`NIF: ${detailParceiro.nif} | Tipo: ${detailParceiro.tipo}`}
          size="lg"
          footer={
            <button
              type="button"
              onClick={() => setDetailParceiro(null)}
              className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Fechar
            </button>
          }
        >
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="text-slate-400 block mb-0.5">Pessoa de Contacto</span>
                <span className="font-bold text-slate-800">{detailParceiro.contactoNome}</span>
                <span className="text-[11px] text-slate-500 block">{detailParceiro.contactoCargo}</span>
              </div>
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="text-slate-400 block mb-0.5">Telefone / Telemóvel</span>
                <span className="font-bold text-slate-800">{detailParceiro.contactoTelefone}</span>
              </div>
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="text-slate-400 block mb-0.5">Email de Contacto</span>
                <span className="font-bold text-slate-800">{detailParceiro.contactoEmail}</span>
              </div>
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="text-slate-400 block mb-0.5">Cidade e Morada</span>
                <span className="font-bold text-slate-800">{detailParceiro.cidade}</span>
                <span className="text-[11px] text-slate-500 block truncate">{detailParceiro.morada || "Sem morada"}</span>
              </div>
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="text-slate-400 block mb-0.5">Validade do Protocolo</span>
                <span className="font-bold text-slate-800">{detailParceiro.protocoloValidade}</span>
              </div>
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="text-slate-400 block mb-0.5">Formandos Encaminhados</span>
                <span className="font-bold text-emerald-700">{detailParceiro.totalAlunosEncaminhados} formandos</span>
              </div>
            </div>

            {/* Condições comerciais */}
            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1">
              <p className="text-xs font-bold text-amber-900 uppercase tracking-wide">Condições Comerciais e Protocolo:</p>
              <p className="text-xs text-amber-950 leading-relaxed">{detailParceiro.condicoesComerciais}</p>
            </div>

            {/* Notas Comerciais associadas ao parceiro */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5 border-b border-slate-200 pb-2">
                {I.note} Notas Comerciais Registadas com este Parceiro ({notas.filter(n => n.parceiroId === detailParceiro.id).length})
              </h4>

              {notas.filter(n => n.parceiroId === detailParceiro.id).length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-lg border border-slate-200">
                  Ainda não existem notas comerciais registadas para esta entidade.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {notas
                    .filter(n => n.parceiroId === detailParceiro.id)
                    .map(nota => (
                      <div key={nota.id} className="p-3 bg-white border border-slate-200 rounded-lg space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-800 flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">
                              {nota.tipo}
                            </span>
                            {nota.titulo}
                          </span>
                          <span className="text-[11px] text-slate-400">{nota.dataRegisto}</span>
                        </div>
                        <p className="text-xs text-slate-600">{nota.conteudo}</p>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </AppModal>
      )}

      {/* Modal Criar / Editar Parceiro */}
      <AppModal
        open={modalParceiroOpen}
        onClose={() => setModalParceiroOpen(false)}
        title={editingParceiro ? `Editar Parceiro: ${editingParceiro.nomeEntidade}` : "Novo Parceiro / Entidade"}
        sub="Registe os dados da entidade parceira, condições do protocolo e pessoa de contacto."
        size="lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => setModalParceiroOpen(false)}
              className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveParceiro}
              className="px-5 py-2 text-sm font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
            >
              {editingParceiro ? "Guardar Parceiro" : "Criar Parceiro"}
            </button>
          </>
        }
      >
        <div className="p-6 space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-700">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block sm:col-span-2">
              <span className="text-xs font-semibold text-slate-600">Nome da Entidade *</span>
              <input
                type="text"
                value={formEntidade}
                onChange={e => setFormEntidade(e.target.value)}
                placeholder="ex: Clínica Dentária Sorriso Modelo, Lda"
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-600">NIF da Entidade *</span>
              <input
                type="text"
                value={formNif}
                onChange={e => setFormNif(e.target.value)}
                placeholder="ex: 509 881 234"
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Tipo de Parceria</span>
              <select
                value={formTipo}
                onChange={e => setFormTipo(e.target.value as TipoParceria)}
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
              >
                <option value="Protocolo de Estágio">Protocolo de Estágio</option>
                <option value="Empresa Cliente">Empresa Cliente</option>
                <option value="Entidade Formadora">Entidade Formadora</option>
                <option value="Agente Comercial">Agente Comercial</option>
                <option value="Instituição de Ensino">Instituição de Ensino</option>
                <option value="Associação Setorial">Associação Setorial</option>
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Pessoa de Contacto</span>
              <input
                type="text"
                value={formContactoNome}
                onChange={e => setFormContactoNome(e.target.value)}
                placeholder="ex: Dr. António Brandão"
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Cargo do Contacto</span>
              <input
                type="text"
                value={formContactoCargo}
                onChange={e => setFormContactoCargo(e.target.value)}
                placeholder="ex: Diretor de Recursos Humanos"
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Email de Contacto</span>
              <input
                type="email"
                value={formContactoEmail}
                onChange={e => setFormContactoEmail(e.target.value)}
                placeholder="ex: rh@sorrisomodelo.pt"
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Telefone</span>
              <input
                type="text"
                value={formContactoTelefone}
                onChange={e => setFormContactoTelefone(e.target.value)}
                placeholder="ex: 223 710 440"
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Cidade / Localidade</span>
              <input
                type="text"
                value={formCidade}
                onChange={e => setFormCidade(e.target.value)}
                placeholder="ex: Vila Nova de Gaia"
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Website da Entidade</span>
              <input
                type="text"
                value={formWebsite}
                onChange={e => setFormWebsite(e.target.value)}
                placeholder="ex: https://sorrisomodelo.pt"
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Data de Início do Protocolo</span>
              <input
                type="date"
                value={formDataInicio}
                onChange={e => setFormDataInicio(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Data de Validade do Protocolo</span>
              <input
                type="date"
                value={formDataValidade}
                onChange={e => setFormDataValidade(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Estado</span>
              <select
                value={formEstado}
                onChange={e => setFormEstado(e.target.value as "Ativo" | "Em Negociação" | "Inativo")}
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
              >
                <option value="Ativo">Ativo</option>
                <option value="Em Negociação">Em Negociação</option>
                <option value="Inativo">Inativo</option>
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Condições Comerciais e Benefícios</span>
            <textarea
              rows={3}
              value={formCondicoes}
              onChange={e => setFormCondicoes(e.target.value)}
              placeholder="Descreva percentagens de comissão acordadas, descontos corporativos ou número de vagas de estágio..."
              className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </label>
        </div>
      </AppModal>
    </div>
  );
}
