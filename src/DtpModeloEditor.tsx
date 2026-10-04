import { useEffect, useMemo, useState } from "react";
import {
  apiDtpEntidadeModelo,
  apiDtpModelo,
  apiSaveDtpEntidadeModelo,
  apiSaveDtpModelo,
  type DtpDef,
  type DtpFase,
  type DtpModeloResposta,
  type Regime,
} from "./api";

type ExtraDraft = { key: string; id: string; fase: DtpFase; label: string; fonte: string; hint: string; bloqueante: boolean; ambito: "turma" | "formando" | "formador" };

const iCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent";

/**
 * Estrutura do dossiê. No curso Gold importa a entidade responsável e só grava
 * a personalização desse curso. Na entidade grava a estrutura que os cursos herdam.
 */
export function DtpModeloEditor({ accent, cursoId, entidadeId, onSaved }: {
  accent: Regime;
  cursoId?: number;
  entidadeId?: number;
  onSaved?: (info: { documentos: number }) => void;
}) {
  const [dados, setDados] = useState<DtpModeloResposta | null>(null);
  const [estado, setEstado] = useState<"loading" | "ready" | "offline">("loading");
  const [excluidos, setExcluidos] = useState<Set<string>>(new Set());
  const [incluidos, setIncluidos] = useState<Set<string>>(new Set());
  const [extra, setExtra] = useState<ExtraDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const gold = accent === "gold";
  const modoEntidade = entidadeId != null;
  const acento = gold
    ? { btn: "bg-amber-500 hover:bg-amber-600", chip: "bg-amber-50 text-amber-700 border-amber-200", chk: "accent-amber-500" }
    : { btn: "bg-blue-600 hover:bg-blue-700", chip: "bg-blue-50 text-blue-700 border-blue-200", chk: "accent-blue-600" };

  useEffect(() => {
    if (!modoEntidade && cursoId == null) { setEstado("ready"); return; }
    let alive = true;
    const pedido = modoEntidade ? apiDtpEntidadeModelo(entidadeId) : apiDtpModelo(accent, cursoId!);
    pedido
      .then(r => {
        if (!alive) return;
        setDados(r);
        setExcluidos(new Set(r.modelo.excluidos));
        setIncluidos(new Set(r.modelo.incluidos ?? []));
        setExtra(r.modelo.extra.map(x => ({ key: x.id, ...x, bloqueante: Boolean(x.bloqueante), ambito: x.ambito ?? "turma" })));
        setEstado("ready");
      })
      .catch(() => { if (alive) setEstado("offline"); });
    return () => { alive = false; };
  }, [accent, cursoId, entidadeId, modoEntidade]);

  const entidadeExcluidos = useMemo(
    () => new Set(dados?.entidade?.modelo.excluidos ?? []),
    [dados],
  );
  const extrasEntidade = dados?.entidade?.modelo.extra ?? [];

  function dentroBase(def: DtpDef) {
    if (def.obrigatorio) return true;
    if (entidadeExcluidos.has(def.id)) return incluidos.has(def.id);
    return !excluidos.has(def.id);
  }

  const porFase = useMemo(() => {
    const fases = dados?.fases ?? [];
    return fases.map(f => ({
      ...f,
      itens: (dados?.base ?? []).filter(d => d.fase === f.id),
      daEntidade: extrasEntidade.filter(x => x.fase === f.id),
      extras: extra.filter(x => x.fase === f.id),
    }));
  }, [dados, extra, extrasEntidade]);

  const total = gold
    ? (dados?.base ?? []).filter(d => dentroBase(d)).length
      + extrasEntidade.filter(x => !excluidos.has(`extra:${x.id}`)).length
      + extra.length
    : (dados?.base ?? []).length;
  const normas = (dados?.base ?? []).filter(d => d.obrigatorio).length;

  async function guardar() {
    if (!modoEntidade && cursoId == null) return;
    const curtos = extra.filter(x => x.label.trim() && x.label.trim().length < 3);
    if (curtos.length) {
      setMsg("Cada documento extra precisa de um nome com pelo menos 3 letras.");
      return;
    }
    setBusy(true);
    setMsg("");
    const extraBody = extra
      .filter(x => x.label.trim().length >= 3)
      .map(x => ({
        id: x.id || undefined,
        fase: x.fase,
        label: x.label.trim(),
        fonte: x.fonte.trim() || undefined,
        hint: x.hint.trim() || undefined,
        bloqueante: x.bloqueante,
        ambito: x.ambito ?? "turma" as const,
      }));
    try {
      const aplicar = (modelo: { excluidos: string[]; incluidos?: string[]; extra: { id: string; fase: DtpFase; label: string; fonte: string; hint: string; bloqueante?: boolean; ambito?: "turma" | "formando" | "formador" }[] }) => {
        setExcluidos(new Set(modelo.excluidos));
        setIncluidos(new Set(modelo.incluidos ?? []));
        setExtra(modelo.extra.map(x => ({ key: x.id || x.label, ...x, bloqueante: Boolean(x.bloqueante), ambito: x.ambito ?? "turma" })));
      };
      if (modoEntidade) {
        const r = await apiSaveDtpEntidadeModelo(entidadeId, { excluidos: [...excluidos], extra: extraBody });
        aplicar(r.modelo);
        onSaved?.({ documentos: r.estrutura.length });
        setMsg(`Estrutura gravada: ${r.estrutura.length} documentos para os cursos desta entidade.`);
      } else {
        const r = await apiSaveDtpModelo(accent, cursoId!, { excluidos: [...excluidos], incluidos: [...incluidos], extra: extraBody });
        aplicar(r.modelo);
        if (r.entidade) setDados(prev => prev ? { ...prev, entidade: r.entidade } : prev);
        setMsg(dados?.entidade
          ? `Personalização gravada: ${r.estrutura.length} documentos nas turmas deste curso. A entidade ${dados.entidade.nome} mantém a estrutura dela.`
          : `Estrutura gravada: ${r.estrutura.length} documentos no dossiê das turmas deste curso.`);
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Não foi possível gravar a estrutura.");
    } finally {
      setBusy(false);
    }
  }

  if (!modoEntidade && cursoId == null) {
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
    if (def.obrigatorio || !gold) return;
    if (entidadeExcluidos.has(def.id)) {
      setIncluidos(prev => {
        const next = new Set(prev);
        if (next.has(def.id)) next.delete(def.id);
        else next.add(def.id);
        return next;
      });
    } else {
      setExcluidos(prev => {
        const next = new Set(prev);
        if (next.has(def.id)) next.delete(def.id);
        else next.add(def.id);
        return next;
      });
    }
    setMsg("");
  }

  function toggleExtraEntidade(id: string) {
    const key = `extra:${id}`;
    setExcluidos(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setMsg("");
  }

  function acrescentar(fase: DtpFase) {
    setExtra(prev => [...prev, { key: `novo-${Date.now()}`, id: "", fase, label: "", fonte: "", hint: "", bloqueante: false, ambito: "turma" }]);
    setMsg("");
  }

  const lead = modoEntidade
    ? "Esta estrutura vale para todos os cursos Gold a que atribuir esta entidade. Cada curso pode personalizar por cima, sem alterar a entidade."
    : dados.entidade
      ? `Importada de ${dados.entidade.nome}. O que ligar ou desligar aqui fica só neste curso. As turmas usam a entidade e, por cima, esta personalização.`
      : gold
        ? "Antes, durante e fecho. Atribua uma entidade responsável na oferta para importar uma estrutura comum. Sem entidade, o dossiê é só deste curso."
        : "Na formação financiada o dossiê é o mesmo para todas as UFCD: antes, durante e fecho, com os requisitos universais e os da execução do financiador.";

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-slate-800">
                {modoEntidade ? "Estrutura desta entidade" : "Estrutura do dossiê técnico-pedagógico"}
              </p>
              {dados.entidade && (
                <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">{dados.entidade.nome}</span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{lead}</p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="text-right">
              <p className="text-2xl font-bold text-slate-800 leading-none">{total}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">documentos</p>
            </div>
            {gold && (
              <button type="button" disabled={busy} onClick={() => void guardar()} className={`px-4 py-2.5 text-sm font-semibold rounded-lg ${acento.btn} disabled:opacity-40 text-white`}>
                {busy ? "A gravar…" : modoEntidade ? "Gravar entidade" : "Gravar estrutura"}
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-slate-500">
          <span className="font-semibold text-slate-700">{normas} documentos são norma</span> e não se removem
          {gold ? " (Portaria 851/2010 da DGERT)." : " (Portaria 851/2010 da DGERT e Despacho 5756/2020 do financiador)."}
          {" "}{modoEntidade
            ? "Os cursos que usam esta entidade herdam a lista. O estado de cada documento continua a ser por turma."
            : "Aplica-se a todas as turmas deste curso. O estado de cada documento continua a ser por turma."}
        </p>
        {msg && <p className="text-xs font-semibold text-emerald-700">{msg}</p>}
      </div>

      {porFase.map(f => (
        <div key={f.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-800">{f.label}</p>
              <p className="text-xs text-slate-400 mt-0.5">{f.hint}</p>
            </div>
            {gold && (
              <button type="button" onClick={() => acrescentar(f.id)} className="text-xs font-semibold text-amber-700 hover:text-amber-900 flex-shrink-0">
                Acrescentar
              </button>
            )}
          </div>
          <div className="divide-y divide-slate-100">
            {f.itens.map(def => {
              const dentro = gold ? dentroBase(def) : true;
              const reposto = entidadeExcluidos.has(def.id) && incluidos.has(def.id);
              return (
                <label
                  key={def.id}
                  className={`flex items-start gap-3 px-4 py-3 ${def.obrigatorio || !gold ? "bg-slate-50/60" : "cursor-pointer hover:bg-slate-50"}`}
                >
                  <input
                    type="checkbox"
                    className={`mt-0.5 w-4 h-4 ${acento.chk} disabled:opacity-60`}
                    checked={dentro}
                    disabled={def.obrigatorio || !gold}
                    onChange={() => toggle(def)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className={`text-sm font-medium ${dentro ? "text-slate-800" : "text-slate-400 line-through"}`}>{def.label}</p>
                      {def.obrigatorio && (
                        <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">norma</span>
                      )}
                      {def.universal && (
                        <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">universal</span>
                      )}
                      {reposto && (
                        <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">curso</span>
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
            {f.daEntidade.map(x => {
              const dentro = !excluidos.has(`extra:${x.id}`);
              return (
                <label key={`ent-${x.id}`} className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    className={`mt-0.5 w-4 h-4 ${acento.chk}`}
                    checked={dentro}
                    onChange={() => toggleExtraEntidade(x.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className={`text-sm font-medium ${dentro ? "text-slate-800" : "text-slate-400 line-through"}`}>{x.label}</p>
                      <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">entidade</span>
                      {x.bloqueante && (
                        <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-red-100 text-red-600">bloqueante</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{x.hint || "Documento da entidade responsável. Desligar aqui vale só para este curso."}</p>
                  </div>
                </label>
              );
            })}
            {gold && f.extras.map(x => (
              <div key={x.key} className="flex items-start gap-3 px-4 py-3 bg-white">
                <span className={`mt-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${acento.chip}`}>{modoEntidade ? "entidade" : "curso"}</span>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <input
                    className={iCls}
                    value={x.label}
                    placeholder="Nome do documento"
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
                  <select
                    className={iCls}
                    value={x.ambito ?? "turma"}
                    onChange={e => setExtra(prev => prev.map(y => (y === x ? { ...y, ambito: e.target.value as ExtraDraft["ambito"] } : y)))}
                  >
                    <option value="turma">Ficheiro da turma (dossiê)</option>
                    <option value="formando">Um por cada formando</option>
                    <option value="formador">No perfil do formador</option>
                  </select>
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
            {f.itens.length === 0 && f.extras.length === 0 && f.daEntidade.length === 0 && (
              <p className="px-4 py-6 text-center text-xs text-slate-400">Sem documentos nesta fase.</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
