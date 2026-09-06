import { useEffect, useRef, useState } from "react";
import {
  getParametrosAvaliacao, grelhaCompleta, pipEstado, simAlunoEstado, simEstado,
  type PipItem, type ResolveDocEstado, type ResolveDocTarget,
  type ResolveListaItem, type SimItem,
} from "./TurmaExtras";

const I = {
  x: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>,
  download: <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd"/></svg>,
  file: <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd"/></svg>,
  trash: <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/></svg>,
};

function badgeEstado(estado: ResolveDocEstado) {
  if (estado === "ok") return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">No dossiê</span>;
  if (estado === "parcial") return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Parcial</span>;
  return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600">Em falta</span>;
}

export function ResolverDocumentoModal({
  open, onClose, target, accent = "gold", onSave,
}: {
  open: boolean;
  onClose: () => void;
  target: ResolveDocTarget | null;
  accent?: "gold" | "fin";
  onSave: (next: { estado: ResolveDocEstado; detalhe: string; payload?: unknown }) => void;
}) {
  const gold = accent === "gold";
  const [items, setItems] = useState<ResolveListaItem[]>([]);
  const [pipItems, setPipItems] = useState<PipItem[]>([]);
  const [simItems, setSimItems] = useState<SimItem[]>([]);
  const [openAluno, setOpenAluno] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const rowInputRef = useRef<HTMLInputElement>(null);
  const [rowUpload, setRowUpload] = useState<{ id: string; field: "pip" | "video" } | null>(null);

  useEffect(() => {
    if (open && target) {
      setItems(target.items ? target.items.map(i => ({ ...i })) : []);
      setPipItems(target.pipItems ? target.pipItems.map(i => ({ ...i })) : []);
      setSimItems(target.simItems ? target.simItems.map(i => ({ ...i, notas: { ...i.notas } })) : []);
      setOpenAluno(null);
      setFile(null);
    }
  }, [open, target]);

  if (!open || !target) return null;
  const doc = target;

  const params = getParametrosAvaliacao(doc.curso);
  const criterios = doc.criterios ?? params.criterios;
  const curso = doc.curso ?? params.curso;
  const doneLista = items.filter(i => i.ok).length;
  const listaEstado: ResolveDocEstado = items.length === 0 ? "ok" : doneLista === items.length ? "ok" : doneLista === 0 ? "falta" : "parcial";
  const pip = pipEstado(pipItems);
  const sim = simEstado(simItems, criterios);
  const progress = doc.kind === "pip" ? pip : doc.kind === "simulacao" ? sim : { done: doneLista, estado: listaEstado, detalhe: "" };
  const total = doc.kind === "pip" ? pipItems.length : doc.kind === "simulacao" ? simItems.length : items.length;
  const wide = doc.kind === "simulacao" || doc.kind === "pip";

  function pickFile(id: string, field: "pip" | "video") {
    setRowUpload({ id, field });
    setTimeout(() => rowInputRef.current?.click(), 0);
  }
  function onRowFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !rowUpload) return;
    if (rowUpload.field === "pip") setPipItems(prev => prev.map(x => x.id === rowUpload.id ? { ...x, fileName: f.name } : x));
    if (rowUpload.field === "video") setSimItems(prev => prev.map(x => x.id === rowUpload.id ? { ...x, videoName: f.name } : x));
    setRowUpload(null);
  }

  function guardar() {
    if (doc.kind === "pip") onSave({ ...pipEstado(pipItems), payload: pipItems });
    else if (doc.kind === "simulacao") onSave({ ...simEstado(simItems, criterios), payload: simItems });
    else if (doc.kind === "lista") {
      onSave({
        estado: listaEstado,
        detalhe: items.length ? `${doneLista} / ${items.length} ${doc.label.toLowerCase().includes("sess") ? "sessões" : "formandos"}.` : doc.detalhe,
      });
    } else onSave({ estado: "ok", detalhe: file ? `Carregado: ${file.name}` : "No dossiê." });
    onClose();
  }

  const sub = doc.kind === "pip"
    ? "Carrega o PIP de cada formando. Sem ficheiro o projeto não entra no dossiê."
    : doc.kind === "simulacao"
      ? `Vídeo da simulação + folha de avaliação com os parâmetros do curso ${curso}.`
      : doc.kind === "lista"
        ? "Marca o que já está no dossiê ou carrega o que falta."
        : "Carrega o ficheiro para resolver neste ecrã.";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className={`bg-white rounded-2xl shadow-2xl w-full flex flex-col max-h-[90vh] ${wide ? "max-w-2xl" : "max-w-lg"}`}>
        <input ref={rowInputRef} type="file" className="hidden"
          accept={rowUpload?.field === "video" ? "video/*,.mp4,.mov,.webm" : ".pdf,.doc,.docx"}
          onChange={onRowFile} />
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <p className="text-sm font-semibold text-slate-800">{doc.label}</p>
            <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100">{I.x}</button>
        </div>

        {(doc.kind === "lista" || doc.kind === "pip" || doc.kind === "simulacao") && (
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
            <span className="text-xs text-slate-500">{progress.done}/{total} no dossiê</span>
            <div className="flex items-center gap-2">
              <div className="w-28 bg-slate-200 rounded-full h-1.5">
                <div className="h-1.5 rounded-full" style={{ width: `${total ? (progress.done / total) * 100 : 0}%`, backgroundColor: gold ? "#F59E0B" : "#2563EB" }} />
              </div>
              <span className="text-xs font-bold text-slate-600">{total ? Math.round((progress.done / total) * 100) : 0}%</span>
            </div>
          </div>
        )}

        {doc.kind === "pip" && (
          <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
            {pipItems.map(item => (
              <div key={item.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800">{item.nome}</p>
                  {item.fileName && <p className="text-xs text-emerald-600 truncate mt-0.5">{item.fileName}</p>}
                </div>
                <button onClick={() => pickFile(item.id, "pip")}
                  className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border whitespace-nowrap ${item.fileName ? "bg-white text-slate-600 border-slate-200 hover:bg-slate-50" : gold ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100" : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"}`}>
                  {item.fileName ? "Substituir" : "Carregar PIP"}
                </button>
                {item.fileName && (
                  <button onClick={() => setPipItems(prev => prev.map(x => x.id === item.id ? { ...x, fileName: undefined } : x))}
                    className="text-slate-300 hover:text-red-500" title="Remover">{I.trash}</button>
                )}
                {badgeEstado(item.fileName ? "ok" : "falta")}
              </div>
            ))}
          </div>
        )}

        {doc.kind === "simulacao" && (
          <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
            <div className="px-5 py-2.5 bg-violet-50 text-xs text-violet-700">
              Folha de avaliação do curso <strong>{curso}</strong> · {criterios.length} critérios · escala 1–5
            </div>
            {simItems.map(item => {
              const est = simAlunoEstado(item, criterios);
              const aberto = openAluno === item.id;
              const media = criterios.map(c => item.notas[c.id]).filter((n): n is number => typeof n === "number");
              return (
                <div key={item.id}>
                  <button onClick={() => setOpenAluno(aberto ? null : item.id)} className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 text-left">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">{item.nome}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Vídeo {item.videoName ? "carregado" : "em falta"} · Grelha {grelhaCompleta(item, criterios) ? `${(media.reduce((a, b) => a + b, 0) / media.length).toFixed(1)}/5` : "por preencher"}
                      </p>
                    </div>
                    {badgeEstado(est)}
                    <span className={`text-slate-400 transition-transform ${aberto ? "rotate-90" : ""}`}>›</span>
                  </button>
                  {aberto && (
                    <div className="px-5 pb-4 space-y-3 bg-slate-50/70">
                      <div className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Vídeo da simulação</p>
                          <p className="text-xs text-slate-700 mt-0.5 truncate">{item.videoName ?? "Nenhum vídeo carregado"}</p>
                        </div>
                        <button onClick={() => pickFile(item.id, "video")}
                          className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border ${item.videoName ? "bg-white text-slate-600 border-slate-200" : "bg-violet-50 text-violet-700 border-violet-200"}`}>
                          {item.videoName ? "Substituir vídeo" : "Carregar vídeo"}
                        </button>
                      </div>
                      <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Folha de avaliação</p>
                        {criterios.length === 0 && (
                          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                            Este curso ainda não tem parâmetros de avaliação. Define-os na ficha do curso (Edição de Cursos).
                          </p>
                        )}
                        {criterios.map(c => (
                          <div key={c.id} className="flex items-center gap-3">
                            <p className="flex-1 text-xs text-slate-700 min-w-0">{c.label}</p>
                            <div className="flex gap-1">
                              {[1, 2, 3, 4, 5].map(n => (
                                <button key={n} onClick={() => setSimItems(prev => prev.map(x => x.id === item.id ? { ...x, notas: { ...x.notas, [c.id]: n } } : x))}
                                  className={`w-7 h-7 rounded-full text-xs font-bold border ${item.notas[c.id] === n ? "bg-amber-500 text-white border-amber-500" : "bg-white text-slate-500 border-slate-200 hover:border-amber-300"}`}>
                                  {n}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {doc.kind === "lista" && (
          <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
            {items.map(item => (
              <label key={item.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 cursor-pointer">
                <button type="button" onClick={() => setItems(prev => prev.map(x => x.id === item.id ? { ...x, ok: !x.ok } : x))}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${item.ok ? "bg-emerald-500 border-emerald-500" : "border-slate-300"}`}>
                  {item.ok && <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </button>
                <span className="flex-1 text-sm text-slate-700">{item.nome}</span>
                {badgeEstado(item.ok ? "ok" : "falta")}
              </label>
            ))}
          </div>
        )}

        {doc.kind === "ficheiro" && (
          <div className="p-5">
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
                <input ref={inputRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setFile(f); }} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" />
              </div>
            ) : (
              <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600 flex-shrink-0">{I.file}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{file.name}</p>
                  <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(0)} KB</p>
                </div>
                <button onClick={() => setFile(null)} className="p-1 text-slate-400 hover:text-red-500">{I.x}</button>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 px-5 py-4 border-t border-slate-100 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2 border border-slate-200 text-sm text-slate-600 rounded-lg hover:bg-slate-50">Cancelar</button>
          <button onClick={guardar} disabled={doc.kind === "ficheiro" && !file}
            className={`flex-1 py-2 disabled:opacity-40 text-white text-sm font-semibold rounded-lg ${gold ? "bg-amber-500 hover:bg-amber-600" : "bg-blue-600 hover:bg-blue-700"}`}>
            {doc.kind === "ficheiro" ? "Guardar no dossiê" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
