import { topicosDoPayload, type TopicosCurso } from "../../src/partilhado/topicosCurso.js";
import { regimeSincronia, type RegimeSincronia } from "../../src/partilhado/regimeSincronia.js";
import type { Db } from "./db/pool.js";
import { mapaImagensPublicas } from "./cursoImagens.js";
import { dadosCatalogoPublico } from "./repos/cursos.js";
import { hojeLisboa } from "./datas.js";
import { escolherPreco, regrasDoPayload } from "./precoOferta.js";
import { eur } from "../../src/partilhado/ui/formatos.js";
import { CONTACTOS_LOCAL } from "../../src/partilhado/contactosLocal.js";
import { textosCurso } from "../../src/partilhado/textosCurso.js";

export type ContactoLocal = { local: string; telemovel: string; telefone: string; email: string; whatsapp: string };

const CAMPOS_CONTACTO = CONTACTOS_LOCAL.map(([campo]) => campo);

/**
 * Contactos dos locais deste curso. Os que se escrevem na ficha do curso só valem para os locais atribuídos ao curso
 * (payload.locais); campo a campo, o que estiver vazio na ficha vem do local (Edição de cursos › Locais).
 */
function contactosDoCurso(payload: Record<string, unknown>, locaisDoCurso: string[], doCatalogo: Map<string, ContactoLocal>, regime: string): ContactoLocal[] {
  const atribuidos = new Set((Array.isArray(payload.locais) ? payload.locais : []).map(l => chave(String(l))));
  const proprios = (payload.contactosLocais && typeof payload.contactosLocais === "object" ? payload.contactosLocais : {}) as Record<string, Record<string, unknown>>;
  const vistos = new Set<string>();
  const out: ContactoLocal[] = [];
  for (const local of locaisDoCurso) {
    const k = chave(local);
    if (!local.trim() || vistos.has(k)) continue;
    vistos.add(k);
    const base = doCatalogo.get(`${regime}:${k}`);
    const deste = atribuidos.has(k) ? Object.entries(proprios).find(([nome]) => chave(nome) === k)?.[1] : undefined;
    const c: ContactoLocal = { local, telemovel: "", telefone: "", email: "", whatsapp: "" };
    for (const campo of CAMPOS_CONTACTO) c[campo] = texto(deste?.[campo]) || base?.[campo] || "";
    if (CAMPOS_CONTACTO.some(campo => c[campo])) out.push(c);
  }
  return out;
}

export type CursoPublico = {
  id: string;
  regime: "gold" | "fin";
  titulo: string;
  area: string;
  modalidade: "Presencial" | "E-learning" | "B-learning";
  horasLabel: string;
  inicio: string;
  precoLabel: string;
  precoDesde: number | null;
  /** O texto completo (igual a `descricaoCompleta`); fica pelos clientes antigos. */
  descricao: string;
  /** Texto de destaque (catálogo): o da ficha ou, vazio, a síntese cortada numa palavra com «…». */
  resumo: string;
  /** Texto completo (página do curso): a síntese da ficha ou, vazia, «Área. N horas.». */
  descricaoCompleta: string;
  financiamento: "Gold" | "Financiada";
  inscricao: "Acesso direto" | "Pré-pago" | "Pré-inscrição";
  miniatura: string | null;
  capa: string | null;
  banner: string | null;
  vendas: number;
  objetivos: string[];
  funcionamento: string;
  /** Metodologias, certificação/avaliação, destinatários e requisitos (ficha › Conteúdo do site). */
  topicos: TopicosCurso;
  seoTitulo: string; seoDescricao: string;
  /** Contactos de cada local do curso: os da ficha do curso (se o local lhe estiver atribuído), senão os de Locais. */
  contactosLocais: ContactoLocal[];
  /** Locais atribuídos na ficha do curso (ex.: «Sala Virtual» no e-learning), com a morada de Locais: aparecem mesmo sem turmas nem contactos. */
  locais: { nome: string; morada: string }[];
  organizacao: "modular" | "livre";
  programa: { titulo: string; horas: string }[];
  /** Regime da oferta (ficha › Oferta): síncrono, assíncrono, misto ou vazio. */
  sincronia: RegimeSincronia;
  /** Próximas datas; o preço segue as regras da ficha (local, horário ou os dois), como na pré-inscrição. */
  sessoes: { data: string; iso: string; local: string; horario: string; preco: number | null; morada: string }[];
  nomeOferta: string;
};

type CursoBruto = {
  id: number;
  regime: "gold" | "fin";
  titulo: string;
  area: string;
  modalidadeTexto: string;
  horas: number;
  preco: number;
  tipo: string;
  payload: unknown;
  chaves: string[];
  nomeOferta: string;
};


function chave(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function asObj(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  return typeof value === "object" ? value as Record<string, unknown> : {};
}

function texto(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function mediaUrl(slot: unknown) {
  const url = texto(asObj(slot).url);
  if (!url || url.startsWith("blob:") || /\/(?:gold|fin)\/\d+(?:\/|$)/.test(url)) return null;
  if (url.startsWith("/api/v1/public/imagens/") || url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:image/")) return url;
  return null;
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function numeroPositivo(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  const textoNumero = texto(value).replace(/\s/g, "").replace(",", ".");
  if (!textoNumero) return fallback;
  const n = Number(textoNumero);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function numeroPreco(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  const match = texto(value).replace(/\s/g, "").match(/(\d+(?:[.,]\d+)?)/);
  if (!match) return null;
  const n = Number(match[1].replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function precosDaFicha(payload: Record<string, unknown>, base: number) {
  const nums = new Set<number>();
  if (base > 0) nums.add(base);
  const directo = numeroPreco(payload.preco);
  if (directo) nums.add(directo);
  const lista = Array.isArray(payload.precosOferta) ? payload.precosOferta : [];
  for (const item of lista) {
    const n = numeroPreco(asObj(item).preco);
    if (n) nums.add(n);
  }
  return [...nums];
}

function modalidade(regime: string): CursoPublico["modalidade"] {
  const r = chave(regime);
  if (r.includes("e-learning") || r.includes("elearning") || r === "online") return "E-learning";
  if (r.includes("b-learning") || r.includes("blearning")) return "B-learning";
  return "Presencial";
}

export function classificarInscricao(regime: "gold" | "fin", tipo: string, modalidade = ""): CursoPublico["inscricao"] {
  if (regime === "fin") return "Pré-inscrição";
  const t = chave(tipo);
  const m = chave(modalidade);
  if (t.includes("pre-insc") || t.includes("preinsc")) return "Pré-inscrição";
  if (t.includes("acesso") && t.includes("diret")) return "Acesso direto";
  if (t.includes("pre-pago") || t.includes("prepago") || t.includes("e-learning") || t.includes("elearning")) return "Pré-pago";
  if ((t === "gold" || t === "pago") && (m.includes("e-learning") || m.includes("elearning"))) return "Pré-pago";
  return "Acesso direto";
}

function dataCurta(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  // Todas as datas em dd-mm-aaaa (também no site).
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function somar(map: Map<string, number>, nome: string, n: number) {
  const key = chave(nome);
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + n);
}

function linhas(value: unknown) {
  return texto(value)
    .split(/\n+/)
    .map(linha => linha.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 12);
}

function duracaoPublica(raw: string) {
  const s = raw.trim().toLowerCase().replace(/\s+/g, "");
  const match = /^(\d+)(?:h|:)?(\d{0,2})(?:min)?$/.exec(s);
  if (!match) return raw.trim();
  const horas = Number(match[1]);
  const minutos = match[2] ? Number(match[2]) : 0;
  if (!Number.isFinite(horas)) return raw.trim();
  if (!minutos) return `${horas} h`;
  return `${horas} h ${String(minutos).padStart(2, "0")} min`;
}

function itemPrograma(linha: string) {
  const horasMatch = linha.match(/[·\-–]\s*(\d+\s*h?(?:\s*\d{1,2})?(?:\s*min)?)\s*$/i);
  const titulo = linha
    .replace(/^(?:M|C|AV|EX)\s*\d+\s*[·.\-:–]+\s*/i, "")
    .replace(/^\d+\s*[.)\-–]\s*/, "")
    .replace(/\s*[·\-–]\s*\d+\s*h?(?:\s*\d{1,2})?(?:\s*min)?\s*$/i, "")
    .trim();
  if (!titulo) return null;
  return { titulo, horas: duracaoPublica(horasMatch?.[1] ?? "") };
}

function programaPublico(payload: Record<string, unknown>) {
  // Gold e Financiada: modular ou livre; sem valor gravado é modular.
  const organizacao: CursoPublico["organizacao"] = payload.organizacaoPrograma === "livre" ? "livre" : "modular";
  const raw = Array.isArray(payload.topicosPrograma) ? payload.topicosPrograma : [];
  const dosTopicos = raw.map(item => {
    const row = asObj(item);
    const titulo = texto(row.titulo) || texto(row.nome);
    return titulo ? { titulo, horas: duracaoPublica(texto(row.horas)) } : null;
  }).filter((item): item is { titulo: string; horas: string } => item !== null);
  if (dosTopicos.length) return { organizacao, programa: dosTopicos.slice(0, 24) };
  const programa = texto(payload.programa).split(/\n+/).map(itemPrograma).filter((item): item is { titulo: string; horas: string } => item !== null);
  return { organizacao, programa: programa.slice(0, 24) };
}

/** Inactivo, Inativo, Inativa e Inactiva ficam fora do site. Estado vazio conta como visível. */
export function cursoVisivelNoSite(estado: unknown) {
  const e = String(estado ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  return !/^(?:inactiv|inativ)/.test(e);
}

export async function listarCatalogoPublico(db: Db): Promise<{ cursos: CursoPublico[]; destaques: CursoPublico[]; ccp: CursoPublico | null }> {
  const dados = await dadosCatalogoPublico(db);
  const imagens = await mapaImagensPublicas(db);
  const gold = { rows: dados.gold };
  const fin = { rows: dados.fin };

  const vendas = new Map<string, number>();
  for (const row of dados.vendas) somar(vendas, row.curso, Number(row.n) || 0);

  const moradas = new Map<string, string>();
  for (const l of dados.locais) if (l.morada.trim()) moradas.set(`${l.regime}:${chave(l.nome)}`, l.morada.trim());
  const contactosLocais = new Map<string, ContactoLocal>();
  for (const l of dados.locais) {
    contactosLocais.set(`${l.regime}:${chave(l.nome)}`, { local: l.nome, telemovel: l.telemovel.trim(), telefone: l.telefone.trim(), email: l.email.trim(), whatsapp: l.whatsapp.trim() });
  }

  const hoje = hojeLisboa();
  const inicios = new Map<string, { data: string; local: string }>();
  const sessoes = new Map<string, Array<{ iso: string; data: string; local: string; horario: string }>>();
  for (const row of dados.turmas) {
    const data = String(row.data_inicio ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || data < hoje) continue;
    const key = chave(row.curso);
    const actual = inicios.get(key);
    if (!actual || data < actual.data) inicios.set(key, { data, local: row.local || "" });
    const lista = sessoes.get(key) ?? [];
    const sessao = { iso: data, data: dataCurta(data), local: row.local || "", horario: row.horario || "" };
    if (!lista.some(item => item.data === sessao.data && item.local === sessao.local && item.horario === sessao.horario)) {
      lista.push(sessao);
    }
    sessoes.set(key, lista);
  }

  const brutos: CursoBruto[] = [];
  for (const row of gold.rows) {
    if (!cursoVisivelNoSite(row.estado)) continue;
    const payload = asObj(row.payload);
    const titulo = texto(payload.titulo) || row.nome || "Curso";
    brutos.push({
      id: row.id,
      regime: "gold",
      titulo,
      area: texto(payload.categoria) || row.categoria || "Gold",
      modalidadeTexto: texto(payload.regime) || row.regime,
      horas: numeroPositivo(payload.horas, Number(row.horas) || 0),
      preco: numeroPositivo(payload.preco, Number(row.preco) || 0),
      tipo: texto(payload.tipo) || row.tipo,
      payload,
      chaves: [...new Set([chave(row.nome), chave(titulo)].filter(Boolean))],
      nomeOferta: row.nome || titulo,
    });
  }
  for (const row of fin.rows) {
    if (!cursoVisivelNoSite(row.estado)) continue;
    const payload = asObj(row.payload);
    const titulo = texto(payload.titulo) || row.nome_comercial || row.ufcd || "Curso";
    brutos.push({
      id: row.id,
      regime: "fin",
      titulo,
      area: texto(payload.categoria) || "Formação financiada",
      modalidadeTexto: texto(payload.regime) || row.regime,
      horas: numeroPositivo(payload.horas, Number(row.horas) || 0),
      preco: 0,
      tipo: "Pré-inscrição",
      payload,
      chaves: [...new Set([chave(row.nome_comercial), chave(row.ufcd), chave(titulo)].filter(Boolean))],
      nomeOferta: row.nome_comercial || titulo,
    });
  }

  const slugs = new Set<string>();
  function reservarSlug(titulo: string, pedido: string) {
    const base = slugify(pedido) || slugify(titulo) || "curso";
    const limpo = /^(?:gold|fin)-\d+$/.test(base) ? slugify(titulo) || "curso" : base;
    let slug = limpo;
    let n = 2;
    while (slugs.has(slug)) slug = `${limpo}-${n++}`;
    slugs.add(slug);
    return slug;
  }

  const cursos = brutos.map((curso): CursoPublico => {
    const payload = asObj(curso.payload);
    const horasLabel = curso.horas > 0 ? `${curso.horas.toLocaleString("pt-PT")} horas` : "Duração a confirmar";
    const textos = textosCurso(payload, `${curso.area}. ${horasLabel}.`);
    const modo = modalidade(curso.modalidadeTexto);
    const entrada = classificarInscricao(curso.regime, curso.tipo, curso.modalidadeTexto);
    const procura = curso.chaves.reduce((max, key) => Math.max(max, vendas.get(key) ?? 0), 0);
    const inicio = curso.chaves.map(key => inicios.get(key)).find(Boolean);
    const precos = curso.regime === "gold" ? precosDaFicha(payload, curso.preco) : [];
    const desde = precos.length ? Math.min(...precos) : null;
    const gravadaThumb = imagens.get(`${curso.regime}:${curso.id}:thumb`) ?? null;
    const gravadaCapa = imagens.get(`${curso.regime}:${curso.id}:capa`) ?? null;
    const gravadaMiniatura = imagens.get(`${curso.regime}:${curso.id}:miniatura`) ?? null;
    const gravadaBanner = imagens.get(`${curso.regime}:${curso.id}:banner`) ?? null;
    const capa = gravadaCapa || mediaUrl(payload.capa) || gravadaThumb || mediaUrl(payload.thumb);
    const miniatura = gravadaMiniatura || mediaUrl(payload.miniatura) || capa;
    const banner = gravadaBanner || mediaUrl(payload.banner) || capa;
    const programa = programaPublico(payload);
    return {
      id: reservarSlug(curso.titulo, texto(payload.slug)),
      regime: curso.regime,
      titulo: curso.titulo,
      area: curso.area,
      modalidade: modo,
      horasLabel,
      inicio: inicio
        ? `${dataCurta(inicio.data)}${inicio.local ? ` · ${inicio.local}` : ""}`
        : modo === "E-learning" ? "Acesso imediato" : "Data a anunciar",
      precoLabel: curso.regime === "fin" ? "Financiada" : desde != null ? (precos.length > 1 ? `A partir de ${eur(desde, true)}` : eur(desde, true)) : "Sob consulta",
      precoDesde: desde,
      descricao: textos.completo,
      resumo: textos.resumo,
      descricaoCompleta: textos.completo,
      financiamento: curso.regime === "fin" ? "Financiada" : "Gold",
      inscricao: entrada,
      miniatura,
      capa,
      banner,
      vendas: procura,
      objetivos: linhas(payload.objetivos),
      funcionamento: texto(payload.funcionamento),
      topicos: topicosDoPayload(payload),
      seoTitulo: texto(payload.seoTitulo), seoDescricao: texto(payload.seoDescricao),
      contactosLocais: contactosDoCurso(payload, [
        ...curso.chaves.flatMap(key => (sessoes.get(key) ?? []).map(s => s.local)),
        ...(Array.isArray(payload.locais) ? payload.locais.map(String) : []),
      ], contactosLocais, curso.regime),
      locais: [...new Map((Array.isArray(payload.locais) ? payload.locais.map(String) : [])
        .filter(l => l.trim())
        .map(l => [chave(l), { nome: l.trim(), morada: moradas.get(`${curso.regime}:${chave(l)}`) ?? "" }])).values()],
      organizacao: programa.organizacao,
      programa: programa.programa,
      sessoes: curso.chaves
        .flatMap(key => sessoes.get(key) ?? [])
        .sort((a, b) => a.iso.localeCompare(b.iso))
        .slice(0, 24)
        .map(({ data, iso, local, horario }) => {
          const preco = curso.regime === "gold" ? escolherPreco(curso.preco, local, horario, regrasDoPayload(payload)) : 0;
          return { data, iso, local, horario, preco: preco > 0 ? preco : null, morada: moradas.get(`${curso.regime}:${chave(local)}`) ?? "" };
        }),
      sincronia: regimeSincronia(payload.regimeSincronia),
      nomeOferta: curso.nomeOferta || curso.titulo,
    };
  });

  cursos.sort((a, b) => b.vendas - a.vendas || a.titulo.localeCompare(b.titulo, "pt"));
  const ccp = cursos
    .filter(curso => curso.regime === "gold" && /formador/i.test(curso.titulo) && /ccp/i.test(curso.titulo))
    .sort((a, b) => b.vendas - a.vendas)[0] ?? null;

  return { cursos, destaques: cursos.slice(0, 6), ccp };
}
