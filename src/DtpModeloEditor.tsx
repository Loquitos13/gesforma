import { useEffect, useMemo, useState } from "react";
import {
  apiDtpModelo,
  apiSaveDtpModelo,
  type DtpDef,
  type DtpFase,
  type DtpModeloResposta,
  type Regime,
} from "./api";
import { useCatalogList } from "./CatalogsContext";
import { SearchSelect } from "./FormKit";

type ExtraDraft = { id: string; fase: DtpFase; label: string; fonte: string; hint: string; bloqueante: boolean; ambito: "turma" | "formando" | "formador" };

const iCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent";

/**
 * Estrutura do dossiê técnico-pedagógico deste curso. A base vem do regime; os documentos
 * que são norma (DGERT e, na financiada, execução do financiador) ficam travados.
 */
type EntidadeDtp = { id: number; nome: string; excluidos?: string[]; extra?: ExtraDraft[] };

export function EntidadesResponsaveisPainel() {
  const [entidades, setEntidades] = useCatalogList<EntidadeDtp>("entidades", "gold", []);
  const [nome, setNome] = useState("");
  const [aberta, setAberta] = useState(false);

  function criar() {
    const limpo = nome.trim();
    if (!limpo) return;
    if (entidades.some(e => e.nome.toLowerCase() === limpo.toLowerCase())) {
      setNome("");
      setAberta(false);
      return;
    }
    setEntidades(prev => [...prev, { id: -Date.now(), nome: limpo }]);
    setNome("");
    setAberta(false);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">Entidades responsáveis</p>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            Crie a entidade aqui. Para a atribuir a um curso, abra Edição de cursos, o curso, e a tab Dossiê TP.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setAberta(true); setNome(""); }}
          className="shrink-0 px-3 py-2 text-xs font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600"
        >
          + Nova entidade
        </button>
      </div>
      {aberta && (
        <form className="flex flex-col sm:flex-row gap-2" onSubmit={e => { e.preventDefault(); criar(); }}>
          <input
            autoFocus
            className={iCls}
            value={nome}
            placeholder="Nome da entidade responsável"
            onChange={e => setNome(e.target.value)}
          />
          <button type="submit" disabled={!nome.trim()} className="px-3 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-white disabled:opacity-40">Criar</button>
          <button type="button" onClick={() => setAberta(false)} className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600">Cancelar</button>
        </form>
      )}
      {entidades.length === 0 ? (
        <p className="text-xs text-slate-400">Ainda não há entidades. Use «Nova entidade» para criar a primeira.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {entidades.map(e => (
            <li key={e.id} className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-900 text-xs font-semibold border border-amber-200">{e.nome}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DtpModeloEditor({
  accent, cursoId, entidadeNome = "", onEntidade,
}: {
  accent: Regime;
  cursoId?: number;
  entidadeNome?: string;
  onEntidade?: (nome: string) => void;
}) {
  const [dados, setDados] = useState<DtpModeloResposta | null>(null);
  const [estado, setEstado] = useState<"loading" | "ready" | "offline">("loading");
  const [excluidos, setExcluidos] = useState<Set<string>>(new Set());
  const [extra, setExtra] = useState<ExtraDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [entidades, setEntidades] = useCatalogList<EntidadeDtp>("entidades", "gold", []);
  const [novaEntidade, setNovaEntidade] = useState(false);
  const [nomeEntidade, setNomeEntidade] = useState("");

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
        setExtra(r.modelo.extra.map(x => ({ ...x, bloqueante: Boolean(x.bloqueante), ambito: x.ambito ?? "turma" })));
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

  const total = gold
    ? (dados?.base ?? []).filter(d => d.obrigatorio || !excluidos.has(d.id)).length + extra.length
    : (dados?.base ?? []).length;
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
            ambito: x.ambito ?? "turma",
          })),
      });
      setExcluidos(new Set(r.modelo.excluidos));
      setExtra(r.modelo.extra.map(x => ({ ...x, bloqueante: Boolean(x.bloqueante), ambito: x.ambito ?? "turma" })));
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

  function estruturaActual() {
    return {
      excluidos: [...excluidos],
      extra: extra.filter(x => x.label.trim()),
    };
  }

  function aplicarEntidade(nome: string) {
    onEntidade?.(nome);
    const ent = entidades.find(e => e.nome === nome);
    if (!ent) return;
    setExcluidos(new Set(ent.excluidos ?? []));
    setExtra((ent.extra ?? []).map(x => ({ ...x, bloqueante: Boolean(x.bloqueante), ambito: x.ambito ?? "turma" })));
    setMsg(`Estrutura de ${nome} aplicada a este curso. Grave para a ficar nas turmas.`);
  }

  function criarEntidade() {
    const nome = nomeEntidade.trim();
    if (!nome) return;
    const id = -Date.now();
    setEntidades(prev => [...prev, { id, nome, ...estruturaActual() }]);
    onEntidade?.(nome);
    setNovaEntidade(false);
    setNomeEntidade("");
  }

  function guardarNaEntidade() {
    const ent = entidades.find(e => e.nome === entidadeNome);
    if (!ent) return;
    setEntidades(prev => prev.map(e => e.id === ent.id ? { ...e, ...estruturaActual() } : e));
    setMsg(`Estrutura gravada na entidade ${ent.nome}.`);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">Entidade responsável</p>
          <p className="text-xs text-slate-500 mt-0.5">A estrutura pode viver na entidade e ser aplicada a este curso. A norma do financiador continua travada.</p>
        </div>
        <SearchSelect
          value={entidadeNome}
          onChange={aplicarEntidade}
          options={entidades.map(e => ({ value: e.nome }))}
          placeholder="Pesquisar entidade…"
          allowEmpty
          onAdd={() => { setNomeEntidade(""); setNovaEntidade(true); }}
          addLabel="Nova entidade responsável"
        />
        {novaEntidade && (
          <div className="flex gap-2">
            <input className={iCls} value={nomeEntidade} placeholder="Nome da entidade" onChange={e => setNomeEntidade(e.target.value)} />
            <button type="button" className="px-3 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-white" onClick={criarEntidade}>Criar</button>
          </div>
        )}
        {entidadeNome && (
          <button type="button" className="text-xs font-semibold text-slate-600 underline" onClick={guardarNaEntidade}>Guardar a estrutura actual nesta entidade</button>
        )}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-800">Estrutura do dossiê técnico-pedagógico</p>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              {gold
                ? "Antes, durante e fecho. Os requisitos universais valem para a autofinanciada e para a financiada. Ligue ou desligue o que este curso exige."
                : "Na formação financiada o dossiê é o mesmo para todas as UFCD: antes, durante e fecho, com os requisitos universais e os da execução do financiador."}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="text-right">
              <p className="text-2xl font-bold text-slate-800 leading-none">{total}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">documentos</p>
            </div>
            {gold && (
              <button type="button" disabled={busy} onClick={() => void guardar()} className={`px-4 py-2.5 text-sm font-semibold rounded-lg ${acento.btn} disabled:opacity-40 text-white`}>
                {busy ? "A gravar…" : "Gravar estrutura"}
              </button>
            )}
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
                    checked={gold ? dentro : true}
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
            {gold && f.extras.map(x => (
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
                  <SearchSelect
                    value={x.ambito ?? "turma"}
                    onChange={v => setExtra(prev => prev.map(y => (y === x ? { ...y, ambito: v as ExtraDraft["ambito"] } : y)))}
                    options={[
                      { value: "turma", sub: "Ficheiro da turma" },
                      { value: "formando", sub: "Um por cada formando" },
                      { value: "formador", sub: "No perfil do formador" },
                    ]}
                  />
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

    </div>
  );
}
