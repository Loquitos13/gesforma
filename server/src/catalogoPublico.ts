import type { Db } from "./db/pool.js";
import { mapaImagensPublicas } from "./cursoImagens.js";
import { hojeLisboa } from "./datas.js";

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
  descricao: string;
  financiamento: "Gold" | "Financiada";
  inscricao: "Acesso direto" | "Pré-pago" | "Pré-inscrição";
  miniatura: string | null;
  banner: string | null;
  vendas: number;
  objetivos: string[];
  organizacao: "modular" | "livre";
  programa: { titulo: string; horas: string }[];
  sessoes: { data: string; local: string; horario: string }[];
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

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

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

function euros(n: number) {
  const inteiro = Math.round(n);
  return inteiro.toLocaleString("pt-PT");
}

function dataCurta(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const mes = MESES[Number(m[2]) - 1] ?? m[2];
  return `${Number(m[3])} ${mes} ${m[1]}`;
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

function programaPublico(regime: "gold" | "fin", payload: Record<string, unknown>) {
  const organizacao: CursoPublico["organizacao"] = regime === "fin" || payload.organizacaoPrograma !== "livre" ? "modular" : "livre";
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
  const [gold, fin, formandosGold, pagos, formandosFin, turmasGold, turmasFin, imagens] = await Promise.all([
    db.query<{ id: number; nome: string; categoria: string; tipo: string; preco: number; regime: string; horas: number; estado: string; payload: unknown }>(
      `SELECT c.id, c.nome, c.categoria, c.tipo, c.preco, c.regime, c.horas, c.estado, f.payload
       FROM cursos_gold c
       LEFT JOIN curso_fichas f ON f.regime = 'gold' AND f.curso_id = c.id`,
    ),
    db.query<{ id: number; ufcd: string; nome_comercial: string; regime: string; horas: number; estado: string; payload: unknown }>(
      `SELECT c.id, c.ufcd, c.nome_comercial, c.regime, c.horas, c.estado, f.payload
       FROM cursos_fin c
       LEFT JOIN curso_fichas f ON f.regime = 'fin' AND f.curso_id = c.id`,
    ),
    db.query<{ curso: string; n: number }>("SELECT curso, count(*)::int AS n FROM formandos_gold GROUP BY curso"),
    db.query<{ curso: string; n: number }>("SELECT curso, count(*)::int AS n FROM pagamentos WHERE lower(trim(estado)) = 'pago' GROUP BY curso"),
    db.query<{ curso: string; n: number }>("SELECT curso, count(*)::int AS n FROM formandos_fin GROUP BY curso"),
    db.query<{ curso: string; local: string; horario: string; data_inicio: string; estado: string }>(
      "SELECT curso, local, horario, data_inicio, estado FROM turmas_gold",
    ),
    db.query<{ curso: string; local: string; horario: string; data_inicio: string; estado: string }>(
      "SELECT curso, local, horario, data_inicio, estado FROM turmas_fin",
    ),
    mapaImagensPublicas(db),
  ]);

  const vendas = new Map<string, number>();
  for (const row of formandosGold.rows) somar(vendas, row.curso, Number(row.n) || 0);
  for (const row of pagos.rows) somar(vendas, row.curso, Number(row.n) || 0);
  for (const row of formandosFin.rows) somar(vendas, row.curso, Number(row.n) || 0);

  const hoje = hojeLisboa();
  const inicios = new Map<string, { data: string; local: string }>();
  const sessoes = new Map<string, Array<CursoPublico["sessoes"][number] & { iso: string }>>();
  for (const row of [...turmasGold.rows, ...turmasFin.rows]) {
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
    const sintese = texto(payload.sintese);
    const horasLabel = curso.horas > 0 ? `${curso.horas.toLocaleString("pt-PT")} horas` : "Duração a confirmar";
    const modo = modalidade(curso.modalidadeTexto);
    const entrada = classificarInscricao(curso.regime, curso.tipo, curso.modalidadeTexto);
    const procura = curso.chaves.reduce((max, key) => Math.max(max, vendas.get(key) ?? 0), 0);
    const inicio = curso.chaves.map(key => inicios.get(key)).find(Boolean);
    const precos = curso.regime === "gold" ? precosDaFicha(payload, curso.preco) : [];
    const desde = precos.length ? Math.min(...precos) : null;
    const gravadaThumb = imagens.get(`${curso.regime}:${curso.id}:thumb`) ?? null;
    const gravadaBanner = imagens.get(`${curso.regime}:${curso.id}:banner`) ?? null;
    const miniatura = gravadaThumb || mediaUrl(payload.thumb);
    const banner = gravadaBanner || mediaUrl(payload.banner) || miniatura;
    const programa = programaPublico(curso.regime, payload);
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
      precoLabel: curso.regime === "fin" ? "Financiada" : desde != null ? (precos.length > 1 ? `A partir de ${euros(desde)} €` : `${euros(desde)} €`) : "Sob consulta",
      precoDesde: desde,
      descricao: sintese || `${curso.area}. ${horasLabel}.`,
      financiamento: curso.regime === "fin" ? "Financiada" : "Gold",
      inscricao: entrada,
      miniatura,
      banner,
      vendas: procura,
      objetivos: linhas(payload.objetivos),
      organizacao: programa.organizacao,
      programa: programa.programa,
      sessoes: curso.chaves
        .flatMap(key => sessoes.get(key) ?? [])
        .sort((a, b) => a.iso.localeCompare(b.iso))
        .slice(0, 8)
        .map(({ data, local, horario }) => ({ data, local, horario })),
      nomeOferta: curso.nomeOferta || curso.titulo,
    };
  });

  cursos.sort((a, b) => b.vendas - a.vendas || a.titulo.localeCompare(b.titulo, "pt"));
  const ccp = cursos
    .filter(curso => curso.regime === "gold" && /formador/i.test(curso.titulo) && /ccp/i.test(curso.titulo))
    .sort((a, b) => b.vendas - a.vendas)[0] ?? null;

  return { cursos, destaques: cursos.slice(0, 6), ccp };
}
