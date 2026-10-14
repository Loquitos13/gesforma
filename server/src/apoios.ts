/**
 * Cálculo dos apoios da Financiada a partir da assiduidade real (folhas de presença) e das regras
 * configuradas. Sem SQL: os dados vêm de `repos/apoios.ts`.
 *
 * Âmbito das regras, do mais forte para o mais fraco: regra da turma → regra do financiador → regra geral.
 */
import { estadoDaMarca, sessoesComHoras, type SessaoComHoras } from "./assiduidade.js";
import { decryptField } from "./fieldCrypto.js";
import {
  TIPOS_APOIO, type ModoApoio, type RegraApoioRow, type TipoApoio,
} from "./repos/apoios.js";

export type RegraApoio = {
  tipo: TipoApoio;
  ativo: boolean;
  modo: ModoApoio;
  valor: number;
  minHorasDia: number;
  tetoMensal: number | null;
  assiduidadeMinima: number | null;
  requerIban: boolean;
  notas: string;
  ambito: "turma" | "financiador" | "geral";
};

export const ROTULO_APOIO: Record<TipoApoio, string> = {
  bolsa: "Bolsa de formação",
  alimentacao: "Subsídio de alimentação",
  transporte: "Subsídio de transporte",
  acolhimento: "Acolhimento de dependentes",
  alojamento: "Alojamento",
};

const num = (v: unknown) => (v == null || v === "" ? null : Number(v));
const r2 = (n: number) => Math.round(n * 100) / 100;

export function regraDaLinha(r: RegraApoioRow): RegraApoio {
  return {
    tipo: r.tipo,
    ativo: Boolean(r.ativo),
    modo: r.modo,
    valor: Number(r.valor ?? 0),
    minHorasDia: Number(r.min_horas_dia ?? 0),
    tetoMensal: num(r.teto_mensal),
    assiduidadeMinima: num(r.assiduidade_minima),
    requerIban: Boolean(r.requer_iban),
    notas: r.notas ?? "",
    ambito: r.turma_id != null ? "turma" : r.financiador ? "financiador" : "geral",
  };
}

/** Para cada tipo, a regra que vale na turma (a mais específica). Tipos sem regra ficam de fora. */
export function regrasEfetivas(linhas: RegraApoioRow[], turmaId: number, financiador: string): RegraApoio[] {
  const peso = (r: RegraApoioRow) => (r.turma_id === turmaId ? 3 : r.turma_id == null && r.financiador === financiador && financiador ? 2 : r.turma_id == null && !r.financiador ? 1 : 0);
  const out: RegraApoio[] = [];
  for (const tipo of TIPOS_APOIO) {
    const melhor = linhas
      .filter(r => r.tipo === tipo && peso(r) > 0)
      .sort((a, b) => peso(b) - peso(a))[0];
    if (melhor) out.push(regraDaLinha(melhor));
  }
  return out;
}

/** "YYYY-MM" válido. */
export function periodoValido(p: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(p);
}

/** Datas de sessão em vários formatos ("2026-01-05", "05/01/2026"): devolve "YYYY-MM-DD" ou "". */
export function dataIso(d: string) {
  const s = String(d ?? "").trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const pt = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
  if (pt) return `${pt[3]}-${pt[2]}-${pt[1]}`;
  return "";
}

export type DiaPresenca = { data: string; horasPrevistas: number; horasPresente: number };

/** Horas previstas e presentes do formando, por dia, nas sessões do mês com folha de presença. */
export function presencasNoMes(sessoes: SessaoComHoras[], formando: { id: number; nome?: string }, periodo: string): DiaPresenca[] {
  const nome = (formando.nome ?? "").trim().toLowerCase();
  const porDia = new Map<string, DiaPresenca>();
  for (const s of sessoes) {
    const data = dataIso(s.data);
    if (!data.startsWith(periodo)) continue;
    const dia = porDia.get(data) ?? { data, horasPrevistas: 0, horasPresente: 0 };
    dia.horasPrevistas += s.horas;
    const m = s.marcas.find(x => x.id === formando.id)
      ?? (nome ? s.marcas.find(x => !Number.isFinite(x.id) && (x.nome ?? "").trim().toLowerCase() === nome) : undefined);
    if (m) {
      const estado = estadoDaMarca(m);
      if (estado === "presente") dia.horasPresente += s.horas;
      else if (estado === "atraso") dia.horasPresente += Math.max(0, s.horas - Math.min(s.horas, (m.minutos ?? 0) / 60));
      // Faltas (justificadas ou não) não dão direito a apoios ligados à presença.
    }
    porDia.set(data, dia);
  }
  return [...porDia.values()]
    .map(d => ({ ...d, horasPrevistas: r2(d.horasPrevistas), horasPresente: r2(d.horasPresente) }))
    .sort((a, b) => a.data.localeCompare(b.data));
}

export type LinhaCalculo = {
  tipo: TipoApoio;
  rotulo: string;
  modo: ModoApoio;
  dias: number;
  horas: number;
  valor: number;
  /** Valor antes do teto mensal. */
  valorBruto: number;
  aplicadoTeto: boolean;
  /** Motivo pelo qual não há direito (valor 0), ou "". */
  exclusao: string;
  bloqueadoIban: boolean;
  ambito: RegraApoio["ambito"];
};

export type CalculoMes = {
  periodo: string;
  horasPrevistas: number;
  horasPresente: number;
  /** Percentagem de presença no mês, sobre as sessões com folha. */
  assiduidade: number | null;
  diasComPresenca: number;
  temIban: boolean;
  linhas: LinhaCalculo[];
  total: number;
};

/** Apoios devidos a um formando num mês, com o detalhe de cada tipo. */
export function calcularMes(
  regras: RegraApoio[],
  dias: DiaPresenca[],
  periodo: string,
  temIban: boolean,
): CalculoMes {
  const horasPrevistas = r2(dias.reduce((s, d) => s + d.horasPrevistas, 0));
  const horasPresente = r2(dias.reduce((s, d) => s + d.horasPresente, 0));
  const assiduidade = horasPrevistas > 0 ? Math.round((horasPresente / horasPrevistas) * 1000) / 10 : null;
  const diasComPresenca = dias.filter(d => d.horasPresente > 0).length;
  const linhas: LinhaCalculo[] = regras.filter(r => r.ativo).map(r => {
    let diasConta = 0;
    let horasConta = 0;
    let bruto = 0;
    if (r.modo === "hora") {
      horasConta = horasPresente;
      diasConta = diasComPresenca;
      bruto = r.valor * horasPresente;
    } else if (r.modo === "dia") {
      const validos = dias.filter(d => d.horasPresente > 0 && d.horasPresente >= r.minHorasDia);
      diasConta = validos.length;
      horasConta = r2(validos.reduce((s, d) => s + d.horasPresente, 0));
      bruto = r.valor * diasConta;
    } else {
      diasConta = diasComPresenca;
      horasConta = horasPresente;
      bruto = diasComPresenca > 0 ? r.valor : 0;
    }
    bruto = r2(bruto);
    let exclusao = "";
    if (!dias.length) exclusao = "Sem sessões com folha de presença neste mês.";
    else if (r.assiduidadeMinima != null && (assiduidade ?? 0) < r.assiduidadeMinima) {
      exclusao = `Assiduidade ${assiduidade ?? 0}% abaixo do mínimo de ${r.assiduidadeMinima}%.`;
    } else if (bruto === 0 && r.modo === "dia" && r.minHorasDia > 0) {
      exclusao = `Nenhum dia com pelo menos ${r.minHorasDia} h de presença.`;
    }
    const teto = r.tetoMensal;
    const comTeto = teto != null && bruto > teto ? teto : bruto;
    const valor = exclusao ? 0 : r2(comTeto);
    const bloqueadoIban = r.requerIban && !temIban && valor > 0;
    return {
      tipo: r.tipo,
      rotulo: ROTULO_APOIO[r.tipo],
      modo: r.modo,
      dias: diasConta,
      horas: r2(horasConta),
      valor,
      valorBruto: bruto,
      aplicadoTeto: !exclusao && teto != null && bruto > teto,
      exclusao,
      bloqueadoIban,
      ambito: r.ambito,
    };
  });
  return {
    periodo,
    horasPrevistas,
    horasPresente,
    assiduidade,
    diasComPresenca,
    temIban,
    linhas,
    total: r2(linhas.reduce((s, l) => s + (l.bloqueadoIban ? 0 : l.valor), 0)),
  };
}

/** Sessões da turma com as horas e as marcas de presença. */
export function sessoesDaTurma(cronograma: unknown, folhas: { sessao_n: number; presencas: unknown }[]) {
  return sessoesComHoras(cronograma, folhas.map(f => ({ sessao_n: Number(f.sessao_n), presencas: f.presencas })));
}

/** Meses ("YYYY-MM") com sessões no cronograma da turma, do mais recente para o mais antigo. */
export function mesesDaTurma(sessoes: SessaoComHoras[]) {
  const set = new Set(sessoes.map(s => dataIso(s.data).slice(0, 7)).filter(Boolean));
  return [...set].sort().reverse();
}

// ── IBAN ──────────────────────────────────────────────────────────────────────

/** Normaliza (sem espaços, maiúsculas) e valida pelo controlo mod-97 (ISO 13616). */
export function validarIban(raw: string): { ok: true; iban: string } | { ok: false; erro: string } {
  const iban = String(raw ?? "").replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return { ok: false, erro: "IBAN com formato inválido." };
  if (iban.startsWith("PT") && iban.length !== 25) return { ok: false, erro: "Um IBAN português tem 25 caracteres." };
  const rearranjado = iban.slice(4) + iban.slice(0, 4);
  let resto = 0;
  for (const ch of rearranjado) {
    const v = ch >= "A" && ch <= "Z" ? String(ch.charCodeAt(0) - 55) : ch;
    for (const d of v) resto = (resto * 10 + Number(d)) % 97;
  }
  if (resto !== 1) return { ok: false, erro: "IBAN inválido (dígitos de controlo errados)." };
  return { ok: true, iban };
}

/** IBAN mascarado para mostrar: "PT50 •••• •••• •••• •••• 1234 5". */
export function mascararIban(iban: string) {
  if (!iban) return "";
  const fim = iban.slice(-5);
  return `${iban.slice(0, 4)} •••• •••• •••• •••• ${fim.slice(0, 4)} ${fim.slice(4)}`.trim();
}

export function ibanDe(enc: string | undefined) {
  if (!enc) return "";
  try {
    return decryptField(enc);
  } catch {
    return "";
  }
}

/** Transições de estado permitidas. */
export const TRANSICOES: Record<string, string[]> = {
  calculado: ["aprovado", "anulado"],
  aprovado: ["pago", "calculado", "anulado"],
  pago: ["aprovado"],
  anulado: ["calculado"],
};
