import { useEffect, useMemo, useState } from "react";
import {
  apiDtpModelo,
  apiSaveDtpModelo,
  type DtpDef,
  type DtpFase,
  type DtpModeloResposta,
  type Regime,
} from "./api";

type ExtraDraft = { id: string; fase: DtpFase; label: string; fonte: string; hint: string; bloqueante: boolean };

const iCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent";

function novoExtra(fase: DtpFase): ExtraDraft {
  return { id: "", fase, label: "", fonte: "", hint: "", bloqueante: false };
}

/**
 * Estrutura do dossiê técnico-pedagógico deste curso. A base vem do regime; os documentos
 * que são norma (DGERT e, na financiada, execução do financiador) ficam travados.
 */
export function DtpModeloEditor({ accent, cursoId }: { accent: Regime; cursoId?: number }) {
  const [dados, setDados] = useState<DtpModeloResposta | null>(null);
  const [estado, setEstado] = useState<"loading" | "ready" | "offline">("loading");
  const [excluidos, setExcluidos] = useState<Set<string>>(new Set());
  const [extra, setExtra] = useState<ExtraDraft[]>([]);
  const [draft, setDraft] = useState<ExtraDraft>(() => novoExtra("durante"));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const gold = accent === "gold";
  const acento = gold
    ? { btn: "bg-amber-500 hover:bg-amber-600", chip: "bg-amber-50 text-amber-700 border-amber-200", chk: "accent-amber-500" }
    : { btn: "bg-blue-600 hover:bg-blue-700", chip: "bg-blue-50 text-blue-700 border-blue-200", chk: "accent-blue-600" };

  useEffect(() => {
    if (cursoId == null) { setEstado("ready"); return; }
    let alive = true;
    apiDtpModelo(accent, cursoId)
      .then(r => {
        if (!alive) return;
        setDados(r);
        setExcluidos(new Set(r.modelo.excluidos));
        setExtra(r.modelo.extra.map(x => ({ ...x, bloqueante: Boolean(x.bloqueante) })));
        setEstado("ready");
      })
      .catch(() => { if (alive) setEstado("offline"); });
    return () => { alive = false; };
  }, [accent, cursoId]);

  const porFase = useMemo(() => {
    const fases = dados?.fases ?? [];
    return fases.map(f => ({
      ...f,
      itens: (dados?.base ?? []).filter(d => d.fase === f.id),
      extras: extra.filter(x => x.fase === f.id),
    }));
  }, [dados, extra]);

  const total = (dados?.base ?? []).filter(d => d.obrigatorio || !excluidos.has(d.id)).length + extra.length;
  const normas = (dados?.base ?? []).filter(d => d.obrigatorio).length;

  async function guardar() {
    if (cursoId == null) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await apiSaveDtpModelo(accent, cursoId, {
        excluidos: [...excluidos],
        extra: extra
          .filter(x => x.label.trim())
          .map(x => ({
            id: x.id || undefined,
            fase: x.fase,
            label: x.label.trim(),
            fonte: x.fonte.trim() || undefined,
            hint: x.hint.trim() || undefined,
            bloqueante: x.bloqueante,
          })),
      });
      setExcluidos(new Set(r.modelo.excluidos));
      setExtra(r.modelo.extra.map(x => ({ ...x, bloqueante: Boolean(x.bloqueante) })));
      setMsg(`Estrutura gravada: ${r.estrutura.length} documentos no dossiê das turmas deste curso.`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Não foi possível gravar a estrutura.");
    } finally {
      setBusy(false);
    }
  }

  if (cursoId == null) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center">
        <p className="text-sm font-semibold text-slate-700">Grave o curso primeiro</p>
        <p className="text-xs text-slate-500 mt-1">A estrutura do dossiê fica ligada ao curso, por isso precisa de um curso gravado.</p>
      </div>
    );
  }
  if (estado === "loading") {
    return <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">A ler a estrutura do dossiê…</div>;
  }
  if (estado === "offline" || !dados) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
        <p className="text-sm font-semibold text-amber-800">Sem ligação à API</p>
        <p className="text-xs text-amber-700 mt-1">A estrutura do dossiê não se edita offline.</p>
      </div>
    );
  }

  function toggle(def: DtpDef) {
    if (def.obrigatorio) return;
    setExcluidos(prev => {
      const next = new Set(prev);
      if (next.has(def.id)) next.delete(def.id);
      else next.add(def.id);
      return next;
    });
    setMsg("");
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-800">Estrutura do dossiê técnico-pedagógico</p>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              {gold
                ? "Base das formações Gold (autofinanciadas): núcleo DGERT mais os extras do CCP. Ligue ou desligue o que este curso exige."
                : "Base das formações financiadas: núcleo DGERT mais a execução do financiador. Ligue ou desligue o que a tipologia exige."}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="text-right">
              <p className="text-2xl font-bold text-slate-800 leading-none">{total}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">documentos</p>
            </div>
            <button type="button" disabled={busy} onClick={() => void guardar()} className={`px-4 py-2.5 text-sm font-semibold rounded-lg ${acento.btn} disabled:opacity-40 text-white`}>
              {busy ? "A gravar…" : "Gravar estrutura"}
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-500">
          <span className="font-semibold text-slate-700">{normas} documentos são norma</span> e não se removem
          {gold ? " (Portaria 851/2010 da DGERT)." : " (Portaria 851/2010 da DGERT e Despacho 5756/2020 do financiador)."}
          {" "}Aplica-se a todas as turmas deste curso; o estado de cada documento continua a ser por turma.
        </p>
        {msg && <p className="text-xs font-semibold text-emerald-700">{msg}</p>}
      </div>

      {porFase.map(f => (
        <div key={f.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
            <p className="text-sm font-semibold text-slate-800">{f.label}</p>
            <p className="text-xs text-slate-400 mt-0.5">{f.hint}</p>
          </div>
          <div className="divide-y divide-slate-100">
            {f.itens.map(def => {
              const dentro = def.obrigatorio || !excluidos.has(def.id);
              return (
                <label
                  key={def.id}
                  className={`flex items-start gap-3 px-4 py-3 ${def.obrigatorio ? "bg-slate-50/60" : "cursor-pointer hover:bg-slate-50"}`}
                >
                  <input
                    type="checkbox"
                    className={`mt-0.5 w-4 h-4 ${acento.chk} disabled:opacity-60`}
                    checked={dentro}
                    disabled={def.obrigatorio}
                    onChange={() => toggle(def)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className={`text-sm font-medium ${dentro ? "text-slate-800" : "text-slate-400 line-through"}`}>{def.label}</p>
                      {def.obrigatorio && (
                        <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">norma</span>
                      )}
                      {def.bloqueante && (
                        <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-red-100 text-red-600">bloqueante</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{def.hint}</p>
                  </div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400 text-right max-w-[160px] flex-shrink-0">{def.fonte}</p>
                </label>
              );
            })}
            {f.extras.map(x => (
              <div key={x.id || x.label} className="flex items-start gap-3 px-4 py-3 bg-white">
                <span className={`mt-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${acento.chip}`}>curso</span>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <input
                    className={iCls}
                    value={x.label}
                    onChange={e => setExtra(prev => prev.map(y => (y === x ? { ...y, label: e.target.value } : y)))}
                  />
                  <input
                    className={iCls}
                    value={x.hint}
                    placeholder="O que a secretaria tem de arquivar"
                    onChange={e => setExtra(prev => prev.map(y => (y === x ? { ...y, hint: e.target.value } : y)))}
                  />
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      className={`w-3.5 h-3.5 ${acento.chk}`}
                      checked={x.bloqueante}
                      onChange={e => setExtra(prev => prev.map(y => (y === x ? { ...y, bloqueante: e.target.checked } : y)))}
                    />
                    Bloqueia o fecho da turma
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => setExtra(prev => prev.filter(y => y !== x))}
                  className="text-xs font-semibold text-slate-400 hover:text-red-500 flex-shrink-0"
                >
                  Remover
                </button>
              </div>
            ))}
            {f.itens.length === 0 && f.extras.length === 0 && (
              <p className="px-4 py-6 text-center text-xs text-slate-400">Sem documentos nesta fase.</p>
            )}
          </div>
        </div>
      ))}

      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">Acrescentar documento a este curso</p>
          <p className="text-xs text-slate-500 mt-0.5">Para exigências que não estão na base do regime — uma ficha técnica, um termo de responsabilidade, um ficheiro de exercícios.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_170px] gap-3">
          <input
            className={iCls}
            value={draft.label}
            placeholder="Nome do documento"
            onChange={e => setDraft(d => ({ ...d, label: e.target.value }))}
          />
          <select className={iCls} value={draft.fase} onChange={e => setDraft(d => ({ ...d, fase: e.target.value as DtpFase }))}>
            {dados.fases.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </div>
        <input
          className={iCls}
          value={draft.hint}
          placeholder="O que a secretaria tem de arquivar (opcional)"
          onChange={e => setDraft(d => ({ ...d, hint: e.target.value }))}
        />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              className={`w-3.5 h-3.5 ${acento.chk}`}
              checked={draft.bloqueante}
              onChange={e => setDraft(d => ({ ...d, bloqueante: e.target.checked }))}
            />
            Bloqueia o fecho da turma
          </label>
          <button
            type="button"
            disabled={draft.label.trim().length < 3}
            onClick={() => {
              setExtra(prev => [...prev, { ...draft, label: draft.label.trim(), fonte: "ENA · exigência do curso" }]);
              setDraft(novoExtra(draft.fase));
              setMsg("");
            }}
            className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            Acrescentar
          </button>
        </div>
      </div>
    </div>
  );
}
