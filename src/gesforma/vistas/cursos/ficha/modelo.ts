// Modelo da ficha do curso: tipos, valores iniciais (vindos dos modelos de conteúdo da base de dados) e validação.
import { TOPICOS_CURSO, topicosDoPayload } from "../../../../partilhado/topicosCurso";
import type { Opcao } from "../../../../partilhado/api/catalogos";
import { avaliacaoCcp, avaliacaoPadrao, cursoECcp, parseAvaliacaoCurso, type AvaliacaoCurso } from "../../../avaliacaoCurso";
import { linhasPrincipais, modeloAplica, programaDePayload, topicosDeTexto, type OrganizacaoPrograma, type TopicoPrograma } from "../../../cursoPrograma";
import { parseConteudosMoodle, type ConteudoMoodle } from "../../../ConteudosMoodle";
import { idsTurmasMoodleNovo } from "../../../../partilhado/moodle";
import { normalizarPlanoCurso, type PlanoCurso } from "../../../planosCurso";
import { codigoCursoValido } from "../../../../partilhado/codigoCurso";
import { regimeSincronia, type RegimeSincronia } from "../../../../partilhado/regimeSincronia";

export type Regime = "gold" | "fin";
export type TabId = "identidade" | "oferta" | "conteudo" | "programa" | "moodle" | "planos" | "avaliacao" | "documentos" | "dtp" | "publicacao";
export type MediaSlot = { name: string; url: string };
export type PrecoOferta = { id: string; local: string; horario: string; preco: string };
/** Plano de sessão do curso (plano completo e sumário padrão); a turma recebe-o pela ordem da sessão. */
export type PlanoLinha = PlanoCurso;
export type ValorFormador = { nome: string; valorHora: string };

/** Dados base do curso (tabela cursos_gold / cursos_fin). */
export type CursoBase = {
  id?: number; nome: string; categoria?: string; tipo?: string; preco?: number; regime: string; horas: number; estado: string;
  ufcdCod?: string; ufcd?: string; areaCnaef?: string; entidadeResponsavelId?: number | null;
};

export type ContactosLocal = { telemovel: string; telefone: string; email: string; whatsapp: string };

export type CursoSite = {
  titulo: string; slug: string; tipo: string; categoria: string; regime: string; video: string; preco: string; horas: string;
  tags: string; dataInicio: string; estado: string; visivelSite: boolean;
  banner: MediaSlot | null; capa: MediaSlot | null; miniatura: MediaSlot | null;
  /** Texto completo (página do curso). */
  sintese: string; objetivos: string; programa: string;
  /** Antigo texto único; passou a «Metodologias» (um dos 4 tópicos). */
  funcionamento: string;
  /** Os 4 tópicos da página do curso (partilhado/topicosCurso.ts). */
  metodologias: string; certificacao: string; destinatarios: string; requisitos: string;
  /** Texto de destaque (catálogo, cartões e listagens); vazio = a síntese cortada numa palavra com «…». */
  resumo: string;
  /** Pesquisa (Google): título e descrição próprios; vazios = o título e o texto de destaque. */
  seoTitulo: string; seoDescricao: string;
  /** Contactos próprios deste curso por local (só valem para os locais atribuídos ao curso); vazio = os de Locais. */
  contactosLocais: Record<string, ContactosLocal>;
  ufcdCod: string; ufcd: string; locais: string[];
  /** Financiada: área de formação CNAEF (guardada no curso, não na ficha do site). */
  areaCnaef: string;
  /** Regime da oferta: síncrono ou assíncrono (não confundir com `regime`, que guarda a modalidade). */
  regimeSincronia: RegimeSincronia;
  /** Financiada: programa (Edição de cursos › Programas) que as turmas do curso usam quando não escolhem outro. */
  programaFin: string;
  organizacaoPrograma: OrganizacaoPrograma; topicosPrograma: TopicoPrograma[];
  avaliacaoCurso: AvaliacaoCurso; precosOferta: PrecoOferta[]; planosSessao: PlanoLinha[];
  valoresFormador: ValorFormador[]; entidadeResponsavel: string; conteudosMoodle: ConteudoMoodle[];
  /** Endereço do curso no Moodle (b-learning, e-learning assíncrono ou misto): aparece na página de entrada do site. */
  moodleUrl: string;
  /** Moodle novo (enquanto o atual é refeito): turmas que começam a partir de `moodleNovoDesde` e as escolhidas. */
  moodleNovoUrl: string; moodleNovoDesde: string; moodleNovoTurmas: number[];
};

export const TABS: { id: TabId; rotulo: string; precisaId?: boolean }[] = [
  { id: "identidade", rotulo: "Identidade" },
  { id: "oferta", rotulo: "Oferta" },
  { id: "conteudo", rotulo: "Conteúdo do site" },
  { id: "programa", rotulo: "Programa" },
  { id: "moodle", rotulo: "Conteúdos Moodle" },
  { id: "planos", rotulo: "Planos de sessão" },
  { id: "avaliacao", rotulo: "Avaliação", precisaId: true },
  { id: "documentos", rotulo: "Documentos", precisaId: true },
  { id: "dtp", rotulo: "Dossiê TP", precisaId: true },
  { id: "publicacao", rotulo: "Publicação" },
];

export function slugify(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function preenchido(v: string | MediaSlot | null | undefined) {
  if (!v) return false;
  if (typeof v === "string") return v.trim().length > 0;
  return Boolean(v.url);
}

export function urlImagem(url?: string) {
  return !url || url.startsWith("blob:") ? "" : url;
}

export function mediaGuardada(slot: MediaSlot | null | undefined): MediaSlot | null {
  return slot ? { name: slot.name, url: urlImagem(slot.url) } : null;
}

function mediaComUrl(slot: unknown): MediaSlot | null {
  if (!slot || typeof slot !== "object") return null;
  const m = slot as { name?: unknown; url?: unknown };
  const url = urlImagem(typeof m.url === "string" ? m.url : "");
  return url ? { name: typeof m.name === "string" && m.name ? m.name : "imagem", url } : null;
}

// ── Modelos de conteúdo (tabela conteudos_modelo, via /v1/opcoes/modelos_conteudo) ──

type TextosSite = { sintese?: string; objetivos?: string; programa?: string; funcionamento?: string; tags?: string; categoria?: string };

export function textosModelo(modelos: Opcao[], nome: string, ufcdCod: string): TextosSite | null {
  const m = modelos.find(o => o.extra?.tipo === "site" && modeloAplica(String(o.extra?.padrao ?? o.rotulo), nome, ufcdCod));
  return m ? (m.extra as TextosSite) : null;
}

/** Ficha nova: dados do curso e, se houver, os textos-modelo que casam com o nome ou o código UFCD. */
export function fichaInicial(curso: CursoBase | null, regime: Regime, modelos: Opcao[]): CursoSite {
  const nome = curso?.nome ?? "";
  const ufcdCod = curso?.ufcdCod ?? "";
  const t = curso ? textosModelo(modelos, nome, ufcdCod) : null;
  const programa = t?.programa ?? "";
  const ehCcp = cursoECcp(nome);
  return {
    titulo: nome,
    slug: nome ? slugify(nome) : "",
    tipo: regime === "fin" ? "Financiada" : curso?.tipo ?? "",
    categoria: curso?.categoria || t?.categoria || "",
    regime: curso?.regime ?? "",
    video: "",
    preco: regime === "fin" ? "" : curso ? String(curso.preco ?? "") : "",
    horas: curso ? String(curso.horas ?? "") : "",
    tags: t?.tags ?? "",
    dataInicio: "",
    estado: curso?.estado ?? "Ativo",
    visivelSite: (curso?.estado ?? "Ativo") === "Ativo",
    banner: null, capa: null, miniatura: null,
    sintese: t?.sintese ?? "",
    resumo: "",
    objetivos: t?.objetivos ?? "",
    programa,
    funcionamento: t?.funcionamento ?? "",
    metodologias: t?.funcionamento ?? "", certificacao: "", destinatarios: "", requisitos: "",
    seoTitulo: "", seoDescricao: "", contactosLocais: {},
    ufcdCod,
    ufcd: curso?.ufcd ?? "",
    areaCnaef: curso?.areaCnaef ?? "",
    locais: [],
    regimeSincronia: "",
    programaFin: "",
    organizacaoPrograma: "modular",
    topicosPrograma: topicosDeTexto(linhasPrincipais(programa)),
    avaliacaoCurso: ehCcp ? avaliacaoCcp() : avaliacaoPadrao(),
    precosOferta: [], planosSessao: [], valoresFormador: [],
    entidadeResponsavel: "",
    conteudosMoodle: [],
    moodleUrl: "",
    moodleNovoUrl: "", moodleNovoDesde: "", moodleNovoTurmas: [],
  };
}

function precosOferta(raw: unknown): PrecoOferta[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const r = item as Record<string, unknown>;
    const local = String(r.local ?? "").trim();
    const horario = String(r.horario ?? "").trim();
    if (!local && !horario) return [];
    return [{ id: String(r.id ?? `preco-${local}-${horario}`), local, horario, preco: String(r.preco ?? "") }];
  });
}

/** Junta a ficha gravada à ficha inicial. A ficha gravada manda sempre. */
export function fundirGuardado(base: CursoSite, guardado: Record<string, unknown>, regime: Regime, nomeCurso: string): CursoSite {
  if (!Object.keys(guardado).length) return base;
  const programa = programaDePayload(guardado);
  const avaliacao = parseAvaliacaoCurso(guardado);
  const nome = String(guardado.titulo ?? nomeCurso ?? "");
  return {
    ...base,
    ...(guardado as Partial<CursoSite>),
    locais: Array.isArray(guardado.locais) ? guardado.locais.map(String).filter(Boolean) : base.locais,
    organizacaoPrograma: programa.organizacao,
    regimeSincronia: regimeSincronia(guardado.regimeSincronia),
    programaFin: typeof guardado.programaFin === "string" ? guardado.programaFin : "",
    moodleUrl: typeof guardado.moodleUrl === "string" ? guardado.moodleUrl : "",
    moodleNovoUrl: typeof guardado.moodleNovoUrl === "string" ? guardado.moodleNovoUrl : "",
    moodleNovoDesde: typeof guardado.moodleNovoDesde === "string" ? guardado.moodleNovoDesde : "",
    moodleNovoTurmas: idsTurmasMoodleNovo(guardado.moodleNovoTurmas),
    topicosPrograma: programa.topicos.length ? programa.topicos : base.topicosPrograma,
    avaliacaoCurso: cursoECcp(nome) && avaliacao.estrutura !== "ccp" ? avaliacaoCcp() : avaliacao,
    banner: mediaComUrl(guardado.banner) ?? base.banner,
    capa: mediaComUrl(guardado.capa) ?? mediaComUrl(guardado.thumb) ?? base.capa,
    miniatura: mediaComUrl(guardado.miniatura) ?? base.miniatura,
    precosOferta: precosOferta(guardado.precosOferta),
    planosSessao: Array.isArray(guardado.planosSessao) ? guardado.planosSessao.map((p, i) => normalizarPlanoCurso(p, i + 1)) : base.planosSessao,
    valoresFormador: Array.isArray(guardado.valoresFormador) ? guardado.valoresFormador as ValorFormador[] : base.valoresFormador,
    entidadeResponsavel: String(guardado.entidadeResponsavel ?? base.entidadeResponsavel ?? ""),
    conteudosMoodle: parseConteudosMoodle(guardado.conteudosMoodle),
    resumo: typeof guardado.resumo === "string" ? guardado.resumo : "",
    ...topicosDoPayload(guardado),
    // A área CNAEF é do curso (tabela), não do conteúdo do site gravado.
    areaCnaef: base.areaCnaef,
  };
}

// ── Validação e prontidão para o site ──

export type CampoFalta = { chave: string; rotulo: string; tab: TabId };

/** Horas do curso: número inteiro positivo (a base guarda inteiros; o servidor recusa decimais). */
export function horasValidas(horas: string) {
  const n = Number(horas);
  return horas.trim() !== "" && Number.isInteger(n) && n >= 1;
}

/**
 * O que o servidor exige para criar o curso (tabela). O rascunho automático de um curso novo
 * só se tenta com isto preenchido; antes disso não há pedido nem aviso de erro.
 */
export function podeCriarRascunho(d: CursoSite, regime: Regime) {
  if (!d.titulo.trim() || !d.regime.trim() || !horasValidas(d.horas)) return false;
  if (regime === "fin") return Boolean(d.ufcdCod.trim());
  const preco = Number(d.preco);
  return Boolean(d.categoria.trim() && d.tipo.trim()) && d.preco.trim() !== "" && Number.isFinite(preco) && preco >= 0;
}

export function camposObrigatorios(d: CursoSite, regime: Regime): CampoFalta[] {
  const out: CampoFalta[] = [];
  if (!d.titulo.trim()) out.push({ chave: "titulo", rotulo: regime === "fin" ? "Nome comercial" : "Título", tab: "identidade" });
  if (!d.slug.trim()) out.push({ chave: "slug", rotulo: "Endereço (slug)", tab: "identidade" });
  if (regime === "fin") {
    if (!codigoCursoValido(d.ufcdCod)) out.push({ chave: "ufcdCod", rotulo: "Código UFCD ou UC", tab: "identidade" });
    if (!d.ufcd.trim()) out.push({ chave: "ufcd", rotulo: "Designação oficial", tab: "identidade" });
    if (!d.categoria.trim()) out.push({ chave: "categoria", rotulo: "Área", tab: "oferta" });
  } else {
    if (!d.tipo.trim()) out.push({ chave: "tipo", rotulo: "Tipo comercial", tab: "oferta" });
    if (!d.categoria.trim()) out.push({ chave: "categoria", rotulo: "Categoria", tab: "oferta" });
    const preco = Number(d.preco);
    if (!d.preco.trim() || Number.isNaN(preco) || preco < 0) out.push({ chave: "preco", rotulo: "Preço", tab: "oferta" });
  }
  if (!d.regime.trim()) out.push({ chave: "regime", rotulo: "Modalidade", tab: "oferta" });
  if (!horasValidas(d.horas)) out.push({ chave: "horas", rotulo: "Horas (número inteiro)", tab: "oferta" });
  if (!d.tags.trim()) out.push({ chave: "tags", rotulo: "Tags", tab: "oferta" });
  if (!d.locais.length) out.push({ chave: "locais", rotulo: "Locais", tab: "oferta" });
  return out;
}

/** Lista do que a página pública precisa; serve a barra de progresso e a checklist de publicação. */
export function prontidao(d: CursoSite, regime: Regime) {
  const meta = regime === "fin"
    ? { id: "meta", rotulo: "UFCD, horas e modalidade", ok: preenchido(d.ufcdCod) && preenchido(d.horas) && preenchido(d.regime) }
    : { id: "meta", rotulo: "Preço, horas e categoria", ok: preenchido(d.preco) && preenchido(d.horas) && preenchido(d.categoria) };
  const itens = [
    { id: "titulo", rotulo: regime === "fin" ? "Nome comercial" : "Título", ok: preenchido(d.titulo) },
    { id: "slug", rotulo: "Endereço da página", ok: preenchido(d.slug) },
    { id: "media", rotulo: "Banner e capa", ok: preenchido(d.banner) && preenchido(d.capa) },
    meta,
    { id: "sintese", rotulo: "Enquadramento", ok: preenchido(d.sintese) },
    { id: "objetivos", rotulo: "Objetivos", ok: preenchido(d.objetivos) },
    { id: "programa", rotulo: "Programa", ok: d.topicosPrograma.some(t => t.titulo.trim()) || preenchido(d.programa) },
    { id: "topicos", rotulo: "Metodologias, certificação, destinatários e requisitos", ok: TOPICOS_CURSO.every(t => preenchido(d[t.chave])) },
  ];
  const feitos = itens.filter(i => i.ok).length;
  return { itens, feitos, pct: Math.round((feitos / itens.length) * 100) };
}

export function cursoTemFolhaSimulacao(d: CursoSite, regime: Regime) {
  return regime === "gold"
    ? /ccp/i.test(d.titulo) || /ccp/i.test(d.categoria)
    : /pedag[oó]g/i.test(d.titulo) || /pedagog/i.test(d.ufcd);
}
