import { useEffect, useMemo, useState } from "react";
import {
  apiCursoDocumentos,
  apiCursoDocumentoApagar,
  apiCursoDocumentoUpload,
  type CursoDocumentoFicheiro,
  type CursoDocumentosResposta,
  type Regime,
} from "./api";
import { toastError, toastOk } from "./toastBus";

const iCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700";

export function CursoDocumentos({ accent, cursoId }: { accent: Regime; cursoId?: number }) {
  const [dados, setDados] = useState<CursoDocumentosResposta | null>(null);
  const [estado, setEstado] = useState<"loading" | "ready" | "offline">("loading");
  const [ambito, setAmbito] = useState<"curso" | "formando" | "formador">("curso");
  const [requisitoId, setRequisitoId] = useState("");
  const [pessoaId, setPessoaId] = useState<number | "">("");
  const [pessoaNome, setPessoaNome] = useState("");
  const [ficheiro, setFicheiro] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const gold = accent === "gold";
  const btn = gold ? "bg-amber-500 hover:bg-amber-600" : "bg-blue-600 hover:bg-blue-700";

  function carregar() {
    if (cursoId == null) { setEstado("ready"); return; }
    apiCursoDocumentos(accent, cursoId)
      .then(r => { setDados(r); setEstado("ready"); setRequisitoId(prev => prev || r.requisitos[0]?.id || ""); })
      .catch(() => setEstado("offline"));
  }

  useEffect(() => { carregar(); }, [accent, cursoId]);

  const porFase = useMemo(() => {
    const fases = dados?.fases ?? [];
    return fases.map(f => ({ ...f, itens: (dados?.requisitos ?? []).filter(r => r.fase === f.id) }));
  }, [dados]);

  async function enviar() {
    if (cursoId == null || !ficheiro || !requisitoId) return;
    if (ambito === "formando" && pessoaId === "") { toastError(new Error("Escolha o formando.")); return; }
    if (ambito === "formador" && !pessoaNome) { toastError(new Error("Escolha o formador.")); return; }
    setBusy(true);
    try {
      await apiCursoDocumentoUpload(accent, cursoId, ficheiro, {
        ambito,
        requisitoId,
        pessoaId: ambito === "formando" && pessoaId !== "" ? pessoaId : undefined,
        pessoaNome: ambito === "formador" ? pessoaNome : undefined,
      });
      setFicheiro(null);
      toastOk("Ficheiro associado ao requisito do dossiê.");
      carregar();
    } catch (err) {
      toastError(err, "Não foi possível anexar.");
    } finally {
      setBusy(false);
    }
  }

  async function apagar(f: CursoDocumentoFicheiro) {
    if (cursoId == null) return;
    setBusy(true);
    try {
      await apiCursoDocumentoApagar(accent, cursoId, f.id);
      carregar();
    } catch (err) {
      toastError(err, "Não foi possível remover.");
    } finally {
      setBusy(false);
    }
  }

  if (cursoId == null) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center">
        <p className="text-sm font-semibold text-slate-700">Grave o curso primeiro</p>
        <p className="text-xs text-slate-500 mt-1">Os documentos ficam ligados ao curso.</p>
      </div>
    );
  }
  if (estado === "loading") return <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">A ler os documentos do curso…</div>;
  if (estado === "offline" || !dados) {
    return <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">Sem ligação à API. Os documentos do curso não se editam offline.</div>;
  }

  const labelReq = (id: string) => dados.requisitos.find(r => r.id === id)?.label ?? id;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">Documentos do curso</p>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            Anexe um ficheiro do curso, de um formando ou de um formador e associe-o a um requisito do dossiê.
            O visto fecha quando todas as partes responsáveis tiverem enviado esse documento.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {([
            ["curso", "Ficheiro do curso"],
            ["formando", "Formando"],
            ["formador", "Formador"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setAmbito(id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border ${ambito === id ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="block text-xs font-semibold uppercase text-slate-500">Requisito do dossiê
          <select className={`${iCls} mt-1`} value={requisitoId} onChange={e => setRequisitoId(e.target.value)}>
            {porFase.map(f => (
              <optgroup key={f.id} label={f.label}>
                {f.itens.map(r => (
                  <option key={r.id} value={r.id}>{r.label}{r.universal ? " · universal" : ""}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        {ambito === "formando" && (
          <label className="block text-xs font-semibold uppercase text-slate-500">Formando
            <select className={`${iCls} mt-1`} value={pessoaId} onChange={e => setPessoaId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Seleccione</option>
              {dados.formandos.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </label>
        )}
        {ambito === "formador" && (
          <label className="block text-xs font-semibold uppercase text-slate-500">Formador
            <select className={`${iCls} mt-1`} value={pessoaNome} onChange={e => setPessoaNome(e.target.value)}>
              <option value="">Seleccione</option>
              {dados.formadores.map(f => <option key={f.nome} value={f.nome}>{f.nome}</option>)}
            </select>
          </label>
        )}
        {ambito === "formando" && dados.formandos.length === 0 && (
          <p className="text-xs text-amber-800">Ainda não há formandos nas turmas deste curso.</p>
        )}
        {ambito === "formador" && dados.formadores.length === 0 && (
          <p className="text-xs text-amber-800">Ainda não há formador atribuído às turmas deste curso.</p>
        )}
        <input className="block w-full text-sm" type="file" onChange={e => setFicheiro(e.target.files?.[0] ?? null)} />
        <button type="button" disabled={busy || !ficheiro || !requisitoId} onClick={() => void enviar()} className={`px-4 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-40 ${btn}`}>
          {busy ? "A anexar…" : "Anexar ao requisito"}
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-800">Ficheiros já associados</p>
        </div>
        {dados.ficheiros.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-400 text-center">Ainda sem ficheiros neste curso.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {dados.ficheiros.map(f => (
              <li key={f.id} className="px-4 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">{labelReq(f.requisitoId)}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {f.ambito === "curso" ? "Curso" : f.ambito === "formando" ? "Formando" : "Formador"}
                    {f.pessoaNome ? ` · ${f.pessoaNome}` : ""}
                    {" · "}{f.nome}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {f.url && <a href={f.url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-amber-700">Abrir</a>}
                  <button type="button" onClick={() => void apagar(f)} className="text-xs font-semibold text-slate-400 hover:text-red-600">Remover</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
