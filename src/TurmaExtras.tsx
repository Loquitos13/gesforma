import { useEffect, useMemo, useRef, useState } from "react";
import {
  ApiError, apiAddInqueritoResposta, apiDriveFiles, apiDtpModelo, apiFormadorDocs, apiInqueritoPublicoLink, apiInqueritoRespostas, apiSaveFormadorDocs, apiUploadDrive,
  type DriveFile, type DriveUploadContext, type InqueritoMetrica, type InqueritoResposta,
} from "./api";
import { DOCS_FORMADOR, fundirDocTipos } from "./dossierDocs";
import { catalogIdRemapSubscribe, useCatalogList } from "./CatalogsContext";
import { useDrive } from "./DriveContext";
import { useFormadores } from "./FormadoresContext";
import { FAIXAS_DISPONIBILIDADE } from "./formadorModel";
import { AppModal } from "./FormKit";
import { ConfirmDangerModal } from "./SecretaryUX";
import { persist } from "./toastBus";
import { useTurmas } from "./TurmasContext";
import { useLists } from "./ListsContext";
import { imprimirFolhasPresencas } from "./presencasPrint";
import { dtpCategoriaPasta, dtpPastaNome } from "./dtpPasta";

const I = {
  x: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>,
  download: <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd"/></svg>,
  file: <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd"/></svg>,
  edit: <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>,
  eye: <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/></svg>,
  trash: <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/></svg>,
  copy: <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" /><path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" /></svg>,
};

function ActBtn({ icon, label, color = "blue", onClick }: { icon: React.ReactNode; label: string; color?: string; onClick?: () => void }) {
  const map: Record<string, string> = {
    blue: "bg-blue-100 text-blue-700 hover:bg-blue-200",
    gray: "bg-slate-100 text-slate-500 hover:bg-slate-200",
    red: "bg-red-100 text-red-600 hover:bg-red-200",
  };
  return (
    <button title={label} aria-label={label} onClick={onClick} className={`w-7 h-7 inline-flex items-center justify-center rounded-lg transition-colors ${map[color] ?? map.blue}`}>
      {icon}
    </button>
  );
}

function SlideOver({ open, onClose, title, sub, children, size = "md" }: { open: boolean; onClose: () => void; title: string; sub?: string; children: React.ReactNode; size?: "sm" | "md" | "lg" | "xl" }) {
  return <AppModal open={open} onClose={onClose} title={title} sub={sub} size={size}>{children}</AppModal>;
}

export function FileUploadModal({
  open, onClose, title, accent = "gold", onConfirm, context,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  accent?: "gold" | "fin";
  onConfirm?: (file: DriveFile) => void;
  context?: DriveUploadContext;
}) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const gold = accent === "gold";
  const { status } = useDrive();
  const dest = [
    status.folderName,
    context?.regime === "fin" ? "Financiada" : context?.regime === "gold" ? "Gold" : null,
    context?.turma ? dtpPastaNome(context.regime === "fin" ? "fin" : "gold", context.turma) : null,
    context?.turma
      ? dtpCategoriaPasta({
          id: context.itemId,
          kind: context.kind,
          ambito:
            context.kind === "formando-doc" || context.kind === "pip"
              ? "formando"
              : context.kind === "formador-doc"
                ? "formador"
                : undefined,
        })
      : null,
    context?.formando ?? null,
    context?.label ?? context?.kind,
  ].filter(Boolean).join(" / ");

  function handleClose() {
    if (busy) return;
    setFile(null);
    setError(null);
    onClose();
  }

  async function handleConfirm() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const uploaded = await apiUploadDrive(file, context ?? { kind: "documento", regime: accent });
      onConfirm?.(uploaded);
      setFile(null);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível enviar o ficheiro.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-800">{title ?? "Importar documento"}</p>
          <button onClick={handleClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100">{I.x}</button>
        </div>
        <div className="p-5 space-y-4">
          <div className={`rounded-xl border px-3 py-2.5 text-xs ${status.connected ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-slate-50 border-slate-200 text-slate-600"}`}>
            {status.connected
              ? <>Vai para o Drive da entidade · <span className="font-semibold">{dest || status.folderName}</span></>
              : <>Ainda sem Drive ligado. Em produção o upload é recusado - ligue a conta Google em Configurações. Em desenvolvimento local o ficheiro fica em disco só como recurso.</>}
          </div>
          {!file ? (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${dragging ? (gold ? "border-amber-400 bg-amber-50" : "border-blue-400 bg-blue-50") : "border-slate-200 hover:border-amber-300 hover:bg-slate-50"}`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 ${gold ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"}`}>{I.download}</div>
              <p className="text-sm font-semibold text-slate-700">Arraste o ficheiro para aqui</p>
              <p className="text-xs text-slate-400 mt-1">ou clique para escolher do computador</p>
              <p className="text-xs text-slate-400 mt-1">PDF, DOC, JPG, PNG, MP4 - máx. 10 MB</p>
              <input ref={inputRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setFile(f); }} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.mp4,.webm" />
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600 flex-shrink-0">{I.file}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{file.name}</p>
                <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(0)} KB</p>
              </div>
              <button onClick={() => setFile(null)} className="p-1 text-slate-400 hover:text-red-500" disabled={busy}>{I.x}</button>
            </div>
          )}
          {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={handleClose} disabled={busy} className="flex-1 py-2 border border-slate-200 text-sm text-slate-600 rounded-lg hover:bg-slate-50 disabled:opacity-40">Cancelar</button>
          <button disabled={!file || busy} onClick={() => void handleConfirm()}
            className={`flex-1 py-2 disabled:opacity-40 text-white text-sm font-semibold rounded-lg ${gold ? "bg-amber-500 hover:bg-amber-600" : "bg-blue-600 hover:bg-blue-700"}`}>
            {busy ? "A enviar…" : status.connected ? "Enviar para o Drive" : "Guardar ficheiro"}
          </button>
        </div>
      </div>
    </div>
  );
}

export type ResolveDocEstado = "ok" | "parcial" | "falta";
export type ResolveListaItem = { id: string; nome: string; ok: boolean };
export type CriterioAvaliacao = { id: string; label: string };

export type PipItem = { id: string; nome: string; fileName?: string };
export type SimItem = { id: string; nome: string; videoName?: string; notas: Record<string, number | undefined> };

export type ResolveDocKind = "ficheiro" | "lista" | "pip" | "simulacao";

export type ResolveDocTarget = {
  label: string;
  detalhe: string;
  estado: ResolveDocEstado;
  kind: ResolveDocKind;
  items?: ResolveListaItem[];
  pipItems?: PipItem[];
  simItems?: SimItem[];
  curso?: string;
  criterios?: CriterioAvaliacao[];
};

export const criteriosCcp: CriterioAvaliacao[] = [
  { id: "planif", label: "Planificação da sessão" },
  { id: "comun", label: "Comunicação e linguagem" },
  { id: "metodos", label: "Métodos e técnicas pedagógicas" },
  { id: "grupo", label: "Gestão do grupo e do tempo" },
  { id: "recursos", label: "Utilização de recursos didáticos" },
  { id: "aval", label: "Avaliação das aprendizagens" },
];

/** Sem ficha de curso gravada, o CCP usa a grelha padrão da simulação pedagógica. */
export function getParametrosAvaliacao(curso?: string) {
  const nome = curso ?? "Formação de Formadores - CCP";
  if (/ccp|formadores/i.test(nome)) return { curso: nome, criterios: criteriosCcp.map(c => ({ ...c })) };
  return { curso: nome, criterios: [] };
}

export function seedPipItems(nomes: string[], saved?: PipItem[]): PipItem[] {
  if (saved?.length) return saved.map(i => ({ ...i }));
  return nomes.map((nome, i) => ({ id: String(i + 1), nome }));
}

export function seedSimItems(nomes: string[], criterios: CriterioAvaliacao[], saved?: SimItem[]): SimItem[] {
  if (saved?.length) {
    return saved.map(i => ({
      ...i,
      notas: Object.fromEntries(criterios.map(c => [c.id, i.notas[c.id]])),
    }));
  }
  return nomes.map((nome, i) => ({
    id: String(i + 1),
    nome,
    notas: Object.fromEntries(criterios.map(c => [c.id, undefined])),
  }));
}

export function pipEstado(items: PipItem[]): { estado: ResolveDocEstado; detalhe: string; done: number } {
  const done = items.filter(i => i.fileName).length;
  const estado: ResolveDocEstado = done === 0 ? "falta" : done === items.length ? "ok" : "parcial";
  return { estado, detalhe: `${done}/${items.length} projetos arquivados.`, done };
}

export function grelhaCompleta(item: SimItem, criterios: CriterioAvaliacao[]) {
  return criterios.length > 0 && criterios.every(c => typeof item.notas[c.id] === "number");
}
export function simAlunoEstado(item: SimItem, criterios: CriterioAvaliacao[]): ResolveDocEstado {
  const vid = !!item.videoName;
  const gre = grelhaCompleta(item, criterios);
  if (vid && gre) return "ok";
  if (vid || gre || Object.values(item.notas).some(v => typeof v === "number")) return "parcial";
  return "falta";
}
export function simEstado(items: SimItem[], criterios: CriterioAvaliacao[]): { estado: ResolveDocEstado; detalhe: string; done: number } {
  const done = items.filter(i => simAlunoEstado(i, criterios) === "ok").length;
  const algum = items.some(i => simAlunoEstado(i, criterios) !== "falta");
  const estado: ResolveDocEstado = done === items.length && items.length > 0 ? "ok" : done === 0 && !algum ? "falta" : "parcial";
  return { estado, detalhe: `${done}/${items.length} formandos com vídeo e grelha.`, done };
}

export function seedListaFromDetalhe(detalhe: string, nomes: string[]): ResolveListaItem[] {
  const m = detalhe.match(/(\d+)\s*\/\s*(\d+)/);
  const okCount = m ? Number(m[1]) : 0;
  const total = m ? Number(m[2]) : nomes.length;
  const list = nomes.slice(0, total);
  while (list.length < total) list.push(list.length < 16 ? `Sessão ${list.length + 1}` : `Item ${list.length + 1}`);
  return list.map((nome, i) => ({ id: String(i + 1), nome, ok: i < okCount }));
}

const PRESENCAS_GOLD_SEED = [
  { id: 1, nome: "Tiago Bento", presente: true },
  { id: 2, nome: "Luciana D'Avila", presente: true },
  { id: 3, nome: "Ciara Gonçalves", presente: false },
  { id: 4, nome: "Liliana Real", presente: true },
  { id: 5, nome: "Angélica Ribeiro", presente: true },
  { id: 6, nome: "Maria Mota", presente: true },
  { id: 7, nome: "Elisabete Soares", presente: false },
  { id: 8, nome: "Andreia Arantes", presente: true },
  { id: 9, nome: "Hugo Baldaia", presente: true },
  { id: 10, nome: "Marta Maia", presente: true },
];

export function PresencasSessaoModal({ open, onClose, sessao, formandos, onSave, turmaNome, cursoNome }: {
  open: boolean; onClose: () => void;
  sessao?: { n: number; data: string; hora: string; modulo?: string; formador?: string };
  formandos?: { id: number; nome: string; presente?: boolean }[];
  onSave?: (rows: { id: number; nome: string; presente: boolean }[]) => void;
  turmaNome?: string;
  cursoNome?: string;
}) {
  function seed() {
    const src = formandos?.length ? formandos : PRESENCAS_GOLD_SEED;
    return src.map((f, i) => ({
      id: f.id,
      nome: f.nome,
      presente: f.presente ?? i !== 2,
    }));
  }
  const [presencas, setPresencas] = useState(seed);
  useEffect(() => {
    if (open) setPresencas(seed());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sessao?.n]);
  const presentes = presencas.filter(p => p.presente).length;
  const pct = Math.round((presentes / presencas.length) * 100);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <p className="text-sm font-semibold text-slate-800">Folha de Presenças - Sessão {sessao?.n}</p>
            <p className="text-xs text-slate-400">{sessao?.data} · {sessao?.hora}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100">{I.x}</button>
        </div>
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">{presentes}/{presencas.length} presentes</span>
            <div className="flex items-center gap-2">
              <div className="w-32 bg-slate-200 rounded-full h-1.5">
                <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: pct >= 90 ? "#10B981" : pct >= 75 ? "#F59E0B" : "#EF4444" }} />
              </div>
              <span className={`text-xs font-bold ${pct >= 90 ? "text-emerald-600" : pct >= 75 ? "text-amber-600" : "text-red-600"}`}>{pct}%</span>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
          {presencas.map(p => (
            <label key={p.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 cursor-pointer">
              <button type="button" onClick={() => setPresencas(prev => prev.map(x => x.id === p.id ? { ...x, presente: !x.presente } : x))}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${p.presente ? "bg-emerald-500 border-emerald-500" : "border-slate-300"}`}>
                {p.presente && <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>}
              </button>
              <span className="flex-1 text-sm text-slate-700">{p.nome}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${p.presente ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                {p.presente ? "Presente" : "Falta"}
              </span>
            </label>
          ))}
        </div>
        <div className="flex gap-2 px-5 py-4 border-t border-slate-100 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2 border border-slate-200 text-sm text-slate-600 rounded-lg hover:bg-slate-50">Cancelar</button>
          <button
            type="button"
            onClick={() => imprimirFolhasPresencas({
              turma: turmaNome || "Turma",
              curso: cursoNome || "",
              formandos: presencas,
              sessoes: [{ n: sessao?.n ?? 0, data: sessao?.data ?? "", hora: sessao?.hora ?? "", modulo: sessao?.modulo, formador: sessao?.formador }],
            })}
            className="flex-1 py-2 border border-slate-200 text-sm font-semibold text-slate-700 rounded-lg hover:bg-slate-50"
          >
            Imprimir folha
          </button>
          <button onClick={() => { onSave?.(presencas); onClose(); }} className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg">Guardar presenças</button>
        </div>
      </div>
    </div>
  );
}

type DocField = { id: string; label: string; required: boolean; uploaded: boolean; fileName?: string; driveUrl?: string; driveFileId?: string };

export function FormadorProfileSlideOver({ open, onClose, nome, telf, accent = "gold", turma }: { open: boolean; onClose: () => void; nome: string; telf?: string; accent?: "gold" | "fin"; turma?: string }) {
  const { formadores } = useFormadores();
  const formador = formadores.find(f => f.nome === nome);
  const { gold, fin } = useTurmas();
  const { cursosGold, cursosFin } = useLists();
  const [docs, setDocs] = useState<DocField[]>(() => DOCS_FORMADOR.map(d => ({ ...d, uploaded: false, required: Boolean(d.required) })));
  const [uploadFor, setUploadFor] = useState<string | null>(null);
  const [ficheiros, setFicheiros] = useState<DriveFile[]>([]);

  const cursos = useMemo(() => {
    const nomes = new Set<string>();
    for (const t of [...gold, ...fin]) {
      const daTurma = t.cronograma.some(s => (s.formadores ?? []).includes(nome)) || t.formador === nome;
      if (daTurma && t.curso) nomes.add(t.curso);
    }
    return [...nomes];
  }, [fin, gold, nome]);

  useEffect(() => {
    if (!open || !formador) return;
    let alive = true;
    apiFormadorDocs(formador.id)
      .then(async r => {
        if (!alive) return;
        const extras: { id: string; label: string }[] = [];
        for (const nomeCurso of cursos) {
          const goldId = cursosGold.find(c => c.nome === nomeCurso)?.id;
          const finId = cursosFin.find(c => c.ufcd === nomeCurso || c.nomeComercial === nomeCurso)?.id;
          if (goldId != null) {
            const m = await apiDtpModelo("gold", goldId).catch(() => null);
            extras.push(...((m?.efectivo ?? m?.modelo)?.extra.filter(x => x.ambito === "formador").map(x => ({ id: x.id, label: x.label })) ?? []));
          }
          if (finId != null) {
            const m = await apiDtpModelo("fin", finId).catch(() => null);
            extras.push(...((m?.efectivo ?? m?.modelo)?.extra.filter(x => x.ambito === "formador").map(x => ({ id: x.id, label: x.label })) ?? []));
          }
        }
        const lista = fundirDocTipos(DOCS_FORMADOR, extras).map(d => ({ ...d, required: Boolean(d.required), uploaded: false as boolean }));
        setDocs(lista.map(d => {
          const saved = r.docs.find(x => x.id === d.id);
          return {
            ...d,
            uploaded: saved?.uploaded ?? false,
            fileName: saved?.fileName,
            driveUrl: saved?.driveUrl,
            driveFileId: saved?.driveFileId,
          };
        }));
      })
      .catch(() => undefined);
    apiDriveFiles({ kind: "formador-doc", regime: accent, formando: nome })
      .then(r => { if (alive) setFicheiros(r.files); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [accent, cursos, cursosFin, cursosGold, formador, nome, open]);

  function markUploaded(id: string, file: DriveFile) {
    const next = docs.map(d => d.id === id ? { ...d, uploaded: true, fileName: file.name, driveUrl: file.openUrl, driveFileId: file.id } : d);
    setDocs(next);
    setUploadFor(null);
    if (formador) {
      void persist(apiSaveFormadorDocs(formador.id, next.map(d => ({
        id: d.id, uploaded: d.uploaded, fileName: d.fileName ?? "", driveFileId: d.driveFileId ?? "", driveUrl: d.driveUrl ?? "",
      }))));
    }
  }

  function abrirFicheiro(doc: DocField) {
    const url = doc.driveUrl || ficheiros.find(f => f.label === doc.label || f.name === doc.fileName)?.openUrl;
    if (url) window.open(url, "_blank", "noreferrer");
  }

  return (
    <>
      <SlideOver open={open} onClose={onClose} title={`Perfil - ${nome}`} sub="Formador / Formadora">
        <div className="p-4 space-y-5">
          <div className="flex items-center gap-4 p-4 bg-violet-50 border border-violet-200 rounded-xl">
            <div className="w-14 h-14 rounded-2xl bg-violet-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">{nome[0]}</div>
            <div>
              <p className="text-sm font-bold text-slate-800">{nome}</p>
              <p className="text-xs text-slate-500">{formador?.especialidade || "Formador / Formadora"}</p>
              <p className="text-xs text-violet-600 font-medium mt-1">
                {formador?.ccp ? `CCP ${formador.ccp}` : "CCP não registado"}{(telf || formador?.telf) ? ` · ${telf || formador?.telf}` : ""}
              </p>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Disponibilidade</p>
            {(formador?.disponibilidade.length ?? 0) === 0 ? (
              <p className="text-xs text-slate-400">Ainda sem faixas registadas.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {FAIXAS_DISPONIBILIDADE.filter(f => formador?.disponibilidade.includes(f.id)).map(f => (
                  <span key={f.id} className="text-[11px] font-semibold px-2 py-0.5 rounded-full border border-violet-200 bg-violet-50 text-violet-800">{f.label}</span>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Cursos atribuídos</p>
            <div className="space-y-1.5">
              {cursos.length === 0 && <p className="text-xs text-slate-400">Sem turmas atribuídas no cronograma.</p>}
              {cursos.map(c => (
                <div key={c} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                  <span className="text-xs text-slate-700">{c}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Documentos</p>
              <span className="text-xs text-slate-500">{docs.filter(d => d.uploaded).length}/{docs.length} entregues</span>
            </div>
            <div className="space-y-2">
              {docs.map(doc => (
                <div key={doc.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${doc.uploaded ? "bg-emerald-500" : doc.required ? "bg-red-400" : "bg-slate-300"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-medium text-slate-800">{doc.label}</p>
                      {doc.required && <span className="text-xs text-red-500 font-bold">*</span>}
                    </div>
                    {doc.uploaded && doc.fileName
                      ? <p className="text-xs text-emerald-600 mt-0.5 truncate">{doc.fileName}</p>
                      : <p className="text-xs text-slate-400 mt-0.5">{doc.required ? "Obrigatório" : "Opcional"}</p>}
                  </div>
                  {doc.uploaded
                    ? <div className="flex gap-1">
                        <ActBtn icon={I.eye} label="Ver" color="gray" onClick={() => abrirFicheiro(doc)} />
                        <ActBtn icon={I.edit} label="Substituir" onClick={() => setUploadFor(doc.id)} />
                      </div>
                    : <button onClick={() => setUploadFor(doc.id)} className="text-xs font-semibold px-2.5 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 whitespace-nowrap">Upload</button>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </SlideOver>
      <FileUploadModal
        open={!!uploadFor}
        onClose={() => setUploadFor(null)}
        title={`Carregar: ${docs.find(d => d.id === uploadFor)?.label ?? ""}`}
        accent={accent}
        context={{ kind: "formador-doc", regime: accent, turma, formando: nome, label: docs.find(d => d.id === uploadFor)?.label }}
        onConfirm={file => { if (uploadFor) markUploaded(uploadFor, file); }}
      />
    </>
  );
}

export type MomentoKey = "introducao" | "desenvolvimento" | "conclusao";
export type MomentoField = { conteudo: string; atividades: string; metodos: string; avaliacao: string; recursos: string; materiais: string };
export type PlanoSessaoData = { objetivosGerais: string; objetivosEspecificos: string; momentos: Record<MomentoKey, MomentoField> };
export type SessaoMeta = { n: number; data: string; hora: string; formador: string; formadores?: string[]; estado: string; plano: boolean; modulo: string; modulos?: string[]; duracao: string };

function formadoresDaSessao(s: SessaoMeta) {
  if (s.formadores?.length) return s.formadores.map(f => f.trim()).filter(Boolean);
  return s.formador?.trim() ? [s.formador.trim()] : [];
}

function formadoresDaSessaoLabel(s: SessaoMeta) {
  return formadoresDaSessao(s).join(" · ");
}

export const emptyMomento: MomentoField = { conteudo: "", atividades: "", metodos: "", avaliacao: "", recursos: "", materiais: "" };

const momentoLabels: Record<MomentoKey, string> = {
  introducao: "Introdução",
  desenvolvimento: "Desenvolvimento",
  conclusao: "Conclusão",
};
const campoLabels: (keyof MomentoField)[] = ["conteudo", "atividades", "metodos", "avaliacao", "recursos", "materiais"];
const campoNames: Record<keyof MomentoField, string> = {
  conteudo: "Conteúdo Programático",
  atividades: "Atividades",
  metodos: "Métodos / Técnicas Pedagógicas",
  avaliacao: "Avaliação",
  recursos: "Recursos Didáticos",
  materiais: "Materiais e Equipamentos",
};

export function emptyPlano(): PlanoSessaoData {
  return { objetivosGerais: "", objetivosEspecificos: "", momentos: { introducao: { ...emptyMomento }, desenvolvimento: { ...emptyMomento }, conclusao: { ...emptyMomento } } };
}

export type SumarioSessaoData = {
  conteudos: string;
  atividades: string;
  observacoes: string;
  assinado: boolean;
  assinadoEm?: string;
};

export function emptySumario(): SumarioSessaoData {
  return { conteudos: "", atividades: "", observacoes: "", assinado: false };
}

export function sumarioPreenchido(s?: SumarioSessaoData) {
  return !!s && s.conteudos.trim().length > 0;
}

export function PlanoSessaoModal({ open, onClose, sessao, plano, onSave }: {
  open: boolean; onClose: () => void;
  sessao?: SessaoMeta;
  plano: PlanoSessaoData;
  onSave: (data: PlanoSessaoData) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PlanoSessaoData>(plano);
  useEffect(() => { setDraft(plano); setEditing(false); }, [open, plano]);

  if (!open || !sessao) return null;
  const hasContent = plano.objetivosGerais.trim() !== "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <p className="text-sm font-bold text-slate-800">Plano de Sessão - Sessão {sessao.n}</p>
            <p className="text-xs text-slate-400 mt-0.5">{sessao.data} · {sessao.hora} · {formadoresDaSessaoLabel(sessao) || "Formador por definir"}</p>
          </div>
          <div className="flex items-center gap-2">
            {!editing
              ? <button onClick={() => { setDraft(plano); setEditing(true); }}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100">
                  {I.edit} Editar
                </button>
              : <>
                  <button onClick={() => setEditing(false)} className="text-xs px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50">Cancelar</button>
                  <button onClick={() => { onSave(draft); setEditing(false); }}
                    className="text-xs font-semibold px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg">Guardar</button>
                </>}
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100">{I.x}</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { l: sessao.modulos && sessao.modulos.length > 1 ? "Módulos" : "Módulo", v: sessao.modulos?.length ? sessao.modulos.join(" · ") : sessao.modulo },
              { l: "Duração", v: sessao.duracao },
              { l: formadoresDaSessao(sessao).length > 1 ? "Formadores" : "Formador/a", v: formadoresDaSessaoLabel(sessao) || "-" },
              { l: "Data", v: sessao.data },
            ].map(f => (
              <div key={f.l} className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                <p className="text-xs text-amber-600 font-semibold uppercase tracking-wider mb-1">{f.l}</p>
                <p className="text-xs font-bold text-slate-800 leading-snug">{f.v}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(["objetivosGerais", "objetivosEspecificos"] as const).map(field => (
              <div key={field} className="space-y-1.5">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  {field === "objetivosGerais" ? "Objetivos Gerais" : "Objetivos Específicos"}
                </p>
                {editing
                  ? <textarea value={draft[field]} onChange={e => setDraft(prev => ({ ...prev, [field]: e.target.value }))} rows={3}
                      className="w-full text-xs text-slate-700 border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-amber-400 resize-none leading-relaxed" />
                  : <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-700 leading-relaxed min-h-[64px]">
                      {plano[field] || <span className="text-slate-400 italic">Não preenchido</span>}
                    </div>}
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">Plano da Sessão</p>
            {editing ? (
              <div className="space-y-4">
                {(Object.keys(momentoLabels) as MomentoKey[]).map(momento => (
                  <div key={momento} className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 bg-slate-800 text-white">
                      <p className="text-xs font-bold uppercase tracking-wider">{momentoLabels[momento]}</p>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {campoLabels.map(campo => (
                        <div key={campo} className="grid grid-cols-3 gap-0">
                          <div className="px-3 py-2.5 bg-slate-50 border-r border-slate-100 flex items-start">
                            <p className="text-xs font-semibold text-slate-600">{campoNames[campo]}</p>
                          </div>
                          <div className="col-span-2 px-3 py-2">
                            <textarea value={draft.momentos[momento][campo]}
                              onChange={e => setDraft(prev => ({ ...prev, momentos: { ...prev.momentos, [momento]: { ...prev.momentos[momento], [campo]: e.target.value } } }))}
                              rows={2} className="w-full text-xs text-slate-700 border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-amber-400 resize-none" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
                <table className="w-full text-xs min-w-[720px]">
                  <thead>
                    <tr className="bg-slate-800 text-white">
                      <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider w-[16%]">Momento</th>
                      {campoLabels.map(c => (
                        <th key={c} className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider">{campoNames[c]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(Object.keys(momentoLabels) as MomentoKey[]).map((momento, mi) => (
                      <tr key={momento} className={mi % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                        <td className="px-3 py-3 font-bold text-slate-700 align-top whitespace-nowrap">{momentoLabels[momento]}</td>
                        {campoLabels.map(campo => (
                          <td key={campo} className="px-3 py-3 text-slate-600 align-top leading-relaxed">
                            {hasContent ? (plano.momentos[momento][campo] || <span className="text-slate-300">-</span>) : <span className="text-slate-300">-</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SumarioSessaoModal({ open, onClose, sessao, sumario, accent = "gold", onSave }: {
  open: boolean; onClose: () => void;
  sessao?: SessaoMeta;
  sumario: SumarioSessaoData;
  accent?: "gold" | "fin";
  onSave: (data: SumarioSessaoData) => void;
}) {
  const gold = accent === "gold";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<SumarioSessaoData>(sumario);
  useEffect(() => {
    setDraft(sumario);
    setEditing(!sumarioPreenchido(sumario));
  }, [open, sumario]);

  if (!open || !sessao) return null;
  const filled = sumarioPreenchido(sumario);

  function guardar(assinar?: boolean) {
    const next: SumarioSessaoData = {
      ...draft,
      assinado: assinar ? true : draft.assinado,
      assinadoEm: assinar ? sessao!.data.replace(/^[^,]+,\s*/, "") : draft.assinadoEm,
    };
    onSave(next);
    setEditing(false);
  }

  const fields: { key: keyof Pick<SumarioSessaoData, "conteudos" | "atividades" | "observacoes">; label: string; hint: string }[] = [
    { key: "conteudos", label: "Conteúdos leccionados", hint: "O que foi efectivamente tratado nesta sessão." },
    { key: "atividades", label: "Atividades realizadas", hint: "Exercícios, demonstrações, trabalhos de grupo." },
    { key: "observacoes", label: "Observações e ocorrências", hint: "Atrasos, desistências, material em falta - ou deixe em branco." },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[90vh]">
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <p className="text-sm font-semibold text-slate-800">Sumário - Sessão {sessao.n}</p>
            <p className="text-xs text-slate-400 mt-0.5">{sessao.data} · {sessao.hora} · {formadoresDaSessaoLabel(sessao) || "Formador por definir"}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100">{I.x}</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className={`rounded-xl p-3 border ${gold ? "bg-amber-50 border-amber-100" : "bg-blue-50 border-blue-100"}`}>
              <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${gold ? "text-amber-600" : "text-blue-600"}`}>{sessao.modulos && sessao.modulos.length > 1 ? "Módulos" : "Módulo"}</p>
              <p className="text-xs font-bold text-slate-800 leading-snug">{sessao.modulos?.length ? sessao.modulos.join(" · ") : sessao.modulo}</p>
            </div>
            <div className={`rounded-xl p-3 border ${gold ? "bg-amber-50 border-amber-100" : "bg-blue-50 border-blue-100"}`}>
              <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${gold ? "text-amber-600" : "text-blue-600"}`}>Duração</p>
              <p className="text-xs font-bold text-slate-800">{sessao.duracao}</p>
            </div>
          </div>
          {fields.map(f => (
            <div key={f.key} className="space-y-1.5">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">{f.label}</p>
              {editing
                ? <textarea value={draft[f.key]} onChange={e => setDraft(prev => ({ ...prev, [f.key]: e.target.value }))} rows={f.key === "observacoes" ? 2 : 3}
                    placeholder={f.hint}
                    className="w-full text-sm text-slate-700 border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none leading-relaxed" />
                : <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-700 leading-relaxed min-h-[56px]">
                    {sumario[f.key] || <span className="text-slate-400 italic">Não preenchido</span>}
                  </div>}
            </div>
          ))}
          <div className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${sumario.assinado ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-xs ${sumario.assinado ? "bg-emerald-500" : "bg-slate-300"}`}>
              {sumario.assinado ? "✓" : ""}
            </span>
            <div>
              <p className="text-xs font-semibold text-slate-700">
                {sumario.assinado ? `Assinado por ${formadoresDaSessaoLabel(sessao) || "formador"}` : "Por assinar pelo formador"}
              </p>
              {sumario.assinadoEm && <p className="text-xs text-slate-400">{sumario.assinadoEm}</p>}
            </div>
          </div>
          <p className="text-xs text-slate-400">Sem sumário assinado a sessão não existiu para auditoria do DTP.</p>
        </div>
        <div className="flex gap-2 px-5 py-4 border-t border-slate-100 flex-shrink-0">
          {editing ? (
            <>
              <button onClick={onClose} className="flex-1 py-2 border border-slate-200 text-sm text-slate-600 rounded-lg hover:bg-slate-50">Cancelar</button>
              <button disabled={!draft.conteudos.trim()} onClick={() => guardar(false)}
                className="flex-1 py-2 border border-slate-200 text-sm text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-40">Guardar rascunho</button>
              <button disabled={!draft.conteudos.trim()} onClick={() => guardar(true)}
                className={`flex-1 py-2 text-white text-sm font-semibold rounded-lg disabled:opacity-40 ${gold ? "bg-amber-500 hover:bg-amber-600" : "bg-blue-600 hover:bg-blue-700"}`}>
                Guardar e assinar
              </button>
            </>
          ) : (
            <>
              <button onClick={onClose} className="flex-1 py-2 border border-slate-200 text-sm text-slate-600 rounded-lg hover:bg-slate-50">Fechar</button>
              <button onClick={() => { setDraft(sumario); setEditing(true); }}
                className="flex-1 py-2 border border-slate-200 text-sm text-slate-700 rounded-lg hover:bg-slate-50">
                {filled ? "Editar" : "Preencher"}
              </button>
              {filled && !sumario.assinado && (
                <button onClick={() => guardar(true)}
                  className={`flex-1 py-2 text-white text-sm font-semibold rounded-lg ${gold ? "bg-amber-500 hover:bg-amber-600" : "bg-blue-600 hover:bg-blue-700"}`}>
                  Assinar
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

type PerguntaTipo = "texto" | "multipla" | "escala" | "simnao";
type Pergunta = { id: number; tipo: PerguntaTipo; texto: string; opcoes?: string[] };
type Inquerito = { id: number; titulo: string; perguntas: Pergunta[] };

const tipoLabels: Record<PerguntaTipo, string> = {
  texto: "Texto livre",
  multipla: "Escolha múltipla",
  escala: "Escala 1 a 5",
  simnao: "Sim / Não",
};
const tipoIcons: Record<PerguntaTipo, React.ReactNode> = {
  texto: <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none"><rect x="1" y="3" width="14" height="2" rx="1" fill="currentColor"/><rect x="1" y="7" width="10" height="2" rx="1" fill="currentColor"/><rect x="1" y="11" width="12" height="2" rx="1" fill="currentColor"/></svg>,
  multipla: <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none"><circle cx="3" cy="4" r="1.5" fill="currentColor"/><rect x="6" y="3" width="9" height="2" rx="1" fill="currentColor"/><circle cx="3" cy="8" r="1.5" fill="currentColor"/><rect x="6" y="7" width="7" height="2" rx="1" fill="currentColor"/><circle cx="3" cy="12" r="1.5" fill="currentColor"/><rect x="6" y="11" width="8" height="2" rx="1" fill="currentColor"/></svg>,
  escala: <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none"><rect x="1" y="6" width="2" height="4" rx="1" fill="currentColor" opacity=".4"/><rect x="4.5" y="4" width="2" height="6" rx="1" fill="currentColor" opacity=".6"/><rect x="8" y="2" width="2" height="8" rx="1" fill="currentColor" opacity=".8"/><rect x="11.5" y="1" width="2" height="9" rx="1" fill="currentColor"/></svg>,
  simnao: <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none"><path d="M3 8.5L6 12l7-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
};

const inqueritosGold: Inquerito[] = [{
  id: 1, titulo: "Inquérito de Satisfação - Formação de Formadores CCP",
  perguntas: [
    { id: 1, tipo: "escala", texto: "Como avalia a qualidade geral da formação?" },
    { id: 2, tipo: "escala", texto: "O formador demonstrou domínio dos conteúdos?" },
    { id: 3, tipo: "multipla", texto: "Qual o principal benefício desta formação?", opcoes: ["Competências pedagógicas", "Certificação CCP", "Rede de contactos", "Outros"] },
    { id: 4, tipo: "simnao", texto: "Recomendaria esta formação a um colega?" },
    { id: 5, tipo: "texto", texto: "Deixe um comentário ou sugestão:" },
  ],
}];

const inqueritosFin: Inquerito[] = [{
  id: 1, titulo: "Inquérito de Satisfação - UFCD 3564 Primeiros Socorros",
  perguntas: [
    { id: 1, tipo: "escala", texto: "Os conteúdos da UFCD foram claros e úteis?" },
    { id: 2, tipo: "escala", texto: "A carga horária (25h) foi adequada?" },
    { id: 3, tipo: "simnao", texto: "Consegue aplicar o que aprendeu no contexto profissional?" },
    { id: 4, tipo: "texto", texto: "Sugestões para a próxima turma:" },
  ],
}];

const tipoLabelsCsv: Record<PerguntaTipo, string> = {
  escala: "Escala 1-5",
  multipla: "Escolha múltipla",
  simnao: "Sim / Não",
  texto: "Texto livre",
};

function exportarInquerito(inq: Inquerito) {
  const linhas = [
    ["#", "Pergunta", "Tipo", "Opções"],
    ...inq.perguntas.map((p, i) => [String(i + 1), p.texto, tipoLabelsCsv[p.tipo], (p.opcoes ?? []).join(" | ")]),
  ];
  const csv = linhas.map(l => l.map(c => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob([`\uFEFF${inq.titulo}\n\n${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `inquerito-${inq.titulo.replace(/[^\w-]+/g, "-").toLowerCase().slice(0, 50)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Preenche e grava uma resposta: é assim que a secretaria lança os inquéritos de papel. */
function InqueritoPreviewModal({ inq, onClose, onGravada }: { inq: Inquerito | null; onClose: () => void; onGravada: () => void }) {
  const [respostas, setRespostas] = useState<Record<string, unknown>>({});
  const [formando, setFormando] = useState("");
  const [turma, setTurma] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { setRespostas({}); setFormando(""); setTurma(""); setMsg(""); }, [inq]);

  const preenchidas = Object.values(respostas).filter(v => v !== "" && v != null).length;

  async function gravar() {
    if (!inq) return;
    setBusy(true);
    setMsg("");
    try {
      await apiAddInqueritoResposta(inq.id, { turma: turma.trim(), formando: formando.trim(), respostas });
      setMsg("Resposta gravada.");
      setRespostas({});
      setFormando("");
      onGravada();
    } catch {
      setMsg("Não foi possível gravar a resposta.");
    } finally {
      setBusy(false);
    }
  }

  const campo = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400";

  return (
    <AppModal
      open={!!inq}
      onClose={onClose}
      title={inq?.titulo ?? "Inquérito"}
      sub="É assim que o formando vê o questionário. Pode lançar aqui uma resposta recebida."
      size="lg"
      footer={
        <>
          <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">Fechar</button>
          <button type="button" disabled={busy || preenchidas === 0} onClick={() => void gravar()} className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white">
            {busy ? "A gravar…" : "Gravar resposta"}
          </button>
        </>
      }
    >
      <div className="p-5 space-y-4">
        {msg && <p className="text-xs font-semibold text-emerald-700">{msg}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input className={campo} value={formando} onChange={e => setFormando(e.target.value)} placeholder="Formando (opcional)" />
          <input className={campo} value={turma} onChange={e => setTurma(e.target.value)} placeholder="Turma (opcional)" />
        </div>
        {inq?.perguntas.length === 0 && <p className="text-sm text-slate-400">Este inquérito ainda não tem perguntas.</p>}
        {inq?.perguntas.map((p, i) => {
          const key = String(p.id);
          const valor = respostas[key];
          return (
            <div key={p.id} className="space-y-2">
              <p className="text-sm font-semibold text-slate-800">{i + 1}. {p.texto || "(pergunta sem texto)"}</p>
              {p.tipo === "escala" && (
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRespostas(prev => ({ ...prev, [key]: n }))}
                      className={`w-9 h-9 rounded-full border-2 flex items-center justify-center text-xs font-bold ${valor === n ? "bg-amber-500 border-amber-500 text-white" : "border-slate-200 text-slate-500 hover:border-amber-300"}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}
              {p.tipo === "simnao" && (
                <div className="flex gap-2">
                  {["Sim", "Não"].map(op => (
                    <button
                      key={op}
                      type="button"
                      onClick={() => setRespostas(prev => ({ ...prev, [key]: op }))}
                      className={`px-4 py-1.5 border rounded-lg text-xs font-semibold ${valor === op ? "bg-slate-800 border-slate-800 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                    >
                      {op}
                    </button>
                  ))}
                </div>
              )}
              {p.tipo === "multipla" && (
                <div className="space-y-1.5">
                  {(p.opcoes ?? []).map((op, oi) => (
                    <button
                      key={oi}
                      type="button"
                      onClick={() => setRespostas(prev => ({ ...prev, [key]: op }))}
                      className="flex items-center gap-2 text-sm text-slate-600 w-full text-left"
                    >
                      <span className={`w-4 h-4 rounded-full border-2 ${valor === op ? "border-amber-500 bg-amber-500" : "border-slate-300"}`} />{op}
                    </button>
                  ))}
                </div>
              )}
              {p.tipo === "texto" && (
                <textarea
                  rows={3}
                  value={typeof valor === "string" ? valor : ""}
                  onChange={e => setRespostas(prev => ({ ...prev, [key]: e.target.value }))}
                  className={`${campo} resize-none`}
                  placeholder="Resposta do formando…"
                />
              )}
            </div>
          );
        })}
      </div>
    </AppModal>
  );
}

export function InqueritosView({ acento }: { acento: "gold" | "fin" }) {
  const isGold = acento === "gold";
  const regime = isGold ? "gold" : "fin";
  const [inqueritos, setInqueritos] = useCatalogList<Inquerito>("inqueritos", regime, isGold ? inqueritosGold : inqueritosFin);
  const [selected, setSelected] = useState<number | null>(1);
  const [creating, setCreating] = useState(false);
  const [novoTitulo, setNovoTitulo] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [preview, setPreview] = useState<Inquerito | null>(null);
  const [apagar, setApagar] = useState<Inquerito | null>(null);
  const [respostas, setRespostas] = useState<InqueritoResposta[]>([]);
  const [metricas, setMetricas] = useState<InqueritoMetrica[]>([]);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);
  const inq = inqueritos.find(i => i.id === selected);

  useEffect(() => catalogIdRemapSubscribe((k, from, to) => {
    if (k !== `inqueritos:${regime}`) return;
    setSelected(s => s === from ? to : s);
  }), [regime]);

  function addInquerito() {
    if (!novoTitulo.trim()) return;
    const id = -Date.now();
    setInqueritos(prev => [...prev, { id, titulo: novoTitulo.trim(), perguntas: [] }]);
    setSelected(id); setCreating(false); setNovoTitulo("");
  }
  function addPergunta(tipo: PerguntaTipo) {
    if (!selected) return;
    setInqueritos(prev => prev.map(i => i.id !== selected ? i : {
      ...i, perguntas: [...i.perguntas, { id: Date.now(), tipo, texto: "", opcoes: tipo === "multipla" ? ["Opção A", "Opção B"] : undefined }],
    }));
  }
  function updatePerguntaTexto(pId: number, texto: string) {
    if (!selected) return;
    setInqueritos(prev => prev.map(i => i.id !== selected ? i : { ...i, perguntas: i.perguntas.map(p => p.id === pId ? { ...p, texto } : p) }));
  }
  function removePergunta(pId: number) {
    if (!selected) return;
    setInqueritos(prev => prev.map(i => i.id !== selected ? i : { ...i, perguntas: i.perguntas.filter(p => p.id !== pId) }));
  }
  function removeInquerito(id: number) {
    setInqueritos(prev => prev.filter(i => i.id !== id));
    setSelected(s => (s === id ? null : s));
    setPreview(p => (p?.id === id ? null : p));
  }

  const accent = isGold
    ? { bg: "bg-amber-500", text: "text-amber-600", light: "bg-amber-50", border: "border-amber-200", pill: "bg-amber-100 text-amber-800" }
    : { bg: "bg-blue-600", text: "text-blue-600", light: "bg-blue-50", border: "border-blue-200", pill: "bg-blue-100 text-blue-800" };

  useEffect(() => {
    if (!inq) { setRespostas([]); setMetricas([]); setLinkUrl(""); return; }
    let alive = true;
    apiInqueritoRespostas(inq.id)
      .then(r => { if (alive) { setRespostas(r.respostas); setMetricas(r.metricas ?? []); } })
      .catch(() => { if (alive) { setRespostas([]); setMetricas([]); } });
    return () => { alive = false; };
  }, [inq]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Inquéritos</h2>
          <p className="text-xs text-slate-400">{isGold ? "Formação Gold · CCP" : "Formação Financiada"}</p>
        </div>
        <button onClick={() => setCreating(true)} className={`flex items-center gap-2 px-4 py-2 ${accent.bg} hover:opacity-90 text-white text-sm font-semibold rounded-lg`}>
          + Novo inquérito
        </button>
      </div>

      {creating && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-700">Novo inquérito</p>
          <input value={novoTitulo} onChange={e => setNovoTitulo(e.target.value)} placeholder="Título do inquérito…"
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-400" />
          <div className="flex gap-2">
            <button onClick={() => { setCreating(false); setNovoTitulo(""); }} className="flex-1 py-2 border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50">Cancelar</button>
            <button onClick={addInquerito} className={`flex-1 py-2 ${accent.bg} text-white text-sm font-semibold rounded-lg hover:opacity-90`}>Criar</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="space-y-2">
          {inqueritos.map(i => (
            <div key={i.id}
              className={`relative rounded-xl border transition-all ${selected === i.id ? `${accent.light} ${accent.border} shadow-sm` : "bg-white border-slate-200 hover:border-slate-300"}`}>
              <button type="button" onClick={() => setSelected(i.id)} className="w-full text-left p-3 pr-12">
                <p className={`text-xs font-bold mb-1 ${selected === i.id ? accent.text : "text-slate-400"}`}>INQUÉRITO</p>
                <p className="text-sm font-semibold text-slate-800 leading-snug">{i.titulo}</p>
                <p className="text-xs text-slate-400 mt-1">{i.perguntas.length} perguntas</p>
              </button>
              <div className="absolute top-2 right-2">
                <ActBtn icon={I.trash} label="Eliminar inquérito" color="red" onClick={() => setApagar(i)} />
              </div>
            </div>
          ))}
          {inq && (
            <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Respostas recebidas</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{respostas.length}</p>
              {respostas.length === 0
                ? <p className="text-xs text-slate-400 mt-1">Ainda sem respostas deste inquérito.</p>
                : <p className="text-xs text-slate-500 mt-1">Última em {respostas[0]?.data}</p>}
              {metricas.length > 0 && respostas.length > 0 && (
                <ul className="text-xs text-slate-600 space-y-1 pt-1 border-t border-slate-100">
                  {metricas.map(m => {
                    const pergunta = inq.perguntas.find(p => p.id === m.id);
                    if (m.tipo === "escala") return <li key={m.id}>Escala: média {m.media ?? "-"} ({m.n})</li>;
                    if (m.tipo === "simnao") return <li key={m.id}>Sim: {m.pctSim ?? "-"}% ({m.n})</li>;
                    if (m.tipo === "multipla") {
                      const top = Object.entries(m.contagens ?? {}).sort((a, b) => b[1] - a[1])[0];
                      return <li key={m.id}>{pergunta?.texto || "Escolha"}: {top ? `${top[0]} (${top[1]})` : "-"}</li>;
                    }
                    return <li key={m.id}>{pergunta?.texto || "Texto"}: {m.n} respostas</li>;
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
        <div className="lg:col-span-2">
          {!inq ? (
            <div className={`h-64 flex items-center justify-center rounded-xl border-2 border-dashed ${accent.border} ${accent.light}`}>
              <p className={`text-sm font-semibold ${accent.text}`}>Selecione ou crie um inquérito</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className={`px-4 py-3 ${accent.light} border-b ${accent.border} flex items-center justify-between gap-3`}>
                <div>
                  <p className={`text-xs font-bold ${accent.text}`}>{isGold ? "GOLD" : "FINANCIADA"}</p>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">{inq.titulo}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                  <button type="button" onClick={() => setPreview(inq)} className="text-xs font-semibold px-2.5 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 inline-flex items-center gap-1">{I.eye} Pré-visualizar</button>
                  <button
                    type="button"
                    disabled={linkBusy}
                    onClick={() => {
                      setLinkBusy(true);
                      void apiInqueritoPublicoLink(inq.id)
                        .then(async r => {
                          setLinkUrl(r.url);
                          try { await navigator.clipboard?.writeText(r.url); } catch { /* mostra o URL */ }
                        })
                        .catch(() => undefined)
                        .finally(() => setLinkBusy(false));
                    }}
                    className="text-xs font-semibold px-2.5 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 inline-flex items-center gap-1"
                  >
                    {I.copy} {linkBusy ? "A gerar…" : "Ligação pública"}
                  </button>
                  <button type="button" onClick={() => exportarInquerito(inq)} className={`text-xs font-semibold px-2.5 py-1.5 ${accent.bg} text-white rounded-lg hover:opacity-90 inline-flex items-center gap-1`}>{I.download} Exportar</button>
                </div>
              </div>
              {linkUrl && (
                <p className="px-4 py-2 text-[11px] font-mono text-slate-600 bg-slate-50 border-b border-slate-100 break-all">
                  {linkUrl}
                </p>
              )}
              <div className="divide-y divide-slate-50">
                {inq.perguntas.map((p, idx) => (
                  <div key={p.id} className="p-4 group">
                    <div className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{idx + 1}</span>
                      <div className="flex-1 min-w-0 space-y-2">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${accent.pill}`}>
                          {tipoIcons[p.tipo]} {tipoLabels[p.tipo]}
                        </span>
                        {editId === p.id
                          ? <input value={p.texto} onChange={e => updatePerguntaTexto(p.id, e.target.value)} onBlur={() => setEditId(null)} autoFocus
                              className="w-full text-sm text-slate-800 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:border-amber-400" />
                          : <p className="text-sm text-slate-800 cursor-pointer hover:text-blue-600" onClick={() => setEditId(p.id)}>
                              {p.texto || <span className="text-slate-400 italic">Clique para escrever a pergunta…</span>}
                            </p>}
                        {p.tipo === "escala" && (
                          <div className="flex gap-2 mt-1">
                            {[1, 2, 3, 4, 5].map(n => (
                              <span key={n} className={`w-8 h-8 rounded-full border-2 ${accent.border} flex items-center justify-center text-xs font-bold ${accent.text}`}>{n}</span>
                            ))}
                          </div>
                        )}
                        {p.tipo === "simnao" && (
                          <div className="flex gap-2 mt-1">
                            <span className="px-4 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-lg">Sim</span>
                            <span className="px-4 py-1.5 bg-red-50 border border-red-200 text-red-600 text-xs font-semibold rounded-lg">Não</span>
                          </div>
                        )}
                        {p.tipo === "multipla" && p.opcoes && (
                          <div className="space-y-1 mt-1">
                            {p.opcoes.map((op, oi) => (
                              <div key={oi} className="flex items-center gap-2">
                                <span className="w-4 h-4 rounded-full border-2 border-slate-300 flex-shrink-0" />
                                <span className="text-xs text-slate-600">{op}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {p.tipo === "texto" && (
                          <div className="mt-1 h-16 border border-slate-200 rounded-lg bg-slate-50 flex items-center justify-center">
                            <span className="text-xs text-slate-400">Resposta em texto livre</span>
                          </div>
                        )}
                      </div>
                      <button onClick={() => removePergunta(p.id)} className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100">{I.trash}</button>
                    </div>
                  </div>
                ))}
                {inq.perguntas.length === 0 && (
                  <div className="p-8 text-center text-slate-400 text-sm">Adicione perguntas usando os botões abaixo</div>
                )}
              </div>
              <div className={`px-4 py-3 border-t ${accent.border} ${accent.light}`}>
                <p className="text-xs font-semibold text-slate-500 mb-2">Adicionar pergunta:</p>
                <InqueritoPreviewModal
                  inq={preview}
                  onClose={() => setPreview(null)}
                  onGravada={() => {
                    if (!inq) return;
                    void apiInqueritoRespostas(inq.id).then(r => { setRespostas(r.respostas); setMetricas(r.metricas ?? []); }).catch(() => undefined);
                  }}
                />
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(tipoLabels) as PerguntaTipo[]).map(tipo => (
                    <button key={tipo} onClick={() => addPergunta(tipo)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:border-slate-300 hover:shadow-sm">
                      <span className={accent.text}>{tipoIcons[tipo]}</span>
                      {tipoLabels[tipo]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDangerModal
        open={!!apagar}
        onClose={() => setApagar(null)}
        title="Eliminar inquérito"
        body={`${apagar?.titulo ?? ""} deixa de estar disponível para preencher ou exportar.`}
        risk="As respostas já recebidas deixam de ser acessíveis a partir daqui."
        onConfirm={() => { if (apagar) removeInquerito(apagar.id); }}
      />
    </div>
  );
}
