export type LocalCatalogo = {
  nome?: unknown;
  morada?: unknown;
};

export type LocalMapeado = {
  codigo: string;
  cidade: string;
  morada: string;
  localizacao: string;
};

const CIDADE_OFICIAL: Record<string, string> = {
  "v.n.gaia": "Vila Nova de Gaia",
  "v.n. gaia": "Vila Nova de Gaia",
  "vn.gaia": "Vila Nova de Gaia",
  "vngaia": "Vila Nova de Gaia",
  "vn gaia": "Vila Nova de Gaia",
  "gaia": "Vila Nova de Gaia",
  "vila nova de gaia": "Vila Nova de Gaia",
  "aveiro": "Aveiro",
  "penafiel": "Penafiel",
  "braga": "Braga",
  "lisboa": "Lisboa",
  "sala virtual": "Sala Virtual",
  "aprendizagem a distancia": "Aprendizagem à distância",
  "e-learning": "E-learning",
  "elearning": "E-learning",
  "centro de emprego gaia": "Centro de Emprego de Gaia",
};

function keyOf(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compact(value: string) {
  return keyOf(value).replace(/[.\s-]/g, "");
}

export function cidadeOficial(codigo: string) {
  const raw = (codigo || "").trim();
  if (!raw) return "";
  const k = keyOf(raw);
  if (CIDADE_OFICIAL[k]) return CIDADE_OFICIAL[k];
  const c = compact(raw);
  if (c === "vngaia" || c === "vilanovadegaia") return "Vila Nova de Gaia";
  return raw;
}

export function mapLocalTurma(codigo: string | undefined, catalogos: LocalCatalogo[] = []): LocalMapeado {
  const raw = (codigo || "").trim();
  const cidade = cidadeOficial(raw);
  const hit = catalogos.find(item => {
    const nome = String(item.nome ?? "").trim();
    if (!nome) return false;
    return keyOf(nome) === keyOf(raw) || compact(nome) === compact(raw) || cidadeOficial(nome) === cidade;
  });
  const moradaCatalogo = String(hit?.morada ?? "").trim();
  // A morada vem sempre do catálogo de locais (Edição de Cursos › Locais).
  const morada = moradaCatalogo;
  const virtual = /sala virtual|e-learning|moodle|zoom|dist[aâ]ncia/i.test(`${cidade} ${morada}`);
  const localizacao = !raw
    ? "-"
    : virtual
      ? (morada ? `${cidade} (${morada})` : cidade)
      : cidade;
  return { codigo: raw, cidade: cidade || raw || "-", morada, localizacao };
}
