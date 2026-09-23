import { useEffect, useMemo, useRef, useState } from "react";
import { SearchSelect, categoriasGoldOpts } from "./FormKit";
import { getParametrosAvaliacao, setParametrosAvaliacao, type CriterioAvaliacao } from "./TurmaExtras";

export type CursoFichaSeed = {
  id: number;
  nome: string;
  categoria?: string;
  tipo?: string;
  preco?: number;
  regime: string;
  horas: number;
  estado: string;
  ufcdCod?: string;
  ufcd?: string;
};

export type CursoGold = CursoFichaSeed;
export type CursoAccent = "gold" | "fin";

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
  ufcdCod: string;
  ufcd: string;
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

const areasFinOpts = [
  { value: "Saúde e segurança" },
  { value: "Marketing digital" },
  { value: "TIC e cibersegurança" },
  { value: "Formação de formadores" },
];

function theme(accent: CursoAccent) {
  if (accent === "fin") {
    return {
      ring: "focus:ring-blue-400",
      iCls: "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent",
      eyebrow: "text-blue-600",
      tabOn: "border-blue-600 text-blue-700",
      save: "bg-blue-600 hover:bg-blue-700",
      bar: "bg-blue-600",
      badge: "bg-blue-600",
      hoverMedia: "hover:border-blue-400 hover:bg-blue-50/40",
      hero: "from-slate-800 via-slate-700 to-blue-900",
      glow: "bg-[radial-gradient(circle_at_30%_20%,#3b82f6,transparent_50%)]",
      note: "border-blue-200 bg-blue-50 text-blue-900",
      preview: "text-blue-600",
      cta: "bg-blue-600",
      accentChk: "accent-blue-600",
      mediaHover: "group-hover:bg-blue-600",
      chip: "bg-blue-50 text-blue-700",
      missing: "text-blue-600",
      missingBg: "bg-blue-50 text-blue-700",
    };
  }
  return {
    ring: "focus:ring-amber-400",
    iCls: "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent",
    eyebrow: "text-amber-600",
    tabOn: "border-amber-500 text-amber-700",
    save: "bg-amber-500 hover:bg-amber-600",
    bar: "bg-amber-500",
    badge: "bg-amber-500",
    hoverMedia: "hover:border-amber-400 hover:bg-amber-50/40",
    hero: "from-slate-800 via-slate-700 to-amber-900",
    glow: "bg-[radial-gradient(circle_at_30%_20%,#f59e0b,transparent_50%)]",
    note: "border-amber-200 bg-amber-50 text-amber-900",
    preview: "text-amber-600",
    cta: "bg-amber-500",
    accentChk: "accent-amber-500",
    mediaHover: "group-hover:bg-amber-500",
    chip: "bg-amber-50 text-amber-700",
    missing: "text-amber-600",
    missingBg: "bg-amber-50 text-amber-700",
  };
}

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
    "Modalidade B-learning pensada para quem precisa de falar em público com clareza e presença - em reuniões, formações ou palco.\n\nCombina 3 aulas virtuais síncronas com trabalho autónomo em vídeo e exercícios práticos. No final, recebe certificado ENA e um percurso concreto para continuar a treinar a voz e a estrutura do discurso.",
  objetivos:
    "Dominar técnicas para respirar e potencializar a voz.\nEstruturar um discurso claro, persuasivo e adaptado ao público.\nGerir o nervosismo e a linguagem corporal em contexto real.\nUsar pausas, ênfase e contacto visual de forma intencional.\nDar e receber feedback construtivo sobre apresentações.",
  programa:
    "Aula Virtual 1 - Técnicas para respirar e potencializar a voz\n• Respiração diafragmática e apoio vocal\n• Articulação, projeção e ritmo\n• Exercícios práticos em grupo\n\nAula Virtual 2 - Estrutura do discurso e presença cénica\n• Abertura, desenvolvimento e fecho\n• Storytelling e exemplos pessoais\n• Linguagem corporal e gestão do espaço\n\nAula Virtual 3 - Ensaio e feedback\n• Apresentação de 3 minutos\n• Grelha de observação entre pares\n• Plano de melhoria individual",
  funcionamento:
    "3 videoconferências de 2h, em grupos até 10 formandos.\n8 horas de trabalho autónomo em plataforma (vídeos, exercícios e fórum).\nMateriais digitais disponíveis após cada sessão.\nSuporte técnico por email durante o curso.\nCertificado emitido com 80% de assiduidade e exercício final entregue.",
};

const conteudoCcp = {
  sintese:
    "O CCP - Certificado de Competências Pedagógicas - é a credenciação oficial para exercer a profissão de formador em Portugal.\n\n90 horas em b-learning: sessões presenciais/síncronas, trabalho em plataforma e simulação pedagógica inicial e final. No fim, o formando está preparado para planear, conduzir e avaliar formação de adultos.",
  objetivos:
    "Compreender o sistema de formação de adultos e o papel do formador.\nPlanear sessões com objetivos, métodos e recursos adequados.\nConduzir grupos com técnicas ativas e gestão do tempo.\nConstruir e aplicar instrumentos de avaliação.\nRealizar uma simulação pedagógica completa, da planificação ao feedback.",
  programa:
    "M1 · Aprendizagem e pedagogia - 20h\nM2 · Comunicação e dinâmica de grupos - 20h\nM3 · Avaliação da formação - 15h\nM4 · Simulação pedagógica - 25h\nM5 · Plataformas digitais e e-learning - 10h",
  funcionamento:
    "Regime b-learning: sábados de manhã ou pós-laboral, consoante a turma.\nPlataforma Moodle para materiais, fóruns e entregas (PIP e simulações).\nSimulação inicial e final gravadas em vídeo, com folha de avaliação do curso.\nAssiduidade mínima de 90% e aprovação nas simulações para emissão do CCP.",
};

const conteudoFin: Record<string, { sintese: string; objetivos: string; programa: string; funcionamento: string; categoria: string; tags: string }> = {
  "3564": {
    categoria: "Saúde e segurança",
    tags: "primeiros socorros, saude, ufcd",
    sintese:
      "UFCD 3564 do Catálogo Nacional de Qualificações. Forma para reconhecer emergências, aplicar suporte básico de vida e estabilizar a vítima até chegar ajuda especializada.\n\n25 horas em e-learning, com casos práticos e avaliação final. Curso financiado - sem custo para o formando elegível.",
    objetivos:
      "Identificar sinais de emergência médica e acionar o 112.\nAplicar a cadeia de sobrevivência e o SBV no adulto.\nControlar hemorragias e imobilizar lesões músculo-esqueléticas.\nAgir em situações de queimadura, intoxicação e desmaio.\nRegistar a ocorrência e comunicar com os meios de socorro.",
    programa:
      "1. Enquadramento e cadeia de sobrevivência\n2. Avaliação da vítima e posição de segurança\n3. Suporte básico de vida e DEA\n4. Hemorragias, feridas e queimaduras\n5. Traumatismos e imobilização\n6. Avaliação e encerramento",
    funcionamento:
      "25 horas assíncronas na plataforma Moodle.\nAcesso durante o período da turma, com tutoragem por formador.\nAssiduidade e teste final obrigatórios para certificado.\nFinanciado - sujeito a critérios de elegibilidade (IEFP / PO).",
  },
  "10785": {
    categoria: "Marketing digital",
    tags: "redes sociais, trafego, ufcd",
    sintese:
      "UFCD 10785 - Publicidade nas Redes Sociais. Percurso prático para planear, lançar e ler campanhas de tráfego pago em Meta e Google.\n\n25 horas em e-learning. O nome comercial no site (Master em Tráfego) deve explicar o benefício; o código UFCD fica visível para quem precisa do CNQ.",
    objetivos:
      "Definir público, objetivo e orçamento de uma campanha.\nMontar conjuntos de anúncios e criativos para feed e stories.\nLer métricas de alcance, CPC e conversão.\nAjustar campanhas com base em dados da primeira semana.\nCumprir as regras de publicidade das plataformas.",
    programa:
      "1. Ecossistema de anúncios sociais\n2. Estrutura de conta, pixel e eventos\n3. Criativos e copy para cada formato\n4. Segmentação e orçamento\n5. Leitura de relatórios e otimização\n6. Projeto final: campanha completa",
    funcionamento:
      "25 horas em e-learning com entregas semanais.\nContas de anúncios de exercício fornecidas pela ENA quando necessário.\nFinanciado. Certificado com assiduidade e projeto entregue.",
  },
  "9188": {
    categoria: "TIC e cibersegurança",
    tags: "ciberseguranca, tic, ufcd",
    sintese:
      "UFCD 9188 - Fundamentos de cibersegurança. Introduz ameaças comuns, higiene digital e o papel de cada colaborador na proteção da organização.\n\n25 horas em b-learning: sessões síncronas para exercícios e trabalho autónomo na plataforma.",
    objetivos:
      "Reconhecer phishing, malware e engenharia social.\nAplicar palavras-passe fortes e autenticação de dois fatores.\nProteger dados pessoais e profissionais no dia a dia.\nSaber a quem reportar um incidente.\nAdotar boas práticas em dispositivos móveis e cloud.",
    programa:
      "1. Conceitos e ameaças atuais\n2. Identidade, acessos e palavras-passe\n3. Correio, ligações e ficheiros suspeitos\n4. Dispositivos, redes e cópias de segurança\n5. Resposta a incidentes e comunicação\n6. Exercício de simulação e fecho",
    funcionamento:
      "Sessões síncronas + trabalho na Moodle (25h no total).\nExercício prático de identificação de ameaças.\nFinanciado. Certificado com assiduidade e exercício entregue.",
  },
  "10394": {
    categoria: "Formação de formadores",
    tags: "pedagogia, formadores, ufcd",
    sintese:
      "UFCD 10394 - Métodos e Técnicas Pedagógicas Ativos. Destina-se a formadores que querem sair do expositivo e pôr o grupo a trabalhar.\n\n25 horas em b-learning, com micro-práticas em sessão e um plano de sessão entregue no fim.",
    objetivos:
      "Escolher métodos ativos adequados ao objetivo e ao grupo.\nDesenhar atividades de 10 a 40 minutos com materiais simples.\nConduzir brainstorming, estudo de caso e role-play.\nDar feedback sem desmotivar o formando.\nIntegrar técnicas ativas num plano de sessão completo.",
    programa:
      "1. Aprendizagem de adultos e o método ativo\n2. Técnicas de abertura e quebra-gelo\n3. Trabalho de grupo, caso e simulação\n4. Questionamento e condução de plenário\n5. Avaliação formativa em sessão\n6. Plano de sessão com técnicas ativas",
    funcionamento:
      "B-learning: sessões síncronas + entregas na plataforma.\nO plano de sessão final usa os parâmetros de avaliação desta UFCD.\nFinanciado. Certificado com assiduidade e plano entregue.",
  },
};

function areaFromCurso(curso?: CursoFichaSeed) {
  if (curso?.categoria) return curso.categoria;
  if (curso?.ufcdCod && conteudoFin[curso.ufcdCod]) return conteudoFin[curso.ufcdCod].categoria;
  return "";
}

function seedSite(curso?: CursoFichaSeed, accent: CursoAccent = "gold"): CursoSite {
  const isCcp = !!curso && /ccp/i.test(curso.nome);
  const isComunicar = !!curso && /comunicar/i.test(curso.nome);
  const finPack = curso?.ufcdCod ? conteudoFin[curso.ufcdCod] : undefined;
  const pack = accent === "fin"
    ? (finPack ?? { sintese: "", objetivos: "", programa: "", funcionamento: "", tags: "ufcd, financiada", categoria: "" })
    : isCcp ? { ...conteudoCcp, tags: "ccp, formadores, iefp", categoria: curso?.categoria ?? "" }
    : isComunicar ? { ...conteudoComunicar, tags: "comunicacao, voz, b-learning", categoria: curso?.categoria ?? "" }
    : { sintese: "", objetivos: "", programa: "", funcionamento: "", tags: "", categoria: curso?.categoria ?? "" };

  return {
    titulo: curso?.nome ?? "",
    slug: curso ? slugify(curso.nome) : "",
    tipo: accent === "fin" ? "Financiada" : (curso?.tipo ?? "Gold"),
    categoria: areaFromCurso(curso) || pack.categoria,
    regime: curso?.regime ?? (accent === "fin" ? "e-learning" : "b-learning"),
    video: isComunicar ? "384729105" : isCcp ? "221904831" : finPack ? "551002210" : "",
    preco: accent === "fin" ? "" : String(curso?.preco ?? ""),
    horas: String(curso?.horas ?? (accent === "fin" ? 25 : "")),
    tags: "tags" in pack ? pack.tags : "",
    dataInicio: "",
    estado: curso?.estado ?? "Ativo",
    visivelSite: curso?.estado === "Ativo",
    banner: curso ? { name: "banner.jpg", url: "" } : null,
    thumb: curso ? { name: "thumb.jpg", url: "" } : null,
    sintese: pack.sintese,
    objetivos: pack.objetivos,
    programa: pack.programa,
    funcionamento: pack.funcionamento,
    ufcdCod: curso?.ufcdCod ?? "",
    ufcd: curso?.ufcd ?? "",
  };
}

function checks(d: CursoSite, accent: CursoAccent) {
  const meta = accent === "fin"
    ? { id: "meta", label: "UFCD, horas e regime", ok: filled(d.ufcdCod) && filled(d.horas) && filled(d.regime) }
    : { id: "meta", label: "Preço, horas e categoria", ok: filled(d.preco) && filled(d.horas) && filled(d.categoria) };
  return [
    { id: "titulo", label: accent === "fin" ? "Nome comercial" : "Título", ok: filled(d.titulo) },
    { id: "slug", label: "Slug / URL", ok: filled(d.slug) },
    { id: "media", label: "Banner e miniatura", ok: !!(d.banner && d.thumb) },
    meta,
    { id: "sintese", label: "Síntese", ok: filled(d.sintese) },
    { id: "objetivos", label: "Objetivos", ok: filled(d.objetivos) },
    { id: "programa", label: "Programa", ok: filled(d.programa) },
    { id: "funcionamento", label: "Funcionamento", ok: filled(d.funcionamento) },
  ];
}

function MediaCard({
  label, hint, value, onChange, tall, accent,
}: {
  label: string; hint: string; value: MediaSlot | null; onChange: (v: MediaSlot | null) => void; tall?: boolean; accent: CursoAccent;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const t = theme(accent);
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
        className={`relative w-full ${tall ? "h-40" : "h-32"} rounded-xl border-2 border-dashed border-slate-200 overflow-hidden bg-slate-50 ${t.hoverMedia} transition-colors text-left group`}
      >
        {value?.url ? (
          <img src={value.url} alt={label} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${t.hero}`}>
            <div className={`absolute inset-0 opacity-40 ${t.glow}`} />
            <div className="absolute bottom-3 left-3">
              <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide ${t.badge} text-white`}>
                {label.toUpperCase()}
              </span>
            </div>
          </div>
        )}
        <div className="absolute inset-0 flex items-end justify-between p-3 bg-gradient-to-t from-black/45 to-transparent">
          <span className="text-[11px] text-white/90 truncate pr-2">{value?.name ?? "Arrastar ou clicar para carregar"}</span>
          <span className={`text-[11px] font-semibold text-white bg-white/15 px-2 py-0.5 rounded-md ${t.mediaHover}`}>Alterar</span>
        </div>
      </button>
      <input ref={ref} type="file" accept="image/*" className="hidden"
        onChange={e => { const file = e.target.files?.[0]; if (file) onChange({ name: file.name, url: URL.createObjectURL(file) }); }} />
      <p className="text-[11px] text-slate-400 mt-1">{hint}</p>
    </div>
  );
}

function EditorBlock({
  label, siteHint, value, onChange, rows = 8, accent,
}: {
  label: string; siteHint: string; value: string; onChange: (v: string) => void; rows?: number; accent: CursoAccent;
}) {
  const t = theme(accent);
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">{label}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{siteHint}</p>
        </div>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${value.trim() ? "bg-emerald-50 text-emerald-700" : t.missingBg}`}>
          {value.trim() ? "Preenchido" : "Em falta"}
        </span>
      </div>
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-slate-100 bg-slate-50 text-slate-500">
        {["B", "I", "•", "1.", "🔗"].map(x => (
          <span key={x} className="w-7 h-7 inline-flex items-center justify-center text-xs font-semibold rounded-md">{x}</span>
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

function SitePreview({ data, accent }: { data: CursoSite; accent: CursoAccent }) {
  const t = theme(accent);
  const bullets = (txt: string) =>
    txt.split("\n").map(l => l.replace(/^[•\-]\s*/, "").trim()).filter(Boolean).slice(0, 5);
  const cta = accent === "fin" ? "Candidatar-me" : "Quero inscrever-me";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2 bg-slate-50">
        <span className="flex gap-1">
          <span className="w-2 h-2 rounded-full bg-slate-300" />
          <span className="w-2 h-2 rounded-full bg-slate-300" />
          <span className="w-2 h-2 rounded-full bg-slate-300" />
        </span>
        <span className="flex-1 text-[11px] font-mono text-slate-400 truncate">ena.pt/cursos/{data.slug || "…"}</span>
        <span className={`text-[10px] font-semibold uppercase tracking-wide ${t.preview}`}>Pré-visualização</span>
      </div>
      <div className="max-h-[720px] overflow-y-auto">
        <div className={`relative h-40 bg-gradient-to-br ${t.hero}`}>
          {data.banner?.url && <img src={data.banner.url} alt="" className="absolute inset-0 w-full h-full object-cover" />}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute bottom-3 left-4 right-4">
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${t.badge} text-white uppercase tracking-wide`}>
                {data.regime || "regime"}
              </span>
              {accent === "fin" && data.ufcdCod && (
                <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-white/20 text-white uppercase tracking-wide">
                  UFCD {data.ufcdCod}
                </span>
              )}
            </div>
            <h3 className="text-white font-bold text-base leading-snug">{data.titulo || "Título do curso"}</h3>
          </div>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex flex-wrap gap-2 text-xs">
            {accent === "fin" ? (
              <span className={`px-2 py-1 rounded-lg ${t.chip} font-semibold`}>Financiado</span>
            ) : (
              <span className={`px-2 py-1 rounded-lg ${t.chip} font-semibold`}>{data.preco ? `€ ${data.preco}` : "Preço -"}</span>
            )}
            <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600">{data.horas ? `${data.horas} horas` : "Horas -"}</span>
            <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600">{data.categoria || (accent === "fin" ? "Área" : "Categoria")}</span>
            {data.tipo && <span className="px-2 py-1 rounded-lg bg-violet-50 text-violet-700">{data.tipo}</span>}
          </div>
          <section>
            <p className={`text-[11px] font-bold uppercase tracking-wide ${t.preview} mb-1`}>Síntese</p>
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
              {data.sintese || "A síntese do curso aparece aqui, no hero da página pública."}
            </p>
          </section>
          <section>
            <p className={`text-[11px] font-bold uppercase tracking-wide ${t.preview} mb-1.5`}>Objetivos</p>
            <ul className="space-y-1">
              {(bullets(data.objetivos).length ? bullets(data.objetivos) : ["Os objetivos gerais listam-se neste bloco."]).map((l, i) => (
                <li key={i} className="text-sm text-slate-600 flex gap-2">
                  <span className={`${t.preview} mt-0.5`}>▸</span><span>{l}</span>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <p className={`text-[11px] font-bold uppercase tracking-wide ${t.preview} mb-1.5`}>Programa</p>
            <div className="text-sm text-slate-600 whitespace-pre-line leading-relaxed bg-slate-50 rounded-xl p-3">
              {data.programa || "O percurso de aprendizagem (aulas / módulos) surge nesta secção."}
            </div>
          </section>
          <section>
            <p className={`text-[11px] font-bold uppercase tracking-wide ${t.preview} mb-1`}>Funcionamento</p>
            <p className="text-sm text-slate-600 whitespace-pre-line leading-relaxed">
              {data.funcionamento || "Logística, grupos, plataforma e certificação."}
            </p>
          </section>
          <button type="button" className={`w-full py-2.5 rounded-lg ${t.cta} text-white text-sm font-semibold`}>{cta}</button>
        </div>
      </div>
    </div>
  );
}

export function CursoFichaView({
  curso,
  onBack,
  onOpenModulos,
  onCommit,
  accent = "gold",
}: {
  curso?: CursoFichaSeed;
  onBack: () => void;
  onOpenModulos?: (cursoNome: string) => void;
  onCommit?: (saved: CursoFichaSeed) => void;
  accent?: CursoAccent;
}) {
  const t = theme(accent);
  const [tab, setTab] = useState<TabId>("identidade");
  const [data, setData] = useState<CursoSite>(() => seedSite(curso, accent));
  const [slugLocked, setSlugLocked] = useState(true);
  const [criterios, setCriterios] = useState<CriterioAvaliacao[]>(() => getParametrosAvaliacao(curso?.nome || curso?.ufcd).criterios);
  const [novoCriterio, setNovoCriterio] = useState("");
  const [saved, setSaved] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const temAvaliacao = accent === "gold"
    ? /ccp/i.test(data.titulo) || /ccp/i.test(data.categoria)
    : /pedagóg/i.test(data.titulo) || /pedagog/i.test(data.ufcd) || data.ufcdCod === "10394";
  const lista = checks(data, accent);
  const done = lista.filter(c => c.ok).length;
  const pct = Math.round((done / lista.length) * 100);

  const tabs = useMemo(() => {
    const base: { id: TabId; label: string }[] = [
      { id: "identidade", label: "Identidade" },
      { id: "conteudo", label: "Conteúdo do site" },
      { id: "avaliacao", label: "Avaliação" },
      { id: "publicacao", label: "Publicação" },
    ];
    return temAvaliacao ? base : base.filter(x => x.id !== "avaliacao");
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
    if (onCommit && data.titulo.trim()) {
      onCommit({
        id: curso?.id ?? Date.now() % 100000,
        nome: data.titulo.trim(),
        categoria: data.categoria,
        tipo: data.tipo,
        preco: Number(data.preco) || 0,
        regime: data.regime,
        horas: Number(data.horas) || 0,
        estado: data.estado || "Ativo",
        ufcdCod: data.ufcdCod,
        ufcd: data.ufcd,
      });
    }
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2400);
  }

  const metaLine = accent === "fin"
    ? [data.ufcdCod ? `UFCD ${data.ufcdCod}` : "UFCD", data.horas ? `${data.horas}h` : "-", data.regime || "regime", data.slug ? `/cursos/${data.slug}` : ""]
        .filter(Boolean).join(" · ")
    : [data.tipo || "Tipo", data.horas ? `${data.horas}h` : "-", data.regime || "regime", data.slug ? `/cursos/${data.slug}` : ""]
        .filter(Boolean).join(" · ");

  return (
    <div className="-m-4 sm:-m-5 min-h-[calc(100vh-7.5rem)] flex flex-col bg-slate-100">
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200">
        <div className="px-4 sm:px-6 py-3 flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <button type="button" onClick={onBack}
              className="mt-0.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 whitespace-nowrap">
              ← Cursos
            </button>
            <div className="min-w-0">
              <p className={`text-[11px] font-semibold uppercase tracking-wide ${t.eyebrow}`}>
                {accent === "fin" ? "Ficha UFCD · website" : "Ficha do curso · website"}
              </p>
              <h1 className="text-lg font-bold text-slate-800 truncate">{data.titulo || (accent === "fin" ? "Nova UFCD" : "Novo curso")}</h1>
              <p className="text-xs text-slate-500 mt-0.5">{metaLine}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="hidden sm:block min-w-[160px]">
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-slate-500">Pronto para o site</span>
                <span className={`font-semibold ${pct === 100 ? "text-emerald-600" : t.missing}`}>{pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div className={`h-full rounded-full ${pct === 100 ? "bg-emerald-500" : t.bar}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
            {onOpenModulos && (
              <button type="button"
                onClick={() => onOpenModulos(data.titulo || curso?.nome || "")}
                className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 whitespace-nowrap">
                Módulos
              </button>
            )}
            <button type="button" onClick={() => setPreviewOpen(v => !v)}
              className="lg:hidden px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
              {previewOpen ? "Editar" : "Ver site"}
            </button>
            <button type="button" onClick={guardar} className={`px-4 py-2 ${t.save} text-white text-sm font-semibold rounded-lg shadow-sm`}>
              {saved ? "Guardado" : "Guardar"}
            </button>
          </div>
        </div>
        <div className="px-4 sm:px-6 flex gap-1 overflow-x-auto">
          {tabs.map(x => (
            <button key={x.id} type="button" onClick={() => { setTab(x.id); setPreviewOpen(false); }}
              className={`px-3 py-2.5 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
                tab === x.id ? t.tabOn : "border-transparent text-slate-500 hover:text-slate-800"
              }`}>
              {x.label}
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
                  <MediaCard accent={accent} label="Banner" hint="Recomendado 1600×600. Aparece no topo da página do curso." value={data.banner} onChange={v => patch({ banner: v })} tall />
                  <MediaCard accent={accent} label="Miniatura" hint="Recomendado 800×600. Usada nas listagens e partilhas." value={data.thumb} onChange={v => patch({ thumb: v })} />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
                <p className="text-sm font-semibold text-slate-800">Dados que o visitante lê</p>
                <Field label={accent === "fin" ? "Nome comercial" : "Título"} hint={accent === "fin" ? "Título no website. Pode ser mais comercial do que a designação oficial da UFCD." : "Nome comercial no website. Evite códigos internos."}>
                  <input className={t.iCls} value={data.titulo}
                    onChange={e => { const titulo = e.target.value; patch({ titulo, slug: slugLocked ? slugify(titulo) : data.slug }); }} />
                </Field>
                {accent === "fin" && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Field label="Código UFCD" hint="Catálogo Nacional de Qualificações">
                      <input className={t.iCls} value={data.ufcdCod} onChange={e => patch({ ufcdCod: e.target.value.replace(/\D/g, "").slice(0, 6) })} placeholder="3564" />
                    </Field>
                    <div className="sm:col-span-2">
                      <Field label="Designação oficial" hint="Nome da UFCD no CNQ. Distinto do nome comercial.">
                        <input className={t.iCls} value={data.ufcd} onChange={e => patch({ ufcd: e.target.value })} />
                      </Field>
                    </div>
                  </div>
                )}
                <Field label="Slug" hint="Endereço público. Alterar um slug publicado parte ligações antigas.">
                  <div className="flex-1 flex items-center rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
                    <span className="px-3 text-[11px] font-mono text-slate-400 whitespace-nowrap">ena.pt/cursos/</span>
                    <input className={`flex-1 px-2 py-2 text-sm bg-white border-l border-slate-200 focus:outline-none focus:ring-2 ${t.ring}`}
                      value={data.slug} onChange={e => { setSlugLocked(false); patch({ slug: slugify(e.target.value) }); }} />
                  </div>
                </Field>
                {accent === "gold" ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <Field label="Tipo de curso"><SearchSelect value={data.tipo} onChange={v => patch({ tipo: v })} options={tipoOpts} /></Field>
                      <Field label="Categoria"><SearchSelect value={data.categoria} onChange={v => patch({ categoria: v })} options={categoriasGoldOpts} /></Field>
                      <Field label="Regime"><SearchSelect value={data.regime} onChange={v => patch({ regime: v })} options={regimeOpts} /></Field>
                      <Field label="Vídeo" hint="ID Vimeo ou URL">
                        <input className={t.iCls} value={data.video} onChange={e => patch({ video: e.target.value })} placeholder="384729105" />
                      </Field>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <Field label="Preço (€)"><input className={t.iCls} type="number" value={data.preco} onChange={e => patch({ preco: e.target.value })} /></Field>
                      <Field label="Horas"><input className={t.iCls} type="number" value={data.horas} onChange={e => patch({ horas: e.target.value })} /></Field>
                      <Field label="Tags" hint="Separadas por vírgula">
                        <input className={t.iCls} value={data.tags} onChange={e => patch({ tags: e.target.value })} placeholder="comunicacao, voz" />
                      </Field>
                      <Field label="Data de início">
                        <input className={t.iCls} type="date" value={data.dataInicio} onChange={e => patch({ dataInicio: e.target.value })} />
                      </Field>
                    </div>
                  </>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <Field label="Área"><SearchSelect value={data.categoria} onChange={v => patch({ categoria: v })} options={areasFinOpts} /></Field>
                    <Field label="Regime"><SearchSelect value={data.regime} onChange={v => patch({ regime: v })} options={regimeOpts} /></Field>
                    <Field label="Horas"><input className={t.iCls} type="number" value={data.horas} onChange={e => patch({ horas: e.target.value })} /></Field>
                    <Field label="Vídeo" hint="ID Vimeo ou URL">
                      <input className={t.iCls} value={data.video} onChange={e => patch({ video: e.target.value })} />
                    </Field>
                    <Field label="Tags" hint="Separadas por vírgula">
                      <input className={t.iCls} value={data.tags} onChange={e => patch({ tags: e.target.value })} placeholder="primeiros socorros, ufcd" />
                    </Field>
                    <Field label="Data de início">
                      <input className={t.iCls} type="date" value={data.dataInicio} onChange={e => patch({ dataInicio: e.target.value })} />
                    </Field>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "conteudo" && (
            <div className="space-y-4">
              <div className={`rounded-xl border px-4 py-3 text-sm ${t.note}`}>
                Cada bloco corresponde a uma secção da página pública. Escreva para o formando - não para a operação interna.
              </div>
              <EditorBlock accent={accent} label="Síntese do curso" siteHint="Primeiro parágrafo abaixo do banner. Responda: para quem é e o que se leva daqui." value={data.sintese} onChange={v => patch({ sintese: v })} rows={7} />
              <EditorBlock accent={accent} label="Objetivos" siteHint="Lista do que o formando será capaz de fazer. Uma ideia por linha." value={data.objetivos} onChange={v => patch({ objetivos: v })} rows={7} />
              <EditorBlock accent={accent} label="Programa / percurso" siteHint="Aulas virtuais ou módulos. Use títulos curtos e tópicos por baixo." value={data.programa} onChange={v => patch({ programa: v })} rows={10} />
              <EditorBlock accent={accent} label="Funcionamento" siteHint="Logística: sessões, elegibilidade, plataforma, assiduidade e certificado." value={data.funcionamento} onChange={v => patch({ funcionamento: v })} rows={7} />
            </div>
          )}

          {tab === "avaliacao" && (
            <div className="rounded-xl border border-violet-200 bg-white p-4 sm:p-5 space-y-4">
              <div>
                <p className="text-sm font-semibold text-slate-800">Parâmetros da folha de avaliação</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {accent === "fin"
                    ? "Usados nas entregas práticas desta UFCD (plano de sessão, exercícios). Escala 1-5. Não aparecem no website."
                    : "Usados nas simulações inicial e final das turmas deste curso. Escala 1-5. Não aparecem no website."}
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
                    <input className={t.iCls} value={c.label}
                      onChange={e => setCriterios(prev => prev.map(x => x.id === c.id ? { ...x, label: e.target.value } : x))} />
                    <button type="button" onClick={() => setCriterios(prev => prev.filter(x => x.id !== c.id))}
                      className="px-2 py-2 text-xs text-slate-400 hover:text-red-500" aria-label="Remover critério">Remover</button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input className={t.iCls} value={novoCriterio} placeholder="Novo critério (ex. Gestão do tempo)"
                  onChange={e => setNovoCriterio(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && novoCriterio.trim()) {
                      setCriterios(prev => [...prev, { id: slugCriterio(novoCriterio, prev), label: novoCriterio.trim() }]);
                      setNovoCriterio("");
                    }
                  }} />
                <button type="button"
                  onClick={() => {
                    if (!novoCriterio.trim()) return;
                    setCriterios(prev => [...prev, { id: slugCriterio(novoCriterio, prev), label: novoCriterio.trim() }]);
                    setNovoCriterio("");
                  }}
                  className="px-3 py-2 text-xs font-semibold rounded-lg border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 whitespace-nowrap">
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
                    <p className="text-xs text-slate-500 mt-0.5">Quando ativo, a página entra em ena.pt/cursos e nas listagens de formação financiada.</p>
                  </div>
                  <input type="checkbox" className={`mt-1 w-4 h-4 ${t.accentChk}`} checked={data.visivelSite}
                    onChange={e => patch({ visivelSite: e.target.checked, estado: e.target.checked ? "Ativo" : "Inactivo" })} />
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Estado interno">
                    <SearchSelect value={data.estado} onChange={v => patch({ estado: v, visivelSite: v === "Ativo" })}
                      options={[{ value: "Ativo" }, { value: "Inactivo" }]} />
                  </Field>
                  <Field label="Próxima data pública">
                    <input className={t.iCls} type="date" value={data.dataInicio} onChange={e => patch({ dataInicio: e.target.value })} />
                  </Field>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                <p className="text-sm font-semibold text-slate-800 mb-3">Checklist da página pública</p>
                <ul className="space-y-2">
                  {lista.map(c => (
                    <li key={c.id} className="flex items-center justify-between text-sm">
                      <span className={c.ok ? "text-slate-700" : "text-slate-500"}>{c.label}</span>
                      <span className={`text-xs font-semibold ${c.ok ? "text-emerald-600" : t.missing}`}>{c.ok ? "Pronto" : "Falta"}</span>
                    </li>
                  ))}
                </ul>
                {pct < 100 && (
                  <p className="text-xs text-slate-500 mt-4">
                    Faltam {lista.length - done} campos para a página ficar completa. Pode guardar na mesma - o site mostra o que já existe.
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
            <SitePreview data={data} accent={accent} />
          </div>
        </aside>
      </div>
    </div>
  );
}
