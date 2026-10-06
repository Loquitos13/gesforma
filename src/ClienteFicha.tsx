import { useCallback, useEffect, useMemo, useState } from "react";
import {
  apiCrmCompletar, apiCrmDossier, apiCrmEtiquetas,
  apiCrmLeadNota, apiCrmNotaFixar, apiCrmLeadCampos, apiCrmCampoCreate,
  apiCrmDocValidar, apiCrmDocRecusar, apiCrmDocAlertar,
  apiCrmValidarPreinscricao, apiCrmTurmaCheia,
  type CrmCampoTipo, type CrmDossier, type CrmEtiqueta, type CrmLead,
} from "./api";
import { useAuth } from "./AuthGate";
import { etiquetaChip } from "./crmUi";
import {
  badgeEstadoCls, camposEmFalta, CRM_COLS, estadoPodeEntregar, isSecretariaRole,
  MODELOS_NOTA,
} from "./crmPipeline";
import { AppModal } from "./FormKit";
import { OptionSelect } from "./OptionSelect";
import type { Preinscricao } from "./ListsContext";
import { dismissAlertsForLead, persist, toastError, toastOk } from "./toastBus";
import { useTurmas } from "./TurmasContext";
import { EscolherTurmaPicker } from "./TurmaInscricao";
import { isTurmaActiva, lugaresLivres, type TurmaGold } from "./turmaModel";
import { CursoOfertaCampos } from "./CursoOfertaCampos";
import { OFERTA_VAZIA, type CursoOfertaSel } from "./oferta";
import { fmtDataCalendario } from "./datas";

const inp = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400";

function telDigits(telf: string) {
  const d = telf.replace(/\D/g, "");
  if (!d) return "";
  return d.startsWith("351") ? d : `351${d}`;
}

function fmtWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16).replace("T", " ");
  return d.toLocaleString("pt-PT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const TIPO_DOT: Record<string, string> = {
  criacao: "bg-slate-400", contacto: "bg-blue-500", nota: "bg-amber-500",
  estado: "bg-indigo-500", seguimento: "bg-teal-500", campo: "bg-violet-500", proposta: "bg-emerald-500",
};

export function ClienteFicha({
  item, onClose, onConvert, onContactar, onPatch, hasPrev, hasNext, onPrev, onNext, comerciais = [],
  regime = "gold", turmas,
}: {
  item: CrmLead | null;
  onClose: () => void;
  onConvert?: (turma: string) => void | Promise<void>;
  onContactar?: (nota: string, meio?: string) => void;
  onPatch?: (patch: Partial<Preinscricao>) => void;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  comerciais?: { id: string; name: string }[];
  regime?: "gold" | "fin";
  turmas?: TurmaGold[];
}) {
  const { user } = useAuth();
  const sec = isSecretariaRole(user.role, regime);
  const { gold } = useTurmas();
  const turmasLista = turmas ?? gold;
  const [dossier, setDossier] = useState<CrmDossier | null>(null);
  const [erro, setErro] = useState("");
  const [busy, setBusy] = useState(false);
  const [obsDoc, setObsDoc] = useState<Record<number, string>>({});
  const [tab, setTab] = useState<"actividade" | "dados" | "documentos" | "secretaria">("actividade");
  const [notaNova, setNotaNova] = useState("");
  const [meio, setMeio] = useState("Telefone");
  const [resultado, setResultado] = useState("");
  const [proximo, setProximo] = useState("");
  const [filtroEv, setFiltroEv] = useState("todos");
  const [etiquetas, setEtiquetas] = useState<CrmEtiqueta[]>([]);
  const [motivo, setMotivo] = useState("");
  const [pagMetodo, setPagMetodo] = useState("");
  const [entregando, setEntregando] = useState(false);
  const [escolherTurma, setEscolherTurma] = useState(false);
  const [turmaSel, setTurmaSel] = useState<TurmaGold | null>(null);
  const [dados, setDados] = useState({
    nome: "", apelido: "", email: "", telf: "", concelho: "", nif: "", moradaFiscal: "", codigoPostal: "",
  });
  const [oferta, setOferta] = useState<CursoOfertaSel>(OFERTA_VAZIA);
  const [vals, setVals] = useState<Record<number, string>>({});
  const [novoCampo, setNovoCampo] = useState(false);
  const [campoLabel, setCampoLabel] = useState("");
  const [campoTipo, setCampoTipo] = useState<CrmCampoTipo>("texto");

  const carregar = useCallback((id: number) => {
    setBusy(true);
    setErro("");
    apiCrmDossier(id)
      .then(d => {
        setDossier(d);
        setMeio(d.lead.meioContacto || "Telefone");
        setProximo(d.lead.proximoContacto ?? "");
        setMotivo(d.lead.motivoDesistencia ?? "");
        setPagMetodo(d.lead.pagamentoMetodo ?? "");
        setDados({
          nome: d.lead.nome, apelido: d.lead.apelido, email: d.lead.email, telf: d.lead.telf,
          concelho: d.lead.concelho, nif: d.lead.nif ?? "", moradaFiscal: d.lead.moradaFiscal ?? "",
          codigoPostal: d.lead.codigoPostal ?? "",
        });
        setOferta({
          curso: d.lead.curso, local: d.lead.local ?? "", horario: d.lead.horario ?? "",
          dataInicio: d.lead.inicioCurso && d.lead.inicioCurso !== "-" ? d.lead.inicioCurso : "",
          turmaId: d.lead.turmaId ?? 0,
        });
        setVals(Object.fromEntries(d.campos.map(c => [c.id, c.valor ?? ""])));
        setBusy(false);
      })
      .catch(() => {
        setErro("Não foi possível abrir o dossiê.");
        setBusy(false);
      });
  }, []);

  useEffect(() => {
    setTab("actividade");
    setNotaNova("");
    setEscolherTurma(false);
    setTurmaSel(null);
    setDossier(null);
    setResultado("");
    setEntregando(false);
  }, [item?.id]);

  useEffect(() => {
    apiCrmEtiquetas().then(r => setEtiquetas(r.etiquetas)).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!item) return;
    carregar(item.id);
  }, [item?.id, item?.estado, carregar]);

  useEffect(() => {
    if (!item) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && hasPrev) { e.preventDefault(); onPrev(); }
      if (e.key === "ArrowRight" && hasNext) { e.preventDefault(); onNext(); }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [item, hasPrev, hasNext, onPrev, onNext]);

  const lead = dossier?.lead ?? item;
  const falta = useMemo(() => lead ? camposEmFalta({
    nome: dados.nome || lead.nome, apelido: dados.apelido || lead.apelido,
    telf: dados.telf || lead.telf, email: dados.email || lead.email,
    concelho: dados.concelho || lead.concelho, curso: oferta.curso || lead.curso,
    local: oferta.local || lead.local, horario: oferta.horario || lead.horario,
    inicioCurso: oferta.dataInicio || lead.inicioCurso,
    nif: dados.nif, moradaFiscal: dados.moradaFiscal,
  }) : [], [lead, dados, oferta]);

  useEffect(() => {
    if (!item || !lead || lead.secretariaEm || entregando) return;
    if (!estadoPodeEntregar(lead.estado) || falta.length > 0) return;
    const t = window.setTimeout(async () => {
      setEntregando(true);
      try {
        const r = await apiCrmCompletar(item.id, {
          ...dados, curso: oferta.curso, local: oferta.local, horario: oferta.horario, inicioCurso: oferta.dataInicio,
        });
        setDossier(r);
        onPatch?.({
          estado: "Pré-inscrição", ...dados, curso: oferta.curso, local: oferta.local,
          horario: oferta.horario, inicioCurso: oferta.dataInicio, secretariaEm: r.lead.secretariaEm,
        });
        toastOk("Pré-inscrição entregue à secretaria.");
      } catch {
        /* ainda em falta no servidor */
      } finally {
        setEntregando(false);
      }
    }, 700);
    return () => window.clearTimeout(t);
    // onPatch muda a cada render do CRM
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, lead?.estado, lead?.secretariaEm, falta.length, entregando, dados, oferta]);

  if (!item || !lead) return null;
  const wa = telDigits(lead.telf);
  const entregue = Boolean(lead.secretariaEm);

  async function gravarNota(texto = notaNova, res = resultado) {
    if (!item) return;
    const r = await persist(apiCrmLeadNota(item.id, texto, meio, res));
    if (!r) return;
    setDossier(r);
    setNotaNova("");
    toastOk("Actividade registada.");
    if (lead?.estado === "Não contactado") onContactar?.(texto, meio);
    if (proximo) onPatch?.({ proximoContacto: proximo });
  }

  async function entregar() {
    if (!item || entregando) return;
    setEntregando(true);
    try {
      const r = await apiCrmCompletar(item.id, {
        ...dados, curso: oferta.curso, local: oferta.local, horario: oferta.horario, inicioCurso: oferta.dataInicio,
      });
      setDossier(r);
      onPatch?.({ estado: "Pré-inscrição", ...dados, curso: oferta.curso, local: oferta.local, horario: oferta.horario, inicioCurso: oferta.dataInicio, secretariaEm: r.lead.secretariaEm });
      toastOk("Pré-inscrição entregue à secretaria.");
      setTab("actividade");
    } catch (e) {
      toastError(e, "Ainda faltam dados obrigatórios.");
    } finally {
      setEntregando(false);
    }
  }

  async function guardarDados() {
    onPatch?.({
      ...dados, curso: oferta.curso, local: oferta.local, horario: oferta.horario,
      inicioCurso: oferta.dataInicio || "-", turmaId: oferta.turmaId,
    });
    toastOk("Dados gravados.");
    if (falta.length === 0 && estadoPodeEntregar(lead?.estado ?? "") && !lead?.secretariaEm) {
      await entregar();
    }
  }

  const eventos = (dossier?.eventos ?? []).filter(e => filtroEv === "todos" || e.tipo === filtroEv);

  return (
    <AppModal
      open
      variant="drawer"
      onClose={onClose}
      title={`${lead.nome} ${lead.apelido}`.trim() || `Pré-inscrição #${lead.id}`}
      sub={`${lead.curso || "Sem curso"} · ${[lead.local, lead.horario, lead.inicioCurso && lead.inicioCurso !== "-" ? fmtDataCalendario(lead.inicioCurso) : ""].filter(Boolean).join(" · ") || "turma por definir"}`}
    >
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between text-xs">
          <button type="button" disabled={!hasPrev} onClick={onPrev} className="px-2 py-1 border rounded-lg disabled:opacity-30">‹ Anterior</button>
          <div className="flex flex-wrap gap-1 justify-center">
            <span className={`px-2 py-0.5 rounded-full border font-semibold ${badgeEstadoCls(lead.estado)}`}>{lead.estado}</span>
            {entregue && <span className="px-2 py-0.5 rounded-full border border-violet-300 bg-violet-50 text-violet-800 font-semibold">Na secretaria</span>}
            {lead.comercialNome && <span className="px-2 py-0.5 rounded-full border border-slate-200 text-slate-600">{lead.comercialNome}</span>}
          </div>
          <button type="button" disabled={!hasNext} onClick={onNext} className="px-2 py-1 border rounded-lg disabled:opacity-30">Seguinte ›</button>
        </div>

        <p className="text-xs text-slate-500">{lead.email || "sem email"} · {lead.telf || "sem telemóvel"}{lead.concelho ? ` · ${lead.concelho}` : ""}</p>

        {(dossier?.outrosPedidos.length ?? 0) > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {dossier!.outrosPedidos.length} outro(s) pedido(s) deste contacto
            {dossier!.outrosPedidos.slice(0, 3).map(o => (
              <p key={o.id} className="text-amber-800 mt-0.5">#{o.id} · {o.curso} · {o.estado}</p>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <a href={lead.telf ? `tel:${lead.telf}` : undefined} onClick={() => { if (lead.telf) void gravarNota("Tentativa de chamada.", resultado || "Não atendeu"); }}
            className="flex-1 py-2 bg-slate-800 text-white text-sm font-semibold rounded-lg text-center">Ligar</a>
          {wa
            ? <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" onClick={() => void gravarNota("Abriu WhatsApp.", resultado || "Atendeu")}
                className="flex-1 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg text-center">WhatsApp</a>
            : <span className="flex-1 py-2 bg-slate-100 text-slate-400 text-sm font-semibold rounded-lg text-center">Sem WA</span>}
        </div>
        {lead.estado !== "Pré-inscrição" && lead.estado !== "Formando" && lead.estado !== "Desistiu" && (
          <button type="button" onClick={() => onPatch?.({ estado: "Pré-inscrição" })}
            className="w-full py-2 bg-violet-600 text-white text-sm font-semibold rounded-lg">
            Passar a pré-inscrito
          </button>
        )}

        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {([["actividade", "Actividade"], ["dados", "Dados"], ["documentos", "Documentos"], ["secretaria", `Secretaria${falta.length ? ` (${falta.length})` : ""}`]] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setTab(id)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md ${tab === id ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}>
              {label}
            </button>
          ))}
        </div>
        {erro && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{erro}</p>}

        {tab === "actividade" && (
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 p-3 space-y-2 bg-slate-50">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Registar contacto</p>
              <div className="flex flex-wrap gap-1">
                {MODELOS_NOTA.map(m => (
                  <button key={m.label} type="button" onClick={() => { setNotaNova(m.texto); setResultado(m.resultado); }}
                    className="px-2 py-1 text-[11px] rounded-md border border-slate-200 bg-white hover:bg-amber-50">{m.label}</button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <OptionSelect lista="meios_contacto" value={meio} onChange={setMeio} />
                <OptionSelect lista="resultados_contacto" value={resultado} onChange={setResultado} allowEmpty placeholder="Resultado…" />
              </div>
              <textarea className={`${inp} resize-none`} rows={2} value={notaNova} onChange={e => setNotaNova(e.target.value)} placeholder="O que ficou combinado…" />
              <div className="flex gap-2 items-end">
                <label className="flex-1 text-[10px] font-bold uppercase text-slate-400">Próximo
                  <input className={inp} type="datetime-local" value={proximo.length === 10 ? `${proximo}T09:00` : proximo.slice(0, 16).replace(" ", "T")}
                    onChange={e => setProximo(e.target.value.replace("T", " ").slice(0, 16))} />
                </label>
                <button type="button" onClick={() => {
                  const d = new Date(); d.setDate(d.getDate() + 1);
                  setProximo(`${d.toISOString().slice(0, 10)} 09:00`);
                }} className="px-2 py-2 text-[11px] border rounded-lg">+1 d</button>
                <button type="button" onClick={() => {
                  const d = new Date(); d.setDate(d.getDate() + 3);
                  setProximo(`${d.toISOString().slice(0, 10)} 09:00`);
                }} className="px-2 py-2 text-[11px] border rounded-lg">+3 d</button>
              </div>
              <button type="button" disabled={!notaNova.trim() && !resultado} onClick={() => void gravarNota()}
                className="w-full py-2 bg-amber-500 disabled:opacity-40 text-white text-sm font-semibold rounded-lg">Gravar actividade</button>
            </div>

            <div className="flex flex-wrap gap-1">
              {["todos", "contacto", "nota", "estado", "seguimento"].map(f => (
                <button key={f} type="button" onClick={() => setFiltroEv(f)}
                  className={`px-2 py-0.5 text-[11px] rounded-full border ${filtroEv === f ? "bg-slate-800 text-white border-slate-800" : "border-slate-200 text-slate-500"}`}>
                  {f === "todos" ? "Tudo" : f}
                </button>
              ))}
            </div>
            {(dossier?.notas ?? []).filter(n => n.fixada).map(n => (
              <div key={n.id} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[11px] text-amber-800 font-semibold">Fixada · {n.actorName}</p>
                  <button type="button" className="text-[11px] text-amber-700 font-semibold" onClick={() => void persist(apiCrmNotaFixar(item.id, n.id, false)).then(r => r && setDossier(r))}>Desafixar</button>
                </div>
                <p className="whitespace-pre-wrap">{n.nota}</p>
              </div>
            ))}
            <ol className="relative border-l border-slate-200 ml-2 space-y-3 max-h-[360px] overflow-y-auto pr-2">
              {eventos.length === 0 && <p className="text-sm text-slate-400 py-6 text-center">{busy ? "A carregar…" : "Ainda sem actividade."}</p>}
              {eventos.map(e => (
                <li key={e.id} className="ml-4">
                  <span className={`absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full border-2 border-white ${TIPO_DOT[e.tipo] ?? "bg-slate-400"}`} />
                  <p className="text-[11px] text-slate-400">{fmtWhen(e.createdAt)}{e.actorName ? ` · ${e.actorName}` : ""}</p>
                  <p className="text-sm font-semibold text-slate-800">{e.titulo}</p>
                  {e.detalhe && <p className="text-xs text-slate-600 mt-0.5 whitespace-pre-wrap">{e.detalhe}</p>}
                </li>
              ))}
            </ol>
            <div className="space-y-1">
              {(dossier?.notas ?? []).map(n => (
                <div key={`n-${n.id}`} className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                  <p className="truncate">{n.fixada ? "★ " : ""}{n.nota.slice(0, 72)}</p>
                  <button type="button" onClick={() => void persist(apiCrmNotaFixar(item.id, n.id, !n.fixada)).then(r => r && setDossier(r))}
                    className={`shrink-0 font-semibold ${n.fixada ? "text-amber-700" : "text-slate-400 hover:text-amber-700"}`}>
                    {n.fixada ? "Desafixar" : "Fixar"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "dados" && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">NIF e morada fiscal são opcionais até à etapa Pré-inscrição.</p>
            <div className="grid grid-cols-2 gap-2">
              {(["nome", "apelido", "telf", "email", "concelho"] as const).map(k => (
                <label key={k} className="text-xs font-semibold text-slate-500 uppercase flex flex-col gap-1">
                  {k}
                  <input className={inp} value={dados[k]} onChange={e => setDados(d => ({ ...d, [k]: e.target.value }))} />
                </label>
              ))}
            </div>
            <CursoOfertaCampos
              variant="crm"
              turmas={turmasLista.filter(isTurmaActiva).map(t => ({
                turmaId: t.id, nome: t.nome, curso: t.curso, local: t.local, horario: t.horario,
                dataInicio: t.dataInicio, vagasLivres: Math.max(0, lugaresLivres(t)),
              }))}
              cursos={[...new Set(turmasLista.map(t => t.curso))].map(nome => ({ nome }))}
              value={oferta}
              onChange={setOferta}
            />
            <label className="text-xs font-semibold text-slate-500 uppercase flex flex-col gap-1">NIF (opcional agora)
              <input className={inp} value={dados.nif} onChange={e => setDados(d => ({ ...d, nif: e.target.value }))} placeholder="9 dígitos" />
            </label>
            <label className="text-xs font-semibold text-slate-500 uppercase flex flex-col gap-1">Morada fiscal (opcional agora)
              <input className={inp} value={dados.moradaFiscal} onChange={e => setDados(d => ({ ...d, moradaFiscal: e.target.value }))} />
            </label>
            <label className="text-xs font-semibold text-slate-500 uppercase flex flex-col gap-1">Código postal
              <input className={inp} value={dados.codigoPostal} onChange={e => setDados(d => ({ ...d, codigoPostal: e.target.value }))} />
            </label>
            <label className="text-xs font-semibold text-slate-500 uppercase flex flex-col gap-1">Comercial
              <select className={inp} value={lead.comercialId ?? ""} onChange={e => onPatch?.({ comercialId: e.target.value || null })}>
                <option value="">Sem dono</option>
                {comerciais.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <div>
              <p className="text-xs font-bold uppercase text-slate-400 mb-1">Etiqueta</p>
              <div className="flex flex-wrap gap-1.5">
                {etiquetas.map(e => (
                  <button key={e.id} type="button" onClick={() => onPatch?.({ etiquetaId: e.id, etiquetaNome: e.nome, etiquetaCor: e.cor })}>
                    {etiquetaChip(e.nome, e.cor)}
                  </button>
                ))}
              </div>
            </div>
            <button type="button" onClick={guardarDados} className="w-full py-2 border text-sm font-semibold rounded-lg">Guardar dados</button>
            <div className="grid grid-cols-2 gap-2">
              <select className={inp} value={lead.estado} onChange={e => {
                const est = e.target.value;
                if (est === "Pago") {
                  onPatch?.({ estado: "Pago", pagamentoMetodo: pagMetodo || "MB Way" });
                  return;
                }
                onPatch?.({ estado: est });
              }}>
                {CRM_COLS.filter(c => c.id !== "Formando" && c.id !== "Desistiu").map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              <OptionSelect lista="metodos_pagamento" value={pagMetodo} onChange={setPagMetodo} allowEmpty placeholder="Método de pagamento" />
            </div>
            <div className="rounded-lg border border-slate-200 p-3 space-y-2">
              <p className="text-xs font-semibold text-slate-600">Desistiu</p>
              <OptionSelect lista="motivos_desistencia" value={motivo} onChange={setMotivo} allowEmpty placeholder="Motivo…" />
              <button type="button" disabled={!motivo} onClick={() => onPatch?.({ estado: "Desistiu", motivoDesistencia: motivo })}
                className="w-full py-1.5 text-xs font-semibold rounded-lg border border-slate-300">Marcar desistência</button>
            </div>
          </div>
        )}

        {tab === "documentos" && (
          <div className="space-y-3">
            {dossier?.docsFechado ? (
              <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">Ligação encerrada. A secretaria validou a pré-inscrição.</p>
            ) : dossier?.docsUrl && (
              <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-violet-700">Ligação pessoal</p>
                <p className="text-xs text-violet-900 break-all mt-1">{dossier.docsUrl}</p>
                <button type="button" className="mt-2 text-xs font-semibold text-violet-800"
                  onClick={() => void navigator.clipboard?.writeText(dossier.docsUrl ?? "")}>Copiar ligação</button>
              </div>
            )}
            {dossier?.pagamento && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Pagamento</p>
                <p className="text-slate-800 mt-1">Entidade {dossier.pagamento.entidade || "—"} · Ref. {dossier.pagamento.referencia}</p>
                <p className="text-slate-700">€ {dossier.pagamento.valor.toLocaleString("pt-PT")} · {dossier.pagamento.estado}</p>
              </div>
            )}
            {!!dossier?.docsEmFalta?.length && (
              <p className="text-xs text-amber-800">Ainda falta: {dossier.docsEmFalta.join(", ")}</p>
            )}
            {(dossier?.documentos ?? []).length === 0 && (
              <p className="text-sm text-slate-400">Ainda sem ficheiros nesta ficha. A pessoa envia-os pela ligação pessoal.</p>
            )}
            <ul className="space-y-2">
              {(dossier?.documentos ?? []).map(d => {
                const estado = d.estado || "pendente";
                return (
                  <li key={d.id} className="rounded-lg border border-slate-200 px-3 py-2 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800">{d.label}</p>
                        <p className="text-xs text-slate-500 truncate">{d.nome}</p>
                        <p className={`text-[11px] font-semibold mt-1 ${estado === "validado" ? "text-emerald-700" : estado === "recusado" ? "text-red-700" : "text-amber-700"}`}>
                          {estado === "validado" ? "Validado" : estado === "recusado" ? "Recusado" : "Por validar"}
                        </p>
                        {d.observacao && <p className="text-xs text-red-800 mt-1">{d.observacao}</p>}
                      </div>
                      {d.url
                        ? <a href={d.url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-amber-700 shrink-0">Abrir</a>
                        : <span className="text-xs text-slate-400">no Drive</span>}
                    </div>
                    {estado !== "validado" && (
                      <div className="space-y-1.5">
                        <textarea
                          className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg"
                          rows={2}
                          placeholder="O que está incorrecto"
                          value={obsDoc[d.id] ?? d.observacao ?? ""}
                          onChange={e => setObsDoc(prev => ({ ...prev, [d.id]: e.target.value }))}
                        />
                        <div className="flex gap-2">
                          <button type="button" className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white" onClick={() => {
                            void persist(apiCrmDocValidar(item.id, d.id)).then(r => {
                              if (!r) return;
                              setDossier(r);
                              dismissAlertsForLead(item.id);
                            });
                          }}>Validar</button>
                          <button type="button" className="flex-1 py-1.5 text-xs font-semibold rounded-lg border border-red-200 text-red-700" onClick={() => {
                            const nota = (obsDoc[d.id] ?? d.observacao ?? "").trim();
                            if (!nota) { toastError(new Error("Escreva o que está incorrecto.")); return; }
                            void persist(apiCrmDocRecusar(item.id, d.id, nota)).then(r => { if (r) setDossier(r); });
                          }}>Recusar</button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {(dossier?.documentos ?? []).some(d => d.estado === "recusado") && !dossier?.docsFechado && (
              <button type="button" className="w-full py-2 text-sm font-semibold rounded-lg bg-amber-500 text-white" onClick={() => {
                void persist(apiCrmDocAlertar(item.id)).then(r => { if (r) toastOk("Email enviado com o que está incorrecto."); });
              }}>Alertar documentos incorrectos</button>
            )}
          </div>
        )}

        {tab === "secretaria" && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Complete o que falta (NIF e morada fiscal inclusive). Quando o dossiê ficar completo, o pedido passa sozinho para a secretaria.
            </p>
            {entregando && <p className="text-xs text-violet-800">A entregar à secretaria…</p>}
            {falta.length === 0
              ? <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{entregue ? "Na secretaria." : "Dossier completo - a entregar à secretaria."}</p>
              : (
                <ul className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 list-disc list-inside">
                  {falta.map(f => <li key={f.key}>{f.label}</li>)}
                </ul>
              )}
            <label className="text-xs font-semibold uppercase text-slate-500 flex flex-col gap-1">NIF
              <input className={inp} value={dados.nif} onChange={e => setDados(d => ({ ...d, nif: e.target.value }))} onBlur={() => { if (falta.length <= 1) void guardarDados(); }} />
            </label>
            <label className="text-xs font-semibold uppercase text-slate-500 flex flex-col gap-1">Morada fiscal
              <input className={inp} value={dados.moradaFiscal} onChange={e => setDados(d => ({ ...d, moradaFiscal: e.target.value }))} onBlur={() => { if (falta.length <= 1) void guardarDados(); }} />
            </label>
            {!entregue && falta.length > 0 && (
              <p className="text-xs text-slate-500">O botão deixa de ser necessário: ao gravar o último campo o processo segue para a secretaria.</p>
            )}
            <div className="rounded-lg border border-slate-200 p-3 space-y-2">
              <p className="text-xs font-semibold uppercase text-slate-500">Validação da pré-inscrição</p>
              {dossier?.turmaEscolhida ? (
                <p className="text-sm text-slate-700">
                  Cronograma: <span className="font-semibold">{dossier.turmaEscolhida.nome}</span>
                  {" · "}{dossier.turmaEscolhida.local} · {dossier.turmaEscolhida.horario}
                  {dossier.turmaEscolhida.livres <= 0 ? " · sem vagas" : ` · ${dossier.turmaEscolhida.livres} vagas`}
                </p>
              ) : (
                <p className="text-sm text-slate-500">A pessoa ainda não escolheu o cronograma na ligação pessoal.</p>
              )}
              {dossier?.percursoConcluido && !dossier.docsFechado && (
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">Processo concluído. Aguarda validação da secretaria.</p>
              )}
              {dossier?.faltaValidar && !dossier.docsFechado && (
                <p className="text-xs text-slate-500">{dossier.faltaValidar}</p>
              )}
              {sec && !dossier?.docsFechado && (
                <button
                  type="button"
                  disabled={!dossier?.podeValidar || busy}
                  onClick={() => {
                    void persist(apiCrmValidarPreinscricao(item.id)).then(r => {
                      if (!r) return;
                      setDossier(r);
                      toastOk("Pré-inscrição validada. A ligação pessoal foi encerrada e os documentos seguiram para a pasta da turma.");
                    });
                  }}
                  className="w-full py-2.5 bg-emerald-600 disabled:opacity-40 text-white text-sm font-bold rounded-lg"
                >
                  Validar pré-inscrição
                </button>
              )}
              {sec && !dossier?.docsFechado && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    void persist(apiCrmTurmaCheia(item.id)).then(r => {
                      if (!r) return;
                      toastOk(r.enviadas
                        ? `Email enviado com ${r.enviadas} turma${r.enviadas === 1 ? "" : "s"} no mesmo local.`
                        : "Email enviado. Não há outra turma com vaga nesse local.");
                      void carregar(item.id);
                    });
                  }}
                  className="w-full py-2 text-sm font-semibold rounded-lg border border-amber-300 text-amber-900 bg-amber-50"
                >
                  Turma cheia: enviar outra data
                </button>
              )}
              <p className="text-[11px] leading-relaxed text-slate-500">
                O email sugere a próxima turma do mesmo curso, no mesmo local, no mesmo horário ou noutro horário. A ligação pessoal continua aberta.
              </p>
            </div>
            {entregue && sec && (
              !escolherTurma ? (
                <button type="button" onClick={() => setEscolherTurma(true)} className="w-full py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-lg">
                  Inscrever numa turma
                </button>
              ) : (
                <div className="space-y-2">
                  <EscolherTurmaPicker lead={lead} turmas={turmasLista} valueId={turmaSel?.id ?? null} onChange={setTurmaSel} />
                  <button type="button" disabled={!turmaSel} onClick={() => turmaSel && void onConvert?.(turmaSel.nome)} className="w-full py-2 bg-emerald-600 disabled:opacity-40 text-white text-sm font-bold rounded-lg">Confirmar inscrição</button>
                </div>
              )
            )}
            {entregue && !sec && (
              <p className="text-xs text-violet-800 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">À espera da secretaria para colocar o formando na turma.</p>
            )}
            {novoCampo ? (
              <div className="rounded-lg border p-3 space-y-2">
                <input className={inp} value={campoLabel} onChange={e => setCampoLabel(e.target.value)} placeholder="Novo campo (todas as pré-inscrições)" />
                <select className={inp} value={campoTipo} onChange={e => setCampoTipo(e.target.value as CrmCampoTipo)}>
                  <option value="texto">Texto</option><option value="numero">Número</option><option value="data">Data</option>
                </select>
                <button type="button" onClick={() => void persist(apiCrmCampoCreate({ label: campoLabel, tipo: campoTipo })).then(() => item && carregar(item.id))} className="text-xs font-semibold">Criar</button>
              </div>
            ) : (
              <button type="button" onClick={() => setNovoCampo(true)} className="text-xs text-slate-400">+ Campo extra (todas as pré-inscrições)</button>
            )}
            {(dossier?.campos ?? []).map(c => (
              <label key={c.id} className="text-xs font-semibold uppercase text-slate-500 flex flex-col gap-1">{c.label}
                <input className={inp} value={vals[c.id] ?? ""} onChange={e => setVals(v => ({ ...v, [c.id]: e.target.value }))} />
              </label>
            ))}
            {(dossier?.campos.length ?? 0) > 0 && (
              <button type="button" onClick={() => void persist(apiCrmLeadCampos(item.id, Object.entries(vals).map(([campoId, valor]) => ({ campoId: Number(campoId), valor })))).then(r => r && setDossier(r))} className="w-full py-2 border text-xs font-semibold rounded-lg">Guardar campos extra</button>
            )}
          </div>
        )}
      </div>
    </AppModal>
  );
}

export function badgeEstado(estado: string) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${badgeEstadoCls(estado)}`}>{estado}</span>;
}
