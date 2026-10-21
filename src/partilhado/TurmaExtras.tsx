import { useEffect, useRef, useState } from "react";
import { ApiError, apiUploadDrive, type DriveFile, type DriveUploadContext } from "./api";
import { useDrive } from "./DriveContext";
import { imprimirFolhasPresencas } from "./presencasPrint";
import { dtpCategoriaPasta, dtpPastaNome } from "./dtpPasta";
import { I } from "./turmaIcones";

export { type MomentoKey, type MomentoField, type PlanoSessaoData, type SessaoMeta, type SumarioSessaoData, emptyMomento, emptyPlano, emptySumario, sumarioPreenchido, PlanoSessaoModal, SumarioSessaoModal } from "./SessaoModais";

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

export function itensPip(nomes: string[], saved?: PipItem[]): PipItem[] {
  if (saved?.length) return saved.map(i => ({ ...i }));
  return nomes.map((nome, i) => ({ id: String(i + 1), nome }));
}

export function itensSimulacao(nomes: string[], criterios: CriterioAvaliacao[], saved?: SimItem[]): SimItem[] {
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

export function PresencasSessaoModal({ open, onClose, sessao, formandos, onSave, turmaNome, cursoNome, onImprimir }: {
  open: boolean; onClose: () => void;
  sessao?: { n: number; data: string; hora: string; modulo?: string; formador?: string };
  formandos?: { id: number; nome: string; presente?: boolean }[];
  onSave?: (rows: { id: number; nome: string; presente: boolean }[]) => void;
  turmaNome?: string;
  cursoNome?: string;
  /** Folha própria do regime (Financiada: PDF do modelo da candidatura); sem ela, a folha impressa pelo browser. */
  onImprimir?: () => void;
}) {
  function seed() {
    return (formandos ?? []).map(f => ({ id: f.id, nome: f.nome, presente: f.presente ?? true }));
  }
  const [presencas, setPresencas] = useState(seed);
  useEffect(() => {
    if (open) setPresencas(seed());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sessao?.n]);
  const presentes = presencas.filter(p => p.presente).length;
  const pct = presencas.length ? Math.round((presentes / presencas.length) * 100) : 0;
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
            onClick={() => onImprimir ? onImprimir() : imprimirFolhasPresencas({
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
