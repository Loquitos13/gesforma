const LOCAIS: Record<string, string> = {
  "v.n.gaia": "VNG",
  "v. n. gaia": "VNG",
  "vn gaia": "VNG",
  "vila nova de gaia": "VNG",
  braga: "BRG",
  lisboa: "LSB",
  penafiel: "PEN",
  porto: "PRT",
  coimbra: "CBR",
  aveiro: "AVR",
  "e-learning": "EL",
  "sala virtual": "SV",
  "sala virtual / e-learning": "EL",
  online: "ON",
};

const HORARIOS: Record<string, string> = {
  "sabado manha": "SM",
  "pos laboral": "PL",
  "laboral manha": "LM",
  "laboral tarde": "LT",
  "domingo manha": "DM",
  online: "ON",
  "e-learning": "EL",
};

const CURSOS: Record<string, string> = {
  "formacao de formadores": "CCP",
  "formacao de formadores ccp": "CCP",
  "ccp formacao de formadores para empresas": "CCP",
  "e formador": "EFN",
  "e formador novas tecnologias": "EFN",
  "excel do basico ao avancado": "EXL",
  "auxiliar de medicina dentaria": "AMD",
  "curso de auxiliar de medicina dentaria": "AMD",
  "auxiliar de medicina veterinaria": "AMV",
  "curso de auxiliar de medicina veterinaria": "AMV",
  "cura pranica": "CPR",
  "curso de cura pranica": "CPR",
  "primeiros socorros": "PS",
  "publicidade nas redes sociais": "PRS",
  "fundamentos de ciberseguranca": "CIB",
  "metodos e tecnicas pedagogicas": "MTP",
  "metodos e tecnicas pedagogicas ativos": "MTP",
};

const PARAR = new Set([
  "de", "da", "do", "das", "dos", "e", "a", "o", "os", "as", "em", "para", "por", "com",
  "no", "na", "nos", "nas", "ao", "aos", "curso", "formacao", "ufcd", "learning", "online",
]);

function chave(raw: string) {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function siglaLivre(raw: string) {
  const palavras = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!palavras.length) return "";
  if (palavras.length === 1) return palavras[0]!.slice(0, 3).toUpperCase();
  return palavras.map(p => p[0]).join("").slice(0, 4).toUpperCase();
}

function siglaConhecida(tabela: Record<string, string>, k: string) {
  if (tabela[k]) return tabela[k];
  let melhor = "";
  let tamanho = 0;
  for (const [nome, sigla] of Object.entries(tabela)) {
    const nk = chave(nome);
    const serve = k === nk || k.startsWith(`${nk} `) || k.includes(` ${nk}`);
    if (serve && nk.length > tamanho) {
      melhor = sigla;
      tamanho = nk.length;
    }
  }
  return melhor;
}

function siglaDe(tabela: Record<string, string>, raw: string) {
  const k = chave(raw);
  if (!k) return "";
  return siglaConhecida(tabela, k) || siglaLivre(raw);
}

export function diminutivoLocal(local: string) {
  return siglaDe(LOCAIS, local);
}

export function diminutivoHorario(horario: string) {
  return siglaDe(HORARIOS, horario);
}

/** Sigla do curso: tabela conhecida, acrónimo já no nome (CCP) ou iniciais. */
export function diminutivoCurso(curso: string) {
  const k = chave(curso);
  if (!k) return "";
  const conhecido = siglaConhecida(CURSOS, k);
  if (conhecido) return conhecido;
  const acronimo = curso.match(/\b([A-Z]{2,5})\b/);
  if (acronimo && acronimo[1] !== "UFCD") return acronimo[1];
  const palavras = k.split(" ").filter(p => p.length > 2 && !PARAR.has(p) && !/^\d+$/.test(p));
  if (!palavras.length) return siglaLivre(curso);
  if (palavras.length === 1) return palavras[0]!.slice(0, 4).toUpperCase();
  return palavras.map(p => p[0]).join("").slice(0, 4).toUpperCase();
}

/** Código interno: diminutivo do curso - local - horário - dd/mm. */
export function codigoInternoTurma(curso: string, local: string, horario: string, dataInicio: string) {
  const cur = diminutivoCurso(curso);
  const loc = diminutivoLocal(local);
  const hor = diminutivoHorario(horario);
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dataInicio.trim());
  const data = m ? `${m[3]}/${m[2]}` : "";
  if (!cur || !loc || !hor || !data) return "";
  return `${cur} - ${loc} - ${hor} - ${data}`;
}
