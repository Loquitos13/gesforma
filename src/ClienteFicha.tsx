import { useCallback, useEffect, useState } from "react";
import {
  apiCrmCampoCreate, apiCrmDossier, apiCrmLeadCampos, apiCrmLeadNota,
  type CrmCampoTipo, type CrmDossier, type CrmLead,
} from "./api";
import { AppModal, SearchSelect } from "./FormKit";
import type { Preinscricao } from "./ListsContext";
import { persist, toastError, toastOk } from "./toastBus";
import { TurmaInscricaoHint } from "./TurmaCronograma";
import { useTurmas } from "./TurmasContext";
import { turmaGoldOpts } from "./turmaModel";

const COLS = [
  { id: "Não contactado", label: "Não contactado" },
  { id: "1º Contacto", label: "1.º Contacto" },
  { id: "2º Contacto", label: "2.º Contacto" },
  { id: "Pago", label: "Pago" },
  { id: "Formando", label: "Formando" },
];

const inp = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400";

function telDigits(telf: string) {
  const d = telf.replace(/\D/g, "");
  if (!d) return "";
  return d.startsWith("351") ? d : `351${d}`;
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

function fmtWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16).replace("T", " ");
  return d.toLocaleString("pt-PT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const TIPO_DOT: Record<string, string> = {
  criacao: "bg-slate-400",
  contacto: "bg-blue-500",
  nota: "bg-amber-500",
  estado: "bg-indigo-500",
  seguimento: "bg-teal-500",
  campo: "bg-violet-500",
  proposta: "bg-emerald-500",
};

export function ClienteFicha({
  item, onClose, onConvert, onContactar, onPatch, hasPrev, hasNext, onPrev, onNext,
}: {
  item: CrmLead | null;
  onClose: () => void;
  onConvert?: (turma: string) => void;
  onContactar?: (nota: string) => void;
  onPatch?: (patch: Partial<Preinscricao>) => void;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  const { gold } = useTurmas();
  const [dossier, setDossier] = useState<CrmDossier | null>(null);
  const [erro, setErro] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"ficha" | "notas" | "historico">("ficha");
  const [notas, setNotas] = useState("");
  const [proximoContacto, setProximoContacto] = useState("");
  const [escolherTurma, setEscolherTurma] = useState(false);
  const [turmaConv, setTurmaConv] = useState("");
  const [vals, setVals] = useState<Record<number, string>>({});
  const [novoCampo, setNovoCampo] = useState(false);
  const [campoLabel, setCampoLabel] = useState("");
  const [campoTipo, setCampoTipo] = useState<CrmCampoTipo>("texto");
  const [campoOpcoes, setCampoOpcoes] = useState("");
  const [notaNova, setNotaNova] = useState("");

  const carregar = useCallback((id: number) => {
    setBusy(true);
    setErro("");
    apiCrmDossier(id)
      .then(d => {
        setDossier(d);
        setVals(Object.fromEntries(d.campos.map(c => [c.id, c.valor ?? ""])));
        setBusy(false);
      })
      .catch(() => {
        setErro("Não foi possível abrir o dossiê. A mostrar os dados da lista.");
        setBusy(false);
      });
  }, []);

  useEffect(() => {
    setEscolherTurma(false);
    setTurmaConv("");
    setTab("ficha");
    setNovoCampo(false);
    setNotaNova("");
    setDossier(null);
  }, [item?.id]);

  useEffect(() => {
    if (!item) return;
    setNotas(item.notas ?? "");
    setProximoContacto(item.proximoContacto ?? "");
    carregar(item.id);
  }, [item?.id, item?.estado, item?.notas, item?.proximoContacto, carregar]);

  useEffect(() => {
    if (!item) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && hasPrev) { e.preventDefault(); onPrev(); }
      if (e.key === "ArrowRight" && hasNext) { e.preventDefault(); onNext(); }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [item, hasPrev, hasNext, onPrev, onNext]);

  if (!item) return null;
  const lead = dossier?.lead ?? item;
  const papel = dossier?.papel ?? (lead.estado === "Pago" || lead.estado === "Formando" ? "cliente" : "potencial");
  const turmaOpts = turmaGoldOpts(gold, { curso: lead.curso });
  const wa = telDigits(lead.telf);
  const etapaIdx = Math.max(0, COLS.findIndex(c => c.id === lead.estado));

  async function guardarCampos() {
    if (!item) return;
    const valores = Object.entries(vals).map(([campoId, valor]) => ({ campoId: Number(campoId), valor }));
    const r = await persist(apiCrmLeadCampos(item.id, valores));
    if (!r) return;
    setDossier(r);
    toastOk("Campos gravados.");
  }

  async function criarCampo() {
    const label = campoLabel.trim();
    if (!label) return;
    const opcoes = campoTipo === "lista" ? campoOpcoes.split(",").map(s => s.trim()).filter(Boolean) : [];
    const r = await persist(apiCrmCampoCreate({ label, tipo: campoTipo, opcoes }));
    if (!r) return;
    toastOk("Campo criado. Passa a estar disponível em todas as leads.");
    setNovoCampo(false);
    setCampoLabel("");
    setCampoOpcoes("");
    if (item) carregar(item.id);
  }

  async function gravarNota() {
    if (!item || !notaNova.trim()) return;
    const r = await persist(apiCrmLeadNota(item.id, notaNova.trim()));
    if (!r) return;
    setDossier(r);
    setNotaNova("");
    toastOk("Nota comercial registada.");
  }

  return (
    <AppModal
      open
      onClose={onClose}
      title={`${lead.nome} ${lead.apelido}`}
      sub={`${lead.curso} · ${lead.local}`}
      size="2xl"
    >
      <div className="p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button type="button" disabled={!hasPrev} onClick={onPrev} className="px-2 py-1 text-xs border rounded-lg disabled:opacity-30">‹ Anterior</button>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${
              papel === "cliente" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-sky-50 text-sky-800 border-sky-200"
            }`}>{papel === "cliente" ? "Cliente" : "Potencial"}</span>
            {badge(lead.estado)}
          </div>
          <button type="button" disabled={!hasNext} onClick={onNext} className="px-2 py-1 text-xs border rounded-lg disabled:opacity-30">Seguinte ›</button>
        </div>

        <p className="text-xs text-slate-500">{lead.email} · {lead.telf} · {lead.origem}{lead.campanha ? ` · ${lead.campanha}` : ""}</p>
        {busy && !dossier && <p className="text-xs text-slate-400">A carregar o histórico…</p>}
        {erro && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{erro}</p>}

        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {([["ficha", "Ficha"], ["notas", "Notas"], ["historico", `Histórico${dossier ? ` (${dossier.eventos.length})` : ""}`]] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setTab(id)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md ${tab === id ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === "ficha" && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            <div className="lg:col-span-3 space-y-4">
              <div className="grid grid-cols-5 gap-1">
                {COLS.map((col, i) => (
                  <button key={col.id} type="button" disabled={col.id === "Formando"}
                    onClick={() => { if (col.id !== lead.estado && col.id !== "Formando") onPatch?.({ estado: col.id }); }}
                    className={`rounded-lg px-1 py-2 text-center border text-[10px] font-bold ${
                      col.id === lead.estado ? "bg-amber-500 border-amber-500 text-white"
                      : i < etapaIdx ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : "bg-slate-50 border-slate-200 text-slate-500"
                    }`}>
                    {col.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 rounded-xl p-3"><p className="text-slate-400">Valor</p><p className="font-bold text-amber-700 text-base">€ {lead.preco}</p></div>
                <div className="bg-slate-50 rounded-xl p-3"><p className="text-slate-400">Inscrito</p><p className="font-semibold text-slate-700">{lead.inscrito}</p></div>
              </div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex flex-col gap-1.5">Próximo contacto
                <input type="date" value={proximoContacto} onChange={e => setProximoContacto(e.target.value)} className={inp} />
              </label>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex flex-col gap-1.5">Notas de seguimento
                <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2} className={`${inp} resize-none`} placeholder="Objecção, horário, o que ficou combinado…" />
              </label>
              <button type="button" onClick={() => { onPatch?.({ notas, proximoContacto }); toastOk("Seguimento gravado."); }}
                className="w-full py-2 text-xs font-semibold rounded-lg border border-slate-200">Guardar seguimento</button>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Campos da lead</p>
                  <button type="button" onClick={() => setNovoCampo(v => !v)} className="text-xs font-semibold text-amber-700 hover:text-amber-800">
                    {novoCampo ? "Cancelar" : "+ Campo"}
                  </button>
                </div>
                {novoCampo && (
                  <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
                    <p className="text-[11px] text-amber-800">O campo fica disponível em todas as leads, não só nesta.</p>
                    <input className={inp} value={campoLabel} onChange={e => setCampoLabel(e.target.value)} placeholder="Nome do campo (ex. NIF, empresa)" />
                    <div className="grid grid-cols-2 gap-2">
                      <select className={inp} value={campoTipo} onChange={e => setCampoTipo(e.target.value as CrmCampoTipo)}>
                        <option value="texto">Texto</option>
                        <option value="numero">Número</option>
                        <option value="data">Data</option>
                        <option value="lista">Lista</option>
                      </select>
                      {campoTipo === "lista" && (
                        <input className={inp} value={campoOpcoes} onChange={e => setCampoOpcoes(e.target.value)} placeholder="Opções, separadas por vírgula" />
                      )}
                    </div>
                    <button type="button" disabled={!campoLabel.trim()} onClick={() => void criarCampo()}
                      className="w-full py-1.5 text-xs font-semibold rounded-lg bg-amber-500 text-white disabled:opacity-40">Criar campo</button>
                  </div>
                )}
                {(!dossier || dossier.campos.length === 0) && !busy && (
                  <p className="text-xs text-slate-400 py-2">Ainda sem campos extra. Crie NIF, empresa ou o que a comercial precisar.</p>
                )}
                <div className="space-y-2">
                  {(dossier?.campos ?? []).map(c => (
                    <label key={c.id} className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex flex-col gap-1.5">
                      {c.label}
                      {c.tipo === "lista" ? (
                        <select className={inp} value={vals[c.id] ?? ""} onChange={e => setVals(v => ({ ...v, [c.id]: e.target.value }))}>
                          <option value="">—</option>
                          {c.opcoes.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input
                          className={inp}
                          type={c.tipo === "numero" ? "number" : c.tipo === "data" ? "date" : "text"}
                          value={vals[c.id] ?? ""}
                          onChange={e => setVals(v => ({ ...v, [c.id]: e.target.value }))}
                        />
                      )}
                    </label>
                  ))}
                </div>
                {(dossier?.campos.length ?? 0) > 0 && (
                  <button type="button" onClick={() => void guardarCampos()} className="mt-2 w-full py-2 text-xs font-semibold rounded-lg border border-slate-200">
                    Guardar campos
                  </button>
                )}
              </div>

              {(dossier?.outrosPedidos.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Outros pedidos deste contacto</p>
                  <ul className="text-xs text-slate-600 space-y-1">
                    {dossier!.outrosPedidos.map(o => (
                      <li key={o.id}>{o.curso} · {o.estado} · {o.inscrito.slice(0, 10)}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="lg:col-span-2 space-y-3">
              <Timeline eventos={dossier?.eventos ?? []} empty={busy ? "A carregar…" : "Ainda sem eventos. Contactos, notas e mudanças de etapa aparecem aqui."} />
              <div className="flex gap-2">
                <a href={`tel:${lead.telf}`} className="flex-1 py-2 bg-slate-800 text-white text-sm font-semibold rounded-lg text-center">Ligar</a>
                {wa
                  ? <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="flex-1 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg text-center">WhatsApp</a>
                  : <span className="flex-1 py-2 bg-slate-100 text-slate-400 text-sm font-semibold rounded-lg text-center">Sem telemóvel</span>}
              </div>
              {lead.estado === "Não contactado" && (
                <button type="button" onClick={() => onContactar?.(notas.trim())} className="w-full py-2 border text-sm font-semibold rounded-lg">Registar 1.º contacto</button>
              )}
              {lead.estado !== "Pago" && lead.estado !== "Formando" && (
                <button type="button" onClick={() => { onPatch?.({ estado: "Pago" }); toastOk("Marcado como pago."); }} className="w-full py-2 border border-teal-200 bg-teal-50 text-sm font-semibold text-teal-800 rounded-lg">Marcar pagamento recebido</button>
              )}
              {lead.estado !== "Formando" && (!escolherTurma ? (
                <button type="button" onClick={() => setEscolherTurma(true)} className="w-full py-2.5 bg-amber-500 text-white text-sm font-bold rounded-lg">Inscrever numa turma</button>
              ) : (
                <div className="space-y-2">
                  <SearchSelect value={turmaConv} onChange={setTurmaConv} options={turmaOpts} placeholder="Só turmas ativas…" empty="Não há turmas ativas para este curso." />
                  <TurmaInscricaoHint optsLen={turmaOpts.length} curso={lead.curso} />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setEscolherTurma(false)} className="flex-1 py-2 border text-sm rounded-lg">Cancelar</button>
                    <button type="button" disabled={!turmaConv} onClick={() => onConvert?.(turmaConv)} className="flex-1 py-2.5 bg-amber-500 disabled:opacity-40 text-white text-sm font-bold rounded-lg">Confirmar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "notas" && (
          <div className="space-y-3">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex flex-col gap-1.5">Nova nota comercial
              <textarea value={notaNova} onChange={e => setNotaNova(e.target.value)} rows={3} className={`${inp} resize-none`} placeholder="O que ficou combinado, objecção, quem atendeu…" />
            </label>
            <button type="button" disabled={!notaNova.trim()} onClick={() => void gravarNota()}
              className="w-full py-2 bg-amber-500 disabled:opacity-40 text-white text-sm font-semibold rounded-lg">Registar nota</button>
            {(dossier?.notas.length ?? 0) === 0 && <p className="text-sm text-slate-400 text-center py-6">Ainda não há notas nesta lead.</p>}
            <ul className="space-y-2">
              {(dossier?.notas ?? []).map(n => (
                <li key={n.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                  <p className="text-[11px] text-slate-400">{fmtWhen(n.createdAt)}{n.actorName ? ` · ${n.actorName}` : ""}</p>
                  <p className="text-sm text-slate-700 mt-0.5 whitespace-pre-wrap">{n.nota || "Contacto sem texto."}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === "historico" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <Timeline eventos={dossier?.eventos ?? []} empty={busy ? "A carregar…" : "Ainda sem eventos nesta lead."} />
            </div>
            <div className="space-y-3">
              {(dossier?.propostas.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Propostas</p>
                  <ul className="space-y-1.5">
                    {dossier!.propostas.map(p => (
                      <li key={p.id} className="rounded-lg border border-slate-200 px-3 py-2 text-xs">
                        <p className="font-semibold text-slate-700">{p.curso || "Proposta"}</p>
                        <p className="text-slate-500">{p.estado} · € {p.valor}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-[11px] text-slate-400">Criação, contactos, notas, campos, etapas e propostas entram neste rasto.</p>
            </div>
          </div>
        )}
      </div>
    </AppModal>
  );
}

function Timeline({ eventos, empty }: { eventos: CrmDossier["eventos"]; empty: string }) {
  if (eventos.length === 0) return <p className="text-sm text-slate-400 py-6 text-center">{empty}</p>;
  return (
    <ol className="relative border-l border-slate-200 ml-2 space-y-3 max-h-[420px] overflow-y-auto pr-2">
      {eventos.map(e => (
        <li key={e.id} className="ml-4">
          <span className={`absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full border-2 border-white ${TIPO_DOT[e.tipo] ?? "bg-slate-400"}`} />
          <p className="text-[11px] text-slate-400">{fmtWhen(e.createdAt)}{e.actorName ? ` · ${e.actorName}` : ""}</p>
          <p className="text-sm font-semibold text-slate-800">{e.titulo}</p>
          {e.detalhe && <p className="text-xs text-slate-600 mt-0.5 whitespace-pre-wrap">{e.detalhe}</p>}
        </li>
      ))}
    </ol>
  );
}
