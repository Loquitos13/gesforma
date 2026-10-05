import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiSaveTurmaAvaliacao, apiTurmaAvaliacao, type Regime } from "./api";
import {
  aprovado,
  chaveNota,
  clampNota,
  formatNota,
  listaNotas,
  mapaNotas,
  MODULO_FINAL,
  notaFinalFormando,
  notaPonderada,
  useAvaliacaoCurso,
  type NotaAvaliacao,
} from "./avaliacaoCurso";
import { codigoTopico, labelTopico, useProgramaDoCurso } from "./cursoPrograma";

type FormandoRow = { id: number; nome: string };

type Sel = { r0: number; c0: number; r1: number; c1: number };

function normSel(s: Sel): Sel {
  return {
    r0: Math.min(s.r0, s.r1),
    c0: Math.min(s.c0, s.c1),
    r1: Math.max(s.r0, s.r1),
    c1: Math.max(s.c0, s.c1),
  };
}

function inSel(s: Sel | null, r: number, c: number) {
  if (!s) return false;
  const n = normSel(s);
  return r >= n.r0 && r <= n.r1 && c >= n.c0 && c <= n.c1;
}

function parseCell(raw: string, cfgMin: number, cfgMax: number): number | null {
  const t = raw.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  const lo = Math.min(cfgMin, cfgMax);
  const hi = Math.max(cfgMin, cfgMax);
  return Math.min(hi, Math.max(lo, n));
}

export function TurmaAvaliacao({
  regime,
  turmaId,
  cursoNome,
  accent = "gold",
  formandos,
}: {
  regime: Regime;
  turmaId: number;
  cursoNome?: string;
  accent?: "gold" | "fin";
  formandos: FormandoRow[];
}) {
  const gold = accent === "gold";
  const cfg = useAvaliacaoCurso(regime, cursoNome);
  const programa = useProgramaDoCurso(regime, cursoNome);
  const moduloIds = useMemo(() => programa.topicos.map(t => t.id), [programa.topicos]);
  const [ativo, setAtivo] = useState(0);
  const [notas, setNotas] = useState<NotaAvaliacao[]>([]);
  const [sel, setSel] = useState<Sel | null>(null);
  const [dragging, setDragging] = useState<"range" | "fill" | null>(null);
  const [gravando, setGravando] = useState<"idle" | "save" | "ok" | "erro">("idle");
  const drafts = useRef<Record<string, string>>({});
  const [, setDraftTick] = useState(0);
  const mapa = useMemo(() => mapaNotas(notas), [notas]);
  const saveTimer = useRef<number | null>(null);
  const dragRef = useRef<"range" | "fill" | null>(null);
  const selRef = useRef<Sel | null>(null);
  const fillValRef = useRef<number | null>(null);
  const moduloRef = useRef(MODULO_FINAL);
  const rowsRef = useRef(formandos);
  const colsRef = useRef(cfg.parametros);
  const cfgRef = useRef(cfg);

  const ring = gold ? "focus:ring-amber-400" : "focus:ring-blue-400";
  const accentBtn = gold ? "bg-amber-500 text-white" : "bg-blue-600 text-white";
  const accentSoft = gold ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-blue-50 text-blue-800 border-blue-200";
  const selBg = gold ? "bg-amber-50" : "bg-blue-50";
  const handleBg = gold ? "bg-amber-500" : "bg-blue-600";

  const abas = useMemo(() => {
    if (cfg.momentos?.length) return cfg.momentos.map(m => ({ id: m.id, label: m.label }));
    if (cfg.modo === "final") return [{ id: MODULO_FINAL, label: "Avaliação final" }];
    return programa.topicos.map((t, i) => ({
      id: t.id,
      label: labelTopico(programa.organizacao, i, t),
    }));
  }, [cfg.modo, cfg.momentos, programa.organizacao, programa.topicos]);

  useEffect(() => {
    setAtivo(0);
  }, [cfg.modo, turmaId]);

  useEffect(() => {
    let alive = true;
    apiTurmaAvaliacao(regime, turmaId)
      .then(r => { if (alive) setNotas(r.notas); })
      .catch(() => { if (alive) setNotas([]); });
    return () => { alive = false; };
  }, [regime, turmaId]);

  const persist = useCallback((next: NotaAvaliacao[]) => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    setGravando("save");
    saveTimer.current = window.setTimeout(() => {
      apiSaveTurmaAvaliacao(regime, turmaId, next.filter(n => n.nota != null))
        .then(() => setGravando("ok"))
        .catch(() => setGravando("erro"));
    }, 500);
  }, [regime, turmaId]);
  const persistRef = useRef(persist);
  persistRef.current = persist;

  useEffect(() => () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); }, []);

  const moduloId = abas[ativo]?.id ?? MODULO_FINAL;
  const cols = cfg.parametros;
  const rows = formandos;
  moduloRef.current = moduloId;
  rowsRef.current = rows;
  colsRef.current = cols;
  cfgRef.current = cfg;
  dragRef.current = dragging;
  selRef.current = sel;

  function setNota(formandoId: number, paramId: string, valor: number | null, mid = moduloId) {
    const key = chaveNota(formandoId, mid, paramId);
    const clamped = valor == null ? null : clampNota(valor, cfg);
    setNotas(prev => {
      const rest = prev.filter(n => chaveNota(n.formandoId, n.moduloId, n.parametroId) !== key);
      const next = [...rest, { formandoId, moduloId: mid, parametroId: paramId, nota: clamped }];
      persist(next);
      return next;
    });
  }

  function applyFill(origin: number | null, range: Sel) {
    const n = normSel(range);
    const mid = moduloRef.current;
    const rs = rowsRef.current;
    const cs = colsRef.current;
    setNotas(prev => {
      const m = mapaNotas(prev);
      for (let r = n.r0; r <= n.r1; r++) {
        for (let c = n.c0; c <= n.c1; c++) {
          const f = rs[r];
          const p = cs[c];
          if (!f || !p) continue;
          const val = origin == null ? null : clampNota(origin, cfgRef.current);
          m.set(chaveNota(f.id, mid, p.id), val);
          delete drafts.current[chaveNota(f.id, mid, p.id)];
        }
      }
      const next = listaNotas(m);
      persistRef.current(next);
      setDraftTick(t => t + 1);
      return next;
    });
  }

  function originValue(range: Sel): number | null {
    const n = normSel(range);
    const f = rows[n.r0];
    const p = cols[n.c0];
    if (!f || !p) return null;
    const key = chaveNota(f.id, moduloId, p.id);
    const draft = drafts.current[key];
    if (draft != null && draft !== "") return parseCell(draft, cfg.escalaMin, cfg.escalaMax);
    const v = mapa.get(key);
    return typeof v === "number" ? v : null;
  }

  useEffect(() => {
    function up() {
      if (dragRef.current === "fill" && selRef.current) applyFill(fillValRef.current, selRef.current);
      dragRef.current = null;
      setDragging(null);
    }
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  function onCellDown(r: number, c: number, e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest("[data-fill-handle]")) return;
    if (e.shiftKey && sel) {
      const next = { ...sel, r1: r, c1: c };
      setSel(next);
      selRef.current = next;
    } else {
      const next = { r0: r, c0: c, r1: r, c1: c };
      setSel(next);
      selRef.current = next;
    }
    setDragging("range");
    dragRef.current = "range";
  }

  function onCellEnter(r: number, c: number) {
    if (!dragRef.current || !selRef.current) return;
    const next = { ...selRef.current, r1: r, c1: c };
    setSel(next);
    selRef.current = next;
  }

  const unidadeNome = programa.unidade;
  const faltaParams = cfg.parametros.length === 0;
  const faltaModulos = cfg.modo === "modulos" && !cfg.momentos?.length && moduloIds.length === 0;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 px-4 py-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-bold text-slate-800">Avaliação da turma</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {faltaParams
              ? "Defina os parâmetros na ficha do curso (separador Avaliação) para lançar notas."
              : cfg.momentos?.length
                ? "Grelha do CCP: a mesma observação na simulação inicial e na final. A nota do certificado é a média das duas."
                : cfg.modo === "modulos"
                  ? `Por ${unidadeNome.singular}: preencha todos os parâmetros de cada ${unidadeNome.singular} para cada formando. Arraste o quadrado da seleção para copiar um valor, como no Excel.`
                  : "Avaliação final: cada parâmetro uma vez por formando. Arraste o quadrado da seleção para copiar um valor, como no Excel."}
          </p>
          {!faltaParams && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${accentSoft}`}>
                Escala {cfg.escalaMin} a {cfg.escalaMax} {cfg.unidade}
              </span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-600">
                Aprovação ≥ {formatNota(cfg.minimoAprovacao, cfg.unidade)}
              </span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-600">
                {cfg.pesosEquitativos ? "Pesos equitativos" : "Pesos individuais"}
              </span>
            </div>
          )}
        </div>
        <p className="text-[11px] text-slate-400 flex-shrink-0">
          {gravando === "save" ? "A gravar…" : gravando === "ok" ? "Gravado" : gravando === "erro" ? "Não gravou" : ""}
        </p>
      </div>

      {faltaParams && (
        <p className="text-sm text-slate-500 rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center">
          Ainda não há parâmetros de avaliação neste curso.
        </p>
      )}

      {faltaModulos && !faltaParams && (
        <p className="text-sm text-slate-500 rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center">
          A avaliação é por {unidadeNome.plural}, mas o programa do curso ainda não tem {unidadeNome.plural}. Adicione-os no separador Programa da ficha.
        </p>
      )}

      {!faltaParams && !faltaModulos && formandos.length === 0 && (
        <p className="text-sm text-slate-500 rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center">
          Ainda não há formandos nesta turma.
        </p>
      )}

      {!faltaParams && !faltaModulos && formandos.length > 0 && (
        <>
          {cfg.modo === "modulos" && (
            <div className="flex gap-1 overflow-x-auto scrollbar-hide -mx-1 px-1">
              {abas.map((a, i) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => { setAtivo(i); setSel(null); }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap border ${
                    i === ativo ? `${accentBtn} border-transparent` : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {cfg.momentos?.length ? a.label : `${codigoTopico(programa.organizacao, i)} · ${programa.topicos[i]?.titulo || a.label}`}
                </button>
              ))}
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px] select-none">
                <thead>
                  <tr className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2 font-semibold sticky left-0 bg-slate-50 z-10 min-w-[180px]">Formando</th>
                    {cols.map(p => (
                      <th key={p.id} className="px-2 py-2 font-semibold text-center min-w-[108px]">
                        <span className="block normal-case text-slate-700">{p.label}</span>
                        <span className="font-medium text-slate-400">
                          {cfg.pesosEquitativos ? `1/${cols.length}` : `${p.peso}`}
                        </span>
                      </th>
                    ))}
                    <th className="px-3 py-2 font-semibold text-right min-w-[120px]">
                      {cfg.modo === "modulos" ? `Nota ${unidadeNome.singular}` : "Nota final"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((f, r) => {
                    const notaMod = notaPonderada(cfg, mapa, f.id, moduloId);
                    const ok = aprovado(notaMod, cfg.minimoAprovacao);
                    return (
                      <tr key={f.id} className="border-t border-slate-100">
                        <td className="px-3 py-1.5 font-medium text-slate-800 sticky left-0 bg-white z-10 whitespace-nowrap">
                          {f.nome}
                        </td>
                        {cols.map((p, c) => {
                          const key = chaveNota(f.id, moduloId, p.id);
                          const stored = mapa.get(key);
                          const selected = inSel(sel, r, c);
                          const nsel = sel ? normSel(sel) : null;
                          const isHandle = selected && nsel && r === nsel.r1 && c === nsel.c1;
                          const shown = drafts.current[key] ?? (stored == null ? "" : String(stored));
                          return (
                            <td
                              key={p.id}
                              className={`relative px-1 py-1 ${selected ? selBg : ""}`}
                              onMouseDown={e => onCellDown(r, c, e)}
                              onMouseEnter={() => onCellEnter(r, c)}
                            >
                              <input
                                className={`w-full px-2 py-1.5 text-center text-sm border rounded-md bg-white ${
                                  selected ? "border-slate-400" : "border-slate-200"
                                } ${ring} focus:outline-none`}
                                inputMode="decimal"
                                value={shown}
                                placeholder="-"
                                onFocus={() => setSel({ r0: r, c0: c, r1: r, c1: c })}
                                onChange={e => {
                                  drafts.current[key] = e.target.value;
                                  setDraftTick(t => t + 1);
                                }}
                                onBlur={e => {
                                  const parsed = parseCell(e.target.value, cfg.escalaMin, cfg.escalaMax);
                                  delete drafts.current[key];
                                  setNota(f.id, p.id, parsed);
                                  setDraftTick(t => t + 1);
                                }}
                                onKeyDown={e => {
                                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                }}
                              />
                              {isHandle && (
                                <button
                                  type="button"
                                  data-fill-handle
                                  aria-label="Arrastar para preencher"
                                  className={`absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-[2px] border border-white ${handleBg} cursor-crosshair z-20`}
                                  onMouseDown={e => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    fillValRef.current = originValue(sel ?? { r0: r, c0: c, r1: r, c1: c });
                                    setDragging("fill");
                                    dragRef.current = "fill";
                                  }}
                                />
                              )}
                            </td>
                          );
                        })}
                        <td className="px-3 py-1.5 text-right">
                          <span className={`text-sm font-semibold ${ok === true ? "text-emerald-700" : ok === false ? "text-red-600" : "text-slate-400"}`}>
                            {formatNota(notaMod, cfg.unidade)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="px-4 py-2 text-[11px] text-slate-400 border-t border-slate-100">
              Clique numa célula, arraste para selecionar um retângulo e puxe o quadrado no canto para copiar o valor. Depois pode corrigir célula a célula.
            </p>
          </div>

          {cfg.modo === "modulos" && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-800">Pauta final</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  A nota de cada {unidadeNome.singular} é a soma ponderada dos parâmetros. A nota final é a média das notas dos {unidadeNome.plural}.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2 font-semibold">Formando</th>
                      {programa.topicos.map((t, i) => (
                        <th key={t.id} className="px-3 py-2 font-semibold text-right">{codigoTopico(programa.organizacao, i)}</th>
                      ))}
                      <th className="px-3 py-2 font-semibold text-right">Final</th>
                      <th className="px-3 py-2 font-semibold">Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(f => {
                      const final = notaFinalFormando(cfg, mapa, f.id, moduloIds);
                      const ok = aprovado(final, cfg.minimoAprovacao);
                      return (
                        <tr key={f.id} className="border-t border-slate-100">
                          <td className="px-3 py-2 font-medium text-slate-800">{f.nome}</td>
                          {moduloIds.map(id => (
                            <td key={id} className="px-3 py-2 text-right text-slate-600">
                              {formatNota(notaPonderada(cfg, mapa, f.id, id), cfg.unidade)}
                            </td>
                          ))}
                          <td className="px-3 py-2 text-right font-semibold text-slate-800">{formatNota(final, cfg.unidade)}</td>
                          <td className="px-3 py-2">
                            {ok == null ? <span className="text-xs text-slate-400">Incompleto</span>
                              : ok ? <span className="text-xs font-semibold text-emerald-700">Aprovado</span>
                                : <span className="text-xs font-semibold text-red-600">Não aprovado</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {cfg.modo === "final" && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
              Resultado: {rows.filter(f => aprovado(notaFinalFormando(cfg, mapa, f.id, moduloIds), cfg.minimoAprovacao) === true).length} aprovados ·{" "}
              {rows.filter(f => aprovado(notaFinalFormando(cfg, mapa, f.id, moduloIds), cfg.minimoAprovacao) === false).length} não aprovados ·{" "}
              {rows.filter(f => aprovado(notaFinalFormando(cfg, mapa, f.id, moduloIds), cfg.minimoAprovacao) == null).length} incompletos
              (faltam parâmetros).
            </div>
          )}
        </>
      )}
    </div>
  );
}
