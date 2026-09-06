import { useEffect, useMemo, useRef, useState } from "react";
import { SearchSelect, categoriasGoldOpts } from "./FormKit";
import { getParametrosAvaliacao, setParametrosAvaliacao, type CriterioAvaliacao } from "./TurmaExtras";

export type CursoGold = {
  id: number;
  nome: string;
  categoria: string;
  tipo: string;
  preco: number;
  regime: string;
  horas: number;
  estado: string;
};

type TabId = "identidade" | "conteudo" | "avaliacao" | "publicacao";

type MediaSlot = { name: string; url: string };

type CursoSite = {
  titulo: string;
  slug: string;
  tipo: string;
  categoria: string;
  regime: string;
  video: string;
  preco: string;
  horas: string;
  tags: string;
  dataInicio: string;
  estado: string;
  visivelSite: boolean;
  banner: MediaSlot | null;
  thumb: MediaSlot | null;
  sintese: string;
  objetivos: string;
  programa: string;
  funcionamento: string;
};

const tipoOpts = [
  { value: "Gold", sub: "Pago · página comercial no site" },
  { value: "Pré-inscrição", sub: "Lista de espera / captação" },
];

const regimeOpts = [
  { value: "b-learning", sub: "Sessões síncronas + trabalho autónomo" },
  { value: "e-learning", sub: "100% assíncrono" },
  { value: "presencial", sub: "Sala física" },
];

const iCls =
  "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-slate-400 leading-snug">{hint}</p>}
    </div>
  );
}

function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function slugCriterio(label: string, existing: CriterioAvaliacao[]) {
  const base = slugify(label) || "criterio";
  let id = base;
  let n = 2;
  while (existing.some(c => c.id === id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  return id;
}

function filled(v: string | MediaSlot | null | undefined) {
  if (!v) return false;
  if (typeof v === "string") return v.trim().length > 0;
  return !!v.url;
}

const conteudoComunicar = {
  sintese:
    "Modalidade B-learning pensada para quem precisa de falar em público com clareza e presença — em reuniões, formações ou palco.\n\nCombina 3 aulas virtuais síncronas com trabalho autónomo em vídeo e exercícios práticos. No final, recebe certificado ENA e um percurso concreto para continuar a treinar a voz e a estrutura do discurso.",
  objetivos:
    "Dominar técnicas para respirar e potencializar a voz.\nEstruturar um discurso claro, persuasivo e adaptado ao público.\nGerir o nervosismo e a linguagem corporal em contexto real.\nUsar pausas, ênfase e contacto visual de forma intencional.\nDar e receber feedback construtivo sobre apresentações.",
  programa:
    "Aula Virtual 1 — Técnicas para respirar e potencializar a voz\n• Respiração diafragmática e apoio vocal\n• Articulação, projeção e ritmo\n• Exercícios práticos em grupo\n\nAula Virtual 2 — Estrutura do discurso e presença cénica\n• Abertura, desenvolvimento e fecho\n• Storytelling e exemplos pessoais\n• Linguagem corporal e gestão do espaço\n\nAula Virtual 3 — Ensaio e feedback\n• Apresentação de 3 minutos\n• Grelha de observação entre pares\n• Plano de melhoria individual",
  funcionamento:
    "3 videoconferências de 2h, em grupos até 10 formandos.\n8 horas de trabalho autónomo em plataforma (vídeos, exercícios e fórum).\nMateriais digitais disponíveis após cada sessão.\nSuporte técnico por email durante o curso.\nCertificado emitido com 80% de assiduidade e exercício final entregue.",
};

const conteudoCcp = {
  sintese:
    "O CCP — Certificado de Competências Pedagógicas — é a credenciação oficial para exercer a profissão de formador em Portugal.\n\n90 horas em b-learning: sessões presenciais/síncronas, trabalho em plataforma e simulação pedagógica inicial e final. No fim, o formando está preparado para planear, conduzir e avaliar formação de adultos.",
  objetivos:
    "Compreender o sistema de formação de adultos e o papel do formador.\nPlanear sessões com objetivos, métodos e recursos adequados.\nConduzir grupos com técnicas ativas e gestão do tempo.\nConstruir e aplicar instrumentos de avaliação.\nRealizar uma simulação pedagógica completa, da planificação ao feedback.",
  programa:
    "M1 · Aprendizagem e pedagogia — 20h\nM2 · Comunicação e dinâmica de grupos — 20h\nM3 · Avaliação da formação — 15h\nM4 · Simulação pedagógica — 25h\nM5 · Plataformas digitais e e-learning — 10h",
  funcionamento:
    "Regime b-learning: sábados de manhã ou pós-laboral, consoante a turma.\nPlataforma Moodle para materiais, fóruns e entregas (PIP e simulações).\nSimulação inicial e final gravadas em vídeo, com folha de avaliação do curso.\nAssiduidade mínima de 90% e aprovação nas simulações para emissão do CCP.",
};

function seedSite(curso?: CursoGold): CursoSite {
  const isCcp = !!curso && /ccp/i.test(curso.nome);
  const isComunicar = !!curso && /comunicar/i.test(curso.nome);
  const pack = isCcp ? conteudoCcp : isComunicar ? conteudoComunicar : { sintese: "", objetivos: "", programa: "", funcionamento: "" };
  return {
    titulo: curso?.nome ?? "",
    slug: curso ? slugify(curso.nome) : "",
    tipo: curso?.tipo ?? "Gold",
    categoria: curso?.categoria ?? "",
    regime: curso?.regime ?? "b-learning",
    video: isComunicar ? "384729105" : isCcp ? "221904831" : "",
    preco: String(curso?.preco ?? ""),
    horas: String(curso?.horas ?? ""),
    tags: isCcp ? "ccp, formadores, iefp" : isComunicar ? "comunicacao, voz, b-learning" : "",
    dataInicio: "",
    estado: curso?.estado ?? "Ativo",
    visivelSite: curso?.estado === "Ativo",
    banner: curso ? { name: "banner.jpg", url: "" } : null,
    thumb: curso ? { name: "thumb.jpg", url: "" } : null,
    ...pack,
  };
}

const checks = (d: CursoSite) => [
  { id: "titulo", label: "Título", ok: filled(d.titulo) },
  { id: "slug", label: "Slug / URL", ok: filled(d.slug) },
  { id: "media", label: "Banner e miniatura", ok: !!(d.banner && d.thumb) },
  { id: "meta", label: "Preço, horas e categoria", ok: filled(d.preco) && filled(d.horas) && filled(d.categoria) },
  { id: "sintese", label: "Síntese", ok: filled(d.sintese) },
  { id: "objetivos", label: "Objetivos", ok: filled(d.objetivos) },
  { id: "programa", label: "Programa", ok: filled(d.programa) },
  { id: "funcionamento", label: "Funcionamento", ok: filled(d.funcionamento) },
];

function MediaCard({
  label,
  hint,
  value,
  onChange,
  tall,
}: {
  label: string;
  hint: string;
  value: MediaSlot | null;
  onChange: (v: MediaSlot | null) => void;
  tall?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{label}</p>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file) onChange({ name: file.name, url: URL.createObjectURL(file) });
        }}
        className={`relative w-full ${tall ? "h-40" : "h-32"} rounded-xl border-2 border-dashed border-slate-200 overflow-hidden bg-slate-50 hover:border-amber-400 hover:bg-amber-50/40 transition-colors text-left group`}
      >
        {value?.url ? (
          <img src={value.url} alt={label} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-700 to-amber-900">
            <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_30%_20%,#f59e0b,transparent_50%)]" />
            <div className="absolute bottom-3 left-3">
              <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide bg-amber-500 text-white">
                {label.toUpperCase()}
              </span>
            </div>
          </div>
        )}
        <div className="absolute inset-0 flex items-end justify-between p-3 bg-gradient-to-t from-black/45 to-transparent">
          <span className="text-[11px] text-white/90 truncate pr-2">{value?.name ?? "Arrastar ou clicar para carregar"}</span>
          <span className="text-[11px] font-semibold text-white bg-white/15 px-2 py-0.5 rounded-md group-hover:bg-amber-500">
            Alterar
          </span>
        </div>
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) onChange({ name: file.name, url: URL.createObjectURL(file) });
        }}
      />
      <p className="text-[11px] text-slate-400 mt-1">{hint}</p>
    </div>
  );
}

function EditorBlock({
  label,
  siteHint,
  value,
  onChange,
  rows = 8,
}: {
  label: string;
  siteHint: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">{label}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{siteHint}</p>
        </div>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${value.trim() ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
          {value.trim() ? "Preenchido" : "Em falta"}
        </span>
      </div>
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-slate-100 bg-slate-50 text-slate-500">
        {["B", "I", "•", "1.", "🔗"].map(t => (
          <span key={t} className="w-7 h-7 inline-flex items-center justify-center text-xs font-semibold rounded-md">
            {t}
          </span>
        ))}
        <span className="ml-auto text-[10px] text-slate-400">{value.trim().length} caracteres</span>
      </div>
      <textarea
        className="w-full px-4 py-3 text-sm text-slate-700 leading-relaxed resize-y focus:outline-none min-h-[140px]"
        rows={rows}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Este texto aparece na página pública do curso."
      />
    </div>
  );
}

function SitePreview({ data }: { data: CursoSite }) {
  const bullets = (t: string) =>
    t
      .split("\n")
      .map(l => l.replace(/^[•\-]\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 5);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2 bg-slate-50">
        <span className="flex gap-1">
          <span className="w-2 h-2 rounded-full bg-slate-300" />
          <span className="w-2 h-2 rounded-full bg-slate-300" />
          <span className="w-2 h-2 rounded-full bg-slate-300" />
        </span>
        <span className="flex-1 text-[11px] font-mono text-slate-400 truncate">
          ena.pt/cursos/{data.slug || "…"}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">Pré-visualização</span>
      </div>
      <div className="max-h-[720px] overflow-y-auto">
        <div className="relative h-40 bg-gradient-to-br from-slate-800 via-slate-700 to-amber-900">
          {data.banner?.url && <img src={data.banner.url} alt="" className="absolute inset-0 w-full h-full object-cover" />}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute bottom-3 left-4 right-4">
            <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-white uppercase tracking-wide">
              {data.regime || "regime"}
            </span>
            <h3 className="text-white font-bold text-base leading-snug mt-1.5">
              {data.titulo || "Título do curso"}
            </h3>
          </div>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-1 rounded-lg bg-amber-50 text-amber-700 font-semibold">
              {data.preco ? `€ ${data.preco}` : "Preço —"}
            </span>
            <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600">{data.horas ? `${data.horas} horas` : "Horas —"}</span>
            <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600">{data.categoria || "Categoria"}</span>
            {data.tipo && <span className="px-2 py-1 rounded-lg bg-violet-50 text-violet-700">{data.tipo}</span>}
          </div>
          <section>
            <p className="text-[11px] font-bold uppercase tracking-wide text-amber-600 mb-1">Síntese</p>
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
              {data.sintese || "A síntese do curso aparece aqui, no hero da página pública."}
            </p>
          </section>
          <section>
            <p className="text-[11px] font-bold uppercase tracking-wide text-amber-600 mb-1.5">Objetivos</p>
            <ul className="space-y-1">
              {(bullets(data.objetivos).length ? bullets(data.objetivos) : ["Os objetivos gerais listam-se neste bloco."]).map((l, i) => (
                <li key={i} className="text-sm text-slate-600 flex gap-2">
                  <span className="text-amber-500 mt-0.5">▸</span>
                  <span>{l}</span>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <p className="text-[11px] font-bold uppercase tracking-wide text-amber-600 mb-1.5">Programa</p>
            <div className="text-sm text-slate-600 whitespace-pre-line leading-relaxed bg-slate-50 rounded-xl p-3">
              {data.programa || "O percurso de aprendizagem (aulas / módulos) surge nesta secção."}
            </div>
          </section>
          <section>
            <p className="text-[11px] font-bold uppercase tracking-wide text-amber-600 mb-1">Funcionamento</p>
            <p className="text-sm text-slate-600 whitespace-pre-line leading-relaxed">
              {data.funcionamento || "Logística, grupos, plataforma e certificação."}
            </p>
          </section>
          <button type="button" className="w-full py-2.5 rounded-lg bg-amber-500 text-white text-sm font-semibold">
            Quero inscrever-me
          </button>
        </div>
      </div>
    </div>
  );
}

export function CursoFichaView({
  curso,
  onBack,
}: {
  curso?: CursoGold;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<TabId>("identidade");
  const [data, setData] = useState<CursoSite>(() => seedSite(curso));
  const [slugLocked, setSlugLocked] = useState(true);
  const [criterios, setCriterios] = useState<CriterioAvaliacao[]>(() => getParametrosAvaliacao(curso?.nome).criterios);
  const [novoCriterio, setNovoCriterio] = useState("");
  const [saved, setSaved] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const temAvaliacao = /ccp/i.test(data.titulo) || /ccp/i.test(data.categoria);
  const lista = checks(data);
  const done = lista.filter(c => c.ok).length;
  const pct = Math.round((done / lista.length) * 100);

  const tabs = useMemo(() => {
    const base: { id: TabId; label: string; hint: string }[] = [
      { id: "identidade", label: "Identidade", hint: "O que o visitante vê primeiro" },
      { id: "conteudo", label: "Conteúdo do site", hint: "Textos da página pública" },
      { id: "avaliacao", label: "Avaliação", hint: "Folha das simulações" },
      { id: "publicacao", label: "Publicação", hint: "Visibilidade no website" },
    ];
    return temAvaliacao ? base : base.filter(t => t.id !== "avaliacao");
  }, [temAvaliacao]);

  useEffect(() => {
    if (!temAvaliacao && tab === "avaliacao") setTab("conteudo");
  }, [temAvaliacao, tab]);

  function patch(p: Partial<CursoSite>) {
    setData(prev => ({ ...prev, ...p }));
    setSaved(false);
  }

  function guardar() {
    if (temAvaliacao) setParametrosAvaliacao(data.titulo || curso?.nome || "Curso", criterios.filter(c => c.label.trim()));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2400);
  }

  return (
    <div className="-m-4 sm:-m-5 min-h-[calc(100vh-7.5rem)] flex flex-col bg-slate-100">
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200">
        <div className="px-4 sm:px-6 py-3 flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <button
              type="button"
              onClick={onBack}
              className="mt-0.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 whitespace-nowrap"
            >
              ← Cursos
            </button>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600">Ficha do curso · website</p>
              <h1 className="text-lg font-bold text-slate-800 truncate">{data.titulo || "Novo curso"}</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {data.tipo || "Tipo"} · {data.horas ? `${data.horas}h` : "—"} · {data.regime || "regime"}
                {data.slug ? ` · /cursos/${data.slug}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="hidden sm:block min-w-[160px]">
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-slate-500">Pronto para o site</span>
                <span className={`font-semibold ${pct === 100 ? "text-emerald-600" : "text-amber-600"}`}>{pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div className={`h-full rounded-full ${pct === 100 ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPreviewOpen(v => !v)}
              className="lg:hidden px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              {previewOpen ? "Editar" : "Ver site"}
            </button>
            <button
              type="button"
              onClick={guardar}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg shadow-sm"
            >
              {saved ? "Guardado" : "Guardar"}
            </button>
          </div>
        </div>
        <div className="px-4 sm:px-6 flex gap-1 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => { setTab(t.id); setPreviewOpen(false); }}
              className={`px-3 py-2.5 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
                tab === t.id ? "border-amber-500 text-amber-700" : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-0 xl:gap-5 p-4 sm:p-5">
        <div className={`${previewOpen ? "hidden lg:block" : ""} space-y-4 min-w-0`}>
          {tab === "identidade" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Identidade visual</p>
                  <p className="text-xs text-slate-500 mt-0.5">Estas imagens alimentam o hero e os cartões do catálogo no site da ENA.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <MediaCard
                    label="Banner"
                    hint="Recomendado 1600×600. Aparece no topo da página do curso."
                    value={data.banner}
                    onChange={v => patch({ banner: v })}
                    tall
                  />
                  <MediaCard
                    label="Miniatura"
                    hint="Recomendado 800×600. Usada nas listagens e partilhas."
                    value={data.thumb}
                    onChange={v => patch({ thumb: v })}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
                <p className="text-sm font-semibold text-slate-800">Dados que o visitante lê</p>
                <Field label="Título" hint="Nome comercial no website. Evite códigos internos.">
                  <input
                    className={iCls}
                    value={data.titulo}
                    onChange={e => {
                      const titulo = e.target.value;
                      patch({ titulo, slug: slugLocked ? slugify(titulo) : data.slug });
                    }}
                  />
                </Field>
                <Field label="Slug" hint="Endereço público. Alterar um slug publicado parte ligações antigas.">
                  <div className="flex gap-2">
                    <div className="flex-1 flex items-center rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
                      <span className="px-3 text-[11px] font-mono text-slate-400 whitespace-nowrap">ena.pt/cursos/</span>
                      <input
                        className="flex-1 px-2 py-2 text-sm bg-white border-l border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
                        value={data.slug}
                        onChange={e => { setSlugLocked(false); patch({ slug: slugify(e.target.value) }); }}
                      />
                    </div>
                  </div>
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <Field label="Tipo de curso"><SearchSelect value={data.tipo} onChange={v => patch({ tipo: v })} options={tipoOpts} /></Field>
                  <Field label="Categoria"><SearchSelect value={data.categoria} onChange={v => patch({ categoria: v })} options={categoriasGoldOpts} /></Field>
                  <Field label="Regime"><SearchSelect value={data.regime} onChange={v => patch({ regime: v })} options={regimeOpts} /></Field>
                  <Field label="Vídeo" hint="ID Vimeo ou URL">
                    <input className={iCls} value={data.video} onChange={e => patch({ video: e.target.value })} placeholder="384729105" />
                  </Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <Field label="Preço (€)"><input className={iCls} type="number" value={data.preco} onChange={e => patch({ preco: e.target.value })} /></Field>
                  <Field label="Horas"><input className={iCls} type="number" value={data.horas} onChange={e => patch({ horas: e.target.value })} /></Field>
                  <Field label="Tags" hint="Separadas por vírgula">
                    <input className={iCls} value={data.tags} onChange={e => patch({ tags: e.target.value })} placeholder="comunicacao, voz" />
                  </Field>
                  <Field label="Data de início">
                    <input className={iCls} type="date" value={data.dataInicio} onChange={e => patch({ dataInicio: e.target.value })} />
                  </Field>
                </div>
              </div>
            </div>
          )}

          {tab === "conteudo" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Cada bloco corresponde a uma secção da página pública. Escreva para o formando — não para a operação interna.
              </div>
              <EditorBlock
                label="Síntese do curso"
                siteHint="Primeiro parágrafo abaixo do banner. Responda: para quem é e o que se leva daqui."
                value={data.sintese}
                onChange={v => patch({ sintese: v })}
                rows={7}
              />
              <EditorBlock
                label="Objetivos"
                siteHint="Lista do que o formando será capaz de fazer. Uma ideia por linha."
                value={data.objetivos}
                onChange={v => patch({ objetivos: v })}
                rows={7}
              />
              <EditorBlock
                label="Programa / percurso"
                siteHint="Aulas virtuais ou módulos. Use títulos curtos e tópicos por baixo."
                value={data.programa}
                onChange={v => patch({ programa: v })}
                rows={10}
              />
              <EditorBlock
                label="Funcionamento"
                siteHint="Logística: sessões, dimensão do grupo, plataforma, assiduidade e certificado."
                value={data.funcionamento}
                onChange={v => patch({ funcionamento: v })}
                rows={7}
              />
            </div>
          )}

          {tab === "avaliacao" && (
            <div className="rounded-xl border border-violet-200 bg-white p-4 sm:p-5 space-y-4">
              <div>
                <p className="text-sm font-semibold text-slate-800">Parâmetros da folha de avaliação</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Usados nas simulações inicial e final das turmas deste curso. Escala 1–5. Não aparecem no website.
                </p>
              </div>
              {criterios.length === 0 && (
                <p className="text-sm text-slate-500 rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center">
                  Ainda não há critérios. Adicione o primeiro abaixo.
                </p>
              )}
              <div className="space-y-2">
                {criterios.map((c, i) => (
                  <div key={c.id} className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400 w-5">{i + 1}</span>
                    <input
                      className={iCls}
                      value={c.label}
                      onChange={e => setCriterios(prev => prev.map(x => x.id === c.id ? { ...x, label: e.target.value } : x))}
                    />
                    <button
                      type="button"
                      onClick={() => setCriterios(prev => prev.filter(x => x.id !== c.id))}
                      className="px-2 py-2 text-xs text-slate-400 hover:text-red-500"
                      aria-label="Remover critério"
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  className={iCls}
                  value={novoCriterio}
                  placeholder="Novo critério (ex. Gestão do tempo)"
                  onChange={e => setNovoCriterio(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && novoCriterio.trim()) {
                      setCriterios(prev => [...prev, { id: slugCriterio(novoCriterio, prev), label: novoCriterio.trim() }]);
                      setNovoCriterio("");
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!novoCriterio.trim()) return;
                    setCriterios(prev => [...prev, { id: slugCriterio(novoCriterio, prev), label: novoCriterio.trim() }]);
                    setNovoCriterio("");
                  }}
                  className="px-3 py-2 text-xs font-semibold rounded-lg border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 whitespace-nowrap"
                >
                  + Critério
                </button>
              </div>
            </div>
          )}

          {tab === "publicacao" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
                <p className="text-sm font-semibold text-slate-800">Estado no website</p>
                <label className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 p-4 cursor-pointer hover:bg-slate-50">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Visível no catálogo</p>
                    <p className="text-xs text-slate-500 mt-0.5">Quando ativo, a página entra em ena.pt/cursos e nas listagens.</p>
                  </div>
                  <input
                    type="checkbox"
                    className="mt-1 w-4 h-4 accent-amber-500"
                    checked={data.visivelSite}
                    onChange={e => patch({ visivelSite: e.target.checked, estado: e.target.checked ? "Ativo" : "Inactivo" })}
                  />
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Estado interno">
                    <SearchSelect
                      value={data.estado}
                      onChange={v => patch({ estado: v, visivelSite: v === "Ativo" })}
                      options={[{ value: "Ativo" }, { value: "Inactivo" }]}
                    />
                  </Field>
                  <Field label="Próxima data pública">
                    <input className={iCls} type="date" value={data.dataInicio} onChange={e => patch({ dataInicio: e.target.value })} />
                  </Field>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                <p className="text-sm font-semibold text-slate-800 mb-3">Checklist da página pública</p>
                <ul className="space-y-2">
                  {lista.map(c => (
                    <li key={c.id} className="flex items-center justify-between text-sm">
                      <span className={c.ok ? "text-slate-700" : "text-slate-500"}>{c.label}</span>
                      <span className={`text-xs font-semibold ${c.ok ? "text-emerald-600" : "text-amber-600"}`}>
                        {c.ok ? "Pronto" : "Falta"}
                      </span>
                    </li>
                  ))}
                </ul>
                {pct < 100 && (
                  <p className="text-xs text-slate-500 mt-4">
                    Faltam {lista.length - done} campos para a página ficar completa. Pode guardar na mesma — o site mostra o que já existe.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <aside className={`${previewOpen ? "block" : "hidden"} xl:block min-w-0`}>
          <div className="xl:sticky xl:top-[7.5rem] space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Página no website</p>
              <span className={`text-[11px] font-semibold ${data.visivelSite ? "text-emerald-600" : "text-slate-400"}`}>
                {data.visivelSite ? "Publicada" : "Rascunho"}
              </span>
            </div>
            <SitePreview data={data} />
          </div>
        </aside>
      </div>
    </div>
  );
}
