import { useEffect, useMemo, useRef, useState } from "react";
import { useCatalogList } from "./CatalogsContext";
import { AppModal, MultiSearchSelect, SearchSelect } from "./FormKit";
import { OptionSelect } from "./OptionSelect";
import { apiCursoFicha, apiSaveCursoFicha } from "./api";
import { CursoDocumentos } from "./CursoDocumentos";
import { DtpModeloEditor } from "./DtpModeloEditor";
import {
  avaliacaoPadrao,
  fracoesPeso,
  novoParametroId,
  parseAvaliacaoCurso,
  type AvaliacaoCurso,
} from "./avaliacaoCurso";
import { codigoTopico, horasDeTexto, juntarHoras, novoTopicoId, partirHoras, programaDePayload, type OrganizacaoPrograma, type TopicoPrograma } from "./cursoPrograma";
import { refereCurso } from "./cursoLocais";
import { fmtDataPt } from "./oferta";
import { getParametrosAvaliacao, type CriterioAvaliacao } from "./TurmaExtras";
import { useTurmas } from "./TurmasContext";
import { isTurmaActiva, lugaresLivres } from "./turmaModel";

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

type TabId = "identidade" | "oferta" | "conteudo" | "programa" | "planos" | "avaliacao" | "documentos" | "dtp" | "publicacao";
type PlanoCursoLinha = { ordem: number; objetivosGerais: string; objetivosEspecificos: string; conteudo: string };
type ValorFormadorLinha = { nome: string; valorHora: string };
type MediaSlot = { name: string; url: string };
type LocalCatalogo = { id: number; nome: string; morada: string; salas: number; turmas: number; status: string };

type CursoTurmaPrev = {
  id: number;
  nome: string;
  local: string;
  horario: string;
  dataInicio: string;
  vagasLivres: number;
  libertada: boolean;
};

type PrecoOferta = { id: string; local: string; horario: string; preco: string };

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
  locais: string[];
  organizacaoPrograma: OrganizacaoPrograma;
  topicosPrograma: TopicoPrograma[];
  avaliacaoCurso: AvaliacaoCurso;
  precosOferta: PrecoOferta[];
  planosSessao: PlanoCursoLinha[];
  valoresFormador: ValorFormadorLinha[];
  entidadeResponsavel: string;
};

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

function inputCls(base: string, invalid?: boolean) {
  return invalid ? `${base} border-red-400 focus:ring-red-400` : base;
}

function Field({ label, hint, error, required, children }: {
  label: string; hint?: string; error?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error ? <p className="text-[11px] text-red-600 leading-snug">{error}</p> : hint ? <p className="text-[11px] text-slate-400 leading-snug">{hint}</p> : null}
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

type CampoFalta = { key: string; label: string; tab: TabId };

function camposObrigatorios(d: CursoSite, accent: CursoAccent): CampoFalta[] {
  const out: CampoFalta[] = [];
  if (!d.titulo.trim()) out.push({ key: "titulo", label: accent === "fin" ? "Nome comercial" : "Título", tab: "identidade" });
  if (!d.slug.trim()) out.push({ key: "slug", label: "Slug", tab: "identidade" });
  if (accent === "fin") {
    if (!d.ufcdCod.trim()) out.push({ key: "ufcdCod", label: "Código UFCD", tab: "identidade" });
    if (!d.ufcd.trim()) out.push({ key: "ufcd", label: "Designação oficial", tab: "identidade" });
    if (!d.categoria.trim()) out.push({ key: "categoria", label: "Área", tab: "oferta" });
  } else {
    if (!d.tipo.trim()) out.push({ key: "tipo", label: "Tipo comercial", tab: "oferta" });
    if (!d.categoria.trim()) out.push({ key: "categoria", label: "Categoria", tab: "oferta" });
    if (!d.preco.trim() || Number(d.preco) < 0 || Number.isNaN(Number(d.preco))) {
      out.push({ key: "preco", label: "Preço", tab: "oferta" });
    }
  }
  if (!d.regime.trim()) out.push({ key: "regime", label: "Modalidade", tab: "oferta" });
  if (!d.horas.trim() || Number(d.horas) <= 0 || Number.isNaN(Number(d.horas))) {
    out.push({ key: "horas", label: "Horas", tab: "oferta" });
  }
  if (!d.tags.trim()) out.push({ key: "tags", label: "Tags", tab: "oferta" });
  if (!d.locais.length) out.push({ key: "locais", label: "Locais", tab: "oferta" });
  return out;
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
    tipo: accent === "fin" ? "Financiada" : (curso?.tipo ?? ""),
    categoria: areaFromCurso(curso) || pack.categoria,
    regime: curso?.regime ?? (accent === "fin" ? "e-learning" : "b-learning"),
    video: isComunicar ? "384729105" : isCcp ? "221904831" : finPack ? "551002210" : "",
    preco: accent === "fin" ? "" : String(curso?.preco ?? ""),
    horas: String(curso?.horas ?? ""),
    tags: curso ? ("tags" in pack ? pack.tags : "") : "",
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
    locais: [],
    organizacaoPrograma: accent === "fin" ? "modular" : (/comunicar/i.test(curso?.nome ?? "") ? "livre" : "modular"),
    topicosPrograma: topicosDeSeed(pack.programa, accent === "fin" ? "modular" : (/comunicar/i.test(curso?.nome ?? "") ? "livre" : "modular")),
    avaliacaoCurso: avaliacaoPadrao(),
    precosOferta: [],
    planosSessao: [],
    valoresFormador: [],
    entidadeResponsavel: "",
  };
}

function parsePrecosOferta(raw: unknown): PrecoOferta[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const row = item as { id?: unknown; local?: unknown; horario?: unknown; preco?: unknown };
    const local = String(row.local ?? "").trim();
    const horario = String(row.horario ?? "").trim();
    if (!local && !horario) return [];
    return [{
      id: String(row.id ?? `preco-${local}-${horario}`),
      local,
      horario,
      preco: String(row.preco ?? ""),
    }];
  });
}

function topicosDeSeed(texto: string, _org: OrganizacaoPrograma): TopicoPrograma[] {
  return texto.split(/\n/).map(s => s.trim()).filter(s => s && !s.startsWith("•") && !s.startsWith("-")).map(linha => {
    const titulo = linha
      .replace(/^(M|C|AV|EX)\s*\d+\s*[·.\-–:]+\s*/i, "")
      .replace(/^\d+\s*[.)\-–]\s*/, "")
      .replace(/\s*[·\-–]\s*\d+\s*h(?:\s*\d{1,2})?\s*(?:min)?\s*$/i, "")
      .trim();
    return { id: novoTopicoId(), titulo: titulo || linha, horas: horasDeTexto(linha) };
  });
}

function DuracaoTopico({ value, onChange, className }: { value: string; onChange: (v: string) => void; className: string }) {
  const partes = partirHoras(value);
  const minutos = partes.minutos || "00";
  return (
    <div className="flex items-center gap-1">
      <input
        className={`${className} w-14`}
        inputMode="numeric"
        aria-label="Horas"
        value={partes.horas}
        placeholder="0"
        onChange={e => onChange(juntarHoras(e.target.value, partes.minutos))}
      />
      <span className="text-xs font-bold text-slate-500">H</span>
      <input
        className={`${className} w-14`}
        inputMode="numeric"
        aria-label="Minutos"
        value={minutos}
        placeholder="00"
        onChange={e => onChange(juntarHoras(partes.horas, e.target.value))}
      />
      <span className="text-xs font-semibold text-slate-500">min</span>
    </div>
  );
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
    { id: "programa", label: "Programa", ok: d.topicosPrograma.some(t => t.titulo.trim()) || filled(d.programa) },
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

function SitePreview({ data, accent, turmas }: { data: CursoSite; accent: CursoAccent; turmas: CursoTurmaPrev[] }) {
  const t = theme(accent);
  const bullets = (txt: string) =>
    txt.split("\n").map(l => l.replace(/^[•\-]\s*/, "").trim()).filter(Boolean).slice(0, 5);
  const cta = accent === "fin" ? "Candidatar-me" : "Quero inscrever-me";
  const abertas = turmas.filter(x => x.libertada);
  const locais = [...new Set(abertas.map(x => x.local))];
  const [local, setLocal] = useState("");
  const [horario, setHorario] = useState("");
  useEffect(() => {
    if (local && !locais.includes(local)) { setLocal(""); setHorario(""); }
  }, [local, locais]);
  const horarios = [...new Set(abertas.filter(x => !local || x.local === local).map(x => x.horario))];
  const datas = abertas.filter(x => (!local || x.local === local) && (!horario || x.horario === horario));

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
          <section className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
            <p className={`text-[11px] font-bold uppercase tracking-wide ${t.preview}`}>Turmas disponíveis</p>
            <p className="text-[11px] text-slate-500">Local e horário vêm das turmas libertadas. Depois da local, só os horários dessa turma.</p>
            {abertas.length === 0 ? (
              <p className="text-xs text-slate-500">Ainda não há turma libertada deste curso. Crie a turma (local, horário, datas e vagas) e liberte-a.</p>
            ) : (
              <>
                <label className="block text-[11px] font-semibold text-slate-500">Local
                  <div className="mt-1">
                    <SearchSelect value={local} onChange={v => { setLocal(v); setHorario(""); }} options={locais.map(value => ({ value }))} allowEmpty placeholder="Todos os locais" />
                  </div>
                </label>
                <label className="block text-[11px] font-semibold text-slate-500">Horário
                  <div className="mt-1">
                    <SearchSelect value={horario} disabled={!local} onChange={setHorario} options={horarios.map(value => ({ value }))} allowEmpty placeholder={local ? "Seleccione o horário" : "Escolha primeiro o local"} />
                  </div>
                </label>
                <ul className="space-y-1.5 pt-1">
                  {datas.map(x => (
                    <li key={x.id} className="text-xs text-slate-700 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
                      <span className="font-semibold">{x.local}</span>
                      {" · "}{x.horario}
                      {" · "}{fmtDataPt(x.dataInicio)}
                      {" · "}{x.vagasLivres > 0 ? `${x.vagasLivres} vagas restantes` : "sem vagas restantes"}
                    </li>
                  ))}
                </ul>
              </>
            )}
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
  onCommit?: (saved: CursoFichaSeed) => void | Promise<number | undefined>;
  accent?: CursoAccent;
}) {
  const t = theme(accent);
  const { gold, fin } = useTurmas();
  const [locaisCat, setLocaisCat] = useCatalogList<LocalCatalogo>("locais", accent, []);
  const [horariosCat] = useCatalogList<{ id: number; nome: string; status?: string }>("horarios", accent === "fin" ? "fin" : "gold", []);
  const [tab, setTab] = useState<TabId>("identidade");
  const [data, setData] = useState<CursoSite>(() => seedSite(curso, accent));
  const [slugLocked, setSlugLocked] = useState(true);
  const [criterios, setCriterios] = useState<CriterioAvaliacao[]>(() => getParametrosAvaliacao(curso?.nome || curso?.ufcd).criterios);
  const [novoCriterio, setNovoCriterio] = useState("");
  const [saved, setSaved] = useState(false);
  const [erro, setErro] = useState("");
  const [gravando, setGravando] = useState(false);
  const [cursoPersistId, setCursoPersistId] = useState<number | undefined>(curso?.id);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [novoLocal, setNovoLocal] = useState(false);
  const [localNome, setLocalNome] = useState("");
  const [localMorada, setLocalMorada] = useState("");
  const [falhas, setFalhas] = useState<Record<string, string>>({});
  const locaisSeeded = useRef(false);

  useEffect(() => {
    const id = curso?.id;
    if (id == null) return;
    let alive = true;
    apiCursoFicha(accent, id)
      .then(r => {
        if (!alive || !r.ficha) return;
        const guardado = r.ficha.payload as Partial<CursoSite>;
        if (Object.keys(guardado).length) {
          setData(prev => {
            const locais = Array.isArray(guardado.locais) ? guardado.locais.map(String).filter(Boolean) : prev.locais;
            if (Array.isArray(guardado.locais)) locaisSeeded.current = true;
            const parsed = programaDePayload({ ...guardado } as Record<string, unknown>, accent);
            return {
              ...prev,
              ...guardado,
              locais,
              organizacaoPrograma: accent === "fin" ? "modular" : parsed.organizacao,
              topicosPrograma: parsed.topicos.length ? parsed.topicos : prev.topicosPrograma,
              avaliacaoCurso: parseAvaliacaoCurso({ ...guardado } as Record<string, unknown>),
              precosOferta: parsePrecosOferta(guardado.precosOferta),
              planosSessao: Array.isArray(guardado.planosSessao) ? guardado.planosSessao : prev.planosSessao,
              valoresFormador: Array.isArray(guardado.valoresFormador) ? guardado.valoresFormador : prev.valoresFormador,
              entidadeResponsavel: String(guardado.entidadeResponsavel ?? prev.entidadeResponsavel ?? ""),
            };
          });
        }
        if (r.ficha.criterios.length) setCriterios(r.ficha.criterios);
      })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [accent, curso?.id]);

  const temAvaliacao = accent === "gold"
    ? /ccp/i.test(data.titulo) || /ccp/i.test(data.categoria)
    : /pedagóg/i.test(data.titulo) || /pedagog/i.test(data.ufcd) || data.ufcdCod === "10394";
  const lista = checks(data, accent);
  const done = lista.filter(c => c.ok).length;
  const pct = Math.round((done / lista.length) * 100);

  const turmasCurso = useMemo<CursoTurmaPrev[]>(() => {
    const nome = data.titulo || curso?.nome || "";
    if (!nome) return [];
    if (accent === "gold") {
      return gold.filter(x => x.curso === nome || refereCurso(x.curso, { nome })).map(x => ({
        id: x.id,
        nome: x.nome,
        local: x.local,
        horario: x.horario,
        dataInicio: x.dataInicio,
        vagasLivres: Math.max(0, lugaresLivres(x)),
        libertada: isTurmaActiva(x),
      }));
    }
    return fin.filter(x => refereCurso(x.curso, {
      nome,
      nomeComercial: nome,
      ufcd: curso?.ufcd,
      ufcdCod: curso?.ufcdCod,
    })).map(x => ({
      id: x.id,
      nome: x.nome,
      local: x.local,
      horario: x.horario,
      dataInicio: x.dataInicio,
      vagasLivres: Math.max(0, lugaresLivres(x)),
      libertada: isTurmaActiva(x),
    }));
  }, [accent, gold, fin, data.titulo, curso?.nome, curso?.ufcd, curso?.ufcdCod]);

  const horariosPreco = useMemo(() => {
    const nomes = new Set<string>();
    for (const h of horariosCat) if (h.nome && h.status !== "Inactivo") nomes.add(h.nome);
    for (const t of turmasCurso) if (t.horario) nomes.add(t.horario);
    return [...nomes].sort((a, b) => a.localeCompare(b, "pt"));
  }, [horariosCat, turmasCurso]);

  const locaisPreco = useMemo(() => {
    const nomes = new Set<string>(data.locais.filter(Boolean));
    for (const t of turmasCurso) if (t.local) nomes.add(t.local);
    return [...nomes].sort((a, b) => a.localeCompare(b, "pt"));
  }, [data.locais, turmasCurso]);

  useEffect(() => {
    if (locaisSeeded.current) return;
    const fromTurmas = [...new Set(turmasCurso.map(x => x.local).filter(Boolean))];
    if (!fromTurmas.length) return;
    locaisSeeded.current = true;
    setData(prev => (prev.locais.length ? prev : { ...prev, locais: fromTurmas }));
  }, [turmasCurso]);

  const proximaTurma = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    return [...turmasCurso].filter(x => x.libertada && x.dataInicio >= hoje).sort((a, b) => a.dataInicio.localeCompare(b.dataInicio))[0]
      ?? [...turmasCurso].filter(x => x.libertada).sort((a, b) => a.dataInicio.localeCompare(b.dataInicio))[0];
  }, [turmasCurso]);

  const tabs = useMemo(() => {
    const base: { id: TabId; label: string }[] = [
      { id: "identidade", label: "Identidade" },
      { id: "oferta", label: "Oferta" },
      { id: "conteudo", label: "Conteúdo do site" },
      { id: "programa", label: "Programa" },
      { id: "planos", label: "Planos de sessão" },
      { id: "avaliacao", label: "Avaliação" },
      { id: "documentos", label: "Documentos" },
      { id: "dtp", label: "Dossiê TP" },
      { id: "publicacao", label: "Publicação" },
    ];
    return base;
  }, []);

  function patch(p: Partial<CursoSite>) {
    setData(prev => ({ ...prev, ...p }));
    setSaved(false);
    setErro("");
    setFalhas(prev => {
      const next = { ...prev };
      for (const k of Object.keys(p)) delete next[k];
      return next;
    });
  }

  function patchAv(p: Partial<AvaliacaoCurso>) {
    patch({ avaliacaoCurso: { ...data.avaliacaoCurso, ...p } });
  }

  function criarLocal() {
    const nome = localNome.trim();
    if (!nome) return;
    const existe = locaisCat.some(x => x.nome.toLowerCase() === nome.toLowerCase());
    if (!existe) {
      const id = Math.max(0, ...locaisCat.map(x => x.id), 1000) + 1;
      setLocaisCat(xs => [{ id, nome, morada: localMorada.trim(), salas: 0, turmas: 0, status: "Ativo" }, ...xs]);
    }
    patch({ locais: data.locais.includes(nome) ? data.locais : [...data.locais, nome] });
    setLocalNome("");
    setLocalMorada("");
    setNovoLocal(false);
  }

  async function guardar(opts?: { rascunho?: boolean }) {
    const faltas = opts?.rascunho ? [] : camposObrigatorios(data, accent);
    if (opts?.rascunho && !data.titulo.trim()) return;
    if (faltas.length) {
      setFalhas(Object.fromEntries(faltas.map(f => [f.key, `${f.label} é obrigatório para criar o curso.`])));
      setErro(`Falta preencher: ${faltas.map(f => f.label).join(", ")}.`);
      setTab(faltas[0]!.tab);
      setPreviewOpen(false);
      return;
    }
    if (!opts?.rascunho && accent === "gold" && data.precosOferta.some(p => (!p.local.trim() && !p.horario.trim()) || p.preco.trim() === "" || Number(p.preco) < 0 || Number.isNaN(Number(p.preco)))) {
      setFalhas({ precosOferta: "Cada preço especial precisa de um local, um horário, ou os dois, e de um valor." });
      setErro("Há um preço por local ou horário incompleto.");
      setTab("oferta");
      setPreviewOpen(false);
      return;
    }
    setFalhas({});
    setGravando(true);
    setErro("");
    let id = cursoPersistId ?? curso?.id;
    const draftId = id ?? (Date.now() % 100000);
    if (onCommit && data.titulo.trim()) {
      const realId = await onCommit({
        id: draftId,
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
      if (typeof realId === "number") id = realId;
    }
    if (id == null) {
      setErro("O curso não chegou a gravar na base. Tente outra vez.");
      setGravando(false);
      return;
    }
    setCursoPersistId(id);
    try {
      await apiSaveCursoFicha(accent, id, {
        payload: {
          ...data,
          organizacaoPrograma: accent === "fin" ? "modular" : data.organizacaoPrograma,
          avaliacaoCurso: data.avaliacaoCurso,
        } as unknown as Record<string, unknown>,
        criterios: temAvaliacao ? criterios.filter(c => c.label.trim()) : [],
      });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2400);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível gravar a ficha no servidor.");
    } finally {
      setGravando(false);
    }
  }

  const metaLine = accent === "fin"
    ? [data.ufcdCod ? `UFCD ${data.ufcdCod}` : "UFCD", data.horas ? `${data.horas}h` : "-", data.regime || "regime", data.slug ? `/cursos/${data.slug}` : ""]
        .filter(Boolean).join(" · ")
    : [data.tipo || "Tipo", data.horas ? `${data.horas}h` : "-", data.regime || "regime", data.slug ? `/cursos/${data.slug}` : ""]
        .filter(Boolean).join(" · ");

  return (
    <div className="-m-4 sm:-m-5 min-h-[calc(100vh-7.5rem)] flex flex-col bg-slate-100">
      <header className="relative z-10 bg-white border-b border-slate-200">
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
            <button type="button" disabled={gravando} onClick={() => void guardar()} className={`px-4 py-2 ${t.save} disabled:opacity-50 text-white text-sm font-semibold rounded-lg shadow-sm`}>
              {gravando ? "A gravar…" : saved ? "Guardado" : "Guardar"}
            </button>
          </div>
        </div>
        {erro && <p className="px-4 sm:px-6 pb-2 text-xs font-semibold text-red-600">{erro}</p>}
        <div className="px-4 sm:px-6 flex gap-1 overflow-x-auto">
          {tabs.map(x => (
            <button key={x.id} type="button" onClick={() => {
              if ((x.id === "documentos" || x.id === "dtp" || x.id === "avaliacao") && (cursoPersistId ?? curso?.id) == null) {
                void guardar({ rascunho: true });
              }
              setTab(x.id);
              setPreviewOpen(false);
            }}
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
                <Field label={accent === "fin" ? "Nome comercial" : "Título"} required error={falhas.titulo} hint={accent === "fin" ? "Título no website. Pode ser mais comercial do que a designação oficial da UFCD." : "Nome comercial no website. Evite códigos internos."}>
                  <input className={inputCls(t.iCls, !!falhas.titulo)} value={data.titulo}
                    onChange={e => { const titulo = e.target.value; patch({ titulo, slug: slugLocked ? slugify(titulo) : data.slug }); }}
                    onBlur={() => { if ((cursoPersistId ?? curso?.id) == null) void guardar({ rascunho: true }); }} />
                </Field>
                {accent === "fin" && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Field label="Código UFCD" required error={falhas.ufcdCod} hint="Catálogo Nacional de Qualificações">
                      <input className={inputCls(t.iCls, !!falhas.ufcdCod)} value={data.ufcdCod} onChange={e => patch({ ufcdCod: e.target.value.replace(/\D/g, "").slice(0, 6) })} placeholder="3564" />
                    </Field>
                    <div className="sm:col-span-2">
                      <Field label="Designação oficial" required error={falhas.ufcd} hint="Nome da UFCD no CNQ. Distinto do nome comercial.">
                        <input className={inputCls(t.iCls, !!falhas.ufcd)} value={data.ufcd} onChange={e => patch({ ufcd: e.target.value })} />
                      </Field>
                    </div>
                  </div>
                )}
                <Field label="Slug" required error={falhas.slug} hint="Endereço público. Alterar um slug publicado parte ligações antigas.">
                  <div className={`flex-1 flex items-center rounded-lg border overflow-hidden ${falhas.slug ? "border-red-400" : "border-slate-200 bg-slate-50"}`}>
                    <span className="px-3 text-[11px] font-mono text-slate-400 whitespace-nowrap">ena.pt/cursos/</span>
                    <input className={`flex-1 px-2 py-2 text-sm bg-white border-l border-slate-200 focus:outline-none focus:ring-2 ${t.ring}`}
                      value={data.slug} onChange={e => { setSlugLocked(false); patch({ slug: slugify(e.target.value) }); }} />
                  </div>
                </Field>
                <Field label="Vídeo" hint="ID Vimeo ou URL do vídeo de apresentação">
                  <input className={t.iCls} value={data.video} onChange={e => patch({ video: e.target.value })} placeholder="384729105" />
                </Field>
              </div>
            </div>
          )}

          {tab === "oferta" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Dados da oferta</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Gold ou Financiada vem do menu onde criou o curso. Aqui só completa o que o catálogo e a página precisam - os campos com * são obrigatórios.
                  </p>
                </div>
                <div className={`rounded-xl border px-3 py-2.5 ${accent === "fin" ? "border-blue-200 bg-blue-50" : "border-amber-200 bg-amber-50"}`}>
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${accent === "fin" ? "text-blue-700" : "text-amber-800"}`}>Canal (pela rota)</p>
                  <p className={`text-sm font-semibold ${accent === "fin" ? "text-blue-900" : "text-amber-950"}`}>
                    {accent === "fin" ? "Financiada" : "Gold / autofinanciada"}
                  </p>
                  <p className={`text-[11px] mt-0.5 ${accent === "fin" ? "text-blue-800" : "text-amber-900"}`}>
                    {accent === "fin"
                      ? "Abriu «Novo curso» em Financiada, por isso esta ficha é uma UFCD. Não volta a escolher Gold."
                      : "Abriu «Novo curso» em Gold, por isso esta ficha é autofinanciada. Não volta a escolher Financiada."}
                  </p>
                </div>
                {accent === "gold" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <Field label="Tipo comercial" required error={falhas.tipo} hint="E-learning: a pessoa paga e recebe acesso ao curso. Pré-inscrição: entra numa turma e a documentação tem de ser validada.">
                      <OptionSelect lista="tipos_curso" value={data.tipo} onChange={v => patch({ tipo: v })} />
                    </Field>
                    <Field label="Categoria" required error={falhas.categoria}>
                      <OptionSelect lista="categorias_gold" value={data.categoria} onChange={v => patch({ categoria: v })} />
                    </Field>
                    <Field label="Modalidade" required error={falhas.regime} hint="b-learning, e-learning ou presencial.">
                      <OptionSelect lista="regimes_curso" value={data.regime} onChange={v => patch({ regime: v })} />
                    </Field>
                    <Field label="Preço (€)" required error={falhas.preco}>
                      <input className={inputCls(t.iCls, !!falhas.preco)} type="number" min={0} value={data.preco} onChange={e => patch({ preco: e.target.value })} />
                    </Field>
                    <Field label="Horas" required error={falhas.horas}>
                      <input className={inputCls(t.iCls, !!falhas.horas)} type="number" min={1} value={data.horas} onChange={e => patch({ horas: e.target.value })} />
                    </Field>
                    <Field label="Tags" required error={falhas.tags} hint="Separadas por vírgula">
                      <input className={inputCls(t.iCls, !!falhas.tags)} value={data.tags} onChange={e => patch({ tags: e.target.value })} placeholder="comunicacao, voz" />
                    </Field>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <Field label="Área" required error={falhas.categoria}>
                      <OptionSelect lista="areas_fin" value={data.categoria} onChange={v => patch({ categoria: v })} />
                    </Field>
                    <Field label="Modalidade" required error={falhas.regime} hint="b-learning, e-learning ou presencial.">
                      <OptionSelect lista="regimes_curso" value={data.regime} onChange={v => patch({ regime: v })} />
                    </Field>
                    <Field label="Horas" required error={falhas.horas}>
                      <input className={inputCls(t.iCls, !!falhas.horas)} type="number" min={1} value={data.horas} onChange={e => patch({ horas: e.target.value })} />
                    </Field>
                    <Field label="Tags" required error={falhas.tags} hint="Separadas por vírgula">
                      <input className={inputCls(t.iCls, !!falhas.tags)} value={data.tags} onChange={e => patch({ tags: e.target.value })} placeholder="primeiros socorros, ufcd" />
                    </Field>
                  </div>
                )}
                <Field
                  label="Locais deste curso"
                  required
                  error={falhas.locais}
                  hint="Pelo menos um polo. O «+» cria um local no catálogo. Horário, datas e vagas só se definem ao criar a turma."
                >
                  <div className={falhas.locais ? "rounded-lg ring-2 ring-red-300" : ""}>
                    <MultiSearchSelect
                      values={data.locais}
                      onChange={v => patch({ locais: v })}
                      options={locaisCat.filter(x => x.status !== "Inactivo").map(x => ({ value: x.nome, sub: x.morada }))}
                      placeholder="Pesquisar local…"
                      noneLabel="Escolher locais…"
                      unitSingular="local"
                      unitPlural="locais"
                      onAdd={() => { setLocalNome(""); setLocalMorada(""); setNovoLocal(true); }}
                      addLabel="Novo local"
                    />
                  </div>
                </Field>
                {accent === "gold" && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Preço por local e horário</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        O preço acima vale para o curso inteiro. Aqui pode fixar outro valor para um local, para um horário, ou para os dois ao mesmo tempo. Se coincidirem, vale a regra com local e horário.
                      </p>
                    </div>
                    {data.precosOferta.length === 0 && (
                      <p className="text-xs text-slate-400">Ainda sem preços especiais. A pré-inscrição usa o preço do curso.</p>
                    )}
                    <div className="space-y-2">
                      {data.precosOferta.map(row => (
                        <div key={row.id} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_7rem_auto] gap-2 items-end">
                          <div>
                            <p className="text-[11px] font-semibold text-slate-500 uppercase mb-1">Local</p>
                            <SearchSelect
                              value={row.local}
                              onChange={v => patch({ precosOferta: data.precosOferta.map(p => p.id === row.id ? { ...p, local: v } : p) })}
                              options={locaisPreco.map(value => ({ value }))}
                              allowEmpty
                              placeholder="Qualquer local"
                            />
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold text-slate-500 uppercase mb-1">Horário</p>
                            <SearchSelect
                              value={row.horario}
                              onChange={v => patch({ precosOferta: data.precosOferta.map(p => p.id === row.id ? { ...p, horario: v } : p) })}
                              options={horariosPreco.map(value => ({ value }))}
                              allowEmpty
                              placeholder="Qualquer horário"
                            />
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold text-slate-500 uppercase mb-1">Preço (€)</p>
                            <input
                              className={inputCls(t.iCls, !!falhas.precosOferta)}
                              type="number"
                              min={0}
                              value={row.preco}
                              onChange={e => patch({ precosOferta: data.precosOferta.map(p => p.id === row.id ? { ...p, preco: e.target.value } : p) })}
                            />
                          </div>
                          <button
                            type="button"
                            className="px-2 py-2 text-xs font-semibold text-slate-500 hover:text-red-600"
                            onClick={() => patch({ precosOferta: data.precosOferta.filter(p => p.id !== row.id) })}
                          >
                            Remover
                          </button>
                        </div>
                      ))}
                    </div>
                    {falhas.precosOferta && <p className="text-[11px] text-red-600">{falhas.precosOferta}</p>}
                    <button
                      type="button"
                      className="text-xs font-semibold text-amber-700"
                      onClick={() => patch({
                        precosOferta: [...data.precosOferta, { id: `preco-${Date.now()}`, local: "", horario: "", preco: data.preco }],
                      })}
                    >
                      + Adicionar preço
                    </button>
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Valor base por formador</p>
                  <p className="text-xs text-slate-500 mt-0.5">Opcional e só interno. Não entra na página pública nem no percurso do formando. A turma pode sobrepor este valor.</p>
                </div>
                {data.valoresFormador.map((row, i) => (
                  <div key={`${row.nome}-${i}`} className="grid grid-cols-1 sm:grid-cols-[1fr_8rem_auto] gap-2">
                    <input className={t.iCls} value={row.nome} placeholder="Nome do formador" onChange={e => patch({ valoresFormador: data.valoresFormador.map((v, j) => j === i ? { ...v, nome: e.target.value } : v) })} />
                    <input className={t.iCls} type="number" min={0} step="0.5" value={row.valorHora} placeholder="€/h" onChange={e => patch({ valoresFormador: data.valoresFormador.map((v, j) => j === i ? { ...v, valorHora: e.target.value } : v) })} />
                    <button type="button" className="text-xs font-semibold text-slate-500" onClick={() => patch({ valoresFormador: data.valoresFormador.filter((_, j) => j !== i) })}>Remover</button>
                  </div>
                ))}
                <button type="button" className={`px-3 py-2 text-xs font-semibold rounded-lg text-white ${t.save}`} onClick={() => patch({ valoresFormador: [...data.valoresFormador, { nome: "", valorHora: "" }] })}>+ Formador</button>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Turmas deste curso</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Na página pública o visitante escolhe o local e, a seguir, o horário das turmas libertadas. Crie a turma para atribuir local, horário, início, fim e vagas.
                  </p>
                </div>
                {turmasCurso.length === 0 ? (
                  <p className="text-sm text-slate-500 rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center">
                    Ainda não há turmas. Quando existirem (e estiverem libertadas), aparecem sozinhas nesta lista e na página do curso.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                    {turmasCurso.map(x => (
                      <li key={x.id} className="px-3 py-2.5 flex flex-wrap items-center justify-between gap-2 text-sm">
                        <div>
                          <p className="font-semibold text-slate-800">{x.local} · {x.horario}</p>
                          <p className="text-xs text-slate-500">{x.nome} · início {fmtDataPt(x.dataInicio)} · {x.vagasLivres > 0 ? `${x.vagasLivres} vagas restantes` : "sem vagas restantes"}</p>
                        </div>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${x.libertada ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                          {x.libertada ? "Libertada" : "Não libertada"}
                        </span>
                      </li>
                    ))}
                  </ul>
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
              <EditorBlock accent={accent} label="Programa no site" siteHint="Texto público. A estrutura pedagógica (módulos ou capítulos) configura-se no separador Programa." value={data.programa} onChange={v => patch({ programa: v })} rows={10} />
              <EditorBlock accent={accent} label="Funcionamento" siteHint="Logística: sessões, elegibilidade, plataforma, assiduidade e certificado." value={data.funcionamento} onChange={v => patch({ funcionamento: v })} rows={7} />
            </div>
          )}

          {tab === "programa" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Programa pedagógico</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Estas unidades aparecem no cronograma e na nova sessão da turma. Não confundir com o texto do website.
                  </p>
                </div>
                {accent === "gold" ? (
                  <Field label="Organização" hint="Modular numera M1, M2, M3… Programa livre numera C1, C2, C3… (capítulos).">
                    <SearchSelect
                      value={data.organizacaoPrograma === "livre" ? "Programa livre" : "Modular"}
                      onChange={v => patch({ organizacaoPrograma: v === "Programa livre" ? "livre" : "modular" })}
                      options={[{ value: "Modular" }, { value: "Programa livre" }]}
                    />
                  </Field>
                ) : (
                  <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5 text-xs text-blue-900">
                    As formações financiadas são sempre <span className="font-semibold">modulares</span> (M1, M2, M3…). A organização não se altera.
                  </div>
                )}
                <div className="space-y-2">
                  {data.topicosPrograma.map((topico, i) => (
                    <div key={topico.id} className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50/60 p-2.5">
                      <span className={`mt-2 w-10 flex-shrink-0 text-xs font-bold ${accent === "fin" ? "text-blue-700" : "text-amber-700"}`}>
                        {codigoTopico(accent === "fin" ? "modular" : data.organizacaoPrograma, i)}
                      </span>
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-2">
                        <input
                          className={t.iCls}
                          value={topico.titulo}
                          placeholder={data.organizacaoPrograma === "livre" && accent !== "fin" ? "Título do capítulo" : "Título do módulo"}
                          onChange={e => patch({
                            topicosPrograma: data.topicosPrograma.map(x => x.id === topico.id ? { ...x, titulo: e.target.value } : x),
                          })}
                        />
                        <DuracaoTopico
                          className={t.iCls}
                          value={topico.horas}
                          onChange={horas => patch({
                            topicosPrograma: data.topicosPrograma.map(x => x.id === topico.id ? { ...x, horas } : x),
                          })}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <button type="button" disabled={i === 0}
                          onClick={() => {
                            const next = [...data.topicosPrograma];
                            [next[i - 1], next[i]] = [next[i]!, next[i - 1]!];
                            patch({ topicosPrograma: next });
                          }}
                          className="px-2 py-1 text-[10px] font-semibold text-slate-500 hover:text-slate-800 disabled:opacity-30">↑</button>
                        <button type="button" disabled={i === data.topicosPrograma.length - 1}
                          onClick={() => {
                            const next = [...data.topicosPrograma];
                            [next[i + 1], next[i]] = [next[i]!, next[i + 1]!];
                            patch({ topicosPrograma: next });
                          }}
                          className="px-2 py-1 text-[10px] font-semibold text-slate-500 hover:text-slate-800 disabled:opacity-30">↓</button>
                      </div>
                      <button type="button"
                        onClick={() => patch({ topicosPrograma: data.topicosPrograma.filter(x => x.id !== topico.id) })}
                        className="px-2 py-2 text-xs text-slate-400 hover:text-red-500">Remover</button>
                    </div>
                  ))}
                  {data.topicosPrograma.length === 0 && (
                    <p className="text-sm text-slate-500 rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center">
                      Ainda não há {accent === "fin" || data.organizacaoPrograma === "modular" ? "módulos" : "capítulos"}. Adicione o primeiro.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => patch({
                    topicosPrograma: [...data.topicosPrograma, { id: novoTopicoId(), titulo: "", horas: "" }],
                  })}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg text-white ${t.save}`}
                >
                  + {accent === "fin" || data.organizacaoPrograma === "modular" ? "Módulo" : "Capítulo"}
                </button>
              </div>
            </div>
          )}

          {tab === "planos" && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
              <div>
                <p className="text-sm font-semibold text-slate-800">Plano de cada sessão</p>
                <p className="text-xs text-slate-500 mt-0.5">A turma herda este plano pela ordem da sessão. Se a sessão ainda não tiver plano gravado, a ficha da turma abre já preenchida com este texto.</p>
              </div>
              {data.planosSessao.length === 0 && (
                <p className="text-sm text-slate-500 rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center">Ainda sem planos. Acrescente a primeira sessão.</p>
              )}
              {data.planosSessao.map((linha, i) => (
                <div key={linha.ordem} className="rounded-lg border border-slate-100 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-500">Sessão {linha.ordem}</p>
                    <button type="button" className="text-xs text-slate-400" onClick={() => patch({ planosSessao: data.planosSessao.filter((_, j) => j !== i).map((p, j) => ({ ...p, ordem: j + 1 })) })}>Remover</button>
                  </div>
                  <textarea className={t.iCls} rows={2} placeholder="Objetivos gerais" value={linha.objetivosGerais} onChange={e => patch({ planosSessao: data.planosSessao.map((p, j) => j === i ? { ...p, objetivosGerais: e.target.value } : p) })} />
                  <textarea className={t.iCls} rows={2} placeholder="Objetivos específicos" value={linha.objetivosEspecificos} onChange={e => patch({ planosSessao: data.planosSessao.map((p, j) => j === i ? { ...p, objetivosEspecificos: e.target.value } : p) })} />
                  <textarea className={t.iCls} rows={3} placeholder="Conteúdo do desenvolvimento" value={linha.conteudo} onChange={e => patch({ planosSessao: data.planosSessao.map((p, j) => j === i ? { ...p, conteudo: e.target.value } : p) })} />
                </div>
              ))}
              <button type="button" className={`px-3 py-2 text-xs font-semibold rounded-lg text-white ${t.save}`} onClick={() => patch({ planosSessao: [...data.planosSessao, { ordem: data.planosSessao.length + 1, objetivosGerais: "", objetivosEspecificos: "", conteudo: "" }] })}>+ Sessão</button>
            </div>
          )}

          {tab === "avaliacao" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Parâmetros de avaliação do curso</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    A avaliação é sempre por formando e todos os parâmetros têm de ser preenchidos. Na turma, o formador lança as notas nesta grelha.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Modo" hint={data.avaliacaoCurso.modo === "modulos"
                    ? `Nota de cada ${data.organizacaoPrograma === "livre" ? "capítulo" : "módulo"} = soma (nota × peso). Nota final = média dessas notas.`
                    : "Cada parâmetro avalia-se uma vez. Nota final = soma (nota × peso)."}>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button"
                        onClick={() => patchAv({ modo: "final" })}
                        className={`px-3 py-2 text-xs font-semibold rounded-lg border ${
                          data.avaliacaoCurso.modo === "final"
                            ? `${t.save} text-white border-transparent`
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}>
                        Avaliação final
                      </button>
                      <button type="button"
                        onClick={() => patchAv({ modo: "modulos" })}
                        className={`px-3 py-2 text-xs font-semibold rounded-lg border ${
                          data.avaliacaoCurso.modo === "modulos"
                            ? `${t.save} text-white border-transparent`
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}>
                        {data.organizacaoPrograma === "livre" ? "Por capítulo" : "Por módulo"}
                      </button>
                    </div>
                  </Field>
                  <Field label="Unidade da escala" hint="Ex. valores, %, pontos">
                    <input className={t.iCls} value={data.avaliacaoCurso.unidade}
                      onChange={e => patchAv({ unidade: e.target.value })} />
                  </Field>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Mínimo da escala">
                    <input className={t.iCls} type="number" value={data.avaliacaoCurso.escalaMin}
                      onChange={e => patchAv({ escalaMin: Number(e.target.value) })} />
                  </Field>
                  <Field label="Máximo da escala">
                    <input className={t.iCls} type="number" value={data.avaliacaoCurso.escalaMax}
                      onChange={e => patchAv({ escalaMax: Number(e.target.value) })} />
                  </Field>
                  <Field label="Mínimo para aprovação">
                    <input className={t.iCls} type="number" value={data.avaliacaoCurso.minimoAprovacao}
                      onChange={e => patchAv({ minimoAprovacao: Number(e.target.value) })} />
                  </Field>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "0 a 20 valores", escalaMin: 0, escalaMax: 20, unidade: "valores", minimoAprovacao: 10 },
                    { label: "0 a 100 %", escalaMin: 0, escalaMax: 100, unidade: "%", minimoAprovacao: 50 },
                    { label: "1 a 5 pontos", escalaMin: 1, escalaMax: 5, unidade: "pontos", minimoAprovacao: 3 },
                  ].map(p => (
                    <button key={p.label} type="button"
                      onClick={() => patchAv(p)}
                      className="px-2.5 py-1 text-[11px] font-semibold rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50">
                      {p.label}
                    </button>
                  ))}
                </div>
                <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" className={`mt-0.5 w-4 h-4 ${t.accentChk}`}
                    checked={data.avaliacaoCurso.pesosEquitativos}
                    onChange={e => patchAv({ pesosEquitativos: e.target.checked })} />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Pesos equitativos</p>
                    <p className="text-xs text-slate-500 mt-0.5">Cada parâmetro vale o mesmo. Desative para atribuir um peso individual.</p>
                  </div>
                </label>
                {data.avaliacaoCurso.parametros.length === 0 && (
                  <p className="text-sm text-slate-500 rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center">
                    Ainda não há parâmetros. Adicione o primeiro (ex. Assiduidade, Trabalho prático, Teste).
                  </p>
                )}
                <div className="space-y-2">
                  {data.avaliacaoCurso.parametros.map((p, i) => {
                    const frac = fracoesPeso(data.avaliacaoCurso)[p.id] ?? 0;
                    return (
                      <div key={p.id} className="flex items-center gap-2">
                        <span className="text-xs font-mono text-slate-400 w-5">{i + 1}</span>
                        <input className={t.iCls} value={p.label} placeholder="Nome do parâmetro"
                          onChange={e => patchAv({
                            parametros: data.avaliacaoCurso.parametros.map(x => x.id === p.id ? { ...x, label: e.target.value } : x),
                          })} />
                        <input className={`${t.iCls} w-24`} type="number" min={0} step="0.1"
                          disabled={data.avaliacaoCurso.pesosEquitativos}
                          value={p.peso}
                          onChange={e => patchAv({
                            parametros: data.avaliacaoCurso.parametros.map(x => x.id === p.id ? { ...x, peso: Number(e.target.value) || 0 } : x),
                          })} />
                        <span className="text-[11px] text-slate-400 w-12 text-right">{Math.round(frac * 100)}%</span>
                        <button type="button"
                          onClick={() => patchAv({ parametros: data.avaliacaoCurso.parametros.filter(x => x.id !== p.id) })}
                          className="px-2 py-2 text-xs text-slate-400 hover:text-red-500">Remover</button>
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => patchAv({
                    parametros: [...data.avaliacaoCurso.parametros, { id: novoParametroId(), label: "", peso: 1 }],
                  })}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg text-white ${t.save}`}
                >
                  + Parâmetro
                </button>
              </div>

              {temAvaliacao && (
                <div className="rounded-xl border border-violet-200 bg-white p-4 sm:p-5 space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Folha de simulação (escala 1 a 5)</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {accent === "fin"
                        ? "Critérios das entregas práticas desta UFCD (plano de sessão, exercícios). Não entram na pauta ponderada acima."
                        : "Critérios das simulações inicial e final. Não entram na pauta ponderada acima."}
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
            </div>
          )}

          {tab === "documentos" && (
            <CursoDocumentos accent={accent} cursoId={cursoPersistId ?? curso?.id} tipo={data.tipo} />
          )}

          {tab === "dtp" && (
            <DtpModeloEditor
              accent={accent}
              cursoId={curso?.id}
              entidadeNome={data.entidadeResponsavel}
              onEntidade={nome => patch({ entidadeResponsavel: nome })}
            />
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
                  <Field label="Próxima data pública" hint="Calculada a partir da próxima turma libertada. Não se edita aqui - muda ao criar ou libertar a turma.">
                    <input className={t.iCls} type="text" readOnly value={proximaTurma ? `${fmtDataPt(proximaTurma.dataInicio)} · ${proximaTurma.local} · ${proximaTurma.horario}` : "Sem turma libertada"} />
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
          <div className="xl:sticky xl:top-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Página no website</p>
              <span className={`text-[11px] font-semibold ${data.visivelSite ? "text-emerald-600" : "text-slate-400"}`}>
                {data.visivelSite ? "Publicada" : "Rascunho"}
              </span>
            </div>
            <SitePreview data={data} accent={accent} turmas={turmasCurso} />
          </div>
        </aside>
      </div>
      <AppModal
        open={novoLocal}
        onClose={() => setNovoLocal(false)}
        title="Novo local"
        sub="Fica no catálogo de locais e fica associado a este curso."
        size="sm"
        footer={(
          <>
            <button type="button" onClick={() => setNovoLocal(false)} className="px-4 py-2 border border-slate-200 text-sm text-slate-600 rounded-lg">Cancelar</button>
            <button type="button" disabled={!localNome.trim()} onClick={criarLocal}
              className={`px-4 py-2 ${t.save} disabled:opacity-40 text-white text-sm font-semibold rounded-lg`}>Guardar</button>
          </>
        )}
      >
        <div className="p-5 space-y-3">
          <Field label="Nome">
            <input autoFocus className={t.iCls} value={localNome} onChange={e => setLocalNome(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); criarLocal(); } }}
              placeholder="Ex.: V.N.Gaia" />
          </Field>
          <Field label="Morada / plataforma" hint="Opcional. Pode completar depois em Edição de Cursos → Locais.">
            <input className={t.iCls} value={localMorada} onChange={e => setLocalMorada(e.target.value)} placeholder="Rua… ou Sala Virtual" />
          </Field>
        </div>
      </AppModal>
    </div>
  );
}
