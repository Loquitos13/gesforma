import { useMemo, useState } from "react";
import { useAuth } from "./AuthGate";
import { campanhaNums, euro, roiLabel } from "./campanhaStats";
import { AppModal, SearchSelect, optsFromCursos } from "./FormKit";
import { useLists, type CampanhaRow } from "./ListsContext";
import { EmptyHint } from "./SecretaryUX";

const iCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent";

const canais = ["Website", "Facebook", "Instagram", "Google", "Email", "WhatsApp", "Referência", "Parceiro"];

function nextListId(rows: { id: number }[]) {
  return (rows.reduce((m, r) => Math.max(m, r.id), 0) || 0) + 1;
}

export function CampanhasView() {
  const { user } = useAuth();
  const {
    campanhas, addCampanha, patchCampanha, removeCampanha,
    preinscricoes, formandosTurmas, pagamentos, cursosGold, cursosFin,
  } = useLists();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CampanhaRow | null>(null);
  const [nome, setNome] = useState("");
  const [curso, setCurso] = useState("");
  const [data, setData] = useState("");
  const [fim, setFim] = useState("");
  const [custo, setCusto] = useState("");
  const [encarregado, setEncarregado] = useState("");
  const [canal, setCanal] = useState("");
  const [notas, setNotas] = useState("");

  const cursosOpts = useMemo(() => {
    const gold = optsFromCursos(cursosGold);
    const fin = optsFromCursos(cursosFin.map(c => ({ nome: c.nomeComercial || c.ufcd, horas: c.horas, regime: c.regime })));
    const seen = new Set<string>();
    return [...gold, ...fin].filter(o => {
      if (seen.has(o.value)) return false;
      seen.add(o.value);
      return true;
    });
  }, [cursosFin, cursosGold]);

  const draft = useMemo(() => ({
    id: editing?.id ?? 0,
    nome: nome.trim() || "Campanha",
    data,
    encarregado,
    custo: Number(custo.replace(",", ".")) || 0,
    curso,
    fim,
    canal,
    notas,
  }), [canal, custo, curso, data, editing?.id, encarregado, fim, nome, notas]);

  const preview = useMemo(
    () => campanhaNums(draft, preinscricoes, formandosTurmas, pagamentos),
    [draft, formandosTurmas, pagamentos, preinscricoes],
  );

  function abrirNova() {
    setEditing(null);
    setNome("");
    setCurso("");
    setData(new Date().toISOString().slice(0, 10));
    setFim("");
    setCusto("");
    setEncarregado(user?.name ?? "");
    setCanal("");
    setNotas("");
    setOpen(true);
  }

  function abrirEditar(c: CampanhaRow) {
    setEditing(c);
    setNome(c.nome);
    setCurso(c.curso ?? "");
    setData(c.data);
    setFim(c.fim ?? "");
    setCusto(c.custo ? String(c.custo) : "");
    setEncarregado(c.encarregado);
    setCanal(c.canal ?? "");
    setNotas(c.notas ?? "");
    setOpen(true);
  }

  function guardar() {
    if (!nome.trim()) return;
    const row: CampanhaRow = {
      id: editing?.id ?? nextListId(campanhas),
      nome: nome.trim(),
      data: data || new Date().toISOString().slice(0, 10),
      encarregado: encarregado.trim() || user?.name || "",
      curso,
      preinscricoes: 0,
      pagos: 0,
      receita: 0,
      custo: Number(custo.replace(",", ".")) || 0,
      fim: fim || "",
      canal,
      notas: notas.trim(),
    };
    if (editing) patchCampanha(editing.id, row);
    else addCampanha(row);
    setOpen(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-1">
        <div>
          <h1 className="text-xl font-bold text-slate-800 leading-tight">Campanhas</h1>
          <p className="text-sm text-slate-500 mt-0.5">Inscrições, conversão e receita saem das pré-inscrições e dos pagamentos. O custo e o canal são da campanha.</p>
        </div>
        <button type="button" onClick={abrirNova} className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg shadow-sm whitespace-nowrap">
          Nova campanha
        </button>
      </div>
      {campanhas.length === 0 && (
        <EmptyHint text="Ainda sem campanhas. Crie uma, associe o curso e veja os números à medida que entram as pré-inscrições." />
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {campanhas.map(c => {
          const n = campanhaNums(c, preinscricoes, formandosTurmas, pagamentos);
          return (
            <div key={c.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-3 mb-3">
                <button type="button" className="text-left min-w-0" onClick={() => abrirEditar(c)}>
                  <p className="font-semibold text-slate-800">{c.nome || <span className="italic text-slate-400">sem nome</span>}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {c.data}{c.fim ? ` → ${c.fim}` : ""} · {c.encarregado || "sem responsável"}
                    {c.curso ? ` · ${c.curso}` : ""}
                    {c.canal ? ` · ${c.canal}` : ""}
                  </p>
                </button>
                <button type="button" onClick={() => removeCampanha(c.id)} className="text-xs font-semibold text-red-500 hover:text-red-700 whitespace-nowrap">Eliminar</button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { l: "Inscrições", v: n.preinscricoes.toLocaleString("pt-PT"), c: "text-blue-600" },
                  { l: "Pagamentos", v: n.pagos.toLocaleString("pt-PT"), c: "text-teal-600" },
                  { l: "Receita", v: euro(n.receita), c: "text-emerald-600" },
                  { l: "ROI", v: roiLabel(n.receita, c.custo), c: "text-amber-600" },
                  { l: "Conversão", v: n.preinscricoes ? `${n.conversaoPct}%` : "-", c: "text-violet-600" },
                  { l: "Ticket médio", v: n.pagos ? euro(n.ticketMedio) : "-", c: "text-slate-700" },
                  { l: "Por contactar", v: String(n.naoContactados), c: n.naoContactados ? "text-amber-600" : "text-slate-400" },
                  { l: "Desistiram", v: String(n.desistiram), c: n.desistiram ? "text-red-500" : "text-slate-400" },
                ].map(s => (
                  <div key={s.l} className="bg-slate-50 rounded-xl p-2.5">
                    <p className="text-xs text-slate-400">{s.l}</p>
                    <p className={`text-sm font-bold ${s.c} mt-0.5`}>{s.v}</p>
                  </div>
                ))}
              </div>
              {n.origens.length > 0 && (
                <p className="text-[11px] text-slate-500 mt-3">
                  Origens: {n.origens.map(o => `${o.origem} (${o.n})`).join(" · ")}
                </p>
              )}
              {c.custo > 0 && (
                <p className="text-[11px] text-slate-400 mt-1">Custo anunciado {euro(c.custo)} · receita estimada das leads {euro(n.receitaEstimada)}</p>
              )}
            </div>
          );
        })}
      </div>

      <AppModal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Editar campanha" : "Nova campanha"}
        sub="Os números abaixo actualizam-se já com as pré-inscrições que batem no nome ou no curso."
        size="lg"
      >
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Nome</label>
              <input className={iCls} value={nome} onChange={e => setNome(e.target.value)} placeholder="Outubro 2026 · CCP" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Curso em destaque</label>
              <SearchSelect value={curso} onChange={setCurso} options={cursosOpts} placeholder="Pesquisar curso…" allowEmpty />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Início</label>
              <input type="date" className={iCls} value={data} onChange={e => setData(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Fim (opcional)</label>
              <input type="date" className={iCls} value={fim} onChange={e => setFim(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Custo da campanha (€)</label>
              <input className={iCls} inputMode="decimal" value={custo} onChange={e => setCusto(e.target.value)} placeholder="0" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Canal principal</label>
              <SearchSelect value={canal} onChange={setCanal} options={canais.map(value => ({ value }))} placeholder="De onde vem o tráfego…" allowEmpty />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Responsável</label>
              <input className={iCls} value={encarregado} onChange={e => setEncarregado(e.target.value)} placeholder="Quem gere a campanha" />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Notas internas</label>
              <textarea className={`${iCls} min-h-[72px] resize-y`} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Público, criativo, orçamento diário…" />
            </div>
          </div>

          <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-3">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-2">Pré-visualização com dados reais</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { l: "Leads", v: String(preview.preinscricoes) },
                { l: "Pagos", v: String(preview.pagos) },
                { l: "Conversão", v: preview.preinscricoes ? `${preview.conversaoPct}%` : "-" },
                { l: "Receita", v: euro(preview.receita) },
                { l: "Ticket", v: preview.pagos ? euro(preview.ticketMedio) : "-" },
                { l: "Por contactar", v: String(preview.naoContactados) },
                { l: "Formandos", v: String(preview.formandos) },
                { l: "ROI", v: roiLabel(preview.receita, draft.custo) },
              ].map(s => (
                <div key={s.l} className="bg-white rounded-lg p-2 border border-amber-100">
                  <p className="text-[11px] text-slate-400">{s.l}</p>
                  <p className="text-sm font-bold text-slate-800">{s.v}</p>
                </div>
              ))}
            </div>
            {preview.origens.length > 0 && (
              <p className="text-[11px] text-slate-600 mt-2">Origens: {preview.origens.map(o => `${o.origem} (${o.n})`).join(" · ")}</p>
            )}
            {!preview.preinscricoes && (
              <p className="text-[11px] text-slate-500 mt-2">Ainda não há leads com este nome de campanha ou curso. Os números aparecem quando o CRM e a pré-inscrição pública usarem o mesmo nome.</p>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)} className="flex-1 py-2 border border-slate-200 text-sm text-slate-600 rounded-lg hover:bg-slate-50">Cancelar</button>
            <button type="button" onClick={guardar} disabled={!nome.trim()} className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white text-sm font-semibold rounded-lg">
              {editing ? "Guardar alterações" : "Criar campanha"}
            </button>
          </div>
        </div>
      </AppModal>
    </div>
  );
}
