import type { Db } from "./db/pool.js";
import { valoresDefinicao } from "./repos/configuracoes.js";
import { one } from "./repos/sql.js";
import { CAMPOS_CANDIDATURA_FIN, CANDIDATURA_FIN_VAZIA, lerCandidaturaFin } from "../../src/partilhado/candidaturaFin.js";

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
  /** Recebe cada comprovativo de pagamento (com os dados da pessoa, os de faturação e o ficheiro em anexo). Vazio: não se envia. */
  emailContabilidade: string;
  /** Horas que o email à contabilidade espera pelos dados de faturação depois do comprovativo (vazio: 24; 0: não espera). */
  esperaFaturacaoHoras: string;
  /** Contactos telefónicos por zona, um por linha (ex.: «223781100 se pretende realizar o curso no Porto/Gaia»): vão nos emails. */
  telefonesZona: string;
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
  emailContabilidade: "",
  esperaFaturacaoHoras: "",
  telefonesZona: "",
};

/** Telefones por zona: até 6 linhas de 120 caracteres. */
const TELEFONES_ZONA_LINHAS = 6;
const TELEFONES_ZONA_CHARS = 120;
/** Tamanho máximo do texto enviado (cada linha com espaços e fim de linha «\r\n» à volta). */
export const MAX_TELEFONES_ZONA = TELEFONES_ZONA_LINHAS * (TELEFONES_ZONA_CHARS + 8);

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
    if (k === "telefonesZona") continue;
    const s = String(v[k] ?? "").trim();
    if (s) out[k] = s.slice(0, 200);
  }
  // Várias linhas (até 6), cada uma com um contacto por zona.
  out.telefonesZona = String(v.telefonesZona ?? "").split(/\r?\n/).map(l => l.trim().slice(0, TELEFONES_ZONA_CHARS)).filter(Boolean).slice(0, TELEFONES_ZONA_LINHAS).join("\n");
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

/**
 * Programa e tipologias dos documentos de uma turma da Financiada: o programa escolhido na turma (Edição de cursos ›
 * Programas) ou, sem ele, o do curso (ficha › Oferta); sem nenhum, o primeiro programa activo; sem programas, a candidatura antiga de Configurações › Financiada.
 */
export async function lerCandidatura(db: Db, programa = "") {
  const p = await programaDosDocumentos(db, programa);
  return p ? lerCandidaturaFin(p.payload, CANDIDATURA_FIN_VAZIA) : lerCandidaturaFin(await valores(db, "candidatura_fin"));
}

export type OrigemPrograma = "turma" | "curso" | "primeiro" | "nenhum";

/**
 * O programa dos documentos de uma turma, por esta ordem: o da turma, o da ficha do curso, o primeiro activo
 * (um nome que já não existe em Programas passa ao seguinte, nunca a outro programa por engano).
 */
export async function programaDaTurma(db: Db, t: { programa?: string; curso_programa?: string }) {
  for (const [nome, origem] of [[t.programa ?? "", "turma"], [t.curso_programa ?? "", "curso"]] as const) {
    if (!nome.trim()) continue;
    const p = await programaDosDocumentos(db, nome);
    if (p?.pedidoEncontrado) return { id: p.id, nome: p.nome, origem: origem as OrigemPrograma, candidatura: lerCandidaturaFin(p.payload, CANDIDATURA_FIN_VAZIA) };
  }
  const p = await programaDosDocumentos(db, "");
  if (p) return { id: p.id, nome: p.nome, origem: "primeiro" as OrigemPrograma, candidatura: lerCandidaturaFin(p.payload, CANDIDATURA_FIN_VAZIA) };
  return { id: null, nome: "", origem: "nenhum" as OrigemPrograma, candidatura: lerCandidaturaFin(await valores(db, "candidatura_fin")) };
}

/**
 * O programa que os documentos usam: o pedido (turma ou curso), mesmo inactivo; sem pedido (ou se já não existe),
 * o primeiro activo. `pedidoEncontrado` diz se o pedido existe (para avisar quando o nome já não corresponde).
 */
export async function programaDosDocumentos(db: Db, programa = "") {
  const p = await one<{ id: number; payload: Record<string, unknown>; pedido: boolean }>(db,
    `SELECT id, payload, (trim($1) <> '' AND lower(trim(payload->>'nome')) = lower(trim($1))) AS pedido FROM catalog_items
      WHERE kind = 'programas' AND regime = 'fin'
        AND ((trim($1) <> '' AND lower(trim(payload->>'nome')) = lower(trim($1)))
             OR coalesce(payload->>'status', 'Ativo') NOT IN ('Inactivo', 'Inativo', 'Arquivado'))
      ORDER BY 3 DESC, id
      LIMIT 1`, [programa]);
  return p ? { id: Number(p.id), payload: p.payload ?? {}, nome: String(p.payload?.nome ?? ""), pedidoEncontrado: Boolean(p.pedido) } : null;
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
  if (id === "whatsapp_regras") {
    const limites: Record<string, [number, string]> = {
      fecharHoras: [720, "Fechar conversas sem mensagens: de 0 a 720 horas."],
      lembreteMin: [1440, "Lembrar quem parou a meio: de 0 a 1440 minutos."],
      avisoEquipaHoras: [168, "Avisar a equipa sem resposta: de 0 a 168 horas."],
    };
    for (const [k, [max, erro]] of Object.entries(limites)) {
      const v = (values[k] ?? "").trim().replace(",", ".");
      if (v && !(/^\d+(\.\d+)?$/.test(v) && Number(v) <= max)) return { ok: false, erro };
    }
  }
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
    const contab = (values.emailContabilidade ?? "").trim();
    if (contab && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contab)) return { ok: false, erro: "Email da contabilidade inválido." };
    const espera = (values.esperaFaturacaoHoras ?? "").trim().replace(",", ".");
    if (espera && !(/^\d+(\.\d+)?$/.test(espera) && Number(espera) <= 168)) {
      return { ok: false, erro: "Espera pelos dados de faturação: de 0 a 168 horas." };
    }
    const e = parseEntidade({ ...values, nif, iban });
    return { ok: true, values: { ...e } };
  }
  if (id === "candidatura_fin") {
    // Só os campos conhecidos; todos gravados (um campo em branco fica em branco, não volta à omissão).
    const c = lerCandidaturaFin(Object.fromEntries(CAMPOS_CANDIDATURA_FIN.map(({ chave }) => [chave, values[chave] ?? ""])));
    return { ok: true, values: { ...c } };
  }
  return { ok: true, values };
}

/** Definições que só o administrador altera. */
export const DEFINICOES_SO_ADMIN = new Set(["site", "seo", "lembrete_pre", "regras_pedagogicas", "entidade"]);
