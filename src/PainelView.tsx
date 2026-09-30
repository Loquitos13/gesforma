import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiDashboard, type Dashboard } from "./api";
import { SearchSelect } from "./FormKit";

type MesReceita = Dashboard["financeiro"]["receitaMensal"][number];
type CursoMes = MesReceita["cursos"][number];

const CORES_MES = ["#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#E11D48", "#0EA5E9", "#F97316", "#14B8A6", "#A855F7", "#84CC16", "#EC4899", "#64748B", "#CA8A04", "#059669", "#4F46E5", "#DB2777", "#0891B2", "#65A30D"];

function eur(v: number) {
  return `\u20ac ${v.toLocaleString("pt-PT")}`;
}

function Card({ children, className = "", clip = true }: { children: React.ReactNode; className?: string; clip?: boolean }) {
  return <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${clip ? "overflow-hidden" : "overflow-visible"} ${className}`}>{children}</div>;
}

function polar(cx: number, cy: number, r: number, a: number) {
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
}

function anel(cx: number, cy: number, r: number, r0: number, a0: number, a1: number) {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  const [ix1, iy1] = polar(cx, cy, r0, a1);
  const [ix0, iy0] = polar(cx, cy, r0, a0);
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} L ${ix1} ${iy1} A ${r0} ${r0} 0 ${large} 0 ${ix0} ${iy0} Z`;
}

function evolucao(atual: number, anterior: number) {
  if (anterior <= 0) return null;
  const pct = Math.round(((atual - anterior) / anterior) * 100);
  if (pct > 0) return { texto: `+${pct}%`, tom: "bg-emerald-50 text-emerald-700" };
  if (pct < 0) return { texto: `${pct}%`, tom: "bg-red-50 text-red-700" };
  return { texto: "0%", tom: "bg-slate-100 text-slate-600" };
}

function fraseEvolucao(texto: string | null, rotulo: string, atual: number) {
  if (!texto) return atual > 0 ? `Não havia receita em ${rotulo}.` : `Igual a ${rotulo}.`;
  if (texto === "0%") return `Igual a ${rotulo}.`;
  const valor = texto.replace(/^[+-]/, "");
  return texto.startsWith("-") ? `${valor} abaixo de ${rotulo}.` : `${valor} acima de ${rotulo}.`;
}

function cursoDe(lista: CursoMes[], nome: string) {
  return lista.find(c => c.nome === nome) ?? { nome, n: 0, receita: 0 };
}

function ReceitaCircular({ meses }: { meses: MesReceita[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [comparar, setComparar] = useState<"mes" | "ano">("mes");
  const sair = useRef<number | null>(null);
  const suprimir = useRef(false);
  const comValor = meses.filter(m => m.v > 0);
  const total = comValor.reduce((s, m) => s + m.v, 0);
  const abertoId = pinned ?? hover;
  const aberto = comValor.find(m => m.chave === abertoId) ?? null;
  const fixo = pinned != null && aberto?.chave === pinned;

  function entrar(chave: string) {
    if (suprimir.current) return;
    if (sair.current) window.clearTimeout(sair.current);
    if (!pinned) setHover(chave);
  }
  function deixar() {
    suprimir.current = false;
    if (pinned) return;
    if (sair.current) window.clearTimeout(sair.current);
    sair.current = window.setTimeout(() => setHover(null), 180);
  }
  function fechar() {
    suprimir.current = true;
    setPinned(null);
    setHover(null);
  }
  function fixar(chave: string) {
    suprimir.current = false;
    setPinned(chave);
  }
  function escolherComparacao(modo: "mes" | "ano") {
    setComparar(modo);
    if (aberto) fixar(aberto.chave);
  }

  const cx = 100;
  const cy = 100;
  const r = 84;
  const r0 = 54;
  let ang = -Math.PI / 2;
  const folga = comValor.length > 1 ? 0.035 : 0;
  const fatias = comValor.map((m, i) => {
    const bruto0 = ang;
    const frac = total > 0 ? m.v / total : 0;
    const bruto1 = bruto0 + frac * Math.PI * 2;
    ang = bruto1;
    const a0 = bruto0 + folga;
    const a1 = Math.max(a0 + 0.02, bruto1 - folga);
    return { ...m, a0, a1, meio: (bruto0 + bruto1) / 2, color: CORES_MES[i % CORES_MES.length]!, cheia: frac >= 0.999 };
  });
  const activa = fatias.find(s => s.chave === aberto?.chave);
  const periodo = aberto
    ? (comparar === "ano" ? aberto.comparar.anoPassado : aberto.comparar.mesPassado)
    : null;
  const top = (aberto?.cursos ?? []).slice(0, 5);
  const maxCurso = Math.max(...top.map(c => c.receita), 1);
  const parte = aberto && total > 0 ? Math.round((aberto.v / total) * 100) : 0;
  const caret = activa ? Math.min(78, Math.max(18, ((Math.sin(activa.meio) + 1) / 2) * 100)) : 28;
  const totalEvo = aberto && periodo ? evolucao(aberto.v, periodo.v) : null;

  return (
    <div className="relative">
      <div className="shrink-0 max-w-xs">
        {fatias.length === 0 ? (
          <p className="text-sm text-slate-400 py-10">Sem receita confirmada neste filtro.</p>
        ) : (
          <svg viewBox="0 0 200 200" className="w-56 h-56" role="img" aria-label="Receita por mês">
            {fatias.map(s => {
              const ligado = aberto?.chave === s.chave;
              const [dx, dy] = polar(0, 0, ligado ? 6 : 0, s.meio);
              const comum = {
                className: "cursor-pointer",
                opacity: aberto && !ligado ? 0.38 : 1,
                style: { transition: "opacity 160ms ease" },
                onMouseEnter: () => entrar(s.chave),
                onMouseLeave: deixar,
                onClick: () => fixar(s.chave),
              };
              return s.cheia ? (
                <circle key={s.chave} cx={cx + dx} cy={cy + dy} r={(r + r0) / 2} fill="none" stroke={s.color} strokeWidth={r - r0} {...comum}>
                  <title>{s.mes} {s.ano} · {eur(s.v)}</title>
                </circle>
              ) : (
                <path key={s.chave} d={anel(cx + dx, cy + dy, r, r0, s.a0, s.a1)} fill={s.color} {...comum}>
                  <title>{s.mes} {s.ano} · {eur(s.v)}</title>
                </path>
              );
            })}
            <text x={cx} y={cy - 2} textAnchor="middle" className="fill-slate-900 pointer-events-none" style={{ fontSize: 15, fontWeight: 650 }}>
              {aberto ? aberto.mes : "Total"}
            </text>
            <text x={cx} y={cy + 16} textAnchor="middle" className="fill-slate-500 pointer-events-none" style={{ fontSize: 11 }}>
              {eur(aberto ? aberto.v : total)}
            </text>
          </svg>
        )}
        {fatias.length > 0 && (
          <ul className="mt-1 space-y-0.5">
            {fatias.map(s => (
              <li key={s.chave}>
                <button
                  type="button"
                  className={`w-full flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left ${aberto?.chave === s.chave ? "bg-slate-50" : "hover:bg-slate-50"}`}
                  onMouseEnter={() => entrar(s.chave)}
                  onMouseLeave={deixar}
                  onClick={() => fixar(s.chave)}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="text-xs text-slate-700">{s.mes} {s.ano}</span>
                  </span>
                  <span className="text-xs font-semibold text-slate-800">{eur(s.v)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {aberto && periodo && activa && (
        <div
          className="absolute z-40 top-0 left-60 w-80 max-w-[min(20rem,calc(100vw-18rem))]"
          onMouseEnter={() => entrar(aberto.chave)}
          onMouseLeave={deixar}
        >
          <span
            className="hidden xl:block absolute -left-1.5 w-3 h-3 rotate-45 border-l border-b border-slate-200 bg-white"
            style={{ top: `${caret}%` }}
          />
          <div
            className="rounded-2xl border border-slate-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.14)] overflow-hidden"
            style={{ borderLeftWidth: 4, borderLeftColor: activa.color }}
          >
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-slate-500">{aberto.mes} {aberto.ano}</p>
                  <p className="text-[28px] leading-none font-bold text-slate-900 mt-1">{eur(aberto.v)}</p>
                </div>
                {fixo && (
                  <button type="button" aria-label="Fechar" onClick={fechar}
                    className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center">
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                      <path strokeLinecap="round" d="M5 5l10 10M15 5L5 15" />
                    </svg>
                  </button>
                )}
              </div>
              <span className="inline-flex mt-2 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800">
                {parte}% do período
              </span>
            </div>
            <div className="px-4 pb-3">
              <p className="text-[11px] font-semibold text-slate-500 mb-2">Mais vendidos</p>
              {top.length === 0 && <p className="text-xs text-slate-400">Sem cursos com receita neste mês.</p>}
              <ul className="space-y-2.5">
                {top.map((c, i) => (
                  <li key={c.nome} className="flex items-start gap-2.5">
                    <span className="mt-0.5 w-[22px] h-[22px] rounded-full text-[11px] font-semibold flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${activa.color}22`, color: activa.color }}>{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-xs font-medium text-slate-700 truncate" title={c.nome}>{c.nome}</p>
                        <p className="text-xs font-semibold text-slate-900 shrink-0">{eur(c.receita)}</p>
                      </div>
                      <div className="mt-1 h-1 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-1 rounded-full" style={{ width: `${Math.max(8, (c.receita / maxCurso) * 100)}%`, backgroundColor: activa.color }} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="px-4 pb-4 pt-3 border-t border-slate-100">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <p className="text-[11px] font-semibold text-slate-500">Comparar com</p>
                <div className="inline-flex rounded-[10px] bg-slate-100 p-0.5">
                  {([
                    ["mes", "Mês passado"],
                    ["ano", "Ano passado"],
                  ] as const).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => escolherComparacao(id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${comparar === id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {aberto && (
                <div className="rounded-xl bg-slate-50 px-3 py-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Este mês</p>
                      <p className="text-sm font-bold text-slate-900 mt-1">{eur(aberto.v)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 truncate" title={periodo.rotulo}>{periodo.rotulo}</p>
                      <p className="text-sm font-bold text-slate-900 mt-1">{eur(periodo.v)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Evolução</p>
                      {totalEvo
                        ? <p className={`inline-flex mt-1 px-1.5 py-0.5 rounded-full text-xs font-bold ${totalEvo.tom}`}>{totalEvo.texto}</p>
                        : <p className="text-sm font-bold text-slate-400 mt-1">—</p>}
                    </div>
                  </div>
                    <p className="text-[11px] text-slate-500 mt-2">{fraseEvolucao(totalEvo?.texto ?? null, periodo.rotulo, aberto.v)}</p>
                </div>
              )}
              <p className="text-[11px] font-semibold text-slate-500 mt-3 mb-2">Por curso</p>
              {top.length === 0 && <p className="text-xs text-slate-400">Sem cursos com receita neste mês.</p>}
              <ul className="space-y-2.5">
                {top.map(c => {
                  const outro = cursoDe(periodo.cursos, c.nome);
                  const evo = evolucao(c.receita, outro.receita);
                  return (
                    <li key={c.nome}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 text-xs font-medium text-slate-700 truncate" title={c.nome}>{c.nome}</p>
                        {evo
                          ? <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[11px] font-semibold ${evo.tom}`}>{evo.texto}</span>
                          : <span className="shrink-0 text-[11px] text-slate-400">—</span>}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {eur(c.receita)} este mês · {eur(outro.receita)} em {periodo.rotulo}
                      </p>
                    </li>
                  );
                })}
              </ul>
              <p className="text-[11px] text-slate-400 mt-3">
                {fixo
                  ? `${top.reduce((s, c) => s + c.n, 0)} vendas neste mês. Fecha no X ou noutra fatia.`
                  : "Clique na fatia para fixar e mudar a comparação."}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function Donut({
  slices,
  center,
  inner,
}: {
  slices: { id: string; label: string; pct: number; color: string; valor?: string }[];
  center: { title: string; sub: string };
  inner?: { id: string; label: string; pct: number; color: string }[];
}) {
  const [hover, setHover] = useState<string | null>(null);
  const r = 56;
  const c = 2 * Math.PI * r;
  let acc = 0;
  const segs = slices.map(d => {
    const len = (d.pct / 100) * c;
    const offset = c * 0.25 - acc;
    acc += len;
    return { ...d, len, offset };
  });
  const active = slices.find(d => d.id === hover);
  const r2 = 36;
  const c2 = 2 * Math.PI * r2;
  let acc2 = 0;
  const innerSegs = (inner ?? []).map(d => {
    const len = (d.pct / 100) * c2;
    const offset = c2 * 0.25 - acc2;
    acc2 += len;
    return { ...d, len, offset };
  });

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <svg viewBox="0 0 140 140" className="w-40 h-40 shrink-0">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#F1F5F9" strokeWidth="14" />
        {segs.map(s => (
          <circle
            key={s.id}
            cx="70" cy="70" r={r} fill="none"
            stroke={s.color}
            strokeWidth={hover === s.id ? 18 : 14}
            strokeDasharray={`${s.len} ${c - s.len}`}
            strokeDashoffset={s.offset}
            className="cursor-pointer"
            onMouseEnter={() => setHover(s.id)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
        {innerSegs.map(s => (
          <circle
            key={`i-${s.id}`}
            cx="70" cy="70" r={r2} fill="none"
            stroke={s.color}
            strokeWidth="8"
            strokeDasharray={`${s.len} ${c2 - s.len}`}
            strokeDashoffset={s.offset}
            opacity={0.95}
          />
        ))}
        <text x="70" y="66" textAnchor="middle" className="fill-slate-800" style={{ fontSize: 11, fontWeight: 700 }}>
          {active?.label ?? center.title}
        </text>
        <text x="70" y="82" textAnchor="middle" className="fill-slate-500" style={{ fontSize: 10 }}>
          {active?.valor ?? center.sub}
        </text>
      </svg>
      <div className="flex-1 w-full space-y-1.5">
        {slices.map(s => (
          <button
            key={s.id}
            type="button"
            className="w-full flex items-center justify-between gap-2 text-left"
            onMouseEnter={() => setHover(s.id)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-xs text-slate-700 truncate">{s.label}</span>
            </span>
            <span className="text-xs font-semibold text-slate-600 shrink-0">{s.pct}%</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ConhecimentoEnaCard({ onVerMais, dados }: { onVerMais: () => void; dados: Dashboard["conhecimento"] }) {
  if (!dados.length) {
    return (
      <Card className="p-4">
        <p className="text-sm font-semibold text-slate-700">Como conheceram a ENA</p>
        <p className="text-xs text-slate-400 mt-1">Ainda sem respostas à pergunta de origem nas pré-inscrições.</p>
      </Card>
    );
  }
  const total = dados.reduce((s, d) => s + d.n, 0);
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-sm font-semibold text-slate-700">Como conheceram a ENA</p>
          <p className="text-xs text-slate-400">{total.toLocaleString("pt-PT")} pré-inscrições no filtro</p>
        </div>
        <button type="button" onClick={onVerMais} className="text-xs font-semibold text-amber-600">Ver CRM →</button>
      </div>
      <Donut
        slices={dados.map(d => ({ id: d.id, label: d.curto, pct: d.pct, color: d.color, valor: `${d.n}` }))}
        center={{ title: "Origem", sub: `${total}` }}
      />
    </Card>
  );
}

const ic = {
  clipboard: <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5z" clipRule="evenodd"/></svg>,
  users: <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>,
  school: <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3z"/></svg>,
  book: <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"/></svg>,
};

export function PainelView({ regime, onNavigate }: { regime: "gold" | "fin"; onNavigate: (v: string) => void }) {
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [estado, setEstado] = useState<"loading" | "ready" | "offline">("loading");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [curso, setCurso] = useState("");
  const [local, setLocal] = useState("");
  const [horario, setHorario] = useState("");
  const [audiencia, setAudiencia] = useState<"todos" | "pre" | "formandos">("todos");
  const [desagregar, setDesagregar] = useState<"curso" | "local" | "horario">("curso");
  const crmView = regime === "fin" ? "fin-preinscricoes" : "gold-preinscricoes";
  const formandosView = regime === "fin" ? "fin-formandos" : "gold-formandos-turmas";
  const turmasView = regime === "fin" ? "fin-turmas" : "gold-turmas";
  const cursosView = regime === "fin" ? "fin-cursos" : "gold-cursos";

  const query = useMemo(() => ({
    regime,
    de: de || undefined,
    ate: ate || undefined,
    curso: curso || undefined,
    local: local || undefined,
    horario: horario || undefined,
    audiencia: audiencia === "todos" ? undefined : audiencia,
    desagregar,
  }), [regime, de, ate, curso, local, horario, audiencia, desagregar]);

  const carregar = useCallback(() => {
    setEstado("loading");
    apiDashboard(query)
      .then(r => { setDash(r); setEstado("ready"); })
      .catch(() => setEstado("offline"));
  }, [query]);
  useEffect(() => { carregar(); }, [carregar]);

  if (estado === "offline" && !dash) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm font-semibold text-slate-800">Sem ligação à API</p>
        <p className="text-sm text-slate-500 mt-1">O painel mostra dados reais da base, por isso não inventa números quando a API não responde.</p>
        <button type="button" onClick={carregar} className="mt-4 px-4 py-2 text-sm font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 text-white">
          Tentar outra vez
        </button>
      </Card>
    );
  }

  const cards = dash?.cards;
  const financeiro = dash?.financeiro;
  const funil = dash?.funil ?? [];
  const topCursos = dash?.topCursos ?? [];
  const base = funil[0]?.v || 1;
  const opts = dash?.filtros ?? { cursos: [], locais: [], horarios: [] };

  return (
    <div className="space-y-5">
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-semibold text-slate-500 uppercase">De
            <input type="date" className="mt-1 block px-3 py-2 text-sm border border-slate-200 rounded-lg" value={de} onChange={e => setDe(e.target.value)} />
          </label>
          <label className="text-xs font-semibold text-slate-500 uppercase">Até
            <input type="date" className="mt-1 block px-3 py-2 text-sm border border-slate-200 rounded-lg" value={ate} onChange={e => setAte(e.target.value)} />
          </label>
          <div className="min-w-[160px] flex-1">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Curso</p>
            <SearchSelect value={curso} onChange={setCurso} options={opts.cursos.map(value => ({ value }))} allowEmpty placeholder="Todos os cursos" />
          </div>
          <div className="min-w-[140px] flex-1">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Local</p>
            <SearchSelect value={local} onChange={setLocal} options={opts.locais.map(value => ({ value }))} allowEmpty placeholder="Todos os locais" />
          </div>
          <div className="min-w-[140px] flex-1">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Horário</p>
            <SearchSelect value={horario} onChange={setHorario} options={opts.horarios.map(value => ({ value }))} allowEmpty placeholder="Todos os horários" />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden bg-white">
            {([["todos", "Todos"], ["pre", "Pré-inscritos"], ["formandos", "Formandos"]] as const).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setAudiencia(id)}
                className={`px-3 py-1.5 text-xs font-semibold ${audiencia === id ? "bg-amber-500 text-white" : "text-slate-500 hover:bg-slate-50"}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden bg-white">
            {([["curso", "Por curso"], ["local", "Por local"], ["horario", "Por horário"]] as const).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setDesagregar(id)}
                className={`px-3 py-1.5 text-xs font-semibold ${desagregar === id ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-50"}`}>
                {label}
              </button>
            ))}
          </div>
          {(de || ate || curso || local || horario || audiencia !== "todos") && (
            <button type="button" className="text-xs font-semibold text-slate-500" onClick={() => {
              setDe(""); setAte(""); setCurso(""); setLocal(""); setHorario(""); setAudiencia("todos");
            }}>Limpar filtros</button>
          )}
        </div>
        <p className="text-[11px] text-slate-400">Formandos = inscritos em turma. Receita, funil e ranking seguem o mesmo filtro.</p>
      </Card>

      {estado === "loading" && !cards && (
        <Card className="p-8"><p className="text-center text-sm text-slate-400">A calcular os números {regime === "fin" ? "da Financiada" : "do Gold"}…</p></Card>
      )}

      {cards && financeiro && (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            {[
              { label: "Pré-inscritos", value: cards.preinscritos.toLocaleString("pt-PT"), sub: `${funil[1]?.v ?? 0} já contactados`, color: "text-blue-600", bg: "bg-blue-50", icon: ic.clipboard, view: crmView },
              { label: "Formandos", value: cards.formandosAtivos.toLocaleString("pt-PT"), sub: regime === "fin" ? "Formação financiada" : "Gold", color: "text-emerald-600", bg: "bg-emerald-50", icon: ic.users, view: formandosView },
              { label: "Turmas ativas", value: String(cards.turmasAtivas), sub: `${cards.turmasTotal} no total`, color: "text-violet-600", bg: "bg-violet-50", icon: ic.school, view: turmasView },
              { label: "Cursos ativos", value: String(cards.cursosAtivos), sub: regime === "fin" ? "UFCD e cursos financiados" : "Cursos Gold", color: "text-amber-600", bg: "bg-amber-50", icon: ic.book, view: cursosView },
            ].map(s => (
              <Card key={s.label} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{s.label}</p>
                  <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center ${s.color}`}>{s.icon}</div>
                </div>
                <p className={`text-2xl font-bold ${s.color} leading-none`}>{s.value}</p>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-slate-400">{s.sub}</p>
                  <button type="button" onClick={() => onNavigate(s.view)} className="text-xs font-semibold text-slate-400 hover:text-amber-600">Ver →</button>
                </div>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            {[
              { label: "Receita confirmada", value: eur(financeiro.receitaTotal), sub: `${financeiro.pagos} pagamentos pagos`, c: "text-slate-800" },
              {
                label: "Receita este mês",
                value: eur(financeiro.receitaMes),
                sub: financeiro.variacaoMes == null ? "Sem mês anterior para comparar" : `${financeiro.variacaoMes >= 0 ? "+" : ""}${financeiro.variacaoMes}% vs mês anterior`,
                c: "text-emerald-600",
              },
              { label: "Ticket médio", value: eur(financeiro.ticketMedio), sub: "Por pagamento confirmado", c: "text-blue-600" },
              { label: "Pagamentos pendentes", value: eur(financeiro.pendentes.valor), sub: `${financeiro.pendentes.n} transações`, c: "text-amber-600" },
            ].map(s => (
              <Card key={s.label} className="p-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{s.label}</p>
                <p className={`text-xl font-bold ${s.c}`}>{s.value}</p>
                <p className="text-xs text-slate-400 mt-1">{s.sub}</p>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card clip={false} className="p-4 lg:col-span-2 relative z-20">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-slate-700">Receita por mês</p>
                  <p className="text-xs text-slate-400">Cada fatia é um mês do filtro. Passe o rato para o detalhe e clique para fixar a comparação.</p>
                </div>
                <span className="text-sm font-bold text-emerald-600">{eur(financeiro.receita12m)}</span>
              </div>
              <ReceitaCircular meses={financeiro.receitaMensal} />
            </Card>
            <Card className="p-4">
              <p className="text-sm font-semibold text-slate-700 mb-3">Funil de conversão</p>
              <div className="space-y-2">
                {funil.map((f, i) => {
                  const pct = Math.min(100, Math.round((f.v / base) * 100));
                  const cores = ["#94A3B8", "#60A5FA", "#F59E0B", "#10B981"];
                  return (
                    <div key={f.l}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-slate-600">{f.l}</span>
                        <span className="font-semibold text-slate-700">{f.v.toLocaleString("pt-PT")}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: cores[i] ?? "#94A3B8" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
          <ConhecimentoEnaCard onVerMais={() => onNavigate(crmView)} dados={dash.conhecimento} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-4">
              <p className="text-sm font-semibold text-slate-700 mb-3">Desagregação · {desagregar === "horario" ? "horário" : desagregar}</p>
              {(dash.desagregacao ?? []).length === 0 && <p className="text-xs text-slate-400">Sem dados neste filtro.</p>}
              <div className="space-y-2">
                {(dash.desagregacao ?? []).map(d => (
                  <div key={d.chave}>
                    <div className="flex justify-between text-xs mb-0.5 gap-2">
                      <span className="text-slate-700 truncate">{d.chave}</span>
                      <span className="font-semibold text-slate-800 shrink-0">{d.n} · {eur(d.receita)}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-amber-400" style={{ width: `${d.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="p-4">
              <p className="text-sm font-semibold text-slate-700 mb-3">Ranking · receita por curso</p>
              {topCursos.length === 0 && <p className="text-xs text-slate-400">Sem receita por curso para mostrar.</p>}
              <div className="space-y-2.5">
                {topCursos.map((c, i) => (
                  <div key={c.nome} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-400 w-4">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700 truncate">{c.nome}</p>
                      <p className="text-xs text-slate-400">{c.inscritos.toLocaleString("pt-PT")} pessoas · {eur(c.receita)}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-bold text-emerald-600">{c.taxa == null ? "-" : `${c.taxa}%`}</p>
                      <p className="text-xs text-slate-400">conversão</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-4 lg:col-span-2">
              <p className="text-sm font-semibold text-slate-700 mb-3">Métodos de pagamento</p>
              {financeiro.metodosPagamento.length === 0 && (
                <p className="text-xs text-slate-400">Ainda sem pagamentos confirmados neste filtro.</p>
              )}
              <div className="space-y-3">
                {financeiro.metodosPagamento.map(m => (
                  <div key={m.metodo}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-700">{m.metodo}</span>
                      <div className="flex gap-2">
                        <span className="text-xs text-slate-500">{eur(m.valor)}</span>
                        <span className="text-xs font-bold text-slate-700 w-8 text-right">{m.pct}%</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2"><div className="h-2 rounded-full" style={{ width: `${m.pct}%`, backgroundColor: m.color }} /></div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
