import type { Db } from "./db/pool.js";
import { valoresDefinicao } from "./repos/configuracoes.js";

/**
 * Regras pedagógicas e dados da entidade, editáveis pelo administrador em `app_settings`
 * (chaves `regras_pedagogicas` e `entidade`). Os valores gravam-se como texto, como as
 * restantes definições; aqui convertem-se e completam-se com os valores por omissão.
 */

export type RegrasPedagogicas = {
  /** Assiduidade mínima (%) para aproveitamento e certificado. */
  assiduidadeMinGold: number;
  assiduidadeMinFin: number;
  /** As faltas justificadas contam como presença no cálculo da assiduidade. */
  justificadasContam: boolean;
  /** Resultado mínimo (%) no e-learning quando o curso não tem grelha de notas. */
  elearningMin: number;
  /** O fecho exige sumários assinados e presenças validadas em todas as sessões passadas. */
  fechoExigeSessoes: boolean;
  /** O fecho exige nota final de todos os formandos activos. */
  fechoExigeNotas: boolean;
  /** O fecho / o certificado exigem o dossiê técnico-pedagógico completo. */
  dtpBloqueiaFecho: boolean;
  dtpBloqueiaCertificado: boolean;
};

export const REGRAS_OMISSAO: RegrasPedagogicas = {
  assiduidadeMinGold: 75,
  assiduidadeMinFin: 90,
  justificadasContam: false,
  elearningMin: 50,
  fechoExigeSessoes: true,
  fechoExigeNotas: true,
  dtpBloqueiaFecho: false,
  dtpBloqueiaCertificado: false,
};

export type Entidade = {
  nome: string;
  nomeCurto: string;
  nif: string;
  morada: string;
  codigoPostal: string;
  localidade: string;
  email: string;
  telefone: string;
  site: string;
  certificacaoDgert: string;
  /** Conta para transferências: aparece no passo de pagamento da ligação pessoal. */
  iban: string;
  titularConta: string;
};

export const ENTIDADE_OMISSAO: Entidade = {
  nome: "ENA · Escola de Negócios e Administração",
  nomeCurto: "ENA",
  nif: "",
  morada: "",
  codigoPostal: "",
  localidade: "",
  email: "",
  telefone: "",
  site: "",
  certificacaoDgert: "",
  iban: "",
  titularConta: "",
};

const BOOL = new Set(["1", "true", "sim", "on"]);

function pct(v: unknown, omissao: number) {
  const n = Number(String(v ?? "").replace(",", "."));
  return v != null && v !== "" && Number.isFinite(n) && n >= 0 && n <= 100 ? n : omissao;
}

function bool(v: unknown, omissao: boolean) {
  if (v == null || v === "") return omissao;
  return BOOL.has(String(v).trim().toLowerCase());
}

export function parseRegras(values: Record<string, unknown> | undefined): RegrasPedagogicas {
  const v = values ?? {};
  const o = REGRAS_OMISSAO;
  return {
    assiduidadeMinGold: pct(v.assiduidadeMinGold, o.assiduidadeMinGold),
    assiduidadeMinFin: pct(v.assiduidadeMinFin, o.assiduidadeMinFin),
    justificadasContam: bool(v.justificadasContam, o.justificadasContam),
    elearningMin: pct(v.elearningMin, o.elearningMin),
    fechoExigeSessoes: bool(v.fechoExigeSessoes, o.fechoExigeSessoes),
    fechoExigeNotas: bool(v.fechoExigeNotas, o.fechoExigeNotas),
    dtpBloqueiaFecho: bool(v.dtpBloqueiaFecho, o.dtpBloqueiaFecho),
    dtpBloqueiaCertificado: bool(v.dtpBloqueiaCertificado, o.dtpBloqueiaCertificado),
  };
}

export function parseEntidade(values: Record<string, unknown> | undefined): Entidade {
  const v = values ?? {};
  const out = { ...ENTIDADE_OMISSAO };
  for (const k of Object.keys(out) as (keyof Entidade)[]) {
    const s = String(v[k] ?? "").trim();
    if (s) out[k] = s.slice(0, 200);
  }
  return out;
}

async function valores(db: Db, id: string) {
  return valoresDefinicao(db, id);
}

export async function lerRegras(db: Db) {
  return parseRegras(await valores(db, "regras_pedagogicas"));
}

export async function lerEntidade(db: Db) {
  return parseEntidade(await valores(db, "entidade"));
}

/** Contactos da entidade que podem sair para páginas públicas (sem NIF, IBAN nem titular). */
export type EntidadePublica = Pick<Entidade, "nome" | "nomeCurto" | "morada" | "codigoPostal" | "localidade" | "telefone" | "email" | "site">;

export async function lerEntidadePublica(db: Db): Promise<EntidadePublica> {
  const e = await lerEntidade(db);
  return {
    nome: e.nome, nomeCurto: e.nomeCurto, morada: e.morada, codigoPostal: e.codigoPostal,
    localidade: e.localidade, telefone: e.telefone, email: e.email, site: e.site,
  };
}

export function assiduidadeMinima(regras: RegrasPedagogicas, regime: "gold" | "fin") {
  return regime === "fin" ? regras.assiduidadeMinFin : regras.assiduidadeMinGold;
}

/**
 * Valida as definições com forma conhecida antes de gravar. Devolve os valores normalizados
 * (como texto) ou a mensagem de erro.
 */
export function validarDefinicoes(
  id: string,
  values: Record<string, string>,
): { ok: true; values: Record<string, string> } | { ok: false; erro: string } {
  if (id === "regras_pedagogicas") {
    for (const k of ["assiduidadeMinGold", "assiduidadeMinFin", "elearningMin"] as const) {
      if (values[k] != null && values[k] !== "") {
        const n = Number(String(values[k]).replace(",", "."));
        if (!Number.isFinite(n) || n < 0 || n > 100) return { ok: false, erro: `${k}: indique uma percentagem entre 0 e 100.` };
      }
    }
    const r = parseRegras(values);
    return {
      ok: true,
      values: Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "boolean" ? (v ? "1" : "0") : String(v)])),
    };
  }
  if (id === "entidade") {
    const nif = (values.nif ?? "").replace(/\s/g, "");
    if (nif && !/^\d{9}$/.test(nif)) return { ok: false, erro: "NIF: 9 dígitos." };
    const iban = (values.iban ?? "").replace(/\s/g, "").toUpperCase();
    if (iban && !/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return { ok: false, erro: "IBAN inválido." };
    const e = parseEntidade({ ...values, nif, iban });
    return { ok: true, values: { ...e } };
  }
  return { ok: true, values };
}

/** Definições que só o administrador altera. */
export const DEFINICOES_SO_ADMIN = new Set(["site", "lembrete_pre", "regras_pedagogicas", "entidade"]);
