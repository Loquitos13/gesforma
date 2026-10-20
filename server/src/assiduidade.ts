import { minutosSessao } from "./relatorioFinal.js";
import { sessaoLectivaN } from "./sessaoAcesso.js";

/**
 * Assiduidade por formando, em horas, a partir das folhas de presença de cada sessão.
 * A sessão n da folha é a sessão lectiva n do cronograma (a mesma regra do registo do sumário),
 * e a duração vem das horas da sessão — nunca da posição na lista de folhas gravadas.
 */

export type EstadoPresenca = "presente" | "falta_justificada" | "falta_injustificada" | "atraso";

export type MarcaPresenca = {
  id: number;
  nome?: string;
  presente?: boolean;
  estado?: EstadoPresenca;
  /** Minutos em falta numa sessão com atraso ou saída antecipada. */
  minutos?: number;
  justificacao?: string;
};

const ESTADOS = new Set<EstadoPresenca>(["presente", "falta_justificada", "falta_injustificada", "atraso"]);

/** Folhas antigas só têm `presente`: verdadeiro é presente, falso é falta injustificada. */
export function estadoDaMarca(m: Partial<MarcaPresenca>): EstadoPresenca {
  if (m.estado && ESTADOS.has(m.estado)) return m.estado;
  return m.presente === false ? "falta_injustificada" : "presente";
}

export type FolhaSessao = { sessao_n: number; presencas: unknown };

export type SessaoComHoras = { n: number; data: string; horas: number; marcas: MarcaPresenca[] };

function asArr(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p : [];
    } catch { return []; }
  }
  return [];
}

function marcas(raw: unknown): MarcaPresenca[] {
  return asArr(raw).flatMap(x => {
    if (!x || typeof x !== "object") return [];
    const o = x as Record<string, unknown>;
    return [{
      id: Number(o.id),
      nome: o.nome == null ? undefined : String(o.nome),
      presente: typeof o.presente === "boolean" ? o.presente : undefined,
      estado: typeof o.estado === "string" ? o.estado as EstadoPresenca : undefined,
      minutos: Number.isFinite(Number(o.minutos)) ? Number(o.minutos) : undefined,
    }];
  });
}

/** Sessões lectivas do cronograma (presencial e síncrona), com a duração em horas. */
export function sessoesLectivas(cronograma: unknown) {
  const out: { n: number; data: string; horas: number }[] = [];
  for (let n = 1; n <= 2000; n++) {
    const s = sessaoLectivaN(cronograma, n);
    if (!s) break;
    out.push({ n, data: String(s.data ?? ""), horas: minutosSessao(s.horaInicio, s.horaFim) / 60 });
  }
  return out;
}

export function sessoesComHoras(cronograma: unknown, folhas: FolhaSessao[]): SessaoComHoras[] {
  const porN = new Map(folhas.map(f => [Number(f.sessao_n), marcas(f.presencas)]));
  return sessoesLectivas(cronograma).map(s => ({ ...s, marcas: porN.get(s.n) ?? [] }));
}

export type Assiduidade = {
  horasPrevistas: number;
  horasRegistadas: number;
  horasPresente: number;
  horasFaltaJustificada: number;
  horasFaltaInjustificada: number;
  /** Percentagem sobre as horas previstas do cronograma (o que conta para o certificado). */
  pct: number | null;
  /** Percentagem só sobre as sessões com folha (para acompanhar durante a acção). */
  pctRegistado: number | null;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export function assiduidadeDoFormando(
  formando: { id: number; nome?: string },
  sessoes: SessaoComHoras[],
  opts: { justificadasContam: boolean },
): Assiduidade {
  const nome = (formando.nome ?? "").trim().toLowerCase();
  let previstas = 0;
  let registadas = 0;
  let presente = 0;
  let just = 0;
  let injust = 0;
  for (const s of sessoes) {
    previstas += s.horas;
    const m = s.marcas.find(x => x.id === formando.id)
      ?? (nome ? s.marcas.find(x => !Number.isFinite(x.id) && (x.nome ?? "").trim().toLowerCase() === nome) : undefined);
    if (!m) continue;
    registadas += s.horas;
    const estado = estadoDaMarca(m);
    if (estado === "presente") presente += s.horas;
    else if (estado === "atraso") {
      const falta = Math.min(s.horas, Math.max(0, (m.minutos ?? 0) / 60));
      presente += s.horas - falta;
      injust += falta;
    } else if (estado === "falta_justificada") just += s.horas;
    else injust += s.horas;
  }
  const contadas = presente + (opts.justificadasContam ? just : 0);
  return {
    horasPrevistas: r2(previstas),
    horasRegistadas: r2(registadas),
    horasPresente: r2(presente),
    horasFaltaJustificada: r2(just),
    horasFaltaInjustificada: r2(injust),
    pct: previstas > 0 ? Math.round((contadas / previstas) * 1000) / 10 : null,
    pctRegistado: registadas > 0 ? Math.round((contadas / registadas) * 1000) / 10 : null,
  };
}
