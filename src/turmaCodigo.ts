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

function siglaDe(tabela: Record<string, string>, raw: string) {
  const k = chave(raw);
  if (!k) return "";
  if (tabela[k]) return tabela[k];
  for (const [nome, sigla] of Object.entries(tabela)) {
    if (chave(nome) === k) return sigla;
  }
  return siglaLivre(raw);
}

export function diminutivoLocal(local: string) {
  return siglaDe(LOCAIS, local);
}

export function diminutivoHorario(horario: string) {
  return siglaDe(HORARIOS, horario);
}

/** Código interno: diminutivo do local - diminutivo do horário - dd/mm. */
export function codigoInternoTurma(local: string, horario: string, dataInicio: string) {
  const loc = diminutivoLocal(local);
  const hor = diminutivoHorario(horario);
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dataInicio.trim());
  const data = m ? `${m[3]}/${m[2]}` : "";
  if (!loc || !hor || !data) return "";
  return `${loc} - ${hor} - ${data}`;
}
