import { useEffect, useState } from "react";
import {
  apiDocsPreinscricao, apiDocsPreinscricaoApagarModelo, apiDocsPreinscricaoUpload, apiSaveDocsPreinscricao,
  type DocPreinscricaoCurso, type Regime,
} from "./api";
import { toastError, toastOk } from "./toastBus";

const iCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700";

function ModeloDoc({
  accent, cursoId, doc, busy, onChange,
}: {
  accent: Regime;
  cursoId: number;
  doc: DocPreinscricaoCurso;
  busy: boolean;
  onChange: () => void;
}) {
  const [aEnviar, setAEnviar] = useState(false);
  async function enviar(file: File | null) {
    if (!file) return;
    setAEnviar(true);
    try {
      await apiDocsPreinscricaoUpload(accent, cursoId, doc.id, file);
      toastOk("Documento da secretaria gravado. Na pré-inscrição a pessoa tem de o ler até ao fim.");
      onChange();
    } catch (err) {
      toastError(err, "Não foi possível gravar o ficheiro.");
    } finally {
      setAEnviar(false);
    }
  }
  async function retirar() {
    setAEnviar(true);
    try {
      await apiDocsPreinscricaoApagarModelo(accent, cursoId, doc.id);
      toastOk("Ficheiro retirado. A pessoa volta a anexar o seu.");
      onChange();
    } catch (err) {
      toastError(err, "Não foi possível retirar o ficheiro.");
    } finally {
      setAEnviar(false);
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="text-[11px] font-semibold text-slate-500">
        <span className="block">{doc.modelo ? doc.modelo : "Sem ficheiro · a pessoa anexa"}</span>
        <input
          type="file"
          accept=".pdf,image/jpeg,image/png,application/pdf"
          disabled={busy || aEnviar}
          className="mt-1 block max-w-[14rem] text-[11px]"
          onChange={e => { void enviar(e.target.files?.[0] ?? null); e.currentTarget.value = ""; }}
        />
      </label>
      {doc.modelo && (
        <button type="button" disabled={busy || aEnviar} onClick={() => void retirar()} className="text-[11px] font-semibold text-slate-400 hover:text-red-600">
          Retirar
        </button>
      )}
    </div>
  );
}

function pedePreinscricao(regime: Regime, tipo: string) {
  if (regime === "fin") return true;
  const t = tipo.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  return t.includes("pre-inscr") || t.includes("preinscr");
}

export function CursoDocumentos({ accent, cursoId, tipo = "" }: { accent: Regime; cursoId?: number; tipo?: string }) {
  const [docs, setDocs] = useState<DocPreinscricaoCurso[]>([]);
  const [estado, setEstado] = useState<"loading" | "ready" | "offline">("loading");
  const [nome, setNome] = useState("");
  const [obrigatorio, setObrigatorio] = useState(true);
  const [busy, setBusy] = useState(false);
  const gold = accent === "gold";
  const btn = gold ? "bg-amber-500 hover:bg-amber-600" : "bg-blue-600 hover:bg-blue-700";
  const chk = gold ? "accent-amber-500" : "accent-blue-600";
  const aplica = pedePreinscricao(accent, tipo);

  function carregar() {
    if (cursoId == null || !aplica) { setEstado("ready"); return; }
    setEstado("loading");
    apiDocsPreinscricao(accent, cursoId)
      .then(r => { setDocs(r.docs); setEstado("ready"); })
      .catch(() => setEstado("offline"));
  }

  useEffect(() => { carregar(); }, [accent, cursoId, aplica]);

  async function guardar(next: DocPreinscricaoCurso[]) {
    if (cursoId == null) return;
    setBusy(true);
    try {
      await apiSaveDocsPreinscricao(accent, cursoId, {
        ocultos: next.filter(d => d.origem === "base" && !d.pedido).map(d => d.id),
        extra: next.filter(d => d.origem === "extra").map(d => ({ id: d.id.startsWith("novo-") ? undefined : d.id, label: d.label, required: d.required })),
      });
      toastOk("Documentos da pré-inscrição gravados.");
      carregar();
    } catch (err) {
      toastError(err, "Não foi possível gravar. Se mudou o tipo comercial, grave primeiro a ficha do curso.");
    } finally {
      setBusy(false);
    }
  }

  function adicionar() {
    const label = nome.trim();
    if (label.length < 3) { toastError(new Error("Escreva o nome do documento.")); return; }
    const id = `novo-${Date.now()}`;
    const next = [...docs, { id, label, required: obrigatorio, pedido: true, origem: "extra" as const }];
    setDocs(next);
    setNome("");
    void guardar(next);
  }

  if (cursoId == null) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center">
        <p className="text-sm font-semibold text-slate-700">Grave o curso primeiro</p>
        <p className="text-xs text-slate-500 mt-1">Os documentos da pré-inscrição ficam ligados ao curso.</p>
      </div>
    );
  }

  if (!aplica) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-sm font-semibold text-slate-800">Sem documentos na pré-inscrição</p>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          Este curso é de acesso direto. A pessoa paga e entra no curso, por isso não há ficheiros para anexar nesta fase.
          A lista só aparece quando o tipo comercial é Pré-inscrição.
        </p>
      </div>
    );
  }

  if (estado === "loading") return <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">A ler os documentos da pré-inscrição…</div>;
  if (estado === "offline") {
    return <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">Sem ligação à API. Os documentos da pré-inscrição não se editam offline.</div>;
  }

  const base = docs.filter(d => d.origem === "base");
  const extra = docs.filter(d => d.origem === "extra");
  const dossie = docs.filter(d => d.origem === "dossie");

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
        <div>
          <p className="text-sm font-semibold text-slate-800">Documentos da pré-inscrição</p>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            O ficheiro da secretaria é opcional. Sem ficheiro, a pessoa anexa o seu na pré-inscrição. Com ficheiro, abre o documento completo e só continua depois de o ler até ao fim.
          </p>
        </div>
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {base.map(d => (
            <li key={d.id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <input
                  type="checkbox"
                  className={`w-4 h-4 ${chk}`}
                  checked={d.pedido}
                  disabled={busy}
                  onChange={e => {
                    const next = docs.map(x => x.id === d.id ? { ...x, pedido: e.target.checked } : x);
                    setDocs(next);
                    void guardar(next);
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${d.pedido ? "text-slate-800" : "text-slate-400 line-through"}`}>{d.label}</p>
                </div>
                {d.required && d.pedido && (
                  <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">obrigatório</span>
                )}
              </div>
              {d.pedido && <ModeloDoc accent={accent} cursoId={cursoId} doc={d} busy={busy} onChange={carregar} />}
            </li>
          ))}
        </ul>
        {extra.length > 0 && (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {extra.map(d => (
              <li key={d.id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-800">{d.label}</p>
                  <p className="text-[11px] text-slate-400">{d.required ? "Obrigatório na pré-inscrição" : "Opcional na pré-inscrição"}</p>
                </div>
                {!d.id.startsWith("novo-") && <ModeloDoc accent={accent} cursoId={cursoId} doc={d} busy={busy} onChange={carregar} />}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    const next = docs.filter(x => x.id !== d.id);
                    setDocs(next);
                    void guardar(next);
                  }}
                  className="text-xs font-semibold text-slate-400 hover:text-red-600"
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        )}
        {dossie.length > 0 && (
          <p className="text-xs text-slate-500">
            O dossiê deste curso também pede, por formando: {dossie.map(d => d.label).join(", ")}.
          </p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end">
          <label className="block text-xs font-semibold uppercase text-slate-500">Novo documento
            <input
              className={`${iCls} mt-1`}
              value={nome}
              placeholder="Ex. Comprovativo de residência"
              onChange={e => setNome(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); adicionar(); } }}
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-600 pb-2">
            <input type="checkbox" className={`w-3.5 h-3.5 ${chk}`} checked={obrigatorio} onChange={e => setObrigatorio(e.target.checked)} />
            Obrigatório
          </label>
        </div>
        <button type="button" disabled={busy || nome.trim().length < 3} onClick={adicionar} className={`px-4 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-40 ${btn}`}>
          {busy ? "A gravar…" : "Adicionar à pré-inscrição"}
        </button>
      </div>
    </div>
  );
}
